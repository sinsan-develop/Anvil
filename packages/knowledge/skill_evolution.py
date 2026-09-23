"""D08 immutable evolution sidecar; 실제 파일/Hook/runtime/HTTP/DB 실행 없음.

capture_* 는 인증된 host control-plane의 증거/정책/사람 승인 adapter다.
API가 발급하지 않는다. D06 candidate와 D07 before-version을 직접 대조하며,
진화 version은 D02 snapshot에 결박된 별도 next-run selection으로만 기록한다.
D07 consumer 연결은 NOT_INTEGRATED. trusted_auto가 D06 승인을 위조하지 않는다.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import wraps
import difflib
import json
import math
from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _digest
from .candidates import snapshot
from .skills import SkillRepository


class EvolutionError(MemoryError):
    pass


def boundary(fn):
    @wraps(fn)
    def call(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except EvolutionError:
            raise
        except MemoryError as exc:
            raise EvolutionError(exc.reason) from None
        except (KeyError, TypeError, ValueError, IndexError, OverflowError, RecursionError):
            raise EvolutionError("INVALID_EVOLUTION_INPUT") from None
    return call


def fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise EvolutionError("INVALID_EVOLUTION_INPUT")


@boundary
def classify_reason(reason):
    if reason not in {"REUSABLE_NEW", "PROCEDURE_GAP", "BROAD_TRIGGER", "DUPLICATE", "OBSOLETE"}:
        raise EvolutionError("EVOLUTION_CLASSIFICATION_REQUIRED")
    return {"REUSABLE_NEW":"CREATE", "PROCEDURE_GAP":"PATCH", "BROAD_TRIGGER":"SPLIT", "DUPLICATE":"MERGE", "OBSOLETE":"ARCHIVE"}[reason]


@dataclass(frozen=True)
class EvolutionRunStart:
    boundary_id: str
    content_hash: str


class SkillEvolutionRepository:
    def __init__(self, skills):
        if type(skills) is not SkillRepository:
            raise EvolutionError("EVOLUTION_HOST_REQUIRED")
        self._skills, self._candidates = skills, skills._candidates
        self._records, self._owners, self._captures, self._events = {}, {}, {}, {}
        self._requests, self._proofs, self._pilot_captures, self._pilots = {}, {}, {}, {}
        self._evaluations, self._approvals, self._approved, self._policies = {}, {}, {}, {}
        self._heads, self._activations, self._starts, self._runs, self._selections, self._impacts = {}, {}, {}, {}, {}, {}
        self._versions = {}  # Append-only identity ledger; rollback never erases a version hash.

    def _scope(self, host):
        return to_primitive(MemoryScope(*host[3]))

    def _before(self, ctx, host, reference, now):
        fields(reference, "selection_ref skill_ref")
        selection = self._skills._selection(ctx, host, reference["selection_ref"], now)
        material, active = self._skills._material(ctx, host, selection, reference["skill_ref"], now)
        return material["data"], active

    def _draft(self, ctx, host, data, now):
        fields(data, "evolution_id candidate_ref before after reason expected_reuse_scope")
        _text(data["evolution_id"])
        _text(data["expected_reuse_scope"])
        _, origin, _ = self._candidates._entry(ctx, host, data["candidate_ref"], now)
        action = classify_reason(data["reason"])
        if origin["kind"] != "SKILL" or origin["intent"] != action:
            raise EvolutionError("EVOLUTION_ORIGIN_ACTION_MISMATCH")
        if type(data["before"]) is not list or type(data["after"]) is not list or max(len(data["before"]), len(data["after"])) > 20:
            raise EvolutionError("INVALID_EVOLUTION_INPUT")
        before = [self._before(ctx, host, reference, now)[0] for reference in data["before"]]
        after = []
        for document in data["after"]:
            # Syntax/hash validation is not approval: pending documents may request
            # changes, but _authorized below decides who may activate exact bytes.
            if document["scope"] != self._scope(host):
                raise EvolutionError("EVOLUTION_SCOPE_MISMATCH")
            if (document["risk"] not in ("LOW", "MEDIUM", "HIGH") or type(document["capabilities"]) is not list
                    or not set(document["capabilities"]) <= {"READ", "WRITE", "NETWORK", "SECRET", "EXECUTE", "TOOLS"}):
                raise EvolutionError("INVALID_EVOLUTION_PERMISSION_CONTRACT")
            shape = dict(target_id=document["skill_id"], version=document["version"], scope=self._scope(host),
                         risk_delta=dict(risk=document["risk"], capabilities=sorted(document["capabilities"]), implicit_trigger=True, script=True))
            after.append(self._skills._data(document, shape))
        old_ids, new_ids = [x["skill_id"] for x in before], [x["skill_id"] for x in after]
        known_ids = {json.loads(raw)["data"]["skill_id"] for raw in self._skills._materials.values()
                     if json.loads(raw)["capture"]["binding"]["context_id"] == host[1]}
        if (set(new_ids) - set(old_ids)) & known_ids:
            raise EvolutionError("EVOLUTION_EXISTING_SKILL_REQUIRES_BEFORE")
        if len(set(old_ids)) != len(old_ids) or len(set(new_ids)) != len(new_ids):
            raise EvolutionError("EVOLUTION_DUPLICATE_TARGET")
        valid = {"CREATE": not before and len(after) == 1, "PATCH": len(before) == len(after) == 1 and old_ids == new_ids,
                 "SPLIT": len(before) == 1 and len(after) >= 2, "MERGE": len(before) >= 2 and len(after) == 1,
                 "ARCHIVE": bool(before) and not after}[action]
        if not valid or origin["target_id"] not in (old_ids if before else new_ids):
            raise EvolutionError("EVOLUTION_TARGET_SHAPE_MISMATCH")
        for document in after:
            old = next((x for x in before if x["skill_id"] == document["skill_id"]), None)
            if document["version"] != (old["version"] + 1 if old else 1):
                raise EvolutionError("EVOLUTION_VERSION_MISMATCH")
        previous = {x["skill_id"]: dict(skill_id=x["skill_id"], version=x["version"], content_hash=_hash(x), origin="D07") for x in before}
        for name in set(old_ids + new_ids):
            expected = previous.get(name)
            current = self._heads.get((id(ctx), name), expected)
            if current != expected:
                raise EvolutionError("EVOLUTION_HEAD_CHANGED")
        version_change = "MAJOR"
        trusted_safe = False
        if action == "PATCH":
            old, new = before[0], after[0]
            changed = {key for key in old if old[key] != new[key]} - {"version", "body_hash"}
            # There is no structured semantic contract fingerprint in this schema.
            # Exact content inequality, including one character or whitespace, is
            # MAJOR. Never infer equivalence from headings, keywords or language.
            version_change = "MAJOR" if changed & {"description", "body", "capabilities", "scope", "risk", "resources", "resource_contents"} else "MINOR" if changed & {"triggers", "exclusions", "tags"} else "PATCH"
            # No natural-language change has a deterministic non-expansion proof.
            # With this schema only a content-identical version bookkeeping PATCH
            # is eligible; description/body edits always require human approval.
            trusted_safe = (version_change == "PATCH" and not changed and old["risk"] == new["risk"] == "LOW"
                            and set(old["capabilities"]) <= {"READ"})
        result = dict(**json.loads(_canonical(data)), action=action, before_documents=before, previous_heads=previous,
                      baseline_hash=_hash(before), version_change=version_change, trusted_safe=trusted_safe,
                      review_ref=origin["review_ref"], provenance=origin["provenance"], source_roots=origin["source_roots"],
                      origin_run=origin["terminal_subject"]["subject_id"], scope=self._scope(host), actor=host[2], context_id=host[1],
                      diff="".join(difflib.unified_diff(_canonical(before).splitlines(True), _canonical(after).splitlines(True), fromfile="before", tofile="pending-after")))
        return result

    def _capture(self, host, binding, now, expires_at):
        if not _time(now) < _time(expires_at) <= host[6]:
            raise EvolutionError("EVOLUTION_ATTESTATION_STALE")
        return dict(binding=binding, actor=host[2], context_id=host[1], issued_at=_time(now), expires_at=_time(expires_at))

    def _valid_capture(self, raw, host, now, reason):
        if raw is None:
            raise EvolutionError(reason)
        value = json.loads(raw)
        if value["actor"] != host[2] or value["context_id"] != host[1]:
            raise EvolutionError("EVOLUTION_AUTHORITY_MISMATCH")
        if not datetime.fromisoformat(value["issued_at"]) <= _time(now) < datetime.fromisoformat(value["expires_at"]):
            raise EvolutionError("EVOLUTION_ATTESTATION_STALE")
        return value

    def _put_capture(self, store, key, value, now):
        old = json.loads(store[key]) if key in store else None
        if old and (_time(now) < datetime.fromisoformat(old["issued_at"]) or old["binding"] != value["binding"]):
            raise EvolutionError("EVOLUTION_ATTESTATION_REBIND")
        if old and _time(now) < datetime.fromisoformat(old["expires_at"]) and _canonical(old) != _canonical(value):
            raise EvolutionError("EVOLUTION_ATTESTATION_REBIND")
        store[key] = _canonical(value)

    @boundary
    def capture_proposal(self, ctx, data, *, evidence_refs, representative_tasks, now, expires_at):
        with self._candidates._session(ctx, now) as host:
            self._draft(ctx, host, data, now)
            if type(evidence_refs) is not list or len(evidence_refs) < 2 or len(set(evidence_refs)) != len(evidence_refs):
                raise EvolutionError("EVOLUTION_REPEAT_EVIDENCE_REQUIRED")
            for value in evidence_refs:
                _text(value)
            if type(representative_tasks) is not list or not 3 <= len(representative_tasks) <= 100:
                raise EvolutionError("EVOLUTION_REPRESENTATIVE_MANIFEST_REQUIRED")
            for task in representative_tasks:
                fields(task, "task_id content_hash input_hash")
                _text(task["task_id"])
                _digest(task["content_hash"])
                _digest(task["input_hash"])
            for column in ("task_id", "content_hash", "input_hash"):
                if len({task[column] for task in representative_tasks}) != len(representative_tasks):
                    raise EvolutionError("EVOLUTION_REPRESENTATIVE_IDENTITY_REUSED")
            value = self._capture(host, dict(proposal_hash=_hash(data), evidence_refs=sorted(evidence_refs),
                                            representative_tasks=sorted(representative_tasks, key=lambda task: task["task_id"])), now, expires_at)
            self._put_capture(self._captures, (id(ctx), data["evolution_id"]), value, now)
            return snapshot(value)

    def _event(self, key, status, now, evidence=None):
        events = self._events.setdefault(key, [])
        body = dict(status=status, version=len(events) + 1, created_at=_time(now), evidence=evidence,
                    previous_hash=json.loads(events[-1])["content_hash"] if events else None)
        body["content_hash"] = _hash(body)
        events.append(_canonical(body))

    def _entry(self, ctx, host, target, now, *, live=True):
        fields(target, "evolution_id content_hash")
        _text(target["evolution_id"])
        _digest(target["content_hash"])
        key = (id(ctx), target["evolution_id"])
        if key not in self._records or self._owners[key] is not ctx:
            raise EvolutionError("EVOLUTION_AUTHORITY_REQUIRED")
        record = json.loads(self._records[key])
        if record["content_hash"] != target["content_hash"]:
            raise EvolutionError("EVOLUTION_TARGET_HASH_MISMATCH")
        state = json.loads(self._events[key][-1])
        if _time(now) < datetime.fromisoformat(state["created_at"]):
            raise EvolutionError("EVOLUTION_TIME_REGRESSION")
        if live:
            self._candidates._entry(ctx, host, record["candidate_ref"], now)
            for reference in record["before"]:
                self._before(ctx, host, reference, now)
            if state["status"] == "ROLLED_BACK":
                raise EvolutionError("EVOLUTION_ROLLED_BACK")
        return key, record, state

    def _request(self, ctx, request_id, operation, value):
        key = (id(ctx), _text(request_id))
        signature = _hash([operation, value])
        if key in self._requests and self._requests[key] != signature:
            raise EvolutionError("EVOLUTION_REPLAY_CONFLICT")
        return key, signature

    @boundary
    def propose(self, ctx, data, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            draft = self._draft(ctx, host, data, now)
            key = (id(ctx), data["evolution_id"])
            capture = self._valid_capture(self._captures.get(key), host, now, "EVOLUTION_PROPOSAL_ATTESTATION_REQUIRED")
            if capture["binding"]["proposal_hash"] != _hash(data):
                raise EvolutionError("EVOLUTION_PROPOSAL_HASH_MISMATCH")
            request, signature = self._request(ctx, request_id, "propose", data)
            if key in self._records:
                if json.loads(self._records[key])["proposal_hash"] != _hash(data):
                    raise EvolutionError("EVOLUTION_REPLAY_CONFLICT")
                return self.query(ctx, data["evolution_id"], now=now)
            draft.update(proposal_hash=_hash(data), reflection_capture_hash=_hash(capture),
                         representative_tasks=capture["binding"]["representative_tasks"], created_at=_time(now))
            draft["content_hash"] = _hash(draft)
            self._records[key], self._owners[key] = _canonical(draft), ctx
            self._event(key, "PENDING", now)
            self._requests[request] = signature
            return self.query(ctx, data["evolution_id"], now=now)

    @boundary
    def capture_policy(self, ctx, before, *, mode, evidence_ref, now, expires_at):
        with self._candidates._session(ctx, now) as host:
            self._before(ctx, host, before, now)
            if mode not in ("observe_only", "review_required", "trusted_auto"):
                raise EvolutionError("INVALID_EVOLUTION_POLICY")
            _text(evidence_ref)
            value = self._capture(host, dict(before=before, mode=mode, evidence_ref=evidence_ref), now, expires_at)
            key = (id(ctx), _hash(before))
            prior = json.loads(self._policies[key]) if key in self._policies else None
            if prior and _time(now) <= datetime.fromisoformat(prior["issued_at"]) and _canonical(value) != _canonical(prior):
                raise EvolutionError("EVOLUTION_POLICY_STALE")
            self._policies[key] = _canonical(value)
            return snapshot(value)

    def _sample(self, sample, record):
        fields(sample, "case_id target_hash baseline_hash status baseline_quality candidate_quality baseline_cost candidate_cost baseline_precision candidate_precision baseline_recall candidate_recall regression permission_drift evidence_ref")
        _text(sample["case_id"])
        _text(sample["evidence_ref"])
        if sample["target_hash"] != record["content_hash"] or sample["baseline_hash"] != record["baseline_hash"]:
            raise EvolutionError("EVOLUTION_EVIDENCE_TARGET_MISMATCH")
        if sample["status"] not in ("PASS", "FAIL", "SKIPPED", "BLOCKED", "ERROR") or type(sample["regression"]) is not bool or type(sample["permission_drift"]) is not bool:
            raise EvolutionError("INVALID_EVOLUTION_EVIDENCE")
        for metric in ("quality", "cost", "precision", "recall"):
            for label in ("baseline_", "candidate_"):
                value = sample[label + metric]
                if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                    raise EvolutionError("INVALID_EVOLUTION_EVIDENCE")
        return (sample["status"] == "PASS" and not sample["regression"] and not sample["permission_drift"]
                and sample["candidate_cost"] <= sample["baseline_cost"]
                and all(sample["candidate_" + metric] >= sample["baseline_" + metric] for metric in ("quality", "precision", "recall")))

    @boundary
    def capture_evaluation(self, ctx, target, proof, *, now, expires_at):
        with self._candidates._session(ctx, now) as host:
            key, record, _ = self._entry(ctx, host, target, now)
            fields(proof, "target_hash baseline_hash checks replay")
            fields(proof["checks"], "static security secret_scan permission reproducible")
            if proof["target_hash"] != record["content_hash"] or proof["baseline_hash"] != record["baseline_hash"]:
                raise EvolutionError("EVOLUTION_EVIDENCE_TARGET_MISMATCH")
            if type(proof["replay"]) is not list or not 1 <= len(proof["replay"]) <= 100:
                raise EvolutionError("EVOLUTION_REPLAY_REQUIRED")
            if len({item["case_id"] for item in proof["replay"]}) != len(proof["replay"]):
                raise EvolutionError("EVOLUTION_DUPLICATE_CASE")
            for item in proof["replay"]:
                self._sample(item, record)
            value = self._capture(host, proof, now, expires_at)
            self._put_capture(self._proofs, key, value, now)
            return snapshot(value)

    @boundary
    def capture_pilot(self, ctx, target, pilot, *, now, expires_at):
        with self._candidates._session(ctx, now) as host:
            key, record, _ = self._entry(ctx, host, target, now)
            self._pilot(pilot, record)
            for (candidate_key, case_id), raw in self._pilot_captures.items():
                if candidate_key == key and case_id != pilot["case_id"]:
                    self._independent_pilots([json.loads(raw)["binding"], pilot])
            value = self._capture(host, pilot, now, expires_at)
            self._put_capture(self._pilot_captures, (key, pilot["case_id"]), value, now)
            return snapshot(value)

    def _pilot(self, pilot, record):
        fields(pilot, "case_id target_hash baseline_hash status baseline_quality candidate_quality baseline_cost candidate_cost baseline_precision candidate_precision baseline_recall candidate_recall regression permission_drift evidence_ref task_ref run_ref evidence_hash")
        fields(pilot["task_ref"], "task_id content_hash input_hash")
        fields(pilot["run_ref"], "run_id content_hash")
        _text(pilot["run_ref"]["run_id"])
        _digest(pilot["run_ref"]["content_hash"])
        _digest(pilot["evidence_hash"])
        if pilot["task_ref"] not in record["representative_tasks"]:
            raise EvolutionError("EVOLUTION_REPRESENTATIVE_TASK_MISMATCH")
        return self._sample({key:value for key,value in pilot.items() if key not in ("task_ref", "run_ref", "evidence_hash")}, record)

    @staticmethod
    def _independent_pilots(pilots):
        columns = [(item["case_id"], item["task_ref"]["task_id"], item["task_ref"]["content_hash"],
                    item["task_ref"]["input_hash"], item["run_ref"]["run_id"], item["run_ref"]["content_hash"],
                    item["evidence_ref"], item["evidence_hash"]) for item in pilots]
        if any(len(set(values)) != len(columns) for values in zip(*columns)):
            raise EvolutionError("EVOLUTION_PILOT_IDENTITY_REUSED")

    @boundary
    def record_pilot(self, ctx, target, pilot_id, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            key, _, state = self._entry(ctx, host, target, now)
            if state["status"] not in ("PENDING", "EVALUATED"):
                raise EvolutionError("EVOLUTION_INVALID_TRANSITION")
            value = self._valid_capture(self._pilot_captures.get((key, _text(pilot_id))), host, now, "EVOLUTION_PILOT_ATTESTATION_REQUIRED")
            request, signature = self._request(ctx, request_id, "pilot", [target, pilot_id, _hash(value)])
            self._pilots[(key, pilot_id)] = _canonical(value)
            self._requests[request] = signature
            return snapshot(value)

    def _evidence(self, key, record, host, now):
        proof = self._valid_capture(self._proofs.get(key), host, now, "EVOLUTION_EVIDENCE_NOT_PASS")
        pilots = [self._valid_capture(raw, host, now, "EVOLUTION_EVIDENCE_NOT_PASS") for (candidate, _), raw in self._pilots.items() if candidate == key]
        binding = proof["binding"]
        for pilot in pilots:
            self._pilot(pilot["binding"], record)
        self._independent_pilots([pilot["binding"] for pilot in pilots])
        passed = (all(value == "PASS" for value in binding["checks"].values())
                  and all(self._sample(item, record) for item in binding["replay"])
                  and len(pilots) >= 3 and all(self._pilot(item["binding"], record) for item in pilots))
        return dict(passed=passed, proof_hash=_hash(proof), pilots=sorted(_hash(item) for item in pilots), baseline_hash=record["baseline_hash"], target_hash=record["content_hash"])

    @boundary
    def evaluate(self, ctx, target, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            key, record, state = self._entry(ctx, host, target, now)
            if state["status"] not in ("PENDING", "EVALUATED"):
                raise EvolutionError("EVOLUTION_INVALID_TRANSITION")
            result = self._evidence(key, record, host, now)
            request, signature = self._request(ctx, request_id, "evaluate", [target, result])
            result["content_hash"] = _hash(result)
            if self._evaluations.get(key) != _canonical(result):
                self._evaluations[key] = _canonical(result)
                self._event(key, "EVALUATED", now, result["content_hash"])
            self._requests[request] = signature
            return snapshot(result)

    def _ready(self, key, record, host, now):
        evidence = self._evidence(key, record, host, now)
        evidence["content_hash"] = _hash(evidence)
        if not evidence["passed"] or self._evaluations.get(key) != _canonical(evidence):
            raise EvolutionError("EVOLUTION_EVIDENCE_NOT_PASS")
        return evidence

    @boundary
    def capture_human_approval(self, ctx, target, *, status, evidence_ref, now, expires_at):
        with self._candidates._session(ctx, now) as host:
            key, record, state = self._entry(ctx, host, target, now)
            if status not in ("APPROVED", "REVOKED"):
                raise EvolutionError("INVALID_EVOLUTION_APPROVAL")
            evidence = self._ready(key, record, host, now)
            _text(evidence_ref)
            value = self._capture(host, dict(target=target, evaluation_hash=evidence["content_hash"], status=status, evidence_ref=evidence_ref), now, expires_at)
            old = json.loads(self._approvals[key]) if key in self._approvals else None
            if old and _time(now) <= datetime.fromisoformat(old["issued_at"]) and _canonical(old) != _canonical(value):
                raise EvolutionError("EVOLUTION_APPROVAL_STALE")
            self._approvals[key] = _canonical(value)
            return snapshot(value)

    @boundary
    def approve(self, ctx, target, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            key, record, state = self._entry(ctx, host, target, now)
            evidence = self._ready(key, record, host, now)
            approval = self._valid_capture(self._approvals.get(key), host, now, "EVOLUTION_HUMAN_APPROVAL_REQUIRED")
            if approval["binding"]["target"] != target or approval["binding"]["status"] != "APPROVED" or approval["binding"]["evaluation_hash"] != evidence["content_hash"]:
                raise EvolutionError("EVOLUTION_HUMAN_APPROVAL_REQUIRED")
            request, signature = self._request(ctx, request_id, "approve", [target, _hash(approval)])
            if state["status"] not in ("EVALUATED", "APPROVED"):
                raise EvolutionError("EVOLUTION_INVALID_TRANSITION")
            if self._approved.get(key) != _hash(approval):
                self._approved[key] = _hash(approval)
                self._event(key, "APPROVED", now, _hash(approval))
            self._requests[request] = signature
            return self.query(ctx, target["evolution_id"], now=now)

    def _authorized(self, key, record, host, now):
        approval_raw = self._approvals.get(key)
        if approval_raw is not None:
            approval = self._valid_capture(approval_raw, host, now, "EVOLUTION_HUMAN_APPROVAL_REQUIRED")
            if approval["binding"]["status"] != "APPROVED" or self._approved.get(key) != _hash(approval):
                raise EvolutionError("EVOLUTION_HUMAN_APPROVAL_REQUIRED")
            return "human", _hash(approval)
        if record["action"] == "PATCH" and record["trusted_safe"] and len(record["before"]) == 1:
            raw = self._policies.get((key[0], _hash(record["before"][0])))
            if raw is not None:
                policy = self._valid_capture(raw, host, now, "EVOLUTION_HUMAN_APPROVAL_REQUIRED")
                if policy["binding"]["mode"] == "trusted_auto":
                    return "trusted_auto", _hash(policy)
        raise EvolutionError("EVOLUTION_HUMAN_APPROVAL_REQUIRED")

    @boundary
    def activate(self, ctx, target, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            key, record, state = self._entry(ctx, host, target, now)
            evidence = self._ready(key, record, host, now)
            mode, authority_hash = self._authorized(key, record, host, now)
            self._current_materials(ctx, host, record, now)
            request, signature = self._request(ctx, request_id, "activate", [target, authority_hash])
            if key in self._activations:
                active = json.loads(self._activations[key])
                if active["authority_hash"] != authority_hash:
                    raise EvolutionError("EVOLUTION_APPROVAL_STALE")
                self._active(ctx, host, active, now)
                self._requests[request] = signature
                return snapshot(active)
            touched = set(record["previous_heads"]) | {x["skill_id"] for x in record["after"]}
            previous = {name:self._heads.get((id(ctx),name), record["previous_heads"].get(name)) for name in touched}
            if previous != {name:record["previous_heads"].get(name) for name in touched}:
                raise EvolutionError("EVOLUTION_HEAD_CHANGED")
            versions = [dict(skill_id=x["skill_id"], version=x["version"], content_hash=_hash(x)) for x in record["after"]]
            for version in versions:
                old_hash = self._versions.get((id(ctx), version["skill_id"], version["version"]))
                if old_hash is not None and old_hash != version["content_hash"]:
                    raise EvolutionError("EVOLUTION_VERSION_REBOUND")
            body = dict(target=target, status="ACTIVE", action=record["action"], versions=versions, previous_heads=previous,
                        authority_hash=authority_hash, approval_mode=mode, evaluation_hash=evidence["content_hash"], actor=host[2], context_id=host[1],
                        created_at=_time(now), applies_from="NEXT_TASK_OR_RUN", consumer_integrated=False)
            body["activation_id"] = "evolution-activation-" + _hash(body)
            body["content_hash"] = _hash(body)
            for version in versions:
                self._versions[(id(ctx), version["skill_id"], version["version"])] = version["content_hash"]
            for name in touched:
                self._heads[(id(ctx),name)] = dict(activation_id=body["activation_id"], version=next((x for x in versions if x["skill_id"] == name), None))
            self._activations[key] = _canonical(body)
            self._event(key, "ACTIVE", now, body["content_hash"])
            self._requests[request] = signature
            return snapshot(body)

    def _current_materials(self, ctx, host, record, now):
        touched = set(record["previous_heads"]) | {item["skill_id"] for item in record["after"]}
        current = {name:set() for name in touched}
        for raw in self._skills._materials.values():
            material = json.loads(raw)
            binding = material["capture"]["binding"]
            name = material["data"]["skill_id"]
            if name not in touched or binding["scope"] != self._scope(host):
                continue
            if binding["context_id"] != host[1]:
                raise EvolutionError("EVOLUTION_CURRENT_MATERIAL_CHANGED")
            try:
                self._candidates._active(ctx, host, binding["activation_ref"]["activation_id"], now)
            except MemoryError:
                continue  # Historical inactive versions are not the current catalog.
            if _hash(material["data"]) != binding["skill_ref"]["content_hash"]:
                raise EvolutionError("EVOLUTION_CURRENT_MATERIAL_CHANGED")
            current[name].add(_canonical(binding["skill_ref"]))
        expected = {item["skill_ref"]["skill_id"]:_canonical(item["skill_ref"]) for item in record["before"]}
        for name in touched:
            wanted = {expected[name]} if name in expected else set()
            if current[name] != wanted:
                raise EvolutionError("EVOLUTION_CURRENT_MATERIAL_CHANGED")
        for reference, pinned in zip(record["before"], record["before_documents"]):
            actual, _ = self._before(ctx, host, reference, now)
            if actual != pinned:
                raise EvolutionError("EVOLUTION_CURRENT_MATERIAL_CHANGED")

    def _active(self, ctx, host, active, now):
        key, record, state = self._entry(ctx, host, active["target"], now)
        if self._activations.get(key) != _canonical(active) or state["status"] != "ACTIVE":
            raise EvolutionError("EVOLUTION_ACTIVATION_MISMATCH")
        if _time(now) < datetime.fromisoformat(active["created_at"]):
            raise EvolutionError("EVOLUTION_TIME_REGRESSION")
        self._ready(key, record, host, now)
        self._current_materials(ctx, host, record, now)
        _, authority = self._authorized(key, record, host, now)
        if authority != active["authority_hash"] or any(self._heads.get((id(ctx),name), {}).get("activation_id") != active["activation_id"] for name in active["previous_heads"]):
            raise EvolutionError("EVOLUTION_HEAD_CHANGED")
        return key, record

    @boundary
    def capture_run_start(self, ctx, activation, snapshot_ref, *, now):
        with self._candidates._session(ctx, now) as host:
            key, record = self._active(ctx, host, activation, now)
            fields(snapshot_ref, "session_id task_id run_id snapshot_id content_hash")
            actual = self._candidates._snapshots.get_task_run(snapshot_ref["session_id"], snapshot_ref["task_id"], snapshot_ref["run_id"], MemoryScope(*host[3]))
            observed = _time(self._candidates._run_clock())
            if (actual.snapshot_id != snapshot_ref["snapshot_id"] or actual.content_hash != snapshot_ref["content_hash"]
                    or actual.run_id == record["origin_run"] or actual.created_at <= datetime.fromisoformat(activation["created_at"])
                    or not actual.created_at <= _time(now) <= observed < min(actual.created_at + timedelta(seconds=5), host[6])):
                raise EvolutionError("EVOLUTION_RUN_START_STALE")
            run_key = (id(ctx), actual.run_id)
            if run_key in self._runs:
                raise EvolutionError("EVOLUTION_RUN_START_CONSUMED")
            body = dict(activation=activation, snapshot_ref=snapshot_ref, actor=host[2], context_id=host[1], observed_at=observed,
                        starts_at=actual.created_at, expires_at=min(actual.created_at+timedelta(seconds=5),host[6]))
            identity = "evolution-start-" + _hash(body)
            cap = EvolutionRunStart(identity, _hash(body))
            self._starts[identity] = (cap, ctx, _canonical(body))
            self._runs[run_key] = None
            return cap

    @boundary
    def select_next_run(self, ctx, boundary_ref, *, now):
        with self._candidates._session(ctx, now) as host:
            if type(boundary_ref) is not EvolutionRunStart:
                raise EvolutionError("EVOLUTION_RUN_START_AUTHORITY_REQUIRED")
            entry = self._starts.get(boundary_ref.boundary_id)
            if not entry or entry[0] is not boundary_ref or entry[1] is not ctx:
                raise EvolutionError("EVOLUTION_RUN_START_AUTHORITY_REQUIRED")
            body = json.loads(entry[2])
            if _hash(body) != boundary_ref.content_hash:
                raise EvolutionError("EVOLUTION_RUN_START_AUTHORITY_REQUIRED")
            key, record = self._active(ctx, host, body["activation"], now)
            observed = _time(self._candidates._run_clock())
            if not datetime.fromisoformat(body["observed_at"]) <= _time(now) <= observed < datetime.fromisoformat(body["expires_at"]):
                raise EvolutionError("EVOLUTION_RUN_START_STALE")
            sr = body["snapshot_ref"]
            run_key = (id(ctx), sr["run_id"])
            if self._runs[run_key] is not None:
                raise EvolutionError("EVOLUTION_RUN_START_CONSUMED")
            result = dict(activation_id=body["activation"]["activation_id"], target=body["activation"]["target"],
                          snapshot_ref=sr, run_id=sr["run_id"], task_id=sr["task_id"], versions=body["activation"]["versions"],
                          actor=host[2], context_id=host[1], created_at=observed, run_started_at=body["starts_at"],
                          boundary_hash=boundary_ref.content_hash, consumer_integrated=False)
            result["selection_id"] = "evolution-selection-" + _hash(result)
            result["content_hash"] = _hash(result)
            self._selections[result["selection_id"]] = _canonical(result)
            self._runs[run_key] = result["selection_id"]
            return snapshot(result)

    @boundary
    def rollback(self, ctx, target, *, evidence_ref, request_id, now):
        with self._candidates._session(ctx, now) as host:
            key, record, state = self._entry(ctx, host, target, now, live=False)
            _text(evidence_ref)
            request, signature = self._request(ctx, request_id, "rollback", [target, evidence_ref])
            if state["status"] == "ROLLED_BACK" and self._requests.get(request) == signature:
                return self.query(ctx, target["evolution_id"], now=now)
            if state["status"] != "ACTIVE":
                raise EvolutionError("EVOLUTION_INVALID_TRANSITION")
            active = json.loads(self._activations[key])
            if any(self._heads.get((id(ctx), name), {}).get("activation_id") != active["activation_id"] for name in active["previous_heads"]):
                raise EvolutionError("EVOLUTION_HEAD_CHANGED")
            for name, previous in active["previous_heads"].items():
                if previous is None:
                    self._heads.pop((id(ctx),name), None)
                else:
                    self._heads[(id(ctx),name)] = previous
            affected = sorted(json.loads(raw)["run_id"] for raw in self._selections.values() if json.loads(raw)["activation_id"] == active["activation_id"])
            impact = dict(affected_runs=affected, evidence_ref=evidence_ref, restore_snapshot_hash=_hash(active["previous_heads"]),
                          counterexample_target=target, runtime_action="REPORT_ONLY", created_at=_time(now))
            impact["content_hash"] = _hash(impact)
            self._impacts.setdefault(key, []).append(_canonical(impact))
            self._event(key, "ROLLED_BACK", now, impact["content_hash"])
            self._requests[request] = signature
            return self.query(ctx, target["evolution_id"], now=now)

    @boundary
    def query(self, ctx, evolution_id, *, now):
        with self._candidates._session(ctx, now) as host:
            key = (id(ctx), _text(evolution_id))
            if key not in self._records or self._owners[key] is not ctx:
                raise EvolutionError("EVOLUTION_AUTHORITY_REQUIRED")
            record = json.loads(self._records[key])
            self._entry(ctx, host, dict(evolution_id=evolution_id, content_hash=record["content_hash"]), now, live=False)
            active = json.loads(self._activations[key]) if key in self._activations else None
            return snapshot(dict(candidate=record, state=json.loads(self._events[key][-1]), events=[json.loads(raw) for raw in self._events[key]],
                                 evaluation=json.loads(self._evaluations[key]) if key in self._evaluations else None,
                                 activations=[active] if active else [], impacts=[json.loads(raw) for raw in self._impacts.get(key,[])],
                                 selections=[json.loads(raw) for raw in self._selections.values() if active and json.loads(raw)["activation_id"] == active["activation_id"]]))
