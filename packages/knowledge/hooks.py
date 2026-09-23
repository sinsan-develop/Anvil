"""D09 결정론적 Hook registry. 어떤 program/process도 실행하지 않는다.

capture_* 는 D05/D06과 동일한 인증 host control-plane in-memory adapter다.
관찰/결과를 독립 수집하는 실제 runner와 서명 검증은 NOT_EXECUTED.
등록은 UNTRUSTED/REVIEW_REQUIRED이며 trust, shadow, pilot, activation은 D10 소유다.
match/merge/fault는 감사 가능한 비실행 projection이지 도구 실행 권한이 아니다.
"""
from datetime import datetime
from functools import wraps
import json
import re
from types import MappingProxyType
from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _digest
from .candidates import CandidateRepository, snapshot


class HookError(MemoryError):
    pass


EVENT_RESULTS = MappingProxyType({
    "SessionStart": frozenset(("context", "log")),
    "UserPromptSubmit": frozenset(("allow", "deny", "context")),
    "PreToolUse": frozenset(("allow", "deny", "ask", "modify")),
    "PermissionRequest": frozenset(("allow", "deny", "context")),
    "PostToolUse": frozenset(("context", "log")),
    "PreCompact": frozenset(("log", "persist")),
    "PostCompact": frozenset(("context", "log")),
    "SubagentStart": frozenset(("context", "log")),
    "SubagentStop": frozenset(("allow", "block", "log")),
    "Stop": frozenset(("allow", "block", "log")),
    "SessionEnd": frozenset(("log", "persist")),
})
HOOK_STATES = frozenset(("CANDIDATE", "REGISTERED", "SHADOW", "PILOT", "TRUST_REVIEW", "ACTIVE", "QUARANTINED", "RETIRED"))
OBSERVATION_KINDS = frozenset(("REPEATED_MANUAL_CHECK", "OBJECTIVE_OMISSION", "OBJECTIVE_VIOLATION", "ALWAYS_SKILL_STEP", "REPEATED_COMMAND", "DETERMINISTIC_REGRESSION_TEST"))


