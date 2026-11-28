import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import type {AccessRepository,AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';
import {collectDocumentBodySnapshot} from '../../../apps/server/modules/backups/full-backup-snapshot-source.ts';
import {verifyDocumentBodyHistory} from '../../../apps/server/modules/backups/full-backup-history-verification.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>`b2000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pinned=(n:number)=>({id:id(n),version:1,contentHash:'b'.repeat(64)});
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const projectId=id(1),documentId=id(2),bodyId=id(3),actorId=id(4),clientId=id(5),sessionId=id(6);
const at='2026-11-28T00:00:00.000Z';
const bytes=Buffer.from('공개 합성 문서');
const bodyRef={artifactId:bodyId,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'};
const standardRef=pinned(101);
const definition={formCode:'AF02',name:'설계서',purpose:'공개 합성 양식',scope:'SYSTEM',authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'사용자',
 requiredInputs:[],items:[],authoringStandardRef:standardRef};
const formRef={id:id(7),version:1,contentHash:hash(definition)};
const systemForm={id:formRef.id,scope:'SYSTEM',owner_user_id:null,project_id:null,form_code:definition.formCode,version:formRef.version,
 definition_json:definition,content_hash:formRef.contentHash,authoring_standard_id:standardRef.id,authoring_standard_version:standardRef.version,
 authoring_standard_hash:standardRef.contentHash,authoring_standard_ref:standardRef,created_by:null,created_at:at};
const standard={id:standardRef.id,version:standardRef.version,content_hash:standardRef.contentHash,created_at:at};
const content={body:bodyRef,attachments:[],sections:[],sourceRefs:[]};
const ref={id:documentId,version:1,contentHash:hash({title:'합성',formRef,stageNodeRef:null,content})};
const original={project_id:projectId,document_id:documentId,version:1,form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,
 stage_ref_json:null,body_artifact_id:bodyId,title:'합성',content_json:content,source_refs_json:[],content_hash:ref.contentHash,sections_json:[],
 author_ref_json:{kind:'HUMAN',userId:actorId},validation_json:{validForConfirmation:true,issues:[],formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'},reason:'합성',client_id:clientId,command_id:id(8),created_at:at};
const artifact={id:bodyId,project_id:projectId,bytes:bytes.length,content_hash:bodyRef.contentHash,
 media_type:bodyRef.mediaType,state:'READY',inspection_json:inspectArtifact(bytes)};
const request={schemaVersion:1,projectId,commandId:id(81),clientId,controlGeneration:1,operation:'saveDocumentDraft',
 targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,
 payload:{title:original.title,formRef,stageNodeRef:null,content,reason:original.reason,importCandidateRef:null}};
const requestHash=hash(request),policyRef=pinned(82);
const scopeDigest=hash({projectId,actorId,clientId,controlGeneration:1,requestHash,policyRef,targetRef:ref});
const command={id:original.command_id,project_id:projectId,draft_id:null,scope_kind:'PROJECT',scope_id:projectId,
 actor_id:actorId,client_id:clientId,operation:request.operation,command_id:request.commandId,request_hash:requestHash,
 operation_id:id(83),state:'APPLIED',authorization_receipt_id:id(84),approval_consumption_id:null,
 expected_version:0,control_generation:1,policy_ref:policyRef,payload_ref:null,received_at:at,completed_at:at,
 result_ref:{operationId:id(83),commandId:request.commandId,projectId,status:'APPLIED',targetId:ref.id,version:ref.version,
  data:{ref,status:'DRAFT',validation:original.validation_json,stageNodeRef:null,stageBinding:null,importCandidateRef:null,proposalRef:null},
  evidenceRefs:[],warnings:[],serverReceivedAt:at}};
const receipt={id:command.authorization_receipt_id,scope_kind:'PROJECT',scope_id:projectId,command_id:command.id,
 subject_ref:{kind:'HUMAN',userId:actorId,clientId},policy_ref:policyRef,scope_digest:scopeDigest,approval_decision_ref:null,authorized_at:at};
const audit={project_id:projectId,server_sequence:1,event_id:id(85),actor_ref:original.author_ref_json,client_ref:clientId,
 command_id:command.id,operation_id:command.operation_id,target_ref:ref,policy_ref:policyRef,approval_ref:null,
 outcome:'APPLIED',reason_code:'EXPLICIT_DOCUMENT_DRAFT',scope_digest:scopeDigest,recorded_at:at,source_kind:'HUMAN_COMMAND',correction_of:null};
const input={projectId,documentRef:ref,limits:{metadataBytes:65536,inputBytes:65536,fileCount:1,deadlineMs:10000}};
const envelope=(row:unknown)=>({inventory_data:structuredClone(row),row_bytes:Buffer.byteLength(JSON.stringify(row))});

function fixture(mode='valid'){
 const trace:string[]=[];
 const person:AuthenticatedIdentity={actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,
  authSession:{id:sessionId,idleExpiresAt:'2026-11-28T00:01:00.000Z',absoluteExpiresAt:'2026-11-28T00:20:00.000Z'}};
 let rc=0,rr=0,obs=0;
 let liveRR=false;
 function db(scope:string){
  return {async query(sql:string,params:unknown[]=[]){
   assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|GRANT)\b/i.test(sql),'정상 운영 표 변경 0');
   if(sql.startsWith('BEGIN')){assert.equal(scope,'RR');assert.match(sql,/REPEATABLE READ READ ONLY/);liveRR=true;trace.push('RR:begin');return {command:'BEGIN',rows:[]};}
   if(sql==='ROLLBACK'){assert(liveRR);liveRR=false;trace.push('RR:rollback');return {command:mode==='rollback-unknown'?'UNKNOWN':'ROLLBACK',rows:[]};}
   if(sql.includes("'statement_timeout'")){assert(Number(params[0])>0&&Number(params[0])<=input.limits.deadlineMs);return {rows:[{ms:params[0]}]};}
   if(sql.includes('pg_current_snapshot')){assert(liveRR);obs++;return {rows:[{snapshot:obs>1&&mode==='snapshot-changed'?'4:15:':'4:14:',at:new Date(at),read_only:'on',isolation:'repeatable read'}]};}
   if(sql.includes('transaction_isolation'))return {rows:[{isolation:'read committed',at:new Date(at)}]};
   if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:new Date(at)}]};
   if(sql.includes("'anvil.actor_id'")){assert.equal(scope,'RR');assert.deepEqual(params,[actorId,clientId]);trace.push('RR:rls');return {rows:[{actor_id:actorId,client_id:clientId}]};}
   if(sql.includes('FROM anvil.projects p')){assert.deepEqual(params,[projectId,actorId]);assert(scope==='RR'?liveRR:!liveRR);return {rows:[{id:projectId,archived_at:null,participation:scope==='RC2'&&mode==='revoked'?'VIEWER':'OWNER'}]};}
   if(sql.includes('FROM anvil.project_control')){assert.equal(params[0],projectId);return {rows:[{actor_id:actorId,client_id:clientId,generation:1,version:1,revoked_at:null}]};}
   assert(sql.includes('FN16_D2_BODY')&&sql.includes('LIMIT 2'));
   const table=sql.match(/FROM anvil\.(\w+)/)?.[1];
   if(!['form_definitions','authoring_standard_versions'].includes(table??''))assert.equal(params[0],projectId);
   trace.push(`${scope}:${table}`);
   let row;
   if(table==='document_versions'){assert.deepEqual(params.slice(1,-1),[documentId,1,ref.contentHash]);row=mode==='part'?{...original,stage_ref_json:{applicationId:id(86),nodeId:'PART'}}:original;}
   else if(table==='document_artifact_links'){assert.deepEqual(params.slice(1,-1),[documentId,1]);row={project_id:projectId,document_id:documentId,version:1,kind:'BODY',artifact_id:mode==='wrong-link'?id(30):bodyId};}
   else if(table==='artifacts'){assert.equal(params[1],bodyId);assert.match(sql,/draft_id IS NULL.*storage_key=/);row=scope==='RC2'&&mode==='current-artifact-change'?{...artifact,state:'QUARANTINED'}:artifact;}
   else if(table==='commands'){
    assert.deepEqual(params.slice(1,-1),[command.id]);assert.match(sql,/t\.id=\$2::uuid.*scope_kind='PROJECT'.*approval_consumption_id IS NULL/);
    row=mode==='different-command'?{...command,id:id(91)}:mode==='other-operation'?{...command,operation:'confirmDocument'}:
     mode==='draft-scope'?{...command,scope_kind:'DRAFT',draft_id:id(92)}:mode==='approval'?{...command,approval_consumption_id:id(93)}:command;
   }
   else if(table==='authorization_receipts'){
    assert.deepEqual(params.slice(1,-1),[receipt.id,command.id]);
    row=mode==='wrong-receipt'?{...receipt,subject_ref:{kind:'HUMAN',userId:id(94),clientId}}:receipt;
   }
   else if(table==='audit_events'){
    assert.deepEqual(params.slice(1,-1),[command.id]);assert.match(sql,/t\.command_id=\$2::uuid AND t\.correction_of IS NULL/);
    assert.doesNotMatch(sql,/WHERE[^\n]*source_kind\s*=/);
    const correction={...audit,event_id:id(95),correction_of:audit.event_id};
    if(mode==='duplicate-audit')return {rows:[envelope(audit),envelope({...audit,event_id:id(96),source_kind:'SERVER_DENIAL'})]};
    if(mode==='correction-only')return {rows:[]};
    // 같은 command의 나중 정정은 original 범위 밖이다.
    row=(scope==='RC2'&&mode==='origin-drift')?{...audit,event_id:id(97)}:[audit,correction].find(event=>event.correction_of===null)!;
   }
   else if(table==='form_definitions'){
    assert.deepEqual(params.slice(0,-1),[formRef.id,formRef.version,formRef.contentHash]);
    assert.match(sql,/d\.scope='SYSTEM' AND d\.owner_user_id IS NULL AND d\.project_id IS NULL/);
    assert.doesNotMatch(sql,/head_version|origin_ref_json|USER_COMMON/);
    const other={...systemForm,scope:'USER_COMMON',owner_user_id:id(102)};
    const head=scope==='RR'?1:2;
    const forms=mode==='hidden-common'?[{...other,head_version:head}]:
     [{...systemForm,head_version:head},{...systemForm,head_version:head,version:2,content_hash:'e'.repeat(64)}];
    const pinned=forms.find(form=>form.scope==='SYSTEM'&&form.version===params[1]&&form.content_hash===params[2]);
    if(!pinned)return {rows:[]};
    const {head_version,...projection}=pinned;
    assert.equal(head_version,head);
    if(mode==='form-duplicate')return {rows:[envelope(systemForm),envelope(systemForm)]};
    row=mode==='unbounded-source-row'?other:mode==='form-version'?{...systemForm,version:2}:
     mode==='form-hash'?{...systemForm,definition_json:{...definition,name:'변조'}}:
     scope==='RC2'&&mode==='form-projection-drift'?{...systemForm,created_at:'2026-11-28T00:00:01.000Z'}:projection;
   }
   else if(table==='authoring_standard_versions'){
    assert.deepEqual(params.slice(0,-1),[standardRef.id,standardRef.version,standardRef.contentHash]);
    assert.doesNotMatch(sql,/body_utf8|source_approval_json/);
    if(scope==='RC2'&&mode==='standard-missing')return {rows:[]};
    row=mode==='standard-mismatch'?{...standard,content_hash:'c'.repeat(64)}:standard;
   }
   else throw Error('잘못된 조회');
   return {rows:[envelope(row)]};
  },release(error?:Error){trace.push(error?'RR:discard':'RR:release');}} as unknown as PoolClient;
 }
 const access:Pick<AccessRepository,'authenticated'|'pool'>={
  async authenticated<T>(_token:string,csrf:string|null,work:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){
   assert.equal(csrf,'synthetic-csrf');assert(!liveRR);const scope=`RC${++rc}`;
   trace.push(`${scope}:begin`);const value=await work(db(scope),person);trace.push(`${scope}:commit`);return value;
  },
  pool:{async connect(){rr++;assert.equal(rr,1);return db('RR');}} as unknown as AccessRepository['pool']
 };
 const reader={async open(expected:unknown){
  assert(!liveRR);
  assert.deepEqual(expected,{projectId,artifactId:bodyId,bytes:bytes.length,contentHash:bodyRef.contentHash});
  trace.push('body:open');
  let read=false;
  return {async read(){if(read)return Buffer.alloc(0);read=true;return mode==='wrong-body'?Buffer.alloc(bytes.length):Buffer.from(bytes);},
   async close(){trace.push('body:close');if(mode==='close-unknown')throw Error('합성 close 불명');}};
 }};
 const admission={async readCurrent(_db:Pick<PoolClient,'query'>,actor:AuthenticatedIdentity,scope:{projectId:string;documentRef:typeof ref}){
  assert.equal(actor,person);assert.deepEqual(scope,{projectId,documentRef:ref});assert(!liveRR);
  trace.push(`RC${rc}:admission`);
  if(mode==='policy-denied'||mode==='policy-revoked'&&rc===2)return null;
  return {purpose:mode==='body-only-admission'?'FN16_D2_DOCUMENT_BODY_ADMISSION_V1':mode==='draft-only-admission'?'FN16_D2_DOCUMENT_DRAFT_ADMISSION_V2':'FN16_D2_DOCUMENT_SYSTEM_FORM_ADMISSION_V3',
   projectId,documentRef:ref,actorId,clientId,sessionId,credentialGeneration:1,controlGeneration:1,
   jobRef:pinned(10),reservationRef:pinned(11),policyRef:pinned(mode==='new-policy'&&rc===2?19:12),targetProtectedRef:pinned(13),
   retentionPolicyRef:pinned(14),encryptionKeyRef:pinned(15),verificationPolicyRef:pinned(16),
   formRef:mode==='foreign-admission-form'?pinned(103):formRef,expiresAt:'2026-11-28T00:00:09.000Z'};
 }};
 const run=()=>collectDocumentBodySnapshot(access,'synthetic-token','synthetic-csrf',input,mode==='unconfigured'?null:admission,reader,new AbortController().signal);
 return {run,trace};
}

