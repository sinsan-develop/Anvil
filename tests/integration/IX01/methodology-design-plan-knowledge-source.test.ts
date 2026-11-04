import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,realpath,lstat,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {registerJourneyClose,closeJourneyContext,type JourneyOwnedResource} from './journey-context-lifecycle.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import {ProjectWorkPlans} from '../../../apps/server/modules/traceability/work-plans.ts';
import {ProjectMethodologies} from '../../../apps/server/modules/methodologies/project-methodologies.ts';
import {buildOfficialForms,type FormDefinition} from '../../../apps/server/modules/documents/forms.ts';
import {seedOfficialForms} from '../../../apps/server/modules/documents/catalog-seed.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {seedBuiltinMethodologies} from '../../../apps/server/modules/methodologies/catalog-seed.ts';
import {methodContentReviewCriteria} from '../../../apps/server/modules/methodologies/content-review.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {newDocument,prepareDocumentSave,continueDocumentSave} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {readDocument,listDocuments} from '../../../apps/web/src/features/design-trace/api.ts';
import {newDocumentReview,prepareDocumentReview,sendDocumentReview} from '../../../apps/web/src/features/design-trace/review-api.ts';
import {newDocumentConfirmation,prepareDocumentConfirmation,sendDocumentConfirmation} from '../../../apps/web/src/features/design-trace/confirmation-api.ts';
import {readWorkPlan,prepareStoredWorkPlan} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
import {readWorkPlanDecision,newWorkPlanDecision,prepareWorkPlanDecision,sendWorkPlanDecision} from '../../../apps/web/src/features/design-trace/work-plan-decision-api.ts';
import {fenceResultQaPool} from '../FN12/result-qa-fence.ts';

import {newKnowledge,prepareKnowledge,sendKnowledge,readKnowledge,searchKnowledge} from '../../../apps/web/src/features/knowledge/api.ts';
import {newTaskTrace,prepareTaskTrace,sendTaskTrace,readTrace} from '../../../apps/web/src/features/design-trace/trace-api.ts';
import {ProjectKnowledge} from '../../../apps/server/modules/knowledge/knowledge.ts';
import {ProjectTraces} from '../../../apps/server/modules/traceability/traces.ts';
import {ProjectListCodec} from '../../../apps/server/modules/projects/service.ts';
import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import type {TaskCard} from '../../../apps/server/modules/traceability/work-plan-card.ts';

/** IX01 실행용 source 준비. PG/화면/사용자 인수 PASS가 아니며 이 파일은 아직 실행하지 않았다.
 * 대형 SQL fake가 없다. 별도 실행 승인·최신 schema/자원 binding이 채택되기 전에는 연결보다 앞에서 거절한다.
 * 이 파일은 DB/container/network/root를 생성·삭제하거나 migration을 적용하지 않는다. */
