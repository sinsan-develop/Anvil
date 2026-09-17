"""E09 host-capture contract fixtures; these are NOT real deployment evidence."""
import importlib
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import pytest
from packages.verification import gates as g

H = 'sha256:' + 'a'*64
OTHER = 'sha256:' + 'b'*64
NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)
SUBJECT = dict(target_hash=H, delivered_artifact_hash=H, git_head='a'*40,
    container_image_digest=H, db_migration_head='0014', config_revision_hash=H,
    policy_hash=H, provider_routing_snapshot_hash=H, environment_id='env_fixture',
    design_baseline_hash=H, work_plan_hash=H, work_instruction_hash=H)
SCOPES = ('impact', 'smoke', 'helper_consumers', 'shared_boundaries')


def real_meta(**values):
    return dict(acquisition_mode='real', available=True, environment_id='env_fixture', **values)


def service(impact=('API',)):
    module = importlib.import_module('packages.verification.release_gates')
    authority = g.GateEvidenceAuthority()
    return module.ReleaseGateService(evidence_authority=authority, subject=SUBJECT,
        required_criteria=('criterion',), impact=impact,
        regression_inventory={key: (key+'-case',) for key in SCOPES}), authority


def observation(code, **changes):
    payload = dict(subject=dict(SUBJECT), acquisition_mode='real', actor_id='tester',
                   started_at=NOW.isoformat(), finished_at=NOW.isoformat(), evidence_refs=['raw'],
                   available=True, observations={})
    if code == 'G4':
        payload['observations'] = {'adapters': {'API': real_meta(openapi_diff='raw', route_test='raw', exit_code=0)}}
    elif code == 'G5':
        payload['observations'] = real_meta(configuration='production', command=['build', '--production'],
            exit_code=0, artifact_hash=H, dependency_snapshot_hash=OTHER, artifact_ref='artifact', dependency_snapshot_ref='dependencies')
        payload['evidence_refs'] = ['raw', 'artifact', 'dependencies']
    elif code == 'G6':
        payload['observations'] = {'scenarios': [real_meta(id='flow', preconditions='signed in', action='POST /api/item',
            expected='saved', observed='saved', evidence=['raw'], verdict='PASS', ui=True,
            boundaries={key: real_meta(evidence_ref='raw') for key in ('click', 'network', 'store', 'response', 'final_ui')},
            request_url='/api/item')]}
    else:
        payload['observations'] = dict(executed={key: [key+'-case'] for key in SCOPES},
            results={key+'-case': 'PASS' for key in SCOPES}, full_suite=True, unverified=[])
    payload.update(changes)
    return payload


def test_g4_selects_impact_adapters_and_rejects_signature_only():
    host, _ = service()
    result = host.capture_gate('G4', observation('G4'))
    assert result.status is g.GateStatus.PASS
    assert result.details['selected_adapters'] == ('API',)
    bad = observation('G4'); bad['observations'] = {'signature_ast': 'same'}
    result = host.capture_gate('G4', bad)
    assert result.status is g.GateStatus.BLOCKED
    assert 'INTEGRATION_EVIDENCE_INCOMPLETE' in result.reason_codes


@pytest.mark.parametrize('mode', ['fixture', 'mock', 'static'])
def test_g4_nonreal_or_missing_environment_never_passes(mode):
    host, _ = service()
    assert host.capture_gate('G4', observation('G4', acquisition_mode=mode)).status is g.GateStatus.BLOCKED
    assert host.capture_gate('G4', observation('G4', available=False)).status is g.GateStatus.BLOCKED


def test_g5_requires_production_build_and_artifact_dependency_hashes():
    host, _ = service()
    assert host.capture_gate('G5', observation('G5')).status is g.GateStatus.PASS
    for name, value in [('configuration', 'development'), ('command', ['dev']), ('artifact_hash', None), ('dependency_snapshot_hash', None)]:
        payload = observation('G5'); payload['observations'][name] = value
        assert host.capture_gate('G5', payload).status is not g.GateStatus.PASS


def test_g6_six_fields_ui_boundaries_and_relative_url():
    host, _ = service()
    assert host.capture_gate('G6', observation('G6')).status is g.GateStatus.PASS
    for field in ('preconditions', 'action', 'expected', 'observed', 'evidence', 'verdict'):
        payload = observation('G6'); del payload['observations']['scenarios'][0][field]
        assert host.capture_gate('G6', payload).status is not g.GateStatus.PASS
    for boundary in ('click', 'network', 'store', 'response', 'final_ui'):
        payload = observation('G6'); del payload['observations']['scenarios'][0]['boundaries'][boundary]
        assert host.capture_gate('G6', payload).status is not g.GateStatus.PASS


@pytest.mark.parametrize('url', ['http://localhost:8000/api/item', '//other/api', r'/\other/api', '/api/\x00'])
def test_g6_ui_absolute_and_escape_network_denied(url):
    host, _ = service(); payload = observation('G6')
    payload['observations']['scenarios'][0]['request_url'] = url
    assert host.capture_gate('G6', payload).status is not g.GateStatus.PASS


@pytest.mark.parametrize('verdict', ['SKIPPED', 'BLOCKED', 'FAIL', 'ERROR'])
def test_g6_never_promotes_nonpass_and_skip_requires_reason(verdict):
    host, _ = service(); payload = observation('G6')
    payload['observations']['scenarios'][0]['verdict'] = verdict
    assert host.capture_gate('G6', payload).status is not g.GateStatus.PASS


