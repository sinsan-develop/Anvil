"""C22 result trace is not Main acceptance or human approval."""
from dataclasses import replace
import pytest
from packages.agent_team import role_results as v
from packages.orchestration.result_envelope import ResultEnvelope, EvidenceReference, ResultTest
from packages.execution.models import ResultStatus
from tests.agent_team.test_role_contracts_c22 import setup, lease, NOW, H, ROLES, EXPECTED


def fixture(role="CODE", mode="real", status="PASS"):
    p, a = setup(role)
    s = v.RoleResultService(p)
    e = s.capture_evidence(assignment=a, evidence_id="e1", kind=EXPECTED[role][1], source=EXPECTED[role][2],
        mode=mode, status=status, raw_hash="sha256:" + "d" * 64, command="bounded observation", exit_code=0,
        expected="contract met", observed="host observation", now=NOW)
    result = ResultEnvelope("subagent_result/v1", "r1", a.packet.delegation_id, "attempt", 1, "lineage",
        ResultStatus.COMPLETED, H, "role contract result", evidence_refs=(EvidenceReference("e1", e.raw_hash),),
        tests=(ResultTest(e.command, "PASS", 0),))
    rr = v.RoleResult(a.definition.result_schema, a.assignment_id, a.content_hash, role, a.actor_id, a.context_id,
        H, result, "completed", (), None, (e,))
    assert hasattr(v, "RoleEnvelope"), "C22 complete role envelope missing"
    envelope = v.RoleEnvelope(rr, a.packet.step_id, a.packet.parent_run_id, a.packet.parent_agent_id,
        H, (EvidenceReference("artifact", "sha256:" + "e" * 64),), ("Provider/DB/UI/Oracle NOT_EXECUTED",),
        "revert scoped candidate only", 2, 15, ("host-observation",))
    args = dict(assignment=a, actor_id=a.actor_id, session_id=a.session_id, context_id=a.context_id,
        target_hash=H, execution_fence=a.execution_fence, now=NOW)
    return p, s, a, envelope, args


@pytest.mark.parametrize("role", ROLES)
def test_role_envelope_preserves_trace_cost_evidence_and_never_accepts(role):
    _, s, a, e, args = fixture(role)
    receipt = s.validate_role_envelope(e, **args)
    assert receipt.valid and receipt.reason == "VALIDATED_PROPOSAL"
    assert not receipt.accepted and receipt.state_transitions == () and receipt.io_count == 0
    assert s.validate_role_envelope(e, **args) == receipt
    assert e.result.envelope.status == ResultStatus.COMPLETED
    assert (e.cost_units, e.latency_ms, e.task_id, e.parent_task_id) == (2, 15, "task1", "parent-task")
    assert s.validate(e.result, **args).reason == "ROLE_ENVELOPE_REQUIRED"


@pytest.mark.parametrize("field,value", [("task_id", "other"), ("parent_task_id", "other"),
    ("parent_actor_id", "other"), ("baseline_hash", "sha256:" + "f" * 64)])
def test_role_trace_rebinding_is_denied(field, value):
    _, s, a, e, args = fixture()
    assert s.validate_role_envelope(replace(e, **{field:value}), **args).reason == "ROLE_TRACE_MISMATCH"


@pytest.mark.parametrize("mode", ["mock", "fixture", "static", "build"])
def test_roles_cannot_promote_nonreal_evidence_to_complete(mode):
    _, s, a, e, args = fixture("TEST", mode=mode)
    assert s.validate_role_envelope(e, **args).reason == "EVIDENCE_NOT_REAL"


@pytest.mark.parametrize("status", ["SKIPPED", "BLOCKED", "FAIL", "NOT_EXECUTED"])
def test_unverified_is_not_success(status):
    _, s, a, e, args = fixture("TEST", status=status)
    assert s.validate_role_envelope(e, **args).reason == "EVIDENCE_NOT_PASS"


