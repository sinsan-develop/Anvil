import test from 'node:test';
import assert from 'node:assert/strict';
import {normalInstructionFixture,normalInstructionDeliveryFixture} from './normal-instruction-dispatch-fixture.ts';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const {readNormalInstructionPermitLedger}=await import('../../../apps/server/modules/executions/normal-instruction-permit.ts');

test('normal SEND permit 원장 판독은 빈 원장의 complete·정확 scope·조회 개수 상한을 검산한다',async()=>{
 const f=await normalInstructionFixture();try{
  const b=f.g.snapshot_json.binding,scope={mode:'EXECUTION',projectId:f.f.pid,connectorId:b.registration.connectorId,executionId:f.g.execution_id,executionGeneration:b.executionGeneration,grantRef:f.request.payload.grantRef,credentialGeneration:b.executionCredentialReservation.generation};
  // 비어 있는 기존 원장도 명시 complete와 정확 scope를 요구한다. 불완전 조회는 허가 근거가 아니다.
  assert.deepEqual(readNormalInstructionPermitLedger({complete:true,permits:[]},scope,f.g.snapshot_json.plannedAt),[]);
  for(const bad of [{complete:false,permits:[]},{permits:[]},{complete:true,permits:[],extra:true},{complete:true,permits:Array(51).fill(null)}])assert.throws(()=>readNormalInstructionPermitLedger(bad,scope,f.g.snapshot_json.plannedAt),/INSTRUCTION_PERMIT_LEDGER_INVALID/);
 }finally{await f.close();}
});

