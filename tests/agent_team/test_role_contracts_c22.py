"""C22 host-only role contracts: no tools or external runtime are executed."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import pytest
from packages.agent_team import role_contracts as r
from packages.orchestration.delegation import PermissionSnapshot, DataEgressProfile, DelegationPacket

NOW = datetime(2026, 9, 18, 9, tzinfo=timezone.utc)
H = "sha256:" + "a" * 64
CTX = "sha256:" + "b" * 64
ROLES = ("PLANNING", "CODE", "REVIEW", "TEST", "DEPLOY")
EXPECTED = {
    "PLANNING": ("plan_result/v1", "plan_trace", "planning_analysis"),
    "CODE": ("implementation_result/v1", "implementation_diff", "implementation_execution"),
    "REVIEW": ("review_result/v1", "diff_review", "independent_review"),
    "TEST": ("test_result/v1", "independent_execution", "independent_execution"),
    "DEPLOY": ("deploy_readiness_result/v1", "deploy_readiness", "readiness_observation"),
}


def setup(role="CODE", *, service=None, suffix="1", writable=True):
    assert hasattr(r.AgentDefinition, "for_role"), "C22 five-role factory missing"
    parent = PermissionSnapshot(("src/**", "tests/**", "docs/**"), ("read", "execute", "write", "patch"),
        ("repo_read", "repo_diff", "test_run", "test_write", "test_patch", "code_write", "code_patch",
         "plan_read", "deploy_inspect"), ("local",), (), (".git/**",), ("delete", "merge", "deploy", "approve", "bypass"))
    actions = ("read", "execute", "write", "patch") if role == "CODE" else (("read", "execute") if role == "TEST" else ("read",))
    tools = ("repo_read", "code_write", "code_patch", "test_run") if role == "CODE" else (("test_run", "repo_read") if role == "TEST" else ("repo_read",))
    permission = replace(parent, allowed_actions=actions, allowed_tools=tools)
    definition = r.AgentDefinition.for_role(role, definition_id=role, version=1,
        read_scope=("src/**", "tests/**", "docs/**"), write_scope=("src/**",) if role == "CODE" and writable else (),
        prohibited_scope=(), permission_ceiling=permission, budget=r.BudgetLimits(20, 2000, 20, 120))
    egress = DataEgressProfile("local_only", (), (), ())
    service = service or r.RolePolicyService(session_id="session", baseline_hash=H, target_hash=H,
        implementation_actor="coder", implementation_context="code-context", implementation_workspace="code-workspace",
        implementation_context_hash="sha256:" + "c" * 64, parent_permission=parent, parent_egress=egress,
        parent_budget=r.BudgetLimits(100, 10000, 100, 1000))
    packet = DelegationPacket("d" + suffix, "parent-task", "main", "wi", 1, "task" + suffix,
        "workspace" + suffix, "bounded role work", ("scope",), ("production",), permission.allowed_paths,
        permission.prohibited_actions, "Guided", definition.result_schema, ("evidence",), "budget",
        ("bound evidence",), H, CTX, permission, permission.snapshot_hash, parent.snapshot_hash,
        egress, egress.snapshot_hash, egress.snapshot_hash)
    assignment = service.register(assignment_id="a" + suffix, definition=definition, packet=packet,
        actor_id="actor" + suffix, context_id="context" + suffix, thread_id="thread" + suffix,
        workspace_id=packet.workspace_id, session_id="session", context_snapshot_hash=CTX,
        issued_at=NOW, expires_at=NOW + timedelta(hours=1), execution_fence="exec" + suffix)
    return service, assignment


def lease(a, **updates):
    values = dict(lease_id="lease-" + a.assignment_id, assignment_id=a.assignment_id, actor_id=a.actor_id,
        workspace_id=a.workspace_id, paths=("src/**",), execution_fence=a.execution_fence, write_fence="write-" + a.assignment_id,
        baseline_hash=H, target_hash=H, work_instruction_id="wi", issued_at=NOW, expires_at=NOW + timedelta(hours=1),
        approval_ref="host-authenticated-wi-approval", work_instruction_hash="sha256:" + "f" * 64)
    values.update(updates)
    return r.CodeWriteLease(**values)


def action(s, a, **updates):
    values = dict(assignment=a, actor_id=a.actor_id, context_id=a.context_id, session_id=a.session_id,
        target_hash=H, execution_fence=a.execution_fence, now=NOW, action="read", tool="repo_read",
        backend="local", path="src/a.py")
    values.update(updates)
    return s.authorize_action(**values)


@pytest.mark.parametrize("role", ROLES)
def test_five_roles_have_distinct_complete_contracts_and_read_permission(role):
    s, a = setup(role)
    d = a.definition
    assert d.role == role and d.schema_version == "agent_definition/v2"
    assert d.result_schema == EXPECTED[role][0]
    assert d.required_evidence == (EXPECTED[role][1],)
    assert d.role_contract.input_contract and d.role_contract.output_contract
    assert d.role_contract.handoff_target == "MAIN"
    assert d.role_contract.failure_contract and d.role_contract.human_approval_boundary
    assert action(s, a).allowed
    assert replace(d).content_hash == d.content_hash


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("operation", ["approve", "merge", "deploy", "delete", "bypass", "oracle_deploy"])
def test_reserved_and_oracle_actions_are_always_denied(role, operation):
    s, a = setup(role)
    result = action(s, a, action=operation)
    assert result.reason == "RESERVED_AUTHORITY" and not result.allowed and result.io_count == 0


@pytest.mark.parametrize("role", ["PLANNING", "REVIEW", "TEST", "DEPLOY"])
def test_non_code_cannot_write_product_even_with_write_fence(role):
    s, a = setup(role)
    assert action(s, a, action="write", tool="code_write", write_fence="forged").reason == "ROLE_ACTION_DENIED"
    with pytest.raises(ValueError, match="CODE_ROLE_REQUIRED"):
        s.register_code_write_lease(lease(a), now=NOW)


def test_code_needs_exact_current_lease_and_both_fences():
    s, a = setup()
    assert action(s, a, action="write", tool="code_write").reason == "CODE_WRITE_LEASE_REQUIRED"
    s.register_code_write_lease(lease(a), now=NOW)
    assert action(s, a, action="write", tool="code_write", write_fence="write-a1").allowed
    assert action(s, a, action="patch", tool="code_patch", write_fence="old").reason == "STALE_WRITE_FENCE"
    assert action(s, a, execution_fence="old").reason == "STALE_EXECUTION_FENCE"
    assert action(s, a, action="write", tool="code_write", write_fence="write-a1", path="tests/a.py").reason == "CODE_WRITE_SCOPE_DENIED"
    s.revoke_code_write_lease("lease-a1")
    assert action(s, a, action="write", tool="code_write", write_fence="write-a1").reason == "CODE_WRITE_LEASE_REQUIRED"


def test_single_code_writer_across_workspaces_atomic_and_safe_replay():
    s, a = setup()
    _, b = setup(service=s, suffix="2")
    def register(item):
        try:
            s.register_code_write_lease(lease(item), now=NOW)
            return item.assignment_id
        except ValueError as error:
            assert str(error) == "CODE_WRITE_OWNER_CONFLICT"
            return None
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(register, [a, b] * 50))
    assert len(set(results) - {None}) == 1
    winner = a if "a1" in results else b
    s.revoke_code_write_lease(lease(winner).lease_id)
    with pytest.raises(ValueError, match="WRITE_LEASE_REBIND"):
        s.register_code_write_lease(lease(winner), now=NOW)


@pytest.mark.parametrize("path", ["src/../a", "C:/src/a", "src\\a", "src/%61", "src/CON", "src2/a", ".git/config"])
def test_code_scope_and_alias_escapes_deny_before_io(path):
    s, a = setup()
    s.register_code_write_lease(lease(a), now=NOW)
    result = action(s, a, action="write", tool="code_write", write_fence="write-a1", path=path)
    assert not result.allowed and result.io_count == 0


def test_definition_lease_and_returned_assignment_are_detached():
    s, a = setup()
    l = lease(a)
    s.register_code_write_lease(l, now=NOW)
    object.__setattr__(l, "write_fence", "evil")
    assert action(s, a, action="write", tool="code_write", write_fence="write-a1").allowed
    object.__setattr__(a.definition.role_contract, "handoff_target", "SELF")
    assert not action(s, a).allowed
    assert s.get_assignment("a1").definition.role_contract.handoff_target == "MAIN"


class Hostile:
    calls = 0
    def __deepcopy__(self, memo):
        Hostile.calls += 1
        return "read"
    def __hash__(self):
        Hostile.calls += 1
        return 1
    def __eq__(self, other):
        Hostile.calls += 1
        return True
    @property
    def content_hash(self):
        Hostile.calls += 1
        return H


def test_forced_assignment_payload_does_not_run_hash_or_deepcopy_callback():
    s, a = setup()
    object.__setattr__(a.packet.permission_snapshot, "allowed_actions", (Hostile(),))
    Hostile.calls = 0
    result = action(s, a)
    assert not result.allowed and Hostile.calls == 0


def test_arbitrary_assignment_property_is_not_called_by_denial():
    s, a = setup()
    Hostile.calls = 0
    result = action(s, a, assignment=Hostile())
    assert not result.allowed and Hostile.calls == 0


def test_legacy_definition_hash_is_unchanged_by_optional_v2_contract():
    import hashlib, json
    from tests.agent_team.test_role_contracts_e01 import fixture
    _, _, _, d, _ = fixture()
    primitive = r._plain(d)
    assert "role_contract" not in primitive
    assert d.content_hash == "sha256:" + hashlib.sha256(json.dumps(primitive, sort_keys=True,
        separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()).hexdigest()


@pytest.mark.parametrize("changes", [{"role": "MAIN"}, {"role": "CODE,REVIEW"},
    {"permission_ceiling": None}, {"required_evidence": ()}, {"role_contract": None}])
def test_invalid_role_contract_cannot_be_registered(changes):
    _, a = setup()
    with pytest.raises(ValueError):
        replace(a.definition, **changes)


def test_test_evidence_writes_still_require_explicit_current_grant():
    from tests.agent_team.test_role_contracts_e01 import fixture
    _, p, _, d, packet = fixture(writable=True)
    d = r.AgentDefinition.for_role("TEST", definition_id="test-v2", version=1, read_scope=d.read_scope,
        write_scope=d.write_scope, prohibited_scope=d.prohibited_scope, permission_ceiling=d.permission_ceiling, budget=d.budget)
    packet = replace(packet, expected_result_schema=d.result_schema)
    # The original E01 host helper supplies the separate approved test grant/lease.
    _, p, a, _, _ = fixture(writable=True, definition=d, packet=packet)
    from tests.agent_team.test_role_contracts_e01 import authorize
    assert authorize(p, a, action="write", tool="test_write", path="tests/evidence.py", write_fence="write-fence").allowed
    assert not authorize(p, a, action="write", tool="test_write", path="src/a.py", write_fence="write-fence").allowed


def test_code_lease_without_explicit_approved_work_instruction_reference_is_denied():
    s, a = setup()
    values = dict(lease_id="no-approval", assignment_id=a.assignment_id, actor_id=a.actor_id,
        workspace_id=a.workspace_id, paths=("src/**",), execution_fence=a.execution_fence,
        write_fence="write", baseline_hash=H, target_hash=H, work_instruction_id="wi",
        issued_at=NOW, expires_at=NOW + timedelta(hours=1))
    with pytest.raises(ValueError, match="WORK_INSTRUCTION_APPROVAL_REQUIRED"):
        r.CodeWriteLease(**values)
