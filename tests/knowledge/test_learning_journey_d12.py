"""D12 read-only projection over actual in-memory D repositories."""
from copy import deepcopy
from datetime import timedelta
import importlib
import json
import pytest
from packages.knowledge.memory import _hash, _canonical, to_primitive, MemoryScope
from tests.knowledge.test_skills_d07 import setup as skill_setup, invoke, invref, AT, NOW
from tests.knowledge.test_hook_runtime_d10 import setup as hook_setup, ready as hook_ready, selection, ev, response


@pytest.fixture
def m():
    try: return importlib.import_module("packages.knowledge.learning_journey")
    except ModuleNotFoundError: pytest.fail("D12_JOURNEY_MISSING")


def setup(m, *, used=True):
    env = skill_setup(); skills, ctx, sr, target, data, candidates, *_ = env
    invocation = invoke(env)
    if used:
        skills.load_l1(ctx, invref(invocation), now=AT)
        skills.record_use(ctx, invref(invocation), outcome="SUCCESS", evidence_ref="verification1", request_id="use", now=AT)
    journey = m.LearningJourney(candidates, ctx, m.LearningJourneyAuthority(), skills=skills)
    return journey, ctx, env, invocation


def hook_env(m, *, fault=False, capture=True):
    _, runtime, ctx, target, executor, registry, *_ = hook_setup()
    hook_ready(runtime, ctx, target, executor, normal_action="deny")
    selected = selection(runtime, ctx)
    event = ev(runtime, ctx, target, "blocked-event")
    packet = response("deny")
    if fault: packet["exit_code"] = 1
    executor.set_response("blocked-event", packet)
    receipt = runtime.run(ctx, selected["selection_id"], event, {"checked": "fixture-input"}, now=AT)
    journey = m.LearningJourney(registry._candidates, ctx, m.LearningJourneyAuthority(), hooks=registry, runtime=runtime)
    if capture: journey.capture_replay_evidence(ctx,receipt["content_hash"],now=AT)
    return journey, ctx, runtime, executor, receipt


def test_actual_provenance_dag_and_read_only_source_state(m):
    journey, ctx, env, invocation = setup(m)
    candidates, sources = env[5], env[7]
    before = deepcopy((candidates._records,candidates._events,sources._states))
    result = journey.query(ctx, now=AT)
    assert {"SOURCE", "REVIEW", "CANDIDATE", "EVALUATION", "APPROVAL", "ACTIVATION", "SELECTION", "APPLICATION", "SKILL", "SKILL_INVOCATION"} <= {n["kind"] for n in result["nodes"]}
    assert all(e["from"] in {n["node_id"] for n in result["nodes"]} and e["to"] in {n["node_id"] for n in result["nodes"]} for e in result["edges"])
    assert before == (candidates._records,candidates._events,sources._states)
    assert result == journey.query(ctx, now=AT)
    assert "L1_ONLY" not in _canonical(result) and "verify retry" not in _canonical(result)
    assert result["runtime_boundary"] == "NOT_INTEGRATED"
    node = next(n for n in result["nodes"] if n["kind"] == "CANDIDATE")
    lineage = journey.lineage(ctx, node["node_id"], snapshot_hash=result["content_hash"], now=AT)
    assert {"SOURCE", "REVIEW", "CANDIDATE"} <= {n["kind"] for n in lineage["nodes"]}


def test_skill_selection_explanation_requires_actual_receipts(m):
    journey, ctx, env, invocation = setup(m)
    result = journey.skill_explanation(ctx, invocation["invocation_id"], now=AT)
    assert result["mode"] == "explicit" and result["reason"] == "EXPLICIT_INVOCATION"
    assert result["input_hash"] == _hash("verify retry")
    assert result["source_roots"] and result["snapshot_ref"]["run_id"] == "next-run"
    assert result["application_status"] == "RECORDED_NOT_EXECUTED"
    assert to_primitive(result["exclusions"]) == [dict(index=0, condition_hash=_hash("production"), matched=False)]
    assert result["actual_program_execution"] == "NOT_EXECUTED"
    with pytest.raises(m.JourneyError, match="JOURNEY_NOT_FOUND"): journey.skill_explanation(ctx, "invented", now=AT)
    env[5]._selections.clear()
    with pytest.raises(m.JourneyError, match="JOURNEY_DANGLING_EDGE"): journey.query(ctx, now=AT)