test('원 START→SEND 저장→페이지/자료 뒤 별도 SEND permit 한 건과 같은 packet replay를 반환한다',async()=>{
 const h=await normalInstructionDeliveryFixture();try{
  const page=await(await h.prepare(h.prefix+'/commands',{waitMs:0})).get();assert.equal(page.statusCode,200,page.body);
  const item=page.json().items.find((i:any)=>i.envelope.operation==='SEND_INSTRUCTION'),e=item.envelope,f=h.q.g.snapshot_json.binding;
  for(const p of item.materials.groups[0].parts){const r=await(await h.prepare(h.prefix+'/commands/'+e.commandId+'/materials/'+p.materialId)).get();assert.equal(r.statusCode,200,r.body);}
  const request={envelopeHash:e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:contentHash('RAM SEND attempted')},sourceObservationRefs:[...new Map(f.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:f.checks.osFence.evidenceRefs[0]};
  const p=await h.prepare(h.prefix+'/commands/'+e.commandId+'/permit',{},request),first=await p.get();assert.equal(first.statusCode,200,first.body);assert.equal(first.json().executionAuthorized,true);assert.equal(first.json().dispatchPerformed,false);assert.equal(h.permits.length,1);assert.equal(h.permits[0].snapshot_json.state,'NORMAL_INSTRUCTION_PERMITTED');assert.deepEqual(h.permits[0].snapshot_json.reservationRef,e.context.budgetRef);assert.notDeepEqual(e.context.budgetRef,f.budgetReservationRef);
  assert.deepEqual((await p.get()).json(),first.json());assert.equal(h.permits.length,1);
  const other=await h.prepare(h.prefix+'/commands/'+e.commandId+'/permit',{},request),reused=await other.get();assert.equal(reused.statusCode,409,reused.body);assert.equal(h.permits.length,1);
 }finally{await h.close();}
});

for(const fault of ['ROLLBACK','COMMIT_TAG','LOST','BUSY','OS','CORRECTION','REPLAY_RECEIPT','LEDGER'] as const)test('SEND permit '+fault+' 경계에서 단발 소비/원 영수증을 보존한다',async()=>{
 const h=await normalInstructionDeliveryFixture();try{
  const c=h.f.tables.execution_commands!.find(c=>c.snapshot_json.envelope.operation==='SEND_INSTRUCTION')!,e=c.snapshot_json.envelope,f=h.q.g.snapshot_json.binding;
  const request={envelopeHash:e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:contentHash('RAM attempted')},sourceObservationRefs:[...new Map(f.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:structuredClone(f.checks.osFence.evidenceRefs[0])};
  if(fault==='OS')request.osOwnershipRef.id=randomUUID();
  const p=await h.prepare(h.prefix+'/commands/'+e.commandId+'/permit',{},request),events=h.q.j.store.events().length,receipts=h.q.j.store.receipts().length;
  if(fault==='ROLLBACK')h.mode.failPermit=true;
  if(fault==='COMMIT_TAG')h.q.j.store.mode.badTag=true;
  if(fault==='LOST')h.q.j.store.mode.lost=true;
  if(fault==='BUSY')h.mode.busy=true;
  if(fault==='CORRECTION')await h.f.richSources!.supersede(h.f.policyRef);
  if(fault==='REPLAY_RECEIPT'||fault==='LEDGER'){
   const first=await p.get();assert.equal(first.statusCode,200,first.body);
   if(fault==='REPLAY_RECEIPT'){
    const r=h.q.j.store.receipts().find((r:any)=>r.snapshot_json.kind==='NORMAL_INSTRUCTION_PERMIT')!;
    r.snapshot_json.commandRef={...r.snapshot_json.commandRef,id:randomUUID()};r.content_hash=contentHash(canonicalJson(r.snapshot_json));
    const v=h.q.j.store.events().find((v:any)=>v.version===2&&v.snapshot_json.consumption.resultRef.id===r.id)!;
    v.snapshot_json.consumption.resultRef.contentHash=r.content_hash;v.content_hash=contentHash(canonicalJson(v.snapshot_json));
    const permit=h.permits[0]!;permit.snapshot_json.proofRef.contentHash=r.content_hash;permit.content_hash=contentHash(canonicalJson(permit.snapshot_json));
   }else{
    const row=h.permits[0]!,scope=row.snapshot_json.scope,at=row.snapshot_json.issuedAt;
    const seal=(s:any,id=randomUUID())=>({ref:{id,version:1,contentHash:contentHash(canonicalJson(s))},snapshot:s});
    const rows=Array.from({length:50},()=>{const s=structuredClone(row.snapshot_json);s.commandId=randomUUID();s.proofRef.id=randomUUID();return seal(s);});
    assert.equal(readNormalInstructionPermitLedger({complete:true,permits:rows},scope,at).length,50);
    assert.throws(()=>readNormalInstructionPermitLedger({complete:true,permits:[...rows,seal(row.snapshot_json)]},scope,at));
    for(const change of [(s:any)=>s.request.sourceObservationRefs=[{...s.request.sourceObservationRefs[0],id:randomUUID()}],(s:any)=>s.request.osOwnershipRef.id=randomUUID(),(s:any)=>{s.currentFact.intent.mode='WORK';s.currentFact.understandingReviewRef=null;}]){
     const s=structuredClone(row.snapshot_json);change(s);s.requestHash=contentHash(canonicalJson(s.request));const{checkedAt:_,expires:__,...fact}=s.currentFact;s.bindingHash=contentHash(canonicalJson({scope,commandRef:s.commandRef,authorizationReceiptRef:s.authorizationReceiptRef,reservationRef:s.reservationRef,fact}));
     assert.throws(()=>readNormalInstructionPermitLedger({complete:true,permits:[seal(s)]},scope,at));
    }
    for(const key of ['commandId','proofRef'] as const){const bad=structuredClone(rows);bad[1]!.snapshot[key]=bad[0]!.snapshot[key];bad[1]!.ref.contentHash=contentHash(canonicalJson(bad[1]!.snapshot));assert.throws(()=>readNormalInstructionPermitLedger({complete:true,permits:bad},scope,at));}
    return;
   }
  }
  const r=await p.get();assert.notEqual(r.statusCode,200,r.body);
  if(fault==='LOST'){assert.equal(r.statusCode,503);assert.equal(h.q.j.store.mode.discards,1);assert.equal(h.permits.length,1);h.q.j.store.mode.lost=false;const replay=await p.get();assert.equal(replay.statusCode,200,replay.body);assert.equal(h.permits.length,1);assert.equal(h.q.j.store.events().length,events+1);assert.equal(h.q.j.store.receipts().length,receipts+1);}
  else if(fault==='REPLAY_RECEIPT')assert.equal(h.permits.length,1);
  else{assert.equal(h.permits.length,0);assert.equal(h.q.j.store.events().length,events);assert.equal(h.q.j.store.receipts().length,receipts);}
 }finally{await h.close();}
});


test('C 선택 SEND는 서명한 원 요청과 전체 permit을 보존하고 같은 packet만 재조회한다',async()=>{
 const h=await normalInstructionDeliveryFixture();try{
  const c=h.f.tables.execution_commands!.find((r:any)=>r.snapshot_json?.envelope.operation==='SEND_INSTRUCTION')!,e=c.snapshot_json.envelope,f=h.q.g.snapshot_json.binding;
  assert.equal(f.intent.mode,'CONTEXT_REVIEW');
  const request={envelopeHash:e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:contentHash('C attempted')},sourceObservationRefs:[...new Map(f.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:f.checks.osFence.evidenceRefs[0],representation:'SEND_PERMIT_SOURCE_V1'};
  const packet=await h.prepare(h.prefix+'/commands/'+e.commandId+'/permit',{},request),first=await packet.get();
  assert.equal(first.statusCode,200);
  const reply=first.json(),snapshot=h.permits[0].snapshot_json;
  assert.deepEqual(reply.executionAuthority,{kind:'NORMAL_SEND_PERMIT_SOURCE_V1',permitSnapshot:snapshot});
  assert.deepEqual(snapshot.request,request);assert.equal(snapshot.requestHash,contentHash(canonicalJson(request)));
  assert.equal(reply.permit.ref.contentHash,contentHash(canonicalJson(snapshot)));
  assert.deepEqual((await packet.get()).json(),reply);assert.equal(h.permits.length,1);
  assert.equal(readNormalInstructionPermitLedger({complete:true,permits:[{ref:reply.permit.ref,snapshot}]},snapshot.scope,snapshot.issuedAt).length,1);
 }finally{await h.close();}
});


for(const selected of [false,true])test('C 선택값 양방향 교체는 원 서명과 같은 명령을 바꾸지 않는다 '+selected,async()=>{
 const h=await normalInstructionDeliveryFixture();try{
  const c=h.f.tables.execution_commands!.find((r:any)=>r.snapshot_json?.envelope.operation==='SEND_INSTRUCTION')!,e=c.snapshot_json.envelope,f=h.q.g.snapshot_json.binding;
  const request:Record<string,unknown>={envelopeHash:e.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:contentHash('signed selection')},sourceObservationRefs:[...new Map(f.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:f.checks.osFence.evidenceRefs[0],...(selected?{representation:'SEND_PERMIT_SOURCE_V1'}:{})};
  const path=h.prefix+'/commands/'+e.commandId+'/permit',packet=await h.prepare(path,{},request),events=h.q.j.store.events().length,receipts=h.q.j.store.receipts().length;
  if(selected)delete request.representation;else request.representation='SEND_PERMIT_SOURCE_V1';
  assert.notEqual((await packet.get()).statusCode,200);assert.equal(h.permits.length,0);
  assert.equal(h.q.j.store.events().length,events);assert.equal(h.q.j.store.receipts().length,receipts);
  if(selected)request.representation='SEND_PERMIT_SOURCE_V1';else delete request.representation;
  const good=await packet.get();assert.equal(good.statusCode,200);
  assert.equal(Object.hasOwn(good.json(),'executionAuthority'),selected);
  const saved=structuredClone(h.permits);
  if(selected)delete request.representation;else request.representation='SEND_PERMIT_SOURCE_V1';
  const changed=await h.prepare(path,{},request),afterEvents=h.q.j.store.events().length,afterReceipts=h.q.j.store.receipts().length;assert.notEqual((await changed.get()).statusCode,200);
  assert.deepEqual(h.permits,saved);assert.equal(h.q.j.store.events().length,afterEvents);assert.equal(h.q.j.store.receipts().length,afterReceipts);
 }finally{await h.close();}
});

test('C 요청의 구형/선택 닫힌 형상 및 전체 READ 적격성을 분리한다',async()=>{
 const {readNormalPermitRequestV1,normalSendPermitSourceEligible}=await import('../../../contracts/runtime/normal-send-permit-source-v1.ts');
 const ref={id:randomUUID(),version:1,contentHash:'a'.repeat(64)},old={envelopeHash:'b'.repeat(64),localAttemptRef:ref,sourceObservationRefs:[ref],osOwnershipRef:ref};
 assert.deepEqual(readNormalPermitRequestV1(old),old);
 assert.deepEqual(readNormalPermitRequestV1({...old,representation:'SEND_PERMIT_SOURCE_V1'}),{...old,representation:'SEND_PERMIT_SOURCE_V1'});
 for(const representation of [null,'',true,'FIRST_SEND_AUTHORITY_V1','SEND_PERMIT_SOURCE_V2'])assert.throws(()=>readNormalPermitRequestV1({...old,representation}));
 assert.throws(()=>readNormalPermitRequestV1({...old,representation:'SEND_PERMIT_SOURCE_V1',extra:true}));
 const f={intent:{mode:'CONTEXT_REVIEW',sourceScopes:[{targets:[{access:'READ'}]},{targets:[{access:'READ'}]}]}};
 assert.equal(normalSendPermitSourceEligible(f),true);
 assert.equal(normalSendPermitSourceEligible({...f,intent:{...f.intent,mode:'WORK'}}),false);
 for(const access of ['WRITE','READ_WRITE',null,undefined]){const bad=structuredClone(f);(bad.intent.sourceScopes[1]!.targets[0] as any).access=access;assert.equal(normalSendPermitSourceEligible(bad),false);}
});
