"""C-13 third-valid-failure Main Agent takeover coordinator.

The coordinator is deliberately in-memory and has no external side effects.
All identity and fencing checks happen before the single mutation section,
which is protected by a lock so a replay or concurrent caller cannot create a
second takeover or leave two active write leases behind.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from contextlib import nullcontext
from threading import RLock
from typing import Any
import re
import unicodedata

from packages.leases import LeaseService
from packages.tool_gateway import ToolPermissionRegistry

from .developer_lifecycle import DeveloperLifecycleService, LifecycleStatus
from .failure_ledger import FailureLedger, FailureLedgerReceipt
from .result_envelope import canonical_hash


class TakeoverReasonCode(StrEnum):
    MISSING_FENCING_TOKEN = "MISSING_FENCING_TOKEN"
    COUNT_BELOW_THREE = "COUNT_BELOW_THREE"
    INVALID_LEDGER_RECEIPT = "INVALID_LEDGER_RECEIPT"
    STALE_LINEAGE = "STALE_LINEAGE"
    STALE_FENCING_TOKEN = "STALE_FENCING_TOKEN"
    DUPLICATE_TAKEOVER = "DUPLICATE_TAKEOVER"
    UNKNOWN_SESSION = "UNKNOWN_SESSION"
    SESSION_IDENTITY_MISMATCH = "SESSION_IDENTITY_MISMATCH"
    TAKEOVER_ALREADY_REQUIRED = "TAKEOVER_ALREADY_REQUIRED"
    MISSING_REFERENCE_BUNDLE = "MISSING_REFERENCE_BUNDLE"
    INVALID_REFERENCE_BUNDLE = "INVALID_REFERENCE_BUNDLE"
    INVALID_REFERENCE = "INVALID_REFERENCE"
    INVALID_REFERENCE_KIND = "INVALID_REFERENCE_KIND"
    INVALID_REFERENCE_CHECKSUM = "INVALID_REFERENCE_CHECKSUM"
    REFERENCE_HASH_MISMATCH = "REFERENCE_HASH_MISMATCH"
    BUNDLE_HASH_MISMATCH = "BUNDLE_HASH_MISMATCH"
    REFERENCE_IDENTITY_MISMATCH = "REFERENCE_IDENTITY_MISMATCH"
    WORK_INSTRUCTION_MISMATCH = "WORK_INSTRUCTION_MISMATCH"
    CHECKPOINT_MISMATCH = "CHECKPOINT_MISMATCH"
    FAILURE_REPORT_REFERENCE_MISMATCH = "FAILURE_REPORT_REFERENCE_MISMATCH"
    REFERENCE_BUNDLE_MISMATCH = "REFERENCE_BUNDLE_MISMATCH"
    MISSING_TRUSTED_EVIDENCE = "MISSING_TRUSTED_EVIDENCE"
    TRUSTED_EVIDENCE_MISMATCH = "TRUSTED_EVIDENCE_MISMATCH"
    TAKEOVER_TRANSACTION_FAILED = "TAKEOVER_TRANSACTION_FAILED"
    TAKEOVER_ROLLBACK_FAILED = "TAKEOVER_ROLLBACK_FAILED"
    UNSAFE_REPLAY_STATE = "UNSAFE_REPLAY_STATE"


@dataclass(frozen=True, slots=True)
class TakeoverArtifactReference:
    artifact_id: str
    kind: str
    checksum: str
    session_id: str
    delegation_id: str
    step_lineage_id: str
    binding_hash: str

    def binding_payload(self) -> dict[str, str]:
        return {
            "artifact_id": self.artifact_id,
            "kind": self.kind,
            "checksum": self.checksum,
            "session_id": self.session_id,
            "delegation_id": self.delegation_id,
            "step_lineage_id": self.step_lineage_id,
        }

    def to_dict(self) -> dict[str, str]:
        return {**self.binding_payload(), "binding_hash": self.binding_hash}


@dataclass(frozen=True, slots=True)
class TakeoverReferenceBundle:
    work_instruction: TakeoverArtifactReference
    diff: TakeoverArtifactReference
    test_output: TakeoverArtifactReference
    checkpoint: TakeoverArtifactReference
    failure_reports: tuple[TakeoverArtifactReference, ...]
    bundle_hash: str
    _shape_valid: bool = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        reports = self.failure_reports
        valid = type(reports) is tuple
        snapshot = tuple(reports) if valid else ()
        object.__setattr__(self, "failure_reports", snapshot)
        object.__setattr__(self, "_shape_valid", valid)

    def binding_payload(self) -> dict[str, Any]:
        return {
            "work_instruction": self.work_instruction.to_dict(),
            "diff": self.diff.to_dict(),
            "test_output": self.test_output.to_dict(),
            "checkpoint": self.checkpoint.to_dict(),
            "failure_reports": [item.to_dict() for item in self.failure_reports],
        }

    def to_dict(self) -> dict[str, Any]:
        return {**self.binding_payload(), "bundle_hash": self.bundle_hash}


def _is_sha256(value: object) -> bool:
    return type(value) is str and re.fullmatch(
        r"sha256:[0-9a-f]{64}", value,
    ) is not None


def _is_identifier(value: object) -> bool:
    return (
        type(value) is str
        and bool(value)
        and value == value.strip()
        and value == unicodedata.normalize("NFC", value)
        and len(value) <= 512
        and not any(unicodedata.category(char).startswith("C") for char in value)
    )


def _valid_reference(reference: object) -> bool:
    return (
        type(reference) is TakeoverArtifactReference
        and all(
            _is_identifier(value)
            for value in (
                reference.artifact_id, reference.kind, reference.session_id,
                reference.delegation_id, reference.step_lineage_id,
            )
        )
        and _is_sha256(reference.checksum)
        and _is_sha256(reference.binding_hash)
        and reference.binding_hash == canonical_hash(reference.binding_payload())
    )


@dataclass(frozen=True, slots=True)
class TakeoverEvidenceExpectation:
    """Trusted current evidence, published outside a takeover call."""

    work_instruction: TakeoverArtifactReference
    diff: TakeoverArtifactReference
    test_output: TakeoverArtifactReference
    checkpoint: TakeoverArtifactReference
    sequence: int
    expectation_hash: str

    def binding_payload(self) -> dict[str, Any]:
        return {
            "work_instruction": self.work_instruction.to_dict(),
            "diff": self.diff.to_dict(),
            "test_output": self.test_output.to_dict(),
            "checkpoint": self.checkpoint.to_dict(),
            "sequence": self.sequence,
        }


class TakeoverEvidenceAuthority:
    """Identity capability required to publish and seal trusted evidence."""

    __slots__ = ()


@dataclass(frozen=True, slots=True)
class SealedTakeoverEvidence:
    """Immutable trusted evidence snapshot consumed by takeover services."""

    expectations: tuple[tuple[str, TakeoverEvidenceExpectation], ...]
    sequence: int
    sealed_hash: str

    def binding_payload(self) -> dict[str, Any]:
        return {
            "expectations": [
                {"session_id": key, **value.binding_payload(),
                 "expectation_hash": value.expectation_hash}
                for key, value in self.expectations
            ],
            "sequence": self.sequence,
        }

    def verify(self) -> bool:
        return (
            type(self.expectations) is tuple
            and type(self.sequence) is int
            and self.sequence > 0
            and all(
                _is_identifier(key)
                and type(value) is TakeoverEvidenceExpectation
                and type(value.sequence) is int
                and 0 < value.sequence <= self.sequence
                and _is_sha256(value.expectation_hash)
                and value.expectation_hash
                == canonical_hash(value.binding_payload())
                for key, value in self.expectations
            )
            and _is_sha256(self.sealed_hash)
            and self.sealed_hash == canonical_hash(self.binding_payload())
        )

    def current(self, session_id: str) -> TakeoverEvidenceExpectation | None:
        return next(
            (value for key, value in self.expectations if key == session_id),
            None,
        )


class TakeoverEvidenceRegistry:
    """Thread-safe trusted source for the latest takeover evidence identity."""

    def __init__(self, authority: TakeoverEvidenceAuthority) -> None:
        if type(authority) is not TakeoverEvidenceAuthority:
            raise ValueError("takeover evidence authority capability is required")
        self._lock = RLock()
        self._authority = authority
        self._current: dict[str, TakeoverEvidenceExpectation] = {}
        self._sequence = 0
        self._sealed = False
        self._sealed_snapshot: SealedTakeoverEvidence | None = None

    def publish(
        self, *, work_instruction: TakeoverArtifactReference,
        diff: TakeoverArtifactReference, test_output: TakeoverArtifactReference,
        checkpoint: TakeoverArtifactReference,
        authority: TakeoverEvidenceAuthority, sequence: int,
    ) -> TakeoverEvidenceExpectation:
        if authority is not self._authority:
            raise ValueError("takeover evidence authority capability mismatch")
        if type(sequence) is not int:
            raise ValueError("takeover evidence sequence must be an exact integer")
        references = (work_instruction, diff, test_output, checkpoint)
        expected_kinds = ("WORK_INSTRUCTION", "DIFF", "TEST_OUTPUT", "CHECKPOINT")
        if any(not _valid_reference(item) for item in references):
            raise ValueError("trusted takeover evidence reference is invalid")
        if tuple(item.kind for item in references) != expected_kinds:
            raise ValueError("trusted takeover evidence kinds are invalid")
        identities = {
            (item.session_id, item.delegation_id, item.step_lineage_id)
            for item in references
        }
        if len(identities) != 1:
            raise ValueError("trusted takeover evidence identity mismatch")
        raw = {
            "work_instruction": work_instruction.to_dict(),
            "diff": diff.to_dict(), "test_output": test_output.to_dict(),
            "checkpoint": checkpoint.to_dict(),
            "sequence": sequence,
        }
        expectation = TakeoverEvidenceExpectation(
            work_instruction, diff, test_output, checkpoint,
            sequence,
            canonical_hash(raw),
        )
        with self._lock:
            if self._sealed:
                raise ValueError("takeover evidence registry is sealed")
            if sequence != self._sequence + 1:
                raise ValueError(
                    "takeover evidence sequence must increase by exactly one"
                )
            self._current[work_instruction.session_id] = expectation
            self._sequence = sequence
        return expectation

    def seal(
        self, *, authority: TakeoverEvidenceAuthority,
    ) -> SealedTakeoverEvidence:
        if authority is not self._authority:
            raise ValueError("takeover evidence authority capability mismatch")
        with self._lock:
            if self._sealed:
                raise ValueError("takeover evidence registry is already sealed")
            if not self._current:
                raise ValueError("trusted takeover evidence is required before seal")
            expectations = tuple(sorted(self._current.items()))
            payload = {
                "expectations": [
                    {"session_id": key, **value.binding_payload(),
                     "expectation_hash": value.expectation_hash}
                    for key, value in expectations
                ],
                "sequence": self._sequence,
            }
            snapshot = SealedTakeoverEvidence(
                expectations, self._sequence, canonical_hash(payload),
            )
            self._sealed = True
            self._sealed_snapshot = snapshot
            return snapshot

    def snapshot_for_service(self) -> SealedTakeoverEvidence:
        """Return only the snapshot sealed by this trusted host adapter."""
        with self._lock:
            if not self._sealed or self._sealed_snapshot is None:
                raise ValueError("takeover evidence registry must be sealed")
            return self._sealed_snapshot


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
    reference_bundle: TakeoverReferenceBundle
    reference_bundle_hash: str
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
            "reference_bundle": self.reference_bundle.to_dict(),
            "reference_bundle_hash": self.reference_bundle_hash,
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
    actor: str
    trigger_type: str
    reference_bundle_hash: str
    packet_hash: str
    lease_released: bool
    tools_revoked: bool
    audit_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "takeover_id": self.takeover_id,
            "step_lineage_id": self.step_lineage_id,
            "failure_fingerprint": self.failure_fingerprint,
            "report_ids": list(self.report_ids),
            "actor": self.actor,
            "trigger_type": self.trigger_type,
            "reference_bundle_hash": self.reference_bundle_hash,
            "packet_hash": self.packet_hash,
            "lease_released": self.lease_released,
            "tools_revoked": self.tools_revoked,
            "audit_hash": self.audit_hash,
        }


@dataclass(frozen=True, slots=True)
class TakeoverReceipt:
    accepted: bool
    duplicate: bool = False
    reason_codes: tuple[str, ...] = ()
    packet: TakeoverPacket | None = None
    audit: TakeoverAudit | None = None


class MainAgentTakeoverService:
    """Perform the mandatory C-13 stop/revoke/packet transition."""

    def __init__(
        self, ledger: FailureLedger, lifecycle: DeveloperLifecycleService,
        leases: LeaseService, tools: ToolPermissionRegistry | None = None, *,
        evidence_registry: TakeoverEvidenceRegistry | None = None,
        evidence_snapshot: SealedTakeoverEvidence | None = None,
    ) -> None:
        if evidence_snapshot is not None:
            raise ValueError("direct takeover evidence snapshot admission is forbidden")
        if type(evidence_registry) is not TakeoverEvidenceRegistry:
            raise ValueError("sealed trusted takeover evidence registry is required")
        trusted_snapshot = evidence_registry.snapshot_for_service()
        if not trusted_snapshot.verify():
            raise ValueError("sealed trusted takeover evidence is invalid")
        self._ledger = ledger
        self._lifecycle = lifecycle
        self._leases = leases
        self._tools = tools or ToolPermissionRegistry()
        self._evidence_snapshot = trusted_snapshot
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
                 execution_fencing_token: str | None = None,
                 reference_bundle: Any | None = None,
                 expected_work_instruction_id: str | None = None,
                 expected_work_instruction_checksum: str | None = None) -> TakeoverReceipt:
        """Take over exactly the ledger's third valid failure.

        The supplied receipt is treated as an opaque capability: its immutable
        entry must still match the ledger projection and current session.
        """
        with self._lock:
            if not isinstance(execution_fencing_token, str) or not execution_fencing_token.strip():
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.MISSING_FENCING_TOKEN.value,))
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
            if (entry.step_lineage_id, entry.failure_fingerprint) != (
                expected_lineage, expected_fingerprint,
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_LINEAGE.value,))
            if reference_bundle is None:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.MISSING_REFERENCE_BUNDLE.value,))
            if type(reference_bundle) is not TakeoverReferenceBundle:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_REFERENCE_BUNDLE.value,))
            if not reference_bundle._shape_valid:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_REFERENCE_BUNDLE.value,))
            references = (
                reference_bundle.work_instruction,
                reference_bundle.diff,
                reference_bundle.test_output,
                reference_bundle.checkpoint,
                *reference_bundle.failure_reports,
            )
            if any(type(item) is not TakeoverArtifactReference for item in references):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_REFERENCE.value,))
            if any(
                not all(
                    _is_identifier(value)
                    for value in (
                        item.artifact_id, item.kind, item.session_id,
                        item.delegation_id, item.step_lineage_id,
                    )
                )
                for item in references
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_REFERENCE.value,))
            expected_kinds = (
                (reference_bundle.work_instruction, "WORK_INSTRUCTION"),
                (reference_bundle.diff, "DIFF"),
                (reference_bundle.test_output, "TEST_OUTPUT"),
                (reference_bundle.checkpoint, "CHECKPOINT"),
            )
            if (
                len(reference_bundle.failure_reports) != 3
                or any(item.kind != expected for item, expected in expected_kinds)
                or any(item.kind != "FAILURE_REPORT" for item in reference_bundle.failure_reports)
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_REFERENCE_KIND.value,))
            if any(not _is_sha256(item.checksum) for item in references):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.INVALID_REFERENCE_CHECKSUM.value,))
            if any(
                not _is_sha256(item.binding_hash)
                or item.binding_hash != canonical_hash(item.binding_payload())
                for item in references
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.REFERENCE_HASH_MISMATCH.value,))
            if (
                not _is_sha256(reference_bundle.bundle_hash)
                or reference_bundle.bundle_hash != canonical_hash(reference_bundle.binding_payload())
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.BUNDLE_HASH_MISMATCH.value,))
            caller_expectation_supplied = (
                expected_work_instruction_id is not None
                or expected_work_instruction_checksum is not None
            )
            if caller_expectation_supplied and (
                not _is_identifier(expected_work_instruction_id)
                or not _is_sha256(expected_work_instruction_checksum)
                or reference_bundle.work_instruction.artifact_id != expected_work_instruction_id
                or reference_bundle.work_instruction.checksum != expected_work_instruction_checksum
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.WORK_INSTRUCTION_MISMATCH.value,))
            try:
                evidence_current = self._lifecycle.current(session_id)
            except KeyError:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.UNKNOWN_SESSION.value,))
            if any(
                (item.session_id, item.delegation_id, item.step_lineage_id)
                != (session_id, evidence_current.delegation_id, expected_lineage)
                for item in references
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.REFERENCE_IDENTITY_MISMATCH.value,))
            evidence_checkpoint = evidence_current.checkpoint
            if (
                evidence_checkpoint is None
                or not evidence_checkpoint.verify()
                or reference_bundle.checkpoint.artifact_id != evidence_checkpoint.checkpoint_id
                or reference_bundle.checkpoint.checksum != evidence_checkpoint.checkpoint_hash
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.CHECKPOINT_MISMATCH.value,))
            trusted = self._evidence_snapshot.current(session_id)
            if trusted is None:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.MISSING_TRUSTED_EVIDENCE.value,))
            if tuple(item.to_dict() for item in references[:4]) != tuple(
                item.to_dict() for item in (
                    trusted.work_instruction, trusted.diff,
                    trusted.test_output, trusted.checkpoint,
                )
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.TRUSTED_EVIDENCE_MISMATCH.value,))
            projection = self._ledger.get(key)
            if projection is None or projection.latest_result_id != entry.result_id:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_LINEAGE.value,))
            if (entry.step_lineage_id, entry.failure_fingerprint) != (expected_lineage, expected_fingerprint):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_LINEAGE.value,))
            canonical_failure_entries = tuple(
                item for item in self._ledger.entries
                if item.failure_key == key and item.accepted
            )
            if tuple(
                (item.artifact_id, item.checksum)
                for item in reference_bundle.failure_reports
            ) != tuple(
                (item.result_id, item.result_hash)
                for item in canonical_failure_entries
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.FAILURE_REPORT_REFERENCE_MISMATCH.value,))
            takeover_id = f"takeover:{key}"
            prior = self._packets.get(takeover_id)
            if prior is not None:
                try:
                    replay_current = self._lifecycle.current(session_id)
                    replay_safe = (
                        replay_current.status is LifecycleStatus.STOPPED
                        and self._leases.active_worker(session_id) is None
                        and not self._leases.active_writes(session_id)
                        and not self._tools.active(session_id)
                    )
                except Exception:
                    replay_safe = False
                if not replay_safe:
                    return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.UNSAFE_REPLAY_STATE.value,))
                if prior.reference_bundle_hash != reference_bundle.bundle_hash:
                    return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.REFERENCE_BUNDLE_MISMATCH.value,))
                return TakeoverReceipt(True, duplicate=True, reason_codes=(TakeoverReasonCode.DUPLICATE_TAKEOVER.value,), packet=prior,
                                       audit=next(item for item in self._audits if item.takeover_id == takeover_id))
            try:
                current = self._lifecycle.current(session_id)
            except KeyError:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.UNKNOWN_SESSION.value,))
            if current.session_id != session_id:
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.SESSION_IDENTITY_MISMATCH.value,))
            if any(
                (item.session_id, item.delegation_id, item.step_lineage_id)
                != (session_id, current.delegation_id, expected_lineage)
                for item in references
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.REFERENCE_IDENTITY_MISMATCH.value,))
            checkpoint = current.checkpoint
            if (
                checkpoint is None
                or not checkpoint.verify()
                or checkpoint.session_id != session_id
                or checkpoint.delegation_id != current.delegation_id
                or checkpoint.packet_hash != current.packet_hash
                or reference_bundle.checkpoint.artifact_id != checkpoint.checkpoint_id
                or reference_bundle.checkpoint.checksum != checkpoint.checkpoint_hash
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.CHECKPOINT_MISMATCH.value,))
            now = datetime.now(timezone.utc)
            active_writes = self._leases.active_writes(session_id)
            if (
                not active_writes
                or any(
                    item.execution_fencing_token != execution_fencing_token
                    or item.expires_at < now
                    for item in active_writes
                )
            ):
                return TakeoverReceipt(False, reason_codes=(TakeoverReasonCode.STALE_FENCING_TOKEN.value,))

            report_ids = tuple(item.result_id for item in canonical_failure_entries)
            transaction = getattr(self._leases, "takeover_transaction", None)
            lease_guard = (
                transaction(
                    session_id, execution_token=execution_fencing_token,
                )
                if callable(transaction) else nullcontext()
            )
            tool_transaction = getattr(self._tools, "takeover_transaction", None)
            tool_guard = (
                tool_transaction(session_id)
                if callable(tool_transaction) else nullcontext()
            )
            try:
                with lease_guard, tool_guard:
                    return self._commit_takeover(
                        session_id=session_id,
                        execution_fencing_token=execution_fencing_token,
                        takeover_id=takeover_id,
                        expected_lineage=expected_lineage,
                        expected_fingerprint=expected_fingerprint,
                        report_ids=report_ids,
                        current=current,
                        reference_bundle=reference_bundle,
                    )
            except Exception:
                return TakeoverReceipt(
                    False,
                    reason_codes=(TakeoverReasonCode.TAKEOVER_TRANSACTION_FAILED.value,),
                )

    def _commit_takeover(
        self, *, session_id: str, execution_fencing_token: str,
        takeover_id: str, expected_lineage: str,
        expected_fingerprint: str, report_ids: tuple[str, ...],
        current: Any, reference_bundle: TakeoverReferenceBundle,
    ) -> TakeoverReceipt:
        """Commit under the coordinator and lease transaction locks."""
        try:
            lifecycle_snapshot = self._lifecycle.takeover_snapshot(session_id)
            lease_snapshot = self._leases.takeover_snapshot(
                session_id, execution_token=execution_fencing_token,
            )
            tool_snapshot = self._tools.takeover_snapshot(session_id)
        except Exception:
            return TakeoverReceipt(
                False,
                reason_codes=(TakeoverReasonCode.TAKEOVER_TRANSACTION_FAILED.value,),
            )
        try:
            self._lifecycle.stop(session_id)
            stopped = self._lifecycle.wait(session_id)
            if stopped.status is not LifecycleStatus.STOPPED:
                raise RuntimeError("lifecycle stop did not reach STOPPED")
            self._leases.revoke_run(
                session_id, execution_token=execution_fencing_token,
            )
            if (
                self._leases.active_worker(session_id) is not None
                or self._leases.active_writes(session_id)
            ):
                raise RuntimeError("lease capabilities remain active after revoke")
            self._tools.revoke(session_id)
            final_current = self._lifecycle.current(session_id)
            if (
                final_current.status is not LifecycleStatus.STOPPED
                or self._leases.active_worker(session_id) is not None
                or self._leases.active_writes(session_id)
                or self._tools.active(session_id)
            ):
                raise RuntimeError("takeover final safety postcondition failed")
            raw = {
                "takeover_id": takeover_id, "step_lineage_id": expected_lineage,
                "failure_fingerprint": expected_fingerprint, "trigger_type": "THIRD_VALID_FAILURE",
                "actor": "MAIN_AGENT", "report_ids": list(report_ids),
                "delegation_id": current.delegation_id, "session_id": session_id,
                "reference_bundle": reference_bundle.to_dict(),
                "reference_bundle_hash": reference_bundle.bundle_hash,
                "status": "MAIN_AGENT_TAKEOVER_REQUIRED",
            }
            packet_hash = canonical_hash(raw)
            packet = TakeoverPacket(takeover_id, expected_lineage, expected_fingerprint,
                                    "THIRD_VALID_FAILURE", "MAIN_AGENT", report_ids,
                                    current.delegation_id, session_id,
                                    reference_bundle, reference_bundle.bundle_hash,
                                    packet_hash)
            audit_raw = {
                "event_id": f"evt_{takeover_id}",
                "event_type": "MainAgentTakeoverRequired",
                "takeover_id": takeover_id,
                "step_lineage_id": expected_lineage,
                "failure_fingerprint": expected_fingerprint,
                "report_ids": list(report_ids),
                "actor": "MAIN_AGENT",
                "trigger_type": "THIRD_VALID_FAILURE",
                "reference_bundle_hash": reference_bundle.bundle_hash,
                "packet_hash": packet_hash,
                "lease_released": True,
                "tools_revoked": True,
            }
            audit = TakeoverAudit(
                event_id=audit_raw["event_id"], event_type=audit_raw["event_type"],
                takeover_id=takeover_id, step_lineage_id=expected_lineage,
                failure_fingerprint=expected_fingerprint, report_ids=report_ids,
                actor="MAIN_AGENT", trigger_type="THIRD_VALID_FAILURE",
                reference_bundle_hash=reference_bundle.bundle_hash,
                packet_hash=packet_hash, lease_released=True, tools_revoked=True,
                audit_hash=canonical_hash(audit_raw),
            )
            lease_complete = getattr(self._leases, "complete_takeover", None)
            tool_complete = getattr(self._tools, "complete_takeover", None)
            if callable(lease_complete):
                lease_complete(session_id)
            if callable(tool_complete):
                tool_complete(session_id)
            self._packets[takeover_id] = packet
            self._audits.append(audit)
            return TakeoverReceipt(True, packet=packet, audit=audit)
        except Exception:
            rollback_failed = False
            for restore, snapshot in (
                (self._tools.restore_takeover, tool_snapshot),
                (self._leases.restore_takeover, lease_snapshot),
                (self._lifecycle.restore_takeover, lifecycle_snapshot),
            ):
                try:
                    restore(snapshot)
                except Exception:
                    rollback_failed = True
            reasons = [TakeoverReasonCode.TAKEOVER_TRANSACTION_FAILED.value]
            if rollback_failed:
                reasons.append(TakeoverReasonCode.TAKEOVER_ROLLBACK_FAILED.value)
            return TakeoverReceipt(False, reason_codes=tuple(reasons))

TakeoverService = MainAgentTakeoverService

__all__ = ["TakeoverReasonCode", "TakeoverArtifactReference", "TakeoverReferenceBundle", "TakeoverEvidenceAuthority", "TakeoverEvidenceExpectation", "TakeoverEvidenceRegistry", "SealedTakeoverEvidence", "TakeoverPacket", "TakeoverAudit", "TakeoverReceipt", "MainAgentTakeoverService", "TakeoverService"]
