"""D08 in-memory evolution: 실제 D05/D06/D07/D02 계보, 외부 실행 없음."""
from copy import deepcopy
from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import importlib
import pytest
from packages.knowledge.memory import to_primitive, _hash
from tests.knowledge.test_skills_d07 import setup as skill_setup, digest, AT, NOW
from tests.knowledge.test_candidates_d06 import successor, create as candidate_create, snapshot


def module():
    try:
        return importlib.import_module("packages.knowledge.skill_evolution")
    except ModuleNotFoundError:
        pytest.fail("D08_EVOLUTION_MISSING")


def setup(action="PATCH", *, create_target="new-skill"):
    skills, ctx, selection, skill_ref, document, candidates, active, sources, _ = skill_setup()
    current = to_primitive(candidates.query(ctx, active["candidate_ref"]["candidate_id"], now=AT))["candidate"]
    proposal = {k: current[k] for k in "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref".split()}
    proposal["expires_at"] = NOW + timedelta(hours=6)
    proposal = successor(candidates, ctx, proposal, "evolution")
    proposal["intent"] = action
    if action == "CREATE":
        proposal["target_id"] = create_target
    created = candidate_create(candidates, ctx, proposal, request="create-evolution")
    cr = {k: created["candidate"][k] for k in ("candidate_id", "version", "content_hash")}
    before = dict(selection_ref=selection, skill_ref=to_primitive(skill_ref))
    after = deepcopy(document)
    after["version"] += 1
    after["body"] += "# Pitfalls\nKeep bounded retries.\n"
    after["body_hash"] = digest(after["body"])
    if action == "CREATE":
        after.update(skill_id=create_target, name=create_target, version=1)
    data = dict(evolution_id="evolution1", candidate_ref=cr, before=[] if action == "CREATE" else [before],
                after=[] if action == "ARCHIVE" else [after], reason={"PATCH":"PROCEDURE_GAP", "CREATE":"REUSABLE_NEW", "SPLIT":"BROAD_TRIGGER", "MERGE":"DUPLICATE", "ARCHIVE":"OBSOLETE"}[action],
                expected_reuse_scope="project:p1")
    repo = module().SkillEvolutionRepository(skills)
    return repo, ctx, data, sources, candidates, skills


def attest(repo, ctx, data, *, now=AT):
    return repo.capture_proposal(ctx, data, evidence_refs=["reflection-1", "reflection-2"], representative_tasks=task_manifest(), now=now, expires_at=NOW + timedelta(minutes=30))


def task_manifest():
    return [dict(task_id="task-"+str(index),content_hash=_hash(["task-content",index]),input_hash=_hash(["input",index])) for index in range(3)]


def pilot_sample(identity, index, target, baseline, **changes):
    result=sample(identity,target,baseline)
    result.update(task_ref=task_manifest()[index],run_ref=dict(run_id="run-"+identity,content_hash=_hash(["run",identity])),evidence_hash=_hash(["evidence",identity]))
    result.update(changes)
    return result


def bookkeeping_only(env):
    after=env[2]["after"][0]
    after["body"]=after["body"].split("# Pitfalls\n")[0]
    after["body_hash"]=digest(after["body"])


def propose(env):
    repo, ctx, data, *_ = env
    attest(repo, ctx, data)
    return repo.propose(ctx, data, request_id="propose", now=AT)


def ref(value):
    value = value["candidate"] if "candidate" in value else value
    return dict(evolution_id=value["evolution_id"], content_hash=value["content_hash"])


def sample(identity, target, baseline, *, status="PASS", **changes):
    value = dict(case_id=identity, target_hash=target["content_hash"], baseline_hash=baseline, status=status,
                 baseline_quality=1.0, candidate_quality=1.0, baseline_cost=1.0, candidate_cost=1.0,
                 baseline_precision=1.0, candidate_precision=1.0, baseline_recall=1.0, candidate_recall=1.0,
                 regression=False, permission_drift=False, evidence_ref="evidence-" + identity)
    value.update(changes)
    return value


