import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const controller=new URL('../../../scripts/p03-pg-copy-host.ts',import.meta.url),shell=new URL('../../../scripts/pg-recovery-copy.sh',import.meta.url),bash='C:/Program Files/Git/bin/bash.exe';
async function subject():Promise<any>{assert(existsSync(controller),'COPY_HOST_SOURCE_MISSING: 신규 COPY 결과 parser 부재');return import(controller.href);}
function shellBytes(){assert(existsSync(shell),'COPY_SHELL_SOURCE_MISSING: 신규 COPY shell 부재');return readFileSync(shell);}
const digest=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
function invoke(command:string,input:Buffer=Buffer.alloc(0)){shellBytes();assert(existsSync(bash),'EXACT_GIT_BASH_UNAVAILABLE');const path=fileURLToPath(shell).replaceAll('\\','/').replace(/^([A-Za-z]):/,(_,drive:string)=>'/'+drive.toLowerCase());const r=spawnSync(bash,['--noprofile','--norc','-c',`source '${path}'; ${command}`],{input,encoding:'buffer',env:{SystemRoot:process.env.SystemRoot,PATH:'C:/Program Files/Git/usr/bin;C:/Program Files/Git/bin',BASH_ENV:'',ENV:'',LC_ALL:'C'},timeout:15000,maxBuffer:16384,windowsHide:true});assert.equal(r.error,undefined);assert.equal(r.stderr.length,0,'원문 stderr 금지');return r;}
// NUL 종료 record: kind uid gid octalMode seconds.nanoseconds size digest relativePath\0.
// path는 마지막 필드의 raw bytes라 공백·개행·탭·구분문자·비UTF8을 재해석하지 않는다.
// END entries logicalBytes\0은 필수이며 중복·누락·추가 frame을 정상화하지 않는다.
const record=(kind:string,path:Buffer|string,size=0)=>Buffer.concat([Buffer.from(`${kind} 999 999 ${kind==='d'?'700':'600'} 1700000000.123456789 ${size} ${kind==='d'?'-':'a'.repeat(64)} `),typeof path==='string'?Buffer.from(path):path,Buffer.from([0])]);
function frames(path:Buffer|string='normal'){return Buffer.concat([record('d','.'),record('d','empty directory'),record('f',path,5),Buffer.from('END 3 5\0')]);}
function aggregate(input:Buffer){const r=invoke('p03_copy_frames',input),lines=r.stdout.toString('utf8').trimEnd().split('\n');assert.equal(lines.shift(),'PREPARATION_ONLY');const summary=JSON.parse(lines.join('\n'));return{code:r.status,summary,stdout:r.stdout.toString('utf8')};}

function report(){const observed={entries:3,regularEntries:1,directoryEntries:2,regularLogicalBytes:5,manifestSha256:'2'.repeat(64),selectedMetadataSha256:'3'.repeat(64)};return{status:'PROTECTED_COPY_VERIFIED',complete:true,sourceIdentity:{name:'anvil-v3-development-pgdata',instance:'dc22a0629e79f259dcd935845e88e58e',createdAt:'2026-10-16T03:53:33+09:00'},copyIdentity:{name:'anvil-v3-pgdata-recovery-20261028-r2',instance:'d'.repeat(32)},sourceBefore:{...observed},sourceAfter:{...observed},copy:{...observed},sourceConsumersBefore:[],sourceConsumersAfter:[],writer:{status:'CONTROLLED',windowEvidenceSha256:'4'.repeat(64)},metadata:{acl:'NONE_VERIFIED',xattr:'NONE_VERIFIED',allUid:999,allGid:999,symlinks:0,special:0,hardlinks:0,externalMounts:0},capacity:{availableBytes:1073741824,availableInodes:1000000,quotaStatus:'ENFORCED',allocationLimitBytes:536870912,reserveBytes:134217728,manifestLimitBytes:33554432},contentVerified:true,selectedMetadataVerified:true,pointInTimeConsistencyProven:false,postgresStarted:false};}

