# P03 R3 보존 자원 한정 관측과 SSH 진단 분류 후보

**미채택 · 새 SSH 실행 0회.** 이전 실행 f520eb는 SSH 255·0/14행·UNKNOWN_PRESERVE로 종료됐다. 당시 stderr는 보존하지 않아 원인을 확인할 수 없다. 원 실행 문서 SHA-256은 `316E965F46B4DCDC7F00AFD6ACBF744D1CDEB535DAD9EFE6CA6211B3FC98F0B5`이며 소진된 f195 승인의 효력·시각을 이월하지 않는다.

### 결정할 범위

별도 직접 승인 시 `WSL-server` SSH 1회, 고정 daemon/원 볼륨/사본 볼륨/init의 네 읽기, 요청 30초·수거 32KiB·결과 4KiB 안에서 기존 관측을 수행한다. 추가 효과는 로컬 SSH 첫 stderr 조각·spawn 전 오류를 상수로 분류해 종료 요약에 남기는 것이다. 알려진 단일 완결 문구만 분류한다. 잘린 줄, 복수 줄, 다른 문구는 UNCLASSIFIED, 수거한 stderr가 0바이트이면 NONE이다. SSH가 표시한 문구의 범주만 확인하며 원인·원격 도달을 추정하지 않는다. raw stderr, 가변 경로·호스트명·계정·도구 오류 문자열은 반환하거나 보존하지 않는다. 원문은 첫 bounded 조각의 프로세스 메모리에만 일시 존재한다.

단발 실행 예정 ID는 `anvil-r3-metadata-diagnostic-b3645a193d704fa38c61a12b44d1f74b`, 관측 run은 `b3645a193d704fa38c61a12b44d1f74b`다. 자원 label 대조에는 원 복제 run `52e1a5269d3943269a1a340ce4da54a5`를 사용한다. Main이 미래 직접 승인 기록을 정확한 JSON 경로에 보존하고 실행자와 승인 지문·검수 문서 지문을 결박한 뒤 원 단발 dispatch 절차를 적용한다. 현재 승인 파일 부재는 NOT_RUN_NO_APPROVAL이다. 재시도·재접속·추가 조회·부분 자원 정리 0회. PG/SQL·키·서비스·Agent·SDK 실행은 범위 밖이다.

Docker/Node 고정 신원과 기존 14행의 순서·형식·해석은 원 문서를 따른다. mountCapsOnly는 마운트·cap 부분만 대조한다. sshCapturedBytes는 SSH 프로세스 stdout/stderr에서 수거한 바이트 합계로 원격 Docker 호출 횟수를 뜻하지 않는다. 진단 상수는 기존 로컬 요약에만 붙으며 기존 3,500바이트 안전 행과 고정 요약 합계는 4KiB 이하다. 실제 SSH 호출은 아래 wrapper가 정확 승인 파일/sha·대상·시각·한도를 검산한 뒤에만 수행한다.

