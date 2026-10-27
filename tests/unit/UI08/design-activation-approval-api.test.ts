import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {validateApprovalView} from '../../../apps/web/src/features/decisions/api.ts';
import {fixture,pid,actor,id,hash,at} from '../FN04/baseline-activation-fixture.ts';
const session={user:{id:actor.actorId},clientId:actor.clientId,csrfToken:'C'.repeat(43)};
async function api(){const url=new URL('../../../apps/web/src/features/decisions/design-activation-approval-api.ts',import.meta.url),m=await import(url.href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND'&&e.url===url.href)return null;throw e;});assert(m,'UI08 activate후보명시요청·exact결박 source 미구현');return m as any;}
function context(){const f=fixture(),rules=[{ruleId:'ACTIVATE',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['activateDesignChange'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],policy={ref:f.policyRef,rules,reason:'한정자료정책',reviewRefs:[],createdAt:at};policy.ref={...policy.ref,contentHash:hash({rules,reason:policy.reason,reviewRefs:[]})};const snapshot={projectId:pid,details:f.details,scopeDigest:hash(f.scope),requiredDecider:{kind:'HUMAN',userId:actor.actorId},policyRef:policy.ref,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1},requestRef={id:f.approvalRef.requestId,version:1,contentHash:hash(snapshot)},request={id:requestRef.id,version:1,status:'PENDING',...snapshot,createdAt:at},body={requestId:request.id,requestVersion:1,requestRef,scopeDigest:snapshot.scopeDigest,decision:'APPROVE',reason:'별도결정',decidedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},controlGeneration:1,policyRef:policy.ref},decision={id:f.approvalRef.decisionId,...body,decidedAt:at,ref:{id:f.approvalRef.decisionId,version:1,contentHash:hash(body)}},view={request,requestRef,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at,candidateActivation:{candidateCommandId:f.command.commandId,payloadHash:hash(f.input),payload:f.input}};
 const calls:any[]=[],client=new ApiClient(async(path,options)=>{calls.push({path:String(path),options});const route=String(path);if(route===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{actorId:actor.actorId,clientId:actor.clientId,generation:1,status:'HELD'}});if(route.endsWith('/permission-policy'))return Response.json({configured:true,policy});if(route.endsWith('/baseline-activations/current'))return Response.json({projectId:pid,current:{state:'NONE'},observedAt:at,executionAuthorized:false,dispatchPerformed:false});if(route.endsWith('/approvals/'+request.id))return Response.json(view);throw Error('허용되지 않은합성경로');});
 const buffer={bindingId:id(50),projectId:pid,ownerUserId:actor.actorId,ownerClientId:actor.clientId,csrfToken:session.csrfToken,api:client,transport:client.transport,controlGeneration:1,input:structuredClone(f.input),current:{projectId:pid,current:{state:'NONE'},observedAt:at,executionAuthorized:false,dispatchPerformed:false},pending:{...f.command,approvalRef:null},receipt:null,uncertain:false,failure:null};return{f,policy,view,client,calls,buffer};}

test('UI08 기존보호승인reader는activate5필드원payload/hash만받고다른후보를거절한다',async()=>{
 const {f,view}=context();assert.deepEqual((await validateApprovalView(view as any,pid,view.request.id) as any).candidateActivation.payload,f.input);
 for(const change of [(v:any)=>v.candidateActivation.payload.reason='다른입력',(v:any)=>v.candidateActivation.candidateCommandId=id(90),(v:any)=>v.candidateActivation.payload.allow=true,(v:any)=>v.candidatePlan=v.candidateActivation]){const v=structuredClone(view);change(v);await assert.rejects(()=>validateApprovalView(v as any,pid,v.request.id));}
});

test('UI08 명시요청은원activation명령/5입력/hash·현재pointer를보존하며request와apply를분리한다',async()=>{
 const m=await api(),x=context(),before=structuredClone(x.buffer.pending),work=m.newDesignActivationApprovalRequest(x.buffer,session);work.details={reason:x.f.details.reason,risks:x.f.details.risks,rollback:x.f.details.rollback,expiresAt:x.f.details.expiresAt};const command=await m.prepareDesignActivationApprovalRequest(x.client,work,x.buffer,session,()=>true);
 assert.equal(command.operation,'requestApproval');assert.equal(command.approvalRef,null);assert.equal(command.targetId,null);assert.deepEqual(command.baselineRefs,[]);assert.deepEqual(command.payload.candidatePayload,x.f.input);assert.equal(command.payload.details.candidateCommandId,before.commandId);assert.equal(command.payload.details.actionScope.payloadHash,hash(x.f.input));assert.deepEqual(command.payload.details.actionScope.targetRef,x.f.input.changeRef);assert.deepEqual(command.payload.details.actionScope.baselineRefs,before.baselineRefs);assert.deepEqual(x.buffer.pending,before);assert(x.calls.every(v=>v.options?.method==='GET'));
});

test('UI08 별도결박은정확보관후보/정책/원command만수락하고새ID·최신pointer로바꾸지않는다',async()=>{
 const m=await api(),x=context(),before=structuredClone(x.buffer.pending),bound=await m.bindDesignActivationApproval(x.client,x.buffer,x.view.request.id,session,()=>true);assert.deepEqual(bound.pending,{...before,approvalRef:{requestId:x.view.request.id,decisionId:x.view.decision.id,scopeDigest:x.view.request.scopeDigest}});assert.deepEqual(x.buffer.pending,before);
 for(const [alter,expected] of [[(v:any)=>v.candidateActivation.payload.reason='다른후보','RESPONSE_INVALID'],[(v:any)=>v.request.details.candidateCommandId=id(90),'RESPONSE_INVALID'],[(v:any)=>{v.expired=true;v.effectiveState='EXPIRED';},'APPROVAL_NOT_USABLE']] as const){const fresh=context();Object.assign(fresh.view,structuredClone(fresh.view));alter(fresh.view);await assert.rejects(()=>m.bindDesignActivationApproval(fresh.client,fresh.buffer,fresh.view.request.id,session,()=>true),(e:any)=>e.code===expected&&e.code!=='DESIGN_ACTIVATION_PAUSED');assert.equal(fresh.calls.filter(v=>v.path===`/api/v1/projects/${pid}/approvals/${fresh.view.request.id}`).length,1);assert(fresh.calls.every(v=>v.options?.method==='GET'));}
});

test('UI08 세션/기기불일치·이탈·권한회수에는후보본문수집/후속GET/자동POST0이다',async()=>{
 const m=await api(),x=context();await assert.rejects(()=>m.bindDesignActivationApproval(x.client,x.buffer,x.view.request.id,{...session,clientId:id(90)},()=>true));assert.deepEqual(x.calls,[]);
 await assert.rejects(()=>m.prepareDesignActivationApprovalRequest(x.client,m.newDesignActivationApprovalRequest(x.buffer,session),x.buffer,session,()=>false));assert.deepEqual(x.calls,[]);
 let calls=0;x.client.transport=async()=>{calls++;return Response.json({code:'NOT_FOUND'},{status:404});};await assert.rejects(()=>m.bindDesignActivationApproval(x.client,{...x.buffer,transport:x.client.transport},x.view.request.id,session,()=>true));assert.equal(calls,1);assert.equal(x.buffer.pending.approvalRef,null);
});

test('UI08 준비해시대기중transport교체는원요청생성도회수하고POST0이다',async()=>{
 const m=await api(),x=context(),work=m.newDesignActivationApprovalRequest(x.buffer,session);work.details={reason:x.f.details.reason,risks:x.f.details.risks,rollback:x.f.details.rollback,expiresAt:x.f.details.expiresAt};
 const original=crypto.subtle.digest;let held!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>held=resolve),wait=new Promise<void>(resolve=>release=resolve);
 (crypto.subtle as any).digest=async function(algorithm:any,data:any){if(new TextDecoder().decode(data).includes('\"confirmedPlanRef\"')){held();await wait;}return original.call(crypto.subtle,algorithm,data);};
 try{const pending=m.prepareDesignActivationApprovalRequest(x.client,work,x.buffer,session,()=>true);await entered;x.client.transport=async()=>Response.json({});release();await assert.rejects(()=>pending,(e:any)=>['DESIGN_ACTIVATION_PAUSED','DESIGN_ACTIVATION_BINDING_INVALID'].includes(e.code));assert(x.calls.every(v=>v.options?.method==='GET'));assert.equal(work.pending,null);assert.equal(x.buffer.pending.approvalRef,null);}
 finally{(crypto.subtle as any).digest=original;}
});

test('UI08 준비해시대기중CSRF·원후보교체는원명령을다른문맥에결박하지않는다',async()=>{
 const m=await api();for(const kind of ['csrf','command']){const x=context(),s={...session},work=m.newDesignActivationApprovalRequest(x.buffer,s);work.details={reason:x.f.details.reason,risks:x.f.details.risks,rollback:x.f.details.rollback,expiresAt:x.f.details.expiresAt};const original=crypto.subtle.digest;let held!:()=>void,release!:()=>void;const entered=new Promise<void>(resolve=>held=resolve),wait=new Promise<void>(resolve=>release=resolve);
  (crypto.subtle as any).digest=async function(algorithm:any,data:any){if(new TextDecoder().decode(data).includes('"confirmedPlanRef"')){held();await wait;}return original.call(crypto.subtle,algorithm,data);};
  try{const pending=m.prepareDesignActivationApprovalRequest(x.client,work,x.buffer,s,()=>true);await entered;if(kind==='csrf')s.csrfToken='D'.repeat(43);else x.buffer.pending.commandId=id(90);release();await assert.rejects(()=>pending,(e:any)=>['DESIGN_ACTIVATION_BINDING_INVALID','APPROVAL_CANDIDATE_MISMATCH'].includes(e.code));assert(x.calls.every(v=>v.options?.method==='GET'));assert.equal(work.pending,null);}
  finally{(crypto.subtle as any).digest=original;}
 }
});
