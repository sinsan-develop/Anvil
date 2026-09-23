"""E08 host admission consuming D11 public PINNED selections and B10 budget.

No provider/network configuration, credentials or registry authority is created.
Host pinning supplies the approval window from its authenticated control-plane
record; D11's public activation exposes its hash, not the capture expiry. This
window adapter is in-memory, not an API for callers to approve their own route.
"""
from copy import deepcopy
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import re
from threading import RLock

from packages.knowledge.model_registry import ModelRegistry
from packages.knowledge.memory import _hash, to_primitive
from .models import BudgetRequest, BudgetDispatch
from .service import BudgetService, BudgetError, _digest


class RoutingError(BudgetError):
    pass


def _utc(value):
    if (type(value) is not datetime or type(value.tzinfo) is not timezone
            or value.utcoffset() != timedelta(0)):
        raise RoutingError('UTC_TIMESTAMP_REQUIRED')
    return datetime(value.year, value.month, value.day, value.hour, value.minute,
                    value.second, value.microsecond, tzinfo=timezone.utc)


def _sealed(value):
    value = to_primitive(value)
    if type(value) is not dict or value.get('content_hash') != _hash({k: v for k, v in value.items() if k != 'content_hash'}):
        raise RoutingError('REGISTRY_EVIDENCE_TAMPERED')
    return value


@dataclass(frozen=True, slots=True)
class RoutePin:
    content_hash: str
    run_id: str
    selection_hash: str
    activation_hash: str
    approval_hash: str
    created_at: datetime
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class RoutedRequest:
    pin_hash: str
    budget_id: str
    step_id: str
    request_id: str
    reservation_id: str
    role: str
    input_tokens: int
    output_tokens: int
    tool_loops: int = 1


@dataclass(frozen=True, slots=True)
class RoutedDispatch:
    dispatch: BudgetDispatch
    pin_hash: str
    activation_hash: str
    approval_hash: str
    model_hash: str
    pricing_version: str
    fallback_from: str | None