test('한 RR의 보관 문서·BODY·원 명령 관계와 정확 바이트를 독립 재검산한다',async()=>{
 const f=fixture(),capture=await f.run();
 const tables=['document_versions','document_artifact_links','artifacts','commands','authorization_receipts','audit_events','form_definitions','authoring_standard_versions'];
 assert.deepEqual(f.trace,['RC1:begin','RC1:admission','RC1:commit','RR:begin','RR:rls',...tables.map(v=>'RR:'+v),
  'RR:rollback','RR:release','body:open','body:close','RC2:begin','RC2:admission',...tables.map(v=>'RC2:'+v),'RC2:commit']);
 assert.deepEqual(capture.body,bytes);
 assert.equal(capture.coverage,'DOCUMENT_BODY_DRAFT_ORIGIN_AND_SYSTEM_FORM');
 const expected={projectId,documentRef:ref,jobRef:pinned(10),snapshot:'4:14:',snapshotHash:capture.snapshotHash};
 const independent=()=>({snapshot:JSON.parse(JSON.stringify(capture.snapshot)),body:Buffer.from(capture.body)});
 const result=await verifyDocumentBodyHistory(expected,async()=>independent());
 assert.deepEqual(result.documentRef,ref);
 assert.deepEqual(result.artifact,bodyRef);
 assert.equal(result.bodyVerified,true);
 assert.equal(result.documentHistoryComplete,false);
 assert.equal(result.restorable,false);
 assert.equal(result.executionAuthorized,false);
 assert.equal(result.kind,'FN16_D2_DOCUMENT_SYSTEM_FORM_VERIFICATION_V3');
 if(result.kind!=='FN16_D2_DOCUMENT_SYSTEM_FORM_VERIFICATION_V3')throw Error('양식 검산 누락');
 assert.deepEqual(result.commandProjectionRef,{id:original.command_id,version:1,contentHash:hash(command)});
 assert.deepEqual(result.receiptProjectionRef,{id:receipt.id,version:1,contentHash:hash(receipt)});
 assert.notEqual(result.receiptProjectionRef.contentHash,scopeDigest);
 assert.deepEqual(result.auditProjectionRef,{id:audit.event_id,version:1,contentHash:hash(audit)});
 assert.deepEqual(result.formRef,formRef);
 assert.equal(result.formProjectionHash,hash(systemForm));
 assert.deepEqual(result.standardRef,standardRef);
 assert.equal(result.standardProjectionHash,hash(standard));
 assert.equal(result.standardBodyVerified,false);
 assert.equal(result.formAuthorityVerified,false);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.body[0]=restored.body[0]!^1;return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.snapshot.observation.snapshot='4:15:';return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.snapshot.rows.link.artifact_id=id(99);return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,jobRef:pinned(99)},async()=>independent()),/HISTORY_INVALID/);
 const stored=independent();
 stored.snapshot.rows.origin.receipt.scope_digest='c'.repeat(64);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(stored.snapshot)},async()=>stored),/HISTORY_INVALID/);
 const changedStandard=independent();
 changedStandard.snapshot.rows.systemForm.definition.authoring_standard_ref=pinned(104);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,snapshotHash:hash(changedStandard.snapshot)},async()=>changedStandard),/HISTORY_INVALID/);
});

