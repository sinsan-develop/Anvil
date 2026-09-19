"""Read local manifests only. Never invoke WSL, SSH, Docker or a database."""
import json
from tests.integration.test_c30_contract_matrix import ROOT,manifest


def test_formal_preflight_cannot_promote_missing_environment_or_approval():
    row=manifest()['wsl_formal']
    assert row['status']=='NOT_EXECUTED' and row['integration']=='NOT_INTEGRATED'
    assert row['execution_authorized'] is False and row['approval_ref'] is None
    assert row['database_writes']==0 and row['container_mutations']==0 and row['external_calls']==0
    assert row['candidate_commit'] is None and row['candidate_image'] is None
    assert set(row['missing'])=={'EXECUTION_SAFETY_APPROVAL','CLEAN_CANDIDATE_COMMIT','C30_RELEASE_MANIFEST','LIVE_ENVIRONMENT_PREFLIGHT','FORMAL_DB_CONTAINER_ENTITY_E2E','INDEPENDENT_REVIEW'}


def test_historical_c01_approval_does_not_authorize_current_dirty_successor():
    old=json.loads((ROOT/'deploy/wsl/FormalSingleRuntimeManifest.json').read_text(encoding='utf-8'))
    value=manifest()
    assert old['source']['commit']!=value['base_head']
    assert value['wsl_formal']['historical_harness_reusable_without_revision'] is False
    script=(ROOT/'deploy/wsl/formal-single-runtime.sh').read_text(encoding='utf-8')
    assert 'docker build' in script and 'remove_runtime_for_exact_replacement' in script
    assert 'REPLACE-EXACT-ANVIL-WEB' in script
    assert value['wsl_formal']['preflight_mode']=='LOCAL_FILES_ONLY_NO_COMMAND_DISPATCH'


def test_prepared_commands_are_unexecuted_and_have_no_secret_or_auto_dispatch():
    rows=manifest()['wsl_formal']['planned_checks']
    assert {r['id'] for r in rows}=={'git','containers','database','entity','http','browser','rollback','cleanup'}
    for row in rows:
        assert row['status']=='NOT_EXECUTED' and row['automatic_dispatch'] is False
        assert row['requires_approval'] is True
        assert row['command_or_owner'] and row['required_evidence']
    text=json.dumps(rows).lower()
    assert 'password=' not in text and 'postgresql://' not in text and 'bearer ' not in text


def test_pg15_pg18_and_provider_boundaries_are_separate():
    value=manifest()
    assert value['wsl_formal']['pg15']=='NOT_EXECUTED'
    assert value['wsl_formal']['pg18_rc']=='NOT_EXECUTED'
    assert value['external']==dict(provider='NOT_EXECUTED',telegram='NOT_EXECUTED',kakao='OPEN_DECISION',oracle='OUT_OF_SCOPE',production='OUT_OF_SCOPE',browser='NOT_EXECUTED')