test('새 COPY shell source 존재/LF·준비 기본모드는 원내용/probe/init/copy를 시작하지 않는다',()=>{const bytes=shellBytes();assert(!bytes.includes(13),'shell LF 필수');const r=invoke(':');assert.equal(r.status,0);assert.equal(r.stdout.toString('utf8'),'PREPARATION_ONLY\n');});
test('NUL frame은 root·빈directory·mtime nanosecond·file길이와 raw 경로를 누락 없이 집계한다',()=>{const input=frames('private file\nwith\ttab | delimiter'),r=aggregate(input);assert.equal(r.code,0);assert.deepEqual(r.summary,{status:'COPY_FRAMES_VALID',complete:true,entries:3,regularEntries:1,directoryEntries:2,regularLogicalBytes:5,manifestSha256:digest(input)});assert(!r.stdout.includes('private file'));assert(!r.stdout.includes('a'.repeat(64)));});
test('비UTF8 path bytes도 UTF8 replacement 없이 전체지문에 결박한다',()=>{const input=frames(Buffer.from([0x66,0xff,0xfe,0x0a,0x09,0x20,0x7c])),r=aggregate(input);assert.equal(r.code,0);assert.equal(r.summary.manifestSha256,digest(input));assert(!r.stdout.includes('\uFFFD'));});
test('NUL raw path의 shell 확장문자는 실행/재해석 없이 원bytes 지문으로만 집계한다',()=>{const literal=Buffer.from('literal $() \x60\x60 $var \"double\" \'single\' * ? [ab] {a,b} ; | & > < \\ end','utf8'),input=frames(literal),r=aggregate(input);assert.equal(r.code,0);assert.equal(r.summary.manifestSha256,digest(input));assert.equal(r.summary.entries,3);assert(!r.stdout.includes('literal'));assert(!r.stdout.includes('$var'));});
test('정상도구 exit0/빈manifest·END누락·부분NUL·종결뒤 자료는 합격이 아니다',()=>{for(const input of [Buffer.alloc(0),Buffer.from('END 0 0\0'),record('d','.'),frames().subarray(0,-1),Buffer.concat([frames(),record('f','late',1)])]){const r=aggregate(input);assert.notEqual(r.code,0);assert.equal(r.summary.complete,false);assert.equal(typeof r.summary.status,'string');assert(!('manifestSha256'in r.summary));}});
test('중복path·root누락·상위/절대경로·특수/link·숫자overflow·길이합산 불일치는 비밀없이 닫힌다',()=>{const end=(a:Buffer,count=2,size=5)=>Buffer.concat([a,Buffer.from(`END ${count} ${size}\0`)]);const cases=[end(Buffer.concat([record('d','.'),record('d','.')]),2,0),end(record('f','private missing root',5),1,5),end(Buffer.concat([record('d','.'),record('f','../private',5)])),end(Buffer.concat([record('d','.'),record('f','/private',5)])),end(Buffer.concat([record('d','.'),record('l','private',5)])),Buffer.from('d 999 999 700 1700000000.123456789 0 - .\0f 999 999 600 1700000000.123456789 9007199254740992 '+ 'a'.repeat(64)+' private\0END 2 5\0'),Buffer.concat([record('d','.'),record('f','private',5),Buffer.from('END 2 6\0')])];for(const input of cases){const r=aggregate(input);assert.notEqual(r.code,0);assert.equal(r.summary.complete,false);assert(!r.stdout.includes('private'));assert(!r.stdout.includes('a'.repeat(64)));}});
test('COPY result는 원본전후/사본 내용 및 선정metadata 일치만 수락하고 PG/시점일관성을 주장하지 않는다',async()=>{const h=await subject(),v=report();assert.deepEqual(h.parseCopyResult(JSON.stringify(v)),v);assert.equal(v.pointInTimeConsistencyProven,false);assert.equal(v.postgresStarted,false);});
test('result parser는 닫힌key/enum·소유/ACL/xattr/writer/quota 미확인·수량/용량상한을 거절한다',async()=>{const h=await subject(),changes=[(v:any)=>v.extra='private-content',(v:any)=>v.complete=false,(v:any)=>v.sourceBefore.entries=0,(v:any)=>v.sourceBefore.entries=100001,(v:any)=>v.sourceBefore.regularLogicalBytes=268435457,(v:any)=>v.sourceBefore.regularLogicalBytes=9007199254740992,(v:any)=>v.copy.entries++,(v:any)=>v.copy.manifestSha256='f'.repeat(64),(v:any)=>v.sourceAfter.selectedMetadataSha256='f'.repeat(64),(v:any)=>v.metadata.allUid=1001,(v:any)=>v.metadata.allGid=1001,(v:any)=>v.metadata.symlinks=1,(v:any)=>v.metadata.special=1,(v:any)=>v.metadata.hardlinks=1,(v:any)=>v.metadata.externalMounts=1,(v:any)=>v.metadata.acl='UNVERIFIED',(v:any)=>v.metadata.xattr='UNVERIFIED',(v:any)=>v.writer.status='UNVERIFIED',(v:any)=>v.capacity.quotaStatus='UNVERIFIED',(v:any)=>v.capacity.availableBytes=1,(v:any)=>v.capacity.availableInodes=1,(v:any)=>v.capacity.allocationLimitBytes=0,(v:any)=>v.capacity.manifestLimitBytes=33554433,(v:any)=>v.pointInTimeConsistencyProven=true,(v:any)=>v.postgresStarted=true,(v:any)=>v.sourceBefore.fileNames=['private-content']];for(const change of changes){const v=report();change(v);assert.throws(()=>h.parseCopyResult(JSON.stringify(v)),/COPY_RESULT_/);}for(const raw of ['{}\n{}',JSON.stringify(report()).replace('"complete":true','"complete":false,"complete":true')])assert.throws(()=>h.parseCopyResult(raw),/COPY_RESULT_/);});
test('result의 malformed/짧은/초과 출력은 민감 원문을 예외에 포함하지 않는다',async()=>{const h=await subject();for(const raw of ['private-content',JSON.stringify({status:'INCONSISTENT',complete:false,stderr:'private-content'}),'x'.repeat(16385)]){try{h.parseCopyResult(raw);assert.fail('거절 필요');}catch(e){assert.match(String(e),/COPY_RESULT_/);assert(!String(e).includes('private-content'));}}});


