from datetime import datetime, timezone

import pytest

from packages.queue.dag import DagNode, TaskGraph
from packages.execution import RunStatus


NOW = datetime(2026, 9, 17, 12, tzinfo=timezone.utc)
HASH = 'sha256:' + 'a' * 64


def graph():
    return TaskGraph('graph', 'run', 'repo', (
        DagNode('a', (), (), True, HASH),
        DagNode('b', ('a',), (), True, HASH),
        DagNode('c', ('b',), (), True, HASH),
        DagNode('d', (), (), True, HASH),
    ))


def test_continue_blocks_transitive_descendants_not_independent_step():
    from packages.orchestration.exception_resolver import ExceptionResolver
    resolver = ExceptionResolver(); g = graph()
    resolver.register(g, expected_graph_hash=g.content_hash, policy='CONTINUE_INDEPENDENT',
                      policy_revision='p1', required_steps=('a', 'b', 'c', 'd'))
    resolver.record_exception(run_id='run', graph_hash=g.content_hash, exception_id='failure-a',
                              step_id='a', code='INDEPENDENT_FAILURE', evidence_hash=HASH,
                              occurred_at=NOW, reported_severe=False)
    projection = resolver.project('run')
    assert dict(projection.steps) == {'a': 'FAILED', 'b': 'BLOCKED_DEPENDENCY',
                                      'c': 'BLOCKED_DEPENDENCY', 'd': 'PENDING'}
    assert projection.ready_steps == ('d',) and projection.run_status is RunStatus.ACTIVE
    resolver.record_result(run_id='run', graph_hash=g.content_hash, result_id='result-d',
                           step_id='d', outcome='SUCCEEDED', evidence_kind='EXECUTED',
                           evidence_hash=HASH, occurred_at=NOW)
    assert resolver.project('run').run_status is RunStatus.FINISHED_WITH_FAILURES


@pytest.mark.parametrize('policy,want', [('STOP', RunStatus.FAILED),
                                      ('COLLECT_AND_REVIEW', RunStatus.AWAITING_EXCEPTION_REVIEW)])
def test_stop_and_collect_never_promote_partial_completion(policy, want):
    from packages.orchestration.exception_resolver import ExceptionResolver
    resolver = ExceptionResolver(); g = graph()
    resolver.register(g, expected_graph_hash=g.content_hash, policy=policy,
                      policy_revision='p1', required_steps=('a', 'b', 'c', 'd'))
    resolver.record_exception(run_id='run', graph_hash=g.content_hash, exception_id='failure-a',
                              step_id='a', code='IMPLEMENTATION_FAILURE', evidence_hash=HASH,
                              occurred_at=NOW)
    if policy == 'COLLECT_AND_REVIEW':
        assert resolver.project('run').run_status is RunStatus.ACTIVE
        resolver.record_result(run_id='run', graph_hash=g.content_hash, result_id='result-d',
                               step_id='d', outcome='SUCCEEDED', evidence_kind='EXECUTED',
                               evidence_hash=HASH, occurred_at=NOW)
    else:
        assert resolver.project('run').steps['d'] == 'BLOCKED_RUN_STOP'
    assert resolver.project('run').run_status is want


def registered(policy='CONTINUE_INDEPENDENT', g=None, required=None):
    from packages.orchestration.exception_resolver import ExceptionResolver
    resolver = ExceptionResolver(); g = g or graph()
    resolver.register(g, expected_graph_hash=g.content_hash, policy=policy,
                      policy_revision='p1', required_steps=required if required is not None else tuple(n.step_id for n in g.nodes))
    return resolver, g


def fail(resolver, g, **overrides):
    data = dict(run_id=g.run_id, graph_hash=g.content_hash, exception_id='failure-a',
                step_id='a', code='INDEPENDENT_FAILURE', evidence_hash=HASH,
                occurred_at=NOW, reported_severe=False)
    data.update(overrides)
    return resolver.record_exception(**data)


def succeed(resolver, g, step='d', **overrides):
    data = dict(run_id=g.run_id, graph_hash=g.content_hash, result_id='result-' + step,
                step_id=step, outcome='SUCCEEDED', evidence_kind='EXECUTED',
                evidence_hash=HASH, occurred_at=NOW)
    data.update(overrides)
    return resolver.record_result(**data)


