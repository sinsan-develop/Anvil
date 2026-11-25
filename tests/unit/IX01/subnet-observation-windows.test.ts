import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {canonicalJson} from '../../../contracts/canonical.ts';
const epoch=1800000000000,sourceHead='a24e14823e26dfca9c8e3c956d2ab3269be26bf2',root=String.raw`C:\Anvil-QA\consumed`;
const hash=(v:unknown)=>createHash('sha256').update(canonicalJson(v)).digest('hex');
const identity={imageSha256:'d'.repeat(64),configurationSha256:'e'.repeat(64),knownHostsSha256:'f'.repeat(64)};
const input=()=>({proof:{attemptId:'11111111-1111-4111-8111-111111111111',helperHash:'e1228af0d86c599de9dd8439c809667b68f6bed842df304d12178746e525a8f4',approvalHash:'c'.repeat(64)},window:{issuedAt:epoch,expiresAt:epoch+60000},location:'USR_SBIN'});
class Child extends EventEmitter{stdin=new EventEmitter();stdout=new EventEmitter();constructor(){super();this.on('error',()=>{});this.stdin.on('error',()=>{});this.stdout.on('error',()=>{});}}
type RecordState={path:string;data:Buffer;flushed:boolean;closed:boolean;closeCount:number;confirmed:boolean};
type Ledger=Map<string,RecordState>;
let saved:Promise<{meta:Uint8Array;observation:Uint8Array}>|undefined;
function bundles(){return saved??=(async()=>{const m=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts'),read=(p:string)=>readFileSync(new URL('../../../'+p,import.meta.url));return {meta:(await m.buildSubnetPreflightBundle(read)).bytes,observation:(await m.buildSubnetObservationNativeBundle(read)).bytes};})();}
async function fixture(mode='normal',ledger:Ledger=new Map()){
 const m=await import('../../../scripts/qa-ix01-subnet-observation-windows.ts'),b=await bundles(),q=input();
 const request={sourceHead,identity:{...identity},planHash:'b'.repeat(64),ledgerRoot:root};
 let wall=epoch,mono=1,serial=0,starts=0,sends=0,reviews=0;const timers=new Map<number,()=>void>(),events:string[]=[],children:Child[]=[],launches:any[]=[],tokens=new WeakMap<object,RecordState>();
 const get=(token:object)=>{const s=tokens.get(token);assert(s);return s;};
 const review=(binding:any)=>{reviews++;assert.equal(binding.planHash,request.planHash);assert.equal(binding.approvalHash,q.proof.approvalHash);assert.equal(binding.sourceHead,sourceHead);assert.equal(binding.ledgerRoot,root);assert.deepEqual(binding.launch.env,{});assert.equal(binding.launch.cwd,String.raw`C:\Windows\System32`);
  return {status:mode==='review'||mode==='second-review'&&starts===1?'UNKNOWN':'CURRENT',reviewHash:mode==='review-hash'?'0'.repeat(64):hash(binding)};};
 const ports={clock:{now:()=>wall,monotonic:()=>mono,setTimeout(fn:()=>void,ms:number){if(mode==='timer-throw')throw Error('PRIVATE');const id=++serial;timers.set(id,fn);if(mode==='timer-inline')fn();return id;},clearTimeout(id:unknown){timers.delete(id as number);}},
 platform:()=>mode==='platform'?'linux':'win32',review,
 openExclusive(path:string){events.push('open');assert(path===root+'\\'+q.proof.attemptId+'.plan.json'||path===root+'\\'+q.proof.attemptId+'.observation.json');if(ledger.has(path))throw Error('EXISTS_PRIVATE');
  const r:RecordState={path,data:Buffer.alloc(0),flushed:false,closed:false,closeCount:0,confirmed:false};ledger.set(path,r);if(mode==='open-unknown')throw Error('PRIVATE');const token={};tokens.set(token,r);return token;},
 write(token:object,bytes:Uint8Array,offset:number){const r=get(token);events.push('write');assert.equal(offset,r.data.length);if(mode==='write')throw Error('PRIVATE');if(mode==='zero')return 0;const count=mode==='partial'?Math.min(37,bytes.length-offset):bytes.length-offset;r.data=Buffer.concat([r.data,Buffer.from(bytes.subarray(offset,offset+count))]);return count;},
 flush(token:object){const r=get(token);events.push('flush');if(mode==='flush'||mode==='second-flush'&&r.path.endsWith('.observation.json'))throw Error('PRIVATE');r.flushed=true;return true;},
 close(token:object){const r=get(token);events.push('close');r.closeCount++;r.closed=true;if(mode==='close')throw Error('PRIVATE');return true;},
 confirmClosed(token:object,bytes:number){const r=get(token);events.push('confirm');assert(r.flushed&&r.closed);assert.equal(r.data.length,bytes);r.confirmed=true;return mode==='confirm'?false:true;},
 spawn(file:string,args:readonly string[],options:unknown){starts++;events.push('spawn');launches.push({file,args,options});assert([...ledger.values()].every(r=>r.confirmed));const c=new Child();children.push(c);if(mode==='spawn')throw Error('PRIVATE');return c;},
 end(child:object,bytes:Uint8Array){sends++;events.push('end');assert.equal(child,children[starts-1]);const c=child as Child;assert(c.stdin.listenerCount('finish')>0&&c.stdout.listenerCount('data')>0);assert.equal(timers.size,1);if(mode==='send')throw Error('PRIVATE');if(mode==='silent')return;
  const text=new TextDecoder().decode(bytes),isMeta=starts===1,name=isMeta?'metaInput':'ixInput',encoded=new RegExp('const '+name+'="([^"]+)"').exec(text)![1]!,i=JSON.parse(Buffer.from(encoded,'base64').toString());assert.deepEqual(i.window,q.window);
  const r:any=isMeta?{schemaVersion:1,purpose:'IX01_SUBNET_IP_MEASUREMENT',basis:'FIXED_NODE_PATH_METADATA',...i.proof,...i.window,measuredAt:epoch+10,location:i.location,measurement:{sha256:'a'.repeat(64),bytes:4096,metadata:{kind:'file',dev:'1',ino:'2',uid:0,gid:0,mode:0o100755,nlink:1,size:4096,rdev:'0',mtimeNs:'1',ctimeNs:'1'}}}:{...i.proof,...i.window,schemaVersion:1,purpose:'IX01_SUBNET_REMOTE_COMPLETION',completion:'DIRECT_CHILDREN_CLOSED',result:{code:'NO_CANDIDATE'}};
  if(mode==='output')r.private='PRIVATE';c.stdin.emit('finish');c.stdout.emit('data',Buffer.from(JSON.stringify(r)+'\n'));c.stdout.emit('end');if(mode!=='hold')c.emit('close',0,null);
 }};
 const supervisor=m.createSubnetWindowsSupervisor(review,ports),run=()=>supervisor.run(b.meta,b.observation,q,request);
 return {run,request,q,ports,review,ledger,children,timers,events,launches,m,b,advance(ms:number){wall+=ms;mono+=ms;},get starts(){return starts;},get sends(){return sends;},get reviews(){return reviews;}};
}
test('IX01 Windows RAM: 같은 감독의 배타+flush+close 기록 뒤 고정 두 단계만 실행한다',async()=>{
 for(const mode of ['normal','partial']){const f=await fixture(mode),r=await f.run();assert.equal(r.status,'OBSERVATION_COLLECTED');assert.equal(f.starts,2);assert.equal(f.sends,2);assert.equal(f.ledger.size,2);assert.equal(f.timers.size,0);
 const records=[...f.ledger.values()];for(const [index,record]of records.entries()){assert.equal(record.closeCount,1);assert(record.flushed&&record.confirmed);const v=JSON.parse(record.data.toString());assert.equal(v.phase,index?'OBSERVATION':'PREFLIGHT');assert.equal(v.planHash,f.request.planHash);assert.equal(v.approvalHash,f.q.proof.approvalHash);assert.equal(v.attemptId,f.q.proof.attemptId);assert.equal(v.expiresAt,epoch+60000);assert.equal(v.binding.sourceHead,sourceHead);assert(record.data.length<=4096);}
 assert.deepEqual(f.launches[0],f.launches[1]);assert.equal(f.launches[0].file,String.raw`C:\Windows\System32\OpenSSH\ssh.exe`);assert.deepEqual(f.launches[0].options,{cwd:String.raw`C:\Windows\System32`,env:{},shell:false,windowsHide:true,stdio:['pipe','pipe','ignore']});
 const argv=f.launches[0].args;for(const flag of ['BatchMode=yes','StrictHostKeyChecking=yes','ClearAllForwardings=yes','UpdateHostKeys=no','AddKeysToAgent=no','VerifyHostKeyDNS=no','ForwardAgent=no','ProxyCommand=none','ProxyJump=none','LocalCommand=none','PermitLocalCommand=no'])assert(argv.includes(flag));assert.equal(argv.at(-1),'exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node --input-type=module');
 assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,2);}
});
test('IX01 Windows RAM: 기존 동일 시도의 기록을 다른 factory가 읽어 재사용할 수 없다',async()=>{
 const ledger:Ledger=new Map(),first=await fixture('normal',ledger);assert.equal((await first.run()).status,'OBSERVATION_COLLECTED');const before=[...ledger.values()].map(r=>Buffer.from(r.data));
 const next=await fixture('normal',ledger);assert.equal((await next.run()).status,'UNKNOWN');assert.equal(next.starts,0);assert.deepEqual([...ledger.values()].map(r=>r.data),before);assert.equal(ledger.size,2);
 const partial=await fixture('open-unknown');assert.equal((await partial.run()).status,'UNKNOWN');assert.equal(partial.starts,0);const nextUnknown=await fixture('normal',partial.ledger);assert.equal((await nextUnknown.run()).status,'UNKNOWN');assert.equal(nextUnknown.starts,0);
});
test('IX01 Windows RAM: 현재 신원/승인/부모·기한 불명은 기록과 SSH0',async()=>{
 for(const mode of ['platform','review','review-hash','root','plan','deadline','receipt']){const f=await fixture(mode);if(mode==='root')f.request.ledgerRoot=String.raw`C:\Anvil-QA\..\other`;if(mode==='plan')f.request.planHash='invalid';if(mode==='deadline')f.advance(60000);if(mode==='receipt')(f.request as any).receipt={status:'CONSUMED'};
 assert.equal((await f.run()).status,'UNKNOWN',mode);assert.equal(f.ledger.size,0,mode);assert.equal(f.starts,0,mode);}
});
test('IX01 Windows RAM: 원 기록 쓰기/flush/close/확인 실패는 close 최대1·삭제0·다음 연결0',async()=>{
 for(const mode of ['write','zero','flush','close','confirm','second-flush','second-review']){const f=await fixture(mode);assert.equal((await f.run()).status,'UNKNOWN',mode);assert.equal(f.starts,mode.startsWith('second')?1:0,mode);for(const r of f.ledger.values())assert.equal(r.closeCount,1);assert.equal((await f.run()).status,'UNKNOWN');}
});
test('IX01 Windows RAM: 원 송신/출력/미종결·timer 불명은 보존하며 늦은 close로 새 연결0',async()=>{
 for(const mode of ['spawn','send','output','silent','hold','timer-throw','timer-inline']){const f=await fixture(mode),pending=f.run();await Promise.resolve();
 if(mode==='silent'||mode==='hold'){assert.equal(f.starts,1);f.advance(10000);for(const fn of [...f.timers.values()])fn();}
 assert.equal((await pending).status,'UNKNOWN',mode);assert.equal(f.starts,1,mode);assert.equal(f.ledger.size,1,mode);assert.equal(f.timers.size,0,mode);
 if(f.children[0]){f.children[0].emit('close',0,null);assert.equal(f.children[0].listenerCount('error'),1);}assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,1);}
});
test('IX01 Windows source: 실제 기본 포트는 wx/fsync/원 fd만, 자동 CLI·삭제·kill·상속 환경0',()=>{
 const text=readFileSync(new URL('../../../scripts/qa-ix01-subnet-observation-windows.ts',import.meta.url),'utf8');
 assert(text.includes("openSync(path,'wx',0o600)"));assert(text.includes('fsyncSync(s.fd)'));assert(text.includes('closeSync(s.fd)'));assert(text.includes('confirmClosed'));
 assert(!/unlinkSync|rmSync|mkdirSync|chmodSync|\.kill\(|process\.env|process\.argv|require\.main/.test(text));
});

const benignAttempt='22222222-2222-4222-8222-222222222222',benignApproval='33333333-3333-4333-8333-333333333333';
function benignEvidence(){return Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_PROTECTED_START' as const,attemptId:benignAttempt,approvalId:benignApproval,
 approvalRef:Object.freeze({id:benignApproval,version:1,contentHash:'c'.repeat(64)}),approvalHash:'c'.repeat(64),sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),sourceHash:'d'.repeat(64),graphHash:'e'.repeat(64),
 issuedAt:epoch,expiresAt:epoch+10000,nodePath:'/opt/node-v24.22.1-linux-x64/bin/node' as const,nodeHash:'f'.repeat(64),launcherHash:'1'.repeat(64),issuerHash:'2'.repeat(64),entryHash:'3'.repeat(64),systemHash:'4'.repeat(64),
 loadedSourceRef:Object.freeze({id:'44444444-4444-4444-8444-444444444444',version:1,contentHash:'5'.repeat(64)})});}
