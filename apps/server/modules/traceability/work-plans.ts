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
}
