"""Deterministic G0-G3 verification and release/apply approval contracts.

The module is deliberately in-memory and side-effect free.  It is the
boundary between technical evidence and a human release decision; no result
is promoted from fixture/static evidence to an operational claim here.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timezone, timedelta
from enum import StrEnum
from functools import wraps
import posixpath
import ast
import re
from types import MappingProxyType
from typing import Any, Mapping, Sequence

from packages.orchestration.result_envelope import canonical_hash, canonical_json


class GateStatus(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIPPED = "SKIPPED"
    BLOCKED = "BLOCKED"
    ERROR = "ERROR"


class GateReasonCode(StrEnum):
    INVALID_GATE = "INVALID_GATE"
    PASS_REQUIRED = "PASS_REQUIRED"
    TARGET_HASH_MISMATCH = "TARGET_HASH_MISMATCH"
    MANIFEST_HASH_MISMATCH = "MANIFEST_HASH_MISMATCH"
    DELIVERED_HASH_MISMATCH = "DELIVERED_HASH_MISMATCH"
    VERIFIED_HASH_MISMATCH = "VERIFIED_HASH_MISMATCH"
    BLOCKING_DEFECT = "BLOCKING_DEFECT"
    PRODUCT_VALIDATION_INCOMPLETE = "PRODUCT_VALIDATION_INCOMPLETE"
    PRODUCT_VALIDATION_FAILED = "PRODUCT_VALIDATION_FAILED"
    UNAUTHENTICATED_ACTOR = "UNAUTHENTICATED_ACTOR"
    INVALID_DECISION = "INVALID_DECISION"
    DECISION_NOT_RELEASE = "DECISION_NOT_RELEASE"
    STALE_APPROVAL = "STALE_APPROVAL"
    DUPLICATE_APPROVAL = "DUPLICATE_APPROVAL"
    REPLAY_CONFLICT = "REPLAY_CONFLICT"
    DIFF_OUT_OF_SCOPE = "DIFF_OUT_OF_SCOPE"
    DELETED_FILE = "DELETED_FILE"
    SECRET_PATTERN = "SECRET_PATTERN"
    TEST_MODIFIED = "TEST_MODIFIED"


_GATES = ("G0", "G1", "G2", "G3")


def _text(value: Any, field: str) -> None:
    if type(value) is not str or not value.strip() or value != value.strip():
        raise ValueError(f"{field} must be a canonical non-empty string")


def _hash(value: Any, field: str) -> None:
    if type(value) is not str or re.fullmatch(r"sha256:[0-9a-f]{64}", value) is None:
        raise ValueError(f"{field} must be a sha256 hash")
    try:
        int(value[7:], 16)
    except ValueError as exc:
        raise ValueError(f"{field} must be a sha256 hash") from exc


def _freeze(value):
    if isinstance(value, Mapping):
        if any(type(key) is not str for key in value): raise ValueError("non-string evidence key")
        return MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if type(value) in (list, tuple): return tuple(_freeze(item) for item in value)
    if value is None or type(value) in (str, bool, int): return value
    raise ValueError("evidence must contain immutable JSON data")


def _thaw(value):
    if isinstance(value, Mapping): return {key: _thaw(item) for key, item in value.items()}
    if type(value) is tuple: return [_thaw(item) for item in value]
    return value


def _strings(values):
    if type(values) not in (list, tuple): raise ValueError("string sequence required")
    result = tuple(values)
    for item in result: _text(item, "item")
    if len(set(result)) != len(result): raise ValueError("duplicate item")
    return result


def _utc(value):
    if type(value) is not datetime or value.tzinfo is None or value.utcoffset() != timezone.utc.utcoffset(value):
        raise ValueError("UTC datetime required")


@dataclass(frozen=True, slots=True)
class GateResult:
    gate_code: str
    status: GateStatus
    target_hash: str
    evidence_refs: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = ()
    details: Mapping[str, Any] = None  # type: ignore[assignment]
    evidence_id: str | None = None

    def __post_init__(self) -> None:
        if self.gate_code not in _GATES:
            raise ValueError("gate_code must be G0, G1, G2 or G3")
        if not isinstance(self.status, GateStatus):
            object.__setattr__(self, "status", GateStatus(self.status))
        _hash(self.target_hash, "target_hash")
        refs = tuple(self.evidence_refs)
        if any(not isinstance(item, str) or not item.strip() for item in refs):
            raise ValueError("evidence_refs must contain non-empty strings")
        if len(refs) != len(set(refs)):
            raise ValueError("evidence_refs must not contain duplicates")
        object.__setattr__(self, "evidence_refs", refs)
        object.__setattr__(self, "reason_codes", tuple(self.reason_codes))
        object.__setattr__(self, "details", _freeze(self.details if self.details is not None else {}))

    @property
    def passed(self) -> bool:
        return self.status is GateStatus.PASS

    def to_dict(self) -> dict[str, Any]:
        return {"gate_code": self.gate_code, "status": self.status.value,
                "target_hash": self.target_hash, "evidence_refs": list(self.evidence_refs),
                "reason_codes": list(self.reason_codes), "details": _thaw(self.details), "evidence_id": self.evidence_id}


@dataclass(frozen=True, slots=True)
class EvidenceManifest:
    target_hash: str
    delivered_artifact_hash: str
    verified_artifact_hash: str
    environment_id: str
    evidence_refs: tuple[str, ...] = ()
    gate_results: tuple[GateResult, ...] = ()
    design_baseline_hash: str | None = None
    work_plan_hash: str | None = None
    work_instruction_hash: str | None = None
    git_head: str | None = None
    acquisition_mode: str = "fixture"
    skipped_or_blocked: tuple[str, ...] = ()
    unverified_scope: tuple[str, ...] = ()
    seal_id: str | None = None

    def __post_init__(self) -> None:
        for value, field in ((self.target_hash, "target_hash"),
                             (self.delivered_artifact_hash, "delivered_artifact_hash"),
                             (self.verified_artifact_hash, "verified_artifact_hash")):
            _hash(value, field)
        _text(self.environment_id, "environment_id")
        if self.acquisition_mode not in {"real", "fixture", "mock", "static"}: raise ValueError("invalid acquisition_mode")
        if self.delivered_artifact_hash != self.target_hash or self.verified_artifact_hash != self.target_hash:
            raise ValueError("delivered and verified hashes must equal target_hash")
        for field in ("design_baseline_hash", "work_plan_hash", "work_instruction_hash"):
            value = getattr(self, field)
            if value is not None:
                _hash(value, field)
        gates = tuple(self.gate_results)
        if any(not isinstance(item, GateResult) for item in gates):
            raise TypeError("gate_results must contain GateResult values")
        if len({item.gate_code for item in gates}) != len(gates):
            raise ValueError("gate_results must not contain duplicate gate codes")
        if any(item.target_hash != self.target_hash for item in gates):
            raise ValueError("every gate target_hash must equal manifest target_hash")
        object.__setattr__(self, "gate_results", tuple(replace(item) for item in gates))
        for field in ("evidence_refs", "skipped_or_blocked", "unverified_scope"):
            object.__setattr__(self, field, _strings(getattr(self, field)))

    @property
    def manifest_hash(self) -> str:
        return canonical_hash(self.to_dict(include_hash=False))

    def to_dict(self, *, include_hash: bool = True) -> dict[str, Any]:
        data = {"target_hash": self.target_hash,
                "delivered_artifact_hash": self.delivered_artifact_hash,
                "verified_artifact_hash": self.verified_artifact_hash,
                "environment_id": self.environment_id,
                "evidence_refs": list(self.evidence_refs),
                "gate_results": [item.to_dict() for item in self.gate_results],
                "design_baseline_hash": self.design_baseline_hash,
                "work_plan_hash": self.work_plan_hash,
                "work_instruction_hash": self.work_instruction_hash,
                "git_head": self.git_head, "acquisition_mode": self.acquisition_mode,
                "skipped_or_blocked": list(self.skipped_or_blocked),
                "unverified_scope": list(self.unverified_scope)}
        if include_hash:
            data["manifest_hash"] = self.manifest_hash
        return data


class GateEvidenceAuthority:
    """Host-only capture registry; possession of this instance is a capability.

    The host configures the same exact instance in capture, validation and release
    services. Agent DTOs never register evidence. Seals are deterministic registry
    identities, not signatures or proof of external IO. A new caller-created
    authority cannot attest evidence to an existing host's release service.
    """

    def __init__(self):
        self._gates: dict[str, str] = {}
        self._manifests: set[str] = set()
        self._sequence = 0
        self._gate_sequence: dict[str, int] = {}

    def _issue_gate(self, result):
        payload = replace(result, evidence_id=None).to_dict()
        identity = canonical_hash(payload)
        if identity not in self._gates:
            self._sequence += 1
            self._gate_sequence[identity] = self._sequence
        self._gates[identity] = canonical_json(payload)
        return replace(result, evidence_id=identity)

    def verify_gate(self, result):
        if type(result) is not GateResult or type(result.evidence_id) is not str: return False
        try:
            payload = replace(result, evidence_id=None).to_dict()
            return self._gates.get(result.evidence_id) == canonical_json(payload)
        except (ValueError, TypeError, AttributeError): return False

    def _issue_manifest(self, manifest):
        self._manifests.add(manifest.manifest_hash)
        return replace(manifest, seal_id=manifest.manifest_hash)

    def verify_manifest(self, manifest):
        return (type(manifest) is EvidenceManifest and manifest.seal_id == manifest.manifest_hash
            and manifest.seal_id in self._manifests)


def _host_capture(method):
    @wraps(method)
    def capture(self, *args, **kwargs):
        result = method(self, *args, **kwargs)
        return self._authority._issue_gate(result) if self._authority is not None else result
    return capture


@dataclass(frozen=True, slots=True)
class DiffReview:
    passed: bool
    changed_paths: tuple[str, ...] = ()
    findings: tuple[str, ...] = ()
    reason_codes: tuple[str, ...] = ()
    deterministic_findings: tuple[ReviewFinding, ...] = ()
    llm_findings: tuple[ReviewFinding, ...] = ()
    complete: bool = False


LLM_CHECKS = ("COMPLETION_CONDITIONS", "UNNECESSARY_REFACTOR", "IMPLICIT_BEHAVIOR_CHANGE",
              "ERROR_HANDLING", "MAINTAINABILITY")


@dataclass(frozen=True, slots=True)
class ReviewFinding:
    category: str
    status: GateStatus
    evidence_ref: str

    def __post_init__(self):
        _text(self.category, "category"); _text(self.evidence_ref, "evidence_ref")
        if type(self.status) is not GateStatus: raise ValueError("finding status required")


@dataclass(frozen=True, slots=True)
class DiffFile:
    path: str
    before: str | None
    after: str | None

    def __post_init__(self):
        _text(self.path, "path")
        if any(value is not None and type(value) is not str for value in (self.before, self.after)):
            raise ValueError("diff text required")
        if self.before is None and self.after is None: raise ValueError("empty diff")


def _scope_path(value):
    if type(value) is not str or not value or value != value.strip(): return None
    root = value.removesuffix("/**")
    if any(c in root for c in ("\\", ":", "%", "*")) or root.startswith("/"): return None
    parts = root.split("/")
    if any(p in {"", ".", ".."} or p.endswith((".", " ")) or
           re.fullmatch(r"(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", p) for p in parts): return None
    return root.casefold()


def _public_surface(path, content):
    if path.endswith(".py"):
        try:
            tree = ast.parse(content)
            def surface(nodes):
                values = []
                for node in nodes:
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and not node.name.startswith("_"):
                        values.append((node.name, ast.dump(node.args), ast.dump(node.returns) if node.returns else None))
                    elif isinstance(node, ast.ClassDef) and not node.name.startswith("_"):
                        values.append((node.name, tuple(ast.dump(base) for base in node.bases), surface(node.body)))
                    elif isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == "__all__" for target in node.targets):
                        values.append(("__all__", ast.dump(node.value)))
                return tuple(values)
            return surface(tree.body)
        except SyntaxError: return ("INVALID_SYNTAX",)
    return tuple(line.strip() for line in content.splitlines() if re.match(r"\s*(export\b|__all__\s*=)", line))


class DiffReviewService:
    """Perform deterministic change review checks before human review."""

    def review(self, *, changed_paths: Sequence[str], allowed_paths: Sequence[str],
               deleted_paths: Sequence[str] = (), modified_tests: bool = False,
               secret_patterns: Sequence[str] = (), dependency_changed: bool = False,
               changes: Sequence[DiffFile] = (), llm_findings: Sequence[ReviewFinding] = ()) -> DiffReview:
        paths, allowed_raw = _strings(changed_paths), _strings(allowed_paths)
        allowed = tuple(_scope_path(item) for item in allowed_raw)
        deterministic = []
        def finding(code, ref): deterministic.append(ReviewFinding(code, GateStatus.FAIL, ref))
        for path in paths:
            normalized = _scope_path(path)
            if not normalized or not allowed or None in allowed or not any(normalized == root or normalized.startswith(root + "/") for root in allowed):
                finding("DIFF_OUT_OF_SCOPE", canonical_hash({"path": path}))
        for path in deleted_paths: finding("DELETED_FILE", canonical_hash({"path": path}))
        if modified_tests: finding("TEST_MODIFIED", "declared-test-change")
        if secret_patterns: finding("SECRET_PATTERN", "redacted-secret-finding")
        if dependency_changed: finding("DEPENDENCY_CHANGED", "declared-dependency-change")
        if any(type(item) is not DiffFile for item in changes): raise ValueError("DiffFile required")
        complete = len(changes) == len(paths) and {item.path for item in changes} == set(paths)
        if changes and not complete: finding("DIFF_INVENTORY_MISMATCH", "diff-inventory")
        for item in changes:
            before, after = item.before or "", item.after or ""
            ref = canonical_hash({"path": item.path, "before": item.before, "after": item.after})
            if item.after is None: finding("DELETED_FILE", ref)
            is_test = bool(re.search(r"(^|/)(tests?/|test_|.*[._](test|spec)\.)", item.path))
            removed = set(before.splitlines()) - set(after.splitlines())
            added = set(after.splitlines()) - set(before.splitlines())
            if is_test and (item.after is None or any(re.search(r"\b(assert|expect|def test_|test\(|it\()", line) for line in removed)
                or any(re.search(r"(?i)(skip|xfail|xit\(|xtest\(|\.todo\()", line) for line in added)):
                finding("TEST_MODIFIED", ref)
            name = posixpath.basename(item.path).casefold()
            if before != after and (name in {"package.json", "pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "go.mod", "go.sum", "cargo.toml", "pnpm-lock.yaml", "npm-shrinkwrap.json"}
                or re.fullmatch(r"requirements[-_.].*\.(txt|in)", name)
                or name.endswith((".lock", "lock.json"))): finding("DEPENDENCY_CHANGED", ref)
            if _public_surface(item.path, before) != _public_surface(item.path, after): finding("PUBLIC_SURFACE_CHANGED", ref)
            if any(re.search(r"(?i)(?:api[_-]?key|secret|token|password)\s*[:=]\s*['\"]?[^'\"\s]{8,}|-----BEGIN .*PRIVATE KEY-----", line) for line in added):
                finding("SECRET_PATTERN", ref)
            if before != after and max(len(before.splitlines()), len(after.splitlines())) >= 20 and re.sub(r"\s", "", before) == re.sub(r"\s", "", after):
                finding("FORMATTER_DRIFT", ref)
        llm = tuple(llm_findings)
        if any(type(item) is not ReviewFinding or item.category not in LLM_CHECKS for item in llm): raise ValueError("invalid LLM finding")
        if len({item.category for item in llm}) != len(llm): raise ValueError("duplicate LLM finding")
        reasons = tuple(dict.fromkeys(item.category for item in deterministic))
        return DiffReview(complete and not reasons and len(llm) == len(LLM_CHECKS) and all(item.status is GateStatus.PASS for item in llm), paths,
            tuple(item.evidence_ref for item in deterministic), reasons, tuple(deterministic), llm, complete)


@dataclass(frozen=True, slots=True)
class ProductValidation:
    criterion_id: str
    target_hash: str
    verdict: str
    validated_by: str
    environment_id: str
    evidence_refs: tuple[str, ...] = ()
    acquisition_mode: str = "fixture"
    delivered_hash: str | None = None
    procedure: str = ""
    expected: str = ""
    observed: str = ""
    validated_at: datetime | None = None

    def __post_init__(self) -> None:
        _text(self.criterion_id, "criterion_id"); _hash(self.target_hash, "target_hash")
        _text(self.validated_by, "validated_by"); _text(self.environment_id, "environment_id")
        if self.verdict not in {"SUITABLE", "NEEDS_IMPROVEMENT", "UNSUITABLE", "BLOCKED"}:
            raise ValueError("invalid product validation verdict")
        object.__setattr__(self, "evidence_refs", _strings(self.evidence_refs))
        if self.delivered_hash is not None: _hash(self.delivered_hash, "delivered_hash")


@dataclass(frozen=True, slots=True)
class DefectAssessment:
    defect_id: str
    target_hash: str
    blocking: bool
    lifecycle: str = "OPEN"
    reported_by: str = "developer"

    def __post_init__(self) -> None:
        _text(self.defect_id, "defect_id"); _hash(self.target_hash, "target_hash")
        _text(self.reported_by, "reported_by")
        if type(self.blocking) is not bool or self.lifecycle not in {"OPEN", "ACCEPTED", "FIXING", "READY_FOR_RETEST", "CLOSED", "DEFERRED", "REJECTED"}:
            raise ValueError("invalid defect assessment")

    @property
    def is_open_blocking(self) -> bool:
        return self.blocking and self.lifecycle != "CLOSED"


class ReleaseDecision(StrEnum):
    RELEASE = "RELEASE"
    REWORK = "REWORK"
    DEFER = "DEFER"
    REJECT = "REJECT"


@dataclass(frozen=True, slots=True)
class ReleaseDecisionRecord:
    decision_id: str
    target_hash: str
    decision: ReleaseDecision
    actor_id: str
    authenticated: bool
    manifest_hash: str
    decided_at: datetime | None = None
    expires_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class ApplyApprovalRecord:
    approval_id: str
    decision_id: str
    target_hash: str
    manifest_hash: str
    actor_id: str
    authenticated: bool
    approved_at: datetime
    expires_at: datetime
    status: str = "ACTIVE"
    actor_role: str = "HUMAN"

    def __post_init__(self):
        for value in (self.approval_id, self.decision_id, self.actor_id): _text(value, "approval identity")
        _hash(self.target_hash, "target_hash"); _hash(self.manifest_hash, "manifest_hash")
        _utc(self.approved_at); _utc(self.expires_at)
        if self.expires_at <= self.approved_at: raise ValueError("invalid approval interval")
        if self.authenticated is not True or self.actor_role != "HUMAN": raise ValueError("UNAUTHENTICATED_ACTOR")
        if self.status not in {"ACTIVE", "REVOKED"}: raise ValueError("invalid approval status")


@dataclass(frozen=True, slots=True)
class ApprovalReceipt:
    accepted: bool
    duplicate: bool = False
    reason_codes: tuple[str, ...] = ()
    approval_id: str | None = None
    target_hash: str | None = None
    manifest_hash: str | None = None


class ReleaseApprovalService:
    """Trusted host admission boundary, analogous to the B-04 approval adapter.

    Only the authenticated host may register decisions, current product state
    and human Apply Approvals. This service issues receipts, never applies files.
    Authentication/persistence and actual dispatch remain outside this module.
    """

    def __init__(self, *, evidence_authority: GateEvidenceAuthority | None = None) -> None:
        if evidence_authority is not None and type(evidence_authority) is not GateEvidenceAuthority:
            raise ValueError("EVIDENCE_AUTHORITY_REQUIRED")
        self._authority = evidence_authority
        self._decisions: dict[str, ReleaseDecisionRecord] = {}
        self._decision_handles: dict[str, ReleaseDecisionRecord] = {}
        self._approvals: dict[str, ApprovalReceipt] = {}
        self._apply_records: dict[str, ApplyApprovalRecord] = {}
        self._states: dict[str, tuple] = {}
        self._consumed: dict[tuple[str, str], str] = {}
        self._defect_history: dict[tuple[str, str], tuple[DefectAssessment, ...]] = {}
        self._retest_after: dict[tuple[str, str], int] = {}
        self._retests: dict[tuple[str, str, int], tuple[str, str]] = {}

    def defect_history(self, *, target_hash, defect_id):
        return tuple(replace(item) for item in self._defect_history.get((target_hash, defect_id), ()))

    def record_defect_retest(self, *, target_hash, defect_id, gate_result, tester_id, independent):
        """Host-only independent retest admission; no external tests are run here."""
        _text(tester_id, "tester_id")
        key = (target_hash, defect_id)
        history = self._defect_history.get(key, ())
        if not history or history[-1].lifecycle != "READY_FOR_RETEST": raise ValueError("RETEST_NOT_READY")
        if independent is not True or tester_id == history[-1].reported_by: raise ValueError("INDEPENDENT_RETEST_REQUIRED")
        if (self._authority is None or not self._authority.verify_gate(gate_result)
            or gate_result.target_hash != target_hash or gate_result.gate_code != "G3" or gate_result.status is not GateStatus.PASS
            or tuple(gate_result.details.get("acquisition_modes", ())) != ("real",)
            or not any(row.get("requirement_id") == defect_id for row in gate_result.details.get("tests", ()))
            or self._authority._gate_sequence[gate_result.evidence_id] <= self._retest_after[key]):
            raise ValueError("RETEST_EVIDENCE_INVALID")
        self._retests[(target_hash, defect_id, len(history))] = (gate_result.evidence_id, tester_id)

    def record_validation_state(self, *, target_hash, product_validations, required_criteria, defects=()):
        _hash(target_hash, "target_hash")
        required = _strings(required_criteria)
        if not required: raise ValueError("PRODUCT_VALIDATION_INCOMPLETE")
        if any(type(item) is not ProductValidation for item in product_validations) or any(type(item) is not DefectAssessment for item in defects):
            raise ValueError("VALIDATION_STATE_INVALID")
        validations, issues = tuple(replace(item) for item in product_validations), tuple(replace(item) for item in defects)
        if len({item.criterion_id for item in validations}) != len(validations) or len({item.defect_id for item in issues}) != len(issues):
            raise ValueError("VALIDATION_STATE_INVALID")
        if any(item.target_hash != target_hash for item in (*validations, *issues)):
            raise ValueError("TARGET_HASH_MISMATCH")
        previous = self._states.get(target_hash)
        if previous and set(previous[1]) != set(required):
            raise ValueError("REQUIRED_CRITERIA_CHANGED")
        transitions = {"OPEN": {"ACCEPTED", "DEFERRED", "REJECTED"}, "ACCEPTED": {"FIXING"},
            "FIXING": {"READY_FOR_RETEST"}, "READY_FOR_RETEST": {"FIXING", "CLOSED"},
            "CLOSED": {"OPEN"}, "DEFERRED": {"ACCEPTED"}, "REJECTED": {"OPEN"}}
        updates = {}
        for issue in issues:
            key = (target_hash, issue.defect_id)
            history = self._defect_history.get(key, ())
            if not history:
                if issue.lifecycle != "OPEN": raise ValueError("DEFECT_TRANSITION_INVALID")
            else:
                old = history[-1]
                if issue == old: continue
                if issue.reported_by != old.reported_by or (old.blocking and not issue.blocking):
                    raise ValueError("DEFECT_IDENTITY_CHANGED")
                if issue.lifecycle not in transitions[old.lifecycle]: raise ValueError("DEFECT_TRANSITION_INVALID")
                if issue.lifecycle == "CLOSED" and (target_hash, issue.defect_id, len(history)) not in self._retests:
                    raise ValueError("INDEPENDENT_RETEST_REQUIRED")
            updates[key] = (*history, issue)
        # Commit only after all transitions validate. Omission never erases history.
        for key, history in updates.items():
            self._defect_history[key] = history
            if history[-1].lifecycle == "READY_FOR_RETEST":
                self._retest_after[key] = self._authority._sequence if self._authority is not None else 0
        merged = tuple(history[-1] for key, history in sorted(self._defect_history.items()) if key[0] == target_hash)
        self._states[target_hash] = (validations, required, merged)

    def decide(self, *, decision_id: str, target_hash: str, decision: ReleaseDecision | str,
               actor_id: str, authenticated: bool, manifest: EvidenceManifest,
               product_validations: Sequence[ProductValidation] = (), required_criteria: Sequence[str] = (),
               defects: Sequence[DefectAssessment] = (), decided_at=None, expires_at=None,
               actor_role="HUMAN") -> ReleaseDecisionRecord:
        _text(decision_id, "decision_id"); _hash(target_hash, "target_hash"); _text(actor_id, "actor_id")
        if authenticated is not True or actor_role != "HUMAN": raise ValueError("UNAUTHENTICATED_ACTOR")
        if type(manifest) is not EvidenceManifest or target_hash != manifest.target_hash: raise ValueError("TARGET_HASH_MISMATCH")
        now = decided_at if decided_at is not None else datetime.now(timezone.utc)
        expiry = expires_at if expires_at is not None else now + timedelta(hours=1)
        _utc(now); _utc(expiry)
        if expiry <= now: raise ValueError("invalid decision interval")
        decision = ReleaseDecision(decision)
        if decision is ReleaseDecision.RELEASE:
            known = self._states.get(target_hash, ((), (), ()))[2]
            current_defects = {item.defect_id: item for item in (*known, *defects)}
            self._assert_release_eligible(target_hash, manifest, product_validations, required_criteria, tuple(current_defects.values()), now)
        record = ReleaseDecisionRecord(decision_id, target_hash, decision, actor_id, True, manifest.manifest_hash, now, expiry)
        prior = self._decisions.get(decision_id)
        if prior is not None:
            if prior != record: raise ValueError("REPLAY_CONFLICT")
            return self._decision_handles[decision_id]
        if decision is ReleaseDecision.RELEASE:
            self.record_validation_state(target_hash=target_hash, product_validations=product_validations,
                required_criteria=required_criteria, defects=defects)
        self._decisions[decision_id] = replace(record)
        self._decision_handles[decision_id] = record
        return record

    def record_apply_approval(self, record: ApplyApprovalRecord) -> None:
        if type(record) is not ApplyApprovalRecord: raise ValueError("APPLY_APPROVAL_REQUIRED")
        record = replace(record)
        prior = self._apply_records.get(record.approval_id)
        if prior is not None and prior != record: raise ValueError("REPLAY_CONFLICT")
        self._apply_records[record.approval_id] = record

    def revoke_apply_approval(self, approval_id: str) -> None:
        record = self._apply_records[approval_id]
        self._apply_records[approval_id] = replace(record, status="REVOKED")

    def apply(self, *, approval_id: str, target_hash: str, manifest: EvidenceManifest,
              decision: ReleaseDecisionRecord, at=None) -> ApprovalReceipt:
        def deny(code): return ApprovalReceipt(False, reason_codes=(code,), approval_id=approval_id)
        _text(approval_id, "approval_id"); _hash(target_hash, "target_hash")
        now = at if at is not None else datetime.now(timezone.utc)
        try: _utc(now)
        except ValueError: return deny("TIME_INVALID")
        if (type(decision) is not ReleaseDecisionRecord or self._decision_handles.get(decision.decision_id) is not decision
            or self._decisions.get(decision.decision_id) != decision):
            return deny("STALE_APPROVAL")
        current = tuple(item for item in self._decisions.values() if item.target_hash == target_hash)
        latest = max((item.decided_at for item in current), default=None)
        if latest != decision.decided_at or sum(item.decided_at == latest for item in current) != 1:
            return deny("STALE_APPROVAL")
        if not decision.decided_at <= now < decision.expires_at: return deny("STALE_APPROVAL")
        if decision.decision is not ReleaseDecision.RELEASE: return deny("DECISION_NOT_RELEASE")
        if type(manifest) is not EvidenceManifest or decision.target_hash != target_hash or manifest.target_hash != target_hash or decision.manifest_hash != manifest.manifest_hash:
            return deny("STALE_APPROVAL")
        record = self._apply_records.get(approval_id)
        if record is None: return deny("APPLY_APPROVAL_REQUIRED")
        if (record.status != "ACTIVE" or record.decision_id != decision.decision_id or record.target_hash != target_hash
            or record.manifest_hash != manifest.manifest_hash or not decision.decided_at <= record.approved_at <= now < record.expires_at):
            return deny("STALE_APPROVAL")
        state = self._states.get(target_hash)
        if state is None: return deny("PRODUCT_VALIDATION_INCOMPLETE")
        try: self._assert_release_eligible(target_hash, manifest, *state, now)
        except (ValueError, TypeError, AttributeError) as error: return deny(str(error))
        key = (decision.decision_id, manifest.manifest_hash)
        if key in self._consumed and self._consumed[key] != approval_id: return deny("REPLAY_CONFLICT")
        prior = self._approvals.get(approval_id)
        if prior is not None:
            return ApprovalReceipt(True, True, ("DUPLICATE_APPROVAL",), approval_id, target_hash, manifest.manifest_hash)
        receipt = ApprovalReceipt(True, approval_id=approval_id, target_hash=target_hash, manifest_hash=manifest.manifest_hash)
        self._approvals[approval_id] = receipt
        self._consumed[key] = approval_id
        return receipt

    def _assert_release_eligible(self, target_hash, manifest, validations, required, defects, at):
        if type(manifest) is not EvidenceManifest or not GateEngine(evidence_authority=self._authority).evaluate_manifest(manifest)[0]:
            raise ValueError("PASS_REQUIRED")
        if manifest.acquisition_mode != "real" or manifest.skipped_or_blocked or manifest.unverified_scope:
            raise ValueError("REAL_BOUNDARY_UNVERIFIED")
        g3 = next(item for item in manifest.gate_results if item.gate_code == "G3")
        if tuple(g3.details.get("acquisition_modes", ())) != ("real",) or not g3.evidence_refs:
            raise ValueError("REAL_BOUNDARY_UNVERIFIED")
        required = _strings(required)
        if not required or any(type(item) is not ProductValidation for item in validations) or any(type(item) is not DefectAssessment for item in defects):
            raise ValueError("PRODUCT_VALIDATION_INCOMPLETE")
        if any(item.target_hash != target_hash for item in (*validations, *defects)):
            raise ValueError("TARGET_HASH_MISMATCH")
        by_criterion = {item.criterion_id: item for item in validations}
        if len(by_criterion) != len(validations): raise ValueError("PRODUCT_VALIDATION_INCOMPLETE")
        if any(cid not in by_criterion for cid in required): raise ValueError("PRODUCT_VALIDATION_INCOMPLETE")
        for cid in required:
            item = by_criterion[cid]
            if item.verdict != "SUITABLE": raise ValueError("PRODUCT_VALIDATION_FAILED")
            if (item.acquisition_mode != "real" or item.delivered_hash != target_hash or not item.evidence_refs
                or item.environment_id != manifest.environment_id):
                raise ValueError("PRODUCT_VALIDATION_INCOMPLETE")
            for value in (item.procedure, item.expected, item.observed): _text(value, "product evidence")
            _utc(item.validated_at)
            if item.validated_at > at: raise ValueError("PRODUCT_VALIDATION_INCOMPLETE")
        if any(item.is_open_blocking for item in defects): raise ValueError("BLOCKING_DEFECT")


def evaluate_gates(results: Sequence[GateResult], *, target_hash: str) -> tuple[bool, tuple[str, ...]]:
    """Return whether exactly one PASS result exists for every G0-G3."""
    _hash(target_hash, "target_hash")
    reasons: list[str] = []
    by_code: dict[str, GateResult] = {}
    for result in results:
        if result.target_hash != target_hash:
            reasons.append(GateReasonCode.TARGET_HASH_MISMATCH.value)
        if result.gate_code in by_code:
            reasons.append(GateReasonCode.INVALID_GATE.value)
        by_code[result.gate_code] = result
        if result.status is not GateStatus.PASS:
            reasons.append(GateReasonCode.PASS_REQUIRED.value)
    if set(by_code) != set(_GATES): reasons.append(GateReasonCode.INVALID_GATE.value)
    return not reasons, tuple(dict.fromkeys(reasons))


@dataclass(frozen=True, slots=True)
class StaticTool:
    name: str
    command: tuple[str, ...]
    declared: bool
    detected: bool
    installed: bool
    version: str

    def __post_init__(self):
        _text(self.name, "tool name")
        object.__setattr__(self, "command", _strings(self.command))
        if not self.command or any(type(value) is not bool for value in (self.declared, self.detected, self.installed)):
            raise ValueError("invalid static tool profile")
        if self.installed: _text(self.version, "installed version")


@dataclass(frozen=True, slots=True)
class CommandEvidence:
    name: str
    command: tuple[str, ...]
    version: str
    exit_code: int
    evidence_ref: str

    def __post_init__(self):
        for value in (self.name, self.version, self.evidence_ref): _text(value, "command evidence")
        object.__setattr__(self, "command", _strings(self.command))
        if type(self.exit_code) is not int: raise ValueError("exit code required")


@dataclass(frozen=True, slots=True)
class TestEvidence:
    __test__ = False
    test_id: str
    requirement_id: str
    status: GateStatus
    acquisition_mode: str
    assertions: Mapping[str, Any]
    skip_reason: str = ""

    def __post_init__(self):
        _text(self.test_id, "test_id")
        if type(self.status) is not GateStatus: raise ValueError("test status required")
        if self.acquisition_mode not in {"real", "fixture", "mock", "static"}: raise ValueError("invalid acquisition mode")
        object.__setattr__(self, "assertions", _freeze(self.assertions))


def _aggregate(statuses):
    for status in (GateStatus.ERROR, GateStatus.BLOCKED, GateStatus.FAIL, GateStatus.SKIPPED):
        if status in statuses: return status
    return GateStatus.PASS


class GateEngine:
    """Small façade used by orchestration callers to evaluate a manifest."""

    def __init__(self, *, evidence_authority: GateEvidenceAuthority | None = None):
        if evidence_authority is not None and type(evidence_authority) is not GateEvidenceAuthority:
            raise ValueError("EVIDENCE_AUTHORITY_REQUIRED")
        self._authority = evidence_authority

    def issue_manifest(self, manifest: EvidenceManifest) -> EvidenceManifest:
        """Host capture endpoint, never exposed as an agent self-attestation API."""
        if not self._evaluate_manifest(manifest, require_seal=False)[0]:
            raise ValueError("GATE_EVIDENCE_INVALID")
        return self._authority._issue_manifest(manifest)

    def evaluate(self, results: Sequence[GateResult], *, target_hash: str) -> tuple[bool, tuple[str, ...]]:
        return evaluate_gates(results, target_hash=target_hash)

    def evaluate_manifest(self, manifest: EvidenceManifest) -> tuple[bool, tuple[str, ...]]:
        return self._evaluate_manifest(manifest, require_seal=True)

    def _evaluate_manifest(self, manifest, *, require_seal):
        if type(manifest) is not EvidenceManifest: return False, ("MANIFEST_INVALID",)
        try:
            replace(manifest)
        except (ValueError, TypeError): return False, ("MANIFEST_HASH_MISMATCH",)
        accepted, reasons = evaluate_gates(manifest.gate_results, target_hash=manifest.target_hash)
        if not accepted: return accepted, reasons
        if self._authority is None or not all(self._authority.verify_gate(gate) for gate in manifest.gate_results):
            return False, ("GATE_EVIDENCE_INVALID",)
        if require_seal and not self._authority.verify_manifest(manifest):
            return False, ("MANIFEST_SEAL_INVALID",)
        # Replay host-collected evidence without executing tools. PASS labels
        # are never evidence, and relabelling a failed observation cannot pass.
        try:
            replay_engine = GateEngine()
            for gate in manifest.gate_results:
                data = gate.details
                if gate.gate_code == "G0":
                    replay = replay_engine.baseline(target_hash=manifest.target_hash, observations=data["observations"])
                elif gate.gate_code == "G1":
                    profile = tuple(StaticTool(**dict(item)) for item in data["profile"])
                    commands = tuple(data["commands"])
                    if len(commands) != sum(tool.detected for tool in profile): raise ValueError("command inventory mismatch")
                    outputs = iter(commands)
                    def recorded_output(tool):
                        item = next(outputs)
                        return CommandEvidence(item["tool"], tuple(item["command"]), item["version"], item["exit_code"], item["evidence_ref"])
                    replay = replay_engine.static(target_hash=manifest.target_hash, tools=profile, runner=recorded_output)
                elif gate.gate_code == "G2":
                    deterministic = tuple(ReviewFinding(item["category"], GateStatus(item["status"]), item["evidence_ref"]) for item in data["deterministic_findings"])
                    llm = tuple(ReviewFinding(item["category"], GateStatus(item["status"]), item["evidence_ref"]) for item in data["llm_findings"])
                    if len(llm) != len(LLM_CHECKS) or deterministic or data["complete"] is not True:
                        raise ValueError("review findings cannot be overridden")
                    review = DiffReview(True, (), (), (), deterministic, llm, True)
                    replay = replay_engine.change_review(target_hash=manifest.target_hash, review=review)
                else:
                    rows = tuple(TestEvidence(item["test_id"], item["requirement_id"], GateStatus(item["status"]),
                        item["acquisition_mode"], item["assertions"], item["skip_reason"]) for item in data["tests"])
                    replay = replay_engine.tests(target_hash=manifest.target_hash, evidence=rows, require_real=manifest.acquisition_mode == "real")
                if replay.status is not GateStatus.PASS or replace(replay, evidence_id=gate.evidence_id).to_dict() != gate.to_dict():
                    raise ValueError("gate evidence mismatch")
        except (ValueError, TypeError, KeyError, AttributeError, StopIteration):
            return False, ("GATE_EVIDENCE_INVALID",)
        return True, ()

    @_host_capture
    def baseline(self, *, target_hash: str, observations: Mapping[str, Any]) -> GateResult:
        names = {"repository_readable", "branch_head", "dirty_manifest", "runtime_versions", "baseline_tests", "backend_health"}
        if not isinstance(observations, Mapping) or set(observations) != names:
            return GateResult("G0", GateStatus.BLOCKED, target_hash, reason_codes=("BASELINE_INCOMPLETE",))
        try:
            data = _thaw(_freeze(observations))
            statuses, refs = [], []
            for name in sorted(data):
                item = data[name]
                if set(item) != {"status", "evidence_ref", "value"}: raise ValueError("invalid observation")
                statuses.append(GateStatus(item["status"])); _text(item["evidence_ref"], "evidence_ref")
                refs.append(item["evidence_ref"])
            for name in ("repository_readable", "backend_health"):
                value = data[name]["value"]
                if type(value) is not bool: raise ValueError("actual boolean observation required")
                if not value: statuses.append(GateStatus.BLOCKED)
            git = data["branch_head"]["value"]
            _text(git["branch"], "branch")
            if re.fullmatch(r"[0-9a-f]{40,64}", git["head"]) is None: raise ValueError("HEAD required")
            dirty = data["dirty_manifest"]["value"]
            if set(dirty) != {"tracked", "untracked"}: raise ValueError("dirty manifest required")
            for values in dirty.values(): _strings(values)
            versions = data["runtime_versions"]["value"]
            if not isinstance(versions, dict) or not versions: raise ValueError("runtime versions required")
            for name, version in versions.items():
                _text(name, "runtime"); _text(version, "actual version")
                if not re.search(r"\d+\.\d+", version): raise ValueError("actual version required")
            tests = data["baseline_tests"]["value"]
            if set(tests) != {"passed", "failed", "skipped"} or any(type(n) is not int or n < 0 for n in tests.values()) or not sum(tests.values()):
                raise ValueError("baseline counts required")
            failure = tests["failed"] > 0 or data["baseline_tests"]["status"] == "FAIL"
            if failure: statuses.append(GateStatus.FAIL)
            if tests["skipped"]: statuses.append(GateStatus.SKIPPED)
            return GateResult("G0", _aggregate(statuses), target_hash, tuple(dict.fromkeys(refs)),
                ("BASELINE_FAILURE",) if failure else (), {"observations": data, "baseline_failure": failure})
        except (ValueError, TypeError, KeyError, AttributeError):
            return GateResult("G0", GateStatus.ERROR, target_hash, reason_codes=("BASELINE_INVALID",))

    @_host_capture
    def static(self, *, target_hash: str, tools: Sequence[StaticTool], runner) -> GateResult:
        # The host supplies a scoped runner capability. This module never starts
        # a process itself; preflight finishes before the first runner call.
        tools = tuple(tools)
        if any(type(item) is not StaticTool for item in tools) or len({item.name for item in tools}) != len(tools):
            return GateResult("G1", GateStatus.ERROR, target_hash, reason_codes=("PROFILE_INVALID",))
        if any(item.declared and not item.installed for item in tools):
            return GateResult("G1", GateStatus.BLOCKED, target_hash, reason_codes=("TOOL_NOT_INSTALLED",))
        if any(item.declared and not item.detected for item in tools):
            return GateResult("G1", GateStatus.BLOCKED, target_hash, reason_codes=("TOOL_NOT_DETECTED",))
        selected = tuple(item for item in tools if item.detected)
        if not selected or any(not item.installed for item in selected):
            return GateResult("G1", GateStatus.BLOCKED, target_hash, reason_codes=("TOOL_NOT_INSTALLED",))
        outputs = []
        try:
            for tool in selected:
                tool = replace(tool)
                output = runner(tool)
                if type(output) is not CommandEvidence or (output.name, output.command, output.version) != (tool.name, tool.command, tool.version):
                    raise ValueError("command evidence mismatch")
                output = replace(output)
                outputs.append({"tool": output.name, "command": output.command, "version": output.version,
                    "exit_code": output.exit_code, "evidence_ref": output.evidence_ref})
        except Exception:
            return GateResult("G1", GateStatus.ERROR, target_hash, reason_codes=("TOOL_EXECUTION_ERROR",), details={"commands": outputs})
        failed = any(item["exit_code"] != 0 for item in outputs)
        return GateResult("G1", GateStatus.FAIL if failed else GateStatus.PASS, target_hash,
            tuple(dict.fromkeys(item["evidence_ref"] for item in outputs)), ("STATIC_FAILED",) if failed else (),
            {"commands": outputs, "profile": [{"name": tool.name, "command": tool.command, "declared": tool.declared,
                "detected": tool.detected, "installed": tool.installed, "version": tool.version} for tool in tools]})

    @_host_capture
    def change_review(self, *, target_hash: str, review: DiffReview) -> GateResult:
        if type(review) is not DiffReview: return GateResult("G2", GateStatus.ERROR, target_hash, reason_codes=("REVIEW_INVALID",))
        details = {"complete": review.complete, "deterministic_findings": [{"category": f.category, "status": f.status.value, "evidence_ref": f.evidence_ref} for f in review.deterministic_findings],
            "llm_findings": [{"category": f.category, "status": f.status.value, "evidence_ref": f.evidence_ref} for f in review.llm_findings]}
        reasons = tuple(dict.fromkeys((*review.reason_codes, *(f.category for f in review.deterministic_findings))))
        if reasons: return GateResult("G2", GateStatus.FAIL, target_hash, reason_codes=reasons, details=details)
        if not review.complete or {f.category for f in review.llm_findings} != set(LLM_CHECKS):
            return GateResult("G2", GateStatus.BLOCKED, target_hash, reason_codes=("REVIEW_INCOMPLETE",), details=details)
        return GateResult("G2", _aggregate([f.status for f in review.llm_findings]), target_hash,
            tuple(dict.fromkeys(f.evidence_ref for f in review.llm_findings)), details=details)

    @_host_capture
    def tests(self, *, target_hash: str, evidence: Sequence[TestEvidence], require_real: bool = True) -> GateResult:
        rows = tuple(evidence)
        if not rows: return GateResult("G3", GateStatus.BLOCKED, target_hash, reason_codes=("TEST_EVIDENCE_MISSING",))
        if any(type(item) is not TestEvidence for item in rows) or len({item.test_id for item in rows}) != len(rows):
            return GateResult("G3", GateStatus.ERROR, target_hash, reason_codes=("TEST_EVIDENCE_INVALID",))
        statuses, refs, reasons = [], [], []
        for item in rows:
            if not item.requirement_id or item.requirement_id != item.requirement_id.strip() or (item.status is GateStatus.SKIPPED and not item.skip_reason.strip()):
                return GateResult("G3", GateStatus.ERROR, target_hash, reason_codes=("SKIP_CONTRACT_INVALID",))
            statuses.append(item.status)
            if require_real and item.acquisition_mode != "real":
                statuses.append(GateStatus.BLOCKED); reasons.append("REAL_BOUNDARY_UNVERIFIED")
            if item.status is GateStatus.PASS and item.acquisition_mode == "real":
                if set(item.assertions) != {"input", "store", "response", "ui"}:
                    statuses.append(GateStatus.BLOCKED); reasons.append("BOUNDARY_EVIDENCE_INCOMPLETE"); continue
                for check in item.assertions.values():
                    if not isinstance(check, Mapping) or set(check) != {"expected", "observed", "evidence_ref"}:
                        statuses.append(GateStatus.ERROR); reasons.append("ASSERTION_INVALID"); continue
                    try: _text(check["evidence_ref"], "evidence_ref")
                    except ValueError:
                        statuses.append(GateStatus.ERROR); reasons.append("ASSERTION_INVALID"); continue
                    refs.append(check["evidence_ref"])
                    if check["expected"] != check["observed"]:
                        statuses.append(GateStatus.FAIL); reasons.append("ASSERTION_FAILED")
        details = {"counts": {status.value: sum(item.status is status for item in rows) for status in GateStatus},
            "acquisition_modes": sorted({item.acquisition_mode for item in rows}),
            "tests": [{"test_id": item.test_id, "requirement_id": item.requirement_id, "status": item.status.value,
                "acquisition_mode": item.acquisition_mode, "assertions": _thaw(item.assertions), "skip_reason": item.skip_reason} for item in rows]}
        return GateResult("G3", _aggregate(statuses), target_hash, tuple(dict.fromkeys(refs)), tuple(dict.fromkeys(reasons)), details)


# Names used by higher-level orchestration documents; aliases preserve one
# implementation and make the approval boundary explicit to callers.
ApplyApprovalService = ReleaseApprovalService
EvidenceManifestValidator = GateEngine


__all__ = ["GateStatus", "GateReasonCode", "GateResult", "EvidenceManifest", "DiffReview",
           "DiffReviewService", "ProductValidation", "DefectAssessment", "ReleaseDecision",
           "ReleaseDecisionRecord", "ApprovalReceipt", "ReleaseApprovalService", "ApplyApprovalService",
           "GateEngine", "EvidenceManifestValidator", "evaluate_gates", "ApplyApprovalRecord",
           "StaticTool", "CommandEvidence", "TestEvidence", "DiffFile", "ReviewFinding", "LLM_CHECKS", "GateEvidenceAuthority"]