@pytest.mark.parametrize('policy', ['STOP', 'CONTINUE_INDEPENDENT', 'COLLECT_AND_REVIEW'])
@pytest.mark.parametrize('code', ['SECRET_ACCESS', 'PROTECTED_PATH_WRITE', 'DESIGN_CHANGE',
                                 'DATA_CORRUPTION_RISK', 'BUDGET_HARD_LIMIT'])
def test_hard_stop_overrides_policy_and_low_severity(policy, code):
    resolver, g = registered(policy)
    receipt = fail(resolver, g, code=code)
    p = resolver.project('run')
    assert p.run_status is RunStatus.BLOCKED and p.ready_steps == ()
    assert dict(p.steps) == {'a': 'FAILED', 'b': 'BLOCKED_RUN_STOP',
                             'c': 'BLOCKED_RUN_STOP', 'd': 'BLOCKED_RUN_STOP'}
    assert p.inbox[0].code == code and p.inbox[0].hard_stop
    assert receipt.reason_code == 'HARD_STOP' and receipt.dispatch_count == 0


@pytest.mark.parametrize('policy', ['CONTINUE_INDEPENDENT', 'COLLECT_AND_REVIEW'])
def test_unrelated_unsafe_steps_are_run_stop_not_false_dependencies(policy):
    g = TaskGraph('graph', 'run', 'repo', (
        DagNode('a', (), ('shared',), True, HASH),
        DagNode('b', ('a',), (), True, HASH),
        DagNode('c', (), ('SHARED',), True, HASH),
        DagNode('d', (), (), False, HASH),
        DagNode('e', (), (), True, HASH)))
    resolver, g = registered(policy, g)
    fail(resolver, g)
    p = resolver.project('run')
    assert p.steps['b'] == 'BLOCKED_DEPENDENCY'
    assert p.steps['c'] == p.steps['d'] == 'BLOCKED_RUN_STOP'
    assert p.ready_steps == ('e',)


def test_inbox_exact_replay_and_conflict_are_append_only():
    resolver, g = registered()
    first = fail(resolver, g)
    before = resolver.project('run')
    assert fail(resolver, g) == first
    assert len(before.inbox) == len(resolver.project('run').inbox) == 1
    with pytest.raises(ValueError, match='REPLAY_CONFLICT'):
        fail(resolver, g, evidence_hash='sha256:' + 'b' * 64)
    assert resolver.project('run') == before
    assert first.fingerprint.startswith('sha256:')


@pytest.mark.parametrize('kwargs,reason', [
    ({'step_id': 'foreign'}, 'UNKNOWN_STEP'),
    ({'graph_hash': 'sha256:' + 'b'*64}, 'GRAPH_HASH_MISMATCH'),
    ({'run_id': 'foreign'}, 'UNKNOWN_RUN'),
    ({'code': 'made_up'}, 'UNKNOWN_EXCEPTION_CODE'),
    ({'code': 'QUOTA_EXHAUSTED'}, 'E08_NOT_IMPLEMENTED'),
    ({'occurred_at': NOW.replace(tzinfo=None)}, 'UTC_TIMESTAMP_REQUIRED'),
    ({'evidence_hash': 'raw-secret'}, 'INVALID_EVIDENCE_HASH'),
    ({'exception_id': []}, 'INVALID_EVENT_ID'),
    ({'reported_severe': 'false'}, 'INVALID_SEVERITY'),
])
def test_invalid_exception_has_zero_publication(kwargs, reason):
    resolver, g = registered(); before = resolver.project('run')
    with pytest.raises(ValueError, match=reason):
        fail(resolver, g, **kwargs)
    assert resolver.project('run') == before


@pytest.mark.parametrize('policy', ['unknown', '', None])
def test_unknown_policy_never_defaults(policy):
    with pytest.raises(ValueError, match='INVALID_POLICY'):
        registered(policy)


@pytest.mark.parametrize('required', [('unknown',), ('a', 'a'), ['a']])
def test_invalid_required_set_rejected(required):
    with pytest.raises(ValueError, match='INVALID_REQUIRED_STEPS'):
        registered(required=required)


def test_no_policy_or_graph_revision_rebind():
    resolver, g = registered()
    before = resolver.project('run')
    with pytest.raises(ValueError, match='RUN_REBIND'):
        resolver.register(g, expected_graph_hash=g.content_hash, policy='STOP',
                          policy_revision='p2', required_steps=('a',))
    assert resolver.project('run') == before


