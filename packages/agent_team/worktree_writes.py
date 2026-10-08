"""E06 host-only bounded writes in C09 isolated stores, never source Git.

LeaseService is the authority owner. This local adapter does not implement
PostgreSQL-time/multiprocess fencing, general Git, merge, PR, or deployment.
"""
from contextlib import contextmanager,nullcontext
from dataclasses import replace
from datetime import datetime,timedelta
from functools import wraps
from hashlib import sha256
import json,os,stat
import io
import re
import subprocess
import time
from queue import Queue,Empty
from pathlib import Path
from threading import RLock,local,Thread
from packages.execution_backends import BackendRejected,GitWorktreeExecutionBackend
from packages.execution_backends.safeio import physical_identity,verified_scope_guard,verified_stat,_final_descriptor_path
from packages.leases.service import LeaseService,LeaseError,RepositoryWriteGrant,repository_scopes,_repository_token_context


_operations=local()
_OBJECT_FANOUTS=tuple(f'{value:02x}' for value in range(256))


def _host_operation(method):
    @wraps(method)
    def execute(self,*args,**kwargs):
        current=getattr(_operations,'current',None)
        if current is not None:
            current['tainted']=True
            token=getattr(_repository_token_context,'active',None)
            if token is not None:token['tainted']=True
            raise LeaseError('WRITE_REENTRANCY')
        state={'service':self,'tainted':False};_operations.current=state
        try:
            self._capture_clock()
            return method(self,*args,**kwargs)
        finally:_operations.current=None
    return execute


