import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AuthFailure,type AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';
import type {ArtifactByteReader} from '../../../apps/server/modules/backups/artifact-byte-verification.ts';

// 실제 collector/current/byte 함수를 소비한다. DB와 원문만 공개 메모리 모델이며 실제 PG/FS가 아니다.
const id=(n:number)=>`b2000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pid=id(1),actorId=id(2),clientId=id(3),sessionId=id(4),aId=id(40),bId=id(41),token='u'.repeat(43),at=new Date('2026-10-29T00:00:00.000Z');
const marker='public-fixture-private-error',hiddenTitle='반환에서 제외할 공개 문서 제목',hiddenForm='반환에서 제외할 공개 양식 내용';
const clone=<T>(v:T):T=>structuredClone(v),hash=(v:unknown)=>contentHash(canonicalJson(v)),byteHash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
async function verifier():Promise<(a:AccessRepository,t:string,v:unknown,r:ArtifactByteReader,s:AbortSignal)=>Promise<any>>{const u=new URL('../../../apps/server/modules/backups/artifact-current-verification.ts',import.meta.url),m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.verifyDocumentInventoryArtifacts,'function','문서 목록 원문 연결 미구현');return m.verifyDocumentInventoryArtifacts;}
const rejected=(status:number)=>(e:any)=>e instanceof AuthFailure&&e.statusCode===status&&/^(ARTIFACT_CURRENT_|DOCUMENT_INVENTORY_|INPUT_INVALID|AUTH_REQUIRED|NOT_FOUND)/.test(e.message)&&!e.cause&&!String(e.stack).includes(marker)&&!JSON.stringify(e).includes(marker)&&!JSON.stringify(e).includes(token);
function fixture(){
 const input={projectId:pid,limits:{metadataBytes:1048576,inputBytes:1048576,fileCount:10,deadlineMs:60000}};
 const originals=new Map([[aId,new TextEncoder().encode('공개 원문 A')],[bId,new TextEncoder().encode('공개 원문 B 내용')]]);
 const artifacts=[...originals].map(([n,bytes])=>({id:n,project_id:pid,bytes:bytes.length,content_hash:byteHash(bytes),media_type:'text/plain;charset=utf-8',state:'READY',inspection_json:inspectArtifact(bytes)}));
 const ar=(index:number)=>{const a=artifacts[index]!;return{artifactId:a.id,bytes:a.bytes,contentHash:a.content_hash,mediaType:a.media_type};};
 const standard={id:id(10),version:1,contentHash:'9'.repeat(64)};
 const definition={formCode:'AF01',name:'공개 양식',purpose:hiddenForm,scope:'SYSTEM',authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'사용자',requiredInputs:[],items:[{itemId:'I1',title:'요구',required:true,valueType:'TEXT',repeated:false,fields:[],authoringRules:['명시'],reviewCriteria:['대조']}],authoringStandardRef:standard};
 const form={id:id(11),scope:'SYSTEM',owner_user_id:null,project_id:null,form_code:'AF01',name:definition.name,version:1,definition_json:definition,content_hash:hash(definition),authoring_standard_id:standard.id,authoring_standard_version:1,authoring_standard_hash:standard.contentHash,authoring_standard_ref:standard,origin_ref_json:null,created_by:null,created_at:at};
 const formRef={id:form.id,version:1,contentHash:form.content_hash};
 const versions=[50,51].map((doc,index)=>{const content={body:ar(index),attachments:[ar(1-index)],sections:[{itemId:'I1',anchor:'line:1'}],sourceRefs:[]},title=hiddenTitle+doc;return{project_id:pid,document_id:id(doc),version:1,form_definition_id:form.id,form_version:1,form_hash:form.content_hash,stage_ref_json:null,body_artifact_id:content.body.artifactId,title,source_refs_json:[],content_json:content,content_hash:hash({title,formRef,stageNodeRef:null,content}),sections_json:content.sections,author_ref_json:{kind:'HUMAN',userId:actorId},validation_json:{formatOnly:true},reason:'공개 합성',client_id:clientId,command_id:id(100+doc),created_at:at};});
 const tables:Record<string,any[]>={documents:versions.map(v=>({id:v.document_id,project_id:pid,title:v.title,head_version:1,confirmed_version:null,created_by:actorId,created_at:at,updated_at:at})),document_versions:versions,
  document_artifact_links:versions.flatMap(v=>[{project_id:pid,document_id:v.document_id,version:1,artifact_id:v.content_json.body.artifactId,kind:'BODY'},{project_id:pid,document_id:v.document_id,version:1,artifact_id:v.content_json.attachments[0]!.artifactId,kind:'ATTACHMENT'}]),
  document_imports:[],document_import_selections:[],document_proposals:[],document_proposal_selections:[],content_reviews:[],document_version_events:[],document_confirmations:[],document_source_links:[],document_source_link_events:[],project_methodologies:[],methodology_definitions:[],artifacts,form_definitions:[form],authoring_standard_versions:[{id:standard.id,version:1,content_hash:standard.contentHash,created_at:at}]};
 const abort=new AbortController(),trace:Array<{op:string;scope:string;phase:number;sql?:string;values?:unknown[];artifactId?:string}>=[],opened:string[]=[],closed:string[]=[];
 const state={authCalls:0,activeRC:0,activeRR:0,connects:0,releases:0,rollbacks:0,member:'OWNER',archived:false,changeIdentityPhase:0,changeIdentityField:'actorId',failTable:'',duplicateArtifacts:false,readError:'',closeError:'',mutateFirstAfterSecond:false,cancelFinalCommit:false,afterClose:null as null|((artifactId:string)=>void),beforeAuth:null as null|((phase:number)=>void),afterCommit:null as null|((phase:number)=>void),readBytes:new Map(originals),declaredSessionMs:600000};
 const flat=(values:unknown[]):unknown[]=>values.flatMap(v=>Array.isArray(v)?flat(v):[v]);
 const keys=(table:string)=>table==='document_versions'?['document_id','version']:table==='document_artifact_links'?['document_id','version','artifact_id','kind']:['form_definitions','methodology_definitions','authoring_standard_versions'].includes(table)?['id','version']:['id'];
 async function query(scope:string,sql:string,values:unknown[]=[]){
  trace.push({op:'QUERY',scope,phase:state.authCalls,sql,values:clone(values)});assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|GRANT)\b/i.test(sql),'영속 쓰기0');
  if(/^BEGIN/.test(sql)){assert.equal(scope,'RR');assert(/REPEATABLE READ READ ONLY/.test(sql));return{rows:[],rowCount:0};}
  if(/^ROLLBACK/.test(sql)){state.rollbacks++;return{rows:[],rowCount:0};}
  assert(!/^COMMIT/.test(sql),'collector RR은 rollback 종료');
  if(/set_config/.test(sql)){assert(/statement_timeout/.test(sql));const n=Number(values[0]);assert(Number.isSafeInteger(n)&&n>0&&n<=input.limits.deadlineMs);return{rows:[{set_config:String(n)}],rowCount:1};}
  if(/current_setting|clock_timestamp|pg_current_snapshot/.test(sql)&&!/FROM anvil\./.test(sql))return{rows:[{isolation:scope==='RR'?'repeatable read':'read committed',read_only:scope==='RR'?'on':'off',snapshot:'1:20:',at}],rowCount:1};
  if(/FROM anvil\.projects\b/.test(sql)){assert(values.includes(pid)&&values.includes(actorId));return{rows:[{id:pid,participation:state.member,archived_at:state.archived?at:null}],rowCount:1};}
  const table=/\bFROM anvil\.([a-z_]+)/.exec(sql)?.[1];assert(table&&Object.hasOwn(tables,table),'허용표만 조회');assert(!/SELECT\s+(?:\w+\.)?\*/.test(sql),'명시열만 조회');if(state.failTable===table)throw Object.assign(Error(marker),{cause:marker});
  const selection=flat(values);
  if(table==='artifacts'&&scope==='RC'&&!/inventory_row/.test(sql)){
   assert(values.includes(pid)&&/storage_key/.test(sql));const selected=artifacts.filter(a=>selection.includes(a.id));return{rows:selected.map(a=>({...clone(a),draft_id:null,storage_key:`blobs/${pid}/${a.id}`})),rowCount:selected.length};
  }
  if(!['form_definitions','methodology_definitions','authoring_standard_versions'].includes(table)){assert.equal(scope,'RR');assert(selection.includes(pid));}
  assert(/inventory_row/.test(sql)&&/CASE\s+WHEN/.test(sql)&&/LIMIT 200/.test(sql));
  let rows=clone(tables[table]!);if(['artifacts','form_definitions','methodology_definitions','authoring_standard_versions','project_methodologies'].includes(table))rows=rows.filter(r=>selection.includes(r.id));
  const k=keys(table);rows.sort((a,b)=>{for(const field of k){const d=typeof a[field]==='number'?a[field]-b[field]:String(a[field]).localeCompare(String(b[field]));if(d)return d;}return 0;});if(table==='artifacts'&&state.duplicateArtifacts&&rows.length)rows.push(clone(rows[0]));
  const cap=Number(values.at(-1));return{rows:rows.map(r=>{const json=JSON.stringify(r),row_bytes=Buffer.byteLength(json);return{inventory_data:row_bytes>cap?null:JSON.parse(json),row_bytes};}),rowCount:rows.length};
 }
 const access={pool:{async connect(){assert.equal(state.activeRC,0,'RC 종료 후 RR 취득');assert.equal(state.activeRR,0);state.connects++;state.activeRR++;return{query:(sql:string,values?:unknown[])=>query('RR',sql,values),release(){assert.equal(state.activeRR,1);state.activeRR--;state.releases++;trace.push({op:'RELEASE',scope:'RR',phase:state.authCalls});}};}},
  async authenticated(given:string,csrf:string|null,body:any){assert.equal(given,token);assert.equal(csrf,null);assert.equal(state.activeRC,0);assert.equal(state.activeRR,0);const phase=++state.authCalls;state.beforeAuth?.(phase);state.activeRC++;trace.push({op:'BEGIN',scope:'RC',phase});const a:any={actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:sessionId,idleExpiresAt:new Date(at.getTime()+state.declaredSessionMs).toISOString(),absoluteExpiresAt:new Date(at.getTime()+3600000).toISOString()}};
   if(phase===state.changeIdentityPhase){if(state.changeIdentityField==='session')a.authSession.id=id(99);else a[state.changeIdentityField]=state.changeIdentityField==='credentialGeneration'?2:id(99);}
   try{const result=await body({query:(sql:string,values?:unknown[])=>query('RC',sql,values)},a);trace.push({op:'COMMIT',scope:'RC',phase});state.activeRC--;const currentIds=trace.filter(t=>t.phase===phase&&t.scope==='RC'&&t.sql?.includes('FROM anvil.artifacts')&&!t.sql?.includes('inventory_row')).flatMap(t=>(t.values??[]).filter(v=>v===aId||v===bId));
    if(state.mutateFirstAfterSecond&&closed.length===2&&currentIds.length===1&&currentIds[0]===bId)artifacts[0]!.state='QUARANTINED';
    if(state.cancelFinalCommit&&closed.length===2&&new Set(currentIds).size===2)abort.abort();state.afterCommit?.(phase);return result;
   }finally{if(state.activeRC)state.activeRC--;trace.push({op:'RELEASE',scope:'RC',phase});}
  }}as unknown as AccessRepository;
 const reader:ArtifactByteReader={async open(ref,signal){assert.equal(state.activeRC,0);assert.equal(state.activeRR,0);assert.equal(signal,abort.signal);assert.equal(ref.projectId,pid);assert(!opened.includes(ref.artifactId),'artifact당 자동 재읽기0');const expected=artifacts.find(a=>a.id===ref.artifactId);assert(expected);assert.equal(expected.content_hash,ref.contentHash);assert.equal(expected.bytes,ref.bytes);opened.push(ref.artifactId);trace.push({op:'OPEN',scope:'FILE',phase:state.authCalls,artifactId:ref.artifactId});let position=0,done=false;
  return{async read(max,readSignal){assert.equal(readSignal,abort.signal);assert.equal(state.activeRC,0);assert.equal(state.activeRR,0);assert(!done);if(state.readError===ref.artifactId)throw Object.assign(Error(marker),{cause:marker});const source=state.readBytes.get(ref.artifactId)!;const result=source.subarray(position,position+Math.min(max,4));position+=result.length;return result;},async close(){assert(!done);done=true;closed.push(ref.artifactId);trace.push({op:'CLOSE',scope:'FILE',phase:state.authCalls,artifactId:ref.artifactId});state.afterClose?.(ref.artifactId);if(state.closeError===ref.artifactId)throw Object.assign(Error(marker),{cause:marker});}};
 }};
 return{input,tables,artifacts,originals,state,trace,opened,closed,abort,access,reader,run:async()=>{const fn=await verifier();return fn(access,token,input,reader,abort.signal);}};
}

test('inventoryBytes 실제 수집2원문·4참조는 각1회·마지막 전체상태·본문반환0',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.kind,'DOCUMENT_INVENTORY_ARTIFACT_VERIFICATION_V1');assert.equal(r.projectId,pid);assert.match(r.inventory.contentHash,/^[a-f0-9]{64}$/);assert.equal(r.inventory.observation.snapshot,'1:20:');assert.equal(r.inventory.observation.isolation,'repeatable read');assert.equal(r.inventory.metadataComplete,true);assert.equal(r.inventory.issueCount,0);assert.equal(r.inventory.externalDependencyCount,0);assert.equal(r.artifacts.length,2);assert.deepEqual(f.opened,[aId,bId]);assert.deepEqual(f.closed,[aId,bId]);assert.equal(f.state.connects,1);assert.equal(f.state.rollbacks,1);assert.equal(f.state.releases,1);
 for(const x of r.artifacts){assert.equal(x.status,'VERIFIED');assert.equal(x.verification.byteVerification.byteIntegrity,'MATCH');assert.equal(x.verification.byteVerification.authorityVerified,false);assert.equal(x.verification.byteVerification.sourceStabilityVerified,false);assert.equal(x.verification.restorable,false);}
 assert.deepEqual(r.usage,{fileCount:2,inputBytes:f.artifacts.reduce((n,a)=>n+a.bytes,0),verifiedCount:2,unverifiedCount:0,verifiedBytes:f.artifacts.reduce((n,a)=>n+a.bytes,0),metadataBytes:Buffer.byteLength(canonicalJson(r))});for(const k of ['atomicSnapshotVerified','fullProjectCoverage','restorable'])assert.equal(r[k],false);
 const last=f.state.authCalls,lastQueries=f.trace.filter(t=>t.phase===last&&t.sql?.includes('FROM anvil.artifacts'));assert.equal(lastQueries.length,2);assert(lastQueries.every(t=>t.scope==='RC'));const output=JSON.stringify(r);for(const v of [hiddenTitle,hiddenForm,token,actorId,clientId,sessionId,'storage_key','blobs/','definitionJson','contentJson'])assert(!output.includes(v));
});

test('inventoryBytes 실제 빈 수집도 시작/종료OWNER 유지·0검사를 전체성공으로 승격0',async()=>{
 const f=fixture();for(const table of Object.keys(f.tables))f.tables[table]=[];const r=await f.run();assert.equal(r.artifacts.length,0);assert.equal(r.usage.verifiedCount,0);assert.equal(r.usage.fileCount,0);assert.equal(r.fullProjectCoverage,false);assert.equal(r.restorable,false);assert.equal(f.state.connects,1);assert.equal(f.opened.length,0);assert(f.state.authCalls>=4);assert(f.trace.some(t=>t.phase===f.state.authCalls&&t.sql?.includes('FROM anvil.projects')));
});

test('inventoryBytes 격리와UNKNOWN은 수집시점 사유만·읽기0',async()=>{
 const f=fixture();f.artifacts[0]!.state='QUARANTINED';f.artifacts[1]!.inspection_json=null as any;const r=await f.run();assert.deepEqual(f.opened,[]);assert.deepEqual(r.artifacts.map((x:any)=>[x.status,x.reasonCode,x.sourceState,x.sourceInspectionStatus]),[['NOT_VERIFIED','ARTIFACT_NOT_READY','QUARANTINED','NO_KNOWN_MARKER'],['NOT_VERIFIED','ARTIFACT_INSPECTION_UNKNOWN','READY','UNKNOWN']]);assert.equal(r.usage.verifiedCount,0);assert.equal(r.usage.unverifiedCount,2);assert.equal(r.inventory.metadataComplete,false);assert.equal(r.inventory.issueCount,2);assert.equal(r.fullProjectCoverage,false);
});

test('inventoryBytes 혼합 목록은 eligible만 읽고 기존 skip은 유지',async()=>{
 const f=fixture();f.artifacts[1]!.inspection_json=null as any;const r=await f.run();assert.deepEqual(f.opened,[aId]);assert.equal(r.usage.verifiedCount,1);assert.equal(r.usage.unverifiedCount,1);assert.equal(r.artifacts[1].status,'NOT_VERIFIED');
});

test('inventoryBytes collector callback 전에 최초actor/client/session/세대 대조',async()=>{
 for(const field of ['actorId','clientId','session','credentialGeneration']){const f=fixture();f.state.changeIdentityPhase=2;f.state.changeIdentityField=field;await assert.rejects(f.run(),rejected(401));assert.equal(f.state.connects,0);assert.equal(f.trace.filter(t=>t.phase===2&&t.op==='QUERY').length,0,'교체된 신원으로 collector SQL0');assert.equal(f.opened.length,0);}
});

test('inventoryBytes 앞원문 검사후 뒤늦은 격리는 최종전체RC에서 결과차단',async()=>{
 const f=fixture();f.state.mutateFirstAfterSecond=true;await assert.rejects(f.run(),rejected(412));assert.deepEqual(f.opened,[aId,bId]);assert.deepEqual(f.closed,[aId,bId]);assert.equal(f.artifacts[0]!.state,'QUARANTINED');
});

test('inventoryBytes 최초eligible의 검증중 오류를 skip/retry로 바꾸지 않음',async()=>{
 for(const errorKind of ['read','close','hash']){const f=fixture();if(errorKind==='read')f.state.readError=aId;if(errorKind==='close')f.state.closeError=aId;if(errorKind==='hash'){const b=Uint8Array.from(f.originals.get(aId)!);b[0]=b[0]!^1;f.state.readBytes.set(aId,b);}await assert.rejects(f.run(),rejected(503));assert.deepEqual(f.opened,[aId]);assert.deepEqual(f.closed,[aId]);}
});

test('inventoryBytes 총fileCount/inputBytes/metadataBytes 부족은 원문IO0',async()=>{
 for(const kind of ['fileCount','inputBytes','metadataBytes']){const f=fixture();f.input.limits[kind as keyof typeof f.input.limits]=kind==='fileCount'?1:kind==='inputBytes'?f.artifacts.reduce((n,a)=>n+a.bytes,0)-1:64;await assert.rejects(f.run(),rejected(413));assert.equal(f.opened.length,0);assert.equal(f.state.activeRR,0);assert.equal(f.state.activeRC,0);}
});

test('inventoryBytes 외부inventory·accessor 입력은 인증/수집0',async()=>{
 const fn=await verifier();for(const accessor of [false,true]){const f=fixture(),value:any=clone(f.input);if(accessor)Object.defineProperty(value,'limits',{enumerable:true,get(){throw Error(marker);}});else value.inventory={artifactRefs:[]};await assert.rejects(fn(f.access,token,value,f.reader,f.abort.signal),rejected(400));assert.equal(f.state.authCalls,0);assert.equal(f.state.connects,0);assert.equal(f.opened.length,0);}
});

test('inventoryBytes 수집 duplicate/변조/DB실패는 원문IO0·원오류 비노출',async()=>{
 for(const kind of ['duplicate','hash','db']){const f=fixture();if(kind==='duplicate')f.state.duplicateArtifacts=true;if(kind==='hash')f.tables.document_versions![0].content_hash='0'.repeat(64);if(kind==='db')f.state.failTable='documents';await assert.rejects(f.run(),rejected(503));assert.equal(f.opened.length,0);assert.equal(f.state.activeRR,0);assert.equal(f.state.activeRC,0);}
});

test('inventoryBytes 첫close뒤권한회수·취소·총기한은 뒤원문IO0',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);for(const kind of ['owner','cancel','deadline']){now=0;const f=fixture();f.input.limits.deadlineMs=100;f.state.afterClose=n=>{if(n!==aId)return;if(kind==='owner')f.state.member='VIEWER';else if(kind==='cancel')f.abort.abort();else now=101;};await assert.rejects(f.run(),rejected(kind==='owner'?404:kind==='cancel'?409:413));assert.deepEqual(f.opened,[aId]);assert.deepEqual(f.closed,[aId]);}
});

test('inventoryBytes 최초 세션기한은 원문마다 새로 연장되지 않음',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);const f=fixture();f.input.limits.deadlineMs=10000;f.state.declaredSessionMs=1000;f.state.afterClose=n=>{now=n===aId?600:1001;};await assert.rejects(f.run(),rejected(413));assert.deepEqual(f.opened,[aId,bId]);assert.deepEqual(f.closed,[aId,bId]);
});

test('inventoryBytes 최종 외부 COMMIT 뒤 취소는 결과 반환0·파일재읽기0',async()=>{
 const f=fixture();f.state.cancelFinalCommit=true;await assert.rejects(f.run(),rejected(409));assert.deepEqual(f.opened,[aId,bId]);assert.deepEqual(f.closed,[aId,bId]);assert.equal(f.state.activeRC,0);
});

test('inventoryBytes close불명과취소가동시면503·후속읽기0',async()=>{
 const f=fixture();f.state.closeError=aId;f.state.afterClose=()=>f.abort.abort();await assert.rejects(f.run(),rejected(503));assert.deepEqual(f.opened,[aId]);assert.deepEqual(f.closed,[aId]);
});

test('inventoryBytes collector에서 단축 관측한 세션기한은 후속 연장으로 복구되지 않음',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);const f=fixture();f.input.limits.deadlineMs=10000;f.state.declaredSessionMs=1000;
 f.state.beforeAuth=phase=>{if(phase===2)f.state.declaredSessionMs=500;if(phase===3)now=400;if(phase===4)f.state.declaredSessionMs=1000;};
 f.state.afterClose=n=>{if(n===aId)now=600;};
 await assert.rejects(f.run(),rejected(413));assert.deepEqual(f.opened,[aId]);assert.deepEqual(f.closed,[aId]);
});