def evaluated(env, *, pilots=3, changes=None):
    repo, ctx, *_ = env
    result = propose(env)
    target = ref(result)
    baseline = result["candidate"]["baseline_hash"]
    proof = dict(target_hash=target["content_hash"], baseline_hash=baseline,
                 checks={key:"PASS" for key in ("static", "security", "secret_scan", "permission", "reproducible")},
                 replay=[sample("past-run", target, baseline)])
    if changes:
        changes(proof)
    repo.capture_evaluation(ctx, target, proof, now=AT, expires_at=NOW + timedelta(minutes=20))
    for number in range(pilots):
        pilot = pilot_sample("pilot-" + str(number), number, target, baseline)
        repo.capture_pilot(ctx, target, pilot, now=AT, expires_at=NOW + timedelta(minutes=20))
        repo.record_pilot(ctx, target, pilot["case_id"], request_id="pilot-" + str(number), now=AT)
    repo.evaluate(ctx, target, request_id="evaluate", now=AT)
    return target


def human(repo, ctx, target, *, now=AT):
    repo.capture_human_approval(ctx, target, status="APPROVED", evidence_ref="human-decision", now=now, expires_at=NOW + timedelta(minutes=15))
    return repo.approve(ctx, target, request_id="approve", now=now)


def activate(env, *, auto=False):
    target = evaluated(env)
    if not auto:
        human(env[0], env[1], target)
    result = env[0].activate(env[1], target, request_id="activate", now=AT)
    return target, result


def test_new_skill_stage_requires_real_reflection_and_never_activates_on_propose():
    env = setup("CREATE")
    repo, ctx, data, *_ = env
    with pytest.raises(module().EvolutionError, match="EVOLUTION_PROPOSAL_ATTESTATION_REQUIRED"):
        repo.propose(ctx, data, request_id="p", now=AT)
    result = propose(env)
    assert result["state"]["status"] == "PENDING" and result["candidate"]["action"] == "CREATE"
    assert result["candidate"]["version_change"] == "MAJOR" and not result["activations"]
    assert result["candidate"]["diff"] and result["candidate"]["review_ref"]


@pytest.mark.parametrize("reason,action", [("PROCEDURE_GAP","PATCH"),("REUSABLE_NEW","CREATE"),("BROAD_TRIGGER","SPLIT"),("DUPLICATE","MERGE"),("OBSOLETE","ARCHIVE")])
def test_classification_is_deterministic_not_model_action(reason, action):
    assert module().classify_reason(reason) == action
    with pytest.raises(module().EvolutionError):
        module().classify_reason("model guesses reusable")


@pytest.mark.parametrize("pilots", [0, 1, 2])
def test_new_skill_requires_three_distinct_pilots(pilots):
    env = setup("CREATE")
    target = evaluated(env, pilots=pilots)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_EVIDENCE_NOT_PASS"):
        human(env[0], env[1], target)
    assert not env[0].query(env[1], target["evolution_id"], now=AT)["activations"]


def test_new_skill_requires_human_even_with_trusted_auto_claim():
    env = setup("CREATE")
    target = evaluated(env)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        env[0].activate(env[1], target, request_id="a", now=AT)
    human(env[0], env[1], target)
    active = env[0].activate(env[1], target, request_id="a", now=AT)
    assert active["status"] == "ACTIVE" and active["consumer_integrated"] is False


def test_next_run_one_shot_and_rollback_preserves_affected_run():
    env = setup("CREATE")
    repo, ctx, _, _, candidates, _ = env
    target, active = activate(env)
    sr = snapshot(candidates._snapshots, run="evolved-run", instant=AT + timedelta(seconds=1))
    candidates._run_clock.advance(AT + timedelta(seconds=1))
    cap = repo.capture_run_start(ctx, to_primitive(active), sr, now=AT + timedelta(seconds=1))
    selected = repo.select_next_run(ctx, cap, now=AT + timedelta(seconds=1))
    assert selected["run_id"] == "evolved-run" and selected["versions"][0]["skill_id"] == "new-skill"
    with pytest.raises(module().EvolutionError, match="EVOLUTION_RUN_START_CONSUMED"):
        repo.select_next_run(ctx, cap, now=AT + timedelta(seconds=1))
    result = repo.rollback(ctx, target, evidence_ref="failed-run", request_id="rollback", now=AT + timedelta(seconds=2))
    assert result["state"]["status"] == "ROLLED_BACK"
    assert result["impacts"][-1]["affected_runs"] == ("evolved-run",)
    assert result["selections"][0] == selected


