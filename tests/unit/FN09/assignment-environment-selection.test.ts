import test from 'node:test';import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {newAssignmentDraft,prepareAssignmentWrite} from '../../../apps/web/src/features/workspace/assignment-api.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
const m:any=await import('../../../apps/web/src/features/workspace/assignment-environment-selection.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',s={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},base={id,version:1,contentHash:'a'.repeat(64)};
const plan:any={ref:base,designRef:{...base,id:pid},tasks:[{taskCode:'FN01',purpose:'개발 주도권 소유',title:'기능 개발',inputs:['설계'],outputs:['구현'],acceptanceCriteria:['동작'],included:['개발'],excluded:['운영'],testCases:[{expected:'저장됨'}],ownerRole:'책임자'}]};
const make=()=>newAssignmentDraft(pid,s,2,plan,'FN01',{...base,id:uid},'N1');
const codes=['INSTRUCTION_SESSION','STATE_ORIGINAL','RESULT_EVIDENCE','TOOL_APPROVAL','STOP_RECLAIM','PATH_WRITE_CONTROL'];
function candidate(kind='ENVIRONMENT_CANDIDATE'){
 const input={kind,candidate:{label:'WSL 대상 후보'},candidateRef:null,policyRef:base,expiresAt:'2026-10-21T00:00:00.000Z',reason:'실행 전 후보 보관'};
 const snapshot={kind,input,readiness:{state:'NOT_READY',executionAuthorized:false,missingRequirements:[{field:'executionHostRef',reason:'NOT_PROVIDED'},{field:'hostTrust',reason:'UNVERIFIED'}]},capabilities:codes.map(code=>({code,documentation:null,measurement:{state:'UNVERIFIED',toolVersion:null,environmentRef:null,executionRef:null,evidenceRefs:[]},controlLevel:'UNVERIFIED',limitations:['NO_AGENT_MEASUREMENT']}))};
 return{ref:{id,version:1,contentHash:contentHash(canonicalJson(snapshot))},candidate:snapshot,expired:false,createdAt:'2026-10-20T00:00:00.000Z',recordedBy:uid,executionAuthorized:false,observedAt:'2026-10-20T00:01:00.000Z'};
}
const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const select=(...args:any[])=>{assert.equal(typeof m.selectAssignmentEnvironment,'function');return m.selectAssignmentEnvironment(...args);};
test('고정 후보 원문을 보호 GET으로 읽고 environmentRef만 초안에 복사하며 미검증을 유지한다',async()=>{
 const b=make(),c=candidate(),before=structuredClone(b),calls:any[]=[];let current=b;
 const client=new ApiClient(async(u,i)=>{calls.push([String(u),i?.method,i?.credentials]);return json(c);});
 const value=await select(client,b,s,c.ref,()=>true,(change:any)=>{current=change(current);});
 assert.deepEqual(calls,[['/api/v1/projects/'+pid+'/connection-candidates/'+id+'/versions/1','GET','same-origin']]);assert.deepEqual(current.input.definition.environmentRef,c.ref);assert.equal(value.candidate.readiness.state,'NOT_READY');assert.equal(value.executionAuthorized,false);assert.deepEqual(b,before);
 current.input.reason='환경 후보 선택 저장';const parsed=readAssignmentDraftInput(prepareAssignmentWrite(current,s).payload);assert.ok(parsed.readinessIssues.some(i=>i.code==='ENVIRONMENT_UNVERIFIED'));assert.equal(parsed.executionAuthorized,false);assert.equal(parsed.dispatchPerformed,false);
 c.ref.contentHash='0'.repeat(64);assert.notEqual(current.input.definition.environmentRef?.contentHash,c.ref.contentHash);
});
test('다른 후보 종류·만료·변조 hash·403과 다른 client·동결 입력은 반영하지 않는다',async()=>{
 for(const mode of ['KIND','EXPIRED','HASH','FORBIDDEN','CLIENT','PENDING']){
  const b=make(),c=candidate(mode==='KIND'?'CONNECTION_CANDIDATE':'ENVIRONMENT_CANDIDATE'),chosen={...c.ref};if(mode==='EXPIRED')c.expired=true;if(mode==='HASH')chosen.contentHash='0'.repeat(64);if(mode==='CLIENT')b.ownerClientId=id;if(mode==='PENDING')b.pending={} as any;
  let updates=0,reads=0;await assert.rejects(select(new ApiClient(async()=>{reads++;return mode==='FORBIDDEN'?json({code:'PROJECT_READ_DENIED'},403):json(c);}),b,s,chosen,()=>true,()=>{updates++;}));
  assert.equal(updates,0);if(['CLIENT','PENDING'].includes(mode))assert.equal(reads,0);
 }
});
test('이탈과 지연 updater의 새 입력/프로젝트/세대/명령을 덮지 않는다',async()=>{
 const b=make(),c=candidate();let reads=0;
 await select(new ApiClient(async()=>{reads++;return json(c);}),b,s,c.ref,()=>false,()=>assert.fail('UNEXPECTED_UPDATE'));assert.equal(reads,0);
 for(const mutate of [(b:any)=>b.input.definition.goal='새 목표',(b:any)=>b.projectId=uid,(b:any)=>b.controlGeneration=3,(b:any)=>b.bindingId=id,(b:any)=>b.uncertain=true,(b:any)=>b.pending={}]){
  let current=structuredClone(b);mutate(current);const before=structuredClone(current);await select(new ApiClient(async()=>json(c)),b,s,c.ref,()=>true,(change:any)=>{current=change(current);});assert.deepEqual(current,before);
 }
 let active=true;await select(new ApiClient(async()=>{active=false;return json(c);}),b,s,c.ref,()=>active,()=>assert.fail('LATE_UPDATE'));
});
