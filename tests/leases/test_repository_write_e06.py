from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timedelta,timezone
from pathlib import Path
from threading import Barrier
import os
import subprocess
import pytest
from packages.leases.service import LeaseService,LeaseError,StaleFencingToken
from packages.paths.identity import RepositoryIdentity,RepositoryPathMapping

NOW=datetime(2026,9,17,6,tzinfo=timezone.utc)
TTL=timedelta(minutes=2)

def environment(tmp_path):
    source=tmp_path/'source';source.mkdir();(source/'pkg').mkdir();(source/'pkg'/'a.txt').write_text('a')
    identity=RepositoryIdentity('repo',str(source),'INSENSITIVE','map1')
    mappings=[]
    for i in range(2):
        root=tmp_path/f'ws{i}';root.mkdir();(root/'pkg').mkdir();(root/'pkg'/'a.txt').write_text('a')
        mappings.append(RepositoryPathMapping(identity,f'ws{i}','git-worktree',str(root)))
    leases=LeaseService();workers=[leases.issue_worker(f'run{i}',f'worker{i}',NOW,TTL) for i in range(2)]
    return leases,workers,mappings

def acquire(leases,worker,mapping,paths,now=NOW):
    return leases.acquire_repository_write(worker,mapping,tuple(paths),now,TTL)

def test_same_repository_overlap_across_runs_and_workspaces_has_one_winner_100_times(tmp_path):
    leases,workers,maps=environment(tmp_path)
    for n in range(100):
        barrier=Barrier(2)
        def attempt(i):
            barrier.wait(timeout=5)
            try:return acquire(leases,workers[i],maps[i],(f'pkg/group{n}' if i==0 else f'PKG/GROUP{n}/a.txt',))
            except LeaseError:return None
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(attempt,range(2)))
        assert sum(r is not None for r in results)==1
        for w in workers:leases.revoke_run(w.run_id)
        workers=[leases.issue_worker(f'run{i}',f'worker{i}',NOW,TTL) for i in range(2)]

def test_worktree_single_owner_disjoint_success_and_exact_retry(tmp_path):
    leases,workers,maps=environment(tmp_path)
    a=acquire(leases,workers[0],maps[0],('pkg/a.txt',))
    assert acquire(leases,workers[0],maps[0],('PKG/A.TXT',))==a
    with pytest.raises(LeaseError):acquire(leases,workers[1],maps[0],('other',))
    b=acquire(leases,workers[1],maps[1],('other',))
    assert a.write.write_fencing_token!=b.write.write_fencing_token

def test_takeover_expires_old_pair_and_half_open_boundary(tmp_path):
    leases,workers,maps=environment(tmp_path);a=acquire(leases,workers[0],maps[0],('pkg',))
    with pytest.raises(StaleFencingToken):leases.require_repository_write(a,NOW+TTL)
    worker=leases.take_over_expired('run0','replacement',NOW+TTL+timedelta(seconds=1),TTL)
    b=acquire(leases,worker,maps[0],('pkg',),NOW+TTL+timedelta(seconds=1))
    with pytest.raises(StaleFencingToken):leases.require_repository_write(a,NOW+TTL+timedelta(seconds=1))
    leases.require_repository_write(b,NOW+TTL+timedelta(seconds=1))

@pytest.mark.parametrize('path',['../escape','pkg/../other','//server/share','C:/outside/file','.git/config','pkg/a.txt:stream','pkg/trailing.'])
def test_unsafe_scope_is_denied(tmp_path,path):
    leases,workers,maps=environment(tmp_path)
    with pytest.raises(LeaseError):acquire(leases,workers[0],maps[0],(path,))
    assert leases.active_writes()==()

