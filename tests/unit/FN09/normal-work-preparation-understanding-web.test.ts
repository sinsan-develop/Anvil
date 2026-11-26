import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {seed,clientFixture} from '../UI04/registered-preparation-options-fixture.ts';
import * as api from '../../../apps/web/src/features/workspace/execution-preparation-api.ts';
import {normalInitialUnderstandingOwner} from '../../../apps/web/src/features/session-detail/understanding-review-write.ts';
import {newExecutionApproval,prepareExecutionApproval,bindExecutionApproval} from '../../../apps/web/src/features/workspace/execution-preparation-approval.ts';
import {sendApprovalCommand} from '../../../apps/web/src/features/decisions/api.ts';
import {build} from 'vite';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const H=(v:unknown)=>contentHash(canonicalJson(v));
const id=(n:number)=>'af094304-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const f=seed(true),base=clientFixture(f),scope={projectId:f.confirmed.projectId,executionId:id(1),executionGeneration:3};
 f.context.manifest.missingRequired=[];f.context.ref.contentHash=H(f.context.manifest);
 const intent={projectId:f.confirmed.projectId,assignmentRef:f.confirmed.ref,roleBindingRef:f.binding.ref,contextBundleRef:f.context.ref,connectionRef:f.connection.ref,environmentRef:f.environment.ref,capabilityRef:f.report.ref,budgetPolicyRef:f.budget.ref,sourceScopes:[f.scope],mode:'CONTEXT_REVIEW',reason:'원 맥락 검토 준비',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1'};
 const body=canonicalJson(f.connection.definition.modelOptions),snapshot={intent,basisRefs:[f.confirmed.ref],latestInstructionRefs:[],checkedAt:f.at,missingConditions:['RESPONSIBLE_SESSION_RESERVED','CONNECTION_DEFINITION_ONLY','ENVIRONMENT_DEFINITION_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'],authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:f.session.user.id},executionAuthorized:false,dispatchPerformed:false,options:{format:'CLAUDE_QUERY_DATA_V1',mediaType:'application/json',body,utf8Bytes:Buffer.byteLength(body),contentHash:contentHash(body)}};
 const original={projectId:f.confirmed.projectId,ref:{...ref(2),contentHash:H(snapshot)},snapshot,currentness:'NOT_RECHECKED'};
 const ground={bundleRef:f.context.ref,preparationRef:original.ref,grantRef:ref(3),startCommandRef:ref(4),manifestRef:ref(5),roleBindingRef:f.binding.ref,agentSessionRef:f.binding.snapshot.sessionRef,roleRef:f.binding.snapshot.roleRef,subjectBindingRef:f.binding.ref,requestRef:ref(6),responseRef:ref(7),basisRefs:snapshot.basisRefs,requiredPartRefs:[ref(8)],receivedPartRefs:[ref(8)],deliveryReceiptRefs:[ref(9)],responsePartRefs:[ref(10)],latestInstructionRefs:[],status:'SOURCE_BASIS_ONLY',subjectBindingState:'VERIFIED',reviewAvailable:false,scope,executionAuthorized:false,dispatchPerformed:false};
 const items=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'].map(code=>({code,sourceRefs:snapshot.basisRefs,responsePartRefs:ground.responsePartRefs,judgement:'MATCH',reason:'사람이 대조한 이유'}));
 const input={bundleRef:ground.bundleRef,responseRef:ground.responseRef,subjectBindingRef:ground.subjectBindingRef,criteriaVersion:1,items,reason:'원 정상 판단'};
 const request={schemaVersion:1,projectId:scope.projectId,commandId:id(11),clientId:f.session.clientId,controlGeneration:1,operation:'reviewUnderstanding',targetId:scope.executionId,expectedVersion:scope.executionGeneration,baselineRefs:[],approvalRef:null,payload:input};
 const currentBinding={transport:'NORMAL_PROTECTED',scope,bundleRef:ground.bundleRef,responseRef:ground.responseRef,subjectBindingRef:ground.subjectBindingRef,basisRefs:ground.basisRefs,latestInstructionRefs:[],requiredPartRefs:ground.requiredPartRefs,receivedPartRefs:ground.receivedPartRefs,responsePartRefs:ground.responsePartRefs,criteria:items.map(({judgement,reason,...v})=>v),sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT',sourceBasis:ground};
 const s={scope,sequence:1,previousRef:null,request,requestHash:H(request),reviewer:{kind:'HUMAN',userId:f.session.user.id,clientId:f.session.clientId,humanSessionId:id(12),credentialGeneration:1,controlGeneration:1},policyRef:ref(13),currentBinding,input,outcome:'ACCEPTED',recordedAt:f.at,executionAuthorized:false,dispatchPerformed:false};
 const row={ref:{...ref(14),contentHash:H(s)},snapshot:s},history={transport:'NORMAL_PROTECTED',scope,items:[row],currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
 const calls:{url:string;method:string;body?:string}[]=[];let stored:any=null,lost=false,postCount=0;const modes={historyFail:false,loseApproval:false,onPolicy:null as (()=>void)|null,onPost:null as (()=>void)|null};
 const basis={kind:'NORMAL_UNDERSTANDING_WORK_BASIS',reviewRef:row.ref,scope,preparationRef:original.ref,assignmentRef:intent.assignmentRef,roleBindingRef:intent.roleBindingRef,agentSessionRef:ground.agentSessionRef,contextBundleRef:intent.contextBundleRef,connectionRef:intent.connectionRef,environmentRef:intent.environmentRef,responseRef:ground.responseRef,requestRef:ground.requestRef,basisRefs:ground.basisRefs,latestInstructionRefs:[]};
 const client=new ApiClient(async(url,options)=>{
  calls.push({url:String(url),method:options?.method??'GET',body:options?.body as string|undefined});
  if(options?.method==='POST')modes.onPost?.();
  if(String(url).includes('/assignments/'+f.confirmed.ref.id+'/versions/'+f.confirmed.ref.version)&&!String(url).endsWith('/execution-preparation-state'))return Response.json(f.confirmed);
  if(String(url).includes('/understanding-reviews?'))return modes.historyFail?Response.json({code:'UNDERSTANDING_HISTORY_UNAVAILABLE'},{status:503}):Response.json(history);
  if(String(url).includes('/execution-preparations/'+original.ref.id+'/'))return Response.json(original);
  if(options?.method==='POST'&&JSON.parse(String(options.body)).operation==='prepareExecution'){
   const q=JSON.parse(String(options.body));if(!stored){postCount++;const {understandingReviewRef,...savedIntent}=q.payload;const snap={...snapshot,intent:savedIntent,missingConditions:[...snapshot.missingConditions,'UNDERSTANDING_NOT_REVIEWED'],understandingBasis:structuredClone(basis)};const r={...ref(15),contentHash:H(snap)};stored={original:{projectId:scope.projectId,ref:r,snapshot:snap,currentness:'NOT_RECHECKED'},receipt:{operationId:id(16),commandId:q.commandId,projectId:scope.projectId,status:'APPLIED',targetId:r.id,version:1,data:{status:'EXECUTION_PREPARED',ref:r,snapshot:snap},evidenceRefs:[],warnings:[],serverReceivedAt:f.at}};}
   if(lost){lost=false;throw Error('합성 응답 유실');}return Response.json(stored.receipt);
  }
  if(stored&&String(url).includes('/execution-preparations/'+stored.original.ref.id+'/'))return Response.json(stored.original);
  const response=await base.client.transport(url,options);if(String(url).endsWith('/permission-policy'))modes.onPolicy?.();
  if(modes.loseApproval&&options?.method==='POST'&&JSON.parse(String(options.body)).operation==='requestApproval'){modes.loseApproval=false;throw Error('합성 승인 응답 유실');}
  return response;
 });
 const rejectNext=(accepted=false)=>{const previous=history.items.at(-1)!;const snap=structuredClone(previous.snapshot);snap.sequence++;snap.previousRef=previous.ref as any;snap.request.commandId=crypto.randomUUID();snap.request.payload.items[0]!.judgement=accepted?'MATCH':'MISMATCH';snap.input=snap.request.payload;snap.requestHash=H(snap.request);snap.outcome=accepted?'ACCEPTED':'NOT_ACCEPTED';const next={ref:{...previous.ref,version:previous.ref.version+1,contentHash:H(snap)},snapshot:snap};history.items.push(next);};
 return {f,client,scope,history,row,original,basis,calls,base,modes,rejectNext,postCount:()=>postCount,lose:()=>{lost=true;}};
}
async function selected(h:ReturnType<typeof fixture>){
 const b=api.newExecutionPreparation(h.f.confirmed as any,h.f.session);b.draft={roleBindingRef:h.f.binding.ref,contextBundleRef:h.f.context.ref,capabilityRef:h.f.report.ref,sourceScopes:[h.f.scope],mode:'WORK',reason:'선택 적합 판단으로 별도 WORK 준비'};
 const sources=await api.selectPreparationSources(h.client,h.f.confirmed as any,b.draft as any,h.f.report.ref,()=>true);
 const select=(api as any).selectNormalWorkUnderstanding;assert.equal(typeof select,'function');
 const selection=await select(h.client,h.f.confirmed,sources,h.scope,h.f.session,()=>true);
 return Object.assign(b,{sources,understandingSelection:selection});
}
function exactCandidate(h:ReturnType<typeof fixture>,reviewRef=h.history.items.at(-1)!.ref){
 return {scope:h.scope,reviewRef,assignmentRef:h.basis.assignmentRef,roleBindingRef:h.basis.roleBindingRef,agentSessionRef:h.basis.agentSessionRef};
}
test('보호 claim에서 선택한 fullref는 새 head·동일 버전의 다른 hash·재검산 경쟁으로 바뀌지 않는다',async()=>{
 for(const mode of ['NEXT','NOT_ACCEPTED','HASH','SECOND_READ','ASSIGNMENT','ROLE','SESSION']){
  const h=fixture();
  h.rejectNext(true);
  const candidate=structuredClone(exactCandidate(h));
  const draft={roleBindingRef:h.f.binding.ref,contextBundleRef:h.f.context.ref,capabilityRef:h.f.report.ref};
  const confirmed=h.f.confirmed as any;
  const sources=await api.selectPreparationSources(h.client,confirmed,draft,h.f.report.ref,()=>true);
  if(mode==='NEXT'||mode==='NOT_ACCEPTED')h.rejectNext(mode==='NEXT');
  if(mode==='HASH'){
   const latest=h.history.items.at(-1)!;
   latest.snapshot.request.payload.reason+=' 변경';
   latest.snapshot.requestHash=H(latest.snapshot.request);
   latest.ref.contentHash=H(latest.snapshot);
  }
  if(mode==='ASSIGNMENT')candidate.assignmentRef=ref(91);
  if(mode==='ROLE')candidate.roleBindingRef=ref(92);
  if(mode==='SESSION')candidate.agentSessionRef=ref(93);
  let historyReads=0;
  const transport=h.client.transport;
  h.client.transport=(url,options)=>{
   if(String(url).includes('/understanding-reviews?')&&++historyReads===2&&mode==='SECOND_READ')h.rejectNext(true);
   return transport(url,options);
  };
  await assert.rejects(api.selectNormalWorkUnderstanding(h.client,confirmed,sources,h.scope,h.f.session,()=>true,candidate),{code:'WORK_PREPARATION_UNDERSTANDING_CHANGED'});
  assert.equal(historyReads,mode==='SECOND_READ'?2:['ASSIGNMENT','ROLE','SESSION'].includes(mode)?0:1);
  assert.equal(h.calls.filter(v=>v.method==='POST').length,0);
 }
});
test('최신 정상 ACCEPTED를 명시 선택해 prepare-only ref와 별도 basis를 저장·재조회한다',async()=>{
 const h=fixture(),b=await selected(h),prepared=await api.prepareExecutionCommand(h.client,b,h.f.confirmed as any,h.f.session,h.f.report.ref,()=>true);
 assert.deepEqual(prepared.pending!.payload.understandingReviewRef,h.row.ref);assert.equal(Object.keys(prepared.pending!.payload).length,14);
 const result=await api.sendExecutionPreparation(h.client,prepared,h.f.session,()=>true);assert.equal(Object.keys(result.snapshot.intent).length,13);assert.ok(!('understandingReviewRef'in result.snapshot.intent));assert.deepEqual(result.snapshot.understandingBasis,h.basis);assert.equal(result.snapshot.executionAuthorized,false);assert.equal(h.postCount(),1);
 (h.f.state.preparations as any[]).push({projectId:result.projectId,ref:result.ref,snapshot:result.snapshot});assert.equal((await api.loadPreparationChoices(h.client,h.f.confirmed as any,()=>true))!.bindings.length,1);
 assert.ok(!JSON.stringify(b).includes('사람이 대조한 이유'));assert.equal((b as any).understandingSelection.ownerEpoch,normalInitialUnderstandingOwner(h.client,h.f.session));
});
test('선택 후 latest 부적합·역할/session/맥락/current·epoch 변경은 동결 또는 신규 POST 전에 거절한다',async()=>{
 for(const change of ['head','latest','role','session','context','missing','epoch']){
  const h=fixture(),b=await selected(h);
  if(change==='head'){h.row.snapshot.input.items[0]!.judgement='MISMATCH';h.row.snapshot.outcome='NOT_ACCEPTED';h.row.snapshot.requestHash=H(h.row.snapshot.request);h.row.ref.contentHash=H(h.row.snapshot);}
  if(change==='latest')h.rejectNext(true);
  if(change==='role')b.draft.roleBindingRef={...b.draft.roleBindingRef!,version:2};
  if(change==='session')h.f.binding.snapshot.sessionRef=ref(99);
  if(change==='context')h.f.context.currentCheck.state='CHANGED' as any;
  if(change==='missing')h.f.context.manifest.missingRequired=['PURPOSE'];
  const session=change==='epoch'?{...h.f.session,csrfToken:'b'.repeat(43)}:h.f.session;
  await assert.rejects(api.prepareExecutionCommand(h.client,b,h.f.confirmed as any,session,h.f.report.ref,()=>true),change);assert.equal(h.postCount(),0,change);
 }
});
test('실제 POST 응답 유실 뒤에는 원 선택이 바뀌어도 정확 원 명령만 재확인하고 재정산하지 않는다',async()=>{
 const h=fixture(),prepared=await api.prepareExecutionCommand(h.client,await selected(h),h.f.confirmed as any,h.f.session,h.f.report.ref,()=>true);h.lose();
 await assert.rejects(api.sendExecutionPreparation(h.client,prepared,h.f.session,()=>true));
 const retried={...prepared,uncertain:true};h.row.snapshot.outcome='NOT_ACCEPTED';
 const result=await api.sendExecutionPreparation(h.client,retried,h.f.session,()=>true);assert.deepEqual(result.snapshot.understandingBasis.reviewRef,h.basis.reviewRef);assert.equal(h.postCount(),1);
 const posts=h.calls.filter(c=>c.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0]!.body,posts[1]!.body);
});