test('기존 BODY v1과 초안 원 명령 v2는 각각 이전 검산 범위로 읽힌다',async()=>{
 const capture=await fixture().run();
 const {version,link,artifact}=capture.snapshot.rows;
 const legacy={...capture.snapshot,kind:'FN16_D2_DOCUMENT_BODY_SNAPSHOT_V1',rows:{version,link,artifact}};
 const expected={projectId,documentRef:ref,jobRef:pinned(10),snapshot:'4:14:',snapshotHash:hash(legacy)};
 const result=await verifyDocumentBodyHistory(expected,async()=>({snapshot:legacy,body:Buffer.from(capture.body)}));
 assert.equal(result.kind,'FN16_D2_DOCUMENT_BODY_VERIFICATION_V1');
 assert.equal(result.bodyVerified,true);
 assert(!Object.hasOwn(result,'receiptProjectionRef'));
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>({snapshot:{...legacy,rows:capture.snapshot.rows},body:bytes})),/HISTORY_INVALID/);
 const v2={...legacy,kind:'FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2',rows:{...legacy.rows,origin:capture.snapshot.rows.origin}};
 const draft=await verifyDocumentBodyHistory({...expected,snapshotHash:hash(v2)},async()=>({snapshot:v2,body:bytes}));
 assert.equal(draft.kind,'FN16_D2_DOCUMENT_DRAFT_VERIFICATION_V2');
 assert(Object.hasOwn(draft,'receiptProjectionRef')&&!Object.hasOwn(draft,'formProjectionHash'));
});

