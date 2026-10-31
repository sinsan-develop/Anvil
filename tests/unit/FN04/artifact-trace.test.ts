import assert from 'node:assert/strict';
import test from 'node:test';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ProjectTraces} from '../../../apps/server/modules/traceability/traces.ts';
import {ProjectWorkPlans} from '../../../apps/server/modules/traceability/work-plans.ts';
import {ProjectPolicyRepository,type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import type {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {blankPlanTask} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const id=(n:number)=>`af040000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const pid=id(1),actor:AuthenticatedIdentity={actorId:id(2),clientId:id(3),serverOwner:false,credentialGeneration:1,reauthUntil:null};
 const designRef={id:id(10),version:1,contentHash:'a'.repeat(64)},documentRef={id:id(11),version:2,contentHash:'b'.repeat(64)},formDesign={id:id(12),version:1,contentHash:'c'.repeat(64)},formPlan={id:id(13),version:1,contentHash:'d'.repeat(64)};
 const itemData={documentRef:designRef,localCode:'D1',title:'설계 원형',anchor:'line:1'},item={id:id(14),...itemData,itemHash:hash(itemData)};
 const designLink={kind:'DESIGN_ITEM' as const,id:item.id,versionRef:designRef,localCode:'D1',anchor:'line:1'};
 // 기존 trace-plan-task의 고정 계획 snapshot/hash 원형을 사용한다. 원문 reader는 명시 메모리 대역이다.
 const task={...blankPlanTask(),taskCode:'FN01',title:'원문 업무',purpose:'등록 산출물 추적',ownerRole:'작성자',designRefs:[designLink],inputs:['입력'],outputs:['산출물'],included:['연결'],excluded:['실행'],allowedFileRefs:['선언'],startPrerequisites:[],acceptancePrerequisites:[],steps:['원문 보존'],testCases:[{id:'T1',kind:'NORMAL' as const,steps:['조회'],expected:'일치',environment:'메모리'}],acceptanceCriteria:['일치'],evidenceRequirements:['원형'],rollback:'원연결 보존',recoveryNotes:'미확인 보존'};
 const snapshot={documentRef,designRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'고정 계획',issues:[],relationalProjection:'STORED'},planRef={id:id(15),version:3,contentHash:hash(snapshot)},plan={ref:planRef,status:'DRAFT',...snapshot};
 const raw=Buffer.from('합성 산출물 원문\n'),artifact={id:id(20),project_id:pid,content_hash:contentHash(raw),bytes:raw.length,media_type:'text/plain;charset=utf-8',state:'READY',storage_key:`blobs/${pid}/${id(20)}`};
 const from={kind:'ARTIFACT',id:artifact.id,versionRef:{id:artifact.id,version:1,contentHash:artifact.content_hash}},to={kind:'PLAN_TASK',id:planRef.id,versionRef:planRef,localCode:task.taskCode};
 const request:ProjectCommand={schemaVersion:1,projectId:pid,commandId:id(30),clientId:actor.clientId,controlGeneration:2,operation:'linkTrace',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{from,to,relation:'IMPLEMENTS',reason:'사용자가 고정 업무에 산출물을 연결'}};
 const rules=[{ruleId:id(31),subjectRef:{kind:'HUMAN',userId:actor.actorId},targetScopes:[{kind:'PROJECT',projectId:pid}],operations:['linkTrace'],disposition:'AUTO',expiresAt:'2099-01-01T00:00:00.000Z',limitPolicyRef:null}],policyReason='명시 추적 정책',policyRef={id:id(32),version:1,contentHash:hash({rules,reason:policyReason,reviewRefs:[]})};
 const sqls:string[]=[],inserts:string[]=[],traceRows:any[]=[];let authCalls=0,commandReached=false,memberAllowed=true;
 const query=async(sql:string,args:unknown[]=[])=>{sqls.push(sql);let rows:any[]=[];
  if(sql.startsWith('SELECT p.id,p.archived_at,m.participation')){assert.equal(args[0],pid);assert.equal(args[1],actor.actorId);rows=memberAllowed?[{id:pid,archived_at:null,participation:'OWNER'}]:[];}
  else if(sql.startsWith('SELECT * FROM anvil.project_control'))rows=[{project_id:pid,actor_id:actor.actorId,client_id:actor.clientId,generation:2,revoked_at:null}];
  else if(sql.startsWith('SELECT p.id,p.head_version,v.rules_json'))rows=[{id:policyRef.id,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policyReason,review_refs:[],created_at:new Date('2026-10-01T00:00:00Z')}];
  else if(sql.startsWith('SELECT operation,request_hash,result_ref'))rows=[];
  else if(sql.startsWith('SELECT content_hash,version_json FROM anvil.work_plan_versions')){assert.deepEqual(args,[pid,planRef.id,3]);rows=[{content_hash:planRef.contentHash,version_json:plan}];}
  else if(sql.includes("definition_json->>'formCode'"))rows=[{code:args[0]===formDesign.id?'AF02':'AF04'}];
  else if(sql.startsWith('SELECT item_json FROM anvil.design_items'))rows=[{item_json:item}];
  else if(sql.startsWith('SELECT s.region_json FROM anvil.screen_regions'))rows=[];
  else if(sql.startsWith('SELECT task_code,card_json,card_hash'))rows=[{task_code:task.taskCode,card_json:task,card_hash:hash(task)}];
  else if(sql.startsWith('SELECT task_code,dependency_task_code,phase'))rows=[];
  else if(sql.includes('FROM anvil.artifacts')){assert.equal(args[0],from.id);assert.equal(args[1],pid);if(args[2]!==undefined)assert.equal(args[2],artifact.content_hash);rows=artifact.id===args[0]&&artifact.project_id===args[1]?[artifact]:[];}
  else if(sql.startsWith('SELECT 1 FROM anvil.trace_edges'))rows=traceRows.length?[{exists:1}]:[];
  else if(sql.startsWith('SELECT edge_json,edge_hash,'))rows=traceRows;
  else if(sql.startsWith('SELECT to_id FROM anvil.trace_edges'))rows=[];
  else if(sql.startsWith('SELECT transaction_timestamp()'))rows=[{at:new Date('2026-11-01T00:00:00.000Z')}];
  else if(sql.startsWith('INSERT INTO ')){inserts.push(sql.split('(')[0]!);if(sql.startsWith('INSERT INTO anvil.trace_edges')){const edge=JSON.parse(String(args[12]));traceRows.push({edge_json:edge,edge_hash:edge.edgeHash,id:edge.id,cursor_at:edge.createdAt});}}
  else if(sql.startsWith('SELECT set_config(')){}
  else throw Error('모델링하지 않은 SQL');
  return{rows,rowCount:rows.length};
 };
 const db={query} as unknown as PoolClient;
 const documents={version:async(_db:PoolClient,_actor:AuthenticatedIdentity,projectId:string,docId:string,version:number)=>{assert.equal(projectId,pid);const r=docId===designRef.id?designRef:documentRef;assert.equal(docId,r.id);assert.equal(version,r.version);return{...r,title:docId===designRef.id?'설계':'계획',formRef:docId===designRef.id?formDesign:formPlan,content:{body:{artifactId:id(40),bytes:0,contentHash:contentHash(''),mediaType:'text/plain;charset=utf-8'}},contentReviews:[]};},originalText:async()=> 'D1 설계 원형'} as unknown as ProjectDocuments;
 const access={authenticated:async(_token:string,_csrf:string|null,body:(db:PoolClient,actor:AuthenticatedIdentity)=>Promise<unknown>)=>{authCalls++;return body(db,actor);}} as unknown as AccessRepository;
 const policies=new ProjectPolicyRepository(access),traces=new ProjectTraces(documents);
 return{pid,actor,planRef,designRef,plan,documents,db,artifact,request,policyRef,sqls,inserts,traces,denyMember(){memberAllowed=false;},authCalls:()=>authCalls,commandReached:()=>commandReached,async link(){return policies.command('memory-session','memory-csrf',request,(db,actor,policy)=>{commandReached=true;return traces.link(db,actor,request,policy);});}};
}
test('READY산출물의원byteshash와고정계획업무를명시IMPLEMENTS로저장한다',async()=>{const f=fixture();const original=structuredClone(f.request);const read=await new ProjectWorkPlans(f.documents).read(f.db,f.actor,f.pid,f.planRef.id,f.planRef.version);assert.deepEqual(read.ref,f.planRef);assert.equal(f.artifact.state,'READY');assert.equal(f.artifact.project_id,f.pid);let result:any;try{result=await f.link();}catch(error){assert(error instanceof AuthFailure);assert.equal(error.message,'TRACE_SOURCE_NOT_READY');assert.equal(error.statusCode,412);assert.equal(f.commandReached(),true);assert(f.authCalls()>0);assert.equal(f.inserts.some(s=>s.includes('trace_edges')),false);throw error;}assert.equal(result.status,'APPLIED');assert.equal(result.data.status,'TRACE_LINKED');assert.deepEqual(result.data.edge.from,f.request.payload.from);assert.deepEqual(result.data.edge.to,f.request.payload.to);assert.equal(result.data.edge.relation,'IMPLEMENTS');assert.deepEqual(f.request,original);assert.equal(f.inserts.filter(s=>s==='INSERT INTO anvil.trace_edges').length,1);});

test('산출물연결의정역조회는동일edgehash와고정업무를재검산하며격리뒤읽기는닫힌다',async()=>{const f=fixture(),saved:any=await f.link();const {ProjectListCodec}=await import('../../../apps/server/modules/projects/service.ts');const codec=new ProjectListCodec(()=> 'a'.repeat(64));for(const direction of['FORWARD','REVERSE']){const v=await f.traces.read(f.db,f.actor,f.pid,{designId:f.designRef.id,version:'1',direction},codec);assert.equal(v.edges.length,1);assert.deepEqual(v.edges[0],saved.data.edge);assert.deepEqual(v.traversal[0]?.from,direction==='FORWARD'?f.request.payload.from:f.request.payload.to);assert.equal(v.nodes.find(n=>n.ref.kind==='ARTIFACT')?.title,'등록 산출물 참조');}f.artifact.state='QUARANTINED';await assert.rejects(f.traces.read(f.db,f.actor,f.pid,{designId:f.designRef.id,version:'1'},codec),(e:any)=>e.statusCode===412&&e.message==='ARTIFACT_QUARANTINED');});
test('격리없음교차권한hash버전idanchorcode와다른관계는새연결행없이거절한다',async()=>{for(const kind of['QUARANTINED','MISSING','MEMBER','HASH','VERSION','ID','ANCHOR','CODE','RELATION','REVERSE','UNSUPPORTED']){const f=fixture(),from=f.request.payload.from as any;if(kind==='QUARANTINED')f.artifact.state='QUARANTINED';if(kind==='MISSING')f.artifact.id=id(99);if(kind==='MEMBER')f.denyMember();if(kind==='HASH')from.versionRef.contentHash='f'.repeat(64);if(kind==='VERSION')from.versionRef.version=2;if(kind==='ID')from.versionRef.id=id(99);if(kind==='ANCHOR')from.anchor='line:1';if(kind==='CODE')from.localCode='A1';if(kind==='RELATION')f.request.payload.relation='REFINES';if(kind==='REVERSE'){f.request.payload.from=f.request.payload.to;f.request.payload.to=from;}if(kind==='UNSUPPORTED')from.kind='TEST_EVIDENCE';await assert.rejects(f.link(),(e:any)=>e instanceof AuthFailure);assert.equal(f.inserts.filter(s=>s==='INSERT INTO anvil.trace_edges').length,0,kind);assert(!f.sqls.some(sql=>sql.includes('anvil.artifacts')&&/FOR SHARE|FOR UPDATE/.test(sql)));}});

test('READY검사metadata의SUSPECTED와잘못된V1형식은bytes읽기없이503으로닫는다',async()=>{for(const extra of[{state:'SUSPECTED'},{policyVersion:2},{reasonCodes:['SECRET_ASSIGNMENT_MARKER']},{extra:true}]){const f=fixture();Object.assign(f.artifact,{inspection_json:{policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'NO_KNOWN_MARKER',reasonCodes:[],...extra}});await assert.rejects(f.link(),(e:any)=>e.statusCode===503&&e.message==='ARTIFACT_INSPECTION_INTEGRITY_FAILED');assert.equal(f.inserts.filter(s=>s==='INSERT INTO anvil.trace_edges').length,0);}});
