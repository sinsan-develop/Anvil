import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
const epoch=1800000000000,head='3ee214fcbc8b0beacb346ab085ce1e0b80a9ed4d';
const identity={imageSha256:'d'.repeat(64),configurationSha256:'e'.repeat(64),knownHostsSha256:'f'.repeat(64)};
const input=()=>({proof:{attemptId:'11111111-1111-4111-8111-111111111111',helperHash:'e1228af0d86c599de9dd8439c809667b68f6bed842df304d12178746e525a8f4',approvalHash:'c'.repeat(64)},window:{issuedAt:epoch,expiresAt:epoch+60000},location:'USR_SBIN'});
function row(q:ReturnType<typeof input>){return {schemaVersion:1,purpose:'IX01_SUBNET_IP_MEASUREMENT',basis:'FIXED_NODE_PATH_METADATA',...q.proof,...q.window,measuredAt:epoch+5000,location:q.location,measurement:{sha256:'a'.repeat(64),bytes:4096,metadata:{kind:'file',dev:'1',ino:'2',uid:0,gid:0,mode:0o100755,nlink:1,size:4096,rdev:'0',mtimeNs:'1',ctimeNs:'1'}}};}
class Child extends EventEmitter{stdin=new EventEmitter();stdout=new EventEmitter();constructor(){super();this.on('error',()=>{});this.stdin.on('error',()=>{});this.stdout.on('error',()=>{});}}
let built:Promise<{meta:Uint8Array;observation:Uint8Array}>|undefined;
function bundles(){return built??=(async()=>{const m=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts'),read=(p:string)=>readFileSync(new URL('../../../'+p,import.meta.url));return {meta:(await m.buildSubnetPreflightBundle(read)).bytes,observation:(await m.buildSubnetObservationNativeBundle(read)).bytes};})();}
async function fixture(mode='normal'){
 const m=await import('../../../scripts/qa-ix01-subnet-observation-local-host.ts'),b=await bundles(),q=input(),prepared=m.prepareSubnetObservationLocal(b.meta,b.observation,q,head,identity);
 let wall=epoch,mono=1,serial=0,starts=0,sends=0,records=0,checks=0;
 const timers=new Map<number,()=>void>(),durations:number[]=[],children=[new Child(),new Child()],commands:unknown[]=[];
 const receipt={schemaVersion:1,purpose:'IX01_SUBNET_TWO_PHASE_CONSUMED',receiptId:'22222222-2222-4222-8222-222222222222',bindingHash:prepared.bindingHash,status:'CONSUMED'};
 const ports={clock:{now:()=>wall,monotonic:()=>mono,setTimeout(fn:()=>void,ms:number){durations.push(ms);if(mode==='timer-throw')throw Error('PRIVATE');const id=++serial;timers.set(id,fn);if(mode==='timer-inline')fn();return id;},clearTimeout(id:unknown){timers.delete(id as number);}},
 verifyPlanConsumed(r:unknown,p:unknown){assert.deepEqual(r,receipt);assert.deepEqual(p,prepared.binding);return {status:mode==='ledger'?'UNKNOWN':'VERIFIED_CONSUMED',receiptId:receipt.receiptId,bindingHash:receipt.bindingHash};},
 verifyCarrier(_i:unknown){checks++;return {status:'VERIFIED',identityHash:prepared.identityHash,configuration:mode==='identity'||(mode==='second-identity'&&checks===2)?'UNKNOWN':'NO_ADDITIONAL_EFFECTS',hostTrust:'EXACT_ALIAS'};},
 observationReceipt(binding:any){records++;assert.equal(binding.inputHash,selectedInputHash);if(mode==='outer-mono')mono+=60000;if(mode==='outer-wall')wall=epoch+60000;return {schemaVersion:1,purpose:'IX01_SUBNET_OBSERVATION_CONSUMED',receiptId:'33333333-3333-4333-8333-333333333333',bindingHash:hashBinding(binding),status:mode==='second-ledger'?'UNKNOWN':'CONSUMED'};},
 verifyConsumed(r:any,binding:any){return {status:'VERIFIED_CONSUMED',receiptId:r.receiptId,bindingHash:hashBinding(binding)};},
 start(file:string,args:readonly string[],options:unknown){commands.push({file,args,options});starts++;return mode==='same-handle'?children[0]:children[starts-1];},
 sendEnd(child:unknown,bytes:Uint8Array){sends++;const c=child as Child;assert(c.stdin.listenerCount('finish'));assert(c.stdout.listenerCount('data'));assert.equal(timers.size,1);
 if(sends===1){assert.deepEqual(bytes,prepared.meta.bytes);if(mode==='silent')return;
  const r:any=row(q);if(mode==='attempt')r.attemptId='44444444-4444-4444-8444-444444444444';if(mode==='time')r.measuredAt=epoch+60000;if(mode==='location')r.location='BIN';if(mode==='sha')r.measurement.sha256='PRIVATE';if(mode==='helper')r.helperHash='a'.repeat(64);
  const line=JSON.stringify(r)+'\n';c.stdin.emit('finish');c.stdout.emit('data',Buffer.from(mode==='overflow'?'x'.repeat(4097):mode==='bom'?'\ufeff'+line:line));c.stdout.emit('end');
  if(mode==='wrong-handle')children[1]!.emit('close',0,null);else if(mode!=='hold')c.emit('close',mode==='exit'?1:0,null);
  if(mode==='send-after-close')throw Error('PRIVATE');
 }else{const text=new TextDecoder().decode(bytes),encoded=/const ixInput="([^"]+)"/.exec(text)![1]!;const o=JSON.parse(Buffer.from(encoded,'base64').toString());assert.equal(o.ip.sha256,'a'.repeat(64));assert.deepEqual(o.window,{...prepared.window});
  c.stdin.emit('finish');c.stdout.emit('data',Buffer.from(JSON.stringify({...o.proof,...o.window,schemaVersion:1,purpose:'IX01_SUBNET_REMOTE_COMPLETION',completion:'DIRECT_CHILDREN_CLOSED',result:{code:'NO_CANDIDATE'}})+'\n'));c.stdout.emit('end');c.emit('close',0,null);
 }} };
 const {createHash}=await import('node:crypto'),{canonicalJson}=await import('../../../contracts/canonical.ts');const hashBinding=(b:unknown)=>createHash('sha256').update(canonicalJson(b)).digest('hex');
 const o={proof:{attemptId:q.proof.attemptId,bundleHash:'da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d',approvalHash:q.proof.approvalHash},window:q.window,ip:{location:q.location,sha256:'a'.repeat(64)}};
 const {prepareSubnetObservationCarrier}=await import('../../../scripts/qa-ix01-subnet-observation-carrier.ts');const selectedInputHash=prepareSubnetObservationCarrier(b.observation,o,head,identity).binding.inputHash;
 const owner=m.createSubnetObservationLocalHost(ports),run=()=>owner.run(b.meta,b.observation,q,{sourceHead:head,identity,receipt});
 return {run,q,ports,receipt,prepared,children,timers,durations,commands,advance(ms:number){wall+=ms;mono+=ms;},get starts(){return starts;},get sends(){return sends;},get records(){return records;}};
}
test('IX01 local host RAM: 정확 메타 종결 이후만 고정 관측 stdin을 파생하고 두 단계 단회/공유 창을 유지한다',async()=>{
 const f=await fixture('hold');let done=false;const pending=f.run().then(r=>{done=true;return r;});await Promise.resolve();assert.equal(done,false);assert.equal(f.starts,1);assert.equal(f.records,0);
 f.advance(9000);f.children[0]!.emit('close',0,null);const r=await pending;assert.equal(r.status,'OBSERVATION_COLLECTED');assert.equal(f.starts,2);assert.equal(f.sends,2);assert.equal(f.records,1);assert.deepEqual(f.commands[0],f.commands[1]);assert.deepEqual(f.durations,[10000,51000]);assert.equal(f.timers.size,0);
 assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,2);
});
test('IX01 local host RAM: 외부 소비·현재 신원·기한 없으면 처음 SSH0이고 다른 요청으로 재시도0',async()=>{
 for(const mode of ['ledger','identity','deadline','receipt']){const f=await fixture(mode);if(mode==='deadline')f.advance(60000);if(mode==='receipt')f.receipt.status='UNKNOWN';assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,0);assert.equal(f.sends,0);assert.equal((await f.run()).status,'UNKNOWN');}
});
test('IX01 local host RAM: 메타 오염/불명·다른 handle·늦은 close는 관측0과 timer 회수',async()=>{
 for(const mode of ['attempt','time','location','sha','helper','overflow','bom','exit','send-after-close','silent','wrong-handle','timer-throw','timer-inline']){const f=await fixture(mode),pending=f.run();await Promise.resolve();
 if(mode==='silent'||mode==='wrong-handle'){f.advance(10000);for(const fn of [...f.timers.values()])fn();}
 assert.equal((await pending).status,'UNKNOWN',mode);assert.equal(f.starts,1,mode);assert.equal(f.records,0,mode);assert.equal(f.sends,mode.startsWith('timer-')?0:1,mode);assert.equal(f.timers.size,0,mode);
 f.children[0]!.emit('close',0,null);assert.equal((await f.run()).status,'UNKNOWN');assert.equal(f.starts,1);}
});
test('IX01 local host RAM: 후속 소비/신원·공유 mono/wall 기한 실패는 두 번째 전송0',async()=>{
 for(const mode of ['second-ledger','second-identity','outer-mono','outer-wall','same-handle']){const f=await fixture(mode);assert.equal((await f.run()).status,'UNKNOWN',mode);assert.equal(f.sends,1,mode);assert.equal(f.starts,mode==='same-handle'?2:1,mode);assert.equal(f.timers.size,0);}
});

test('IX01 local host RAM: 호출 후 입력/기한 객체 변경은 이미 결박된 두 단계에 반영되지 않는다',async()=>{
 const f=await fixture('hold'),pending=f.run();await Promise.resolve();f.q.proof.approvalHash='0'.repeat(64);f.q.location='BIN';f.q.window.expiresAt++;
 f.children[0]!.emit('close',0,null);assert.equal((await pending).status,'OBSERVATION_COLLECTED');assert.equal(f.starts,2);assert.equal(f.timers.size,0);
});
