"""D-06 immutable learning lifecycle, without Skill/Hook or external IO.

capture_* entry points are trusted host-control-plane adapters, never API routes.
The host must authenticate human events and collect evaluation evidence outside
this module. Selection is a D-06 sidecar to an actual immutable D-02 snapshot;
it does not insert entries into that snapshot or run a runtime consumer.
"""
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import wraps
import json
import math
from threading import RLock

from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _digest, _integer, _freeze
from .reviews import LearningReviewRepository
from .snapshots import LearningSnapshotRepository

CHECKS = ("static", "security", "license", "permission", "replay", "sandbox_pilot", "quality", "cost", "trigger")
STATUSES = ("PASS", "FAIL", "SKIPPED", "BLOCKED", "ERROR")
KINDS = ("USER", "MEMORY", "CODE_PATTERN", "ANTI_PATTERN", "SKILL", "HOOK", "PROMPT", "BENCHMARK", "ROUTING")
RUN_START_WINDOW = timedelta(seconds=5)


class CandidateError(MemoryError):
    pass


@dataclass(frozen=True)
class RunStartBoundary:
    boundary_id: str
    content_hash: str


def boundary(function):
    @wraps(function)
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except CandidateError:
            raise
        except MemoryError as error:
            raise CandidateError(error.reason) from None
        except (TypeError, ValueError, KeyError, IndexError, OverflowError, RecursionError):
            raise CandidateError("INVALID_CANDIDATE_INPUT") from None
    return guarded


def fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise CandidateError("INVALID_CANDIDATE_INPUT")


def snapshot(value):
    return _freeze(json.loads(_canonical(value)))


def reference(value):
    fields(value, "candidate_id version content_hash")
    _text(value["candidate_id"])
    _integer(value["version"])
    _digest(value["content_hash"])
    return deepcopy(value)


