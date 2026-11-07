import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {AuthFailure,type AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readAssignmentDraftInput} from '../../../apps/server/modules/assignments/assignment-input.ts';
import {readAssignmentContentReview,readAssignmentConfirmation,assignmentContentCriteria} from '../../../apps/server/modules/assignments/assignment-confirmation-input.ts';
const id=(n:number)=>`fa000000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),actorId=id(2),clientId=id(3),sessionId=id(4),pastActor=id(5),pastClient=id(6),token='s'.repeat(43),at=new Date('2026-10-29T00:00:00.000Z'),marker='public-driver-private-detail';
const clone=<T>(v:T):T=>structuredClone(v),hash=(v:unknown)=>contentHash(canonicalJson(v));
async function collector(){const u=new URL('../../../apps/server/modules/backups/assignment-inventory.ts',import.meta.url),m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.collectAssignmentInventory,'function','임무 이력 수집 미구현');return m.collectAssignmentInventory as(a:AccessRepository,t:string,v:unknown,s:AbortSignal)=>Promise<any>;}
const rejected=(status:number)=>(e:any)=>e instanceof AuthFailure&&e.statusCode===status&&!e.cause&&!JSON.stringify(e).includes(marker)&&!String(e.stack).includes(marker)&&!/SELECT|blobs\//.test(e.message);
function fixture(){
 const input={projectId:pid,limits:{metadataBytes:16777216,inputBytes:1048576,fileCount:10,deadlineMs:10000}},abort=new AbortController(),ref=(n:number)=>({id:id(n),version:1,contentHash:String(n%10).repeat(64)}),policy=ref(20);
 const tables:Record<string,any[]>={assignment_drafts:[],assignment_draft_versions:[],assignment_content_reviews:[],assignment_versions:[],commands:[],authorization_receipts:[],audit_events:[]},t=(name:string)=>tables[name]!;let serial=100;
 const next=()=>id(serial++),time=()=>new Date(at.getTime()-10000-serial).toISOString();
 const definition:any={taskRef:{planRef:ref(21),applicationRef:ref(22),taskCode:'FN09',nodeId:'implement'},baselineRefs:[ref(21),ref(22),ref(23)],purpose:'임무 목적',goal:'내용 완성',ownerRole:'개발',integrationResponsibility:'별도 검수',inputs:['확정 설계'],outputs:['구현'],acceptanceCriteria:['검수'],verificationRequirements:['시험'],included:['범위'],excluded:['운영'],requiredCapabilities:['CODE'],allowedScopes:[{sourceRootRef:ref(24),mappingRef:null,observationRef:ref(25),baselineRef:ref(26),targets:[{relativePath:'src/unit.ts',kind:'FILE',access:'WRITE',recursive:false}]}],environmentRef:ref(27),budgetRef:ref(28),recordingPolicyRef:ref(29),parentAssignmentRef:null};
 function data(e:any){return{ref:clone(e.ref),status:e.kind==='draft'?'ASSIGNMENT_DRAFT_STORED':e.kind==='review'?'ASSIGNMENT_CONTENT_REVIEWED':'ASSIGNMENT_CONTENT_CONFIRMED',...(e.kind==='confirmation'?{confirmationId:e.row.confirmation_id}:{}),snapshot:clone(e.snapshot)};}
 function original(e:any){const c=e.c;return{schemaVersion:1,projectId:pid,commandId:c.command_id,clientId:c.client_id,controlGeneration:Number(c.control_generation),operation:c.operation,targetId:e.kind==='draft'?(e.ref.version===1?null:e.ref.id):e.input.draftRef.id,expectedVersion:e.kind==='draft'?e.ref.version-1:e.input.draftRef.version,baselineRefs:[],approvalRef:null,payload:e.input};}
 function seal(e:any){e.ref.contentHash=hash(e.snapshot);e.row.content_hash=e.ref.contentHash;e.c.request_hash=hash(original(e));e.c.result_ref.data=data(e);e.c.result_ref.commandId=e.c.command_id;e.audit.target_ref=clone(e.ref);const digest=hash({projectId:pid,actorId:e.c.actor_id,clientId:e.c.client_id,controlGeneration:Number(e.c.control_generation),requestHash:e.c.request_hash,policyRef:e.c.policy_ref,targetRef:e.ref});e.ar.scope_digest=digest;e.audit.scope_digest=digest;}
 function evidence(kind:string,row:any,snapshot:any,rawInput:any,reference:any,who=pastActor){
  const operation=kind==='draft'?'prepareAssignment':kind==='review'?'reviewAssignmentContent':'confirmAssignment',reason=kind==='draft'?'EXPLICIT_ASSIGNMENT_DRAFT_ONLY':kind==='review'?'EXPLICIT_ASSIGNMENT_CONTENT_REVIEW':'EXPLICIT_ASSIGNMENT_CONTENT_ONLY';
  const c:any={id:next(),command_id:next(),scope_kind:'PROJECT',scope_id:pid,project_id:pid,state:'APPLIED',operation,actor_id:who,client_id:pastClient,control_generation:2,expected_version:kind==='draft'?reference.version-1:rawInput.draftRef.version,policy_ref:policy,result_ref:null,authorization_receipt_id:next(),approval_consumption_id:null,payload_ref:null,completed_at:row.created_at,operation_id:next(),request_hash:''};
  row.created_by=who;row.client_id=pastClient;row.command_id=c.id;
  c.result_ref={operationId:c.operation_id,commandId:c.command_id,projectId:pid,status:'APPLIED',targetId:reference.id,version:reference.version,data:null,evidenceRefs:[],warnings:[],serverReceivedAt:row.created_at};
  const ar:any={id:c.authorization_receipt_id,scope_kind:'PROJECT',scope_id:pid,command_id:c.id,subject_ref:{kind:'HUMAN',userId:who,clientId:pastClient},policy_ref:policy,scope_digest:'',approval_decision_ref:null,authorized_at:row.created_at};
  const audit:any={project_id:pid,server_sequence:t('audit_events').length+1,event_id:next(),actor_ref:{kind:'HUMAN',userId:who},client_ref:pastClient,command_id:c.id,operation_id:c.operation_id,target_ref:reference,policy_ref:policy,approval_ref:null,outcome:'APPLIED',reason_code:reason,scope_digest:'',recorded_at:row.created_at,source_kind:'HUMAN_COMMAND',correction_of:null};
  const e={kind,row,snapshot,input:rawInput,ref:reference,c,ar,audit};seal(e);t('commands').push(c);t('authorization_receipts').push(ar);t('audit_events').push(audit);return e;
 }
 function draft(prior:any=null,patch:any={},who=pastActor){const reference={id:prior?prior.ref.id:next(),version:prior?prior.ref.version+1:1,contentHash:''},rawInput={baseRef:prior?clone(prior.ref):null,definition:{...clone(definition),...clone(patch)},reason:'초안 '+reference.version},analysis=readAssignmentDraftInput(rawInput),basis={planRef:rawInput.definition.taskRef.planRef,applicationRef:rawInput.definition.taskRef.applicationRef,designRef:ref(23),taskCode:rawInput.definition.taskRef.taskCode,nodeId:rawInput.definition.taskRef.nodeId,taskCardHash:hash('외부 작업카드')},snapshot={definition:rawInput.definition,reason:rawInput.reason,previousRef:rawInput.baseRef,basis,readinessIssues:[...analysis.readinessIssues,...(rawInput.definition.baselineRefs.some((r:any)=>canonicalJson(r)===canonicalJson(basis.designRef))?[]:[{code:'BASELINE_REFERENCE_MISSING',location:'baselineRefs'}])],status:'DRAFT',ready:false,executionAuthorized:false,dispatchPerformed:false};
  const row={project_id:pid,draft_id:reference.id,version:reference.version,content_hash:'',version_json:snapshot,created_by:'',client_id:'',command_id:'',created_at:time()},e=evidence('draft',row,snapshot,rawInput,reference,who);t('assignment_draft_versions').push(row);if(prior){const head=t('assignment_drafts').find(h=>h.id===reference.id);head.head_version=reference.version;head.updated_at=row.created_at;}else t('assignment_drafts').push({project_id:pid,id:reference.id,head_version:1,created_by:who,client_id:pastClient,created_at:row.created_at,updated_at:row.created_at});return e;}
 function review(d:any,outcome='ACCEPTED',who=pastActor){const reference={id:next(),version:1,contentHash:''},rawInput={draftRef:clone(d.ref),criteriaVersion:1,items:assignmentContentCriteria.map(criterionId=>({criterionId,outcome,reason:'내용 검토',evidenceRefs:[]})),outcome,reason:'검토 이유'},created=time();readAssignmentContentReview(rawInput);const snapshot={...rawInput,reviewedBy:{kind:'HUMAN',userId:who},reviewedAt:created,independence:'NOT_CLAIMED'},row={project_id:pid,review_id:reference.id,draft_id:d.ref.id,draft_version:d.ref.version,draft_hash:d.ref.contentHash,content_hash:'',review_json:snapshot,created_by:'',client_id:'',command_id:'',created_at:created},e=evidence('review',row,snapshot,rawInput,reference,who);t('assignment_content_reviews').push(row);return e;}
 function confirmation(d:any,reviews:any[]){const reference={id:d.ref.id,version:d.ref.version,contentHash:''},rawInput={draftRef:clone(d.ref),reviewRefs:reviews.map(r=>clone(r.ref)),reason:'별도 내용 확정',acknowledged:true},created=time();readAssignmentConfirmation(rawInput);const snapshot={draftRef:rawInput.draftRef,definition:clone(d.snapshot.definition),reviewRefs:rawInput.reviewRefs,reason:rawInput.reason,confirmedBy:{kind:'HUMAN',userId:pastActor},confirmedAt:created,contentConfirmed:true,readinessIssues:clone(d.snapshot.readinessIssues),ready:false,executionAuthorized:false,dispatchPerformed:false},row={project_id:pid,assignment_id:reference.id,version:reference.version,content_hash:'',version_json:snapshot,created_by:'',client_id:'',command_id:'',confirmation_id:next(),created_at:created},e=evidence('confirmation',row,snapshot,rawInput,reference);t('assignment_versions').push(row);return e;}
 const d1=draft(),r1=review(d1),c1=confirmation(d1,[r1]),child=draft(null,{parentAssignmentRef:clone(c1.ref),taskRef:{...definition.taskRef,taskCode:'CHILD'},allowedScopes:[],goal:''}),later=review(d1,'REWORK',id(8)),d2=draft(d1,{purpose:'',allowedScopes:[]}),d3=draft(d2),r3=review(d3,'ACCEPTED',id(8)),c3=confirmation(d3,[r3]);
 const state={auth:0,rc:0,rr:0,releases:0,rollbacks:0,owner:'OWNER',archived:false,changed:'',failTable:'',duplicateTable:'',overRows:false,bigRow:false,failBegin:false,failRollback:false,cancelCommit:false,sessionMs:5000,beforeAuth:null as null|((phase:number)=>void),afterCommit:null as null|((phase:number)=>void),afterQuery:null as null|(()=>void)};
 const trace:Array<{scope:string;sql:string;values:unknown[]}>=[],releaseErrors:unknown[]=[];
 async function query(dbScope:string,sql:string,values:unknown[]=[]):Promise<any>{
  trace.push({scope:dbScope,sql,values:clone(values)});assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|GRANT)\b/i.test(sql),'쓰기0');if(/^BEGIN/.test(sql)){assert.equal(dbScope,'RR');assert(/REPEATABLE READ READ ONLY/.test(sql));if(state.failBegin)throw Error(marker);return{rows:[]};}if(/^ROLLBACK/.test(sql)){state.rollbacks++;if(state.failRollback)throw Error(marker);return{rows:[]};}assert(!/^COMMIT/.test(sql));
  if(/set_config/.test(sql)){assert(/statement_timeout/.test(sql));assert(Number(values[0])>0&&Number(values[0])<=input.limits.deadlineMs);return{rows:[]};}
  if(/current_setting|clock_timestamp|pg_current_snapshot/.test(sql)&&!/FROM anvil\./.test(sql))return{rows:[{isolation:dbScope==='RR'?'repeatable read':'read committed',read_only:dbScope==='RR'?'on':'off',snapshot:'8:80:',at}]};
  if(/FROM anvil\.projects\b/.test(sql)){assert(values.includes(pid)&&values.includes(actorId));return{rows:[{id:pid,participation:state.owner,archived_at:state.archived?at:null}]};}
  const table=/FROM anvil\.([a-z_]+)/.exec(sql)?.[1];assert(table&&Object.hasOwn(tables,table),'정확 결과/명령 증빙만 조회');assert.equal(dbScope,'RR');assert(values.includes(pid));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(sql));assert(!/\bOFFSET\b/i.test(sql));assert(/CASE\s+WHEN/i.test(sql)&&/octet_length/.test(sql));assert(/LIMIT 200/.test(sql));
  if(state.failTable===table)throw Object.assign(Error(marker),{cause:marker});let rows=clone(t(table));const selected=values.flatMap(v=>Array.isArray(v)?v:[]);
  if(!['assignment_drafts','assignment_draft_versions','assignment_content_reviews','assignment_versions'].includes(table)){assert(selected.length>0&&selected.length<=200);const by=table==='audit_events'?'command_id':'id';rows=rows.filter(r=>selected.includes(r[by]));}if(table==='commands')assert(/scope_kind\s*=\s*'PROJECT'/.test(sql)&&/scope_id\s*=/.test(sql)&&/operation\s+IN/.test(sql));
  const key=table==='audit_events'?'event_id':table==='assignment_draft_versions'?'draft_id':table==='assignment_versions'?'assignment_id':table==='assignment_content_reviews'?'review_id':'id';rows.sort((a,b)=>a[key]<b[key]?-1:a[key]>b[key]?1:Number(a.version??0)-Number(b.version??0));const cursors=values.slice(1,-1).filter(v=>!Array.isArray(v));if(cursors.length&&cursors[0]!==null)rows=rows.filter(r=>r[key]>(cursors[0]as string)||['assignment_draft_versions','assignment_versions'].includes(table)&&r[key]===cursors[0]&&Number(r.version)>Number(cursors[1]));rows=rows.slice(0,200);
  if(state.overRows&&rows.length)rows=Array.from({length:201},()=>clone(rows[0]));if(state.duplicateTable===table&&rows.length)rows.splice(1,0,clone(rows[0]));
  const cap=Number(values.at(-1)),result=rows.map(r=>{const fields=/WITH inventory_row AS \(SELECT ([\s\S]+?) FROM anvil/.exec(sql)![1]!.split(',').map(k=>k.trim().slice(2)),text=JSON.stringify(Object.fromEntries(fields.map(k=>[k,r[k]]))),row_bytes=state.bigRow?cap+1:Buffer.byteLength(text);return{inventory_data:row_bytes>cap?null:JSON.parse(text),row_bytes};});state.afterQuery?.();return{rows:result,rowCount:result.length};
 }
 const access={pool:{async connect(){assert.equal(state.rc,0);assert.equal(state.rr,0);state.rr++;return{query:(s:string,v?:unknown[])=>query('RR',s,v),release(error?:unknown){assert.equal(state.rr,1);state.rr--;state.releases++;releaseErrors.push(error);}};}},async authenticated(given:string,csrf:string|null,body:any){assert.equal(given,token);assert.equal(csrf,null);assert.equal(state.rr,0);assert.equal(state.rc,0);const phase=++state.auth;state.beforeAuth?.(phase);state.rc++;const actor:any={actorId,clientId,credentialGeneration:1,serverOwner:false,reauthUntil:null,authSession:{id:sessionId,idleExpiresAt:new Date(at.getTime()+state.sessionMs).toISOString(),absoluteExpiresAt:new Date(at.getTime()+600000).toISOString()}};if(phase===2&&state.changed){if(state.changed==='session')actor.authSession.id=id(99);else actor[state.changed]=state.changed==='credentialGeneration'?2:id(99);}
  try{const r=await body({query:(s:string,v?:unknown[])=>query('RC',s,v)},actor);state.rc--;if(phase===2&&state.cancelCommit)abort.abort();state.afterCommit?.(phase);return r;}finally{state.rc=0;}}
 }as unknown as AccessRepository;
 return{input,abort,access,tables,t,state,trace,releaseErrors,d1,d2,d3,r1,r3,c1,c3,child,later,draft,review,confirmation,seal,ref,run:async()=>{const fn=await collector();return fn(access,token,input,abort.signal);}};
}

// 기존 root/초안 역사 메모리 fixture에 실제 HUMAN 내용 producer만 연결한다.
// 운영 auth/parent current 검사는 drafts port 대역이며, producer/receipt와 collector는 실제 함수다.
import {ProjectAssignmentConfirmations} from '../../../apps/server/modules/assignments/project-assignment-confirmations.ts';
import {randomUUID} from 'node:crypto';
async function produced(){
 const f=fixture(),d=f.draft(null,{parentAssignmentRef:clone(f.c1.ref),taskRef:{...clone(f.d1.snapshot.definition.taskRef),taskCode:'CHILD'}});
 const actor:any={actorId:pastActor,clientId:pastClient,credentialGeneration:1,serverOwner:false,reauthUntil:null};
 const find=(project:string,ref:any)=>{assert.equal(project,pid);const r=f.t('assignment_draft_versions').find(r=>r.draft_id===ref.id&&r.version===ref.version);assert(r);assert.equal(r.content_hash,ref.contentHash);return {projectId:pid,ref:clone(ref),snapshot:clone(r.version_json),headVersion:f.t('assignment_drafts').find(h=>h.id===ref.id).head_version};};
 const store=new ProjectAssignmentConfirmations({read:async(_db:any,_a:any,p:string,i:string,v:number)=>{const r=f.t('assignment_draft_versions').find(r=>r.draft_id===i&&r.version===v);assert(r);return find(p,{id:i,version:v,contentHash:r.content_hash});},currentForContent:async(_db:any,_a:any,p:string,r:any)=>find(p,r),current:async()=>{throw new AuthFailure('ASSIGNMENT_CHILD_DRAFT_ONLY',412);}} as any);
 const joined=(r:any)=>{const c=f.t('commands').find(c=>c.id===r.command_id),a=f.t('audit_events').find(a=>a.command_id===r.command_id);return {...clone(r),result_ref:clone(c.result_ref),operation:c.operation,state:c.state,expected_version:c.expected_version,command_actor:c.actor_id,command_client:c.client_id,server_sequence:a.server_sequence,draft_author:pastActor};};
 const db:any={query:async(sql:string,p:any[]=[])=>{
  if(sql==='SELECT transaction_timestamp() AS at')return{rows:[{at}]};
  if(sql.startsWith('SELECT set_config'))return{rows:[]};
  if(sql.startsWith('INSERT INTO anvil.commands')){f.t('commands').push({id:p[0],command_id:p[5],scope_kind:'PROJECT',scope_id:p[1],project_id:p[1],state:'APPLIED',operation:p[4],actor_id:p[2],client_id:p[3],control_generation:p[11],expected_version:p[10],policy_ref:JSON.parse(p[12]),result_ref:JSON.parse(p[14]),authorization_receipt_id:p[8],approval_consumption_id:p[9],payload_ref:p[13],received_at:at.toISOString(),completed_at:at.toISOString(),operation_id:p[7],request_hash:p[6]});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){f.t('authorization_receipts').push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6],authorized_at:at.toISOString()});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){f.t('audit_events').push({project_id:p[0],server_sequence:Math.max(...f.t('audit_events').map(a=>a.server_sequence))+1,event_id:p[1],actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),approval_ref:p[8],outcome:'APPLIED',reason_code:p[9],scope_digest:p[10],recorded_at:at.toISOString(),source_kind:'HUMAN_COMMAND',correction_of:null});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.assignment_content_reviews')){f.t('assignment_content_reviews').push({project_id:p[0],review_id:p[1],draft_id:p[2],draft_version:p[3],draft_hash:p[4],content_hash:p[5],review_json:JSON.parse(p[6]),created_by:p[7],client_id:p[8],command_id:p[9],created_at:at.toISOString()});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.assignment_versions')){f.t('assignment_versions').push({project_id:p[0],assignment_id:p[1],version:p[2],content_hash:p[3],version_json:JSON.parse(p[4]),created_by:p[5],client_id:p[6],command_id:p[7],confirmation_id:p[8],created_at:at.toISOString()});return{rows:[]};}
  if(sql.startsWith('SELECT count(*) total')){const rs=f.t('assignment_content_reviews').filter(r=>r.project_id===p[0]&&r.draft_id===p[1]&&r.draft_version===p[2]);return{rows:[{total:rs.length,invalid:rs.filter(r=>!f.t('commands').some(c=>c.id===r.command_id)||f.t('authorization_receipts').filter(a=>a.command_id===r.command_id).length!==1||f.t('audit_events').filter(a=>a.command_id===r.command_id).length!==1).length}]};}
  if(sql.startsWith('SELECT to_jsonb(c)')){const c=f.t('commands').find(c=>c.project_id===p[0]&&c.id===p[1]);return{rows:c?[{command:clone(c),receipts:clone(f.t('authorization_receipts').filter(a=>a.command_id===c.id)),audits:clone(f.t('audit_events').filter(a=>a.command_id===c.id))}]:[]};}
  if(sql.includes('FROM anvil.assignment_content_reviews r')){const rs=f.t('assignment_content_reviews').filter(r=>r.project_id===p[0]&&(sql.includes('r.review_id=$2')?r.review_id===p[1]:r.draft_id===p[1]&&r.draft_version===p[2]));return{rows:rs.map(joined).sort((a,b)=>b.server_sequence-a.server_sequence).slice(0,201)};}
  if(sql.includes('FROM anvil.assignment_versions v'))return{rows:f.t('assignment_versions').filter(r=>r.project_id===p[0]&&r.assignment_id===p[1]&&r.version===p[2]).map(joined)};
  throw Error('UNMODELLED_PRODUCER_SQL');
 }};
 const command=(operation:string,payload:any):any=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:pastClient,controlGeneration:2,operation,targetId:d.ref.id,expectedVersion:d.ref.version,baselineRefs:[],approvalRef:null,payload});
 const reviewInput={draftRef:clone(d.ref),criteriaVersion:1,items:assignmentContentCriteria.map(criterionId=>({criterionId,outcome:'ACCEPTED',reason:'실제 HUMAN 내용 검토',evidenceRefs:[]})),outcome:'ACCEPTED',reason:'실행을 허가하지 않는 내용 검토'};
 const review:any=await store.reviewContent(db,actor,command('reviewAssignmentContent',reviewInput),f.ref(20));
 const confirmation:any=await store.confirmContent(db,actor,command('confirmAssignment',{draftRef:clone(d.ref),reviewRefs:[review.data.ref],reason:'별도 내용 확정',acknowledged:true}),f.ref(20));
 const rr=f.t('assignment_content_reviews').find(r=>r.review_id===review.data.ref.id)!,cr=f.t('assignment_versions').find(r=>r.assignment_id===d.ref.id)!;
 return{...f,d,store,db,actor,review,confirmation,rr,cr};
}

test('실제 HUMAN child producer의 원검토·별도확정을 동일 inventory에 보존한다',async()=>{
 const f=await produced(),r=await f.run();
 const review=r.reviews.find((v:any)=>v.ref.id===f.review.data.ref.id),confirmation=r.confirmations.find((v:any)=>v.ref.id===f.d.ref.id);
 assert(review);assert(confirmation);assert.deepEqual(review.ref,f.review.data.ref);assert.deepEqual(confirmation.ref,f.confirmation.data.ref);
 assert.deepEqual(review.snapshot,{...f.review.data.snapshot,reviewedBy:{kind:'HUMAN'}});assert.deepEqual(confirmation.snapshot,{...f.confirmation.data.snapshot,confirmedBy:{kind:'HUMAN'}});
 assert.equal(review.ref.contentHash,hash(f.rr.review_json));assert.equal(confirmation.ref.contentHash,hash(f.cr.version_json));
 for(const v of [review,confirmation]){const {projectionHash,...body}=v;assert.equal(projectionHash,hash(body));}
 assert.equal(confirmation.snapshot.contentConfirmed,true);for(const k of ['ready','executionAuthorized','dispatchPerformed','restorable','fullProjectCoverage'])assert.equal(r[k],false);
 assert.equal(r.draftVersions.length,5);assert.equal(r.reviews.length,4);assert.equal(r.confirmations.length,3);assert.equal(f.state.rr,0);assert.equal(f.state.releases,1);
});


test('child 내용은 부모 후속개정 뒤에도 당시 exact parent fullref와 원hash를 보존한다',async()=>{
 const f=await produced(),before=clone(f.cr.version_json),original=clone(f.confirmation.data.ref);
 f.draft(f.d3,{goal:'부모의 후속 개정'});
 const r=await f.run(),c=r.confirmations.find((v:any)=>v.ref.id===f.d.ref.id);
 assert.deepEqual(c.ref,original);assert.deepEqual(c.snapshot.definition.parentAssignmentRef,f.c1.ref);assert.equal(c.snapshot.definition.goal,before.definition.goal);
 assert.equal(r.parentCurrentnessVerification,'NOT_PERFORMED');assert.equal(r.sourceScopeContainment,'EXACT_STORED_PARENT_SUBSET_ONLY');
 assert.equal(r.draftVersions.find((v:any)=>v.ref.id===f.d.ref.id).snapshot.definition.parentAssignmentRef.contentHash,f.c1.ref.contentHash);
});

test('child 원문·선택검토·원command·receipt·audit 손상은 성공/부분배열로 숨기지 않는다',async()=>{
 for(const mode of ['reviewMissing','parentMissing','commandMissing','receiptMissing','auditMissing','auditDuplicate','requestHash','reviewHash','confirmationHash','draftTuple','otherProject','selectedReview','scopeDigest']){
  const f=await produced(),command=f.t('commands').find(c=>c.id===f.cr.command_id)!;
  if(mode==='reviewMissing')f.tables.assignment_content_reviews=f.t('assignment_content_reviews').filter(r=>r!==f.rr);
  if(mode==='parentMissing')f.tables.assignment_versions=f.t('assignment_versions').filter(r=>r!==f.c1.row);
  if(mode==='commandMissing')f.tables.commands=f.t('commands').filter(c=>c!==command);
  if(mode==='receiptMissing')f.tables.authorization_receipts=f.t('authorization_receipts').filter(a=>a.command_id!==command.id);
  if(mode==='auditMissing')f.tables.audit_events=f.t('audit_events').filter(a=>a.command_id!==f.rr.command_id);
  if(mode==='auditDuplicate'){const a=f.t('audit_events').find(a=>a.command_id===command.id)!;f.t('audit_events').push({...clone(a),event_id:id(9999),server_sequence:999});}
  if(mode==='requestHash')command.request_hash='0'.repeat(64);
  if(mode==='reviewHash')f.rr.content_hash='0'.repeat(64);
  if(mode==='confirmationHash')f.cr.content_hash='0'.repeat(64);
  if(mode==='draftTuple')f.rr.draft_hash='0'.repeat(64);
  if(mode==='otherProject')f.cr.project_id=id(99);
  if(mode==='selectedReview')f.cr.version_json.reviewRefs=[f.r3.ref];
  if(mode==='scopeDigest')f.t('authorization_receipts').find(a=>a.command_id===command.id)!.scope_digest='0'.repeat(64);
  await assert.rejects(f.run(),rejected(503));assert.equal(f.state.rr,0);assert.equal(f.state.releases,1);
 }
});

test('child 손자·부모교체·부모 fullhash·부분범위 확장은 원문증빙이 정합해도 거절한다',async()=>{
 for(const mode of ['grandchild','reparent','parentHash','scope','capability','environment']){
  const f=await produced();
  if(mode==='grandchild')f.draft(null,{parentAssignmentRef:clone(f.confirmation.data.ref)});
  if(mode==='reparent')f.draft(f.d,{parentAssignmentRef:clone(f.c3.ref)});
  if(mode==='parentHash')f.draft(null,{parentAssignmentRef:{...clone(f.c1.ref),contentHash:'0'.repeat(64)}});
  if(mode==='scope'){const scopes=clone(f.d.snapshot.definition.allowedScopes);scopes[0].targets[0].relativePath='src/outside.ts';f.draft(null,{parentAssignmentRef:clone(f.c1.ref),allowedScopes:scopes});}
  if(mode==='capability')f.draft(null,{parentAssignmentRef:clone(f.c1.ref),requiredCapabilities:['UNGRANTED']});
  if(mode==='environment')f.draft(null,{parentAssignmentRef:clone(f.c1.ref),environmentRef:f.ref(99)});
  await assert.rejects(f.run(),rejected(503));assert.equal(f.state.rr,0);
 }
});

test('child 새성공은 현재OWNER·유한metadata·완료뒤취소 보호를 바꾸지 않는다',async()=>{
 for(const mode of ['owner','limit','cancel']){
  const f=await produced();if(mode==='owner')f.state.owner='VIEWER';if(mode==='limit')f.input.limits.metadataBytes=1;if(mode==='cancel')f.state.cancelCommit=true;
  await assert.rejects(f.run(),rejected(mode==='owner'?404:mode==='limit'?413:409));assert.equal(f.state.rr,0);
 }
});