def test_existing_low_risk_patch_trusted_policy_is_host_only_and_exact_before():
    env = setup()
    bookkeeping_only(env)
    repo, ctx, data, *_ = env
    repo.capture_policy(ctx, data["before"][0], mode="trusted_auto", evidence_ref="human-policy", now=AT, expires_at=NOW + timedelta(minutes=20))
    target, active = activate(env, auto=True)
    assert active["approval_mode"] == "trusted_auto" and active["versions"][0]["version"] == 2
    assert repo.query(ctx, target["evolution_id"], now=AT)["candidate"]["version_change"] == "PATCH"


@pytest.mark.parametrize("mode", ["observe_only", "review_required"])
def test_default_policies_require_human(mode):
    env = setup()
    env[0].capture_policy(env[1], env[2]["before"][0], mode=mode, evidence_ref="policy", now=AT, expires_at=NOW + timedelta(minutes=20))
    target = evaluated(env)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        env[0].activate(env[1], target, request_id="activate", now=AT)


@pytest.mark.parametrize("change,level", [("trigger","MINOR"),("capability","MAJOR"),("script","MAJOR"),("policy","MAJOR"),("procedure","MAJOR")])
def test_trusted_auto_cannot_expand_meaning_permissions_script_or_policy(change, level):
    env = setup()
    bookkeeping_only(env)
    repo, ctx, data, *_ = env
    after = data["after"][0]
    if change == "trigger":
        after["triggers"] = ["all tasks"]
    elif change == "capability":
        after["capabilities"] = ["READ", "NETWORK"]
    elif change == "script":
        from tests.knowledge.test_skills_d07 import script_payload
        script_payload(after)
    elif change == "policy":
        after["body"] += "Change permission policy."
    else:
        after["body"] = after["body"].replace("Read the declared reference when needed.", "Run a changed procedure.")
    after["body_hash"] = digest(after["body"])
    repo.capture_policy(ctx, data["before"][0], mode="trusted_auto", evidence_ref="policy", now=AT, expires_at=NOW + timedelta(minutes=20))
    target = evaluated(env)
    assert repo.query(ctx, target["evolution_id"], now=AT)["candidate"]["version_change"] == level
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        repo.activate(ctx, target, request_id="a", now=AT)


@pytest.mark.parametrize("field,value", [("candidate_quality",0.5),("candidate_cost",2.0),("candidate_precision",0.5),("candidate_recall",0.5),("regression",True),("permission_drift",True)])
def test_pass_labels_cannot_hide_baseline_regression(field,value):
    env = setup("CREATE")
    target = evaluated(env, changes=lambda proof: proof["replay"][0].update({field:value}))
    with pytest.raises(module().EvolutionError, match="EVOLUTION_EVIDENCE_NOT_PASS"):
        human(env[0], env[1], target)


@pytest.mark.parametrize("check", ["secret_scan", "permission", "security", "reproducible"])
def test_missing_or_nonpass_safety_evidence_blocks_approval(check):
    env = setup("CREATE")
    target = evaluated(env, changes=lambda proof: proof["checks"].update({check:"FAIL"}))
    with pytest.raises(module().EvolutionError, match="EVOLUTION_EVIDENCE_NOT_PASS"):
        human(env[0], env[1], target)


def test_concurrent_activation_is_one_and_replay_conflict_fails():
    env = setup("CREATE")
    target = evaluated(env)
    human(env[0], env[1], target)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: env[0].activate(env[1], target, request_id="a", now=AT), range(8)))
    assert all(result == results[0] for result in results)
    assert len(env[0].query(env[1], target["evolution_id"], now=AT)["activations"]) == 1


