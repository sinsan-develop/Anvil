"""D09 registry/projection only; program/process/network 실행은 없다."""
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import importlib
import pytest
from packages.knowledge.memory import MemoryScope, _hash, to_primitive
from tests.knowledge.test_candidates_d06 import NOW, setup as candidate_setup, create, ref, successor


def module():
    try:
        return importlib.import_module("packages.knowledge.hooks")
    except ModuleNotFoundError:
        pytest.fail("D09_HOOK_REGISTRY_MISSING")


def program(**changes):
    result = dict(program_id="program1", version=1, type="command", entrypoint=".anvil/hooks/check.py",
                  source_hash="a" * 64, dependency_hash="b" * 64, artifact_hash="c" * 64,
                  signature_hash="d" * 64, output_schema="hook-result-v1")
    return {**result, **changes}


def definition(h, identity="catalog-item", **changes):
    return dict(hook_id=identity, version=1, event="PreToolUse", matcher=dict(all=[dict(field="tool", op="eq", value="file.apply_patch"),
        dict(field="path", op="path_glob", value="infra/prod/**")], exclude=[]),
        program_ref=h.program_reference(program()), timeout_ms=1000, permissions=dict(filesystem="read_only", network="deny"),
        failure_policy="fail_closed", idempotency="required", recursion_guard=True, max_depth=1, **changes)


def observations():
    return [dict(observation_id="obs" + str(i), kind="REPEATED_MANUAL_CHECK", task_id="task" + str(i),
                 run_id="run" + str(i), input_hash=_hash(["input", i]), evidence_id="evidence" + str(i), evidence_hash=_hash(["proof", i])) for i in (1, 2)]


def setup():
    h = module()
    candidates, ctx, data, sources, _ = candidate_setup(importlib.import_module("packages.knowledge.candidates"), "HOOK")
    origin = ref(create(candidates, ctx, data))
    repo = h.HookRegistry(candidates)
    proposal = dict(proposal_id="proposal1", candidate_ref=origin, action="create_program_and_rule", before=[],
                    after=[definition(h)], programs=[program()])
    return h, repo, ctx, proposal, sources


def capture(repo, ctx, data, **kwargs):
    return repo.capture_observations(ctx, data, kwargs.pop("observations", observations()), now=NOW,
                                     expires_at=NOW + timedelta(hours=1), **kwargs)


def register(repo, ctx, data, **kwargs):
    capture(repo, ctx, data, **kwargs)
    candidate = repo.candidate(ctx, data, request_id="candidate-" + data["proposal_id"], now=NOW)
    return repo.register(ctx, candidate["proposal_ref"], request_id="register-" + data["proposal_id"], now=NOW)


def event(**kwargs):
    return dict(event_id="event1", event="PreToolUse", depth=0, payload=dict(tool="file.apply_patch", path="infra/prod/app.py"), **kwargs)


def result_for(receipt, action="allow", modifications=None):
    return [dict(hook_ref=to_primitive(x), result=action, modifications=modifications or {}, messages=[]) for x in receipt["matched"]]


def merged(repo, ctx, receipt, results):
    captured = repo.capture_results(ctx, receipt["content_hash"], results, now=NOW, expires_at=NOW + timedelta(minutes=5))
    return repo.merge(ctx, captured["capture_id"], now=NOW)


def test_registered_contract_is_immutable_pending_with_real_d06_lineage():
    h, repo, ctx, data, _ = setup()
    value = register(repo, ctx, data)
    assert value["status"] == "REGISTERED" and value["executable"] is False
    assert value["trust_status"] == "UNTRUSTED" and value["review_status"] == "REVIEW_REQUIRED"
    assert value["scope"]["project_id"] == "p1" and value["provenance"]["candidate_ref"] == data["candidate_ref"]
    assert len(value["provenance"]["observations"]) == 2
    with pytest.raises(TypeError):
        value["after"][0]["matcher"]["all"][0]["value"] = "other"
    data["after"][0]["matcher"]["all"][0]["value"] = "other"
    assert repo.query(ctx, "proposal1", now=NOW)["content_hash"] == value["content_hash"]


