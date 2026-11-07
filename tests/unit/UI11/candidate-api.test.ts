import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newCandidate,prepareCandidate,sendCandidate,readCandidate,listCandidates,candidateAccess} from '../../../apps/web/src/features/connections/api.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},policyRef={id,version:1,contentHash:'a'.repeat(64)};
const codes=['INSTRUCTION_SESSION','STATE_ORIGINAL','RESULT_EVIDENCE','TOOL_APPROVAL','STOP_RECLAIM','PATH_WRITE_CONTROL'];
const canonical=(v:any):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
function snapshot(input:any){return{kind:input.kind,input,readiness:{state:'NOT_READY',executionAuthorized:false,missingRequirements:[{field:'connectorRef',reason:'NOT_PROVIDED'},{field:'environmentRef',reason:'NOT_PROVIDED'},{field:'hostTrust',reason:'UNVERIFIED'},{field:'agentMeasurement',reason:'NOT_EXECUTED'}]},capabilities:codes.map(code=>({code,documentation:null,measurement:{state:'UNVERIFIED',toolVersion:'1',environmentRef:null,executionRef:null,evidenceRefs:[]},controlLevel:'UNVERIFIED',limitations:['HOST_NOT_TRUSTED','NO_AGENT_MEASUREMENT','NOT_EXECUTABLE_CANDIDATE']}))};}
function filled(){const b=newCandidate(pid,session,1,'CONNECTION_CANDIDATE');b.input={kind:'CONNECTION_CANDIDATE',candidate:{label:'로컬 도구 후보',toolProduct:'코딩 도구',toolVersion:'1',adapterKind:'CLI'},candidateRef:null,policyRef,expiresAt:new Date(Date.now()+600000).toISOString(),reason:'실측 전 후보 보존'};return b;}
test('응답 유실 후 동일 명령만 재확인하여 원입력과 대상/정책을 보존한다',async()=>{
 const b=filled();b.pending=await prepareCandidate(b,session);const original=structuredClone(b.pending);let calls=0;const bodies:string[]=[];
 const api=new ApiClient(async(url,init)=>{assert.equal(url,`/api/v1/projects/${pid}/commands`);bodies.push(init!.body as string);if(++calls===1)throw Error('lost');const c=JSON.parse(init!.body as string),candidate=snapshot(c.payload),ref={id,version:1,contentHash:createHash('sha256').update(canonical(candidate)).digest('hex')};return Response.json({commandId:c.commandId,projectId:pid,status:'APPLIED',operationId:id,targetId:id,version:1,serverReceivedAt:new Date().toISOString(),data:{status:'CANDIDATE_STORED',ref,candidate,previousRef:null}});});
 await assert.rejects(sendCandidate(api,b,session),{code:'CONNECTION_LOST'});assert.deepEqual(b.pending,original);const result=await sendCandidate(api,b,session);assert.equal(result.ref.version,1);assert.equal(result.candidate.readiness.state,'NOT_READY');assert.equal(bodies[0],bodies[1]);
});
test('타 사용자/프로젝트 결박·준비 뒤 입력 변경은 전송 전 거절한다',async()=>{
 const b=filled();b.pending=await prepareCandidate(b,session);const api=new ApiClient(async()=>{assert.fail('must not send');});
 await assert.rejects(sendCandidate(api,b,{...session,user:{id}}),{code:'CANDIDATE_BINDING_INVALID'});
 b.projectId=id;await assert.rejects(sendCandidate(api,b,session),{code:'CANDIDATE_PENDING_CHANGED'});b.projectId=pid;b.input!.candidate.label='바뀐 입력';await assert.rejects(sendCandidate(api,b,session),{code:'CANDIDATE_PENDING_CHANGED'});
});
test('정확 hash·NOT_READY·6능력 미확인 없는 조회를 성공 처리하지 않는다',async()=>{
 const b=filled(),candidate=snapshot(b.input),ref={id,version:1,contentHash:createHash('sha256').update(canonical(candidate)).digest('hex')};
 const value={ref,candidate,expired:false,executionAuthorized:false,createdAt:new Date().toISOString(),recordedBy:uid,observedAt:new Date().toISOString()};const api=new ApiClient(async()=>Response.json(value));assert.equal((await readCandidate(api,pid,ref)).ref.id,id);
 value.candidate.capabilities[0]!.measurement.state='VERIFIED';await assert.rejects(readCandidate(api,pid,ref),{code:'RESPONSE_INVALID'});
});
test('목록 필터 same-origin·잘못된 kind/승격 응답은 거절한다',async()=>{
 const api=new ApiClient(async(url)=>{assert.equal(url,`/api/v1/projects/${pid}/connection-candidates?limit=50&kind=CONNECTION_CANDIDATE`);return Response.json({view:'CANDIDATES_ONLY',items:[{ref:{id,version:1,contentHash:'b'.repeat(64)},kind:'CONNECTION_CANDIDATE',label:'후보',readiness:'READY',expiresAt:new Date().toISOString(),integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:new Date().toISOString()});});
 await assert.rejects(listCandidates(api,pid,'CONNECTION_CANDIDATE'),{code:'RESPONSE_INVALID'});await assert.rejects(listCandidates(api,pid,['CONNECTION_CANDIDATE'] as any),{code:'CLIENT_PATH_INVALID'});
});
test('비밀 원문·정책 부재·만료 입력은 명령을 만들지 않는다',async()=>{
 const b=filled();b.input!.candidate.label='api_key=do-not-send-secret';await assert.rejects(prepareCandidate(b,session),{code:'CANDIDATE_INPUT_INVALID'});b.input!.candidate.label='안전 후보';b.input!.expiresAt='2000-01-01T00:00:00.000Z';await assert.rejects(prepareCandidate(b,session),{code:'CANDIDATE_INPUT_INVALID'});b.input=null;await assert.rejects(prepareCandidate(b,session),{code:'CANDIDATE_INPUT_INVALID'});
});
test('현재 AUTO와 승인필요 규칙이 함께 있어도 화면이 승인을 우회하지 않는다',async()=>{
 const rule={subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnection'],targetScopes:[{kind:'PROJECT',projectId:pid}],expiresAt:new Date(Date.now()+600000).toISOString()};
 const api=new ApiClient(async(url)=>Response.json(String(url).endsWith('/permission-policy')?{configured:true,policy:{ref:policyRef,rules:[{...rule,disposition:'AUTO'},{...rule,disposition:'REQUIRE_APPROVAL'}]}}:{id:pid,participation:'OWNER',controlState:{generation:1,status:'HELD',actorId:uid,clientId:uid}}));
 await assert.rejects(candidateAccess(api,pid,session,'CONNECTION_CANDIDATE'),{code:'APPROVAL_REQUIRED',status:412});
});
test('서버와 같은 passwd/access_token 표식도 원문 전송 전에 차단한다',async()=>{for(const label of ['passwd=not-a-real-secret','access_token=not-a-real-secret']){const b=filled();b.input!.candidate.label=label;await assert.rejects(prepareCandidate(b,session),{code:'CANDIDATE_INPUT_INVALID'});}});
test('승인 요청 준비용 조회만 승인 필요 상태를 반환하고 실행 허가로 바꾸지 않는다',async()=>{const api=new ApiClient(async(url)=>Response.json(String(url).endsWith('/permission-policy')?{configured:true,policy:{ref:policyRef,rules:[{subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnection'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',expiresAt:new Date(Date.now()+600000).toISOString()}]}}:{id:pid,participation:'OWNER',controlState:{generation:1,status:'HELD',actorId:uid,clientId:uid}}));const v=await candidateAccess(api,pid,session,'CONNECTION_CANDIDATE',true);assert.equal(v.approvalRequired,true);assert.deepEqual(v.policyRef,policyRef);});
