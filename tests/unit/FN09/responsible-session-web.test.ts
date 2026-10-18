import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { canonicalJson,contentHash } from '../../../contracts/canonical.ts';
const module:any=await import('../../../apps/web/src/features/workspace/responsible-session-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const pid='11111111-1111-4111-8111-111111111111',ref={id:pid,version:1,contentHash:'a'.repeat(64)},session:any={user:{id:pid},clientId:pid,csrfToken:'a'.repeat(43)};
const confirmed:any={projectId:pid,ref,snapshot:{definition:{taskRef:{applicationRef:ref,nodeId:'개발'},allowedScopes:[]},contentConfirmed:true,executionAuthorized:false,dispatchPerformed:false}};
function state(){const snapshot={kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'총괄',definedBy:{kind:'HUMAN',userId:pid},definedAt:'2026-10-19T00:00:00.000Z'};return{projectId:pid,assignmentRef:ref,roles:[{projectId:pid,ref:{...ref,contentHash:contentHash(canonicalJson(snapshot))},snapshot}],bindings:[],preparations:[],hasMorePreparations:false,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};}
test('화면 조회는 same-origin exact 임무/원문hash·실행false만 수용한다',async()=>{
  assert.equal(typeof module.readResponsibleSessionState,'function');let received='';const good=state();
  const client=new ApiClient(async(url)=>{received=String(url);return Response.json(good);});
  const value=await module.readResponsibleSessionState(client,confirmed);assert.deepEqual(value,good);assert.equal(received,'/api/v1/projects/'+pid+'/assignments/'+pid+'/versions/1/execution-preparation-state');
  for(const patch of [{assignmentRef:{...ref,version:2}},{executionAuthorized:true},{roles:[{...good.roles[0],snapshot:{...good.roles[0]!.snapshot,reason:'손상'}}]}])await assert.rejects(module.readResponsibleSessionState(new ApiClient(async()=>Response.json({...good,...patch})),confirmed));
});
test('책임역할 명령은 현재주체·제어와 exact parent/단계를 결박하고 미확인 명령은 같은ID만 재확인한다',()=>{
  assert.equal(typeof module.newResponsibleSessionBuffer,'function');const b=module.newResponsibleSessionBuffer(confirmed,session,3);b.reason='명시 역할';
  const first=module.prepareResponsibleSessionAction(b,session,confirmed,state(),'COORDINATOR');
  assert.equal(first.operation,'defineProjectRole');assert.equal(first.controlGeneration,3);assert.deepEqual(first.payload,{kind:'COORDINATOR',stageRef:null,parentRoleRef:null,reason:'명시 역할'});
  b.pending=first;assert.deepEqual(module.prepareResponsibleSessionAction(b,session,confirmed,state(),'COORDINATOR'),first);
  b.reason='다른 입력';assert.throws(()=>module.prepareResponsibleSessionAction(b,session,confirmed,state(),'COORDINATOR'));
  assert.throws(()=>module.prepareResponsibleSessionAction(b,{...session,clientId:'22222222-2222-4222-8222-222222222222'},confirmed,state(),'COORDINATOR'));
});
test('세션 예약은 선택된 현재 역할과 연결 후보를 요구하며 다른 도구로 기존 세션을 덮지 않는다',()=>{
  assert.equal(typeof module.prepareResponsibleSessionAction,'function');
  const b=module.newResponsibleSessionBuffer(confirmed,session,1);b.reason='동일 세션';b.connectionRef=ref;
  const s:any=state(),roleRef={...ref,id:'22222222-2222-4222-8222-222222222222'};
  s.roles.push({projectId:pid,ref:roleRef,snapshot:{kind:'STAGE_OWNER',stageRef:{applicationRef:ref,nodeId:'개발'},parentRoleRef:s.roles[0].ref}});
  const binding={projectId:pid,ref:{...ref,version:2},snapshot:{assignmentRef:ref,roleRef,connectionRef:ref,state:'RESERVED',externalSessionHandleRef:null,executionAuthorized:false,dispatchPerformed:false}};
  s.bindings=[binding];
  const command=module.prepareResponsibleSessionAction(b,session,confirmed,s,'BIND');
  assert.equal(command.expectedVersion,2);assert.deepEqual(command.payload.existingSessionBindingRef,binding.ref);assert.deepEqual(command.payload.assignmentRef,ref);
  b.pending=command;s.bindings=[{...binding,ref:{...binding.ref,version:3}}];
  assert.deepEqual(module.prepareResponsibleSessionAction(b,session,confirmed,s,'BIND'),command);
  b.connectionRef={...ref,id:'33333333-3333-4333-8333-333333333333'};assert.throws(()=>module.prepareResponsibleSessionAction(b,session,confirmed,s,'BIND'));
});
test('저장 영수증은 payload/hash뿐 아니라 현재 작성 주체를 결박한다',async()=>{
  assert.equal(typeof module.sendResponsibleSessionAction,'function');const b=module.newResponsibleSessionBuffer(confirmed,session,1);b.reason='명시 총괄';
  const command=module.prepareResponsibleSessionAction(b,session,confirmed,state(),'COORDINATOR');
  const response=(other=false)=>{const snapshot={...command.payload,definedBy:{kind:'HUMAN',userId:other?'22222222-2222-4222-8222-222222222222':pid},definedAt:'2026-10-19T00:00:00.000Z'},reference={...ref,contentHash:contentHash(canonicalJson(snapshot))};return{commandId:command.commandId,projectId:pid,status:'APPLIED',operationId:pid,serverReceivedAt:'2026-10-19T00:00:00.000Z',targetId:pid,version:1,data:{ref:reference,snapshot,status:'PROJECT_ROLE_DEFINED'}};};
  await module.sendResponsibleSessionAction(new ApiClient(async()=>Response.json(response())),command,session);
  await assert.rejects(module.sendResponsibleSessionAction(new ApiClient(async()=>Response.json(response(true))),command,session));
});
test('준비 원문 조회는 알 수 없는 실행모드·누락 누락판정·가짜 지시참조를 거절한다',async()=>{
  const scope={sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'WRITE',recursive:false}]};
  const target={...confirmed,snapshot:{...confirmed.snapshot,definition:{...confirmed.snapshot.definition,allowedScopes:[scope]}}};
  const missing=['RESPONSIBLE_SESSION_RESERVED','CONNECTION_CANDIDATE_ONLY','ENVIRONMENT_CANDIDATE_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'];
  const snapshot={intent:{projectId:pid,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes:[scope],mode:'WORK',reason:'준비'},basisRefs:[ref],latestInstructionRefs:[],checkedAt:'2026-10-19T00:00:00.000Z',missingConditions:missing,authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:pid},executionAuthorized:false,dispatchPerformed:false};
  const read=async(s:any)=>module.readResponsibleSessionState(new ApiClient(async()=>Response.json({...state(),preparations:[{projectId:pid,ref:{...ref,contentHash:contentHash(canonicalJson(s))},snapshot:s,currentness:'NOT_RECHECKED'}]})),target);
  await read(snapshot);
  for(const s of [{...snapshot,intent:{...snapshot.intent,mode:'AUTO'}},{...snapshot,missingConditions:[]},{...snapshot,latestInstructionRefs:[{kind:'UNKNOWN',id:pid,contentHash:ref.contentHash}]}])await assert.rejects(read(s));
});
test('같은주체의 완료버퍼는 다른임무로 명시 교체 가능하고 미확인/다른기기는 불가하다',()=>{
  assert.equal(typeof module.canPrepareResponsibleSessionInput,'function');
  const b=module.newResponsibleSessionBuffer(confirmed,session,1),target={...confirmed,ref:{...ref,version:2}};
  assert.equal(module.canPrepareResponsibleSessionInput(b,target,session),true);
  b.uncertain=true;assert.equal(module.canPrepareResponsibleSessionInput(b,target,session),false);
  b.uncertain=false;b.pending={commandId:pid}as any;assert.equal(module.canPrepareResponsibleSessionInput(b,target,session),false);
  b.pending=null;assert.equal(module.canPrepareResponsibleSessionInput(b,target,{...session,clientId:'22222222-2222-4222-8222-222222222222'}),false);
});
test('준비 재조회는 첫요청 전에 이전 표시를 숨기고403에도 원입력을 보존한다',async()=>{
  assert.equal(typeof module.prepareResponsibleSessionInput,'function');
  const b=module.newResponsibleSessionBuffer(confirmed,session,1);b.reason='원 미저장 이유';b.dirty=true;const before=structuredClone(b);let hidden=false,calls=0;
  const client=new ApiClient(async()=>{calls++;assert.equal(hidden,true);return Response.json({code:'PROJECT_READ_DENIED'},{status:403});});
  await assert.rejects(module.prepareResponsibleSessionInput(client,confirmed,session,b,()=>{hidden=true;},()=>true));
  assert.equal(calls,1);assert.deepEqual(b,before);
});
test('권한/후보 조회를 기다리는 동안 입력이 바뀌면 전송 준비를 중단한다',()=>{
  assert.equal(typeof module.assertResponsibleSessionInputCurrent,'function');const b=module.newResponsibleSessionBuffer(confirmed,session,1);b.reason='원 입력';
  assert.doesNotThrow(()=>module.assertResponsibleSessionInputCurrent(b,b));
  for(const patch of [{reason:'새 입력'},{bindingId:crypto.randomUUID()},{pending:{commandId:pid}},{ownerClientId:crypto.randomUUID()}])assert.throws(()=>module.assertResponsibleSessionInputCurrent({...b,...patch},b));
});
