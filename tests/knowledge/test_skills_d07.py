"""D-07: 실제 D-03~D-06 in-memory authority를 통한 progressive load, 외부 IO 없음."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
from hashlib import sha256
import importlib
import json
import pytest
from packages.knowledge.memory import _canonical, to_primitive, MemoryScope
from tests.knowledge.test_candidates_d06 import setup as candidate_setup, activate, snapshot, select as run_select, successor, NOW


AT = NOW + timedelta(seconds=1)


def module():
    try:
        return importlib.import_module("packages.knowledge.skills")
    except ModuleNotFoundError:
        pytest.fail("D07_PROGRESSIVE_SKILL_LOADER_MISSING")


def digest(value):
    return sha256(value.encode("utf-8")).hexdigest()


def payload(active):
    content = "L2_ONLY_REFERENCE_CONTENT"
    resources = [dict(path="references/check.md", kind="reference", content_hash=digest(content))]
    body = "# Procedure\nL1_ONLY_COMPLETE_BODY\nRead the declared reference when needed.\n```anvil-resources\n" + json.dumps(resources) + "\n```\n# Verification\nKeep the result.\n"
    return dict(skill_id=active["target_id"], name=active["target_id"], version=active["version"],
                description="Verify bounded retry", tags=["verification"], scope=to_primitive(active["scope"]),
                triggers=["retry"] if active["risk_delta"]["implicit_trigger"] else [], exclusions=["production"], risk=active["risk_delta"]["risk"],
                capabilities=to_primitive(active["risk_delta"]["capabilities"]), body=body, body_hash=digest(body),
                resources=resources, resource_contents={resources[0]["path"]: content})


def setup(*, risk=None, capture=True, kind="SKILL"):
    c = importlib.import_module("packages.knowledge.candidates")
    candidates, ctx, proposal, sources, snapshots = candidate_setup(c, kind=kind)
    if risk:
        proposal["risk_delta"].update(risk)
    active = activate(candidates, ctx, proposal)
    selection = run_select(candidates, ctx, [to_primitive(active)], snapshot(snapshots), now=AT)
    s = module()
    repo = s.SkillRepository(candidates)
    data = payload(active)
    sr = dict(selection_id=selection["selection_id"], content_hash=selection["content_hash"])
    ar = {k: active[k] for k in ("activation_id", "version", "content_hash")}
    reference = None
    if capture:
        reference = repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host-materialization", now=AT, expires_at=NOW + timedelta(minutes=10))
    return repo, ctx, sr, reference, data, candidates, active, sources, ar


def invoke(env, *, mode="explicit", task="verify retry", request="select", now=AT):
    repo, ctx, sr, ref, *_ = env
    return repo.select(ctx, sr, to_primitive(ref), task=task, mode=mode, request_id=request, now=now)


def invref(value):
    return dict(invocation_id=value["invocation_id"], content_hash=value["content_hash"])


def test_l0_match_whole_l1_exact_l2_and_usage_lineage():
    env = setup()
    repo, ctx, sr, ref, data, candidates, active, _, _ = env
    catalog = repo.catalog(ctx, sr, scope=data["scope"], now=AT)
    assert len(catalog["items"]) == 1 and catalog["items"][0]["status"] == "ACTIVE"
    assert "L1_ONLY" not in _canonical(catalog) and "L2_ONLY" not in _canonical(catalog)
    assert "resources" not in catalog["items"][0] and "body_hash" not in catalog["items"][0]
    matches = repo.match(ctx, sr, scope=data["scope"], task="verify retry", limit=1, now=AT)
    assert not matches["items"] and not repo.audit(ctx, sr, now=AT)["events"]
    assert catalog["items"][0]["invocation_policy"] == "EXPLICIT_ONLY_NO_APPROVED_TRIGGER_MANIFEST"
    selected = invoke(env)
    assert not candidates._uses
    loaded = repo.load_l1(ctx, invref(selected), now=AT)
    assert loaded["body"] == data["body"] and loaded["body_hash"] == digest(data["body"])
    assert "L2_ONLY" not in _canonical(loaded) and candidates._uses
    resource = data["resources"][0]
    l2 = repo.load_l2(ctx, invref(selected), **resource, now=AT)
    assert l2["content"] == "L2_ONLY_REFERENCE_CONTENT" and l2["executed"] is False
    use = repo.record_use(ctx, invref(selected), outcome="SUCCESS", evidence_ref="validation-1", request_id="use", now=AT)
    assert use["run_id"] == "next-run" and use["task_id"] == "task-next-run"
    assert use["selection_hash"] == sr["content_hash"] and use["activation_hash"] == active["content_hash"]
    assert use["l1_hash"] == loaded["content_hash"] and len(use["l2_hashes"]) == 1
    assert [event["kind"] for event in repo.audit(ctx, sr, now=AT)["events"]] == ["SELECTED", "L1_LOADED", "L2_LOADED", "USED"]


@pytest.mark.parametrize("risk", [{"risk": "HIGH"}, {"risk": "MEDIUM"}, {"capabilities": ["READ", "WRITE"]}, {"capabilities": ["NETWORK"]}, {"capabilities": ["SECRET"]}, {"capabilities": ["EXECUTE"]}, {"script": True}])
def test_implicit_unsafe_skills_not_matched_or_loaded_but_explicit_only_loads(risk):
    env = setup(risk=risk)
    repo, ctx, sr, _, data, *_ = env
    assert repo.match(ctx, sr, scope=data["scope"], task="retry", limit=5, now=AT)["items"] == ()
    with pytest.raises(module().SkillError, match="IMPLICIT_SKILL_DENIED"):
        invoke(env, mode="implicit")
    assert not repo.audit(ctx, sr, now=AT)["events"]
    assert repo.load_l1(ctx, invref(invoke(env, mode="explicit")), now=AT)["body"] == data["body"]


@pytest.mark.parametrize("task", ["production retry", "unrelated task", "retry production retry"])
def test_exclusion_precedes_trigger_and_nonmatch_does_not_select(task):
    env = setup(risk={"implicit_trigger": True})
    with pytest.raises(module().SkillError, match="IMPLICIT_SKILL_DENIED"):
        invoke(env, task=task, mode="implicit")
    assert not env[0].audit(env[1], env[2], now=AT)["events"]


@pytest.mark.parametrize("field,value", [("skill_id", "foreign"), ("name", "foreign"), ("version", 2), ("body_hash", "a" * 64), ("risk", "HIGH"), ("scope", dict(user_id="u2", scope="project", project_id="p1"))])
def test_materialization_identity_and_hash_cannot_relabel_activation(field, value):
    repo, ctx, sr, _, data, _, _, _, ar = setup(capture=False)
    data[field] = value
    with pytest.raises(module().SkillError):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))
    assert not repo.catalog(ctx, sr, scope=MemoryScope("u1", "project", "p1"), now=AT)["items"]


@pytest.mark.parametrize("change", ["manifest", "resource_hash", "extra_content", "path", "kind", "duplicate"])
def test_only_manifest_exact_safe_resources_can_materialize(change):
    repo, ctx, sr, _, data, _, _, _, ar = setup(capture=False)
    if change == "manifest":
        data["body"] = "# No resources declared"
        data["body_hash"] = digest(data["body"])
    elif change == "resource_hash":
        data["resource_contents"]["references/check.md"] = "changed"
    elif change == "extra_content":
        data["resource_contents"]["private/hidden.md"] = "private sibling"
    else:
        if change == "path":
            data["resources"][0]["path"] = "../private.md"
        elif change == "kind":
            data["resources"][0]["kind"] = "auto-execute"
        else:
            data["resources"].append(deepcopy(data["resources"][0]))
        data["body"] = "```anvil-resources\n" + json.dumps(data["resources"]) + "\n```"
        data["body_hash"] = digest(data["body"])
    with pytest.raises(module().SkillError):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))


@pytest.mark.parametrize("path", ["../x", "/x", "C:/x", "\\\\host\\x", "references/../x", "references//check.md", "references/check.md ", "references/%2e%2e/x", "references/CON", "references/check.md:stream"])
def test_l2_path_escape_and_alias_never_load(path):
    env = setup()
    selected = invoke(env)
    env[0].load_l1(env[1], invref(selected), now=AT)
    with pytest.raises(module().SkillError):
        env[0].load_l2(env[1], invref(selected), path=path, kind="reference", content_hash=env[4]["resources"][0]["content_hash"], now=AT)
    assert len(env[0].audit(env[1], env[2], now=AT)["events"]) == 2


def test_selection_then_l1_then_l2_is_mandatory():
    env = setup()
    repo, ctx = env[:2]
    with pytest.raises(module().SkillError, match="SKILL_INVOCATION_REQUIRED"):
        repo.load_l1(ctx, dict(invocation_id="forged", content_hash="a" * 64), now=AT)
    selected = invoke(env)
    with pytest.raises(module().SkillError, match="SKILL_L1_REQUIRED"):
        repo.load_l2(ctx, invref(selected), **env[4]["resources"][0], now=AT)
    with pytest.raises(module().SkillError, match="SKILL_L1_REQUIRED"):
        repo.record_use(ctx, invref(selected), outcome="SUCCESS", evidence_ref="e", request_id="use", now=AT)


def test_unselected_activation_foreign_context_and_forged_selection_denied():
    env = setup()
    repo, ctx, sr, ref, data, candidates, active, sources, ar = env
    foreign = sources.admit_host("human2", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=1))
    with pytest.raises(module().SkillError):
        repo.catalog(foreign, sr, scope=data["scope"], now=AT)
    forged = dict(sr, content_hash="a" * 64)
    with pytest.raises(module().SkillError, match="SKILL_SELECTION_MISMATCH"):
        repo.select(ctx, forged, to_primitive(ref), task="retry", mode="explicit", request_id="x", now=AT)
    original = to_primitive(candidates.query(ctx, active["candidate_ref"]["candidate_id"], now=AT))["candidate"]
    original = {key: original[key] for key in "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref".split()}
    original["expires_at"] = NOW + timedelta(hours=6)
    other_proposal = successor(candidates, ctx, original, "other")
    other_proposal["target_id"] = "other-skill"
    other_active = activate(candidates, ctx, other_proposal)
    next_sr = run_select(candidates, ctx, [to_primitive(other_active)], snapshot(candidates._snapshots, run="foreign-run", instant=NOW + timedelta(seconds=2)), now=NOW + timedelta(seconds=2))
    with pytest.raises(module().SkillError):
        repo.capture_materialization(ctx, ar, dict(selection_id=next_sr["selection_id"], content_hash=next_sr["content_hash"]), data, evidence_ref="host", now=NOW + timedelta(seconds=2), expires_at=NOW + timedelta(minutes=10))


def test_expiry_reissue_preserves_identity_and_old_time_is_stale():
    env = setup()
    repo, ctx, sr, ref, data, _, _, _, ar = env
    changed = deepcopy(data)
    changed["description"] = "Other meaning"
    for instant in (AT, NOW + timedelta(minutes=10)):
        with pytest.raises(module().SkillError, match="SKILL_MATERIALIZATION_REBIND"):
            repo.capture_materialization(ctx, ar, sr, changed, evidence_ref="host-materialization", now=instant, expires_at=NOW + timedelta(minutes=20))
    renewed = repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host-materialization", now=NOW + timedelta(minutes=10), expires_at=NOW + timedelta(minutes=20))
    assert renewed == ref
    with pytest.raises(module().SkillError, match="SKILL_MATERIALIZATION_STALE"):
        invoke(env, now=AT)
    assert invoke(env, now=NOW + timedelta(minutes=10))["skill_ref"] == ref


@pytest.mark.parametrize("operation", ["catalog", "match", "select", "l1", "l2", "use"])
@pytest.mark.parametrize("contain", ["revoke", "rollback"])
def test_revoke_and_rollback_block_new_load_and_keep_audit(operation, contain):
    env = setup()
    repo, ctx, sr, ref, data, candidates, active, sources, _ = env
    selected = invoke(env)
    repo.load_l1(ctx, invref(selected), now=AT)
    before = repo.audit(ctx, sr, now=AT)
    if contain == "revoke":
        sources.transition(ctx, "s1", "REVOKED", reason="DELETED", expected_version=1, request_id="revoke", now=AT)
    else:
        candidates.rollback(ctx, to_primitive(active["candidate_ref"]), reason="quality", evidence_ref="retest", expected_version=5, request_id="rollback", now=AT)
    if operation in ("catalog", "match"):
        args = dict(scope=data["scope"], now=AT)
        if operation == "match":
            args.update(task="retry", limit=5)
        assert not getattr(repo, operation)(ctx, sr, **args)["items"]
    else:
        with pytest.raises(module().SkillError):
            if operation == "select":
                invoke(env, mode="explicit", request="another")
            elif operation == "l1":
                repo.load_l1(ctx, invref(selected), now=AT)
            elif operation == "l2":
                repo.load_l2(ctx, invref(selected), **data["resources"][0], now=AT)
            else:
                repo.record_use(ctx, invref(selected), outcome="SUCCESS", evidence_ref="e", request_id="use", now=AT)
    assert repo.audit(ctx, sr, now=AT) == before


def test_replay_concurrency_and_detached_snapshot_are_canonical():
    env = setup()
    repo, ctx = env[:2]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: invoke(env), range(8)))
    assert all(result == results[0] for result in results)
    selected = results[0]
    loaded = repo.load_l1(ctx, invref(selected), now=AT)
    mutated = to_primitive(loaded)
    mutated["body"] = "MUTATED"
    assert repo.load_l1(ctx, invref(selected), now=AT)["body"] == env[4]["body"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: repo.record_use(ctx, invref(selected), outcome="FAILURE", evidence_ref="e", request_id="use", now=AT), range(8)))
    assert all(result == results[0] for result in results)
    assert len(repo.audit(ctx, env[2], now=AT)["events"]) == 3
    with pytest.raises(module().SkillError, match="SKILL_REPLAY_CONFLICT"):
        repo.record_use(ctx, invref(selected), outcome="SUCCESS", evidence_ref="e", request_id="use", now=AT)


def test_catalog_budget_is_bounded_and_explicitly_truncated():
    repo, ctx, sr, _, data, _, _, _, ar = setup(capture=False)
    data["description"] = "넓은 설명 " * 600
    data["description"] = data["description"].strip()
    repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))
    result = repo.catalog(ctx, sr, scope=data["scope"], now=AT)
    assert not result["items"] and result["truncated"] and result["omitted_count"] == 1
    assert result["token_count"] <= 2000 and (len(_canonical(result).encode()) + 3) // 4 <= 2000


def test_non_skill_candidate_cannot_self_materialize_as_skill():
    repo, ctx, sr, _, data, _, _, _, ar = setup(capture=False, kind="PROMPT")
    with pytest.raises(module().SkillError, match="SKILL_ACTIVATION_REQUIRED"):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))


@pytest.mark.parametrize("operation", ["l1", "l2", "use"])
def test_load_history_cannot_be_backdated_before_last_consumption(operation):
    env = setup()
    selected = invoke(env)
    later = AT + timedelta(seconds=5)
    env[0].load_l1(env[1], invref(selected), now=later)
    with pytest.raises(module().SkillError, match="SKILL_EVENT_TIME_REGRESSION"):
        if operation == "l1":
            env[0].load_l1(env[1], invref(selected), now=AT)
        elif operation == "l2":
            env[0].load_l2(env[1], invref(selected), **env[4]["resources"][0], now=AT)
        else:
            env[0].record_use(env[1], invref(selected), outcome="SUCCESS", evidence_ref="e", request_id="u", now=AT)


def test_selection_history_cannot_backdate_another_invocation():
    env = setup()
    later = AT + timedelta(seconds=5)
    invoke(env, now=later)
    with pytest.raises(module().SkillError, match="SKILL_EVENT_TIME_REGRESSION"):
        invoke(env, request="second", now=AT)


@pytest.mark.parametrize("mutation", ["hash", "version", "activation", "skill"])
def test_explicit_does_not_bypass_exact_skill_reference(mutation):
    env = setup()
    reference = to_primitive(env[3])
    key, value = {"hash": ("content_hash", "a" * 64), "version": ("version", 2), "activation": ("activation_id", "foreign"), "skill": ("skill_id", "foreign")}[mutation]
    reference[key] = value
    with pytest.raises(module().SkillError):
        env[0].select(env[1], env[2], reference, task="retry", mode="explicit", request_id="s", now=AT)
    assert not env[0].audit(env[1], env[2], now=AT)["events"]


@pytest.mark.parametrize("mutation", ["path", "kind", "hash"])
def test_l2_requires_manifest_exact_path_kind_and_hash(mutation):
    env = setup()
    chosen = invoke(env)
    env[0].load_l1(env[1], invref(chosen), now=AT)
    resource = deepcopy(env[4]["resources"][0])
    resource[{"path": "path", "kind": "kind", "hash": "content_hash"}[mutation]] = {"path": "references/other.md", "kind": "script", "hash": "a" * 64}[mutation]
    with pytest.raises(module().SkillError, match="SKILL_RESOURCE_MANIFEST_MISMATCH"):
        env[0].load_l2(env[1], invref(chosen), **resource, now=AT)


@pytest.mark.parametrize("expiry_delta", [0, -1, 3601])
def test_capture_expiry_cannot_exceed_host_or_activation(expiry_delta):
    repo, ctx, sr, _, data, _, _, _, ar = setup(capture=False)
    with pytest.raises(module().SkillError, match="SKILL_MATERIALIZATION_STALE"):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=AT + timedelta(seconds=expiry_delta))


def test_expiry_denies_load_and_valid_attestation_cannot_rebind_time_or_proof():
    env = setup()
    repo, ctx, sr, _, data, _, _, _, ar = env
    chosen = invoke(env)
    with pytest.raises(module().SkillError, match="SKILL_MATERIALIZATION_REBIND"):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="other-proof", now=AT, expires_at=NOW + timedelta(minutes=10))
    with pytest.raises(module().SkillError, match="SKILL_MATERIALIZATION_STALE"):
        repo.load_l1(ctx, invref(chosen), now=NOW + timedelta(minutes=10))
    repo.capture_materialization(ctx, ar, sr, data, evidence_ref="renewed-host-proof", now=NOW + timedelta(minutes=10), expires_at=NOW + timedelta(minutes=20))
    with pytest.raises(module().SkillError, match="SKILL_INVOCATION_STALE"):
        repo.load_l1(ctx, invref(chosen), now=NOW + timedelta(minutes=10))


def test_materialization_payload_and_return_projection_have_no_internal_alias():
    env = setup()
    data = env[4]
    data["body"] = "MUTATED_BODY"
    data["resources"][0]["path"] = "other.md"
    data["resource_contents"]["references/check.md"] = "MUTATED_RESOURCE"
    chosen = invoke(env)
    l1 = env[0].load_l1(env[1], invref(chosen), now=AT)
    assert "L1_ONLY_COMPLETE_BODY" in l1["body"] and "MUTATED" not in l1["body"]
    with pytest.raises(TypeError):
        chosen["skill_ref"]["version"] = 99
    l2 = env[0].load_l2(env[1], invref(chosen), path="references/check.md", kind="reference", content_hash=digest("L2_ONLY_REFERENCE_CONTENT"), now=AT)
    assert l2["content"] == "L2_ONLY_REFERENCE_CONTENT"


def test_catalog_never_admits_wrong_scope_or_nonpositive_limits():
    env = setup()
    with pytest.raises(module().SkillError, match="SKILL_SCOPE_MISMATCH"):
        env[0].catalog(env[1], env[2], scope=MemoryScope("u1", "project", "p2"), now=AT)
    for limit in (0, -1, True, 21):
        with pytest.raises(module().SkillError, match="INVALID_SKILL_LIMIT"):
            env[0].match(env[1], env[2], scope=env[4]["scope"], task="retry", limit=limit, now=AT)


@pytest.mark.parametrize("body", ["api key=FAKE_TEST_ONLY", "https://admin:FAKE_TEST_ONLY@example.test/x"])
def test_materialization_does_not_store_or_echo_secret_like_body(body):
    repo, ctx, sr, _, data, _, _, _, ar = setup(capture=False)
    data["body"] += body
    data["body_hash"] = digest(data["body"])
    with pytest.raises(module().SkillError) as error:
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))
    assert "FAKE_TEST_ONLY" not in str(error.value)
    assert not repo.catalog(ctx, sr, scope=data["scope"], now=AT)["items"]


def test_r1_false_implicit_approval_rejects_materialized_triggers():
    repo, ctx, sr, _, data, _, active, _, ar = setup(capture=False)
    assert active["risk_delta"]["implicit_trigger"] is False
    data["triggers"] = ["retry"]
    with pytest.raises(module().SkillError, match="SKILL_IMPLICIT_EXPANSION_UNAPPROVED"):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))
    assert not repo.catalog(ctx, sr, scope=data["scope"], now=AT)["items"]


def test_r1_boolean_implicit_approval_without_exact_trigger_proof_is_explicit_only():
    env = setup(risk={"implicit_trigger": True})
    repo, ctx, sr, _, data, *_ = env
    assert not repo.match(ctx, sr, scope=data["scope"], task="retry", limit=5, now=AT)["items"]
    with pytest.raises(module().SkillError, match="IMPLICIT_SKILL_DENIED"):
        invoke(env, mode="implicit")
    assert not repo.audit(ctx, sr, now=AT)["events"]
    assert repo.load_l1(ctx, invref(invoke(env, mode="explicit")), now=AT)["body"] == data["body"]


def script_payload(data, *, path="scripts/check.py", kind="script"):
    resource = dict(path=path, kind=kind, content_hash=digest("print('test-only')"))
    data["resources"] = [resource]
    data["resource_contents"] = {path: "print('test-only')"}
    data["body"] = "# Procedure\n```anvil-resources\n" + json.dumps([resource]) + "\n```\n"
    data["body_hash"] = digest(data["body"])
    return data


@pytest.mark.parametrize("path,kind", [("scripts/check.py", "script"), ("references/check.md", "script"), ("examples/check.PY", "example"), ("references/check.ps1", "reference"), ("scripts/check.sh", "reference")])
def test_r1_false_script_approval_blocks_kind_and_extension_alias(path, kind):
    repo, ctx, sr, _, data, _, active, _, ar = setup(capture=False)
    assert active["risk_delta"]["script"] is False
    data["triggers"] = []
    script_payload(data, path=path, kind=kind)
    with pytest.raises(module().SkillError, match="SKILL_SCRIPT_EXPANSION_UNAPPROVED"):
        repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))
    assert not repo.catalog(ctx, sr, scope=data["scope"], now=AT)["items"]


def test_r1_approved_script_is_explicit_exact_read_only_not_execution():
    env = list(setup(risk={"script": True}, capture=False))
    repo, ctx, sr, _, data, _, _, _, ar = env
    data["triggers"] = []
    script_payload(data)
    env[3] = repo.capture_materialization(ctx, ar, sr, data, evidence_ref="host", now=AT, expires_at=NOW + timedelta(minutes=10))
    with pytest.raises(module().SkillError, match="IMPLICIT_SKILL_DENIED"):
        invoke(env, mode="implicit")
    chosen = invoke(env, mode="explicit")
    repo.load_l1(ctx, invref(chosen), now=AT)
    resource = data["resources"][0]
    for forged in (dict(resource, kind="reference"), dict(resource, content_hash="a" * 64), dict(resource, path="scripts/check.PY")):
        with pytest.raises(module().SkillError, match="SKILL_RESOURCE_MANIFEST_MISMATCH"):
            repo.load_l2(ctx, invref(chosen), **forged, now=AT)
    result = repo.load_l2(ctx, invref(chosen), **resource, now=AT)
    assert result["content"] == "print('test-only')" and result["executed"] is False
