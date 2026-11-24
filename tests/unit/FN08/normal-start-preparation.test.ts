import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const id=(n:number)=>`a9080000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
async function api(){const path='../../../apps/server/modules/executions/normal-start-preparation.ts';const m=await import(path).catch(()=>null);assert.ok(m,'동일 요청의 원 준비 객체 수명 관리가 필요하다');return m;}
function input(){const now=Date.now();return{purpose:'NORMAL_START_PREPARATION_V1',commandId:id(10),scope:{requestHash:contentHash('original'),transactionId:'1',projectId:id(1),executionId:id(2),executionGeneration:1,preparationRef:ref(3),contextBundleRef:ref(4),actorId:id(5),clientId:id(6),humanSessionId:id(7),controlGeneration:1,credentialGeneration:1},connectorRef:ref(8),registrationRef:ref(9),createdAt:new Date(now).toISOString(),expiresAt:new Date(now+10000).toISOString()};}
function receipt(b:ReturnType<typeof input>){return{commandId:id(10),projectId:b.scope.projectId,data:{ref:ref(11),status:'NORMAL_QUEUE_STORED',snapshot:{transport:'NORMAL_PROTECTED',executionId:b.scope.executionId,executionGeneration:1,executorRegistrationRef:b.registrationRef,grantRef:ref(12)}}};}
function fixture(){const events:string[]=[],made:any[]=[],closed:any[]=[],sent:any[]=[],mode={handoff:'OK',duringHandoff:()=>{}};let createCalls=0;
 const port={async create(binding:any,signal:AbortSignal){createCalls++;events.push('create');const owner={async read(scope:any,at:string,readSignal:AbortSignal){assert.deepEqual(scope,binding.scope);assert(!signal.aborted&&!readSignal.aborted);events.push('read');return{checkedAt:at,expiresAt:binding.expiresAt};},async handoff(value:any){events.push('handoff');sent.push(value);mode.duringHandoff();if(mode.handoff==='WRONG_OWNER')return{} as any;return owner;},async close(){events.push('close');closed.push(owner);}};made.push(owner);return owner;}};
 return{port,events,made,closed,sent,mode,calls:()=>createCalls};
}
test('원 객체는 exact 요청·등록·거래의 세 read와 확정 COMMIT 뒤 단회 인계에만 사용한다',async()=>{
 const m=await api(),f=fixture(),attempts=new m.NormalStartPreparationAttempts(f.port),b=input();
 const held=await attempts.create(b);for(let n=0;n<3;n++)await held.observe(b.scope,b.createdAt,new AbortController().signal);
 assert.deepEqual(f.events,['create','read','read','read']);assert.equal(f.sent.length,0);
 held.beforeCommit();await held.committed(receipt(b),'b'.repeat(64));assert.deepEqual(f.events,['create','read','read','read','handoff']);assert.deepEqual(f.sent[0],{preparation:b,commandRef:ref(11),grantRef:ref(12),envelopeHash:'b'.repeat(64)});assert.equal(f.closed.length,0);
 await assert.rejects(held.committed(receipt(b),'b'.repeat(64)));await assert.rejects(attempts.create({...b,scope:{...b.scope,transactionId:'2'}}));assert.equal(f.calls(),1);assert.equal(f.sent.length,1);
});
test('원 요청의 다른 hash·세대·등록·거래 또는 교체된 port/owner는 read·인계·재생성0이다',async()=>{
 const m=await api();for(const mode of ['HASH','GENERATION','TRANSACTION','REGISTRATION','OWNER_READ','PORT']as const){const f=fixture(),attempts=new m.NormalStartPreparationAttempts(f.port),b=input(),held=await attempts.create(b);
  if(mode==='REGISTRATION')await assert.rejects(attempts.create({...b,registrationRef:ref(90)}));
  else if(mode==='OWNER_READ'){f.made[0].read=async()=>{throw Error('REPLACED');};await assert.rejects(held.observe(b.scope,b.createdAt,new AbortController().signal));}
  else if(mode==='PORT'){f.port.create=async()=>{throw Error('REPLACED');};await assert.rejects(held.observe(b.scope,b.createdAt,new AbortController().signal));}
  else await assert.rejects(held.observe({...b.scope,...(mode==='HASH'?{requestHash:contentHash('changed')}:mode==='GENERATION'?{executionGeneration:2}:{transactionId:'2'})},b.createdAt,new AbortController().signal));
  await held.failedBody();await assert.rejects(attempts.create(b));assert.equal(f.calls(),1);assert.equal(f.sent.length,0);assert.equal(f.events.filter(e=>e==='read').length,0);
 }
});
test('10초/더 짧은 원 기한과 create 늦은 반환은 원 객체 한 번 회수·UNKNOWN 보존이며 재생성0이다',async t=>{
 const m=await api();t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});const b=input();b.expiresAt=new Date(Date.now()+20).toISOString();let release!:(v:any)=>void,onClosed!:()=>void,closes=0,creates=0;const didClose=new Promise<void>(resolve=>{onClosed=resolve;});
 const owner={async read(){throw Error('READ0');},async handoff(){throw Error('HANDOFF0');},async close(){closes++;onClosed();}},port={create:async()=>{creates++;return new Promise(resolve=>{release=resolve;});}},attempts=new m.NormalStartPreparationAttempts(port);
 const pending=attempts.create(b),denied=assert.rejects(pending,{message:'NORMAL_START_PREPARATION_OUTCOME_UNKNOWN'});await Promise.resolve();t.mock.timers.tick(21);await denied;release(owner);await didClose;
 assert.equal(closes,1);await assert.rejects(attempts.create(b));assert.equal(creates,1);
 const tooLong={...input(),expiresAt:new Date(Date.now()+10001).toISOString()};await assert.rejects(new m.NormalStartPreparationAttempts(fixture().port).create(tooLong));
 const stale={...input(),createdAt:new Date(Date.now()-20000).toISOString(),expiresAt:new Date(Date.now()-10000).toISOString()},fresh=fixture();await assert.rejects(new m.NormalStartPreparationAttempts(fresh.port).create(stale));assert.equal(fresh.calls(),0);
});
test('거래 실패/COMMIT불명/인계 반환 불명·인계 뒤 만료는 동일 원 객체의 인계 재호출을 만들지 않는다',async t=>{
 const m=await api();t.mock.timers.enable({apis:['Date'],now:Date.now()});for(const mode of ['ROLLBACK','COMMIT_UNKNOWN','WRONG_OWNER','LATE']as const){const f=fixture(),b=input(),attempts=new m.NormalStartPreparationAttempts(f.port),held=await attempts.create(b);
  if(mode==='ROLLBACK')await held.failedBody();
  else if(mode==='COMMIT_UNKNOWN'){held.beforeCommit();held.unknown();}
  else{held.beforeCommit();f.mode.handoff=mode;if(mode==='LATE')f.mode.duringHandoff=()=>t.mock.timers.tick(10001);await assert.rejects(held.committed(receipt(b),'b'.repeat(64)));}
  await assert.rejects(attempts.create(b));assert.equal(f.calls(),1);assert.equal(f.sent.length,mode==='ROLLBACK'||mode==='COMMIT_UNKNOWN'?0:1);assert.equal(f.closed.length,mode==='ROLLBACK'?1:0);
 }
});

test('거래 본문 실패의 close 완료는 원 남은 기한 안에서만 관측하고 동일 close를 다시 호출하지 않는다',async()=>{
 const m=await api(),b=input();let finish!:()=>void,entered!:()=>void,closes=0,settled=false,nested:Promise<any>|undefined,held:any;
 const gate=new Promise<void>(resolve=>{finish=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
 const owner={async read(){throw Error('READ0');},async handoff(){throw Error('HANDOFF0');},async close(){closes++;nested=held.failedBody();entered();await gate;}},port={async create(){return owner;}};
 held=await new m.NormalStartPreparationAttempts(port).create(b);const cleaning=held.failedBody().then((result:any)=>{settled=true;return result;});
 await started;assert.equal(settled,false);finish();assert.deepEqual(await cleaning,{state:'CLOSED_CONFIRMED'});assert.deepEqual(await nested,{state:'CLOSED_CONFIRMED'});assert.deepEqual(await held.failedBody(),{state:'CLOSED_CONFIRMED'});assert.equal(closes,1);
});
test('close 거절·늦음과 본문 완료 뒤 COMMIT 불명은 UNKNOWN이며 정상 인계나 중복 close가 없다',async t=>{
 const m=await api();t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
 for(const mode of ['REJECT','FALSE','LATE','SYNC_LATE','COMMIT_UNKNOWN']as const){let closes=0,finish!:()=>void;const b=input(),gate=new Promise<void>(resolve=>{finish=resolve;});
  const owner={async read(){throw Error('READ0');},async handoff(){throw Error('HANDOFF0');},async close(){closes++;if(mode==='REJECT')throw Error('PRIVATE_CLOSE');if(mode==='FALSE')return false as any;if(mode==='SYNC_LATE')t.mock.timers.tick(10001);await gate;}},port={async create(){return owner;}},attempts=new m.NormalStartPreparationAttempts(port),held=await attempts.create(b);
  if(mode==='COMMIT_UNKNOWN'){held.beforeCommit();held.unknown();assert.deepEqual(await held.failedBody(),{state:'UNKNOWN'});assert.equal(closes,0);}
  else{const cleaning=held.failedBody();if(mode==='LATE')t.mock.timers.tick(10001);assert.deepEqual(await cleaning,{state:'UNKNOWN'});finish();assert.deepEqual(await held.failedBody(),{state:'UNKNOWN'});assert.equal(closes,1);}
  await assert.rejects(attempts.create(b));
 }
});
