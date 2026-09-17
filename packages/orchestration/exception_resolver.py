"""E-07 host-only exception projection over the E-04 graph owner.

This in-memory boundary consumes host-validated classification/evidence references;
it does not authenticate arbitrary agent claims or execute/dispatch work. Inbox
durability, quota accounting, retry and human resolution commands are not adapters
provided by this package. All publication is callback-free under one local lock.
"""

from copy import deepcopy
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from enum import Enum
import re
from threading import RLock
from types import MappingProxyType
from typing import Mapping

from packages.agent_team.collaboration import canonical_hash
from packages.execution import RunStatus
from packages.queue.dag import snapshot_graph


class FailurePolicy(str, Enum):
    STOP = 'STOP'
    CONTINUE_INDEPENDENT = 'CONTINUE_INDEPENDENT'
    COLLECT_AND_REVIEW = 'COLLECT_AND_REVIEW'


class ExceptionResolutionError(ValueError):
    """Value-safe deterministic reason code, never untrusted input text."""


HARD_STOP_CODES = frozenset({'SECRET_ACCESS', 'PROTECTED_PATH_WRITE', 'DESIGN_CHANGE',
                           'DATA_CORRUPTION_RISK', 'BUDGET_HARD_LIMIT'})
_ORDINARY_CODES = frozenset({'INDEPENDENT_FAILURE', 'IMPLEMENTATION_FAILURE',
                           'VALIDATION_FAILURE', 'TOOL_FAILURE', 'UNVERIFIED_RESULT'})
_EVIDENCE_KINDS = frozenset({'EXECUTED', 'MOCK', 'FIXTURE', 'STATIC', 'BUILD', 'SKIPPED', 'BLOCKED'})
_ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}')
_HASH = re.compile(r'sha256:[0-9a-f]{64}')
MAX_NODES = 128
MAX_EVENTS = 512


def _id(value, reason):
    if type(value) is not str or not _ID.fullmatch(value):
        raise ExceptionResolutionError(reason)


def _hash(value, reason):
    if type(value) is not str or not _HASH.fullmatch(value):
        raise ExceptionResolutionError(reason)


def _time(value):
    # Reject subclass/custom tzinfo before any callback. Keep only an exact,
    # detached builtin UTC value in hashes and append-only records.
    if (type(value) is not datetime or type(value.tzinfo) is not timezone
            or value.utcoffset() != timedelta(0)):
        raise ExceptionResolutionError('UTC_TIMESTAMP_REQUIRED')
    return datetime(value.year, value.month, value.day, value.hour, value.minute,
                    value.second, value.microsecond, tzinfo=timezone.utc)


@dataclass(frozen=True, slots=True)
class ExceptionRecord:
    sequence: int
    exception_id: str
    run_id: str
    graph_hash: str
    policy_hash: str
    step_id: str
    code: str
    hard_stop: bool
    reported_severe: bool
    evidence_hash: str
    occurred_at: datetime
    fingerprint: str


@dataclass(frozen=True, slots=True)
class ExceptionReceipt:
    sequence: int
    event_id: str
    run_id: str
    graph_hash: str
    policy_hash: str
    reason_code: str
    run_status: RunStatus
    changed_steps: tuple[tuple[str, str], ...]
    fingerprint: str
    content_hash: str
    dispatch_count: int = 0


@dataclass(frozen=True, slots=True)
class ExceptionEvent:
    sequence: int
    event_id: str
    kind: str
    step_id: str
    value: str
    evidence_kind: str
    evidence_hash: str
    occurred_at: datetime
    request_hash: str
    receipt: ExceptionReceipt


@dataclass(frozen=True, slots=True)
class ExceptionProjection:
    run_id: str
    graph_id: str
    graph_hash: str
    policy: FailurePolicy
    policy_revision: str
    policy_hash: str
    required_steps: tuple[str, ...]
    steps: Mapping[str, str]
    ready_steps: tuple[str, ...]
    run_status: RunStatus
    inbox: tuple[ExceptionRecord, ...]
    events: tuple[ExceptionEvent, ...]
    content_hash: str
    dispatch_count: int = 0