def boundary(fn):
    @wraps(fn)
    def call(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except HookError:
            raise
        except MemoryError as error:
            raise HookError(error.reason) from None
        except (TypeError, ValueError, KeyError, IndexError, OverflowError, RecursionError):
            raise HookError("INVALID_HOOK_INPUT") from None
    return call


def fields(value, names):
    if type(value) not in (dict, MappingProxyType) or set(value) != set(names.split()):
        raise HookError("INVALID_HOOK_INPUT")


def integer(value, maximum=1_000_000):
    if type(value) is not int or not 1 <= value <= maximum:
        raise HookError("INVALID_HOOK_INPUT")
    return value


def path(value, *, glob=False):
    _text(value)
    parts = value.split("/")
    if (len(value) > 1024 or any(c in value for c in "\\:%?#[]{}\x00") or value.startswith("/")
            or any(p in ("", ".", "..") or p.endswith((".", " ")) for p in parts)):
        raise HookError("HOOK_UNSAFE_PATH")
    for part in parts:
        if re.fullmatch(r"(?i)(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\..*)?", part):
            raise HookError("HOOK_UNSAFE_PATH")
        if not re.fullmatch(r"[A-Za-z0-9_.*/-]+" if glob else r"[A-Za-z0-9_.-]+", part):
            raise HookError("HOOK_UNSAFE_PATH")
        if "**" in part and (part != "**" or part != parts[-1]):
            raise HookError("HOOK_INVALID_GLOB")
    if glob and "**" in parts[:-1]:
        raise HookError("HOOK_INVALID_GLOB")
    return value


@boundary
def program_reference(value):
    fields(value, "program_id version type entrypoint source_hash dependency_hash artifact_hash signature_hash output_schema")
    _text(value["program_id"]); integer(value["version"])
    if value["type"] != "command" or value["output_schema"] != "hook-result-v1":
        raise HookError("HOOK_COMMAND_CONTRACT_REQUIRED")
    path(value["entrypoint"])
    for name in ("source_hash", "dependency_hash", "artifact_hash", "signature_hash"):
        _digest(value[name])
    return dict(program_id=value["program_id"], version=value["version"], content_hash=_hash(value))


def reference(value, kind="hook"):
    fields(value, kind + "_id version content_hash")
    _text(value[kind + "_id"]); integer(value["version"]); _digest(value["content_hash"])
    return value


def matcher(value):
    fields(value, "all exclude")
    result = {}
    for name in ("all", "exclude"):
        if type(value[name]) is not list or len(value[name]) > 32 or (name == "all" and not value[name]):
            raise HookError("HOOK_INVALID_MATCHER")
        conditions = []
        for condition in value[name]:
            fields(condition, "field op value")
            field, op, text = condition["field"], condition["op"], condition["value"]
            if field not in ("tool", "path", "status", "agent_id") or op not in ("eq", "path_glob") or (op == "path_glob" and field != "path"):
                raise HookError("HOOK_INVALID_MATCHER")
            _text(text)
            if field == "path":
                path(text, glob=op == "path_glob")
            conditions.append(dict(condition))
        result[name] = sorted({ _canonical(x): x for x in conditions }.values(), key=_canonical)
    return result


def definition(value):
    fields(value, "hook_id version event matcher program_ref timeout_ms permissions failure_policy idempotency recursion_guard max_depth")
    _text(value["hook_id"]); integer(value["version"]); integer(value["timeout_ms"], 60_000)
    if value["event"] not in EVENT_RESULTS:
        raise HookError("HOOK_INVALID_EVENT")
    if (value["recursion_guard"] is not True or type(value["max_depth"]) is not int or value["max_depth"] != 1
            or value["idempotency"] != "required"):
        raise HookError("HOOK_RECURSION_IDEMPOTENCY_REQUIRED")
    if value["permissions"] != dict(filesystem="read_only", network="deny"):
        raise HookError("HOOK_READ_ONLY_NETWORK_DENY_REQUIRED")
    if value["failure_policy"] not in ("fail_open", "fail_closed"):
        raise HookError("HOOK_INVALID_FAULT_POLICY")
    reference(value["program_ref"], "program")
    return {**value, "matcher": matcher(value["matcher"])}


@boundary
def validate_result(event, value):
    fields(value, "result modifications messages")
    if event not in EVENT_RESULTS or value["result"] not in EVENT_RESULTS[event]:
        raise HookError("HOOK_EVENT_RESULT_MISMATCH")
    changes, messages = value["modifications"], value["messages"]
    if type(changes) is not dict or len(changes) > 32 or type(messages) is not list or len(messages) > 16:
        raise HookError("HOOK_INVALID_RESULT")
    if bool(changes) != (value["result"] == "modify"):
        raise HookError("HOOK_INVALID_RESULT")
    for key, change in changes.items():
        if type(key) is not str or not re.fullmatch(r"arguments(?:\.[A-Za-z_][A-Za-z0-9_]*)*", key):
            raise HookError("HOOK_INVALID_MODIFY_TARGET")
        # JSON-only bounded output; secrets/instructions are never reflected.
        _text(_canonical(change))
    for message in messages:
        _text(message)
    if len(_canonical(value).encode("utf-8")) > 16384:
        raise HookError("HOOK_RESULT_TOO_LARGE")
    return snapshot(value)


@boundary
def merge_results(event, values):
    if type(values) is not list or len(values) > 128 or event not in EVENT_RESULTS:
        raise HookError("HOOK_INVALID_RESULT")
    results = [to_primitive(validate_result(event, x)) for x in values]
    changes, conflict = {}, False
    for value in results:
        for key, change in value["modifications"].items():
            for old, prior in changes.items():
                if (old == key and _canonical(prior) != _canonical(change)) or (old != key and (old.startswith(key + ".") or key.startswith(old + "."))):
                    conflict = True
            changes[key] = change
    actions = {x["result"] for x in results}
    if "deny" in actions or "block" in actions:
        decision, reason = "deny", "HOOK_DENY"
    elif conflict:
        decision, reason = "deny", "HOOK_MODIFY_CONFLICT"
    elif "ask" in actions:
        decision, reason = "ask", "HOOK_ASK"
    elif "modify" in actions:
        decision, reason = "modify", "HOOK_MODIFY"
    else:
        decision, reason = "allow", "HOOK_ALLOW"
    body = dict(decision=decision, reason=reason, modifications=changes if decision == "modify" else {},
                messages=sorted({m for x in results for m in x["messages"]}), executed=False, boundary="REGISTRY_PROJECTION_NOT_EXECUTED")
    body["content_hash"] = _hash(body)
    return snapshot(body)


class HookRegistry:
    def __init__(self, candidates):
        if type(candidates) is not CandidateRepository:
            raise HookError("HOOK_HOST_REQUIRED")
        self._candidates = candidates
        self._captures, self._records, self._programs, self._hooks, self._heads = {}, {}, {}, {}, {}
        self._requests, self._receipts, self._event_ids, self._results, self._audits = {}, {}, {}, {}, {}

    def _hook(self, ctx, host, target, now, *, current=True, live=True):
        reference(target)
        key = (id(ctx), target["hook_id"], target["version"])
        if key not in self._hooks:
            raise HookError("HOOK_REFERENCE_MISMATCH")
        record = json.loads(self._hooks[key])
        if record["hook_ref"] != target or (current and self._heads.get(key[:2]) != target):
            raise HookError("HOOK_REFERENCE_MISMATCH")
        if live:
            self._candidates._entry(ctx, host, record["candidate_ref"], now)
            pref = record["definition"]["program_ref"]
            program = json.loads(self._programs[(id(ctx), pref["program_id"], pref["version"])])
            if program["ref"] != pref:
                raise HookError("HOOK_PROGRAM_REFERENCE_MISMATCH")
            self._candidates._entry(ctx, host, program["candidate_ref"], now)
        return record

    def _draft(self, ctx, host, data, now):
        fields(data, "proposal_id candidate_ref action before after programs")
        _text(data["proposal_id"])
        _, origin, _ = self._candidates._entry(ctx, host, data["candidate_ref"], now)
        actions = {"create_rule": "CREATE", "create_program_and_rule": "CREATE", "patch_matcher": "PATCH", "upgrade_program": "PATCH",
                   "split": "SPLIT", "merge": "MERGE", "quarantine": "ARCHIVE", "retire": "ARCHIVE"}
        action = data["action"]
        if origin["kind"] != "HOOK" or action not in actions or origin["intent"] != actions[action]:
            raise HookError("HOOK_ORIGIN_ACTION_MISMATCH")
        for name in ("before", "after", "programs"):
            if type(data[name]) is not list or len(data[name]) > 20:
                raise HookError("HOOK_INVALID_ACTION_SHAPE")
        before = [self._hook(ctx, host, r, now)["definition"] for r in data["before"]]
        after = [definition(x) for x in data["after"]]
        old, new = [x["hook_id"] for x in before], [x["hook_id"] for x in after]
        if len(set(old)) != len(old) or len(set(new)) != len(new):
            raise HookError("HOOK_INVALID_ACTION_SHAPE")
        shape = ((not old and len(new) == 1) if action.startswith("create_") else
                 (len(old) == len(new) == 1 and old == new) if action in ("patch_matcher", "upgrade_program") else
                 (len(old) == 1 and len(new) >= 2 and not set(old) & set(new)) if action == "split" else
                 (len(old) >= 2 and len(new) == 1 and not set(old) & set(new)) if action == "merge" else
                 (len(old) == 1 and not new))
        if not shape or origin["target_id"] not in (new if not old else old):
            raise HookError("HOOK_INVALID_ACTION_SHAPE")
        programs = {}
        for value in data["programs"]:
            ref = program_reference(value)
            key = (ref["program_id"], ref["version"])
            if key in programs:
                raise HookError("HOOK_PROGRAM_VERSION_CONFLICT")
            programs[key] = dict(data=value, ref=ref)
        if action == "create_rule" and programs or action == "create_program_and_rule" and not programs:
            raise HookError("HOOK_INVALID_ACTION_SHAPE")
        used = set()
        for value in after:
            pref = value["program_ref"]; key = (pref["program_id"], pref["version"])
            available = programs.get(key)
            if available is None:
                raw = self._programs.get((id(ctx), *key))
                available = json.loads(raw) if raw else None
                if available:
                    self._candidates._entry(ctx, host, available["candidate_ref"], now)
            if available is None or available["ref"] != pref:
                raise HookError("HOOK_PROGRAM_REFERENCE_MISMATCH")
            used.add(key)
            old_value = next((v for v in before if v["hook_id"] == value["hook_id"]), None)
            if old_value:
                if value["version"] != old_value["version"] + 1:
                    raise HookError("HOOK_VERSION_CONFLICT")
                allowed = {"version", "event", "matcher"} if action == "patch_matcher" else {"version", "program_ref"}
                if any(value[k] != old_value[k] for k in value if k not in allowed):
                    raise HookError("HOOK_ACTION_DELTA_MISMATCH")
                if action == "patch_matcher":
                    if programs:
                        raise HookError("HOOK_ACTION_DELTA_MISMATCH")
                    if value["event"] == old_value["event"] and value["matcher"] == old_value["matcher"]:
                        raise HookError("HOOK_ACTION_NO_CHANGE")
                    # hook-result-v1 has no per-program result subset: retain the
                    # entire existing Event result contract conservatively.
                    # This checks compatibility, NOT lifecycle/risk refinement;
                    # event frequency/risk and activation remain D10 human review.
                    if not EVENT_RESULTS[old_value["event"]] <= EVENT_RESULTS[value["event"]]:
                        raise HookError("HOOK_EVENT_RESULT_CONTRACT_MISMATCH")
                if action == "upgrade_program" and value["program_ref"] == old_value["program_ref"]:
                    raise HookError("HOOK_ACTION_DELTA_MISMATCH")
            elif value["version"] != 1 or (id(ctx), value["hook_id"]) in self._heads:
                raise HookError("HOOK_VERSION_CONFLICT")
        if set(programs) - used:
            raise HookError("HOOK_UNUSED_PROGRAM")
        return dict(**{**data, "after": sorted(after, key=lambda x: x["hook_id"]), "programs": sorted(data["programs"], key=_canonical)},
                    scope=to_primitive(MemoryScope(*host[3])), source_provenance=origin["provenance"])

    def _window(self, now, expires_at):
        start, end = _time(now), _time(expires_at)
        if start >= end:
            raise HookError("HOOK_STALE_CAPTURE")
        return start, end

    @boundary
    def capture_observations(self, ctx, proposal, observations, *, now, expires_at, managed=False):
        with self._candidates._session(ctx, now) as host:
            data = self._draft(ctx, host, proposal, now)
            start, end = self._window(now, expires_at)
            if type(managed) is not bool or type(observations) is not list or not 2 <= len(observations) <= 32:
                raise HookError("HOOK_INDEPENDENT_OBSERVATIONS_REQUIRED")
            names = "observation_id kind task_id run_id input_hash evidence_id evidence_hash"
            for obs in observations:
                fields(obs, names)
                if obs["kind"] not in OBSERVATION_KINDS:
                    raise HookError("HOOK_INVALID_OBSERVATION")
                for name, value in obs.items():
                    (_digest if name.endswith("hash") else _text)(value)
            for name in names.split():
                if name != "kind" and len({x[name] for x in observations}) != len(observations):
                    raise HookError("HOOK_INDEPENDENT_OBSERVATIONS_REQUIRED")
            body = dict(data_hash=_hash(data), observations=sorted(observations, key=_canonical), managed=managed,
                        context_id=host[1], actor=host[2], captured_at=start, expires_at=end)
            key = (id(ctx), proposal["proposal_id"])
            old = json.loads(self._captures[key]) if key in self._captures else None
            if old and ({k: v for k, v in old.items() if k not in ("captured_at", "expires_at")} !=
                        {k: v for k, v in to_primitive(body).items() if k not in ("captured_at", "expires_at")}):
                raise HookError("HOOK_OBSERVATION_REBIND")
            if old and start < datetime.fromisoformat(old["expires_at"]) and _canonical(body) != _canonical(old):
                raise HookError("HOOK_OBSERVATION_REBIND")
            self._captures[key] = _canonical(body)
            return snapshot(body)

    def _request(self, ctx, request_id, operation, payload):
        _text(request_id)
        key, digest = (id(ctx), request_id), _hash([operation, payload])
        old = self._requests.get(key)
        if old and old[0] != digest:
            raise HookError("HOOK_IDEMPOTENCY_CONFLICT")
        return key, digest, old

    @boundary
    def candidate(self, ctx, proposal, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            data = self._draft(ctx, host, proposal, now)
            key = (id(ctx), proposal["proposal_id"])
            proof = json.loads(self._captures[key]) if key in self._captures else None
            if (not proof or proof["data_hash"] != _hash(data) or not
                    datetime.fromisoformat(proof["captured_at"]) <= _time(now) < datetime.fromisoformat(proof["expires_at"])):
                raise HookError("HOOK_OBSERVATIONS_REQUIRED")
            rkey, digest, prior = self._request(ctx, request_id, "candidate", data)
            if prior:
                return snapshot(json.loads(prior[1]))
            if key in self._records:
                raise HookError("HOOK_PROPOSAL_EXISTS")
            body = dict(**data, status="CANDIDATE", executable=False, trust_status="UNTRUSTED", review_status="REVIEW_REQUIRED",
                        provenance=dict(candidate_ref=data["candidate_ref"], observations=proof["observations"], capture=proof),
                        created_at=_time(now), hook_refs=[], audit=[])
            body["content_hash"] = _hash(body)
            body["proposal_ref"] = dict(proposal_id=data["proposal_id"], content_hash=body["content_hash"])
            self._records[key] = _canonical(body)
            self._requests[rkey] = (digest, _canonical(body))
            return snapshot(body)

    @boundary
    def register(self, ctx, target, *, request_id, now):
        with self._candidates._session(ctx, now) as host:
            fields(target, "proposal_id content_hash")
            key = (id(ctx), target["proposal_id"])
            if key not in self._records:
                raise HookError("HOOK_PROPOSAL_NOT_FOUND")
            body = json.loads(self._records[key])
            if body["proposal_ref"] != target:
                raise HookError("HOOK_REFERENCE_MISMATCH")
            self._candidates._entry(ctx, host, body["candidate_ref"], now)
            rkey, digest, prior = self._request(ctx, request_id, "register", target)
            if prior:
                return snapshot(json.loads(prior[1]))
            if body["status"] != "CANDIDATE":
                raise HookError("HOOK_ALREADY_REGISTERED")
            if _time(now) < datetime.fromisoformat(body["created_at"]) or _time(now) >= datetime.fromisoformat(body["provenance"]["capture"]["expires_at"]):
                raise HookError("HOOK_STALE_CAPTURE")
            self._draft(ctx, host, {k: body[k] for k in "proposal_id candidate_ref action before after programs".split()}, now)
            pending = {}
            for value in body["programs"]:
                pref = program_reference(value); pkey = (id(ctx), pref["program_id"], pref["version"])
                existing = self._programs.get(pkey)
                if existing and json.loads(existing)["ref"] != pref:
                    raise HookError("HOOK_PROGRAM_VERSION_CONFLICT")
                versions = [k[2] for k in self._programs if k[:2] == pkey[:2]]
                if not existing and pref["version"] != (max(versions) + 1 if versions else 1):
                    raise HookError("HOOK_PROGRAM_VERSION_CONFLICT")
                pending[pkey] = existing or _canonical(dict(data=value, ref=pref, candidate_ref=body["candidate_ref"],
                    scope=body["scope"], source_provenance=body["source_provenance"], signature_verification="NOT_EXECUTED",
                    trust_status="UNTRUSTED", review_status="REVIEW_REQUIRED", executable=False))
            hooks = {}
            for value in body["after"]:
                hkey = (id(ctx), value["hook_id"], value["version"])
                if hkey in self._hooks:
                    raise HookError("HOOK_VERSION_CONFLICT")
                definition_body = dict(**value, scope=body["scope"], provenance=body["provenance"], status="REGISTERED")
                href = dict(hook_id=value["hook_id"], version=value["version"], content_hash=_hash(definition_body))
                hooks[hkey] = _canonical(dict(hook_ref=href, definition=value, contract=definition_body, candidate_ref=body["candidate_ref"],
                                              proposal_id=body["proposal_id"], managed=body["provenance"]["capture"]["managed"]))
            # All checks above; publish together while holding the existing host/repository lock.
            self._programs.update(pending)
            self._hooks.update(hooks)
            for old in body["before"]:
                self._heads.pop((id(ctx), old["hook_id"]), None)
            body["hook_refs"] = [json.loads(raw)["hook_ref"] for raw in hooks.values()]
            for href in body["hook_refs"]:
                self._heads[(id(ctx), href["hook_id"])] = href
            body["status"] = {"quarantine": "QUARANTINED", "retire": "RETIRED"}.get(body["action"], "REGISTERED")
            body["registered_at"] = _time(now)
            body["content_hash"] = _hash({k: v for k, v in body.items() if k != "content_hash"})
            self._records[key] = _canonical(body)
            self._requests[rkey] = (digest, _canonical(body))
            return snapshot(body)

    @boundary
    def query(self, ctx, proposal_id, *, now):
        with self._candidates._session(ctx, now):
            _text(proposal_id)
            key = (id(ctx), proposal_id)
            if key not in self._records:
                raise HookError("HOOK_PROPOSAL_NOT_FOUND")
            body = json.loads(self._records[key])
            body["audit"] = [json.loads(raw) for raw in self._audits.get(key, [])]
            return snapshot(body)

    @boundary
    def version(self, ctx, target, *, now):
        with self._candidates._session(ctx, now) as host:
            record = self._hook(ctx, host, target, now, current=False, live=False)
            pref = record["definition"]["program_ref"]
            record["program"] = json.loads(self._programs[(id(ctx), pref["program_id"], pref["version"])])
            return snapshot(record)

    def _matches(self, condition, payload):
        value = payload.get(condition["field"])
        if value is None:
            return False
        if condition["op"] == "eq":
            return value == condition["value"]
        pattern = condition["value"]
        if pattern == "**":
            # Input already passed canonical nonempty relative-path validation.
            return re.fullmatch(r"[^/]+(?:/[^/]+)*", value) is not None
        trailing = pattern.endswith("/**")
        if trailing:
            pattern = pattern[:-3]
        expression = re.escape(pattern).replace(r"\*", "[^/]*")
        return re.fullmatch(expression + (r"(?:/[^/]+)*" if trailing else ""), value) is not None

    @boundary
    def match(self, ctx, event, *, now):
        with self._candidates._session(ctx, now) as host:
            fields(event, "event_id event depth payload")
            _text(event["event_id"])
            if event["event"] not in EVENT_RESULTS or type(event["depth"]) is not int or event["depth"] < 0:
                raise HookError("HOOK_INVALID_EVENT")
            if type(event["payload"]) is not dict or not set(event["payload"]) <= {"tool", "path", "status", "agent_id"}:
                raise HookError("HOOK_INVALID_EVENT")
            for name, value in event["payload"].items():
                (path if name == "path" else _text)(value)
            if event["depth"] >= 1:
                body = dict(event=event, matched=[], decision="deny", reason="HOOK_RECURSION_BLOCKED", executed=False)
                return self._remember_event(ctx, event, body)
            matches = []
            for key, href in self._heads.items():
                if key[0] != id(ctx):
                    continue
                record = self._hook(ctx, host, href, now)
                d = record["definition"]; m = d["matcher"]
                if d["event"] == event["event"] and all(self._matches(c, event["payload"]) for c in m["all"]) and not any(self._matches(c, event["payload"]) for c in m["exclude"]):
                    matches.append(record)
            matches.sort(key=lambda x: (not x["managed"], x["hook_ref"]["hook_id"], x["hook_ref"]["version"], x["hook_ref"]["content_hash"]))
            body = dict(event=event, matched=[x["hook_ref"] for x in matches], executed=False, trust_status="UNTRUSTED", boundary="MATCH_PREVIEW_NOT_EXECUTED")
            return self._remember_event(ctx, event, body)

    def _remember_event(self, ctx, event, body):
        body["content_hash"] = _hash(body)
        key = (id(ctx), event["event_id"])
        if key in self._event_ids and self._event_ids[key] != body["content_hash"]:
            raise HookError("HOOK_IDEMPOTENCY_CONFLICT")
        self._event_ids[key] = body["content_hash"]
        self._receipts[(id(ctx), body["content_hash"])] = _canonical(body)
        return snapshot(body)

    def _receipt(self, ctx, host, receipt_hash, now):
        raw = self._receipts.get((id(ctx), receipt_hash))
        if raw is None:
            raise HookError("HOOK_MATCH_RECEIPT_REQUIRED")
        body = json.loads(raw)
        if body.get("reason") == "HOOK_RECURSION_BLOCKED":
            raise HookError("HOOK_RECURSION_BLOCKED")
        for href in body["matched"]:
            self._hook(ctx, host, href, now)
        return body

    @boundary
    def capture_results(self, ctx, receipt_hash, results, *, now, expires_at):
        with self._candidates._session(ctx, now) as host:
            receipt = self._receipt(ctx, host, receipt_hash, now)
            start, end = self._window(now, expires_at)
            if type(results) is not list or len(results) != len(receipt["matched"]):
                raise HookError("HOOK_RESULT_TARGET_MISMATCH")
            normalized = []
            for value in results:
                if type(value) is dict and "fault" in value:
                    fields(value, "hook_ref fault")
                    record = self._hook(ctx, host, value["hook_ref"], now)
                    self._fault(record, value["hook_ref"], value["fault"])
                    normalized.append(dict(value))
                    continue
                fields(value, "hook_ref result modifications messages")
                reference(value["hook_ref"])
                result = validate_result(receipt["event"]["event"], {k: value[k] for k in ("result", "modifications", "messages")})
                normalized.append(dict(hook_ref=value["hook_ref"], **to_primitive(result)))
            if sorted(_canonical(x["hook_ref"]) for x in normalized) != sorted(_canonical(x) for x in receipt["matched"]):
                raise HookError("HOOK_RESULT_TARGET_MISMATCH")
            body = dict(receipt_hash=receipt_hash, results=sorted(normalized, key=_canonical), captured_at=start, expires_at=end,
                        context_id=host[1], actor=host[2], executed=False)
            body["capture_id"] = _hash(body)
            self._results[(id(ctx), body["capture_id"])] = _canonical(body)
            return snapshot(body)

    @boundary
    def merge(self, ctx, capture_id, *, now):
        with self._candidates._session(ctx, now) as host:
            raw = self._results.get((id(ctx), capture_id))
            if raw is None:
                raise HookError("HOOK_RESULT_CAPTURE_REQUIRED")
            body = json.loads(raw)
            if not datetime.fromisoformat(body["captured_at"]) <= _time(now) < datetime.fromisoformat(body["expires_at"]):
                raise HookError("HOOK_RESULT_CAPTURE_REQUIRED")
            receipt = self._receipt(ctx, host, body["receipt_hash"], now)
            values = [{k: x[k] for k in ("result", "modifications", "messages")} for x in body["results"] if "fault" not in x]
            outcome = to_primitive(merge_results(receipt["event"]["event"], values))
            outcome["faults"] = [self._fault(self._hook(ctx, host, x["hook_ref"], now), x["hook_ref"], x["fault"])
                                 for x in body["results"] if "fault" in x]
            if any(x["decision"] == "deny" for x in outcome["faults"]):
                outcome.update(decision="deny", reason="HOOK_FAULT_DENY", modifications={})
            outcome.update(receipt_hash=body["receipt_hash"], capture_id=capture_id)
            outcome["content_hash"] = _hash({k: v for k, v in outcome.items() if k != "content_hash"})
            for href in receipt["matched"]:
                self._audit(ctx, self._hook(ctx, host, href, now)["proposal_id"], outcome)
            return snapshot(outcome)

    def _audit(self, ctx, proposal_id, body):
        key = (id(ctx), proposal_id)
        raw = _canonical(body)
        if raw not in self._audits.get(key, []):
            self._audits[key] = self._audits.get(key, []) + [raw]

    @boundary
    def fault_projection(self, ctx, target, kind, *, now):
        with self._candidates._session(ctx, now) as host:
            record = self._hook(ctx, host, target, now)
            body = self._fault(record, target, kind)
            self._audit(ctx, record["proposal_id"], body)
            return snapshot(body)

    def _fault(self, record, target, kind):
        if kind not in ("timeout", "error"):
            raise HookError("HOOK_INVALID_FAULT")
        policy = record["definition"]["failure_policy"]
        body = dict(hook_ref=target, fault=kind, failure_policy=policy, program_result=None,
                    decision="deny" if policy == "fail_closed" else "allow", warning=policy == "fail_open",
                    reason="HOOK_" + kind.upper() + "_" + policy.upper(), log=True, executed=False,
                    boundary="ENGINE_FAULT_PROJECTION_NOT_EXECUTED")
        body["content_hash"] = _hash(body)
        return body
