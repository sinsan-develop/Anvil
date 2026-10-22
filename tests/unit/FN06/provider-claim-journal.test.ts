import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import {providerClaimFixture} from './provider-claim-fixture.ts';
const m:any=await import('../../../apps/server/modules/executions/provider-session-claim-journal.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
async function fixture(){
 const f=providerClaimFixture(),p=await f.issue();await new SyntheticProviderSessionClaims(f.store).ingest(f.scope,p.issued.ref,p.proof,p.signature,p.raw);const entry=f.state().entries[0],c=f.claim;
 const q={projectId:c.projectId,agentSessionId:c.agentSessionRef.id,executionId:c.execution.id,generation:c.execution.generation,commandId:c.commandId,kind:'THREAD',requestIdDigest:c.source.requestIdDigest,claimHash:contentHash(canonicalJson(c))};
 const row:any={project_id:c.projectId,claim_id:c.claimId,version:'1',execution_id:c.execution.id,generation:'1',command_id:c.commandId,agent_session_id:c.agentSessionRef.id,agent_session_version:'1',grant_id:f.scope.grantRef.id,grant_version:'1',permit_id:c.permitRef.id,permit_version:'1',kind:'THREAD',request_id_digest:c.source.requestIdDigest,event_key:entry.eventKey,content_hash:q.claimHash,snapshot_json:structuredClone(entry),recorded_at:new Date(entry.receipt.recordedAt)};
 let rows=[row];const calls:any[]=[];const db:any={query:async(sql:string,params:any[])=>{calls.push({sql,params});return{rows};}};
 const make=()=>{assert.equal(typeof m.SyntheticPgProviderClaimJournal,'function');return new m.SyntheticPgProviderClaimJournal();};
 return{f,q,row,entry,db,calls,make,rows:(v:any[])=>rows=v};
}
test('정확 사건의 parameterized SELECT로 원 entry를 읽고 DML/BEGIN/COMMIT0이다',async()=>{
 const f=await fixture(),r=await f.make().read(f.db,f.q);assert.deepEqual(r,f.entry);assert.equal(f.calls.length,1);assert.match(f.calls[0].sql,/^SELECT /);assert.match(f.calls[0].sql,/LIMIT 2$/);assert.deepEqual(f.calls[0].params,[f.q.projectId,f.q.agentSessionId,f.entry.eventKey]);
});
test('다른 claimHash는 원 entry를 숨기거나 바꾸지 않고 상위 권한·충돌 판정에 넘긴다',async()=>{
 const f=await fixture();assert.deepEqual(await f.make().read(f.db,{...f.q,claimHash:'f'.repeat(64)}),f.entry);f.rows([]);assert.equal(await f.make().read(f.db,f.q),null);
});
test('중복·열/snapshot 불일치·raw 추가·해시/시각변조·DB오류는 원문 없는 오류로 닫힌다',async()=>{
 for(const mutate of [(f:any)=>f.rows([f.row,f.row]),(f:any)=>f.row.project_id=f.f.claim.claimId,(f:any)=>f.row.generation='2',(f:any)=>f.row.agent_session_version='2',(f:any)=>f.row.content_hash='f'.repeat(64),(f:any)=>f.row.snapshot_json.rawHandle='PRIVATE_RAW',(f:any)=>f.row.recorded_at=new Date('2026-10-23T00:00:00Z'),(f:any)=>f.db.query=async()=>{throw Error('PRIVATE_SQL_DSN');}]){
  const f=await fixture();mutate(f);await assert.rejects(f.make().read(f.db,f.q),(e:any)=>e.message==='PROVIDER_CLAIM_JOURNAL_UNAVAILABLE'&&e.statusCode===503);
 }
 const f=await fixture();await assert.rejects(f.make().read(f.db,{...f.q,extra:'PRIVATE_RAW'}));assert.equal(f.calls.length,0);
});
