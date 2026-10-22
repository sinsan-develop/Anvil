import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import {SyntheticPgProviderClaimStore} from '../../../apps/server/modules/executions/provider-session-claim-store.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
test('TURN PG source는 START표 대신 기존 SEND journal/원 budget을 읽고 같은 nonce tx에서 보호 flush한다',async()=>{
 for(const corruptParent of [false,true]){
 const x=await providerTurnFixture(),calls:any[]=[],parent=structuredClone(x.f.state().entries[0]);let saved:any=null,parentReads=0;
 if(corruptParent){parent.claim.kind='TURN';parent.claim.parentThreadClaimRef=parent.receipt.claimRef;}
 const source=new SyntheticPgProviderClaimStore({connect:async()=>{throw Error('NO_CONNECT');}} as any,{transport:'SYNTHETIC_ONLY',key:async()=>null},{transport:'SYNTHETIC_ONLY',current:async()=>null});
 const store:any={transport:'SYNTHETIC_ONLY',transaction:(scope:any,body:any)=>x.f.store.transaction(scope,async(base:any)=>{
  let draft:any=null;const p=x.permit.snapshot,db:any={query:async(sql:string,params:any[])=>{
   calls.push({sql,params});
   if(sql.includes('FROM anvil.execution_instruction_permits'))return{rows:[{project_id:scope.projectId,execution_id:scope.executionId,generation:1,id:x.permit.ref.id,version:1,content_hash:x.permit.ref.contentHash,snapshot_json:p,command_id:p.commandId,command_record_id:p.commandRef.id,command_record_version:1,grant_id:p.scope.grantRef.id,grant_version:1,reservation_id:p.reservationRef.id,reservation_version:1,proof_result_id:p.proofRef.id,proof_result_version:1,envelope_hash:p.request.envelopeHash}]};
   if(sql.includes('FROM anvil.usage_reservations'))return{rows:[{reservation_id:x.reservation.ref.id,version:1,content_hash:x.reservation.ref.contentHash,snapshot_json:x.reservation.snapshot}]};
   if(sql.includes('FROM anvil.provider_session_claims')){if(params[3]===parent.claim.claimId){parentReads++;if(corruptParent&&parentReads>4)throw Error('BOUNDED_TEST_GUARD');}return{rows:params[3]===parent.claim.claimId?[{snapshot_json:parent,content_hash:hash(parent.claim),claim_id:parent.claim.claimId,project_id:scope.projectId,execution_id:scope.executionId,generation:1}]:[]};}
   if(sql.includes('FROM anvil.provider_session_claim_proof_results'))return{rows:[]};
   if(sql.startsWith('SELECT anvil.record_provider_session_claim(')){const entry=JSON.parse(params[1]),ref=JSON.parse(params[2]);assert.equal(entry.claim.kind,'TURN');assert.equal((await base.challenges.read()).events.some((e:any)=>canonicalJson(e.snapshot.consumption?.resultRef??null)===canonicalJson(ref)),true);draft=entry;return{rows:[{result:{claimRef:entry.receipt.claimRef,proofResultRef:ref,recorded:true,executionAuthorized:false,dispatchPerformed:false}}]};}
   throw Error('UNEXPECTED_SQL');
  }};
  const bound=source.bind(db,scope,{challenges:base.challenges,permits:{current:async()=>{const{permit:_,localAttemptRef:__,instructionReservation:___,...raw}=x.f.basis;return structuredClone(raw);},read:async()=>{throw Error('NO_START_PERMIT_READ');},append:async()=>{throw Error('NO_PERMIT_APPEND');}}} as any),result=await body(bound.tx);await bound.flush();saved=draft;return result;
 })};
 const p=await x.f.issue(x.claim),invoke=()=>new SyntheticProviderSessionClaims(store).ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw);
 if(corruptParent){await assert.rejects(invoke());assert.ok(parentReads<=2,'TURN parent must be rejected before recursive lookup');assert.equal(saved,null);continue;}
 const r=await invoke();assert.equal(r.receipt.claimRef.id,x.claim.claimId);assert.equal(saved.claim.kind,'TURN');assert.equal(calls.some(c=>c.sql.includes('execution_instruction_permits')),true);assert.equal(calls.some(c=>c.sql.includes('execution_start_permits')),false);assert.equal(calls.some(c=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(c.sql)),false);
 }
});