@pytest.mark.parametrize("field,value", [("type", "python"), ("type", "llm"), ("type", "agent"), ("entrypoint", "../check.py"),
    ("entrypoint", "C:/check.py"), ("entrypoint", "//server/share"), ("entrypoint", "hooks/../x"), ("entrypoint", "hooks\\x"),
    ("entrypoint", "hooks/%2e%2e/x"), ("source_hash", "fake"), ("version", True), ("output_schema", "raw-text")])
def test_program_contract_fail_closed(field, value):
    h = module()
    with pytest.raises(h.HookError):
        h.program_reference(program(**{field: value}))


@pytest.mark.parametrize("change", [dict(recursion_guard=False), dict(max_depth=2), dict(max_depth=True), dict(idempotency="optional"),
    dict(permissions=dict(filesystem="write", network="deny")), dict(permissions=dict(filesystem="read_only", network="allow")),
    dict(timeout_ms=0), dict(timeout_ms=True), dict(failure_policy="ignore"), dict(event="Unknown"), dict(depends_on=["other"])])
def test_definition_contract_fail_closed(change):
    h, repo, ctx, data, _ = setup()
    data["after"][0].update(change)
    with pytest.raises(h.HookError):
        capture(repo, ctx, data)


@pytest.mark.parametrize("condition", [dict(field="random", op="eq", value="x"), dict(field="tool", op="eval", value="x"),
    dict(field="path", op="regex", value="(.*)+"), dict(field="path", op="path_glob", value="infra/**/../*"),
    dict(field="path", op="path_glob", value="infra/[a-z]"), dict(field="tool", op="eq", value=True)])
def test_unknown_nondeterministic_or_malformed_matcher_rejected(condition):
    h, repo, ctx, data, _ = setup()
    data["after"][0]["matcher"]["all"] = [condition]
    with pytest.raises(h.HookError):
        capture(repo, ctx, data)


def test_no_self_attestation_or_cross_context_and_expiry():
    h, repo, ctx, data, sources = setup()
    with pytest.raises(h.HookError, match="HOOK_OBSERVATIONS_REQUIRED"):
        repo.candidate(ctx, data, request_id="raw", now=NOW)
    capture(repo, ctx, data)
    with pytest.raises(h.HookError, match="HOOK_OBSERVATIONS_REQUIRED"):
        repo.candidate(ctx, data, request_id="expired", now=NOW + timedelta(hours=1))
    other = sources.admit_host("human1", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=1))
    with pytest.raises(h.HookError):
        repo.candidate(other, data, request_id="foreign", now=NOW)


@pytest.mark.parametrize("alias", ["observation_id", "task_id", "run_id", "input_hash", "evidence_id", "evidence_hash"])
def test_two_labels_do_not_make_independent_observations(alias):
    h, repo, ctx, data, _ = setup()
    obs = observations()
    obs[1][alias] = obs[0][alias]
    with pytest.raises(h.HookError, match="HOOK_INDEPENDENT_OBSERVATIONS_REQUIRED"):
        capture(repo, ctx, data, observations=obs)


@pytest.mark.parametrize("action", ["patch_matcher", "upgrade_program", "split", "merge", "quarantine", "retire", "execute"])
def test_action_requires_exact_before_after_shape(action):
    h, repo, ctx, data, _ = setup()
    data["action"] = action
    with pytest.raises(h.HookError):
        capture(repo, ctx, data)


