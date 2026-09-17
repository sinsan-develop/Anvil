"""E10 fake-driver/host contract only: never invoke Git or remote mutation."""
import importlib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import pytest
from packages.orchestration.result_envelope import canonical_hash

A, B, C = 'a'*40, 'b'*40, 'c'*40
H, J = 'sha256:'+'a'*64, 'sha256:'+'b'*64
NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)
AT, UNTIL = NOW.isoformat(), (NOW+timedelta(hours=1)).isoformat()


def snapshot():
    return dict(repository_id='repo', workspace_id='workspace', physical_identity=H,
        head=A, branch='codex/work', refs={'main': A, 'codex/work': A, 'codex/source': B},
        tracked={'user.txt': J}, untracked={'notes.txt': J}, index={}, owned_changes={},
        user_paths=['user.txt', 'notes.txt'], protected_paths=['.git', 'secrets'],
        protected_branches=['main'], remote_id='development', revision=1,
        execution_fence='exec-1', write_fence='write-1', merge_conflicts=[], related_history=True)


def request(operation='BRANCH', **changes):
    value = dict(request_id='request', operation=operation, repository_id='repo', workspace_id='workspace',
        baseline=A, source_ref='codex/work', source_commit=A, target_ref='codex/new', target_commit=A,
        target_hash=H, delivered_hash=H, allowed_paths=['src/a.py'], changes={}, diff_hash=canonical_hash({}),
        expected_commit=A, expected_tree=C, message='approved change', remote_id='development',
        metadata=dict(purpose='fix', impact='internal', validation='tested', unverified='actual Git', rollback='previous commit'))
    if operation == 'COMMIT':
        value.update(target_ref='codex/work', changes={'src/a.py': H}, diff_hash=canonical_hash({'src/a.py': H}), expected_commit=B)
    if operation in ('MERGE', 'PR'):
        value.update(source_ref='codex/source', source_commit=B, target_ref='codex/work', expected_commit=C)
    value.update(changes)
    return value


def setup_host(operation='BRANCH'):
    module = importlib.import_module('packages.git_adapter')
    driver = module.FakeGitDriver()
    host = module.GitAdapterHost(driver)
    state = snapshot()
    if operation == 'COMMIT':
        state['tracked']['src/a.py'] = H
        state['index'] = {'src/a.py': H}; state['owned_changes'] = {'src/a.py': H}
    host.register_repository(state)
    return host, driver


def authorize(host, data, grant_id='grant', **kwargs):
    return host.authorize(grant_id, data, actor_id='host-user', authenticated=True,
        issued_at=AT, expires_at=UNTIL, **kwargs)


def execute(host, grant, data):
    return host.execute(grant, data, at=AT, execution_fence='exec-1', write_fence='write-1')


def test_branch_preserves_every_user_dirty_untracked_index_and_existing_ref():
    host, driver = setup_host(); data = request(); before = host.repository('repo')
    receipt = execute(host, authorize(host, data), data)
    assert receipt['accepted'] and receipt['external_side_effects'] == 0
    after = host.repository('repo')
    for key in ('tracked', 'untracked', 'index', 'head', 'branch'):
        assert after[key] == before[key]
    assert after['refs'] == {'main': A, 'codex/work': A, 'codex/source': B, 'codex/new': A}
    assert len(driver.calls) == 1 and receipt['mode'] == 'FAKE_DRIVER_CONTRACT'


def test_commit_exact_parent_tree_paths_hash_and_preservation():
    host, driver = setup_host('COMMIT'); data = request('COMMIT')
    receipt = execute(host, authorize(host, data), data)
    assert receipt['accepted'] and receipt['result']['parent'] == A
    assert receipt['result']['commit'] == B and receipt['result']['tree'] == C
    assert receipt['result']['changed_paths'] == ['src/a.py']
    assert host.repository('repo')['tracked'] == {'user.txt': J}
    assert host.repository('repo')['untracked'] == {'notes.txt': J}