test('SYSTEM 양식이나 표준의 교차·변조·중복과 최신 RC 변경을 거절한다',async()=>{
 for(const mode of ['hidden-common','unbounded-source-row','form-version','form-hash','form-duplicate','standard-mismatch','foreign-admission-form']){
  const f=fixture(mode);
  await assert.rejects(f.run,/DOCUMENT_INVENTORY_INTEGRITY_FAILED/);
  assert(!f.trace.includes('body:open'),mode);
  if(mode==='foreign-admission-form')assert(!f.trace.includes('RR:form_definitions'));
 }
 for(const mode of ['standard-missing','form-projection-drift']){
  const f=fixture(mode);
  await assert.rejects(f.run);
  assert(f.trace.includes('RC2:form_definitions')&&!f.trace.includes('RC2:commit'),mode);
 }
});

test('원 명령 참조·범위·인가·원 감사의 부적격은 BODY IO 전에 닫는다',async()=>{
 for(const mode of ['part','draft-scope','other-operation','approval','different-command','wrong-receipt','duplicate-audit','correction-only']){
  const f=fixture(mode);
  await assert.rejects(f.run,/DOCUMENT_INVENTORY_INTEGRITY_FAILED/);
  assert(!f.trace.includes('body:open'),mode);
  assert.equal(f.trace.filter(s=>s==='RR:rollback').length,1,mode);
 }
 const drift=fixture('origin-drift');
 await assert.rejects(drift.run,/FN16_D2_SNAPSHOT_INVALID/);
 assert(drift.trace.includes('RC2:audit_events')&&!drift.trace.includes('RC2:commit'));
});