def test_exact_path_exclusions_idempotency_and_recursion():
    h, repo, ctx, data, _ = setup()
    data["after"][0]["matcher"]["exclude"] = [dict(field="path", op="path_glob", value="infra/prod/docs/**")]
    register(repo, ctx, data)
    receipt = repo.match(ctx, event(), now=NOW)
    assert len(receipt["matched"]) == 1 and receipt["executed"] is False
    assert repo.match(ctx, event(), now=NOW)["content_hash"] == receipt["content_hash"]
    for i, path in enumerate(["infra/production/a.py", "infra/prod/docs/a.md"]):
        ev = event(); ev["event_id"] += str(i); ev["payload"]["path"] = path
        assert repo.match(ctx, ev, now=NOW)["matched"] == ()
    ev = event(); ev["payload"]["tool"] = "other"
    with pytest.raises(h.HookError, match="HOOK_IDEMPOTENCY_CONFLICT"):
        repo.match(ctx, ev, now=NOW)
    ev = event(); ev["event_id"] = "recursive-event"; ev["depth"] = 1
    assert repo.match(ctx, ev, now=NOW)["reason"] == "HOOK_RECURSION_BLOCKED"


@pytest.mark.parametrize("path", ["infra/prod/../secret", "infra/prod//a", "infra/prod/%2e%2e/a", "/infra/prod/a", "infra/prod/a:stream"])
def test_event_path_escape_is_denied_before_projection(path):
    h, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    ev = event(); ev["payload"]["path"] = path
    with pytest.raises(h.HookError):
        repo.match(ctx, ev, now=NOW)


@pytest.mark.parametrize("policy,decision", [("fail_closed", "deny"), ("fail_open", "allow")])
@pytest.mark.parametrize("kind", ["timeout", "error"])
def test_fault_policy_audit_matches_engine_projection(policy, decision, kind):
    h, repo, ctx, data, _ = setup(); data["after"][0]["failure_policy"] = policy
    value = register(repo, ctx, data)
    result = repo.fault_projection(ctx, value["hook_refs"][0], kind, now=NOW)
    assert result["decision"] == decision and result["program_result"] is None
    assert result["executed"] is False and result["warning"] == (policy == "fail_open")
    assert result == repo.query(ctx, "proposal1", now=NOW)["audit"][-1]


@pytest.mark.parametrize("ev,allowed", [("SessionStart", ["context", "log"]), ("UserPromptSubmit", ["allow", "deny", "context"]),
    ("PreToolUse", ["allow", "deny", "ask", "modify"]), ("PermissionRequest", ["allow", "deny", "context"]),
    ("PostToolUse", ["context", "log"]), ("PreCompact", ["log", "persist"]), ("PostCompact", ["context", "log"]),
    ("SubagentStart", ["context", "log"]), ("SubagentStop", ["allow", "block", "log"]),
    ("Stop", ["allow", "block", "log"]), ("SessionEnd", ["log", "persist"])])
def test_event_result_matrix(ev, allowed):
    h = module()
    for result in {"allow", "deny", "ask", "modify", "context", "log", "persist", "block"}:
        if result in allowed:
            assert h.validate_result(ev, dict(result=result, modifications={"arguments.limit": 1} if result == "modify" else {}, messages=[]))["result"] == result
        else:
            with pytest.raises(h.HookError, match="HOOK_EVENT_RESULT_MISMATCH"):
                h.validate_result(ev, dict(result=result, modifications={}, messages=[]))


def test_merge_cannot_accept_payload_result_authority_and_fault_deny():
    h, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    receipt = repo.match(ctx, event(), now=NOW)
    with pytest.raises(h.HookError, match="HOOK_RESULT_CAPTURE_REQUIRED"):
        repo.merge(ctx, "forged", now=NOW)
    assert merged(repo, ctx, receipt, result_for(receipt, "deny"))["decision"] == "deny"
    with pytest.raises(h.HookError, match="HOOK_RESULT_TARGET_MISMATCH"):
        repo.capture_results(ctx, receipt["content_hash"], [], now=NOW, expires_at=NOW + timedelta(minutes=1))