// 실제 cp 대신 이 시험 안의 printf wrapper만 호출한다. 외부 writer/quota 증거의 권위 판정은 host가 별도 수행한다.
function gateCarrier(){return ['--scope','P03_PROTECTED_COPY_R1','--run-instance','d'.repeat(32),'--source-instance','dc22a0629e79f259dcd935845e88e58e','--copy-instance','d'.repeat(32),'--decision-sha256','7'.repeat(64),'--acl','REQUIRE_NONE_VERIFIED','--xattr','REQUIRE_NONE_VERIFIED','--quota','REQUIRE_ENFORCED','--writer','REQUIRE_CONTROLLED','--writer-evidence-sha256','8'.repeat(64),'--quota-evidence-sha256','9'.repeat(64)];}
function gateObservations(){return ['--acl-observed','NONE_VERIFIED','--xattr-observed','NONE_VERIFIED','--available-bytes','1073741824','--available-inodes','1000000','--allocation-limit-bytes','536870912','--reserve-bytes','134217728','--manifest-limit-bytes','33554432','--logical-bytes','5','--entry-count','3','--allocation-bytes-needed','4096','--audit-bytes-needed','1024'];}
function gate(args:string[]){const quoted=args.map(v=>{assert(/^[A-Za-z0-9_-]+$/.test(v),'fixture는닫힌enum/숫자/지문만');return "'"+v+"'";}).join(' ');return invoke("p03_copy_cp(){ printf 'MOCK_CP_CALLED\\n'; }; p03_copy_gate "+quoted);}
test('cp직전 순수gate는 strict carrier와 확인된 합성ACL/xattr/space에서만 mock cp1이다',()=>{const r=gate([...gateCarrier(),...gateObservations()]);assert.equal(r.status,0);assert.equal(r.stdout.toString('utf8').split('MOCK_CP_CALLED').length-1,1);});
test('cp직전 carrier누락/변조·ACL/xattr/space 미확인은 mock cp0이며 뒤늦은 reportFAIL로 대체하지 않는다',()=>{const changes=[(a:string[])=>a.splice(a.indexOf('--decision-sha256'),2),(a:string[])=>a[a.indexOf('--scope')+1]='P03_RO_METADATA_R2',(a:string[])=>a[a.indexOf('--run-instance')+1]='invalid',(a:string[])=>a[a.indexOf('--copy-instance')+1]='invalid',(a:string[])=>a[a.indexOf('--decision-sha256')+1]='invalid',(a:string[])=>a[a.indexOf('--quota-evidence-sha256')+1]='UNVERIFIED',(a:string[])=>a[a.indexOf('--writer-evidence-sha256')+1]='UNVERIFIED',(a:string[])=>a[a.indexOf('--acl-observed')+1]='UNVERIFIED',(a:string[])=>a[a.indexOf('--xattr-observed')+1]='UNVERIFIED',(a:string[])=>a[a.indexOf('--available-bytes')+1]='1',(a:string[])=>a[a.indexOf('--available-inodes')+1]='1',(a:string[])=>a[a.indexOf('--allocation-limit-bytes')+1]='0',(a:string[])=>a[a.indexOf('--allocation-limit-bytes')+1]='4096',(a:string[])=>a[a.indexOf('--manifest-limit-bytes')+1]='33554433',(a:string[])=>a[a.indexOf('--logical-bytes')+1]='268435457',(a:string[])=>a[a.indexOf('--entry-count')+1]='100001',(a:string[])=>a[a.indexOf('--audit-bytes-needed')+1]='9007199254740992',(a:string[])=>a.push('--allow-unknown')];for(const change of changes){const args=[...gateCarrier(),...gateObservations()];change(args);const r=gate(args);assert.notEqual(r.status,0);assert(!r.stdout.toString('utf8').includes('MOCK_CP_CALLED'));}});


test('정적 bash -s stdin은 library로 오인하지 않고 잘못된 carrier를 실제효과 없이 거절한다',()=>{const bytes=shellBytes();assert(existsSync(bash));const r=spawnSync(bash,['--noprofile','--norc','-s','--','__invalid_mode__'],{input:bytes,encoding:'utf8',env:{SystemRoot:process.env.SystemRoot,PATH:'C:/Program Files/Git/usr/bin;C:/Program Files/Git/bin',BASH_ENV:'',ENV:'',LC_ALL:'C'},timeout:15000,maxBuffer:16384,windowsHide:true});assert.equal(r.error,undefined);assert.equal(r.status,1);assert.equal(r.stderr,'');assert.deepEqual(JSON.parse(r.stdout),{status:'COPY_BINDING_UNVERIFIED',complete:false});});