def test_code_changed_paths_require_lease_on_result_consumption_without_budget_use():
    p, s, a, e, args = fixture()
    e = replace(e, result=replace(e.result, envelope=replace(e.result.envelope, changed_paths=("src/a.py",))))
    assert s.validate_role_envelope(e, **args).reason == "CODE_WRITE_LEASE_REQUIRED"
    p.register_code_write_lease(lease(a), now=NOW)
    assert s.validate_role_envelope(e, **args).valid
    p.revoke_code_write_lease("lease-a1")
    assert not s.validate_role_envelope(e, **args).valid


@pytest.mark.parametrize("field,value", [("artifact_refs", ()), ("rollback", ""), ("provenance", ()),
    ("cost_units", -1), ("latency_ms", True)])
def test_missing_or_invalid_required_role_fields_rejected(field, value):
    _, _, _, e, _ = fixture()
    with pytest.raises(ValueError):
        replace(e, **{field:value})


def test_role_envelope_snapshot_tamper_and_requested_approval_deny():
    _, s, a, e, args = fixture("DEPLOY")
    other = replace(e, result=replace(e.result, requested_actions=("oracle_deploy",)))
    assert s.validate_role_envelope(other, **args).reason == "RESERVED_AUTHORITY"
    object.__setattr__(e.artifact_refs[0], "checksum", "sha256:" + "f" * 64)
    assert s.validate_role_envelope(e, **args).reason == "ROLE_ENVELOPE_TAMPERED"


def test_v2_critical_or_important_findings_require_rework_not_completed():
    _, s, a, e, args = fixture("REVIEW")
    finding = v.ReviewFinding("finding", "C22", "IMPORTANT", "src/a.py", "e1", "contract mismatch")
    e = replace(e, result=replace(e.result, review_findings=(finding,)))
    assert s.validate_role_envelope(e, **args).reason == "REVIEW_REWORK_REQUIRED"


def test_result_metadata_replay_change_cannot_reuse_old_inner_receipt():
    _, s, a, e, args = fixture()
    assert s.validate_role_envelope(e, **args).valid
    assert s.validate_role_envelope(replace(e, cost_units=3), **args).reason == "RESULT_REPLAY_CONFLICT"


def test_forced_nested_result_callback_never_runs():
    from tests.agent_team.test_role_contracts_c22 import Hostile
    _, s, a, e, args = fixture()
    object.__setattr__(e.result.envelope, "summary", Hostile())
    Hostile.calls = 0
    assert not s.validate_role_envelope(e, **args).valid
    assert Hostile.calls == 0


def test_role_envelope_construction_rejects_forced_callback_before_copy():
    from tests.agent_team.test_role_contracts_c22 import Hostile
    _, _, _, e, _ = fixture()
    object.__setattr__(e.result.evidence[0], "command", Hostile())
    Hostile.calls = 0
    with pytest.raises(ValueError):
        replace(e)
    assert Hostile.calls == 0


def test_v2_inner_result_construction_rejects_callback_before_copy():
    from tests.agent_team.test_role_contracts_c22 import Hostile
    _, _, _, e, _ = fixture()
    object.__setattr__(e.result.evidence[0], "command", Hostile())
    Hostile.calls = 0
    with pytest.raises(ValueError):
        replace(e.result)
    assert Hostile.calls == 0


def test_validation_receipt_binds_entire_trace_not_only_inner_result():
    _, s, _, e, args = fixture()
    assert s.validate_role_envelope(e, **args).result_hash == e.content_hash


def test_forced_content_hash_callback_is_rejected_before_comparison():
    from tests.agent_team.test_role_contracts_c22 import Hostile
    _, s, _, e, args = fixture()
    object.__setattr__(e, "content_hash", Hostile())
    Hostile.calls = 0
    assert not s.validate_role_envelope(e, **args).valid
    assert Hostile.calls == 0
