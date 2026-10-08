from datetime import datetime,timedelta,timezone
from pathlib import Path
import hashlib,json,os,subprocess
import pytest
from packages.execution_backends import GitWorktreeExecutionBackend,RepositoryIdentity,WorkspaceSpec
from packages.leases.service import LeaseService,LeaseError,StaleFencingToken

NOW=datetime(2026,9,17,6,tzinfo=timezone.utc)
TTL=timedelta(minutes=2)
def git(path,*args):
    return subprocess.run(['git','-C',str(path),*args],capture_output=True,check=True,text=True).stdout.strip()

def setup(tmp_path):
    from packages.agent_team.worktree_writes import WorktreeWriteService
    source=tmp_path/'source';source.mkdir();git(source,'init')
    git(source,'config','user.name','Anvil Test');git(source,'config','user.email','test@example.invalid');git(source,'config','core.autocrlf','false')
    (source/'a.txt').write_text('alpha');(source/'b.txt').write_text('beta')
    git(source,'add','.');git(source,'commit','-m','baseline');baseline=git(source,'rev-parse','HEAD')
    identity=RepositoryIdentity('repo',str(source),'INSENSITIVE','map1')
    raw=json.dumps({'schema_version':'1.0.0','manifest_type':'ANVIL_BASELINE_AUTHORITY','repository_id':'repo','approved_baseline':baseline},sort_keys=True,separators=(',',':')).encode()
    backend=GitWorktreeExecutionBackend(tmp_path/'managed',manifest_evidence={('repo',baseline):raw})
    refs=[backend.prepare_workspace(WorkspaceSpec(f'run{i}','session',f'ws{i}',identity,baseline,hashlib.sha256(raw).hexdigest(),(f'{letter}.txt',))) for i,letter in enumerate(('a','b'))]
    leases=LeaseService();workers=[leases.issue_worker(f'run{i}',f'worker{i}',NOW,TTL) for i in range(2)]
    clock=[NOW];service=WorktreeWriteService(backend,leases,clock=lambda:clock[0])
    grants=[service.acquire(ref.workspace_id,worker,baseline=baseline) for ref,worker in zip(refs,workers)]
    return service,refs,grants,clock,leases,source,baseline