test('순수 명령 capture는 exit0+stderr·실패exit·짧은hash를 숨기지 않고 후속0으로 닫는다',()=>{for(const mode of ['warning','failure','short','blank-warning']){const command="p03_fake_external(){ "+(mode==='short'?"printf 'short\\n'; ":"printf '"+'a'.repeat(64)+"  -\\n'; ")+(mode==='warning'?"printf 'private-source-name\\n' >&2; ":mode==='blank-warning'?"printf '\\n' >&2; ":'')+"return "+(mode==='failure'?'1':'0')+"; }; p03_copy_capture_memory hash p03_fake_external && printf 'FOLLOWUP\\n'";const r=invoke(command);assert.notEqual(r.status,0,mode);assert(!r.stdout.toString('utf8').includes('FOLLOWUP'),mode);assert(!r.stdout.toString('utf8').includes('private-source-name'),mode);}});
test('순수 명령 capture의 검증된 정상hash만 후속1이고 library 입력은 파일/temp를 만들지 않는다',()=>{const r=invoke("p03_fake_external(){ printf '"+'a'.repeat(64)+"  -\\n'; }; p03_copy_capture_memory hash p03_fake_external && printf 'FOLLOWUP\\n'");assert.equal(r.status,0);assert.equal(r.stdout.toString('utf8').split('FOLLOWUP').length-1,1);});

test('private 관측 wrapper도 가짜 IO ports의 exit/stderr/짧은출력에서 후속0이다',()=>{for(const mode of ['warning','failure','short','ok']){const text=(mode==='short'?'short':'a'.repeat(64)+'  -')+'\n',command="p03_copy_io_run(){ return "+(mode==='failure'?'1':'0')+"; }; p03_copy_measure(){ if [[ $1 == ERR ]]; then P03_BYTES="+(mode==='warning'?'1':'0')+"; else P03_BYTES=68; fi; }; p03_copy_io_text(){ P03_VALUE="+"'"+text+"'"+"; }; p03_copy_capture hash OUT ERR /fake/not-executed && printf 'FOLLOWUP\\n'";const r=invoke(command);if(mode==='ok'){assert.equal(r.status,0);assert.equal(r.stdout.toString('utf8').split('FOLLOWUP').length-1,1);}else{assert.notEqual(r.status,0,mode);assert(!r.stdout.toString('utf8').includes('FOLLOWUP'),mode);}}});
test('scalar 출력은 종료개행·hash 길이·df 두줄 형식을 완결 확인한다',()=>{for(const command of ["p03_copy_scalar_format uint '999'","p03_copy_scalar_format help $'\\n'","p03_copy_scalar_format hash $'short\\n'","p03_copy_scalar_format df-avail $'Avail\\n5'","p03_copy_scalar_format df-inodes $'IFree\\n5\\nextra\\n'"]){const r=invoke(command+" && printf 'FOLLOWUP\\n'");assert.notEqual(r.status,0);assert(!r.stdout.toString('utf8').includes('FOLLOWUP'));}for(const kind of ['df-avail','df-inodes']){const r=invoke("p03_copy_scalar_format "+kind+" $'"+(kind==='df-avail'?'Avail':'IFree')+"\\n 500\\n' && printf 'FOLLOWUP\\n'");assert.equal(r.status,0);assert(r.stdout.toString('utf8').includes('FOLLOWUP'));}});

test('실제 framing hash 호출선의 가짜외부명령 경고/실패/짧은출력은 원문없이 거절한다',()=>{for(const mode of ['warning','failure','short']){const command="p03_copy_sha256(){ printf '"+(mode==='short'?'short':'a'.repeat(64)+'  -')+"\\n'; "+(mode==='warning'?"printf 'private-source-name\\n' >&2; ":'')+"return "+(mode==='failure'?'1':'0')+"; }; p03_copy_frames",r=invoke(command,frames());assert.notEqual(r.status,0,mode);const lines=r.stdout.toString('utf8').trim().split('\n');assert.equal(lines.shift(),'PREPARATION_ONLY');assert.deepEqual(JSON.parse(lines.join('\n')),{status:'COPY_FRAME_HASH',complete:false});assert(!r.stdout.toString('utf8').includes('private-source-name'));}});

