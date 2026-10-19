import assert from 'node:assert/strict';
import test from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {resultFixture,hash} from './result-view-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/result-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function methods(){assert.equal(typeof mod.readAssignmentResults,'function','임무 결과 목록 클라이언트 미연결');assert.equal(typeof mod.readAssignmentResult,'function');return mod;}
test('제출결과를상대GET로조회하고정확임무/원문hash·미실행상태를보존한다',async()=>{
 const f=resultFixture(),calls:string[]=[],client=new ApiClient(async(url,options)=>{assert.equal(options?.method,'GET');assert.equal(options?.credentials,'same-origin');calls.push(String(url));return Response.json(calls.length===1?f.page:f.entry);}),m=methods();
 const list=await m.readAssignmentResults(client,f.pid,f.a,()=>true);assert.equal(list.items[0].completionAccepted,false);const result=await m.readAssignmentResult(client,f.pid,f.a,list.items[0],()=>true);assert.equal(result.snapshot.manifest.testResults[0].status,'NOT_EXECUTED');assert.deepEqual(calls,[`/api/v1/projects/${f.pid}/assignments/${f.a.id}/versions/1/results`,`/api/v1/projects/${f.pid}/results/${f.item.ref.id}`]);
});
test('다른임무·위조완료·중복목록·원문hash손상을화면자료로반환하지않는다',async()=>{
 const m=methods();for(const alter of [(f:any)=>f.page.assignmentRef.contentHash='f'.repeat(64),(f:any)=>f.page.items[0].completionAccepted=true,(f:any)=>f.page.items.push(structuredClone(f.page.items[0]))]){const f=resultFixture(),expected=structuredClone(f.a);alter(f);await assert.rejects(m.readAssignmentResults(new ApiClient(async()=>Response.json(f.page)),f.pid,expected,()=>true));}
 for(const [index,alter] of [(f:any)=>f.entry.snapshot.manifest.rollback='변조',(f:any)=>{f.entry.snapshot.completionAccepted=true;f.entry.ref.contentHash=hash(f.entry.snapshot);},(f:any)=>{delete f.entry.snapshot.manifest.changes;f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);}].entries()){const f:any=resultFixture(),item=structuredClone(f.item);alter(f);if(index>0){item.ref=structuredClone(f.entry.ref);item.manifestRef.contentHash=f.entry.snapshot.manifestHash;}await assert.rejects(m.readAssignmentResult(new ApiClient(async()=>Response.json(f.entry)),f.pid,f.a,item,()=>true));}
});
test('선택전환·인증실패뒤다른원문이나예전목록으로대체하지않는다',async()=>{
 const f=resultFixture(),m=methods();let active=true,calls=0;const client=new ApiClient(async()=>{calls++;active=false;return Response.json(f.page);});assert.equal(await m.readAssignmentResults(client,f.pid,f.a,()=>active),null);assert.equal(calls,1);
 await assert.rejects(m.readAssignmentResult(new ApiClient(async()=>Response.json({code:'AUTH_REQUIRED'},{status:401})),f.pid,f.a,f.item,()=>true),(e:any)=>e.status===401);assert.equal(await m.readAssignmentResult(client,f.pid,f.a,f.item,()=>false),null);assert.equal(calls,1);
});