@pytest.mark.parametrize('operation', ['RESET', 'CLEAN', 'PUSH', 'DELETE', 'REBASE', 'FORCE_PUSH'])
def test_forbidden_operation_audit_and_zero_driver(operation):
    host, driver = setup_host(); data = request(operation)
    with pytest.raises(ValueError, match='FORBIDDEN_OPERATION'): authorize(host, data)
    assert driver.calls == [] and host.audit()[-1]['code'] == 'FORBIDDEN_OPERATION'
    assert host.audit()[-1]['external_side_effects'] == 0


def test_exact_replay_and_different_payload_conflict():
    host, driver = setup_host(); data = request(); grant = authorize(host, data)
    first = execute(host, grant, data)
    assert execute(host, grant, data) == first and len(driver.calls) == 1
    data['target_ref'] = 'codex/other'
    with pytest.raises(ValueError, match='REQUEST_BINDING_MISMATCH'): execute(host, grant, data)


@pytest.mark.parametrize('path', ['user.txt', 'USER.TXT', 'notes.txt', 'secrets/password.txt'])
def test_user_overlap_and_protected_paths_block_without_driver(path):
    host, driver = setup_host(); data = request(allowed_paths=[path])
    with pytest.raises(ValueError, match='USER_CHANGE_CONFLICT|PROTECTED_PATH'): authorize(host, data)
    assert not driver.calls


def release_host(operation):
    from pathlib import Path
    spec = importlib.util.spec_from_file_location('e09_contract_fixture', Path(__file__).parents[1]/'verification/test_gates_e09.py')
    fixture = importlib.util.module_from_spec(spec); spec.loader.exec_module(fixture)
    release, _, bundle, _, human, decision = fixture.release_fixture()
    approval = release.approve_action('git', bundle, decision, human, operation='APPLY', at=AT,
        expires_at=(NOW+timedelta(minutes=30)).isoformat())
    module = importlib.import_module('packages.git_adapter'); driver = module.FakeGitDriver()
    host = module.GitAdapterHost(driver, release_service=release)
    state = snapshot(); state.update(head=B, refs={'main': B, 'codex/work': B, 'codex/source': A}, tracked={}, untracked={}, user_paths=[])
    host.register_repository(state)
    data = request(operation, baseline=B, source_commit=A, target_commit=B)
    return host, driver, data, release, bundle, approval


@pytest.mark.parametrize('operation', ['MERGE', 'PR'])
def test_merge_pr_consume_real_e09_owner_admission_and_exact_source_subject(operation):
    host, driver, data, release, bundle, approval = release_host(operation)
    grant = authorize(host, data, release_bundle=bundle, release_approval=approval)
    receipt = execute(host, grant, data)
    assert receipt['accepted'] and receipt['external_side_effects'] == 0
    assert receipt['result']['source_commit'] == A
    assert receipt['result']['target_commit'] == B
    assert receipt['result']['artifact_hash'] == H
    assert receipt['release_admission']['bundle_hash'] == bundle.content_hash
    assert len(driver.calls) == 1


@pytest.mark.parametrize('operation', ['MERGE', 'PR'])
def test_merge_pr_cannot_self_mint_release_or_reuse_wrong_subject(operation):
    host, driver, data, release, bundle, approval = release_host(operation)
    with pytest.raises(ValueError): authorize(host, data, release_bundle={'accepted': True}, release_approval=approval)
    data['target_hash'] = data['delivered_hash'] = J
    with pytest.raises(ValueError, match='RELEASE_SUBJECT_MISMATCH'):
        authorize(host, data, release_bundle=bundle, release_approval=approval)
    assert driver.calls == []


@pytest.mark.parametrize('mutation', ['parent', 'commit', 'tree', 'artifact_hash', 'argv', 'after', 'exit_code'])
def test_driver_swap_denied_preserving_before_and_no_receipt(mutation):
    host, driver = setup_host('COMMIT'); data = request('COMMIT'); grant = authorize(host, data)
    before = host.repository('repo'); normal = driver.prepare
    def changed(plan):
        value = normal(plan)
        if mutation == 'argv': value['argv'] = ['reset', '--hard']
        elif mutation == 'after': value['after']['untracked'] = {}
        elif mutation == 'exit_code': value['exit_code'] = 1
        else: value[mutation] = J
        return value
    driver.prepare = changed
    with pytest.raises(ValueError, match='DRIVER_EVIDENCE_MISMATCH'): execute(host, grant, data)
    assert host.repository('repo') == before and host._receipts == {}