def test_unexecuted_skill_is_not_promoted_to_application(m):
    journey, ctx, _, invocation = setup(m, used=False)
    assert journey.skill_explanation(ctx, invocation["invocation_id"], now=AT)["application_status"] == "NOT_EXECUTED"


@pytest.mark.parametrize("change", ["hash", "dangling", "actor", "previous"])
def test_corrupt_candidate_or_chain_fails_closed(m, change):
    journey, ctx, env, _ = setup(m); repo = env[5]; key = next(iter(repo._records))
    record = json.loads(repo._records[key])
    if change == "hash": record["target_id"] = "other"
    elif change == "dangling":
        record["review_ref"]["content_hash"] = "f" * 64
        record["content_hash"] = _hash({k:v for k,v in record.items() if k != "content_hash"})
    elif change == "actor": record["created_by"] = "foreign"
    else:
        event = json.loads(repo._events[key][1]); event["previous_hash"] = "f" * 64
        event["content_hash"] = _hash({k:v for k,v in event.items() if k != "content_hash"})
        repo._events[key][1] = _canonical(event)
    if change != "previous": repo._records[key] = _canonical(record)
    with pytest.raises(m.JourneyError): journey.query(ctx, now=AT)


def test_dag_cycle_validator_fails_closed(m):
    with pytest.raises(m.JourneyError, match="JOURNEY_CYCLE"):
        m.validate_dag([{"node_id":"a"}, {"node_id":"b"}], [{"from":"a","to":"b"}, {"from":"b","to":"a"}])


def test_foreign_context_and_repository_composition_denied(m):
    journey, ctx, env, _ = setup(m)
    other = env[7].admit_host("human1", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=2))
    with pytest.raises(m.JourneyError, match="JOURNEY_AUTHORITY_MISMATCH"): journey.query(other, now=AT)
    foreign = skill_setup()[0]
    with pytest.raises(m.JourneyError, match="JOURNEY_REPOSITORY_MISMATCH"):
        m.LearningJourney(env[5], ctx, m.LearningJourneyAuthority(), skills=foreign)


def test_stable_cursor_bounds_and_head_drift(m):
    journey, ctx, env, _ = setup(m)
    page = journey.list(ctx, limit=2, now=AT)
    again = journey.list(ctx, limit=2, now=AT)
    assert page == again and page["next_cursor"]
    second = journey.list(ctx, limit=2, cursor=page["next_cursor"], now=AT)
    assert not {x["node_id"] for x in page["items"]} & {x["node_id"] for x in second["items"]}
    for limit in (0, 101, True):
        with pytest.raises(m.JourneyError, match="INVALID_JOURNEY_INPUT"): journey.list(ctx, limit=limit, now=AT)
    env[7].transition(ctx, "s1", "REVOKED", reason="PERMISSION_REVOKED", expected_version=1, request_id="revoke", now=AT)
    with pytest.raises(m.JourneyError, match="JOURNEY_SNAPSHOT_MISMATCH"): journey.list(ctx, limit=2, cursor=page["next_cursor"], now=AT)


@pytest.mark.parametrize("fault", [False, True])
def test_hook_replay_exact_saved_input_fault_and_merge_io0(m, fault):
    journey, ctx, runtime, executor, receipt = hook_env(m, fault=fault)
    before = _canonical(runtime._state); count = len(executor.calls)
    replay = journey.hook_replay(ctx, receipt["content_hash"], now=AT)
    assert replay["decision"] == "deny" and replay["event_hash"] == receipt["event_hash"]
    assert replay["input_hash"] == _hash({"checked":"fixture-input"})
    assert replay["matcher_trace"] and replay["executed"] is False and replay["io_count"] == 0
    assert replay["faults"] if fault else not replay["faults"]
    assert "fixture-input" not in _canonical(replay) and "entrypoint" not in _canonical(replay)
    assert count == len(executor.calls) and before == _canonical(runtime._state)
    assert replay == journey.hook_replay(ctx, receipt["content_hash"], now=AT)


