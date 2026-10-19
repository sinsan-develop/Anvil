import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticPgChallengeStore} from '../../../apps/server/modules/executions/execution-challenge-store.ts';
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)},at='2026-10-19T08:00:00.000Z';
const scope=()=>({sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/main.ts',kind:'FILE',access:'READ',recursive:false}]});
function fact():any{return {
 schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:pid,executionId:eid,executionGeneration:1,
 subject:{userId:pid,clientId:eid,humanSessionId:eid,controlGeneration:2,credentialGeneration:3},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:4},
 registration:{ref,connectorId:pid,generation:5,hostPublicKeyFingerprint:'b'.repeat(64)},
 intent:{projectId:pid,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes:[scope()],mode:'CONTEXT_REVIEW',reason:'변경 없는 맥락 확인'},
 preparationRef:ref,permissionPolicyRef:ref,budgetReservationRef:ref,basisRefs:[ref],latestInstructionRefs:[{kind:'CONVERSATION',id:pid,contentHash:'c'.repeat(64)}],understandingReviewRef:null,
 checks:Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(name=>[name,{state:name==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:name==='understanding'?[]:[ref]}])),
 writerState:'NONE',expires:{humanSession:'2026-10-19T11:00:00.000Z',permissionPolicy:'2026-10-19T09:45:00.000Z',registration:'2026-10-19T09:30:00.000Z',budget:'2026-10-19T10:00:00.000Z',automaticScope:'2026-10-19T10:00:00.000Z'},checkedAt:at,
 executionAuthorized:false,dispatchPerformed:false
};}

const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(revoked:unknown){
 const f=fact(),now=new Date(at),queries:string[]=[],keys:{count:number}={count:0};
 const snapshot={kind:'EXECUTION',state:'SYNTHETIC_PLAN',transport:'SYNTHETIC_ONLY',binding:f,factHash:hash(f),expiresAt:f.expires.registration,executionAuthorized:false,dispatchPerformed:false};
 const grantRef={id:pid,version:1,contentHash:hash(snapshot)};
 const db:any={release:()=>{},query:async(sql:string)=>{queries.push(sql);
  if(sql==='BEGIN'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return{rows:[]};
  if(sql.startsWith('SELECT g.*,e.transport'))return{rows:[{execution_id:eid,generation:1,content_hash:grantRef.contentHash,snapshot_json:snapshot,execution_transport:'SYNTHETIC_ONLY',execution_state:'SYNTHETIC_QUEUED'}]};
  if(sql.startsWith('SELECT s.*,u.status'))return{rows:[{id:eid,user_status:'ACTIVE',credential_generation:3,current_generation:3,revoked_at:null,user_revoked_at:null,client_revoked_at:null,idle_expires_at:new Date(now.getTime()+3600000),absolute_expires_at:new Date(now.getTime()+3600000)}]};
  if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:now}]};
  if(sql.startsWith('SELECT id FROM anvil.projects'))return{rows:[{id:pid}]};
  if(sql.startsWith('SELECT EXISTS(SELECT 1 FROM anvil.execution_grant_revocations'))return{rows:revoked==='MISSING'?[]:[{revoked}]};
  throw Error('NEXT_EXISTING_AUTHORITY');
 }};
 const store=new SyntheticPgChallengeStore({connect:async()=>db} as any,{transport:'SYNTHETIC_ONLY',key:async()=>{keys.count++;throw Error('KEY_MUST_NOT_BE_READ');}});
 return{queries,keys,run:()=>store.transaction({mode:'EXECUTION',projectId:pid,connectorId:pid,executionId:eid,executionGeneration:1,grantRef,credentialGeneration:1},async tx=>tx.current())};
}
test('회수된 원grant는 project 잠금 뒤 새 challenge/current를 거절하며 host key/credential INSERT까지 가지 않는다',async()=>{
 const f=fixture(true);await assert.rejects(f.run(),(e:any)=>e.message==='EXECUTION_GRANT_REVOKED'&&e.statusCode===412);assert.equal(f.keys.count,0);assert(!f.queries.some(q=>q.startsWith('INSERT')));
 const lock=f.queries.findIndex(q=>q.startsWith('SELECT id FROM anvil.projects')),check=f.queries.findIndex(q=>q.includes('execution_grant_revocations'));assert(lock>=0&&check>lock);assert(!f.queries[check]!.includes('created_command_id IS DISTINCT FROM'));
});
test('회수 여부 없음/불명확은 정상 취급하지 않고 false만 기존 정책/예산 검사를 계속한다',async()=>{
 for(const state of ['MISSING',null,'false',0]){const f=fixture(state);await assert.rejects(f.run(),(e:any)=>e.message==='EXECUTION_GRANT_REVOCATION_UNVERIFIED'&&e.statusCode===503);assert.equal(f.keys.count,0);}
 const f=fixture(false);await assert.rejects(f.run(),/NEXT_EXISTING_AUTHORITY/);assert.equal(f.keys.count,0);
});