class CapabilityBudgetRouter:
    """The host injects exact owners; all sender callbacks execute outside locks."""

    def __init__(self, budgets, registry, context):
        if type(budgets) is not BudgetService or type(registry) is not ModelRegistry:
            raise RoutingError('EXACT_OWNER_REQUIRED')
        self._budgets, self._registry, self._context = budgets, registry, context
        self._pins, self._requests = {}, {}
        self._lock = RLock()

    def pin(self, snapshot_ref, *, now, approval_expires_at):
        """Host-only capture: never an approval minting endpoint.

        An existing run cannot acquire a longer approval window by re-pinning.
        """
        now, expiry = _utc(now), _utc(approval_expires_at)
        if not now < expiry:
            raise RoutingError('APPROVAL_EXPIRED')
        if type(snapshot_ref) is not dict or len(snapshot_ref) != 5:
            raise RoutingError('INVALID_SNAPSHOT_REF')
        # No user Mapping/string hooks reach D11 safe()/to_primitive().
        for key, value in snapshot_ref.items():
            if type(key) is not str or type(value) is not str or not value or len(key) > 32 or len(value) > 256:
                raise RoutingError('INVALID_SNAPSHOT_REF')
        if set(snapshot_ref) != {'session_id', 'task_id', 'run_id', 'snapshot_id', 'content_hash'}:
            raise RoutingError('INVALID_SNAPSHOT_REF')
        snapshot_ref = dict(snapshot_ref)
        selection = _sealed(self._registry.run_guard(self._context, snapshot_ref, now=now))
        if selection.get('status') != 'PINNED':
            raise RoutingError('ROUTE_NOT_PINNED')
        view = to_primitive(self._registry.query(self._context, now=now))
        activation = self._activation(view, selection)
        payload = (selection, activation['approval_hash'], now.isoformat(), expiry.isoformat())
        pin = RoutePin(_digest(payload), selection['snapshot_ref']['run_id'], selection['content_hash'],
                       activation['content_hash'], activation['approval_hash'], now, expiry)
        encoded = json.dumps(selection, sort_keys=True, separators=(',', ':'))
        with self._lock:
            for existing, _ in self._pins.values():
                if existing.run_id == pin.run_id:
                    if existing != pin:
                        raise RoutingError('PIN_REBIND')
                    return deepcopy(existing)
            self._pins[pin.content_hash] = (pin, encoded)
        return deepcopy(pin)

    @staticmethod
    def _activation(view, selection):
        candidates = [a for a in view['activations'] if a['content_hash'] == selection['activation_hash']]
        if len(candidates) != 1:
            raise RoutingError('ACTIVATION_MISMATCH')
        activation = _sealed(candidates[0])
        if activation['routing'] != selection['routing'] or activation['approval_mode'] not in {'HUMAN', 'MAIN_POLICY'}:
            raise RoutingError('ACTIVATION_MISMATCH')
        if any(q['activation_hash'] == activation['content_hash'] for q in view['quarantine']):
            raise RoutingError('BLOCKED_CAPABILITY_DRIFT')
        return activation

    def _current(self, pin_hash, now):
        now = _utc(now)
        if type(pin_hash) is not str:
            raise RoutingError('UNKNOWN_PIN')
        with self._lock:
            pair = self._pins.get(pin_hash)
            if pair is None:
                raise RoutingError('UNKNOWN_PIN')
            pin, encoded = pair
            pin = deepcopy(pin)
        if not pin.created_at <= now < pin.expires_at:
            raise RoutingError('APPROVAL_EXPIRED')
        selection = _sealed(json.loads(encoded))
        if (_digest((selection, pin.approval_hash, pin.created_at.isoformat(), pin.expires_at.isoformat())) != pin_hash
                or pin.content_hash != pin_hash):
            raise RoutingError('PIN_TAMPERED')
        # Public D11 owner query refreshes capability/source quarantine. Do not
        # trust a previously returned PINNED DTO alone or access registry state.
        view = to_primitive(self._registry.query(self._context, now=now))
        actual = _sealed(view['runs'].get(pin.run_id))
        if actual != selection:
            raise RoutingError('SELECTION_MISMATCH')
        activation = self._activation(view, selection)
        if activation['approval_hash'] != pin.approval_hash:
            raise RoutingError('APPROVAL_MISMATCH')
        return pin, selection, view

    @staticmethod
    def _model(view, target, now):
        record = view['models'].get(target['model']['content_hash'])
        model = _sealed(record)
        if {k: model[k] for k in ('id', 'version', 'content_hash')} != target['model']:
            raise RoutingError('MODEL_IDENTITY_MISMATCH')
        data = model['data']; probe = data['probe']; req = target['requirements']
        observed = datetime.fromisoformat(probe['observed_at'])
        if (view['heads'].get('model:' + model['id']) != model['content_hash'] or probe['status'] != 'AVAILABLE'
                or not observed <= now < observed + timedelta(seconds=probe['ttl_seconds'])):
            raise RoutingError('BLOCKED_CAPABILITY_DRIFT')
        if (not set(req['capabilities']) <= set(data['capabilities']) or not set(req['tools']) <= set(data['tools'])
                or req['context_tokens'] > data['context_tokens'] or req['privacy_class'] != data['privacy_class']
                or (data['training_use'] and not req['training_use']) or data['retention_days'] > req['retention_days']
                or (req['zdr'] and not data['zdr']) or data['pricing']['currency'] != req['currency']
                or data['pricing']['unit'] != req['unit']
                or Decimal(data['pricing']['input']) > Decimal(req['max_input_price'])
                or Decimal(data['pricing']['output']) > Decimal(req['max_output_price'])):
            raise RoutingError('ROUTE_REQUIREMENTS_UNMET')
        return model

    def send(self, request, *, now, sender, fallback_from=None, abort_before_send=False,
             checkpoint_ref=None, reset_hint='UNKNOWN'):
        if type(request) is not RoutedRequest:
            raise RoutingError('INVALID_ROUTED_REQUEST')
        if type(request.pin_hash) is not str or not re.fullmatch(r'sha256:[a-f0-9]{64}', request.pin_hash):
            raise RoutingError('INVALID_ROUTED_REQUEST')
        if type(abort_before_send) is not bool:
            raise RoutingError('INVALID_ROUTED_REQUEST')
        for value in (checkpoint_ref, reset_hint, fallback_from):
            if value is not None and (type(value) is not str or not value or len(value) > 256):
                raise RoutingError('INVALID_ROUTED_REQUEST')
        for name in ('budget_id', 'step_id', 'request_id', 'reservation_id', 'role'):
            value = getattr(request, name)
            if type(value) is not str or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}', value):
                raise RoutingError('INVALID_ROUTED_REQUEST')
        for name in ('input_tokens', 'output_tokens', 'tool_loops'):
            value = getattr(request, name)
            if type(value) is not int or value < (1 if name == 'tool_loops' else 0) or value > 1000000:
                raise RoutingError('INVALID_FORECAST')
        request = deepcopy(request); now = _utc(now)
        pin, selection, view = self._current(request.pin_hash, now)
        targets = [r for r in selection['routing']['routes'] if r['role'] == request.role]
        if len(targets) != 1:
            raise RoutingError('ROLE_NOT_APPROVED')
        primary = targets[0]; model = self._model(view, primary, now)
        selected = primary
        if fallback_from is not None:
            if type(fallback_from) is not str:
                raise RoutingError('FALLBACK_NOT_APPROVED')
            with self._lock:
                previous = self._requests.get(fallback_from)
            if previous is None or previous[0].pin_hash != request.pin_hash or previous[1] is not None:
                raise RoutingError('FALLBACK_NOT_APPROVED')
            old = previous[0]
            if (old.budget_id, old.step_id, old.role, old.input_tokens, old.output_tokens, old.tool_loops) != (
                    request.budget_id, request.step_id, request.role, request.input_tokens, request.output_tokens, request.tool_loops):
                raise RoutingError('FALLBACK_NOT_APPROVED')
            receipt = self._budgets.dispatch_receipt(fallback_from)
            if (receipt.failure_code not in primary['fallback']['on'] or receipt.failure_code not in {'TIMEOUT', 'RATE_LIMIT', 'TEMPORARY_5XX'}
                    or receipt.status not in {'FINALIZED', 'USAGE_RECONCILIATION_REQUIRED'} or not primary['fallback']['targets']):
                raise RoutingError('FALLBACK_NOT_APPROVED')
            selected = primary['fallback']['targets'][0]
            replacement = self._model(view, selected, now)
            a, b = model['data'], replacement['data']
            if (selected['requirements'] != primary['requirements'] or a['privacy_class'] != b['privacy_class']
                    or a['training_use'] != b['training_use'] or b['retention_days'] > a['retention_days']
                    or a['zdr'] != b['zdr'] or b['context_tokens'] < a['context_tokens'] or a['tools'] != b['tools']
                    or not set(a['capabilities']) <= set(b['capabilities'])
                    or a['pricing']['currency'] != b['pricing']['currency']
                    or Decimal(b['pricing']['input']) > Decimal(a['pricing']['input'])
                    or Decimal(b['pricing']['output']) > Decimal(a['pricing']['output'])):
                raise RoutingError('FALLBACK_NOT_EQUIVALENT')
            model = replacement
        data = model['data']
        if request.input_tokens + request.output_tokens > data['context_tokens']:
            raise RoutingError('CONTEXT_LIMIT')
        price = data['pricing']
        tokens = (request.input_tokens + request.output_tokens) * request.tool_loops
        cost = ((Decimal(request.input_tokens) * Decimal(price['input']) + Decimal(request.output_tokens) * Decimal(price['output']))
                * request.tool_loops / Decimal(1000000))
        budget_request = BudgetRequest(request.reservation_id, request.budget_id, pin.run_id, request.step_id,
                                       request.request_id, data['provider'], data['model_id'], model['content_hash'], cost, tokens)
        admission_hash = _digest((asdict(request), asdict(pin), selected, fallback_from))
        # Prepare all provenance before side effect. The callback rechecks the
        # public owner after budget reservation and immediately before send.
        def guard():
            current_pin, _, current_view = self._current(request.pin_hash, now)
            if current_pin != pin or self._model(current_view, selected, now) != model:
                raise RoutingError('ROUTE_DRIFT')
        result = self._budgets.dispatch(budget_request, admission_hash=admission_hash, sender=sender, pre_send=guard,
                    abort_before_send=abort_before_send, checkpoint_ref=checkpoint_ref, reset_hint=reset_hint)
        with self._lock:
            self._requests[request.request_id] = (request, fallback_from)
        return RoutedDispatch(result, pin.content_hash, pin.activation_hash, pin.approval_hash,
                              model['content_hash'], model['content_hash'], fallback_from)
