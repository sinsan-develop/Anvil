"""D-04 trusted provenance·positive quality·progressive retrieval 계약."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import importlib
import pytest
from packages.knowledge.sources import LearningSourceRepository, MemoryScope, hash_body, to_primitive

NOW = datetime(2026, 9, 16, tzinfo=timezone.utc)


@pytest.fixture
def p():
    return importlib.import_module("packages.knowledge.patterns")


def setup(p, *, quality=True, source_type="code_selection", multi_locator=False):
    sources = LearningSourceRepository()
    context = sources.admit_host("human1", MemoryScope("u1", "project", "p1"), now=NOW, expires_at=NOW + timedelta(days=1))
    locator = {"repository_id": "repo1", "commit": "a" * 40, "paths": ["src/main.py"], "symbols": ["main"]}
    if multi_locator:
        locator["paths"].append("private/sibling.py")
        locator["symbols"].append("PrivateSibling")
    if source_type == "design_document":
        locator = {"document_id": "doc1", "revision": "r1"}
    elif source_type == "completed_run":
        locator = {"run_id": "run1", "revision": "r1"}
    body = "verified source artifact"
    source = dict(source_id="s1", version=1, source_type=source_type, locator=locator, body=body,
                  content_hash=hash_body(body), teaching_intent="safe retry", user_quality_label="exemplar", exclusions=["provider"])
    sources.authorize_capture(context, source, confidentiality="private", license_ref="internal-owned", license_status="APPROVED",
                              ownership="OWNED", quality_evidence=["quality1"] if quality else [], now=NOW)
    state = sources.register(context, source, expected_version=0, request_id="source", now=NOW)
    return p.PatternRepository(sources), sources, context, state


def payload(state, kind="CODE_PATTERN", **changes):
    if kind == "CODE_PATTERN":
        details = dict(intent="safe retry", languages=["python"], frameworks=["stdlib"], problem_signals=["transient failure"],
                       preconditions=["idempotent operation"], procedure=["bound retries", "record evidence"], tradeoffs=["latency"],
                       prohibitions=["unbounded retry"], failure_conditions=["budget exceeded"], verification_refs=["test1"], example_refs=[])
    elif kind == "EXAMPLE_REFERENCE":
        details = dict(purpose="retry example", excerpt_hash="c" * 64,
                       selector=dict(path="src/main.py", symbol="main", start_line=1, end_line=5))
    else:
        details = dict(failed_approach="unbounded retry", recurrence_conditions=["transient failure"], detection_signals=["repeated attempt"],
                       impact="budget loss", safer_alternative="bounded retry", verification_refs=["failure1"])
    result = dict(artifact_id="artifact1", version=1, kind=kind,
                  source_ref=dict(source_id=state.record.source_id, version=state.record.version, record_hash=state.record.record_hash),
                  risk="LOW", details=details)
    result.update(changes)
    return result


def evidence(state, **changes):
    result = dict(final_artifact_hash=state.record.content_hash, approved_artifact_hash=state.record.content_hash,
                  result="ACCEPTED", tests={"test1": "PASS"}, gates={"G0": "PASS", "G1": "PASS", "G2": "PASS", "G3": "PASS"},
                  origin="HUMAN_CURATED", independently_verified=True, verification_refs=["test1"], failure_refs=[])
    result.update(changes)
    return result


def attest(repo, context, data, proof, *, now=NOW):
    repo.attest(context, data, proof, now=now, expires_at=now + timedelta(hours=1))


def extract(repo, context, data, *, request="extract", expected=0, now=NOW):
    return repo.extract(context, data, expected_version=expected, request_id=request, now=now)


@pytest.mark.parametrize("source_type", ["code_selection", "design_document", "completed_run"])
def test_verified_sources_create_pattern_with_inherited_provenance(p, source_type):
    repo, sources, context, state = setup(p, source_type=source_type)
    data = payload(state)
    attest(repo, context, data, evidence(state))
    result = extract(repo, context, data)
    assert result.kind == "CODE_PATTERN" and result.provenance["license_ref"] == "internal-owned"
    assert result.provenance["scope"] == state.record.scope
    assert result.source_ref["record_hash"] == state.record.record_hash
    assert result.created_by == "human1" and result.previous_hash is None


@pytest.mark.parametrize("changes", [dict(result="FAILED"), dict(result="REJECTED"), dict(result="BLOCKED"),
    dict(result="ERROR"), dict(result="SKIPPED"), dict(tests={"test1": "SKIPPED"}), dict(gates={"G0": "PASS"}),
    dict(tests={}), dict(approved_artifact_hash="b" * 64), dict(final_artifact_hash="b" * 64),
    dict(origin="SELF_GENERATED", independently_verified=False)])
@pytest.mark.parametrize("kind", ["CODE_PATTERN", "EXAMPLE_REFERENCE"])
def test_unverified_failed_or_incomplete_evidence_cannot_create_positive(p, changes, kind):
    repo, _, context, state = setup(p)
    data = payload(state, kind)
    attest(repo, context, data, evidence(state, **changes))
    with pytest.raises(p.PatternError, match="POSITIVE_EVIDENCE_REQUIRED"):
        extract(repo, context, data)
    assert repo.search(context, {}, now=NOW) == ()


def test_unverified_source_only_allows_evidenced_antipattern_candidate(p):
    repo, _, context, state = setup(p, quality=False)
    positive = payload(state)
    attest(repo, context, positive, evidence(state))
    with pytest.raises(p.PatternError, match="POSITIVE_EVIDENCE_REQUIRED"):
        extract(repo, context, positive)
    negative = payload(state, "ANTI_PATTERN", artifact_id="anti1")
    attest(repo, context, negative, evidence(state, result="FAILED", failure_refs=["failure1"]))
    result = extract(repo, context, negative)
    assert result.kind == "ANTI_PATTERN" and result.candidate_only
    assert repo.search(context, {}, now=NOW) == ()
    assert len(repo.search(context, {"kind": "ANTI_PATTERN"}, now=NOW)) == 1


def reference_chain(repo, context, state):
    reference = payload(state, "EXAMPLE_REFERENCE", artifact_id="ref1")
    attest(repo, context, reference, evidence(state))
    created = extract(repo, context, reference, request="reference")
    pattern = payload(state)
    pattern["details"]["example_refs"] = [dict(artifact_id="ref1", version=1, record_hash=created.record_hash)]
    attest(repo, context, pattern, evidence(state))
    return extract(repo, context, pattern), created


def test_search_and_get_do_not_load_references_without_explicit_selected_pattern(p):
    repo, _, context, state = setup(p)
    pattern, reference = reference_chain(repo, context, state)
    found = repo.search(context, dict(intent="retry", language="python", framework="stdlib", risk="LOW"), now=NOW)
    assert len(found) == 1 and found[0].artifact_id == pattern.artifact_id
    assert "locator" not in str(to_primitive(found)) and "procedure" not in str(to_primitive(found))
    assert "locator" not in str(to_primitive(repo.get(context, "ref1", version=1, now=NOW)))
    loaded = repo.load_reference(context, pattern_ref=dict(artifact_id=pattern.artifact_id, version=1, record_hash=pattern.record_hash),
                                 reference_ref=dict(artifact_id="ref1", version=1, record_hash=reference.record_hash), now=NOW)
    assert loaded.details["locator"]["commit"] == "a" * 40 and loaded.details["excerpt_hash"] == "c" * 64
    assert "body" not in str(to_primitive(loaded))


@pytest.mark.parametrize("target", ["REVOKED", "QUARANTINED"])
def test_source_revocation_blocks_extract_search_get_and_reference_load(p, target):
    repo, sources, context, state = setup(p)
    pattern, reference = reference_chain(repo, context, state)
    sources.transition(context, "s1", target, "SECURITY_REVIEW", expected_version=1, request_id="revoke", now=NOW)
    assert repo.search(context, {}, now=NOW) == ()
    with pytest.raises(p.PatternError, match="LEARNING_SOURCE_REVOKED"):
        repo.get(context, pattern.artifact_id, version=1, now=NOW)
    with pytest.raises(p.PatternError, match="LEARNING_SOURCE_REVOKED"):
        repo.load_reference(context, pattern_ref=dict(artifact_id=pattern.artifact_id, version=1, record_hash=pattern.record_hash),
                            reference_ref=dict(artifact_id="ref1", version=1, record_hash=reference.record_hash), now=NOW)
    assert sources.history(context, "s1", now=NOW)[0].record_hash == state.record.record_hash


def test_canonical_order_alias_versions_replay_and_forged_authority(p):
    repo, _, context, state = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state))
    with pytest.raises(p.PatternError):
        extract(repo, context, dict(data, actor="self", approval="PASS"))
    first = extract(repo, context, data)
    saved_hash = first.record_hash
    object.__setattr__(first, "record_hash", "b" * 64)
    data["details"]["procedure"].append("tamper")
    assert repo.get(context, "artifact1", version=1, now=NOW).record_hash == saved_hash
    with pytest.raises(p.PatternError, match="REQUEST_REPLAY"):
        extract(repo, context, data)
    second = payload(state, version=2)
    attest(repo, context, second, evidence(state))
    result = extract(repo, context, second, request="second", expected=1)
    assert result.previous_hash == saved_hash


def test_concurrent_extract_creates_one_canonical_version(p):
    repo, _, context, state = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state))
    def attempt(index):
        try:
            return extract(repo, context, data, request="extract-" + str(index))
        except p.PatternError as error:
            return error.reason
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(attempt, range(8)))
    assert sum(not isinstance(x, str) for x in results) == 1
    assert results.count("PATTERN_VERSION_CONFLICT") == 7


def test_antipattern_evidence_still_binds_exact_source_artifact(p):
    repo, _, context, state = setup(p)
    data = payload(state, "ANTI_PATTERN")
    attest(repo, context, data, evidence(state, result="FAILED", failure_refs=["failure1"], final_artifact_hash="b" * 64))
    with pytest.raises(p.PatternError, match="PATTERN_EVIDENCE_TARGET_MISMATCH"):
        extract(repo, context, data)


@pytest.mark.parametrize("offset", [-1, 3600])
def test_attestation_half_open_validity_is_checked_before_extract(p, offset):
    repo, _, context, state = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state), now=NOW + timedelta(seconds=2))
    with pytest.raises(p.PatternError, match="STALE_PATTERN_ATTESTATION"):
        extract(repo, context, data, now=NOW + timedelta(seconds=2 + offset))
    assert extract(repo, context, data, now=NOW + timedelta(seconds=2)).version == 1


@pytest.mark.parametrize("field,value", [("record_hash", "b" * 64), ("version", 2), ("source_id", "other")])
def test_source_reference_cannot_be_relabelled(p, field, value):
    repo, _, context, state = setup(p)
    data = payload(state)
    data["source_ref"][field] = value
    with pytest.raises(p.PatternError):
        attest(repo, context, data, evidence(state))
    assert repo.search(context, {}, now=NOW) == ()


@pytest.mark.parametrize("change", [{"scope": "user"}, {"license_ref": "MIT"}, {"confidentiality": "public"}, {"quality": "VERIFIED"}])
def test_payload_cannot_relax_provenance(p, change):
    repo, _, context, state = setup(p)
    with pytest.raises(p.PatternError, match="INVALID_PATTERN_INPUT"):
        attest(repo, context, dict(payload(state), **change), evidence(state))


def test_foreign_forged_and_cross_scope_contexts_fail_closed(p):
    from packages.knowledge.sources import SourceHostContext
    repo, sources, context, state = setup(p)
    _, _, foreign, _ = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state))
    for caller in (foreign, SourceHostContext(context.context_id), object()):
        with pytest.raises(p.PatternError, match="SOURCE_HOST_AUTHORITY_REQUIRED"):
            extract(repo, caller, data)
    created = extract(repo, context, data)
    other = sources.admit_host("human1", MemoryScope("u1", "project", "p2"), now=NOW, expires_at=NOW + timedelta(days=1))
    assert repo.search(other, {}, now=NOW) == ()
    with pytest.raises(p.PatternError, match="PATTERN_NOT_FOUND"):
        repo.get(other, created.artifact_id, version=1, now=NOW)


def test_nonselected_reference_and_tampered_hash_cannot_load(p):
    repo, _, context, state = setup(p)
    pattern, reference = reference_chain(repo, context, state)
    pref = dict(artifact_id=pattern.artifact_id, version=1, record_hash=pattern.record_hash)
    rref = dict(artifact_id="ref1", version=1, record_hash=reference.record_hash)
    with pytest.raises(p.PatternError, match="PATTERN_REFERENCE_NOT_SELECTED"):
        repo.load_reference(context, pattern_ref=pref, reference_ref={**rref, "record_hash": "b" * 64}, now=NOW)
    data = payload(state, artifact_id="no-refs")
    attest(repo, context, data, evidence(state))
    other = extract(repo, context, data, request="other")
    with pytest.raises(p.PatternError, match="PATTERN_REFERENCE_NOT_SELECTED"):
        repo.load_reference(context, pattern_ref=dict(artifact_id=other.artifact_id, version=1, record_hash=other.record_hash), reference_ref=rref, now=NOW)


@pytest.mark.parametrize("selector", [dict(path="../private", symbol="main", start_line=1, end_line=5),
    dict(path="src/other.py", symbol="main", start_line=1, end_line=5), dict(path="src/main.py", symbol="other", start_line=1, end_line=5)])
def test_reference_selector_cannot_escape_source_locator(p, selector):
    repo, _, context, state = setup(p)
    data = payload(state, "EXAMPLE_REFERENCE")
    data["details"]["selector"] = selector
    attest(repo, context, data, evidence(state))
    with pytest.raises(p.PatternError, match="INVALID_REFERENCE_SELECTOR"):
        extract(repo, context, data)


def test_order_and_mutable_evidence_cannot_change_canonical_artifact(p):
    first, _, one, state = setup(p)
    second, _, two, other = setup(p)
    a, b = payload(state), payload(other)
    b = dict(reversed(list(b.items())))
    b["details"] = dict(reversed(list(b["details"].items())))
    proof = evidence(state)
    attest(first, one, a, proof)
    attest(second, two, b, evidence(other))
    proof["gates"]["G0"] = "FAILED"
    assert extract(first, one, a).record_hash == extract(second, two, b).record_hash


@pytest.mark.parametrize("version", [0, 3, True])
def test_version_gap_rollback_and_boolean_are_rejected(p, version):
    repo, _, context, state = setup(p)
    data = payload(state, version=version)
    with pytest.raises(p.PatternError):
        attest(repo, context, data, evidence(state))
        extract(repo, context, data)


@pytest.mark.parametrize("kind", ["CODE_PATTERN", "EXAMPLE_REFERENCE"])
def test_r1_positive_refs_must_name_actual_pass_evidence_keys(p, kind):
    repo, _, context, state = setup(p)
    data = payload(state, kind)
    attest(repo, context, data, evidence(state, tests={"unrelated-smoke": "PASS"}, verification_refs=["test1"]))
    with pytest.raises(p.PatternError, match="POSITIVE_EVIDENCE_REQUIRED"):
        extract(repo, context, data)
    assert repo.search(context, {}, now=NOW) == ()


def test_r1_attestation_can_renew_only_after_expiry_and_old_time_is_stale(p):
    repo, _, context, state = setup(p)
    data = payload(state)
    attest(repo, context, data, evidence(state, tests={"test1": "FAILED"}))
    with pytest.raises(p.PatternError, match="PATTERN_ATTESTATION_REBIND"):
        attest(repo, context, data, evidence(state), now=NOW + timedelta(seconds=1))
    renewal = NOW + timedelta(hours=1)
    attest(repo, context, data, evidence(state), now=renewal)
    with pytest.raises(p.PatternError, match="STALE_PATTERN_ATTESTATION"):
        extract(repo, context, data, now=NOW + timedelta(minutes=30))
    with pytest.raises(p.PatternError, match="STALE_PATTERN_ATTESTATION"):
        extract(repo, context, data, now=renewal + timedelta(hours=1))
    assert extract(repo, context, data, now=renewal).version == 1


def test_r1_selected_reference_never_retains_or_returns_private_siblings(p):
    repo, sources, context, state = setup(p, multi_locator=True)
    pattern, reference = reference_chain(repo, context, state)
    loaded = repo.load_reference(context, pattern_ref=dict(artifact_id=pattern.artifact_id, version=1, record_hash=pattern.record_hash),
                                 reference_ref=dict(artifact_id=reference.artifact_id, version=1, record_hash=reference.record_hash), now=NOW)
    locator = to_primitive(loaded.details["locator"])
    assert locator == {"repository_id": "repo1", "commit": "a" * 40, "paths": ["src/main.py"], "symbols": ["main"]}
    assert "sibling" not in str(to_primitive(loaded)).lower()
    assert "sibling" not in str(repo._records).lower()
    assert "private/sibling.py" in sources.get(context, "s1", now=NOW).record.locator["paths"]
