"""D-07 순수 in-memory progressive Skill loader; 파일/스크립트 실행 없음.

capture_materialization은 인증된 host의 materialization 검증 경계다. Host는
승인된 candidate action/target에 해당하는 정확한 bytes를 검증하여 전달한다.
Agent/API에는 이 메서드를 노출하지 않는다. 본 모듈은 사람 승인을 생성하지
않으며 D-06의 실제 ACTIVE/next-run 정본과 매번 대조한다. 본문 resource manifest는
단 하나의 `anvil-resources` fenced JSON 배열(path/kind/content_hash)이다.
저장은 JSON 문자열, 모든 반환값은 독립 immutable snapshot이다.
"""
from datetime import datetime
from functools import wraps
from hashlib import sha256
import json
import re

from .candidates import CandidateRepository, snapshot
from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _digest, _integer, _scan_body_credentials


class SkillError(MemoryError):
    pass


_SCRIPT_SUFFIXES = frozenset(("py", "pyw", "sh", "bash", "zsh", "ps1", "bat", "cmd", "js", "mjs", "cjs", "ts", "exe", "com"))


def boundary(function):
    @wraps(function)
    def guarded(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except SkillError:
            raise
        except MemoryError as error:
            raise SkillError(error.reason) from None
        except (TypeError, ValueError, KeyError, IndexError, OverflowError, RecursionError):
            raise SkillError("INVALID_SKILL_INPUT") from None
    return guarded


def fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise SkillError("INVALID_SKILL_INPUT")


def content_digest(value):
    if type(value) is not str or not value.strip() or len(value.encode("utf-8")) > 262144:
        raise SkillError("INVALID_SKILL_CONTENT")
    _scan_body_credentials(value)
    return sha256(value.encode("utf-8")).hexdigest()


def resource_path(value):
    _text(value)
    parts = value.split("/")
    if (len(value) > 240 or any(re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*", part) is None
                              or part.endswith(".") or re.fullmatch(r"(?i)(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?", part)
                              for part in parts)):
        raise SkillError("UNSAFE_SKILL_RESOURCE_PATH")
    return value


def resource_ref(value):
    fields(value, "path kind content_hash")
    resource_path(value["path"])
    if value["kind"] not in ("reference", "script", "example"):
        raise SkillError("INVALID_SKILL_RESOURCE_KIND")
    _digest(value["content_hash"])
    return dict(value)


def requires_script_approval(resource):
    # A reference/example label must not turn an obvious script path into READ-only approval.
    return resource["kind"] == "script" or resource["path"].rsplit(".", 1)[-1].casefold() in _SCRIPT_SUFFIXES


class SkillRepository:
    def __init__(self, candidates):
        if type(candidates) is not CandidateRepository:
            raise SkillError("SKILL_HOST_REQUIRED")
        self._candidates = candidates
        # D-06 _session owns the shared reentrant authority/lineage lock order.
        self._materials, self._identities, self._invocations = {}, {}, {}
        self._requests, self._l1, self._l2, self._uses, self._events = {}, {}, {}, {}, {}

    def _selection(self, context, host, selection_ref, now):
        fields(selection_ref, "selection_id content_hash")
        _text(selection_ref["selection_id"])
        _digest(selection_ref["content_hash"])
        stored = self._candidates._selections.get(selection_ref["selection_id"])
        if stored is None or stored[0] is not context:
            raise SkillError("SKILL_SELECTION_AUTHORITY_REQUIRED")
        selected = json.loads(stored[1])
        if selected["content_hash"] != selection_ref["content_hash"]:
            raise SkillError("SKILL_SELECTION_MISMATCH")
        start = self._candidates._run_starts.get(selected["run_start_boundary_id"])
        if (start is None or start["context"] is not context or start["selection_id"] != selected["selection_id"]
                or selected["actor"] != host[2] or selected["context_id"] != host[1]
                or selected["scope"] != to_primitive(MemoryScope(*host[3]))):
            raise SkillError("SKILL_SELECTION_AUTHORITY_REQUIRED")
        sr = selected["snapshot_ref"]
        actual = self._candidates._snapshots.get_task_run(sr["session_id"], sr["task_id"], sr["run_id"], MemoryScope(*host[3]))
        if actual.snapshot_id != sr["snapshot_id"] or actual.content_hash != sr["content_hash"]:
            raise SkillError("SKILL_SELECTION_MISMATCH")
        if _time(now) < datetime.fromisoformat(selected["created_at"]) or _time(now) < actual.created_at:
            raise SkillError("SKILL_SELECTION_STALE")
        return selected

    def _activation(self, context, host, activation_ref, selection, now):
        fields(activation_ref, "activation_id version content_hash")
        _text(activation_ref["activation_id"])
        _integer(activation_ref["version"])
        _digest(activation_ref["content_hash"])
        _, candidate, active = self._candidates._active(context, host, activation_ref["activation_id"], now)
        expected = {key: active[key] for key in ("activation_id", "version", "content_hash")}
        if expected != activation_ref or expected not in selection["activations"]:
            raise SkillError("SKILL_SELECTION_MISMATCH")
        if candidate["kind"] != "SKILL" or active["kind"] != "SKILL" or candidate["selector"]["field"] != "candidate_actions":
            raise SkillError("SKILL_ACTIVATION_REQUIRED")
        return candidate, active

    def _data(self, data, active):
        fields(data, "skill_id name version description tags scope triggers exclusions risk capabilities body body_hash resources resource_contents")
        for key in ("skill_id", "name", "description"):
            _text(data[key])
        _integer(data["version"])
        for key in ("tags", "triggers", "exclusions", "capabilities"):
            if type(data[key]) is not list or len(data[key]) > 64 or len(data[key]) != len(set(data[key])):
                raise SkillError("INVALID_SKILL_INPUT")
            for item in data[key]:
                _text(item)
        if (data["skill_id"] != active["target_id"] or data["name"] != active["target_id"]
                or data["version"] != active["version"] or data["scope"] != active["scope"]
                or data["risk"] != active["risk_delta"]["risk"]
                or sorted(data["capabilities"]) != active["risk_delta"]["capabilities"]):
            raise SkillError("SKILL_ACTIVATION_MISMATCH")
        if data["triggers"] and active["risk_delta"]["implicit_trigger"] is not True:
            raise SkillError("SKILL_IMPLICIT_EXPANSION_UNAPPROVED")
        if content_digest(data["body"]) != _digest(data["body_hash"]):
            raise SkillError("SKILL_CONTENT_HASH_MISMATCH")
        if type(data["resources"]) is not list or len(data["resources"]) > 64 or type(data["resource_contents"]) is not dict:
            raise SkillError("INVALID_SKILL_INPUT")
        resources = [resource_ref(item) for item in data["resources"]]
        if active["risk_delta"]["script"] is not True and any(requires_script_approval(item) for item in resources):
            raise SkillError("SKILL_SCRIPT_EXPANSION_UNAPPROVED")
        paths = [item["path"] for item in resources]
        if len({path.casefold() for path in paths}) != len(paths) or set(paths) != set(data["resource_contents"]):
            raise SkillError("SKILL_RESOURCE_MANIFEST_MISMATCH")
        declarations = re.findall(r"(?m)^```anvil-resources\r?\n(.*?)\r?\n```[ \t]*(?:\r?\n|$)", data["body"], re.DOTALL)
        if len(declarations) != 1 or json.loads(declarations[0]) != resources:
            raise SkillError("SKILL_RESOURCE_MANIFEST_MISMATCH")
        for item in resources:
            if content_digest(data["resource_contents"][item["path"]]) != item["content_hash"]:
                raise SkillError("SKILL_CONTENT_HASH_MISMATCH")
        return json.loads(_canonical(data))

    @boundary
    def capture_materialization(self, context, activation_ref, selection_ref, data, *, evidence_ref, now, expires_at):
        """Trusted host only. Immutable identity cannot be revised by renewing capture."""
        with self._candidates._session(context, now) as host:
            selected = self._selection(context, host, selection_ref, now)
            candidate, active = self._activation(context, host, activation_ref, selected, now)
            data = self._data(data, active)
            _text(evidence_ref)
            expiry = _time(expires_at)
            if not _time(now) < expiry <= min(host[6], datetime.fromisoformat(active["expires_at"])):
                raise SkillError("SKILL_MATERIALIZATION_STALE")
            material_hash = _hash(data)
            identity = (id(context), active["activation_id"])
            if identity in self._identities and self._identities[identity] != material_hash:
                raise SkillError("SKILL_MATERIALIZATION_REBIND")
            reference = dict(skill_id=data["skill_id"], version=data["version"], content_hash=material_hash, activation_id=active["activation_id"])
            binding = dict(skill_ref=reference, activation_ref=activation_ref, selection_ref=selection_ref,
                           candidate_ref=active["candidate_ref"], review_ref=candidate["review_ref"], action_selector=candidate["selector"],
                           provenance=candidate["provenance"], source_roots=candidate["source_roots"], scope=active["scope"],
                           actor=host[2], context_id=host[1], body_hash=data["body_hash"], resources=data["resources"])
            key = (selected["selection_id"], active["activation_id"])
            old = json.loads(self._materials[key]) if key in self._materials else None
            capture = dict(binding=binding, evidence_ref=evidence_ref, issued_at=_time(now), expires_at=expiry)
            if old:
                prior = old["capture"]
                if _time(now) < datetime.fromisoformat(prior["issued_at"]):
                    raise SkillError("SKILL_MATERIALIZATION_STALE")
                if prior["binding"] != binding:
                    raise SkillError("SKILL_MATERIALIZATION_REBIND")
                if _time(now) < datetime.fromisoformat(prior["expires_at"]):
                    if _canonical(capture) != _canonical(prior):
                        raise SkillError("SKILL_MATERIALIZATION_REBIND")
                    return snapshot(reference)
            self._identities[identity] = material_hash
            self._materials[key] = _canonical(dict(data=data, capture=capture, capture_hash=_hash(capture)))
            return snapshot(reference)

    def _material(self, context, host, selection, reference, now):
        fields(reference, "skill_id version content_hash activation_id")
        _text(reference["skill_id"])
        _integer(reference["version"])
        _digest(reference["content_hash"])
        _text(reference["activation_id"])
        raw = self._materials.get((selection["selection_id"], reference["activation_id"]))
        if raw is None:
            raise SkillError("SKILL_MATERIALIZATION_REQUIRED")
        value = json.loads(raw)
        capture = value["capture"]
        if capture["binding"]["skill_ref"] != reference or _hash(value["data"]) != reference["content_hash"]:
            raise SkillError("SKILL_REFERENCE_MISMATCH")
        if (capture["binding"]["actor"] != host[2] or capture["binding"]["context_id"] != host[1]
                or capture["binding"]["selection_ref"] != dict(selection_id=selection["selection_id"], content_hash=selection["content_hash"])):
            raise SkillError("SKILL_MATERIALIZATION_AUTHORITY_REQUIRED")
        if not datetime.fromisoformat(capture["issued_at"]) <= _time(now) < datetime.fromisoformat(capture["expires_at"]):
            raise SkillError("SKILL_MATERIALIZATION_STALE")
        _, active = self._activation(context, host, capture["binding"]["activation_ref"], selection, now)
        return value, active

    @staticmethod
    def _summary(value):
        data = value["data"]
        return dict(**{k: data[k] for k in ("name", "description", "tags", "scope", "version", "triggers", "exclusions", "risk", "capabilities")},
                    status="ACTIVE", invocation_policy="EXPLICIT_ONLY_NO_APPROVED_TRIGGER_MANIFEST",
                    content_hash=value["capture"]["binding"]["skill_ref"]["content_hash"], skill_ref=value["capture"]["binding"]["skill_ref"])

    def _catalog(self, context, host, selected, scope, now):
        if to_primitive(scope) != to_primitive(MemoryScope(*host[3])):
            raise SkillError("SKILL_SCOPE_MISMATCH")
        items = []
        for key in sorted(self._materials):
            if key[0] != selected["selection_id"]:
                continue
            value = json.loads(self._materials[key])
            try:
                value, _ = self._material(context, host, selected, value["capture"]["binding"]["skill_ref"], now)
            except MemoryError:
                continue  # Revoked/stale material is never emitted as an available Skill.
            items.append(self._summary(value))
        return sorted(items, key=lambda item: (item["name"], item["version"], item["content_hash"]))

    @staticmethod
    def _budget(items, budget):
        if type(budget) is not int or not 64 <= budget <= 2000:
            raise SkillError("INVALID_SKILL_BUDGET")
        kept = list(items)
        while True:
            result = dict(items=kept, truncated=len(kept) < len(items), omitted_count=len(items) - len(kept), token_budget=budget, token_count=0)
            # Count the complete response, including its own token count field.
            for _ in range(3):
                result["token_count"] = (len(_canonical(result).encode("utf-8")) + 3) // 4
            if result["token_count"] <= budget:
                return result
            if not kept:
                raise SkillError("INVALID_SKILL_BUDGET")
            kept.pop()

    @boundary
    def catalog(self, context, selection_ref, *, scope, now, budget=2000):
        with self._candidates._session(context, now) as host:
            selected = self._selection(context, host, selection_ref, now)
            return snapshot(self._budget(self._catalog(context, host, selected, scope, now), budget))

    @staticmethod
    def _implicit(data, active, task):
        # D-06 approves risk_delta booleans but has no exact trigger/exclusion/
        # body/resource manifest in its human-approved candidate/evaluation schema.
        # Host materialization attestation is NOT that missing human approval.
        # Until the owning approval contract supplies it, even implicit_trigger=True
        # cannot authorize implicit selection. No payload escape hatch is provided.
        return False

    @boundary
    def match(self, context, selection_ref, *, scope, task, limit, now):
        with self._candidates._session(context, now) as host:
            _text(task)
            if type(limit) is not int or not 1 <= limit <= 20:
                raise SkillError("INVALID_SKILL_LIMIT")
            selected = self._selection(context, host, selection_ref, now)
            available = self._budget(self._catalog(context, host, selected, scope, now), 2000)
            matches = []
            for item in available["items"]:
                value, active = self._material(context, host, selected, item["skill_ref"], now)
                if self._implicit(value["data"], active, task):
                    matches.append(item)
            result = self._budget(matches[:limit], 2000)
            result["truncated"] = available["truncated"] or len(matches) > limit
            return snapshot(result)

    def _event(self, selection_id, kind, receipt, now):
        events = self._events.setdefault(selection_id, [])
        body = dict(sequence=len(events) + 1, kind=kind, receipt_hash=receipt["content_hash"], created_at=_time(now),
                    previous_hash=json.loads(events[-1])["content_hash"] if events else None)
        body["content_hash"] = _hash(body)
        events.append(_canonical(body))

    def _event_time(self, selection_id, now):
        history = self._events.get(selection_id, [])
        if history and _time(now) < datetime.fromisoformat(json.loads(history[-1])["created_at"]):
            raise SkillError("SKILL_EVENT_TIME_REGRESSION")

    @boundary
    def select(self, context, selection_ref, skill_ref, *, task, mode, request_id, now):
        with self._candidates._session(context, now) as host:
            selected = self._selection(context, host, selection_ref, now)
            value, active = self._material(context, host, selected, skill_ref, now)
            self._event_time(selected["selection_id"], now)
            _text(task)
            _text(request_id)
            if mode not in ("implicit", "explicit"):
                raise SkillError("INVALID_SKILL_INVOCATION_MODE")
            if mode == "implicit" and not self._implicit(value["data"], active, task):
                raise SkillError("IMPLICIT_SKILL_DENIED")
            body = dict(selection_ref=selection_ref, skill_ref=skill_ref, task=task, mode=mode,
                        reason="EXPLICIT_INVOCATION" if mode == "explicit" else "TRIGGER_MATCH_LOW_RISK_READ_ONLY",
                        actor=host[2], context_id=host[1], capture_hash=value["capture_hash"])
            signature = _hash(body)
            key = (id(context), _text(request_id))
            if key in self._requests:
                old_signature, invocation_id = self._requests[key]
                if old_signature != signature:
                    raise SkillError("SKILL_REPLAY_CONFLICT")
                return snapshot(json.loads(self._invocations[invocation_id]))
            body["created_at"] = _time(now)
            body["invocation_id"] = "skill-invocation-" + _hash(body)
            body["content_hash"] = _hash(body)
            if body["invocation_id"] not in self._invocations:
                self._invocations[body["invocation_id"]] = _canonical(body)
                self._event(selected["selection_id"], "SELECTED", body, now)
            self._requests[key] = (signature, body["invocation_id"])
            return snapshot(body)

    def _invocation(self, context, host, reference, now):
        fields(reference, "invocation_id content_hash")
        _text(reference["invocation_id"])
        _digest(reference["content_hash"])
        raw = self._invocations.get(reference["invocation_id"])
        if raw is None:
            raise SkillError("SKILL_INVOCATION_REQUIRED")
        invocation = json.loads(raw)
        if invocation["actor"] != host[2] or invocation["context_id"] != host[1] or invocation["content_hash"] != reference["content_hash"]:
            raise SkillError("SKILL_INVOCATION_AUTHORITY_REQUIRED")
        selected = self._selection(context, host, invocation["selection_ref"], now)
        material, _ = self._material(context, host, selected, invocation["skill_ref"], now)
        if material["capture_hash"] != invocation["capture_hash"] or _time(now) < datetime.fromisoformat(invocation["created_at"]):
            raise SkillError("SKILL_INVOCATION_STALE")
        self._event_time(selected["selection_id"], now)
        return invocation, selected, material

    @boundary
    def load_l1(self, context, invocation_ref, *, now):
        with self._candidates._session(context, now) as host:
            invocation, selected, material = self._invocation(context, host, invocation_ref, now)
            identity = invocation["invocation_id"]
            if identity not in self._l1:
                lineage = self._candidates.register_use(context, invocation["skill_ref"]["activation_id"], selected["selection_id"],
                                                       expected_selection_hash=selected["content_hash"], request_id="d07-" + identity, now=now)
                body = dict(invocation_ref=invocation_ref, body=material["data"]["body"], body_hash=material["data"]["body_hash"],
                            lineage_hash=lineage["content_hash"], created_at=_time(now), executed=False)
                body["content_hash"] = _hash(body)
                self._l1[identity] = _canonical(body)
                self._event(selected["selection_id"], "L1_LOADED", body, now)
            return snapshot(json.loads(self._l1[identity]))

    @boundary
    def load_l2(self, context, invocation_ref, *, path, kind, content_hash, now):
        with self._candidates._session(context, now) as host:
            invocation, selected, material = self._invocation(context, host, invocation_ref, now)
            identity = invocation["invocation_id"]
            if identity not in self._l1:
                raise SkillError("SKILL_L1_REQUIRED")
            requested = resource_ref(dict(path=path, kind=kind, content_hash=content_hash))
            if requested not in material["data"]["resources"]:
                raise SkillError("SKILL_RESOURCE_MANIFEST_MISMATCH")
            key = (identity, path)
            if key not in self._l2:
                if identity in self._uses:
                    raise SkillError("SKILL_USAGE_ALREADY_RECORDED")
                body = dict(invocation_ref=invocation_ref, resource_ref=requested, content=material["data"]["resource_contents"][path],
                            l1_hash=json.loads(self._l1[identity])["content_hash"], created_at=_time(now), executed=False)
                body["content_hash"] = _hash(body)
                self._l2[key] = _canonical(body)
                self._event(selected["selection_id"], "L2_LOADED", body, now)
            return snapshot(json.loads(self._l2[key]))

    @boundary
    def record_use(self, context, invocation_ref, *, outcome, evidence_ref, request_id, now):
        with self._candidates._session(context, now) as host:
            invocation, selected, material = self._invocation(context, host, invocation_ref, now)
            identity = invocation["invocation_id"]
            if identity not in self._l1:
                raise SkillError("SKILL_L1_REQUIRED")
            if outcome not in ("SUCCESS", "FAILURE"):
                raise SkillError("INVALID_SKILL_OUTCOME")
            _text(evidence_ref)
            key = (id(context), _text(request_id))
            signature = _hash(dict(operation="record-use", invocation_ref=invocation_ref, outcome=outcome, evidence_ref=evidence_ref))
            if key in self._requests and self._requests[key] != (signature, identity):
                raise SkillError("SKILL_REPLAY_CONFLICT")
            if identity in self._uses:
                prior = json.loads(self._uses[identity])
                if prior["outcome"] != outcome or prior["evidence_ref"] != evidence_ref:
                    raise SkillError("SKILL_REPLAY_CONFLICT")
                self._requests[key] = (signature, identity)
                return snapshot(prior)
            binding = material["capture"]["binding"]
            body = dict(invocation_ref=invocation_ref, selection_id=selected["selection_id"], selection_hash=selected["content_hash"],
                        activation_id=binding["activation_ref"]["activation_id"], activation_hash=binding["activation_ref"]["content_hash"],
                        skill_ref=invocation["skill_ref"], candidate_ref=binding["candidate_ref"], review_ref=binding["review_ref"],
                        provenance=binding["provenance"], scope=binding["scope"], actor=host[2], context_id=host[1],
                        task_id=selected["snapshot_ref"]["task_id"], run_id=selected["snapshot_ref"]["run_id"], snapshot_ref=selected["snapshot_ref"],
                        l1_hash=json.loads(self._l1[identity])["content_hash"],
                        l2_hashes=sorted(json.loads(raw)["content_hash"] for (inv, _), raw in self._l2.items() if inv == identity),
                        outcome=outcome, evidence_ref=evidence_ref, created_at=_time(now), executed=False)
            body["content_hash"] = _hash(body)
            self._uses[identity] = _canonical(body)
            self._requests[key] = (signature, identity)
            self._event(selected["selection_id"], "USED", body, now)
            return snapshot(body)

    @boundary
    def audit(self, context, selection_ref, *, now):
        with self._candidates._session(context, now) as host:
            selected = self._selection(context, host, selection_ref, now)
            # Audit survives source revocation; no newly usable content is returned.
            return snapshot(dict(events=[json.loads(raw) for raw in self._events.get(selected["selection_id"], [])],
                                 uses=[json.loads(raw) for raw in self._uses.values() if json.loads(raw)["selection_id"] == selected["selection_id"]]))