test('원 승인 백업 입장이 없거나 최종 정책이 바뀌면 수집 권위를 만들지 않는다',async()=>{
 for(const mode of ['unconfigured','policy-denied','policy-revoked','new-policy','body-only-admission','draft-only-admission']){
  const f=fixture(mode);
  await assert.rejects(f.run,/SNAPSHOT_(ADMISSION_|AUTH_CHANGED)/);
  assert(!f.trace.includes('RC2:document_versions'),mode);
  if(['unconfigured','policy-denied','body-only-admission','draft-only-admission'].includes(mode))assert(!f.trace.includes('RR:begin'),mode);
 }
});

test('교차 관계·스냅샷·회수 불명·권한 변경에서 수집 결과를 반환하지 않는다',async()=>{
 for(const mode of ['wrong-link','snapshot-changed','rollback-unknown','wrong-body','close-unknown','revoked','current-artifact-change']){
  const f=fixture(mode);
  await assert.rejects(f.run);
  assert.equal(f.trace.includes('RC2:commit'),false,mode);
  assert.equal(f.trace.filter(s=>s==='RR:rollback').length,1,mode);
  if(mode==='rollback-unknown')assert(f.trace.includes('RR:discard'));
  if(['wrong-link','snapshot-changed','rollback-unknown'].includes(mode))assert(!f.trace.includes('body:open'),mode);
  else assert.equal(f.trace.filter(s=>s==='body:close').length,1,mode);
 }
});
