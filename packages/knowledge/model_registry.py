"""D11 host-issued fixture registry. Provider/network/process/DB IO 없음.

capture_*는 인증된 host의 관측/사람 결정을 수신하는 trust boundary이다.
API에는 capture 발급 경로가 없다. authority checkpoint는 in-memory adapter이며
실제 서명/영속 재시작 및 D02/Provider consumer 주입은 NOT_INTEGRATED다.
"""
from contextlib import contextmanager
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from functools import wraps
import json
import re
from .memory import MemoryError, MemoryScope, _canonical, _hash, _time, to_primitive
from .sources import _text, _scan_body_credentials
from .candidates import CandidateRepository, snapshot


PROVIDERS = ("cerebras", "groq", "mistral", "openrouter", "upstage", "gemini", "anthropic", "openai", "ollama")
ROLES = ("request_analyzer", "planner", "developer", "reviewer", "reflection", "skill_curator")


class ModelRegistryError(MemoryError):
    pass


def boundary(fn):
    @wraps(fn)
    def call(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ModelRegistryError:
            raise
        except MemoryError as error:
            raise ModelRegistryError(error.reason) from None
        except (ValueError, TypeError, KeyError, IndexError, OverflowError, RecursionError, InvalidOperation):
            raise ModelRegistryError("INVALID_REGISTRY_INPUT") from None
    return call


def atomic_publication(fn):
    """Registry lock 아래 전체 publication과 응답 생성까지 하나의 transaction.

    Epoch/owner는 이 context 항목만 복구하여 다른 host의 상태를 덮지 않는다.
    실제 DB transaction을 대신하는 in-memory boundary다.
    """
    @wraps(fn)
    def call(self, ctx, *args, **kwargs):
        with self._candidates._session(ctx, kwargs["now"]) as host:
            before = json.loads(_canonical(self._state))
            context = self._context
            missing = object()
            epoch = self._authority.epochs.get(host[1], missing)
            owner = self._authority.owners.get(host[1], missing)
            try:
                return fn(self, ctx, *args, **kwargs)
            except BaseException:
                self._state, self._context = before, context
                for registry, value in ((self._authority.epochs, epoch), (self._authority.owners, owner)):
                    if value is missing: registry.pop(host[1], None)
                    else: registry[host[1]] = value
                raise
    return call


def fields(value, names):
    if type(value) is not dict or set(value) != set(names.split()):
        raise ModelRegistryError("INVALID_REGISTRY_INPUT")


def safe(value):
    value = to_primitive(value)
    if len(_canonical(value).encode("utf-8")) > 65536:
        raise ModelRegistryError("REGISTRY_INPUT_TOO_LARGE")
    _scan_body_credentials(value)
    def walk(item):
        if type(item) is str:
            _text(item)
        elif type(item) is dict:
            for key, child in item.items():
                _text(key); walk(child)
        elif type(item) is list:
            for child in item: walk(child)
        elif item is not None and type(item) not in (bool, int, float):
            raise ModelRegistryError("INVALID_REGISTRY_INPUT")
    walk(value)
    return value


def integer(value, minimum=1):
    if type(value) is not int or value < minimum:
        raise ModelRegistryError("INVALID_REGISTRY_INPUT")
    return value


def amount(value):
    if type(value) not in (int, float, str): raise ModelRegistryError("INVALID_REGISTRY_INPUT")
    result = Decimal(str(value))
    if not result.is_finite() or result < 0: raise ModelRegistryError("INVALID_REGISTRY_INPUT")
    return result


def digest(value):
    if type(value) is not str or not re.fullmatch("[a-f0-9]{64}", value):
        raise ModelRegistryError("INVALID_REGISTRY_INPUT")


def stamp(value):
    return _time(datetime.fromisoformat(value) if type(value) is str else value)


def ref(value):
    return {k: value[k] for k in ("id", "version", "content_hash")}


def hashed(value):
    value = to_primitive(value); value["content_hash"] = _hash(value)
    return value


def words(value):
    if type(value) is not list or len(value) != len(set(value)) or any(type(x) is not str for x in value):
        raise ModelRegistryError("INVALID_REGISTRY_INPUT")
    return sorted(value)


class ModelRegistryAuthority:
    """Host control-plane ownership and checkpoint seals; no payload-issued authority."""
    def __init__(self):
        self.owners, self.epochs, self.checkpoints = {}, {}, {}


class ModelRegistry:
    def __init__(self, candidates, authority, *, roles, min_samples=3, max_sample_cost=1):
        if type(candidates) is not CandidateRepository or type(authority) is not ModelRegistryAuthority:
            raise ModelRegistryError("REGISTRY_HOST_REQUIRED")
        if not roles or len(set(roles)) != len(roles) or not set(roles) <= set(ROLES):
            raise ModelRegistryError("EXACT_ROLE_SET_REQUIRED")
        integer(min_samples, 3); amount(max_sample_cost)
        self._candidates, self._authority, self._context = candidates, authority, None
        self._policy = dict(roles=sorted(roles), min_samples=min_samples, max_sample_cost=str(max_sample_cost))
        self._state = dict(policy=self._policy, context_id=None, principal_id=None, scope=None, captures={},
                           prompts={}, models={}, benchmarks={}, routing_candidates={}, heads={}, active=None,
                           activations=[], quarantine=[], audit=[], runs={}, version=0, last_at=None,
                           boundary="HOST_FIXTURE_ONLY_NEXT_RUN_SIDECAR")

    @contextmanager
    def _session(self, ctx, now, *, restore=False):
        with self._candidates._session(ctx, now) as host:
            if not restore:
                if self._context is not None and self._context is not ctx:
                    raise ModelRegistryError("REGISTRY_AUTHORITY_MISMATCH")
                if self._authority.owners.get(host[1], self) is not self:
                    raise ModelRegistryError("REGISTRY_OWNER_STALE")
                if self._context is None:
                    self._context = ctx
                    self._state.update(context_id=host[1], principal_id=host[2], scope=to_primitive(MemoryScope(*host[3])))
                    self._authority.owners[host[1]] = self
                    self._authority.epochs.setdefault(host[1], 0)
                if self._state["last_at"] and _time(now) < stamp(self._state["last_at"]):
                    raise ModelRegistryError("REGISTRY_STALE_TIME")
            yield host

    def _changed(self, now):
        self._state["last_at"] = _time(now).isoformat()
        key = self._state["context_id"]
        self._authority.epochs[key] += 1

    def _capture(self, kind, data, now, expires_at, **proof):
        if not _time(now) < _time(expires_at): raise ModelRegistryError("STALE_HOST_CAPTURE")
        capture = hashed(dict(kind=kind, data=data, context_id=self._state["context_id"], principal_id=self._state["principal_id"],
                              scope=self._state["scope"], created_at=_time(now), expires_at=_time(expires_at), proof=proof))
        identity = "capture-" + capture["content_hash"]
        self._state["captures"][identity] = capture; self._changed(now)
        return identity

    def _capture_get(self, kind, identity, now):
        value = self._state["captures"].get(identity)
        if not value: raise ModelRegistryError("HOST_CAPTURE_REQUIRED")
        expected_fields = set("kind data context_id principal_id scope created_at expires_at proof content_hash".split())
        if (type(value) is not dict or set(value) != expected_fields
                or _hash({k: v for k, v in value.items() if k != "content_hash"}) != value["content_hash"]
                or identity != "capture-" + value["content_hash"]
                or any(value[name] != self._state[name] for name in ("context_id", "principal_id", "scope"))):
            raise ModelRegistryError("HOST_CAPTURE_INTEGRITY_MISMATCH")
        if value["kind"] != kind: raise ModelRegistryError("HOST_CAPTURE_REQUIRED")
        if not stamp(value["created_at"]) <= _time(now) < stamp(value["expires_at"]):
            raise ModelRegistryError("STALE_HOST_CAPTURE")
        return value

    def _entry(self, kind, target):
        target = to_primitive(target); fields(target, "id version content_hash")
        integer(target["version"]); digest(target["content_hash"])
        value = self._state[kind].get(target["content_hash"])
        if value is None or ref(value) != target or _hash({k: v for k, v in value.items() if k != "content_hash"}) != target["content_hash"]:
            raise ModelRegistryError("REGISTRY_REFERENCE_MISMATCH")
        return value

    def _candidate(self, ctx, host, data, now):
        _, value, state = self._candidates._entry(ctx, host, data["candidate_ref"], now)
        if value["kind"] != "PROMPT" or value["target_id"] != data["id"] or state["status"] != "ACTIVE":
            raise ModelRegistryError("PROMPT_PROVENANCE_REQUIRED")
        if _hash({k: v for k, v in value.items() if k != "content_hash"}) != value["content_hash"]:
            raise ModelRegistryError("PROMPT_PROVENANCE_REQUIRED")
        return value

    @boundary
    def capture_prompt(self, ctx, data, *, evidence_ref, now, expires_at):
        with self._session(ctx, now) as host:
            data = safe(data); fields(data, "id version role body input_contract output_contract candidate_ref")
            integer(data["version"]); _text(evidence_ref)
            if data["role"] not in self._policy["roles"]: raise ModelRegistryError("EXACT_ROLE_SET_REQUIRED")
            if not data["body"] or not data["input_contract"] or not data["output_contract"]:
                raise ModelRegistryError("INVALID_REGISTRY_INPUT")
            candidate = self._candidate(ctx, host, data, now)
            return self._capture("prompt", data, now, expires_at, approval="HUMAN", evidence_ref=evidence_ref,
                                 source_provenance=candidate["provenance"], candidate_hash=candidate["content_hash"])

    def _model_data(self, data, now):
        data = safe(data)
        fields(data, "id version provider upstream_provider upstream_model model_id model_revision endpoint_ref account_ref organization_ref region context_tokens capabilities tools privacy_class retention_days training_use zdr pricing benchmark_revision probe")
        integer(data["version"]); integer(data["context_tokens"]); integer(data["retention_days"], 0)
        if data["provider"] not in PROVIDERS or data["upstream_provider"] not in PROVIDERS:
            raise ModelRegistryError("UNKNOWN_PROVIDER")
        if data["upstream_provider"] == "openrouter" or type(data["upstream_model"]) is not str or not data["upstream_model"]:
            raise ModelRegistryError("UPSTREAM_PROVENANCE_MISMATCH")
        if data["provider"] != "openrouter" and data["provider"] != data["upstream_provider"]:
            raise ModelRegistryError("UPSTREAM_PROVENANCE_MISMATCH")
        for name in ("endpoint_ref", "account_ref", "organization_ref"):
            if not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", data[name]): raise ModelRegistryError("OPAQUE_REFERENCE_REQUIRED")
        for name in ("training_use", "zdr"):
            if type(data[name]) is not bool: raise ModelRegistryError("INVALID_REGISTRY_INPUT")
        if data["privacy_class"] not in ("LOCAL", "CLOUD") or (data["provider"] == "ollama") != (data["privacy_class"] == "LOCAL"):
            raise ModelRegistryError("INVALID_PRIVACY_CLASS")
        data["capabilities"], data["tools"] = words(data["capabilities"]), words(data["tools"])
        fields(data["pricing"], "currency unit input output")
        if data["pricing"]["currency"] not in ("USD", "KRW", "EUR") or data["pricing"]["unit"] != "PER_MILLION_TOKENS":
            raise ModelRegistryError("INVALID_PRICE_UNIT")
        for name in ("input", "output"): data["pricing"][name] = format(amount(data["pricing"][name]).normalize(), "f")
        probe = data["probe"]; fields(probe, "revision evidence_hash observed_at ttl_seconds status")
        digest(probe["evidence_hash"]); integer(probe["ttl_seconds"])
        if probe["status"] not in ("AVAILABLE", "UNAVAILABLE", "ERROR") or stamp(probe["observed_at"]) > _time(now):
            raise ModelRegistryError("INVALID_PROBE")
        probe["observed_at"] = stamp(probe["observed_at"]).isoformat()
        return data

    @boundary
    def capture_model(self, ctx, data, *, now):
        with self._session(ctx, now):
            data = self._model_data(data, now)
            expiry = stamp(data["probe"]["observed_at"]) + timedelta(seconds=data["probe"]["ttl_seconds"])
            return self._capture("model", data, now, expiry, mode="HOST_PROBE_FIXTURE")

    def _fresh_model(self, target, now):
        model = self._entry("models", target); data = model["data"]; probe = data["probe"]
        if (self._state["heads"].get("model:" + data["id"]) != target["content_hash"] or probe["status"] != "AVAILABLE"
                or not stamp(probe["observed_at"]) <= _time(now) < stamp(probe["observed_at"]) + timedelta(seconds=probe["ttl_seconds"])):
            raise ModelRegistryError("BLOCKED_CAPABILITY_DRIFT")
        return model

    def _live_prompt(self, ctx, host, target, now):
        prompt = self._entry("prompts", target)
        candidate = self._candidate(ctx, host, prompt["data"], now)
        if candidate["provenance"] != prompt["proof"]["source_provenance"]: raise ModelRegistryError("PROMPT_PROVENANCE_REQUIRED")
        return prompt

    @boundary
    @atomic_publication
    def publish(self, ctx, kind, capture_id, *, now):
        with self._session(ctx, now) as host:
            if kind not in ("model", "prompt", "benchmark"): raise ModelRegistryError("INVALID_REGISTRY_INPUT")
            capture = self._capture_get(kind, capture_id, now); data = capture["data"]
            if kind == "prompt": self._candidate(ctx, host, data, now)
            if kind == "benchmark": self._benchmark_data(ctx, host, data, now)
            record = hashed(dict(id=data["id"], version=data["version"], data=data, proof=capture["proof"], capture_hash=capture["content_hash"],
                                 created_at=capture["created_at"], **({"passed": True} if kind == "benchmark" else {})))
            bucket = {"model": "models", "prompt": "prompts", "benchmark": "benchmarks"}[kind]
            old = [r for r in self._state[bucket].values() if r["id"] == record["id"]]
            same = next((r for r in old if r["version"] == record["version"]), None)
            if same:
                if same != record: raise ModelRegistryError("IMMUTABLE_VERSION_CONFLICT")
                return snapshot(same)
            if record["version"] != max((r["version"] for r in old), default=0) + 1:
                raise ModelRegistryError("IMMUTABLE_VERSION_CONFLICT")
            if kind == "model":
                for item in self._state["models"].values():
                    if item["id"] != record["id"] and (item["data"]["provider"], item["data"]["model_id"]) == (data["provider"], data["model_id"]):
                        raise ModelRegistryError("MODEL_IDENTITY_ALIAS")
            self._state[bucket][record["content_hash"]] = record
            self._state["heads"][kind + ":" + record["id"]] = record["content_hash"]
            self._changed(now); self._refresh(ctx, host, now)
            return snapshot(record)

    def _benchmark_baseline(self, data):
        active = self._state["active"]
        expected = data["target"]
        if active:
            previous = next(r for r in active["routing"]["routes"] if r["role"] == data["role"])
            expected = {k: previous[k] for k in ("prompt", "model")}
            previous_bench = self._entry("benchmarks", previous["benchmark"])
            if previous_bench["data"]["fixture_hash"] != data["fixture_hash"]:
                raise ModelRegistryError("BENCHMARK_FIXTURE_MISMATCH")
        if data["baseline"] != expected: raise ModelRegistryError("BENCHMARK_BASELINE_MISMATCH")

    def _benchmark_data(self, ctx, host, data, now):
        data = safe(data); fields(data, "id version revision role fixture fixture_hash baseline target samples")
        integer(data["version"])
        if data["role"] not in self._policy["roles"]: raise ModelRegistryError("EXACT_ROLE_SET_REQUIRED")
        fields(data["target"], "prompt model"); fields(data["baseline"], "prompt model")
        prompt = self._live_prompt(ctx, host, data["target"]["prompt"], now)
        model = self._fresh_model(data["target"]["model"], now)
        if prompt["data"]["role"] != data["role"] or data["revision"] != model["data"]["benchmark_revision"]:
            raise ModelRegistryError("BENCHMARK_BINDING_MISMATCH")
        self._entry("prompts", data["baseline"]["prompt"]); self._entry("models", data["baseline"]["model"])
        self._benchmark_baseline(data)
        fixture, samples = data["fixture"], data["samples"]
        if type(fixture) is not list or type(samples) is not list or len(fixture) < self._policy["min_samples"] or len(samples) != len(fixture) or _hash(fixture) != data["fixture_hash"]:
            raise ModelRegistryError("BENCHMARK_FIXTURE_MISMATCH")
        for case in fixture:
            fields(case, "case_id input_hash"); digest(case["input_hash"])
        if len({c["case_id"] for c in fixture}) != len(fixture) or len({c["input_hash"] for c in fixture}) != len(fixture):
            raise ModelRegistryError("BENCHMARK_SAMPLE_ALIAS")
        identities = set(); evidence = set()
        expected_cases = {c["case_id"]: c["input_hash"] for c in fixture}
        for sample in samples:
            fields(sample, "case_id input_hash evidence_hash baseline_quality quality regression baseline_cost cost baseline_latency_ms latency_ms")
            digest(sample["evidence_hash"])
            if sample["case_id"] in identities or expected_cases.get(sample["case_id"]) != sample["input_hash"] or sample["evidence_hash"] in evidence:
                raise ModelRegistryError("BENCHMARK_SAMPLE_ALIAS")
            identities.add(sample["case_id"]); evidence.add(sample["evidence_hash"])
            metrics = {name: amount(sample[name]) for name in ("baseline_quality", "quality", "baseline_cost", "cost", "baseline_latency_ms", "latency_ms")}
            if (sample["regression"] is not False or metrics["quality"] < max(Decimal("0.8"), metrics["baseline_quality"])
                    or metrics["cost"] > min(amount(self._policy["max_sample_cost"]), metrics["baseline_cost"])
                    or metrics["latency_ms"] > metrics["baseline_latency_ms"]):
                raise ModelRegistryError("BENCHMARK_NOT_PASS")
        return data

    @boundary
    def capture_benchmark(self, ctx, data, *, now):
        with self._session(ctx, now) as host:
            data = self._benchmark_data(ctx, host, data, now)
            return self._capture("benchmark", data, now, _time(now) + timedelta(minutes=30), mode="HOST_BENCHMARK_FIXTURE")

    def _route_target(self, ctx, host, route, role, now):
        fields(route, "prompt model benchmark requirements")
        prompt = self._live_prompt(ctx, host, route["prompt"], now)
        model = self._fresh_model(route["model"], now)["data"]
        bench = self._entry("benchmarks", route["benchmark"])
        if (prompt["data"]["role"] != role or not bench["passed"] or bench["data"]["role"] != role
                or bench["data"]["target"] != {k: route[k] for k in ("prompt", "model")}):
            raise ModelRegistryError("BENCHMARK_BINDING_MISMATCH")
        req = route["requirements"]
        fields(req, "capabilities tools context_tokens privacy_class training_use retention_days zdr max_input_price max_output_price currency unit")
        words(req["capabilities"]); words(req["tools"]); integer(req["context_tokens"]); integer(req["retention_days"], 0)
        if type(req["training_use"]) is not bool or type(req["zdr"]) is not bool: raise ModelRegistryError("INVALID_REGISTRY_INPUT")
        if (not set(req["capabilities"]) <= set(model["capabilities"]) or not set(req["tools"]) <= set(model["tools"])
                or req["context_tokens"] > model["context_tokens"] or req["privacy_class"] != model["privacy_class"]
                or (model["training_use"] and not req["training_use"]) or model["retention_days"] > req["retention_days"]
                or (req["zdr"] and not model["zdr"]) or req["currency"] != model["pricing"]["currency"]
                or req["unit"] != model["pricing"]["unit"] or amount(model["pricing"]["input"]) > amount(req["max_input_price"])
                or amount(model["pricing"]["output"]) > amount(req["max_output_price"])):
            raise ModelRegistryError("ROUTING_REQUIREMENTS_UNMET")
        return model

    def _routing_data(self, ctx, host, data, now, *, new_activation=False):
        data = safe(data); fields(data, "id version routes"); integer(data["version"])
        routes = data["routes"]
        if type(routes) is not list or sorted(r.get("role", "") for r in routes) != self._policy["roles"]:
            raise ModelRegistryError("EXACT_ROLE_SET_REQUIRED")
        for route in routes:
            fields(route, "role prompt model benchmark requirements fallback")
            model = self._route_target(ctx, host, {k: route[k] for k in ("prompt", "model", "benchmark", "requirements")}, route["role"], now)
            fallback = route["fallback"]; fields(fallback, "on targets")
            if not set(words(fallback["on"])) <= {"RATE_LIMIT", "TIMEOUT", "TEMPORARY_5XX"} or type(fallback["targets"]) is not list:
                raise ModelRegistryError("FALLBACK_REAPPROVAL_REQUIRED")
            seen = {route["model"]["content_hash"]}
            for target in fallback["targets"]:
                replacement = self._route_target(ctx, host, target, route["role"], now)
                if (target["requirements"] != route["requirements"] or target["model"]["content_hash"] in seen
                        or replacement["privacy_class"] != model["privacy_class"] or replacement["training_use"] != model["training_use"]
                        or replacement["retention_days"] > model["retention_days"] or replacement["zdr"] != model["zdr"]
                        or replacement["context_tokens"] < model["context_tokens"] or replacement["tools"] != model["tools"]
                        or not set(model["capabilities"]) <= set(replacement["capabilities"])):
                    raise ModelRegistryError("FALLBACK_REAPPROVAL_REQUIRED")
                seen.add(target["model"]["content_hash"])
            if new_activation:
                for target in [route, *fallback["targets"]]:
                    self._benchmark_baseline(self._entry("benchmarks", target["benchmark"])["data"])
        data["routes"] = sorted(routes, key=lambda r: r["role"])
        return data

    @boundary
    def create_routing(self, ctx, data, *, now):
        with self._session(ctx, now) as host:
            data = self._routing_data(ctx, host, data, now, new_activation=True)
            candidate = hashed(dict(id=data["id"], version=data["version"], data=data, baseline_version=self._state["version"],
                                    scope=self._state["scope"], context_id=host[1], principal_id=host[2]))
            for old in self._state["routing_candidates"].values():
                if old["id"] == candidate["id"] and old["version"] == candidate["version"]:
                    if old != candidate: raise ModelRegistryError("IMMUTABLE_VERSION_CONFLICT")
                    return snapshot(old)
            self._state["routing_candidates"][candidate["content_hash"]] = candidate; self._changed(now)
            return snapshot(candidate)

    def _human_required(self, data):
        active = self._state["active"]
        if active is None: return True
        def semantic(routing):
            result = to_primitive(routing["routes"])
            for route in result:
                for target in [route, *route["fallback"]["targets"]]:
                    model = dict(self._entry("models", target["model"])["data"])
                    for name in ("id", "version", "probe", "benchmark_revision"): model.pop(name)
                    target["model"] = model; target.pop("benchmark")
            return result
        return semantic(active["routing"]) != semantic(data)

    @boundary
    def capture_activation(self, ctx, target, *, mode, evidence_ref, expected_version, now, expires_at):
        with self._session(ctx, now) as host:
            integer(expected_version, 0)
            if expected_version != self._state["version"]: raise ModelRegistryError("ROUTING_VERSION_CONFLICT")
            candidate = self._entry("routing_candidates", target)
            self._routing_data(ctx, host, candidate["data"], now, new_activation=True)
            if mode not in ("HUMAN", "MAIN_POLICY") or (mode != "HUMAN" and self._human_required(candidate["data"])):
                raise ModelRegistryError("HUMAN_APPROVAL_REQUIRED")
            _text(evidence_ref)
            return self._capture("activation", dict(target=to_primitive(target), expected_version=expected_version), now, expires_at,
                                 mode=mode, evidence_ref=evidence_ref)

    @boundary
    @atomic_publication
    def activate(self, ctx, target, capture_id, *, expected_version, now):
        with self._session(ctx, now) as host:
            integer(expected_version, 0)
            if expected_version != self._state["version"]: raise ModelRegistryError("ROUTING_VERSION_CONFLICT")
            candidate = self._entry("routing_candidates", target)
            if candidate["baseline_version"] != expected_version: raise ModelRegistryError("ROUTING_VERSION_CONFLICT")
            capture = self._state["captures"].get(capture_id)
            if not capture or capture["kind"] != "activation": raise ModelRegistryError("ACTIVATION_APPROVAL_REQUIRED")
            capture = self._capture_get("activation", capture_id, now)
            if capture["data"] != dict(target=to_primitive(target), expected_version=expected_version):
                raise ModelRegistryError("ACTIVATION_APPROVAL_REQUIRED")
            data = self._routing_data(ctx, host, candidate["data"], now, new_activation=True)
            if capture["proof"]["mode"] != "HUMAN" and self._human_required(data): raise ModelRegistryError("HUMAN_APPROVAL_REQUIRED")
            # 모든 role/approval/CAS 검증을 끝낸 뒤 한 번만 publish한다.
            active = hashed(dict(version=expected_version + 1, routing=data, candidate_ref=to_primitive(target),
                                 approval_hash=capture["content_hash"], approval_mode=capture["proof"]["mode"], created_at=_time(now),
                                 applies_from="NEXT_RUN_ONLY", previous_hash=self._state["active"]["content_hash"] if self._state["active"] else None))
            self._state.update(active=active, version=active["version"])
            self._state["activations"].append(active); self._changed(now)
            return snapshot(active)

    def _refresh(self, ctx, host, now):
        active = self._state["active"]
        if not active or any(q["activation_hash"] == active["content_hash"] for q in self._state["quarantine"]): return
        try:
            self._routing_data(ctx, host, active["routing"], now)
        except MemoryError as error:
            incident = hashed(dict(activation_hash=active["content_hash"], reason="BLOCKED_CAPABILITY_DRIFT", cause=error.reason,
                                   approval_required=True, reprobe_required=True, benchmark_required=True, created_at=_time(now),
                                   affected_runs=sorted(self._state["runs"]), running_action="KEEP_PIN_NO_SUBSTITUTION_REVALIDATION_REQUIRED"))
            self._state["quarantine"].append(incident); self._state["audit"].append(incident); self._changed(now)

    @boundary
    def run_guard(self, ctx, snapshot_ref, *, now):
        with self._session(ctx, now) as host:
            snapshot_ref = safe(snapshot_ref); fields(snapshot_ref, "session_id task_id run_id snapshot_id content_hash")
            actual = self._candidates._snapshots.get_task_run(snapshot_ref["session_id"], snapshot_ref["task_id"], snapshot_ref["run_id"], MemoryScope(*host[3]))
            actual_payload = to_primitive(actual)
            if (any(getattr(actual, name) != value for name, value in snapshot_ref.items())
                    or _hash({k: v for k, v in actual_payload.items() if k != "content_hash"}) != actual.content_hash):
                raise ModelRegistryError("RUN_SNAPSHOT_MISMATCH")
            self._refresh(ctx, host, now)
            old = self._state["runs"].get(snapshot_ref["run_id"])
            if old:
                if old["snapshot_ref"] != snapshot_ref: raise ModelRegistryError("RUN_SNAPSHOT_MISMATCH")
                return snapshot(old)
            active = self._state["active"]
            if active is None: raise ModelRegistryError("ROUTING_NOT_ACTIVE")
            if any(q["activation_hash"] == active["content_hash"] for q in self._state["quarantine"]):
                return snapshot(dict(status="BLOCKED_CAPABILITY_DRIFT", activation_hash=active["content_hash"], run_id=snapshot_ref["run_id"], io_count=0))
            host_now = _time(self._candidates._run_clock())
            if host_now != _time(now) or not actual.created_at <= host_now <= actual.created_at + timedelta(seconds=5):
                raise ModelRegistryError("RUN_START_BOUNDARY_REQUIRED")
            if actual.created_at <= stamp(active["created_at"]): raise ModelRegistryError("NEXT_RUN_ONLY")
            selection = hashed(dict(status="PINNED", snapshot_ref=snapshot_ref, activation_hash=active["content_hash"], routing=active["routing"],
                                    context_id=host[1], principal_id=host[2], scope=self._state["scope"], created_at=_time(now), io_count=0))
            self._state["runs"][snapshot_ref["run_id"]] = selection; self._changed(now)
            return snapshot(selection)

    @boundary
    def query(self, ctx, *, now):
        with self._session(ctx, now) as host:
            self._refresh(ctx, host, now)
            return snapshot({k: v for k, v in self._state.items() if k not in ("captures", "last_at")})

    @boundary
    def export_state(self, ctx, *, now):
        with self._session(ctx, now) as host:
            self._refresh(ctx, host, now)
            value = dict(state=to_primitive(self._state), epoch=self._authority.epochs[host[1]], context_id=host[1], principal_id=host[2],
                         content_hash=_hash(self._state))
            value["checkpoint_id"] = "registry-checkpoint-" + _hash(value)
            self._authority.checkpoints[value["checkpoint_id"]] = (ctx, _canonical(value))
            return snapshot(value)

    @boundary
    def import_state(self, ctx, envelope, *, now):
        with self._session(ctx, now, restore=True) as host:
            envelope = to_primitive(envelope); fields(envelope, "state epoch context_id principal_id content_hash checkpoint_id")
            item = self._authority.checkpoints.get(envelope["checkpoint_id"])
            if (not item or item[0] is not ctx or item[1] != _canonical(envelope) or envelope["context_id"] != host[1]
                    or envelope["principal_id"] != host[2] or envelope["epoch"] != self._authority.epochs.get(host[1])
                    or envelope["content_hash"] != _hash(envelope["state"]) or envelope["state"]["policy"] != self._policy
                    or (envelope["state"]["last_at"] and _time(now) < stamp(envelope["state"]["last_at"]))):
                raise ModelRegistryError("CHECKPOINT_INVALID")
            self._state, self._context = envelope["state"], ctx
            self._authority.owners[host[1]] = self; self._changed(now)
            self._refresh(ctx, host, now)
            return self.query(ctx, now=now)