for(const channel of ['stdout','stderr'])test(`raw NUL ${channel}는 문자열치환 전에 거절하고 외부stderr/후속0이다`,()=>{const command="p03_fake_external(){ printf '"+'a'.repeat(64)+"  -\\n'; printf '\\0'"+(channel==='stderr'?' >&2':'')+"; }; p03_copy_capture_memory hash p03_fake_external && printf 'FOLLOWUP\\n'",r=invoke(command);assert.notEqual(r.status,0);assert(!r.stdout.toString('utf8').includes('FOLLOWUP'));});
test('memory capture는 cap marker를 payload와 구별하고 종료상태/다중stderr를 보존한다',()=>{let r=invoke("p03_fake_external(){ printf '%16383s\\n' ''; }; p03_copy_capture_memory help p03_fake_external && printf 'FOLLOWUP\\n'");assert.equal(r.status,0);assert(r.stdout.toString('utf8').includes('FOLLOWUP'));for(const command of ["p03_fake_external(){ printf '%16384s\\n' ''; }; p03_copy_capture_memory help p03_fake_external","p03_fake_external(){ printf '"+'a'.repeat(64)+"  -\\n'; return 7; }; p03_copy_capture_memory hash p03_fake_external","p03_fake_external(){ printf '"+'a'.repeat(64)+"  -\\n'; printf '\\n' >&2; printf 'private-name' >&2; }; p03_copy_capture_memory hash p03_fake_external"]){r=invoke(command+" && printf 'FOLLOWUP\\n'");assert.notEqual(r.status,0);assert(!r.stdout.toString('utf8').includes('FOLLOWUP'));assert(!r.stdout.toString('utf8').includes('private-name'));}});

// P03 limited-risk TEST_ONLY append. 위 strict/library 시험 원바이트는 보존한다.
// 감시는 완성 report fixture를 판정하는 대신 실제 supervisor 호출선에 fake cp/clock/관측/TERM/wait/dispose를 주입한다.
function limitedMonitorCommand(scenario:string){assert(/^[a-z-]+$/.test(scenario));return 'SCENARIO='+scenario+'\n'+String.raw`
declare -i FAKE_NOW=0 FAKE_STARTS=0 FAKE_OBSERVES=0 FAKE_POLLS=0 FAKE_TERMS=0 FAKE_WAITS=0 FAKE_DISPOSES=0 FAKE_COLLECTS=0 FAKE_FOREIGN=0
declare -i FAKE_SOURCE_LOGICAL=5 FAKE_SOURCE_ALLOCATED=4096 FAKE_SOURCE_ENTRIES=3
case $SCENARIO in source-logical-limit) FAKE_SOURCE_LOGICAL=268435457;; source-allocation-limit) FAKE_SOURCE_ALLOCATED=536870913;; source-entry-limit) FAKE_SOURCE_ENTRIES=100001;; numeric-overflow) FAKE_SOURCE_LOGICAL=9007199254740992;; esac
P03_LIMITED_VIOLATION_LATCHED=false
P03_LIMITED_PRESERVATION_REQUIRED=false
p03_limited_now(){ P03_LIMITED_NOW_MS=$FAKE_NOW; }
p03_limited_cp_start(){
 ((FAKE_STARTS+=1)); P03_LIMITED_CP_PID=4242; P03_LIMITED_CP_PARENT_PID=42; P03_LIMITED_CP_START_IDENTITY=12345
 [[ $SCENARIO != spawn-failure ]]
}
p03_limited_cp_identity(){
 P03_LIMITED_OBSERVED_PID=4242; P03_LIMITED_OBSERVED_PARENT_PID=42; P03_LIMITED_OBSERVED_START_IDENTITY=12345
 if ((FAKE_NOW>0)); then
  case $SCENARIO in wrong-pid) P03_LIMITED_OBSERVED_PID=4343;; wrong-parent) P03_LIMITED_OBSERVED_PARENT_PID=43;; wrong-start) P03_LIMITED_OBSERVED_START_IDENTITY=99999;; esac
 fi
 if [[ $SCENARIO == changed-before-term && $FAKE_OBSERVES -ge 2 ]]; then P03_LIMITED_OBSERVED_PARENT_PID=43; fi
 return 0
}
p03_limited_space_observe(){
 ((FAKE_OBSERVES+=1)); P03_LIMITED_AVAILABLE_BYTES=1073741824; P03_LIMITED_AVAILABLE_INODES=1000000; P03_LIMITED_SPACE_OBSERVED_MS=$FAKE_NOW; P03_LIMITED_SPACE_STATUS=OBSERVED
 if ((FAKE_OBSERVES==1)); then case $SCENARIO in before-low) P03_LIMITED_AVAILABLE_BYTES=134217727;; before-inode) P03_LIMITED_AVAILABLE_INODES=102;; before-estimate) P03_LIMITED_AVAILABLE_BYTES=167776255;; esac; fi
 if ((FAKE_OBSERVES>=2)); then
  case $SCENARIO in low|late-success|finish-race|changed-before-term|wait-unknown) P03_LIMITED_AVAILABLE_BYTES=134217727;; inode) P03_LIMITED_AVAILABLE_INODES=102;; observation-error) P03_LIMITED_SPACE_STATUS=ERROR; return 1;; observation-delay) ((FAKE_NOW+=10001));; esac
 fi
 return 0
}
p03_limited_cp_poll(){
 ((FAKE_POLLS+=1)); P03_LIMITED_CP_DONE=false; P03_LIMITED_CP_EXIT=0; P03_LIMITED_CP_CLOSED=false
 if [[ $SCENARIO == normal || $SCENARIO == finish-race || $SCENARIO == dispose-error ]]; then
  if ((FAKE_NOW>=10000)); then P03_LIMITED_CP_DONE=true; P03_LIMITED_CP_CLOSED=true; fi
 fi
 return 0
}
p03_limited_wait_tick(){
 case $SCENARIO in period-delay) ((FAKE_NOW+=10001));; deadline) FAKE_NOW=500001;; *) ((FAKE_NOW+=10000));; esac
 return 0
}
p03_limited_cp_term(){
 ((FAKE_TERMS+=1)); if [[ $1 != 4242 ]]; then ((FAKE_FOREIGN+=1)); return 1; fi
 return 0
}
p03_limited_cp_wait(){
 ((FAKE_WAITS+=1)); P03_LIMITED_CP_DONE=true; P03_LIMITED_CP_EXIT=0; P03_LIMITED_CP_CLOSED=true
 if [[ $SCENARIO == wait-unknown ]]; then P03_LIMITED_CP_CLOSED=false; return 1; fi
 return 0
}
p03_limited_watch_dispose(){
 ((FAKE_DISPOSES+=1)); P03_LIMITED_TIMER_DISPOSED=true; P03_LIMITED_PIPE_CLOSED=true
 if [[ $SCENARIO == dispose-error ]]; then P03_LIMITED_TIMER_DISPOSED=false; return 1; fi
 return 0
}
declare -F p03_limited_copy_supervise >/dev/null || { printf 'LIMITED_SUPERVISOR_SOURCE_MISSING\n'; exit 99; }
p03_limited_copy_supervise --scope P03_PROTECTED_COPY_LIMITED_RISK_R1 --source-deadline-ms 500000 --deadline-ms 600000 --reserve-bytes 134217728 --min-inodes 103 --expected-needed-bytes 33558528 --source-logical-bytes "$FAKE_SOURCE_LOGICAL" --source-allocated-bytes "$FAKE_SOURCE_ALLOCATED" --source-entry-count "$FAKE_SOURCE_ENTRIES" --max-observation-ms 10000
supervised=$?
if [[ $supervised == 0 ]]; then ((FAKE_COLLECTS+=1)); fi
printf 'LIMITED_MONITOR %s %s %s %s %s %s %s %s %s %s\n' "$supervised" "$FAKE_STARTS" "$FAKE_OBSERVES" "$FAKE_TERMS" "$FAKE_WAITS" "$FAKE_DISPOSES" "$FAKE_COLLECTS" "$FAKE_FOREIGN" "$P03_LIMITED_VIOLATION_LATCHED" "$P03_LIMITED_PRESERVATION_REQUIRED"
`;}
function limitedMonitor(scenario:string){const r=invoke(limitedMonitorCommand(scenario));assert.notEqual(r.status,99,'LIMITED_SUPERVISOR_SOURCE_MISSING');assert.equal(r.status,0);const lines=r.stdout.toString('utf8').trim().split('\n');assert.equal(lines.shift(),'PREPARATION_ONLY');assert.equal(lines.length,1);const [tag,rc,starts,observes,terms,waits,disposes,collects,foreign,latched,preserve]=lines[0]!.split(' ');assert.equal(tag,'LIMITED_MONITOR');for(const value of [rc,starts,observes,terms,waits,disposes,collects,foreign])assert.match(value??'',/^\d+$/);return{rc:Number(rc),starts:Number(starts),observes:Number(observes),terms:Number(terms),waits:Number(waits),disposes:Number(disposes),collects:Number(collects),foreign:Number(foreign),latched,preserve};}

