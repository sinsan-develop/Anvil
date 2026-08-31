"""C-13 third-valid-failure Main Agent takeover coordinator.

The coordinator is deliberately in-memory and has no external side effects.
All identity and fencing checks happen before the single mutation section,
which is protected by a lock so a replay or concurrent caller cannot create a
second takeover or leave two active write leases behind.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from threading import RLock
from typing import Any

from packages.leases import LeaseService, StaleFencingToken
from packages.tool_gateway import ToolPermissionRegistry

from .developer_lifecycle import DeveloperLifecycleService, LifecycleStatus
from .failure_ledger import FailureLedger, FailureLedgerReceipt
from .result_envelope import canonical_hash


class TakeoverReasonCode(StrEnum):
    COUNT_BELOW_THREE = "COUNT_BELOW_THREE"
    INVALID_LEDGER_RECEIPT = "INVALID_LEDGER_RECEIPT"
    STALE_LINEAGE = "STALE_LINEAGE"
    STALE_FENCING_TOKEN = "STALE_FENCING_TOKEN"
    DUPLICATE_TAKEOVER = "DUPLICATE_TAKEOVER"
    UNKNOWN_SESSION = "UNKNOWN_SESSION"
    SESSION_IDENTITY_MISMATCH = "SESSION_IDENTITY_MISMATCH"
    TAKEOVER_ALREADY_REQUIRED = "TAKEOVER_ALREADY_REQUIRED"


@dataclass(frozen=True, slots=True)
class TakeoverPacket:
    takeover_id: str
    step_lineage_id: str
    failure_fingerprint: str
    trigger_type: str
    actor: str
    report_ids: tuple[str, ...]
    delegation_id: str
    session_id: str
    packet_hash: str
    status: str = "MAIN_AGENT_TAKEOVER_REQUIRED"

    def to_dict(self) -> dict[str, Any]:
        return {
            "takeover_id": self.takeover_id,
            "step_lineage_id": self.step_lineage_id,
            "failure_fingerprint": self.failure_fingerprint,
            "trigger_type": self.trigger_type,
            "actor": self.actor,
            "report_ids": list(self.report_ids),
            "delegation_id": self.delegation_id,
            "session_id": self.session_id,
            "packet_hash": self.packet_hash,
            "status": self.status,
        }


@dataclass(frozen=True, slots=True)
class TakeoverAudit:
    event_id: str
    event_type: str
    takeover_id: str
    step_lineage_id: str
    failure_fingerprint: str
    report_ids: tuple[str, ...]
    lease_released: bool
    tools_revoked: bool


@dataclass(frozen=True, slots=True)
class TakeoverReceipt:
    accepted: bool
    duplicate: bool = False
    reason_codes: tuple[str, ...] = ()
    packet: TakeoverPacket | None = None
    audit: TakeoverAudit | None = None


class MainAgentTakeoverService:
    """Perform the mandatory C-13 stop/revoke/packet transition."""

    def __init__(self, ledger: FailureLedger, lifecycle: DeveloperLifecycleService,
                 leases: LeaseService, tools: ToolPermissionRegistry | None = None) -> None:
        self._ledger = ledger
        self._lifecycle = lifecycle
        self._leases = leases
        self._tools = tools or ToolPermissionRegistry()
        self._lock = RLock()
        self._packets: dict[str, TakeoverPacket] = {}
        self._audits: list[TakeoverAudit] = []

    @property
    def packets(self) -> tuple[TakeoverPacket, ...]:
        with self._lock:
            return tuple(self._packets.values())

    @property
    def audits(self) -> tuple[TakeoverAudit, ...]:
        with self._lock:
            return tuple(self._audits)

    def takeover(self, receipt: FailureLedgerReceipt, *, session_id: str,
                 expected_lineage: str, expected_fingerprint: str,
                 execution_fencing_token: str | None = None) -> TakeoverReceipt:
        """Take over exactly the ledger's third valid failure.

        The supplied receipt is treated as an opaque capability: its immutable
        entry must still match the ledger projection and current session.
        """
        with self._lock:
            if not isinstance(receipt, FailureLedgerReceipt) or not receipt.accepted or receipt.entry is None:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_LEDGER_RECEIPT.value,))
            entry = receipt.entry
            key = f"{entry.step_lineage_id}|{entry.failure_fingerprint}"
            # A first/second valid receipt is an intentional no-op.  Decide
            # this before checking the projection's latest result, because a
            # later report may already exist in the same ledger.
            if entry.valid_failure_count < 3 or not entry.takeover_required:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.COUNT_BELOW_THREE.value,))
            if entry.valid_failure_count > 3:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.TAKEOVER_ALREADY_REQUIRED.value,))
            projection = self._ledger.get(key)
            if projection is None or projection.latest_result_id != entry.result_id:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_LINEAGE.value,))
            if (entry.step_lineage_id, entry.failure_fingerprint) != (expected_lineage, expected_fingerprint):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_LINEAGE.value,))
            takeover_id = f"takeover:{key}"
            prior = self._packets.get(takeover_id)
            if prior is not None:
                return TakeoverReceipt(True, duplicate=True, reason_codes=(TakeoverReasonCode.DUPLICATE_TAKEOVER.value,), packet=prior,
                                       audit=next(item for item in self._audits if item.takeover_id == takeover_id))
            try:
                current = self._lifecycle.current(session_id)
            except KeyError:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.UNKNOWN_SESSION.value,))
            if current.session_id != session_id:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.SESSION_IDENTITY_MISMATCH.value,))
            if execution_fencing_token is not None:
                try:
                    # require_current is a pure check; an arbitrary write token
                    # is not needed because revoke_run fences the worker token.
                    worker = next((w for w in self._leases._workers.values() if w.run_id == session_id), None)
                    if worker is None or worker.execution_fencing_token != execution_fencing_token:
                        raise StaleFencingToken("stale execution fencing token")
                except StaleFencingToken:
                    return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_FENCING_TOKEN.value,))

            report_ids = tuple(item.result_id for item in self._ledger.entries
                               if item.failure_key == key and item.accepted)
            # Mutation section: stop first, then revoke every capability, then
            # publish the immutable packet and audit as the final commit.
            self._lifecycle.stop(session_id)
            self._leases.revoke_run(session_id, execution_token=execution_fencing_token)
            self._tools.revoke(session_id)
            raw = {
                "takeover_id": takeover_id, "step_lineage_id": expected_lineage,
                "failure_fingerprint": expected_fingerprint, "trigger_type": "THIRD_VALID_FAILURE",
                "actor": "MAIN_AGENT", "report_ids": list(report_ids),
                "delegation_id": current.delegation_id, "session_id": session_id,
                "status": "MAIN_AGENT_TAKEOVER_REQUIRED",
            }
            packet_hash = canonical_hash(raw)
            packet = TakeoverPacket(takeover_id, expected_lineage, expected_fingerprint,
                                    "THIRD_VALID_FAILURE", "MAIN_AGENT", report_ids,
                                    current.delegation_id, session_id, packet_hash)
            audit = TakeoverAudit(
                event_id=f"evt_{takeover_id}", event_type="MainAgentTakeoverRequired",
                takeover_id=takeover_id, step_lineage_id=expected_lineage,
                failure_fingerprint=expected_fingerprint, report_ids=report_ids,
                lease_released=True, tools_revoked=True,
            )
            self._packets[takeover_id] = packet
            self._audits.append(audit)
            return TakeoverReceipt(True, packet=packet, audit=audit)


TakeoverService = MainAgentTakeoverService

__all__ = ["TakeoverReasonCode", "TakeoverPacket", "TakeoverAudit", "TakeoverReceipt", "MainAgentTakeoverService", "TakeoverService"]