@pytest.mark.parametrize("change", ["receipt", "packet", "missing", "definition"])
def test_hook_replay_missing_or_hash_drift_denied(m, change):
    journey, ctx, runtime, executor, receipt = hook_env(m,capture=False)
    if change == "receipt": next(iter(runtime._state["receipts"].values()))["result"]["decision"] = "allow"
    elif change == "missing": executor.calls.clear()
    elif change == "packet":
        data = to_primitive(executor.calls[-1]); data["input"]["checked"] = "changed"; executor.calls[-1] = data
    else: next(iter(runtime._state["records"].values()))["definition"]["failure_policy"] = "fail_open"
    with pytest.raises(m.JourneyError): journey.capture_replay_evidence(ctx, receipt["content_hash"], now=AT)


def test_menu_loading_ready_blocked_and_not_executed(m):
    journey, ctx, env, _ = setup(m)
    assert journey.menu(ctx, "Skills", now=AT)["state"] == "loading"
    result = journey.query(ctx, now=AT)
    view = journey.menu(ctx, "Skills", snapshot_hash=result["content_hash"], now=AT)
    assert view["state"] == "ready" and {"source", "evidence", "last_verified", "rollback", "next_action"} <= set(view)
    assert journey.menu(ctx, "Hooks", snapshot_hash=result["content_hash"], now=AT)["state"] == "not_executed"
    env[7].transition(ctx,"s1","REVOKED",reason="PERMISSION_REVOKED",expected_version=1,request_id="revoke",now=AT)
    assert journey.menu(ctx, "Skills", snapshot_hash=result["content_hash"], now=AT)["state"] == "error"


def test_checkpoint_preserves_read_snapshot_cursor_but_denies_tamper_and_drift(m):
    journey, ctx, env, _ = setup(m)
    page = journey.list(ctx, limit=2, now=AT); exported = journey.export_state(ctx, now=AT)
    restored = m.LearningJourney(env[5], ctx, journey._authority, skills=env[0])
    bad = to_primitive(exported); bad["snapshot"]["nodes"].pop()
    with pytest.raises(m.JourneyError, match="JOURNEY_CHECKPOINT_INVALID"): restored.import_state(ctx, bad, now=AT)
    assert restored.import_state(ctx, exported, now=AT) == journey.query(ctx, now=AT)
    assert restored.list(ctx, limit=2, cursor=page["next_cursor"], now=AT)


def test_d11_model_prompt_routing_projection_no_raw_body(m):
    from tests.knowledge.test_model_registry_d11 import ready, activate
    registry, ctx, _, _, _, _, _, _, candidate = ready(importlib.import_module("packages.knowledge.model_registry"))
    activate(registry, ctx, candidate)
    journey = m.LearningJourney(registry._candidates, ctx, m.LearningJourneyAuthority(), models=registry)
    before = _canonical(registry._state)
    result = journey.query(ctx, now=NOW)
    assert {"PROMPT", "MODEL", "BENCHMARK", "ROUTING", "ROUTING_ACTIVATION"} <= {n["kind"] for n in result["nodes"]}
    assert "Return a concise explanation" not in _canonical(result) and before == _canonical(registry._state)