interface ApprovedExecution {
 schemaVersion:1;purpose:'IX01_ACTUAL_JOURNEY_EXECUTION_PLAN';sourceHead:string;cwd:string;uid:number;host:string;database:string;artifactRoot:string;issuedAt:string;expiresAt:string;
 sourceFiles:readonly {path:string;sha256:string}[];migrations:readonly {id:string;checksum:string;path:string}[];migrationPlanHash:string;
 ownerMarker:{path:string;sha256:string};
}
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const publicHash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const iso=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const sourcePath=(v:unknown):v is string=>typeof v==='string'&&/^(apps|contracts|scripts|tests|db|docs)\//.test(v)&&!/[\\:%\u0000-\u001f]/.test(v)&&!v.split('/').some(x=>!x||x.startsWith('.'))&&/\.(ts|tsx|mts|cjs|json|md|sql|sql\.pending)$/.test(v);
/** 실행 계획의 일치 검산이지 사람 승인/제품 인증이 아니다. 계획 원문은 공개 metadata만 허용한다. */
function readExecutionPlan(env:NodeJS.ProcessEnv):ApprovedExecution {
 if(env.ANVIL_IX01_ACTUAL_OPT_IN!=='APPROVED')throw Error('IX01_ACTUAL_EXECUTION_NOT_OPTED_IN');
 const raw=env.ANVIL_IX01_EXECUTION_PLAN,digest=env.ANVIL_IX01_EXECUTION_PLAN_SHA256;
 if(typeof raw!=='string'||raw.length>65536||Buffer.byteLength(raw)>65536||!publicHash(digest)||contentHash(raw)!==digest)throw Error('IX01_EXECUTION_PLAN_REQUIRED');
 let v:unknown;try{v=parseWireJson(raw);}catch{throw Error('IX01_EXECUTION_PLAN_INVALID');}
 assert(exact(v,['schemaVersion','purpose','sourceHead','cwd','uid','host','database','artifactRoot','issuedAt','expiresAt','sourceFiles','migrations','migrationPlanHash','ownerMarker']),'IX01_EXECUTION_PLAN_SHAPE');
 assert(v.schemaVersion===1&&v.purpose==='IX01_ACTUAL_JOURNEY_EXECUTION_PLAN');assert(typeof v.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(v.sourceHead));
 assert(typeof v.cwd==='string'&&v.cwd.startsWith('/')&&resolve(v.cwd)===v.cwd);assert(typeof v.uid==='number'&&Number.isSafeInteger(v.uid)&&v.uid>0);
 assert(typeof v.host==='string'&&/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(v.host)&&v.host.split('.').every(x=>Number(x)<=255));
 assert(typeof v.database==='string'&&/^anvil_v3_ix01_[a-z0-9_]{8,48}$/.test(v.database));
 assert(typeof v.artifactRoot==='string'&&/^\/tmp\/anvil-v3-ix01-[a-z0-9-]{8,64}\/artifacts$/.test(v.artifactRoot));
 assert(iso(v.issuedAt)&&iso(v.expiresAt)&&Date.parse(v.issuedAt)<=Date.now()&&Date.parse(v.expiresAt)>Date.now()&&Date.parse(v.expiresAt)-Date.parse(v.issuedAt)<=600000);
 assert(Array.isArray(v.sourceFiles)&&v.sourceFiles.length>0);const sourceFiles=v.sourceFiles.map(row=>{assert(exact(row,['path','sha256'])&&sourcePath(row.path)&&publicHash(row.sha256));return{path:row.path,sha256:row.sha256};});assert.equal(new Set(sourceFiles.map(r=>r.path)).size,sourceFiles.length);
 assert(sourceFiles.some(r=>r.path==='tests/integration/IX01/methodology-design-plan-knowledge-source.test.ts'),'시험 자신도 source binding에 포함');
 assert(Array.isArray(v.migrations)&&v.migrations.length>0);const migrations=v.migrations.map(row=>{assert(exact(row,['id','checksum','path'])&&typeof row.id==='string'&&/^[a-z0-9_]+$/.test(row.id)&&publicHash(row.checksum)&&sourcePath(row.path)&&row.path.startsWith('db/migrations/')&&(row.path==='db/migrations/'+row.id+'.sql'||row.path==='db/migrations/'+row.id+'.sql.pending'));return{id:row.id,checksum:row.checksum,path:row.path};});
 assert.equal(new Set(migrations.map(r=>r.id)).size,migrations.length);assert(publicHash(v.migrationPlanHash)&&v.migrationPlanHash===contentHash(canonicalJson(migrations)),'명시된 순서도 원문 hash에 결박');
 assert(exact(v.ownerMarker,['path','sha256'])&&v.ownerMarker.path===v.artifactRoot+'/owner.json'&&publicHash(v.ownerMarker.sha256));
 return{schemaVersion:1,purpose:'IX01_ACTUAL_JOURNEY_EXECUTION_PLAN',sourceHead:v.sourceHead,cwd:v.cwd,uid:v.uid,host:v.host,database:v.database,artifactRoot:v.artifactRoot,issuedAt:v.issuedAt,expiresAt:v.expiresAt,sourceFiles,migrations,migrationPlanHash:v.migrationPlanHash,ownerMarker:{path:v.ownerMarker.path,sha256:v.ownerMarker.sha256}};
}
const same=(a:unknown,b:unknown)=>assert.equal(canonicalJson(a),canonicalJson(b));