def test_callback_revocation_after_prepare_prevents_publication():
    host, driver = setup_host(); data = request(); grant = authorize(host, data)
    before = host.repository('repo'); normal = driver.prepare
    def revoke(plan):
        result = normal(plan); host.revoke(grant); return result
    driver.prepare = revoke
    with pytest.raises(ValueError, match='GRANT_REVOKED'): execute(host, grant, data)
    assert host.repository('repo') == before and host._receipts == {}


@pytest.mark.parametrize('argv', [['push', '--force'], ['push', '--force-with-lease'], ['reset', '--hard'],
    ['clean', '-fd'], ['branch', '-D', 'main'], ['tag', '-d', 'v1'], ['rebase', 'main'],
    ['filter-repo'], ['reflog', 'expire', '--all'], ['gc', '--prune=now'], ['checkout', '--', '.'],
    ['restore', '.'], ['commit', '-a'], ['add', '-A'], ['merge', '--allow-unrelated-histories'], ['update-ref', '-d', 'HEAD']])
def test_arbitrary_destructive_or_broad_argv_cannot_reach_driver(argv):
    host, driver = setup_host(); data = request(); data['argv'] = argv
    with pytest.raises(ValueError, match='FORBIDDEN_COMMAND'): authorize(host, data)
    assert not driver.calls and host.audit()[-1]['external_side_effects'] == 0


@pytest.mark.parametrize('path', ['../a', '/root/a', 'C:/a', r'\\server\a', r'src\a.py', 'src/../a',
    'src/A~1.py', 'src/%2e%2e/a', 'src/ａ.py', 'src/a.py.', 'src/CON.txt', 'src/a;rm', 'src/a\x00'])
def test_path_alias_escape_denied(path):
    host, driver = setup_host()
    with pytest.raises(ValueError): authorize(host, request(allowed_paths=[path]))
    assert not driver.calls


@pytest.mark.parametrize('ref', ['main', 'MAIN', 'codex/work', 'codex/WORK', 'HEAD', 'codex/../x', 'codex/ｘ',
    'codex/a.lock', 'codex/a;rm', 'codex/a@{1}', '--force', 'codex/a\n'])
def test_ref_alias_protected_existing_denied(ref):
    host, driver = setup_host()
    with pytest.raises(ValueError): authorize(host, request(target_ref=ref))
    assert not driver.calls


@pytest.mark.parametrize('field,value', [('baseline', B), ('source_commit', B), ('target_commit', B),
    ('expected_commit', B), ('workspace_id', 'other'), ('remote_id', 'other'), ('delivered_hash', J)])
def test_branch_subject_swaps_rejected_before_driver(field, value):
    host, driver = setup_host()
    with pytest.raises(ValueError): authorize(host, request(**{field: value}))
    assert not driver.calls


@pytest.mark.parametrize('mutation', ['extra-index', 'missing-index', 'partial-index', 'unreceipted', 'content-swap', 'out-of-scope', 'empty'])
def test_commit_rejects_index_smuggling_and_unreceipted_changes(mutation):
    host, driver = setup_host('COMMIT'); state = host.repository('repo'); state['revision'] += 1
    data = request('COMMIT')
    if mutation == 'extra-index': state['index']['user.txt'] = J
    if mutation == 'missing-index': state['index'] = {}
    if mutation == 'partial-index': state['index']['src/a.py'] = J
    if mutation == 'unreceipted': state['owned_changes'] = {}
    if mutation == 'content-swap': state['tracked']['src/a.py'] = J
    if mutation == 'out-of-scope': data['allowed_paths'] = ['src/b.py']
    if mutation == 'empty': data.update(changes={}, diff_hash=canonical_hash({}))
    host.register_repository(state); before = host.repository('repo')
    with pytest.raises(ValueError): authorize(host, data)
    assert not driver.calls and host.repository('repo') == before