def test_memory_pattern_reference_projection_preserves_exact_hashes(m):
    from tests.knowledge.test_patterns_d04 import reference_chain
    from tests.knowledge.test_memory_d01 import payload
    journey, ctx, env, _ = setup(m)
    reviews=env[5]._reviews
    item=reviews._memory.add(payload(),now=NOW)
    pattern, reference=reference_chain(reviews._patterns,ctx,env[7].get(ctx,"s1",now=AT))
    result=journey.query(ctx,now=AT)
    assert {item.content_hash,pattern.record_hash,reference.record_hash} <= {n["artifact_hash"] for n in result["nodes"]}
    assert {"from":"EXAMPLE_REFERENCE:"+reference.record_hash,"to":"CODE_PATTERN:"+pattern.record_hash} in to_primitive(result["edges"])
    assert "same-origin" not in _canonical(result)


def test_evolution_approval_activation_and_rollback_projection(m):
    from tests.knowledge.test_skill_evolution_d08 import setup as evo_setup, activate
    env=evo_setup(); evo,ctx,_,_,candidates,skills=env
    target,active=activate(env)
    journey=m.LearningJourney(candidates,ctx,m.LearningJourneyAuthority(),skills=skills,evolution=evo)
    result=journey.query(ctx,now=AT)
    assert {"EVOLUTION_EVALUATION","EVOLUTION_APPROVAL","EVOLUTION_ACTIVATION"} <= {n["kind"] for n in result["nodes"]}
    checkpoint=journey.export_state(ctx,now=AT)
    evo.rollback(ctx,target,evidence_ref="rollback-proof",request_id="rollback",now=AT)
    result=journey.query(ctx,now=AT)
    assert any(n["status"]=="ROLLED_BACK" for n in result["nodes"])
    assert journey.menu(ctx,"Learning Journey",snapshot_hash=result["content_hash"],now=AT)["state"]=="blocked"
    with pytest.raises(m.JourneyError,match="JOURNEY_CHECKPOINT_INVALID"): journey.import_state(ctx,checkpoint,now=AT)


def test_source_revocation_read_projection_does_not_lazy_mutate(m):
    journey,ctx,env,_=setup(m)
    env[7].transition(ctx,"s1","REVOKED",reason="PERMISSION_REVOKED",expected_version=1,request_id="revoke",now=AT)
    before=deepcopy((env[5]._events,env[0]._events,env[7]._states))
    result=journey.query(ctx,now=AT)
    assert journey.menu(ctx,"Skills",snapshot_hash=result["content_hash"],now=AT)["state"]=="blocked"
    assert before==(env[5]._events,env[0]._events,env[7]._states)


def test_hook_quarantine_fallback_affected_run_and_trust_are_visible(m):
    journey,ctx,runtime,executor,receipt=hook_env(m)
    record=next(iter(runtime._state["records"].values()))
    runtime.quarantine(ctx,record["target"],reason="SECURITY",expected_version=record["state_version"],request_id="q",now=AT)
    before=_canonical(runtime._state); count=len(executor.calls)
    replay=journey.hook_replay(ctx,receipt["content_hash"],now=AT)
    state=replay["hook_states"][0]
    assert state["status"]=="QUARANTINED" and state["fallback_hash"] and state["trust_hash"]
    assert state["affected_runs"] and state["fault_policy_hash"]
    assert before==_canonical(runtime._state) and count==len(executor.calls)


def test_empty_menu_and_expired_or_foreign_checkpoint(m):
    from tests.knowledge.test_candidates_d06 import setup as candidate_setup
    env=candidate_setup(importlib.import_module("packages.knowledge.candidates")); candidates,ctx=env[:2]
    from packages.knowledge.skills import SkillRepository
    journey=m.LearningJourney(candidates,ctx,m.LearningJourneyAuthority(),skills=SkillRepository(candidates))
    view=journey.query(ctx,now=NOW)
    assert journey.menu(ctx,"Skills",snapshot_hash=view["content_hash"],now=NOW)["state"]=="empty"
    checkpoint=journey.export_state(ctx,now=NOW)
    other=m.LearningJourney(candidates,ctx,m.LearningJourneyAuthority(),skills=journey._skills)
    with pytest.raises(m.JourneyError,match="JOURNEY_CHECKPOINT_INVALID"): other.import_state(ctx,checkpoint,now=NOW)
    with pytest.raises(m.JourneyError): journey.query(ctx,now=NOW+timedelta(days=3))