test('원 인증/transport는 fresh preflight 전체에 고정되어 policy await 중 변경 뒤 POST0이다',async()=>{
 for(const kind of ['session','transport']){const h=fixture(),b=await api.prepareExecutionCommand(h.client,await selected(h),h.f.confirmed as any,h.f.session,h.f.report.ref,()=>true);
  h.modes.onPolicy=()=>{if(kind==='session')h.f.session.csrfToken='b'.repeat(43);else h.client.transport=async()=>assert.fail('교체 transport 호출 금지');};
  await assert.rejects(api.sendExecutionPreparation(h.client,b,h.f.session,()=>true));assert.equal(h.postCount(),0);assert.equal(b.uncertain,false);
 }
});

test('linked 준비의 별도 승인 후보 hash는 selector를 포함하고 같은 준비 명령에만 결박한다',async()=>{
 const h=fixture();h.base.setPolicy('REQUIRE_APPROVAL');let b=await api.prepareExecutionCommand(h.client,await selected(h),h.f.confirmed as any,h.f.session,h.f.report.ref,()=>true);
 const w=await newExecutionApproval(b,h.f.session,h.client);w.details={reason:'별도 준비 보관만 승인',risks:{data:'원문 추가 없음',security:'보호 조회',cost:'기존 정산',interruption:'실행 없음',unverified:'SDK 미실행'},rollback:{method:'기록 보존',limitations:'실행 권리 없음',evidenceRefs:[]},expiresAt:new Date(Date.now()+1800000).toISOString()};
 const packet=await prepareExecutionApproval(h.client,b,w,h.f.session,()=>true);assert.ok(packet.payload.candidatePayload);assert.deepEqual(packet.payload.candidatePayload.understandingReviewRef,h.row.ref);assert.equal(packet.payload.details.actionScope.payloadHash,H(b.pending!.payload));
 const saved=await sendApprovalCommand(h.client,packet,h.f.session);
 const decision:any={schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:h.f.session.clientId,controlGeneration:1,operation:'decideApproval',targetId:saved.data.ref.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{requestId:saved.data.ref.id,expectedVersion:1,scopeDigest:saved.data.request.scopeDigest,decision:'APPROVE',reason:'별도 보관 승인'}};
 await sendApprovalCommand(h.client,decision,h.f.session);b.approval={request:{...w,pending:packet,resultId:saved.data.ref.id},requestId:saved.data.ref.id,commandHash:null};
 const bound=await bindExecutionApproval(h.client,b,saved.data.ref.id,h.f.session,()=>true);assert.equal(bound.pending!.commandId,b.pending!.commandId);assert.deepEqual(bound.pending!.payload,b.pending!.payload);
 const stored=await api.sendExecutionPreparation(h.client,bound,h.f.session,()=>true);assert.deepEqual(stored.snapshot.understandingBasis.reviewRef,h.row.ref);
 h.rejectNext();await assert.rejects(bindExecutionApproval(h.client,b,saved.data.ref.id,h.f.session,()=>true));assert.equal(h.postCount(),1);
});