@pytest.mark.parametrize("results,decision,reason", [([("allow", {}), ("deny", {})], "deny", "HOOK_DENY"),
    ([("modify", {"arguments.limit": 1}), ("ask", {})], "ask", "HOOK_ASK"),
    ([("modify", {"arguments.limit": 1}), ("modify", {"arguments.limit": 2})], "deny", "HOOK_MODIFY_CONFLICT"),
    ([("modify", {"arguments.limit": 1}), ("modify", {"arguments": {"limit": 1}})], "deny", "HOOK_MODIFY_CONFLICT"),
    ([("modify", {"arguments.limit": 1}), ("modify", {"arguments.limit": 1})], "modify", "HOOK_MODIFY")])
def test_merge_priority_and_conflicts_are_order_independent(results, decision, reason):
    h = module()
    values = [dict(result=a, modifications=b, messages=[]) for a, b in results]
    first = h.merge_results("PreToolUse", values)
    assert first["decision"] == decision and first["reason"] == reason
    assert h.merge_results("PreToolUse", list(reversed(values))) == first


def test_source_revoke_blocks_new_match_and_keeps_historical_query():
    h, repo, ctx, data, sources = setup(); register(repo, ctx, data)
    sources.transition(ctx, "s1", "REVOKED", reason="PERMISSION_REVOKED", expected_version=1, request_id="revoke", now=NOW)
    with pytest.raises(h.HookError):
        repo.match(ctx, event(), now=NOW)
    assert repo.query(ctx, "proposal1", now=NOW)["status"] == "REGISTERED"


def next_proposal(repo, ctx, data, identity, action, before, after, programs):
    original = to_primitive(repo._candidates.query(ctx, data["candidate_ref"]["candidate_id"], now=NOW)["candidate"])
    original = {k: original[k] for k in "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref".split()}
    original["expires_at"] = datetime.fromisoformat(original["expires_at"])
    proposal = successor(repo._candidates, ctx, original, identity)
    proposal["intent"] = {"create_rule":"CREATE", "create_program_and_rule":"CREATE", "patch_matcher":"PATCH", "upgrade_program":"PATCH",
                          "split":"SPLIT", "merge":"MERGE", "quarantine":"ARCHIVE", "retire":"ARCHIVE"}[action]
    proposal["target_id"] = before[0]["hook_id"] if before else after[0]["hook_id"]
    origin = ref(create(repo._candidates, ctx, proposal, request="origin-" + identity))
    return dict(proposal_id="proposal" + identity, candidate_ref=origin, action=action, before=to_primitive(before), after=after, programs=programs)


@pytest.mark.parametrize("action", ["create_rule", "patch_matcher", "upgrade_program", "split", "merge", "quarantine", "retire"])
def test_all_action_shapes_keep_versions_pending_and_history(action):
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    before, after, programs = [first["hook_refs"][0]], [deepcopy(data["after"][0])], []
    if action == "create_rule":
        before = []; after = [definition(h, "second")]
    elif action == "patch_matcher":
        after[0]["version"] = 2; after[0]["matcher"]["all"] = [dict(field="tool", op="eq", value="read")]
    elif action == "upgrade_program":
        after[0]["version"] = 2; programs = [program(version=2, source_hash="e" * 64)]
        after[0]["program_ref"] = h.program_reference(programs[0])
    elif action == "split":
        after = [definition(h, "split-a"), definition(h, "split-b")]
    elif action == "merge":
        second_data = next_proposal(repo, ctx, data, "second", "create_rule", [], [definition(h, "second")], [])
        second = register(repo, ctx, second_data)
        before += [second["hook_refs"][0]]; after = [definition(h, "merged")]
    else:
        after = []
    revised = next_proposal(repo, ctx, data, "revision", action, before, after, programs)
    value = register(repo, ctx, revised)
    assert value["executable"] is False and value["trust_status"] == "UNTRUSTED"
    assert repo.version(ctx, first["hook_refs"][0], now=NOW)["hook_ref"] == first["hook_refs"][0]
    assert value["status"] == {"quarantine":"QUARANTINED", "retire":"RETIRED"}.get(action, "REGISTERED")