def test_evolution_next_run_selection_bound_to_snapshot(m):
    from tests.knowledge.test_skill_evolution_d08 import setup as evo_setup, activate
    from tests.knowledge.test_candidates_d06 import snapshot
    evo,ctx,_,_,candidates,skills = env=evo_setup("CREATE")
    _,active=activate(env); instant=AT+timedelta(seconds=1)
    sr=snapshot(candidates._snapshots,run="evolved-run",instant=instant)
    candidates._run_clock.advance(instant)
    cap=evo.capture_run_start(ctx,to_primitive(active),sr,now=instant)
    selected=evo.select_next_run(ctx,cap,now=instant)
    journey=m.LearningJourney(candidates,ctx,m.LearningJourneyAuthority(),skills=skills,evolution=evo)
    view=journey.query(ctx,now=instant)
    assert any(n["artifact_hash"]==selected["content_hash"] and n["status"]=="NOT_INTEGRATED" for n in view["nodes"])


def test_source_derived_usage_and_revocation_impact_are_in_dag(m):
    from tests.knowledge.test_sources_d03 import item, ref
    journey,ctx,env,_=setup(m); sources=env[7]; source=sources.get(ctx,"s1",now=AT)
    child=sources.register_derived(ctx,item(source),expected_version=0,request_id="derive",now=AT)
    sources.record_usage(ctx,source_ref=ref(source),derived_ref=dict(item_id=child.item_id,version=child.version,record_hash=child.record_hash),
                         snapshot_id="reported-snapshot",run_id="reported-run",run_status="ACTIVE",request_id="source-use",now=AT)
    sources.transition(ctx,"s1","REVOKED",reason="PERMISSION_REVOKED",expected_version=1,request_id="revoke",now=AT)
    view=journey.query(ctx,now=AT)
    assert {"DERIVED_SOURCE","SOURCE_USAGE","SOURCE_IMPACT"} <= {n["kind"] for n in view["nodes"]}


@pytest.mark.parametrize("fault",[False,True])
def test_r2_replay_survives_executor_loss_after_host_sealed_capture(m,fault):
    journey,ctx,runtime,executor,receipt=hook_env(m,fault=fault)
    before=_canonical(runtime._state); count=len(executor.calls)
    checkpoint=journey.capture_replay_evidence(ctx,receipt["content_hash"],now=AT)
    expected=journey.hook_replay(ctx,receipt["content_hash"],now=AT)
    assert "fixture-input" not in str(checkpoint) and count==len(executor.calls)
    executor.calls.clear(); runtime._executor=None
    exported=journey.export_state(ctx,now=AT)
    restored=m.LearningJourney(journey._candidates,ctx,journey._authority,hooks=journey._hooks,runtime=runtime)
    restored.import_state(ctx,exported,now=AT)
    assert restored.hook_replay(ctx,receipt["content_hash"],now=AT)==expected
    assert before==_canonical(runtime._state)


def test_r2_timeline_covers_all_lifecycle_nodes_and_canonical_time(m):
    journey,ctx,env,_=setup(m)
    env[7].transition(ctx,"s1","REVOKED",reason="PERMISSION_REVOKED",expected_version=1,request_id="revoke",now=AT)
    view=journey.query(ctx,now=AT)
    assert {row["node_id"] for row in view["timeline"]}=={node["node_id"] for node in view["nodes"]}
    assert {"SOURCE","REVIEW","CANDIDATE","EVALUATION","APPROVAL","ACTIVATION","SELECTION","APPLICATION","SKILL_USE","SOURCE_IMPACT"} <= {row["kind"] for row in view["timeline"]}
    dated=[row for row in view["timeline"] if row["created_at"] is not None]
    assert [row["created_at"] for row in dated]==sorted(row["created_at"] for row in dated)
    positions={row["node_id"]:i for i,row in enumerate(view["timeline"])}
    for edge in view["edges"]:
        assert positions[edge["from"]]<positions[edge["to"]]
    assert view==journey.query(ctx,now=AT)


