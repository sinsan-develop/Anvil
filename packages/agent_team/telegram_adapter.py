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
from urllib.parse import urlparse
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
    if not path.startswith("/") or path.startswith("//") or "\\" in path or "\n" in path:
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

    def __post_init__(self) -> None:
        for value, field in ((self.command_id, "command_id"), (self.chat_id, "chat_id"), (self.user_id, "user_id"), (self.command, "command"), (self.nonce, "nonce"), (self.signature, "signature")):
            _text(value, field)
        _utc(self.issued_at, "issued_at"); _utc(self.expires_at, "expires_at")
        if self.expires_at <= self.issued_at:
            raise ValueError("expires_at must be after issued_at")
        if not isinstance(self.parameters, tuple) or any(not isinstance(pair, tuple) or len(pair) != 2 or any(not isinstance(v, str) for v in pair) for pair in self.parameters):
            raise ValueError("parameters must be tuple pairs")


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
        audit = AuditEvent(f"telegram-audit-{len(self._audits) + 1}", command_id, operator_id, "telegram", outcome.value, now)
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
        claimed = update.nonce not in self._seen and update.command_id not in self._seen
        if claimed and self._state_store is not None:
            claimed = self._state_store.claim_update(
                nonce=update.nonce, command_id=update.command_id,
                chat_id=update.chat_id, user_id=update.user_id,
                first_seen_at=now, expires_at=update.expires_at,
            )
        if not claimed:
            audit = self._audit(update, TelegramOutcome.REPLAYED, now)
            return TelegramResult(False, "이미 처리된 명령입니다.", TelegramOutcome.REPLAYED, audit)
        self._seen.update((update.nonce, update.command_id))
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
