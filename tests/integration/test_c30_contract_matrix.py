"""C30 evidence inventory is a local audit artifact, never a release grant."""
import hashlib
import json
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[2]
MANIFEST=ROOT/'docs/evidence/manifests/C-30_EVIDENCE_MANIFEST.json'


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


def test_frozen_sources_and_authority_docs_are_exact_current_bytes():
    value=manifest()
    for path,expected in value['source_sha256'].items():
        assert not path.startswith(('/','\\')) and '..' not in Path(path).parts
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest().upper()==expected,path
    for path in ['Anvil_설계서_v2.md','Anvil_작업계획서_v1.md','Anvil_통합검증매트릭스_v1.md','Anvil_테스트계획서_v1.md','docs/work_orders/C-30_WORK_INSTRUCTION.md']:
        assert path in value['source_sha256']


def test_confirmation_binds_frozen_c28_not_a_rewritten_mockup():
    value=manifest();events=json.loads((ROOT/'docs/progress/progress-events.json').read_text(encoding='utf-8'))['events']
    confirmation=next(e for e in events if e['event_id']=='evt_c28_user_confirmation_recorded')
    assert confirmation['sequence']==1252
    assert confirmation['details']['confirmed_target_hash']==value['source_sha256']['apps/web/c28-agent-console-mockup.html']
    assert value['confirmation_event']==confirmation['event_id']


def test_developer_evidence_event_is_not_acceptance_and_history_is_unchanged():
    value=manifest();path=ROOT/'docs/progress/progress-events.json';raw=path.read_bytes()
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
    handoff=(ROOT/'docs/progress/BUILD_HANDOFF.md').read_text(encoding='utf-8')
    assert 'C-30 local validation' in handoff and 'NOT_EXECUTED/NOT_INTEGRATED' in handoff
