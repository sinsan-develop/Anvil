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