@pytest.mark.parametrize('kind', ['MOCK', 'FIXTURE', 'STATIC', 'BUILD', 'SKIPPED', 'BLOCKED'])
def test_non_execution_evidence_never_becomes_success(kind):
    g = TaskGraph('graph', 'run', 'repo', (DagNode('a', (), (), True, HASH),))
    resolver, g = registered(g=g)
    succeed(resolver, g, 'a', evidence_kind=kind)
    p = resolver.project('run')
    assert p.steps['a'] == 'UNVERIFIED'
    assert p.run_status is RunStatus.FINISHED_WITH_FAILURES


def test_dependencies_and_past_terminal_state_cannot_be_overwritten():
    resolver, g = registered()
    with pytest.raises(ValueError, match='STEP_NOT_READY'):
        succeed(resolver, g, 'b')
    fail(resolver, g)
    with pytest.raises(ValueError, match='STEP_TERMINAL'):
        succeed(resolver, g, 'a')
    with pytest.raises(ValueError, match='STEP_TERMINAL'):
        fail(resolver, g, exception_id='different')


@pytest.mark.parametrize('initial', ['SUCCEEDED', 'FAILED'])
def test_late_hard_evidence_always_blocks_without_overwriting_terminal_step(initial):
    resolver, g = registered()
    if initial == 'SUCCEEDED':
        succeed(resolver, g, 'a')
    else:
        fail(resolver, g)
    fail(resolver, g, exception_id='late-hard', code='SECRET_ACCESS')
    p = resolver.project('run')
    assert p.run_status is RunStatus.BLOCKED
    assert p.steps['a'] == initial
    assert p.inbox[-1].hard_stop
    assert not p.ready_steps


def test_public_exports_are_lazy_compatible():
    import packages.orchestration as package
    from packages.orchestration.exception_resolver import ExceptionResolver, FailurePolicy
    assert package.ExceptionResolver is ExceptionResolver
    assert package.FailurePolicy is FailurePolicy
    assert 'ExceptionResolver' in package.__all__


def test_returned_graph_inbox_events_receipts_are_detached():
    resolver, g = registered(); original_hash = g.content_hash
    object.__setattr__(g.nodes[0], 'dependency_ids', ('foreign',))
    receipt = fail(resolver, graph(), graph_hash=original_hash)
    before = resolver.project('run')
    p = resolver.project('run')
    with pytest.raises(TypeError):
        p.steps['a'] = 'SUCCEEDED'
    object.__setattr__(p.inbox[0], 'code', 'FAKE')
    object.__setattr__(p.events[0].receipt, 'reason_code', 'FAKE')
    object.__setattr__(receipt, 'run_status', RunStatus.SUCCEEDED)
    object.__setattr__(p, 'run_status', RunStatus.SUCCEEDED)
    assert resolver.project('run') == before
    assert fail(resolver, graph()).run_status is RunStatus.ACTIVE


def test_concurrent_duplicate_delivery_publishes_once():
    from concurrent.futures import ThreadPoolExecutor
    resolver, g = registered()
    with ThreadPoolExecutor(max_workers=12) as pool:
        receipts = list(pool.map(lambda _: fail(resolver, g), range(100)))
    assert all(r == receipts[0] for r in receipts)
    p = resolver.project('run')
    assert len(p.events) == len(p.inbox) == 1


@pytest.mark.parametrize('policy', ['STOP', 'CONTINUE_INDEPENDENT', 'COLLECT_AND_REVIEW'])
@pytest.mark.parametrize('required', [(), ('a',), ('a', 'b', 'c', 'd')])
def test_verified_all_steps_success_and_optional_failure_honesty(policy, required):
    resolver, g = registered(policy, required=required)
    for step in ('a', 'b', 'c', 'd'):
        succeed(resolver, g, step)
    assert resolver.project('run').run_status is RunStatus.SUCCEEDED
    resolver, g = registered(policy, required=required)
    fail(resolver, g)
    if policy != 'STOP':
        succeed(resolver, g)
    assert resolver.project('run').run_status is not RunStatus.SUCCEEDED