@pytest.mark.parametrize("change",["sealed_packet","receipt","definition","selection","missing_seal","foreign_seal"])
def test_r2_sealed_replay_tamper_or_missing_is_fail_closed(m,change):
    journey,ctx,runtime,executor,receipt=hook_env(m)
    key=(id(ctx),receipt["content_hash"]); entry=journey._authority._replays[key]
    if change=="sealed_packet":
        value=json.loads(entry[2]); value["packets"][0]["input"]={"bad":"token=FAKE_TEST_ONLY"}
        journey._authority._replays[key]=(ctx,entry[1],_canonical(value))
    elif change=="receipt": next(iter(runtime._state["receipts"].values()))["signature"]="f"*64
    elif change=="definition": next(iter(runtime._state["records"].values()))["definition"]["failure_policy"]="fail_open"
    elif change=="selection": next(iter(runtime._state["selections"].values()))["run_id"]="foreign"
    elif change=="missing_seal": journey._authority._replays.clear()
    else: journey._authority._replays[key]=(object(),entry[1],entry[2])
    executor.calls.clear()
    with pytest.raises(m.JourneyError) as error: journey.hook_replay(ctx,receipt["content_hash"],now=AT)
    assert "FAKE_TEST_ONLY" not in str(error.value) and not executor.calls


def test_r2_uncaptured_missing_packet_does_not_mint_a_checkpoint(m):
    journey,ctx,runtime,executor,receipt=hook_env(m,capture=False)
    executor.calls.clear()
    with pytest.raises(m.JourneyError,match="JOURNEY_MISSING_EVIDENCE"):
        journey.capture_replay_evidence(ctx,receipt["content_hash"],now=AT)
    assert not journey._authority._replays


@pytest.mark.parametrize("rehash",[False,True])
def test_r2_timeline_canonical_chronology_and_hash_drift_denied(m,rehash):
    journey,ctx,env,_=setup(m)
    key=next(iter(env[0]._invocations)); value=json.loads(env[0]._invocations[key])
    value["created_at"]=(NOW-timedelta(seconds=1)).isoformat()
    if rehash: value["content_hash"]=_hash({k:v for k,v in value.items() if k!="content_hash"})
    # Remove dependent receipt refs so this isolates timestamp causality, not a dangling edge.
    env[0]._l1.clear(); env[0]._uses.clear(); env[0]._events.clear()
    env[0]._invocations[key]=_canonical(value)
    with pytest.raises(m.JourneyError,match="JOURNEY_TIME_DRIFT" if rehash else "JOURNEY_HASH_DRIFT"):
        journey.query(ctx,now=AT)


def test_r2_timeline_ties_ignore_storage_insertion_order(m):
    journey,ctx,env,_=setup(m)
    expected=journey.query(ctx,now=AT)["timeline"]
    candidates=env[5]
    candidates._records=dict(reversed(list(candidates._records.items())))
    env[0]._materials=dict(reversed(list(env[0]._materials.items())))
    assert journey.query(ctx,now=AT)["timeline"]==expected
    source=next(row for row in expected if row["kind"]=="SOURCE")
    approval=next(row for row in expected if row["kind"]=="APPROVAL")
    assert source["created_at"]==approval["created_at"]=="2026-09-16T00:00:00+00:00"
    assert list(expected).index(source)<list(expected).index(approval)
    assert any(row["time_basis"]=="NOT_RECORDED" and row["created_at"] is None for row in expected)