def test_same_request_concurrency_dispatches_once_with_immutable_receipt():
    host, driver = setup_host(); data = request(); grant = authorize(host, data)
    def attempt(_):
        try: return execute(host, grant, data)
        except ValueError as error: return str(error)
    with ThreadPoolExecutor(max_workers=16) as pool: results = list(pool.map(attempt, range(100)))
    receipts = [r for r in results if type(r) is dict]
    assert receipts and all(r == receipts[0] for r in receipts) and len(driver.calls) == 1
    receipts[0]['result']['after']['untracked'].clear()
    assert host.repository('repo')['untracked'] == {'notes.txt': J}
    audit = host.audit(); audit.clear(); assert host.audit()


def test_swallowed_reentrant_dispatch_taints_outer_and_publishes_nothing():
    host, driver = setup_host(); data = request(); grant = authorize(host, data); before = host.repository('repo')
    normal = driver.prepare
    def reenter(plan):
        try: execute(host, grant, data)
        except ValueError: pass
        return normal(plan)
    driver.prepare = reenter
    with pytest.raises(ValueError, match='REENTRANT_DISPATCH'): execute(host, grant, data)
    assert host.repository('repo') == before and host._receipts == {}


def test_grant_alias_input_callbacks_and_no_arbitrary_driver():
    host, driver = setup_host(); data = request(); grant = authorize(host, data)
    forged = replace(grant)
    with pytest.raises(ValueError, match='HOST_GRANT_REQUIRED'): execute(host, forged, data)
    calls = []
    class Hostile:
        def __getattribute__(self, name): calls.append(name); raise AssertionError('callback')
    for field in ('message', 'metadata', 'source_commit', 'allowed_paths'):
        payload = dict(data); payload[field] = Hostile()
        with pytest.raises(ValueError, match='INVALID_BUILTIN_INPUT'): authorize(host, payload)
    with pytest.raises(ValueError): execute(host, Hostile(), data)
    assert calls == [] and not driver.calls


@pytest.mark.parametrize('field', ['execution_fence', 'write_fence'])
def test_stale_fence_is_denied_before_driver(field):
    host, driver = setup_host(); data = request(); grant = authorize(host, data)
    args = dict(at=AT, execution_fence='exec-1', write_fence='write-1'); args[field] = 'stale'
    with pytest.raises(ValueError, match='STALE_FENCING_TOKEN'): host.execute(grant, data, **args)
    assert not driver.calls


def test_merge_changed_paths_cannot_expand_approved_inventory():
    host, driver, data, _, bundle, approval = release_host('MERGE')
    data['changes'] = {'outside.txt': H}; data['diff_hash'] = canonical_hash(data['changes'])
    with pytest.raises(ValueError, match='PATH_SCOPE_DENIED'):
        authorize(host, data, release_bundle=bundle, release_approval=approval)
    assert not driver.calls


def test_audit_publication_failure_restores_simulated_state_and_receipt():
    host, driver = setup_host(); data = request(); grant = authorize(host, data); before = host.repository('repo')
    event = host._event
    def fail(code, **values):
        if code == 'SIMULATED_COMPLETED': raise RuntimeError('publication injection')
        return event(code, **values)
    host._event = fail
    with pytest.raises(ValueError, match='DRIVER_ERROR'): execute(host, grant, data)
    assert host.repository('repo') == before and host._receipts == {}


def test_completed_merge_replay_rechecks_current_release_authority():
    host, driver, data, release, bundle, approval = release_host('MERGE')
    grant = authorize(host, data, release_bundle=bundle, release_approval=approval)
    execute(host, grant, data)
    release.revoke_action_approval(approval)
    with pytest.raises(ValueError, match='RELEASE_AUTHORITY_INVALID'): execute(host, grant, data)
    assert len(driver.calls) == 1


def test_cross_repository_same_request_reentry_is_not_a_second_operation():
    host, driver = setup_host(); first = request(); grant = authorize(host, first)
    state = snapshot(); state.update(repository_id='other', workspace_id='other', physical_identity=J)
    host.register_repository(state)
    second = request(repository_id='other', workspace_id='other'); grant2 = authorize(host, second, 'grant2')
    normal = driver.prepare
    def reenter(plan):
        try: execute(host, grant2, second)
        except ValueError: pass
        return normal(plan)
    driver.prepare = reenter
    with pytest.raises(ValueError, match='REENTRANT_DISPATCH'): execute(host, grant, first)
    assert host._receipts == {} and host._inflight == {}
    assert host.repository('repo')['revision'] == host.repository('other')['revision'] == 1