@dataclass(frozen=True, slots=True)
class _Run:
    graph: object
    graph_hash: str
    policy: FailurePolicy
    policy_revision: str
    required_steps: tuple[str, ...]
    policy_hash: str
    steps: tuple[tuple[str, str], ...]
    inbox: tuple[ExceptionRecord, ...] = ()
    events: tuple[ExceptionEvent, ...] = ()


def _ready(state):
    steps = dict(state.steps)
    return tuple(n.step_id for n in state.graph.nodes if steps[n.step_id] == 'PENDING'
                 and all(steps[d] == 'SUCCEEDED' for d in n.dependency_ids))


def _status(state):
    if any(record.hard_stop for record in state.inbox):
        return RunStatus.BLOCKED
    if state.policy is FailurePolicy.STOP and state.inbox:
        return RunStatus.FAILED
    if _ready(state):
        return RunStatus.ACTIVE
    if all(value == 'SUCCEEDED' for _, value in state.steps):
        return RunStatus.SUCCEEDED
    return (RunStatus.AWAITING_EXCEPTION_REVIEW if state.policy is FailurePolicy.COLLECT_AND_REVIEW
            else RunStatus.FINISHED_WITH_FAILURES)


def _descendants(graph, step_id):
    found = {step_id}
    while True:
        expanded = found | {n.step_id for n in graph.nodes if found.intersection(n.dependency_ids)}
        if expanded == found:
            return found - {step_id}
        found = expanded


