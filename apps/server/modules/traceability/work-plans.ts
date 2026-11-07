import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectDesignIndex} from './design-index.ts';
import {analyzeWorkPlanCards,exactKeys,planText,type PlanTraceRef} from './work-plan-card.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import{acceptedWorkPlanReviews,workPlanReviewCriteria,workPlanReviews,writeWorkPlanReview}from'./work-plan-reviews.ts';

export class ProjectWorkPlans {
  #documents:ProjectDocuments;#index:ProjectDesignIndex;
  constructor(documents:ProjectDocuments){this.#documents=documents;this.#index=new ProjectDesignIndex(documents);}
  async #source(db:PoolClient,actor:AuthenticatedIdentity,pid:string,ref:VersionRef,kind:string){
    const document=await this.#documents.version(db,actor,pid,ref.id,ref.version);
    if(document.contentHash!==ref.contentHash) throw new AuthFailure('VERSION_CONFLICT',409);
    const form=(await db.query("SELECT definition_json->>'formCode' code FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3",[document.formRef.id,document.formRef.version,document.formRef.contentHash])).rows[0];
    if(form?.code!==kind) throw new AuthFailure('WORK_PLAN_DOCUMENT_KIND_INVALID',422);
    return document;
  }
  async #references(db:PoolClient,actor:AuthenticatedIdentity,pid:string,p:Record<string,any>){
    const document=await this.#source(db,actor,pid,p.documentRef,'AF04'),design=await this.#source(db,actor,pid,p.designRef,'AF02');
    const index=await this.#index.read(db,actor,pid,p.designRef.id,p.designRef.version);
    const screens=new Map<string,VersionRef>();
    for(const task of p.tasks) for(const ref of [...task.designRefs,...task.screenRefs] as PlanTraceRef[]){
      const item=ref.kind==='DESIGN_ITEM'?index.items.find(i=>i.id===ref.id):index.screenRegions.find(i=>i.id===ref.id);
      if(!item) throw new AuthFailure('NOT_FOUND',404);
      if(canonicalJson(item.documentRef)!==canonicalJson(ref.versionRef)||ref.localCode!==(ref.kind==='DESIGN_ITEM'?item.localCode:item.screenCode)||ref.anchor!==item.anchor) throw new AuthFailure('TRACE_REFERENCE_MISMATCH',409);
      if(ref.kind==='SCREEN_REGION') screens.set(ref.versionRef.id+':'+ref.versionRef.version,ref.versionRef);
    }
    const reviewed=new Set<string>();
    for(const ref of p.screenReviewRefs){
      if(!exactKeys(ref,['id','targetRef','criteriaVersion','outcome'])||!isVersionRef({id:ref.id,version:1,contentHash:'0'.repeat(64)})||!isVersionRef(ref.targetRef)||ref.criteriaVersion!==1||ref.outcome!=='ACCEPTED') throw new AuthFailure('SCREEN_REVIEW_REFERENCE_INVALID',422);
      const key=ref.targetRef.id+':'+ref.targetRef.version;
      if(!screens.has(key)||canonicalJson(screens.get(key))!==canonicalJson(ref.targetRef)||reviewed.has(key)) throw new AuthFailure('SCREEN_REVIEW_REFERENCE_INVALID',422);
      const reviews=(await this.#documents.version(db,actor,pid,ref.targetRef.id,ref.targetRef.version)).contentReviews;
      if(!reviews.some((r:any)=>canonicalJson(r.ref)===canonicalJson(ref))) throw new AuthFailure('SCREEN_REVIEW_REFERENCE_INVALID',422);
      if(reviews[0]&&canonicalJson(reviews[0].ref)===canonicalJson(ref)) reviewed.add(key);
    }
    return {document,design,screens,reviewed};
  }
  async save(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef){
    const p=request.payload;
    if(!exactKeys(p,['documentRef','designRef','screenReviewRefs','tasks','reason'])||!isVersionRef(p.documentRef)||!isVersionRef(p.designRef)||!Array.isArray(p.screenReviewRefs)||p.screenReviewRefs.length>200||!planText(p.reason)||!p.reason.trim()) throw new AuthFailure('WORK_PLAN_INPUT_INVALID',422);
    const analysis=analyzeWorkPlanCards(p.tasks);
    const head=(await db.query('SELECT head_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE',[request.projectId,p.documentRef.id])).rows[0];
    if(!head) throw new AuthFailure('NOT_FOUND',404);
    if(Number(head.head_version)!==p.documentRef.version) throw new AuthFailure('VERSION_CONFLICT',409);
    const sources=await this.#references(db,actor,request.projectId,p);
    const body=await this.#documents.originalText(db,request.projectId,sources.document.content.body);
    const issues=[...analysis.issues];
    const issue=(code:string,location:string,message:string)=>issues.push({code,location,message});
    if(!sources.document.confirmed) issue('PLAN_DOCUMENT_NOT_CONFIRMED','documentRef','작업계획 원문이 사용자 확정되지 않았습니다. 초안만 보관합니다.');
    if(!sources.design.confirmed) issue('DESIGN_NOT_CONFIRMED','designRef','설계 원문이 사용자 확정되지 않았습니다. 초안만 보관합니다.');
    for(const [key] of sources.screens) if(!sources.reviewed.has(key)) issue('SCREEN_REVIEW_MISSING','screenReviewRefs','연결된 화면 버전에 대한 실제 내용검토가 없습니다.');
    for(const [n,t] of analysis.tasks.entries()){
      if(!body.split(/\r\n|\r|\n/).some(line=>new RegExp('(?<![A-Za-z0-9_-])'+t.taskCode+'(?![A-Za-z0-9_-])').test(line)&&line.includes(t.title))) issue('PLAN_SOURCE_TASK_MISSING',`tasks[${n}]`,'정확한 AF04 원문에서 업무 코드와 제목을 함께 확인하지 못했습니다.');
    }
    const relationalProjection=analysis.issues.some(i=>['DUPLICATE_TASK_CODE','DEPENDENCY_CYCLE','DEPENDENCY_TASK_NOT_FOUND','SELF_DEPENDENCY','DUPLICATE_DEPENDENCY','DEPENDENCY_INPUT_INVALID'].includes(i.code))?'ISSUES_ONLY':'STORED';
    const current=request.targetId?(await db.query('SELECT head_version FROM anvil.work_plans WHERE project_id=$1 AND id=$2 FOR UPDATE',[request.projectId,request.targetId])).rows[0]:null;
    if(request.targetId&&!current) throw new AuthFailure('NOT_FOUND',404);
    if(request.expectedVersion!==(current?Number(current.head_version):0)) throw new AuthFailure('VERSION_CONFLICT',409);
    const id=request.targetId??randomUUID(),version=request.expectedVersion+1;if(!Number.isSafeInteger(version)) throw new AuthFailure('VERSION_CONFLICT',409);
    const snapshot={documentRef:p.documentRef,designRef:p.designRef,screenReviewRefs:p.screenReviewRefs,tasks:analysis.tasks,dependencies:analysis.dependencies,reason:p.reason,issues,relationalProjection};
    const ref={id,version,contentHash:contentHash(canonicalJson(snapshot))};
    const value={ref,status:'DRAFT',...snapshot};
    const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'WORK_PLAN_DRAFT_SAVED',workPlan:value},policyRef,'EXPLICIT_WORK_PLAN_DRAFT');
    if(!current) await db.query('INSERT INTO anvil.work_plans(id,project_id,head_version,created_by) VALUES($1,$2,1,$3)',[id,request.projectId,actor.actorId]);
    else await db.query('UPDATE anvil.work_plans SET head_version=$3,updated_at=now() WHERE project_id=$1 AND id=$2',[request.projectId,id,version]);
    await db.query('INSERT INTO anvil.work_plan_versions(project_id,plan_id,version,document_id,document_version,document_hash,design_id,design_version,design_hash,screen_review_refs,content_hash,version_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[request.projectId,id,version,p.documentRef.id,p.documentRef.version,p.documentRef.contentHash,p.designRef.id,p.designRef.version,p.designRef.contentHash,JSON.stringify(p.screenReviewRefs),ref.contentHash,JSON.stringify(value),actor.actorId,actor.clientId,receipt.id]);
    if(relationalProjection==='STORED'){
      for(const t of analysis.tasks) await db.query('INSERT INTO anvil.plan_tasks(project_id,plan_id,plan_version,task_code,task_type,card_json,card_hash,owner_role) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[request.projectId,id,version,t.taskCode,t.type,JSON.stringify(t),contentHash(canonicalJson(t)),t.ownerRole]);
      for(const d of analysis.dependencies) await db.query('INSERT INTO anvil.plan_dependencies(project_id,plan_id,plan_version,task_code,dependency_task_code,phase) VALUES($1,$2,$3,$4,$5,$6)',[request.projectId,id,version,d.taskCode,d.dependencyTaskCode,d.phase]);
    }
    return receipt.result;
  }
  async #current(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,ref:VersionRef){
    const row=(await db.query('SELECT w.head_version,w.confirmed_version,v.created_by FROM anvil.work_plans w JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=$3 WHERE w.project_id=$1 AND w.id=$2 FOR UPDATE OF w',[c.projectId,ref.id,ref.version])).rows[0];
    if(!row)throw new AuthFailure('NOT_FOUND',404);if(Number(row.head_version)!==ref.version)throw new AuthFailure('VERSION_CONFLICT',409);
    const view=await this.read(db,actor,c.projectId,ref.id,ref.version);if(canonicalJson(view.ref)!==canonicalJson(ref))throw new AuthFailure('VERSION_CONFLICT',409);return{row,view};
  }
  async review(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
    const ref=c.payload.targetRef;if(!isVersionRef(ref)||c.targetId!==ref.id||c.expectedVersion!==ref.version)throw new AuthFailure('WORK_PLAN_REVIEW_INPUT_INVALID',422);
    const{row,view}=await this.#current(db,actor,c,ref);return writeWorkPlanReview(db,actor,c,policyRef,view.ref,row.created_by);
  }
  async #readiness(db:PoolClient,actor:AuthenticatedIdentity,pid:string,view:Record<string,any>){
    const sources=await this.#references(db,actor,pid,view),analysis=analyzeWorkPlanCards(view.tasks),issues=[...analysis.issues];
    const issue=(code:string,location:string,message:string)=>issues.push({code,location,message});
    for(const[k,document,ref]of[['PLAN_DOCUMENT',sources.document,view.documentRef],['DESIGN',sources.design,view.designRef]]as const){
      const head=(await db.query('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE',[pid,ref.id])).rows[0];
      if(!document.confirmed||Number(head?.head_version)!==ref.version||Number(head?.confirmed_version)!==ref.version||!document.validation.validForConfirmation||document.contentReviews[0]?.ref.outcome!=='ACCEPTED')issue(k+'_NOT_READY',k==='DESIGN'?'designRef':'documentRef','정확한 현재 원문의 형식·내용검토·별도 확정이 필요합니다.');
    }
    for(const[key]of sources.screens)if(!sources.reviewed.has(key))issue('SCREEN_REVIEW_MISSING','screenReviewRefs','연결 화면의 최신 적합 검토를 정확히 선택해야 합니다.');
    const body=await this.#documents.originalText(db,pid,sources.document.content.body);
    for(const[n,t]of analysis.tasks.entries())if(!body.split(/\r\n|\r|\n/).some(line=>new RegExp('(?<![A-Za-z0-9_-])'+t.taskCode+'(?![A-Za-z0-9_-])').test(line)&&line.includes(t.title)))issue('PLAN_SOURCE_TASK_MISSING',`tasks[${n}]`,'AF04 원문에서 업무 코드와 제목을 확인하지 못했습니다.');
    if(view.relationalProjection!=='STORED')issue('WORK_PLAN_PROJECTION_NOT_READY','tasks','모호한 관계 투영을 확정할 수 없습니다.');
    return{validForConfirmation:issues.length===0,issues,sourceRefs:[view.documentRef,view.designRef],screenReviewRefs:view.screenReviewRefs};
  }
  async confirm(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
    const p=c.payload;if(!exactKeys(p,['planRef','reviewRefs'])||!isVersionRef(p.planRef)||c.targetId!==p.planRef.id||c.expectedVersion!==p.planRef.version)throw new AuthFailure('WORK_PLAN_CONFIRMATION_INPUT_INVALID',422);
    const{row,view}=await this.#current(db,actor,c,p.planRef);if(Number(row.confirmed_version)===view.ref.version)throw new AuthFailure('WORK_PLAN_ALREADY_CONFIRMED',409);
    const reviewRefs=acceptedWorkPlanReviews(view.ref,p.reviewRefs,await workPlanReviews(db,c.projectId,view.ref,row.created_by)),validation=await this.#readiness(db,actor,c.projectId,view);
    if(!validation.validForConfirmation)throw new AuthFailure('WORK_PLAN_NOT_READY',422);
    const id=randomUUID(),receipt=await persistProjectReceipt(db,actor,c,view.ref,{status:'CONFIRMED',confirmationId:id,reviewRefs,validation,activatedAsBaseline:false},policyRef,'EXPLICIT_WORK_PLAN_CONFIRMATION');
    await db.query('INSERT INTO anvil.work_plan_confirmations(id,project_id,plan_id,version,target_hash,review_refs,validation_json,confirmed_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,c.projectId,view.ref.id,view.ref.version,view.ref.contentHash,JSON.stringify(reviewRefs),JSON.stringify(validation),actor.actorId,actor.clientId,receipt.id]);
    await db.query('UPDATE anvil.work_plans SET confirmed_version=$3,updated_at=now() WHERE project_id=$1 AND id=$2',[c.projectId,view.ref.id,view.ref.version]);return receipt.result;
  }
  async decision(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number){
    const view=await this.read(db,actor,pid,id,version),row=(await db.query('SELECT w.head_version,w.confirmed_version,v.created_by FROM anvil.work_plans w JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=$3 WHERE w.project_id=$1 AND w.id=$2',[pid,id,version])).rows[0],reviews=await workPlanReviews(db,pid,view.ref,row.created_by),validation=await this.#readiness(db,actor,pid,view);
    const stored=(await db.query("SELECT f.*,c.result_ref,c.actor_id,c.client_id command_client,c.operation FROM anvil.work_plan_confirmations f JOIN anvil.commands c ON c.id=f.command_id AND c.project_id=f.project_id WHERE f.project_id=$1 AND f.plan_id=$2 AND f.version=$3",[pid,id,version])).rows[0];let confirmation=null;
    if(stored){const d=stored.result_ref?.data;if(stored.operation!=='confirmWorkPlan'||stored.actor_id!==stored.confirmed_by||stored.command_client!==stored.client_id||stored.result_ref?.status!=='APPLIED'||d?.status!=='CONFIRMED'||d.confirmationId!==stored.id||canonicalJson(d.ref)!==canonicalJson(view.ref)||stored.target_hash!==view.ref.contentHash||canonicalJson(d.reviewRefs)!==canonicalJson(stored.review_refs)||canonicalJson(d.validation)!==canonicalJson(stored.validation_json)||d.activatedAsBaseline!==false)throw new AuthFailure('WORK_PLAN_CONFIRMATION_INTEGRITY_FAILED',503);confirmation={id:stored.id,planRef:view.ref,reviewRefs:stored.review_refs,validation:stored.validation_json,confirmedBy:{kind:'HUMAN',userId:stored.confirmed_by},confirmedAt:stored.created_at.toISOString()};}
    return{planRef:view.ref,headVersion:Number(row.head_version),confirmedVersion:row.confirmed_version===null?null:Number(row.confirmed_version),criteria:workPlanReviewCriteria,contentReviews:reviews,confirmation,validation,currentConfirmationValid:!!confirmation&&Number(row.head_version)===version&&Number(row.confirmed_version)===version&&reviews[0]?.ref.outcome==='ACCEPTED'&&validation.validForConfirmation,activatedAsBaseline:false,observedAt:new Date().toISOString()};
  }
  async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number){
    await projectMember(db,actor,pid);
    const row=(await db.query('SELECT content_hash,version_json FROM anvil.work_plan_versions WHERE project_id=$1 AND plan_id=$2 AND version=$3',[pid,id,version])).rows[0];
    if(!row) throw new AuthFailure('NOT_FOUND',404);
    const v=row.version_json,{ref,status,...snapshot}=v;
    if(status!=='DRAFT'||canonicalJson(ref)!==canonicalJson({id,version,contentHash:row.content_hash})||contentHash(canonicalJson(snapshot))!==row.content_hash) throw new AuthFailure('WORK_PLAN_INTEGRITY_FAILED',503);
    analyzeWorkPlanCards(v.tasks);await this.#references(db,actor,pid,v);
    const cards=(await db.query('SELECT task_code,card_json,card_hash FROM anvil.plan_tasks WHERE project_id=$1 AND plan_id=$2 AND plan_version=$3 ORDER BY task_code',[pid,id,version])).rows;
    const deps=(await db.query('SELECT task_code,dependency_task_code,phase FROM anvil.plan_dependencies WHERE project_id=$1 AND plan_id=$2 AND plan_version=$3 ORDER BY task_code,dependency_task_code,phase',[pid,id,version])).rows.map(d=>({taskCode:d.task_code,dependencyTaskCode:d.dependency_task_code,phase:d.phase}));
    if(v.relationalProjection==='STORED'){
      if(cards.length!==v.tasks.length||cards.some(c=>contentHash(canonicalJson(c.card_json))!==c.card_hash||!v.tasks.some((t:any)=>t.taskCode===c.task_code&&canonicalJson(t)===canonicalJson(c.card_json)))||canonicalJson(deps.map(c=>canonicalJson(c)).sort())!==canonicalJson(v.dependencies.map((c:any)=>canonicalJson(c)).sort())) throw new AuthFailure('WORK_PLAN_INTEGRITY_FAILED',503);
    }else if(v.relationalProjection!=='ISSUES_ONLY'||cards.length||deps.length) throw new AuthFailure('WORK_PLAN_INTEGRITY_FAILED',503);
    return {...v,executionEvidence:'NOT_CONNECTED',observedAt:new Date().toISOString()};
  }
  async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,query:Record<string,unknown>,codec:ProjectListCodec){
    await projectMember(db,actor,pid);
    if(Object.keys(query).some(k=>!['limit','cursor','documentId'].includes(k))||query.limit!==undefined&&(typeof query.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(query.limit)||Number(query.limit)>200)||query.cursor!==undefined&&(typeof query.cursor!=='string'||query.cursor.length>4096)||query.documentId!==undefined&&!isVersionRef({id:query.documentId,version:1,contentHash:'0'.repeat(64)}))throw new AuthFailure('INPUT_INVALID',400);
    const limit=query.limit===undefined?50:Number(query.limit),filter={query:canonicalJson({projectId:pid,kind:'WORK_PLANS',documentId:query.documentId??null}),archived:false,limit};
    let position:{at:string;id:string}|null=null;if(query.cursor!==undefined){try{position=codec.read(String(query.cursor),actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
    const rows=(await db.query('SELECT w.id,w.head_version,w.updated_at,v.version_json,v.content_hash,d.title,to_char(w.updated_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') cursor_at FROM anvil.work_plans w JOIN anvil.work_plan_versions v ON v.project_id=w.project_id AND v.plan_id=w.id AND v.version=w.head_version JOIN anvil.document_versions d ON d.project_id=v.project_id AND d.document_id=v.document_id AND d.version=v.document_version WHERE w.project_id=$1 AND ($2::uuid IS NULL OR v.document_id=$2) AND ($3::timestamptz IS NULL OR (w.updated_at,w.id)<($3::timestamptz,$4::uuid)) ORDER BY w.updated_at DESC,w.id DESC LIMIT $5',[pid,query.documentId??null,position?.at??null,position?.id??null,limit+1])).rows;
    const visible=rows.slice(0,limit),hasMore=rows.length>limit,last=visible.at(-1),items=visible.map(row=>{const{ref,status,...snapshot}=row.version_json;if(status!=='DRAFT'||ref.id!==row.id||ref.version!==Number(row.head_version)||ref.contentHash!==row.content_hash||contentHash(canonicalJson(snapshot))!==row.content_hash)throw new AuthFailure('WORK_PLAN_INTEGRITY_FAILED',503);return{ref,status,title:row.title,documentRef:snapshot.documentRef,designRef:snapshot.designRef,issueCount:snapshot.issues.length,updatedAt:row.updated_at.toISOString(),integrity:'NOT_RECHECKED'};});
    return{items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:new Date().toISOString()};
  }
}