def test_managed_order_cannot_mask_any_unmanaged_deny_and_hash_is_stable():
    h, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    other = next_proposal(repo, ctx, data, "second", "create_rule", [], [definition(h, "z-managed")], [])
    register(repo, ctx, other, managed=True)
    receipt = repo.match(ctx, event(), now=NOW)
    assert [r["hook_id"] for r in receipt["matched"]] == ["z-managed", "catalog-item"]
    values = result_for(receipt); values[1]["result"] = "deny"
    value = merged(repo, ctx, receipt, values)
    assert value["decision"] == "deny"
    assert repo.match(ctx, event(), now=NOW) == receipt
    assert value == merged(repo, ctx, receipt, list(reversed(values)))


@pytest.mark.parametrize("changed", ["source_hash", "dependency_hash", "artifact_hash", "signature_hash", "entrypoint"])
def test_program_hash_change_cannot_reuse_program_version(changed):
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    p = program(**{changed: "other.py" if changed == "entrypoint" else "e" * 64})
    after = deepcopy(data["after"]); after[0].update(version=2, program_ref=h.program_reference(p))
    revised = next_proposal(repo, ctx, data, "revision", "upgrade_program", first["hook_refs"], after, [p])
    capture(repo, ctx, revised)
    pending = repo.candidate(ctx, revised, request_id="c2", now=NOW)
    with pytest.raises(h.HookError, match="HOOK_PROGRAM_VERSION_CONFLICT"):
        repo.register(ctx, pending["proposal_ref"], request_id="r2", now=NOW)
    assert repo.match(ctx, event(), now=NOW)["matched"] == first["hook_refs"]


def test_registration_cas_rechecks_before_after_staging():
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    after = deepcopy(data["after"]); after[0]["version"] = 2
    after[0]["matcher"]["exclude"] = [dict(field="path", op="path_glob", value="infra/prod/docs/**")]
    revised = next_proposal(repo, ctx, data, "revision", "patch_matcher", first["hook_refs"], after, [])
    capture(repo, ctx, revised)
    staged = repo.candidate(ctx, revised, request_id="staged", now=NOW)
    concurrent = next_proposal(repo, ctx, data, "concurrent", "patch_matcher", first["hook_refs"], after, [])
    register(repo, ctx, concurrent)
    with pytest.raises(h.HookError, match="HOOK_REFERENCE_MISMATCH"):
        repo.register(ctx, staged["proposal_ref"], request_id="stale", now=NOW)


@pytest.mark.parametrize("ev", ["PreToolUse", "SessionStart"])
@pytest.mark.parametrize("policy,decision", [("fail_closed", "deny"), ("fail_open", "allow")])
@pytest.mark.parametrize("kind", ["timeout", "error"])
def test_captured_fault_is_merged_as_engine_decision_not_program_result(ev, policy, decision, kind):
    h, repo, ctx, data, _ = setup()
    data["after"][0].update(event=ev, failure_policy=policy)
    register(repo, ctx, data)
    e = event(); e["event"] = ev
    receipt = repo.match(ctx, e, now=NOW)
    results = [dict(hook_ref=to_primitive(receipt["matched"][0]), fault=kind)]
    output = merged(repo, ctx, receipt, results)
    assert output["decision"] == decision and output["faults"][0]["program_result"] is None
    assert output == repo.query(ctx, "proposal1", now=NOW)["audit"][-1]


def test_result_capture_expiry_cross_context_and_alias_are_fail_closed():
    h, repo, ctx, data, sources = setup(); register(repo, ctx, data)
    receipt = repo.match(ctx, event(), now=NOW)
    values = result_for(receipt, "deny")
    proof = repo.capture_results(ctx, receipt["content_hash"], values, now=NOW, expires_at=NOW + timedelta(minutes=1))
    values[0]["result"] = "allow"
    assert repo.merge(ctx, proof["capture_id"], now=NOW)["decision"] == "deny"
    with pytest.raises(h.HookError, match="HOOK_RESULT_CAPTURE_REQUIRED"):
        repo.merge(ctx, proof["capture_id"], now=NOW + timedelta(minutes=1))
    other = sources.admit_host("human1", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=1))
    with pytest.raises(h.HookError, match="HOOK_RESULT_CAPTURE_REQUIRED"):
        repo.merge(other, proof["capture_id"], now=NOW)