test('LIMITED 실감시 호출선 정상은 원cp1→최대10초관측→정상종료→회수1·선정결과수집1이다',()=>{const r=limitedMonitor('normal');assert.equal(r.rc,0);assert.equal(r.starts,1);assert(r.observes>=3);assert.equal(r.terms,0);assert.equal(r.disposes,1);assert.equal(r.collects,1);assert.equal(r.foreign,0);assert.equal(r.latched,'false');});
for(const scenario of ['low','inode','observation-error','observation-delay','period-delay','deadline','late-success'])test('LIMITED 실감시 '+scenario+'는 원cp TERM1·유한wait/회수·위반latch로늦은성공수집0이다',()=>{const r=limitedMonitor(scenario);assert.notEqual(r.rc,0);assert.equal(r.starts,1);assert.equal(r.terms,1);assert.equal(r.waits,1);assert.equal(r.disposes,1);assert.equal(r.collects,0);assert.equal(r.foreign,0);assert.equal(r.latched,'true');assert.equal(r.preserve,'true');});
for(const scenario of ['wrong-pid','wrong-parent','wrong-start','changed-before-term'])test('LIMITED 실감시 '+scenario+'는 신원불명대상TERM/후속0·부분사본/helper보존이다',()=>{const r=limitedMonitor(scenario);assert.notEqual(r.rc,0);assert.equal(r.starts,1);assert.equal(r.terms,0);assert.equal(r.disposes,1);assert.equal(r.collects,0);assert.equal(r.foreign,0);assert.equal(r.preserve,'true');});
test('LIMITED cp정상종료와위반관측 경합은 종료사실로 latch를 덮지 않고 성공수집0이다',()=>{const r=limitedMonitor('finish-race');assert.notEqual(r.rc,0);assert.equal(r.starts,1);assert.equal(r.terms,0);assert.equal(r.disposes,1);assert.equal(r.collects,0);assert.equal(r.latched,'true');assert.equal(r.preserve,'true');});
for(const scenario of ['before-low','before-inode','before-estimate','source-logical-limit','source-allocation-limit','source-entry-limit','numeric-overflow'])test('LIMITED cp시작전 '+scenario+'의범위/예상량/가용bytes/inode guard는 cp0이다',()=>{const r=limitedMonitor(scenario);assert.notEqual(r.rc,0);assert.equal(r.starts,0);assert.equal(r.terms,0);assert.equal(r.collects,0);});
for(const scenario of ['spawn-failure','wait-unknown','dispose-error'])test('LIMITED '+scenario+'의 불명/회수실패는 새cp/성공수집0이다',()=>{const r=limitedMonitor(scenario);assert.notEqual(r.rc,0);assert.equal(r.starts,1);assert(r.terms<=1);assert.equal(r.foreign,0);assert.equal(r.collects,0);assert.equal(r.preserve,'true');});