@pytest.mark.parametrize('secret', ['api_key=FAKE_TEST_ONLY', 'ａｐｉ＿ｋｅｙ=FAKE_TEST_ONLY',
    'api\u200b_key=FAKE_TEST_ONLY', 'api%5Fkey%3DFAKE_TEST_ONLY'])
def test_sensitive_metadata_never_enters_grant_driver_or_audit(secret):
    host, driver = setup_host(); data = request(); data['metadata']['purpose'] = secret
    with pytest.raises(ValueError, match='SENSITIVE_INPUT'): authorize(host, data)
    assert driver.calls == [] and host._grants == {}
    assert 'FAKE_TEST_ONLY' not in repr(host.audit())


def test_authorization_publication_failure_has_no_partial_grant():
    host, _ = setup_host(); event = host._event
    def fail(code, **values):
        if code == 'AUTHORIZED': raise RuntimeError('injected')
        return event(code, **values)
    host._event = fail
    with pytest.raises(RuntimeError): authorize(host, request())
    assert host._grants == host._handles == host._release_bindings == {}


@pytest.mark.parametrize('field', sorted(request()))
def test_every_request_field_rejects_custom_callbacks_before_inspection(field):
    host, driver = setup_host(); calls = []
    class Hostile:
        def __deepcopy__(self, memo): calls.append('copy'); return 'valid'
        def __str__(self): calls.append('str'); return 'valid'
        def __hash__(self): calls.append('hash'); return 1
        def __eq__(self, other): calls.append('eq'); return True
    data = request(); data[field] = Hostile()
    with pytest.raises(ValueError, match='INVALID_BUILTIN_INPUT'): authorize(host, data)
    assert calls == driver.calls == []


def test_host_snapshot_request_and_returned_state_are_detached():
    from packages.git_adapter import GitAdapterHost, FakeGitDriver
    host = GitAdapterHost(FakeGitDriver()); state = snapshot(); host.register_repository(state)
    state['untracked'].clear(); assert host.repository('repo')['untracked'] == {'notes.txt': J}
    data = request(); grant = authorize(host, data); data['metadata']['purpose'] = 'changed'
    with pytest.raises(ValueError, match='REQUEST_BINDING_MISMATCH'): execute(host, grant, data)
    projection = host.repository('repo'); projection['refs'].clear()
    assert host.repository('repo')['refs']
    object.__setattr__(grant, 'content_hash', J)
    with pytest.raises(ValueError, match='HOST_GRANT_REQUIRED'): execute(host, grant, request())


def test_driver_exception_payload_is_never_audit_or_error_text():
    from packages.git_adapter import GitRejected
    host, driver = setup_host(); data = request(); grant = authorize(host, data)
    def fail(plan): raise GitRejected('api_key=FAKE_TEST_ONLY')
    driver.prepare = fail
    with pytest.raises(ValueError, match='^DRIVER_ERROR$'): execute(host, grant, data)
    assert 'FAKE_TEST_ONLY' not in repr(host.audit()) and host._receipts == {}


@pytest.mark.parametrize('field,value', [('head', B), ('execution_fence', 'exec-2'), ('write_fence', 'write-2')])
def test_callback_repository_drift_prevents_simulated_publication(field, value):
    host, driver = setup_host(); data = request(); grant = authorize(host, data); normal = driver.prepare
    def mutate(plan):
        result = normal(plan); state = host.repository('repo'); state[field] = value; state['revision'] += 1
        if field == 'head': state['refs'][state['branch']] = value
        host.register_repository(state); return result
    driver.prepare = mutate
    with pytest.raises(ValueError, match='REPOSITORY_STATE_DRIFT'): execute(host, grant, data)
    assert host._receipts == {} and 'codex/new' not in host.repository('repo')['refs']


