"""D-01 bounded curated memory, without disk, network, model or database IO.

Host boundary: add/version accept already curated material, not agent approval.
Candidate approval/activation belongs to D-06. propose never activates anything.
Instruction keys are host-normalized semantic subjects; this module compares exact
key/value bindings, not free-text meaning. An LLM cannot supply priority overrides.
"""
from collections.abc import Mapping
from dataclasses import dataclass, fields, is_dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
import re
from threading import RLock
from types import MappingProxyType


PRIORITIES = (
    "CURRENT_USER", "DESIGN_BASELINE", "WORK_PLAN", "WORK_INSTRUCTION",
    "PROJECT_POLICY", "AGENT_DEFINITION", "SKILL_HOOK_PROMPT", "MEMORY_CODE_EXAMPLE",
)
LIMITS = MappingProxyType({"USER": 500, "MEMORY": 800})
_CATEGORIES = ("environment", "preference", "convention", "lesson", "decision")
_CONFIDENCES = ("confirmed", "inferred", "unverified")
_STATUSES = ("ACTIVE", "PENDING", "INACTIVE", "QUARANTINED", "REVOKED")
_SOURCE_TYPES = ("user_confirmation", "verification", "run_result", "document", "model_summary")
_SOURCE_FIELDS = frozenset(("source_type", "source_project_id", "source_task_id", "source_run_id",
                            "source_event_id", "created_by", "retention_policy"))
_INPUT_FIELDS = frozenset(("entry_id", "kind", "scope", "user_id", "project_id", "category",
                          "instruction_key", "statement", "confidence", "status", "source", "evidence",
                          "created_at", "last_verified_at", "expires_at"))
_SECRET = re.compile(
    r"(?i)(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|secret)\s*[:=]\s*\S+"
    r"|\bbearer\s+\S+|\bsk-[a-zA-Z0-9_-]{12,}|\b(?:ghp|github_pat)_[a-zA-Z0-9_]+"
    r"|-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----|\bAKIA[A-Z0-9]{16}\b"
)
_URI_AUTHORITY = re.compile(r"(?i)(?:\b[a-z][a-z0-9+.-]*:)?//([^/?#\s<>\"']*)")
_SUBJECT_WORDS = frozenset(("previous", "prior", "earlier", "system", "higher", "developer"))
_OBJECT_WORDS = frozenset(("instruction", "directive", "rule", "prompt", "message"))
_OVERRIDE_WORDS = frozenset(("ignore", "disregard", "override"))
_NEGATION_WORDS = frozenset(("not", "never", "don't", "shouldn't", "mustn't", "cannot", "can't"))
_VERB_ADVERBS = frozenset(("ever", "really", "simply", "just", "intentionally", "deliberately"))
_DETERMINERS = frozenset(("all", "the", "any"))
_KOREAN_SUBJECTS = ("이전", "과거", "상위", "시스템", "개발자")
_KOREAN_OBJECTS = ("지시사항", "지시", "지침", "규칙", "프롬프트", "메시지")
_KOREAN_TARGET = re.compile(
    "(?P<subject>" + "|".join(_KOREAN_SUBJECTS) + r")\s*"
    "(?P<object>" + "|".join(_KOREAN_OBJECTS) + r")(?:를|을|는|은)?\s*무시"
)


def _instruction_tokens(statement):
    """Normalize a finite subject/object vocabulary; retain clause delimiters."""
    words = re.findall(r"[a-z]+(?:'[a-z]+)?|[^\w\s]|\n", statement.casefold().replace("’", "'"))
    result = []
    for word in words:
        if word in _SUBJECT_WORDS:
            token = "SUBJECT"
        elif word.removesuffix("s") in _OBJECT_WORDS:
            token = "OBJECT"
        elif word in _OVERRIDE_WORDS:
            token = "OVERRIDE"
        elif word in _NEGATION_WORDS:
            token = "NEGATION"
        elif word in _VERB_ADVERBS:
            token = "ADVERB"
        elif word in _DETERMINERS:
            token = "DETERMINER"
        else:
            token = word
        result.append(token)
    return result


