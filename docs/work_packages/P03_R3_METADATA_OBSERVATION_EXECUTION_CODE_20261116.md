# P03 R3 보존 자원 한정 관측 실행 코드

검토용 고정본. 직접 승인 `anvil-r3-metadata-f1957b3dc03d4f869dd4ddd5e0a11680`과 후보 `0ED884E382AB328B6280658485EFACE6EEAABF9E7DD9BDBFC4574CFDE7613C75` 적용. Main의 추가 GO 이전 실행 0. 파일 자체에는 관측 결과가 없다.

아래 javascript 단일 블록은 Windows 고정 `C:\Program Files\nodejs\node.exe -`의 표준입력이다. GO 때 Main이 검수한 이 문서 bytes SHA256과 승인 JSON·후보 SHA256을 로컬에서 대조하고 같은 문서 bytes에서 이 블록만 추출한다. Windows driver는 JS 함수 원문을 메모리에서 고정 Node용 명령으로 구성한다. Python·임시 파일·원격 ledger 접근 0. shell 도구는 기존 고정 Node의 경로·소유·권한·원바이트 지문 대조 전용이다. Docker의 고정 필드 투영은 원격 프로세스 안에서만 읽고 실제 경로·원시 JSON·원 stderr를 반환하지 않는다.

출력 `mountCounts`는 HostConfig.Mounts와 runtime Mounts의 순서다. `host`는 정확 키 집합·키 수·Type/Source/Target/ReadOnly, `volumeOptions`는 키 집합·수·NoCopy, `tmpfs`는 키 집합·수·지정 키의 값, `runtime`은 키 집합·수·Type/Name/Source/Destination/Driver/Mode/RW/Propagation 순서다. 중첩 객체 own key의 누락·null·false를 구분한다. Go 템플릿의 최상위 필드 투영 null은 누락과 구분 불가로 표시한다. `mountCapsOnly`는 8d limited·3858 limited·3858 strict의 **마운트와 capability 조건만** 대조한다. SSH 종료 결과와 신원·조건 판정을 구분한다.

```javascript
function bounded(exe,args,{env,input,budget,outMax,remaining}) {
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
    child=spawn(exe,args,{env,windowsHide:true,stdio:[input===null?'ignore':'pipe','pipe','pipe']});
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
        if(isErr){err=true;stop();return}
        size+=b.length;output.push(b);
      }
    }
    child.stdout.on('readable',()=>collect(child.stdout,false));
    child.stderr.on('readable',()=>collect(child.stderr,true));
    child.stdout.on('error',stop);child.stderr.on('error',stop);child.on('error',stop);
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
        if(!Number.isSafeInteger(v)||v<approved/1000||v>=expires/1000)throw Error();
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
async function main(){
  const cp='C:\\Windows\\System32\\OpenSSH\\ssh.exe';
  const args=['-T','-oBatchMode=yes','-oStrictHostKeyChecking=yes','-oUpdateHostKeys=no','-oControlMaster=no','-oControlPath=none','-oConnectTimeout=6','-oConnectionAttempts=1','-oForwardAgent=no','-oClearAllForwardings=yes','WSL-server','/bin/bash','--noprofile','--norc','-s'];
  const approved=Date.parse('2026-11-15T16:33:44Z'),expires=Date.parse('2026-11-15T17:03:44Z');
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
  const r=await bounded(cp,args,{env:sshEnv,input,budget:4096,outMax:3500,remaining});
  const parsed=readRows(r.out,approved,expires);
  for(const row of parsed.rows)console.log(JSON.stringify(row));
  const ok=r.ok&&parsed.complete&&remaining()>0;
  console.log(JSON.stringify({run:'f1957b3dc03d4f869dd4ddd5e0a11680',sshClosed:r.closed,sshExit:r.code,result:ok?'OBSERVATION_CLOSED':'UNKNOWN_PRESERVE'}));
  process.exitCode=ok?0:2;
}
main().catch(()=>{console.log('UNKNOWN_PRESERVE');process.exitCode=2});
```

Main GO 뒤 Windows PowerShell 7에서 아래 블록에 독립 검수자가 확인한 최종 문서 SHA-256을 인자로 전달한다. 승인·후보·문서 동일성을 확인한 로컬 Node와 SSH 자식에 명시한 Windows 환경변수의 기존 값만 전달한다.

```powershell
param([Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ReviewedSha256)
$ErrorActionPreference='Stop'
$doc='docs/work_packages/P03_R3_METADATA_OBSERVATION_EXECUTION_CODE_20261116.md'
$approval='docs/approvals/anvil-r3-metadata-f1957b3dc03d4f869dd4ddd5e0a11680.json'
$candidate='docs/work_packages/P03_R3_PRESERVED_RESOURCE_NEXT_ACTION_CANDIDATE_20261116.md'
$bytes=[IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $doc).Path)
if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) -ne $ReviewedSha256){throw 'REVIEWED_SOURCE_MISMATCH'}
if((Get-FileHash -LiteralPath $approval).Hash -ne '72AFBA0822F05BD19B07DB1B365B5188BB3403429445D18333026DD4BC5BC1A9'){throw 'APPROVAL_MISMATCH'}
if((Get-FileHash -LiteralPath $candidate).Hash -ne '0ED884E382AB328B6280658485EFACE6EEAABF9E7DD9BDBFC4574CFDE7613C75'){throw 'CANDIDATE_MISMATCH'}
$fence=[char]96
$triple=([string]$fence)*3
$pattern='(?ms)^'+$triple+'javascript\r?\n(?<code>.*?)\r?\n'+$triple+'\r?$'
$blocks=[regex]::Matches([Text.Encoding]::UTF8.GetString($bytes),$pattern)
if($blocks.Count -ne 1){throw 'REVIEWED_BLOCK_INVALID'}
$psi=[Diagnostics.ProcessStartInfo]::new()
$psi.FileName='C:\Program Files\nodejs\node.exe'
$psi.ArgumentList.Add('-')
$psi.UseShellExecute=$false
$psi.RedirectStandardInput=$true
$psi.StandardInputEncoding=[Text.UTF8Encoding]::new($false)
$psi.Environment.Clear()
foreach($key in 'SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','PATH'){
  $value=[Environment]::GetEnvironmentVariable($key)
  if($null -ne $value){$psi.Environment[$key]=$value}
}
$expiry=[DateTimeOffset]::Parse('2026-11-15T17:03:44Z')
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
