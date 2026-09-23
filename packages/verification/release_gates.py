"""E09 host-only release evidence boundary. No runner, network or deploy IO.

Capture methods are trusted host adapters, not agent/API attestations. ``real``
is a host assertion about supplied observations, never proof that this module
executed a command. The transport manifest owner and C14 foundation stay distinct.
"""
from datetime import datetime, timezone
from dataclasses import dataclass
from functools import wraps
import json
import re
from threading import RLock

from packages.artifacts.evidence import EvidenceManifest as TransportEvidenceManifest
from packages.artifacts.evidence import RawArtifactChecksum, AcquisitionMode
from . import gates as foundation
from .gates import EvidenceManifest as FoundationEvidenceManifest


SUBJECT_FIELDS = (
    "target_hash", "delivered_artifact_hash", "git_head", "container_image_digest",
    "db_migration_head", "config_revision_hash", "policy_hash",
    "provider_routing_snapshot_hash", "environment_id", "design_baseline_hash",
    "work_plan_hash", "work_instruction_hash",
)
REGRESSION_SCOPES = ("impact", "smoke", "helper_consumers", "shared_boundaries")
ADAPTERS = {
    "API": ("openapi_diff", "route_test"),
    "DB": ("migration_up", "migration_down"),
    "Browser": ("bff_route", "network_url"),
    "Module": ("caller_test", "import_test"),
    "External": ("approved_environment", "real_response"),
}


class ReleaseContractError(ValueError):
    """Value-safe stable rejection code (never interpolate input)."""


def _fail(code):
    raise ReleaseContractError(code)


def _plain(value, depth=0, budget=None):
    """Validate before any coercion/hash/copy; arbitrary callbacks execute zero."""
    if budget is None:
        budget = [20000, 262144]
    budget[0] -= 1
    if depth > 12 or budget[0] < 0:
        _fail("INPUT_BOUND_EXCEEDED")
    kind = type(value)
    if kind is str:
        budget[1] -= len(value.encode("utf-8"))
        if len(value) > 16384 or budget[1] < 0:
            _fail("INPUT_BOUND_EXCEEDED")
        return value
    if value is None or kind is bool:
        return value
    if kind is int and abs(value) <= 2**53:
        return value
    if kind in (list, tuple):
        if len(value) > 1024:
            _fail("INPUT_BOUND_EXCEEDED")
        return [_plain(item, depth+1, budget) for item in value]
    if kind is dict:
        if len(value) > 256 or any(type(key) is not str for key in value):
            _fail("INVALID_BUILTIN_INPUT")
        return {_plain(key, depth+1, budget): _plain(item, depth+1, budget) for key, item in value.items()}
    _fail("INVALID_BUILTIN_INPUT")


def _text(value):
    return type(value) is str and bool(value.strip()) and value == value.strip()


def _hash(value):
    return type(value) is str and re.fullmatch(r"sha256:[0-9a-f]{64}", value) is not None


def _timestamp(value):
    if type(value) is not str:
        _fail("UTC_TIME_REQUIRED")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        _fail("UTC_TIME_REQUIRED")
    if parsed.tzinfo is not timezone.utc:
        _fail("UTC_TIME_REQUIRED")
    return parsed


@dataclass(frozen=True, slots=True)
class ReleaseEvidenceRef:
    record_id: str
    content_hash: str


def _locked(method):
    @wraps(method)
    def call(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)
    return call


def _gate(data):
    """Only detached builtin data reaches the older DTO constructor."""
    value = _plain(data)
    return foundation.GateResult(**value)


def _foundation(data):
    value = _plain(data)
    value.pop('manifest_hash', None)
    value['gate_results'] = tuple(_gate(row) for row in value['gate_results'])
    return FoundationEvidenceManifest(**value)