```javascript
function bounded(exe,args,{env,input,budget,outMax,remaining,diag}) {
  const {spawn}=require('node:child_process');
  return new Promise(resolve=>{
    const output=[];
    let size=0, used=0, err=false, stopped=false, done=false, child;
    const finish=(code,closed)=>{
      if(done)return;
      done=true;clearTimeout(alarm);clearTimeout(reap);
      resolve({code,closed,ok:closed&&code===0&&!stopped&&!err&&remaining()>0,
        out:Buffer.concat(output,size),used});
    };
    const stop=()=>{
      if(stopped||done)return;
      stopped=true;
      if(child.pid&&child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
    };
    const left=remaining();
    if(left<=1400){resolve({code:null,closed:false,ok:false,out:Buffer.alloc(0),used:0});return}
    try{child=spawn(exe,args,{env,windowsHide:true,stdio:[input===null?'ignore':'pipe','pipe','pipe']})}
    catch(e){if(!diag)throw e;diag.failed(e.code);resolve({code:null,closed:false,ok:false,out:Buffer.alloc(0),used:0});return}
    if(diag)child.once('spawn',()=>diag.spawned());
    const alarm=setTimeout(stop,left-1000);
    const reap=setTimeout(()=>{
      stop();child.stdin?.destroy();child.stdout.destroy();child.stderr.destroy();
      child.unref();finish(null,false);
    },left-100);
    function collect(stream,isErr){
      while(!stopped&&stream.readableLength){
        const available=Math.min(budget-used,isErr?budget-used:outMax-size);
        if(available<=0){stop();return}
        const b=stream.read(Math.min(stream.readableLength,available,2048));
        if(!b)return;
        used+=b.length;
        if(isErr){err=true;if(diag)diag.first(b,stream.readableLength>0);stop();return}
        size+=b.length;output.push(b);
      }
    }
    child.stdout.on('readable',()=>collect(child.stdout,false));
    child.stderr.on('readable',()=>collect(child.stderr,true));
    child.stdout.on('error',stop);child.stderr.on('error',stop);child.on('error',e=>{if(diag)diag.failed(e.code);stop()});
    child.on('close',code=>finish(code,true));
    if(child.stdin){child.stdin.on('error',stop);child.stdin.end(input)}
  });
}

async function observe(request,approvedAt,expiresAt) {
  const fs=require('node:fs'), pfs=fs.promises, os=require('node:os');
  const {createHash}=require('node:crypto');
  const start=performance.now(),initial=Date.now();
  const stopAt=Math.min(expiresAt-2000,request+27000);
  const duration=stopAt-initial;
  const remaining=()=>Math.min(stopAt-Date.now(),duration-(performance.now()-start));
  let stage='preflight',calls=0,collected=0,printed=0;
  function need(ok){if(!ok)throw Error('UNKNOWN')}
  function guard(){need(approvedAt<=request&&request<=Date.now()&&remaining()>0)}
  function emit(key,v){
    const row=JSON.stringify([key,v])+'\n';
    need(printed+Buffer.byteLength(row)<=3500);
    printed+=Buffer.byteLength(row);process.stdout.write(row);
  }
  const node='/opt/node-v24.21.0-linux-x64/bin/node',docker='/usr/bin/docker';
  const nodePin='7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c';
  const dockerPin='7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b';
  function sameFile(a,b){return ['dev','ino','size','ctimeNs','mtimeNs','mode','nlink','uid','gid'].every(k=>a[k]===b[k])}
  async function pinned(path,owner,digest){
    guard();
    const before=await pfs.lstat(path,{bigint:true});
    need(before.isFile()&&before.nlink===1n&&before.uid===BigInt(owner)&&
      (before.mode&0o022n)===0n&&before.size<=268435456n&&await pfs.realpath(path)===path);
    const fd=await pfs.open(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
    try{
      need(sameFile(before,await fd.stat({bigint:true})));
      const h=createHash('sha256'),buf=Buffer.alloc(65536);
      let n=0;
      while(n<Number(before.size)){
        guard();const r=await fd.read(buf,0,Math.min(buf.length,Number(before.size)-n),n);
        need(r.bytesRead>0);h.update(buf.subarray(0,r.bytesRead));n+=r.bytesRead;
      }
      need(sameFile(before,await fd.stat({bigint:true}))&&h.digest('hex')===digest);
    }finally{await fd.close()}
    need(sameFile(before,await pfs.lstat(path,{bigint:true})));guard();
    return before;
  }
  async function checkDocker(){
    for(const dir of ['/','/usr','/usr/bin']){
      const s=await pfs.lstat(dir);
      need(s.isDirectory()&&s.uid===0&&(s.mode&0o022)===0&&await pfs.realpath(dir)===dir);
    }
    await pinned(docker,0,dockerPin);
  }
  const id='99cc99d63c6283d8dc9dc3a3dab36be35d25a3e2009b373e2a8c7dff04ed6097';
  const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f';
  const run='52e1a5269d3943269a1a340ce4da54a5',sid='dc22a0629e79f259dcd935845e88e58e';
  const src='anvil-v3-development-pgdata',copy='anvil-v3-pgdata-recovery-20261028-r3';
  const format=xs=>'['+xs.map(x=>'{{json '+x+'}}').join(',')+']';
  // json receives only explicitly named fields. Label names outside the fixed set are never returned.
  const labelFields=(m,ls)=>['(len '+m+')',...Object.keys(ls).map(k=>'(index '+m+' '+JSON.stringify(k)+')')];
  const matches=(actual,expected)=>JSON.stringify(actual)===JSON.stringify(expected);
  async function get(op,fmt,target){
    guard();need(calls<4);await checkDocker();guard();calls++;
    const a=['--host','unix:///var/run/docker.sock',...op,'--format',fmt,...(target?[target]:[])];
    const r=await bounded(docker,a,{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',DOCKER_CONFIG:'/nonexistent'},input:null,
      budget:24576-collected,outMax:24576-collected,remaining});
    collected+=r.used;need(r.ok);await checkDocker();guard();
    return JSON.parse(r.out.toString('utf8'));
  }
  function identity(ok){
    if(!ok){emit(stage,'MISMATCH');throw Error('IDENTITY_MISMATCH')}
    emit(stage,'MATCH');
  }
  async function volume(name,created,ls,withMount){
    const f=['.Name','.Driver','.Scope','.CreatedAt',...labelFields('.Labels',ls)];
    if(withMount)f.push('.Mountpoint');
    const v=await get(['volume','inspect'],format(f),name);
    need(Array.isArray(v)&&v.length===f.length);
    identity(matches(v.slice(0,4+Object.keys(ls).length+1),
      [name,'local','local',created,Object.keys(ls).length,...Object.values(ls)]));
    if(withMount){
      const mp=v.at(-1);need(typeof mp==='string'&&mp.startsWith('/')&&mp.length<=4096&&require('node:path').posix.normalize(mp)===mp);
      return mp;
    }
  }
  function record(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)}
  function shape(v,keys){
    if(!record(v))return v===null?'NULL':'OTHER';
    return Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))?'KEYS_MATCH':'KEYS_MISMATCH';
  }
  function field(v,k,values,codes){
    if(!record(v))return 'NOT_OBSERVED';
    if(!Object.hasOwn(v,k))return 'ABSENT';
    if(v[k]===null)return 'NULL';
    const i=values.findIndex(x=>matches(x,v[k]));return i<0?'OTHER':codes[i];
  }
  function count(v){return Array.isArray(v)?v.length:v===null?'NULL_OR_ABSENT':'OTHER'}
  function entry(v){return Array.isArray(v)&&v.length===1?v[0]:undefined}
  function fields(key,v,ks,expected){
    emit(key,[shape(v,ks),record(v)?Object.keys(v).length:'NOT_OBSERVED',...ks.filter(k=>Object.hasOwn(expected,k)).map(k=>field(v,k,...expected[k]))]);
  }
  try{
    guard();need(process.platform==='linux'&&process.getuid()===1000&&process.getgid()===1000&&os.hostname()==='SINSAN'&&os.userInfo().username==='daon');
    need(await pfs.realpath('/proc/self/exe')===node);
    const self=await pinned(node,1001,nodePin);
    need(sameFile(self,await pfs.stat('/proc/self/exe',{bigint:true})));
    emit('time',Math.floor(Date.now()/1000));emit('preflight','MATCH');
    stage='daemon';identity(matches(await get(['info'],format(['.ID']),null),['e3349f1d-dbfc-478a-96d9-295bf6c6839e']));
    stage='sourceVolume';await volume(src,'2026-10-16T03:53:33+09:00',{'anvil.project':'v3','anvil.owner':'P03','anvil.instance':sid},false);
    stage='copyVolume';const mp=await volume(copy,'2026-11-16T00:42:17+09:00',{'anvil.project':'v3','anvil.owner':'project-main','anvil.instance':run,'anvil.role':'copy-volume','anvil.source-instance':sid},true);
    stage='init';const ls={'anvil.project':'v3','anvil.owner':'project-main','anvil.instance':run,'anvil.role':'init'};
    const f=['.Id','.Name','.Image','.State.Status','.State.Running','.State.StartedAt','.State.FinishedAt',...labelFields('.Config.Labels',ls),
      '.HostConfig.Mounts','.HostConfig.Tmpfs','.Mounts','.HostConfig.CapAdd','.HostConfig.CapDrop'];
    const values=await get(['container','inspect'],format(f),id);
    need(Array.isArray(values)&&values.length===f.length);
    const z='0001-01-01T00:00:00Z';
    identity(matches(values.slice(0,-5),[id,'/anvil-v3-pgcopy-init-20261028-r3',image,'created',false,z,z,4,...Object.values(ls)]));
    const [hm,t,rm,add,drop]=values.slice(-5),h=entry(hm),m=entry(rm),v=record(h)?h.VolumeOptions:undefined;
    const hk=['Type','Source','Target','ReadOnly','VolumeOptions'],mk=['Type','Name','Source','Destination','Driver','Mode','RW','Propagation'];
    const mount='/anvil-recovery-copy',tmp='/var/lib/postgresql/data',spec='rw,noexec,nosuid,nodev,size=33554432,uid=0,gid=0,mode=0700';
    emit('mountCounts',[count(hm),count(rm)]);
    fields('host',h,hk,{Type:[['volume'],['MATCH']],Source:[[copy],['MATCH']],Target:[[mount],['MATCH']],ReadOnly:[[false,true],['FALSE','TRUE']]});
    emit('volumeOptions',[!record(h)?'NOT_OBSERVED':!Object.hasOwn(h,'VolumeOptions')?'ABSENT':shape(v,['NoCopy']),record(v)?Object.keys(v).length:'NOT_OBSERVED',field(v,'NoCopy',[true,false],['TRUE','FALSE'])]);
    fields('tmpfs',t,[tmp],{[tmp]:[[spec],['MATCH']]});
    fields('runtime',m,mk,{Type:[['volume'],['MATCH']],Name:[[copy],['MATCH']],Source:[[mp],['MATCH']],Destination:[[mount],['MATCH']],Driver:[['local'],['MATCH']],Mode:[['','rw'],['EMPTY','RW']],RW:[[true,false],['TRUE','FALSE']],Propagation:[['','rprivate'],['EMPTY','RPRIVATE']]});
    const ca=matches(add,['CHOWN'])?'CHOWN':matches(add,['CAP_CHOWN'])?'CAP_CHOWN':add===null?'NULL_OR_ABSENT':'OTHER';
    const cd=matches(drop,['ALL'])?'ALL':drop===null?'NULL_OR_ABSENT':'OTHER';
    emit('caps',[ca,cd]);
    const hmOK=shape(h,hk)==='KEYS_MATCH'&&h.Type==='volume'&&h.Source===copy&&h.Target===mount&&h.ReadOnly===false&&shape(v,['NoCopy'])==='KEYS_MATCH'&&v.NoCopy===true;
    const tOK=shape(t,[tmp])==='KEYS_MATCH'&&t[tmp]===spec;
    const rmOK=shape(m,mk)==='KEYS_MATCH'&&m.Type==='volume'&&m.Name===copy&&m.Source===mp&&m.Destination===mount&&m.Driver==='local'&&['','rw'].includes(m.Mode)&&m.RW===true&&['','rprivate'].includes(m.Propagation);
    const base=hmOK&&tOK&&rmOK&&cd==='ALL',old=base&&ca==='CHOWN',current=base&&['CHOWN','CAP_CHOWN'].includes(ca);
    guard();emit('mountCapsOnly',[old?'MATCH':'MISMATCH',current?'MATCH':'MISMATCH',current?'MATCH':'MISMATCH']);emit('finished','MATCH');
  }catch(e){if(e.message!=='IDENTITY_MISMATCH')emit(stage,'UNKNOWN');process.exitCode=2}
}

function readRows(out,approved,expires){
  const keys=['time','preflight','daemon','sourceVolume','copyVolume','init','mountCounts','host','volumeOptions','tmpfs','runtime','caps','mountCapsOnly','finished'];
  const count=v=>Number.isSafeInteger(v)&&v>=0&&v<=24576;
  const one=(...allowed)=>v=>allowed.includes(v);
  const numberOrMissing=v=>count(v)||v==='NOT_OBSERVED';
  const arrayCount=v=>count(v)||v==='NULL_OR_ABSENT'||v==='OTHER';
  const shape=one('KEYS_MATCH','KEYS_MISMATCH','NULL','OTHER');
  const flag=(...ok)=>one(...ok,'ABSENT','NULL','OTHER','NOT_OBSERVED');
  const eq=flag('MATCH'),bool=flag('TRUE','FALSE'),decision=one('MATCH','MISMATCH');
  const schemas={
    mountCounts:[arrayCount,arrayCount],host:[shape,numberOrMissing,eq,eq,eq,bool],
    volumeOptions:[one('KEYS_MATCH','KEYS_MISMATCH','NULL','OTHER','ABSENT','NOT_OBSERVED'),numberOrMissing,bool],
    tmpfs:[shape,numberOrMissing,eq],
    runtime:[shape,numberOrMissing,eq,eq,eq,eq,eq,flag('EMPTY','RW'),bool,flag('EMPTY','RPRIVATE')],
    caps:[one('CHOWN','CAP_CHOWN','NULL_OR_ABSENT','OTHER'),one('ALL','NULL_OR_ABSENT','OTHER')],
    mountCapsOnly:[decision,decision,decision]
  };
  const rows=[];let complete=true,bytes=0;
  const lines=out.toString('utf8').split('\n');
  if(lines.pop()!=='')complete=false;
  for(const line of lines){
    try{
      const row=JSON.parse(line);
      if(!Array.isArray(row)||row.length!==2)throw Error();
      const [k,v]=row;
      if(['preflight','daemon','sourceVolume','copyVolume','init'].includes(k)&&one('UNKNOWN','MISMATCH')(v)){
        rows.push([k,v]);complete=false;break;
      }
      if(rows.length>=keys.length||k!==keys[rows.length])throw Error();
      if(k==='time'){
        if(!Number.isSafeInteger(v)||v<Math.floor(approved/1000)||v>=expires/1000)throw Error();
      }else if(Object.hasOwn(schemas,k)){
        const spec=schemas[k];
        if(!Array.isArray(v)||v.length!==spec.length||!spec.every((accept,i)=>accept(v[i])))throw Error();
      }else if(v!=='MATCH')throw Error();
      bytes+=Buffer.byteLength(JSON.stringify(row))+1;if(bytes>3500)throw Error();
      rows.push(row);
    }catch{complete=false;break}
  }
  return {rows,complete:complete&&rows.length===keys.length};
}
function sshDiagnostics(){
  let spawned=false,spawnError='NONE',stderrClass='NONE';
  return {
    spawned(){spawned=true},
    failed(code){if(!spawned&&spawnError==='NONE')spawnError=['ENOENT','EACCES','EPERM'].includes(code)?code:'OTHER'},
    first(chunk,more){
      if(stderrClass!=='NONE')return;
      stderrClass='UNCLASSIFIED';
      if(more||!chunk.length||chunk.at(-1)!==10)return;
      let line=chunk.subarray(0,-1);
      if(line.at(-1)===13)line=line.subarray(0,-1);
      if(line.includes(10)||line.includes(13))return;
      const s=line.toString('latin1');
      if(s==='Host key verification failed.')stderrClass='SSH_REPORTED_HOST_KEY_VERIFICATION_FAILED';
      else if(/^ssh: connect to host [A-Za-z0-9.:%_-]+ port [0-9]{1,5}: Connection refused$/.test(s))stderrClass='SSH_REPORTED_CONNECTION_REFUSED';
      else if(/^[A-Za-z0-9_.-]{1,64}@[A-Za-z0-9.:%_-]{1,253}: Permission denied \((?:publickey|password|keyboard-interactive|hostbased|gssapi-with-mic)(?:,(?:publickey|password|keyboard-interactive|hostbased|gssapi-with-mic)){0,4}\)\.$/.test(s))stderrClass='SSH_REPORTED_PERMISSION_DENIED';
      else if(/^ssh: Could not resolve hostname [A-Za-z0-9.:%_-]{1,253}: (?:Name or service not known|Temporary failure in name resolution|No such host is known\.)$/.test(s))stderrClass='SSH_REPORTED_HOSTNAME_RESOLUTION_FAILED';
      else if(/^ssh: connect to host [A-Za-z0-9.:%_-]{1,253} port [0-9]{1,5}: Connection timed out$/.test(s))stderrClass='SSH_REPORTED_CONNECTION_TIMED_OUT';
    },
    summary(used){return {sshSpawnError:spawnError,sshStderrClass:stderrClass,sshCapturedBytes:used}}
  };
}
async function main(){
  const cp='C:\\Windows\\System32\\OpenSSH\\ssh.exe';
  const args=['-T','-oBatchMode=yes','-oStrictHostKeyChecking=yes','-oUpdateHostKeys=no','-oControlMaster=no','-oControlPath=none','-oConnectTimeout=6','-oConnectionAttempts=1','-oForwardAgent=no','-oClearAllForwardings=yes','WSL-server','/bin/bash','--noprofile','--norc','-s'];
  const argv=process.argv.slice(2);
  if(argv.length!==2||!argv.every(v=>/^[1-9][0-9]{12}$/.test(v))){console.log('NOT_RUN_WINDOW');process.exitCode=2;return}
  const [approved,expires]=argv.map(Number);
  if(expires<=approved||expires-approved>1800000){console.log('NOT_RUN_WINDOW');process.exitCode=2;return}
  const now=Date.now(),mono=performance.now(),max=Math.min(30000,expires-now);
  const remaining=()=>Math.min(expires-Date.now(),now+30000-Date.now(),max-(performance.now()-mono));
  if(now<approved||remaining()<5000){console.log('NOT_RUN_WINDOW');process.exitCode=2;return}
  const code=bounded.toString()+'\n'+observe.toString()+'\nobserve('+now+','+approved+','+expires+').catch(()=>{process.exitCode=2});';
  const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
  const pre=[
    'set -euo pipefail',
    'NODE=/opt/node-v24.21.0-linux-x64/bin/node',
    "for spec in '/:0:0:755' '/opt:0:0:755' '/opt/node-v24.21.0-linux-x64:1001:1001:755' '/opt/node-v24.21.0-linux-x64/bin:1001:1001:755'; do",
    ' dir=${spec%%:*}; want=${spec#*:}',
    ' [[ -d "$dir" && ! -L "$dir" && $(/usr/bin/readlink -e -- "$dir") == "$dir" && $(/usr/bin/stat -c "%u:%g:%a" -- "$dir") == "$want" ]] || exit 2',
    'done',
    '[[ -f "$NODE" && ! -L "$NODE" && $(/usr/bin/readlink -e -- "$NODE") == "$NODE" && $(/usr/bin/stat -c "%u:%g:%a:%h" -- "$NODE") == 1001:1001:755:1 ]] || exit 2',
    'before=$(/usr/bin/stat -c "%d:%i:%s:%y:%u:%g:%a:%h" -- "$NODE")',
    '[[ $(/usr/bin/sha256sum -- "$NODE") == "7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c  $NODE" && $(/usr/bin/stat -c "%d:%i:%s:%y:%u:%g:%a:%h" -- "$NODE") == "$before" ]] || exit 2',
    'exec "$NODE" -e '+quote(code)
  ].join('\n');
  const input='exec /usr/bin/env -i PATH=/usr/bin:/bin LANG=C LC_ALL=C /bin/bash --noprofile --norc -c '+quote(pre)+'\n';
  const sshEnv={};
  for(const key of ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH']){
    if(process.env[key]!==undefined)sshEnv[key]=process.env[key];
  }
  const diag=sshDiagnostics();
  const r=await bounded(cp,args,{env:sshEnv,input,budget:4096,outMax:3500,remaining,diag});
  const parsed=readRows(r.out,approved,expires);
  for(const row of parsed.rows)console.log(JSON.stringify(row));
  const ok=r.ok&&parsed.complete&&remaining()>0;
  console.log(JSON.stringify({run:'b3645a193d704fa38c61a12b44d1f74b',sshClosed:r.closed,sshExit:r.code,...diag.summary(r.used),result:ok?'OBSERVATION_CLOSED':'UNKNOWN_PRESERVE'}));
  process.exitCode=ok?0:2;
}
main().catch(()=>{console.log('UNKNOWN_PRESERVE');process.exitCode=2});
```

