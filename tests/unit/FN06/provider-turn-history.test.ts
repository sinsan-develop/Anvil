import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID,createHmac} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerProtectedHandleRef} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readProviderClaimReceiptHistory,readProviderClaimPageHistory} from '../../../apps/web/src/features/workspace/provider-claim-receipt-api.ts';
import {fixture,at} from './provider-history-db-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function setup(){
 const f=fixture();f.provideClaim();const parent=f.rows()[0],row=structuredClone(parent),old=row.snapshot_json.claim,{protectedHandleRef:_,...binding}=old;
 const input={...binding,claimId:randomUUID(),commandId:randomUUID(),kind:'TURN',parentThreadClaimRef:parent.snapshot_json.receipt.claimRef,source:{...old.source,method:'turn/start',requestIdDigest:'d'.repeat(64)}},claim={...input,protectedHandleRef:providerProtectedHandleRef(input,'f'.repeat(64))},claimRef={id:claim.claimId,version:1,contentHash:hash(claim)},receipt={...parent.snapshot_json.receipt,claimRef};
 Object.assign(row,{claim_id:claim.claimId,command_id:claim.commandId,kind:'TURN',request_id_digest:claim.source.requestIdDigest,event_key:hash([claim.projectId,claim.execution.id,1,claim.commandId,'TURN',claim.source.requestIdDigest]),content_hash:claimRef.contentHash});row.snapshot_json={...row.snapshot_json,claim,receipt,eventKey:row.event_key};f.replaceRows([parent,row]);
 const q={...f.q,commandId:claim.commandId,kind:'TURN' as const,requestIdDigest:claim.source.requestIdDigest,claimHash:claimRef.contentHash},queries:any[]=[],dbQuery=f.db.query;
 // Parent SELECT must be distinguished from the pre-existing event-key lookup in this fake only.
 f.db.query=async(sql:string,params:any[])=>{if(sql.includes('FROM anvil.provider_session_claims')&&sql.includes('AND claim_id=')){f.calls.push({sql,params});return{rows:f.rows().filter(r=>r.claim_id===params[2])};}return dbQuery(sql,params);};
 const repository:any={signProviderClaimCursor:(v:string)=>createHmac('sha256',Buffer.alloc(32,7)).update('provider-claim-history-page:v1:'+v).digest('hex'),authenticated:async(_token:string,_csrf:unknown,body:any)=>body(f.db,f.actor)};
 const app=buildApp({},undefined,{repository,origin:'https://localhost:3830'}),client=new ApiClient((async(url:string)=>{const r=await app.inject({method:'GET',url,headers:{host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)}});queries.push({url,status:r.statusCode});return new Response(r.body,{status:r.statusCode,headers:{'content-type':'application/json'}});}) as typeof fetch);
 return{f,q,parent,row,receipt,client,app,queries};
}
test('TURN 원 receipt와 혼합 목록은 현재 OWNER GET→원장·정확 부모→브라우저 reader로 조회된다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse(at)});const s=setup();try{const before=JSON.stringify(s.f.rows()),one=await readProviderClaimReceiptHistory(s.client,s.q,()=>true);assert.deepEqual(one?.receipt,s.receipt);const page=await readProviderClaimPageHistory(s.client,s.q.projectId,s.f.sessionRef,null,()=>true);assert.equal(page?.items.length,2);assert.deepEqual(page?.items.map(v=>v.query.kind).sort(),['THREAD','TURN']);assert(s.queries.every(v=>v.status===200));assert.equal(JSON.stringify(s.f.rows()),before);assert(!s.f.calls.some(v=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(v.sql)));}finally{await s.app.close();}
});
test('TURN 조회의 부모 부재/변조/타scope는 원 결과를 노출하지 않으며 쓰기0이다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse(at)});
 for(const fault of ['missing','hash','scope']){const s=setup();try{if(fault==='missing')s.f.replaceRows([s.row]);if(fault==='hash')s.parent.content_hash='e'.repeat(64);if(fault==='scope')s.parent.snapshot_json.scope.credentialGeneration++;await assert.rejects(readProviderClaimReceiptHistory(s.client,s.q,()=>true));assert(s.queries.every(v=>v.status!==200));assert(!s.f.calls.some(v=>/^(INSERT|UPDATE|DELETE)/.test(v.sql)));}finally{await s.app.close();}}
});