def test_real_disjoint_write_commit_and_source_zero_mutation(tmp_path):
    s,refs,grants,clock,leases,source,base=setup(tmp_path)
    before={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    for i in range(2):
        path=f'{("a","b")[i]}.txt';receipt=s.write(grants[i],path,b'changed',request_id='write')
        assert s.write(grants[i],path,b'changed',request_id='write')==receipt
        commit=s.commit(grants[i],request_id='commit')
        assert commit['commit']!=base and git(Path(refs[i].workspace_root),'rev-parse','HEAD')==commit['commit']
        assert s.commit(grants[i],request_id='commit')==commit
    after={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    assert before==after and not (source/'.git'/'worktrees').exists()

@pytest.mark.parametrize('stage',['write','commit'])
def test_late_takeover_blocks_old_filesystem_and_commit(tmp_path,stage):
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    if stage=='commit':s.write(g[0],'a.txt',b'prepared',request_id='prepare')
    clock[0]=NOW+TTL+timedelta(seconds=1)
    leases.take_over_expired('run0','replacement',clock[0],TTL)
    with pytest.raises(StaleFencingToken):
        if stage=='write':s.write(g[0],'a.txt',b'late',request_id='late')
        else:s.commit(g[0],request_id='late')
    assert git(Path(refs[0].workspace_root),'rev-parse','HEAD')==base

@pytest.mark.parametrize('stage',['write','commit'])
def test_final_mutation_fence_rechecks_after_preflight_callback(tmp_path,stage):
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    if stage=='commit':s.write(g[0],'a.txt',b'prepared',request_id='prepare')
    def revoke():leases.revoke_run('run0')
    setattr(s,'before_'+stage,revoke)
    with pytest.raises(StaleFencingToken):
        if stage=='write':s.write(g[0],'a.txt',b'late',request_id='late')
        else:s.commit(g[0],request_id='late')
    assert git(Path(refs[0].workspace_root),'rev-parse','HEAD')==base
    if stage=='write':assert Path(refs[0].workspace_root,'a.txt').read_bytes()==b'alpha'

@pytest.mark.parametrize('mutation',['dirty','head','branch','source'])
def test_scope_and_baseline_drift_blocks_commit(tmp_path,mutation):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'prepared',request_id='prepare')
    if mutation=='dirty':(work/'b.txt').write_text('unauthorized')
    elif mutation=='head':git(work,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','foreign')
    elif mutation=='branch':git(work,'switch','-c','foreign')
    else:(source/'a.txt').write_text('source drift')
    observed=git(work,'rev-parse','HEAD')
    with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==observed

@pytest.mark.parametrize('path',['../outside','b.txt','.git/config','a.txt:ads','/tmp/escape'])
def test_out_of_scope_write_is_denied(tmp_path,path):
    s,refs,g,*_=setup(tmp_path)
    with pytest.raises(LeaseError):s.write(g[0],path,b'bad',request_id='bad')
    assert Path(refs[0].workspace_root,'a.txt').read_bytes()==b'alpha'

def test_filesystem_alias_swap_cannot_write_source_hardlink(tmp_path):
    import os
    s,refs,g,clock,leases,source,base=setup(tmp_path);target=Path(refs[0].workspace_root,'a.txt')
    def swap():target.unlink();os.link(source/'a.txt',target)
    s.before_write=swap
    with pytest.raises(Exception):s.write(g[0],'a.txt',b'bad',request_id='swap')
    assert (source/'a.txt').read_bytes()==b'alpha'

def test_commit_rechecks_late_dirty_paths(tmp_path):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'prepared',request_id='prepare')
    s.before_commit=lambda:(work/'b.txt').write_text('late intrusion')
    with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==base

def test_commit_tree_cannot_absorb_interleaved_foreign_index(tmp_path,monkeypatch):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._git;injected=[]
    def interleave(w,*args,**kwargs):
        result=original(w,*args,**kwargs)
        if args[0] in ('add','commit-tree') and not injected:
            (work/'b.txt').write_bytes(b'foreign');git(work,'add','b.txt');injected.append(True)
        return result
    monkeypatch.setattr(s,'_git',interleave)
    try:receipt=s.commit(g[0],request_id='commit')
    except LeaseError:assert git(work,'rev-parse','HEAD')==base
    else:
        actual=tuple(git(work,'diff-tree','--no-commit-id','--name-only','-r',receipt['commit']).splitlines())
        assert actual==receipt['changed_paths']==('a.txt',)
    assert injected and (source/'b.txt').read_bytes()==b'beta'

@pytest.mark.parametrize('staged',[False,True])
def test_commit_requires_service_write_provenance(tmp_path,staged):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    (work/'a.txt').write_bytes(b'foreign')
    if staged:git(work,'add','a.txt')
    before=git(work,'status','--porcelain')
    with pytest.raises(LeaseError,match='WRITE_PROVENANCE_REQUIRED'):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==base and git(work,'status','--porcelain')==before

def test_partial_write_exception_preserves_original(tmp_path,monkeypatch):
    import os
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root);original=os.write;calls=[]
    def broken(fd,data):
        if calls:raise OSError('synthetic write failure')
        calls.append(True);return original(fd,data[:2])
    monkeypatch.setattr(os,'write',broken)
    with pytest.raises(OSError):s.write(g[0],'a.txt',b'abcdef',request_id='write')
    assert (work/'a.txt').read_bytes()==b'alpha' and not s._receipts

