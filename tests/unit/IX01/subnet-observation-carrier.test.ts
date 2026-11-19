import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
const epoch=1_800_000_000_000,sourceHead='ed877b59a492c26b39440ffd034740c934d986e9';
const observation={proof:{attemptId:'11111111-1111-4111-8111-111111111111',bundleHash:'da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d',approvalHash:'c'.repeat(64)},window:{issuedAt:epoch,expiresAt:epoch+60000},ip:{location:'USR_SBIN',sha256:'a'.repeat(64)}};
const identity={imageSha256:'d'.repeat(64),configurationSha256:'e'.repeat(64),knownHostsSha256:'f'.repeat(64)};
let original:Uint8Array|undefined;
async function bundle(){if(original)return original;const {buildSubnetObservationNativeBundle}=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');return original=(await buildSubnetObservationNativeBundle(p=>readFileSync(new URL('../../../'+p,import.meta.url)))).bytes;}
class Child extends EventEmitter{stdin=new EventEmitter();stdout=new EventEmitter();constructor(){super();this.on('error',()=>{});this.stdin.on('error',()=>{});this.stdout.on('error',()=>{});}}
async function fixture(mode='normal'){
 const m=await import('../../../scripts/qa-ix01-subnet-observation-carrier.ts');const raw=await bundle(),prepared=m.prepareSubnetObservationCarrier(raw,observation,sourceHead,identity);
 const receipt={schemaVersion:1,purpose:'IX01_SUBNET_OBSERVATION_CONSUMED',receiptId:'22222222-2222-4222-8222-222222222222',bindingHash:prepared.bindingHash,status:'CONSUMED'};
 let wall=epoch,mono=1,start=0,send=0,checks=0,serial=0;const child=new Child(),timers=new Map<number,()=>void>();let launched:any;
 const clock={now:()=>wall,monotonic:()=>mono,setTimeout(fn:()=>void,_ms:number){if(mode==='timer-throw')throw Error('PRIVATE');const id=++serial;timers.set(id,fn);if(mode==='timer-inline')fn();return id;},clearTimeout(id:unknown){timers.delete(id as number);}};
 const ports={clock,verifyConsumed(r:unknown,b:unknown){assert.deepEqual(r,receipt);assert.deepEqual(b,prepared.binding);return {status:'VERIFIED_CONSUMED',receiptId:receipt.receiptId,bindingHash:prepared.bindingHash};},
 verifyCarrier(_value:unknown){checks++;return {status:'VERIFIED',identityHash:prepared.identityHash,configuration:'NO_ADDITIONAL_EFFECTS',hostTrust:'EXACT_ALIAS'};},
 start(file:string,args:readonly string[],options:unknown){start++;launched={file,args,options};return child;},
 sendEnd(c:unknown,bytes:Uint8Array){send++;assert.equal(c,child);assert.deepEqual(bytes,prepared.payload.bytes);assert(child.stdin.listenerCount('finish')>0);assert(child.stdout.listenerCount('data')>0);assert(timers.size===1);
 if(mode==='send-throw')throw Error('PRIVATE');if(mode==='silent')return;
 child.stdin.emit('finish');const e={...observation.proof,...observation.window,schemaVersion:1,purpose:'IX01_SUBNET_REMOTE_COMPLETION',completion:'DIRECT_CHILDREN_CLOSED',result:{code:'CANDIDATE',cidr:'172.16.0.0/28'}};
 child.stdout.emit('data',Buffer.from(mode==='overflow'?'x'.repeat(4097):JSON.stringify(e)+'\n'));child.stdout.emit('end');if(mode!=='hold')child.emit('close',0,null);if(mode==='throw-after-close')throw Error('PRIVATE');}};
 return {m,raw,prepared,receipt,ports,clock,child,timers,advance(ms:number){wall+=ms;mono+=ms;},get start(){return start;},get send(){return send;},get checks(){return checks;},get launched(){return launched;}};
}
test('IX01 carrier RAM: 외부 소비·신원 검산 뒤 한 handle 수거를 먼저 붙여 고정 stdin을 보낸다',async()=>{
 const f=await fixture(),carrier=f.m.createSubnetObservationCarrier(f.ports);const r=await carrier.run(f.raw,observation,{sourceHead,identity,receipt:f.receipt});
 assert.equal(r.status,'OBSERVATION_COLLECTED');assert.equal(f.start,1);assert.equal(f.send,1);assert.equal(f.timers.size,0);assert.equal(f.launched.file,'C:\\Windows\\System32\\OpenSSH\\ssh.exe');
 assert.deepEqual(f.launched.options,{shell:false,windowsHide:true,stdio:['pipe','pipe','ignore']});
 assert.deepEqual(f.launched.args,['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes',
 '-o','UpdateHostKeys=no','-o','AddKeysToAgent=no','-o','VerifyHostKeyDNS=no','-o','ForwardAgent=no','-o','ForwardX11=no','-o','ForwardX11Trusted=no','-o','Tunnel=no',
 '-o','ProxyCommand=none','-o','ProxyJump=none','-o','PermitLocalCommand=no','-o','LocalCommand=none','-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','RequestTTY=no','-o','RemoteCommand=none',
 '-o','ConnectionAttempts=1','-o','ConnectTimeout=8','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','-o','LogLevel=ERROR',
 'WSL-server','exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node --input-type=module']);
 assert.deepEqual(f.launched.args.slice(-2),['WSL-server','exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node --input-type=module']);
 assert.equal((await carrier.run(f.raw,observation,{sourceHead,identity,receipt:f.receipt})).status,'UNKNOWN');assert.equal(f.start,1);
});
test('IX01 carrier RAM: 소비 원장/현재 신원·기한·결박 불명은 start0이며 재시도0',async()=>{
 for(const mode of ['receipt','binding','identity','verify','config','deadline']){const f=await fixture(),receipt={...f.receipt};
 if(mode==='receipt')receipt.status='MISSING';if(mode==='binding')receipt.bindingHash='0'.repeat(64);if(mode==='identity')f.ports.verifyCarrier=()=>({status:'VERIFIED',identityHash:'0'.repeat(64),configuration:'NO_ADDITIONAL_EFFECTS',hostTrust:'EXACT_ALIAS'});
 if(mode==='verify')f.ports.verifyConsumed=()=>{throw Error('PRIVATE');};if(mode==='config')f.ports.verifyCarrier=()=>({status:'VERIFIED',identityHash:f.prepared.identityHash,configuration:'UNCONFIRMED',hostTrust:'EXACT_ALIAS'});if(mode==='deadline')f.advance(60000);
 const carrier=f.m.createSubnetObservationCarrier(f.ports);assert.equal((await carrier.run(f.raw,observation,{sourceHead,identity,receipt})).status,'UNKNOWN');assert.equal(f.start,0);
 assert.equal((await carrier.run(f.raw,observation,{sourceHead,identity,receipt:f.receipt})).status,'UNKNOWN');assert.equal(f.start,0);}
});
test('IX01 carrier RAM: timer 등록 실패/동기 발화는 전송0, 전송·종결 불명 뒤 시도0',async()=>{
 for(const mode of ['timer-throw','timer-inline','send-throw','silent','hold','overflow','throw-after-close']){const f=await fixture(mode),carrier=f.m.createSubnetObservationCarrier(f.ports);let done=false;
 const p=carrier.run(f.raw,observation,{sourceHead,identity,receipt:f.receipt}).then(r=>{done=true;return r;});await Promise.resolve();
 if(mode==='silent'||mode==='hold'){assert.equal(done,false);f.advance(60000);for(const cb of [...f.timers.values()])cb();}
 const r=await p;assert.equal(r.status,'UNKNOWN');assert.equal(f.start,1);assert.equal(f.send,mode.startsWith('timer-')?0:1);assert.equal(f.timers.size,0);
 f.child.emit('close',0,null);assert.equal((await carrier.run(f.raw,observation,{sourceHead,identity,receipt:f.receipt})).status,'UNKNOWN');assert.equal(f.start,1);}
});

test('IX01 carrier RAM: 원 source·proof·payload·신원 교체와 누락 검증 포트는 start0',async()=>{
 for(const mode of ['source','proof','payload','identity','missing']){const f=await fixture(),o=structuredClone(observation),raw=new Uint8Array(f.raw),i={...identity};let head=sourceHead;
 if(mode==='source')head='0'.repeat(40);if(mode==='proof')o.proof.approvalHash='0'.repeat(64);if(mode==='payload')raw[0]=raw[0]!^1;if(mode==='identity')i.imageSha256='0'.repeat(64);
 const ports:any={...f.ports};if(mode==='missing')delete ports.verifyConsumed;
 const carrier=f.m.createSubnetObservationCarrier(ports);assert.equal((await carrier.run(raw,o,{sourceHead:head,identity:i,receipt:f.receipt})).status,'UNKNOWN');assert.equal(f.start,0);assert.equal(f.send,0);}
});
