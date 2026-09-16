"""C-15 synthetic backend/API E2E harness.

This is an intentionally small in-memory composition root for C-01..C-14.
It exposes request-shaped methods so tests exercise the same identity and
fail-closed boundaries as an API without claiming HTTP/DB/production proof.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from itertools import count
from types import MappingProxyType
from typing import Any, Mapping

from packages.leases import LeaseService, LeaseError
from packages.orchestration.delegation import (
    DataEgressProfile, DelegationPacket, PermissionSnapshot,
)
from packages.orchestration.developer_lifecycle import (
    CheckpointHandoff, DeveloperLifecycleService, LifecycleStatus,
    LifecycleError,
)
from packages.orchestration.failure_ledger import FailureLedger
from packages.orchestration.failure_report import compute_failure_fingerprint, validate_failure_report
from packages.orchestration.result_envelope import (
    EvidenceReference, ResultEnvelope, ResultTest, canonical_hash,
)
from packages.orchestration.takeover import (MainAgentTakeoverService, TakeoverArtifactReference,
    TakeoverReferenceBundle, TakeoverEvidenceAuthority, TakeoverEvidenceRegistry)
from packages.execution import ResultStatus
from packages.tool_gateway import ToolPermissionRegistry
from packages.verification.gates import (
    DefectAssessment, EvidenceManifest, GateResult, GateStatus,
    ProductValidation, ReleaseApprovalService, ReleaseDecision,
    GateEngine, GateEvidenceAuthority, StaticTool, CommandEvidence, DiffFile,
    DiffReviewService, ReviewFinding, LLM_CHECKS, TestEvidence, ApplyApprovalRecord,
)
from packages.planning import planner as planning
from packages.planning.models import WorkPlan, IterationPlan
from packages.planning.approval import ApprovalRecord, ApprovalType
from packages.planning.service import (PlanningApprovalService, PlanningMainAuthorityService,
    MainAuthorityRecord, MainAuthoritySource)

_HOST_IDS = count(1)


def _freeze(value):
    if isinstance(value, Mapping): return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, (tuple, list)): return tuple(_freeze(item) for item in value)
    return value


def _thaw(value):
    if isinstance(value, Mapping): return {key: _thaw(item) for key, item in value.items()}
    if isinstance(value, tuple): return [_thaw(item) for item in value]
    return value


@dataclass(frozen=True, slots=True)
class SyntheticHumanContext:
    """Opaque host-admitted test identity, never authenticated from request JSON."""
    actor_id: str


def _hash(value: object) -> str:
    return canonical_hash({"fixture": value})


@dataclass(frozen=True, slots=True)
class E2EResponse:
    status_code: int
    body: Mapping[str, Any]

    def __post_init__(self): object.__setattr__(self, "body", _freeze(self.body))


@dataclass(frozen=True, slots=True)
class E2EProjection:
    run_id: str
    target_hash: str
    phase: str
    status: str
    events: tuple[Mapping[str, Any], ...]
    evidence_manifest: EvidenceManifest | None = None
    release_receipt: Mapping[str, Any] | None = None
    fixture_state: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        object.__setattr__(self, "events", _freeze(self.events))
        if self.evidence_manifest is not None:
            # Reconstructing also clones each GateResult and recursively freezes
            # its details, so forced mutation of a returned DTO stays local.
            object.__setattr__(self, "evidence_manifest", replace(self.evidence_manifest))
        object.__setattr__(self, "release_receipt", _freeze(self.release_receipt))
        object.__setattr__(self, "fixture_state", _freeze(self.fixture_state))

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id, "target_hash": self.target_hash,
            "phase": self.phase, "status": self.status,
            "events": _thaw(self.events),
            "evidence_manifest": None if self.evidence_manifest is None else self.evidence_manifest.to_dict(),
            "release_receipt": None if self.release_receipt is None else dict(self.release_receipt),
            "synthetic": True, "acquisition_mode": "synthetic-fixture", "external_io_count": 0,
            "unverified_scope": ["provider", "database", "browser", "deployment"],
            "fixture_state": _thaw(self.fixture_state),
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
    worker: Any = None
    write: Any = None
    decision: Any = None
    plan: Any = None
    main: Any = None
    plan_approvals: Any = None
    main_authority: Any = None
    original: str = "hello"
    candidate: str | None = None
    apply_count: int = 0


class SyntheticE2EHarness:
    """Compose the previously verified pure contracts into one API fixture."""

    _BASELINE = _hash("baseline")
    _PERMISSION = _hash("permission")
    _CONTEXT = _hash("context")
    _EGRESS = _hash("egress")

    def __init__(self, *, clock=None) -> None:
        self.now = clock() if clock is not None else datetime.now(timezone.utc)
        self._host_id, self._tokens = next(_HOST_IDS), count(1)
        self._humans: list[tuple[SyntheticHumanContext, str]] = []
        self.lifecycle = DeveloperLifecycleService()
        self.ledger = FailureLedger()
        self.leases = LeaseService(token_factory=lambda: f"synthetic-{self._host_id}-{next(self._tokens)}")
        self.tools = ToolPermissionRegistry()
        # C-13 requires a sealed per-run checkpoint/reference registry; construct
        # the coordinator only after those artifacts exist.
        self.takeover = None
        self._evidence = GateEvidenceAuthority()
        self.gates = GateEngine(evidence_authority=self._evidence)
        self.release = ReleaseApprovalService(evidence_authority=self._evidence)
        self._runs: dict[str, _Run] = {}
        self._used_request_ids: set[str] = set()

    def admit_human(self, actor_id: str) -> SyntheticHumanContext:
        """Trusted fixture-host setup, not an API authentication endpoint."""
        if type(actor_id) is not str or not actor_id.strip(): raise E2EError("HUMAN_REQUIRED")
        context = SyntheticHumanContext(actor_id)
        self._humans.append((context, actor_id))
        return context

    def _human(self, context):
        if type(context) is not SyntheticHumanContext or not any(item is context and actor == context.actor_id for item, actor in self._humans):
            raise E2EError("AUTHENTICATED_HUMAN_REQUIRED")
        return context.actor_id

    def command_context(self, run_id):
        """Trusted host-issued command binding for this synthetic run."""
        run = self._runs[run_id]
        return {"run_id": run_id, "target_hash": run.target_hash,
            "execution_fencing_token": run.worker.execution_fencing_token,
            "write_fencing_token": run.write.write_fencing_token,
            "manifest_hash": run.manifest.manifest_hash if run.manifest else None}

    def _fence(self, run, execution_token, write_token):
        if type(execution_token) is not str or type(write_token) is not str: raise E2EError("FENCING_REQUIRED")
        try: self.leases.require_current(run.run_id, execution_token, write_token, self.now)
        except LeaseError as error: raise E2EError("STALE_FENCING_TOKEN") from error

    @property
    def projections(self) -> tuple[E2EProjection, ...]:
        return tuple(self._projection(run) for run in self._runs.values())

    def request(self, method: str, path: str, payload: Mapping[str, Any] | None = None, *, human=None) -> E2EResponse:
        """API-shaped dispatch. Host identity is transport context, never JSON."""
        payload = dict(payload or {})
        request_id = payload.get("request_id")
        if type(request_id) is not str or not request_id.strip():
            return E2EResponse(400, {"error": "REQUEST_ID_REQUIRED"})
        if request_id in self._used_request_ids:
            return E2EResponse(409, {"error": "DUPLICATE_REPLAY"})
        self._used_request_ids.add(request_id)
        try:
            if method == "POST" and path == "/runs":
                return E2EResponse(201, self.start(payload["run_id"]).to_dict())
            run = self._runs[payload["run_id"]]
            if method == "GET" and path == "/runs/projection":
                return E2EResponse(200, self._projection(run).to_dict())
            known = {"/runs/" + name for name in ("approve-plan", "complete", "pause", "resume", "release", "approve-apply", "apply", "discard", "takeover", "reject")}
            if method != "POST" or path not in known:
                return E2EResponse(404, {"error": "NOT_FOUND"})
            self._fence(run, payload.get("execution_fencing_token"), payload.get("write_fencing_token"))
            if payload.get("target_hash") != run.target_hash: raise E2EError("STALE_TARGET_HASH")
            if path in {"/runs/release", "/runs/approve-apply", "/runs/apply"}:
                if run.manifest is None: raise E2EError("TECHNICAL_VALIDATION_REQUIRED")
                if payload.get("manifest_hash") != run.manifest.manifest_hash: raise E2EError("STALE_MANIFEST_HASH")
            if path == "/runs/approve-plan": self.approve_plan(run.run_id, human=human)
            elif path == "/runs/complete": self.complete(run.run_id)
            elif path == "/runs/pause": self.pause(run.run_id)
            elif path == "/runs/resume": self.resume(run.run_id, payload["target_hash"])
            elif path in {"/runs/release", "/runs/reject"}:
                actor = self._human(human)
                self.release_decision(run.run_id, "REJECT" if path.endswith("reject") else payload.get("decision", "RELEASE"), actor, True, human=human)
            elif path == "/runs/approve-apply": self.approve_apply(run.run_id, payload["approval_id"], human=human)
            elif path == "/runs/apply": self.apply(run.run_id, payload["approval_id"])
            elif path == "/runs/discard": self.discard(run.run_id)
            elif path == "/runs/takeover": self.record_takeover(run.run_id)
            return E2EResponse(200, self._projection(run).to_dict())
        except (KeyError, ValueError, E2EError, LifecycleError, LeaseError) as error:
            return E2EResponse(409, {"error": str(error)})

    def start(self, run_id: str = "run:fixture") -> E2EProjection:
        if type(run_id) is not str or not run_id.strip() or run_id != run_id.strip(): raise E2EError("RUN_ID_REQUIRED")
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
        run.worker = self.leases.issue_worker(run_id, "developer-primary", self.now, timedelta(hours=1))
        run.write = self.leases.issue_write(run.worker, f"synthetic/{run_id}/fixture.txt", self.now, timedelta(hours=1))
        self.tools.grant(run_id, {"read_file", "pytest"})
        self._prepare_plan(run)
        self._runs[run_id] = run
        self._event(run, "RunRequested")
        self._event(run, "RequestAnalysis", analysis_hash=run.plan.analysis.content_hash)
        self._event(run, "WorkInstruction", instruction_hash=run.plan.source_work_instruction_hash)
        self._event(run, "ExecutionPlan", plan_hash=run.plan.content_hash, approved=False)
        return self._projection(run)

    def _prepare_plan(self, run):
        analysis = planning.analyze_request(run.run_id, "uppercase synthetic fixture", scope=("synthetic fixture",),
            completion_conditions=("uppercase verified",), allowed_paths=("fixture/value.txt",), prohibited_actions=("network", "secret", "destructive"),
            risk=("low",), baseline_hash=self._BASELINE, egress_snapshot_hash=run.packet.egress_snapshot_hash)
        work = WorkPlan.create(artifact_id="work:" + run.run_id, revision=1, design_baseline_id="design:fixture",
            design_baseline_hash=self._BASELINE, scope=frozenset(analysis.scope), created_at=self.now)
        iteration = IterationPlan.create(artifact_id="iteration:" + run.run_id, revision=1, work_plan=work, sequence=1, created_at=self.now)
        instruction = planning.generate_work_instruction(iteration, analysis=analysis, created_at=self.now,
            allowed_actions=("write",), validation_contract=("synthetic-uppercase",))
        step = planning.ExecutionStep("fixture-write", planning.StepKind.WRITE, "uppercase candidate", (),
            analysis.allowed_paths, analysis.completion_conditions, risk=("low",), egress_snapshot_hash=analysis.egress_snapshot_hash)
        run.plan = planning.build_execution_plan(analysis, (step,), plan_id="plan:" + run.run_id,
            permission_snapshot_hash=run.packet.permission_snapshot_hash, created_at=self.now, work_plan=work,
            source_work_instruction=instruction, source_iteration_plan=iteration)
        run.main = planning.MainResponsibility("MAIN_AGENT", run.plan.plan_id, observed_at=self.now,
            expires_at=self.now + timedelta(hours=1), authority_source="CONTROL_PLANE", authority_event_hash=self._BASELINE,
            execution_fencing_token=run.worker.execution_fencing_token)
        run.main_authority = PlanningMainAuthorityService()
        run.main_authority.record_observation(MainAuthorityRecord("MAIN_AGENT", run.plan.plan_id, self.now,
            self.now + timedelta(hours=1), MainAuthoritySource.CONTROL_PLANE, self._BASELINE, run.worker.execution_fencing_token))
        run.plan_approvals = PlanningApprovalService()

    def approve_plan(self, run_id, *, human):
        actor = self._human(human); run = self._runs[run_id]
        self._active(run, {"REQUESTED", "RESUMED"})
        p = run.plan
        subjects = ((ApprovalType.DESIGN_SPECIFICATION, p.design_baseline_id, p.design_baseline_hash),
            (ApprovalType.WORK_PLAN, p.work_plan_id, p.work_plan_hash),
            (ApprovalType.WORK_INSTRUCTION, p.source_work_instruction_id, p.source_work_instruction_hash),
            (ApprovalType.EXECUTION_PLAN, p.plan_id, p.content_hash))
        for kind, subject, digest in subjects:
            run.plan_approvals.record_approval(ApprovalRecord(f"{run_id}:{kind.value}", kind, subject, digest, actor, True, self.now, self.now + timedelta(hours=1)))
        self._event(run, "ExecutionPlanApproved", actor=actor, plan_hash=p.content_hash)

    def _active(self, run, phases):
        self._fence(run, run.worker.execution_fencing_token, run.write.write_fencing_token)
        if run.phase not in phases: raise E2EError("INVALID_PHASE")

    def complete(self, run_id: str) -> E2EProjection:
        run = self._runs[run_id]
        self._active(run, {"REQUESTED", "RESUMED"})
        scheduled = planning.schedule_ready_steps(run.plan, main=run.main, main_authority=run.main_authority,
            approval_guard=run.plan_approvals, at=self.now, actual_diff_paths=("fixture/value.txt",))
        if not scheduled.allowed: raise E2EError(scheduled.reason_code)
        for _ in range(2):
            if self.lifecycle.current(run_id).status is not LifecycleStatus.COMPLETED: self.lifecycle.wait(run_id)
        if self.lifecycle.current(run_id).status is not LifecycleStatus.COMPLETED: raise E2EError("DEVELOPER_INCOMPLETE")
        run.candidate = run.original.upper()
        self._build_manifest(run)
        run.phase, run.status = "TECHNICAL_VALIDATION", "SUCCEEDED"
        self._event(run, "TechnicalValidation", status="PASS")
        self._event(run, "ProductValidation", verdict="SUITABLE")
        self._event(run, "DefectAssessment", blocking=False)
        return self._projection(run)

    def pause(self, run_id: str) -> None:
        run = self._runs[run_id]
        self._active(run, {"REQUESTED", "RESUMED"})
        if self.lifecycle.current(run_id).status is LifecycleStatus.PENDING: self.lifecycle.wait(run_id)
        current = self.lifecycle.current(run_id)
        self.lifecycle.request_checkpoint(run_id, idempotency_key=f"pause:{run_id}:{current.resume_epoch}")
        run.phase, run.status = "INTERRUPTED", "PAUSED_USER"; self._event(run, "RunPaused")

    def resume(self, run_id: str, target_hash: str) -> None:
        run = self._runs[run_id]
        if target_hash != run.target_hash: raise E2EError("STALE_TARGET_HASH")
        self._active(run, {"INTERRUPTED"})
        self.lifecycle.resume(run_id, run.packet.packet_hash)
        run.phase, run.status = "RESUMED", "ACTIVE"; self._event(run, "RunResumed")

    def reject(self, run_id: str, *, human=None) -> E2EProjection:
        self.release_decision(run_id, "REJECT", self._human(human), True, human=human)
        return self._projection(self._runs[run_id])

    def record_takeover(self, run_id: str) -> E2EProjection:
        run = self._runs[run_id]
        self._active(run, {"REQUESTED", "RESUMED"})
        self.pause(run_id)
        for number in range(1, 4):
            result = self._failure(run, number)
            receipt = self.ledger.record(result)
            self._event(run, "FailureReport", result_id=result.result_id, count=receipt.valid_failure_count)
        worker = run.worker
        bundle = self._takeover_bundle(run)
        authority = TakeoverEvidenceAuthority(); registry = TakeoverEvidenceRegistry(authority)
        registry.publish(work_instruction=bundle.work_instruction, diff=bundle.diff, test_output=bundle.test_output,
            checkpoint=bundle.checkpoint, authority=authority, sequence=1)
        registry.seal(authority=authority)
        self.takeover = MainAgentTakeoverService(self.ledger, self.lifecycle, self.leases, self.tools, evidence_registry=registry)
        receipt = self.takeover.takeover(
            receipt,
            session_id=run_id,
            expected_lineage=f"lineage:{run_id}",
            expected_fingerprint=result.failure_fingerprint,
            execution_fencing_token=worker.execution_fencing_token,
            reference_bundle=bundle,
        )
        if not receipt.accepted: raise E2EError("TAKEOVER_REJECTED")
        run.phase, run.status = "MAIN_AGENT_TAKEOVER_REQUIRED", "BLOCKED"
        self._event(run, "MainAgentTakeoverRequired", report_count=3)
        return self._projection(run)

    def _takeover_bundle(self, run):
        def reference(kind, identity, checksum):
            payload = dict(artifact_id=identity, kind=kind, checksum=checksum, session_id=run.run_id,
                delegation_id=run.packet.delegation_id, step_lineage_id=f"lineage:{run.run_id}")
            return TakeoverArtifactReference(**payload, binding_hash=canonical_hash(payload))
        checkpoint = self.lifecycle.handoff(run.run_id)
        wi = reference("WORK_INSTRUCTION", run.packet.work_instruction_id, self._BASELINE)
        diff = reference("DIFF", "diff:" + run.run_id, _hash({"run": run.run_id, "change": "uppercase"}))
        tests = reference("TEST_OUTPUT", "tests:" + run.run_id, _hash({"run": run.run_id, "failure": "E_FIXTURE"}))
        cp = reference("CHECKPOINT", checkpoint.checkpoint_id, checkpoint.checkpoint_hash)
        reports = tuple(reference("FAILURE_REPORT", entry.result_id, entry.result_hash) for entry in self.ledger.entries
            if entry.accepted and entry.step_lineage_id == f"lineage:{run.run_id}")
        payload = dict(work_instruction=wi.to_dict(), diff=diff.to_dict(), test_output=tests.to_dict(), checkpoint=cp.to_dict(), failure_reports=[r.to_dict() for r in reports])
        return TakeoverReferenceBundle(wi, diff, tests, cp, reports, canonical_hash(payload))

    def release_decision(
        self, run_id: str, decision: str, actor_id: str, authenticated: bool,
        *, validations: tuple[ProductValidation, ...] | None = None,
        required_criteria: tuple[str, ...] = ("criterion:fixture",),
        defects: tuple[DefectAssessment, ...] | None = None,
        human: SyntheticHumanContext | None = None,
    ) -> None:
        run = self._runs[run_id]
        if authenticated is not True or self._human(human) != actor_id: raise E2EError("AUTHENTICATED_HUMAN_REQUIRED")
        self._active(run, {"TECHNICAL_VALIDATION"})
        # An explicitly supplied empty collection is different from an
        # omitted collection.  Never silently replace caller evidence with
        # fixture defaults: this is the API boundary's fail-closed rule.
        if validations is not None and not validations:
            raise E2EError("EMPTY_VALIDATIONS")
        if defects is not None and not defects:
            raise E2EError("EMPTY_DEFECTS")
        if run.manifest is None: raise E2EError("TECHNICAL_VALIDATION_REQUIRED")
        validations = validations if validations is not None else (ProductValidation("criterion:fixture", run.target_hash, "SUITABLE", "independent-synthetic-tester", "ENV-SYNTHETIC",
            ("synthetic:uppercase-test",), "real", run.target_hash, "uppercase memory fixture", "HELLO", run.candidate, self.now),)
        defects = defects if defects is not None else (DefectAssessment("defect:fixture", run.target_hash, False),)
        record = self.release.decide(decision_id=f"decision:{run_id}", target_hash=run.target_hash,
                                     decision=ReleaseDecision(decision), actor_id=actor_id, authenticated=authenticated,
                                     manifest=run.manifest, product_validations=validations,
                                     required_criteria=required_criteria, defects=defects, decided_at=self.now, expires_at=self.now + timedelta(hours=1))
        run.decision = record
        run.phase, run.status = ("APPLY_PENDING", "WAITING_DECISION") if record.decision is ReleaseDecision.RELEASE else ("RESULT_REVIEW", record.decision.value + "ED" if record.decision is ReleaseDecision.REJECT else record.decision.value)
        self._event(run, "ReleaseDecision", decision=record.decision.value, actor=actor_id)

    def approve_apply(self, run_id, approval_id, *, human):
        actor = self._human(human); run = self._runs[run_id]
        self._active(run, {"APPLY_PENDING"})
        if run.decision is None: raise E2EError("RELEASE_DECISION_REQUIRED")
        self.release.record_apply_approval(ApplyApprovalRecord(approval_id, run.decision.decision_id,
            run.target_hash, run.manifest.manifest_hash, actor, True, self.now, self.now + timedelta(hours=1)))
        self._event(run, "ApplyApproval", approval_id=approval_id, actor=actor)

    def apply(self, run_id: str, approval_id: str) -> None:
        run = self._runs[run_id]
        record = run.decision
        if record is None: raise E2EError("RELEASE_DECISION_REQUIRED")
        self._active(run, {"APPLY_PENDING"})
        receipt = self.release.apply(approval_id=approval_id, target_hash=run.target_hash, manifest=run.manifest, decision=record, at=self.now)
        if not receipt.accepted: raise E2EError(",".join(receipt.reason_codes))
        run.release_receipt = {"accepted": True, "approval_id": approval_id}
        run.original = run.candidate; run.apply_count += 1
        run.phase, run.status = "APPLIED", "SUCCEEDED"; self._event(run, "Applied", approval_id=approval_id)

    def discard(self, run_id: str) -> None:
        run = self._runs[run_id]
        self._active(run, {"REQUESTED", "RESUMED", "TECHNICAL_VALIDATION", "APPLY_PENDING", "RESULT_REVIEW"})
        run.candidate = None
        run.phase, run.status = "DISCARDED", "DISCARDED"; self._event(run, "Discarded")

    def _build_manifest(self, run: _Run) -> None:
        # These host-issued records model real-contract inputs entirely in memory.
        # The enclosing projection always marks synthetic=true and external IO0.
        observation = lambda ref, value: {"status": "PASS", "evidence_ref": "synthetic:" + ref, "value": value}
        baseline = {
            "repository_readable": observation("repository", True),
            "branch_head": observation("git", {"branch": "synthetic/c15", "head": "a" * 40}),
            "dirty_manifest": observation("dirty", {"tracked": [], "untracked": []}),
            "runtime_versions": observation("runtime", {"synthetic-runtime": "1.0"}),
            "baseline_tests": observation("baseline-tests", {"passed": 1, "failed": 0, "skipped": 0}),
            "backend_health": observation("backend", True),
        }
        tool = StaticTool("synthetic-check", ("synthetic-check", "fixture"), True, True, True, "1.0")
        changes = (DiffFile("fixture/value.txt", "hello", run.candidate),)
        review = DiffReviewService().review(changed_paths=("fixture/value.txt",), allowed_paths=("fixture",), changes=changes,
            llm_findings=tuple(ReviewFinding(name, GateStatus.PASS, "synthetic-review:" + name) for name in LLM_CHECKS))
        checks = {
            "input": {"expected": "hello", "observed": run.original, "evidence_ref": "synthetic:input"},
            "store": {"expected": "HELLO", "observed": run.candidate, "evidence_ref": "synthetic:memory-store"},
            "response": {"expected": "HELLO", "observed": run.candidate, "evidence_ref": "synthetic:response"},
            "ui": {"expected": "HELLO", "observed": self._projection(run).fixture_state["candidate"], "evidence_ref": "synthetic:projection-not-browser"},
        }
        gates = (
            self.gates.baseline(target_hash=run.target_hash, observations=baseline),
            self.gates.static(target_hash=run.target_hash, tools=(tool,),
                runner=lambda item: CommandEvidence(item.name, item.command, item.version, 0, "synthetic:static")),
            self.gates.change_review(target_hash=run.target_hash, review=review),
            self.gates.tests(target_hash=run.target_hash,
                evidence=(TestEvidence("synthetic-uppercase:" + run.run_id, "criterion:fixture", GateStatus.PASS, "real", checks),)),
        )
        manifest = EvidenceManifest(run.target_hash, run.target_hash, run.target_hash, "ENV-SYNTHETIC",
            evidence_refs=("synthetic:contract-model-not-operational-evidence",), gate_results=gates,
            acquisition_mode="real", design_baseline_hash=self._BASELINE,
            work_plan_hash=run.plan.work_plan_hash, work_instruction_hash=run.plan.source_work_instruction_hash)
        run.manifest = self.gates.issue_manifest(manifest)

    def _failure(self, run: _Run, number: int) -> ResultEnvelope:
        candidate = ResultEnvelope(
            "subagent_result/v1", f"failure:{run.run_id}:{number}", run.packet.delegation_id,
                              f"attempt:{run.run_id}:{number}", number, f"lineage:{run.run_id}", ResultStatus.FAILURE_REPORT,
            run.target_hash, "synthetic failure", actions_taken=("fixture failure reproduced",),
            changed_paths=("packages/e2e/harness.py",),
            evidence_refs=(EvidenceReference(f"evidence:failure:{number}", "sha256:" + "0" * 64, "fixture"),),
            tests=(ResultTest("fixture-test", "FAIL", 1),),
            issue_id="fixture-issue", failure_fingerprint=None,
            unresolved=("synthetic defect",), decision_needed="Main Agent takeover",
            handoff={
                "problem_name": "fixture failure",
                "failure_stage": "fixture stage",
                "confirmed_cause": "fixture cause",
                "alternatives_considered": ("retry",),
                "normalized_error_code": "E_FIXTURE",
                "failing_test_or_gate": "fixture-test",
                "relevant_stack_fingerprint": "stack:fixture",
                "failure_origin": "CODE_DEFECT",
            },
        )
        return replace(candidate, failure_fingerprint=compute_failure_fingerprint(candidate))

    def _event(self, run: _Run, event_type: str, **details: Any) -> None:
        run.events.append({"sequence": len(run.events) + 1, "event_type": event_type, **details})

    def _projection(self, run: _Run) -> E2EProjection:
        return E2EProjection(run.run_id, run.target_hash, run.phase, run.status, tuple(run.events), run.manifest, run.release_receipt,
            {"original": run.original, "candidate": run.candidate, "apply_count": run.apply_count})


def run_synthetic_e2e() -> E2EProjection:
    """Run the happy request→validation→human release→apply journey."""
    harness = SyntheticE2EHarness(clock=lambda: datetime(2026, 9, 1, tzinfo=timezone.utc))
    run = harness.start()
    human = harness.admit_human("synthetic-human")
    harness.approve_plan(run.run_id, human=human)
    harness.complete(run.run_id)
    harness.release_decision(run.run_id, "RELEASE", human.actor_id, True, human=human)
    harness.approve_apply(run.run_id, "synthetic-apply", human=human)
    harness.apply(run.run_id, "synthetic-apply")
    return harness.projections[0]


__all__ = ["E2EError", "E2EResponse", "E2EProjection", "SyntheticE2EHarness", "SyntheticHumanContext", "run_synthetic_e2e"]
