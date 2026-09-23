"""C27 contract drafts only: no Kakao protocol, credentials or gateway admission.

The shared C25 envelope is a declared, unverified trace, never actor authority.
Local draft throttling is not a claim about Kakao rate/quota. There is deliberately
no enable/authenticate/send method; resolving the external decisions is future work.
"""
from copy import deepcopy
from dataclasses import fields
from datetime import datetime, timedelta
import json
from threading import RLock

from .sns_gateway import SNSGateway, SNSMessageEnvelope, _id, _integer, _ref, _value, plain, utc
from .provider_catalog import _c24_hash, _c24_read


class KakaoContractAdapter:
    """Host-only bounded draft ledger, not a transport or permission owner."""

    def __init__(self, gateway, *, draft_limit=20, draft_window_seconds=60):
        if type(gateway) is not SNSGateway:
            raise ValueError('CANONICAL_GATEWAY_REQUIRED')
        # Do not call or retain a sender/driver or consume gateway authority.
        self._limit = _integer(draft_limit, 1, 1000)
        self._window = _integer(draft_window_seconds, 1, 3600)
        self._lock = RLock()
        self._state = dict(receipts={}, idem={}, nonces={}, messages={}, times=[], audit=[], last_at=None)

    def _clock(self, now):
        now = utc(now)
        if self._state['last_at'] and now.isoformat() < self._state['last_at']:
            raise ValueError('PAST_EVENT')
        return now

    def _envelope(self, envelope, now):
        if type(envelope) is not SNSMessageEnvelope:
            raise ValueError('ENVELOPE_REQUIRED')
        row = {f.name: getattr(envelope, f.name) for f in fields(SNSMessageEnvelope)}
        start, end = utc(row['issued_at']), utc(row['expires_at'])
        row['issued_at'], row['expires_at'] = start.isoformat(), end.isoformat()
        row = plain(row)  # Exact builtins before copy, serialization or hashing.
        for key in ('message_id', 'channel', 'session_id', 'task_id', 'internal_user', 'tenant_id',
                    'project_id', 'role', 'command', 'correlation_id', 'idempotency_key', 'replay_nonce'):
            _id(row[key])
        if row['parent_task_id'] is not None:
            _id(row['parent_task_id'])
        for key in ('external_actor_hash', 'target_hash', 'baseline_hash'):
            _c24_hash(row[key])
        if row['channel'] != 'KAKAO':
            raise ValueError('TRANSPORT_INVALID')
        if row['privacy'] != 'PRIVATE':
            raise ValueError('PRIVACY_DENIED')
        if type(row['attempt']) is not int or row['attempt'] != 1:
            raise ValueError('ATTEMPT_INVALID')
        _integer(row['retention_seconds'], 1, 86400)
        if not start <= now < end:
            raise ValueError('WINDOW_INVALID')
        if end - start > timedelta(seconds=row['retention_seconds']):
            raise ValueError('RETENTION_WINDOW_INVALID')
        row['payload_ref'] = _ref(row['payload_ref'])
        return row

    def project(self, envelope, *, now, direction='INBOUND'):
        """Publish an OPEN_DECISION draft. No receipt here permits any action."""
        if type(direction) is not str or direction not in ('INBOUND', 'OUTBOUND'):
            raise ValueError('DIRECTION_INVALID')
        now = utc(now)
        row = self._envelope(envelope, now)
        fingerprint = _value('KAKAO_DRAFT_INPUT', row['message_id'],
                             dict(envelope=row, direction=direction)).content_hash
        with self._lock:
            self._clock(now)
            old = self._state['idem'].get(row['idempotency_key'])
            if old:
                if old[0] != fingerprint:
                    raise ValueError('IDEMPOTENCY_CONFLICT')
                return _value('KAKAO_CONTRACT_RECEIPT', old[1], json.loads(self._state['receipts'][old[1]][1]))
            if row['replay_nonce'] in self._state['nonces']:
                raise ValueError('REPLAY_NONCE')
            if row['message_id'] in self._state['messages']:
                raise ValueError('MESSAGE_REBIND')
            recent = [t for t in self._state['times']
                      if now - datetime.fromisoformat(t) < timedelta(seconds=self._window)]
            if len(recent) >= self._limit:
                raise ValueError('LOCAL_DRAFT_RATE_LIMIT')
            if len(self._state['audit']) >= 512:
                raise ValueError('AUDIT_BOUND_EXCEEDED')
            low = row['command'] in ('STATUS', 'QUESTION', 'RESULT', 'PAUSE', 'RESUME')
            data = dict(status='OPEN_DECISION', allowed=False, delivery='NOT_EXECUTED',
                gateway_admission='NOT_EXECUTED', authority='UNVERIFIED_DECLARED_TRACE',
                observed_status=None, intent_status='DRAFT_NOT_APPLIED' if low else 'DENIED_HIGH_RISK',
                reason='KAKAO_EXTERNAL_CONTRACT_UNCONFIRMED' if low else 'CONSOLE_STEP_UP_REQUIRED',
                open_decisions=['API_CHANNEL', 'AUTH_WEBHOOK_SIGNATURE_TOKEN', 'ACTOR_MAPPING',
                                'RATE_QUOTA', 'MESSAGE_POLICY', 'OPERATING_ACCOUNT'],
                direction=direction, channel='KAKAO', command=row['command'],
                requested_control=row['command'] if row['command'] in ('PAUSE', 'RESUME') else None,
                trace={k: row[k] for k in ('session_id', 'task_id', 'parent_task_id', 'internal_user',
                       'external_actor_hash', 'tenant_id', 'project_id', 'role', 'target_hash', 'baseline_hash')},
                console_link='/sessions/' + row['session_id'], payload_ref=row['payload_ref'],
                correlation_id=row['correlation_id'], envelope_hash=fingerprint, attempt=1,
                receipt_ref=None, privacy='PRIVATE', retention_seconds=row['retention_seconds'],
                issued_at=now.isoformat(), expires_at=row['expires_at'],
                local_rate_contract='HOST_DRAFT_ONLY_NOT_PROVIDER_QUOTA',
                runner_dispatch=0, io_count=0, automatic_acceptance=False)
            receipt = _value('KAKAO_CONTRACT_RECEIPT', 'draft-' + row['message_id'], data)
            state = deepcopy(self._state)
            state['receipts'][receipt.record_id] = (receipt.content_hash, receipt.payload_json)
            state['idem'][row['idempotency_key']] = (fingerprint, receipt.record_id)
            state['messages'][row['message_id']] = receipt.record_id
            state['nonces'][row['replay_nonce']] = receipt.record_id
            state['times'] = recent + [now.isoformat()]
            state['audit'].append(dict(sequence=len(state['audit']) + 1, receipt_hash=receipt.content_hash,
                status='OPEN_DECISION', occurred_at=now.isoformat(), io_count=0))
            state['last_at'] = now.isoformat()
            self._state = state
            return receipt

    def receipt(self, handle, *, now):
        """Read a registered blocked draft; never validate Kakao identity."""
        with self._lock:
            now = self._clock(now)
            try:
                data = _c24_read(handle)
                if handle.kind != 'KAKAO_CONTRACT_RECEIPT' or self._state['receipts'].get(handle.record_id) != (handle.content_hash, handle.payload_json):
                    raise ValueError('RECEIPT_INVALID')
            except (ValueError, TypeError):
                raise ValueError('RECEIPT_INVALID') from None
            if now >= datetime.fromisoformat(data['expires_at']):
                raise ValueError('WINDOW_INVALID')
            return _value('KAKAO_CONTRACT_RECEIPT', handle.record_id, data)

    def audit(self, *, offset=0, limit=50):
        _integer(offset, 0, 512)
        _integer(limit, 1, 50)
        with self._lock:
            total = len(self._state['audit'])
            end = min(total, offset + limit)
            return _value('KAKAO_CONTRACT_AUDIT', 'audit', dict(events=self._state['audit'][offset:end],
                total=total, next_offset=end if end < total else None, io_count=0))
