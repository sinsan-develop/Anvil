import test from 'node:test';import assert from 'node:assert/strict';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {assignmentRevisionFixture} from './assignment-revision-fixture.ts';
const m:any=await import('../../../apps/web/src/features/workspace/assignment-revision-comparison.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function read(...args:any[]){assert.equal(typeof m.readAssignmentRevisionComparison,'function');return m.readAssignmentRevisionComparison(...args);}
test('고정 직전 버전만 GET/hash 대조해 바뀐 목표/이유를 양쪽 값으로 비교하고 현재 입력을 바꾸지 않는다',async()=>{
 const f=assignmentRevisionFixture(),before=structuredClone(f.current),calls:string[]=[];
 const client=new ApiClient(async(path,init)=>{assert.equal(init?.method??'GET','GET');calls.push(String(path));return Response.json(f.previous);}),r=await read(client,f.current);
 assert.deepEqual(r.changes.map((v:any)=>v.field),['definition.goal','reason']);assert.equal(r.changes[0].before,'이전 목표');assert.equal(r.changes[0].after,f.current.snapshot.definition.goal);assert.deepEqual(f.current,before);assert.deepEqual(calls,['/api/v1/projects/'+f.current.projectId+'/assignment-drafts/'+f.previous.ref.id+'/versions/1']);
});
test('다른project/id/직전version·본문변조·거절과 닫힌요청은 비교결과로 채택하지 않는다',async()=>{
 assert.equal(typeof m.readAssignmentRevisionComparison,'function');
 for(const mode of ['project','id','version','body','denied','closed','late']){
  const f=assignmentRevisionFixture();let active=mode!=='closed',calls=0;if(mode==='project')f.previous.projectId=f.previous.ref.id;if(mode==='id')f.current.snapshot.previousRef.id=f.current.projectId;if(mode==='version')f.current.snapshot.previousRef.version=2;if(mode==='body')f.previous.snapshot.definition.goal='변조 원문';
  const client=new ApiClient(async()=>{calls++;if(mode==='late')active=false;return mode==='denied'?Response.json({code:'REVISION_DENIED'},{status:403}):Response.json(f.previous);});
  if(mode==='closed'||mode==='late'){assert.equal(await read(client,f.current,()=>active),null);assert.equal(calls,mode==='closed'?0:1);}else await assert.rejects(read(client,f.current),e=>e instanceof ApiError,mode);
 }
});