// 메모리 검토본: 기존 helper/strict prefix를 수정하지 않고 append하는 deadline 반례.
function limitedDeadlineMonitor(scenario:string){
 assert(/^(initial|done-now|done-sample)-(source|total)-(equal|over)$/.test(scenario));
 let command=limitedMonitorCommand('normal').replace('SCENARIO=normal\n','SCENARIO='+scenario+'\n');
 command=command.replace('--source-deadline-ms 500000 --deadline-ms 600000','--source-deadline-ms 5000 --deadline-ms 6000');
 command=command.replace('P03_LIMITED_SPACE_STATUS=OBSERVED\n',String.raw`P03_LIMITED_SPACE_STATUS=OBSERVED
 if ((FAKE_OBSERVES==1));then
  case $SCENARIO in initial-source-equal)FAKE_NOW=5000;;initial-source-over)FAKE_NOW=5001;;initial-total-equal)FAKE_NOW=6000;;initial-total-over)FAKE_NOW=6001;;esac
 fi
 if ((FAKE_OBSERVES==2));then
  case $SCENARIO in done-sample-source-equal)FAKE_NOW=5000;;done-sample-total-equal)FAKE_NOW=6000;;esac
 fi
`);
 command=command.replace('P03_LIMITED_CP_CLOSED=false\n',String.raw`P03_LIMITED_CP_CLOSED=false
 if ((FAKE_POLLS==1));then
  case $SCENARIO in
   done-now-source-equal)FAKE_NOW=5000;P03_LIMITED_CP_DONE=true;P03_LIMITED_CP_CLOSED=true;;
   done-now-total-equal)FAKE_NOW=6000;P03_LIMITED_CP_DONE=true;P03_LIMITED_CP_CLOSED=true;;
   done-sample-source-equal|done-sample-total-equal)FAKE_NOW=4000;P03_LIMITED_CP_DONE=true;P03_LIMITED_CP_CLOSED=true;;
  esac
 fi
 case $SCENARIO in done-*)P03_LIMITED_CP_DONE=true;P03_LIMITED_CP_CLOSED=true;;esac
`);
 const r=invoke(command);assert.equal(r.status,0);
 const lines=r.stdout.toString('utf8').trim().split('\n');assert.equal(lines.shift(),'PREPARATION_ONLY');assert.equal(lines.length,1);
 const [tag,rc,starts,observes,terms,waits,disposes,collects,foreign,latched,preserve]=lines[0]!.split(' ');
 assert.equal(tag,'LIMITED_MONITOR');
 for(const value of [rc,starts,observes,terms,waits,disposes,collects,foreign])assert.match(value??'',/^\d+$/);
 return{rc:Number(rc),starts:Number(starts),observes:Number(observes),terms:Number(terms),waits:Number(waits),disposes:Number(disposes),collects:Number(collects),foreign:Number(foreign),latched,preserve};
}
for(const scenario of ['initial-source-equal','initial-source-over','initial-total-equal','initial-total-over'])test('LIMITED deadline initial sample '+scenario+'는 cp0·후속0이다',()=>{
 const r=limitedDeadlineMonitor(scenario);assert.notEqual(r.rc,0);assert.equal(r.starts,0);assert.equal(r.terms,0);assert.equal(r.waits,0);assert.equal(r.disposes,1);assert.equal(r.collects,0);assert.equal(r.foreign,0);assert.equal(r.latched,'true');assert.equal(r.preserve,'true');
});
for(const scenario of ['done-now-source-equal','done-now-total-equal','done-sample-source-equal','done-sample-total-equal'])test('LIMITED deadline DONE '+scenario+'는 늦은성공수집0·위반latch·부분보존이다',()=>{
 const r=limitedDeadlineMonitor(scenario);assert.notEqual(r.rc,0);assert.equal(r.starts,1);assert.equal(r.terms,0);assert.equal(r.disposes,1);assert.equal(r.collects,0);assert.equal(r.foreign,0);assert.equal(r.latched,'true');assert.equal(r.preserve,'true');
});

