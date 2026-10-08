"""C30 evidence inventory is a local audit artifact, never a release grant."""
import hashlib
import json
import subprocess
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'docs/evidence/manifests/C-30_EVIDENCE_MANIFEST.json'
FROZEN_CHECKPOINT='abb736108e60a5bc3c93c3ca531f71d70a3c5ee2'
ACCEPTED_CHECKPOINT='ec9ee09daa6c8ecc042f8ace313e6bda5dd42f5e'
FINAL_CHECKPOINT='5e7407de43341401f412a9e41723a5faddf5d31a'


def checkpoint_bytes(path, checkpoint=FROZEN_CHECKPOINT):
    assert not path.startswith(('/', '\\')) and '..' not in Path(path).parts
    return subprocess.check_output(['git', 'show', f'{checkpoint}:{path}'], cwd=ROOT)


def handoff_summary(raw):
    text=raw.decode('utf-8')
    marker='```json anvil-recovery-summary\n'
    assert text.count(marker)==1
    return json.loads(text.split(marker, 1)[1].split('\n```', 1)[0])


def manifest():
    assert MANIFEST.is_file(), 'C30 evidence manifest missing: RED readiness inventory'
    return json.loads(MANIFEST.read_text(encoding='utf-8'))


def test_c30_inventory_separates_developer_evidence_from_acceptance():
    value=manifest()
    assert value['schema']=='c30-local-evidence/v1'
    assert value['work_package']=='C-30' and value['automatic_acceptance'] is False
    assert value['release_allowed'] is False and value['formal_failure_count']==0
    assert value['independent_review']=={'status':'NOT_EXECUTED','critical':None,'important':None}


@pytest.mark.parametrize('package',[f'C-{i}' for i in range(22,31)])
def test_each_successor_has_design_reserved_group_and_real_test_mapping(package):
    row=manifest()['matrix'][package]
    assert row['design'].startswith('51.')
    assert row['validation_group'] in {'ROLE-CONTRACT-RED/GREEN','TEAM-MOA-RED/GREEN','SNS-DAON-RED/GREEN','UI-TRACE-RED/GREEN','WSL-E2E-RED/GREEN'}
    assert row['formal_av_ids']==[]  # Existing overlay reserves groups; do not invent AV IDs.
    assert row['tests'] and all((ROOT/path).is_file() for path in row['tests'])


def test_frozen_sources_and_authority_docs_are_exact_checkpoint_bytes():
    value=manifest()
    assert MANIFEST.read_bytes()==checkpoint_bytes(MANIFEST.relative_to(ROOT).as_posix())
    assert len(value['source_sha256'])==30
    for path,expected in value['source_sha256'].items():
        assert not path.startswith(('/','\\')) and '..' not in Path(path).parts
        assert hashlib.sha256(checkpoint_bytes(path)).hexdigest().upper()==expected,path
    for path in ['Anvil_설계서_v2.md','Anvil_작업계획서_v1.md','Anvil_통합검증매트릭스_v1.md','Anvil_테스트계획서_v1.md','docs/work_orders/C-30_WORK_INSTRUCTION.md']:
        assert path in value['source_sha256']


def test_confirmation_binds_frozen_c28_not_a_rewritten_mockup():
    value=manifest();events=json.loads((ROOT/'docs/progress/progress-events.json').read_text(encoding='utf-8'))['events']
    confirmation=next(e for e in events if e['event_id']=='evt_c28_user_confirmation_recorded')
    assert confirmation['sequence']==1252
    assert confirmation['details']['confirmed_target_hash']==value['source_sha256']['apps/web/c28-agent-console-mockup.html']
    assert value['confirmation_event']==confirmation['event_id']


def test_frozen_c30_prefix_hash_and_current_nonaccepting_evidence_link():
    value=manifest();path=ROOT/'docs/progress/progress-events.json';raw=checkpoint_bytes('docs/progress/progress-events.json')
    history=value['historical_events']
    start=raw.index(b'  "events": [')+len(b'  "events": [')
    assert hashlib.sha256(raw[start:start+history['bytes']]).hexdigest().upper()==history['sha256']
    events=json.loads(raw)['events']
    event=next(e for e in events if e['event_id']=='evt_c30_local_evidence_manifest_created')
    assert event['event_type']=='EVIDENCE_MANIFEST_CREATED'
    assert event['actor_id']=='developer-primary-c30-r1'
    assert event['details']['manifest_sha256']==hashlib.sha256(MANIFEST.read_bytes()).hexdigest().upper()
    assert event['details']['accepted'] is False
    assert event['details']['wsl_formal']=='NOT_EXECUTED'
    assert event['sequence']>history['last_sequence']
    current_raw=path.read_bytes()
    current_events=json.loads(current_raw)['events']
    assert next(e for e in current_events if e['event_id']==event['event_id'])==event
    current_progress=json.loads((ROOT/'docs/progress/build-progress.json').read_bytes())
    assert current_progress['event_sequence']>event['sequence']
    assert current_progress['registry_refs']['progress_events']['sha256']==hashlib.sha256(current_raw).hexdigest().upper()


