"""E08 uses real B10/D11 owners; sender is an explicit host fixture, not network."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
import importlib

import pytest

from packages.budget import BudgetLimit, BudgetRequest, BudgetService, UsageReceipt
from packages.persistence.intervention_budget_repository import InMemoryInterventionBudgetRepository


def budget(cost='10', tokens=1000, concurrency=10):
    repository = InMemoryInterventionBudgetRepository()
    service = BudgetService(repository)
    service.create_budget(BudgetLimit('budget', Decimal(cost), tokens, concurrency))
    return service


def request(identity='one', cost='1', tokens=100):
    return BudgetRequest('reservation-' + identity, 'budget', 'run', 'step', 'request-' + identity,
                         'openai', 'model-a', 'price-v1', Decimal(cost), tokens)


def test_reserve_before_send_and_final_usage_releases_only_remainder():
    from packages.budget.models import ProviderOutcome
    service = budget(); seen = []
    def sender(req):
        seen.append(service.reservation(req.reservation_id).reserved_cost)
        return ProviderOutcome(req.request_id, req.provider, req.model, 'COMPLETED',
                               Decimal('.4'), 40, 'PROVIDER_FINAL', None, 'bucket', None)
    result = service.dispatch(request(), admission_hash='sha256:' + 'a'*64, sender=sender)
    assert seen == [Decimal('1')]
    assert result.status == 'FINALIZED' and result.send_count == 1
    assert result.reconciliation.consumed_cost == Decimal('.4')
    assert result.reconciliation.released_cost == Decimal('.6')
    assert service.snapshot('budget').reserved_cost == 0


def test_unknown_abort_usage_retains_reservation_and_metadata():
    from packages.budget.models import ProviderOutcome, ReservationStatus
    service = budget()
    result = service.dispatch(request(), admission_hash='sha256:' + 'a'*64,
        sender=lambda req: ProviderOutcome(req.request_id, req.provider, req.model, 'CLIENT_DISCONNECTED',
                                          None, None, 'UNKNOWN', '30', 'bucket', None))
    assert result.status == 'USAGE_RECONCILIATION_REQUIRED'
    assert result.usage.actual_cost is None and result.usage.retry_after == '30'
    assert service.reservation('reservation-one').status is ReservationStatus.RECONCILIATION_REQUIRED
    assert service.snapshot('budget').reserved_cost == Decimal('1')


def test_hard_limit_100_way_sends_only_successful_reservations():
    from packages.budget.models import ProviderOutcome
    service = budget(cost='3', tokens=300, concurrency=3); sent = []
    def run(index):
        return service.dispatch(request(str(index)), admission_hash='sha256:' + 'a'*64,
            sender=lambda req: (sent.append(req.request_id), ProviderOutcome(req.request_id, req.provider,
                req.model, 'ABORT_PENDING', None, None, 'UNKNOWN', None, None, None))[1])
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(run, range(100)))
    assert len(sent) == sum(r.send_count for r in results) == 3
    assert sum(r.status == 'PAUSED_QUOTA' for r in results) == 97
    assert service.snapshot('budget').reserved_cost == Decimal('3')


def routed(fallback=False):
    from tests.knowledge.test_model_registry_d11 import ready, activate, guard, NOW
    from packages.budget.routing import CapabilityBudgetRouter
    module = importlib.import_module('packages.knowledge.model_registry')
    registry, ctx, _, _, snaps, prompt, model, bench, candidate = ready(module)
    if fallback:
        from tests.knowledge.test_model_registry_d11 import publish_model, model_data, benchmark, bench_data, route_data
        other = publish_model(registry, ctx, model_data(id='model2', model_id='model-b', upstream_model='model-b'))
        data = bench_data(prompt, other); data['id'] = 'benchmark-fallback'
        other_bench = benchmark(registry, ctx, data)
        data = route_data(prompt, model, bench, 'with-fallback')
        replacement = route_data(prompt, other, other_bench)['routes'][0]
        data['routes'][0]['fallback']['targets'] = [{k: replacement[k] for k in ('prompt', 'model', 'benchmark', 'requirements')}]
        candidate = registry.create_routing(ctx, data, now=NOW)
    activate(registry, ctx, candidate)
    _, snap = guard(registry, ctx, snaps)
    service = budget()
    router = CapabilityBudgetRouter(service, registry, ctx)
    now = NOW + timedelta(seconds=1)
    pin = router.pin(snap, now=now, approval_expires_at=NOW + timedelta(minutes=20))
    return router, pin, service, registry, ctx, now


def route_request(pin, **changes):
    from packages.budget.routing import RoutedRequest
    data = dict(pin_hash=pin.content_hash, budget_id='budget', step_id='step', request_id='route-request',
                reservation_id='route-reservation', role='developer', input_tokens=100, output_tokens=200, tool_loops=2)
    data.update(changes)
    return RoutedRequest(**data)


def provider_result(req, **changes):
    from packages.budget.models import ProviderOutcome
    data = dict(request_id=req.request_id, provider=req.provider, model=req.model, abort_status='COMPLETED',
                actual_cost=Decimal('.0003'), actual_tokens=100, provenance='PROVIDER_FINAL',
                retry_after=None, rate_bucket='bucket', failure_code=None)
    data.update(changes)
    return ProviderOutcome(**data)


def test_d11_pinned_route_derives_bound_maximum_forecast():
    router, pin, service, _, _, now = routed()
    sent = []
    def sender(req):
        sent.append(req)
        return provider_result(req)
    result = router.send(route_request(pin), now=now, sender=sender)
    assert len(sent) == 1 and sent[0].provider == 'openai' and sent[0].model == 'model-a'
    assert sent[0].forecast_cost == Decimal('.001') and sent[0].forecast_tokens == 600
    assert result.dispatch.status == 'FINALIZED'
    assert result.activation_hash == pin.activation_hash and result.approval_hash == pin.approval_hash
    assert result.pricing_version == sent[0].pricing_version


def test_only_approved_observed_trigger_can_select_equivalent_fallback():
    router, pin, _, _, _, now = routed(fallback=True)
    first = router.send(route_request(pin), now=now,
                        sender=lambda req: provider_result(req, failure_code='TIMEOUT'))
    second = router.send(route_request(pin, request_id='retry', reservation_id='retry-reservation'),
                         now=now, sender=provider_result, fallback_from='route-request')
    assert first.dispatch.request.model == 'model-a'
    assert second.dispatch.request.model == 'model-b'
    assert second.fallback_from == 'route-request'


@pytest.mark.parametrize('failure', [None, 'QUOTA_EXHAUSTED', 'HARD_LIMIT', 'APPROVAL_EXPIRED',
                                     'CAPABILITY_DRIFT', 'UNKNOWN', 'PRIVACY_MISMATCH'])
def test_forbidden_fallback_sends_zero(failure):
    router, pin, _, _, _, now = routed(fallback=True)
    router.send(route_request(pin), now=now, sender=lambda req: provider_result(req, failure_code=failure))
    sent = []
    with pytest.raises(ValueError, match='FALLBACK_NOT_APPROVED'):
        router.send(route_request(pin, request_id='retry', reservation_id='retry-reservation'),
                    now=now, sender=lambda req: sent.append(req), fallback_from='route-request')
    assert sent == []


def test_expired_approval_and_context_overflow_send_zero():
    router, pin, _, _, _, now = routed()
    sent = []
    with pytest.raises(ValueError, match='APPROVAL_EXPIRED'):
        router.send(route_request(pin), now=now + timedelta(minutes=21), sender=sent.append)
    with pytest.raises(ValueError, match='CONTEXT_LIMIT'):
        router.send(route_request(pin, input_tokens=9000), now=now, sender=sent.append)
    assert sent == []


def test_two_services_share_100_way_send_once_and_replay_conflict():
    from dataclasses import replace
    from packages.budget.models import ProviderOutcome
    service = budget(); other = BudgetService(service._repository); sent = []
    def run(index):
        return (service if index % 2 else other).dispatch(request(), admission_hash='sha256:'+'a'*64,
            sender=lambda req: (sent.append(req.request_id), provider_result(req, actual_cost=Decimal('.4')))[1])
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(run, range(100)))
    assert len(sent) == 1
    assert all(r.status in {'SEND_STARTED', 'FINALIZED'} for r in results)
    assert run(0).status == 'FINALIZED'
    with pytest.raises(ValueError, match='REQUEST_IDENTITY_CONFLICT'):
        other.dispatch(replace(request(), forecast_tokens=101), admission_hash='sha256:'+'a'*64, sender=sent.append)
    with pytest.raises(ValueError, match='RESERVATION_IDENTITY_CONFLICT'):
        other.dispatch(replace(request('other'), reservation_id='reservation-one'), admission_hash='sha256:'+'a'*64, sender=sent.append)
    assert len(sent) == 1


@pytest.mark.parametrize('amount', ['NaN', 'sNaN', 'Infinity', '-Infinity'])
def test_nonfinite_forecast_rejected_as_value_error(amount):
    with pytest.raises(ValueError):
        request(cost=amount)


def test_legacy_send_entry_cannot_bypass_shared_request_identity():
    service = budget(); other = BudgetService(service._repository); sent = []
    first = service.reserve_and_send(request(), lambda identity: sent.append(identity) or 'provider-ref')
    assert other.reserve_and_send(request(), lambda identity: sent.append(identity)) == first
    assert sent == ['request-one']
    with pytest.raises(ValueError):
        other.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sent.append)
    assert sent == ['request-one']


def test_pre_send_guard_failure_proves_zero_sends_and_retains_safe_exposure():
    service = budget(); sent = []
    def guard():
        raise ValueError('synthetic-guard-failure')
    result = service.dispatch(request(), admission_hash='sha256:'+'a'*64,
                              sender=sent.append, pre_send=guard)
    assert result.status == 'BLOCKED_BEFORE_SEND' and result.send_count == 0
    assert sent == []
    assert service.dispatch(request(), admission_hash='sha256:'+'a'*64,
                            sender=sent.append, pre_send=guard) == result


def test_reservation_reconcile_during_pre_send_guard_cannot_send():
    service = budget(); sent = []
    def guard():
        service.reconcile(UsageReceipt('foreign-usage', 'reservation-one', 'request-one', 'COMPLETED',
                                       Decimal('0'), 0, None, None, 'provider_final_usage'))
    result = service.dispatch(request(), admission_hash='sha256:'+'a'*64,
                              sender=sent.append, pre_send=guard)
    assert result.status == 'BLOCKED_BEFORE_SEND' and sent == []


def test_provider_quota_records_pause_and_does_not_zero_unknown_cost():
    service = budget()
    result = service.dispatch(request(), admission_hash='sha256:'+'a'*64,
        checkpoint_ref='checkpoint-exact', reset_hint='tomorrow',
        sender=lambda req: provider_result(req, actual_cost=None, actual_tokens=None,
                                           provenance='UNKNOWN', retry_after='40', failure_code='QUOTA_EXHAUSTED'))
    assert result.status == 'PAUSED_QUOTA'
    assert result.pause.checkpoint_ref == 'checkpoint-exact'
    assert result.pause.incomplete_step_id == 'step' and result.pause.reset_hint == 'tomorrow'
    assert result.usage.actual_cost is None and result.usage.retry_after == '40'
    assert service.snapshot('budget').reserved_cost == 1


@pytest.mark.parametrize('abort', ['ABORT_PENDING', 'ABORT_CONFIRMED', 'CLIENT_DISCONNECTED', 'UNKNOWN'])
def test_abort_then_authoritative_final_retains_metadata_and_consumes_actual(abort):
    service = budget()
    first = service.dispatch(request(), admission_hash='sha256:'+'a'*64,
        sender=lambda req: provider_result(req, abort_status=abort, actual_cost=None, actual_tokens=None, provenance='UNKNOWN'))
    assert first.status == 'USAGE_RECONCILIATION_REQUIRED'
    final = provider_result(request(), abort_status=abort, actual_cost=Decimal('.6'), actual_tokens=60, retry_after='30')
    result = service.finalize('request-one', final)
    assert result.status == 'FINALIZED'
    assert result.usage.abort_status == abort and result.usage.retry_after == '30'
    assert result.reconciliation.released_cost == Decimal('.4')
    assert service.finalize('request-one', final) == result
    with pytest.raises(ValueError, match='FINAL_USAGE_CONFLICT'):
        service.finalize('request-one', provider_result(request(), actual_cost=Decimal('0')))


@pytest.mark.parametrize('changes,expected_cost,expected_tokens', [
    (dict(actual_cost=None), None, 100), (dict(actual_tokens=None), Decimal('.0003'), None),
    (dict(provenance='UNKNOWN', actual_cost=Decimal('0'), actual_tokens=0), None, None),
    (dict(provenance='ESTIMATED'), None, None)])
def test_partial_or_untrusted_usage_is_not_zero(changes, expected_cost, expected_tokens):
    from packages.budget.models import ReservationStatus
    service = budget()
    result = service.dispatch(request(), admission_hash='sha256:'+'a'*64,
                              sender=lambda req: provider_result(req, **changes))
    assert result.status == 'USAGE_RECONCILIATION_REQUIRED'
    assert result.usage.actual_cost == expected_cost and result.usage.actual_tokens == expected_tokens
    assert service.reservation('reservation-one').status is ReservationStatus.RECONCILIATION_REQUIRED
    assert service.snapshot('budget').reserved_cost == 1


def test_abort_before_send_has_no_reservation_no_send_and_no_retry_side_effect():
    service = budget(); sent = []
    result = service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sent.append, abort_before_send=True)
    assert result.status == 'ABORTED_BEFORE_SEND' and result.send_count == 0
    assert service.snapshot('budget').reserved_cost == 0
    assert service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sent.append, abort_before_send=True) == result
    assert sent == []


def test_sender_exception_or_malformed_identity_never_refunds_or_resends():
    service = budget(); sent = []
    def sender(req):
        sent.append(req.request_id)
        raise RuntimeError('DO_NOT_LEAK_EXCEPTION')
    first = service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sender)
    assert first.status == 'USAGE_RECONCILIATION_REQUIRED' and first.send_count == 1
    assert service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sender) == first
    assert len(sent) == 1 and 'DO_NOT_LEAK_EXCEPTION' not in repr(first)
    second = service.dispatch(request('two'), admission_hash='sha256:'+'a'*64,
                              sender=lambda req: provider_result(req, request_id='foreign'))
    assert second.status == 'USAGE_RECONCILIATION_REQUIRED'
    assert service.snapshot('budget').reserved_cost == 2


def test_sender_callback_is_outside_shared_and_repository_locks():
    service = budget(); other = BudgetService(service._repository)
    def sender(req):
        with ThreadPoolExecutor(max_workers=1) as pool:
            duplicate = pool.submit(other.dispatch, request(), admission_hash='sha256:'+'a'*64,
                                    sender=lambda _: pytest.fail('duplicate-send')).result(timeout=3)
        assert duplicate.status == 'SEND_STARTED'
        assert service.snapshot('budget').reserved_cost == 1
        return provider_result(req)
    assert service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sender).status == 'FINALIZED'


def test_atomic_reservation_and_final_publication_failure_recover(monkeypatch):
    import packages.budget.service as module
    service = budget(); owner = service._repository; original = owner.reserve
    def broken(req):
        original(req)
        raise RuntimeError('after-reserve')
    monkeypatch.setattr(owner, 'reserve', broken)
    sent = []
    with pytest.raises(RuntimeError, match='after-reserve'):
        service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sent.append)
    assert sent == [] and service.snapshot('budget').reserved_cost == 0
    monkeypatch.setattr(owner, 'reserve', original)
    copy = module.deepcopy
    def bad_copy(value):
        if getattr(value, 'status', None) == 'FINALIZED':
            raise RuntimeError('after-reconcile')
        return copy(value)
    monkeypatch.setattr(module, 'deepcopy', bad_copy)
    with pytest.raises(RuntimeError, match='after-reconcile'):
        service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=provider_result)
    assert service.snapshot('budget').reserved_cost == 1
    monkeypatch.setattr(module, 'deepcopy', copy)
    assert service.finalize('request-one', provider_result(request())).status == 'FINALIZED'


def test_returned_records_and_pin_cannot_mutate_canonical_state():
    service = budget()
    result = service.dispatch(request(), admission_hash='sha256:'+'a'*64, sender=provider_result)
    before = service.dispatch_receipt('request-one')
    object.__setattr__(result.request, 'request_id', 'foreign')
    object.__setattr__(result.reservation, 'reserved_cost', Decimal('0'))
    object.__setattr__(result.usage, 'actual_cost', Decimal('0'))
    assert service.dispatch_receipt('request-one') == before
    router, pin, _, _, _, now = routed()
    original = pin.content_hash
    object.__setattr__(pin, 'expires_at', now - timedelta(seconds=1))
    assert router.send(route_request(pin, pin_hash=original), now=now, sender=provider_result).dispatch.status == 'FINALIZED'


def test_additive_public_exports():
    import packages.budget as package
    from packages.budget.routing import CapabilityBudgetRouter, RoutedRequest
    assert package.CapabilityBudgetRouter is CapabilityBudgetRouter
    assert package.RoutedRequest is RoutedRequest
    assert 'ProviderOutcome' in package.__all__


@pytest.mark.parametrize('field', ['provider', 'request_id', 'provenance', 'abort_status'])
def test_outcome_custom_string_cannot_run_callbacks_under_owner_lock(field):
    class Tricky(str):
        def __eq__(self, other):
            raise AssertionError('untrusted-string-callback')
        def strip(self):
            raise AssertionError('untrusted-string-callback')
    service = budget()
    service.dispatch(request(), admission_hash='sha256:'+'a'*64,
                     sender=lambda req: provider_result(req, actual_cost=None))
    values = {'provider': 'openai', 'request_id': 'request-one', 'provenance': 'PROVIDER_FINAL', 'abort_status': 'COMPLETED'}
    with pytest.raises(ValueError, match='INVALID_PROVIDER_OUTCOME'):
        service.finalize('request-one', provider_result(request(), **{field: Tricky(values[field])}))
    assert service.snapshot('budget').reserved_cost == 1


def test_approval_pin_rebind_and_foreign_pin_are_rejected():
    router, pin, _, registry, ctx, now = routed()
    selection = registry.query(ctx, now=now)['runs'][pin.run_id]
    with pytest.raises(ValueError, match='PIN_REBIND'):
        router.pin(dict(selection['snapshot_ref']), now=now, approval_expires_at=now + timedelta(hours=1))
    foreign, _, _, _, _, _ = routed()
    # Same fixture data is deliberately identical; remove its host-issued pin.
    from packages.budget.routing import CapabilityBudgetRouter
    empty = CapabilityBudgetRouter(router._budgets, registry, ctx)
    with pytest.raises(ValueError, match='UNKNOWN_PIN'):
        empty.send(route_request(pin), now=now, sender=provider_result)


def test_new_model_revision_quarantines_pinned_route_before_send():
    from tests.knowledge.test_model_registry_d11 import publish_model, model_data
    router, pin, _, registry, ctx, now = routed()
    publish_model(registry, ctx, model_data(version=2, capabilities=['text']), now=now)
    sent = []
    with pytest.raises(ValueError, match='BLOCKED_CAPABILITY_DRIFT'):
        router.send(route_request(pin), now=now, sender=sent.append)
    assert sent == []


def test_route_drift_after_reserve_blocks_actual_sender(monkeypatch):
    from tests.knowledge.test_model_registry_d11 import publish_model, model_data
    router, pin, service, registry, ctx, now = routed()
    original = service._repository.reserve
    def change_after_reservation(req):
        result = original(req)
        publish_model(registry, ctx, model_data(version=2, capabilities=['text']), now=now)
        return result
    monkeypatch.setattr(service._repository, 'reserve', change_after_reservation)
    sent = []
    result = router.send(route_request(pin), now=now, sender=sent.append)
    assert sent == [] and result.dispatch.send_count == 0
    assert result.dispatch.status == 'BLOCKED_BEFORE_SEND'


def test_approved_set_does_not_allow_more_expensive_fallback():
    from packages.knowledge.memory import _hash, to_primitive
    from tests.knowledge.test_model_registry_d11 import ready, publish_model, model_data, benchmark, bench_data, route_data, activate, guard, NOW
    from packages.budget.routing import CapabilityBudgetRouter
    registry, ctx, _, _, snaps, prompt, model, bench, _ = ready(importlib.import_module('packages.knowledge.model_registry'))
    other = publish_model(registry, ctx, model_data(id='model2', model_id='model-b', upstream_model='model-b',
                           pricing=dict(currency='USD', unit='PER_MILLION_TOKENS', input='2', output='3')))
    data = bench_data(prompt, other); data['id'] = 'other-benchmark'
    other_bench = benchmark(registry, ctx, data)
    data = route_data(prompt, model, bench, 'expensive-fallback')
    item = route_data(prompt, other, other_bench)['routes'][0]
    data['routes'][0]['fallback']['targets'] = [{k: item[k] for k in ('prompt', 'model', 'benchmark', 'requirements')}]
    candidate = registry.create_routing(ctx, data, now=NOW); activate(registry, ctx, candidate)
    _, snap = guard(registry, ctx, snaps); now = NOW + timedelta(seconds=1)
    router = CapabilityBudgetRouter(budget(), registry, ctx)
    pin = router.pin(snap, now=now, approval_expires_at=NOW + timedelta(minutes=10))
    router.send(route_request(pin), now=now, sender=lambda req: provider_result(req, failure_code='TIMEOUT'))
    sent = []
    with pytest.raises(ValueError, match='FALLBACK_NOT_EQUIVALENT'):
        router.send(route_request(pin, request_id='retry', reservation_id='retry-res'), now=now,
                    sender=sent.append, fallback_from='route-request')
    assert sent == []


@pytest.mark.parametrize('override', [dict(role='attacker'), dict(tool_loops=0), dict(input_tokens=True),
                                     dict(output_tokens=-1), dict(pin_hash='foreign'), dict(request_id=[])])
def test_invalid_route_admission_is_send_zero(override):
    router, pin, _, _, _, now = routed(); sent = []
    with pytest.raises(ValueError):
        router.send(route_request(pin, **override), now=now, sender=sent.append)
    assert sent == []


def test_forecast_maximum_hard_limit_pauses_with_checkpoint():
    router, pin, service, _, _, now = routed(); sent = []
    result = router.send(route_request(pin, tool_loops=100), now=now, sender=sent.append,
                         checkpoint_ref='checkpoint-route', reset_hint='later')
    assert result.dispatch.status == 'PAUSED_QUOTA'
    assert result.dispatch.pause.checkpoint_ref == 'checkpoint-route'
    assert result.dispatch.pause.reset_hint == 'later'
    assert sent == [] and service.snapshot('budget').reserved_tokens == 0


@pytest.mark.parametrize('entry', ['reserve', 'reservation', 'dispatch', 'dispatch_receipt', 'legacy'])
def test_r1_public_reservation_cannot_reduce_canonical_exposure(entry):
    service = budget(cost='1'); req = request(); sent = []
    if entry == 'reserve':
        exposed = service.reserve(req)
    elif entry == 'legacy':
        exposed = service.reserve_and_send(req, lambda _: 'provider-ref')
    else:
        result = service.dispatch(req, admission_hash='sha256:'+'a'*64,
            sender=lambda req: provider_result(req, actual_cost=None, actual_tokens=None))
        exposed = (service.reservation(req.reservation_id) if entry == 'reservation' else
                   service.dispatch_receipt(req.request_id).reservation if entry == 'dispatch_receipt' else result.reservation)
    before = service.snapshot('budget')
    object.__setattr__(exposed, 'reserved_cost', Decimal('0'))
    object.__setattr__(exposed, 'reserved_tokens', 0)
    assert service.snapshot('budget') == before
    assert service.reservation(req.reservation_id).reserved_cost == Decimal('1')
    denied = service.dispatch(request('second'), admission_hash='sha256:'+'a'*64, sender=sent.append)
    assert denied.status == 'PAUSED_QUOTA' and denied.send_count == 0 and sent == []


def test_r1_input_limit_and_usage_aliases_cannot_rewrite_owner():
    service = BudgetService(InMemoryInterventionBudgetRepository())
    limit = BudgetLimit('budget', Decimal('1'), 1000, 10)
    service.create_budget(limit)
    object.__setattr__(limit, 'hard_cost_limit', Decimal('99'))
    assert service.snapshot('budget').hard_cost_limit == Decimal('1')
    service.reserve(request())
    receipt = UsageReceipt('final', 'reservation-one', 'request-one', 'COMPLETED', Decimal('.4'), 40, None, None, 'provider_final_usage')
    published = service.reconcile(receipt)
    object.__setattr__(receipt, 'actual_cost', Decimal('0'))
    object.__setattr__(published, 'consumed_cost', Decimal('0'))
    replay = service.reconcile(UsageReceipt('final', 'reservation-one', 'request-one', 'COMPLETED', Decimal('.4'), 40, None, None, 'provider_final_usage'))
    assert replay.consumed_cost == Decimal('.4')


@pytest.mark.parametrize('amount,tokens', [('3', 50), ('.5', 1100)])
def test_r1_known_overforecast_pauses_and_preserves_actual_replay(amount, tokens):
    from packages.budget.models import ReservationStatus
    service = budget(cost='2'); sent = []; req = request()
    outcome = provider_result(req, actual_cost=Decimal(amount), actual_tokens=tokens)
    result = service.dispatch(req, admission_hash='sha256:'+'a'*64, sender=lambda _: outcome)
    assert result.status == 'PAUSED_QUOTA'
    assert result.failure_code == 'ACTUAL_USAGE_EXCEEDS_FORECAST'
    assert result.pause.next_safe_action == 'RECONCILE_ACTUAL_USAGE_AND_APPROVED_BUDGET'
    assert result.usage.actual_cost == Decimal(amount) and result.usage.actual_tokens == tokens
    assert result.usage.provenance == 'PROVIDER_FINAL'
    assert result.reservation.status is ReservationStatus.RECONCILIATION_REQUIRED
    assert service.snapshot('budget').new_action_allowed is False
    assert service.finalize(req.request_id, outcome) == result
    with pytest.raises(ValueError, match='FINAL_USAGE_CONFLICT'):
        service.finalize(req.request_id, provider_result(req))
    assert service.dispatch(request('next'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []


def test_r1_overforecast_publication_failure_restores_then_retry_pauses(monkeypatch):
    import packages.budget.service as module
    service = budget(cost='2'); req = request(); original = module.deepcopy
    def fail(value):
        if getattr(value, 'failure_code', None) == 'ACTUAL_USAGE_EXCEEDS_FORECAST':
            raise RuntimeError('pause-publication-fault')
        return original(value)
    monkeypatch.setattr(module, 'deepcopy', fail)
    final = provider_result(req, actual_cost=Decimal('3'))
    with pytest.raises(RuntimeError, match='pause-publication-fault'):
        service.dispatch(req, admission_hash='sha256:'+'a'*64, sender=lambda _: final)
    assert service.snapshot('budget').new_action_allowed is False
    assert service.snapshot('budget').reserved_cost == Decimal('1')
    monkeypatch.setattr(module, 'deepcopy', original)
    assert service.dispatch_receipt(req.request_id).status == 'PAUSED_QUOTA'
    assert service.dispatch_receipt(req.request_id).usage.actual_cost == Decimal('3')
    sent = []
    assert service.dispatch(request('before-retry'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []
    assert service.finalize(req.request_id, final).status == 'PAUSED_QUOTA'


@pytest.mark.parametrize('field', ['pin_hash', 'budget_id', 'step_id', 'request_id', 'reservation_id', 'role',
                                  'input_tokens', 'output_tokens', 'tool_loops'])
def test_r1_route_untrusted_fields_never_invoke_callbacks(field):
    router, pin, _, _, _, now = routed(); calls = []; sent = []; req = route_request(pin)
    class Hostile:
        def __deepcopy__(self, memo):
            calls.append('deepcopy'); return pin.content_hash
        def __bool__(self):
            calls.append('bool'); return True
        def __hash__(self):
            calls.append('hash'); return 0
    object.__setattr__(req, field, Hostile())
    with pytest.raises(ValueError):
        router.send(req, now=now, sender=sent.append)
    assert calls == [] and sent == []


@pytest.mark.parametrize('entry', ['service', 'router'])
def test_r1_pause_metadata_rejects_truth_callback_before_use(entry):
    calls = []; sent = []
    class Hostile:
        def __bool__(self):
            calls.append('bool'); return False
    with pytest.raises(ValueError):
        if entry == 'service':
            budget().dispatch(request(), admission_hash='sha256:'+'a'*64, sender=sent.append, checkpoint_ref=Hostile())
        else:
            router, pin, _, _, _, now = routed()
            router.send(route_request(pin), now=now, sender=sent.append, checkpoint_ref=Hostile())
    assert calls == [] and sent == []


@pytest.mark.parametrize('entry', ['pause', 'warning', 'legacy_receipt', 'pin_mapping', 'pin_value'])
def test_r1_other_public_boundaries_do_not_evaluate_untrusted_values(entry):
    calls = []; service = budget()
    class Text(str):
        def __hash__(self): calls.append('hash'); return 0
        def __str__(self): calls.append('str'); return 'receipt'
        def strip(self): calls.append('strip'); return 'value'
    class Mapping(dict):
        def items(self): calls.append('items'); return super().items()
    if entry == 'legacy_receipt':
        service.reserve_and_send(request(), lambda _: Text('receipt'))
        assert service.reservation('reservation-one').provider_receipt_ref is None
    else:
        with pytest.raises(ValueError):
            if entry == 'pause':
                service.pause_for_quota(Text('budget'), incomplete_step_id='step', checkpoint_ref='checkpoint',
                                        reset_hint='later', next_safe_action='review')
            elif entry == 'warning':
                service.approaching_quota(Text('budget'), checkpoint_ref='checkpoint', next_safe_action='review')
            else:
                router, _, _, _, _, now = routed()
                data = dict(session_id='session', task_id='task', run_id='run', snapshot_id='snapshot', content_hash='sha256:'+'a'*64)
                if entry == 'pin_mapping': data = Mapping(data)
                else: data['run_id'] = Text('run')
                router.pin(data, now=now, approval_expires_at=now+timedelta(minutes=1))
    assert calls == []


@pytest.mark.parametrize('field', ['forecast_tokens', 'hard_token_limit', 'max_concurrent_requests'])
def test_r1_budget_numeric_inputs_are_bounded_before_hash_or_owner(field):
    huge = 10**10000
    with pytest.raises(ValueError):
        if field == 'forecast_tokens':
            request(tokens=huge)
        elif field == 'hard_token_limit':
            budget(tokens=huge)
        else:
            budget(concurrency=huge)


def test_r1_reconcile_returns_detached_receipt_on_first_and_replay():
    service = budget(); service.reserve(request())
    receipt = UsageReceipt('final', 'reservation-one', 'request-one', 'COMPLETED', Decimal('.4'), 40, None, None, 'provider_final_usage')
    for _ in range(2):
        exposed = service.reconcile(receipt)
        object.__setattr__(exposed, 'consumed_cost', Decimal('0'))
    assert service.reconcile(receipt).consumed_cost == Decimal('.4')


@pytest.mark.parametrize('kind,field',
    [('limit', name) for name in ('budget_id', 'hard_cost_limit', 'hard_token_limit', 'max_concurrent_requests')] +
    [('request', name) for name in ('reservation_id', 'budget_id', 'run_id', 'step_id', 'request_id',
                                    'provider', 'model', 'pricing_version', 'forecast_cost', 'forecast_tokens')] +
    [('outcome', name) for name in ('request_id', 'provider', 'model', 'abort_status', 'actual_cost',
                                    'actual_tokens', 'provenance', 'retry_after', 'rate_bucket', 'failure_code')])
def test_r1_all_budget_dto_fields_reject_callback_values_before_owner(kind, field):
    calls = []; sent = []; service = budget()
    class Hostile:
        def __deepcopy__(self, memo): calls.append('copy'); return 'value'
        def __str__(self): calls.append('str'); return 'value'
        def __eq__(self, other): calls.append('eq'); return False
        def __hash__(self): calls.append('hash'); return 0
        def strip(self): calls.append('strip'); return 'value'
        def __bool__(self): calls.append('bool'); return True
    if kind == 'limit':
        dto = BudgetLimit('other', Decimal('1'), 10, 1)
    elif kind == 'request':
        dto = request()
    else:
        service.dispatch(request(), admission_hash='sha256:'+'a'*64,
                         sender=lambda req: provider_result(req, actual_cost=None))
        dto = provider_result(request())
    object.__setattr__(dto, field, Hostile())
    with pytest.raises(ValueError):
        if kind == 'limit': service.create_budget(dto)
        elif kind == 'request': service.dispatch(dto, admission_hash='sha256:'+'a'*64, sender=sent.append)
        else: service.finalize('request-one', dto)
    assert calls == [] and sent == []


@pytest.mark.parametrize('cost,tokens', [(Decimal('3'), None), (None, 1100)])
def test_r2_partial_authoritative_overforecast_preserves_known_dimension_and_pauses(cost, tokens):
    from packages.budget.models import ReservationStatus
    service = budget(cost='2'); req = request(); sent = []
    final = provider_result(req, actual_cost=cost, actual_tokens=tokens)
    result = service.dispatch(req, admission_hash='sha256:'+'a'*64, sender=lambda _: final)
    assert result.usage.actual_cost == cost and result.usage.actual_tokens == tokens
    assert result.status == 'PAUSED_QUOTA' and result.failure_code == 'ACTUAL_USAGE_EXCEEDS_FORECAST'
    assert result.reservation.status is ReservationStatus.RECONCILIATION_REQUIRED
    assert result.reconciliation is None and service.snapshot('budget').new_action_allowed is False
    assert service.finalize(req.request_id, final) == result
    object.__setattr__(result.usage, 'actual_cost', Decimal('0'))
    object.__setattr__(result.usage, 'actual_tokens', 0)
    assert service.dispatch_receipt(req.request_id).usage.actual_cost == cost
    assert service.dispatch_receipt(req.request_id).usage.actual_tokens == tokens
    assert service.dispatch(request('next'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []


@pytest.mark.parametrize('cost,tokens', [(Decimal('.4'), None), (None, 40)])
def test_r2_partial_authoritative_underforecast_is_evidence_not_final_reconciliation(cost, tokens):
    service = budget(); req = request()
    first = provider_result(req, actual_cost=cost, actual_tokens=tokens)
    result = service.dispatch(req, admission_hash='sha256:'+'a'*64, sender=lambda _: first)
    assert result.usage.actual_cost == cost and result.usage.actual_tokens == tokens
    assert result.status == 'USAGE_RECONCILIATION_REQUIRED' and result.reconciliation is None
    assert service.snapshot('budget').reserved_cost == Decimal('1')
    final = provider_result(req, actual_cost=Decimal('.4'), actual_tokens=40)
    assert service.finalize(req.request_id, final).status == 'FINALIZED'


@pytest.mark.parametrize('cost,tokens', [(Decimal('3'), None), (None, 1100)])
def test_r2_partial_overforecast_publication_fault_restores_then_retry_preserves(cost, tokens, monkeypatch):
    import packages.budget.service as module
    service = budget(cost='2'); req = request(); original = module.deepcopy
    final = provider_result(req, actual_cost=cost, actual_tokens=tokens)
    def fail(value):
        if getattr(value, 'failure_code', None) == 'ACTUAL_USAGE_EXCEEDS_FORECAST':
            raise RuntimeError('partial-publication-fault')
        return original(value)
    monkeypatch.setattr(module, 'deepcopy', fail)
    with pytest.raises(RuntimeError, match='partial-publication-fault'):
        service.dispatch(req, admission_hash='sha256:'+'a'*64, sender=lambda _: final)
    assert service.snapshot('budget').new_action_allowed is False
    assert service.snapshot('budget').reserved_cost == Decimal('1')
    monkeypatch.setattr(module, 'deepcopy', original)
    assert service.dispatch_receipt(req.request_id).status == 'PAUSED_QUOTA'
    assert service.dispatch_receipt(req.request_id).usage.actual_cost == cost
    sent = []
    assert service.dispatch(request('before-retry'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []
    result = service.finalize(req.request_id, final)
    assert result.status == 'PAUSED_QUOTA'
    assert result.usage.actual_cost == cost and result.usage.actual_tokens == tokens


@pytest.mark.parametrize('cost,tokens', [(Decimal('3'), 100), (Decimal('3'), None), (None, 1100), (Decimal('.4'), 1100)])
def test_r2_public_reconcile_overrun_preserves_evidence_and_blocks_other_service(cost, tokens):
    from packages.budget.service import UsageReconciliationRequired
    service = budget(cost='2'); req = request(); other = BudgetService(service._repository); sent = []
    service.dispatch(req, admission_hash='sha256:'+'a'*64,
                     sender=lambda req: provider_result(req, actual_cost=None, actual_tokens=None))
    receipt = UsageReceipt('direct-final', req.reservation_id, req.request_id, 'COMPLETED', cost, tokens,
                           None, 'bucket', 'provider_final_usage')
    for _ in range(2):
        with pytest.raises(UsageReconciliationRequired):
            other.reconcile(receipt)
        evidence = service.dispatch_receipt(req.request_id)
        assert evidence.status == 'PAUSED_QUOTA' and evidence.usage == receipt
        assert evidence.failure_code == 'ACTUAL_USAGE_EXCEEDS_FORECAST'
    object.__setattr__(receipt, 'actual_cost', Decimal('0'))
    assert service.dispatch_receipt(req.request_id).usage.actual_cost == cost
    assert service.snapshot('budget').new_action_allowed is False
    assert other.dispatch(request('next'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []


def test_r2_public_reconcile_safety_fact_survives_adapter_failure(monkeypatch):
    service = budget(cost='2'); req = request(); sent = []
    service.dispatch(req, admission_hash='sha256:'+'a'*64,
                     sender=lambda req: provider_result(req, actual_cost=None, actual_tokens=None))
    original = service._repository.reconcile
    def fail(receipt):
        raise RuntimeError('reconcile-adapter-fault')
    monkeypatch.setattr(service._repository, 'reconcile', fail)
    receipt = UsageReceipt('direct-final', req.reservation_id, req.request_id, 'COMPLETED', Decimal('3'), None,
                           None, None, 'provider_final_usage')
    with pytest.raises(RuntimeError, match='reconcile-adapter-fault'):
        service.reconcile(receipt)
    assert service.snapshot('budget').new_action_allowed is False
    assert service.dispatch_receipt(req.request_id).usage == receipt
    monkeypatch.setattr(service._repository, 'reconcile', original)
    assert service.dispatch(request('next'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []


@pytest.mark.parametrize('failure', ['adapter', 'response'])
def test_r2_normal_public_reconcile_still_rolls_back_without_safety_fact(failure, monkeypatch):
    import packages.budget.service as module
    from packages.budget.models import ReconciliationReceipt, ReservationStatus
    service = budget(); service.reserve(request()); original = service._repository.reconcile; copy = module.deepcopy
    def fail_adapter(receipt):
        original(receipt)
        raise RuntimeError('normal-reconcile-fault')
    def fail_response(value):
        if type(value) is ReconciliationReceipt:
            raise RuntimeError('normal-reconcile-fault')
        return copy(value)
    if failure == 'adapter': monkeypatch.setattr(service._repository, 'reconcile', fail_adapter)
    else: monkeypatch.setattr(module, 'deepcopy', fail_response)
    receipt = UsageReceipt('normal', 'reservation-one', 'request-one', 'COMPLETED', Decimal('.4'), 40,
                           None, None, 'provider_final_usage')
    with pytest.raises(RuntimeError, match='normal-reconcile-fault'):
        service.reconcile(receipt)
    assert service.snapshot('budget').reserved_cost == Decimal('1')
    assert service.snapshot('budget').consumed_cost == 0
    assert service.snapshot('budget').new_action_allowed is True
    assert service.reservation('reservation-one').status is ReservationStatus.RESERVED
    monkeypatch.setattr(service._repository, 'reconcile', original)
    monkeypatch.setattr(module, 'deepcopy', copy)
    assert service.reconcile(receipt).consumed_cost == Decimal('.4')


@pytest.mark.parametrize('code', ['QUOTA_EXHAUSTED', 'HARD_LIMIT'])
@pytest.mark.parametrize('cost,tokens', [(Decimal('.4'), 40), (None, None), (Decimal('.4'), None), (None, 40)])
@pytest.mark.parametrize('failure', ['response', 'reservation', 'reconcile'])
def test_r3_provider_stop_survives_response_fault_and_other_service_send(code, cost, tokens, failure, monkeypatch):
    import packages.budget.service as module
    from packages.budget.models import BudgetReservation
    service = budget(); other = BudgetService(service._repository); req = request(); sent = []
    original = module.deepcopy; reconcile = service._repository.reconcile; observed_provider = []
    final = provider_result(req, actual_cost=cost, actual_tokens=tokens, failure_code=code, retry_after='30')
    def sender(_):
        observed_provider.append(True)
        return final
    def fail(value):
        if ((failure == 'response' and getattr(value, 'status', None) == 'PAUSED_QUOTA') or
                (failure == 'reservation' and observed_provider and type(value) is BudgetReservation)):
            raise RuntimeError('provider-stop-publication-fault')
        return original(value)
    def fail_reconcile(receipt):
        try:
            reconcile(receipt)
        finally:
            raise RuntimeError('provider-stop-publication-fault')
    monkeypatch.setattr(module, 'deepcopy', fail)
    if failure == 'reconcile': monkeypatch.setattr(service._repository, 'reconcile', fail_reconcile)
    with pytest.raises(RuntimeError, match='provider-stop-publication-fault'):
        service.dispatch(req, admission_hash='sha256:'+'a'*64, sender=sender,
                         checkpoint_ref='checkpoint-provider-stop', reset_hint='reset-later')
    assert service.snapshot('budget').new_action_allowed is False
    assert service.snapshot('budget').reserved_cost == Decimal('1')
    assert service.snapshot('budget').consumed_cost == 0
    monkeypatch.setattr(module, 'deepcopy', original)
    monkeypatch.setattr(service._repository, 'reconcile', reconcile)
    observed = other.dispatch_receipt(req.request_id)
    assert observed.status == 'PAUSED_QUOTA' and observed.failure_code == code
    assert observed.usage.actual_cost == cost and observed.usage.actual_tokens == tokens
    assert observed.usage.retry_after == '30' and observed.usage.provenance == 'PROVIDER_FINAL'
    assert observed.pause.checkpoint_ref == 'checkpoint-provider-stop'
    assert observed.pause.reset_hint == 'reset-later'
    assert other.dispatch(request('after-stop'), admission_hash='sha256:'+'a'*64, sender=sent.append).send_count == 0
    assert sent == []
    recovered = service.finalize(req.request_id, final)
    assert recovered.status == 'PAUSED_QUOTA' and recovered.failure_code == code
    assert service.finalize(req.request_id, final) == recovered
    assert service.snapshot('budget').new_action_allowed is False
    if cost is not None and tokens is not None:
        assert recovered.reconciliation.consumed_cost == Decimal('.4')
        assert service.snapshot('budget').reserved_cost == 0
    else:
        assert recovered.reconciliation is None
        assert service.snapshot('budget').reserved_cost == Decimal('1')


@pytest.mark.parametrize('code', ['QUOTA_EXHAUSTED', 'HARD_LIMIT'])
def test_r3_later_final_usage_without_stop_code_cannot_erase_original_provider_stop(code):
    service = budget(); req = request()
    service.dispatch(req, admission_hash='sha256:'+'a'*64,
                     sender=lambda req: provider_result(req, failure_code=code, actual_cost=None, actual_tokens=None))
    final = provider_result(req, failure_code=None, actual_cost=Decimal('.4'), actual_tokens=40)
    result = service.finalize(req.request_id, final)
    assert result.status == 'PAUSED_QUOTA' and result.failure_code == code
    assert result.reconciliation.consumed_cost == Decimal('.4')
    assert service.snapshot('budget').new_action_allowed is False
