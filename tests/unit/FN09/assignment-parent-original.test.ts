import assert from 'node:assert/strict';
import test from 'node:test';
import { contentHash, canonicalJson } from '../../../contracts/canonical.ts';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
const subject:any=await import('../../../apps/web/src/features/workspace/assignment-confirmation-api.ts');
const pid='11111111-1111-4111-8111-111111111111',parentId='22222222-2222-4222-8222-222222222222',at='2026-10-21T01:00:00Z';
const ref={id:pid,version:1,contentHash:'a'.repeat(64)};
function fixture(){
 const definition={taskRef:{planRef:ref,taskCode:'FN01',applicationRef:ref,nodeId:'N1'},purpose:'원 목적',goal:'부모 목표',baselineRefs:[ref],inputs:['입력'],outputs:['산출물'],acceptanceCriteria:['완료조건'],verificationRequirements:['검사'],included:['개발'],excluded:['운영'],allowedScopes:[],environmentRef:null,requiredCapabilities:['코드'],budgetRef:null,ownerRole:'책임자',parentAssignmentRef:null,recordingPolicyRef:null,integrationResponsibility:'검수'};
 const snapshot={definition,previousRef:null,reason:'보관 초안',basis:{planRef:ref,applicationRef:ref,designRef:ref,taskCode:'FN01',nodeId:'N1',taskCardHash:'b'.repeat(64)},readinessIssues:[{code:'EXECUTION_NOT_CONNECTED',location:'taskRef'}],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
 const draft={projectId:pid,ref:{id:parentId,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot,headVersion:2,sourceCurrentness:'NOT_RECHECKED',observedAt:at};
 const confirmedSnapshot={draftRef:structuredClone(draft.ref),definition:structuredClone(definition),reviewRefs:[ref],reason:'내용만 확정',confirmedBy:{kind:'HUMAN',userId:pid},confirmedAt:at,contentConfirmed:true,readinessIssues:structuredClone(snapshot.readinessIssues),ready:false,executionAuthorized:false,dispatchPerformed:false};
 const parent={projectId:pid,ref:{id:parentId,version:1,contentHash:contentHash(canonicalJson(confirmedSnapshot))},snapshot:confirmedSnapshot,observedAt:at};
 const child:any={projectId:pid,ref, snapshot:{definition:{parentAssignmentRef:parent.ref}}};
 return {draft,parent,child};
}
function read(...args:any[]){assert.equal(typeof subject.readParentAssignmentOriginal,'function');return subject.readParentAssignmentOriginal(...args);}
test('과거 고정 부모는 confirmed와 원draft의 서로 다른 hash를 대조하며 최신으로 대체하지 않는다',async()=>{
 const q=fixture(),calls:string[]=[];
 const client=new ApiClient(async(path,init)=>{assert.equal(init?.method??'GET','GET');calls.push(String(path));return Response.json(String(path).includes('/assignment-drafts/')?q.draft:q.parent);});
 const result=await read(client,pid,q.child);
 assert.deepEqual(result.parent.ref,q.parent.ref);assert.deepEqual(result.draft.ref,q.draft.ref);assert.notEqual(result.parent.ref.contentHash,result.draft.ref.contentHash);
 assert.equal(result.draft.headVersion,2);assert.equal(result.sourceCurrentness,'NOT_RECHECKED');
 assert.deepEqual(calls,['/api/v1/projects/'+pid+'/assignments/'+parentId+'/versions/1','/api/v1/projects/'+pid+'/assignment-drafts/'+parentId+'/versions/1']);
});
test('닫기·이탈 뒤 늦은 부모 응답은 추가 초안 조회와 결과 채택을 하지 않는다',async()=>{
 const q=fixture(),calls:string[]=[];let active=true;
 const client=new ApiClient(async(path)=>{calls.push(String(path));active=false;return Response.json(String(path).includes('/assignment-drafts/')?q.draft:q.parent);});
 const result=await read(client,pid,q.child,()=>active);
 assert.equal(result,null);assert.equal(calls.length,1);
});

test('교차project/부모 변조·가짜 draft귀속·본문·권한 true·거절은 고정 부모로 채택하지 않는다',async()=>{
 for(const mode of ['PROJECT','HASH','DRAFT_ID','DRAFT_HASH','BODY','READY','DENIED','ROOT']){
  const q=fixture(),calls:string[]=[];
  if(mode==='PROJECT')q.parent.projectId=parentId;
  if(mode==='HASH')q.parent.snapshot.reason='변조';
  if(mode==='DRAFT_ID'){q.parent.snapshot.draftRef={...q.parent.snapshot.draftRef,id:pid};q.parent.ref.contentHash=contentHash(canonicalJson(q.parent.snapshot));q.child.snapshot.definition.parentAssignmentRef=structuredClone(q.parent.ref);}
  if(mode==='DRAFT_HASH')q.draft.ref.contentHash='f'.repeat(64);
  if(mode==='BODY')q.draft.snapshot.definition.goal='다른 본문';
  if(mode==='READY'){q.parent.snapshot.ready=true;q.parent.ref.contentHash=contentHash(canonicalJson(q.parent.snapshot));q.child.snapshot.definition.parentAssignmentRef=structuredClone(q.parent.ref);}
  if(mode==='ROOT')q.child.snapshot.definition.parentAssignmentRef=null;
  const client=new ApiClient(async(path)=>{calls.push(String(path));return mode==='DENIED'?Response.json({code:'PERMISSION_DENIED'},{status:403}):Response.json(String(path).includes('/assignment-drafts/')?q.draft:q.parent);});
  await assert.rejects(read(client,pid,q.child), (e:unknown)=>e instanceof ApiError,mode);
  if(['PROJECT','HASH','DRAFT_ID','ROOT'].includes(mode))assert(calls.length<2,mode);
  assert(calls.every(path=>path.startsWith('/api/v1/projects/'+pid+'/')),mode);
 }
});