def test_progress_snapshot_and_handoff_reference_local_not_formal_evidence():
    progress=json.loads((ROOT/'docs/progress/build-progress.json').read_text(encoding='utf-8'))
    row=progress['c30_local_validation']
    # The Developer evidence stays non-accepting after Main accepts a successor.
    events=json.loads((ROOT/'docs/progress/progress-events.json').read_text(encoding='utf-8'))['events']
    original=next(e for e in events if e['event_id']=='evt_c30_local_evidence_manifest_created')
    assert original['details']['accepted'] is False
    assert original['details']['wsl_formal']=='NOT_EXECUTED'
    assert row['wsl_formal']=='NOT_EXECUTED'
    assert row['manifest_ref']=='docs/evidence/manifests/C-30_EVIDENCE_MANIFEST.json'
    assert row['manifest_sha256']==hashlib.sha256(MANIFEST.read_bytes()).hexdigest().upper()
    recorded=progress.pop('snapshot_hash')
    assert recorded==hashlib.sha256(json.dumps(progress,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest().upper()
    handoff_path='docs/progress/BUILD_HANDOFF.md'
    historical_handoff=checkpoint_bytes(handoff_path).decode('utf-8')
    assert 'C-30 local validation' in historical_handoff and 'NOT_EXECUTED/NOT_INTEGRATED' in historical_handoff

    # C30R4 acceptance remains a frozen successor after C30R5 final acceptance.
    accepted=handoff_summary(checkpoint_bytes(handoff_path, ACCEPTED_CHECKPOINT))
    accepted_progress=json.loads(checkpoint_bytes('docs/progress/build-progress.json', ACCEPTED_CHECKPOINT))
    projection_fields=('event_sequence', 'last_event_id', 'status', 'current_phase',
                       'current_work_package', 'next_work_package',
                       'next_successor_work_package', 'next_safe_action')
    for field in projection_fields:
        assert accepted[field]==accepted_progress[field], field
    assert accepted['event_sequence']==1345
    assert accepted['current_work_package']=='C-30R4' and accepted['status']=='ACCEPTED'
    assert accepted['next_work_package']=={'package_id':'C-30', 'status':'PENDING_FINAL_GATE'}
    assert accepted['c30r3_evidence_scope']=='C30R3_FIXTURE_AUTHENTICATED_DISPOSABLE_VALIDATION_ONLY'
    unverified={'PROVIDER', 'PRODUCTION_AUTH', 'PG18', 'ACTUAL_SERVER_GENERATED_400', 'ORACLE'}
    assert len(accepted['unverified'])==6
    assert set(accepted['unverified'])==unverified|{'LIVE_REMOTE'}

    final=handoff_summary(checkpoint_bytes(handoff_path, FINAL_CHECKPOINT))
    final_progress=json.loads(checkpoint_bytes('docs/progress/build-progress.json', FINAL_CHECKPOINT))
    for field in projection_fields:
        assert final[field]==final_progress[field], field
    assert final['event_sequence']==1359
    assert final['current_work_package']=='C-30' and final['status']=='ACCEPTED'
    assert final['next_work_package']=={'package_id':'C-30', 'status':'ACCEPTED'}
    assert final['next_successor_work_package'] is None
    assert final['c30_overall_status']=='ACCEPTED'
    # Main resolved LIVE_REMOTE by exact push/remote checks at the R5 start.
    assert len(final['unverified'])==5 and set(final['unverified'])==unverified

    handoff_raw=(ROOT/handoff_path).read_bytes()
    current=handoff_summary(handoff_raw)
    for field in ('event_sequence', 'last_event_id', 'status', 'current_work_package',
                  'active_agent', 'worker_lease', 'write_lease', 'next_safe_action'):
        assert current[field]==progress[field], field
    assert current['event_sequence']>final['event_sequence']
    assert current['current_work_package']=='F-20' and current['status']=='ACTIVE'
    final_evidence=final_progress['current_progress_evidence_ref']
    assert final_evidence['package_id']=='C-30'
    final_digest=json.loads(checkpoint_bytes(final_evidence['path'], FINAL_CHECKPOINT))
    for key,path in (('progress', 'docs/progress/build-progress.json'),
                     ('handoff', handoff_path)):
        historical_raw=checkpoint_bytes(path, FINAL_CHECKPOINT)
        assert final_digest[key]['file_sha256']==hashlib.sha256(historical_raw).hexdigest().upper()
        assert final_digest[key]['bytes']==len(historical_raw)
    evidence=progress['current_progress_evidence_ref']
    assert evidence['package_id']==current['current_work_package']
    digest=json.loads((ROOT/evidence['path']).read_bytes())
    assert digest['event_sequence']==current['event_sequence']
    for key,path,raw in (('progress', 'docs/progress/build-progress.json',
                         (ROOT/'docs/progress/build-progress.json').read_bytes()),
                        ('handoff', handoff_path, handoff_raw)):
        assert digest[key]['path']==path
        assert digest[key]['bytes']==len(raw)
        assert digest[key]['file_sha256']==hashlib.sha256(raw).hexdigest().upper()
    for key,field,value in (('progress','canonical_json_sha256',final_progress),
                            ('handoff','machine_summary_canonical_sha256',final)):
        canonical=json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
        assert final_digest[key][field]==hashlib.sha256(canonical).hexdigest().upper()
