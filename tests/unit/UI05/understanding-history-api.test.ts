import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {understandingHistoryFixture} from './understanding-history-fixture.ts';
import {readUnderstandingHistory} from '../../../apps/server/modules/executions/execution-understanding.ts';
const m:any=await import('../../../apps/web/src/features/session-detail/understanding-history-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('원제출 실행 결박을 먼저 확인하고 같은 세대의 보관 6항목만 읽는다',async()=>{
 const f=understandingHistoryFixture(),calls:string[]=[];readUnderstandingHistory(f.history.items,f.scope);assert.equal(typeof m.readStoredUnderstandingHistory,'function');
 const client=new ApiClient(async path=>{calls.push(String(path));return Response.json(calls.length===1?f.source:f.history);});const out=await m.readStoredUnderstandingHistory(client,f.result,()=>true);assert.deepEqual(out,f.history);
 assert.deepEqual(calls,[`/api/v1/projects/${f.scope.projectId}/results/${f.result.ref.id}/execution-source`,`/api/v1/projects/${f.scope.projectId}/executions/${f.scope.executionId}/understanding-reviews?generation=1`]);
});
test('다른 세대·권위 승격·내용/hash·chain/6항목 불일치는 반환하지 않는다',async()=>{
 assert.equal(typeof m.readStoredUnderstandingHistory,'function');for(const mutate of [(h:any)=>h.scope.executionGeneration++,(h:any)=>h.executionAuthorized=true,(h:any)=>h.items[0].snapshot.input.items[0].reason='변조',(h:any)=>{h.items[0].snapshot.sequence=2;},(h:any)=>h.items[0].snapshot.input.items.pop(),(h:any)=>h.items[0].snapshot.outcome='NOT_ACCEPTED']){const f=understandingHistoryFixture(),h=structuredClone(f.history);mutate(h);let n=0;await assert.rejects(m.readStoredUnderstandingHistory(new ApiClient(async()=>Response.json(++n===1?f.source:h)),f.result,()=>true));}
});
test('조회 거절·비활성 후 늦은 JSON은 이전 이력 성공으로 반환하지 않는다',async()=>{
 assert.equal(typeof m.readStoredUnderstandingHistory,'function');const f=understandingHistoryFixture();let n=0;await assert.rejects(m.readStoredUnderstandingHistory(new ApiClient(async()=>++n===1?Response.json(f.source):Response.json({code:'ACCESS_DENIED'},{status:403})),f.result,()=>true),(e:any)=>e.status===403);
 let active=true;n=0;const result=await m.readStoredUnderstandingHistory(new ApiClient(async()=>{if(++n===1)return Response.json(f.source);active=false;return Response.json(f.history);}),f.result,()=>active);assert.equal(result,null);
});
test('hash를 다시 결박해도 순번·필수 6항목·판단과 내용의 모순은 거절한다',async()=>{
 for(const mode of ['sequence','items','outcome']){const f=understandingHistoryFixture(),h=structuredClone(f.history),row=h.items[0]!;
  if(mode==='sequence'){row.snapshot.sequence=2;row.ref.version=2;}else if(mode==='items')row.snapshot.input.items.pop();else row.snapshot.outcome='NOT_ACCEPTED';
  row.snapshot.request.payload=structuredClone(row.snapshot.input);row.snapshot.requestHash=f.hash(row.snapshot.request);row.ref.contentHash=f.hash(row.snapshot);
  let n=0;await assert.rejects(m.readStoredUnderstandingHistory(new ApiClient(async()=>Response.json(++n===1?f.source:h)),f.result,()=>true));
 }
});