def test_real_junction_and_windows_wsl_case_alias_conflict(tmp_path):
    leases,workers,maps=environment(tmp_path);source=Path(maps[0].identity.source_root);alias=tmp_path/'alias'
    if os.name=='nt':
        outcome=subprocess.run(['cmd.exe','/d','/c','mklink','/J',str(alias),str(source)],capture_output=True)
        if outcome.returncode:pytest.skip('local junction creation unavailable')
    else:alias.symlink_to(source,target_is_directory=True)
    try:
        a=acquire(leases,workers[0],maps[0],(str(alias/'pkg'/'a.txt'),))
        absolute=str(source/'PKG'/'A.TXT').replace('\\','/')
        if os.name=='nt':absolute='/mnt/'+absolute[0].lower()+absolute[2:]
        with pytest.raises(LeaseError):acquire(leases,workers[1],maps[1],(absolute,))
        assert a.scopes==('pkg/a.txt',)
    finally:
        if alias.is_symlink():alias.unlink()
        else:os.rmdir(alias)

def test_real_short_name_alias_is_same_resource(tmp_path):
    if os.name!='nt':pytest.skip('Windows 8.3 alias requires Windows')
    import ctypes
    leases,workers,maps=environment(tmp_path);source=Path(maps[0].identity.source_root)
    long=source/'LongDirectoryName';long.mkdir();target=long/'LongFileName.txt';target.write_text('a')
    buffer=ctypes.create_unicode_buffer(32768)
    size=ctypes.windll.kernel32.GetShortPathNameW(str(target),buffer,len(buffer))
    if not size or buffer.value.casefold()==str(target).casefold():pytest.skip('8.3 alias generation disabled on this volume')
    a=acquire(leases,workers[0],maps[0],(buffer.value,))
    with pytest.raises(LeaseError):acquire(leases,workers[1],maps[1],(str(target),))
    assert a.scopes==('longdirectoryname/longfilename.txt',)

def test_repository_id_cannot_rebind_to_different_physical_source(tmp_path):
    leases,workers,maps=environment(tmp_path);acquire(leases,workers[0],maps[0],('pkg',))
    other=tmp_path/'other-source';other.mkdir()
    mapping=RepositoryPathMapping(RepositoryIdentity('repo',str(other),'INSENSITIVE','map1'),'other','git-worktree',maps[1].workspace_root)
    with pytest.raises(LeaseError,match='REPOSITORY_IDENTITY_REBIND'):acquire(leases,workers[1],mapping,('different',))

@pytest.mark.parametrize('kind',['source','workspace'])
def test_physical_identity_ignores_policy_and_id_labels(tmp_path,kind):
    leases,workers,maps=environment(tmp_path);acquire(leases,workers[0],maps[0],('pkg',))
    source=Path(maps[0].identity.source_root)
    if kind=='workspace':
        source=tmp_path/'different-source';source.mkdir()
    alternate=RepositoryPathMapping(RepositoryIdentity('alternate',str(source).upper(),'SENSITIVE','map2'),'alternate','git-worktree',str(Path(maps[0 if kind=='workspace' else 1].workspace_root)).upper())
    if os.name!='nt':pytest.skip('Windows case alias')
    with pytest.raises(LeaseError):acquire(leases,workers[1],alternate,('pkg',))
    assert len(leases.active_writes())==1

def test_expired_observation_cannot_revive_after_clock_rollback(tmp_path):
    leases,workers,maps=environment(tmp_path);grant=acquire(leases,workers[0],maps[0],('pkg',))
    with pytest.raises(StaleFencingToken):leases.require_repository_write(grant,NOW+TTL)
    with pytest.raises(StaleFencingToken):leases.require_repository_write(grant,NOW)

def test_physical_root_replacement_invalidates_grant(tmp_path):
    leases,workers,maps=environment(tmp_path);grant=acquire(leases,workers[0],maps[0],('pkg',))
    root=Path(maps[0].workspace_root);root.rename(tmp_path/'old-workspace');root.mkdir()
    with pytest.raises(LeaseError):leases.require_repository_write(grant,NOW)