def test_source_revoke_blocks_next_run_without_changing_existing_snapshot():
    env = setup("CREATE")
    repo, ctx, _, sources, candidates, _ = env
    target, active = activate(env)
    sources.transition(ctx, "s1", "REVOKED", reason="DELETED", expected_version=1, request_id="rev", now=AT)
    sr = snapshot(candidates._snapshots, run="blocked-run", instant=AT + timedelta(seconds=1))
    candidates._run_clock.advance(AT + timedelta(seconds=1))
    with pytest.raises(module().EvolutionError):
        repo.capture_run_start(ctx, to_primitive(active), sr, now=AT + timedelta(seconds=1))
    assert not repo.query(ctx, target["evolution_id"], now=AT)["selections"]


def test_foreign_context_and_payload_self_authority_are_rejected():
    env = setup()
    repo, ctx, data, *_ = env
    attest(repo, ctx, data)
    with pytest.raises(module().EvolutionError):
        repo.propose(object(), data, request_id="p", now=AT)
    for key in ("approval", "actor", "trusted_auto", "pilot_results"):
        forged = deepcopy(data)
        forged[key] = "FORGED_NO_ECHO"
        with pytest.raises(module().EvolutionError) as error:
            repo.propose(ctx, forged, request_id="p", now=AT)
        assert "FORGED_NO_ECHO" not in str(error.value)


def add_before(env, identity="second-skill"):
    from tests.knowledge.test_candidates_d06 import activate as activate_candidate, select as select_candidate
    from tests.knowledge.test_skills_d07 import payload as skill_payload
    repo, ctx, data, sources, candidates, skills = env
    origin = to_primitive(candidates.query(ctx, data["candidate_ref"]["candidate_id"], now=AT))["candidate"]
    proposal = {k:origin[k] for k in "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref".split()}
    proposal["expires_at"] = NOW + timedelta(hours=6)
    proposal = successor(candidates, ctx, proposal, identity)
    proposal.update(target_id=identity, intent="CREATE")
    active = activate_candidate(candidates, ctx, proposal)
    sr = snapshot(candidates._snapshots, run=identity, instant=AT)
    selected = select_candidate(candidates, ctx, [to_primitive(active)], sr, now=AT)
    selection = dict(selection_id=selected["selection_id"], content_hash=selected["content_hash"])
    ar = {key:active[key] for key in ("activation_id","version","content_hash")}
    doc = skill_payload(active)
    skill = skills.capture_materialization(ctx, ar, selection, doc, evidence_ref="material-" + identity, now=AT, expires_at=NOW + timedelta(minutes=10))
    data["before"].append(dict(selection_ref=selection, skill_ref=to_primitive(skill)))


@pytest.mark.parametrize("action", ["SPLIT", "MERGE", "ARCHIVE"])
def test_split_merge_archive_stage_and_human_activation_without_auto_delete(action):
    env = setup(action)
    repo, ctx, data, *_ = env
    if action == "SPLIT":
        second = deepcopy(data["after"][0])
        second.update(skill_id="split-child", name="split-child", version=1)
        data["after"].append(second)
    if action == "MERGE":
        add_before(env)
    repo.capture_policy(ctx, data["before"][0], mode="trusted_auto", evidence_ref="policy", now=AT, expires_at=NOW+timedelta(minutes=20))
    target = evaluated(env)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        repo.activate(ctx, target, request_id="a", now=AT)
    human(repo, ctx, target)
    active = repo.activate(ctx, target, request_id="a", now=AT)
    assert active["action"] == action and active["approval_mode"] == "human"
    assert len(active["versions"]) == {"SPLIT":2,"MERGE":1,"ARCHIVE":0}[action]
    before_count = len(data["before"])
    result = repo.rollback(ctx, target, evidence_ref="rollback", request_id="r", now=AT)
    assert result["state"]["status"] == "ROLLED_BACK"
    assert len(result["candidate"]["before_documents"]) == before_count


def test_create_cannot_shadow_existing_active_skill_by_omitting_before():
    env = setup("CREATE", create_target="catalog-item")
    with pytest.raises(module().EvolutionError, match="EVOLUTION_EXISTING_SKILL_REQUIRES_BEFORE"):
        propose(env)