async function benignFixture(mode='normal',ledger:Ledger=new Map()){
 const m=await import('../../../scripts/qa-ix01-subnet-observation-windows.ts'),evidence=benignEvidence(),stdin=Buffer.from(canonicalJson(evidence)),stdinHash=createHash('sha256').update(stdin).digest('hex');
 let wall=epoch,mono=1,starts=0,sends=0,reviews=0,serial=0;const timers=new Map<number,()=>void>(),children:Child[]=[],launches:any[]=[],tokens=new WeakMap<object,RecordState>();
 const get=(token:object)=>{const value=tokens.get(token);assert(value);return value;};
 const review=(binding:any)=>{reviews++;assert.equal(binding.purpose,'IX01_0076_BENIGN_FD_PROOF_WINDOWS_SEND');assert.equal(binding.attemptId,benignAttempt);assert.equal(binding.stdinSha256,stdinHash);return{status:mode==='review'?'UNKNOWN':'CURRENT',reviewHash:mode==='review-hash'?'0'.repeat(64):hash(binding)};};
 const ports={clock:{now:()=>wall,monotonic:()=>mono,setTimeout(fn:()=>void){const id=++serial;timers.set(id,fn);if(mode==='timer-inline')fn();return id;},clearTimeout(id:unknown){timers.delete(id as number);}},platform:()=>mode==='platform'?'linux':'win32',review,
  openExclusive(path:string){assert.equal(path,String.raw`D:\Project\Anvil\.av3-data\ix01-0076-fd-proof-22222222-2222-4222-8222-222222222222-transport.json`);if(ledger.has(path))throw Error('EXISTS');const value={path,data:Buffer.alloc(0),flushed:false,closed:false,closeCount:0,confirmed:false};ledger.set(path,value);const token={};tokens.set(token,value);return token;},
  write(token:object,bytes:Uint8Array,offset:number){const value=get(token);if(mode==='write')throw Error('WRITE');const count=mode==='partial'?Math.min(31,bytes.byteLength-offset):bytes.byteLength-offset;value.data=Buffer.concat([value.data,Buffer.from(bytes.subarray(offset,offset+count))]);return count;},
  flush(token:object){const value=get(token);value.flushed=true;if(mode==='flush')throw Error('FLUSH');return true;},close(token:object){const value=get(token);value.closed=true;value.closeCount++;if(mode==='close')throw Error('CLOSE');return true;},confirmClosed(token:object,bytes:number){const value=get(token);assert.equal(value.data.length,bytes);value.confirmed=true;return mode==='confirm'?false:true;},
  spawn(file:string,args:readonly string[],options:unknown){starts++;launches.push({file,args,options});const child=new Child();children.push(child);return child;},
  end(child:object,bytes:Uint8Array){sends++;assert.equal(child,children[0]);assert.deepEqual(Buffer.from(bytes),stdin);if(mode==='send')throw Error('SEND');if(mode==='hold')return;const intentDigest=createHash('sha256').update(canonicalJson({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_LAUNCH_INTENT',attemptId:benignAttempt,approvalRef:evidence.approvalRef,approvalHash:evidence.approvalHash,planHash:evidence.planHash,graphHash:evidence.graphHash,stdinHash,issuedAt:evidence.issuedAt,expiresAt:evidence.expiresAt})).digest('hex');
   const result:any={status:'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS',attemptId:mode==='output-attempt'?'55555555-5555-4555-8555-555555555555':benignAttempt,approvalRef:evidence.approvalRef,intentDigest:mode==='output-intent'?'0'.repeat(64):intentDigest,observation:{path:mode==='output-path'?'/usr/bin/other':'/usr/bin/sleep',dev:mode==='output-dev'?-1:8,ino:9,sha256:mode==='output-sha'?'z'.repeat(64):'a'.repeat(64)},runtimeVerified:false,executionAuthorized:false,pgAuthorized:false};
   const c=child as Child;c.stdin.emit('finish');c.stdout.emit('data',Buffer.from(canonicalJson(result)+'\n'));c.stdout.emit('end');c.emit('exit',0,null);c.emit('close',0,null);}
 };
 const carrier=(m as any).create0076BenignFdProofWindowsCarrier(review,ports),run=()=>carrier.run(stdin);
 return{run,ledger,children,timers,launches,stdin,stdinHash,ports,evidence,advance(ms:number){wall+=ms;mono+=ms;},get starts(){return starts;},get sends(){return sends;},get reviews(){return reviews;}};
}
test('IX01 Windows benign carrier: 원 승인 bytes를 고정 route로 단회 보내고 exact 관측만 수용한다',async()=>{
 const f=await benignFixture(),result=await f.run();assert.equal(result.status,'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS');assert.equal(result.attemptId,benignAttempt);assert.deepEqual(result.approvalRef,f.evidence.approvalRef);assert.equal(result.observation.path,'/usr/bin/sleep');assert.equal(result.observation.dev,8);assert.equal(result.observation.ino,9);assert.equal(result.observation.sha256,'a'.repeat(64));
 assert.equal(f.starts,1);assert.equal(f.sends,1);assert.equal(f.ledger.size,1);const launch=f.launches[0];assert.equal(launch.file,String.raw`C:\Windows\System32\OpenSSH\ssh.exe`);assert.deepEqual(launch.options,{cwd:String.raw`C:\Windows\System32`,env:{},shell:false,windowsHide:true,stdio:['pipe','pipe','ignore']});
 assert.equal(launch.args.at(-2),'WSL-server');assert.equal(launch.args.at(-1),"cd '/home/daon/anvil-ix01-0076-negative-22222222222242228222222222222222-qa' && exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node '/home/daon/anvil-ix01-0076-negative-22222222222242228222222222222222-qa/scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts' --run "+benignAttempt+' '+f.evidence.planHash+' '+f.evidence.approvalHash+' '+f.stdinHash);
 assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,1);
});
test('IX01 Windows benign carrier: 교차 결과·불명은 UNKNOWN이고 재시도·새 효과가 없다',async()=>{
 for(const mode of ['output-attempt','output-intent','output-path','output-dev','output-sha','send','hold']){const f=await benignFixture(mode),pending=f.run();await Promise.resolve();if(mode==='hold'){f.advance(10000);for(const callback of f.timers.values())callback();}assert.equal((await pending).status,'UNKNOWN',mode);assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,1,mode);assert.equal(f.sends,1,mode);
  if(mode==='hold'){const child=f.children[0];assert(child);assert(child.listenerCount('close')>0);assert(child.listenerCount('error')>1);child.emit('error',Error('LATE'));child.stdin.emit('error',Error('LATE'));child.stdout.emit('error',Error('LATE'));assert.equal(f.starts,1);child.emit('close',0,null);assert.equal(child.listenerCount('close'),0);assert.equal(child.listenerCount('error'),1);}}
});
test('IX01 Windows benign carrier: current·기록·선만료 실패는 spawn 또는 stdin 전에 닫힌다',async()=>{
 for(const mode of ['platform','review','review-hash','write','flush','close','confirm','timer-inline']){const f=await benignFixture(mode);assert.equal((await f.run()).status,'UNKNOWN',mode);assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,0,mode);assert.equal(f.sends,0,mode);assert.equal(f.timers.size,0,mode);for(const value of f.ledger.values())assert(value.closeCount<=1);}
 const first=await benignFixture();assert.notEqual((await first.run()).status,'UNKNOWN');const duplicate=await benignFixture('normal',first.ledger);assert.equal((await duplicate.run()).status,'UNKNOWN');assert.equal(duplicate.starts,0);
});
