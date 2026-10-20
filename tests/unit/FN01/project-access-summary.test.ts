import test from 'node:test';import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
const mod:any=await import(new URL('../../../apps/web/src/features/projects/project-access-summary.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',at='2026-10-20T00:00:00Z';
function fixture(){return{id,name:'개발 제어',purpose:'사용자 소유 지식',desiredOutcome:'계속할 수 있는 작업',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[{code:'METHODOLOGY_CONNECTION_PENDING'}],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:id,clientId:other,generation:3,status:'OTHER_CLIENT'}};}
const read=()=>{assert.equal(typeof mod.readProjectAccessSummary,'function','목록의 프로젝트 상태 조회 연결 누락');return mod.readProjectAccessSummary;};
test('세 제어 상태·참여권한은 기존 보호 GET 한 번으로 읽고 실행 허가를 만들지 않는다',async()=>{
 for(const status of ['HELD','OTHER_CLIENT','UNASSIGNED']){const f=fixture();f.controlState.status=status;if(status==='UNASSIGNED')f.controlState={actorId:null,clientId:null,generation:null,status} as any;
  const calls:string[]=[],client=new ApiClient(async(url,init)=>{calls.push(String(url));assert.equal(init?.method,'GET');return Response.json(f);});
  const v=await read()(client,id,()=>true);assert.deepEqual(v.controlState,f.controlState);assert.equal(v.participation,'VIEWER');assert.deepEqual(v.readinessIssues,f.readinessIssues);assert.equal(v.executionAuthorized,false);assert.equal(v.controlAcquired,false);assert.equal(v.source,'PROJECT_DETAIL_RESPONSE');assert.equal(Number.isFinite(Date.parse(v.receivedAt)),true);assert.deepEqual(calls,[`/api/v1/projects/${id}`]);assert.equal('sourceDeclaration'in v,false);
 }
});
test('권한거절·다른 프로젝트·불완전 제어 상태를 빈 성공으로 만들지 않는다',async()=>{
 const fn=read();for(const status of [401,403,404])await assert.rejects(fn(new ApiClient(async()=>Response.json({code:'PROJECT_ACCESS_DENIED'},{status})),id,()=>true),(e:any)=>e.status===status);
 for(const patch of [{id:other},{controlState:{actorId:null,clientId:null,generation:null,status:'HELD'}},{participation:'ADMIN'},{readinessIssues:[{code:'<script>not executed</script>'}]}])await assert.rejects(fn(new ApiClient(async()=>Response.json({...fixture(),...patch})),id,()=>true));
});
test('요청 전과 응답 대기중 이탈은 조회/채택을 막고 원문 자료를 유지하지 않는다',async()=>{
 let calls=0,active=false;const client=new ApiClient(async()=>{calls++;active=false;return Response.json(fixture());});
 await assert.rejects(read()(client,id,()=>active));assert.equal(calls,0);active=true;await assert.rejects(read()(client,id,()=>active));assert.equal(calls,1);
});
