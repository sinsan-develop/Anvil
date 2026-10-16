import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,persistProjectReceipt,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectDesignIndex} from './design-index.ts';
import {ProjectWorkPlans} from './work-plans.ts';
import {exactKeys,planText} from './work-plan-card.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import type {ProjectListCodec} from '../projects/service.ts';
type TraceRef={kind:string;id:string;versionRef:VersionRef;localCode?:string;anchor?:string};
type Resolved={ref:TraceRef;title:string;designRefs:VersionRef[]};
export class ProjectTraces{
  #documents:ProjectDocuments;#index:ProjectDesignIndex;#plans:ProjectWorkPlans;
  constructor(documents:ProjectDocuments){this.#documents=documents;this.#index=new ProjectDesignIndex(documents);this.#plans=new ProjectWorkPlans(documents);}
  async #resolve(db:PoolClient,actor:AuthenticatedIdentity,pid:string,value:unknown):Promise<Resolved>{
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['kind','id','versionRef','localCode','anchor'].includes(k)))throw new AuthFailure('TRACE_REFERENCE_INVALID',422);
    const r=value as TraceRef;
    if(typeof r.kind!=='string'||!isVersionRef({id:r.id,version:1,contentHash:'0'.repeat(64)})||!isVersionRef(r.versionRef)||r.localCode!==undefined&&(typeof r.localCode!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(r.localCode))||r.anchor!==undefined&&(typeof r.anchor!=='string'||!/^line:[1-9][0-9]{0,7}$/.test(r.anchor)))throw new AuthFailure('TRACE_REFERENCE_INVALID',422);
    if(['REQUIREMENT','ARTIFACT','EXECUTION','TEST_EVIDENCE'].includes(r.kind))throw new AuthFailure('TRACE_SOURCE_NOT_READY',412);
    if(r.kind==='PLAN_TASK'){
      if(r.id!==r.versionRef.id||!r.localCode||r.anchor!==undefined)throw new AuthFailure('TRACE_REFERENCE_INVALID',422);
      const p=await this.#plans.read(db,actor,pid,r.id,r.versionRef.version);if(p.ref.contentHash!==r.versionRef.contentHash)throw new AuthFailure('TRACE_REFERENCE_MISMATCH',409);
      const tasks=p.tasks.filter((t:any)=>t.taskCode===r.localCode);if(!tasks.length)throw new AuthFailure('NOT_FOUND',404);if(tasks.length!==1||p.relationalProjection!=='STORED')throw new AuthFailure('TRACE_SOURCE_AMBIGUOUS',409);
      return{ref:{kind:r.kind,id:r.id,versionRef:r.versionRef,localCode:r.localCode},title:tasks[0].title,designRefs:[p.designRef]};
    }
    if(r.kind==='DOCUMENT_VERSION'){
      if(r.id!==r.versionRef.id||r.localCode!==undefined||r.anchor!==undefined)throw new AuthFailure('TRACE_REFERENCE_INVALID',422);
      const d=await this.#documents.version(db,actor,pid,r.id,r.versionRef.version);if(d.contentHash!==r.versionRef.contentHash)throw new AuthFailure('TRACE_REFERENCE_MISMATCH',409);
      const form=(await db.query("SELECT definition_json->>'formCode' code FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3",[d.formRef.id,d.formRef.version,d.formRef.contentHash])).rows[0];
      return{ref:{kind:r.kind,id:r.id,versionRef:r.versionRef},title:d.title,designRefs:form?.code==='AF02'?[r.versionRef]:[]};
    }
    if(!['DESIGN_ITEM','SCREEN_REGION'].includes(r.kind))throw new AuthFailure('TRACE_REFERENCE_INVALID',422);
    const row=r.kind==='DESIGN_ITEM'?(await db.query('SELECT design_document_id,document_version FROM anvil.design_items WHERE project_id=$1 AND id=$2',[pid,r.id])).rows[0]:(await db.query('SELECT d.design_document_id,d.document_version FROM anvil.screen_regions s JOIN anvil.design_items d ON d.project_id=s.project_id AND d.id=s.design_item_id WHERE s.project_id=$1 AND s.id=$2',[pid,r.id])).rows[0];
    if(!row)throw new AuthFailure('NOT_FOUND',404);
    const index=await this.#index.read(db,actor,pid,row.design_document_id,Number(row.document_version)),item=r.kind==='DESIGN_ITEM'?index.items.find(i=>i.id===r.id):index.screenRegions.find(i=>i.id===r.id);
    if(!item)throw new AuthFailure('TRACE_INTEGRITY_FAILED',503);
    const code=r.kind==='DESIGN_ITEM'?item.localCode:item.screenCode;
    if(canonicalJson(item.documentRef)!==canonicalJson(r.versionRef)||r.localCode!==undefined&&r.localCode!==code||r.anchor!==undefined&&r.anchor!==item.anchor)throw new AuthFailure('TRACE_REFERENCE_MISMATCH',409);
    return{ref:{kind:r.kind,id:r.id,versionRef:item.documentRef,localCode:code,anchor:item.anchor},title:r.kind==='DESIGN_ITEM'?item.title:code,designRefs:[index.documentRef]};
  }
  async link(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef){
    const p=request.payload;
    if(request.targetId!==null||request.expectedVersion!==0||!exactKeys(p,['from','to','relation','reason'])||!planText(p.reason)||!p.reason.trim()||typeof p.relation!=='string'||!['REFINES','IMPLEMENTS','VERIFIES','DEPENDS_ON'].includes(p.relation))throw new AuthFailure('TRACE_INPUT_INVALID',422);
    const from=await this.#resolve(db,actor,request.projectId,p.from),to=await this.#resolve(db,actor,request.projectId,p.to);
    if(canonicalJson(from.ref)===canonicalJson(to.ref))throw new AuthFailure('TRACE_SELF_REFERENCE',422);
    const f=from.ref.kind,t=to.ref.kind;
    if(!(p.relation==='IMPLEMENTS'&&f==='PLAN_TASK'&&['DESIGN_ITEM','SCREEN_REGION'].includes(t)||p.relation==='REFINES'&&(f==='SCREEN_REGION'&&t==='DESIGN_ITEM'||f==='DESIGN_ITEM'&&t==='DOCUMENT_VERSION'||f==='DOCUMENT_VERSION'&&t==='DOCUMENT_VERSION')||p.relation==='DEPENDS_ON'&&f===t&&['PLAN_TASK','DESIGN_ITEM'].includes(f)))throw new AuthFailure('TRACE_RELATION_INVALID',422);
    const designRefs=[...new Map([...from.designRefs,...to.designRefs].map(r=>[canonicalJson(r),r])).values()].sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)));
    if(!designRefs.length)throw new AuthFailure('TRACE_DESIGN_ANCHOR_REQUIRED',422);
    if((await db.query('SELECT 1 FROM anvil.trace_edges WHERE project_id=$1 AND from_kind=$2 AND from_id=$3 AND from_version=$4 AND from_code=$5 AND to_kind=$6 AND to_id=$7 AND to_version=$8 AND to_code=$9 AND relation=$10',[request.projectId,f,from.ref.id,from.ref.versionRef.version,from.ref.localCode??'',t,to.ref.id,to.ref.versionRef.version,to.ref.localCode??'',p.relation])).rowCount)throw new AuthFailure('TRACE_ALREADY_EXISTS',409);
    const data={from:from.ref,to:to.ref,relation:p.relation,reason:p.reason,designRefs},id=randomUUID(),edgeHash=contentHash(canonicalJson(data)),createdAt=(await db.query('SELECT transaction_timestamp() at')).rows[0].at.toISOString(),edge={id,...data,edgeHash,createdAt},ref={id,version:1,contentHash:edgeHash};
    const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'TRACE_LINKED',edge},policyRef,'EXPLICIT_TRACE_LINK');
    await db.query('INSERT INTO anvil.trace_edges(id,project_id,from_kind,from_id,from_version,from_code,to_kind,to_id,to_version,to_code,relation,design_refs,edge_json,edge_hash,reason,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',[id,request.projectId,f,from.ref.id,from.ref.versionRef.version,from.ref.localCode??'',t,to.ref.id,to.ref.versionRef.version,to.ref.localCode??'',p.relation,JSON.stringify(designRefs),JSON.stringify(edge),edgeHash,p.reason,actor.actorId,actor.clientId,receipt.id]);
    return receipt.result;
  }
  async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){
    await projectMember(db,actor,pid);
    if(Object.keys(q).some(k=>!['designId','version','direction','limit','cursor'].includes(k))||!isVersionRef({id:q.designId,version:1,contentHash:'0'.repeat(64)})||typeof q.version!=='string'||!/^[1-9][0-9]{0,14}$/.test(q.version)||q.direction!==undefined&&(typeof q.direction!=='string'||!['FORWARD','REVERSE'].includes(q.direction))||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(q.limit)||Number(q.limit)>200)||q.cursor!==undefined&&(typeof q.cursor!=='string'||q.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
    const index=await this.#index.read(db,actor,pid,String(q.designId),Number(q.version)),limit=q.limit===undefined?50:Number(q.limit),direction=q.direction??'FORWARD',filter={query:canonicalJson({projectId:pid,designRef:index.documentRef,direction}),archived:false,limit};
    let pos:{at:string;id:string}|null=null;if(q.cursor!==undefined){try{pos=codec.read(String(q.cursor),actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
    const rows=(await db.query('SELECT edge_json,edge_hash,to_char(created_at AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\') cursor_at,id FROM anvil.trace_edges WHERE project_id=$1 AND design_refs @> $2::jsonb AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::uuid)) ORDER BY created_at DESC,id DESC LIMIT $5',[pid,JSON.stringify([index.documentRef]),pos?.at??null,pos?.id??null,limit+1])).rows;
    const edges:any[]=[],nodes=new Map<string,Resolved>();for(const row of rows.slice(0,limit)){const e=row.edge_json,{id,edgeHash,createdAt,...data}=e;if(id!==row.id||edgeHash!==row.edge_hash||contentHash(canonicalJson(data))!==edgeHash)throw new AuthFailure('TRACE_INTEGRITY_FAILED',503);const from=await this.#resolve(db,actor,pid,e.from),to=await this.#resolve(db,actor,pid,e.to);if(canonicalJson(from.ref)!==canonicalJson(e.from)||canonicalJson(to.ref)!==canonicalJson(e.to))throw new AuthFailure('TRACE_INTEGRITY_FAILED',503);nodes.set(canonicalJson(from.ref),from);nodes.set(canonicalJson(to.ref),to);edges.push(e);}
    const linked=new Set((await db.query("SELECT to_id FROM anvil.trace_edges WHERE project_id=$1 AND relation='IMPLEMENTS' AND to_kind='DESIGN_ITEM' AND design_refs @> $2::jsonb",[pid,JSON.stringify([index.documentRef])])).rows.map(r=>r.to_id));
    const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);
    return{designRef:index.documentRef,direction,nodes:[...nodes.values()],edges,traversal:edges.map(e=>({edgeId:e.id,from:direction==='FORWARD'?e.from:e.to,to:direction==='FORWARD'?e.to:e.from})),missingLinks:index.items.filter(i=>!linked.has(i.id)).map(i=>({ref:{kind:'DESIGN_ITEM',id:i.id,versionRef:i.documentRef,localCode:i.localCode,anchor:i.anchor},code:'PLAN_TASK_LINK_MISSING'})),unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:new Date().toISOString()};
  }
}
