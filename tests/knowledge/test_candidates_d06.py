"""D-06 actual in-memory review/snapshot/source lifecycle; runtime IO는 없다."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import timedelta
import importlib
import pytest
from packages.knowledge.memory import MemoryRepository, _hash
from packages.knowledge.snapshots import LearningSnapshotRepository
from packages.knowledge.reviews import LearningReviewRepository
from packages.knowledge.sources import MemoryScope, to_primitive
from tests.knowledge.test_reviews_d05 import NOW, payload as review_payload, attest as review_attest, create as review_create, evidence as review_evidence, provenance
from tests.knowledge.test_patterns_d04 import setup as source_setup
from tests.knowledge.test_snapshots_d02 import bases
from tests.knowledge.test_memory_d01 import payload as memory_payload


@pytest.fixture
def c():
    try:
        return importlib.import_module("packages.knowledge.candidates")
    except ModuleNotFoundError:
        pytest.fail("D06_CANDIDATE_LIFECYCLE_MISSING")


class HostClock:
    def __init__(self):
        self.value = NOW

    def __call__(self):
        return self.value

    def advance(self, value):
        self.value = value


def setup(c, kind="SKILL", identity="1"):
    patterns, sources, ctx, source = source_setup(importlib.import_module("packages.knowledge.patterns"))
    snapshots, memory = LearningSnapshotRepository(), MemoryRepository()
    reviews = LearningReviewRepository(sources, snapshots=snapshots, memory=memory, patterns=patterns)
    ref = provenance("SOURCE", "s1", source.record.record_hash)
    data = review_payload(review_id="review" + identity, subject_ref=dict(kind="RUN", subject_id="origin" + identity), no_change_reason=None,
                          candidate_actions=[dict(kind=kind if kind != "USER" else "MEMORY", action="PROPOSE", polarity="POSITIVE", summary="bounded retry", evidence_refs=["test1"])])
    refs = [ref]
    if kind == "USER":
        entry = memory.add(memory_payload(kind="USER"), now=NOW)
        refs.append(provenance("USER", entry.entry_id, entry.content_hash))
        data["user_corrections"] = [dict(summary="prefer bounded retry", evidence_refs=["decision1"])]
    review_attest(reviews, ctx, data, proof=review_evidence(provenance=refs))
    review = review_create(reviews, ctx, data)
    repo = c.CandidateRepository(reviews, snapshots, run_clock=HostClock())
    proposal = dict(candidate_id="candidate" + identity, review_ref=dict(review_id=review.review_id, version=1, content_hash=review.content_hash),
                    selector=dict(field="user_corrections" if kind == "USER" else "candidate_actions", index=0,
                                  content_hash=_hash(data["user_corrections"][0] if kind == "USER" else data["candidate_actions"][0])),
                    target_id="catalog-item", intent="CREATE", target_scope=to_primitive(MemoryScope("u1", "project", "p1")),
                    confidence="VERIFIED", expires_at=NOW + timedelta(hours=6),
                    risk_delta=dict(risk="LOW", capabilities=["READ"], implicit_trigger=False, script=False, policy=False),
                    user_source_ref=refs[-1] if kind == "USER" else None)
    return repo, ctx, proposal, sources, snapshots


def create(repo, ctx, proposal, request="create", now=NOW):
    return repo.create(ctx, proposal, expected_version=0, request_id=request, now=now)


def ref(result):
    value = result["candidate"] if "candidate" in result else result
    return dict(candidate_id=value["candidate_id"], version=value["version"], content_hash=value["content_hash"])


def proof(target, status="PASS", **metrics):
    names = ("static", "security", "license", "permission", "replay", "sandbox_pilot", "quality", "cost", "trigger")
    values = dict(baseline_quality=1.0, observed_quality=1.0, baseline_cost=1.0, observed_cost=1.0, baseline_trigger=1.0, observed_trigger=1.0)
    values.update(metrics)
    return dict(checks={name: dict(status=status, target_hash=target["content_hash"], evidence_ref="evidence-" + name) for name in names}, metrics=values)


def evaluated(repo, ctx, proposal):
    suffix = proposal["candidate_id"]
    result = create(repo, ctx, proposal, request="create-" + suffix)
    target = ref(result)
    repo.capture_evaluation(ctx, target, proof(target), now=NOW, expires_at=NOW + timedelta(hours=1))
    return repo.evaluate(ctx, target, expected_version=1, request_id="evaluate-" + suffix, now=NOW)


def activate(repo, ctx, proposal, now=NOW):
    result = evaluated(repo, ctx, proposal)
    target = ref(result)
    suffix = proposal["candidate_id"]
    repo.request_approval(ctx, target, expected_version=2, request_id="request-" + suffix, now=now)
    repo.capture_human_decision(ctx, target, decision="APPROVE", evidence_ref="human-event", now=now, expires_at=now + timedelta(hours=1))
    repo.approve(ctx, target, expected_version=3, request_id="approve-" + suffix, now=now)
    return repo.activate(ctx, target, expected_version=4, request_id="activate-" + suffix, now=now)


def snapshot(snapshots, run="next-run", instant=NOW + timedelta(seconds=1)):
    scope = MemoryScope("u1", "project", "p1")
    if not snapshots._sessions:
        snapshots.publish(scope, base_sources=bases(), sources=[], now=NOW)
        snapshots.create_session("session1", scope, now=NOW, request_id="session")
    value = snapshots.create_task_run("session1", "task-" + run, run, "revision1", scope, now=instant, request_id="snapshot-" + run)
    return dict(session_id=value.session_id, task_id=value.task_id, run_id=value.run_id, snapshot_id=value.snapshot_id, content_hash=value.content_hash)


def start_boundary(repo, ctx, activations, snap):
    actual = repo._snapshots.get_task_run(snap["session_id"], snap["task_id"], snap["run_id"], MemoryScope("u1", "project", "p1"))
    repo._run_clock.advance(actual.created_at)
    return repo.capture_run_start(ctx, activations, snap, now=actual.created_at)


def select(repo, ctx, activations, snap, *, now):
    start = start_boundary(repo, ctx, activations, snap)
    repo._run_clock.advance(now)
    return repo.select_next_run(ctx, activations, snap, run_start=start, now=now)


@pytest.mark.parametrize("kind", ["MEMORY", "CODE_PATTERN", "ANTI_PATTERN", "SKILL", "HOOK", "PROMPT", "BENCHMARK", "ROUTING"])
def test_all_review_action_kinds_follow_next_run_lifecycle(c, kind):
    repo, ctx, proposal, _, snapshots = setup(c, kind)
    active = activate(repo, ctx, proposal)
    assert active["kind"] == kind and active["applies_from"] == "NEXT_TASK_OR_RUN"
    snap = snapshot(snapshots)
    selection = select(repo, ctx, [to_primitive(active)], snap, now=NOW + timedelta(seconds=1))
    use = repo.register_use(ctx, active["activation_id"], selection["selection_id"], expected_selection_hash=selection["content_hash"], request_id="use", now=NOW + timedelta(seconds=1))
    assert use["run_id"] == "next-run" and use["review_ref"] == proposal["review_ref"]
    report = repo.query(ctx, proposal["candidate_id"], now=NOW + timedelta(seconds=1))
    assert [x["status"] for x in report["events"]] == ["PROPOSED", "EVALUATED", "AWAITING_APPROVAL", "APPROVED", "ACTIVE"]
    assert report["candidate"]["provenance"][0]["inherited"]["confidentiality"] == "private"
    assert report["uses"][0]["activation_hash"] == active["content_hash"]
    assert snapshots.get_task_run("session1", snap["task_id"], snap["run_id"], MemoryScope("u1", "project", "p1")).source_versions == ()


def test_user_requires_exact_correction_source_and_separate_confirmation(c):
    repo, ctx, proposal, _, _ = setup(c, "USER")
    with pytest.raises(c.CandidateError, match="USER_CONFIRMATION_REQUIRED"):
        create(repo, ctx, proposal)
    repo.capture_user_confirmation(ctx, proposal, evidence_ref="user-confirmation", now=NOW, expires_at=NOW + timedelta(hours=1))
    result = activate(repo, ctx, proposal)
    assert result["kind"] == "USER"


@pytest.mark.parametrize("status", ["FAIL", "SKIPPED", "BLOCKED", "ERROR"])
def test_nonpass_evaluation_cannot_request_approval(c, status):
    repo, ctx, proposal, _, _ = setup(c)
    target = ref(create(repo, ctx, proposal))
    repo.capture_evaluation(ctx, target, proof(target, status), now=NOW, expires_at=NOW + timedelta(hours=1))
    state = repo.evaluate(ctx, target, expected_version=1, request_id="eval", now=NOW)
    assert state["evaluation"]["counts"][status] == 9 and state["evaluation"]["passed"] is False
    with pytest.raises(c.CandidateError, match="EVALUATION_NOT_PASS"):
        repo.request_approval(ctx, target, expected_version=2, request_id="request", now=NOW)


@pytest.mark.parametrize("change", [{"observed_quality": .9}, {"observed_cost": 2.0}, {"observed_trigger": .5}])
def test_baseline_regression_overrides_pass_labels(c, change):
    repo, ctx, proposal, _, _ = setup(c)
    target = ref(create(repo, ctx, proposal))
    repo.capture_evaluation(ctx, target, proof(target, **change), now=NOW, expires_at=NOW + timedelta(hours=1))
    result = repo.evaluate(ctx, target, expected_version=1, request_id="eval", now=NOW)
    assert result["evaluation"]["passed"] is False


def test_bare_or_wrong_target_evaluation_and_missing_human_are_denied(c):
    repo, ctx, proposal, _, _ = setup(c)
    target = ref(create(repo, ctx, proposal))
    with pytest.raises(c.CandidateError, match="EVALUATION_ATTESTATION_REQUIRED"):
        repo.evaluate(ctx, target, expected_version=1, request_id="eval", now=NOW)
    bad = proof(target)
    bad["checks"]["security"]["target_hash"] = "b" * 64
    with pytest.raises(c.CandidateError, match="EVIDENCE_TARGET_MISMATCH"):
        repo.capture_evaluation(ctx, target, bad, now=NOW, expires_at=NOW + timedelta(hours=1))
    with pytest.raises(c.CandidateError, match="INVALID_CANDIDATE_TRANSITION"):
        repo.activate(ctx, target, expected_version=1, request_id="activate", now=NOW)
    repo.capture_evaluation(ctx, target, proof(target), now=NOW, expires_at=NOW + timedelta(hours=1))
    repo.evaluate(ctx, target, expected_version=1, request_id="eval", now=NOW)
    repo.request_approval(ctx, target, expected_version=2, request_id="request", now=NOW)
    with pytest.raises(c.CandidateError, match="HUMAN_APPROVAL_REQUIRED"):
        repo.approve(ctx, target, expected_version=3, request_id="approve", now=NOW)


@pytest.mark.parametrize("extra", [{"trusted_auto": True}, {"approval": True}, {"actor": "human1"}, {"permission": "all"}, {"evidence": {}}])
def test_proposal_cannot_mint_authority(c, extra):
    repo, ctx, proposal, _, _ = setup(c)
    with pytest.raises(c.CandidateError, match="INVALID_CANDIDATE_INPUT"):
        create(repo, ctx, {**proposal, **extra})


@pytest.mark.parametrize("actor", ["human1", "human2"])
def test_cross_context_cannot_consume_candidate_or_job_like_actions(c, actor):
    repo, ctx, proposal, sources, _ = setup(c)
    target = ref(create(repo, ctx, proposal))
    other = sources.admit_host(actor, MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=8))
    with pytest.raises(c.CandidateError):
        create(repo, other, proposal)
    with pytest.raises(c.CandidateError, match="CANDIDATE_AUTHORITY_MISMATCH"):
        repo.capture_evaluation(other, target, proof(target), now=NOW, expires_at=NOW + timedelta(hours=1))
    with pytest.raises(c.CandidateError, match="CANDIDATE_AUTHORITY_MISMATCH"):
        repo.query(other, proposal["candidate_id"], now=NOW)


@pytest.mark.parametrize("instant,run", [(NOW, "current"), (NOW + timedelta(seconds=1), "origin1")])
def test_current_run_and_origin_run_selection_are_denied(c, instant, run):
    repo, ctx, proposal, _, snapshots = setup(c)
    active = activate(repo, ctx, proposal)
    snap = snapshot(snapshots, run, instant)
    with pytest.raises(c.CandidateError, match="NEXT_RUN_REQUIRED"):
        select(repo, ctx, [to_primitive(active)], snap, now=NOW + timedelta(seconds=2))


@pytest.mark.parametrize("reason", ["DELETED", "LICENSE_CHANGED", "SECRET_EXPOSED"])
@pytest.mark.parametrize("kind", ["MEMORY", "SKILL", "HOOK"])
def test_source_revoke_blocks_cached_activation_and_preserves_running_impact(c, reason, kind):
    repo, ctx, proposal, sources, snapshots = setup(c, kind)
    active = activate(repo, ctx, proposal)
    snap = snapshot(snapshots)
    selection = select(repo, ctx, [to_primitive(active)], snap, now=NOW + timedelta(seconds=1))
    repo.register_use(ctx, active["activation_id"], selection["selection_id"], expected_selection_hash=selection["content_hash"], request_id="use", now=NOW + timedelta(seconds=1))
    sources.transition(ctx, "s1", "REVOKED", reason, expected_version=1, request_id="revoke", now=NOW + timedelta(seconds=2))
    with pytest.raises(c.CandidateError, match="CANDIDATE_QUARANTINED"):
        repo.register_use(ctx, active["activation_id"], selection["selection_id"], expected_selection_hash=selection["content_hash"], request_id="use", now=NOW + timedelta(seconds=2))
    report = repo.query(ctx, proposal["candidate_id"], now=NOW + timedelta(seconds=2))
    assert report["state"]["status"] == "QUARANTINED"
    assert report["impacts"][0]["pause_required_runs"] == ("next-run",)
    assert report["uses"][0]["snapshot_hash"] == snap["content_hash"]


def test_rollback_blocks_use_and_keeps_baseline_and_affected_run(c):
    repo, ctx, proposal, _, snapshots = setup(c)
    active = activate(repo, ctx, proposal)
    snap = snapshot(snapshots)
    selected = select(repo, ctx, [to_primitive(active)], snap, now=NOW + timedelta(seconds=1))
    repo.register_use(ctx, active["activation_id"], selected["selection_id"], expected_selection_hash=selected["content_hash"], request_id="use", now=NOW + timedelta(seconds=1))
    result = repo.rollback(ctx, ref(create(repo, ctx, proposal)), reason="QUALITY_REGRESSION", evidence_ref="rollback-evidence", expected_version=5, request_id="rollback", now=NOW + timedelta(seconds=2))
    assert result["impacts"][0]["restore"] == "BASELINE" and result["impacts"][0]["affected_runs"] == ("next-run",)
    with pytest.raises(c.CandidateError, match="CANDIDATE_ROLLED_BACK"):
        repo.register_use(ctx, active["activation_id"], selected["selection_id"], expected_selection_hash=selected["content_hash"], request_id="use", now=NOW + timedelta(seconds=3))


def test_concurrency_alias_and_stale_versions(c):
    repo, ctx, proposal, _, _ = setup(c)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda n: create(repo, ctx, proposal, request="create" + str(n)), range(8)))
    assert len({r["candidate"]["content_hash"] for r in results}) == 1
    target = ref(results[0])
    with pytest.raises(TypeError):
        results[0]["candidate"]["risk_delta"]["risk"] = "LOW"
    wrong = deepcopy(proposal)
    wrong["target_scope"]["project_id"] = "foreign"
    with pytest.raises(c.CandidateError):
        create(repo, ctx, wrong, request="foreign")
    with pytest.raises(c.CandidateError, match="CANDIDATE_VERSION_CONFLICT"):
        repo.request_approval(ctx, target, expected_version=0, request_id="stale", now=NOW)


def successor(repo, ctx, original, identity):
    previous = repo._reviews.get(ctx, original["review_ref"]["review_id"], now=NOW)
    data = review_payload(review_id="review" + identity, subject_ref=dict(kind="RUN", subject_id="origin" + identity),
                          no_change_reason=None, candidate_actions=to_primitive(previous.candidate_actions))
    review_attest(repo._reviews, ctx, data, proof=review_evidence(provenance=[to_primitive(x["reference"]) for x in previous.provenance]))
    review = review_create(repo._reviews, ctx, data, request="review-create" + identity)
    proposal = deepcopy(original)
    proposal.update(candidate_id="candidate" + identity, review_ref=dict(review_id=review.review_id, version=1, content_hash=review.content_hash), intent="PATCH")
    return proposal


def test_activation_replay_cannot_reuse_foreign_request_id(c):
    repo, ctx, proposal, _, _ = setup(c)
    active = activate(repo, ctx, proposal)
    with pytest.raises(c.CandidateError, match="CANDIDATE_REPLAY_CONFLICT"):
        repo.activate(ctx, to_primitive(active["candidate_ref"]), expected_version=4, request_id="create-candidate1", now=NOW)


def test_rollback_restores_previous_safe_activation_without_version_reuse(c):
    repo, ctx, proposal, _, _ = setup(c)
    first = activate(repo, ctx, proposal)
    second_proposal = successor(repo, ctx, proposal, "2")
    second = activate(repo, ctx, second_proposal)
    assert second["version"] == 2 and second["previous_activation"] == first["activation_id"]
    rolled = repo.rollback(ctx, to_primitive(second["candidate_ref"]), reason="REGRESSION", evidence_ref="retest", expected_version=5, request_id="rollback", now=NOW)
    assert rolled["impacts"][0]["restore"] == first["activation_id"]
    third = activate(repo, ctx, successor(repo, ctx, proposal, "3"))
    assert third["version"] == 3 and third["previous_activation"] == first["activation_id"]


def test_activation_concurrency_and_selection_immutable_hash(c):
    repo, ctx, proposal, _, snapshots = setup(c)
    active = activate(repo, ctx, proposal)
    target = to_primitive(active["candidate_ref"])
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda n: repo.activate(ctx, target, expected_version=4, request_id="activation-replay" + str(n), now=NOW), range(8)))
    assert len({a["activation_id"] for a in results}) == 1
    snap = snapshot(snapshots)
    wrong = to_primitive(active)
    wrong["risk_delta"]["capabilities"] = ["SECRET"]
    with pytest.raises(c.CandidateError, match="ACTIVATION_REFERENCE_MISMATCH"):
        select(repo, ctx, [wrong], snap, now=NOW + timedelta(seconds=1))
    wrong_snap = {**snap, "content_hash": "b" * 64}
    with pytest.raises(c.CandidateError, match="SNAPSHOT_REFERENCE_MISMATCH"):
        select(repo, ctx, [to_primitive(active)], wrong_snap, now=NOW + timedelta(seconds=1))
    selection = select(repo, ctx, [to_primitive(active)], snap, now=NOW + timedelta(seconds=1))
    with pytest.raises(c.CandidateError, match="ACTIVATION_REFERENCE_MISMATCH"):
        repo.register_use(ctx, active["activation_id"], selection["selection_id"], expected_selection_hash="b" * 64, request_id="use", now=NOW + timedelta(seconds=1))
    use = repo.register_use(ctx, active["activation_id"], selection["selection_id"], expected_selection_hash=selection["content_hash"], request_id="use", now=NOW + timedelta(seconds=1))
    assert repo.register_use(ctx, active["activation_id"], selection["selection_id"], expected_selection_hash=selection["content_hash"], request_id="use2", now=NOW + timedelta(seconds=1)) == use
    assert len(repo.query(ctx, proposal["candidate_id"], now=NOW + timedelta(seconds=1))["uses"]) == 1


@pytest.mark.parametrize("edge", ["expired", "future", "reject"])
def test_human_decision_time_and_rejection_cannot_activate(c, edge):
    repo, ctx, proposal, _, _ = setup(c)
    target = ref(evaluated(repo, ctx, proposal))
    repo.request_approval(ctx, target, expected_version=2, request_id="request", now=NOW)
    issued = NOW + timedelta(seconds=10) if edge == "future" else NOW
    repo.capture_human_decision(ctx, target, decision="REJECT" if edge == "reject" else "APPROVE", evidence_ref="human", now=issued, expires_at=issued + timedelta(seconds=10))
    if edge != "reject":
        at = NOW + timedelta(seconds=10) if edge == "expired" else NOW
        with pytest.raises(c.CandidateError, match="STALE_CANDIDATE_ATTESTATION"):
            repo.approve(ctx, target, expected_version=3, request_id="approve", now=at)
    else:
        rejected = repo.approve(ctx, target, expected_version=3, request_id="approve", now=NOW)
        assert rejected["state"]["status"] == "REJECTED"
        with pytest.raises(c.CandidateError, match="CANDIDATE_REJECTED"):
            repo.activate(ctx, target, expected_version=4, request_id="activate", now=NOW)


@pytest.mark.parametrize("change", ["selector", "source", "proof", "actor"])
def test_user_confirmation_cannot_be_rebound(c, change):
    repo, ctx, proposal, sources, _ = setup(c, "USER")
    repo.capture_user_confirmation(ctx, proposal, evidence_ref="human-confirmation", now=NOW, expires_at=NOW + timedelta(hours=1))
    if change == "selector":
        proposal["selector"]["content_hash"] = "b" * 64
    elif change == "source":
        proposal["user_source_ref"]["content_hash"] = "b" * 64
    elif change == "proof":
        proposal["risk_delta"]["script"] = True
    else:
        ctx = sources.admit_host("human2", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=8))
    with pytest.raises(c.CandidateError):
        create(repo, ctx, proposal)


def test_user_candidate_persists_separate_confirmation_binding(c):
    repo, ctx, proposal, _, _ = setup(c, "USER")
    repo.capture_user_confirmation(ctx, proposal, evidence_ref="human-confirmation", now=NOW, expires_at=NOW + timedelta(hours=1))
    created = create(repo, ctx, proposal)
    assert len(created["candidate"]["user_confirmation_hash"]) == 64


def test_explicit_quarantine_keeps_audit_and_rejects_reactivation(c):
    repo, ctx, proposal, _, _ = setup(c)
    target = ref(create(repo, ctx, proposal))
    result = repo.quarantine(ctx, target, reason="SECURITY", evidence_ref="audit-event", expected_version=1, request_id="quarantine", now=NOW)
    assert result["state"]["status"] == "QUARANTINED" and len(result["events"]) == 2
    with pytest.raises(c.CandidateError, match="CANDIDATE_QUARANTINED"):
        repo.capture_evaluation(ctx, target, proof(target), now=NOW, expires_at=NOW + timedelta(hours=1))


def test_source_sync_quarantines_entire_candidate_lineage(c):
    repo, ctx, proposal, sources, _ = setup(c)
    first = activate(repo, ctx, proposal)
    second = activate(repo, ctx, successor(repo, ctx, proposal, "2"))
    sources.transition(ctx, "s1", "QUARANTINED", "SECRET_EXPOSED", expected_version=1, request_id="revoke", now=NOW)
    impacts = repo.sync_sources(ctx, now=NOW)
    assert {x["candidate_ref"]["candidate_id"] for x in impacts} == {"candidate1", "candidate2"}
    assert len(repo.sync_sources(ctx, now=NOW)) == 2
    for candidate in (first, second):
        assert repo.query(ctx, candidate["candidate_ref"]["candidate_id"], now=NOW)["state"]["status"] == "QUARANTINED"


def test_indirect_code_pattern_source_revoke_reaches_skill(c):
    from tests.knowledge.test_patterns_d04 import payload as pattern_payload, attest as pattern_attest, evidence as pattern_evidence, extract
    repo, ctx, proposal, sources, _ = setup(c)
    state = sources.get(ctx, "s1", now=NOW)
    data = pattern_payload(state)
    pattern_attest(repo._reviews._patterns, ctx, data, pattern_evidence(state))
    pattern = extract(repo._reviews._patterns, ctx, data)
    old_review = repo._reviews.get(ctx, "review1", now=NOW)
    review_data = review_payload(review_id="indirect-review", subject_ref=dict(kind="RUN", subject_id="indirect-run"),
                                no_change_reason=None, candidate_actions=to_primitive(old_review.candidate_actions))
    pattern_ref = provenance("CODE_PATTERN", pattern.artifact_id, pattern.record_hash)
    review_attest(repo._reviews, ctx, review_data, proof=review_evidence(provenance=[pattern_ref]))
    review = review_create(repo._reviews, ctx, review_data, request="indirect-review")
    proposal["review_ref"] = dict(review_id=review.review_id, version=1, content_hash=review.content_hash)
    active = activate(repo, ctx, proposal)
    sources.transition(ctx, "s1", "REVOKED", "LICENSE_CHANGED", expected_version=1, request_id="revoke", now=NOW)
    with pytest.raises(c.CandidateError, match="CANDIDATE_QUARANTINED"):
        repo.activate(ctx, to_primitive(active["candidate_ref"]), expected_version=4, request_id="activation-replay", now=NOW)


def test_next_run_selection_cannot_be_expanded_after_freeze(c):
    repo, ctx, proposal, _, snapshots = setup(c)
    first = activate(repo, ctx, proposal)
    next_proposal = successor(repo, ctx, proposal, "2")
    next_proposal["target_id"] = "another-catalog-item"
    second = activate(repo, ctx, next_proposal)
    snap = snapshot(snapshots)
    start = start_boundary(repo, ctx, [to_primitive(first)], snap)
    selected = repo.select_next_run(ctx, [to_primitive(first)], snap, run_start=start, now=NOW + timedelta(seconds=1))
    with pytest.raises(c.CandidateError, match="RUN_START_CONSUMED"):
        repo.select_next_run(ctx, [to_primitive(first), to_primitive(second)], snap, run_start=start, now=NOW + timedelta(seconds=1))
    with pytest.raises(c.CandidateError, match="RUN_START_CONSUMED"):
        repo.select_next_run(ctx, [to_primitive(first)], snap, run_start=start, now=NOW + timedelta(seconds=1))
    assert selected["snapshot_ref"] == snap


def test_r1_late_running_snapshot_is_not_a_run_start_authority(c):
    repo, ctx, proposal, _, snapshots = setup(c)
    active = activate(repo, ctx, proposal)
    snap = snapshot(snapshots)
    with pytest.raises(c.CandidateError, match="RUN_START_AUTHORITY_REQUIRED"):
        repo.select_next_run(ctx, [to_primitive(active)], snap, now=NOW + timedelta(minutes=30))


def healthy_successor(repo, ctx, original, identity):
    from packages.knowledge.sources import hash_body
    sources = repo._reviews._sources
    body = "independent approved reference " + identity
    source = dict(source_id="source" + identity, version=1, source_type="design_document",
                  locator=dict(document_id="doc" + identity, revision="r1"), body=body, content_hash=hash_body(body),
                  teaching_intent="bounded retry", user_quality_label="exemplar", exclusions=[])
    sources.authorize_capture(ctx, source, confidentiality="private", license_ref="internal-owned", license_status="APPROVED",
                              ownership="OWNED", quality_evidence=["quality"], now=NOW)
    record = sources.register(ctx, source, expected_version=0, request_id="source" + identity, now=NOW)
    review_data = review_payload(review_id="fresh-review" + identity, subject_ref=dict(kind="RUN", subject_id="fresh-run" + identity),
                                no_change_reason=None, candidate_actions=[dict(kind="SKILL", action="PROPOSE", polarity="POSITIVE", summary="bounded retry", evidence_refs=["test1"])])
    review_attest(repo._reviews, ctx, review_data, proof=review_evidence(provenance=[provenance("SOURCE", source["source_id"], record.record.record_hash)]))
    review = review_create(repo._reviews, ctx, review_data, request="fresh-review" + identity)
    proposal = deepcopy(original)
    proposal.update(candidate_id="fresh-candidate" + identity, review_ref=dict(review_id=review.review_id, version=1, content_hash=review.content_hash), intent="PATCH")
    return proposal


@pytest.mark.parametrize("safe_previous", [False, True])
def test_r1_source_quarantine_allows_independent_replacement_in_same_slot(c, safe_previous):
    repo, ctx, proposal, sources, _ = setup(c)
    first = activate(repo, ctx, proposal)
    bad = activate(repo, ctx, healthy_successor(repo, ctx, proposal, "2")) if safe_previous else first
    bad_source = "source2" if safe_previous else "s1"
    sources.transition(ctx, bad_source, "QUARANTINED", "SECRET_EXPOSED", expected_version=1, request_id="revoke", now=NOW)
    report = repo.query(ctx, bad["candidate_ref"]["candidate_id"], now=NOW)
    replacement = activate(repo, ctx, healthy_successor(repo, ctx, proposal, "3"))
    expected_previous = first["activation_id"] if safe_previous else None
    assert replacement["previous_activation"] == expected_previous
    assert report["impacts"][0]["restore"] == (expected_previous or "BASELINE")
    with pytest.raises(c.CandidateError, match="CANDIDATE_QUARANTINED"):
        repo.activate(ctx, to_primitive(bad["candidate_ref"]), expected_version=4, request_id="old-cached", now=NOW)


@pytest.mark.parametrize("edge", ["late", "backdate", "future", "deadline", "foreign_context", "foreign_actor", "cross_run", "snapshot_hash", "forged", "mutated"])
def test_r1_run_start_authority_rejects_late_rebound_or_forged_selection(c, edge):
    repo, ctx, proposal, sources, snapshots = setup(c)
    active = to_primitive(activate(repo, ctx, proposal))
    snap = snapshot(snapshots)
    other_snap = snapshot(snapshots, "other-run")
    start = start_boundary(repo, ctx, [active], snap)
    now = NOW + timedelta(seconds=1)
    caller, supplied_snap = ctx, snap
    if edge == "late":
        repo._run_clock.advance(NOW + timedelta(minutes=30))
    elif edge == "backdate":
        now = NOW
    elif edge == "future":
        now = NOW + timedelta(seconds=2)
    elif edge == "deadline":
        now = NOW + timedelta(seconds=6)
        repo._run_clock.advance(now)
    elif edge in ("foreign_actor", "foreign_context"):
        caller = sources.admit_host("human2" if edge == "foreign_actor" else "human1", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=8))
    elif edge == "cross_run":
        supplied_snap = other_snap
    elif edge == "snapshot_hash":
        supplied_snap = {**snap, "content_hash": "b" * 64}
    elif edge == "forged":
        start = c.RunStartBoundary(start.boundary_id, start.content_hash)
    else:
        object.__setattr__(start, "content_hash", "b" * 64)
    with pytest.raises(c.CandidateError) as error:
        repo.select_next_run(caller, [active], supplied_snap, run_start=start, now=now)
    assert error.value.reason in {"RUN_START_AUTHORITY_REQUIRED", "STALE_RUN_START_BOUNDARY", "RUN_START_BINDING_MISMATCH", "CANDIDATE_AUTHORITY_MISMATCH"}
    assert repo.query(ctx, proposal["candidate_id"], now=NOW + timedelta(minutes=30))["uses"] == ()


def test_r1_selection_uses_actual_host_time_and_one_shot_boundary(c):
    repo, ctx, proposal, _, snapshots = setup(c)
    active = to_primitive(activate(repo, ctx, proposal))
    snap = snapshot(snapshots)
    start = start_boundary(repo, ctx, [active], snap)
    observed = NOW + timedelta(seconds=2)
    repo._run_clock.advance(observed)
    selected = repo.select_next_run(ctx, [active], snap, run_start=start, now=observed)
    assert selected["created_at"] == observed.isoformat()
    assert selected["run_started_at"] == (NOW + timedelta(seconds=1)).isoformat()
    with pytest.raises(c.CandidateError, match="RUN_START_CONSUMED"):
        repo.select_next_run(ctx, [active], snap, run_start=start, now=observed)
    with pytest.raises(c.CandidateError, match="RUN_START_ALREADY_ISSUED"):
        repo.capture_run_start(ctx, [active], snap, now=observed)
    with pytest.raises(c.CandidateError, match="STALE_RUN_START_BOUNDARY"):
        repo.register_use(ctx, active["activation_id"], selected["selection_id"], expected_selection_hash=selected["content_hash"], request_id="early-use", now=NOW + timedelta(seconds=1))
    assert repo.register_use(ctx, active["activation_id"], selected["selection_id"], expected_selection_hash=selected["content_hash"], request_id="use", now=observed)["run_id"] == "next-run"


def test_r1_late_host_capture_cannot_be_backdated(c):
    repo, ctx, proposal, _, snapshots = setup(c)
    active = to_primitive(activate(repo, ctx, proposal))
    snap = snapshot(snapshots)
    repo._run_clock.advance(NOW + timedelta(minutes=30))
    with pytest.raises(c.CandidateError, match="STALE_RUN_START_BOUNDARY"):
        repo.capture_run_start(ctx, [active], snap, now=NOW + timedelta(seconds=1))


def test_r1_quarantine_cannot_remove_other_authoritys_current_head(c):
    repo, ctx, proposal, sources, _ = setup(c)
    other = sources.admit_host("human2", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(hours=8))
    other_proposal = healthy_successor(repo, other, proposal, "other")
    other_candidate = create(repo, other, other_proposal)
    active = activate(repo, ctx, proposal)
    repo.quarantine(other, ref(other_candidate), reason="SECURITY", evidence_ref="audit", expected_version=1, request_id="quarantine", now=NOW)
    # Containment of the other pending proposal must not withdraw this approved slot.
    assert repo.activate(ctx, to_primitive(active["candidate_ref"]), expected_version=4, request_id="replay", now=NOW) == active