class CandidateRepository:
    def __init__(self, reviews, snapshots, *, run_clock=None):
        if (type(reviews) is not LearningReviewRepository or type(snapshots) is not LearningSnapshotRepository
                or reviews._snapshots is not snapshots):
            raise CandidateError("CANDIDATE_HOST_REQUIRED")
        self._reviews, self._snapshots = reviews, snapshots
        self._lock = RLock()
        self._records, self._owners, self._origins, self._requests = {}, {}, {}, {}
        self._events, self._evaluations, self._decisions, self._captures, self._user_confirmations = {}, {}, {}, {}, {}
        self._activations, self._heads, self._selections, self._run_selections, self._uses, self._impacts = {}, {}, {}, {}, {}, {}
        self._activation_versions = {}
        # Only trusted host construction may inject a test/host clock; never an API input.
        self._run_clock = run_clock if run_clock is not None else lambda: datetime.now(timezone.utc)
        if not callable(self._run_clock):
            raise CandidateError("CANDIDATE_HOST_REQUIRED")
        self._run_starts, self._started_runs, self._observed_start_times = {}, {}, {}

    @contextmanager
    def _session(self, context, now):
        with self._reviews._locked(), self._lock:
            host = self._reviews._host(context, now)
            yield host

    def _owned(self, key, context, host):
        owner = self._owners.get(key)
        if owner is None or owner[0] is not context or owner[1:] != host[1:]:
            raise CandidateError("CANDIDATE_AUTHORITY_MISMATCH")

    def _state(self, key):
        return json.loads(self._events[key][-1])

    def _event(self, key, status, now, evidence=None):
        old = self._events.get(key, [])
        body = dict(candidate_id=key[1], state_version=len(old) + 1, status=status, created_at=_time(now),
                    previous_hash=json.loads(old[-1])["content_hash"] if old else None, evidence=evidence)
        body["content_hash"] = _hash(body)
        self._events[key] = old + [_canonical(body)]

    def _source_roots(self, context, host, provenance, now):
        roots = []
        for item in provenance:
            ref = item["reference"]
            resolved = self._reviews._resolve(context, host, ref, now)
            if resolved != item:
                raise CandidateError("CANDIDATE_PROVENANCE_DRIFT")
            if ref["kind"] == "SOURCE":
                root = dict(source_id=ref["artifact_id"], version=ref["version"], record_hash=ref["content_hash"])
            elif ref["kind"] in ("CODE_PATTERN", "EXAMPLE_REFERENCE", "ANTI_PATTERN"):
                artifact = self._reviews._patterns.get(context, ref["artifact_id"], version=ref["version"], now=now)
                root = to_primitive(artifact.source_ref)
            else:
                continue
            current = self._reviews._sources.get(context, root["source_id"], now=now)
            if (current.status != "REGISTERED" or current.record.version != root["version"]
                    or current.record.record_hash != root["record_hash"] or current.record.findings
                    or current.record.license_status != "APPROVED"):
                raise CandidateError("CANDIDATE_PROVENANCE_DRIFT")
            roots.append(root)
        return sorted(roots, key=_canonical)

    def _impact(self, key, reason, evidence, now, restore="BASELINE"):
        candidate = json.loads(self._records[key])
        uses = [json.loads(raw) for raw in self._uses.values() if json.loads(raw)["candidate_ref"]["candidate_id"] == key[1]
                and json.loads(raw)["scope"] == candidate["target_scope"]]
        body = dict(candidate_ref=self._ref(candidate), reason=reason, evidence_ref=evidence, restore=restore,
                    affected_runs=sorted({u["run_id"] for u in uses}), affected_snapshots=sorted({u["snapshot_id"] for u in uses}),
                    pause_required_runs=sorted({u["run_id"] for u in uses}), scope=candidate["target_scope"],
                    new_use_blocked=True, runtime_action="REPORT_ONLY_SAFE_POINT_REQUIRED", created_at=_time(now))
        body["content_hash"] = _hash(body)
        self._impacts.setdefault(key, []).append(_canonical(body))

    def _refresh(self, key, context, host, now):
        state = self._state(key)
        if state["status"] in ("QUARANTINED", "ROLLED_BACK", "REJECTED"):
            return
        try:
            self._source_roots(context, host, json.loads(self._records[key])["provenance"], now)
        except MemoryError:
            # Mark contaminated before scanning alternatives, avoiding restoration cycles.
            self._event(key, "QUARANTINED", now, "SOURCE_PROVENANCE_INVALID")
            restore = self._restore_slot(context, host, json.loads(self._records[key]), now)
            self._impact(key, "SOURCE_PROVENANCE_INVALID", "live-source-check", now, restore)

    def _entry(self, context, host, target, now, *, live=True):
        target = reference(target)
        key = (host[3], target["candidate_id"])
        if key not in self._records:
            raise CandidateError("CANDIDATE_NOT_FOUND")
        self._owned(key, context, host)
        candidate = json.loads(self._records[key])
        if self._ref(candidate) != target:
            raise CandidateError("CANDIDATE_REFERENCE_MISMATCH")
        if _time(now) < datetime.fromisoformat(self._state(key)["created_at"]):
            raise CandidateError("CANDIDATE_STALE_TIME")
        self._refresh(key, context, host, now)
        state = self._state(key)
        if live:
            if state["status"] in ("QUARANTINED", "ROLLED_BACK", "REJECTED"):
                raise CandidateError("CANDIDATE_" + state["status"])
            if _time(now) >= datetime.fromisoformat(candidate["expires_at"]):
                raise CandidateError("CANDIDATE_EXPIRED")
        return key, candidate, state

    @staticmethod
    def _ref(candidate):
        return {k: candidate[k] for k in ("candidate_id", "version", "content_hash")}

    @staticmethod
    def _slot(host, candidate):
        return host[3], candidate["kind"], candidate["target_id"]

    def _restore_slot(self, context, host, candidate, now):
        """Restore only already-issued, human-approved live ACTIVE activations.

        An APPROVED candidate without an activation is not silently activated.
        Scan highest version first; retain every historical artifact and counter.
        """
        slot = self._slot(host, candidate)
        current = self._heads.get(slot)
        if current is not None:
            current_key = (host[3], json.loads(self._activations[current])["candidate_ref"]["candidate_id"])
            owner = self._owners[current_key]
            if owner[0] is not context or owner[1:] != host[1:]:
                # Quarantining our pending proposal is not authority to change another owner's head.
                return "UNCHANGED_FOREIGN_AUTHORITY"
        alternatives = sorted((json.loads(raw) for raw in self._activations.values()
                               if json.loads(raw)["scope"] == candidate["target_scope"]
                               and json.loads(raw)["kind"] == candidate["kind"]
                               and json.loads(raw)["target_id"] == candidate["target_id"]),
                              key=lambda value: value["version"], reverse=True)
        for activation in alternatives:
            other_key = (host[3], activation["candidate_ref"]["candidate_id"])
            if self._state(other_key)["status"] != "ACTIVE":
                continue
            try:
                self._active(context, host, activation["activation_id"], now, require_head=False)
            except CandidateError:
                continue
            self._heads[slot] = activation["activation_id"]
            return activation["activation_id"]
        self._heads.pop(slot, None)
        return "BASELINE"

    def _proposal(self, context, host, data, now):
        fields(data, "candidate_id review_ref selector target_id intent target_scope confidence expires_at risk_delta user_source_ref")
        data = deepcopy(data)
        _text(data["candidate_id"])
        _text(data["target_id"])
        fields(data["review_ref"], "review_id version content_hash")
        _digest(data["review_ref"]["content_hash"])
        _integer(data["review_ref"]["version"])
        review = self._reviews.get(context, data["review_ref"]["review_id"], now=now)
        if review.content_hash != data["review_ref"]["content_hash"] or review.version != data["review_ref"]["version"]:
            raise CandidateError("REVIEW_REFERENCE_MISMATCH")
        fields(data["selector"], "field index content_hash")
        selector = data["selector"]
        index = _integer(selector["index"], 0)
        _digest(selector["content_hash"])
        if selector["field"] not in ("candidate_actions", "user_corrections"):
            raise CandidateError("REVIEW_ACTION_REQUIRED")
        items = getattr(review, selector["field"])
        if index >= len(items) or _hash(items[index]) != selector["content_hash"]:
            raise CandidateError("REVIEW_ACTION_REQUIRED")
        kind = "USER" if selector["field"] == "user_corrections" else items[index]["kind"]
        if kind not in KINDS:
            raise CandidateError("REVIEW_ACTION_REQUIRED")
        if data["target_scope"] != to_primitive(review.scope) or data["target_scope"] != json.loads(host[4]):
            raise CandidateError("CANDIDATE_SCOPE_DENIED")
        if data["intent"] not in ("CREATE", "PATCH", "SPLIT", "MERGE", "ARCHIVE") or data["confidence"] not in ("VERIFIED", "UNVERIFIED"):
            raise CandidateError("INVALID_CANDIDATE_INPUT")
        delta = data["risk_delta"]
        fields(delta, "risk capabilities implicit_trigger script policy")
        if (delta["risk"] not in ("LOW", "MEDIUM", "HIGH") or type(delta["capabilities"]) is not list
                or any(x not in ("READ", "WRITE", "NETWORK", "SECRET", "EXECUTE", "TOOLS") for x in delta["capabilities"])
                or any(type(delta[x]) is not bool for x in ("implicit_trigger", "script", "policy"))):
            raise CandidateError("INVALID_CANDIDATE_INPUT")
        delta["capabilities"] = sorted(set(delta["capabilities"]))
        expiry = _time(data["expires_at"])
        if not review.created_at <= _time(now) < expiry <= host[6]:
            raise CandidateError("CANDIDATE_EXPIRED")
        provenance = to_primitive(review.provenance)
        roots = self._source_roots(context, host, provenance, now)
        if kind == "USER":
            source = data["user_source_ref"]
            if (type(source) is not dict or source.get("kind") != "USER"
                    or source not in [p["reference"] for p in provenance]):
                raise CandidateError("USER_SOURCE_REQUIRED")
        elif data["user_source_ref"] is not None:
            raise CandidateError("INVALID_CANDIDATE_INPUT")
        return data, review, kind, roots

    def _record_capture(self, table, identity, binding, now, expires_at, host):
        now, expiry = _time(now), _time(expires_at)
        if not now < expiry <= host[6]:
            raise CandidateError("STALE_CANDIDATE_ATTESTATION")
        value = dict(binding=binding, actor=host[2], context_id=host[1], issued_at=now, expires_at=expiry)
        raw = _canonical(value)
        old = table.get(identity)
        if old and old != raw:
            prior = json.loads(old)
            if now < datetime.fromisoformat(prior["expires_at"]) or prior["binding"] != json.loads(raw)["binding"]:
                raise CandidateError("CANDIDATE_ATTESTATION_REBIND")
        table[identity] = raw

    def _capture(self, table, identity, host, now, reason):
        raw = table.get(identity)
        if raw is None:
            raise CandidateError(reason)
        value = json.loads(raw)
        if value["actor"] != host[2] or value["context_id"] != host[1]:
            raise CandidateError("CANDIDATE_AUTHORITY_MISMATCH")
        if not datetime.fromisoformat(value["issued_at"]) <= _time(now) < datetime.fromisoformat(value["expires_at"]):
            raise CandidateError("STALE_CANDIDATE_ATTESTATION")
        return value

    @boundary
    def capture_user_confirmation(self, context, proposal, *, evidence_ref, now, expires_at):
        with self._session(context, now) as host:
            data, review, kind, roots = self._proposal(context, host, proposal, now)
            if kind != "USER":
                raise CandidateError("USER_SOURCE_REQUIRED")
            binding = dict(proposal_hash=_hash(data), user_source_ref=data["user_source_ref"], evidence_ref=_text(evidence_ref))
            self._record_capture(self._user_confirmations, (id(context), _hash(data)), binding, now, expires_at, host)

    @boundary
    def create(self, context, proposal, *, expected_version, request_id, now):
        with self._session(context, now) as host:
            data, review, kind, roots = self._proposal(context, host, proposal, now)
            if _integer(expected_version, 0) != 0:
                raise CandidateError("CANDIDATE_VERSION_CONFLICT")
            user_confirmation_hash = None
            if kind == "USER":
                confirmation = self._capture(self._user_confirmations, (id(context), _hash(data)), host, now, "USER_CONFIRMATION_REQUIRED")
                user_confirmation_hash = _hash(confirmation)
            origin = (host[3], review.review_id, review.version, data["selector"]["field"], data["selector"]["index"])
            key = (host[3], data["candidate_id"])
            digest = _hash(data)
            request = (id(context), _text(request_id))
            if request in self._requests and self._requests[request] != ("create", digest):
                raise CandidateError("CANDIDATE_REPLAY_CONFLICT")
            if origin in self._origins:
                old_key, old_digest = self._origins[origin]
                self._owned(old_key, context, host)
                if old_key != key or old_digest != digest:
                    raise CandidateError("CANDIDATE_IDENTITY_REBIND")
                self._entry(context, host, self._ref(json.loads(self._records[key])), now)
                self._requests[request] = ("create", digest)
                return self.query(context, key[1], now=now)
            if key in self._records:
                raise CandidateError("CANDIDATE_IDENTITY_REBIND")
            slot = (host[3], kind, data["target_id"])
            previous = self._heads.get(slot)
            if previous:
                # A revoke need not have been queried before healthy replacement arrives.
                previous_candidate = json.loads(self._records[(host[3], json.loads(self._activations[previous])["candidate_ref"]["candidate_id"])])
                self._owned((host[3], previous_candidate["candidate_id"]), context, host)
                self._restore_slot(context, host, previous_candidate, now)
                previous = self._heads.get(slot)
            body = dict(data, version=1, kind=kind, provenance=to_primitive(review.provenance), source_roots=roots,
                        terminal_subject=to_primitive(review.subject_ref), terminal_result=review.terminal_result, target_hash=review.target_hash,
                        review_evidence_digest=review.evidence_digest, proposal_hash=digest, previous_activation=previous,
                        created_by=host[2], created_at=_time(now), human_approval_required=True, user_confirmation_hash=user_confirmation_hash)
            body["content_hash"] = _hash(body)
            self._records[key], self._owners[key] = _canonical(body), host
            self._origins[origin] = (key, digest)
            self._requests[request] = ("create", digest)
            self._event(key, "PROPOSED", now)
            return self.query(context, key[1], now=now)

    def _transition(self, context, host, target, now, expected_version, request_id, operation, allowed):
        key, candidate, state = self._entry(context, host, target, now)
        expected = _integer(expected_version, 0)
        request = (id(context), _text(request_id))
        value = (operation, _hash(dict(target=target, expected_version=expected)))
        if request in self._requests:
            if self._requests[request] != value:
                raise CandidateError("CANDIDATE_REPLAY_CONFLICT")
            return key, candidate, state, request, value, True
        if expected != state["state_version"]:
            raise CandidateError("CANDIDATE_VERSION_CONFLICT")
        if state["status"] not in allowed:
            raise CandidateError("INVALID_CANDIDATE_TRANSITION")
        return key, candidate, state, request, value, False

    @boundary
    def capture_evaluation(self, context, target, evidence, *, now, expires_at):
        with self._session(context, now) as host:
            key, candidate, state = self._entry(context, host, target, now)
            if state["status"] not in ("PROPOSED", "EVALUATED"):
                raise CandidateError("INVALID_CANDIDATE_TRANSITION")
            fields(evidence, "checks metrics")
            fields(evidence["checks"], " ".join(CHECKS))
            for check in evidence["checks"].values():
                fields(check, "status target_hash evidence_ref")
                _text(check["evidence_ref"])
                if check["status"] not in STATUSES:
                    raise CandidateError("INVALID_CANDIDATE_INPUT")
                if check["target_hash"] != candidate["content_hash"]:
                    raise CandidateError("EVIDENCE_TARGET_MISMATCH")
            fields(evidence["metrics"], "baseline_quality observed_quality baseline_cost observed_cost baseline_trigger observed_trigger")
            if any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in evidence["metrics"].values()):
                raise CandidateError("INVALID_CANDIDATE_INPUT")
            self._record_capture(self._captures, key, dict(candidate_ref=target, evidence=deepcopy(evidence)), now, expires_at, host)

    @boundary
    def evaluate(self, context, target, *, expected_version, request_id, now):
        with self._session(context, now) as host:
            key, candidate, state, request, value, replay = self._transition(context, host, target, now, expected_version, request_id, "evaluate", ("PROPOSED",))
            if not replay:
                capture = self._capture(self._captures, key, host, now, "EVALUATION_ATTESTATION_REQUIRED")
                evidence = capture["binding"]["evidence"]
                counts = {status: sum(x["status"] == status for x in evidence["checks"].values()) for status in STATUSES}
                metrics = evidence["metrics"]
                passed = counts["PASS"] == len(CHECKS) and metrics["observed_quality"] >= metrics["baseline_quality"] and metrics["observed_trigger"] >= metrics["baseline_trigger"] and metrics["observed_cost"] <= metrics["baseline_cost"]
                evaluation = dict(candidate_ref=target, evidence=evidence, counts=counts, passed=passed, capture_hash=_hash(capture), expires_at=capture["expires_at"])
                evaluation["content_hash"] = _hash(evaluation)
                self._evaluations[key] = _canonical(evaluation)
                self._event(key, "EVALUATED", now, evaluation["content_hash"])
                self._requests[request] = value
            return self.query(context, key[1], now=now)

    def _evaluation(self, key, now):
        evaluation = json.loads(self._evaluations[key])
        if not evaluation["passed"]:
            raise CandidateError("EVALUATION_NOT_PASS")
        if _time(now) >= datetime.fromisoformat(evaluation["expires_at"]):
            raise CandidateError("STALE_CANDIDATE_ATTESTATION")
        return evaluation

    @boundary
    def request_approval(self, context, target, *, expected_version, request_id, now):
        with self._session(context, now) as host:
            key, candidate, state, request, value, replay = self._transition(context, host, target, now, expected_version, request_id, "request", ("EVALUATED",))
            self._evaluation(key, now)
            if not replay:
                self._event(key, "AWAITING_APPROVAL", now)
                self._requests[request] = value
            return self.query(context, key[1], now=now)

    @boundary
    def capture_human_decision(self, context, target, *, decision, evidence_ref, now, expires_at):
        with self._session(context, now) as host:
            key, candidate, state = self._entry(context, host, target, now)
            evaluation = self._evaluation(key, now)
            if state["status"] != "AWAITING_APPROVAL" or decision not in ("APPROVE", "REJECT"):
                raise CandidateError("INVALID_CANDIDATE_TRANSITION")
            binding = dict(candidate_ref=target, decision=decision, evidence_ref=_text(evidence_ref), state_hash=state["content_hash"],
                           scope=candidate["target_scope"], risk_delta=candidate["risk_delta"], evaluation_hash=evaluation["content_hash"])
            self._record_capture(self._decisions, key, binding, now, expires_at, host)

    @boundary
    def approve(self, context, target, *, expected_version, request_id, now):
        with self._session(context, now) as host:
            key, candidate, state, request, value, replay = self._transition(context, host, target, now, expected_version, request_id, "approve", ("AWAITING_APPROVAL",))
            self._evaluation(key, now)
            decision = self._capture(self._decisions, key, host, now, "HUMAN_APPROVAL_REQUIRED")
            if not replay:
                if decision["binding"]["state_hash"] != state["content_hash"]:
                    raise CandidateError("STALE_CANDIDATE_ATTESTATION")
                self._event(key, "APPROVED" if decision["binding"]["decision"] == "APPROVE" else "REJECTED", now, _hash(decision))
                self._requests[request] = value
            return self.query(context, key[1], now=now)

    def _active(self, context, host, activation_id, now, *, require_head=True):
        _text(activation_id)
        raw = self._activations.get(activation_id)
        if raw is None:
            raise CandidateError("ACTIVATION_NOT_FOUND")
        activation = json.loads(raw)
        key, candidate, state = self._entry(context, host, activation["candidate_ref"], now)
        if state["status"] != "ACTIVE":
            raise CandidateError("INVALID_CANDIDATE_TRANSITION")
        if not datetime.fromisoformat(activation["created_at"]) <= _time(now) < datetime.fromisoformat(activation["expires_at"]):
            raise CandidateError("ACTIVATION_EXPIRED")
        if require_head and self._heads.get(self._slot(host, candidate)) != activation_id:
            raise CandidateError("ACTIVATION_SUPERSEDED")
        return key, candidate, activation

    @boundary
    def activate(self, context, target, *, expected_version, request_id, now):
        with self._session(context, now) as host:
            key, candidate, state = self._entry(context, host, target, now)
            if state["status"] == "ACTIVE" and _integer(expected_version) == state["state_version"] - 1:
                request = (id(context), _text(request_id))
                value = ("activate", _hash(dict(target=target, expected_version=expected_version)))
                if request in self._requests and self._requests[request] != value:
                    raise CandidateError("CANDIDATE_REPLAY_CONFLICT")
                matches = [i for i, raw in self._activations.items() if json.loads(raw)["candidate_ref"] == target]
                self._active(context, host, matches[0], now)
                self._requests[request] = value
                return snapshot(json.loads(self._activations[matches[0]]))
            key, candidate, state, request, value, replay = self._transition(context, host, target, now, expected_version, request_id, "activate", ("APPROVED",))
            self._evaluation(key, now)
            approval = self._capture(self._decisions, key, host, now, "HUMAN_APPROVAL_REQUIRED")
            if approval["binding"]["decision"] != "APPROVE" or state["evidence"] != _hash(approval):
                raise CandidateError("HUMAN_APPROVAL_REQUIRED")
            slot = self._slot(host, candidate)
            if self._heads.get(slot) != candidate["previous_activation"]:
                raise CandidateError("ACTIVATION_HEAD_CHANGED")
            previous = candidate["previous_activation"]
            previous_version = self._activation_versions.get(slot, 0)
            body = dict(candidate_ref=target, kind=candidate["kind"], target_id=candidate["target_id"], scope=candidate["target_scope"],
                        version=previous_version + 1, previous_activation=previous, approval_hash=_hash(approval),
                        actor=host[2], context_id=host[1], risk_delta=candidate["risk_delta"], applies_from="NEXT_TASK_OR_RUN",
                        created_at=_time(now), expires_at=min(candidate["expires_at"], approval["expires_at"]), runtime_connected=False)
            body["activation_id"] = "activation-" + _hash(body)
            body["content_hash"] = _hash(body)
            self._activations[body["activation_id"]] = _canonical(body)
            self._activation_versions[slot] = body["version"]
            self._heads[slot] = body["activation_id"]
            self._event(key, "ACTIVE", now, body["content_hash"])
            self._requests[request] = value
            return snapshot(body)

    def _next_selection(self, context, host, activations, snapshot_ref, now):
            fields(snapshot_ref, "session_id task_id run_id snapshot_id content_hash")
            if type(activations) is not list or not activations:
                raise CandidateError("ACTIVATION_SELECTION_REQUIRED")
            scope = MemoryScope(*host[3])
            actual = self._snapshots.get_task_run(snapshot_ref["session_id"], snapshot_ref["task_id"], snapshot_ref["run_id"], scope)
            if (actual.snapshot_id != snapshot_ref["snapshot_id"] or actual.content_hash != snapshot_ref["content_hash"]
                    or actual.created_at > _time(now)):
                raise CandidateError("SNAPSHOT_REFERENCE_MISMATCH")
            chosen = []
            for provided in activations:
                if type(provided) is not dict:
                    raise CandidateError("ACTIVATION_REFERENCE_MISMATCH")
                key, candidate, activation = self._active(context, host, provided["activation_id"], now)
                if provided != activation:
                    raise CandidateError("ACTIVATION_REFERENCE_MISMATCH")
                if actual.created_at <= datetime.fromisoformat(activation["created_at"]) or actual.run_id == candidate["terminal_subject"]["subject_id"]:
                    raise CandidateError("NEXT_RUN_REQUIRED")
                chosen.append(dict(activation_id=activation["activation_id"], version=activation["version"], content_hash=activation["content_hash"]))
            if len({x["activation_id"] for x in chosen}) != len(chosen):
                raise CandidateError("ACTIVATION_REFERENCE_MISMATCH")
            return actual, sorted(chosen, key=_canonical)

    def _observe_start(self, context, now):
        observed = _time(self._run_clock())
        old = self._observed_start_times.get(id(context))
        if _time(now) > observed or (old is not None and observed < old):
            raise CandidateError("STALE_RUN_START_BOUNDARY")
        self._observed_start_times[id(context)] = observed
        return observed

    @boundary
    def capture_run_start(self, context, activations, snapshot_ref, *, now):
        """Trusted startup event: actual clock, exact D-02 snapshot and chosen set.

        Capture/selection occur within the half-open five-second startup window.
        No expired boundary may be reissued for an already-started Run.
        """
        with self._session(context, now) as host:
            observed = self._observe_start(context, now)
            self._reviews._host(context, observed)
            actual, chosen = self._next_selection(context, host, activations, snapshot_ref, observed)
            run = (host[3], actual.run_id)
            if run in self._started_runs:
                raise CandidateError("RUN_START_ALREADY_ISSUED")
            deadline = min(actual.created_at + RUN_START_WINDOW, host[6])
            if not actual.created_at <= _time(now) <= observed < deadline:
                raise CandidateError("STALE_RUN_START_BOUNDARY")
            binding = dict(snapshot_ref=snapshot_ref, activations=chosen, actor=host[2], context_id=host[1],
                           scope=json.loads(host[4]), started_at=actual.created_at, observed_at=observed, expires_at=deadline)
            binding["boundary_id"] = "run-start-" + _hash(binding)
            binding["content_hash"] = _hash(binding)
            capability = RunStartBoundary(binding["boundary_id"], binding["content_hash"])
            self._run_starts[capability.boundary_id] = dict(capability=capability, canonical=_canonical(capability), context=context,
                                                          binding=_canonical(binding), selection_id=None)
            self._started_runs[run] = capability.boundary_id
            return capability

    @boundary
    def select_next_run(self, context, activations, snapshot_ref, *, run_start=None, now):
        with self._session(context, now) as host:
            if type(run_start) is not RunStartBoundary:
                raise CandidateError("RUN_START_AUTHORITY_REQUIRED")
            record = self._run_starts.get(run_start.boundary_id)
            if (record is None or record["capability"] is not run_start or record["context"] is not context
                    or record["canonical"] != _canonical(run_start)):
                raise CandidateError("RUN_START_AUTHORITY_REQUIRED")
            if record["selection_id"] is not None:
                raise CandidateError("RUN_START_CONSUMED")
            observed = self._observe_start(context, now)
            self._reviews._host(context, observed)
            binding = json.loads(record["binding"])
            if not datetime.fromisoformat(binding["observed_at"]) <= _time(now) <= observed < datetime.fromisoformat(binding["expires_at"]):
                raise CandidateError("STALE_RUN_START_BOUNDARY")
            if snapshot_ref != binding["snapshot_ref"] or binding["actor"] != host[2] or binding["context_id"] != host[1]:
                raise CandidateError("RUN_START_BINDING_MISMATCH")
            actual, chosen = self._next_selection(context, host, activations, snapshot_ref, observed)
            if chosen != binding["activations"]:
                raise CandidateError("RUN_START_BINDING_MISMATCH")
            body = dict(snapshot_ref=snapshot_ref, activations=chosen, scope=json.loads(host[4]),
                        actor=host[2], context_id=host[1], applies_from="NEXT_TASK_OR_RUN", runtime_connected=False,
                        created_at=observed, run_started_at=actual.created_at, run_start_boundary_id=run_start.boundary_id,
                        run_start_hash=binding["content_hash"])
            body["selection_id"] = "selection-" + _hash(body)
            body["content_hash"] = _hash(body)
            run = (host[3], actual.run_id)
            if run in self._run_selections and self._run_selections[run] != body["selection_id"]:
                raise CandidateError("RUN_SELECTION_IMMUTABLE")
            self._run_selections[run] = body["selection_id"]
            self._selections[body["selection_id"]] = (context, _canonical(body))
            record["selection_id"] = body["selection_id"]
            return snapshot(body)

    @boundary
    def register_use(self, context, activation_id, selection_id, *, expected_selection_hash, request_id, now):
        with self._session(context, now) as host:
            key, candidate, activation = self._active(context, host, activation_id, now)
            _text(selection_id)
            _digest(expected_selection_hash)
            selected = self._selections.get(selection_id)
            if selected is None or selected[0] is not context:
                raise CandidateError("ACTIVATION_SELECTION_REQUIRED")
            selection = json.loads(selected[1])
            start = self._run_starts.get(selection["run_start_boundary_id"])
            if start is None or start["context"] is not context or start["selection_id"] != selection_id:
                raise CandidateError("RUN_START_AUTHORITY_REQUIRED")
            if _time(now) < datetime.fromisoformat(selection["created_at"]):
                raise CandidateError("STALE_RUN_START_BOUNDARY")
            expected = dict(activation_id=activation_id, version=activation["version"], content_hash=activation["content_hash"])
            if selection["content_hash"] != expected_selection_hash or expected not in selection["activations"]:
                raise CandidateError("ACTIVATION_REFERENCE_MISMATCH")
            sr = selection["snapshot_ref"]
            actual = self._snapshots.get_task_run(sr["session_id"], sr["task_id"], sr["run_id"], MemoryScope(*host[3]))
            if actual.content_hash != sr["content_hash"] or _time(now) < actual.created_at:
                raise CandidateError("SNAPSHOT_REFERENCE_MISMATCH")
            body = dict(candidate_ref=activation["candidate_ref"], activation_id=activation_id, activation_hash=activation["content_hash"],
                        selection_id=selection_id, selection_hash=selection["content_hash"], snapshot_id=sr["snapshot_id"], snapshot_hash=sr["content_hash"],
                        task_id=sr["task_id"], run_id=sr["run_id"], review_ref=candidate["review_ref"], provenance=candidate["provenance"],
                        scope=candidate["target_scope"], actor=host[2], runtime_connected=False)
            body["content_hash"] = _hash(body)
            request = (id(context), _text(request_id))
            value = ("use", body["content_hash"])
            if request in self._requests and self._requests[request] != value:
                raise CandidateError("CANDIDATE_REPLAY_CONFLICT")
            self._uses[(activation_id, selection_id)] = _canonical(body)
            self._requests[request] = value
            return snapshot(body)

    def _contain(self, context, target, reason, evidence_ref, expected_version, request_id, now, status):
        with self._session(context, now) as host:
            _text(reason)
            _text(evidence_ref)
            key, candidate, state, request, value, replay = self._transition(context, host, target, now, expected_version, request_id, status + _hash([reason, evidence_ref]), ("ACTIVE",) if status == "ROLLED_BACK" else ("PROPOSED", "EVALUATED", "AWAITING_APPROVAL", "APPROVED", "ACTIVE"))
            if not replay:
                self._event(key, status, now, dict(reason=reason, evidence_ref=evidence_ref))
                restore = self._restore_slot(context, host, candidate, now)
                self._impact(key, reason, evidence_ref, now, restore)
                self._requests[request] = value
            return self.query(context, key[1], now=now)

    @boundary
    def rollback(self, context, target, *, reason, evidence_ref, expected_version, request_id, now):
        return self._contain(context, target, reason, evidence_ref, expected_version, request_id, now, "ROLLED_BACK")

    @boundary
    def quarantine(self, context, target, *, reason, evidence_ref, expected_version, request_id, now):
        return self._contain(context, target, reason, evidence_ref, expected_version, request_id, now, "QUARANTINED")

    @boundary
    def sync_sources(self, context, *, now):
        """Host revoke-notification adapter; no queue or Run mutation.

        All subsequent use paths also check live provenance before their effect.
        Query synchronizes every candidate owned by this exact host authority.
        """
        with self._session(context, now) as host:
            owned = []
            for key, owner in self._owners.items():
                if owner[0] is context and owner[1:] == host[1:]:
                    if _time(now) >= datetime.fromisoformat(self._state(key)["created_at"]):
                        self._refresh(key, context, host, now)
                    owned.append(key)
            return snapshot([json.loads(raw) for key in owned for raw in self._impacts.get(key, [])])

    @boundary
    def query(self, context, candidate_id, *, now):
        with self._session(context, now) as host:
            _text(candidate_id)
            key = (host[3], candidate_id)
            if key not in self._records:
                raise CandidateError("CANDIDATE_NOT_FOUND")
            self._owned(key, context, host)
            self.sync_sources(context, now=now)
            candidate = json.loads(self._records[key])
            self._entry(context, host, self._ref(candidate), now, live=False)
            return snapshot(dict(candidate=candidate, state=self._state(key),
                                 evaluation=json.loads(self._evaluations[key]) if key in self._evaluations else None,
                                 approval=json.loads(self._decisions[key]) if key in self._decisions else None,
                                 activations=[json.loads(raw) for raw in self._activations.values() if json.loads(raw)["candidate_ref"] == self._ref(candidate)],
                                 uses=[json.loads(raw) for raw in self._uses.values() if json.loads(raw)["candidate_ref"] == self._ref(candidate)],
                                 impacts=[json.loads(raw) for raw in self._impacts.get(key, [])], events=[json.loads(raw) for raw in self._events[key]]))