@pytest.mark.parametrize("payload", [dict(tool=True), dict(path=["infra/prod/a"]), dict(tool="read", now="today"), dict(path="infra/prod/a\u0001")])
def test_event_type_drift_and_unknown_fields_fail_closed(payload):
    h, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    e = event(); e["payload"] = payload
    with pytest.raises(h.HookError):
        repo.match(ctx, e, now=NOW)


def test_program_version_exposes_exact_origin_without_implying_signature_verification():
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    record = repo.version(ctx, first["hook_refs"][0], now=NOW)
    assert record["program"]["candidate_ref"] == data["candidate_ref"]
    assert record["program"]["ref"] == data["after"][0]["program_ref"]
    assert record["program"]["signature_verification"] == "NOT_EXECUTED"
    assert record["program"]["scope"]["project_id"] == "p1"


def test_concurrent_registration_publishes_only_one_identical_version():
    h, repo, ctx, data, _ = setup(); capture(repo, ctx, data)
    c = repo.candidate(ctx, data, request_id="c", now=NOW)
    def attempt(i):
        try:
            return repo.register(ctx, c["proposal_ref"], request_id="r" + str(i), now=NOW)["status"]
        except h.HookError as error:
            return error.reason
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(attempt, [1, 2])) == ["HOOK_ALREADY_REGISTERED", "REGISTERED"]
    assert len(repo.match(ctx, event(), now=NOW)["matched"]) == 1


@pytest.mark.parametrize("claim", ["trust", "managed", "source_provenance", "actor", "status", "approval"])
def test_proposal_body_cannot_issue_host_authority(claim):
    h, repo, ctx, data, _ = setup(); data[claim] = True
    with pytest.raises(h.HookError, match="INVALID_HOOK_INPUT"):
        capture(repo, ctx, data)


def test_definition_version_cannot_reuse_hash_or_add_order_dependency():
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    after = deepcopy(data["after"])
    after[0]["matcher"]["all"] = [dict(field="tool", op="eq", value="read")]
    revised = next_proposal(repo, ctx, data, "revision", "patch_matcher", first["hook_refs"], after, [])
    with pytest.raises(h.HookError, match="HOOK_VERSION_CONFLICT"):
        capture(repo, ctx, revised)
    revised["after"][0]["version"] = 2
    revised["after"][0]["depends_on"] = ["unrelated"]
    with pytest.raises(h.HookError, match="INVALID_HOOK_INPUT"):
        capture(repo, ctx, revised)


@pytest.mark.parametrize("reorder", [False, True])
def test_r1_patch_matcher_rejects_version_only_or_canonical_noop(reorder):
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    after = deepcopy(data["after"]); after[0]["version"] = 2
    if reorder:
        after[0]["matcher"]["all"].reverse()
    revised = next_proposal(repo, ctx, data, "r1", "patch_matcher", first["hook_refs"], after, [])
    with pytest.raises(h.HookError, match="HOOK_ACTION_NO_CHANGE"):
        capture(repo, ctx, revised)


@pytest.mark.parametrize("before_event,after_event,allowed", [("SessionStart", "PostToolUse", True),
    ("UserPromptSubmit", "PermissionRequest", True), ("PermissionRequest", "UserPromptSubmit", True),
    ("SessionStart", "PreToolUse", False), ("PreToolUse", "Stop", False), ("Stop", "SessionEnd", False)])