class ExceptionResolver:
    """Main host owns this object; no payload API registers authority or dispatches.

    Bounded runs are independently registered immutable contracts. A fresh ID is
    needed for a revised policy/graph; existing events are never rewritten.
    """

    def __init__(self):
        self._runs = {}
        self._lock = RLock()

    def register(self, graph, *, expected_graph_hash, policy, policy_revision, required_steps):
        try:
            graph = snapshot_graph(graph)
        except (ValueError, TypeError, AttributeError):
            raise ExceptionResolutionError('INVALID_GRAPH') from None
        if len(graph.nodes) > MAX_NODES or sum(len(n.dependency_ids) for n in graph.nodes) > 512:
            raise ExceptionResolutionError('GRAPH_LIMIT_EXCEEDED')
        if graph.content_hash != expected_graph_hash:
            raise ExceptionResolutionError('GRAPH_HASH_MISMATCH')
        if type(policy) not in (str, FailurePolicy):
            raise ExceptionResolutionError('INVALID_POLICY')
        try:
            policy = FailurePolicy(policy)
        except ValueError:
            raise ExceptionResolutionError('INVALID_POLICY') from None
        _id(policy_revision, 'INVALID_POLICY_REVISION')
        node_ids = {n.step_id for n in graph.nodes}
        if (type(required_steps) is not tuple or any(type(s) is not str for s in required_steps)
                or len(set(required_steps)) != len(required_steps) or not set(required_steps) <= node_ids):
            raise ExceptionResolutionError('INVALID_REQUIRED_STEPS')
        required_steps = tuple(sorted(required_steps))
        policy_hash = canonical_hash((graph.content_hash, policy, policy_revision, required_steps))
        state = _Run(graph, graph.content_hash, policy, policy_revision, required_steps, policy_hash,
                     tuple((n.step_id, 'PENDING') for n in graph.nodes))
        with self._lock:
            if graph.run_id in self._runs:
                current = self._current(graph.run_id)
                if current.policy_hash != policy_hash:
                    raise ExceptionResolutionError('RUN_REBIND')
                return self._project(current)
            result = self._project(state)
            self._runs[graph.run_id] = state
            return result

    def _current(self, run_id, graph_hash=None):
        _id(run_id, 'INVALID_RUN_ID')
        state = self._runs.get(run_id)
        if state is None:
            raise ExceptionResolutionError('UNKNOWN_RUN')
        try:
            current_hash = snapshot_graph(state.graph).content_hash
        except (TypeError, ValueError, AttributeError):
            raise ExceptionResolutionError('GRAPH_TAMPERED') from None
        if current_hash != state.graph_hash:
            raise ExceptionResolutionError('GRAPH_TAMPERED')
        if graph_hash is not None and graph_hash != state.graph_hash:
            raise ExceptionResolutionError('GRAPH_HASH_MISMATCH')
        return state

    def record_exception(self, *, run_id, graph_hash, exception_id, step_id, code,
                         evidence_hash, occurred_at, reported_severe=False):
        if type(code) is not str:
            raise ExceptionResolutionError('UNKNOWN_EXCEPTION_CODE')
        if code == 'QUOTA_EXHAUSTED':
            raise ExceptionResolutionError('E08_NOT_IMPLEMENTED')
        if code not in HARD_STOP_CODES | _ORDINARY_CODES:
            raise ExceptionResolutionError('UNKNOWN_EXCEPTION_CODE')
        if type(reported_severe) is not bool:
            raise ExceptionResolutionError('INVALID_SEVERITY')
        return self._record(run_id, graph_hash, exception_id, step_id, 'EXCEPTION', code,
                            'HOST_CLASSIFICATION', evidence_hash, occurred_at, reported_severe)

    def record_result(self, *, run_id, graph_hash, result_id, step_id, outcome,
                      evidence_kind, evidence_hash, occurred_at):
        if type(outcome) is not str or outcome not in {'SUCCEEDED', 'FAILED', 'UNVERIFIED', 'SKIPPED', 'BLOCKED'}:
            raise ExceptionResolutionError('INVALID_OUTCOME')
        if type(evidence_kind) is not str or evidence_kind not in _EVIDENCE_KINDS:
            raise ExceptionResolutionError('INVALID_EVIDENCE_KIND')
        return self._record(run_id, graph_hash, result_id, step_id, 'RESULT', outcome,
                            evidence_kind, evidence_hash, occurred_at, False)

    def _record(self, run_id, graph_hash, event_id, step_id, kind, value, evidence_kind,
                evidence_hash, occurred_at, severe):
        _id(event_id, 'INVALID_EVENT_ID')
        _id(step_id, 'INVALID_STEP_ID')
        _hash(graph_hash, 'GRAPH_HASH_MISMATCH')
        _hash(evidence_hash, 'INVALID_EVIDENCE_HASH')
        occurred_at = _time(occurred_at)
        request_hash = canonical_hash((run_id, graph_hash, event_id, step_id, kind, value,
                                       evidence_kind, evidence_hash, occurred_at, severe))
        with self._lock:
            state = self._current(run_id, graph_hash)
            steps = dict(state.steps)
            if step_id not in steps:
                raise ExceptionResolutionError('UNKNOWN_STEP')
            for event in state.events:
                if event.event_id == event_id:
                    if event.request_hash != request_hash:
                        raise ExceptionResolutionError('REPLAY_CONFLICT')
                    return deepcopy(event.receipt)
            if len(state.events) >= MAX_EVENTS:
                raise ExceptionResolutionError('INBOX_LIMIT_EXCEEDED')
            hard = kind == 'EXCEPTION' and value in HARD_STOP_CODES
            # Safety evidence is appended in arrival order while preserving its
            # original occurrence time. It must not rewind ordinary causal time.
            if not hard and state.events and occurred_at < max(e.occurred_at for e in state.events):
                raise ExceptionResolutionError('PAST_EVENT')
            if steps[step_id] != 'PENDING' and not hard:
                raise ExceptionResolutionError('STEP_TERMINAL')
            if not hard and step_id not in _ready(state):
                raise ExceptionResolutionError('STEP_NOT_READY')
            failure = kind == 'EXCEPTION' or value != 'SUCCEEDED' or evidence_kind != 'EXECUTED'
            status = ('FAILED' if kind == 'EXCEPTION' else
                      'UNVERIFIED' if value == 'SUCCEEDED' and evidence_kind != 'EXECUTED' else value)
            # Late safety evidence may stop a run, but cannot rewrite a past
            # terminal Step/result. The new inbox event explains the override.
            if steps[step_id] == 'PENDING':
                steps[step_id] = status
            sequence = len(state.events) + 1
            code = value if kind == 'EXCEPTION' else ('VALIDATION_FAILURE' if status == 'FAILED' else 'UNVERIFIED_RESULT')
            fingerprint = canonical_hash((run_id, graph_hash, state.policy_hash, step_id, code, evidence_hash))
            inbox = state.inbox
            if failure:
                inbox += (ExceptionRecord(sequence, event_id, run_id, graph_hash, state.policy_hash,
                                           step_id, code, hard, severe, evidence_hash, occurred_at, fingerprint),)
                descendants = _descendants(state.graph, step_id)
                failed_groups = next(n.conflict_groups for n in state.graph.nodes if n.step_id == step_id)
                for node in state.graph.nodes:
                    if steps[node.step_id] != 'PENDING':
                        continue
                    if hard:
                        steps[node.step_id] = 'BLOCKED_RUN_STOP'
                    elif node.step_id in descendants:
                        steps[node.step_id] = 'BLOCKED_DEPENDENCY'
                    elif (state.policy is FailurePolicy.STOP or not node.independent
                          or set(failed_groups).intersection(node.conflict_groups)):
                        steps[node.step_id] = 'BLOCKED_RUN_STOP'
                # Descendants of unrelated stopped nodes cannot become runnable either.
                # They were not descendants of the failed Step: preserve honest cause.
                stopped = {s for s, v in steps.items() if v == 'BLOCKED_RUN_STOP'}
                for stopped_id in stopped:
                    for child in _descendants(state.graph, stopped_id):
                        if steps[child] == 'PENDING':
                            steps[child] = 'BLOCKED_RUN_STOP'
            staged = replace(state, steps=tuple(sorted(steps.items())), inbox=inbox)
            reason = 'HARD_STOP' if hard else 'FAILURE_RECORDED' if failure else 'RESULT_RECORDED'
            changes = tuple((s, v) for s, v in staged.steps if dict(state.steps)[s] != v)
            receipt_payload = (sequence, event_id, run_id, graph_hash, state.policy_hash, reason,
                               _status(staged), changes, fingerprint, request_hash)
            receipt = ExceptionReceipt(sequence, event_id, run_id, graph_hash, state.policy_hash,
                                       reason, _status(staged), changes, fingerprint, canonical_hash(receipt_payload))
            event = ExceptionEvent(sequence, event_id, kind, step_id, value, evidence_kind,
                                   evidence_hash, occurred_at, request_hash, receipt)
            staged = replace(staged, events=state.events + (event,))
            result = deepcopy(receipt)
            self._project(staged)  # All fallible serialization before publication.
            self._runs[run_id] = staged
            return result

    def project(self, run_id):
        with self._lock:
            return self._project(self._current(run_id))

    @staticmethod
    def _project(state):
        payload = (state.graph.run_id, state.graph.graph_id, state.graph_hash, state.policy,
                   state.policy_revision, state.policy_hash, state.required_steps, state.steps,
                   _ready(state), _status(state), state.inbox, state.events)
        return ExceptionProjection(state.graph.run_id, state.graph.graph_id, state.graph_hash,
                                   state.policy, state.policy_revision, state.policy_hash, state.required_steps,
                                   MappingProxyType(dict(state.steps)), _ready(state), _status(state),
                                   deepcopy(state.inbox), deepcopy(state.events), canonical_hash(payload))