test('IX01 실제 저장 여정 source — 명시 승인·최신 manifest·새 자원 전에는 실행 불가',{
 skip:process.env.ANVIL_IX01_ACTUAL_OPT_IN!=='APPROVED'?'실제 실행 미승인: NOT_RUN이며 PASS가 아님':false,timeout:90000,
},async t=>{
 // opt-in/공개 계획이 없거나 잘못되면 파일/Secret/Pool보다 먼저 거절한다.
 const binding=readExecutionPlan(process.env),until=Date.parse(binding.expiresAt),fresh=()=>assert(!t.signal.aborted&&Date.now()<until,'IX01_QA_EXPIRED');fresh();
 assert.equal(process.platform,'linux');assert.equal(process.getuid?.(),binding.uid);assert.equal(await realpath(process.cwd()),binding.cwd);
 assert.equal(execFileSync('/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),binding.sourceHead);fresh();
 assert(!process.env.ANVIL_DB_CONFIG&&!process.env.ANVIL_MIGRATOR_CONFIG&&!process.env.ANVIL_AUTH_CONFIG,'기존 보호 환경 설정 혼용 금지');
 for(const row of binding.sourceFiles){fresh();const path=resolve(binding.cwd,row.path),stat=await lstat(path);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(await realpath(path),path);assert.equal(contentHash(await readFile(path)),row.sha256);fresh();}
 for(const row of binding.migrations){fresh();const path=resolve(binding.cwd,row.path),stat=await lstat(path);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(await realpath(path),path);assert.equal(contentHash(await readFile(path)),row.checksum);fresh();}
 const root=await lstat(binding.artifactRoot);assert(root.isDirectory()&&!root.isSymbolicLink());assert.equal(await realpath(binding.artifactRoot),binding.artifactRoot);assert.equal(root.uid,binding.uid);assert.equal(root.mode&0o777,0o700);same(await readdir(binding.artifactRoot),['owner.json']);
 const marker=await lstat(binding.ownerMarker.path);assert(marker.isFile()&&!marker.isSymbolicLink()&&marker.nlink===1&&marker.size<=4096);assert.equal(marker.uid,binding.uid);assert.equal(marker.mode&0o777,0o600);assert.equal(await realpath(binding.ownerMarker.path),binding.ownerMarker.path);
 const markerBytes=await readFile(binding.ownerMarker.path);assert.equal(contentHash(markerBytes),binding.ownerMarker.sha256);const owner:unknown=parseWireJson(markerBytes.toString('utf8'));
 assert(exact(owner,['schemaVersion','purpose','sourceHead','artifactRoot','uid','issuedAt','expiresAt'])&&owner.schemaVersion===1&&owner.purpose==='IX01_ACTUAL_JOURNEY_OWNER'&&owner.sourceHead===binding.sourceHead&&owner.artifactRoot===binding.artifactRoot&&owner.uid===binding.uid&&owner.issuedAt===binding.issuedAt&&owner.expiresAt===binding.expiresAt);fresh();
 const password=process.env.ANVIL_IX01_QA_APP??'',migratorPassword=process.env.ANVIL_IX01_QA_MIGRATOR??'';
 if(!/^[a-f0-9]{64}$/.test(password)||!/^[a-f0-9]{64}$/.test(migratorPassword))throw Error('IX01_QA_CREDENTIAL_FORMAT_INVALID');fresh();
 const config={host:binding.host,port:5432,database:binding.database,connectionTimeoutMillis:3000,statement_timeout:5000};
 // 반환받은 자원은 생성 즉시 소유한다. 후속 생성/close 실패도 이미 소유한 자원 회수를 막지 않는다.
 const owned:JourneyOwnedResource[]=[];let failed=false,failure:unknown;
 try{
  const rawAdmin=new Pool({...config,user:'anvil_v3_migrator',password:migratorPassword,max:2});registerJourneyClose(owned,'migratorPool',()=>rawAdmin.end());const admin=fenceResultQaPool(rawAdmin,fresh);
  const authConfiguration={installationId:randomUUID(),key:randomBytes(32)};let contextGeneration=0;
  const createContext=()=>{
   fresh();const generation=++contextGeneration,rawPool=new Pool({...config,user:'anvil_v3_app',password,max:3});
   const closePool=registerJourneyClose(owned,'appPool:'+generation,()=>rawPool.end()),pool=fenceResultQaPool(rawPool,fresh);fresh();
   const access=new AccessRepository(pool,authConfiguration);fresh();
   const app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830',artifactRoot:binding.artifactRoot});
   const closeApp=registerJourneyClose(owned,'app:'+generation,()=>app.close());fresh();return{pool,access,app,closePool,closeApp};
  };
  let current=createContext(),{pool,access,app}=current;
  same((await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows,[{db:binding.database,role:'anvil_v3_app',rolsuper:false,rolbypassrls:false}]);
  // 원장 집합 일치는 실제 적용 순서의 증거가 아니다. 순서/의존의 채택은 외부 실행 계획 소유다.
  same((await admin.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows,binding.migrations.map(({id,checksum})=>({id,checksum})).toSorted((a,b)=>a.id.localeCompare(b.id)));
  assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.users')).rows[0].n,0,'전용 빈 격리만 허용');
  const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url))),methods=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms);
  const seed=await admin.connect();try{await seed.query('BEGIN');await seedOfficialForms(seed,forms);await seedBuiltinMethodologies(seed,methods,forms.forms);await seed.query('COMMIT');}catch(e){await seed.query('ROLLBACK');throw e;}finally{seed.release();}
  const uid=randomUUID(),loginPassword=randomBytes(32).toString('base64url');await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'IX01 격리 사용자','ACTIVE')",[uid,'ix01-'+uid]);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[uid,await hashPassword(loginPassword)]);
  let who=await access.login('ix01-'+uid,loginPassword,'IX01 격리','ix01-source');who=await access.reauthenticate(who.token,who.csrfToken,loginPassword,'ix01-source');
  const actor=await access.authenticated(who.token,who.csrfToken,async(_db,a)=>a),session={user:{id:uid},clientId:who.clientId,csrfToken:who.csrfToken},headers={host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+who.token,'x-anvil-csrf':who.csrfToken};
  const client=new ApiClient(async(url,init)=>{fresh();assert(String(url).startsWith('/api/v1/'));let payload:Buffer|string|undefined;
   if(init?.body instanceof Blob)payload=Buffer.from(await init.body.arrayBuffer());else if(init?.body instanceof Uint8Array)payload=Buffer.from(init.body);else if(typeof init?.body==='string')payload=init.body;else assert(init?.body==null);
   const r=await app.inject({method:(init?.method??'GET') as 'GET'|'POST',url:String(url),headers:{...headers,...init?.headers as Record<string,string>},payload});return new Response(r.body,{status:r.statusCode,headers:{'content-type':String(r.headers['content-type']??'')}});
  });
  const source=methods[0]!,sourceRef={id:source.id,version:source.version,contentHash:source.contentHash};
  async function createProject(name:string){const r=await app.inject({method:'POST',url:'/api/v1/project-drafts',headers,payload:{schemaVersion:1,commandId:randomUUID(),clientId:who.clientId,targetId:null,expectedVersion:0,name,purpose:'방법론에서 지식까지 원 근거 연결',desiredOutcome:'저장·버전·접근 검산',sourceMode:'EMPTY',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:sourceRef},artifactRefs:[]}});assert.equal(r.statusCode,201);const v=await app.inject({method:'POST',url:'/api/v1/projects',headers,payload:{schemaVersion:1,commandId:randomUUID(),clientId:who.clientId,draftId:r.json().draftId,draftVersion:1}});assert.equal(v.statusCode,201);return v.json();}
  const project=await createProject('IX01 원 여정'),other=await createProject('IX01 별도 프로젝트'),pid:string=project.id;
  const command=(operation:string,payload:Record<string,unknown>,targetId:string|null=null,expectedVersion=0):ProjectCommand=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:who.clientId,controlGeneration:1,operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload});
  const send=(c:ProjectCommand)=>{fresh();return app.inject({method:'POST',url:'/api/v1/projects/'+c.projectId+'/commands',headers,payload:c});};
  const success=async(c:ProjectCommand)=>{const r=await send(c);assert.equal(r.statusCode,200,r.json().code);return r.json();};
  const operations=['uploadArtifact','saveDocumentDraft','recordContentReview','confirmDocument','indexDesignDocument','saveWorkPlanDraft','confirmWorkPlan','linkTrace','saveKnowledge','saveMethodologyDraft','confirmMethodology','applyMethodology'];
  await success(command('savePermissionPolicy',{rules:[{ruleId:'IX01_ONLY',subjectRef:{kind:'HUMAN',userId:uid},targetScopes:[{kind:'PROJECT',projectId:pid}],operations,disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(until).toISOString()}],reason:'명시 격리 여정',reviewRefs:[]}));
  const method=(await success(command('saveMethodologyDraft',{name:'IX01 절차',purpose:'불변 적용 근거',scope:'PROJECT',graph:source.graph,reason:'명시 격리 절차'}))).data.ref;
  const review=(await success(command('recordContentReview',{targetKind:'METHODOLOGY',targetRef:method,criteriaVersion:1,items:methodContentReviewCriteria.items.map(item=>({criterionId:item.criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'합성 원문 대조'})),outcome:'ACCEPTED',reason:'실제 사용자 인수 아님'},method.id,method.version))).data.reviewRef;
  await success(command('confirmMethodology',{versionRef:method,reviewRefs:[review]},method.id,method.version));
  const applied=await success(command('applyMethodology',{methodologyRef:method,expectedApplicationVersion:1,reason:'업무 생성 전 명시 적용'},pid,1)),applicationRef=applied.data.ref;
  async function document(formId:string,title:string,lead:string,confirmed=true){
   const r=await app.inject({method:'GET',url:'/api/v1/forms/'+formId+'/versions/1',headers});assert.equal(r.statusCode,200);const form=r.json(),buffer=newDocument(pid,form,uid,1),text=[lead];
   const node=source.graph.nodes.find(node=>node.outputs.some(output=>canonicalJson(output.formRef)===canonicalJson(form.ref)));assert(node,'실제 적용 graph의 해당 양식 출력 노드');
   const stage={applicationId:applicationRef.id,nodeId:node.nodeId};buffer.stageNodeRef=stage;
   for(const item of(form.definition as FormDefinition).items){buffer.content.sections.push({itemId:item.itemId,anchor:'line:'+(text.length+1)});text.push('## '+item.title);if(item.valueType==='TEXT')text.push('격리 합성 범위·원근거·검수 조건');else text.push('| '+item.fields.map(f=>f.fieldId).join(' | ')+' |','| '+item.fields.map(()=>'---').join(' | ')+' |','| '+item.fields.map((_,i)=>'합성값'+i).join(' | ')+' |');}
   Object.assign(buffer,{title,body:text.join('\n'),reason:'IX01 고정 원문',dirty:true});const ref=await continueDocumentSave(client,await prepareDocumentSave(buffer,session),session,()=>{},()=>true),view=await readDocument(client,pid,ref.id,ref.version,{expectedStage:stage,expectedContentHash:ref.contentHash});assert.equal(view.document.validation.validForConfirmation,true);
   same(view.document.stageNodeRef,stage);same(view.document.stageBinding?.applicationRef,applicationRef);assert.equal(view.document.stageBinding?.nodeId,node.nodeId);assert(view.document.stageBinding?.uses.includes('OUTPUT'));
   const filtered=await listDocuments(client,pid,null,stage);assert(filtered.items.some(item=>item.id===ref.id&&item.headVersion===ref.version),'적용본/출력 노드 필터가 실제 저장 문서를 반환');
   let reviewRef:Awaited<ReturnType<typeof sendDocumentReview>>|null=null;
   if(confirmed){const r=newDocumentReview(pid,view.document,uid,1);r.items=r.items.map(i=>({...i,outcome:'ACCEPTED',reason:'합성 검토'}));r.outcome='ACCEPTED';r.reason='사용자 인수 아님';r.pending=prepareDocumentReview(r,session);reviewRef=await sendDocumentReview(client,r,session,()=>true);const c=newDocumentConfirmation(pid,(await readDocument(client,pid,ref.id,ref.version)).document,uid,1);c.acknowledged=true;c.pending=prepareDocumentConfirmation(c,session);await sendDocumentConfirmation(client,c,session,()=>true);}
   return{ref,buffer,reviewRef};
  }
  const design=await document('a6f30000-0000-4000-8000-000000000002','IX01 설계','# D11 원 설계'),screen=await document('a6f30000-0000-4000-8000-000000000003','IX01 화면','# UI01 합성 화면'),planDoc=await document('a6f30000-0000-4000-8000-000000000004','IX01 계획','# UI01 IX01 UI01\n# FN01 IX01 FN01');
  const index=(await success(command('indexDesignDocument',{documentRef:design.ref,items:[{localCode:'D11',title:'원 설계',anchor:'line:1'}],screens:[{designLocalCode:'D11',screenCode:'UI01',documentRef:screen.ref,anchor:'line:1'}],reason:'원문 위치 연결'},design.ref.id,design.ref.version))).data;
  const designLocation={kind:'DESIGN_ITEM' as const,id:index.designItems[0].id,versionRef:design.ref,localCode:'D11',anchor:'line:1'},screenLocation={kind:'SCREEN_REGION' as const,id:index.screenRegions[0].id,versionRef:screen.ref,localCode:'UI01',anchor:'line:1'};
  const task=(taskCode:string,type:TaskCard['type'],startPrerequisites:string[]):TaskCard=>({taskCode,type,title:'IX01 '+taskCode,purpose:'원 설계에서 작업·검수 왕복',designRefs:[designLocation],screenRefs:type==='SCREEN'?[screenLocation]:[],ownerRole:'단계책임자',inputs:['확정 설계'],outputs:['저장된 원문'],included:['작성·저장·조회'],excluded:['Agent 실행'],allowedFileRefs:['src/ix01.ts'],startPrerequisites,acceptancePrerequisites:[],steps:['명시 저장·재조회'],testCases:['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].map((kind,n)=>({id:'T'+n,kind:kind as 'NORMAL'|'IMPORTANT_FAILURE'|'DIRECT_IMPACT',steps:['원근거 검산'],expected:'원문/ref 불변',environment:'격리 PG'})),acceptanceCriteria:['고정 버전 일치'],evidenceRequirements:['불변 ref·영수증'],rollback:'등록 자원 회수계획',recoveryNotes:'불명 보존'});
  const planRequest=command('saveWorkPlanDraft',{documentRef:planDoc.ref,designRef:design.ref,screenReviewRefs:[screen.reviewRef],tasks:[task('UI01','SCREEN',[]),task('FN01','FUNCTION',['UI01'])],reason:'화면/기능 선행과 검수'});
  const snapshotDocuments=new ProjectDocuments(binding.artifactRoot);
  const domainState=async()=>{
   const tables=['documents','document_versions','document_artifact_links','document_version_events','work_plans','work_plan_versions','plan_tasks','plan_dependencies','work_plan_confirmations','trace_edges','knowledge_entries','knowledge_versions','knowledge_events','artifacts','content_reviews','document_confirmations'];
   const db=await admin.connect();try{
   const rows:Record<string,unknown[]>={};for(const table of tables)rows[table]=(await db.query('SELECT to_jsonb(r) row FROM anvil.'+table+' r WHERE project_id=$1 ORDER BY to_jsonb(r)::text',[pid])).rows.map(r=>r.row);
   const originals:unknown[]=[];
   for(const row of(await db.query('SELECT document_id,version,content_json FROM anvil.document_versions WHERE project_id=$1 ORDER BY document_id,version',[pid])).rows)originals.push({kind:'DOCUMENT',id:row.document_id,version:row.version,ref:row.content_json.body,body:await snapshotDocuments.originalText(db,pid,row.content_json.body)});
   for(const row of(await db.query('SELECT entry_id,version,entry_json FROM anvil.knowledge_versions WHERE project_id=$1 ORDER BY entry_id,version',[pid])).rows)originals.push({kind:'KNOWLEDGE',id:row.entry_id,version:row.version,ref:row.entry_json.contentRef,body:await snapshotDocuments.originalText(db,pid,row.entry_json.contentRef)});
   return{rows,originals};
   }finally{db.release();}
  };
  const saved=await success(planRequest);assert.deepEqual(saved.data.workPlan.issues,[]);const beforeReplay=await domainState();same(await success(planRequest),saved);same(await domainState(),beforeReplay);
  const plan=await readWorkPlan(client,pid,saved.data.ref);assert(plan.dependencies.some(d=>d.taskCode==='FN01'&&d.dependencyTaskCode==='UI01'&&d.phase==='START'));
  const pr=newWorkPlanDecision(pid,await readWorkPlanDecision(client,pid,plan),session,1,'REVIEW');pr.items=pr.items.map(i=>({...i,outcome:'ACCEPTED',reason:'원문·선행 검산'}));pr.outcome='ACCEPTED';pr.reason='격리 준비 검토';pr.pending=prepareWorkPlanDecision(pr,session);await sendWorkPlanDecision(client,pr,session,()=>true);
  const pc=newWorkPlanDecision(pid,await readWorkPlanDecision(client,pid,plan),session,1,'CONFIRM');pc.acknowledged=true;pc.pending=prepareWorkPlanDecision(pc,session);await sendWorkPlanDecision(client,pc,session,()=>true);assert((await readWorkPlanDecision(client,pid,plan)).currentConfirmationValid);
  const traceBuffer=await prepareStoredWorkPlan(client,pid,plan.ref,session,'TRACE');assert(traceBuffer.workPlanState);
  const trace=newTaskTrace(traceBuffer,'FN01');trace.input.to=designLocation;trace.input.reason='확정 계획 업무에서 원 설계로';traceBuffer.workPlanState.traceLink=trace;trace.pending=prepareTaskTrace(traceBuffer,session);const linked=await sendTaskTrace(client,traceBuffer,session,()=>true);
  for(const direction of ['FORWARD','REVERSE'] as const){const view=await readTrace(client,pid,design.ref,direction,null),edge=view.edges.find(e=>e.id===linked.id),walk=view.traversal.find(t=>t.edgeId===linked.id);assert(edge&&walk);same(edge,linked);same(walk.from,direction==='FORWARD'?linked.from:linked.to);same(walk.to,direction==='FORWARD'?linked.to:linked.from);}
  const knowledge=newKnowledge(pid,session,1);Object.assign(knowledge,{title:'IX01 결정 근거',body:'확정 설계와 계획의 선행을 보존한다.',reason:'여정의 원 판단 보존',kind:'DECISION',scope:{projectId:pid,stageRefs:[{applicationRef,nodeId:source.graph.nodes[0]!.nodeId}],taskRefs:[{planRef:plan.ref,taskCode:'FN01'}]},sourceRefs:[{kind:'DOCUMENT_VERSION',...design.ref}]});knowledge.pending=await prepareKnowledge(knowledge,session);
  const knowledgeRef=await sendKnowledge(client,knowledge,session,p=>{knowledge.pending=p;},()=>true),known=await readKnowledge(client,pid,knowledgeRef);assert.equal(known.state,'PROPOSED');assert.equal(known.agentDelivery,'NOT_CONNECTED');same(known.entry.scope.taskRefs,[{planRef:plan.ref,taskCode:'FN01'}]);assert((await searchKnowledge(client,pid,'IX01 결정')).items.some(i=>i.versionRef.id===knowledgeRef.id));
  // 도메인 자료가 모두 생긴 뒤 각 원명령 replay도 원본문/ref/물리행 전체를 바꾸지 않아야 한다.
  const allBeforeReplay=await domainState();same(await success(planRequest),saved);assert(trace.pending);same((await success(trace.pending)).data.edge,linked);assert(knowledge.pending?.save);same((await success(knowledge.pending.save)).data.ref,knowledgeRef);same(await domainState(),allBeforeReplay);
  const freshDocuments=new ProjectDocuments(binding.artifactRoot),freshPlans=new ProjectWorkPlans(freshDocuments),freshKnowledge=new ProjectKnowledge(freshDocuments),freshTraces=new ProjectTraces(freshDocuments),freshMethods=new ProjectMethodologies();
  await access.authenticated(who.token,null,async(db,a)=>{same((await freshPlans.read(db,a,pid,plan.ref.id,plan.ref.version)).ref,plan.ref);same((await freshKnowledge.read(db,a,pid,knowledgeRef.id,knowledgeRef.version)).ref,knowledgeRef);same((await freshMethods.readApplication(db,a,pid)).applicationRef,applicationRef);assert((await freshTraces.read(db,a,pid,{designId:design.ref.id,version:String(design.ref.version),direction:'FORWARD'},new ProjectListCodec(s=>access.signProjectCursor(s)))).edges.some(e=>e.id===linked.id));});
  // 같은 PG의 원 app/Pool을 종료하고 재생성한다. 실제 프로세스/화면 재시작 검수가 아니다.
  const count=async()=> (await admin.query("SELECT (SELECT count(*) FROM anvil.commands WHERE project_id=$1) commands,(SELECT count(*) FROM anvil.authorization_receipts WHERE scope_id=$1) receipts,(SELECT count(*) FROM anvil.audit_events WHERE project_id=$1) audits",[pid])).rows;
  const beforeReconnect=await domainState(),commandsBeforeReconnect=await count();
  const documentsBeforeReconnect=await Promise.all([design,screen,planDoc].map(value=>readDocument(client,pid,value.ref.id,value.ref.version,{expectedContentHash:value.ref.contentHash})));
  const planBeforeReconnect=await readWorkPlan(client,pid,plan.ref),knowledgeBeforeReconnect=await readKnowledge(client,pid,knowledgeRef);
  await closeJourneyContext(current,fresh);fresh();current=createContext();({pool,access,app}=current);
  assert.equal(contextGeneration,2);same((await pool.query('SELECT current_database() db,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows,[{db:binding.database,role:'anvil_v3_app',rolsuper:false,rolbypassrls:false}]);fresh();
  for(const [i,value]of [design,screen,planDoc].entries()){
   const readback=await readDocument(client,pid,value.ref.id,value.ref.version,{expectedContentHash:value.ref.contentHash});
   same(readback.document,documentsBeforeReconnect[i]!.document);assert.equal(readback.body,documentsBeforeReconnect[i]!.body);
  }
  const planAfterReconnect=await readWorkPlan(client,pid,plan.ref),knowledgeAfterReconnect=await readKnowledge(client,pid,knowledgeRef);
  same(planAfterReconnect.ref,plan.ref);same(planAfterReconnect.tasks,planBeforeReconnect.tasks);same(planAfterReconnect.dependencies,planBeforeReconnect.dependencies);same(knowledgeAfterReconnect.entry,knowledgeBeforeReconnect.entry);
  await access.authenticated(who.token,null,async(db,a)=>{same((await new ProjectMethodologies().readApplication(db,a,pid)).applicationRef,applicationRef);});
  for(const direction of ['FORWARD','REVERSE']as const){const view=await readTrace(client,pid,design.ref,direction,null),edge=view.edges.find(e=>e.id===linked.id),walk=view.traversal.find(t=>t.edgeId===linked.id);assert(edge&&walk);same(edge,linked);same(walk.from,direction==='FORWARD'?linked.from:linked.to);same(walk.to,direction==='FORWARD'?linked.to:linked.from);}
  same(await domainState(),beforeReconnect);same(await count(),commandsBeforeReconnect);
  for(const path of ['/documents/'+design.ref.id+'/versions/'+design.ref.version,'/work-plans/'+plan.ref.id+'/versions/'+plan.ref.version,'/knowledge/'+knowledgeRef.id+'/versions/'+knowledgeRef.version]){const r=await app.inject({method:'GET',url:'/api/v1/projects/'+other.id+path,headers});assert.equal(r.statusCode,404);assert(!r.body.includes('IX01 원문'));}
  const unchanged=async(c:ProjectCommand)=>{const before=await count(),domainBefore=await domainState(),r=await send(c);assert(r.statusCode>=400);same(await count(),before);same(await domainState(),domainBefore);};
  await unchanged({...structuredClone(planRequest),commandId:randomUUID(),controlGeneration:2});
  await unchanged({...structuredClone(planRequest),commandId:randomUUID(),payload:{...planRequest.payload,designRef:{...design.ref,contentHash:'f'.repeat(64)}}});
  const unconfirmed=await document('a6f30000-0000-4000-8000-000000000002','IX01 미확정','# D12 미확정',false);
  const incompleteIndex=(await success(command('indexDesignDocument',{documentRef:unconfirmed.ref,items:[{localCode:'D12',title:'미확정',anchor:'line:1'}],screens:[{designLocalCode:'D12',screenCode:'UI01',documentRef:screen.ref,anchor:'line:1'}],reason:'미확정 원문도 합격으로 위장하지 않음'},unconfirmed.ref.id,unconfirmed.ref.version))).data;
  const incompleteDoc=await document('a6f30000-0000-4000-8000-000000000004','IX01 미확정 계획','# UI01 IX01 UI01\n# FN01 IX01 FN01');
  const incompleteTasks=plan.tasks.map(t=>({...t,designRefs:[{kind:'DESIGN_ITEM',id:incompleteIndex.designItems[0].id,versionRef:unconfirmed.ref,localCode:'D12',anchor:'line:1'}],screenRefs:t.type==='SCREEN'?[{kind:'SCREEN_REGION',id:incompleteIndex.screenRegions[0].id,versionRef:screen.ref,localCode:'UI01',anchor:'line:1'}]:[]}));
  const incomplete=await success(command('saveWorkPlanDraft',{documentRef:incompleteDoc.ref,designRef:unconfirmed.ref,screenReviewRefs:[screen.reviewRef],tasks:incompleteTasks,reason:'미확정 설계의 issue 보관'}));assert(incomplete.data.workPlan.issues.some((i:{code:string})=>i.code==='DESIGN_NOT_CONFIRMED'));await unchanged(command('confirmWorkPlan',{versionRef:incomplete.data.ref,reviewRefs:[]},incomplete.data.ref.id,incomplete.data.ref.version));
  const outsider=randomUUID(),outsiderPassword=randomBytes(32).toString('base64url');await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'IX01 비회원','ACTIVE')",[outsider,'ix01-other-'+outsider]);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)',[outsider,await hashPassword(outsiderPassword)]);const outsiderLogin=await access.login('ix01-other-'+outsider,outsiderPassword,'IX01 비회원','ix01-other');
  for(const path of ['/documents/'+design.ref.id+'/versions/'+design.ref.version,'/work-plans/'+plan.ref.id+'/versions/'+plan.ref.version,'/knowledge/'+knowledgeRef.id+'/versions/'+knowledgeRef.version,'/knowledge?query=IX01']){const denied=await app.inject({method:'GET',url:'/api/v1/projects/'+pid+path,headers:{host:'localhost:3830',cookie:'__Host-anvil.sid='+outsiderLogin.token}});assert.equal(denied.statusCode,404);assert(!denied.body.includes('IX01 결정 근거'));}
  // 원장/권한 guard를 비활성화하지 않는다. 이 fixture 변경을 실제 schema가 거절하면 검증 실패로 남긴다.
  await admin.query('UPDATE anvil.project_control SET revoked_at=clock_timestamp() WHERE project_id=$1',[pid]);await unchanged({...structuredClone(planRequest),commandId:randomUUID()});
  await admin.query("UPDATE anvil.auth_sessions SET idle_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[actor.authSession!.id]);const before=await count(),domainBefore=await domainState(),expired=await send({...structuredClone(planRequest),commandId:randomUUID()});assert.equal(expired.statusCode,401);same(await count(),before);same(await domainState(),domainBefore);
  for(const table of ['executions','execution_grants','writer_claims','execution_commands','delivery_outbox'])assert.equal((await admin.query('SELECT count(*)::int n FROM anvil.'+table)).rows[0].n,0);
 }catch(error){failed=true;failure=error;}finally{
  // 전부 호출한 뒤 각 정착을 관측한다. 미정착을 정리 완료로 간주하거나 강제 종료하지 않는다.
  const results=await Promise.allSettled([...owned].reverse().map(async resource=>{await resource.close();}));
  const cleanup=results.flatMap((result,index)=>result.status==='rejected'?[new Error('IX01_CLEANUP_UNCONFIRMED:'+owned[owned.length-1-index]!.name,{cause:result.reason})]:[]);
  if(cleanup.length)throw new AggregateError([...(failed?[failure]:[]),...cleanup],'IX01_EXECUTION_OR_CLEANUP_UNCONFIRMED');
  if(failed)throw failure;
 }
});