def test_r1_event_change_requires_existing_result_contract_compatibility(before_event, after_event, allowed):
    h, repo, ctx, data, _ = setup(); data["after"][0]["event"] = before_event
    first = register(repo, ctx, data)
    after = deepcopy(data["after"]); after[0].update(version=2, event=after_event)
    revised = next_proposal(repo, ctx, data, "r1", "patch_matcher", first["hook_refs"], after, [])
    if allowed:
        result = register(repo, ctx, revised)
        assert result["after"][0]["event"] == after_event and result["executable"] is False
        assert result["trust_status"] == "UNTRUSTED"
    else:
        with pytest.raises(h.HookError, match="HOOK_EVENT_RESULT_CONTRACT_MISMATCH"):
            capture(repo, ctx, revised)


@pytest.mark.parametrize("field,value", [("timeout_ms", 2000), ("failure_policy", "fail_open"),
    ("permissions", dict(filesystem="write", network="deny")), ("program_ref", dict(program_id="other", version=1, content_hash="a" * 64))])
def test_r1_patch_matcher_cannot_modify_other_contract_fields(field, value):
    h, repo, ctx, data, _ = setup(); first = register(repo, ctx, data)
    after = deepcopy(data["after"]); after[0].update(version=2, **{field: value})
    after[0]["matcher"]["exclude"] = [dict(field="path", op="eq", value="infra/prod/excluded.py")]
    revised = next_proposal(repo, ctx, data, "r1", "patch_matcher", first["hook_refs"], after, [])
    with pytest.raises(h.HookError):
        capture(repo, ctx, revised)


@pytest.mark.parametrize("first_depth,second_depth,payload_change", [(1, 0, False), (0, 1, False), (1, 2, False), (1, 1, True)])
def test_r1_recursion_event_identity_cannot_be_rebound(first_depth, second_depth, payload_change):
    h, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    first = event(); first["depth"] = first_depth
    original = repo.match(ctx, first, now=NOW)
    assert repo.match(ctx, first, now=NOW) == original
    changed = deepcopy(first); changed["depth"] = second_depth
    if payload_change:
        changed["payload"]["path"] = "infra/prod/other.py"
    with pytest.raises(h.HookError, match="HOOK_IDEMPOTENCY_CONFLICT"):
        repo.match(ctx, changed, now=NOW)


def test_r1_recursive_denial_has_receipt_but_cannot_be_promoted_to_allow():
    h, repo, ctx, data, _ = setup(); register(repo, ctx, data)
    e = event(); e["depth"] = 1
    denied = repo.match(ctx, e, now=NOW)
    assert denied["reason"] == "HOOK_RECURSION_BLOCKED"
    assert (id(ctx), denied["content_hash"]) in repo._receipts
    with pytest.raises(h.HookError, match="HOOK_RECURSION_BLOCKED"):
        repo.capture_results(ctx, denied["content_hash"], [], now=NOW, expires_at=NOW + timedelta(minutes=1))


@pytest.mark.parametrize("value", ["root.py", "infra/prod/app.py", ".anvil/hooks/check.py", "a/b/c/d.txt"])
def test_r1_root_double_star_matches_all_canonical_depths(value):
    h, repo, ctx, data, _ = setup()
    data["after"][0]["matcher"]["all"] = [dict(field="path", op="path_glob", value="**")]
    first = register(repo, ctx, data)
    e = event(); e["payload"]["path"] = value
    assert repo.match(ctx, e, now=NOW)["matched"] == first["hook_refs"]


@pytest.mark.parametrize("value", ["../x", "a/../b", "a//b", "a/%2e%2e/b", "/a/b", "C:/a", "a\\b"])
def test_r1_root_double_star_never_bypasses_path_normalization(value):
    h, repo, ctx, data, _ = setup()
    data["after"][0]["matcher"]["all"] = [dict(field="path", op="path_glob", value="**")]
    register(repo, ctx, data)
    e = event(); e["payload"]["path"] = value
    with pytest.raises(h.HookError, match="HOOK_UNSAFE_PATH"):
        repo.match(ctx, e, now=NOW)
