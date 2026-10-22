import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import {providerClaimFixture} from './provider-claim-fixture.ts';
const m:any=await import('../../../apps/server/modules/executions/provider-session-claim-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const f=providerClaimFixture(),calls:any[]=[];let persisted:any={entries:[],mappings:[],proofs:[],audits:[]},fault='',connects=0;
 const make=()=>{assert.equal(typeof m.SyntheticPgProviderClaimStore,'function');return new m.SyntheticPgProviderClaimStore({connect:async()=>{connects++;throw Error('NO_NESTED_CONNECTION');}},{transport:'SYNTHETIC_ONLY',key:async()=>null},{transport:'SYNTHETIC_ONLY',current:async()=>null});};
 const store:any={transport:'SYNTHETIC_ONLY',transaction:(scope:any,body:any)=>f.store.transaction(scope,async(base:any)=>{
  const draft=structuredClone(persisted);
  const joint:any={challenges:{...base.challenges,recordResult:async(v:any)=>{const snapshot={kind:'SYNTHETIC_PROOF_RESULT',challengeRef:v.challengeRef,requestId:v.requestId,proofHash:v.proofHash,recordedAt:await base.challenges.clock(),credentialIssued:false,executionAuthorized:false,dispatchPerformed:false},ref={id:randomUUID(),version:1,contentHash:hash(snapshot)};draft.proofs.push({ref,snapshot});return ref;}},permits:{current:async()=>{const{permit:_,localAttemptRef:__,...raw}=f.basis;return structuredClone(raw);},read:async()=>({complete:true,permits:[structuredClone(f.basis.permit)]}),append:async()=>{throw Error('NO_NEW_START_PERMIT');}}};
  const db:any={query:async(sql:string,params:any[])=>{
   calls.push({sql,params});
   if(sql.startsWith('SELECT anvil.record_provider_session_claim(')){
    const [sc,raw,pr,bodyHash,au]=params.map((v:any,i:number)=>i===3?v:JSON.parse(v)),journal=await base.challenges.read();
    assert.equal(journal.events.some((e:any)=>e.ref.version===2&&canonicalJson(e.snapshot.consumption?.resultRef)===canonicalJson(pr)),true,'nonce must already be consumed before protected flush');
    assert.equal(sc.projectId,f.scope.projectId);assert.equal(raw.claim.claimId,f.claim.claimId);assert.equal(bodyHash,hash({claim:f.claim}));
    let entry=draft.entries.find((e:any)=>e.claim.claimId===raw.claim.claimId);if(!entry){entry=raw;draft.entries.push(entry);assert.ok(au);draft.audits.push(au);}else assert.equal(au,null);
    draft.mappings.push({ref:pr,bodyHash,receipt:entry.receipt});if(fault==='flush')throw Error('PRIVATE_DATABASE_FAILURE');
    if(fault==='expired')f.advance(31000);if(fault==='changed')f.basis.fact.writerState='UNKNOWN';
    return{rows:[{result:{claimRef:entry.receipt.claimRef,proofResultRef:pr,recorded:true,executionAuthorized:fault==='corrupt',dispatchPerformed:false}}]};
   }
   if(sql.includes('FROM anvil.provider_session_claim_proof_results')){
    const map=draft.mappings.find((v:any)=>v.ref.id===params[3]);if(!map)return{rows:[]};const entry=draft.entries.find((e:any)=>e.claim.claimId===map.receipt.claimRef.id),proof=draft.proofs.find((p:any)=>p.ref.id===map.ref.id);
    return{rows:[{project_id:scope.projectId,execution_id:scope.executionId,generation:scope.executionGeneration,proof_result_id:map.ref.id,proof_result_version:1,body_hash:map.bodyHash,receipt_json:map.receipt,entry_snapshot:entry,proof_content_hash:proof.ref.contentHash,proof_snapshot:proof.snapshot}]};
   }
   if(sql.includes('FROM anvil.provider_session_claims')){const entry=draft.entries.find((e:any)=>sql.includes('event_key=$4')?e.eventKey===params[3]:e.claim.claimId===params[3]);return{rows:entry?[{snapshot_json:entry,content_hash:hash(entry.claim),claim_id:entry.claim.claimId,project_id:scope.projectId,execution_id:scope.executionId,generation:scope.executionGeneration}]:[]};}
   throw Error('UNEXPECTED_SQL');
  }};
  const binding=make().bind(db,scope,joint),result=await body(binding.tx);assert.equal(calls.filter(c=>c.sql.startsWith('SELECT anvil.record_provider_session_claim(')).length,draft.mappings.length,'protected write must not run inside service body');
  await binding.flush();if(fault==='commit')throw Error('PRIVATE_COMMIT');persisted=draft;return result;
 })};
 return{f,store,calls,make,state:()=>persisted,fault:(v:string)=>fault=v,connects:()=>connects};
}
test('nonce 완료 뒤 한 번의 보호 flush로 원 claim/결과/감사를 연결하고 nested 연결·raw DML0이다',async()=>{
 const x=fixture(),p=await x.f.issue(),r=await new SyntheticProviderSessionClaims(x.store).ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw);
 assert.equal(r.receipt.claimRef.id,x.f.claim.claimId);assert.equal(x.state().entries.length,1);assert.equal(x.state().mappings.length,1);assert.equal(x.state().audits.length,1);assert.equal(x.connects(),0);assert.equal(x.calls.some(c=>/^(BEGIN|COMMIT|INSERT|UPDATE|DELETE)/.test(c.sql)),false);
});
test('같은 proof와 새 유효 proof는 원 receipt를 보존하며 새 claim/감사를 만들지 않는다',async()=>{
 const x=fixture(),service=new SyntheticProviderSessionClaims(x.store),p=await x.f.issue(),first=await service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw);
 assert.deepEqual((await service.ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw)).receipt,first.receipt);
 const second=await x.f.issue();assert.deepEqual((await service.ingest(x.f.scope,second.issued.ref,second.proof,second.signature,second.raw)).receipt,first.receipt);assert.equal(x.state().entries.length,1);assert.equal(x.state().mappings.length,2);assert.equal(x.state().audits.length,1);
});
test('보호함수/COMMIT 실패·변조·최종 현재성 변경/만료는 claim/결과/감사와 nonce 소비를 되돌린다',async()=>{
 assert.equal(typeof m.SyntheticPgProviderClaimStore,'function');
 for(const fault of ['flush','commit','corrupt','changed','expired']){const x=fixture(),p=await x.f.issue(),before=canonicalJson(x.f.state());x.fault(fault);await assert.rejects(new SyntheticProviderSessionClaims(x.store).ingest(x.f.scope,p.issued.ref,p.proof,p.signature,p.raw),(e:any)=>e.message==='PROVIDER_SESSION_CLAIM_REJECTED');assert.equal(canonicalJson(x.f.state()),before);assert.equal(x.state().entries.length,0);assert.equal(x.state().mappings.length,0);assert.equal(x.state().audits.length,0);}
});
test('실제/누락 facts·keys fallback과 잘못된 scope는 DB 연결 전에 거절한다',async()=>{
 assert.equal(typeof m.SyntheticPgProviderClaimStore,'function');const x=fixture(),pool={connect:async()=>{throw Error('NO_CONNECT');}},keys={transport:'SYNTHETIC_ONLY',key:async()=>null};for(const facts of [undefined,{transport:'REAL',current:async()=>null}])assert.throws(()=>new m.SyntheticPgProviderClaimStore(pool,keys,facts));
 for(const scope of [null,{...x.f.scope,mode:'RECOVERY'}])await assert.rejects(x.make().transaction(scope,async()=>null));assert.equal(x.connects(),0);
});