def test_unrecognised_risk_or_capability_is_not_an_approvable_contract():
    for field, value in (("risk","NONE"),("capabilities",["UNBOUNDED_ADMIN"])):
        env = setup()
        env[2]["after"][0][field] = value
        with pytest.raises(module().EvolutionError, match="INVALID_EVOLUTION_PERMISSION_CONTRACT"):
            propose(env)


@pytest.mark.parametrize("delta", [-1, 5, 1800])
def test_next_run_backdate_future_and_late_boundary_rejected(delta):
    env = setup("CREATE")
    repo, ctx, _, _, candidates, _ = env
    _, active = activate(env)
    start = AT + timedelta(seconds=1)
    sr = snapshot(candidates._snapshots, run="next", instant=start)
    candidates._run_clock.advance(start + timedelta(seconds=max(0,delta)))
    expected = "EVOLUTION_ATTESTATION_STALE" if delta == 1800 else "EVOLUTION_RUN_START_STALE"
    with pytest.raises(module().EvolutionError, match=expected):
        repo.capture_run_start(ctx, to_primitive(active), sr, now=start + timedelta(seconds=delta))


def test_run_start_public_dto_and_wrong_hash_cannot_forge_capability():
    env = setup("CREATE")
    repo, ctx, _, _, candidates, _ = env
    _, active = activate(env)
    sr = snapshot(candidates._snapshots, run="next", instant=AT+timedelta(seconds=1))
    candidates._run_clock.advance(AT+timedelta(seconds=1))
    cap = repo.capture_run_start(ctx, to_primitive(active), sr, now=AT+timedelta(seconds=1))
    for forged in (module().EvolutionRunStart(cap.boundary_id, cap.content_hash), dict(boundary_id=cap.boundary_id, content_hash=cap.content_hash)):
        with pytest.raises(module().EvolutionError, match="EVOLUTION_RUN_START_AUTHORITY_REQUIRED"):
            repo.select_next_run(ctx, forged, now=AT+timedelta(seconds=1))


def test_approval_revocation_and_expiry_cannot_reanimate_duplicate_activation():
    env = setup("CREATE")
    repo, ctx = env[:2]
    target, _ = activate(env)
    later = AT + timedelta(seconds=1)
    repo.capture_human_approval(ctx, target, status="REVOKED", evidence_ref="revoke", now=later, expires_at=NOW+timedelta(minutes=15))
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        repo.activate(ctx, target, request_id="activate", now=later)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_ATTESTATION_STALE"):
        repo.activate(ctx, target, request_id="activate", now=NOW+timedelta(minutes=15))


def test_wrong_target_approval_and_evidence_hash_rejected():
    env = setup("CREATE")
    result = propose(env)
    target = ref(result)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_TARGET_HASH_MISMATCH"):
        env[0].capture_human_approval(env[1], dict(target,content_hash="a"*64), status="APPROVED", evidence_ref="e", now=AT, expires_at=NOW+timedelta(minutes=10))
    proof = dict(target_hash=target["content_hash"],baseline_hash="b"*64,checks={k:"PASS" for k in ("static","security","secret_scan","permission","reproducible")},replay=[])
    with pytest.raises(module().EvolutionError, match="EVOLUTION_EVIDENCE_TARGET_MISMATCH"):
        env[0].capture_evaluation(env[1], target, proof, now=AT, expires_at=NOW+timedelta(minutes=10))


def test_duplicate_pilot_names_do_not_count_as_three_tasks():
    env = setup("CREATE")
    target = evaluated(env, pilots=1)
    for index in range(3):
        env[0].record_pilot(env[1],target,"pilot-0",request_id="again-"+str(index),now=AT)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_EVIDENCE_NOT_PASS"):
        human(env[0],env[1],target)


def test_trusted_auto_policy_cannot_be_injected_or_changed_after_approval_by_replay():
    env = setup()
    bookkeeping_only(env)
    repo, ctx, data, *_ = env
    repo.capture_policy(ctx,data["before"][0],mode="trusted_auto",evidence_ref="policy",now=AT,expires_at=NOW+timedelta(minutes=10))
    target, active = activate(env,auto=True)
    repo.capture_policy(ctx,data["before"][0],mode="review_required",evidence_ref="revoke-auto",now=AT+timedelta(seconds=1),expires_at=NOW+timedelta(minutes=10))
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        repo.activate(ctx,target,request_id="activate",now=AT+timedelta(seconds=1))