@pytest.mark.parametrize('outcome', ['FAILED', 'SKIPPED', 'UNVERIFIED', 'BLOCKED'])
def test_required_non_success_result_blocks_descendants_and_creates_inbox(outcome):
    resolver, g = registered()
    succeed(resolver, g, 'a', outcome=outcome)
    p = resolver.project('run')
    assert p.steps['a'] == outcome
    assert p.steps['b'] == p.steps['c'] == 'BLOCKED_DEPENDENCY'
    assert p.ready_steps == ('d',)
    assert len(p.inbox) == 1


def test_graph_and_internal_snapshot_tamper_rejected():
    from packages.orchestration.exception_resolver import ExceptionResolver
    resolver = ExceptionResolver(); g = graph()
    expected = g.content_hash
    object.__setattr__(g.nodes[0], 'dependency_ids', ('c',))
    with pytest.raises(ValueError, match='INVALID_GRAPH'):
        resolver.register(g, expected_graph_hash=expected, policy='STOP', policy_revision='p1', required_steps=('a',))
    resolver, g = registered()
    object.__setattr__(resolver._runs['run'].graph, 'repository_id', 'changed')
    with pytest.raises(ValueError, match='GRAPH_TAMPERED'):
        resolver.project('run')


def test_determinism_reordered_input_and_idempotent_result():
    from dataclasses import replace
    left, g = registered()
    right, _ = registered(g=replace(g, nodes=tuple(reversed(g.nodes))))
    assert fail(left, g) == fail(right, g)
    first = succeed(left, g)
    assert succeed(left, g) == first
    succeed(right, g)
    assert left.project('run') == right.project('run')
    assert left.project('run').content_hash.startswith('sha256:')


def test_publish_failure_is_atomic_and_retry_recovers(monkeypatch):
    resolver, g = registered(); before = resolver.project('run')
    original = resolver._project
    def fail_projection(state):
        if state.events:
            raise RuntimeError('synthetic-serialization-fault')
        return original(state)
    monkeypatch.setattr(resolver, '_project', fail_projection)
    with pytest.raises(RuntimeError, match='synthetic-serialization-fault'):
        fail(resolver, g)
    assert resolver.project('run') == before
    monkeypatch.setattr(resolver, '_project', original)
    fail(resolver, g)
    assert len(resolver.project('run').events) == 1


def test_past_timestamp_noop_and_revision_validation():
    from datetime import timedelta
    resolver, g = registered()
    fail(resolver, g); before = resolver.project('run')
    with pytest.raises(ValueError, match='PAST_EVENT'):
        succeed(resolver, g, occurred_at=NOW - timedelta(seconds=1))
    assert resolver.project('run') == before
    with pytest.raises(ValueError, match='INVALID_POLICY_REVISION'):
        resolver.register(g, expected_graph_hash=g.content_hash, policy='STOP', policy_revision='', required_steps=())


@pytest.mark.parametrize('key,value,reason', [('outcome', 'PASS', 'INVALID_OUTCOME'),
                                            ('evidence_kind', 'NATIVE_CLAIM', 'INVALID_EVIDENCE_KIND')])
def test_unknown_result_schema_rejected(key, value, reason):
    resolver, g = registered(); before = resolver.project('run')
    with pytest.raises(ValueError, match=reason):
        succeed(resolver, g, **{key: value})
    assert resolver.project('run') == before


def test_event_bound_and_graph_bound_fail_closed(monkeypatch):
    import packages.orchestration.exception_resolver as module
    resolver, g = registered()
    monkeypatch.setattr(module, 'MAX_EVENTS', 1)
    fail(resolver, g); before = resolver.project('run')
    assert fail(resolver, g).sequence == 1
    with pytest.raises(ValueError, match='INBOX_LIMIT_EXCEEDED'):
        succeed(resolver, g)
    assert resolver.project('run') == before
    monkeypatch.setattr(module, 'MAX_NODES', 1)
    with pytest.raises(ValueError, match='GRAPH_LIMIT_EXCEEDED'):
        registered()


@pytest.mark.parametrize('policy', ['STOP', 'CONTINUE_INDEPENDENT', 'COLLECT_AND_REVIEW'])
@pytest.mark.parametrize('code', ['SECRET_ACCESS', 'PROTECTED_PATH_WRITE', 'DESIGN_CHANGE',
                                 'DATA_CORRUPTION_RISK', 'BUDGET_HARD_LIMIT'])