// LIMITED 마지막호출선: 실제 mode/proc/cp를 호출하지 않는 명시 fake 주입만 사용한다.
test('LIMITED 마지막호출선 dispatcher 세 rolemode의 invalid carrier는 실함수 진입0이다',()=>{
 const text=shellBytes().toString('utf8'),boundary=text.lastIndexOf('if [[ -n ${BASH_SOURCE[0]-}');
 assert(boundary>0);
 const allowed=new Set(['p03_copy_fail','p03_copy_uint','p03_copy_parse','p03_limited_parse']);
 const names=[...text.matchAll(/^(p03_[a-z0-9_]+)\(\)\{/gm)].map(v=>v[1]!);
 const sentinels=names.filter(name=>!allowed.has(name)).map(name=>name+"(){ printf 'FORBIDDEN_REAL_ENTRY\\n'; return 97; }").join('\n')+'\n';
 const program=Buffer.from(text.slice(0,boundary)+sentinels+text.slice(boundary),'utf8');
 for(const mode of ['--preflight-p03-copy-limited-risk-r1','--init-p03-copy-limited-risk-r1','--copy-p03-copy-limited-risk-r1']){
  const r=spawnSync(bash,['--noprofile','--norc','-s','--',mode],{input:program,encoding:'utf8',env:{SystemRoot:process.env.SystemRoot,PATH:'C:/Program Files/Git/usr/bin;C:/Program Files/Git/bin',BASH_ENV:'',ENV:'',LC_ALL:'C'},timeout:15000,maxBuffer:16384,windowsHide:true});
  assert.equal(r.error,undefined);assert.equal(r.status,1,mode);assert.equal(r.stderr,'');assert(!r.stdout.includes('FORBIDDEN_REAL_ENTRY'));
  assert.deepEqual(JSON.parse(r.stdout),{status:'LIMITED_COPY_BINDING_UNVERIFIED',complete:false});
 }
});
function limitedReapBoundary(kind:string){
 assert(['known','unreaped','open','initial-unknown'].includes(kind));
 let command=limitedMonitorCommand('normal');
 command=command.replace('p03_limited_cp_identity(){\n','p03_limited_cp_identity(){\n '+(kind==='initial-unknown'?'return 1':'if ((FAKE_NOW>0));then return 1;fi')+'\n');
 const original='if ((FAKE_NOW>=10000)); then P03_LIMITED_CP_DONE=true; P03_LIMITED_CP_CLOSED=true; fi';
 const replacement='if ((FAKE_NOW>=10000)); then P03_LIMITED_CP_DONE=true; P03_LIMITED_CP_CLOSED='+(kind==='open'?'false':'true')+'; P03_LIMITED_CP_REAPED='+(kind==='unreaped'?'false':'true')+'; fi';
 assert(command.includes(original));command=command.replace(original,replacement);
 const r=invoke(command);assert.equal(r.status,0);
 const lines=r.stdout.toString('utf8').trim().split('\n');assert.equal(lines.shift(),'PREPARATION_ONLY');assert.equal(lines.length,1);
 const [tag,rc,starts,observes,terms,waits,disposes,collects,foreign,latched,preserve]=lines[0]!.split(' ');
 assert.equal(tag,'LIMITED_MONITOR');
 for(const value of [rc,starts,observes,terms,waits,disposes,collects,foreign])assert.match(value??'',/^\d+$/);
 return{rc:Number(rc),starts:Number(starts),terms:Number(terms),waits:Number(waits),disposes:Number(disposes),collects:Number(collects),foreign:Number(foreign),latched,preserve};
}
for(const kind of ['known','unreaped','open','initial-unknown'])test('LIMITED 마지막호출선 proc 소실 '+kind+'는 원job 회수증거만 수락한다',()=>{
 const r=limitedReapBoundary(kind);assert.equal(r.starts,1);assert.equal(r.terms,0);assert.equal(r.foreign,0);assert.equal(r.disposes,1);
 if(kind==='known'){assert.equal(r.rc,0);assert.equal(r.collects,1);assert.equal(r.waits,1);assert.equal(r.latched,'false');}
 else{assert.notEqual(r.rc,0);assert.equal(r.collects,0);assert.equal(r.waits,0);assert.equal(r.latched,'true');assert.equal(r.preserve,'true');}
});
