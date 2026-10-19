import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {SyntheticStartReceiver} from '../../../apps/connector/runtime/execution-start-receiver.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-permits.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)},now=Date.parse('2026-10-19T12:00:00.000Z'),iso=(n:number)=>new Date(n).toISOString();
const scope={mode:'EXECUTION',projectId:pid,connectorId:pid,executionId:eid,executionGeneration:1,grantRef:ref,credentialGeneration:1};
function fixture(){
 const sourceScopes=[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}];
 const fact:any={schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:pid,executionId:eid,executionGeneration:1,subject:{userId:pid,clientId:eid,humanSessionId:eid,controlGeneration:1,credentialGeneration:1},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:1},registration:{ref,connectorId:pid,generation:1,hostPublicKeyFingerprint:'b'.repeat(64)},intent:{projectId:pid,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes,mode:'CONTEXT_REVIEW',reason:'합성 정확 명령'},preparationRef:ref,permissionPolicyRef:ref,budgetReservationRef:ref,basisRefs:[ref],latestInstructionRefs:[],understandingReviewRef:null,checks:Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(n=>[n,{state:n==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:n==='understanding'?[]:[ref]}])),writerState:'OWNED',expires:Object.fromEntries(['humanSession','permissionPolicy','registration','budget','automaticScope'].map(n=>[n,iso(now+120000)])),checkedAt:iso(now),executionAuthorized:false,dispatchPerformed:false};
 const unsigned={schemaVersion:1,commandId:pid,issuedAt:iso(now-1000),expiresAt:iso(now+60000),executorRegistrationRef:ref,context:{projectId:pid,assignmentId:pid,executionId:eid,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes},operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}};
 const envelope={...unsigned,envelopeHash:contentHash(canonicalJson(unsigned))};
 const queue={transport:'SYNTHETIC_ONLY',executionId:eid,executionGeneration:1,state:'SYNTHETIC_QUEUED',grantRef:ref,reservationRef:ref,executorRegistrationRef:ref,operation:'START_SESSION',payload:unsigned.payload,humanSessionId:eid,sourceScopes,budgetPolicyRef:ref,queuedAt:unsigned.issuedAt,executionAuthorized:false,dispatchPerformed:false};
 const request={envelopeHash:envelope.envelopeHash,localAttemptRef:ref,sourceObservationRefs:[ref],osOwnershipRef:ref};
 const current:any={fact,grantRef:ref,grantExpiresAt:iso(now+90000),commandRef:{id:eid,version:1,contentHash:contentHash(canonicalJson(queue))},commandSnapshot:{...queue,envelope},authorizationReceiptRef:ref,
  proof:{kind:'SYNTHETIC_VERIFIED_REQUEST_PROOF',ref,target:executionTarget('POST','/api/v1/connectors/'+pid+'/executions/'+eid+'/commands/'+pid+'/permit',[],canonicalJson(request)),grantRef:ref,credentialGeneration:1,publicKeyFingerprint:'b'.repeat(64),verifiedAt:iso(now),challengeExpiresAt:iso(now+10000)}};
 return{current,request,envelope};
}
function harness(){const f=fixture();let records:any[]=[],clock=now,failAppend=false,changeAfterAppend=false;let tail=Promise.resolve();
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(_scope:any,body:any)=>{const prior=tail;let release!:()=>void;tail=new Promise(r=>{release=r;});await prior;const draft=structuredClone(records);try{const result=await body({clock:async()=>iso(clock),current:async()=>structuredClone(f.current),read:async()=>({complete:true,permits:structuredClone(draft)}),append:async(r:any)=>{if(failAppend)throw Error('PRIVATE_TOKEN_PERMIT_FAILURE');draft.push(structuredClone(r));if(changeAfterAppend)f.current.fact.subject.controlGeneration++;}});records=draft;return result;}finally{release();}}};
 const make=()=>{assert.equal(typeof m.SyntheticCommandPermits,'function');return new m.SyntheticCommandPermits(store);};
 return{...f,store,make,get records(){return records;},get clock(){return clock;},set clock(n:number){clock=n;f.current.fact.checkedAt=iso(n);},get failAppend(){return failAppend;},set failAppend(v:boolean){failAppend=v;},get changeAfterAppend(){return changeAfterAppend;},set changeAfterAppend(v:boolean){changeAfterAppend=v;}};
}
test('정확 서버 명령/시도/관측/proof만 1회 합성 permit으로 저장하고 TTL을 연장하지 않는다',async()=>{
 const h=harness(),s=h.make(),first=await s.consume(scope,pid,h.request);assert.equal(first.expiresAt,iso(now+10000));assert.equal(first.executionAuthorized,false);assert.equal(first.dispatchPerformed,false);assert.equal(h.records.length,1);
 h.clock=now+15000;assert.deepEqual(await s.consume(scope,pid,h.request),first);assert.equal(h.records.length,1);
});
test('다른 봉투/localAttempt/source/OS 관측 또는 proof 대상은 저장하지 않는다',async()=>{
 for(const patch of [{envelopeHash:'f'.repeat(64)},{localAttemptRef:{...ref,version:2}},{sourceObservationRefs:[{...ref,version:2}]},{osOwnershipRef:{...ref,version:2}}]){const h=harness();await assert.rejects(h.make().consume(scope,pid,{...h.request,...patch}));assert.equal(h.records.length,0);}
 const h=harness();h.current.proof.target.bodyHash='f'.repeat(64);await assert.rejects(h.make().consume(scope,pid,h.request));assert.equal(h.records.length,0);
});
test('현재 writer 불명·OS/source 미확인·회수 scope·현재 세대 변경은 새 permit을 만들지 않는다',async()=>{
 for(const kind of ['writer','os','source','recovery','control']){const h=harness();if(kind==='writer')h.current.fact.writerState='UNKNOWN';if(kind==='os')h.current.fact.checks.osFence.state='UNVERIFIED';if(kind==='source')h.current.fact.checks.source.state='UNVERIFIED';if(kind==='control')h.changeAfterAppend=true;await assert.rejects(h.make().consume(kind==='recovery'?{...scope,mode:'RECOVERY'}:scope,pid,h.request));assert.equal(h.records.length,0);}
});
test('같은 명령 다른 시도는 재허가하지 않고 동시 같은 요청은 한 permit만 저장한다',async()=>{
 const h=harness(),s=h.make(),result=await Promise.all([s.consume(scope,pid,h.request),s.consume(scope,pid,h.request)]);assert.deepEqual(result[0],result[1]);assert.equal(h.records.length,1);
 const changed={...h.request,localAttemptRef:{...ref,version:2}};h.current.proof.target=executionTarget('POST','/api/v1/connectors/'+pid+'/executions/'+eid+'/commands/'+pid+'/permit',[],canonicalJson(changed));await assert.rejects(s.consume(scope,pid,changed),/PERMIT_COMMAND_ATTEMPT_CONFLICT/);assert.equal(h.records.length,1);
});
test('저장 실패는 permit0·고정 오류이며 만료 challenge는 최초 소비할 수 없다',async()=>{
 const h=harness();h.failAppend=true;await assert.rejects(h.make().consume(scope,pid,h.request),(e:Error)=>e.message==='PERMIT_STORAGE_UNAVAILABLE');assert.equal(h.records.length,0);
 const k=harness();k.clock=now+10000;await assert.rejects(k.make().consume(scope,pid,k.request));assert.equal(k.records.length,0);
});
test('합성 수신기의 실제 START_ATTEMPTED ref를 서버 permit에 결박한 뒤에만 fake wire를 보낸다',async()=>{
 const h=harness(),events:any[]=[];let sends=0;
 const local:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,body:any)=>body({read:async()=>({complete:true,events:structuredClone(events)}),appendAndSync:async(e:any)=>{events.push(structuredClone(e));}})};
 const authority:any={transport:'SYNTHETIC_ONLY',consume:async(e:any,attempt:any)=>{const body={...h.request,localAttemptRef:attempt};assert.deepEqual(attempt,events[1].ref);h.current.proof.target=executionTarget('POST','/api/v1/connectors/'+pid+'/executions/'+eid+'/commands/'+pid+'/permit',[],canonicalJson(body));return h.make().consumeForReceiver(scope,e.commandId,body);}};
 const wire:any={transport:'SYNTHETIC_ONLY',send:async()=>{assert.equal(events[2].snapshot.state,'PERMIT_RECORDED');assert.deepEqual(events[2].snapshot.permitRef,h.records[0].ref);sends++;return{transport:'SYNTHETIC_ONLY',responseRef:ref};}};
 const r=new SyntheticStartReceiver(local,authority,wire,{context:h.envelope.context as any,executorRegistrationRef:ref,grantRef:ref},()=>now);
 await r.receive(h.envelope);assert.equal((await r.start(h.envelope)).state,'RESPONSE_RECORDED');assert.equal(sends,1);assert.equal(h.records.length,1);await r.start(h.envelope);assert.equal(sends,1);
});
for(const boundary of ['grant','proof'])test('append 중 '+boundary+' 기한이 축소되면 더 긴 permit을 COMMIT하지 않는다',async()=>{
 const h=harness(),original=h.store.transaction;
 h.store.transaction=(s:any,body:any)=>original(s,(tx:any)=>body({...tx,append:async(r:any)=>{await tx.append(r);if(boundary==='grant')h.current.grantExpiresAt=iso(now+5000);else h.current.proof.challengeExpiresAt=iso(now+5000);}}));
 await assert.rejects(h.make().consume(scope,pid,h.request),/PERMIT_CURRENT_BINDING_CHANGED/);assert.equal(h.records.length,0);
});
test('같은 결과 재조회도 현재 grant보다 긴 permit을 다시 제공하지 않는다',async()=>{
 const h=harness();await h.make().consume(scope,pid,h.request);h.current.grantExpiresAt=iso(now+5000);
 await assert.rejects(h.make().consume(scope,pid,h.request));assert.equal(h.records.length,1);
});