def test_two_staged_candidates_cannot_both_replace_same_head():
    env = setup()
    repo, ctx, first, _, candidates, _ = env
    one = evaluated(env)
    human(repo,ctx,one)
    origin = to_primitive(candidates.query(ctx,first["candidate_ref"]["candidate_id"],now=AT))["candidate"]
    proposal = {k:origin[k] for k in "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref".split()}
    proposal["expires_at"] = NOW+timedelta(hours=6)
    proposal = successor(candidates,ctx,proposal,"competing")
    new = candidate_create(candidates,ctx,proposal,request="competing")
    second = deepcopy(first)
    second.update(evolution_id="evolution2",candidate_ref={k:new["candidate"][k] for k in ("candidate_id","version","content_hash")})
    attest(repo,ctx,second)
    pending = repo.propose(ctx,second,request_id="p2",now=AT)
    target2 = prepare_existing(repo,ctx,pending,"second")
    repo.activate(ctx,one,request_id="a",now=AT)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HEAD_CHANGED"):
        repo.activate(ctx,target2,request_id="a2",now=AT)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HEAD_CHANGED"):
        repo.capture_proposal(ctx,second,evidence_refs=["r1","r2"],representative_tasks=["t1","t2"],now=AT,expires_at=NOW+timedelta(minutes=10))
    assert pending["state"]["status"] == "PENDING"


def prepare_existing(repo, ctx, result, suffix):
    target = ref(result)
    baseline = result["candidate"]["baseline_hash"]
    proof = dict(target_hash=target["content_hash"],baseline_hash=baseline,
                 checks={key:"PASS" for key in ("static","security","secret_scan","permission","reproducible")},
                 replay=[sample("past-"+suffix,target,baseline)])
    repo.capture_evaluation(ctx,target,proof,now=AT,expires_at=NOW+timedelta(minutes=20))
    for index in range(3):
        pilot = pilot_sample(suffix+str(index),index,target,baseline)
        repo.capture_pilot(ctx,target,pilot,now=AT,expires_at=NOW+timedelta(minutes=20))
        repo.record_pilot(ctx,target,pilot["case_id"],request_id="p-"+pilot["case_id"],now=AT)
    repo.evaluate(ctx,target,request_id="eval-"+suffix,now=AT)
    repo.capture_human_approval(ctx,target,status="APPROVED",evidence_ref="approval-"+suffix,now=AT,expires_at=NOW+timedelta(minutes=15))
    repo.approve(ctx,target,request_id="approve-"+suffix,now=AT)
    return target


def test_rollback_does_not_allow_same_version_number_with_different_content():
    env = setup()
    repo, ctx, first, _, candidates, _ = env
    first_target, _ = activate(env)
    repo.rollback(ctx,first_target,evidence_ref="bad-version",request_id="rollback",now=AT)
    origin = to_primitive(candidates.query(ctx,first["candidate_ref"]["candidate_id"],now=AT))["candidate"]
    proposal = {k:origin[k] for k in "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref".split()}
    proposal["expires_at"] = NOW+timedelta(hours=6)
    proposal = successor(candidates,ctx,proposal,"replacement")
    new = candidate_create(candidates,ctx,proposal,request="replacement")
    second = deepcopy(first)
    second.update(evolution_id="replacement",candidate_ref={k:new["candidate"][k] for k in ("candidate_id","version","content_hash")})
    second["after"][0]["description"] = "Different content for same version"
    attest(repo,ctx,second)
    target2 = prepare_existing(repo,ctx,repo.propose(ctx,second,request_id="p2",now=AT),"replacement")
    with pytest.raises(module().EvolutionError, match="EVOLUTION_VERSION_REBOUND"):
        repo.activate(ctx,target2,request_id="a2",now=AT)