class WorktreeWriteService:
    def __init__(self,backend,leases,*,clock):
        if type(backend) is not GitWorktreeExecutionBackend or type(leases) is not LeaseService or not callable(clock):
            raise LeaseError('WRITE_AUTHORITY_REQUIRED')
        self.backend=backend;self.leases=leases;self.clock=clock
        self._lock=RLock();self._bindings={};self._receipts={};self._local=local()
        self.before_write=None;self.before_commit=None

    def _capture_clock(self):
        state=_operations.current
        if state['tainted']:raise LeaseError('WRITE_REENTRANCY')
        if self._lock._is_owned() or self.leases._lock._is_owned():raise LeaseError('CLOCK_LOCK_BOUNDARY_VIOLATION')
        value=self.clock()
        if state['tainted']:raise LeaseError('WRITE_REENTRANCY')
        if type(value) is not datetime or value.tzinfo is None:raise LeaseError('CLOCK_OBSERVATION_INVALID')
        state['now']=value;state['monotonic']=time.monotonic()

    def _now(self):
        state=_operations.current
        if state['service'] is not self or state['tainted']:raise LeaseError('WRITE_REENTRANCY')
        return state['now']

    def _require_grant(self,grant):
        now=self._now();state=_operations.current
        self.leases.require_repository_write(grant,now)
        if now+timedelta(seconds=time.monotonic()-state['monotonic'])>=grant.write.expires_at:
            self.leases.require_repository_write(grant,grant.write.expires_at)

    @staticmethod
    def _text(value):
        if type(value) is not str or not value or len(value)>256 or value!=value.strip():raise LeaseError('WRITE_REQUEST_INVALID')

    @staticmethod
    def _git(workspace,*args,input_bytes=None,git_dir=None,common_dir=None):
        argv=['git','-C',workspace.workspace_root]
        if git_dir is not None:
            argv.extend(['--git-dir='+str(git_dir),'--work-tree='+workspace.workspace_root])
        argv.extend(['-c','core.hooksPath='+str(Path(workspace.managed_store).parent/'no-hooks'),
            '-c','user.name=Anvil isolated writer','-c','user.email=isolated@example.invalid',*args])
        env={'PATH':os.environ.get('PATH',''),'GIT_TERMINAL_PROMPT':'0',
            'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_SYSTEM':os.devnull,
            'GIT_CONFIG_GLOBAL':os.devnull,'GIT_ATTR_NOSYSTEM':'1',
            'GIT_OPTIONAL_LOCKS':'0','LC_ALL':'C'}
        if common_dir is not None:env['GIT_COMMON_DIR']=str(common_dir)
        result=subprocess.run(argv,input=input_bytes,capture_output=True,check=False,timeout=20,env=env)
        if result.returncode!=0:
            raise BackendRejected('GIT_DRIVER_FAILED',result.stderr.decode('utf-8','replace')[:1000])
        return result.stdout

    def _bound_git(self,b,*args,input_bytes=None):
        return self._git(b['workspace'],*args,input_bytes=input_bytes,
            git_dir=b['git_dir'],common_dir=b['common_dir'])

    @_host_operation
    def acquire(self,workspace_id,worker,*,baseline):
        with self._lock:
            workspace=self.backend.workspace_ref(workspace_id)
            self.backend._workspace_root(workspace)
            if workspace.run_id!=worker.run_id or workspace.baseline!=baseline or not workspace.managed_store:
                raise LeaseError('WORKSPACE_BASELINE_MISMATCH')
            head_file=Path(self._git(workspace,'rev-parse','--git-path','HEAD').decode().strip()).resolve(strict=True)
            chain=self._ref_chain(workspace,head_file)
            store=Path(workspace.managed_store).resolve(strict=True)
            git_dir=head_file.parent.resolve(strict=True)
            common_dir=Path(self._git(workspace,'rev-parse','--git-common-dir').decode().strip()).resolve(strict=True)
            if common_dir!=store or not git_dir.is_relative_to(store):raise LeaseError('WORKSPACE_GIT_STORE_INVALID')
            objects_dir=(common_dir/'objects').resolve(strict=True)
            if objects_dir.parent!=common_dir:raise LeaseError('WORKSPACE_GIT_STORE_INVALID')
            for fanout in _OBJECT_FANOUTS:(objects_dir/fanout).mkdir(exist_ok=True)
            objects_root_identity=physical_identity(objects_dir)
            with verified_scope_guard(objects_dir,_OBJECT_FANOUTS,expected_root_identity=objects_root_identity):pass
            head=self._git(workspace,'rev-parse','HEAD',git_dir=git_dir,common_dir=common_dir).decode().strip()
            if head!=baseline or chain[-1][2]!=head:raise LeaseError('WORKSPACE_BASELINE_MISMATCH')
            binding={'workspace':workspace,'workspace_hash':sha256(repr(workspace).encode()).hexdigest(),
                'head':head,'branch':self._git(workspace,'rev-parse','--abbrev-ref','HEAD',git_dir=git_dir,common_dir=common_dir).decode().strip(),
                'source_snapshot':self.backend._scan(Path(workspace.mapping.identity.source_root)).no_write_proof['post_snapshot_sha256'],
                'writes':{},'git_dir':git_dir,'common_dir':common_dir,'objects_dir':objects_dir,
                'git_dir_identity':(git_dir.stat().st_dev,git_dir.stat().st_ino),
                'common_dir_identity':(common_dir.stat().st_dev,common_dir.stat().st_ino),
                'objects_dir_identity':(objects_dir.stat().st_dev,objects_dir.stat().st_ino),
                'objects_root_identity':objects_root_identity}
            if not head_file.is_relative_to(Path(workspace.managed_store).resolve(strict=True)):raise LeaseError('WORKSPACE_IDENTITY_DRIFT')
            binding['head_file']=head_file;binding['head_kind'],binding['head_target']=self._head_identity(head_file)
            binding['head_chain']=chain
        # Arbitrary host token factory executes without facade or owner locks.
        now=self._now()
        grant=self.leases.acquire_repository_write(worker,workspace.mapping,workspace.target_scopes,now,worker.expires_at-now)
        self._capture_clock()
        with self._lock,self.leases._lock:
            self._require_grant(grant)
            token=grant.write.write_fencing_token
            if token not in self._bindings:
                self._bindings[token]=binding
            return replace(grant,write=replace(grant.write))

    def _validate(self,grant):
        self._require_grant(grant)
        b=self._bindings.get(grant.write.write_fencing_token)
        if b is None:raise LeaseError('WRITE_BINDING_REQUIRED')
        w=b['workspace'];current=self.backend.workspace_ref(w.workspace_id)
        if sha256(repr(current).encode()).hexdigest()!=b['workspace_hash']:raise LeaseError('WORKSPACE_IDENTITY_DRIFT')
        self.backend._workspace_root(w)
        for path,key in ((b['git_dir'],'git_dir_identity'),(b['common_dir'],'common_dir_identity'),(b['objects_dir'],'objects_dir_identity')):
            current_path=path.resolve(strict=True);info=current_path.stat()
            if current_path!=path or not stat.S_ISDIR(info.st_mode) or (info.st_dev,info.st_ino)!=b[key]:
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
        self._check_chain(b,b['head'])
        if self._bound_git(b,'rev-parse','HEAD').decode().strip()!=b['head'] or self._bound_git(b,'rev-parse','--abbrev-ref','HEAD').decode().strip()!=b['branch']:
            raise LeaseError('WORKSPACE_BASELINE_DRIFT')
        if self._head_identity(b['head_file'])!=(b['head_kind'],b['head_target']):raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')
        if self.backend._scan(Path(w.mapping.identity.source_root)).no_write_proof['post_snapshot_sha256']!=b['source_snapshot']:
            raise LeaseError('SOURCE_BASELINE_DRIFT')
        return b

    @staticmethod
    def _head_identity(path):
        raw=path.read_bytes()
        if re.fullmatch(rb'[0-9a-f]{40,64}\n',raw):return 'DETACHED','HEAD'
        if re.fullmatch(rb'ref: refs/heads/[A-Za-z0-9_.\-/]{1,240}\n',raw):return 'SYMBOLIC',raw[5:-1].decode()
        raise LeaseError('WORKSPACE_HEAD_IDENTITY_INVALID')

    @staticmethod
    def _ref_path(workspace,head_file,name):
        store=Path(workspace.managed_store).resolve(strict=True)
        path=head_file if name=='HEAD' else store/name
        if not path.resolve().is_relative_to(store) or path.resolve()!=path.absolute():
            raise LeaseError('WORKSPACE_HEAD_IDENTITY_INVALID')
        return path

    @classmethod
    def _ref_chain(cls,workspace,head_file):
        """Bounded semantic ref identity; packed direct refs never imply a symref.

        Each tuple binds name, raw kind and exact target/object. Storage packing
        may change without changing this identity; loose records take precedence.
        """
        chain=[];seen=set();name='HEAD'
        for _ in range(8):
            if name in seen:raise LeaseError('WORKSPACE_HEAD_CHAIN_CYCLE')
            seen.add(name);path=cls._ref_path(workspace,head_file,name)
            if path.exists():
                info=path.stat()
                if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_size>512:
                    raise LeaseError('WORKSPACE_HEAD_IDENTITY_INVALID')
                raw=path.read_bytes()
            else:
                if name=='HEAD':raise LeaseError('WORKSPACE_HEAD_UNBORN')
                packed=cls._ref_path(workspace,head_file,'packed-refs')
                if not packed.is_file() or packed.stat().st_size>1_048_576:raise LeaseError('WORKSPACE_HEAD_UNBORN')
                entries=[line.split(b' ',1)[0] for line in packed.read_bytes().splitlines()
                    if b' ' in line and line.split(b' ',1)[1]==name.encode()]
                if len(entries)!=1:raise LeaseError('WORKSPACE_HEAD_UNBORN')
                raw=entries[0]+b'\n'
            if re.fullmatch(rb'[0-9a-f]{40}(?:[0-9a-f]{24})?\n',raw):
                return tuple(chain+[(name,'DIRECT',raw[:-1].decode())])
            if not re.fullmatch(rb'ref: refs/heads/[A-Za-z0-9_.\-/]{1,240}\n',raw):
                raise LeaseError('WORKSPACE_HEAD_IDENTITY_INVALID')
            target=raw[5:-1].decode()
            if '..' in target or any(not part or part.startswith('.') or part.endswith(('.', '.lock')) for part in target.split('/')):
                raise LeaseError('WORKSPACE_HEAD_IDENTITY_INVALID')
            chain.append((name,'SYMBOLIC',target));name=target
        raise LeaseError('WORKSPACE_HEAD_CHAIN_DEPTH')

    @staticmethod
    def _chain_at(b,oid):
        chain=b['head_chain']
        return chain[:-1]+((chain[-1][0],'DIRECT',oid),)

    def _check_chain(self,b,oid):
        if self._ref_chain(b['workspace'],b['head_file'])!=self._chain_at(b,oid):
            raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')

    @classmethod
    def _direct_ref_oid(cls,workspace,head_file,name):
        """Read one bound direct ref without following a later symref redirect."""
        path=cls._ref_path(workspace,head_file,name)
        if path.exists():
            info=path.stat()
            if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_size>512:
                raise LeaseError('WORKSPACE_HEAD_IDENTITY_INVALID')
            raw=path.read_bytes()
        else:
            packed=cls._ref_path(workspace,head_file,'packed-refs')
            if not packed.is_file() or packed.stat().st_size>1_048_576:
                raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')
            entries=[line.split(b' ',1)[0] for line in packed.read_bytes().splitlines()
                if b' ' in line and line.split(b' ',1)[1]==name.encode()]
            if len(entries)!=1:raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')
            raw=entries[0]+b'\n'
        if not re.fullmatch(rb'[0-9a-f]{40}(?:[0-9a-f]{24})?\n',raw):
            raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')
        return raw[:-1].decode()

    @staticmethod
    def _ref_reply(process,expected):
        reply=Queue(maxsize=1)
        Thread(target=lambda:reply.put(process.stdout.readline(256)),daemon=True).start()
        try:line=reply.get(timeout=10)
        except Empty as exc:raise LeaseError('COMMIT_REF_TRANSACTION_TIMEOUT') from exc
        if line!=expected+b': ok\n':raise LeaseError('COMMIT_REF_TRANSACTION_FAILED')

    def _publish_head(self,b,grant,new,old,*,compensation=False):
        """Bounded Git files-ref transaction; no host callbacks while prepared.

        Git holds every traversed ref lock from prepare through commit. Verify
        all acquired identities against the original chain before committing.
        """
        w=b['workspace'];expected=(b['head_kind'],b['head_target'])
        self._check_chain(b,old)
        if self._head_identity(b['head_file'])!=expected:raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')
        # Same restricted environment as the C09 driver; this seam runs only
        # update-ref's fixed two-phase protocol, never arbitrary commands.
        env={'PATH':os.environ.get('PATH',''),'GIT_TERMINAL_PROMPT':'0',
            'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_SYSTEM':os.devnull,
            'GIT_CONFIG_GLOBAL':os.devnull,'GIT_ATTR_NOSYSTEM':'1',
            'GIT_OPTIONAL_LOCKS':'0','LC_ALL':'C'}
        env['GIT_COMMON_DIR']=str(b['common_dir'])
        process=subprocess.Popen(['git','-C',w.workspace_root,'--git-dir='+str(b['git_dir']),'--work-tree='+w.workspace_root,
            '-c','core.hooksPath='+str(Path(w.managed_store).parent/'no-hooks'),'update-ref','--stdin'],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
        committed=False
        try:
            option='option no-deref\n' if b['head_kind']=='DETACHED' else ''
            process.stdin.write(f'start\n{option}update HEAD {new} {old}\nprepare\n'.encode());process.stdin.flush()
            self._ref_reply(process,b'start');self._ref_reply(process,b'prepare')
            for name,kind,value in b['head_chain']:
                path=self._ref_path(w,b['head_file'],name)
                if not Path(str(path)+'.lock').is_file():raise LeaseError('COMMIT_REF_LOCK_REQUIRED')
            self._check_chain(b,old)
            if self._head_identity(b['head_file'])!=expected:raise LeaseError('WORKSPACE_HEAD_IDENTITY_DRIFT')
            if b['head_kind']=='DETACHED' and b['head_file'].read_bytes()!=(old+'\n').encode():raise LeaseError('WORKSPACE_BASELINE_DRIFT')
            if not compensation:self._require_grant(grant)
            process.stdin.write(b'commit\n');process.stdin.flush();self._ref_reply(process,b'commit')
            committed=True
            # ``commit: ok`` is the publication linearization point.  A later
            # actor may redirect an intermediate symref after Git releases its
            # transaction locks; verify the originally bound final direct ref,
            # not the now-mutable traversal from HEAD.
            try:published=self._direct_ref_oid(w,b['head_file'],b['head_chain'][-1][0])
            except Exception as exc:raise LeaseError('COMMIT_RECOVERY_REQUIRED') from exc
            if published!=new:raise LeaseError('COMMIT_RECOVERY_REQUIRED')
        finally:
            if process.poll() is None:
                try:
                    if not committed:process.stdin.write(b'abort\n');process.stdin.flush()
                    process.stdin.close();process.wait(timeout=10)
                except (OSError,subprocess.TimeoutExpired):process.kill();process.wait(timeout=10)
            for stream in (process.stdin,process.stdout,process.stderr):
                if stream and not stream.closed:stream.close()

    def _restore_bound_final(self,b,new,old):
        """CAS-restore the original final direct ref without replacing a symref."""
        w=b['workspace'];final=b['head_chain'][-1][0]
        env={'PATH':os.environ.get('PATH',''),'GIT_TERMINAL_PROMPT':'0',
            'GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_SYSTEM':os.devnull,
            'GIT_CONFIG_GLOBAL':os.devnull,'GIT_ATTR_NOSYSTEM':'1',
            'GIT_OPTIONAL_LOCKS':'0','LC_ALL':'C','GIT_COMMON_DIR':str(b['common_dir'])}
        process=subprocess.Popen(['git','-C',w.workspace_root,'--git-dir='+str(b['git_dir']),'--work-tree='+w.workspace_root,
            '-c','core.hooksPath='+str(Path(w.managed_store).parent/'no-hooks'),'update-ref','--stdin'],
            stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
        committed=False
        try:
            process.stdin.write(f'start\noption no-deref\nupdate {final} {old} {new}\nprepare\n'.encode());process.stdin.flush()
            self._ref_reply(process,b'start');self._ref_reply(process,b'prepare')
            path=self._ref_path(w,b['head_file'],final)
            if not Path(str(path)+'.lock').is_file():raise LeaseError('COMMIT_REF_LOCK_REQUIRED')
            if self._direct_ref_oid(w,b['head_file'],final)!=new:raise LeaseError('COMMIT_RECOVERY_REQUIRED')
            process.stdin.write(b'commit\n');process.stdin.flush();self._ref_reply(process,b'commit');committed=True
            if self._direct_ref_oid(w,b['head_file'],final)!=old:raise LeaseError('COMMIT_RECOVERY_REQUIRED')
        except Exception as exc:
            if isinstance(exc,LeaseError) and str(exc)=='COMMIT_RECOVERY_REQUIRED':raise
            raise LeaseError('COMMIT_RECOVERY_REQUIRED') from exc
        finally:
            if process.poll() is None:
                try:
                    if not committed:process.stdin.write(b'abort\n');process.stdin.flush()
                    process.stdin.close();process.wait(timeout=10)
                except (OSError,subprocess.TimeoutExpired):process.kill();process.wait(timeout=10)
            for stream in (process.stdin,process.stdout,process.stderr):
                if stream and not stream.closed:stream.close()

    def _path(self,grant,path):
        if type(path) is not str or path.startswith(('/', '~')) or '\\' in path or ':' in path or any(p in ('','.','..') for p in path.split('/')):
            raise LeaseError('WRITE_PATH_DENIED')
        w=self._bindings[grant.write.write_fencing_token]['workspace']
        scopes=repository_scopes(w.mapping,(path,));relative=scopes[0]
        if not any(relative==s or relative.startswith(s+'/') for s in grant.scopes):raise LeaseError('WRITE_PATH_DENIED')
        return relative

    def _dirty(self,grant,b):
        parts=self._bound_git(b,'status','--porcelain=v1','-z','--untracked-files=all').split(b'\0')
        paths=[]
        for part in parts:
            if not part:continue
            status=part[:2].decode();path=part[3:].decode('utf-8')
            if any(flag in status for flag in 'DRCU'):raise LeaseError('DESTRUCTIVE_CHANGE_DENIED')
            self._path(grant,path);paths.append(path)
        return tuple(sorted(set(paths)))

    def _callback(self,operation):
        if getattr(self._local,'active',False):raise LeaseError('WRITE_REENTRANCY')
        callback=getattr(self,'before_'+operation)
        if callback:
            self._local.active=True
            try:callback()
            finally:self._local.active=False
        self._capture_clock()

    def _request(self,grant,request_id,operation,path='',data=b''):
        self._text(request_id)
        if getattr(self._local,'active',False):raise LeaseError('WRITE_REENTRANCY')
        if type(grant) is not RepositoryWriteGrant:raise LeaseError('WRITE_BINDING_REQUIRED')
        return (grant.write.write_fencing_token,request_id),sha256(json.dumps([operation,path,sha256(data).hexdigest()]).encode()).hexdigest()

    def _replay(self,key,digest):
        old=self._receipts.get(key)
        if old:
            if old[0]!=digest:raise LeaseError('WRITE_REPLAY_CONFLICT')
            return dict(old[1])

    @_host_operation
    def write(self,grant,path,data,*,request_id,permissions=None,before_dispatch=None):
        if type(data) is not bytes or len(data)>1_048_576:raise LeaseError('WRITE_PAYLOAD_INVALID')
        key,digest=self._request(grant,request_id,'write',path,data)
        permission_lock=permissions._lock if permissions is not None else nullcontext()
        with permission_lock,self._lock,self.leases._lock:
            b=self._validate(grant);relative=self._path(grant,path);self._approved_paths(grant,b)
            old=self._replay(key,digest)
            if old is not None:return old
            if permissions is not None:permissions.require(b['workspace'].session_id,'repo.write_file')
        if before_dispatch:before_dispatch()
        self._callback('write')
        with permission_lock,self._lock,self.leases._lock:
            b=self._validate(grant);w=b['workspace'];self._approved_paths(grant,b)
            if permissions is not None:permissions.require(w.session_id,'repo.write_file')
            old=self._replay(key,digest)
            if old is not None:return old
            root,identity=self.backend._workspace_root(w);target=root/relative
            parent=target.parent.relative_to(root).as_posix()
            receipts_before=dict(self._receipts);writes_before=dict(b['writes'])
            prior=None;original=None;fd=None;mutated=False;created=False;file_identity=None
            try:
                with verified_scope_guard(root,(parent,),expected_root_identity=identity):
                    prior=verified_stat(root,target,expected_root_identity=identity) if target.exists() else None
                    if prior and (not stat.S_ISREG(prior.st_mode) or prior.st_nlink!=1 or prior.st_size>1_048_576):raise LeaseError('WRITE_PATH_DENIED')
                    original=target.read_bytes() if prior else None
                    flags=os.O_RDWR|getattr(os,'O_BINARY',0)|getattr(os,'O_NOFOLLOW',0)
                    if prior is None:flags|=os.O_CREAT|os.O_EXCL
                    self._require_grant(grant)
                    fd=os.open(target,flags,0o600);created=prior is None
                    opened=os.fstat(fd);file_identity=(opened.st_dev,opened.st_ino);final=_final_descriptor_path(fd)
                    if final is None or final.resolve()!=target.resolve() or opened.st_nlink!=1 or prior and file_identity!=(prior.st_dev,prior.st_ino):raise LeaseError('WRITE_PATH_CHANGED')
                    self._require_grant(grant)
                    mutated=True;os.ftruncate(fd,0);offset=0
                    while offset<len(data):
                        size=os.write(fd,data[offset:])
                        if size<=0:raise OSError('WRITE_PUBLICATION_FAILED')
                        offset+=size
                    os.fsync(fd);closing=fd;fd=None;os.close(closing)
                    receipt={'operation':'write','request_id':request_id,'workspace_id':w.workspace_id,'baseline':w.baseline,'path':relative,'sha256':sha256(data).hexdigest(),'io_count':1}
                    b['writes'][relative]=receipt['sha256']
                    self._receipts[key]=(digest,receipt)
                return dict(receipt)
            except Exception as exc:
                self._receipts=receipts_before;b['writes']=writes_before
                exc.io_count=int(mutated or created);exc.target_restored=False
                if mutated or created:
                    try:
                        if fd is not None:closing=fd;fd=None;os.close(closing)
                        with verified_scope_guard(root,(parent,),expected_root_identity=identity):
                            current=verified_stat(root,target,expected_root_identity=identity)
                            if (current.st_dev,current.st_ino)!=file_identity:raise LeaseError('WRITE_RECOVERY_IDENTITY_CHANGED')
                            if created:target.unlink()
                            else:
                                with io.FileIO(target,'r+') as restore:
                                    restore.write(original);restore.truncate(len(original));restore.flush();restore.seek(0)
                                    if restore.read()!=original:raise LeaseError('WRITE_RECOVERY_FAILED')
                                os.utime(target,ns=(prior.st_atime_ns,prior.st_mtime_ns))
                        exc.target_restored=True
                    except Exception as failure:
                        recovery=LeaseError('WRITE_RECOVERY_REQUIRED');recovery.io_count=1
                        raise recovery from failure
                raise
            finally:
                if fd is not None:os.close(fd)

    def _approved_paths(self,grant,b):
        # Compare actual working files to HEAD, not mutable shared index staging.
        w=b['workspace'];paths=self._dirty(grant,b)
        actual=tuple(p.decode() for p in self._bound_git(b,'diff','--name-only','-z',b['head'],'--').split(b'\0') if p)
        untracked=tuple(p.decode() for p in self._bound_git(b,'ls-files','--others','--exclude-standard','-z').split(b'\0') if p)
        changed=tuple(sorted(set(actual+untracked)))
        for path in changed:
            self._path(grant,path)
            expected=b['writes'].get(path)
            if expected is None or sha256(Path(w.workspace_root,path).read_bytes()).hexdigest()!=expected:raise LeaseError('WRITE_PROVENANCE_REQUIRED')
        return changed

    def _approved_tree(self,b,paths):
        w=b['workspace'];entries={}
        for item in self._bound_git(b,'ls-tree','-r','-z',b['head']).split(b'\0'):
            if not item:continue
            meta,path=item.split(b'\t',1);mode,kind,oid=meta.split();entries[path.decode()]=(mode,kind,oid)
        for path in paths:
            data=Path(w.workspace_root,path).read_bytes()
            if sha256(data).hexdigest()!=b['writes'][path]:raise LeaseError('WRITE_PROVENANCE_REQUIRED')
            oid=self._bound_git(b,'hash-object','-w','--stdin',input_bytes=data).strip()
            mode=entries.get(path,(b'100644',))[0]
            if mode not in (b'100644',b'100755'):raise LeaseError('WRITE_PATH_DENIED')
            entries[path]=(mode,b'blob',oid)
        tree={}
        for path,entry in entries.items():
            node=tree;parts=path.split('/')
            for part in parts[:-1]:node=node.setdefault(part,{})
            node[parts[-1]]=entry
        def build(node):
            rows=[]
            for name,value in sorted(node.items()):
                mode,kind,oid=(b'040000',b'tree',build(value)) if isinstance(value,dict) else value
                rows.append(mode+b' '+kind+b' '+oid+b'\t'+name.encode()+b'\0')
            return self._bound_git(b,'mktree','-z',input_bytes=b''.join(rows)).strip()
        return build(tree).decode()

    @contextmanager
    def _object_write_guard(self,b):
        """Pin every loose-object fanout while Git object writers run."""
        if os.name!='nt':
            try:
                with verified_scope_guard(b['objects_dir'],_OBJECT_FANOUTS,
                        expected_root_identity=b['objects_root_identity']):
                    yield
            except BackendRejected as exc:
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT') from exc
            return
        import ctypes
        create=ctypes.windll.kernel32.CreateFileW
        create.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,
            ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p]
        create.restype=ctypes.c_void_p;invalid=ctypes.c_void_p(-1).value;locked=[];expected=[]
        try:
            if physical_identity(b['objects_dir'])!=b['objects_root_identity']:
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
            for name in _OBJECT_FANOUTS:
                path=b['objects_dir']/name;identity=physical_identity(path)
                handle=create(str(path),0x80000000,0x00000001|0x00000002,None,3,
                    0x02000000|0x00200000,None)
                if handle in (None,invalid):raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
                expected.append((path,identity));locked.append(handle)
            if physical_identity(b['objects_dir'])!=b['objects_root_identity']:
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
            if any(physical_identity(path)!=identity for path,identity in expected):
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
            yield
            if physical_identity(b['objects_dir'])!=b['objects_root_identity']:
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
            if any(physical_identity(path)!=identity for path,identity in expected):
                raise LeaseError('WORKSPACE_GIT_STORE_DRIFT')
        except BackendRejected as exc:
            raise LeaseError('WORKSPACE_GIT_STORE_DRIFT') from exc
        finally:
            for handle in reversed(locked):ctypes.windll.kernel32.CloseHandle(ctypes.c_void_p(handle))

    @_host_operation
    def commit(self,grant,*,request_id):
        key,digest=self._request(grant,request_id,'commit')
        with self._lock,self.leases._lock:
            self._require_grant(grant)
            old=self._replay(key,digest)
            if old is not None:return old
            b=self._validate(grant);self._dirty(grant,b)
        self._callback('commit')
        with self._lock,self.leases._lock:
            self._require_grant(grant)
            old=self._replay(key,digest)
            if old is not None:return old
            b=self._validate(grant);w=b['workspace'];paths=self._approved_paths(grant,b)
            if not paths:raise LeaseError('NO_CHANGES')
            root,identity=self.backend._workspace_root(w)
            parent=b['head'];head=None;receipts_before=dict(self._receipts)
            try:
                with verified_scope_guard(root,paths,expected_root_identity=identity):
                    with self._object_write_guard(b):
                        tree=self._approved_tree(b,paths)
                        actual=tuple(p.decode() for p in self._bound_git(b,'diff-tree','--no-commit-id','--name-only','-r','-z',parent,tree).split(b'\0') if p)
                        if actual!=paths:raise LeaseError('COMMIT_TREE_SCOPE_MISMATCH')
                        self._require_grant(grant)
                        head=self._bound_git(b,'commit-tree',tree,'-p',parent,'-m','E06 isolated verified change').decode().strip()
                    self._require_grant(grant)
                    self._publish_head(b,grant,head,parent)
                    chain=self._chain_at(b,head)
                    receipt={'operation':'commit','request_id':request_id,'workspace_id':w.workspace_id,'baseline':w.baseline,'commit':head,'parent':parent,'tree':tree,'head_kind':b['head_kind'],'head_target':b['head_target'],'final_target':chain[-1][0],'head_chain':chain,'head_chain_hash':sha256(repr(chain).encode()).hexdigest(),'changed_paths':paths,'integration':'MAIN_REVIEW_REQUIRED'}
                    self._receipts[key]=(digest,receipt)
                b['head']=head
                return dict(receipt)
            except Exception as exc:
                self._receipts=receipts_before;b['head']=parent
                if head is not None:
                    final=b['head_chain'][-1][0]
                    try:observed=self._direct_ref_oid(w,b['head_file'],final)
                    except Exception as recovery:raise LeaseError('COMMIT_RECOVERY_REQUIRED') from recovery
                    if observed==head:
                        self._restore_bound_final(b,head,parent)
                    elif observed!=parent:raise LeaseError('COMMIT_RECOVERY_REQUIRED') from exc
                raise


__all__=['WorktreeWriteService']