const hooksUrl='data:text/javascript,'+encodeURIComponent(`let cursor=0,slots=[],effects=new Map(),pending=[];export function useState(v){const n=cursor++;if(!(n in slots))slots[n]=v;return[slots[n],x=>slots[n]=typeof x==='function'?x(slots[n]):x];}export function useRef(v){return slots[cursor++]??={current:v};}export function useEffect(fn,deps){const n=cursor++,old=effects.get(n);if(!old||deps.some((x,i)=>x!==old.deps[i]))pending.push(()=>{old?.clean?.();effects.set(n,{deps,clean:fn()});});}export function draw(fn){cursor=0;const tree=fn();for(const f of pending.splice(0))f();return tree;}export function unmount(){for(const e of effects.values())e.clean?.();slots=[];effects=new Map();pending=[];}`);
function find(tree:any,p:(n:any)=>boolean):any{if(Array.isArray(tree)){for(const n of tree){const v=find(n,p);if(v)return v;}return;}if(!tree||typeof tree!=='object')return;if(p(tree))return tree;return find(tree.props?.children,p);}
function text(tree:any):string{return Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');}
test('실제 준비 editor의 명시 선택→freeze→내부 GET503은 미전송 유지, 새 head 뒤 재시도 POST0·epoch 교체 접근0',async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/workspace/ExecutionPreparationEditor.tsx',import.meta.url));
 const result=await build({configFile:false,logLevel:'error',plugins:[{name:'원 실제 API 재사용',enforce:'pre',resolveId(source,importer){if(importer&&source.startsWith('.')&&source.endsWith('.ts'))return{id:pathToFileURL(resolve(dirname(importer),source)).href,external:true};}}],build:{write:false,lib:{entry,formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
 const output=Array.isArray(result)?result[0]:result;assert.ok(output&&'output'in output);const chunk=output.output.find((v:any)=>v.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 assert.ok(chunk.code.includes('file:///'),chunk.code.slice(0,1200));const code=chunk.code.replace(/(["'])(react(?:\/jsx-runtime)?)\1/g,(_m:string,_q:string,name:string)=>JSON.stringify(name==='react'?hooksUrl:import.meta.resolve(name)));
 const component=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')),hooks=await import(hooksUrl);
 for(const mode of ['SAVED','LOST','PREFLIGHT','CAS','EXACT','EXACT_ABA','EXACT_DENIED','PREP_OWNER','PREP_TRANSPORT','PREP_DISPATCH_TRANSPORT','APPROVAL_ABA','APPROVAL_PENDING','APPROVAL_LOST','APPROVAL_PARENT_IGNORED','APPROVAL_CAS','APPROVAL_OWNER','APPROVAL_TRANSPORT','APPROVAL_DISPATCH_OWNER']){const h=fixture();let b:any=api.newExecutionPreparation(h.f.confirmed as any,h.f.session);
 b.draft={roleBindingRef:h.f.binding.ref,contextBundleRef:h.f.context.ref,capabilityRef:h.f.report.ref,sourceScopes:[h.f.scope],mode:'WORK',reason:'화면에서 별도 WORK 준비'};
 let session=h.f.session,defer=false,deferred:((value:any)=>any)|null=null;const storage:any={buffers:{old:{ownerEpoch:normalInitialUnderstandingOwner(h.client,session),ownerUserId:session.user.id,ownerClientId:session.clientId,basis:{scope:h.scope,assignmentRef:h.f.confirmed.ref},stored:h.row}},read:()=>null,onChange:()=>{}};
 const approval=mode.startsWith('APPROVAL'),exact=mode.startsWith('EXACT')||approval;
 if(exact){h.rejectNext(true);h.basis.reviewRef=h.history.items.at(-1)!.ref;}
 const candidate=structuredClone(exactCandidate(h));
 let candidates=exact?[candidate]:[],onChange:()=>void=()=>{},ignoreUpdater=false,owner=true;
 const transport=h.client.transport;
 const draw=()=>hooks.draw(()=>component.ExecutionPreparationEditor({client:h.client,confirmed:h.f.confirmed,session,normalInitialReviews:storage,exactWorkCandidates:candidates,providedHumanReportRef:h.f.report.ref,buffer:b,onChange:(change:any)=>{if(ignoreUpdater)return;if(defer)deferred=change;else{b=change(b);onChange();}},owner,onAuthenticationLost:()=>assert.fail('인증 소실 아님')}));
 const leave=()=>{if(mode.endsWith('OWNER'))owner=false;else h.client.transport=async()=>assert.fail('교체 transport 호출 금지');draw();};
 const restore=()=>{owner=true;h.client.transport=transport;draw();};
 const button=(label:string)=>{const n=find(draw(),n=>n.type==='button'&&text(n).includes(label));assert.ok(n,label+': '+text(draw()).slice(-2500));assert.equal(n.props.disabled??false,false,label);n.props.onClick();};
 const until=async(check:()=>boolean)=>{const end=performance.now()+4000;while(!check()&&performance.now()<end){draw();await new Promise<void>(r=>setImmediate(r));}draw();assert.ok(check());};
 try{
  if(exact)assert.ok(!text(draw()).includes('최신 적합 판단 확인·선택'));
  if(mode==='EXACT_ABA'||mode==='EXACT_DENIED'){
   const transport=h.client.transport;
   let release:(()=>void)|undefined;
   h.client.transport=async(url,options)=>{
    if(!String(url).includes('/understanding-reviews?'))return transport(url,options);
    if(mode==='EXACT_DENIED')return Response.json({code:'FORBIDDEN'},{status:403});
    await new Promise<void>(r=>{release=r;});
    return transport(url,options);
   };
   button('선택한 적합 판단 확인');
   if(mode==='EXACT_ABA'){
    await until(()=>!!release);
    candidates=[{...candidate,reviewRef:{...candidate.reviewRef,version:3}}];draw();
    candidates=[candidate];draw();
    release!();
   }
   await until(()=>!find(draw(),n=>n.type==='button'&&text(n).includes('선택한 적합 판단 확인')).props.disabled);
   assert.equal(b.understandingSelection,undefined);assert.equal(h.calls.filter(v=>v.method==='POST').length,0);continue;
  }
  button(exact?'선택한 적합 판단 확인':'최신 적합 판단 확인·선택');await until(()=>!!b.understandingSelection);assert.equal(h.calls.filter(v=>v.method==='POST').length,0);
  button('의도 준비·입력 확인');await until(()=>!!b.pending);const command=structuredClone(b.pending);
  if(approval){
   h.base.setPolicy('REQUIRE_APPROVAL');b={...b,failure:{code:'APPROVAL_REQUIRED',status:412}};
   button('준비본 보관 승인 요청 준비');await until(()=>!!b.approval?.request);
   const request=b.approval.request;
   b={...b,approval:{...b.approval,request:{...request,details:{reason:'별도 보관만 승인',risks:{data:'자료',security:'보호',cost:'기존',interruption:'없음',unverified:'미검증'},rollback:{method:'기록 보존',limitations:'실행 없음',evidenceRefs:[]},expiresAt:new Date(Date.now()+1800000).toISOString()}}}};
   const replacement={...candidate,reviewRef:{...candidate.reviewRef,version:3}};
   if(mode==='APPROVAL_ABA')h.modes.onPolicy=()=>{candidates=[replacement];draw();candidates=[candidate];draw();};
   if(mode==='APPROVAL_PENDING')onChange=()=>{if(b.approval.request.pending){onChange=()=>{};candidates=[replacement];draw();}};
   if(mode==='APPROVAL_LOST')h.modes.loseApproval=true;
   if(mode==='APPROVAL_PARENT_IGNORED'||mode==='APPROVAL_CAS'){
    ignoreUpdater=mode==='APPROVAL_PARENT_IGNORED';
    defer=mode==='APPROVAL_CAS';
    const before=b;
    button('준비 승인 요청 명시 보관');
    if(mode==='APPROVAL_CAS'){
     const end=performance.now()+4000;
     while(!deferred&&performance.now()<end)await new Promise<void>(r=>setImmediate(r));
     assert.ok(deferred);
     assert.equal(h.calls.filter(v=>v.method==='POST').length,0,'부모 commit 전 POST 금지');
     const competing={...b,approval:{...b.approval,request:{...b.approval.request,dirty:true}}};
     b=competing;
     assert.equal((deferred as (value:any)=>any)(competing),competing);
    }
    await until(()=>text(draw()).includes('EXECUTION_PREPARATION_DISPATCH_REJECTED'));
    assert.equal(b.approval.request.pending,null);
    assert.equal(b.approval.request.uncertain,false);
    assert.equal(h.calls.filter(v=>v.method==='POST').length,0);
    if(mode==='APPROVAL_CAS')assert.equal(deferred!(before),before,'거절 뒤 지연 updater는 pending을 되살리지 않는다');
    ignoreUpdater=false;defer=false;
    button('준비 승인 요청 명시 보관');await until(()=>!!b.approval.request.resultId);
    assert.equal(h.calls.filter(v=>v.method==='POST').length,1);
    continue;
   }
   if(mode==='APPROVAL_OWNER'||mode==='APPROVAL_TRANSPORT'){
    const before=b;
    onChange=()=>{if(b.approval.request.pending){onChange=()=>{};leave();}};
    button('준비 승인 요청 명시 보관');let invalidated=false;
    await until(()=>{if(!owner||h.client.transport!==transport)invalidated=true;return invalidated&&b===before;});
    assert.equal(h.calls.filter(v=>v.method==='POST').length,0);assert.equal(b.approval.request.pending,null);
    restore();assert.ok(!text(draw()).includes('같은 준비 승인 요청 재확인'));
    button('준비 승인 요청 명시 보관');await until(()=>!!b.approval.request.resultId);
    assert.equal(h.calls.filter(v=>v.method==='POST').length,1);continue;
   }
   if(mode==='APPROVAL_DISPATCH_OWNER'){
    h.modes.loseApproval=true;h.modes.onPost=()=>{h.modes.onPost=null;leave();};
    button('준비 승인 요청 명시 보관');await until(()=>h.calls.some(v=>v.method==='POST'));
    await new Promise<void>(r=>setImmediate(r));
    const issued=b.approval.request.pending;assert.ok(issued);assert.equal(b.approval.request.uncertain,true);
    restore();button('같은 준비 승인 요청 재확인');await until(()=>!!b.approval.request.resultId);
    const posts=h.calls.filter(v=>v.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0]!.body,posts[1]!.body);assert.deepEqual(JSON.parse(posts[0]!.body!),issued);continue;
   }
   button('준비 승인 요청 명시 보관');
   await until(()=>mode==='APPROVAL_PENDING'?text(draw()).includes('EXECUTION_PREPARATION_DISPATCH_REJECTED'):!!b.approval.request.failure);
   if(mode==='APPROVAL_LOST'){
    assert.equal(b.approval.request.uncertain,true);
    const issued=structuredClone(b.approval.request.pending);
    candidates=[replacement];draw();h.rejectNext(true);
    button('같은 준비 승인 요청 재확인');await until(()=>!!b.approval.request.resultId);
    const posts=h.calls.filter(v=>v.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0]!.body,posts[1]!.body);
    assert.deepEqual(JSON.parse(posts[0]!.body!),issued);assert.deepEqual(issued.payload.candidatePayload.understandingReviewRef,candidate.reviewRef);
   }else{
    assert.equal(h.calls.filter(v=>v.method==='POST').length,0);assert.equal(b.approval.request.pending,null);assert.equal(b.approval.request.uncertain,false);
   }
   continue;
  }
  const ack=find(draw(),n=>n.props?.['aria-label']==='준비 보관 확인');ack.props.onChange({target:{checked:true}});draw();
  if(mode==='PREP_OWNER'||mode==='PREP_TRANSPORT'){
   const before=b;
   onChange=()=>{if(b.uncertain){onChange=()=>{};leave();}};
   button('준비본 보관');let invalidated=false;
   await until(()=>{if(!owner||h.client.transport!==transport)invalidated=true;return invalidated&&b===before;});
   assert.equal(h.calls.filter(v=>v.method==='POST').length,0);assert.equal(b.uncertain,false);
   restore();assert.ok(!text(draw()).includes('같은 준비 명령 재확인'));assert.deepEqual(b.pending,command);continue;
  }
  if(mode==='PREP_DISPATCH_TRANSPORT'){
   h.lose();h.modes.onPost=()=>{h.modes.onPost=null;leave();};
   button('준비본 보관');await until(()=>h.calls.some(v=>v.method==='POST'));
   await new Promise<void>(r=>setImmediate(r));
   assert.equal(b.uncertain,true);assert.deepEqual(b.pending,command);
   restore();find(draw(),n=>n.props?.['aria-label']==='준비 보관 확인').props.onChange({target:{checked:true}});
   button('같은 준비 명령 재확인');await until(()=>!!b.result);
   const posts=h.calls.filter(v=>v.method==='POST');assert.equal(posts.length,2);assert.equal(posts[0]!.body,posts[1]!.body);assert.equal(h.postCount(),1);continue;
  }
  if(mode==='CAS'){defer=true;button('준비본 보관');await until(()=>!!deferred);assert.equal(h.postCount(),0);assert.equal(b.uncertain,false);const replacement={...b,dirty:true};b=replacement;draw();defer=false;assert.equal(deferred!(b),replacement);await until(()=>text(draw()).includes('EXECUTION_PREPARATION_DISPATCH_REJECTED'));assert.equal(b,replacement);assert.equal(b.uncertain,false);assert.equal(h.postCount(),0);assert.ok(!text(draw()).includes('같은 준비 명령 재확인'));continue;}
  if(mode==='SAVED'||mode==='EXACT'){button('준비본 보관');await until(()=>!!b.result);assert.equal(h.postCount(),1);assert.ok(text(draw()).includes('정착 검토'));if(exact){assert.deepEqual(command.payload.understandingReviewRef,candidate.reviewRef);assert.deepEqual(b.result.snapshot.understandingBasis.reviewRef,candidate.reviewRef);assert.deepEqual(JSON.parse(h.calls.find(v=>v.method==='POST')!.body!).payload.understandingReviewRef,candidate.reviewRef);}continue;}
  if(mode==='LOST'){h.lose();button('준비본 보관');await until(()=>!!b.failure);assert.equal(b.uncertain,true);assert.equal(h.postCount(),1);const count=h.calls.length;session={...session,csrfToken:'b'.repeat(43)};assert.ok(!text(draw()).includes(command.commandId));assert.ok(!text(draw()).includes(h.row.ref.id));assert.equal(h.calls.length,count);assert.ok(b.pending&&b.uncertain);continue;}
  h.modes.historyFail=true;button('준비본 보관');await until(()=>text(draw()).includes('UNDERSTANDING_HISTORY_UNAVAILABLE'));assert.equal(b.uncertain,false);assert.deepEqual(b.pending,command);assert.equal(h.postCount(),0);
  h.modes.historyFail=false;h.rejectNext();button('준비본 보관');await until(()=>text(draw()).includes('WORK_PREPARATION_UNDERSTANDING_CHANGED'));assert.equal(h.postCount(),0);assert.equal(b.uncertain,false);assert.deepEqual(b.pending,command);
  const calls=h.calls.length;session={...session,csrfToken:'b'.repeat(43)};assert.ok(!text(draw()).includes(command.commandId));assert.ok(!text(draw()).includes(h.row.ref.id));assert.equal(h.calls.length,calls);
 }finally{hooks.unmount();}
 }
});