def packetless_env(m,kind):
    journey,ctx,runtime,executor,first=hook_env(m,capture=False)
    event=to_primitive(executor.calls[-1])["event"]
    event["event_id"]="packetless-event"
    instant=AT; selection_id=first["selection_id"]
    if kind=="recursion": event["depth"]=1
    else:
        record=next(iter(runtime._state["records"].values()))
        runtime.quarantine(ctx,record["target"],reason="SECURITY",expected_version=record["state_version"],request_id="q",now=AT)
        instant=AT+timedelta(seconds=1)
        selection_id=selection(runtime,ctx,run="fallback-next",instant=instant)["selection_id"]
    executor.calls.clear()
    receipt=runtime.run(ctx,selection_id,event,{"payload":"PRIVATE_INPUT_MARKER"},now=instant)
    assert executor.calls==[]
    return journey,ctx,runtime,executor,receipt,instant


@pytest.mark.parametrize("kind,reason",[("recursion","HOOK_RECURSION_BLOCKED"),("fallback","HOOK_FAULT_DENY")])
def test_r3_packetless_receipt_metadata_visible_while_replay_remains_denied(m,kind,reason):
    journey,ctx,runtime,executor,receipt,instant=packetless_env(m,kind)
    before=_canonical(runtime._state); view=journey.query(ctx,now=instant)
    node_id="HOOK_RECEIPT:"+receipt["content_hash"]
    detail=journey.detail(ctx,node_id,snapshot_hash=view["content_hash"],now=instant)
    projected=detail["stored_receipt"]
    stored=next(v for v in runtime._state["receipts"].values() if v["result"]["content_hash"]==receipt["content_hash"])
    assert projected["decision"]=="deny" and projected["reason"]==reason
    assert projected["event_hash"]==receipt["event_hash"] and projected["idempotency_hash"]==stored["signature"]
    assert projected["selection_id"]==receipt["selection_id"] and projected["selection_hash"]
    assert projected["evidence_status"]=="RECORDED_NOT_REPLAYED"
    assert projected["fallback_hashes"] if kind=="fallback" else not projected["fallback_hashes"]
    assert "PRIVATE_INPUT_MARKER" not in _canonical(detail) and "entrypoint" not in _canonical(detail)
    for operation in (journey.hook_replay,journey.capture_replay_evidence):
        with pytest.raises(m.JourneyError,match="JOURNEY_MISSING_EVIDENCE"): operation(ctx,receipt["content_hash"],now=instant)
    assert before==_canonical(runtime._state) and executor.calls==[]


@pytest.mark.parametrize("change",["receipt_hash","signature_secret","reason_secret","foreign_selection"])
def test_r3_stored_receipt_tamper_or_foreign_selection_denied(m,change):
    journey,ctx,runtime,_,receipt,instant=packetless_env(m,"recursion")
    saved=next(v for v in runtime._state["receipts"].values() if v["result"]["content_hash"]==receipt["content_hash"])
    if change=="receipt_hash": saved["result"]["decision"]="allow"
    elif change=="signature_secret": saved["signature"]="token=FAKE_TEST_ONLY"
    elif change=="reason_secret":
        saved["result"]["reason"]="PRIVATE_ARBITRARY_STRING"
        saved["result"]["content_hash"]=_hash({k:v for k,v in saved["result"].items() if k!="content_hash"})
    else:
        selected=runtime._state["selections"][receipt["selection_id"]]
        selected["principal"]="foreign-actor"
        selected["content_hash"]=_hash({k:v for k,v in selected.items() if k not in ("content_hash","selection_id")})
        selected["selection_id"]="automation-selection-"+selected["content_hash"]
        saved["result"]["selection_id"]=selected["selection_id"]
        runtime._state["selections"]={selected["selection_id"]:selected}
        # Drop the older fixture receipt so authority, not dangling, is tested.
        runtime._state["receipts"]={"only":saved}
        saved["result"]["content_hash"]=_hash({k:v for k,v in saved["result"].items() if k!="content_hash"})
    with pytest.raises(m.JourneyError) as error: journey.query(ctx,now=instant)
    assert "FAKE_TEST_ONLY" not in str(error.value) and "PRIVATE_ARBITRARY_STRING" not in str(error.value)