def test_token_callback_reentry_has_no_partial_claim(tmp_path):
    leases,workers,maps=environment(tmp_path);entered=[]
    def token():
        leases._token_factory=lambda:'nested-token'
        try:entered.append(acquire(leases,workers[1],maps[1],('other',)))
        except LeaseError:pass
        return 'outer-token'
    leases._token_factory=token
    with pytest.raises(LeaseError):acquire(leases,workers[0],maps[0],('pkg',))
    assert not leases.active_writes() and not entered

def test_physical_alias_contention_100_rounds(tmp_path):
    if os.name!='nt':pytest.skip('Windows physical case identity')
    _,_,maps=environment(tmp_path)
    alternate=RepositoryPathMapping(RepositoryIdentity('alternate',str(Path(maps[0].identity.source_root)).upper(),'SENSITIVE','map2'),'alternate','git-worktree',maps[1].workspace_root.upper())
    for _ in range(100):
        leases=LeaseService();workers=[leases.issue_worker(f'r{i}',f'w{i}',NOW,TTL) for i in range(2)];barrier=Barrier(2)
        def attempt(i):
            barrier.wait(timeout=5)
            try:return acquire(leases,workers[i],(maps[0],alternate)[i],('pkg',))
            except LeaseError:return None
        with ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(attempt,range(2)))
        assert sum(x is not None for x in out)==1 and len(leases.active_writes())==1

def test_future_replacement_prevents_two_current_on_rollback(tmp_path):
    leases,workers,maps=environment(tmp_path);old=acquire(leases,workers[0],maps[0],('pkg',))
    future=NOW+TTL+timedelta(seconds=1)
    worker=leases.issue_worker('new-run','new-worker',future,TTL)
    new=acquire(leases,worker,maps[1],('pkg',),future)
    for grant in (old,new):
        with pytest.raises(StaleFencingToken):leases.require_repository_write(grant,NOW)
    with pytest.raises(StaleFencingToken):leases.require_repository_write(old,future)
    leases.require_repository_write(new,future)

def test_token_callback_foreign_owner_reentry_is_rejected(tmp_path):
    leases,workers,maps=environment(tmp_path);foreign=LeaseService();worker=foreign.issue_worker('foreign','worker',NOW,TTL)
    def token():
        try:acquire(foreign,worker,maps[1],('other',))
        except LeaseError:pass
        return 'token'
    leases._token_factory=token
    with pytest.raises(LeaseError):acquire(leases,workers[0],maps[0],('pkg',))
    assert not leases.active_writes() and not foreign.active_writes()

def test_token_callback_can_read_owner_from_other_thread(tmp_path):
    leases,workers,maps=environment(tmp_path)
    with ThreadPoolExecutor(max_workers=1) as pool:
        def token():
            assert pool.submit(leases.active_writes).result(timeout=2)==()
            return 'outside-lock-token'
        leases._token_factory=token
        assert acquire(leases,workers[0],maps[0],('pkg',))

@pytest.mark.parametrize('operation',['require','acquire'])
def test_invalid_future_call_cannot_poison_current_clock(tmp_path,operation):
    from dataclasses import replace
    leases,workers,maps=environment(tmp_path);grant=acquire(leases,workers[0],maps[0],('pkg',))
    future=NOW+timedelta(days=1000)
    with pytest.raises(LeaseError):
        if operation=='require':leases.require_repository_write(replace(grant,write=replace(grant.write,write_fencing_token='forged')),future)
        else:acquire(leases,replace(workers[1],execution_fencing_token='forged'),maps[1],('other',),future)
    leases.require_repository_write(grant,NOW)

def test_out_of_bound_future_even_with_exact_grant_is_not_observation(tmp_path):
    leases,workers,maps=environment(tmp_path);grant=acquire(leases,workers[0],maps[0],('pkg',))
    with pytest.raises(LeaseError,match='CLOCK_OBSERVATION_OUT_OF_RANGE'):leases.require_repository_write(grant,NOW+timedelta(days=1000))
    leases.require_repository_write(grant,NOW)
