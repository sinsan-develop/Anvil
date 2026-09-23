"""Host-only in-memory Git adapter contract; no subprocess/filesystem/network.

FakeGitDriver prepares a simulated result, never performs an operation. Real
execution, physical identity capture, durable recovery and remote auth remain
owner integration work. Agent submissions cannot select argv, shell or driver.
"""
from threading import RLock, get_ident
import json
from packages.repository_intelligence.git_readonly import GitCommand
from packages.orchestration.result_envelope import canonical_hash
from packages.verification import ReleaseGateService, ReleaseEvidenceRef
from . import models as m


class FakeGitDriver:
    def __init__(self):
        self._calls = []
        self._lock = RLock()

    @property
    def calls(self):
        with self._lock: return m.plain(self._calls)

    def prepare(self, plan):
        data = m.plain(plan)
        with self._lock: self._calls.append(m.plain(data))
        return m.plain(data['expected_result'])


class GitAdapterHost:
    """Trusted host capability. authorize/register are not public agent APIs."""
    def __init__(self, driver, *, release_service=None):
        if type(driver) is not FakeGitDriver: m.reject('FAKE_DRIVER_REQUIRED')
        if release_service is not None and type(release_service) is not ReleaseGateService: m.reject('RELEASE_OWNER_REQUIRED')
        self._driver = driver
        self._release_service = release_service
        self._release_bindings = {}
        self._lock = RLock()
        self._repositories = {}
        self._grants = {}
        self._handles = {}
        self._receipts = {}
        self._inflight = {}
        self._request_inflight = {}
        self._tainted = set()
        self._audit = []
        self._revoked = set()

    def _event(self, code, **values):
        row = dict(sequence=len(self._audit)+1, code=code, external_side_effects=0,
            previous_hash=self._audit[-1]['event_hash'] if self._audit else None, **values)
        row['event_hash'] = canonical_hash(row)
        # One event must remain retrievable inside the same bounded page contract.
        page = m.plain([row])
        if len(json.dumps(page, ensure_ascii=False).encode('utf-8')) > 262144: m.reject('INPUT_BOUND_EXCEEDED')
        self._audit.append(page[0])

    def audit(self, *, after_sequence=None, through_sequence=None, limit=20):
        """Latest bounded suffix by default; ascending cursor pages otherwise.

        Pin through_sequence to the observed final sequence for a stable snapshot
        while new events append. No events are evicted from canonical history.
        """
        if type(limit) is not int or not 1 <= limit <= 100: m.reject('AUDIT_CURSOR_INVALID')
        for value in (after_sequence, through_sequence):
            if value is not None and (type(value) is not int or not 0 <= value <= 2**53): m.reject('AUDIT_CURSOR_INVALID')
        with self._lock:
            end = len(self._audit) if through_sequence is None else through_sequence
            if end > len(self._audit) or (after_sequence is not None and after_sequence > end): m.reject('AUDIT_CURSOR_INVALID')
            indices = range(end-1, -1, -1) if after_sequence is None else range(after_sequence, end)
            page = []
            for index in indices:
                candidate = page+[self._audit[index]]
                try:
                    detached = m.plain(candidate)
                except m.GitRejected as error:
                    if str(error) == 'INPUT_BOUND_EXCEEDED' and page: break
                    raise
                if len(json.dumps(detached, ensure_ascii=False).encode('utf-8')) > 262144: break
                page = detached
                if len(page) == limit: break
            return list(reversed(page)) if after_sequence is None else page

    def register_repository(self, value):
        data = m.snapshot(value)
        with self._lock:
            key = data['repository_id']; prior = self._repositories.get(key)
            if prior == data: return
            if prior and (data['revision'] != prior['revision']+1 or any(data[k] != prior[k] for k in ('workspace_id', 'physical_identity'))): m.reject('REPOSITORY_IDENTITY_DRIFT')
            if any(k != key and v['physical_identity'] == data['physical_identity'] for k, v in self._repositories.items()): m.reject('REPOSITORY_IDENTITY_CONFLICT')
            self._repositories[key] = data

    def repository(self, repository_id):
        if not m.identifier(repository_id): m.reject('REPOSITORY_UNKNOWN')
        with self._lock:
            if repository_id not in self._repositories: m.reject('REPOSITORY_UNKNOWN')
            return m.plain(self._repositories[repository_id])

    def _check(self, data, state):
        if data['workspace_id'] != state['workspace_id'] or data['baseline'] != state['head']: m.reject('BASELINE_MISMATCH')
        if data['remote_id'] != state['remote_id']: m.reject('REMOTE_MISMATCH')
        if state['refs'].get(data['source_ref']) != data['source_commit']: m.reject('SOURCE_REF_MISMATCH')
        if not set(data['changes']).issubset(data['allowed_paths']): m.reject('PATH_SCOPE_DENIED')
        for path in data['allowed_paths']:
            if any(m.overlaps(path, p) for p in state['protected_paths']): m.reject('PROTECTED_PATH')
            user = [*state['user_paths'], *(p for name in ('tracked', 'untracked', 'index') for p in state[name] if p not in state['owned_changes'])]
            if any(m.overlaps(path, p) for p in user): m.reject('USER_CHANGE_CONFLICT')
        op = data['operation']
        if op == 'BRANCH':
            if not data['target_ref'].startswith('codex/') or m.ref(data['target_ref']) in {m.ref(r) for r in [*state['refs'], *state['protected_branches']]}: m.reject('BRANCH_EXISTS_OR_PROTECTED')
            if (data['source_ref'] != state['branch'] or data['source_commit'] != data['baseline']
                    or data['target_commit'] != data['baseline'] or data['expected_commit'] != data['baseline'] or data['changes']): m.reject('BASELINE_MISMATCH')
        elif op == 'COMMIT':
            if data['source_ref'] != state['branch'] or data['target_ref'] != state['branch'] or data['target_commit'] != state['head']: m.reject('BRANCH_HEAD_MISMATCH')
            if m.ref(data['target_ref']) in {m.ref(r) for r in state['protected_branches']}: m.reject('PROTECTED_BRANCH')
            if (not data['changes'] or set(data['changes']) != set(data['allowed_paths']) or state['index'] != data['changes']
                    or any(state['owned_changes'].get(p) != h or state['tracked'].get(p, state['untracked'].get(p)) != h for p, h in data['changes'].items())): m.reject('INDEX_OR_PROVENANCE_MISMATCH')
        else:
            if state['refs'].get(data['target_ref']) != data['target_commit']: m.reject('TARGET_REF_MISMATCH')
            if data['source_ref'] == data['target_ref'] or data['source_commit'] == data['target_commit']: m.reject('EMPTY_INTEGRATION')
            if op == 'MERGE':
                if data['target_ref'] != state['branch'] or data['target_commit'] != state['head']: m.reject('BRANCH_HEAD_MISMATCH')
                if state['merge_conflicts']: m.reject('MERGE_CONFLICT')
                if state['related_history'] is not True: m.reject('UNRELATED_HISTORY_DENIED')
                if any(state[k] for k in ('tracked', 'untracked', 'index')): m.reject('USER_CHANGE_CONFLICT')

    def _release(self, data, bundle, approval, at):
        if self._release_service is None: m.reject('RELEASE_ADMISSION_REQUIRED')
        if type(bundle) is not ReleaseEvidenceRef or type(approval) is not ReleaseEvidenceRef: m.reject('RELEASE_AUTHORITY_INVALID')
        try:
            evidence = m.plain(self._release_service.project(bundle))
            subject = evidence['subject']
            if (subject['git_head'] != data['source_commit'] or subject['target_hash'] != data['target_hash']
                    or subject['delivered_artifact_hash'] != data['delivered_hash']): m.reject('RELEASE_SUBJECT_MISMATCH')
            receipt = m.plain(self._release_service.admit(bundle, approval, operation='APPLY', at=at))
        except m.GitRejected:
            raise
        except (ValueError, KeyError, TypeError):
            m.reject('RELEASE_AUTHORITY_INVALID')
        if receipt.get('accepted') is not True or receipt.get('target_hash') != data['target_hash'] or receipt.get('bundle_hash') != bundle.content_hash: m.reject('RELEASE_SUBJECT_MISMATCH')
        return receipt

    def authorize(self, grant_id, request, *, actor_id, authenticated, issued_at, expires_at, release_bundle=None, release_approval=None):
        try:
            data = m.request(request)
            info = m.plain(dict(grant_id=grant_id, actor_id=actor_id, authenticated=authenticated, issued_at=issued_at, expires_at=expires_at))
            if not m.identifier(grant_id) or not m.identifier(actor_id) or authenticated is not True: m.reject('HOST_AUTHENTICATION_REQUIRED')
            if m.utc(expires_at) <= m.utc(issued_at): m.reject('AUTHORITY_WINDOW_INVALID')
            admission = self._release(data, release_bundle, release_approval, issued_at) if data['operation'] in ('MERGE', 'PR') else None
            with self._lock:
                state = self.repository(data['repository_id']); self._check(data, state)
                record = dict(info, request=data, before=state, release_admission=admission)
                digest = canonical_hash(record)
                prior = self._grants.get(grant_id)
                if prior is not None:
                    if prior != record: m.reject('REPLAY_CONFLICT')
                    return self._handles[grant_id]
                handle = m.GitGrant(grant_id, digest)
                audit_count = len(self._audit)
                try:
                    self._event('AUTHORIZED', grant_id=grant_id, subject_hash=digest)
                except Exception:
                    del self._audit[audit_count:]
                    raise
                self._grants[grant_id] = record; self._handles[grant_id] = handle
                if admission is not None: self._release_bindings[grant_id] = (release_bundle, release_approval)
                return handle
        except m.GitRejected as error:
            with self._lock: self._event(str(error))
            raise

    def _grant(self, handle):
        if type(handle) is not m.GitGrant or not m.identifier(handle.grant_id) or not m.sha(handle.content_hash): m.reject('HOST_GRANT_REQUIRED')
        record = self._grants.get(handle.grant_id)
        if self._handles.get(handle.grant_id) is not handle or record is None or canonical_hash(record) != handle.content_hash: m.reject('HOST_GRANT_REQUIRED')
        if handle.grant_id in self._revoked: m.reject('GRANT_REVOKED')
        return record

    def revoke(self, handle):
        with self._lock:
            self._grant(handle); self._revoked.add(handle.grant_id)
            self._event('GRANT_REVOKED', grant_id=handle.grant_id)

    def _plan(self, record):
        data, before = record['request'], record['before']
        after = m.plain(before); op = data['operation']
        if op == 'BRANCH':
            argv = ('branch', '--', data['target_ref'], data['baseline'])
            after['refs'][data['target_ref']] = before['head']
        elif op == 'COMMIT':
            argv = ('commit', '--only', '-m', data['message'], '--', *sorted(data['changes']))
            after['head'] = data['expected_commit']; after['refs'][after['branch']] = after['head']
            for name in ('tracked', 'untracked', 'index', 'owned_changes'):
                for path in data['changes']: after[name].pop(path, None)
        elif op == 'MERGE':
            argv = ('merge', '--no-edit', '--no-ff', '--', data['source_commit'])
            after['head'] = data['expected_commit']; after['refs'][after['branch']] = after['head']
        else:
            # A PR descriptor, not a shell/CLI/network command. The host remote
            # adapter is deliberately absent in E10.
            argv = ('pr-descriptor', data['remote_id'], data['source_ref'], data['source_commit'], data['target_ref'], data['target_commit'])
        after['revision'] += 1
        command = GitCommand('e10.'+op.lower(), argv)
        result = dict(command_id=command.command_id, argv=list(command.arguments), exit_code=0,
            before_head=before['head'], before_status_hash=canonical_hash(before), after=after,
            parent=data['baseline'], commit=after['head'], tree=data['expected_tree'],
            changed_paths=sorted(data['changes']), artifact_hash=data['delivered_hash'])
        result.update(source_ref=data['source_ref'], source_commit=data['source_commit'], target_ref=data['target_ref'],
            target_commit=data['target_commit'], remote_id=data['remote_id'], metadata=data['metadata'])
        return dict(command_id=command.command_id, argv=list(command.arguments), subject_hash=canonical_hash(record), expected_result=result)

    def execute(self, grant, request, *, at, execution_fence, write_fence):
        key = None
        try:
            data = m.request(request)
            m.plain(dict(at=at, execution_fence=execution_fence, write_fence=write_fence))
            now = m.utc(at)
            with self._lock:
                initial = self._grant(grant)
                binding = self._release_bindings.get(grant.grant_id)
                expected_admission = m.plain(initial['release_admission'])
            # Even exact receipt replay must consume current release authority.
            # The release owner is never called while the Git owner lock is held.
            if binding is not None:
                if self._release(data, *binding, at) != expected_admission: m.reject('RELEASE_SUBJECT_MISMATCH')
            with self._lock:
                record = self._grant(grant)
                if data != record['request']: m.reject('REQUEST_BINDING_MISMATCH')
                if not m.utc(record['issued_at']) <= now < m.utc(record['expires_at']): m.reject('STALE_AUTHORITY')
                current = self._repositories[data['repository_id']]
                if (execution_fence, write_fence) != (current['execution_fence'], current['write_fence']): m.reject('STALE_FENCING_TOKEN')
                prior = self._receipts.get(data['request_id'])
                if prior:
                    if prior['subject_hash'] != grant.content_hash: m.reject('REPLAY_CONFLICT')
                    return m.plain(prior)
                if current != record['before']: m.reject('REPOSITORY_STATE_DRIFT')
                physical = current['physical_identity']
                collision = physical if physical in self._inflight else self._request_inflight.get(data['request_id'])
                if collision is not None:
                    if self._inflight.get(collision) == get_ident(): self._tainted.add(collision)
                    m.reject('OPERATION_IN_FLIGHT')
                key = physical
                plan = self._plan(record)
                self._inflight[key] = get_ident()
                self._request_inflight[data['request_id']] = key
            if record['release_admission'] is not None:
                if self._release(data, *self._release_bindings[grant.grant_id], at) != record['release_admission']: m.reject('RELEASE_SUBJECT_MISMATCH')
            # Host driver is invoked outside all owner locks. The only driver
            # accepted here is synthetic; preparing never mutates a Git repo.
            try:
                prepared = self._driver.prepare(m.plain(plan))
            except Exception:
                raise m.GitRejected('DRIVER_ERROR') from None
            result = m.plain(prepared)
            if record['release_admission'] is not None:
                if self._release(data, *self._release_bindings[grant.grant_id], at) != record['release_admission']: m.reject('RELEASE_SUBJECT_MISMATCH')
            with self._lock:
                record = self._grant(grant)
                if key in self._tainted: m.reject('REENTRANT_DISPATCH')
                if self._repositories[data['repository_id']] != record['before']: m.reject('REPOSITORY_STATE_DRIFT')
                if result != plan['expected_result']: m.reject('DRIVER_EVIDENCE_MISMATCH')
                receipt = dict(accepted=True, mode='FAKE_DRIVER_CONTRACT', external_side_effects=0,
                    request_id=data['request_id'], subject_hash=grant.content_hash, result=result, release_admission=record['release_admission'])
                stored = m.plain(receipt)
                returned = m.plain(receipt)
                after = m.plain(result['after'])
                audit_count = len(self._audit)
                try:
                    self._event('SIMULATED_COMPLETED', request_id=data['request_id'], result=result, subject_hash=grant.content_hash)
                except Exception:
                    del self._audit[audit_count:]
                    raise
                self._repositories[data['repository_id']] = after
                self._receipts[data['request_id']] = stored
                return returned
        except m.GitRejected as error:
            with self._lock: self._event(str(error))
            raise
        except Exception:
            with self._lock: self._event('DRIVER_ERROR')
            m.reject('DRIVER_ERROR')
        finally:
            if key is not None:
                with self._lock:
                    self._inflight.pop(key, None)
                    self._request_inflight.pop(data['request_id'], None)
                    self._tainted.discard(key)