def test_old_hard_evidence_appends_by_arrival_without_rewinding_ordinary_clock(policy, code):
    from datetime import timedelta
    resolver, g = registered(policy)
    succeed(resolver, g, 'a', occurred_at=NOW)
    succeed(resolver, g, 'd', occurred_at=NOW + timedelta(seconds=10))
    before = resolver.project('run')
    receipt = fail(resolver, g, exception_id='late-safety', code=code, occurred_at=NOW)
    p = resolver.project('run')
    assert p.run_status is RunStatus.BLOCKED and p.ready_steps == ()
    assert dict(p.steps) == {'a': 'SUCCEEDED', 'b': 'BLOCKED_RUN_STOP',
                             'c': 'BLOCKED_RUN_STOP', 'd': 'SUCCEEDED'}
    assert p.events[:2] == before.events
    assert p.events[-1].sequence == p.inbox[-1].sequence == 3
    assert p.events[-1].occurred_at == p.inbox[-1].occurred_at == NOW
    assert fail(resolver, g, exception_id='late-safety', code=code, occurred_at=NOW) == receipt
    with pytest.raises(ValueError, match='REPLAY_CONFLICT'):
        fail(resolver, g, exception_id='late-safety', code=code, occurred_at=NOW + timedelta(seconds=1))
    with pytest.raises(ValueError, match='PAST_EVENT'):
        succeed(resolver, g, 'b', occurred_at=NOW + timedelta(seconds=1))
    assert resolver.project('run') == p


def test_delayed_safety_publication_fault_restores_then_retry_blocks(monkeypatch):
    from datetime import timedelta
    resolver, g = registered()
    succeed(resolver, g, 'a')
    succeed(resolver, g, 'd', occurred_at=NOW + timedelta(seconds=10))
    before = resolver.project('run'); original = resolver._project
    def broken_projection(state):
        if len(state.events) == 3:
            raise RuntimeError('late-safety-publication-fault')
        return original(state)
    monkeypatch.setattr(resolver, '_project', broken_projection)
    with pytest.raises(RuntimeError, match='late-safety-publication-fault'):
        fail(resolver, g, code='SECRET_ACCESS')
    assert resolver.project('run') == before
    monkeypatch.setattr(resolver, '_project', original)
    fail(resolver, g, code='SECRET_ACCESS')
    assert resolver.project('run').run_status is RunStatus.BLOCKED


@pytest.mark.parametrize('mode', ['exception', 'result'])
def test_mutable_custom_timezone_is_rejected_without_calling_it(mode):
    from datetime import tzinfo, timedelta
    class MutableZone(tzinfo):
        def __init__(self):
            self.hours = 0
            self.calls = 0
        def utcoffset(self, value):
            self.calls += 1
            return timedelta(hours=self.hours)
    zone = MutableZone()
    supplied = datetime(2026, 9, 17, 12, tzinfo=zone)
    resolver, g = registered(); before = resolver.project('run')
    with pytest.raises(ValueError, match='UTC_TIMESTAMP_REQUIRED'):
        if mode == 'exception':
            fail(resolver, g, occurred_at=supplied)
        else:
            succeed(resolver, g, occurred_at=supplied)
    zone.hours = 1
    assert zone.calls == 0
    assert resolver.project('run') == before


def test_builtin_utc_value_is_copied_and_canonicalized_not_caller_alias():
    from datetime import timedelta
    supplied = datetime(2026, 9, 17, 12, tzinfo=timezone(timedelta(0), 'custom-name'))
    resolver, g = registered()
    fail(resolver, g, occurred_at=supplied)
    event = resolver.project('run').events[0]
    assert event.occurred_at == supplied
    assert event.occurred_at.tzinfo is timezone.utc
    assert event.occurred_at is not supplied


@pytest.mark.parametrize('kind', ['subclass', 'naive', 'non-utc'])
def test_untrusted_timestamp_types_and_non_utc_remain_rejected(kind):
    from datetime import timedelta
    class DateSubclass(datetime):
        pass
    supplied = {'subclass': DateSubclass(2026, 9, 17, 12, tzinfo=timezone.utc),
                'naive': NOW.replace(tzinfo=None),
                'non-utc': NOW.replace(tzinfo=timezone(timedelta(hours=9)))}[kind]
    resolver, g = registered(); before = resolver.project('run')
    with pytest.raises(ValueError, match='UTC_TIMESTAMP_REQUIRED'):
        fail(resolver, g, occurred_at=supplied)
    assert resolver.project('run') == before