def _instruction_override(statement):
    """Match OVERRIDE [determiner] SUBJECT [priority] OBJECT + local negation.

    A negator binds only across verb adverbs, not an intervening conjunction,
    punctuation or another verb. 'not only' is not negation of the override.
    Korean target clauses use the immediate -지 않/-지 말/-지 마 ending.
    Each verb/target is evaluated separately; no earlier negative clause masks
    a later imperative. This finite grammar is not general semantic analysis.
    """
    tokens = _instruction_tokens(statement)
    for index, token in enumerate(tokens):
        if token != "OVERRIDE":
            continue
        target = index + 1
        while target < len(tokens) and tokens[target] == "DETERMINER":
            target += 1
        if target >= len(tokens) or tokens[target] != "SUBJECT":
            continue
        target += 1
        if target < len(tokens) and tokens[target] == "priority":
            target += 1
        if target >= len(tokens) or tokens[target] != "OBJECT":
            continue
        prefix = index - 1
        while prefix >= 0 and tokens[prefix] == "ADVERB":
            prefix -= 1
        if prefix < 0 or tokens[prefix] != "NEGATION":
            return True
    for match in _KOREAN_TARGET.finditer(statement):
        ending = re.sub(r"\s+", "", statement[match.end():])
        if not re.match(r"하?지(?:않|말|마)", ending):
            return True
    return False


class MemoryError(ValueError):
    """Errors carry reason codes/counts only; never echo rejected material."""

    def __init__(self, reason, details=None):
        self.reason = reason
        self.details = MappingProxyType(dict(details or {}))
        super().__init__(reason)


def _text(value):
    if type(value) is not str or not value.strip():
        raise MemoryError("INVALID_MEMORY_INPUT")
    return value


def _scan(value):
    if isinstance(value, str):
        # Inspect only authority, not @ in a safe URL's path/query. Any userinfo
        # is credential-shaped, including encoded passwords and username-only
        # URIs. Never parse/connect to the target or echo its rejected value.
        if _SECRET.search(value) or any("@" in match[1] for match in _URI_AUTHORITY.finditer(value)):
            raise MemoryError("SECRET_LIKE_INPUT")
    elif isinstance(value, Mapping):
        for key, item in value.items():
            _scan(key)
            _scan(item)
    elif isinstance(value, (tuple, list)):
        for item in value:
            _scan(item)


def _time(value):
    if type(value) is not datetime or value.tzinfo is None or value.utcoffset() is None:
        raise MemoryError("INVALID_MEMORY_TIME")
    return value.astimezone(timezone.utc)


