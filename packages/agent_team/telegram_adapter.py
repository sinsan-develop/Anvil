"""Transport-neutral Telegram supplementary adapter.

This module deliberately contains no Telegram SDK or network calls.  It turns
signed Telegram-shaped updates into safe domain outcomes and links operators
back to the Web Console, which remains the authority for approvals.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
import hashlib
import hmac
import json
import re
from threading import Lock
from uuid import uuid4
from urllib.parse import unquote, urlparse
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from packages.persistence.telegram_webhook import TelegramStateStore

from .remote_control import ApprovalRequest, ApprovalState, AuditEvent, CommandKind, OperatorCommand


LOW_RISK = frozenset({"status", "pause", "resume", "request-status"})
APPROVAL_COMMANDS = frozenset({"merge", "deploy", "delete", "change-permissions", "change-provider-credentials"})


def _text(value: str, field: str) -> None:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _utc(value: datetime, field: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None or value.utcoffset().total_seconds() != 0:
        raise ValueError(f"{field} must be timezone-aware UTC")


def _safe_path(path: str) -> str:
    _text(path, "console_path")
    parsed = urlparse(path)
    segments = [unquote(segment) for segment in parsed.path.split("/")]
    if (
        not path.startswith("/") or path.startswith("//") or "\\" in path or "\n" in path
        or parsed.path != path or parsed.query or parsed.fragment
        or any(segment in {".", ".."} for segment in segments)
        or any(ord(char) < 0x20 for char in path)
    ):
        raise ValueError("console_path must be a relative Web Console path")
    return path


def _console_origin(value: str) -> str:
    """Validate and return an origin-only Web Console base URL."""
    _text(value, "console_base_url")
    parsed = urlparse(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.path != ""
        or parsed.params
        or parsed.query
        or parsed.fragment
        or parsed.username is not None
        or parsed.password is not None
    ):
        raise ValueError("console_base_url must be an HTTP(S) origin with no path, query, or fragment")
    return value.rstrip("/")


class TelegramOutcome(str, Enum):
    ACCEPTED = "ACCEPTED"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    MALFORMED = "MALFORMED"
    REPLAYED = "REPLAYED"
    EXPIRED = "EXPIRED"
    UNAUTHORIZED = "UNAUTHORIZED"
    FUTURE_DATED = "FUTURE_DATED"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    UNSUPPORTED = "UNSUPPORTED"


@dataclass(frozen=True, slots=True)
class TelegramNotification:
    event_id: str
    title: str
    body: str
    console_path: str

    def __post_init__(self) -> None:
        for value, field in ((self.event_id, "event_id"), (self.title, "title"), (self.body, "body")):
            _text(value, field)
        _safe_path(self.console_path)


@dataclass(frozen=True, slots=True)
class TelegramUpdate:
    command_id: str
    chat_id: str
    user_id: str
    command: str
    issued_at: datetime
    expires_at: datetime
    nonce: str
    signature: str
    parameters: tuple[tuple[str, str], ...] = ()
    actor_id: str = ""
    device_id: str = "telegram"
    session_id: str = ""

    def __post_init__(self) -> None:
        for value, field in ((self.command_id, "command_id"), (self.chat_id, "chat_id"), (self.user_id, "user_id"), (self.command, "command"), (self.nonce, "nonce"), (self.signature, "signature")):
            _text(value, field)
        _utc(self.issued_at, "issued_at"); _utc(self.expires_at, "expires_at")
        if self.expires_at <= self.issued_at:
            raise ValueError("expires_at must be after issued_at")
        if not isinstance(self.parameters, tuple) or any(not isinstance(pair, tuple) or len(pair) != 2 or any(not isinstance(v, str) for v in pair) for pair in self.parameters):
            raise ValueError("parameters must be tuple pairs")
        for key, value in self.parameters:
            _text(key, "parameters.key")
            _text(value, "parameters.value")
        if tuple(sorted(self.parameters)) != self.parameters or len({pair[0] for pair in self.parameters}) != len(self.parameters):
            raise ValueError("parameters must use sorted unique canonical keys")
        if self.actor_id and (not isinstance(self.actor_id, str) or self.actor_id != self.actor_id.strip()):
            raise ValueError("actor_id must be canonical")
        _text(self.device_id, "device_id")
        if self.session_id and (not isinstance(self.session_id, str) or self.session_id != self.session_id.strip()):
            raise ValueError("session_id must be canonical")


@dataclass(frozen=True, slots=True)
class TelegramResult:
    accepted: bool
    text: str
    outcome: TelegramOutcome
    audit: AuditEvent
    approval: ApprovalRequest | None = None


def notification_text(notification: TelegramNotification, console_base_url: str) -> str:
    """Format a notification with a Web Console deep link and no credentials."""
    link = _console_origin(console_base_url) + _safe_path(notification.console_path)
    return f"{notification.title}\n{notification.body}\n상세 보기: {link}"


class TelegramAdapter:
    """Validate Telegram updates; optional state store makes replay/audit durable."""

    def __init__(self, *, allowlisted_identities: frozenset[tuple[str, str]], signing_secret: str, console_base_url: str, state_store: "TelegramStateStore | None" = None) -> None:
        if not isinstance(allowlisted_identities, frozenset) or any(not isinstance(pair, tuple) or len(pair) != 2 or any(not isinstance(v, str) or not v.strip() for v in pair) for pair in allowlisted_identities):
            raise ValueError("allowlisted_identities must be a frozenset of (chat_id, user_id)")
        _text(signing_secret, "signing_secret")
        normalized_console_base_url = _console_origin(console_base_url)
        self._allowlist = allowlisted_identities
        self._secret = signing_secret
        self._console_base_url = normalized_console_base_url
        self._state_store = state_store
        self._seen: set[str] = set()
        self._seen_lock = Lock()
        self._audits: tuple[AuditEvent, ...] = ()

    @property
    def audits(self) -> tuple[AuditEvent, ...]:
        return self._audits

    def attach_state_store(self, state_store: "TelegramStateStore") -> None:
        """Attach the process-wide durable store before serving requests."""
        if self._state_store is not None and self._state_store is not state_store:
            raise ValueError("a Telegram state store is already attached")
        self._state_store = state_store

    @staticmethod
    def canonical_payload(update: TelegramUpdate) -> str:
        # JSON gives fields and parameter boundaries an unambiguous canonical form.
        return json.dumps(
            {
                "chat_id": update.chat_id,
                "command": update.command,
                "command_id": update.command_id,
                "expires_at": update.expires_at.isoformat(),
                "issued_at": update.issued_at.isoformat(),
                "nonce": update.nonce,
                "parameters": update.parameters,
                "user_id": update.user_id,
                "actor_id": update.actor_id,
                "device_id": update.device_id,
                "session_id": update.session_id,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        )

    @classmethod
    def sign(cls, update: TelegramUpdate, secret: str) -> str:
        _text(secret, "secret")
        return hmac.new(secret.encode(), cls.canonical_payload(update).encode(), hashlib.sha256).hexdigest()

    def _audit(self, update: TelegramUpdate | None, outcome: TelegramOutcome, now: datetime) -> AuditEvent:
        command_id = update.command_id if update is not None and isinstance(update.command_id, str) and update.command_id.strip() else "malformed"
        operator_id = update.user_id if update is not None and isinstance(update.user_id, str) and update.user_id.strip() else "unknown"
        details = ()
        if update is not None:
            details = tuple((key, value) for key, value in (
                ("actor_id", update.actor_id or update.user_id),
                ("device_id", update.device_id),
                ("session_id", update.session_id or "telegram"),
            ) if value)
        audit = AuditEvent(f"telegram-audit-{uuid4().hex}", command_id, operator_id, "telegram", outcome.value, now, details)
        self._audits += (audit,)
        if self._state_store is not None:
            self._state_store.record_audit(
                audit_id=audit.audit_id, command_id=audit.command_id,
                operator_id=audit.operator_id, source=audit.action,
                outcome=audit.outcome, occurred_at=audit.recorded_at,
            )
        return audit

    def process(self, update: TelegramUpdate, *, now: datetime) -> TelegramResult:
        _utc(now, "now")
        if not isinstance(update, TelegramUpdate):
            audit = self._audit(None, TelegramOutcome.MALFORMED, now)
            return TelegramResult(False, "업데이트 형식이 올바르지 않습니다.", TelegramOutcome.MALFORMED, audit)
        try:
            command = update.command.removeprefix("/").strip().lower()
            if command != update.command.removeprefix("/").strip() or not command:
                raise ValueError
        except (AttributeError, ValueError):
            audit = self._audit(update, TelegramOutcome.MALFORMED, now)
            return TelegramResult(False, "명령 형식이 올바르지 않습니다.", TelegramOutcome.MALFORMED, audit)
        if (update.chat_id, update.user_id) not in self._allowlist:
            audit = self._audit(update, TelegramOutcome.UNAUTHORIZED, now)
            return TelegramResult(False, "허용되지 않은 사용자입니다.", TelegramOutcome.UNAUTHORIZED, audit)
        if update.issued_at > now:
            audit = self._audit(update, TelegramOutcome.FUTURE_DATED, now)
            return TelegramResult(False, "미래 시각의 명령은 거부되었습니다.", TelegramOutcome.FUTURE_DATED, audit)
        if update.expires_at <= now:
            audit = self._audit(update, TelegramOutcome.EXPIRED, now)
            return TelegramResult(False, "만료된 명령입니다.", TelegramOutcome.EXPIRED, audit)
        expected = self.sign(update, self._secret)
        if not hmac.compare_digest(update.signature, expected):
            audit = self._audit(update, TelegramOutcome.INVALID_SIGNATURE, now)
            return TelegramResult(False, "서명 검증에 실패했습니다.", TelegramOutcome.INVALID_SIGNATURE, audit)
        with self._seen_lock:
            claimed = update.nonce not in self._seen and update.command_id not in self._seen
            if claimed and self._state_store is not None:
                claimed = self._state_store.claim_update(
                    nonce=update.nonce, command_id=update.command_id,
                    chat_id=update.chat_id, user_id=update.user_id,
                    first_seen_at=now, expires_at=update.expires_at,
                )
            if claimed:
                self._seen.update((update.nonce, update.command_id))
        if not claimed:
            audit = self._audit(update, TelegramOutcome.REPLAYED, now)
            return TelegramResult(False, "이미 처리된 명령입니다.", TelegramOutcome.REPLAYED, audit)
        if command in APPROVAL_COMMANDS:
            kind = CommandKind(command)
            operator_command = OperatorCommand(update.command_id, update.user_id, kind, update.issued_at, update.expires_at, update.nonce, "telegram-redacted")
            request = ApprovalRequest(f"telegram-approval-{len(self._audits) + 1}", operator_command, update.user_id, "Telegram 명령은 Leader/Main 승인 후 Web Console에서 실행", now)
            audit = self._audit(update, TelegramOutcome.APPROVAL_REQUIRED, now)
            link = self._console_base_url + "/approvals/" + request.request_id
            return TelegramResult(False, f"승인이 필요한 명령입니다. Web Console에서 검토하세요: {link}", TelegramOutcome.APPROVAL_REQUIRED, audit, request)
        if command not in LOW_RISK:
            audit = self._audit(update, TelegramOutcome.UNSUPPORTED, now)
            return TelegramResult(False, "지원하지 않는 명령입니다.", TelegramOutcome.UNSUPPORTED, audit)
        audit = self._audit(update, TelegramOutcome.ACCEPTED, now)
        return TelegramResult(True, f"명령을 접수했습니다: {command}", TelegramOutcome.ACCEPTED, audit)


# C26 is additive: the legacy signed adapter and persistence contract above are
# unchanged. This path only consumes sanitized host observations and C25 refs.
from threading import RLock as _GatewayLock
from packages.provider_catalog.models import Snapshot as _GatewaySnapshot
from .provider_catalog import _c24_hash as _gateway_hash, _c24_read as _gateway_read
from .sns_gateway import (SNSGateway, SNSMessageEnvelope, _id as _gateway_id,
    _integer as _gateway_integer, _value as _gateway_value, _ref as _gateway_ref,
    plain as _gateway_plain, utc as _gateway_utc)
from .orchestration import RoleTeamOrchestrator as _GatewayTeam


class TelegramGatewayAdapter:
    """Host-only Telegram -> C25 adapter; no token, signature or sender.

    Bindings are authenticated host observations, NOT payload authentication.
    C25 verifies current registered identity/role at admission and every replay.
    Pause/resume remain requests for Web Console, never queue/Runner mutations.
    """
    _UPDATE_FIELDS=frozenset({'update_id','chat_hash','user_hash','device_id','session_id','command',
        'nonce','idempotency_key','correlation_id','payload_ref','retention_seconds','issued_at','expires_at'})
    _LOW={'status':('STATUS',None),'request-status':('STATUS',None),
        'pause':('QUESTION','PAUSE'),'resume':('QUESTION','RESUME')}

    def __init__(self,gateway,*,team):
        if type(gateway) is not SNSGateway or type(team) is not _GatewayTeam:raise ValueError('CANONICAL_GATEWAY_REQUIRED')
        self._gateway=gateway;self._team=team;self._lock=_GatewayLock();self._bindings={};self._identities={};self._revoked=set()
        self._state=dict(updates={},audit=[],last_at=None)

    @staticmethod
    def _copy(value):
        return _GatewaySnapshot(value.kind,value.record_id,value.content_hash,value.payload_json)

    def capture_binding(self,binding_id,*,identity,chat_hash,user_hash,device_id,auth_observation_hash,now,expires_at):
        _gateway_id(binding_id);_gateway_id(device_id)
        for value in (chat_hash,user_hash,auth_observation_hash):_gateway_hash(value)
        now=_gateway_utc(now);expires_at=_gateway_utc(expires_at)
        try:
            data=_gateway_read(identity)
            required={'identity_id','external_actor_hash','internal_user','task_id','role','session_id','parent_task_id',
                'parent_run_id','baseline_hash','target_hash','tenant_id','project_id','assignment_hash','authn_hash','authz_hash',
                'commands','privacy','retention_seconds','issued_at','expires_at'}
            if identity.kind!='SNS_IDENTITY' or type(data) is not dict or set(data)!=required:raise ValueError()
            _gateway_plain(data)
            for key in ('internal_user','session_id','task_id','role','tenant_id','project_id'):_gateway_id(data[key])
            if data['external_actor_hash']!=user_hash:raise ValueError()
            start=_gateway_utc(datetime.fromisoformat(data['issued_at']))
            end=_gateway_utc(datetime.fromisoformat(data['expires_at']))
            if not start<=now<expires_at<=end:raise ValueError()
        except (ValueError,TypeError,KeyError):raise ValueError('BINDING_IDENTITY_INVALID') from None
        row=dict(chat_hash=chat_hash,user_hash=user_hash,device_id=device_id,session_id=data['session_id'],
            identity_hash=identity.content_hash,auth_observation_hash=auth_observation_hash,
            issued_at=now.isoformat(),expires_at=expires_at.isoformat(),
            authority='HOST_OBSERVATION_PENDING_GATEWAY_CHECK',transport='TELEGRAM',io_count=0)
        receipt=_gateway_value('TELEGRAM_BINDING',binding_id,row)
        with self._lock:
            if binding_id in self._revoked:raise ValueError('BINDING_REVOKED')
            prior=self._bindings.get(binding_id)
            if prior is not None and prior!=(receipt.content_hash,receipt.payload_json):raise ValueError('BINDING_REBIND')
            if prior is None and len(self._bindings)>=128:raise ValueError('BINDING_BOUND_EXCEEDED')
            self._bindings[binding_id]=(receipt.content_hash,receipt.payload_json)
            self._identities[binding_id]=self._copy(identity)
            return receipt

    def revoke_binding(self,binding_id):
        _gateway_id(binding_id)
        with self._lock:
            if binding_id not in self._bindings:raise ValueError('BINDING_INVALID')
            self._revoked.add(binding_id)

    def _binding(self,binding,now):
        try:
            row=_gateway_read(binding)
            if binding.kind!='TELEGRAM_BINDING' or self._bindings.get(binding.record_id)!=(binding.content_hash,binding.payload_json):
                raise ValueError()
        except (ValueError,TypeError):raise ValueError('BINDING_INVALID') from None
        if binding.record_id in self._revoked:raise ValueError('BINDING_REVOKED')
        if not row['issued_at']<=now.isoformat()<row['expires_at']:raise ValueError('BINDING_EXPIRED')
        return row,self._copy(self._identities[binding.record_id])

    def _update(self,update,mapping,now):
        if type(update) is not dict or any(type(k) is not str for k in update) or set(update)!=self._UPDATE_FIELDS:
            raise ValueError('TELEGRAM_UPDATE_INVALID')
        start=_gateway_utc(update['issued_at']);end=_gateway_utc(update['expires_at'])
        row=_gateway_plain(dict(update,issued_at=start.isoformat(),expires_at=end.isoformat()))
        _gateway_integer(row['update_id'],0,2**53-1)
        for key in ('chat_hash','user_hash'):_gateway_hash(row[key])
        for key in ('device_id','session_id','nonce','idempotency_key','correlation_id'):_gateway_id(row[key])
        for key in ('chat_hash','user_hash','device_id','session_id'):
            if row[key]!=mapping[key]:raise ValueError('TELEGRAM_IDENTITY_MISMATCH')
        if type(row['command']) is not str or re.fullmatch(r'/?[a-z][a-z-]{0,63}',row['command']) is None:
            raise ValueError('COMMAND_INVALID')
        row['command']=row['command'].removeprefix('/')
        if row['command'] not in self._LOW:raise ValueError('CONSOLE_STEP_UP_REQUIRED')
        if not start<=now<end or end>datetime.fromisoformat(mapping['expires_at']):raise ValueError('UPDATE_WINDOW_INVALID')
        row['payload_ref']=_gateway_ref(row['payload_ref'])
        _gateway_integer(row['retention_seconds'],1,86400)
        return row

    def _observation(self,identity,fence,now):
        who=_gateway_read(identity)
        self._team.mailbox(who['task_id'],actor_id=who['internal_user'],execution_fence=fence,now=now)
        projection=self._team.project();view=projection.to_dict();task=view['tasks'].get(who['task_id'])
        if (view['session']['session_id']!=who['session_id'] or view['session']['baseline_hash']!=who['baseline_hash']
            or view['target_hash']!=who['target_hash'] or task is None or task['assignment_hash']!=who['assignment_hash']):
            raise ValueError('STATUS_TRACE_MISMATCH')
        return dict(team_status=view['status'],task_status=task['status'],target_hash=view['target_hash'],
            baseline_hash=view['session']['baseline_hash'],projection_hash=projection.content_hash,observed_at=now.isoformat())

    def process(self,update,*,binding,execution_fence,now):
        now=_gateway_utc(now);_gateway_id(execution_fence)
        with self._lock:
            if self._state['last_at'] and now.isoformat()<self._state['last_at']:raise ValueError('PAST_EVENT')
            mapping,identity=self._binding(binding,now);row=self._update(update,mapping,now)
            observation=self._observation(identity,execution_fence,now)
            key=str(row['update_id'])
            fingerprint=_gateway_value('TELEGRAM_NORMALIZED',key,dict(update=row,binding_hash=binding.content_hash)).content_hash
            prior=self._state['updates'].get(key)
            if prior is not None:
                if prior['fingerprint']!=fingerprint:raise ValueError('UPDATE_REBIND')
                upstream=_GatewaySnapshot(*prior['gateway'])
                self._gateway.receipt(upstream,identity=identity,execution_fence=execution_fence,now=now)
                return _GatewaySnapshot(*prior['receipt'])
            if len(self._state['audit'])>=512:raise ValueError('AUDIT_BOUND_EXCEEDED')
            who=_gateway_read(identity);gateway_command,intent=self._LOW[row['command']]
            envelope=SNSMessageEnvelope(message_id='tg-'+key,channel='SNS',session_id=who['session_id'],task_id=who['task_id'],
                parent_task_id=who['parent_task_id'],external_actor_hash=who['external_actor_hash'],internal_user=who['internal_user'],
                tenant_id=who['tenant_id'],project_id=who['project_id'],role=who['role'],target_hash=who['target_hash'],
                baseline_hash=who['baseline_hash'],command=gateway_command,payload_ref=row['payload_ref'],
                correlation_id='tg-'+fingerprint.removeprefix('sha256:'),idempotency_key=row['idempotency_key'],
                replay_nonce=row['nonce'],attempt=1,privacy='PRIVATE',retention_seconds=row['retention_seconds'],
                issued_at=datetime.fromisoformat(row['issued_at']),expires_at=datetime.fromisoformat(row['expires_at']))
            # C25 may durably record an admission before local projection fails.
            # Never undo that owner's audit: exact retries recover the same ref.
            upstream=self._gateway.receive(envelope,identity=identity,execution_fence=execution_fence,now=now)
            receipt=_gateway_value('TELEGRAM_RECEIPT','tg-'+key,dict(status='REQUESTED_NOT_APPLIED' if intent else 'STATUS_REQUESTED',
                delivery='NOT_EXECUTED',requested_control=intent,gateway_command=gateway_command,
                session_id=who['session_id'],device_id=row['device_id'],binding_hash=binding.content_hash,
                observed_status=observation,
                update_hash=fingerprint,gateway_receipt_hash=upstream.content_hash,correlation_id=row['correlation_id'],
                console_link='/sessions/'+who['session_id'],runner_dispatch=0,io_count=0,automatic_acceptance=False,
                expires_at=row['expires_at'],unverified=['Telegram/auth/network NOT_EXECUTED']))
            # Recheck registered role, binding, receipt and expiry after all DTO
            # preparation, then publish one callback-free local state pointer.
            self._gateway.receipt(upstream,identity=identity,execution_fence=execution_fence,now=now)
            self._binding(binding,now)
            if self._observation(identity,execution_fence,now)!=observation:raise ValueError('STATUS_OBSERVATION_DRIFT')
            events=self._state['audit']+[dict(sequence=len(self._state['audit'])+1,receipt_hash=receipt.content_hash,
                status=receipt.to_dict()['status'],occurred_at=now.isoformat(),delivery='NOT_EXECUTED',io_count=0)]
            records=dict(self._state['updates']);records[key]=dict(fingerprint=fingerprint,
                gateway=(upstream.kind,upstream.record_id,upstream.content_hash,upstream.payload_json),
                receipt=(receipt.kind,receipt.record_id,receipt.content_hash,receipt.payload_json))
            self._state=dict(updates=records,audit=events,last_at=now.isoformat())
            return receipt

    def receipt(self,handle,*,binding,execution_fence,now):
        now=_gateway_utc(now);_gateway_id(execution_fence)
        with self._lock:
            _,identity=self._binding(binding,now)
            try:
                row=_gateway_read(handle)
                if handle.kind!='TELEGRAM_RECEIPT':raise ValueError()
                found=next((r for r in self._state['updates'].values() if r['receipt']==
                    (handle.kind,handle.record_id,handle.content_hash,handle.payload_json)),None)
                if found is None or row['binding_hash']!=binding.content_hash:raise ValueError()
            except (ValueError,TypeError):raise ValueError('RECEIPT_INVALID') from None
            self._gateway.receipt(_GatewaySnapshot(*found['gateway']),identity=identity,execution_fence=execution_fence,now=now)
            return self._copy(handle)

    def audit(self,*,offset=0,limit=50):
        _gateway_integer(offset,0,512);_gateway_integer(limit,1,50)
        with self._lock:
            return _gateway_value('TELEGRAM_AUDIT','audit',dict(events=self._state['audit'][offset:offset+limit],
                total=len(self._state['audit']),next_offset=offset+limit if offset+limit<len(self._state['audit']) else None,io_count=0))
