import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {AuthFailure,type AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

// 공개 합성 metadata만 사용한다. 실제 PG·원문·키·서비스 연결은 없다.
const id=(n:number)=>`72000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const pid=id(1),actorId=id(2),clientId=id(3),sessionId=id(4),at=new Date('2026-10-29T00:00:00.000Z');
const marker='synthetic-private-storage-detail';
const clone=<T>(v:T):T=>structuredClone(v);
const ref=(n:number,v=1)=>({id:id(n),version:v,contentHash:String(n%10).repeat(64)});
const input=()=>({projectId:pid,limits:{metadataBytes:16*1024*1024,inputBytes:20*1024*1024,fileCount:1000,deadlineMs:10000}});
async function collector():Promise<(a:AccessRepository,t:string,i:unknown,s:AbortSignal)=>Promise<any>>{
 const url=new URL('../../../apps/server/modules/backups/document-inventory.ts',import.meta.url),m:any=existsSync(url)?await import(url.href):{};
 assert.equal(typeof m.collectDocumentInventory,'function','문서 inventory collector 미구현');return m.collectDocumentInventory;
}
function rejected(status:number){return(e:any)=>e instanceof AuthFailure&&e.statusCode===status&&!e.message.includes(marker)&&!JSON.stringify(e).includes(marker)&&e.cause===undefined;}
function fixture(){
 const standard=ref(10),form=(n:number,scope:string)=>{const definition={formCode:'AF01',name:'합성 양식',purpose:'자료 정합',scope,authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'사용자',requiredInputs:[],items:[{itemId:'I1',title:'요구',required:true,valueType:'TEXT',repeated:false,fields:[],authoringRules:['명시'],reviewCriteria:['대조']}],authoringStandardRef:standard};return{id:id(n),scope,owner_user_id:scope==='USER_COMMON'?actorId:null,project_id:null,form_code:'AF01',name:definition.name,version:1,definition_json:definition,content_hash:hash(definition),authoring_standard_id:standard.id,authoring_standard_version:1,authoring_standard_hash:standard.contentHash,authoring_standard_ref:standard,origin_ref_json:null,created_by:scope==='SYSTEM'?null:actorId,created_at:at};};
 const forms=[form(11,'SYSTEM'),form(12,'USER_COMMON')],frefs=forms.map(f=>({id:f.id,version:1,contentHash:f.content_hash}));
 const graph=(formRef:any)=>({nodes:[{nodeId:'N1',name:'정의',purpose:'자료 작성',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[{itemId:'O1',formRef,required:true,reviewCriteria:['검토']}],taskScope:{included:['작성'],excluded:[]},completionCriteria:['작성'],approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['이력']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']});
 const methods=frefs.map((f,i)=>({id:id(20+i),scope:'PROJECT',owner_user_id:null,project_id:pid,system_code:null,version:1,name:'프로젝트 방법론',purpose:'자료 작성',graph_json:graph(f),content_hash:hash(graph(f)),origin_ref_json:null,reason:'합성',created_by:actorId,created_at:at}));
 const applications=methods.map((m,i)=>{const snapshot={name:m.name,purpose:m.purpose,graph:m.graph_json,sourceRef:{id:m.id,version:1,contentHash:m.content_hash}};return{id:id(30+i),project_id:pid,application_version:i+1,source_definition_id:m.id,source_version:1,source_hash:m.content_hash,snapshot_json:snapshot,snapshot_hash:hash(snapshot),created_by:actorId,created_at:at};});
 const artifacts=[40,41,42,43,44,45].map(n=>({id:id(n),project_id:pid,bytes:100+n,content_hash:String(n%10).repeat(64),media_type:n>=44?'application/json;charset=utf-8':'text/plain;charset=utf-8',state:'READY',inspection_json:{policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'NO_KNOWN_MARKER',reasonCodes:[]}}));
 const ar=(n:number)=>{const a=artifacts[n]!;return{artifactId:a.id,bytes:a.bytes,contentHash:a.content_hash,mediaType:a.media_type};};
 const version=(doc:number,v:number,fi:number)=>{const content={body:ar(doc===50&&v===2?3:fi),attachments:[ar(2)],sections:[{itemId:'I1',anchor:'line:1'}],sourceRefs:[]},formRef=frefs[fi],stageNodeRef={applicationId:applications[fi]!.id,nodeId:'N1'},title=`문서 ${doc}`;return{project_id:pid,document_id:id(doc),version:v,form_definition_id:formRef!.id,form_version:1,form_hash:formRef!.contentHash,stage_ref_json:stageNodeRef,body_artifact_id:content.body.artifactId,title,source_refs_json:[],content_json:content,content_hash:hash({title,formRef,stageNodeRef,content}),sections_json:content.sections,author_ref_json:{kind:'HUMAN',userId:actorId},validation_json:{formatOnly:true},reason:'합성 기록',client_id:clientId,command_id:id(1000+doc*10+v),created_at:at};};
 const versions=[version(50,1,0),version(50,2,0),version(51,1,1)],dr=(v:any)=>({id:v.document_id,version:v.version,contentHash:v.content_hash});
 const documents=[{id:id(50),project_id:pid,title:'문서 50',head_version:2,confirmed_version:1,created_by:actorId,created_at:at,updated_at:at},{id:id(51),project_id:pid,title:'문서 51',head_version:1,confirmed_version:null,created_by:actorId,created_at:at,updated_at:at}];
 const links=versions.flatMap(v=>[{project_id:pid,document_id:v.document_id,version:v.version,artifact_id:v.content_json.body.artifactId,kind:'BODY'},{project_id:pid,document_id:v.document_id,version:v.version,artifact_id:ar(2).artifactId,kind:'ATTACHMENT'}]);
 links.push({project_id:pid,document_id:id(51),version:1,artifact_id:ar(0).artifactId,kind:'SOURCE'});
 const candidate={id:id(60),originalRef:ar(0),extractedContentRef:ar(0),intendedFormRef:frefs[0],parserVersion:'UTF8_IDENTITY_1',losses:[],issues:[],status:'READY'};
 const failed={...candidate,id:id(61),extractedContentRef:null,status:'FAILED',issues:[{code:'UNSUPPORTED',message:'합성 원문 불명'}]};
 const imports=[candidate,failed].map(c=>({id:c.id,project_id:pid,original_artifact_id:c.originalRef.artifactId,form_definition_id:frefs[0]!.id,form_version:1,form_hash:frefs[0]!.contentHash,candidate_json:c,content_hash:hash(c),created_by:actorId,client_id:clientId,command_id:id(c===candidate?160:161),created_at:at}));
 const proposals=[70,71].map(n=>{const proposal={id:id(n),baseRef:dr(versions[0]),proposedContentRef:ar(3),diffRef:ar(n===70?4:5),status:'PENDING'},content=versions[1]!.content_json,reason='합성 제안';return{id:id(n),project_id:pid,document_id:id(50),base_version:1,base_hash:versions[0]!.content_hash,body_artifact_id:ar(3).artifactId,diff_artifact_id:ar(n===70?4:5).artifactId,content_json:content,proposal_json:proposal,content_hash:hash({proposal,content,reason}),reason,created_by:actorId,client_id:clientId,command_id:id(100+n),created_at:at};});
 const review={id:id(80),scope_kind:'PROJECT',scope_id:pid,project_id:pid,target_kind:'DOCUMENT',target_id:id(50),target_version:1,target_hash:versions[0]!.content_hash,criteria_version:1,criteria_snapshot_json:{criteriaVersion:1,formRef:frefs[0],items:[{criterionId:'I1',title:'요구',reviewCriteria:['대조']}]},items_json:[{criterionId:'I1',outcome:'ACCEPTED',evidenceRefs:[],reason:'합성 확인'}],outcome:'ACCEPTED',reviewer_user_id:actorId,client_id:clientId,reviewer_subject_ref:{kind:'HUMAN',userId:actorId,sameAsTargetRecorder:true},source_kind:'HUMAN_REVIEW',reason:'합성 검토',command_id:id(180),created_at:at};
 const reviewRef={id:review.id,targetRef:dr(versions[0]),criteriaVersion:1,outcome:'ACCEPTED'};
 const sourceFirst={documentRef:dr(versions[0]),sourceRootId:id(90),relativePath:'private/source.txt',sourceSnapshotRef:ref(91),blobHash:'a'.repeat(64),reason:'연결',projectId:pid,kind:'LINKED',state:'ACTIVE',previousRef:null,recordedAt:at.toISOString()},sourceRef={id:id(92),version:1,contentHash:hash(sourceFirst)};
 const sourceSecond={...sourceFirst,kind:'DETACHED',state:'DETACHED',previousRef:sourceRef,reason:'분리'};
 const tables:Record<string,any[]>={documents,document_versions:versions,document_artifact_links:links,artifacts,document_imports:imports,
  document_import_selections:[{id:id(62),project_id:pid,import_id:id(60),document_id:id(50),version:1,created_by:actorId,client_id:clientId,command_id:id(162),created_at:at}],
  document_proposals:proposals,document_proposal_selections:[{id:id(72),project_id:pid,proposal_id:id(70),document_id:id(50),version:2,created_by:actorId,client_id:clientId,command_id:id(172),created_at:at}],content_reviews:[review],
  document_confirmations:[{id:id(81),project_id:pid,document_id:id(50),version:1,target_hash:versions[0]!.content_hash,form_ref:frefs[0],review_refs:[reviewRef],validation_json:{validForConfirmation:true},confirmed_by:actorId,client_id:clientId,command_id:id(181),created_at:at}],
  document_version_events:versions.map((v,i)=>({id:id(82+i),project_id:pid,document_id:v.document_id,version:v.version,event_kind:'DRAFT_SAVED',review_ref:null,actor_ref:v.author_ref_json,reason:'합성',command_id:v.command_id,created_at:at})),
  document_source_links:[{project_id:pid,id:id(92),document_id:id(50),version:1,source_root_id:id(90),relative_path:sourceFirst.relativePath,source_snapshot_ref:ref(91),blob_hash:'a'.repeat(64),link_version:2,state:'DETACHED',current_event_id:id(94),linked_at:at,updated_at:at}],
  document_source_link_events:[{id:id(93),project_id:pid,link_id:id(92),link_version:1,content_hash:hash(sourceFirst),snapshot_json:sourceFirst,command_id:id(193),created_at:at},{id:id(94),project_id:pid,link_id:id(92),link_version:2,content_hash:hash(sourceSecond),snapshot_json:sourceSecond,command_id:id(194),created_at:at}],
  form_definitions:forms,authoring_standard_versions:[{id:standard.id,version:1,content_hash:standard.contentHash,created_at:at}],project_methodologies:applications,methodology_definitions:methods};
 const trace:{scope:string;sql:string;values:unknown[]}[]=[],calls=new Map<string,number>();
 const state={authCalls:0,connects:0,released:0,rollback:0,writes:0,wrongIsolation:false,wrongReadOnly:false,beginFailure:false,denyStart:false,denyEnd:false,changeIdentity:'',failAuthCommit:false,failTable:'',failPageTable:'',duplicatePage:false,rollbackFailure:false,abortedDuringQuery:false,releaseError:false,denyCommonEnd:false,overPage:false,oversizeRow:false,cancelAfterCommit:false,afterCommit:null as null|(()=>void)};
 const abort=new AbortController();
 const tupleKeys=(table:string)=>table==='document_versions'?['document_id','version']:table==='document_artifact_links'?['document_id','version','artifact_id','kind']:['form_definitions','methodology_definitions','authoring_standard_versions'].includes(table)?['id','version']:['id'];
 const comparable=(a:any,b:any)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b));
 const sort=(rows:any[],keys:string[])=>rows.sort((a,b)=>{for(const k of keys){const n=comparable(a[k],b[k]);if(n)return n;}return 0;});
 const flatten=(values:unknown[]):unknown[]=>values.flatMap(v=>{if(Array.isArray(v))return flatten(v);if(v&&typeof v==='object'&&!(v instanceof Date))return flatten(Object.values(v));if(typeof v==='string'&&(v.startsWith('[')||v.startsWith('{'))){try{return flatten([JSON.parse(v)]);}catch{}}return[v];});
 async function query(scope:string,raw:any,params?:unknown[]){
  const sql=typeof raw==='string'?raw:raw.text,values:unknown[]=params??raw.values??[];trace.push({scope,sql,values:clone(values)});
  assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|GRANT)\b/i.test(sql),'inventory DB 영속 쓰기 금지');
  if(/^BEGIN\b/i.test(sql)){assert.equal(scope,'RR');assert(/REPEATABLE READ/i.test(sql)&&/READ ONLY/i.test(sql));if(state.beginFailure)throw Object.assign(Error(marker),{cause:marker});return{rows:[],rowCount:0};}
  if(/^ROLLBACK\b/i.test(sql)){state.rollback++;if(state.rollbackFailure)throw Error(marker);return{rows:[],rowCount:0};}
  assert(!/^COMMIT\b/i.test(sql),'자료 RR은 rollback 종료');
  if(/set_config/i.test(sql)){assert.equal(scope,'RR');assert(/statement_timeout/.test(sql));return{rows:[{set_config:String(values[0]??10000)}],rowCount:1};}
  if(/current_setting|pg_current_snapshot|clock_timestamp/i.test(sql)&&!/FROM anvil\./i.test(sql))return{rows:[{isolation:scope==='RR'?(state.wrongIsolation?'read committed':'repeatable read'):'read committed',read_only:scope==='RR'?(state.wrongReadOnly?'off':'on'):'off',readOnly:scope==='RR'?'on':'off',snapshot:'1:10:',at:new Date()}],rowCount:1};
  if(/FROM anvil\.projects\b/i.test(sql)){assert(values.includes(pid)&&values.includes(actorId));return{rows:state.authCalls===2&&state.denyEnd?[]:[{id:pid,archived_at:null,participation:'OWNER'}],rowCount:state.authCalls===2&&state.denyEnd?0:1};}
  const table=/\bFROM anvil\.([a-z_]+)/i.exec(sql)?.[1];assert(table&&Object.hasOwn(tables,table),'등록되지 않은 metadata query');
  assert(!/SELECT\s+(?:\w+\.)?\*/i.test(sql),'명시 열만 허용');assert(!/\b(?:storage_key|body_utf8|source_approval_json)\b/i.test(sql),'원문/보관경로 조회 금지');
  const flat=flatten(values),common=['form_definitions','authoring_standard_versions','methodology_definitions'].includes(table);
  if(!common){assert.equal(scope,'RR');assert(values.includes(pid),'모든 프로젝트 자료 pid 결박');assert(/project_id\s*=\s*\$\d|project_id\s*=\s*[^ ]+\.project_id/i.test(sql));}
  if(['form_definitions','methodology_definitions'].includes(table)){assert(flat.includes(actorId),'공통본 사용자 경계');assert(/owner_user_id/.test(sql)&&/scope/.test(sql));}
  if(common||table==='project_methodologies'||table==='artifacts'){assert(/\bWHERE\b/i.test(sql));assert(flat.some(v=>typeof v==='string'&&v!==pid&&v!==actorId&&/^72000000-/.test(v)),'고정 ref/id 묶음만 조회');}
  if(table==='content_reviews')assert(/PROJECT/.test(sql)&&/DOCUMENT/.test(sql)&&/scope_id/.test(sql));
  const nth=(calls.get(scope+table)??0)+1;calls.set(scope+table,nth);
  if(state.failTable===table||state.failPageTable===table&&nth>1)throw Object.assign(Error(marker),{cause:marker});
  if(state.abortedDuringQuery)abort.abort();
  let rows=clone(tables[table]!);
  if(common||table==='project_methodologies'||table==='artifacts')rows=rows.filter(r=>flat.includes(r.id));
  if(table==='form_definitions')rows=rows.filter(r=>r.scope==='SYSTEM'||r.scope==='USER_COMMON'&&r.owner_user_id===actorId&&!(scope==='RC'&&state.authCalls===2&&state.denyCommonEnd));
  if(table==='methodology_definitions')rows=rows.filter(r=>r.scope==='SYSTEM'||r.scope==='USER_COMMON'&&r.owner_user_id===actorId||r.scope==='PROJECT'&&r.project_id===pid);
  const keys=tupleKeys(table);sort(rows,keys);
  // 실제 SQL의 키 순서/상한을 대조하고, 반환은 고정 정렬 page 모델이다. 실제 PG 구문 검증 아님.
  if(scope==='RR'){assert(/ORDER BY/i.test(sql));assert(/LIMIT\s+(?:200|\$\d)/i.test(sql));if(nth>1&&!common&&table!=='project_methodologies'&&table!=='artifacts')assert(/>/.test(sql),'뒤 page keyset 조건');}
  const pageOffset=scope==='RR'&&!common&&table!=='project_methodologies'&&table!=='artifacts'?(state.duplicatePage&&nth>1?0:(nth-1)*200):0;
  if(state.oversizeRow&&table==='documents'){assert(/octet_length/i.test(sql)&&/CASE\s+WHEN/i.test(sql),'거대 row는 SQL 측 크기와 본문 억제 필요');return{rows:[{inventory_data:null,row_bytes:input().limits.metadataBytes+1}],rowCount:1};}
  rows=rows.slice(pageOffset,pageOffset+200).map(r=>({...r,row_bytes:Buffer.byteLength(JSON.stringify(r))}));
  if(state.overPage&&table==='documents')rows=Array.from({length:201},(_,i)=>({...rows[0],id:id(2000+i)}));
  return{rows:rows.map(({row_bytes,...data})=>({inventory_data:JSON.parse(JSON.stringify(data)),row_bytes})),rowCount:rows.length};
 }
 const rr={query:(sql:any,values?:unknown[])=>query('RR',sql,values),release(error?:unknown){state.released++;state.releaseError=error!==undefined;}};
 const actor=()=>({actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:sessionId,idleExpiresAt:new Date(Date.now()+60000).toISOString(),absoluteExpiresAt:new Date(Date.now()+120000).toISOString()}});
 const access={pool:{async connect(){state.connects++;return rr;}},async authenticated(token:string,csrf:unknown,body:any){assert.equal(token,'synthetic-token');assert.equal(csrf,null);state.authCalls++;if(state.authCalls===1&&state.denyStart)throw new AuthFailure('AUTH_REQUIRED',401);const a:any=actor();if(state.authCalls===2&&state.changeIdentity){if(state.changeIdentity==='session')a.authSession.id=id(999);else if(state.changeIdentity==='generation')a.credentialGeneration++;else a[state.changeIdentity]=id(999);}const value=await body({query:(sql:any,values?:unknown[])=>query('RC',sql,values)},a);if(state.authCalls===2&&state.failAuthCommit)throw Error(marker);if(state.authCalls===2){if(state.cancelAfterCommit)abort.abort();state.afterCommit?.();}return value;}};
 return{tables,state,trace,calls,abort,access:access as unknown as AccessRepository,run:async(fn:any,request:any=input())=>fn(access,'synthetic-token',request,abort.signal)};
}

test('inventoryCollect 두 문서 모든 버전·참조·SOURCE 관계를 같은 RR에서 수집한다',async()=>{
 const fn=await collector(),f=fixture(),out=await f.run(fn);
 assert.equal(out.kind,'DOCUMENT_INVENTORY_V1');assert.equal(out.scope,'DOCUMENT_HISTORY_ONLY');assert.equal(out.projectId,pid);
 assert.equal(out.documents.length,2);assert.equal(out.versions.length,3);assert.equal(out.imports.length,2);assert.equal(out.proposals.length,2);assert.equal(out.reviews.length,1);assert.equal(out.confirmations.length,1);assert.equal(out.applications.length,2);assert.equal(out.forms.length,2);
 assert.equal(out.artifactLinks.length,7);assert.equal(out.artifactLinks.filter((l:any)=>l.kind==='SOURCE').length,1);
 for(const l of out.artifactLinks){assert(l.documentRef.id&&l.documentRef.version&&l.documentRef.contentHash);assert(l.artifactRef.artifactId&&l.artifactRef.contentHash);}
 assert.equal(out.usage.fileCount,6);assert.equal(out.usage.inputBytes,140+141+142+143+144+145);assert.equal(out.usage.metadataBytes,Buffer.byteLength(canonicalJson(out)));
 assert.equal(out.blobVerification,'NOT_PERFORMED');assert.equal(out.fullProjectCoverage,false);assert.equal(out.restorable,false);assert(out.standards.every((s:any)=>s.bodyVerification==='NOT_PERFORMED'));
 const events=out.sourceLinks[0].events;assert.equal(events.length,2);for(const e of events){assert.equal(e.projectionHash,hash(e.projection));assert.notEqual(e.sourceRef.contentHash,e.projectionHash);}
 const text=JSON.stringify(out);for(const forbidden of ['private/source.txt','relativePath','storage_key','body_utf8','synthetic-token','authSession'])assert(!text.includes(forbidden));
 assert.equal(f.state.authCalls,2);assert.equal(f.state.connects,1);assert.equal(f.state.rollback,1);assert.equal(f.state.released,1);
 assert(f.trace.findIndex(t=>t.scope==='RC')<f.trace.findIndex(t=>t.scope==='RR'));assert.equal(f.trace.at(-1)?.scope,'RC');
});

test('inventoryAuth 시작 거절·반환 전 신원 변경·현재OWNER회수는 결과를 반환하지 않는다',async()=>{
 const fn=await collector();const start=fixture();start.state.denyStart=true;await assert.rejects(start.run(fn),rejected(401));assert.equal(start.state.connects,0);
 for(const change of ['actorId','clientId','session','generation']){const f=fixture();f.state.changeIdentity=change;await assert.rejects(f.run(fn),rejected(401));assert.equal(f.state.released,1);}
 const owner=fixture();owner.state.denyEnd=true;await assert.rejects(owner.run(fn),rejected(404));
 const commit=fixture();commit.state.failAuthCommit=true;await assert.rejects(commit.run(fn),rejected(503));
});

test('inventoryCancel 이미 취소된 요청은 IO0이며 진행 중 취소도 결과0으로 회수한다',async()=>{
 const fn=await collector(),first=fixture();first.abort.abort();await assert.rejects(first.run(fn),rejected(409));assert.equal(first.state.authCalls,0);assert.equal(first.state.connects,0);
 const during=fixture();during.state.abortedDuringQuery=true;await assert.rejects(during.run(fn),rejected(409));assert.equal(during.state.released,1);assert.equal(during.state.rollback,1);
});

test('inventoryClosure 필수 head·artifact 링크·검토대상·원hash 누락/변조는 오류다',async()=>{
 const fn=await collector();
 const changes=[(f:any)=>f.tables.documents[0].head_version=9,(f:any)=>f.tables.document_artifact_links.splice(0,1),(f:any)=>f.tables.artifacts.splice(0,1),(f:any)=>f.tables.document_versions[0].content_hash='f'.repeat(64),(f:any)=>f.tables.document_proposals[0].content_hash='f'.repeat(64),(f:any)=>f.tables.content_reviews[0].target_hash='f'.repeat(64),(f:any)=>f.tables.document_confirmations[0].review_refs[0].id=id(999)];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(f.run(fn),rejected(503));assert.equal(f.state.released,1);}
});

test('inventoryCommon 접근 불가 공통 출처는 읽지 않고 부분 의존으로 보존한다',async()=>{
 const fn=await collector(),f=fixture();f.tables.form_definitions![1]!.owner_user_id=id(999);
 const out=await f.run(fn);assert.equal(out.forms.length,1);assert.equal(out.metadataComplete,false);assert(out.externalDependencies.length>0);
 assert(!JSON.stringify(out.forms).includes(id(999)));assert(f.trace.filter(t=>/form_definitions/.test(t.sql)).every(t=>t.values.includes(actorId)));
});

test('inventoryPages 200 keyset 뒤 페이지와 중복·후속오류·transaction설정을 구분한다',async()=>{
 const fn=await collector(),normal=fixture(),base=normal.tables.document_version_events![0]!;
 normal.tables.document_version_events=Array.from({length:201},(_,i)=>({...base,id:id(1000+i)}));const out=await normal.run(fn);assert.equal(out.events.length,201);assert((normal.calls.get('RRdocument_version_events')??0)>=2);
 for(const mode of ['duplicatePage','failPageTable','failTable','wrongIsolation','wrongReadOnly']){const f=fixture();f.tables.document_version_events=clone(normal.tables.document_version_events);if(mode==='failTable')f.state.failTable='document_versions';else if(mode==='failPageTable')f.state.failPageTable='document_version_events';else (f.state as any)[mode]=true;await assert.rejects(f.run(fn),rejected(503));assert.equal(f.state.released,1);}
});

test('inventoryPartial 격리·미완료·검사불명 원문을 정상검증으로 대체하지 않는다',async()=>{
 const fn=await collector();for(const state of ['QUARANTINED','STAGING','FAILED','UNKNOWN_INSPECTION']){const f=fixture();if(state==='UNKNOWN_INSPECTION')f.tables.artifacts![0]!.inspection_json=null;else f.tables.artifacts![0]!.state=state;const out=await f.run(fn);assert.equal(out.metadataComplete,false);assert(out.issues.length>0);assert(out.artifactRefs.every((a:any)=>a.blobVerification==='NOT_PERFORMED'));assert.equal(out.restorable,false);}
});

test('inventoryLimits metadata·원문선언 한도/overflow와 rollback불명을 실패로 보존한다',async()=>{
 const fn=await collector();for(const field of ['metadataBytes','inputBytes','fileCount'] as const){const f=fixture(),request=input();request.limits[field]=1;await assert.rejects(f.run(fn,request),rejected(413));assert.equal(f.state.released,1);}
 const overflow=fixture();overflow.tables.artifacts![0]!.bytes=Number.MAX_SAFE_INTEGER;await assert.rejects(overflow.run(fn),rejected(503));
 const cleanup=fixture();cleanup.state.failTable='document_versions';cleanup.state.rollbackFailure=true;await assert.rejects(cleanup.run(fn),rejected(503));assert.equal(cleanup.state.released,1);assert.equal(cleanup.state.releaseError,true);
});

test('inventoryCurrent 공통 원출처 접근 회수와 다른 프로젝트 행은 반환하지 않는다',async()=>{
 const fn=await collector(),common=fixture();common.state.denyCommonEnd=true;await assert.rejects(common.run(fn),rejected(503));assert.equal(common.state.released,1);
 const other=fixture();other.tables.documents![0]!.project_id=id(999);await assert.rejects(other.run(fn),rejected(503));
});

test('inventoryAfterCommit 마지막 인증 외부COMMIT 뒤 취소·기한도 결과를 폐기한다',async t=>{
 const fn=await collector(),cancelled=fixture();cancelled.state.cancelAfterCommit=true;await assert.rejects(cancelled.run(fn),rejected(409));assert.equal(cancelled.state.released,1);
 let clock=100;t.mock.method(performance,'now',()=>clock);const late=fixture(),request=input();request.limits.deadlineMs=10;late.state.afterCommit=()=>{clock=111;};await assert.rejects(late.run(fn,request),rejected(413));assert.equal(late.state.released,1);
});

test('inventoryRows source head 불일치·200초과·거대row·알려진 비밀표식은 거절한다',async()=>{
 const fn=await collector();
 const head=fixture();head.tables.document_source_links![0]!.current_event_id=id(999);await assert.rejects(head.run(fn),rejected(503));
 const over=fixture();over.state.overPage=true;await assert.rejects(over.run(fn),rejected(503));
 const big=fixture();big.state.oversizeRow=true;await assert.rejects(big.run(fn),rejected(413));
 const secret=fixture();secret.tables.document_version_events![0]!.reason='Bearer syntheticabcdefghijklmnopqrstuvwxyz';await assert.rejects(secret.run(fn),rejected(503));
});


test('inventoryReviewTarget 확정의 실제 검토 ID가 다른 문서를 가리키면 거절한다',async()=>{
 const fn=await collector(),f=fixture(),other=f.tables.document_versions![2]!,review=clone(f.tables.content_reviews![0]!);
 review.id=id(79);review.target_id=other.document_id;review.target_version=other.version;review.target_hash=other.content_hash;
 review.criteria_snapshot_json.formRef={id:other.form_definition_id,version:other.form_version,contentHash:other.form_hash};
 f.tables.content_reviews!.push(review);f.tables.document_confirmations![0]!.review_refs[0].id=review.id;
 await assert.rejects(f.run(fn),rejected(503));assert.equal(f.state.rollback,1);assert.equal(f.state.released,1);
});

test('inventoryStoredShape 저장된 단계 참조 불량은 입력422가 아닌 고정 무결성503이다',async()=>{
 const fn=await collector(),f=fixture();f.tables.document_versions![0]!.stage_ref_json={applicationId:'invalid',nodeId:'N1'};
 await assert.rejects(f.run(fn),rejected(503));assert.equal(f.state.rollback,1);assert.equal(f.state.released,1);
});

test('inventoryQueryDeadline RR 각 자료 query 직전 남은 상한을 갱신한다',async t=>{
 const fn=await collector(),f=fixture();let clock=0;t.mock.method(performance,'now',()=>++clock);
 await f.run(fn);const trace=f.trace.filter(x=>x.scope==='RR');
 const queries=trace.map((x,i)=>({x,i})).filter(({x})=>/WITH inventory_row AS/.test(x.sql));assert(queries.length>10);
 const budgets:number[]=[];for(const{x,i}of queries){assert(i>0);const previous=trace[i-1]!;assert(/set_config/.test(previous.sql),'자료 query 바로 앞 남은 statement_timeout');budgets.push(Number(previous.values[0]));}
 assert(budgets.every((n,i)=>Number.isInteger(n)&&n>0&&(i===0||n<budgets[i-1]!)));
});


test('inventoryReviewShape 검토 저장형식 불량은 거절하고 과거 결과는 재판정하지 않는다',async()=>{
 const fn=await collector();
 for(const change of [(r:any)=>r.items_json[0].outcome='UNKNOWN',(r:any)=>delete r.items_json[0].reason,(r:any)=>r.items_json[0].extra=true,(r:any)=>r.items_json[0].reason=' ',(r:any)=>r.items_json[0].outcome='REWORK']){
  const f=fixture();change(f.tables.content_reviews![0]);await assert.rejects(f.run(fn),rejected(503));assert.equal(f.state.released,1);
 }
 for(const outcome of ['REWORK','BLOCKED','NOT_EXECUTED']){const f=fixture();f.tables.content_reviews![0]!.outcome=outcome;f.tables.content_reviews![0]!.items_json[0].outcome=outcome;f.tables.document_confirmations=[];f.tables.documents![0]!.confirmed_version=null;const out=await f.run(fn);assert.equal(out.reviews[0].outcome,outcome);assert.equal(out.reviews[0].itemsJson[0].outcome,outcome);}
});

test('inventoryOrigins 알려진 원출처를 exact 외부의존과 경로없는 투영으로 보존한다',async()=>{
 const fn=await collector(),f=fixture(),parent=ref(301),draft=ref(302),source=ref(303);
 f.tables.form_definitions![0]!.origin_ref_json={kind:'P01_APPROVED_SOURCE',sourcePath:'synthetic/source-only.md',sourceHash:'a'.repeat(64),productAcceptance:false};
 f.tables.form_definitions![1]!.origin_ref_json={kind:'COPY',parentRef:parent,reason:'과거 복사'};
 f.tables.methodology_definitions![0]!.origin_ref_json={kind:'DRAFT_CONFIRMED_SOURCE',draftRef:draft,confirmationId:id(304),sourceRefs:[source]};
 f.tables.methodology_definitions![1]!.origin_ref_json={kind:'REVISION',parentRef:ref(305)};
 const out=await f.run(fn);for(const r of [parent,draft,source,ref(305)])assert(out.externalDependencies.some((e:any)=>canonicalJson(e.ref)===canonicalJson(r)));
 assert.equal(out.metadataComplete,false);assert(!JSON.stringify(out).includes('synthetic/source-only.md'));
 assert.equal(out.forms[0].contentHash,f.tables.form_definitions![0]!.content_hash);assert.equal(out.methodologies[0].contentHash,f.tables.methodology_definitions![0]!.content_hash);
 assert.deepEqual(out.forms[1].originProjection.parentRef,parent);assert.deepEqual(out.methodologies[0].originProjection.draftRef,draft);
 for(const row of [...out.forms,...out.methodologies])assert.equal(row.originProjectionHash,hash(row.originProjection));
 assert.equal(out.externalDependencies.some((e:any)=>e.ref.contentHash==='a'.repeat(64)),false,'원 sourceHash로 가짜 VersionRef 생성 금지');
});

test('inventoryOriginShape 불량 또는 미지원 원출처는 조용히 누락하지 않는다',async()=>{
 const fn=await collector();for(const origin of [{kind:'COPY',parentRef:{id:id(301)},reason:'합성'},{kind:'UNKNOWN'},{kind:'USER_AUTHORED',reason:'합성',extra:true}]){const f=fixture();f.tables.form_definitions![1]!.origin_ref_json=origin;await assert.rejects(f.run(fn),rejected(503));}
 const f=fixture();f.tables.methodology_definitions![0]!.origin_ref_json={kind:'DRAFT_CONFIRMED_SOURCE',draftRef:ref(302),confirmationId:id(304),sourceRefs:[{id:id(303)}]};await assert.rejects(f.run(fn),rejected(503));
});

test('inventoryBeginUnknown BEGIN 응답 유실 client는 정상 풀에 재사용하지 않는다',async()=>{
 const fn=await collector(),f=fixture();f.state.beginFailure=true;await assert.rejects(f.run(fn),rejected(503));
 assert.equal(f.state.connects,1);assert.equal(f.state.released,1);assert.equal(f.state.releaseError,true);assert.equal(f.state.authCalls,1);assert.equal(f.trace.filter(x=>/WITH inventory_row AS/.test(x.sql)).length,0);
});