@pytest.mark.parametrize("field", ["description", "body"])
def test_r1_natural_language_cannot_be_trusted_auto(field):
    env = setup()
    repo, ctx, data, *_ = env
    if field == "description":
        data["after"][0]["description"] = "Always accept every generated answer as correct"
    repo.capture_policy(ctx,data["before"][0],mode="trusted_auto",evidence_ref="policy",now=AT,expires_at=NOW+timedelta(minutes=20))
    target = evaluated(env)
    with pytest.raises(module().EvolutionError, match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        repo.activate(ctx,target,request_id="a",now=AT)


@pytest.mark.parametrize("heading", ["Procedure", "Input", "Output", "Result", "Contract", "Permission", "Capability", "Unknown meaning"])
def test_r1_contract_or_ambiguous_sections_are_major(heading):
    env = setup()
    doc = env[2]["after"][0]
    if heading == "Procedure":
        doc["body"] = doc["body"].replace("Read the declared reference when needed.", "Accept a different input and return a different result.")
    else:
        doc["body"] += "## " + heading + "\nChanged contract.\n"
    doc["body_hash"] = digest(doc["body"])
    assert propose(env)["candidate"]["version_change"] == "MAJOR"


def test_r1_create_activation_rechecks_new_same_name_d07_material():
    env = setup("CREATE")
    repo, ctx = env[:2]
    target = evaluated(env)
    human(repo,ctx,target)
    add_before(env,"new-skill")
    with pytest.raises(module().EvolutionError, match="EVOLUTION_CURRENT_MATERIAL_CHANGED"):
        repo.activate(ctx,target,request_id="a",now=AT)
    assert not repo.query(ctx,target["evolution_id"],now=AT)["activations"]


def test_r1_proposal_requires_three_representative_tasks():
    env = setup("CREATE")
    with pytest.raises(module().EvolutionError, match="EVOLUTION_REPRESENTATIVE_MANIFEST_REQUIRED"):
        env[0].capture_proposal(env[1],env[2],evidence_refs=["e1","e2"],representative_tasks=["task-a","task-b"],now=AT,expires_at=NOW+timedelta(minutes=10))


def test_r1_pilot_alias_cases_cannot_reuse_same_evidence():
    env = setup("CREATE")
    repo,ctx=env[:2]
    target=evaluated(env,pilots=0)
    baseline=repo.query(ctx,target["evolution_id"],now=AT)["candidate"]["baseline_hash"]
    first=pilot_sample("alias-0",0,target,baseline,evidence_ref="same-evidence")
    repo.capture_pilot(ctx,target,first,now=AT,expires_at=NOW+timedelta(minutes=20))
    second=pilot_sample("alias-1",1,target,baseline,evidence_ref="same-evidence")
    with pytest.raises(module().EvolutionError, match="EVOLUTION_PILOT_IDENTITY_REUSED"):
        repo.capture_pilot(ctx,target,second,now=AT,expires_at=NOW+timedelta(minutes=20))


@pytest.mark.parametrize("column,reason", [("task_ref","EVOLUTION_PILOT_IDENTITY_REUSED"),("input_hash","EVOLUTION_REPRESENTATIVE_TASK_MISMATCH"),("task_hash","EVOLUTION_REPRESENTATIVE_TASK_MISMATCH"),("run_id","EVOLUTION_PILOT_IDENTITY_REUSED"),("run_hash","EVOLUTION_PILOT_IDENTITY_REUSED"),("evidence_hash","EVOLUTION_PILOT_IDENTITY_REUSED"),("case_id","EVOLUTION_ATTESTATION_REBIND")])
def test_r1_pilot_case_task_run_input_evidence_aliases_are_rejected(column,reason):
    env=setup("CREATE")
    repo,ctx=env[:2]
    pending=propose(env)
    target=ref(pending)
    baseline=pending["candidate"]["baseline_hash"]
    first=pilot_sample("first",0,target,baseline)
    second=pilot_sample("second",1,target,baseline)
    if column in ("task_ref","evidence_hash","case_id"):
        second[column]=deepcopy(first[column])
    elif column in ("input_hash","task_hash"):
        key="input_hash" if column=="input_hash" else "content_hash"
        second["task_ref"][key]=first["task_ref"][key]
    else:
        key="run_id" if column=="run_id" else "content_hash"
        second["run_ref"][key]=first["run_ref"][key]
    repo.capture_pilot(ctx,target,first,now=AT,expires_at=NOW+timedelta(minutes=20))
    with pytest.raises(module().EvolutionError,match=reason):
        repo.capture_pilot(ctx,target,second,now=AT,expires_at=NOW+timedelta(minutes=20))


@pytest.mark.parametrize("column", ["task_id","content_hash","input_hash"])
def test_r1_proposal_task_manifest_is_distinct_and_immutable(column):
    repo,ctx,data,*_=setup("CREATE")
    manifest=task_manifest()
    manifest[1][column]=manifest[0][column]
    with pytest.raises(module().EvolutionError,match="EVOLUTION_REPRESENTATIVE_IDENTITY_REUSED"):
        repo.capture_proposal(ctx,data,evidence_refs=["e1","e2"],representative_tasks=manifest,now=AT,expires_at=NOW+timedelta(minutes=20))


@pytest.mark.parametrize("action", ["PATCH","SPLIT","MERGE","ARCHIVE"])
def test_r1_all_before_actions_recheck_current_d07_version(action):
    env=setup(action)
    repo,ctx,data,*_=env
    if action=="SPLIT":
        second=deepcopy(data["after"][0])
        second.update(skill_id="split-child",name="split-child",version=1)
        data["after"].append(second)
    elif action=="MERGE":
        add_before(env)
    target=evaluated(env)
    human(repo,ctx,target)
    add_before(env,"catalog-item")
    with pytest.raises(module().EvolutionError,match="ACTIVATION_SUPERSEDED"):
        repo.activate(ctx,target,request_id="a",now=AT)
    assert not repo.query(ctx,target["evolution_id"],now=AT)["activations"]


def test_r1_noop_bookkeeping_is_only_existing_trusted_auto_delta():
    env=setup()
    bookkeeping_only(env)
    repo,ctx,data,*_=env
    repo.capture_policy(ctx,data["before"][0],mode="trusted_auto",evidence_ref="policy",now=AT,expires_at=NOW+timedelta(minutes=20))
    target,active=activate(env,auto=True)
    candidate=repo.query(ctx,target["evolution_id"],now=AT)["candidate"]
    old=to_primitive(candidate["before_documents"][0])
    after=to_primitive(candidate["after"][0])
    assert {key for key in old if old[key]!=after[key]} == {"version"}
    assert active["approval_mode"]=="trusted_auto"


@pytest.mark.parametrize("field", ["description", "body"])
@pytest.mark.parametrize("text", ["Emit YAML rather than JSON.", "Serialize with a different codec.", "Always emit a successful answer.", "항상 YAML 문서를 내보내세요.", "常にYAMLを生成してください。", "RW1pdCBZQU1MIHJhdGhlciB0aGFuIEpTT04u", "Emit%20YAML%20rather%20than%20JSON.", "Keep the result!", "Keep the result. "])
def test_r2_any_natural_language_delta_is_major_and_requires_human(field,text):
    env=setup()
    bookkeeping_only(env)
    repo,ctx,data,*_=env
    document=data["after"][0]
    if field=="description":
        document["description"]=text.strip()
    else:
        document["body"]=document["body"].replace("Keep the result.",text)
        document["body_hash"]=digest(document["body"])
    repo.capture_policy(ctx,data["before"][0],mode="trusted_auto",evidence_ref="policy",now=AT,expires_at=NOW+timedelta(minutes=20))
    target=evaluated(env)
    record=repo.query(ctx,target["evolution_id"],now=AT)["candidate"]
    assert record["version_change"]=="MAJOR" and record["trusted_safe"] is False
    with pytest.raises(module().EvolutionError,match="EVOLUTION_HUMAN_APPROVAL_REQUIRED"):
        repo.activate(ctx,target,request_id="activate",now=AT)


@pytest.mark.parametrize("field,value", [("tags",["new-tag"]),("triggers",["new-trigger"]),("exclusions",["new-exclusion"])])
def test_r2_structured_matching_metadata_only_is_still_minor(field,value):
    env=setup()
    bookkeeping_only(env)
    env[2]["after"][0][field]=value
    assert propose(env)["candidate"]["version_change"]=="MINOR"