### 고정 PowerShell 7 실행부

ReviewedSha256과 ExpectedApprovalSha256은 Main이 검수·직접 승인 기록을 통해 각각 제공한다. firstObservedAt/expiresAt은 UTC 밀리초 정밀 ISO 원문이다. 신규 승인 JSON의 candidate에는 이 문서의 저장소 상대경로, candidateSha256에는 검수본 지문을 기록한다. 기존 원격 관측 범위 후보 0ED884E3 지문도 별도로 대조한다.

```powershell
param([Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ReviewedSha256,
      [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedApprovalSha256)
$ErrorActionPreference='Stop'
$doc='docs/work_packages/P03_R3_METADATA_DIAGNOSTIC_FOLLOWUP_CANDIDATE_20261116.md'
$approval='docs/approvals/anvil-r3-metadata-diagnostic-b3645a193d704fa38c61a12b44d1f74b.json'
$candidate='docs/work_packages/P03_R3_PRESERVED_RESOURCE_NEXT_ACTION_CANDIDATE_20261116.md'
$bytes=[IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $doc).Path)
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) -ne $ReviewedSha256){throw 'REVIEWED_SOURCE_MISMATCH'}
if(!(Test-Path -LiteralPath $approval -PathType Leaf)){Write-Output 'NOT_RUN_NO_APPROVAL';exit 2}
$approvalBytes=[IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $approval).Path)
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($approvalBytes)) -ne $ExpectedApprovalSha256){throw 'APPROVAL_MISMATCH'}
$parsed=[System.Text.Json.JsonDocument]::Parse([Text.UTF8Encoding]::new($false,$true).GetString($approvalBytes))
try{
  $root=$parsed.RootElement
  if($root.ValueKind -ne 'Object'){throw 'APPROVAL_SHAPE_INVALID'}
  $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach($field in $root.EnumerateObject()){if(!$seen.Add($field.Name)){throw 'APPROVAL_DUPLICATE'}}
  $bound=@{
    authority='USER_DIRECT';approvalId='anvil-r3-metadata-diagnostic-b3645a193d704fa38c61a12b44d1f74b'
    runInstance='b3645a193d704fa38c61a12b44d1f74b';candidate=$doc
    sshAlias='WSL-server';executor='d2_preflight';initId='99cc99d63c6283d8dc9dc3a3dab36be35d25a3e2009b373e2a8c7dff04ed6097'
    sourceVolume='anvil-v3-development-pgdata';copyVolume='anvil-v3-pgdata-recovery-20261028-r3'
  }
  foreach($key in $bound.Keys){if($root.GetProperty($key).GetString() -cne $bound[$key]){throw 'APPROVAL_BINDING_INVALID'}}
  if($root.GetProperty('candidateSha256').GetString() -ine $ReviewedSha256){throw 'APPROVAL_CODE_MISMATCH'}
  $limits=@{sshConnectionsMax=1;dockerReadCallsMax=4;requestSecondsMax=30;captureBytesMax=32768;resultBytesMax=4096}
  foreach($key in $limits.Keys){if($root.GetProperty($key).GetInt32() -ne $limits[$key]){throw 'APPROVAL_LIMIT_INVALID'}}
  $timeFormat="yyyy-MM-dd'T'HH:mm:ss.fff'Z'"
  $culture=[Globalization.CultureInfo]::InvariantCulture
  $style=[Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
  $first=[DateTimeOffset]::ParseExact($root.GetProperty('firstObservedAt').GetString(),$timeFormat,$culture,$style)
  $expiry=[DateTimeOffset]::ParseExact($root.GetProperty('expiresAt').GetString(),$timeFormat,$culture,$style)
  $at=[DateTimeOffset]::UtcNow
  if($first -gt $at -or $expiry -le $at -or $expiry -le $first -or ($expiry-$first).TotalMilliseconds -gt 1800000){throw 'NOT_RUN_WINDOW'}
}finally{$parsed.Dispose()}
if((Get-FileHash -LiteralPath $candidate).Hash -ne '0ED884E382AB328B6280658485EFACE6EEAABF9E7DD9BDBFC4574CFDE7613C75'){throw 'CANDIDATE_MISMATCH'}
$fence=[char]96
$triple=([string]$fence)*3
$pattern='(?ms)^'+$triple+'javascript\r?\n(?<code>.*?)\r?\n'+$triple+'\r?$'
$blocks=[regex]::Matches([Text.Encoding]::UTF8.GetString($bytes),$pattern)
if($blocks.Count -ne 1){throw 'REVIEWED_BLOCK_INVALID'}
$psi=[Diagnostics.ProcessStartInfo]::new()
$psi.FileName='C:\Program Files\nodejs\node.exe'
$psi.ArgumentList.Add('-')
$psi.ArgumentList.Add($first.ToUnixTimeMilliseconds().ToString($culture))
$psi.ArgumentList.Add($expiry.ToUnixTimeMilliseconds().ToString($culture))
$psi.UseShellExecute=$false
$psi.RedirectStandardInput=$true
$psi.StandardInputEncoding=[Text.UTF8Encoding]::new($false)
$psi.Environment.Clear()
foreach($key in 'SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH'){
  $value=[Environment]::GetEnvironmentVariable($key)
  if($null -ne $value){$psi.Environment[$key]=$value}
}
$windowMs=[Math]::Min(30000,[Math]::Floor(($expiry-[DateTimeOffset]::UtcNow).TotalMilliseconds))
if($windowMs -lt 5000){throw 'NOT_RUN_WINDOW'}
$timer=[Diagnostics.Stopwatch]::StartNew()
function LeftMs([int]$reserve){
  $value=[Math]::Min($windowMs-$timer.ElapsedMilliseconds,($expiry-[DateTimeOffset]::UtcNow).TotalMilliseconds)
  return [int][Math]::Max(0,[Math]::Floor($value-$reserve))
}
$proc=[Diagnostics.Process]::Start($psi)
$rc=2
try{
  $send=$proc.StandardInput.WriteAsync($blocks[0].Groups['code'].Value)
  if(!$send.Wait((LeftMs 1400))){throw 'SEND_DEADLINE'}
  $flush=$proc.StandardInput.FlushAsync()
  if(!$flush.Wait((LeftMs 1400))){throw 'FLUSH_DEADLINE'}
  $proc.StandardInput.Close()
  if(!$proc.WaitForExit((LeftMs 300))){throw 'CLOSE_DEADLINE'}
  $rc=$proc.ExitCode
}catch{
  if(!$proc.HasExited){
    try{$proc.Kill()}catch{}
  }
  $closed=$proc.WaitForExit((LeftMs 0))
  Write-Output ('UNKNOWN_PRESERVE localNodeClosed='+$closed)
}finally{$proc.Dispose()}
exit $rc
```
