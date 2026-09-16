"""D10 fake-only sandbox lifecycle. 실제 OS/process/HTTP/DB 실행 경로 없음.

FakeSandboxExecutor는 계약 검증용이며 OS 격리의 증거가 아니다. capture_* 와
HookRuntimeAuthority는 인증 host adapter이며 API body에서 발급할 수 없다.
restart는 이 adapter가 보존한 sealed checkpoint의 in-memory 복원만 검증한다.
"""
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import wraps
import json
from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _scan_body_credentials
from .candidates import snapshot
from .hooks import HookRegistry, EVENT_RESULTS, fields, reference, path, program_reference, validate_result, merge_results


class HookRuntimeError(MemoryError):
    pass


def boundary(fn):
    @wraps(fn)
    def call(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except HookRuntimeError:
            raise
        except MemoryError as error:
            raise HookRuntimeError(error.reason) from None
        except (ValueError, TypeError, KeyError, IndexError, OverflowError, RecursionError):
            raise HookRuntimeError("INVALID_HOOK_RUNTIME_INPUT") from None
    return call


def safe_json(value):
    if len(_canonical(value).encode("utf-8")) > 16384:
        raise HookRuntimeError("HOOK_RUNTIME_INPUT_TOO_LARGE")
    _scan_body_credentials(value)
    def walk(item):
        if type(item) is str:
            if item: _text(item)
        elif type(item) is dict:
            for key, child in item.items():
                _text(key); walk(child)
        elif type(item) in (list, tuple):
            for child in item: walk(child)
        elif item is not None and type(item) not in (bool, int, float):
            raise HookRuntimeError("INVALID_HOOK_RUNTIME_INPUT")
    walk(value)


def hashed(value):
    body = to_primitive(value)
    body["content_hash"] = _hash(body)
    return body


class FakeSandboxExecutor:
    """Deterministic injected fixture adapter; callable/OS executor는 받지 않는다."""
    def __init__(self):
        self._responses, self.hash_overrides, self.calls = {}, {}, []

    def set_response(self, event_id, value):
        self._responses[event_id] = _canonical(value)

    def inspect(self, program):
        return {name: self.hash_overrides.get(name, program[name]) for name in
                ("source_hash", "dependency_hash", "artifact_hash", "signature_hash")}

    def run(self, packet):
        self.calls.append(snapshot(packet))
        raw = self._responses.get(packet["event"]["event_id"])
        if raw is None:
            return dict(stdout='{"result":"allow","modifications":{},"messages":[]}', stderr="", exit_code=0, duration_ms=1)
        return json.loads(raw)


class HookRuntimeAuthority:
    """Host-owned control-plane seam; durable storage/signing은 NOT_INTEGRATED."""
    def __init__(self):
        self._owners, self._checkpoints, self._epochs = {}, {}, {}


@dataclass(frozen=True)
class HookRunStart:
    boundary_id: str
    content_hash: str


class HookRuntime:
    def __init__(self, registry, executor, authority):
        if type(registry) is not HookRegistry or type(executor) is not FakeSandboxExecutor or type(authority) is not HookRuntimeAuthority:
            raise HookRuntimeError("HOOK_RUNTIME_HOST_REQUIRED")
        self._registry, self._executor, self._authority = registry, executor, authority
        self._context = None
        self._starts = {}
        self._state = dict(records={}, heads={}, fallbacks={}, requests={}, pilot_captures={}, human_captures={}, selections={}, run_ids={}, receipts={},
                           automation=[], context_id=None, principal_id=None, scope=None, boundary="FAKE_SANDBOX_ONLY")

    @contextmanager
    def _session(self, ctx, now, *, restore=False):
        with self._registry._candidates._session(ctx, now) as host:
            if not restore:
                owner = self._authority._owners.get(host[1])
                if owner is not None and owner is not self:
                    raise HookRuntimeError("HOOK_RUNTIME_OWNER_STALE")
                if self._context is not None and self._context is not ctx:
                    raise HookRuntimeError("HOOK_RUNTIME_AUTHORITY_MISMATCH")
                if self._context is None:
                    self._context = ctx
                    self._state.update(context_id=host[1], principal_id=host[2], scope=to_primitive(MemoryScope(*host[3])))
                    self._authority._owners[host[1]] = self
                    self._authority._epochs.setdefault(host[1], 0)
            yield host

    def _changed(self):
        key = self._state["context_id"]
        self._authority._epochs[key] = self._authority._epochs.get(key, 0) + 1

    def _canonical_record(self, ctx, host, target, now):
        raw = self._registry._hook(ctx, host, target, now, current=False)
        value = to_primitive(self._registry.version(ctx, target, now=now))
        contract, definition, program = value["contract"], value["definition"], value["program"]
        if (_hash(contract) != target["content_hash"] or any(contract.get(k) != v for k, v in definition.items())
                or program_reference(program["data"]) != definition["program_ref"] or program["ref"] != definition["program_ref"]
                or contract["scope"] != to_primitive(MemoryScope(*host[3]))):
            raise HookRuntimeError("HOOK_RUNTIME_HASH_DRIFT")
        if raw["definition"] != definition:
            raise HookRuntimeError("HOOK_RUNTIME_HASH_DRIFT")
        return value

    def _entry(self, ctx, host, target, now, *, live=True):
        reference(target)
        record = self._state["records"].get(target["content_hash"])
        if record is None or record["target"] != target:
            raise HookRuntimeError("HOOK_RUNTIME_TARGET_MISMATCH")
        if _time(now) < datetime.fromisoformat(record["events"][-1]["created_at"]):
            raise HookRuntimeError("HOOK_RUNTIME_STALE_TIME")
        if live:
            try:
                actual = self._canonical_record(ctx, host, target, now)
                if actual != record["registry_record"]:
                    raise HookRuntimeError("HOOK_RUNTIME_HASH_DRIFT")
            except MemoryError:
                if record["status"] == "ACTIVE": self._isolate(record, "SOURCE_OR_HASH_DRIFT", now)
                raise
        return record

    def _event(self, record, status, evidence, now):
        entry = hashed(dict(status=status, state_version=record["state_version"] + 1, evidence_hash=_hash(evidence),
                            previous_hash=record["events"][-1]["content_hash"] if record["events"] else None, created_at=_time(now)))
        record.update(status=status, state_version=entry["state_version"])
        record["events"].append(entry)
        self._changed()

    def _audit(self, record, kind, details, now):
        record["audit"].append(hashed(dict(type=kind, details=details, created_at=_time(now),
                                          previous_hash=record["audit"][-1]["content_hash"] if record["audit"] else None)))
        self._changed()

    def _begin(self, record, operation, payload, expected_version, request_id, statuses):
        _text(request_id)
        signature = _hash([operation, record["target"], payload, expected_version])
        old = self._state["requests"].get(request_id)
        if old:
            if old["signature"] != signature:
                raise HookRuntimeError("HOOK_RUNTIME_REPLAY_CONFLICT")
            return signature, snapshot(old["result"])
        if type(expected_version) is not int or expected_version != record["state_version"]:
            raise HookRuntimeError("HOOK_RUNTIME_VERSION_CONFLICT")
        if record["status"] not in statuses:
            raise HookRuntimeError("HOOK_RUNTIME_INVALID_TRANSITION")
        return signature, None

    def _finish(self, request_id, signature, record):
        result = to_primitive(record)
        self._state["requests"][request_id] = dict(signature=signature, result=result)
        self._changed()
        return snapshot(result)

    @boundary
    def track(self, ctx, target, *, now):
        with self._session(ctx, now) as host:
            actual = self._canonical_record(ctx, host, target, now)
            key = target["content_hash"]
            if key not in self._state["records"]:
                record = dict(target=to_primitive(target), registry_record=actual, definition=actual["definition"], status="REGISTERED", state_version=0,
                              events=[], audit=[], shadow=None, pilot=None, trust=None, notifications=[], rollback_ref=None,
                              fallback=None, affected_runs=[], error_count=0, deny_count=0, boundary="FAKE_SANDBOX_ONLY")
                record["expected_head"] = self._state["heads"].get(target["hook_id"])
                self._state["records"][key] = record
                self._event(record, "REGISTERED", target, now)
            return snapshot(self._state["records"][key])

    @boundary
    def query(self, ctx, target, *, now):
        with self._session(ctx, now) as host:
            return snapshot(self._entry(ctx, host, target, now, live=False))

    def _event_input(self, value, data):
        fields(value, "event_id event depth payload")
        _text(value["event_id"])
        if value["event"] not in EVENT_RESULTS or type(value["depth"]) is not int or value["depth"] < 0:
            raise HookRuntimeError("INVALID_HOOK_RUNTIME_INPUT")
        if type(value["payload"]) is not dict or not set(value["payload"]) <= {"tool", "path", "status", "agent_id"} or type(data) is not dict:
            raise HookRuntimeError("INVALID_HOOK_RUNTIME_INPUT")
        for name, text in value["payload"].items():
            (path if name == "path" else _text)(text)
        safe_json(data)

    def _matches(self, record, event):
        definition = record["definition"]; matcher = definition["matcher"]
        return (event["event"] == definition["event"] and all(self._registry._matches(c, event["payload"]) for c in matcher["all"])
                and not any(self._registry._matches(c, event["payload"]) for c in matcher["exclude"]))

    def _execute(self, record, event, data):
        self._event_input(event, data)
        if event["depth"] >= 1:
            return hashed(dict(kind="recursion", reason="HOOK_RECURSION_BLOCKED", decision="deny", executor_called=False))
        if not self._matches(record, event):
            return hashed(dict(kind="unmatched", decision="allow", executor_called=False))
        program = record["registry_record"]["program"]["data"]
        actual = self._executor.inspect(snapshot(program))
        expected = {k: program[k] for k in ("source_hash", "dependency_hash", "artifact_hash", "signature_hash")}
        if actual != expected:
            raise HookRuntimeError("HOOK_RUNTIME_HASH_DRIFT")
        profile = dict(non_root=True, rootfs="read_only", read_paths=[program["entrypoint"]], network="deny", project_write=False,
                       credential_read=False, process_spawn=False, deployment=False, hook_mutation=False, subagent_create=False)
        packet = dict(program=program, target=record["target"], profile=profile, event=event, input=data, timeout_ms=record["definition"]["timeout_ms"])
        raw = self._executor.run(snapshot(packet))
        result, fault = None, None
        duration, code, stderr_hash, stdout_hash = None, None, None, None
        try:
            fields(raw, "stdout stderr exit_code duration_ms")
            if type(raw["stdout"]) is not str or type(raw["stderr"]) is not str or len(raw["stdout"]) > 16384 or len(raw["stderr"]) > 4096:
                raise HookRuntimeError("HOOK_RUNTIME_OUTPUT_SCHEMA")
            duration, code = raw["duration_ms"], raw["exit_code"]
            if type(duration) is not int or duration < 0 or type(code) is not int:
                raise HookRuntimeError("HOOK_RUNTIME_OUTPUT_SCHEMA")
            stdout_hash, stderr_hash = _hash(raw["stdout"]), _hash(raw["stderr"])
            safe_json(raw["stderr"])
            if duration >= record["definition"]["timeout_ms"]:
                fault = "timeout"
            elif code != 0:
                fault = "error"
            else:
                parsed = json.loads(raw["stdout"])
                safe_json(parsed)
                result = to_primitive(validate_result(event["event"], parsed))
        except (MemoryError, ValueError, TypeError, KeyError):
            fault, result = "schema", None
        return hashed(dict(kind="fault" if fault else "result", fault=fault, result=result, executor_called=True,
                           duration_ms=duration, exit_code=code, stdout_hash=stdout_hash, stderr_hash=stderr_hash,
                           program_hash=record["registry_record"]["program"]["ref"]["content_hash"], profile_hash=_hash(profile), boundary="FAKE_SANDBOX_ONLY"))

    @boundary
    def shadow(self, ctx, target, event, data, *, expected_version, request_id, now):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now)
            signature, replay = self._begin(record, "shadow", [event, data], expected_version, request_id, ("REGISTERED",))
            if replay: return replay
            receipt = self._execute(record, event, data)
            record["shadow"] = hashed(dict(receipt=receipt, original_action_changed=False, original_decision="unchanged"))
            self._event(record, "SHADOW", record["shadow"], now)
            return self._finish(request_id, signature, record)

    @boundary
    def capture_pilot(self, ctx, target, fixtures, *, now, expires_at):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now)
            kinds = {"positive", "negative", "timeout", "schema", "fault_policy", "recursion"}
            if type(fixtures) is not list or len(fixtures) != 6 or record["status"] != "SHADOW" or _time(expires_at) <= _time(now):
                raise HookRuntimeError("HOOK_RUNTIME_PILOT_COVERAGE")
            for f in fixtures:
                fields(f, "case_id kind event input"); _text(f["case_id"]); self._event_input(f["event"], f["input"])
            if (set(f["kind"] for f in fixtures) != kinds or len({f["case_id"] for f in fixtures}) != 6
                    or len({f["event"]["event_id"] for f in fixtures}) != 6 or len({_hash(f["input"]) for f in fixtures}) != 6):
                raise HookRuntimeError("HOOK_RUNTIME_PILOT_COVERAGE")
            capture = hashed(dict(target=target, fixtures=fixtures, principal=host[2], context_id=host[1], captured_at=_time(now), expires_at=_time(expires_at), state_hash=record["events"][-1]["content_hash"]))
            key = target["content_hash"]
            old = self._state["pilot_captures"].get(key)
            if old and old != capture:
                raise HookRuntimeError("HOOK_RUNTIME_CAPTURE_REBIND")
            self._state["pilot_captures"][key] = capture; self._changed()
            return snapshot(capture)

    def _capture(self, collection, record, now, reason):
        value = self._state[collection].get(record["target"]["content_hash"])
        if (value is None or not datetime.fromisoformat(value["captured_at"]) <= _time(now) < datetime.fromisoformat(value["expires_at"])
                or value["state_hash"] != record["events"][-1]["content_hash"]):
            raise HookRuntimeError(reason)
        return value

    def _fault_policy_receipt(self, record, receipt, fault):
        """Pilot와 active가 동일한 D09 fault/merge 계약을 소비한다."""
        kind = "timeout" if fault == "timeout" else "error"
        policy = record["definition"]["failure_policy"]
        closed = policy == "fail_closed"
        projection = self._registry._fault(record["registry_record"], record["target"], kind)
        expected = dict(hook_ref=record["target"], fault=kind, failure_policy=policy, program_result=None,
                        decision="deny" if closed else "allow", warning=not closed, log=True,
                        reason="HOOK_" + kind.upper() + "_" + policy.upper(), executed=False,
                        boundary="ENGINE_FAULT_PROJECTION_NOT_EXECUTED")
        if projection != hashed(expected):
            raise HookRuntimeError("HOOK_RUNTIME_FAULT_POLICY_MISMATCH")
        # Empty normal results must be canonical allow; then the independent
        # engine fault participates with the same deny priority as D09.merge.
        merged = to_primitive(merge_results(record["definition"]["event"], []))
        if (merged["decision"] != "allow" or merged["modifications"] or merged["reason"] != "HOOK_ALLOW"
                or merged["content_hash"] != _hash({k:v for k,v in merged.items() if k != "content_hash"})):
            raise HookRuntimeError("HOOK_RUNTIME_FAULT_POLICY_MISMATCH")
        merged = {k:v for k,v in merged.items() if k != "content_hash"}
        if closed: merged.update(decision="deny", reason="HOOK_FAULT_DENY", modifications={})
        merged["faults"] = [projection]
        merged = hashed(merged)
        value = {k:v for k,v in receipt.items() if k != "content_hash"}
        value.update(kind="fault", fault=fault, result=None, failure_policy=policy, canonical_decision=merged["decision"],
                     warning=projection["warning"], log=projection["log"], projection_hash=projection["content_hash"],
                     fault_projection=projection, fault_merge=merged)
        return hashed(value)

    @boundary
    def pilot(self, ctx, target, *, expected_version, request_id, now):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now)
            signature, replay = self._begin(record, "pilot", [], expected_version, request_id, ("SHADOW",))
            if replay: return replay
            capture = self._capture("pilot_captures", record, now, "HOOK_RUNTIME_PILOT_REQUIRED")
            receipts = []
            for fixture in capture["fixtures"]:
                result = self._execute(record, fixture["event"], fixture["input"])
                if result.get("fault"):
                    try:
                        result = self._fault_policy_receipt(record, result, result["fault"])
                    except (MemoryError, ValueError, TypeError, KeyError):
                        raise HookRuntimeError("HOOK_RUNTIME_PILOT_NOT_PASS") from None
                kind = fixture["kind"]
                passed = (result["kind"] == "result" if kind == "positive" else result["kind"] == "unmatched" if kind == "negative" else
                          result["kind"] == "recursion" if kind == "recursion" else result.get("fault") == {"timeout":"timeout", "schema":"schema", "fault_policy":"error"}[kind])
                receipts.append(dict(case_id=fixture["case_id"], kind=kind, passed=passed, receipt=result))
            if not all(x["passed"] for x in receipts):
                raise HookRuntimeError("HOOK_RUNTIME_PILOT_NOT_PASS")
            record["pilot"] = hashed(dict(capture_hash=capture["content_hash"], receipts=receipts, passed=True))
            self._event(record, "PILOT", record["pilot"], now)
            return self._finish(request_id, signature, record)

    def _binding(self, record):
        return dict(definition_hash=record["target"]["content_hash"], program_ref=record["registry_record"]["program"]["ref"],
                    permission_profile_hash=_hash(record["definition"]["permissions"]), scope_hash=_hash(self._state["scope"]),
                    principal_id=self._state["principal_id"], context_id=self._state["context_id"])

    @boundary
    def capture_human_trust(self, ctx, target, *, allowed_results, allow_narrowing, evidence_ref, now, expires_at):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now)
            if record["status"] != "PILOT" or type(allowed_results) is not list or not allowed_results or type(allow_narrowing) is not bool:
                raise HookRuntimeError("HOOK_RUNTIME_HUMAN_TRUST_REQUIRED")
            if not set(allowed_results) <= EVENT_RESULTS[record["definition"]["event"]] or _time(now) >= _time(expires_at):
                raise HookRuntimeError("HOOK_RUNTIME_HUMAN_TRUST_REQUIRED")
            _text(evidence_ref)
            capture = hashed(dict(**self._binding(record), target=target, allowed_results=sorted(set(allowed_results)), allow_narrowing=allow_narrowing,
                                  evidence_ref=evidence_ref, state_hash=record["events"][-1]["content_hash"], pilot_hash=record["pilot"]["content_hash"],
                                  captured_at=_time(now), expires_at=_time(expires_at), mode="HUMAN"))
            key = target["content_hash"]
            old = self._state["human_captures"].get(key)
            if old and old != capture:
                raise HookRuntimeError("HOOK_RUNTIME_CAPTURE_REBIND")
            self._state["human_captures"][key] = capture; self._changed()
            return snapshot(capture)

    def _valid_trust(self, record, now):
        trust = record["trust"]
        if (trust is None or any(trust.get(k) != v for k, v in self._binding(record).items())
                or not datetime.fromisoformat(trust["captured_at"]) <= _time(now) < datetime.fromisoformat(trust["expires_at"])
                or _hash({k:v for k,v in trust.items() if k != "content_hash"}) != trust["content_hash"]):
            raise HookRuntimeError("HOOK_RUNTIME_STALE_TRUST")
        return trust

    def _auto_trust(self, ctx, host, record, now):
        definition = record["definition"]
        old_target = self._state["heads"].get(definition["hook_id"])
        if not old_target:
            raise HookRuntimeError("HOOK_RUNTIME_AUTO_NOT_AUTHORIZED")
        old = self._entry(ctx, host, old_target, now)
        trust = self._valid_trust(old, now)
        proposal = self._registry.query(ctx, record["registry_record"]["proposal_id"], now=now)
        before, after = old["definition"], definition
        old_ex = {_canonical(x) for x in before["matcher"]["exclude"]}
        new_ex = {_canonical(x) for x in after["matcher"]["exclude"]}
        if (old["status"] != "ACTIVE" or not trust["allow_narrowing"] or set(trust["allowed_results"]) != {"log"}
                or before["failure_policy"] != "fail_open" or proposal["action"] != "patch_matcher"
                or list(proposal["before"]) != [old_target] or before["version"] + 1 != after["version"]
                or any(before[k] != after[k] for k in before if k not in ("version", "matcher"))
                or before["matcher"]["all"] != after["matcher"]["all"] or not old_ex < new_ex
                or not self._narrowing_witness(old, [x for x in after["matcher"]["exclude"] if _canonical(x) not in old_ex])):
            raise HookRuntimeError("HOOK_RUNTIME_AUTO_NOT_AUTHORIZED")
        return hashed(dict(**self._binding(record), target=record["target"], mode="TRUSTED_AUTO", parent_trust_hash=trust["content_hash"],
                           allowed_results=trust["allowed_results"], allow_narrowing=True, captured_at=_time(now), expires_at=trust["expires_at"],
                           pilot_hash=record["pilot"]["content_hash"]))

    def _narrowing_witness(self, old, added):
        # Exclusion addition cannot widen. Prove strict narrowing with at least
        # one concrete canonical Event formerly matched but now excluded.
        # If this limited algebra cannot construct a witness, require human trust.
        def witness(condition):
            value = condition["value"]
            if condition["op"] == "path_glob":
                value = value.replace("**", "probe/item.py").replace("*", "probe")
            return value
        for exclusion in added:
            payload = {c["field"]:witness(c) for c in old["definition"]["matcher"]["all"]}
            payload[exclusion["field"]] = witness(exclusion)
            event = dict(event=old["definition"]["event"], payload=payload)
            if self._matches(old, event) and self._registry._matches(exclusion, payload): return True
        return False

    @boundary
    def trust(self, ctx, target, *, mode, expected_version, request_id, now):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now)
            signature, replay = self._begin(record, "trust", mode, expected_version, request_id, ("PILOT",))
            if replay: return replay
            if mode == "human":
                trust = self._capture("human_captures", record, now, "HOOK_RUNTIME_HUMAN_TRUST_REQUIRED")
            elif mode == "trusted_auto":
                trust = self._auto_trust(ctx, host, record, now)
            else:
                raise HookRuntimeError("HOOK_RUNTIME_HUMAN_TRUST_REQUIRED")
            actions = {x["receipt"]["result"]["result"] for x in record["pilot"]["receipts"] if x["receipt"].get("result")}
            if not actions <= set(trust["allowed_results"]):
                raise HookRuntimeError("HOOK_RUNTIME_RESULT_NOT_TRUSTED")
            record["trust"] = to_primitive(trust)
            self._event(record, "TRUST_REVIEW", trust, now)
            return self._finish(request_id, signature, record)

    def _automation(self, now):
        body = hashed(dict(version=len(self._state["automation"]) + 1, heads=self._state["heads"], fallbacks=self._state["fallbacks"], created_at=_time(now),
                           previous_hash=self._state["automation"][-1]["content_hash"] if self._state["automation"] else None))
        self._state["automation"].append(body); self._changed()
        return body

    @boundary
    def activate(self, ctx, target, *, expected_version, request_id, now):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now)
            signature, replay = self._begin(record, "activate", [], expected_version, request_id, ("TRUST_REVIEW",))
            if replay: return replay
            trust = self._valid_trust(record, now)
            name = target["hook_id"]
            if self._state["heads"].get(name) != record["expected_head"]:
                raise HookRuntimeError("HOOK_RUNTIME_HEAD_CONFLICT")
            if trust["mode"] == "TRUSTED_AUTO": self._auto_trust(ctx, host, record, now)
            record["rollback_ref"] = self._state["automation"][-1]["content_hash"] if self._state["automation"] else "BASELINE"
            self._state["heads"][name] = to_primitive(target)
            self._state["fallbacks"].pop(name, None)
            record["activated_at"] = _time(now).isoformat()
            self._event(record, "ACTIVE", trust, now)
            automation = self._automation(now)
            record["notifications"].append(hashed(dict(type="HOOK_ACTIVATED", mode=trust["mode"], target=target, applies_from="NEXT_RUN",
                                                       automation_hash=automation["content_hash"], rollback_ref=record["rollback_ref"])))
            return self._finish(request_id, signature, record)

    @boundary
    def capture_run_start(self, ctx, snapshot_ref, *, now):
        with self._session(ctx, now) as host:
            fields(snapshot_ref, "session_id task_id run_id snapshot_id content_hash")
            c = self._registry._candidates
            actual = c._snapshots.get_task_run(snapshot_ref["session_id"], snapshot_ref["task_id"], snapshot_ref["run_id"], MemoryScope(*host[3]))
            observed = _time(c._run_clock())
            if (actual.snapshot_id != snapshot_ref["snapshot_id"] or actual.content_hash != snapshot_ref["content_hash"]
                    or not actual.created_at <= _time(now) <= observed < min(actual.created_at + timedelta(seconds=5), host[6])):
                raise HookRuntimeError("HOOK_RUNTIME_RUN_START_STALE")
            if actual.run_id in self._state["run_ids"]:
                raise HookRuntimeError("HOOK_RUNTIME_RUN_START_CONSUMED")
            hooks = []
            targets = {**self._state["fallbacks"], **self._state["heads"]}
            for target in sorted(targets.values(), key=lambda x:x["hook_id"]):
                is_fallback = self._state["fallbacks"].get(target["hook_id"]) == target
                record = self._entry(ctx, host, target, now, live=not is_fallback)
                if is_fallback:
                    if not record["fallback"]: raise HookRuntimeError("HOOK_RUNTIME_NOT_ACTIVE")
                    hooks.append(dict(target=record["target"], trust_hash=None, managed_fallback=True))
                    continue
                self._valid_trust(record, now)
                origin = self._registry._candidates._entry(ctx, host, record["registry_record"]["candidate_ref"], now)[1]
                if (record["status"] != "ACTIVE" or actual.created_at <= datetime.fromisoformat(record["activated_at"])
                        or actual.run_id == origin["terminal_subject"]["subject_id"]):
                    raise HookRuntimeError("HOOK_RUNTIME_RUN_START_STALE")
                hooks.append(dict(target=record["target"], trust_hash=record["trust"]["content_hash"]))
            body = hashed(dict(snapshot_ref=snapshot_ref, hooks=hooks, skill_versions=[to_primitive(x) for x in actual.source_versions if x["kind"] == "SKILL"],
                               automation_hash=self._state["automation"][-1]["content_hash"] if self._state["automation"] else "BASELINE",
                               principal=host[2], context_id=host[1], observed_at=observed, starts_at=actual.created_at,
                               expires_at=min(actual.created_at + timedelta(seconds=5), host[6])))
            cap = HookRunStart("hook-start-" + body["content_hash"], body["content_hash"])
            self._starts[cap.boundary_id] = (cap, ctx, body)
            self._state["run_ids"][actual.run_id] = None; self._changed()
            return cap

    @boundary
    def select_next_run(self, ctx, start, *, now):
        with self._session(ctx, now) as host:
            entry = self._starts.get(start.boundary_id) if type(start) is HookRunStart else None
            if not entry or entry[0] is not start or entry[1] is not ctx or entry[2]["content_hash"] != start.content_hash:
                raise HookRuntimeError("HOOK_RUNTIME_RUN_START_AUTHORITY_REQUIRED")
            body = entry[2]; observed = _time(self._registry._candidates._run_clock())
            if not datetime.fromisoformat(body["observed_at"]) <= _time(now) <= observed < datetime.fromisoformat(body["expires_at"]):
                raise HookRuntimeError("HOOK_RUNTIME_RUN_START_STALE")
            run_id = body["snapshot_ref"]["run_id"]
            if self._state["run_ids"].get(run_id) is not None:
                raise HookRuntimeError("HOOK_RUNTIME_RUN_START_CONSUMED")
            for item in body["hooks"]:
                record = self._entry(ctx, host, item["target"], now, live=not item.get("managed_fallback", False))
                if item.get("managed_fallback"):
                    if not record["fallback"]: raise HookRuntimeError("HOOK_RUNTIME_NOT_ACTIVE")
                    continue
                if record["status"] != "ACTIVE" or self._valid_trust(record, now)["content_hash"] != item["trust_hash"]:
                    raise HookRuntimeError("HOOK_RUNTIME_STALE_TRUST")
            value = hashed(dict(**{k:body[k] for k in ("hooks", "skill_versions", "snapshot_ref", "automation_hash", "principal", "context_id")},
                                run_id=run_id, created_at=observed, run_started_at=body["starts_at"], boundary_hash=start.content_hash))
            value["selection_id"] = "automation-selection-" + value["content_hash"]
            self._state["selections"][value["selection_id"]] = value
            self._state["run_ids"][run_id] = value["selection_id"]; self._changed()
            return snapshot(value)

    def _safety_blocking(self, record):
        if record["definition"]["failure_policy"] == "fail_closed": return True
        event = record["definition"]["event"]
        actions = set((record.get("trust") or {}).get("allowed_results", []))
        normal = [record.get("shadow", {}).get("receipt", {})]
        normal += [x["receipt"] for x in (record.get("pilot") or {}).get("receipts", [])]
        actions.update(x["result"]["result"] for x in normal if x.get("result"))
        return any(merge_results(event, [dict(result=action, modifications={}, messages=[])])["decision"] == "deny"
                   for action in actions & EVENT_RESULTS[event] & {"deny", "block"})

    def _publish_isolation_snapshot(self, now):
        version = len(self._state["automation"]) + 1
        published = self._automation(now)
        if (type(published) is not dict or len(self._state["automation"]) != version
                or self._state["automation"][-1] != published or published.get("version") != version
                or published.get("heads") != self._state["heads"] or published.get("fallbacks") != self._state["fallbacks"]
                or published.get("content_hash") != _hash({k:v for k,v in published.items() if k != "content_hash"})):
            raise HookRuntimeError("HOOK_RUNTIME_FALLBACK_PUBLICATION_FAILED")
        return published

    def _isolate(self, record, reason, now):
        if record["status"] != "ACTIVE": return
        prior_state = to_primitive(self._state)
        context_id = self._state["context_id"]
        prior_epoch = self._authority._epochs[context_id]
        try:
            name = record["target"]["hook_id"]
            owns_head = self._state["heads"].get(name) == record["target"]
            if self._safety_blocking(record):
                record["fallback"] = hashed(dict(policy="MANAGED_BUILTIN_SAFETY_BLOCK", decision="deny", target=record["target"], reason=reason))
                if owns_head: self._state["fallbacks"][name] = record["target"]
                # Publish a hash-bound fallback head/snapshot while the original
                # head is still ACTIVE. Only after this succeeds may it be removed.
                self._publish_isolation_snapshot(now)
                self._audit(record, "MANAGED_FALLBACK_ACTIVATED", record["fallback"], now)
            record["affected_runs"] = sorted({v["run_id"] for v in self._state["selections"].values() if any(x["target"] == record["target"] for x in v["hooks"])})
            record["notifications"].append(hashed(dict(type="HOOK_QUARANTINED", reason=reason, target=record["target"], affected_runs=record["affected_runs"])))
            self._event(record, "QUARANTINED", reason, now)
            self._audit(record, "QUARANTINED", dict(reason=reason, rollback_ref=record["rollback_ref"]), now)
            if owns_head: self._state["heads"].pop(name)
            self._publish_isolation_snapshot(now)
        except Exception:
            # In-memory transaction rollback: no notification, epoch, quarantine
            # or head deletion can survive failed fallback creation/publication.
            self._state = prior_state
            self._authority._epochs[context_id] = prior_epoch
            raise HookRuntimeError("HOOK_RUNTIME_FALLBACK_PUBLICATION_FAILED") from None

    @boundary
    def quarantine(self, ctx, target, *, reason, expected_version, request_id, now):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now, live=False)
            signature, replay = self._begin(record, "quarantine", reason, expected_version, request_id, ("ACTIVE",))
            if replay: return replay
            if reason not in ("REPEATED_ERROR", "LATENCY", "EXCESS_DENY", "SCHEMA", "SECURITY"):
                raise HookRuntimeError("INVALID_HOOK_RUNTIME_INPUT")
            self._isolate(record, reason, now)
            return self._finish(request_id, signature, record)

    @boundary
    def rollback(self, ctx, target, *, expected_version, request_id, now):
        with self._session(ctx, now) as host:
            record = self._entry(ctx, host, target, now, live=False)
            signature, replay = self._begin(record, "rollback", [], expected_version, request_id, ("ACTIVE", "QUARANTINED"))
            if replay: return replay
            previous = next((x for x in self._state["automation"] if x["content_hash"] == record["rollback_ref"]), None)
            old_target = previous["heads"].get(target["hook_id"]) if previous else None
            if old_target:
                old = self._entry(ctx, host, old_target, now)
                if old["status"] != "ACTIVE": raise HookRuntimeError("HOOK_RUNTIME_UNSAFE_ROLLBACK")
                self._valid_trust(old, now)
            current = self._state["heads"].get(target["hook_id"])
            if current is not None and current != target: raise HookRuntimeError("HOOK_RUNTIME_HEAD_CONFLICT")
            if old_target: self._state["heads"][target["hook_id"]] = old_target
            else: self._state["heads"].pop(target["hook_id"], None)
            self._state["fallbacks"].pop(target["hook_id"], None)
            record["restored_target"] = old_target
            record["affected_runs"] = sorted({v["run_id"] for v in self._state["selections"].values() if any(x["target"] == target for x in v["hooks"])})
            self._event(record, "RETIRED", dict(rollback_ref=record["rollback_ref"], restored_target=old_target), now)
            self._audit(record, "ROLLED_BACK", record["restored_target"], now)
            self._automation(now)
            return self._finish(request_id, signature, record)

    @boundary
    def run(self, ctx, selection_id, event, data, *, now):
        with self._session(ctx, now) as host:
            selected = self._state["selections"].get(selection_id)
            if selected is None: raise HookRuntimeError("HOOK_RUNTIME_NOT_ACTIVE")
            if _time(now) < datetime.fromisoformat(selected["created_at"]): raise HookRuntimeError("HOOK_RUNTIME_STALE_TIME")
            self._event_input(event, data)
            key = _hash([selection_id, event["event_id"]]); signature = _hash([selection_id, event, data])
            prior = self._state["receipts"].get(key)
            if prior:
                if prior["signature"] != signature: raise HookRuntimeError("HOOK_RUNTIME_REPLAY_CONFLICT")
            records = []
            for item in selected["hooks"]:
                record = self._entry(ctx, host, item["target"], now, live=not item.get("managed_fallback", False))
                if record["status"] == "ACTIVE":
                    if self._valid_trust(record, now)["content_hash"] != item["trust_hash"]: raise HookRuntimeError("HOOK_RUNTIME_STALE_TRUST")
                    program = record["registry_record"]["program"]["data"]
                    expected = {k:program[k] for k in ("source_hash", "dependency_hash", "artifact_hash", "signature_hash")}
                    if self._executor.inspect(snapshot(program)) != expected:
                        self._isolate(record, "HASH_DRIFT", now)
                        raise HookRuntimeError("HOOK_RUNTIME_HASH_DRIFT")
                elif not record["fallback"]: raise HookRuntimeError("HOOK_RUNTIME_NOT_ACTIVE")
                elif prior and prior["result"]["decision"] != "deny": raise HookRuntimeError("HOOK_RUNTIME_NOT_ACTIVE")
                records.append(record)
            if prior: return snapshot(prior["result"])
            outputs, results, deny = [], [], False
            if event["depth"] >= 1:
                outcome = dict(decision="deny", reason="HOOK_RECURSION_BLOCKED", modifications={}, messages=[])
            else:
                records.sort(key=lambda r:(not r["registry_record"]["managed"], r["target"]["hook_id"]))
                for record in records:
                    if not self._matches(record, event): continue
                    if record["status"] != "ACTIVE":
                        deny = True; outputs.append(record["fallback"]); continue
                    try:
                        receipt = self._execute(record, event, data)
                    except HookRuntimeError as error:
                        if error.reason == "HOOK_RUNTIME_HASH_DRIFT": self._isolate(record, "HASH_DRIFT", now)
                        raise
                    outputs.append(receipt)
                    fault = receipt.get("fault")
                    if receipt.get("result"):
                        value = receipt["result"]
                        if value["result"] not in record["trust"]["allowed_results"]:
                            fault = "schema"
                        else:
                            results.append(value)
                            record["deny_count"] += value["result"] in ("deny", "block")
                    if fault:
                        receipt = self._fault_policy_receipt(record, receipt, fault)
                        outputs[-1] = receipt
                        record["error_count"] += 1
                        deny |= receipt["canonical_decision"] == "deny"
                        outputs.append(receipt["fault_projection"])
                        if fault in ("schema", "timeout") or record["error_count"] >= 2:
                            self._isolate(record, "SCHEMA" if fault == "schema" else "LATENCY" if fault == "timeout" else "REPEATED_ERROR", now)
                    if record["deny_count"] >= 3: self._isolate(record, "EXCESS_DENY", now)
                outcome = to_primitive(merge_results(event["event"], results))
                if deny: outcome.update(decision="deny", reason="HOOK_FAULT_DENY", modifications={})
            outcome = {k:v for k,v in outcome.items() if k != "content_hash"}
            outcome.update(selection_id=selection_id, event_hash=_hash(event), receipts=outputs, boundary="FAKE_SANDBOX_ONLY", actual_os_executed=False)
            outcome = hashed(outcome)
            self._state["receipts"][key] = dict(signature=signature, result=outcome); self._changed()
            return snapshot(outcome)

    @boundary
    def export_state(self, ctx, *, now):
        with self._session(ctx, now) as host:
            value = dict(state=to_primitive(self._state), epoch=self._authority._epochs[host[1]], context_id=host[1], principal_id=host[2])
            value["content_hash"] = _hash(value["state"])
            value["checkpoint_id"] = "hook-checkpoint-" + _hash(value)
            self._authority._checkpoints[value["checkpoint_id"]] = (ctx, _canonical(value))
            return snapshot(value)

    @boundary
    def import_state(self, ctx, envelope, *, now):
        with self._session(ctx, now, restore=True) as host:
            fields(envelope, "state epoch context_id principal_id content_hash checkpoint_id")
            item = self._authority._checkpoints.get(envelope["checkpoint_id"])
            if (not item or item[0] is not ctx or item[1] != _canonical(envelope) or envelope["context_id"] != host[1]
                    or envelope["principal_id"] != host[2] or envelope["epoch"] != self._authority._epochs.get(host[1])
                    or envelope["content_hash"] != _hash(envelope["state"])):
                raise HookRuntimeError("HOOK_RUNTIME_CHECKPOINT_REJECTED")
            value = to_primitive(envelope["state"])
            for record in value["records"].values():
                if record["status"] == "ACTIVE":
                    actual = self._canonical_record(ctx, host, record["target"], now)
                    if actual != record["registry_record"] or not _time(now) < datetime.fromisoformat(record["trust"]["expires_at"]):
                        raise HookRuntimeError("HOOK_RUNTIME_CHECKPOINT_REJECTED")
            self._state, self._context = value, ctx
            self._authority._owners[host[1]] = self
            self._starts = {}; self._changed()
            return snapshot(dict(restored=True, checkpoint_id=envelope["checkpoint_id"], boundary="IN_MEMORY_RESTART_ONLY"))
