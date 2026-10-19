import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-observations.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)},now='2026-10-19T12:00:00.000Z';
const scope={mode:'EXECUTION',projectId:id,connectorId:id,executionId:id,executionGeneration:1,grantRef:ref,credentialGeneration:1};
function event(sequence:number,type='UNKNOWN'){return{projectId:id,executionId:id,executionGeneration:1,sequence,eventId:sequence.toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111',type,commandId:id,envelopeHash:'b'.repeat(64),localRecordRef:{...ref,version:sequence},processRef:null,occurredAt:now,reasonCode:type==='UNKNOWN'?'PROVIDER_RESPONSE_LOST':'UNVERIFIED_PROVIDER_CLAIM'};}
const batch=(events:any[])=>({events,batchHash:contentHash(canonicalJson(events))});
function harness(){let events:any[]=[],ack:any=null,authorityRef:any=ref,complete=true,failAck=false,afterAppend=false,clock=now,expireDuringCurrent=false;let tail=Promise.resolve();let writes=0;
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(_scope:any,body:any)=>{const prior=tail;let unlock!:()=>void;tail=new Promise(r=>{unlock=r;});await prior;const draft=structuredClone({events,ack});try{
  const result=await body({clock:async()=>clock,current:async()=>{if(expireDuringCurrent)clock='2026-10-19T12:00:30.001Z';return{transport:'SYNTHETIC_ONLY',scope:structuredClone(_scope),operation:'SYNC_OBSERVATIONS',authorityRef:structuredClone(authorityRef),checkedAt:now,expiresAt:'2026-10-19T12:00:30.000Z'};},read:async()=>({complete,...structuredClone(draft)}),append:async(e:any)=>{draft.events.push(structuredClone(e));writes++;if(afterAppend)authorityRef={...ref,version:2};},saveAck:async(a:any)=>{if(failAck)throw Error('PRIVATE_TOKEN_ACK_FAILURE');draft.ack=structuredClone(a);}});events=draft.events;ack=draft.ack;return result;
 }finally{unlock();}}};
 const make=()=>{assert.equal(typeof m.SyntheticExecutionObservations,'function');return new m.SyntheticExecutionObservations(store);};
 return{store,make,get events(){return events;},get ack(){return ack;},get writes(){return writes;},set complete(v:boolean){complete=v;},set failAck(v:boolean){failAck=v;},set afterAppend(v:boolean){afterAppend=v;},set expireDuringCurrent(v:boolean){expireDuringCurrent=v;},corrupt:()=>{events[0].snapshot.event.reasonCode='NONE';}};
}
test('관측 순번 공백은 ACK를 올리지 않고 누락 도착 뒤에만 연속 ACK를 저장한다',async()=>{
 const h=harness(),s=h.make(),first=await s.ingest(scope,batch([event(1),event(3)]));assert.equal(first.snapshot.highestContiguous,1);assert.deepEqual(first.snapshot.gaps,[{from:2,to:2}]);assert.equal(first.snapshot.maxSequence,3);
 const next=await s.ingest(scope,batch([event(2)]));assert.equal(next.snapshot.highestContiguous,3);assert.deepEqual(next.snapshot.gaps,[]);assert.equal(h.events.length,3);assert.equal(next.snapshot.writerReleaseVerified,false);
 assert.deepEqual(await h.make().ingest(scope,batch([event(1),event(3)])),next);assert.equal(h.events.length,3);assert.equal(h.writes,3);
});
test('같은 순번 다른 내용·eventId 재사용·다른 실행/세대·batch hash 변조는 저장하지 않는다',async()=>{
 const h=harness(),s=h.make();await s.ingest(scope,batch([event(1)]));
 for(const input of [batch([{...event(1),type:'STARTED'}]),batch([{...event(2),eventId:event(1).eventId}]),batch([{...event(2),executionGeneration:2}]),{...batch([event(2)]),batchHash:'f'.repeat(64)}])await assert.rejects(s.ingest(scope,input));assert.equal(h.events.length,1);
});
test('STARTED/STOPPED 공급자 주장이나 heartbeat만으로 실제 실행·writer 회수를 확정하지 않는다',async()=>{
 const h=harness(),result=await h.make().ingest(scope,batch([event(1,'STARTED'),event(2,'STOPPED'),event(3,'HEARTBEAT')]));
 assert.equal(result.snapshot.writerReleaseVerified,false);assert.equal(result.snapshot.executionAuthorized,false);assert.equal(result.snapshot.dispatchPerformed,false);for(const e of h.events){assert.equal(e.snapshot.verification,'PROVIDER_CLAIM_ONLY');assert.equal(e.snapshot.transport,'SYNTHETIC_ONLY');}
});
test('ACK 쓰기 실패·현재 권한세대 변경은 관측과 ACK를 함께 rollback하고 오류 원문을 숨긴다',async()=>{
 for(const fault of ['ack','current']){const h=harness();if(fault==='ack')h.failAck=true;else h.afterAppend=true;await assert.rejects(h.make().ingest(scope,batch([event(1)])),(e:Error)=>!e.message.includes('PRIVATE_TOKEN'));assert.equal(h.events.length,0);assert.equal(h.ack,null);}
});
test('불완전/변조 journal·비합성 port·자유 원문/과대 batch는 거절한다',async()=>{
 const h=harness(),s=h.make();h.complete=false;await assert.rejects(s.ingest(scope,batch([event(1)])),/OBSERVATION_LEDGER_INCOMPLETE/);h.complete=true;await s.ingest(scope,batch([event(1)]));h.corrupt();await assert.rejects(s.ingest(scope,batch([event(2)])),/OBSERVATION_LEDGER_INVALID/);
 for(const input of [batch([{...event(2),message:'PRIVATE_TOKEN_NEVER_STORE'}]),batch([{...event(2),reasonCode:'PRIVATE_TOKEN'}]),batch(Array.from({length:201},(_,i)=>event(i+1)))])await assert.rejects(h.make().ingest(scope,input));
 assert.throws(()=>new m.SyntheticExecutionObservations({transport:'REAL',transaction:async()=>null}),/SYNTHETIC_OBSERVATION_STORE_REQUIRED/);
});
test('실행 credential 교체/회수용 scope도 기존 순번을 초기화하지 않고 동시 중복은 관측 1개만 저장한다',async()=>{
 const h=harness(),first=await h.make().ingest(scope,batch([event(1)]));const recovery={...scope,mode:'RECOVERY',grantRef:{...ref,version:2},credentialGeneration:2};
 const result=await Promise.all([h.make().ingest(recovery,batch([event(2)])),h.make().ingest(recovery,batch([event(2)]))]);assert.deepEqual(result[0],result[1]);assert.equal(result[0].snapshot.highestContiguous,2);assert.equal(h.events.length,2);assert.notEqual(result[0].ref.contentHash,first.ref.contentHash);
});
test('현재성 조회 중 기한이 지나면 관측 append 전 거절한다',async()=>{
 const h=harness();h.expireDuringCurrent=true;await assert.rejects(h.make().ingest(scope,batch([event(1)])),/OBSERVATION_CURRENT_AUTHORITY_REQUIRED/);assert.equal(h.writes,0);
});
test('transaction port가 전달받은 scope 별칭을 바꿔도 다른 세대를 저장하지 않는다',async()=>{
 const k=harness(),original=k.store.transaction;k.store.transaction=(s:any,fn:any)=>{s.executionGeneration=2;return original(s,fn);};
 await assert.rejects(k.make().ingest(scope,batch([{...event(1),executionGeneration:2}])));assert.equal(k.events.length,0);
});
