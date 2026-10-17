import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readHumanRegistration,listHumanRegistrations,newTrustBuffer,prepareTrustRegistration,freezeTrustCommand,sendTrustCommand,trustAccess,prepareTrustApproval,settleTrustBuffer} from '../../../apps/web/src/features/connections/trust-api.ts';
import {sendApprovalCommand} from '../../../apps/web/src/features/decisions/api.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},ref={id,version:1,contentHash:'a'.repeat(64)};

test('지연 신뢰 결과는 같은 주체·명령·승인 대기에만 반영하고 새 입력·결박·복구 결과를 보존한다',async()=>{
 const expected=newTrustBuffer(pid,session,1);expected.draft={hostLabel:'원 입력',expectedHostFingerprint:'b'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),reason:'원 명령'};await freezeTrustCommand(expected,session,await prepareTrustRegistration(expected,session,ref),null,ref,expected.draft.expiresAt);
 const completed={...expected,pending:null,pendingHash:null,resultRegistrationId:id},fresh=structuredClone(expected);
 assert.deepEqual(settleTrustBuffer(fresh,expected,completed),completed);
 const draft=newTrustBuffer(pid,session,1);draft.draft.hostLabel='후속 입력';assert.equal(settleTrustBuffer(draft,expected,completed),draft);
 assert.equal(settleTrustBuffer(null,expected,completed),null);
 for(const change of [{projectId:id},{ownerUserId:id},{ownerClientId:id},{controlGeneration:2},{pending:{...expected.pending!,commandId:uid}},{pendingHash:'c'.repeat(64)},{approvalWork:{details:{} as any,pending:null,requestId:id,uncertain:false}}]){const newer={...fresh,...change};assert.equal(settleTrustBuffer(newer,expected,completed),newer);}
 expected.approvalWork={details:{} as any,pending:{...expected.pending!,commandId:uid},requestId:null,uncertain:false};const replayed={...expected,approvalWork:{...expected.approvalWork,pending:null,requestId:id}};
 assert.equal(settleTrustBuffer(replayed,expected,completed),replayed);
});
test('HUMAN 목록은 same-origin GET만 사용하고 state·cursor·비밀 승격 응답을 거절한다',async()=>{
 const hit={registrationRef:ref,connectorRef:ref,hostLabel:'합성 host',state:'CREATED',derivedExpired:false,expiresAt:new Date(Date.now()+600000).toISOString(),proofedAt:null,revokedAt:null};
 const value={view:'HOST_TRUST_REGISTRATIONS_ONLY',items:[hit],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()};
 const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/connector-registrations?limit=50`);assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');return Response.json(value);});
 assert.equal((await listHumanRegistrations(client,pid)).items[0]!.hostLabel,'합성 host');
 (value.items[0] as any).oneTimeCode='must-not-return';await assert.rejects(listHumanRegistrations(client,pid),{code:'RESPONSE_INVALID'});
});
test('신뢰 일회 승인 요청도 원 명령·정확 payload/ref·기한에 결박하고 자동 소비하지 않는다',async()=>{
 const b=newTrustBuffer(pid,session,1);b.draft={hostLabel:'승인 host',expectedHostFingerprint:'b'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),reason:'별도 승인'};const c=await prepareTrustRegistration(b,session,ref);await freezeTrustCommand(b,session,c,null,ref,b.draft.expiresAt);
 const details={reason:'이번 등록만',risks:{data:'자료 접근0',security:'상태 조회만',cost:'비용0',interruption:'중단0',unverified:'실PC 미검증'},rollback:{method:'명시 회수',limitations:'최초 코드 복구 불가',evidenceRefs:[]},expiresAt:b.draft.expiresAt};
 const request=await prepareTrustApproval(b,session,details);assert.equal(request.operation,'requestApproval');assert.equal((request.payload.details as any).candidateCommandId,c.commandId);assert.equal((request.payload.details as any).actionScope.operation,'registerConnector');assert.equal((request.payload.details as any).actionScope.targetRef,null);assert.deepEqual(b.pending,c);
 const api=new ApiClient(async(_url,init)=>{const posted=JSON.parse(init!.body as string);assert.equal(posted.payload.details.actionScope.operation,'registerConnector');return Response.json({code:'APPROVAL_REQUIRED'},{status:412});});await assert.rejects(sendApprovalCommand(api,request,session),{code:'APPROVAL_REQUIRED',status:412});
});
test('신뢰 등록 응답 유실은 같은 명령만 보내고 pairing code를 root 버퍼에 저장하지 않는다',async()=>{
 const b=newTrustBuffer(pid,session,1);b.draft={hostLabel:'합성 host',expectedHostFingerprint:'b'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),reason:'등록 유실 확인'};const command=await prepareTrustRegistration(b,session,ref);await freezeTrustCommand(b,session,command,null,ref,b.draft.expiresAt);
 const bodies:string[]=[],api=new ApiClient(async(url,init)=>{if(String(url).endsWith('/permission-policy'))return Response.json({configured:true,policy:{ref,rules:[{subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnector'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',expiresAt:new Date(Date.now()+600000).toISOString()}]}});if(String(url)===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{generation:1,status:'HELD',actorId:uid,clientId:uid}});bodies.push(init!.body as string);if(bodies.length===1)throw Error('lost');return Response.json({commandId:command.commandId,operationId:id,projectId:pid,status:'APPLIED',targetId:id,version:1,serverReceivedAt:new Date().toISOString(),data:{status:'REGISTRATION_CREATED',registrationRef:ref,connectorRef:ref,oneTimeCode:null,secretDisposition:'ALREADY_ISSUED_RECONCILE',grants:[],executionAuthorized:false}});});
 await assert.rejects(sendTrustCommand(api,b,session),{code:'CONNECTION_LOST'});b.uncertain=true;const result=await sendTrustCommand(api,b,session);assert.equal(result.oneTimeCode,null);assert.equal(bodies[0],bodies[1]);assert.equal('oneTimeCode'in b,false);assert.deepEqual(b.pending,command);
 b.pending!.payload.reason='변조';await assert.rejects(sendTrustCommand(api,b,session),{code:'TRUST_PENDING_CHANGED'});assert.equal(bodies.length,2);
});
test('현재 확인 정책을 읽기 허가와 혼동하지 않고 승인필요를 자동 허가로 바꾸지 않는다',async()=>{
 const rule={subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnector'],targetScopes:[{kind:'PROJECT',projectId:pid}],expiresAt:new Date(Date.now()+600000).toISOString()};
 const api=new ApiClient(async(url)=>Response.json(String(url).endsWith('/permission-policy')?{configured:true,policy:{ref,rules:[{...rule,disposition:'AUTO'},{...rule,disposition:'REQUIRE_APPROVAL'}]}}:{id:pid,participation:'OWNER',controlState:{generation:1,status:'HELD',actorId:uid,clientId:uid}}));
 const a=await trustAccess(api,pid,session,'registerConnector');assert.equal(a.approvalRequired,true);await assert.rejects(trustAccess(api,pid,session,'confirmConnectorRegistration'),{code:'PROJECT_OPERATION_DENIED',status:403});
});
test('상세 요청은 credential을 넣지 않고 잘못된 project/예상치 않은 token 응답을 차단한다',async()=>{
 const client=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/connector-registrations/${id}`);assert.equal(new Headers(init?.headers).has('authorization'),false);return Response.json({registrationRef:ref,projectId:pid,credential:{token:'must-not-return'}});});
 await assert.rejects(readHumanRegistration(client,pid,id),{code:'RESPONSE_INVALID'});await assert.rejects(readHumanRegistration(client,'bad',id),{code:'CLIENT_PATH_INVALID'});
});
test('등록 버퍼는 본인/client/project/세대와6필드 입력을 고정하고 code/Secret을 담지 않는다',async()=>{
 const b=newTrustBuffer(pid,session,1);b.draft={hostLabel:'로컬 host',expectedHostFingerprint:'b'.repeat(64),expiresAt:new Date(Date.now()+300000).toISOString(),reason:'명시 등록 요청'};
 const c=await prepareTrustRegistration(b,session,ref);assert.equal(c.operation,'registerConnector');assert.equal(c.targetId,null);assert.equal(c.expectedVersion,0);assert.deepEqual(Object.keys(c.payload).sort(),['expectedHostFingerprint','expiresAt','hostLabel','kind','policyRef','reason']);assert.equal('oneTimeCode'in b,false);
 await assert.rejects(prepareTrustRegistration(b,{...session,clientId:id},ref),{code:'TRUST_BINDING_INVALID'});b.draft.hostLabel='api_key=must-not-send';await assert.rejects(prepareTrustRegistration(b,session,ref),{code:'TRUST_INPUT_INVALID'});
});
