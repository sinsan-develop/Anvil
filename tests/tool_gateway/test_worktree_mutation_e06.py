import importlib.util
from pathlib import Path
import pytest
from packages.tool_gateway.registry import ToolPermissionRegistry
from packages.leases.service import StaleFencingToken

def fixture(tmp_path):
    spec=importlib.util.spec_from_file_location('e06_real_fixture',Path(__file__).parents[1]/'agent_team/test_worktree_writes_e06.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module.setup(tmp_path)

@pytest.mark.parametrize('change',['lease','permission'])
def test_gateway_final_tool_fence_blocks_preflight_revocation(tmp_path,change):
    from packages.tool_gateway.gateway import WorktreeMutationGateway
    s,refs,g,clock,leases,*_=fixture(tmp_path);p=ToolPermissionRegistry();p.grant('session',('repo.write_file',))
    gateway=WorktreeMutationGateway(s,p)
    gateway.before_dispatch=lambda:leases.revoke_run('run0') if change=='lease' else p.revoke('session')
    with pytest.raises(Exception) as error:gateway.write(g[0],'a.txt',b'changed',request_id='tool')
    assert 'STALE_FENCING_TOKEN' in str(error.value) if change=='lease' else 'TOOL_PERMISSION_DENIED' in str(error.value)
    assert Path(refs[0].workspace_root,'a.txt').read_bytes()==b'alpha'
    assert gateway.audits[-1]['io_count']==0

def test_gateway_real_write_and_permission_required(tmp_path):
    from packages.tool_gateway.gateway import WorktreeMutationGateway
    s,refs,g,*_=fixture(tmp_path);p=ToolPermissionRegistry();gateway=WorktreeMutationGateway(s,p)
    with pytest.raises(Exception):gateway.write(g[0],'a.txt',b'changed',request_id='tool')
    p.grant('session',('repo.write_file',));r=gateway.write(g[0],'a.txt',b'changed',request_id='tool')
    assert r['io_count']==1 and Path(refs[0].workspace_root,'a.txt').read_bytes()==b'changed'

def test_gateway_secret_input_has_no_write(tmp_path):
    from packages.tool_gateway.gateway import WorktreeMutationGateway
    s,refs,g,*_=fixture(tmp_path);p=ToolPermissionRegistry();p.grant('session',('repo.write_file',));gateway=WorktreeMutationGateway(s,p)
    with pytest.raises(Exception,match='SECRET_INPUT_DENIED'):gateway.write(g[0],'a.txt',b'api_key=FAKE_TEST_ONLY',request_id='tool')
    assert Path(refs[0].workspace_root,'a.txt').read_bytes()==b'alpha'

def test_publication_failure_restores_file_and_audits_real_io(tmp_path,monkeypatch):
    import os
    from packages.tool_gateway.gateway import WorktreeMutationGateway
    s,refs,g,*_=fixture(tmp_path);p=ToolPermissionRegistry();p.grant('session',('repo.write_file',));gateway=WorktreeMutationGateway(s,p)
    original=os.write;calls=[]
    def broken(fd,data):
        calls.append(True)
        if len(calls)==2:raise OSError('synthetic publication fault')
        return original(fd,data[:2])
    monkeypatch.setattr(os,'write',broken)
    with pytest.raises(Exception):gateway.write(g[0],'a.txt',b'abcdef',request_id='tool')
    assert Path(refs[0].workspace_root,'a.txt').read_bytes()==b'alpha'
    assert not s._receipts and gateway.audits[-1]['io_count']==1 and gateway.audits[-1]['target_restored']