def test_g7_four_scopes_and_unverified_are_derived_not_claimed():
    host, _ = service()
    assert host.capture_gate('G7', observation('G7')).status is g.GateStatus.PASS
    for key in SCOPES:
        payload = observation('G7'); payload['observations']['executed'][key] = []
        result = host.capture_gate('G7', payload)
        assert result.status is g.GateStatus.BLOCKED
        assert key+'-case' in result.details['unverified_scope']
    payload = observation('G7'); payload['observations']['full_suite'] = False
    result = host.capture_gate('G7', payload)
    assert result.status is g.GateStatus.BLOCKED and 'FULL_SUITE_NOT_EXECUTED' in result.details['unverified_scope']


def test_capture_callbacks_zero_alias_detached_and_subject_swap_denied():
    host, authority = service()
    class Hostile:
        def __deepcopy__(self, memo): raise AssertionError('callback executed')
        def __str__(self): raise AssertionError('callback executed')
        def __iter__(self): raise AssertionError('callback executed')
    for key in ('actor_id', 'subject', 'observations', 'evidence_refs'):
        payload = observation('G4'); payload[key] = Hostile()
        with pytest.raises(ValueError, match='INVALID_BUILTIN_INPUT'): host.capture_gate('G4', payload)
    payload = observation('G4'); result = host.capture_gate('G4', payload)
    payload['observations']['adapters']['API']['exit_code'] = 9
    assert result.status is g.GateStatus.PASS and authority.verify_gate(result)
    payload = observation('G4'); payload['subject']['config_revision_hash'] = OTHER
    with pytest.raises(ValueError, match='EVIDENCE_TARGET_MISMATCH'): host.capture_gate('G4', payload)


def full_fixture():
    host, authority = service()
    engine = g.GateEngine(evidence_authority=authority)
    baseline = {key: dict(status='PASS', evidence_ref='raw', value=value) for key, value in dict(
        repository_readable=True, branch_head=dict(branch='test', head='a'*40),
        dirty_manifest=dict(tracked=[], untracked=[]), runtime_versions=dict(python='3.13.0'),
        baseline_tests=dict(passed=1, failed=0, skipped=0), backend_health=True).items()}
    tool = g.StaticTool('lint', ('lint',), True, True, True, '1.0')
    review = g.DiffReviewService().review(changed_paths=('src/a.py',), allowed_paths=('src',),
        changes=(g.DiffFile('src/a.py', 'a=1', 'a=2'),),
        llm_findings=tuple(g.ReviewFinding(k, g.GateStatus.PASS, 'raw') for k in g.LLM_CHECKS))
    gates = (engine.baseline(target_hash=H, observations=baseline),
        engine.static(target_hash=H, tools=(tool,), runner=lambda t: g.CommandEvidence(t.name, t.command, t.version, 0, 'raw')),
        engine.change_review(target_hash=H, review=review), retest_gate(engine, 'criterion'))
    base = engine.issue_manifest(g.EvidenceManifest(H, H, H, 'env_fixture', ('raw',), gates,
        H, H, H, 'a'*40, 'real'))
    foundation = base.to_dict(); foundation['seal_id'] = base.seal_id
    gate_ids = [host.capture_gate(code, observation(code)).evidence_id for code in ('G4', 'G5', 'G6', 'G7')]
    transport = dict(SUBJECT, manifest_id='manifest', manifest_path='manifest.json',
        git_status_before_ref='raw', git_status_after_ref='raw', toolchain_versions={'python': '3.13.0', 'lint': '1.0'},
        commands=['build --production', 'lint'], started_at=NOW.isoformat(), finished_at=NOW.isoformat(),
        actor_id='tester', actor_role='TESTER', acquisition_mode='real',
        raw_artifact_checksums=[dict(path=path, bytes=10, sha256=digest, target_hash=H, environment_id='env_fixture')
            for path, digest in [('raw', H), ('artifact', H), ('dependencies', OTHER)]],
        skipped_or_blocked=[], unverified_scope=[])
    tester = host.register_actor('tester', role='TESTER', context='independent', issued_at=NOW.isoformat(),
                                 expires_at=(NOW+timedelta(hours=1)).isoformat())
    human = host.register_actor('human', role='HUMAN', context='host-session', issued_at=NOW.isoformat(),
                                expires_at=(NOW+timedelta(hours=1)).isoformat())
    return host, authority, foundation, transport, gate_ids, tester, human


def retest_gate(engine, requirement):
    return engine.tests(target_hash=H, evidence=(g.TestEvidence('flow-'+requirement, requirement, g.GateStatus.PASS, 'real',
        {key: dict(expected='ok', observed='ok', evidence_ref='raw') for key in ('input', 'store', 'response', 'ui')}),))


