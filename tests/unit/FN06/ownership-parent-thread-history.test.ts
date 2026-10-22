import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerProtectedHandleRef,validateProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {ownershipInstructionHistoryFixture} from './ownership-instruction-history-fixture.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-parent-thread-history.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
async function fixture(options:{humanCredentialGeneration?:number}={}){
 const f=await ownershipInstructionHistoryFixture(options),fact=f.permit.snapshot.currentFact,c:any=f.shift(f.x.parent),scope=f.permit.snapshot.scope;
 Object.assign(c,{projectId:f.scope.projectId,agentSessionRef:structuredClone(fact.agentSession.sessionRef),responsibleBindingRef:structuredClone(fact.agentSession.roleBindingRef),connectionRef:structuredClone(fact.intent.connectionRef),environmentRef:structuredClone(fact.intent.environmentRef),executorRegistrationRef:structuredClone(fact.registration.ref),assignmentRef:structuredClone(fact.intent.assignmentRef),execution:{id:f.scope.executionId,generation:1}});
 const rehash=()=>{const{protectedHandleRef:_,...binding}=c;c.protectedHandleRef=providerProtectedHandleRef(binding,'f'.repeat(64));return validateProviderSessionClaim(c).ref;};
 let parentRef=rehash();const receipt:any={claimRef:parentRef,recordedAt:c.capturedAt,state:'PROVIDER_CLAIM_RECORDED',sourceVerification:'PROVIDER_CLAIM_ONLY',nonceConsumed:true,credentialIssued:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false};
 const q:any={projectId:f.scope.projectId,agentSessionId:c.agentSessionRef.id,executionId:f.scope.executionId,generation:1,commandId:c.commandId,kind:'THREAD',requestIdDigest:c.source.requestIdDigest,claimHash:parentRef.contentHash};
 const eventKey=hash([q.projectId,q.executionId,1,q.commandId,'THREAD',q.requestIdDigest]),row:any={project_id:q.projectId,claim_id:c.claimId,version:1,execution_id:q.executionId,generation:1,command_id:q.commandId,agent_session_id:q.agentSessionId,agent_session_version:1,grant_id:scope.grantRef.id,grant_version:scope.grantRef.version,permit_id:c.permitRef.id,permit_version:1,kind:'THREAD',request_id_digest:q.requestIdDigest,event_key:eventKey,content_hash:parentRef.contentHash,snapshot_json:{scope:structuredClone(scope),eventKey,claim:c,receipt},recorded_at:new Date(receipt.recordedAt)};
 let mode='',reads=0;const db={async query(sql:string,args:any[]=[]){
  if(sql.includes('FROM anvil.auth_sessions')&&sql.includes('WHERE s.id=')){assert.deepEqual(args,[fact.subject.humanSessionId,fact.subject.userId,fact.subject.clientId]);return{rows:[{...f.f.row,user_id:fact.subject.userId}]};}
  if(sql.includes('FROM anvil.agent_sessions')){assert.deepEqual(args,[q.projectId,q.agentSessionId]);return{rows:[f.sessionRow]};}
  if(sql.includes('FROM anvil.provider_session_claims')){reads++;assert.deepEqual(args,[q.projectId,q.agentSessionId,eventKey]);if(mode==='REVOKE')(f.f.row as any).revoked_at=f.f.now;if(mode==='EXPIRE')f.f.late();return{rows:mode==='MISSING'?[]:[row]};}
  return f.db.query(sql,args);
 },release(){throw Error('CALLER_OWNS_CONNECTION');}} as unknown as PoolClient;
 const selection:any={instruction:f.selection,parentQuery:q,parentRef:structuredClone(parentRef)};
 const read=()=>{assert.equal(typeof m.readOwnershipParentThreadHistory,'function','현재 HUMAN/원 SEND 아래 parent THREAD 이력 연결이 필요하다');return m.readOwnershipParentThreadHistory(db,f.f.access,f.f.token,f.f.csrf,f.scope,f.f.prep.ref,selection);};
 const reseal=()=>{parentRef=rehash();receipt.claimRef=parentRef;row.content_hash=parentRef.contentHash;q.claimHash=parentRef.contentHash;selection.parentRef=structuredClone(parentRef);};
 return{f,c,q,row,receipt,selection,read,reseal,reads:()=>reads,mode(v:string){mode=v;}};
}
test('현재 HUMAN/OWNER·예약·원 THREAD receipt를 SEND scope에 대조하고 raw/handle 없이 역사 refs만 반환한다',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.purpose,'OWNERSHIP_PARENT_THREAD_HISTORY_ONLY');assert.deepEqual(r.parentThreadClaimRef,f.selection.parentRef);assert.equal(r.currentParentVerified,false);assert.equal(r.bindingAuthorized,false);assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);assert.equal(r.writerState,'UNKNOWN');assert(!JSON.stringify(r).includes('protectedHandleRef'));assert(!JSON.stringify(r).includes('thread/start'));
});
test('정합 재해시한 다른 parent 연결·등록·역할·세션은 원 SEND의 parent로 채택하지 않는다',async()=>{
 for(const change of [(f:any)=>f.c.connectionRef={...f.c.connectionRef,contentHash:'0'.repeat(64)},(f:any)=>f.c.executorRegistrationRef={...f.c.executorRegistrationRef,version:1},(f:any)=>f.c.responsibleBindingRef={...f.c.responsibleBindingRef,contentHash:'0'.repeat(64)},(f:any)=>f.f.sessionRow.content_hash='0'.repeat(64)]){const f=await fixture();change(f);f.reseal();await assert.rejects(f.read(),/OWNERSHIP_PARENT_THREAD_HISTORY_UNAVAILABLE/);}
});
test('원 parent 부재·최종 HUMAN 회수/기한은 역사 claim이 있어도 거절한다',async()=>{
 for(const mode of ['MISSING','REVOKE','EXPIRE']){const f=await fixture();f.mode(mode);await assert.rejects(f.read(),/OWNERSHIP_PARENT_THREAD_HISTORY_UNAVAILABLE/);assert(f.reads()>0);}
});
test('OWNER가 아니거나 잘못된 query/claim ref면 parent 원문 조회 전에 거절한다',async()=>{
 for(const change of [(f:any)=>f.f.f.member.participation='VIEWER',(f:any)=>f.selection.parentQuery.kind='TURN',(f:any)=>f.selection.parentRef.contentHash='0'.repeat(64)]){const f=await fixture();change(f);await assert.rejects(f.read(),/OWNERSHIP_PARENT_THREAD_HISTORY_UNAVAILABLE/);assert.equal(f.reads(),0);}
});
test('원 parent의 실행 credential/connector나 SEND 이후 생성 시각을 정합 재해시해도 거절한다',async()=>{
 for(const change of [(f:any)=>f.row.snapshot_json.scope.credentialGeneration=2,(f:any)=>f.row.snapshot_json.scope.connectorId=f.f.scope.projectId,(f:any)=>{f.c.capturedAt=new Date(Date.parse(f.f.record.snapshot.envelope.issuedAt)+1).toISOString();f.receipt.recordedAt=f.c.capturedAt;f.row.recorded_at=new Date(f.c.capturedAt);}]){const f=await fixture();change(f);f.reseal();await assert.rejects(f.read(),/OWNERSHIP_PARENT_THREAD_HISTORY_UNAVAILABLE/);assert(f.reads()>0);}
});
test('HUMAN 세대2·실행 credential1은 구분하고 await 이후 caller parent 교체는 채택하지 않는다',async()=>{
 const f=await fixture({humanCredentialGeneration:2}),expected=structuredClone(f.selection.parentRef),pending=f.read();f.selection.parentRef.contentHash='0'.repeat(64);const r=await pending;assert.deepEqual(r.parentThreadClaimRef,expected);assert.equal(r.currentParentVerified,false);
});
test('row와 함께 바꾼 다른 grant 또는 같은 grant ID의 다른 hash는 원 SEND parent로 연결하지 않는다',async()=>{
 for(const sameId of [false,true]){const f=await fixture(),g=f.row.snapshot_json.scope.grantRef;f.row.snapshot_json.scope.grantRef={...g,...(sameId?{contentHash:'0'.repeat(64)}:{id:f.f.scope.projectId})};f.row.grant_id=f.row.snapshot_json.scope.grantRef.id;f.reseal();await assert.rejects(f.read(),/OWNERSHIP_PARENT_THREAD_HISTORY_UNAVAILABLE/);assert(f.reads()>0);}
});
test('parent 이력 읽기는 앞선 proof 서명·credential 현재성·SEND 권위 미확인을 숨기지 않는다',async()=>{
 const f=await fixture(),r=await f.read();for(const missing of ['PROOF_SIGNATURE_VERIFICATION','EXECUTION_CREDENTIAL_CURRENTNESS','CURRENT_SEND_AUTHORITY'])assert(r.missingEvidence.includes(missing));assert.equal(r.currentParentVerified,false);
});