@pytest.mark.parametrize('alias', ['refs/heads/main', 'refs/heads/codex/work', 'REFS/HEADS/codex/work'])
def test_r1_only_canonical_short_branch_refs_can_enter_snapshot(alias):
    host, driver = setup_host('COMMIT'); state = host.repository('repo'); state['revision'] += 1
    state['branch'] = alias; state['refs'][alias] = A
    with pytest.raises(ValueError, match='REF_ALIAS_DENIED'): host.register_repository(state)
    assert not driver.calls


def test_r1_conflicting_short_full_ref_identity_is_rejected():
    host, _ = setup_host(); state = host.repository('repo'); state['revision'] += 1
    state['refs']['refs/heads/codex/work'] = B
    with pytest.raises(ValueError, match='REF_ALIAS_DENIED'): host.register_repository(state)


@pytest.mark.parametrize('secret', ['Authorization: Bearer FAKE_TEST_ONLY', 'token=FAKE_TEST_ONLY',
    '-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----',
    'Ａｕｔｈｏｒｉｚａｔｉｏｎ： Ｂｅａｒｅｒ FAKE_TEST_ONLY',
    'to\u200bken=FAKE_TEST_ONLY', 'token%3DFAKE_TEST_ONLY',
    '%2D%2D%2D%2D%2DBEGIN%20OPENSSH%20PRIVATE%20KEY%2D%2D%2D%2D%2D'])
def test_r1_credentials_are_value_safe_input_denials(secret):
    host, driver = setup_host(); data = request(); data['metadata']['purpose'] = secret
    with pytest.raises(ValueError, match='^SENSITIVE_INPUT$'): authorize(host, data)
    assert driver.calls == [] and host._grants == {}
    assert secret not in repr(host.audit()) and 'FAKE_TEST_ONLY' not in repr(host.audit())


def test_r1_seventy_branches_audit_is_bounded_stable_pageable_and_detached():
    host, _ = setup_host()
    for i in range(70):
        data = request(request_id=f'branch-{i}', target_ref=f'codex/new-{i}')
        execute(host, authorize(host, data, f'grant-{i}'), data)
    latest = host.audit()
    assert latest[-1]['sequence'] == 140 and len(latest) <= 20
    snapshot_end = latest[-1]['sequence']; all_rows = []; cursor = 0
    while cursor < snapshot_end:
        page = host.audit(after_sequence=cursor, through_sequence=snapshot_end, limit=13)
        assert 1 <= len(page) <= 13
        all_rows.extend(page); cursor = page[-1]['sequence']
    assert [r['sequence'] for r in all_rows] == list(range(1, 141))
    for previous, current in zip(all_rows, all_rows[1:]):
        assert current['previous_hash'] == previous['event_hash']
    first = host.audit(after_sequence=0, through_sequence=140, limit=13)
    all_rows[0]['code'] = 'MUTATED'
    with pytest.raises(ValueError): authorize(host, request('RESET'))
    assert host.audit()[-1]['code'] == 'FORBIDDEN_OPERATION'
    assert host.audit(after_sequence=0, through_sequence=140, limit=13) == first


@pytest.mark.parametrize('operation', ['MERGE', 'PR'])
def test_r1_returned_release_admission_does_not_alias_canonical_grant(operation):
    host, _, data, _, bundle, approval = release_host(operation)
    grant = authorize(host, data, release_bundle=bundle, release_approval=approval)
    receipt = execute(host, grant, data); expected = importlib.import_module('copy').deepcopy(receipt)
    original_audit = host.audit()
    receipt['release_admission']['accepted'] = False
    receipt['release_admission']['bundle_hash'] = J
    assert execute(host, grant, data) == expected
    assert host.audit() == original_audit


@pytest.mark.parametrize('operation', ['COMMIT', 'MERGE'])
@pytest.mark.parametrize('field', ['baseline', 'source_commit', 'target_commit'])
def test_r1_new_commit_must_differ_from_every_parent_subject(operation, field):
    if operation == 'COMMIT':
        host, driver = setup_host(operation); data = request(operation); kwargs = {}
    else:
        host, driver, data, _, bundle, approval = release_host(operation)
        kwargs = dict(release_bundle=bundle, release_approval=approval)
    data['expected_commit'] = data[field]
    with pytest.raises(ValueError, match='IMPOSSIBLE_COMMIT_IDENTITY'): authorize(host, data, **kwargs)
    assert not driver.calls and host._grants == {}