class ReleaseGateService:
    """In-memory trusted host capability; agent payloads cannot register authority."""

    def __init__(self, *, evidence_authority, subject, required_criteria, impact,
                 regression_inventory):
        if type(evidence_authority) is not foundation.GateEvidenceAuthority:
            _fail("HOST_AUTHORITY_REQUIRED")
        self._authority = evidence_authority
        self._subject = _plain(subject)
        if type(self._subject) is not dict or set(self._subject) != set(SUBJECT_FIELDS):
            _fail("EVIDENCE_TARGET_MISMATCH")
        for key, value in self._subject.items():
            if not _text(value) or (key.endswith("hash") or key.endswith("digest")) and not _hash(value):
                _fail("EVIDENCE_TARGET_MISMATCH")
        if self._subject['target_hash'] != self._subject['delivered_artifact_hash']:
            _fail("EVIDENCE_TARGET_MISMATCH")
        if re.fullmatch(r"[0-9a-f]{40,64}", self._subject['git_head']) is None:
            _fail("EVIDENCE_TARGET_MISMATCH")
        self._criteria = _plain(required_criteria)
        self._impact = _plain(impact)
        self._inventory = _plain(regression_inventory)
        if not self._criteria or len(set(self._criteria)) != len(self._criteria) or any(not _text(c) for c in self._criteria):
            _fail("CRITERIA_REQUIRED")
        if not self._impact or any(type(c) is not str or c not in ADAPTERS for c in self._impact):
            _fail("IMPACT_ADAPTER_REQUIRED")
        if set(self._inventory) != set(REGRESSION_SCOPES) or any(
                type(v) is not list or not v or any(not _text(c) for c in v) or len(set(v)) != len(v)
                for v in self._inventory.values()):
            _fail("REGRESSION_INVENTORY_REQUIRED")
        self._gates = {}
        self._lock = RLock()
        self._records = {}
        self._handles = {}
        self._actors = {}
        self._actor_generations = {}
        self._revoked_actor_ids = set()
        self._current_bundle = None
        self._validation_data = {}
        self._state_version = 0
        self._latest_decision = None
        self._latest_decision_at = None
        self._consumed = {}
        self._revoked = set()
        self._defects = {}
        self._independent_retests = {}
        self._owner = foundation.ReleaseApprovalService(evidence_authority=evidence_authority)

    @_locked
    def capture_gate(self, code, observation):
        if type(code) is not str or code not in ('G4', 'G5', 'G6', 'G7'):
            _fail("INVALID_GATE")
        data = _plain(observation)
        if type(data) is not dict or data.get('subject') != self._subject:
            _fail("EVIDENCE_TARGET_MISMATCH")
        start = _timestamp(data.get('started_at'))
        finish = _timestamp(data.get('finished_at'))
        if finish < start or not _text(data.get('actor_id')):
            _fail("INVALID_OBSERVATION")
        refs = data.get('evidence_refs')
        if type(refs) is not list or any(not _text(r) for r in refs) or len(set(refs)) != len(refs):
            _fail("INVALID_EVIDENCE_REFS")
        details = dict(capture=data, selected_adapters=sorted(set(self._impact)))
        reasons = []
        status = foundation.GateStatus.PASS
        if data.get('acquisition_mode') != 'real' or data.get('available') is not True or not refs:
            reasons.append('REAL_EVIDENCE_REQUIRED')
        obs = data.get('observations')
        if type(obs) is not dict:
            _fail("INVALID_OBSERVATION")
        if code == 'G4':
            adapters = obs.get('adapters', {})
            if type(adapters) is not dict:
                _fail('INVALID_OBSERVATION')
            for name in self._impact:
                item = adapters.get(name)
                if type(item) is not dict:
                    reasons.append('INTEGRATION_EVIDENCE_INCOMPLETE'); continue
                if item.get('acquisition_mode') != 'real' or item.get('available') is not True:
                    reasons.append('REAL_INTEGRATION_EVIDENCE_REQUIRED')
                if item.get('environment_id') != self._subject['environment_id']:
                    reasons.append('INTEGRATION_ENVIRONMENT_MISMATCH')
                required = ADAPTERS[name]
                if name == 'DB' and item.get('rollback_approved') is True:
                    required = ('migration_up', 'approved_rollback')
                if any(type(item.get(k)) is not str or item[k] not in refs for k in required) or type(item.get('exit_code')) is not int:
                    reasons.append('INTEGRATION_EVIDENCE_INCOMPLETE')
                elif item['exit_code'] != 0:
                    status = foundation.GateStatus.FAIL; reasons.append('INTEGRATION_FAILED')
                if name == 'Browser' and not self._same_origin(item.get('request_url')):
                    reasons.append('BROWSER_SAME_ORIGIN_REQUIRED')
                if name == 'External' and (item.get('acquisition_mode') != 'real' or item.get('environment_id') != self._subject['environment_id']):
                    reasons.append('REAL_EXTERNAL_EVIDENCE_REQUIRED')
        elif code == 'G5':
            command = obs.get('command')
            if not self._real_boundary(obs):
                reasons.append('REAL_BUILD_EVIDENCE_REQUIRED')
            if any(not _text(obs.get(k)) or obs[k] not in refs for k in ('artifact_ref', 'dependency_snapshot_ref')):
                reasons.append('BUILD_ARTIFACT_REFERENCE_REQUIRED')
            if (obs.get('configuration') != 'production' or type(command) is not list or not command
                    or any(not _text(c) for c in command) or any(c in ('dev', 'serve', '--watch') for c in command)
                    or obs.get('artifact_hash') != self._subject['delivered_artifact_hash']
                    or not _hash(obs.get('dependency_snapshot_hash')) or type(obs.get('exit_code')) is not int):
                reasons.append('PRODUCTION_BUILD_EVIDENCE_REQUIRED')
            elif obs['exit_code'] != 0:
                status = foundation.GateStatus.FAIL; reasons.append('BUILD_FAILED')
        elif code == 'G6':
            rows = obs.get('scenarios')
            if type(rows) is not list or not rows:
                reasons.append('FUNCTIONAL_EVIDENCE_INCOMPLETE')
            else:
                ids = []
                for row in rows:
                    if type(row) is not dict:
                        reasons.append('FUNCTIONAL_EVIDENCE_INCOMPLETE'); continue
                    if not self._real_boundary(row):
                        reasons.append('REAL_FUNCTIONAL_EVIDENCE_REQUIRED')
                    ids.append(row.get('id'))
                    if any(not _text(row.get(k)) for k in ('id', 'preconditions', 'action', 'expected', 'observed', 'verdict')):
                        reasons.append('FUNCTIONAL_EVIDENCE_INCOMPLETE')
                    evidence = row.get('evidence')
                    if type(evidence) is not list or not evidence or any(type(r) is not str or r not in refs for r in evidence):
                        reasons.append('FUNCTIONAL_EVIDENCE_INCOMPLETE')
                    if row.get('verdict') != 'PASS':
                        reasons.append('FUNCTIONAL_NOT_PASS')
                    if row.get('verdict') == 'SKIPPED' and (not _text(row.get('skip_reason')) or not _text(row.get('requirement_id'))):
                        reasons.append('SKIP_CONTRACT_INVALID')
                    if row.get('expected') != row.get('observed'):
                        status = foundation.GateStatus.FAIL; reasons.append('FUNCTIONAL_ASSERTION_FAILED')
                    if type(row.get('ui')) is not bool:
                        reasons.append('FUNCTIONAL_UI_SCOPE_REQUIRED')
                    if row.get('ui') is True:
                        boundaries = row.get('boundaries')
                        if (type(boundaries) is not dict or set(boundaries) != {'click', 'network', 'store', 'response', 'final_ui'}
                                or any(not self._real_boundary(r) or type(r.get('evidence_ref')) is not str
                                       or r['evidence_ref'] not in refs for r in boundaries.values())):
                            reasons.append('UI_EVIDENCE_INCOMPLETE')
                        if not self._same_origin(row.get('request_url')):
                            reasons.append('BROWSER_SAME_ORIGIN_REQUIRED')
                if any(not _text(i) for i in ids) or len(set(i for i in ids if type(i) is str)) != len(ids):
                    reasons.append('FUNCTIONAL_SCENARIO_ID_INVALID')
        else:
            executed, results = obs.get('executed'), obs.get('results')
            missing = []
            if type(executed) is not dict or type(results) is not dict or set(executed) != set(REGRESSION_SCOPES):
                reasons.append('REGRESSION_SCOPE_INCOMPLETE')
                missing.extend(c for values in self._inventory.values() for c in values)
            else:
                for scope, expected in self._inventory.items():
                    seen = executed[scope]
                    if type(seen) is not list or any(not _text(c) for c in seen):
                        reasons.append('REGRESSION_SCOPE_INCOMPLETE'); missing.extend(expected); continue
                    if len(set(seen)) != len(seen) or any(c not in expected for c in seen):
                        reasons.append('REGRESSION_INVENTORY_MISMATCH')
                    for case in expected:
                        if case not in seen:
                            missing.append(case)
                        elif results.get(case) != 'PASS':
                            reasons.append('REGRESSION_NOT_PASS')
            if obs.get('full_suite') is not True:
                missing.append('FULL_SUITE_NOT_EXECUTED')
            declared = obs.get('unverified')
            if type(declared) is not list or any(not _text(v) for v in declared):
                reasons.append('UNVERIFIED_SCOPE_REQUIRED')
            else:
                missing.extend(declared)
            details['unverified_scope'] = sorted(set(missing))
            if missing:
                reasons.append('REGRESSION_SCOPE_UNVERIFIED')
        if reasons and status is foundation.GateStatus.PASS:
            status = foundation.GateStatus.BLOCKED
        result = self._authority._issue_gate(foundation.GateResult(code, status,
            self._subject['target_hash'], tuple(refs), tuple(sorted(set(reasons))), details))
        self._gates[result.evidence_id] = result.to_dict()
        return result

    def _real_boundary(self, value):
        return (type(value) is dict and value.get('acquisition_mode') == 'real'
                and value.get('available') is True and value.get('environment_id') == self._subject['environment_id'])

    @staticmethod
    def _same_origin(value):
        return type(value) is str and value.startswith('/') and not value.startswith('//') and '\\' not in value and not any(ord(c) < 32 for c in value)

    def _publish(self, kind, identity, data):
        if not _text(identity):
            _fail('INVALID_RECORD_ID')
        key = kind + ':' + identity
        detached = _plain(dict(data, kind=kind, record_id=key))
        raw = foundation.canonical_json(detached)
        digest = foundation.canonical_hash(detached)
        if key in self._records and self._records[key] != raw:
            _fail('REPLAY_CONFLICT')
        handle = ReleaseEvidenceRef(key, digest)
        self._records[key] = raw
        self._handles[id(handle)] = (handle, key, digest)
        return handle

    def _record(self, handle, kind=None):
        if type(handle) is not ReleaseEvidenceRef or type(handle.record_id) is not str or type(handle.content_hash) is not str:
            _fail('HOST_RECORD_REQUIRED')
        registered = self._handles.get(id(handle))
        if registered is None or registered[0] is not handle or registered[1:] != (handle.record_id, handle.content_hash):
            _fail('HOST_RECORD_REQUIRED')
        raw = self._records.get(handle.record_id)
        if type(raw) is not str:
            _fail('RECORD_HASH_MISMATCH')
        data = json.loads(raw)
        if foundation.canonical_hash(data) != handle.content_hash or kind is not None and data['kind'] != kind:
            _fail('RECORD_HASH_MISMATCH')
        return data

    @_locked
    def project(self, handle):
        """Detached value-safe contract projection; no raw artifact body."""
        return self._record(handle)

    @_locked
    def register_actor(self, actor_id, *, role, context, issued_at, expires_at):
        """Host authentication adapter only. Not an agent-accessible API."""
        data = _plain(dict(actor_id=actor_id, role=role, context=context, issued_at=issued_at, expires_at=expires_at))
        if any(not _text(data[k]) for k in ('actor_id', 'context')) or role not in ('HUMAN', 'TESTER', 'DEVELOPER'):
            _fail('INVALID_ACTOR')
        if actor_id in self._revoked_actor_ids:
            _fail('ACTOR_IDENTITY_REVOKED')
        if _timestamp(expires_at) <= _timestamp(issued_at):
            _fail('INVALID_ACTOR_WINDOW')
        current = self._actor_generations.get(actor_id)
        if current is not None:
            previous = self._record(current, 'ACTOR')
            if self._actors.get(actor_id) != current.content_hash:
                _fail('ACTOR_GENERATION_STALE')
            if data == {key: previous[key] for key in data}:
                return current
            # A superseded registration is historical evidence, not a request
            # to roll the current authority back. Equal-time rebinds also deny.
            if _timestamp(issued_at) <= _timestamp(previous['issued_at']):
                _fail('ACTOR_GENERATION_STALE')
        ref = self._publish('ACTOR', actor_id + ':' + issued_at, data)
        self._actors[actor_id] = ref.content_hash
        self._actor_generations[actor_id] = ref
        return ref

    @_locked
    def revoke_actor(self, actor):
        data = self._record(actor, 'ACTOR')
        self._revoked_actor_ids.add(data['actor_id'])
        self._actors.pop(data['actor_id'], None)

    def _actor(self, actor, at, human=False):
        data = self._record(actor, 'ACTOR')
        if self._actors.get(data['actor_id']) != actor.content_hash or not _timestamp(data['issued_at']) <= _timestamp(at) < _timestamp(data['expires_at']):
            _fail('STALE_ACTOR')
        if human and data['role'] != 'HUMAN':
            _fail('AUTHENTICATED_HUMAN_REQUIRED')
        return data

    def _actor_by_id(self, actor_id, at):
        for handle, _, digest in self._handles.values():
            if self._actors.get(actor_id) == digest:
                data = self._actor(handle, at)
                if data['actor_id'] == actor_id:
                    return data
        _fail('HOST_ACTOR_REQUIRED')

    @_locked
    def capture_bundle(self, bundle_id, *, foundation_data, transport, gate_ids, at):
        data, base, ids = _plain(transport), _plain(foundation_data), _plain(gate_ids)
        if not _text(bundle_id):
            _fail('INVALID_RECORD_ID')
        previous = self._records.get('BUNDLE:' + bundle_id)
        if previous is not None and foundation.canonical_hash(json.loads(previous)) != self._current_bundle:
            _fail('STALE_BUNDLE')
        now = _timestamp(at)
        if type(data) is not dict or any(data.get(k) != self._subject[k] for k in SUBJECT_FIELDS):
            _fail('EVIDENCE_TARGET_MISMATCH')
        if type(base) is not dict or any(base.get(k) != self._subject[k] for k in (
                'target_hash', 'delivered_artifact_hash', 'environment_id', 'design_baseline_hash',
                'work_plan_hash', 'work_instruction_hash', 'git_head')) or base.get('verified_artifact_hash') != self._subject['target_hash']:
            _fail('EVIDENCE_TARGET_MISMATCH')
        if type(ids) is not list or len(ids) != 4 or any(not _hash(i) for i in ids) or len(set(ids)) != 4:
            _fail('ALL_GATES_REQUIRED')
        additional = []
        for identity in ids:
            row = self._gates.get(identity)
            if row is None or not self._authority.verify_gate(_gate(row)):
                _fail('GATE_EVIDENCE_INVALID')
            additional.append(_plain(row))
        if {r['gate_code'] for r in additional} != {'G4', 'G5', 'G6', 'G7'}:
            _fail('ALL_GATES_REQUIRED')
        try:
            old_manifest = _foundation(base)
        except (TypeError, KeyError, ValueError):
            _fail('FOUNDATION_EVIDENCE_INVALID')
        if not foundation.GateEngine(evidence_authority=self._authority).evaluate_manifest(old_manifest)[0]:
            _fail('FOUNDATION_EVIDENCE_INVALID')
        if (old_manifest.acquisition_mode != 'real' or old_manifest.skipped_or_blocked or old_manifest.unverified_scope
                or any(row['status'] != 'PASS' for row in additional)):
            _fail('ALL_GATES_PASS_REQUIRED')
        raw = data.get('raw_artifact_checksums')
        if type(raw) is not list or not raw:
            _fail('RAW_CHECKSUMS_REQUIRED')
        if any(type(row) is not dict or row.get('target_hash') != self._subject['target_hash']
               or row.get('environment_id') != self._subject['environment_id'] for row in raw):
            _fail('EVIDENCE_TARGET_MISMATCH')
        for row in raw:
            if not _text(row.get('path')) or not _hash(row.get('sha256')) or type(row.get('bytes')) is not int or row['bytes'] < 0:
                _fail('RAW_CHECKSUMS_REQUIRED')
        if data.get('acquisition_mode') != 'real' or data.get('skipped_or_blocked') != [] or data.get('unverified_scope') != []:
            _fail('REAL_BOUNDARY_UNVERIFIED')
        actor = self._actor_by_id(data.get('actor_id'), at)
        if actor['role'] not in ('TESTER', 'HUMAN') or data.get('actor_role') != actor['role']:
            _fail('INDEPENDENT_EVIDENCE_REQUIRED')
        versions = data.get('toolchain_versions')
        if type(versions) is not dict or not versions or any(not _text(k) or not _text(v) for k, v in versions.items()):
            _fail('TOOLCHAIN_REQUIRED')
        start, finish = _timestamp(data.get('started_at')), _timestamp(data.get('finished_at'))
        if not start <= finish <= now:
            _fail('EVIDENCE_TIME_MISMATCH')
        refs = {row['path'] for row in raw}
        all_gates = [*base['gate_results'], *additional]
        if any(ref not in refs for row in all_gates for ref in row['evidence_refs']):
            _fail('RAW_CHECKSUMS_REQUIRED')
        if any(data.get(k) not in refs for k in ('git_status_before_ref', 'git_status_after_ref')):
            _fail('RAW_CHECKSUMS_REQUIRED')
        for row in additional:
            capture = row['details']['capture']
            if capture['subject'] != self._subject or capture['actor_id'] != actor['actor_id']:
                _fail('EVIDENCE_TARGET_MISMATCH')
            if not start <= _timestamp(capture['started_at']) <= _timestamp(capture['finished_at']) <= finish:
                _fail('EVIDENCE_TIME_MISMATCH')
        by_code = {row['gate_code']: row for row in all_gates}
        build = by_code['G5']['details']['capture']['observations']
        raw_by_path = {row['path']: row for row in raw}
        if len(raw_by_path) != len(raw):
            _fail('RAW_CHECKSUMS_REQUIRED')
        for ref_key, hash_key in (('artifact_ref', 'artifact_hash'), ('dependency_snapshot_ref', 'dependency_snapshot_hash')):
            artifact = raw_by_path.get(build.get(ref_key))
            if artifact is None or artifact['sha256'] != build.get(hash_key):
                _fail('BUILD_ARTIFACT_CHECKSUM_MISMATCH')
        observed_g0 = by_code['G0']['details']['observations']
        if observed_g0['branch_head']['value']['head'] != self._subject['git_head']:
            _fail('EVIDENCE_TARGET_MISMATCH')
        if any(versions.get(k) != v for k, v in observed_g0['runtime_versions']['value'].items()):
            _fail('TOOLCHAIN_MISMATCH')
        for command in by_code['G1']['details']['commands']:
            if versions.get(command['tool']) != command['version']:
                _fail('TOOLCHAIN_MISMATCH')
        build_command = ' '.join(by_code['G5']['details']['capture']['observations']['command'])
        if type(data.get('commands')) is not list or build_command not in data['commands']:
            _fail('COMMAND_EVIDENCE_MISMATCH')
        try:
            dto = dict(data, started_at=start, finished_at=finish, acquisition_mode=AcquisitionMode.REAL,
                       raw_artifact_checksums=tuple(RawArtifactChecksum(**row) for row in raw))
            TransportEvidenceManifest(**dto)
        except (TypeError, KeyError, ValueError):
            _fail('TRANSPORT_MANIFEST_INVALID')
        result = self._publish('BUNDLE', bundle_id, dict(subject=self._subject, transport=data, foundation=base,
            gates=additional, status='TECHNICAL_PASS_NOT_PRODUCT_ACCEPTANCE', actor_hash=self._actors[actor['actor_id']]))
        self._current_bundle = result.content_hash
        return result

    def _bundle(self, ref, at):
        data = self._record(ref, 'BUNDLE')
        if data['subject'] != self._subject or self._current_bundle != ref.content_hash:
            _fail('RELEASE_SUBJECT_HASH_MISMATCH')
        actor = self._actor_by_id(data['transport']['actor_id'], at)
        if self._actors[actor['actor_id']] != data['actor_hash']:
            _fail('STALE_ACTOR')
        base = _foundation(data['foundation'])
        if not foundation.GateEngine(evidence_authority=self._authority).evaluate_manifest(base)[0] or any(
                not self._authority.verify_gate(_gate(row)) for row in data['gates']):
            _fail('GATE_EVIDENCE_INVALID')
        return data, base

    def _validations(self, data_by_criterion=None):
        rows = []
        for data in (self._validation_data if data_by_criterion is None else data_by_criterion).values():
            rows.append(foundation.ProductValidation(data['criterion_id'], self._subject['target_hash'],
                data['verdict'], data['validated_by'], self._subject['environment_id'], tuple(data['evidence_refs']),
                data['acquisition_mode'], self._subject['delivered_artifact_hash'], data['procedure'],
                data['expected'], data['observed'], _timestamp(data['validated_at'])))
        return tuple(rows)

    @_locked
    def record_product_validation(self, bundle, actor, validation, *, at):
        data = _plain(validation)
        evidence, _ = self._bundle(bundle, at)
        who = self._actor(actor, at)
        if who['role'] not in ('TESTER', 'HUMAN'):
            _fail('INDEPENDENT_EVIDENCE_REQUIRED')
        if type(data) is not dict or data.get('subject') != self._subject:
            _fail('RELEASE_SUBJECT_HASH_MISMATCH')
        if data.get('criterion_id') not in self._criteria or data.get('verdict') not in ('SUITABLE', 'NEEDS_IMPROVEMENT', 'UNSUITABLE', 'BLOCKED'):
            _fail('PRODUCT_VALIDATION_INCOMPLETE')
        if any(not _text(data.get(k)) for k in ('procedure', 'expected', 'observed')):
            _fail('PRODUCT_VALIDATION_INCOMPLETE')
        refs = data.get('evidence_refs')
        raw = {row['path'] for row in evidence['transport']['raw_artifact_checksums']}
        if type(refs) is not list or not refs or any(type(r) is not str or r not in raw for r in refs):
            _fail('PRODUCT_VALIDATION_INCOMPLETE')
        if data.get('acquisition_mode') != 'real' or not _timestamp(evidence['transport']['started_at']) <= _timestamp(data.get('validated_at')) <= _timestamp(at):
            _fail('PRODUCT_VALIDATION_INCOMPLETE')
        if data['verdict'] == 'SUITABLE' and data['expected'] != data['observed']:
            _fail('PRODUCT_VALIDATION_FAILED')
        data.update(validated_by=who['actor_id'], actor_hash=actor.content_hash, bundle_hash=bundle.content_hash)
        proposed = dict(self._validation_data)
        proposed[data['criterion_id']] = data
        self._owner.record_validation_state(target_hash=self._subject['target_hash'], product_validations=self._validations(proposed), required_criteria=self._criteria)
        self._validation_data = proposed
        self._state_version += 1

    def _eligible(self, bundle, at):
        evidence, base = self._bundle(bundle, at)
        if set(self._validation_data) != set(self._criteria):
            _fail('PRODUCT_VALIDATION_INCOMPLETE')
        for value in self._validation_data.values():
            if value['bundle_hash'] != bundle.content_hash or self._actors.get(value['validated_by']) != value['actor_hash']:
                _fail('PRODUCT_VALIDATION_INCOMPLETE')
            self._actor_by_id(value['validated_by'], at)
        state = self._owner._states.get(self._subject['target_hash'])
        if state is None:
            _fail('PRODUCT_VALIDATION_INCOMPLETE')
        self._owner._assert_release_eligible(self._subject['target_hash'], base, *state, _timestamp(at))
        return evidence, base

    @_locked
    def decide(self, decision_id, bundle, actor, *, decision, at, expires_at, deferral=None):
        values = _plain(dict(decision_id=decision_id, decision=decision, at=at, expires_at=expires_at, deferral=deferral))
        who = self._actor(actor, at, human=True)
        self._bundle(bundle, at)
        if values['decision'] not in ('RELEASE', 'REWORK', 'DEFER', 'REJECT'):
            _fail('INVALID_DECISION')
        if not _timestamp(at) < _timestamp(expires_at) <= _timestamp(who['expires_at']):
            _fail('STALE_APPROVAL')
        if decision == 'RELEASE':
            self._eligible(bundle, at)
        if decision == 'DEFER':
            if type(deferral) is not dict or any(not _text(deferral.get(k)) for k in ('reason', 'risk', 'carryover')):
                _fail('DEFERRAL_CONTRACT_REQUIRED')
            if _timestamp(deferral.get('review_at')) <= _timestamp(at):
                _fail('DEFERRAL_CONTRACT_REQUIRED')
        data = dict(values, bundle_hash=bundle.content_hash, subject_hash=foundation.canonical_hash(self._subject),
            actor_id=who['actor_id'], actor_hash=actor.content_hash, state_version=self._state_version)
        result = self._publish('DECISION', decision_id, data)
        # Insertion order / replay of old records is not current authority.
        when = _timestamp(at)
        if self._latest_decision_at is None or when > self._latest_decision_at:
            self._latest_decision, self._latest_decision_at = result.content_hash, when
        elif when == self._latest_decision_at and self._latest_decision != result.content_hash:
            self._latest_decision = None  # Ambiguous equal-time human decisions fail closed.
        return result

    def _decision(self, ref, bundle, at):
        self._record(bundle, 'BUNDLE')
        data = self._record(ref, 'DECISION')
        if data['bundle_hash'] != bundle.content_hash or data['subject_hash'] != foundation.canonical_hash(self._subject):
            _fail('RELEASE_SUBJECT_HASH_MISMATCH')
        if (self._latest_decision != ref.content_hash or data['state_version'] != self._state_version
                or not _timestamp(data['at']) <= _timestamp(at) < _timestamp(data['expires_at'])
                or self._actors.get(data['actor_id']) != data['actor_hash']):
            _fail('STALE_APPROVAL')
        self._actor_by_id(data['actor_id'], at)
        if data['decision'] != 'RELEASE':
            _fail('DECISION_NOT_RELEASE')
        self._eligible(bundle, at)
        return data

    @_locked
    def approve_action(self, approval_id, bundle, decision, actor, *, operation, at, expires_at):
        values = _plain(dict(approval_id=approval_id, operation=operation, at=at, expires_at=expires_at))
        self._record(bundle, 'BUNDLE')
        who = self._actor(actor, at, human=True)
        decided = self._decision(decision, bundle, at)
        if operation not in ('APPLY', 'DEPLOY'):
            _fail('INVALID_OPERATION')
        if not _timestamp(at) < _timestamp(expires_at) <= min(_timestamp(who['expires_at']), _timestamp(decided['expires_at'])):
            _fail('STALE_APPROVAL')
        return self._publish('APPROVAL', approval_id, dict(values, bundle_hash=bundle.content_hash,
            decision_id=decision.record_id, decision_hash=decision.content_hash,
            actor_id=who['actor_id'], actor_hash=actor.content_hash))

    @_locked
    def admit(self, bundle, approval, *, operation, at):
        """Admission only: never perform Apply/Deploy or imply Main acceptance."""
        _plain(dict(operation=operation, at=at))
        self._record(bundle, 'BUNDLE')
        data = self._record(approval, 'APPROVAL')
        if approval.content_hash in self._revoked:
            _fail('STALE_APPROVAL')
        if data['bundle_hash'] != bundle.content_hash:
            _fail('RELEASE_SUBJECT_HASH_MISMATCH')
        if operation != data['operation']:
            _fail('APPROVAL_OPERATION_MISMATCH')
        if not _timestamp(data['at']) <= _timestamp(at) < _timestamp(data['expires_at']) or self._actors.get(data['actor_id']) != data['actor_hash']:
            _fail('STALE_APPROVAL')
        self._actor_by_id(data['actor_id'], at)
        decision = next((h for h, key, digest in self._handles.values() if key == data['decision_id'] and digest == data['decision_hash']), None)
        self._decision(decision, bundle, at)
        key = (data['decision_hash'], operation)
        if key in self._consumed:
            old_id, receipt = self._consumed[key]
            if old_id != approval.record_id:
                _fail('REPLAY_CONFLICT')
            return _plain(receipt)
        receipt = dict(accepted=True, status='ADMITTED_NOT_EXECUTED', operation=operation, approval_id=approval.record_id,
            bundle_hash=bundle.content_hash, target_hash=self._subject['target_hash'], side_effects=0)
        self._consumed[key] = (approval.record_id, _plain(receipt))
        return receipt

    @_locked
    def revoke_action_approval(self, approval):
        self._record(approval, 'APPROVAL')
        self._revoked.add(approval.content_hash)

    @_locked
    def record_defect(self, bundle, actor, defect, *, at):
        data = _plain(defect)
        evidence, _ = self._bundle(bundle, at)
        who = self._actor(actor, at)
        if type(data) is not dict or data.get('subject') != self._subject:
            _fail('RELEASE_SUBJECT_HASH_MISMATCH')
        if (not _text(data.get('defect_id')) or data.get('severity') not in ('CRITICAL', 'MAJOR', 'MINOR')
                or type(data.get('blocking')) is not bool or not _text(data.get('lifecycle'))):
            _fail('DEFECT_CONTRACT_INVALID')
        refs = data.get('evidence_refs')
        raw = {row['path'] for row in evidence['transport']['raw_artifact_checksums']}
        if type(refs) is not list or not refs or any(type(r) is not str or r not in raw for r in refs):
            _fail('DEFECT_EVIDENCE_REQUIRED')
        prior = self._defects.get(data['defect_id'], [])
        if prior:
            if any(data[k] != prior[-1][k] for k in ('severity', 'blocking', 'subject')):
                _fail('DEFECT_IDENTITY_CHANGED')
            data.update(reported_by=prior[0]['reported_by'], reporter_context=prior[0]['reporter_context'])
        else:
            data.update(reported_by=who['actor_id'], reporter_context=who['context'])
        # Host transition actor is the fixer; caller-supplied fixer claims cannot
        # replace history. Preserve all actors/contexts that handled a fix.
        fixers = _plain(prior[-1]['fixers']) if prior else []
        if data['lifecycle'] in ('FIXING', 'READY_FOR_RETEST'):
            fixer = dict(actor_id=who['actor_id'], context=who['context'])
            if fixer not in fixers:
                fixers.append(fixer)
        data['fixers'] = fixers
        if data['lifecycle'] == 'CLOSED':
            retest = self._independent_retests.get(data['defect_id'])
            if retest is None or retest['fixers_hash'] != foundation.canonical_hash(fixers):
                _fail('INDEPENDENT_RETEST_REQUIRED')
            if self._actors.get(retest['actor_id']) != retest['actor_hash']:
                _fail('INDEPENDENT_RETEST_REQUIRED')
            self._actor_by_id(retest['actor_id'], at)
        if data['lifecycle'] == 'DEFERRED':
            self._actor(actor, at, human=True)
            deferred = data.get('deferral')
            if type(deferred) is not dict or any(not _text(deferred.get(k)) for k in ('reason', 'risk', 'carryover')):
                _fail('DEFERRAL_CONTRACT_REQUIRED')
            if _timestamp(deferred.get('review_at')) <= _timestamp(at):
                _fail('DEFERRAL_CONTRACT_REQUIRED')
        assessment = foundation.DefectAssessment(data['defect_id'], self._subject['target_hash'],
            data['severity'] == 'CRITICAL' or data['blocking'], data['lifecycle'], data['reported_by'])
        self._owner.record_validation_state(target_hash=self._subject['target_hash'], product_validations=self._validations(),
            required_criteria=self._criteria, defects=(assessment,))
        data.update(at=at, actor_id=who['actor_id'], bundle_hash=bundle.content_hash)
        if not prior or data != prior[-1]:
            self._defects[data['defect_id']] = [*prior, data]
            self._state_version += 1

    @_locked
    def record_retest(self, bundle, actor, defect_id, gate_data, *, at):
        _plain(dict(defect_id=defect_id, gate_data=gate_data))
        self._bundle(bundle, at)
        who = self._actor(actor, at)
        if not _text(defect_id):
            _fail('DEFECT_CONTRACT_INVALID')
        history = self._defects.get(defect_id, [])
        if not history or who['role'] != 'TESTER' or who['actor_id'] == history[0]['reported_by'] or who['context'] == history[0]['reporter_context']:
            _fail('INDEPENDENT_RETEST_REQUIRED')
        if not history[-1]['fixers'] or any(who['actor_id'] == fixer['actor_id'] or who['context'] == fixer['context'] for fixer in history[-1]['fixers']):
            _fail('INDEPENDENT_RETEST_REQUIRED')
        result = _gate(gate_data)
        self._owner.record_defect_retest(target_hash=self._subject['target_hash'], defect_id=defect_id,
            gate_result=result, tester_id=who['actor_id'], independent=True)
        self._independent_retests[defect_id] = dict(fixers_hash=foundation.canonical_hash(history[-1]['fixers']),
            actor_id=who['actor_id'], actor_hash=actor.content_hash, gate_hash=result.evidence_id)

    @_locked
    def defect_history(self, defect_id):
        if not _text(defect_id):
            _fail('DEFECT_CONTRACT_INVALID')
        return _plain(self._defects.get(defect_id, []))


__all__ = ['ReleaseGateService', 'ReleaseContractError', 'ReleaseEvidenceRef',
           'TransportEvidenceManifest', 'FoundationEvidenceManifest']
