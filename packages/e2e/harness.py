"""C-15 synthetic backend/API E2E harness.

This is an intentionally small in-memory composition root for C-01..C-14.
It exposes request-shaped methods so tests exercise the same identity and
fail-closed boundaries as an API without claiming HTTP/DB/production proof.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from packages.leases import LeaseService
from packages.orchestration.delegation import (
    DataEgressProfile, DelegationPacket, PermissionSnapshot,
)
from packages.orchestration.developer_lifecycle import (
    CheckpointHandoff, DeveloperLifecycleService, LifecycleStatus,
)
from packages.orchestration.failure_ledger import FailureLedger
from packages.orchestration.failure_report import validate_failure_report
from packages.orchestration.result_envelope import (
    EvidenceReference, ResultEnvelope, ResultTest, canonical_hash,
)
from packages.orchestration.takeover import MainAgentTakeoverService
from packages.execution import ResultStatus
from packages.tool_gateway import ToolPermissionRegistry
from packages.verification.gates import (
    DefectAssessment, EvidenceManifest, GateResult, GateStatus,
    ProductValidation, ReleaseApprovalService, ReleaseDecision,
)


def _hash(value: object) -> str:
    return canonical_hash({"fixture": value})


@dataclass(frozen=True, slots=True)
class E2EResponse:
    status_code: int
    body: Mapping[str, Any]


@dataclass(frozen=True, slots=True)
class E2EProjection:
    run_id: str
    target_hash: str
    phase: str
    status: str
    events: tuple[Mapping[str, Any], ...]
    evidence_manifest: EvidenceManifest | None = None
    release_receipt: Mapping[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id, "target_hash": self.target_hash,
            "phase": self.phase, "status": self.status,
            "events": [dict(event) for event in self.events],
            "evidence_manifest": None if self.evidence_manifest is None else self.evidence_manifest.to_dict(),
            "release_receipt": None if self.release_receipt is None else dict(self.release_receipt),
        }


class E2EError(RuntimeError):
    """Expected fixture/API rejection (never an external-service failure)."""


@dataclass
class _Run:
    run_id: str
    target_hash: str
    packet: DelegationPacket
    phase: str = "REQUESTED"
    status: str = "ACTIVE"
    events: list[Mapping[str, Any]] = field(default_factory=list)
    manifest: EvidenceManifest | None = None
    release_receipt: Mapping[str, Any] | None = None


class SyntheticE2EHarness:
    """Compose the previously verified pure contracts into one API fixture."""

    _BASELINE = _hash("baseline")
    _PERMISSION = _hash("permission")
    _CONTEXT = _hash("context")
    _EGRESS = _hash("egress")

    def __init__(self) -> None:
        self.lifecycle = DeveloperLifecycleService()
        self.ledger = FailureLedger()
        self.leases = LeaseService(token_factory=lambda: "fixture-token")
        self.tools = ToolPermissionRegistry()
        self.takeover = MainAgentTakeoverService(self.ledger, self.lifecycle, self.leases, self.tools)
        self.release = ReleaseApprovalService()
        self._runs: dict[str, _Run] = {}
        self._used_request_ids: set[str] = set()

    @property
    def projections(self) -> tuple[E2EProjection, ...]:
        return tuple(self._projection(run) for run in self._runs.values())

    def request(self, method: str, path: str, payload: Mapping[str, Any] | None = None) -> E2EResponse:
        """Dispatch the small fixture API; unknown or duplicate requests fail closed."""
        payload = dict(payload or {})
        request_id = payload.get("request_id")
        if not isinstance(request_id, str) or not request_id.strip():
            return E2EResponse(400, {"error": "REQUEST_ID_REQUIRED"})
        if request_id in self._used_request_ids:
            return E2EResponse(409, {"error": "DUPLICATE_REPLAY"})
        self._used_request_ids.add(request_id)
        try:
            if method == "POST" and path == "/runs":
                run = self.start(payload["run_id"])
                return E2EResponse(201, self._projection(run).to_dict())
            run = self._runs[payload["run_id"]]
            if method == "POST" and path == "/runs/pause":
                self.pause(run.run_id); return E2EResponse(200, self._projection(run).to_dict())
            if method == "POST" and path == "/runs/resume":
                self.resume(run.run_id, payload.get("target_hash", run.target_hash)); return E2EResponse(200, self._projection(run).to_dict())
            if method == "POST" and path == "/runs/release":
                self.release_decision(run.run_id, payload.get("decision", "RELEASE"), payload.get("actor_id", "human"), bool(payload.get("authenticated", True)))
                return E2EResponse(200, self._projection(run).to_dict())
            if method == "POST" and path == "/runs/apply":
                self.apply(run.run_id, payload["approval_id"]); return E2EResponse(200, self._projection(run).to_dict())
        except (KeyError, ValueError, E2EError) as error:
            return E2EResponse(409, {"error": str(error)})
        return E2EResponse(404, {"error": "NOT_FOUND"})

    def start(self, run_id: str = "run:fixture") -> _Run:
        if run_id in self._runs:
            raise E2EError("DUPLICATE_RUN")
        target = _hash({"run": run_id, "artifact": "synthetic"})
        permission = PermissionSnapshot(
            allowed_paths=("packages/e2e/**", "tests/e2e/**"),
            allowed_actions=("read", "test"),
            allowed_tools=("read_file", "pytest"),
            allowed_backends=("local",), prohibited_paths=(), protected_paths=(),
            prohibited_actions=("external_network", "database", "deployment"),
        )
        egress = DataEgressProfile("local_only", (), (), ())
        packet = DelegationPacket(
            delegation_id=f"delegation:{run_id}", parent_run_id=run_id,
            parent_agent_id="MAIN_AGENT", work_instruction_id="C-15",
            plan_revision=1, step_id="step:fixture", workspace_id="fixture-workspace",
            objective="synthetic E2E", in_scope=("synthetic fixture",),
            out_of_scope=("external systems",), allowed_paths=permission.allowed_paths,
            prohibited_actions=permission.prohibited_actions,
            permission_profile_id="fixture-read-only",
            expected_result_schema="subagent_result/v1",
            required_evidence=("evidence", "projection"), budget_ref="fixture-budget",
            completion_conditions=("evidence", "projection"),
            baseline_hash=self._BASELINE, context_snapshot_hash=self._CONTEXT,
            permission_snapshot=permission,
            permission_snapshot_hash=permission.snapshot_hash,
            parent_permission_snapshot_hash=permission.snapshot_hash,
            data_egress_profile=egress, egress_snapshot_hash=egress.snapshot_hash,
            parent_egress_snapshot_hash=egress.snapshot_hash,
        )
        self.lifecycle.start(
            packet, session_id=run_id, baseline_hash=self._BASELINE,
            context_snapshot_hash=self._CONTEXT,
            parent_permission_snapshot=permission, parent_egress_profile=egress,
        )
        run = _Run(run_id, target, packet)
        self._runs[run_id] = run
        self._event(run, "RunRequested")
        self._event(run, "TechnicalValidation", status="PASS")
        return run

    def complete(self, run_id: str) -> E2EProjection:
        run = self._runs[run_id]
        self.lifecycle.wait(run_id); self.lifecycle.wait(run_id)
        run.phase, run.status = "TECHNICAL_VALIDATION", "SUCCEEDED"
        self._event(run, "TechnicalValidation", status="PASS")
        self._build_manifest(run)
        self._event(run, "ProductValidation", verdict="SUITABLE")
        self._event(run, "DefectAssessment", blocking=False)
        return self._projection(run)

    def pause(self, run_id: str) -> None:
        run = self._runs[run_id]
        self.lifecycle.wait(run_id)
        checkpoint = CheckpointHandoff(
            checkpoint_id=f"checkpoint:{run_id}", checkpoint_hash=_hash("checkpoint"),
            state={"phase": run.phase}, session_id=run_id,
            delegation_id=run.packet.delegation_id, packet_hash=run.packet.packet_hash,
        )
        self.lifecycle.pause(run_id, checkpoint)
        run.phase, run.status = "INTERRUPTED", "PAUSED_USER"; self._event(run, "RunPaused")

    def resume(self, run_id: str, target_hash: str) -> None:
        run = self._runs[run_id]
        if target_hash != run.target_hash: raise E2EError("STALE_TARGET_HASH")
        self.lifecycle.resume(run_id, run.packet.packet_hash)
        run.phase, run.status = "RESUMED", "ACTIVE"; self._event(run, "RunResumed")

    def reject(self, run_id: str) -> E2EProjection:
        run = self._runs[run_id]; run.phase, run.status = "RESULT_REVIEW", "REJECTED"
        self._event(run, "ReleaseDecision", decision="REJECT"); return self._projection(run)

    def record_takeover(self, run_id: str) -> E2EProjection:
        run = self._runs[run_id]
        for number in range(1, 4):
            result = self._failure(run, number)
            receipt = self.ledger.record(result)
            self._event(run, "FailureReport", result_id=result.result_id, count=receipt.valid_failure_count)
        worker = self.leases.issue_worker(run_id, "developer-primary", datetime.now(timezone.utc), timedelta(minutes=5))
        self.lifecycle.wait(run_id)
        receipt = self.takeover.takeover(receipt, session_id=run_id, expected_lineage="lineage-fixture",
                                         expected_fingerprint="fixture-failure", execution_fencing_token=worker.execution_fencing_token)
        if not receipt.accepted: raise E2EError("TAKEOVER_REJECTED")
        run.phase, run.status = "MAIN_AGENT_TAKEOVER_REQUIRED", "BLOCKED"
        self._event(run, "MainAgentTakeoverRequired", report_count=3)
        return self._projection(run)

    def release_decision(
        self, run_id: str, decision: str, actor_id: str, authenticated: bool,
        *, validations: tuple[ProductValidation, ...] | None = None,
        required_criteria: tuple[str, ...] = ("criterion:fixture",),
        defects: tuple[DefectAssessment, ...] | None = None,
    ) -> None:
        run = self._runs[run_id]
        # An explicitly supplied empty collection is different from an
        # omitted collection.  Never silently replace caller evidence with
        # fixture defaults: this is the API boundary's fail-closed rule.
        if validations is not None and not validations:
            raise E2EError("EMPTY_VALIDATIONS")
        if defects is not None and not defects:
            raise E2EError("EMPTY_DEFECTS")
        if run.manifest is None: self.complete(run_id)
        validations = validations if validations is not None else (ProductValidation("criterion:fixture", run.target_hash, "SUITABLE", "tester", "ENV-LOCAL"),)
        defects = defects if defects is not None else (DefectAssessment("defect:fixture", run.target_hash, False),)
        record = self.release.decide(decision_id=f"decision:{run_id}", target_hash=run.target_hash,
                                     decision=ReleaseDecision(decision), actor_id=actor_id, authenticated=authenticated,
                                     manifest=run.manifest, product_validations=validations,
                                     required_criteria=required_criteria, defects=defects)
        run.phase, run.status = "APPLY_PENDING", "WAITING_DECISION"
        self._event(run, "ReleaseDecision", decision=record.decision.value, actor=actor_id)

    def apply(self, run_id: str, approval_id: str) -> None:
        run = self._runs[run_id]
        record = self.release._decisions.get(f"decision:{run_id}")
        if record is None: raise E2EError("RELEASE_DECISION_REQUIRED")
        receipt = self.release.apply(approval_id=approval_id, target_hash=run.target_hash, manifest=run.manifest, decision=record)
        if not receipt.accepted: raise E2EError(",".join(receipt.reason_codes))
        run.release_receipt = {"accepted": True, "approval_id": approval_id}
        run.phase, run.status = "APPLIED", "SUCCEEDED"; self._event(run, "ApplyApproval", approval_id=approval_id)

    def discard(self, run_id: str) -> None:
        run = self._runs[run_id]
        run.phase, run.status = "DISCARDED", "DISCARDED"; self._event(run, "Discarded")

    def _build_manifest(self, run: _Run) -> None:
        gates = tuple(GateResult(code, GateStatus.PASS, run.target_hash, evidence_refs=(f"evidence:{code}",)) for code in ("G0", "G1", "G2", "G3"))
        run.manifest = EvidenceManifest(run.target_hash, run.target_hash, run.target_hash, "ENV-LOCAL",
                                        evidence_refs=("evidence:fixture",), gate_results=gates,
                                        acquisition_mode="synthetic-fixture",
                                        unverified_scope=("provider", "database", "browser", "deployment"))

    def _failure(self, run: _Run, number: int) -> ResultEnvelope:
        return ResultEnvelope(
            "subagent_result/v1", f"failure:{run.run_id}:{number}", run.packet.delegation_id,
                              f"attempt:{number}", number, "lineage-fixture", ResultStatus.FAILURE_REPORT,
            run.target_hash, "synthetic failure", actions_taken=("fixture failure reproduced",),
            changed_paths=("packages/e2e/harness.py",),
            evidence_refs=(EvidenceReference(f"evidence:failure:{number}", "sha256:" + "0" * 64, "fixture"),),
            tests=(ResultTest("fixture-test", "FAIL", 1),),
            issue_id="fixture-issue", failure_fingerprint="fixture-failure",
            unresolved=("synthetic defect",), decision_needed="Main Agent takeover",
            handoff={"problem_name": "fixture failure", "failure_stage": "fixture stage",
                     "confirmed_cause": "fixture cause", "alternatives_considered": ("retry",)},
        )

    def _event(self, run: _Run, event_type: str, **details: Any) -> None:
        run.events.append({"sequence": len(run.events) + 1, "event_type": event_type, **details})

    def _projection(self, run: _Run) -> E2EProjection:
        return E2EProjection(run.run_id, run.target_hash, run.phase, run.status, tuple(run.events), run.manifest, run.release_receipt)


def run_synthetic_e2e() -> E2EProjection:
    """Run the happy request→validation→human release→apply journey."""
    harness = SyntheticE2EHarness()
    run = harness.start()
    return harness.complete(run.run_id)


__all__ = ["E2EError", "E2EResponse", "E2EProjection", "SyntheticE2EHarness", "run_synthetic_e2e"]