def to_primitive(value):
    """Detached JSON-shaped projection. No internal DTO is returned by reference."""
    if is_dataclass(value):
        return {f.name: to_primitive(getattr(value, f.name)) for f in fields(value)}
    if isinstance(value, Mapping):
        return {k: to_primitive(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [to_primitive(v) for v in value]
    if isinstance(value, datetime):
        return _time(value).isoformat()
    return value


def _canonical(value):
    return json.dumps(to_primitive(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _hash(value):
    return sha256(_canonical(value).encode("utf-8")).hexdigest()


def estimate_tokens(statement):
    """Deterministic token-equivalent = ceil(UTF-8 statement bytes / 4).

    Not a Provider tokenizer. Only statements are injected; provenance stays in
    the evidence projection. Each statement is rounded separately, then summed.
    """
    return (len(_text(statement).encode("utf-8")) + 3) // 4


@dataclass(frozen=True)
class MemoryScope:
    user_id: str
    scope: str
    project_id: str | None = None

    def __post_init__(self):
        _text(self.user_id)
        if self.scope not in ("user", "project"):
            raise MemoryError("INVALID_MEMORY_INPUT")
        if self.scope == "project":
            _text(self.project_id)
        elif self.project_id is not None:
            raise MemoryError("INVALID_MEMORY_INPUT")
        _scan((self.user_id, self.project_id))


def _scope_key(scope):
    if type(scope) is not MemoryScope:
        raise MemoryError("INVALID_MEMORY_INPUT")
    validated = MemoryScope(scope.user_id, scope.scope, scope.project_id)
    return (validated.user_id, validated.scope, validated.project_id)


@dataclass(frozen=True)
class MemoryEntry:
    entry_id: str
    kind: str
    scope: str
    user_id: str
    project_id: str | None
    category: str
    instruction_key: str
    statement: str
    confidence: str
    status: str
    source: Mapping
    evidence: tuple
    created_at: datetime
    last_verified_at: datetime
    expires_at: datetime | None
    version: int
    previous_hash: str | None
    content_hash: str


def _entry(raw):
    value = json.loads(raw)
    for key in ("created_at", "last_verified_at", "expires_at"):
        if value[key] is not None:
            value[key] = datetime.fromisoformat(value[key])
    value["source"] = MappingProxyType(value["source"])
    value["evidence"] = tuple(MappingProxyType(x) for x in value["evidence"])
    return MemoryEntry(**value)


@dataclass(frozen=True)
class Instruction:
    instruction_id: str
    priority: str
    instruction_key: str
    statement: str

    def __post_init__(self):
        for value in (self.instruction_id, self.instruction_key, self.statement):
            _text(value)
            _scan(value)
        if self.priority not in PRIORITIES:
            raise MemoryError("INVALID_INSTRUCTION_PRIORITY")


@dataclass(frozen=True)
class LearningConflict:
    conflict_id: str
    entry_id: str
    entry_hash: str
    instruction_key: str
    winner_id: str
    winner_priority: str
    reason: str
    observed_at: datetime


@dataclass(frozen=True)
class ContextResolution:
    entries: tuple
    values: Mapping
    conflicts: tuple
    content_hash: str


class MemoryRepository:
    """Single-host in-memory adapter; separate kind/scope stores, immutable journal.

    Canonical versions/conflicts are stored as immutable JSON strings, so even
    object.__setattr__ on a frozen response cannot corrupt the stored history.
    This is not a persistent transaction/authentication implementation.
    """

    def __init__(self):
        self._stores = {"USER": {}, "MEMORY": {}}
        self._conflicts = {}
        self._requests = set()
        self._lock = RLock()

    def _partition(self, kind, scope):
        if type(kind) is not str or kind not in LIMITS:
            raise MemoryError("INVALID_MEMORY_INPUT")
        return self._stores[kind].get(_scope_key(scope), {})

    def _validate(self, payload, now):
        now = _time(now)
        if type(payload) is not dict:
            raise MemoryError("INVALID_MEMORY_INPUT")
        _scan(payload)
        if set(payload) != _INPUT_FIELDS:
            raise MemoryError("INVALID_MEMORY_INPUT")
        value = dict(payload)
        for key in ("entry_id", "kind", "category", "instruction_key", "statement", "confidence", "status"):
            _text(value[key])
        if (value["kind"] not in LIMITS or value["category"] not in _CATEGORIES
                or value["confidence"] not in _CONFIDENCES or value["status"] not in _STATUSES):
            raise MemoryError("INVALID_MEMORY_INPUT")
        if _instruction_override(value["statement"]):
            raise MemoryError("MEMORY_INSTRUCTION_INJECTION")
        scope = MemoryScope(value["user_id"], value["scope"], value["project_id"])
        source = value["source"]
        if type(source) is not dict or set(source) != _SOURCE_FIELDS:
            raise MemoryError("MEMORY_SOURCE_REQUIRED")
        for key in _SOURCE_FIELDS - {"source_project_id"}:
            _text(source[key])
        if source["source_type"] not in _SOURCE_TYPES:
            raise MemoryError("MEMORY_SOURCE_REQUIRED")
        if source["source_type"] == "model_summary" and value["confidence"] != "unverified":
            raise MemoryError("MEMORY_UNVERIFIED_SOURCE")
        if source["source_project_id"] != scope.project_id:
            raise MemoryError("MEMORY_SOURCE_SCOPE_MISMATCH")
        evidence = value["evidence"]
        if type(evidence) not in (list, tuple) or not evidence:
            raise MemoryError("MEMORY_EVIDENCE_REQUIRED")
        for item in evidence:
            if type(item) is not dict or set(item) != {"type", "ref"}:
                raise MemoryError("MEMORY_EVIDENCE_REQUIRED")
            _text(item["type"])
            _text(item["ref"])
        value["source"] = dict(source)
        value["evidence"] = [dict(x) for x in evidence]
        created, verified = _time(value["created_at"]), _time(value["last_verified_at"])
        expiry = None if value["expires_at"] is None else _time(value["expires_at"])
        if not created <= verified <= now or (expiry is not None and (expiry <= created or verified >= expiry)):
            raise MemoryError("INVALID_MEMORY_TIME")
        value.update(created_at=created, last_verified_at=verified, expires_at=expiry)
        return value, scope

    def history(self, kind, scope, entry_id):
        _text(entry_id)
        return tuple(_entry(x) for x in self._partition(kind, scope).get(entry_id, ()))

    def list(self, kind, scope, *, now):
        now = _time(now)
        latest = (_entry(versions[-1]) for _, versions in sorted(self._partition(kind, scope).items()))
        return tuple(x for x in latest if x.status == "ACTIVE" and x.created_at <= now
                     and (x.expires_at is None or now < x.expires_at))

    def get(self, kind, scope, entry_id, *, now):
        _text(entry_id)
        for entry in self.list(kind, scope, now=now):
            if entry.entry_id == entry_id:
                return entry
        raise MemoryError("MEMORY_NOT_FOUND")

    def capacity(self, kind, scope, *, now):
        current = sum(estimate_tokens(x.statement) for x in self.list(kind, scope, now=now))
        return dict(current=current, added=0, limit=LIMITS[kind], total=current)

    def _prepare(self, payload, *, now, expected_hash=None, versioning=False):
        value, scope = self._validate(payload, now)
        history = self.history(value["kind"], scope, value["entry_id"])
        if versioning:
            if not history:
                raise MemoryError("MEMORY_NOT_FOUND")
            if expected_hash != history[-1].content_hash:
                raise MemoryError("MEMORY_VERSION_CONFLICT")
            if value["created_at"] < history[-1].created_at:
                raise MemoryError("INVALID_MEMORY_TIME")
            if value["instruction_key"] != history[-1].instruction_key:
                raise MemoryError("MEMORY_VERSION_CONFLICT")
        elif history:
            raise MemoryError("MEMORY_DUPLICATE")
        existing = self.list(value["kind"], scope, now=now)
        for other in existing:
            if other.entry_id != value["entry_id"] and (
                other.instruction_key == value["instruction_key"] and
                " ".join(other.statement.split()).casefold() == " ".join(value["statement"].split()).casefold()
            ):
                raise MemoryError("MEMORY_DUPLICATE")
        current = sum(estimate_tokens(x.statement) for x in existing if x.entry_id != value["entry_id"])
        eligible = value["status"] == "ACTIVE" and (value["expires_at"] is None or now < value["expires_at"])
        added = estimate_tokens(value["statement"]) if eligible else 0
        capacity = dict(current=current, added=added, limit=LIMITS[value["kind"]], total=current + added)
        if capacity["total"] > capacity["limit"]:
            raise MemoryError("MEMORY_CAPACITY_EXCEEDED", capacity)
        value.update(version=len(history) + 1, previous_hash=history[-1].content_hash if history else None)
        value["content_hash"] = _hash(value)
        return value, scope, capacity

    def propose(self, payload, *, now):
        value, _, capacity = self._prepare(payload, now=now)
        return dict(status="PENDING_REVIEW", entry=to_primitive(value), capacity=capacity)

    def _commit(self, value, scope):
        bucket = self._stores[value["kind"]].setdefault(_scope_key(scope), {})
        entry_id = value["entry_id"]
        raw = _canonical(value)
        bucket[entry_id] = bucket.get(entry_id, ()) + (raw,)
        return _entry(raw)

    def _write(self, payload, *, now, request_id, expected_hash=None, versioning=False):
        # Replay identity belongs to this repository+scope, not a transient API
        # instance; append and receipt reservation share the same host lock.
        with self._lock:
            _, scope = self._validate(payload, now)
            request_key = None
            if request_id is not None:
                _text(request_id)
                _scan(request_id)
                request_key = (_scope_key(scope), request_id)
                if request_key in self._requests:
                    raise MemoryError("REQUEST_REPLAY")
            value, scope, _ = self._prepare(payload, now=now, expected_hash=expected_hash, versioning=versioning)
            result = self._commit(value, scope)
            if request_key is not None:
                self._requests.add(request_key)
            return result

    def add(self, payload, *, now, request_id=None):
        return self._write(payload, now=now, request_id=request_id)

    def version(self, payload, *, expected_hash, now, request_id=None):
        return self._write(payload, now=now, request_id=request_id, expected_hash=expected_hash, versioning=True)

    def conflicts(self, scope):
        result = []
        for _, raw in sorted(self._conflicts.get(_scope_key(scope), {}).items()):
            value = json.loads(raw)
            value["observed_at"] = datetime.fromisoformat(value["observed_at"])
            result.append(LearningConflict(**value))
        return tuple(result)

    def resolve_context(self, kind, scope, *, instructions, now):
        now = _time(now)
        if type(instructions) not in (tuple, list):
            raise MemoryError("INVALID_MEMORY_INPUT")
        groups = {}
        for item in instructions:
            if type(item) is not Instruction:
                raise MemoryError("INVALID_MEMORY_INPUT")
            checked = Instruction(item.instruction_id, item.priority, item.instruction_key, item.statement)
            groups.setdefault(checked.instruction_key, []).append(checked)
        entries = tuple(x for x in self.list(kind, scope, now=now) if x.confidence == "confirmed")
        for item in entries:
            groups.setdefault(item.instruction_key, []).append(
                Instruction(item.entry_id, "MEMORY_CODE_EXAMPLE", item.instruction_key, item.statement))
        values, winners, ambiguous = {}, {}, set()
        for key, candidates in sorted(groups.items()):
            ordered = sorted(candidates, key=lambda x: (PRIORITIES.index(x.priority), x.instruction_id, x.statement))
            best = ordered[0]
            winners[key] = best
            top = [x for x in ordered if x.priority == best.priority]
            if len({x.statement for x in top}) != 1:
                ambiguous.add(key)
            else:
                values[key] = best.statement
        applied, conflicts = [], []
        for item in entries:
            best = winners[item.instruction_key]
            if item.instruction_key not in ambiguous and item.statement == best.statement:
                applied.append(item)
                continue
            reason = "INSTRUCTION_AMBIGUITY" if item.instruction_key in ambiguous else "LEARNING_CONFLICT"
            detail = dict(entry_id=item.entry_id, entry_hash=item.content_hash, instruction_key=item.instruction_key,
                          winner_id=best.instruction_id, winner_priority=best.priority, reason=reason, observed_at=now)
            identity = _hash(dict(detail, scope=to_primitive(scope)))
            conflict = LearningConflict(identity, **detail)
            conflicts.append(conflict)
        conflicts.sort(key=lambda x: x.conflict_id)
        body = dict(entries=tuple(applied), values=values, conflicts=tuple(conflicts))
        digest = _hash(dict(body, scope=to_primitive(scope), kind=kind, resolved_at=now,
                            instructions=sorted((to_primitive(x) for x in instructions), key=_canonical)))
        # Only after complete validation; failed requests never append partial conflicts.
        journal = self._conflicts.setdefault(_scope_key(scope), {})
        for conflict in conflicts:
            journal.setdefault(conflict.conflict_id, _canonical(conflict))
        return ContextResolution(tuple(applied), MappingProxyType(values), tuple(conflicts), digest)
