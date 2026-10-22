import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {contentHash} from '../../../contracts/canonical.ts';
import {resultFixture,hash} from './result-view-fixture.ts';
async function module(){return import('../../../apps/web/src/features/session-detail/reported-command-evidence.ts');}
function fixture(){
 const f=resultFixture(),text='명령의 별도 근거\n',ref={id:'33333333-3333-4333-8333-333333333333',version:1,contentHash:contentHash(text)},outputRef={...ref,id:'44444444-4444-4444-8444-444444444444'},m:any=f.entry.snapshot.manifest;
 const evidence={sourceKind:'WORKER_CLAIM',ref,contentHash:ref.contentHash,environmentRef:f.a,recordedAt:f.entry.snapshot.submittedAt};
 m.commandResults=[{profileRef:f.a,argv:['check'],cwdRef:f.a,hostRef:f.entry.snapshot.scope.executionRef,executionRef:f.entry.snapshot.scope.executionRef,startedAt:null,finishedAt:null,exitCode:null,outputRef,evidence:[evidence]}];
 m.artifactRefs=[ref,outputRef];const rehash=()=>{f.entry.snapshot.manifestHash=hash(m);f.entry.ref.contentHash=hash(f.entry.snapshot);};rehash();
 const file=()=>({projectId:f.pid,resultRef:f.entry.ref,artifactRef:ref,bytes:Buffer.byteLength(text),mediaType:'text/plain;charset=utf-8',text,sourceState:'REGISTERED_BYTES_ONLY',evidenceProvenanceVerified:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false,observedAt:'2026-10-20T00:00:00.000Z'});
 return{...f,m,ref,outputRef,evidence,text,rehash,file,selection:{commandIndex:0,evidenceIndex:0}};
}
test('명령 output과 다른 개별 evidence만 기존 same-origin GET으로 대조한다',async()=>{
 const m=await module(),f=fixture(),calls:string[]=[];
 const result=await m.readReportedCommandEvidence(new ApiClient(async(path,options)=>{calls.push(String(path));assert.equal(options?.method,'GET');return Response.json(f.file());}),f.entry as any,f.selection,()=>true);
 assert(result);assert.equal(result.bytesState,'MATCHED_REGISTERED_BYTES');assert.equal(result.file!.text,f.text);assert.deepEqual(result.reported,f.evidence);assert.deepEqual(result.issues,[]);
 assert.deepEqual(calls,[`/api/v1/projects/${f.pid}/results/${f.entry.ref.id}/artifacts/${f.ref.id}/text`]);
 for(const key of ['evidenceProvenanceVerified','commandExecutionVerified','commandExitVerified','completionAccepted','executionAuthorized','dispatchPerformed'] as const)assert.equal(result[key],false);
});
test('다른 실행·선언hash/등록ref·중복파일·미지원 버전은 요청0과 이유를 보존한다',async()=>{
 const mod=await module();
 for(const [change,reason]of [
  [(f:any)=>f.m.commandResults[0].executionRef={...f.entry.snapshot.scope.executionRef,version:2},'COMMAND_EXECUTION_MISMATCH'],
  [(f:any)=>f.evidence.contentHash='f'.repeat(64),'DECLARED_EVIDENCE_HASH_MISMATCH'],
  [(f:any)=>f.m.artifactRefs=[],'FILE_NOT_DECLARED_IN_RESULT'],
  [(f:any)=>f.m.artifactRefs.push(f.ref),'AMBIGUOUS_FILE_ID'],
  [(f:any)=>f.m.artifactRefs[0]={...f.ref,contentHash:'f'.repeat(64)},'DECLARED_FILE_REF_MISMATCH'],
  [(f:any)=>{f.ref.version=2;},'FILE_VERSION_UNSUPPORTED'],
 ]as const){const f=fixture();change(f);f.rehash();let calls=0;const r=await mod.readReportedCommandEvidence(new ApiClient(async()=>{calls++;return Response.json(f.file());}),f.entry as any,f.selection,()=>true);assert(r);assert.equal(r.file,null);assert.equal(r.bytesState,'NOT_QUERIED_BINDING_MISMATCH');assert(r.issues.includes(reason));assert.equal(calls,0);}
});
test('변형 원제출·잘못된 선택은 요청0, 403과 선택교체 뒤 응답은 이전 성공으로 바꾸지 않는다',async()=>{
 const mod=await module();
 for(const alter of [(f:any)=>f.entry.ref.contentHash='f'.repeat(64),(f:any)=>f.m.rollback='변형',(f:any)=>f.selection.commandIndex=-1,(f:any)=>f.selection.evidenceIndex=1,(f:any)=>f.selection.extra=true]){
  const f=fixture();alter(f);let calls=0;await assert.rejects(mod.readReportedCommandEvidence(new ApiClient(async()=>{calls++;return Response.json(f.file());}),f.entry as any,f.selection,()=>true));assert.equal(calls,0);
 }
 const f=fixture();await assert.rejects(mod.readReportedCommandEvidence(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),f.entry as any,f.selection,()=>true),(e:any)=>e instanceof ApiError&&e.status===403);
 let active=true;assert.equal(await mod.readReportedCommandEvidence(new ApiClient(async()=>{active=false;return Response.json(f.file());}),f.entry as any,f.selection,()=>active),null);
});
test('응답 headers 도착 뒤 JSON 처리 중 선택을 닫으면 원문을 반환하지 않는다',async()=>{
 const mod=await module(),f=fixture();let active=true,calls=0,release!:()=>void,entered!:()=>void;
 const waiting=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>entered=resolve);
 const client=new ApiClient(async()=>{
  calls++;const response=Response.json(f.file()),json=response.json.bind(response);
  response.json=async()=>{entered();await waiting;return json();};return response;
 });
 const reading=mod.readReportedCommandEvidence(client,f.entry as any,f.selection,()=>active);
 await started;active=false;release();assert.equal(await reading,null);assert.equal(calls,1);
});