def test_commit_failure_preserves_preoperation_index(tmp_path,monkeypatch):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._git
    index=Path(git(work,'rev-parse','--git-path','index'));before=index.read_bytes()
    def broken(w,*args,**kwargs):
        if args[0] in ('commit','commit-tree'):raise OSError('synthetic commit failure')
        return original(w,*args,**kwargs)
    monkeypatch.setattr(s,'_git',broken)
    with pytest.raises(OSError):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==base and index.read_bytes()==before

def test_post_cas_exception_restores_head_and_keeps_index(tmp_path,monkeypatch):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._publish_head
    index=Path(git(work,'rev-parse','--git-path','index'));before=index.read_bytes()
    def broken(*args,**kwargs):
        original(*args,**kwargs)
        raise OSError('synthetic post CAS fault')
    monkeypatch.setattr(s,'_publish_head',broken)
    with pytest.raises(OSError):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==base and index.read_bytes()==before
    assert (g[0].write.write_fencing_token,'commit') not in s._receipts

def test_facade_acquire_token_callback_runs_without_owner_lock(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    with ThreadPoolExecutor(max_workers=1) as pool:
        def token():
            assert len(pool.submit(leases.active_writes).result(timeout=2))==1
            return 'facade-outside-lock'
        leases._token_factory=token
        assert s.acquire(refs[0].workspace_id,worker,baseline=base)

@pytest.mark.parametrize('transition',['detached-symbolic','symbolic-detached','symbolic-other','same-object-other-target'])
def test_final_head_kind_and_exact_target_cannot_redirect_commit(tmp_path,monkeypatch,transition):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    git(work,'update-ref','refs/heads/owned',base);git(work,'update-ref','refs/heads/foreign',base)
    if transition!='detached-symbolic':
        git(work,'symbolic-ref','HEAD','refs/heads/owned')
        leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
        g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._git;injected=[]
    def redirect(w,*args,**kwargs):
        result=original(w,*args,**kwargs)
        if args[0]=='commit-tree' and not injected:
            if transition=='symbolic-detached':git(work,'update-ref','--no-deref','HEAD',base)
            else:git(work,'symbolic-ref','HEAD','refs/heads/foreign')
            injected.append(True)
        return result
    monkeypatch.setattr(s,'_git',redirect)
    with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    assert injected and git(work,'rev-parse','refs/heads/foreign')==base
    assert git(work,'rev-parse','refs/heads/owned')==base and git(work,'rev-parse','HEAD')==base
    assert (g[0].write.write_fencing_token,'commit') not in s._receipts

@pytest.mark.parametrize('variant',['loose','packed','nested'])
def test_indirect_referent_redirect_never_commits_foreign_branch(tmp_path,monkeypatch,variant):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    git(work,'update-ref','refs/heads/owned',base);git(work,'update-ref','refs/heads/foreign',base)
    terminal='refs/heads/owned'
    if variant=='nested':
        terminal='refs/heads/bridge';git(work,'update-ref',terminal,base)
        git(work,'symbolic-ref','refs/heads/owned',terminal)
    git(work,'symbolic-ref','HEAD','refs/heads/owned')
    if variant=='packed':git(work,'pack-refs','--all','--prune')
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write')
    index=Path(git(work,'rev-parse','--git-path','index')).read_bytes();original=s._git;injected=[]
    def redirect(w,*args,**kwargs):
        result=original(w,*args,**kwargs)
        if args[0]=='commit-tree' and not injected:
            git(work,'symbolic-ref',terminal,'refs/heads/foreign');injected.append(True)
        return result
    monkeypatch.setattr(s,'_git',redirect)
    with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    assert injected and git(work,'rev-parse','refs/heads/foreign')==base
    assert git(work,'rev-parse','HEAD')==base and git(source,'rev-parse','HEAD')==base
    assert (g[0].write.write_fencing_token,'commit') not in s._receipts
    assert Path(git(work,'rev-parse','--git-path','index')).read_bytes()==index
    assert not list(Path(refs[0].managed_store).rglob('*.lock'))

@pytest.mark.parametrize('packed',[False,True])
def test_nested_referent_commit_receipt_names_actual_final_target(tmp_path,packed):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    git(work,'update-ref','refs/heads/final',base)
    git(work,'symbolic-ref','refs/heads/owned','refs/heads/final')
    git(work,'symbolic-ref','HEAD','refs/heads/owned')
    if packed:git(work,'pack-refs','--all','--prune')
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write');receipt=s.commit(g[0],request_id='commit')
    assert receipt['head_target']=='refs/heads/owned' and receipt['final_target']=='refs/heads/final'
    assert git(work,'rev-parse','refs/heads/final')==receipt['commit']
    assert receipt['parent']==base and receipt['tree']==git(work,'rev-parse',receipt['commit']+'^{tree}')
    assert receipt['changed_paths']==('a.txt',)
    assert s.commit(g[0],request_id='commit')==receipt

def test_prepared_nested_chain_locks_every_symbolic_hop(tmp_path,monkeypatch):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    for ref in ('refs/heads/final','refs/heads/foreign'):git(work,'update-ref',ref,base)
    git(work,'symbolic-ref','refs/heads/owned','refs/heads/final');git(work,'symbolic-ref','HEAD','refs/heads/owned')
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._ref_reply;attempts=[]
    def attack(process,expected):
        original(process,expected)
        if expected==b'prepare':
            for ref in ('HEAD','refs/heads/owned','refs/heads/final'):
                result=subprocess.run(['git','-C',str(work),'symbolic-ref',ref,'refs/heads/foreign'],capture_output=True)
                attempts.append((ref,result.returncode))
    monkeypatch.setattr(s,'_ref_reply',attack)
    receipt=s.commit(g[0],request_id='commit')
    assert len(attempts)==3 and all(code!=0 for ref,code in attempts)
    assert git(work,'rev-parse','refs/heads/foreign')==base
    assert git(work,'rev-parse','HEAD')==receipt['commit']
    assert not list(Path(refs[0].managed_store).rglob('*.lock'))

def test_post_commit_retarget_keeps_receipt_for_bound_final_ref(tmp_path,monkeypatch):
    """Git's commit reply linearizes publication on the bound final ref."""
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    for ref in ('refs/heads/final','refs/heads/foreign'):git(work,'update-ref',ref,base)
    git(work,'symbolic-ref','refs/heads/owned','refs/heads/final');git(work,'symbolic-ref','HEAD','refs/heads/owned')
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._ref_reply;injected=[]
    def retarget_after_commit(process,expected):
        original(process,expected)
        if expected==b'commit' and not injected:
            git(work,'symbolic-ref','refs/heads/owned','refs/heads/foreign');injected.append(True)
    monkeypatch.setattr(s,'_ref_reply',retarget_after_commit)
    receipt=s.commit(g[0],request_id='commit')
    assert injected and receipt['final_target']=='refs/heads/final'
    assert git(work,'rev-parse','refs/heads/final')==receipt['commit']
    assert git(work,'rev-parse','refs/heads/foreign')==base and git(work,'rev-parse','HEAD')==base
    assert s.commit(g[0],request_id='commit')==receipt
    with pytest.raises(LeaseError):s.commit(g[0],request_id='new-request')
    assert git(source,'rev-parse','HEAD')==base and not list(Path(refs[0].managed_store).rglob('*.lock'))

def test_workspace_git_pointer_redirect_cannot_mutate_foreign_store(tmp_path):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    git(source,'checkout','--detach',base)
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write')
    source_before={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    pointer=work/'.git';original=pointer.read_text();foreign=(source/'.git').resolve()
    try:
        with pointer.open('r+',encoding='utf-8') as handle:
            handle.seek(0);handle.write(f'gitdir: {foreign}\n');handle.truncate()
        receipt=s.commit(g[0],request_id='commit')
    finally:
        with pointer.open('r+',encoding='utf-8') as handle:
            handle.seek(0);handle.write(original);handle.truncate()
    source_after={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    assert source_before==source_after
    assert git(work,'rev-parse','HEAD')==receipt['commit'] and receipt['parent']==base

def test_managed_object_directory_redirect_is_rejected_before_foreign_write(tmp_path):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'approved',request_id='write')
    store=Path(refs[0].managed_store);objects=store/'objects';saved=store/'objects-preserved'
    source_before={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    objects.rename(saved)
    try:
        if os.name=='nt':
            result=subprocess.run(['cmd.exe','/d','/c','mklink','/J',str(objects),str(source/'.git'/'objects')],capture_output=True)
            if result.returncode:pytest.skip('local junction creation unavailable')
        else:objects.symlink_to(source/'.git'/'objects',target_is_directory=True)
        with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    finally:
        if objects.exists() or objects.is_symlink():
            if objects.is_symlink():objects.unlink()
            else:os.rmdir(objects)
        saved.rename(objects)
    source_after={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    assert source_before==source_after and git(work,'rev-parse','HEAD')==base

def test_managed_object_fanout_redirect_is_rejected_before_foreign_write(tmp_path):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    oid=hashlib.sha1(b'blob 8\0approved').hexdigest();prefix=oid[:2]
    store=Path(refs[0].managed_store);fanout=store/'objects'/prefix;saved=store/'objects'/(prefix+'-preserved')
    foreign=source/'.git'/'objects'/prefix;foreign.mkdir(exist_ok=True)
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write')
    source_before={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    if fanout.exists():fanout.rename(saved)
    try:
        if os.name=='nt':
            result=subprocess.run(['cmd.exe','/d','/c','mklink','/J',str(fanout),str(foreign)],capture_output=True)
            if result.returncode:pytest.skip('local junction creation unavailable')
        else:fanout.symlink_to(foreign,target_is_directory=True)
        with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    finally:
        if fanout.exists() or fanout.is_symlink():
            if fanout.is_symlink():fanout.unlink()
            else:os.rmdir(fanout)
        if saved.exists():saved.rename(fanout)
    source_after={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    assert source_before==source_after and git(work,'rev-parse','HEAD')==base

def test_posix_object_fanout_rejection_uses_public_lease_error(tmp_path,monkeypatch):
    from contextlib import contextmanager
    import packages.agent_team.worktree_writes as module
    from packages.execution_backends import BackendRejected
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    binding=s._bindings[g[0].write.write_fencing_token]

    class PosixOS:
        name='posix'

    @contextmanager
    def reject_fanout(*args,**kwargs):
        raise BackendRejected('REPARSE_PATH_DENIED')
        yield

    monkeypatch.setattr(module,'os',PosixOS())
    monkeypatch.setattr(module,'verified_scope_guard',reject_fanout)
    with pytest.raises(LeaseError,match='WORKSPACE_GIT_STORE_DRIFT'):
        with s._object_write_guard(binding):
            pytest.fail('object writer reached after fanout rejection')
    assert git(Path(refs[0].workspace_root),'rev-parse','HEAD')==base

def test_post_commit_retarget_then_receipt_failure_compensates_bound_final(tmp_path,monkeypatch):
    from contextlib import contextmanager
    import packages.agent_team.worktree_writes as module
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    for ref in ('refs/heads/final','refs/heads/foreign'):git(work,'update-ref',ref,base)
    git(work,'symbolic-ref','refs/heads/owned','refs/heads/final');git(work,'symbolic-ref','HEAD','refs/heads/owned')
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base);s.write(g[0],'a.txt',b'approved',request_id='write')
    original_reply=s._ref_reply;original_guard=module.verified_scope_guard
    def retarget_after_commit(process,expected):
        original_reply(process,expected)
        if expected==b'commit':git(work,'symbolic-ref','refs/heads/owned','refs/heads/foreign')
    @contextmanager
    def fail_after_publication(*args,**kwargs):
        with original_guard(*args,**kwargs):yield
        raise OSError('synthetic post-publication receipt failure')
    monkeypatch.setattr(s,'_ref_reply',retarget_after_commit)
    monkeypatch.setattr(module,'verified_scope_guard',fail_after_publication)
    with pytest.raises(OSError):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','refs/heads/final')==base
    assert git(work,'rev-parse','refs/heads/foreign')==base and git(work,'rev-parse','HEAD')==base
    assert (g[0].write.write_fencing_token,'commit') not in s._receipts
    assert git(source,'rev-parse','HEAD')==base and not list(Path(refs[0].managed_store).rglob('*.lock'))

def test_compensation_does_not_replace_new_symbolic_final_identity(tmp_path,monkeypatch):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    for ref in ('refs/heads/final','refs/heads/foreign'):git(work,'update-ref',ref,base)
    git(work,'symbolic-ref','HEAD','refs/heads/final')
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base);s.write(g[0],'a.txt',b'approved',request_id='write')
    class Broken(dict):
        def __setitem__(self,key,value):super().__setitem__(key,value);raise OSError('synthetic receipt failure')
    s._receipts=Broken(s._receipts);original=s._restore_bound_final;injected=[]
    def redirect_before_compensation(b,new,old):
        git(work,'update-ref','refs/heads/foreign',new)
        git(work,'symbolic-ref','refs/heads/final','refs/heads/foreign');injected.append(True)
        return original(b,new,old)
    monkeypatch.setattr(s,'_restore_bound_final',redirect_before_compensation)
    with pytest.raises(LeaseError,match='COMMIT_RECOVERY_REQUIRED'):s.commit(g[0],request_id='commit')
    assert injected and git(work,'symbolic-ref','refs/heads/final')=='refs/heads/foreign'
    assert git(work,'rev-parse','refs/heads/foreign')!=base
    assert git(source,'rev-parse','HEAD')==base and not list(Path(refs[0].managed_store).rglob('*.lock'))

def test_chain_redirect_between_preflight_and_prepare_aborts_publication(tmp_path,monkeypatch):
    import packages.agent_team.worktree_writes as module
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    for ref in ('refs/heads/owned','refs/heads/foreign'):git(work,'update-ref',ref,base)
    git(work,'symbolic-ref','HEAD','refs/heads/owned');leases.revoke_run('run0')
    worker=leases.issue_worker('run0','replacement',NOW,TTL);g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=module.subprocess.Popen;injected=[]
    def race(argv,*args,**kwargs):
        if 'update-ref' in argv and '--stdin' in argv and not injected:
            injected.append(True);git(work,'symbolic-ref','refs/heads/owned','refs/heads/foreign')
        return original(argv,*args,**kwargs)
    monkeypatch.setattr(module.subprocess,'Popen',race)
    with pytest.raises(LeaseError):s.commit(g[0],request_id='commit')
    assert injected and git(work,'rev-parse','refs/heads/foreign')==base
    assert (g[0].write.write_fencing_token,'commit') not in s._receipts
    assert not list(Path(refs[0].managed_store).rglob('*.lock'))

@pytest.mark.parametrize('variant',['cycle','depth','unborn'])
def test_invalid_symbolic_chain_acquire_is_bounded_domain_denial(tmp_path,variant):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    if variant=='cycle':
        git(work,'symbolic-ref','refs/heads/one','refs/heads/two')
        git(work,'symbolic-ref','refs/heads/two','refs/heads/one')
    elif variant=='depth':
        git(work,'update-ref','refs/heads/last',base)
        for n in range(12):git(work,'symbolic-ref',f'refs/heads/link{n}',f'refs/heads/link{n+1}' if n<11 else 'refs/heads/last')
    git(work,'symbolic-ref','HEAD',{'cycle':'refs/heads/one','depth':'refs/heads/link0','unborn':'refs/heads/missing'}[variant])
    leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    old_bindings=dict(s._bindings)
    with pytest.raises(LeaseError):s.acquire(refs[0].workspace_id,worker,baseline=base)
    assert s._bindings==old_bindings and git(source,'rev-parse','HEAD')==base
    assert not list(Path(refs[0].managed_store).rglob('*.lock'))

@pytest.mark.parametrize('symbolic',[False,True])
def test_prepared_native_transaction_locks_head_identity(tmp_path,monkeypatch,symbolic):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    git(work,'update-ref','refs/heads/owned',base);git(work,'update-ref','refs/heads/foreign',base)
    if symbolic:
        git(work,'symbolic-ref','HEAD','refs/heads/owned');leases.revoke_run('run0')
        worker=leases.issue_worker('run0','replacement',NOW,TTL);g[0]=s.acquire(refs[0].workspace_id,worker,baseline=base)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._ref_reply;attempted=[]
    def attack(process,expected):
        original(process,expected)
        if expected==b'prepare':
            outcome=subprocess.run(['git','-C',str(work),'symbolic-ref','HEAD','refs/heads/foreign'],capture_output=True)
            attempted.append((outcome.returncode,b'HEAD.lock' in outcome.stderr))
    monkeypatch.setattr(s,'_ref_reply',attack)
    receipt=s.commit(g[0],request_id='commit')
    assert len(attempted)==1 and attempted[0][0]!=0 and attempted[0][1]
    assert git(work,'rev-parse','refs/heads/foreign')==base
    assert receipt['parent']==base and receipt['tree']==git(work,'rev-parse',receipt['commit']+'^{tree}')
    assert receipt['changed_paths']==tuple(git(work,'diff-tree','--no-commit-id','--name-only','-r',receipt['commit']).splitlines())==('a.txt',)
    assert receipt['head_kind']==('SYMBOLIC' if symbolic else 'DETACHED')

def test_prepared_transaction_stale_fence_aborts_without_lock_residue(tmp_path,monkeypatch):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=s._ref_reply
    def revoke(process,expected):
        original(process,expected)
        if expected==b'prepare':leases.revoke_run('run0')
    monkeypatch.setattr(s,'_ref_reply',revoke)
    with pytest.raises(StaleFencingToken):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==base
    assert not list(Path(refs[0].managed_store).rglob('*.lock'))

@pytest.mark.parametrize('staged',[False,True])
def test_write_cannot_overwrite_unreceipted_dirty(tmp_path,staged):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    (work/'a.txt').write_bytes(b'foreign')
    if staged:git(work,'add','a.txt')
    before=git(work,'status','--porcelain')
    with pytest.raises(LeaseError):s.write(g[0],'a.txt',b'overwrite',request_id='write')
    assert (work/'a.txt').read_bytes()==b'foreign' and git(work,'status','--porcelain')==before

@pytest.mark.parametrize('operation',['write','commit'])
def test_receipt_publication_exception_restores_visible_state(tmp_path,operation):
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    if operation=='commit':s.write(g[0],'a.txt',b'approved',request_id='write')
    before=(work/'a.txt').read_bytes();index=Path(git(work,'rev-parse','--git-path','index')).read_bytes();old=dict(s._receipts)
    class Broken(dict):
        def __setitem__(self,key,value):super().__setitem__(key,value);raise OSError('synthetic receipt publication failure')
    s._receipts=Broken(s._receipts)
    with pytest.raises(OSError):
        if operation=='write':s.write(g[0],'a.txt',b'new',request_id='write')
        else:s.commit(g[0],request_id='commit')
    assert (work/'a.txt').read_bytes()==before and git(work,'rev-parse','HEAD')==base
    assert dict(s._receipts)==old and Path(git(work,'rev-parse','--git-path','index')).read_bytes()==index
    assert not list(work.glob('.e06-write-*')) and not list(Path(refs[0].managed_store).rglob('*.lock'))

def test_swallowed_clock_reentry_taints_outer_without_writes(tmp_path):
    s,refs,g,clock,leases,source,base=setup(tmp_path);entered=[]
    def recursive():
        if not entered:
            entered.append(True)
            try:s.write(g[1],'b.txt',b'nested',request_id='nested')
            except LeaseError:pass
        return NOW
    s.clock=recursive
    with pytest.raises(LeaseError):s.write(g[0],'a.txt',b'outer',request_id='outer')
    assert Path(refs[0].workspace_root,'a.txt').read_bytes()==b'alpha' and Path(refs[1].workspace_root,'b.txt').read_bytes()==b'beta'

def test_clock_callback_reads_owner_from_other_thread_without_lock_inversion(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    with ThreadPoolExecutor(max_workers=1) as pool:
        def observed():pool.submit(leases.active_writes).result(timeout=2);return NOW
        s.clock=observed
        assert s.write(g[0],'a.txt',b'approved',request_id='write')

def test_swallowed_token_callback_facade_reentry_taints_outer(tmp_path):
    s,refs,g,clock,leases,source,base=setup(tmp_path);leases.revoke_run('run0');worker=leases.issue_worker('run0','replacement',NOW,TTL)
    def token():
        try:s.write(g[1],'b.txt',b'nested',request_id='nested')
        except LeaseError:pass
        return 'outer-acquire'
    leases._token_factory=token
    with pytest.raises(LeaseError):s.acquire(refs[0].workspace_id,worker,baseline=base)
    assert Path(refs[1].workspace_root,'b.txt').read_bytes()==b'beta' and len(leases.active_writes())==1

def test_post_guard_failure_restores_commit_and_receipt(tmp_path,monkeypatch):
    from contextlib import contextmanager
    import packages.agent_team.worktree_writes as module
    s,refs,g,clock,leases,source,base=setup(tmp_path);work=Path(refs[0].workspace_root)
    s.write(g[0],'a.txt',b'approved',request_id='write');original=module.verified_scope_guard;old=dict(s._receipts)
    @contextmanager
    def broken(*args,**kwargs):
        with original(*args,**kwargs):yield
        raise OSError('synthetic post-guard failure')
    monkeypatch.setattr(module,'verified_scope_guard',broken)
    with pytest.raises(OSError):s.commit(g[0],request_id='commit')
    assert git(work,'rev-parse','HEAD')==base and s._receipts==old

def test_swallowed_foreign_service_clock_reentry_has_no_publication(tmp_path):
    from packages.agent_team.worktree_writes import WorktreeWriteService
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    other=WorktreeWriteService(s.backend,leases,clock=lambda:NOW)
    foreign=other.acquire(refs[1].workspace_id,leases.active_worker('run1'),baseline=base)
    def callback():
        try:other.write(foreign,'b.txt',b'nested',request_id='nested')
        except LeaseError:pass
        return NOW
    s.clock=callback
    with pytest.raises(LeaseError):s.write(g[0],'a.txt',b'outer',request_id='outer')
    assert Path(refs[1].workspace_root,'b.txt').read_bytes()==b'beta' and not other._receipts

def test_two_service_clock_callbacks_do_not_invert_locks(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from packages.agent_team.worktree_writes import WorktreeWriteService
    s,refs,g,clock,leases,source,base=setup(tmp_path)
    other=WorktreeWriteService(s.backend,leases,clock=lambda:NOW)
    foreign=other.acquire(refs[1].workspace_id,leases.active_worker('run1'),baseline=base);barrier=Barrier(2)
    def observe(peer):
        barrier.wait(timeout=15)
        with peer._lock:return NOW
    s.clock=lambda:observe(other);other.clock=lambda:observe(s)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first=pool.submit(s.write,g[0],'a.txt',b'first',request_id='first')
        second=pool.submit(other.write,foreign,'b.txt',b'second',request_id='second')
        assert first.result(timeout=40)['io_count']==second.result(timeout=40)['io_count']==1