@pytest.mark.parametrize('kwargs', [{'limit': 0}, {'limit': 101}, {'limit': True},
    {'after_sequence': -1}, {'after_sequence': True}, {'through_sequence': 2},
    {'after_sequence': 1, 'through_sequence': 0}])
def test_r1_audit_invalid_cursor_has_no_state_change(kwargs):
    host, _ = setup_host(); before = host.audit()
    with pytest.raises(ValueError, match='AUDIT_CURSOR_INVALID'): host.audit(**kwargs)
    assert host.audit() == before


def test_r1_audit_large_events_retain_byte_bound_and_all_sequences():
    import json
    host, _ = setup_host()
    for i in range(12):
        data = request(request_id=f'large-{i}', target_ref=f'codex/large-{i}')
        data['metadata'] = {k: ('bounded description '*350).strip() for k in data['metadata']}
        execute(host, authorize(host, data, f'large-grant-{i}'), data)
    cursor = 0; rows = []
    while cursor < 24:
        page = host.audit(after_sequence=cursor, through_sequence=24, limit=100)
        assert page and len(json.dumps(page, ensure_ascii=False).encode()) <= 262144
        rows += page; cursor = page[-1]['sequence']
    assert [r['sequence'] for r in rows] == list(range(1, 25))
    latest = host.audit()
    assert latest[-1]['sequence'] == 24
    assert len(json.dumps(latest, ensure_ascii=False).encode()) <= 262144


@pytest.mark.parametrize('secret', ['Authorization%3A%20Bearer%20FAKE_TEST_ONLY',
    '-----BEGIN EC PRIVATE KEY-----', '-----BEGIN ENCRYPTED PRIVATE KEY-----',
    '-----BEGIN OP\u200bENSSH PRIVATE KEY-----',
    '%EF%BD%94%EF%BD%8F%EF%BD%8B%EF%BD%85%EF%BD%8E=FAKE_TEST_ONLY'])
def test_r1_additional_credential_normalization_never_enters_audit(secret):
    host, driver = setup_host(); data = request(); data['message'] = secret
    with pytest.raises(ValueError, match='^SENSITIVE_INPUT$'): authorize(host, data)
    assert not driver.calls and 'FAKE_TEST_ONLY' not in repr(host.audit())


@pytest.mark.parametrize('header', [
    'Authorization: Basic RkFLRV9URVNUX09OTFk=',
    'Authorization%3A%20Basic%20RkFLRV9URVNUX09OTFk%3D',
    'Ａｕｔｈｏｒｉｚａｔｉｏｎ： Ｂａｓｉｃ RkFLRV9URVNUX09OTFk=',
    'Authori\u200bzation: Ba\u200bsic RkFLRV9URVNUX09OTFk=',
    'Authorization: Digest synthetic-only',
    'Authorization: Custom synthetic-only',
    'Authorization: Bearer synthetic-only',
    'Authorization:\tRkFLRV9URVNUX09OTFk=',
])
@pytest.mark.parametrize('field', ['message', 'purpose'])
def test_r2_nonempty_authorization_header_is_scheme_independent_denial(header, field):
    host, driver = setup_host(); data = request()
    if field == 'message': data['message'] = header
    else: data['metadata']['purpose'] = header
    with pytest.raises(ValueError, match='^SENSITIVE_INPUT$') as error: authorize(host, data)
    assert host._grants == {} and host._receipts == {} and driver.calls == []
    assert str(error.value) == 'SENSITIVE_INPUT'
    assert header not in repr(host.audit()) and 'RkFLRV9URVNUX09OTFk' not in repr(host.audit())
    assert 'synthetic-only' not in repr(host.audit())


@pytest.mark.parametrize('text', ['HTTP authorization documentation', 'Basic authorization is documented',
    'Review Authorization header handling', '인증 authorization 설명', 'Authorization:'])
def test_r2_plain_authorization_documentation_is_not_a_credential(text):
    host, driver = setup_host(); data = request(); data['metadata']['purpose'] = text
    grant = authorize(host, data)
    assert execute(host, grant, data)['accepted'] and len(driver.calls) == 1