def bundle_fixture():
    host, authority, base, transport, ids, tester, human = full_fixture()
    bundle = host.capture_bundle('bundle', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    return host, authority, bundle, tester, human


def product_validation():
    return dict(criterion_id='criterion', subject=dict(SUBJECT), verdict='SUITABLE',
        acquisition_mode='real', procedure='create then reload', expected='saved', observed='saved',
        evidence_refs=['raw'], validated_at=NOW.isoformat())


def release_fixture():
    host, authority, bundle, tester, human = bundle_fixture()
    host.record_product_validation(bundle, tester, product_validation(), at=NOW.isoformat())
    decision = host.decide('decision', bundle, human, decision='RELEASE', at=NOW.isoformat(),
                           expires_at=(NOW+timedelta(minutes=30)).isoformat())
    return host, authority, bundle, tester, human, decision


def test_full_manifest_product_validation_then_human_release_and_separate_apply_deploy():
    host, authority, bundle, tester, human = bundle_fixture()
    assert host.project(bundle)['status'] == 'TECHNICAL_PASS_NOT_PRODUCT_ACCEPTANCE'
    with pytest.raises(ValueError, match='PRODUCT_VALIDATION_INCOMPLETE'):
        host.decide('early', bundle, human, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    host.record_product_validation(bundle, tester, product_validation(), at=NOW.isoformat())
    decision = host.decide('release', bundle, human, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    for operation in ('APPLY', 'DEPLOY'):
        approval = host.approve_action(operation, bundle, decision, human, operation=operation,
            at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=20)).isoformat())
        receipt = host.admit(bundle, approval, operation=operation, at=NOW.isoformat())
        assert receipt['accepted'] and receipt['side_effects'] == 0
        assert host.admit(bundle, approval, operation=operation, at=NOW.isoformat()) == receipt


@pytest.mark.parametrize('field', tuple(SUBJECT))
def test_full_manifest_every_subject_dimension_is_bound(field):
    host, _, base, transport, ids, _, _ = full_fixture()
    transport[field] = OTHER if field.endswith(('hash', 'digest')) else 'different'
    with pytest.raises(ValueError, match='EVIDENCE_TARGET_MISMATCH'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())


def test_missing_gate_forged_pass_raw_target_and_missing_mandatory_data_denied():
    host, _, base, transport, ids, _, _ = full_fixture()
    with pytest.raises(ValueError, match='ALL_GATES_REQUIRED'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids[:-1], at=NOW.isoformat())
    transport['raw_artifact_checksums'][0]['environment_id'] = 'foreign'
    with pytest.raises(ValueError, match='EVIDENCE_TARGET_MISMATCH'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())


def test_agent_cannot_release_payload_spoof_alias_or_cross_authority():
    host, _, bundle, tester, human, decision = release_fixture()
    with pytest.raises(ValueError, match='AUTHENTICATED_HUMAN_REQUIRED'):
        host.decide('agent', bundle, tester, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    projection = host.project(bundle); projection['transport']['config_revision_hash'] = OTHER
    assert host.project(bundle)['transport']['config_revision_hash'] == H
    forged = replace(human)
    with pytest.raises(ValueError, match='HOST_RECORD_REQUIRED'):
        host.decide('forged', bundle, forged, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())


@pytest.mark.parametrize('verdict', ['BLOCKED', 'UNSUITABLE', 'NEEDS_IMPROVEMENT'])
def test_unsuitable_product_blocks_technical_pass_release(verdict):
    host, _, bundle, tester, human = bundle_fixture()
    data = product_validation(); data['verdict'] = verdict
    host.record_product_validation(bundle, tester, data, at=NOW.isoformat())
    with pytest.raises(ValueError, match='PRODUCT_VALIDATION_FAILED'):
        host.decide('decision', bundle, human, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())


def defect(lifecycle='OPEN', **changes):
    data = dict(defect_id='defect', subject=dict(SUBJECT), severity='CRITICAL', blocking=True,
                lifecycle=lifecycle, evidence_refs=['raw'])
    data.update(changes)
    return data


def test_defect_omission_does_not_erase_and_independent_retest_required():
    host, authority, bundle, tester, human, decision = release_fixture()
    developer = host.register_actor('developer', role='DEVELOPER', context='implementation',
        issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    host.record_defect(bundle, developer, defect(), at=NOW.isoformat())
    host.record_product_validation(bundle, tester, product_validation(), at=NOW.isoformat())
    with pytest.raises(ValueError, match='BLOCKING_DEFECT'):
        host.decide('blocked', bundle, human, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    for state in ('ACCEPTED', 'FIXING', 'READY_FOR_RETEST'):
        host.record_defect(bundle, developer, defect(state), at=NOW.isoformat())
    with pytest.raises(ValueError, match='INDEPENDENT_RETEST_REQUIRED'):
        host.record_defect(bundle, developer, defect('CLOSED'), at=NOW.isoformat())
    gate = retest_gate(g.GateEngine(evidence_authority=authority), 'defect')
    with pytest.raises(ValueError, match='INDEPENDENT_RETEST_REQUIRED'):
        host.record_retest(bundle, developer, 'defect', gate.to_dict(), at=NOW.isoformat())
    host.record_retest(bundle, tester, 'defect', gate.to_dict(), at=NOW.isoformat())
    host.record_defect(bundle, tester, defect('CLOSED'), at=NOW.isoformat())
    release = host.decide('fixed', bundle, human, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    assert host.project(release)['decision'] == 'RELEASE'
    assert [d['lifecycle'] for d in host.defect_history('defect')] == ['OPEN', 'ACCEPTED', 'FIXING', 'READY_FOR_RETEST', 'CLOSED']


@pytest.mark.parametrize('severity,blocking', [('CRITICAL', False), ('MAJOR', True)])
def test_critical_or_blocking_major_denies_release_apply_deploy(severity, blocking):
    host, _, bundle, tester, human, decision = release_fixture()
    approvals = [host.approve_action(op, bundle, decision, human, operation=op, at=NOW.isoformat(),
                 expires_at=(NOW+timedelta(minutes=10)).isoformat()) for op in ('APPLY', 'DEPLOY')]
    host.record_defect(bundle, tester, defect(severity=severity, blocking=blocking), at=NOW.isoformat())
    for op, approval in zip(('APPLY', 'DEPLOY'), approvals):
        with pytest.raises(ValueError): host.admit(bundle, approval, operation=op, at=NOW.isoformat())


def test_defer_records_reason_risk_review_time_carryover_and_never_admits():
    host, _, bundle, _, human = bundle_fixture()
    with pytest.raises(ValueError, match='DEFERRAL_CONTRACT_REQUIRED'):
        host.decide('defer', bundle, human, decision='DEFER', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    decision = host.decide('defer', bundle, human, decision='DEFER', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat(),
        deferral=dict(reason='needs review', risk='remaining scenario', review_at=(NOW+timedelta(days=1)).isoformat(), carryover='next iteration'))
    assert host.project(decision)['deferral']['carryover'] == 'next iteration'
    with pytest.raises(ValueError, match='DECISION_NOT_RELEASE'):
        host.approve_action('a', bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())


def test_expiry_revocation_same_id_replay_conflict_and_no_implicit_action():
    host, _, bundle, tester, human, decision = release_fixture()
    approval = host.approve_action('a', bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    assert host._consumed == {}
    with pytest.raises(ValueError, match='APPROVAL_OPERATION_MISMATCH'):
        host.admit(bundle, approval, operation='DEPLOY', at=NOW.isoformat())
    with pytest.raises(ValueError, match='STALE_APPROVAL'):
        host.admit(bundle, approval, operation='APPLY', at=(NOW+timedelta(minutes=10)).isoformat())
    host.revoke_action_approval(approval)
    with pytest.raises(ValueError, match='STALE_APPROVAL'):
        host.admit(bundle, approval, operation='APPLY', at=NOW.isoformat())
    assert host._consumed == {}


def test_old_decision_replay_does_not_reactivate_after_human_reject():
    host, _, bundle, _, human, decision = release_fixture()
    host.decide('reject', bundle, human, decision='REJECT', at=(NOW+timedelta(seconds=1)).isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    host.decide('decision', bundle, human, decision='RELEASE', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=30)).isoformat())
    with pytest.raises(ValueError, match='STALE_APPROVAL'):
        host.approve_action('a', bundle, decision, human, operation='APPLY', at=(NOW+timedelta(seconds=2)).isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())


@pytest.mark.parametrize('name,fields', [('API', ('openapi_diff', 'route_test')),
    ('DB', ('migration_up', 'migration_down')), ('Browser', ('bff_route', 'network_url')),
    ('Module', ('caller_test', 'import_test')), ('External', ('approved_environment', 'real_response'))])
def test_all_five_g4_adapters_require_exact_real_integration_refs(name, fields):
    host, _ = service((name,)); payload = observation('G4')
    item = dict.fromkeys(fields, 'raw'); item.update(exit_code=0, acquisition_mode='real', available=True,
        environment_id='env_fixture', request_url='/api/item')
    payload['observations']['adapters'] = {name: item}
    assert host.capture_gate('G4', payload).status is g.GateStatus.PASS
    for field in fields:
        original = item.pop(field)
        assert host.capture_gate('G4', payload).status is not g.GateStatus.PASS
        item[field] = original
    item['acquisition_mode'] = 'mock'
    assert host.capture_gate('G4', payload).status is not g.GateStatus.PASS


@pytest.mark.parametrize('code', ['G4', 'G5', 'G6', 'G7'])
@pytest.mark.parametrize('mode', ['fixture', 'mock', 'static'])
def test_every_late_gate_refuses_nonreal_mode(code, mode):
    host, _ = service()
    assert host.capture_gate(code, observation(code, acquisition_mode=mode)).status is not g.GateStatus.PASS


@pytest.mark.parametrize('field', ['manifest_id', 'manifest_path', 'git_status_before_ref', 'git_status_after_ref',
    'toolchain_versions', 'commands', 'started_at', 'finished_at', 'actor_id', 'actor_role', 'raw_artifact_checksums'])
def test_transport_mandatory_field_missing_fails_closed_without_publication(field):
    host, _, base, transport, ids, _, _ = full_fixture(); del transport[field]
    with pytest.raises(ValueError):
        host.capture_bundle('missing', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    assert 'BUNDLE:missing' not in host._records


@pytest.mark.parametrize('change', ['toolchain', 'g0head', 'g1version', 'rawhash', 'rawtarget', 'rawref', 'manifesttime', 'fixture', 'unverified'])
def test_manifest_gate_and_transport_consistency(change):
    host, _, base, transport, ids, _, _ = full_fixture()
    if change == 'toolchain': transport['toolchain_versions']['python'] = '9.0'
    if change == 'g0head': base['gate_results'][0]['details']['observations']['branch_head']['value']['head'] = 'b'*40
    if change == 'g1version': transport['toolchain_versions']['lint'] = '9.0'
    if change == 'rawhash': transport['raw_artifact_checksums'][0]['sha256'] = 'not-a-hash'
    if change == 'rawtarget': transport['raw_artifact_checksums'][0]['target_hash'] = OTHER
    if change == 'rawref': transport['raw_artifact_checksums'][0]['path'] = 'unrelated'
    if change == 'manifesttime': transport['finished_at'] = (NOW+timedelta(seconds=1)).isoformat()
    if change == 'fixture': transport['acquisition_mode'] = 'fixture'
    if change == 'unverified': transport['unverified_scope'] = ['browser']
    with pytest.raises(ValueError):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    assert 'BUNDLE:bad' not in host._records


def test_hash_and_gate_status_tamper_cannot_publish():
    host, _, base, transport, ids, _, _ = full_fixture()
    host._gates[ids[0]]['status'] = 'FAIL'
    with pytest.raises(ValueError, match='GATE_EVIDENCE_INVALID'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())


def test_alias_force_mutation_cannot_change_canonical_or_foreign_authority():
    host, _, bundle, tester, human, decision = release_fixture()
    original = host.project(bundle)
    object.__setattr__(bundle, 'content_hash', OTHER)
    with pytest.raises(ValueError, match='HOST_RECORD_REQUIRED'): host.project(bundle)
    assert __import__('json').loads(host._records['BUNDLE:bundle']) == original
    foreign, _ = service()
    with pytest.raises(ValueError, match='HOST_RECORD_REQUIRED'): foreign.project(human)


def test_distinct_manifest_identity_has_distinct_hash_and_old_capture_replay_cannot_reactivate():
    host, _, base, transport, ids, _, _ = full_fixture()
    first = host.capture_bundle('first', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    second = host.capture_bundle('second', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    assert first.content_hash != second.content_hash
    with pytest.raises(ValueError, match='STALE_BUNDLE'):
        host.capture_bundle('first', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    assert host._current_bundle == second.content_hash


@pytest.mark.parametrize('field', ['procedure', 'expected', 'observed', 'evidence_refs', 'validated_at', 'criterion_id'])
def test_product_validation_all_fields_required(field):
    host, _, bundle, tester, _ = bundle_fixture(); data = product_validation(); del data[field]
    with pytest.raises(ValueError): host.record_product_validation(bundle, tester, data, at=NOW.isoformat())
    assert host._validation_data == {}


@pytest.mark.parametrize('field', ['target_hash', 'delivered_artifact_hash', 'environment_id'])
def test_product_validation_different_release_subject_exact_reason(field):
    host, _, bundle, tester, _ = bundle_fixture(); data = product_validation(); data['subject'][field] = OTHER
    with pytest.raises(ValueError, match='RELEASE_SUBJECT_HASH_MISMATCH'):
        host.record_product_validation(bundle, tester, data, at=NOW.isoformat())


def test_untrusted_container_and_datetime_callbacks_zero_all_public_boundaries():
    host, _, base, transport, ids, tester, human = full_fixture()
    calls = []
    class Hostile:
        def __deepcopy__(self, memo): calls.append('deepcopy'); return 'valid'
        def __iter__(self): calls.append('iter'); return iter(())
        def __str__(self): calls.append('str'); return 'valid'
        def __hash__(self): calls.append('hash'); return 1
    for field in ('actor_id', 'toolchain_versions', 'raw_artifact_checksums', 'commands', 'config_revision_hash'):
        data = dict(transport); data[field] = Hostile()
        with pytest.raises(ValueError, match='INVALID_BUILTIN_INPUT'):
            host.capture_bundle('hostile', foundation_data=base, transport=data, gate_ids=ids, at=NOW.isoformat())
    with pytest.raises(ValueError): host.register_actor(Hostile(), role='HUMAN', context='c', issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    with pytest.raises(ValueError): host.project(Hostile())
    assert calls == []


def test_developer_product_report_does_not_become_tester_validation():
    host, _, bundle, _, _ = bundle_fixture()
    actor = host.register_actor('dev', role='DEVELOPER', context='dev', issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    with pytest.raises(ValueError, match='INDEPENDENT_EVIDENCE_REQUIRED'):
        host.record_product_validation(bundle, actor, product_validation(), at=NOW.isoformat())


def test_invalid_duplicate_product_refs_never_partially_publish():
    host, _, bundle, tester, _ = bundle_fixture(); data = product_validation(); data['evidence_refs'] = ['raw', 'raw']
    with pytest.raises(ValueError): host.record_product_validation(bundle, tester, data, at=NOW.isoformat())
    assert host._validation_data == {} and host._state_version == 0


def test_public_aliases_do_not_replace_c14_manifest_owner():
    from packages.verification import FoundationEvidenceManifest, TransportEvidenceManifest, EvidenceManifest
    from packages.artifacts.evidence import EvidenceManifest as Transport
    assert EvidenceManifest is FoundationEvidenceManifest is g.EvidenceManifest
    assert TransportEvidenceManifest is Transport and Transport is not EvidenceManifest


def test_current_actor_revoked_blocks_previously_valid_approval_and_receipt_replay():
    host, _, bundle, _, human, decision = release_fixture()
    approval = host.approve_action('a', bundle, decision, human, operation='DEPLOY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    receipt = host.admit(bundle, approval, operation='DEPLOY', at=NOW.isoformat())
    receipt['target_hash'] = OTHER
    assert host.admit(bundle, approval, operation='DEPLOY', at=NOW.isoformat())['target_hash'] == H
    host.revoke_actor(human)
    with pytest.raises(ValueError): host.admit(bundle, approval, operation='DEPLOY', at=NOW.isoformat())


def test_new_approval_same_decision_operation_cannot_double_admit():
    host, _, bundle, _, human, decision = release_fixture()
    approvals = [host.approve_action(name, bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat()) for name in ('a', 'b')]
    assert host.admit(bundle, approvals[0], operation='APPLY', at=NOW.isoformat())['accepted']
    with pytest.raises(ValueError, match='REPLAY_CONFLICT'):
        host.admit(bundle, approvals[1], operation='APPLY', at=NOW.isoformat())


@pytest.mark.parametrize('code,field', [('G4', 'actor_id'), ('G5', 'finished_at'), ('G6', 'evidence_refs'), ('G7', 'observations')])
def test_gate_missing_mandatory_capture_never_passes(code, field):
    host, _ = service(); data = observation(code); del data[field]
    with pytest.raises(ValueError): host.capture_gate(code, data)


@pytest.mark.parametrize('case', ['unsafe-url', 'up-only', 'failed', 'missing', 'rollback'])
def test_g4_db_rollback_and_browser_modes_are_explicit(case):
    host, _ = service(('DB', 'Browser')); data = observation('G4')
    data['observations']['adapters'] = dict(DB=real_meta(migration_up='raw', migration_down='raw', exit_code=0),
        Browser=real_meta(bff_route='raw', network_url='raw', request_url='/api/items', exit_code=0))
    if case == 'unsafe-url': data['observations']['adapters']['Browser']['request_url'] = 'http://internal/items'
    if case == 'up-only': del data['observations']['adapters']['DB']['migration_down']
    if case == 'failed': data['observations']['adapters']['DB']['exit_code'] = 1
    if case == 'missing': del data['observations']['adapters']['DB']
    if case == 'rollback':
        del data['observations']['adapters']['DB']['migration_down']
        data['observations']['adapters']['DB'].update(rollback_approved=True, approved_rollback='raw')
    result = host.capture_gate('G4', data)
    assert (result.status is g.GateStatus.PASS) == (case == 'rollback')


@pytest.mark.parametrize('adapter,fields', [('API', ('openapi_diff', 'route_test')),
    ('DB', ('migration_up', 'migration_down')), ('Browser', ('bff_route', 'network_url')),
    ('Module', ('caller_test', 'import_test')), ('External', ('approved_environment', 'real_response'))])
@pytest.mark.parametrize('key,value', [('acquisition_mode', None), ('available', None), ('environment_id', None),
    ('acquisition_mode', 'mock'), ('available', False), ('environment_id', 'foreign')])
def test_r1_g4_every_adapter_requires_explicit_real_available_environment(adapter, fields, key, value):
    host, _ = service((adapter,)); data = observation('G4')
    item = real_meta(**dict.fromkeys(fields, 'raw'), exit_code=0, request_url='/api/items')
    if value is None: item.pop(key)
    else: item[key] = value
    data['observations']['adapters'] = {adapter: item}
    result = host.capture_gate('G4', data)
    assert result.status is g.GateStatus.BLOCKED


@pytest.mark.parametrize('code,level', [('G5', 'observation'), ('G6', 'scenario'), ('G6', 'click'),
    ('G6', 'network'), ('G6', 'store'), ('G6', 'response'), ('G6', 'final_ui')])
@pytest.mark.parametrize('key,value', [('acquisition_mode', None), ('available', None), ('environment_id', None),
    ('acquisition_mode', 'fixture'), ('available', False), ('environment_id', 'foreign')])
def test_r1_nested_real_cannot_override_absent_mock_or_unavailable(code, level, key, value):
    host, _ = service(); data = observation(code)
    item = data['observations'] if level == 'observation' else data['observations']['scenarios'][0]
    if level not in ('observation', 'scenario'): item = item['boundaries'][level]
    if value is None: item.pop(key)
    else: item[key] = value
    assert host.capture_gate(code, data).status is g.GateStatus.BLOCKED


def test_r1_g6_explicit_real_boundaries_positive():
    host, _ = service()
    assert host.capture_gate('G6', observation('G6')).status is g.GateStatus.PASS


@pytest.mark.parametrize('field,value', [('acquisition_mode', 'mock'), ('available', False), ('environment_id', 'foreign')])
def test_r1_g6_legacy_unqualified_refs_do_not_mask_nested_nonreal(field, value):
    host, _ = service(); data = observation('G6'); row = data['observations']['scenarios'][0]
    row['boundaries'] = dict.fromkeys(('click', 'network', 'store', 'response', 'final_ui'), 'raw')
    row[field] = value
    assert host.capture_gate('G6', data).status is g.GateStatus.BLOCKED


@pytest.mark.parametrize('field', ['artifact_ref', 'dependency_snapshot_ref'])
@pytest.mark.parametrize('value', [None, '', 'not-captured'])
def test_r1_g5_requires_each_artifact_reference(field, value):
    host, _ = service(); data = observation('G5')
    if value is None: data['observations'].pop(field)
    else: data['observations'][field] = value
    assert host.capture_gate('G5', data).status is g.GateStatus.BLOCKED


@pytest.mark.parametrize('path', ['artifact', 'dependencies'])
def test_r1_build_hash_must_match_exact_transport_path_checksum(path):
    host, _, base, transport, ids, _, _ = full_fixture()
    row = next(row for row in transport['raw_artifact_checksums'] if row['path'] == path)
    row['sha256'] = 'sha256:'+'c'*64
    with pytest.raises(ValueError, match='BUILD_ARTIFACT_CHECKSUM_MISMATCH'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())
    assert 'BUNDLE:bad' not in host._records


def test_r1_dependency_hash_cannot_be_substituted_by_another_raw_path():
    host, _, base, transport, ids, _, _ = full_fixture(); payload = observation('G5')
    payload['observations']['dependency_snapshot_ref'] = 'raw'
    ids[1] = host.capture_gate('G5', payload).evidence_id
    with pytest.raises(ValueError, match='BUILD_ARTIFACT_CHECKSUM_MISMATCH'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())


@pytest.mark.parametrize('operation', ['approve', 'admit'])
def test_r1_bundle_property_callbacks_zero(operation):
    host, _, bundle, _, human, decision = release_fixture(); calls = []
    approval = host.approve_action('a', bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    class HostileBundle:
        @property
        def content_hash(self): calls.append('content_hash'); return bundle.content_hash
    with pytest.raises(ValueError, match='HOST_RECORD_REQUIRED'):
        if operation == 'approve':
            host.approve_action('b', HostileBundle(), decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
        else:
            host.admit(HostileBundle(), approval, operation='APPLY', at=NOW.isoformat())
    assert calls == [] and host._consumed == {}


@pytest.mark.parametrize('reissue', ['exact', 'new-window', 'new-context'])
def test_r1_revoked_actor_identity_never_revives_old_approval(reissue):
    host, _, bundle, _, human, decision = release_fixture()
    approval = host.approve_action('a', bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    host.revoke_actor(human)
    issued = NOW+timedelta(seconds=1) if reissue == 'new-window' else NOW
    context = 'new-context' if reissue == 'new-context' else 'host-session'
    with pytest.raises(ValueError, match='ACTOR_IDENTITY_REVOKED'):
        host.register_actor('human', role='HUMAN', context=context, issued_at=issued.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    with pytest.raises(ValueError): host.admit(bundle, approval, operation='APPLY', at=NOW.isoformat())
    assert host._consumed == {}
    replacement = host.register_actor('human-new-identity', role='HUMAN', context='host-session',
        issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    assert host.project(replacement)['actor_id'] == 'human-new-identity'


@pytest.mark.parametrize('identity', ['same-actor', 'same-context'])
def test_r1_retester_must_be_independent_of_actual_fixer(identity):
    host, authority, bundle, tester, human = bundle_fixture()
    host.record_defect(bundle, human, defect(), at=NOW.isoformat())
    host.record_defect(bundle, human, defect('ACCEPTED'), at=NOW.isoformat())
    host.record_defect(bundle, tester, defect('FIXING'), at=NOW.isoformat())
    host.record_defect(bundle, tester, defect('READY_FOR_RETEST'), at=NOW.isoformat())
    retester = tester if identity == 'same-actor' else host.register_actor('tester-alias', role='TESTER', context='independent',
        issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    gate = retest_gate(g.GateEngine(evidence_authority=authority), 'defect')
    with pytest.raises(ValueError, match='INDEPENDENT_RETEST_REQUIRED'):
        host.record_retest(bundle, retester, 'defect', gate.to_dict(), at=NOW.isoformat())
    with pytest.raises(ValueError, match='INDEPENDENT_RETEST_REQUIRED'):
        host.record_defect(bundle, human, defect('CLOSED'), at=NOW.isoformat())
    independent = host.register_actor('tester-other', role='TESTER', context='another-context',
        issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    host.record_retest(bundle, independent, 'defect', gate.to_dict(), at=NOW.isoformat())
    host.record_defect(bundle, independent, defect('CLOSED'), at=NOW.isoformat())
    assert host.defect_history('defect')[-1]['fixers'] == [{'actor_id': 'tester', 'context': 'independent'}]


@pytest.mark.parametrize('boundary', ['project', 'revoke_actor', 'decide_bundle', 'decide_actor', 'approve_bundle',
    'approve_actor', 'approve_decision', 'admit_bundle', 'admit_approval', 'revoke_approval', 'product_bundle',
    'product_actor', 'defect_bundle', 'defect_actor', 'retest_bundle', 'retest_actor'])
def test_r1_every_public_handle_slot_rejects_properties_without_callbacks(boundary):
    host, _, bundle, tester, human, decision = release_fixture(); calls = []
    approval = host.approve_action('a', bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    class Hostile:
        def __getattribute__(self, name): calls.append(name); raise AssertionError('callback executed')
    bad = Hostile(); window = dict(at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    with pytest.raises(ValueError, match='HOST_RECORD_REQUIRED'):
        if boundary == 'project': host.project(bad)
        elif boundary == 'revoke_actor': host.revoke_actor(bad)
        elif boundary.startswith('decide_'):
            host.decide('d', bad if boundary.endswith('bundle') else bundle, bad if boundary.endswith('actor') else human, decision='RELEASE', **window)
        elif boundary.startswith('approve_'):
            host.approve_action('b', bad if boundary.endswith('bundle') else bundle,
                bad if boundary.endswith('decision') else decision, bad if boundary.endswith('actor') else human, operation='APPLY', **window)
        elif boundary.startswith('admit_'):
            host.admit(bad if boundary.endswith('bundle') else bundle, bad if boundary.endswith('approval') else approval, operation='APPLY', at=NOW.isoformat())
        elif boundary == 'revoke_approval': host.revoke_action_approval(bad)
        elif boundary.startswith('product_'):
            host.record_product_validation(bad if boundary.endswith('bundle') else bundle, bad if boundary.endswith('actor') else tester, product_validation(), at=NOW.isoformat())
        elif boundary.startswith('defect_'):
            host.record_defect(bad if boundary.endswith('bundle') else bundle, bad if boundary.endswith('actor') else tester, defect(), at=NOW.isoformat())
        else:
            host.record_retest(bad if boundary.endswith('bundle') else bundle, bad if boundary.endswith('actor') else tester, 'defect', {}, at=NOW.isoformat())
    assert calls == [] and host._consumed == {}


@pytest.mark.parametrize('fixer_role', ['HUMAN', 'DEVELOPER', 'TESTER'])
def test_r1_fixer_identity_and_context_survive_role_transition_and_payload_claims(fixer_role):
    host, authority, bundle, tester, human = bundle_fixture()
    fixer = host.register_actor('actual-fixer', role=fixer_role, context='fixer-workspace',
        issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    host.record_defect(bundle, human, defect(), at=NOW.isoformat())
    host.record_defect(bundle, human, defect('ACCEPTED'), at=NOW.isoformat())
    host.record_defect(bundle, fixer, defect('FIXING', fixers=[dict(actor_id='fake', context='fake')]), at=NOW.isoformat())
    host.record_defect(bundle, fixer, defect('READY_FOR_RETEST', fixers=[]), at=NOW.isoformat())
    projected = host.defect_history('defect'); projected[-1]['fixers'].clear()
    assert host.defect_history('defect')[-1]['fixers'] == [dict(actor_id='actual-fixer', context='fixer-workspace')]
    role_changed = host.register_actor('actual-fixer', role='TESTER', context='new-context',
        issued_at=(NOW+timedelta(seconds=1)).isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    gate = retest_gate(g.GateEngine(evidence_authority=authority), 'defect')
    with pytest.raises(ValueError, match='INDEPENDENT_RETEST_REQUIRED'):
        host.record_retest(bundle, role_changed, 'defect', gate.to_dict(), at=(NOW+timedelta(seconds=1)).isoformat())
    host.record_retest(bundle, tester, 'defect', gate.to_dict(), at=(NOW+timedelta(seconds=1)).isoformat())
    host.record_defect(bundle, tester, defect('CLOSED'), at=(NOW+timedelta(seconds=1)).isoformat())
    assert host.defect_history('defect')[-1]['lifecycle'] == 'CLOSED'


@pytest.mark.parametrize('field', ['target_hash', 'environment_id'])
def test_r1_build_checksum_path_keeps_target_and_environment_binding(field):
    host, _, base, transport, ids, _, _ = full_fixture()
    transport['raw_artifact_checksums'][2][field] = OTHER
    with pytest.raises(ValueError, match='EVIDENCE_TARGET_MISMATCH'):
        host.capture_bundle('bad', foundation_data=base, transport=transport, gate_ids=ids, at=NOW.isoformat())


def test_r1_actor_revoke_then_explicit_new_identity_requires_new_decision_and_approval():
    host, _, bundle, _, human, decision = release_fixture()
    host.revoke_actor(human)
    new_actor = host.register_actor('new-human', role='HUMAN', context='host-session', issued_at=NOW.isoformat(),
        expires_at=(NOW+timedelta(hours=1)).isoformat())
    with pytest.raises(ValueError, match='STALE_APPROVAL'):
        host.approve_action('a', bundle, decision, new_actor, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    now = (NOW+timedelta(seconds=1)).isoformat()
    new_decision = host.decide('new-decision', bundle, new_actor, decision='RELEASE', at=now, expires_at=(NOW+timedelta(minutes=20)).isoformat())
    approval = host.approve_action('new-a', bundle, new_decision, new_actor, operation='APPLY', at=now, expires_at=(NOW+timedelta(minutes=10)).isoformat())
    assert host.admit(bundle, approval, operation='APPLY', at=now)['side_effects'] == 0


@pytest.mark.parametrize('role,context', [('HUMAN', 'host-session'), ('TESTER', 'host-session'), ('HUMAN', 'new-context')])
def test_r2_superseded_actor_registration_cannot_restore_old_approval(role, context):
    host, _, bundle, _, human, decision = release_fixture()
    approval = host.approve_action('a', bundle, decision, human, operation='APPLY', at=NOW.isoformat(), expires_at=(NOW+timedelta(minutes=10)).isoformat())
    issued = (NOW+timedelta(seconds=1)).isoformat()
    current = host.register_actor('human', role=role, context=context, issued_at=issued, expires_at=(NOW+timedelta(hours=1)).isoformat())
    with pytest.raises(ValueError, match='STALE_APPROVAL'):
        host.admit(bundle, approval, operation='APPLY', at=issued)
    with pytest.raises(ValueError, match='ACTOR_GENERATION_STALE'):
        host.register_actor('human', role='HUMAN', context='host-session', issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    assert host._actors['human'] == current.content_hash
    with pytest.raises(ValueError, match='STALE_APPROVAL'):
        host.admit(bundle, approval, operation='APPLY', at=issued)
    assert host._consumed == {}


def test_r2_current_registration_retry_same_handle_and_state_no_new_publication():
    host, _, _, _, human = bundle_fixture()
    before = (dict(host._actors), dict(host._records), len(host._handles))
    replay = host.register_actor('human', role='HUMAN', context='host-session', issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    assert replay is human
    assert (host._actors, host._records, len(host._handles)) == before


def test_r2_never_registered_older_generation_is_rejected_before_publication():
    host, _, _, _, human = bundle_fixture(); before = dict(host._records)
    with pytest.raises(ValueError, match='ACTOR_GENERATION_STALE'):
        host.register_actor('human', role='HUMAN', context='older', issued_at=(NOW-timedelta(seconds=1)).isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    assert host._records == before and host._actors['human'] == human.content_hash


def test_r2_revoke_after_generation_change_still_tombstones_all_generations():
    host, _, _, _, human = bundle_fixture()
    current = host.register_actor('human', role='HUMAN', context='next', issued_at=(NOW+timedelta(seconds=1)).isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    host.revoke_actor(current)
    for offset, context in [(0, 'host-session'), (1, 'next'), (2, 'another')]:
        with pytest.raises(ValueError, match='ACTOR_IDENTITY_REVOKED'):
            host.register_actor('human', role='HUMAN', context=context, issued_at=(NOW+timedelta(seconds=offset)).isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    assert 'human' not in host._actors


@pytest.mark.parametrize('field,value', [('role', 'TESTER'), ('context', 'other'), ('expires_at', (NOW+timedelta(minutes=20)).isoformat())])
def test_r2_equal_issue_time_conflict_cannot_replace_generation(field, value):
    host, _, _, _, human = bundle_fixture()
    data = dict(role='HUMAN', context='host-session', issued_at=NOW.isoformat(), expires_at=(NOW+timedelta(hours=1)).isoformat())
    data[field] = value; before = dict(host._records)
    with pytest.raises(ValueError, match='ACTOR_GENERATION_STALE'): host.register_actor('human', **data)
    assert host._records == before and host._actors['human'] == human.content_hash


def test_r2_newer_active_generation_retry_and_new_decision_remain_valid():
    host, _, bundle, _, old_human, old_decision = release_fixture()
    now = (NOW+timedelta(seconds=1)).isoformat()
    data = dict(role='HUMAN', context='next-session', issued_at=now, expires_at=(NOW+timedelta(hours=1)).isoformat())
    current = host.register_actor('human', **data)
    assert host.register_actor('human', **data) is current
    new_decision = host.decide('new-decision', bundle, current, decision='RELEASE', at=now, expires_at=(NOW+timedelta(minutes=20)).isoformat())
    approval = host.approve_action('a', bundle, new_decision, current, operation='DEPLOY', at=now, expires_at=(NOW+timedelta(minutes=10)).isoformat())
    assert host.admit(bundle, approval, operation='DEPLOY', at=now)['accepted']
    with pytest.raises(ValueError, match='STALE_ACTOR'):
        host.decide('old', bundle, old_human, decision='RELEASE', at=now, expires_at=(NOW+timedelta(minutes=20)).isoformat())
