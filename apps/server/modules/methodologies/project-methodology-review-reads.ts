import{timingSafeEqual}from'node:crypto';
import type{PoolClient}from'pg';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{projectMember}from'../access/project-command.ts';
import{ProjectMethodologies}from'./project-methodologies.ts';
import{methodContentReviewCriteria}from'./content-review.ts';
import{readProjectMethodReview}from'./project-input.ts';
type Row=Record<string,any>;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v),hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),h=(v:unknown)=>contentHash(canonicalJson(v));
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const fail=(code='METHODOLOGY_INTEGRITY_FAILED',status=503):never=>{throw new AuthFailure(code,status);};
const size=<T>(value:T):T=>{if(Buffer.byteLength(canonicalJson(value),'utf8')>2097152)fail('METHOD_REVIEW_PAGE_TOO_LARGE');return value;};
function sequence(v:unknown,zero=false){if(typeof v==='string'){if(!/^(0|[1-9][0-9]*)$/.test(v))return fail();const n=BigInt(v);if(n>BigInt(Number.MAX_SAFE_INTEGER))return fail();v=Number(n);}if(!Number.isSafeInteger(v)||Number(v)<(zero?0:1))return fail();return Number(v);}
function stamp(v:unknown){if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v))v=new Date(v);if(!(v instanceof Date)||!Number.isFinite(v.getTime()))return fail();return v.toISOString();}
const scopeWhere="r.scope_kind='PROJECT' AND r.scope_id=$1 AND r.project_id=$1 AND r.target_kind='METHODOLOGY' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4";
const proofColumns="to_jsonb(c) AS command_row,(SELECT COALESCE(jsonb_agg(to_jsonb(ar)),'[]'::jsonb) FROM anvil.authorization_receipts ar WHERE ar.command_id=r.command_id) AS receipt_rows,(SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM anvil.audit_events a WHERE a.command_id=r.command_id) AS audit_rows,(SELECT MIN(a.server_sequence)::text FROM anvil.audit_events a WHERE a.command_id=r.command_id) AS audit_sequence";
const reviewSelect=`SELECT r.*,${proofColumns} FROM anvil.content_reviews r LEFT JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id`;
interface CursorScope{actorId:string;projectId:string;targetRef:VersionRef;limit:number}
interface PageCursor{kind:'FN02_METHOD_REVIEW_HISTORY';version:1;scope:CursorScope;upper:number;before:number;issuedAt:number;expiresAt:number}
/** 동일 caller-owned 인증 Tx의 읽기만 수행한다. 기존 mutation/read의 201 guard는 호출하거나 바꾸지 않는다. */
export class ProjectMethodologyReviewReads{
 readonly methods:Pick<ProjectMethodologies,'row'>;readonly sign:(value:string)=>string;
 constructor(methods:Pick<ProjectMethodologies,'row'>,sign:(value:string)=>string){this.methods=methods;this.sign=sign;}
 async #clock(db:PoolClient,actor:AuthenticatedIdentity){const now=stamp((await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at),s=actor.authSession;if(!s||!uuid(s.id)||!Number.isFinite(Date.parse(s.idleExpiresAt))||!Number.isFinite(Date.parse(s.absoluteExpiresAt))||Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt))<=Date.parse(now))fail('AUTH_REQUIRED',401);return now;}
 async #end(db:PoolClient,actor:AuthenticatedIdentity,pid:string){await projectMember(db,actor,pid);return this.#clock(db,actor);}
 #input(pid:string,id:string,version:number,raw:Record<string,unknown>,page=false){if(!uuid(pid)||!uuid(id)||!Number.isSafeInteger(version)||version<1||!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!(page?['targetHash','limit','cursor']:['targetHash']).includes(k))||raw.targetHash!==undefined&&!hash(raw.targetHash)||page&&!hash(raw.targetHash))fail('INPUT_INVALID',400);}
 async #row(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number,expected?:unknown){await projectMember(db,actor,pid);await this.#clock(db,actor);const row=await this.methods.row(db,pid,id,version);if(expected!==undefined&&row.content_hash!==expected)fail();if(!Number.isSafeInteger(Number(row.head_version))||Number(row.head_version)<version||typeof row.name!=='string'||typeof row.purpose!=='string'||typeof row.reason!=='string')fail();return row;}
 #proof(raw:Row,pid:string,ref:VersionRef,operation:string,payload:unknown,who:string,at:string,targetId:string|null=ref.id,expectedVersion=ref.version){
  const c=raw.command_row,ars=raw.receipt_rows,audits=raw.audit_rows;
  if(!c||!Array.isArray(ars)||ars.length!==1||!Array.isArray(audits)||audits.length!==1)fail();const ar=ars[0],a=audits[0],result=c.result_ref;
  if(!uuid(c.id)||!uuid(c.command_id)||!uuid(c.operation_id)||!uuid(c.client_id)||!isVersionRef(c.policy_ref)||c.scope_kind!=='PROJECT'||c.scope_id!==pid||c.project_id!==pid||c.actor_id!==who||c.operation!==operation||c.state!=='APPLIED'||!Number.isSafeInteger(Number(c.control_generation))||Number(c.control_generation)<1||Number(c.expected_version)!==expectedVersion||c.approval_consumption_id!==null||c.payload_ref!==null)fail();
  const request={schemaVersion:1,projectId:pid,commandId:c.command_id,clientId:c.client_id,controlGeneration:Number(c.control_generation),operation,targetId,expectedVersion,baselineRefs:[],approvalRef:null,payload};
  const digest=h({projectId:pid,actorId:who,clientId:c.client_id,controlGeneration:Number(c.control_generation),requestHash:h(request),policyRef:c.policy_ref,targetRef:ref});
  if(c.request_hash!==h(request)||ar.id!==c.authorization_receipt_id||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==pid||!same(ar.subject_ref,{kind:'HUMAN',userId:who,clientId:c.client_id})||!same(ar.policy_ref,c.policy_ref)||ar.scope_digest!==digest||ar.approval_decision_ref!==null||a.project_id!==pid||a.command_id!==c.id||a.operation_id!==c.operation_id||!same(a.actor_ref,{kind:'HUMAN',userId:who})||a.client_ref!==c.client_id||a.source_kind!=='HUMAN_COMMAND'||a.outcome!=='APPLIED'||!same(a.target_ref,ref)||!same(a.policy_ref,c.policy_ref)||a.approval_ref!==null||a.scope_digest!==digest)fail();
  const seq=sequence(a.server_sequence);if(raw.audit_sequence!==undefined&&sequence(raw.audit_sequence)!==seq)fail();
  if(!result||result.status!=='APPLIED'||result.projectId!==pid||result.commandId!==c.command_id||result.operationId!==c.operation_id||result.targetId!==ref.id||result.version!==ref.version||!same(result.data?.ref,ref)||result.serverReceivedAt!==at||stamp(c.received_at)!==at||stamp(c.completed_at)!==at||stamp(ar.authorized_at)!==at||stamp(a.recorded_at)!==at||!Array.isArray(result.evidenceRefs)||!Array.isArray(result.warnings))fail();return{result,seq};
 }
 async #source(db:PoolClient,pid:string,ref:VersionRef,row:Row){
  const rows=(await db.query(`/*FN02_SOURCE_PROOF*/ SELECT to_jsonb(c) AS command_row,(SELECT COALESCE(jsonb_agg(to_jsonb(ar)),'[]'::jsonb) FROM anvil.authorization_receipts ar WHERE ar.command_id=c.id) AS receipt_rows,(SELECT COALESCE(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM anvil.audit_events a WHERE a.command_id=c.id) AS audit_rows FROM anvil.commands c WHERE c.project_id=$1 AND c.scope_kind='PROJECT' AND c.operation IN('copyMethodology','saveMethodologyDraft') AND c.result_ref->'data'->'ref'=$2::jsonb`,[pid,JSON.stringify(ref)])).rows;
  if(!rows.length){if(row.origin_ref_json?.kind!=='DRAFT_CONFIRMED_SOURCE'||ref.version!==1)fail();return;}
  if(rows.length!==1)fail();const c=rows[0].command_row,copy=c.operation==='copyMethodology',payload=copy?{sourceRef:row.origin_ref_json?.parentRef,name:row.name,scope:'PROJECT',reason:row.reason}:{name:row.name,purpose:row.purpose,scope:'PROJECT',graph:row.graph_json,reason:row.reason};
  this.#proof(rows[0],pid,ref,c.operation,payload,row.created_by,stamp(row.created_at),copy||ref.version===1?null:ref.id,copy?0:ref.version-1);
  if(c.result_ref.data.status!=='DRAFT'||!same(c.result_ref.data.snapshot,{name:row.name,purpose:row.purpose,graph:row.graph_json,origin:row.origin_ref_json,reason:row.reason}))fail();
 }
 #review(raw:Row,pid:string,ref:VersionRef,recorder:string){
  try{
   if(raw.scope_kind!=='PROJECT'||raw.scope_id!==pid||raw.project_id!==pid||raw.target_kind!=='METHODOLOGY'||raw.target_id!==ref.id||Number(raw.target_version)!==ref.version||raw.target_hash!==ref.contentHash||!uuid(raw.id)||!uuid(raw.reviewer_user_id)||raw.source_kind!=='HUMAN_REVIEW'||typeof raw.outcome!=='string'||!same(raw.criteria_snapshot_json,methodContentReviewCriteria))fail();
   const input=readProjectMethodReview({targetKind:'METHODOLOGY',targetRef:ref,criteriaVersion:Number(raw.criteria_version),items:raw.items_json,outcome:raw.outcome,reason:raw.reason});
   if((input.items as Row[]).some(i=>typeof i.outcome!=='string'))fail();const reviewRef={id:raw.id,criteriaVersion:1,targetRef:ref,outcome:raw.outcome};
   const proof=this.#proof(raw,pid,ref,'recordContentReview',input,raw.reviewer_user_id,stamp(raw.created_at));
   if(proof.result.data.status!=='REVIEW_RECORDED'||!same(proof.result.data.reviewRef,reviewRef)||!same(proof.result.data.review,input)||raw.client_id!==raw.command_row.client_id||!same(raw.reviewer_subject_ref,{kind:'HUMAN',userId:raw.reviewer_user_id,sameAsTargetRecorder:recorder===raw.reviewer_user_id}))fail();
   return{ref:reviewRef,criteria:structuredClone(methodContentReviewCriteria),items:structuredClone(raw.items_json),reviewer:structuredClone(raw.reviewer_subject_ref),sourceKind:'HUMAN_REVIEW' as const,reason:raw.reason,reviewedAt:stamp(raw.created_at),serverSequence:proof.seq};
  }catch{return fail();}
 }
 async #inventory(db:PoolClient,pid:string,ref:VersionRef){
  const row=(await db.query(`/*FN02_REVIEW_INVENTORY*/ SELECT COALESCE(MAX(z.seq),0)::text AS upper,COALESCE(bool_or(z.proof_id IS NULL OR z.operation<>'recordContentReview' OR z.state<>'APPLIED' OR z.receipt_count<>1 OR z.audit_count<>1 OR z.seq<1 OR z.seq>9007199254740991),false) AS invalid,count(*)<>count(DISTINCT z.seq) AS duplicate FROM (SELECT r.id,c.id AS proof_id,c.operation,c.state,(SELECT count(*) FROM anvil.authorization_receipts ar WHERE ar.command_id=r.command_id) AS receipt_count,(SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=r.command_id) AS audit_count,(SELECT MIN(a.server_sequence) FROM anvil.audit_events a WHERE a.command_id=r.command_id) AS seq FROM anvil.content_reviews r LEFT JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE ${scopeWhere}) z`,[pid,ref.id,ref.version,ref.contentHash])).rows[0];
  if(!row||row.invalid!==false||row.duplicate!==false)fail();return sequence(row.upper,true);
 }
 async overview(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number,raw:Record<string,unknown>={}){
  this.#input(pid,id,version,raw);const row=await this.#row(db,actor,pid,id,version,raw.targetHash),ref={id,version,contentHash:row.content_hash};await this.#source(db,pid,ref,row);
  const inventory=(await db.query(`/*FN02_CONFIRMATION_INVENTORY*/ SELECT COALESCE(MAX(z.seq),0)::text AS upper,COALESCE(bool_or(z.proof_id IS NULL OR z.operation<>'confirmMethodology' OR z.state<>'APPLIED' OR z.receipt_count<>1 OR z.audit_count<>1 OR z.seq<1 OR z.seq>9007199254740991),false) AS invalid,count(*)<>count(DISTINCT z.seq) AS duplicate FROM (SELECT r.id,c.id AS proof_id,c.operation,c.state,(SELECT count(*) FROM anvil.authorization_receipts ar WHERE ar.command_id=r.command_id) AS receipt_count,(SELECT count(*) FROM anvil.audit_events a WHERE a.command_id=r.command_id) AS audit_count,(SELECT MIN(a.server_sequence) FROM anvil.audit_events a WHERE a.command_id=r.command_id) AS seq FROM anvil.methodology_reviews r LEFT JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.definition_id=$2 AND r.version=$3 AND r.target_hash=$4 AND r.decision='CONFIRMED') z`,[pid,id,version,ref.contentHash])).rows[0];
  if(!inventory||inventory.invalid!==false||inventory.duplicate!==false)fail();const confirmedUpper=sequence(inventory.upper,true);
  const stored=(await db.query(`/*FN02_CONFIRMATION_READ*/ SELECT r.*,${proofColumns} FROM anvil.methodology_reviews r LEFT JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id WHERE r.project_id=$1 AND r.definition_id=$2 AND r.version=$3 AND r.target_hash=$4 AND r.decision='CONFIRMED' ORDER BY (SELECT MIN(a.server_sequence) FROM anvil.audit_events a WHERE a.command_id=r.command_id) DESC LIMIT 1`,[pid,id,version,ref.contentHash])).rows;
  if(stored.length!==(confirmedUpper?1:0)||stored[0]&&sequence(stored[0].audit_sequence)!==confirmedUpper)fail();let confirmation=null;
  if(stored.length){const r=stored[0],refs=r.review_refs;if(!uuid(r.id)||r.decision!=='CONFIRMED'||!Array.isArray(refs)||!refs.length||refs.length>200||new Set(refs.map((x:Row)=>x.id)).size!==refs.length||refs.some((x:Row)=>!exact(x,['id','criteriaVersion','targetRef','outcome'])||!uuid(x.id)||x.criteriaVersion!==1||!same(x.targetRef,ref)||x.outcome!=='ACCEPTED'))fail();
   const proof=this.#proof(r,pid,ref,'confirmMethodology',{versionRef:ref,reviewRefs:refs},r.decided_by,stamp(r.decided_at));
   if(r.client_id!==r.command_row.client_id||proof.result.data.status!=='CONFIRMED'||proof.result.data.confirmationId!==r.id||!same(proof.result.data.reviewRefs,refs)||!same(proof.result.data.validation,r.validation_json)||r.validation_json?.validForConfirmation!==true)fail();
   const selected=(await db.query(`/*FN02_REVIEW_BY_IDS*/ ${reviewSelect} WHERE ${scopeWhere} AND r.id=ANY($5::uuid[])`,[pid,id,version,ref.contentHash,refs.map((x:Row)=>x.id)])).rows;if(selected.length!==refs.length)fail();const actual=selected.map(x=>this.#review(x,pid,ref,row.created_by));if(actual.some(x=>x.serverSequence>=proof.seq)||refs.some((x:Row)=>!actual.some(a=>same(a.ref,x))))fail();
   confirmation={id:r.id,decision:'CONFIRMED' as const,decidedBy:r.decided_by,decided_at:stamp(r.decided_at),reviewRefs:structuredClone(refs),validation:structuredClone(r.validation_json)};
  }
  const result={projectId:pid,ref,headVersion:Number(row.head_version),name:row.name,purpose:row.purpose,scope:'PROJECT' as const,systemCode:null,graph:structuredClone(row.graph_json),sourceApproval:structuredClone(row.origin_ref_json),reason:row.reason,createdAt:stamp(row.created_at),contentReviewCriteria:structuredClone(methodContentReviewCriteria),confirmation,historyMode:'SEPARATE_PAGE' as const,currentConfirmationState:'NOT_REEVALUATED' as const,runtimeReadiness:'PROJECT_BINDINGS_REQUIRED' as const,applicationTransition:'EXECUTION_STATE_UNVERIFIED' as const};await this.#end(db,actor,pid);return size(result);
 }
 #encode(value:PageCursor){const text=Buffer.from(canonicalJson(value)).toString('base64url'),signature=this.sign(text);if(!hash(signature))fail();return text+'.'+signature;}
 #decode(raw:string,scope:CursorScope,now:number):PageCursor{
  try{if(typeof raw!=='string'||raw.length>4096)throw Error();const m=/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(raw);if(!m)throw Error();const expected=this.sign(m[1]!);if(!hash(expected)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(m[2]!,'hex')))throw Error();const bytes=Buffer.from(m[1]!,'base64url'),v=JSON.parse(bytes.toString('utf8'));if(bytes.toString('base64url')!==m[1]||canonicalJson(v)!==bytes.toString('utf8')||!exact(v,['kind','version','scope','upper','before','issuedAt','expiresAt'])||v.kind!=='FN02_METHOD_REVIEW_HISTORY'||v.version!==1||!same(v.scope,scope)||!Number.isSafeInteger(v.issuedAt)||!Number.isSafeInteger(v.expiresAt)||v.expiresAt-v.issuedAt!==1800000||v.issuedAt>now||v.expiresAt<=now||sequence(v.before)>sequence(v.upper,true))throw Error();return v;}catch{return fail('CURSOR_INVALID',400);}
 }
 async page(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number,raw:Record<string,unknown>){
  this.#input(pid,id,version,raw,true);if(raw.limit!==undefined&&(typeof raw.limit!=='string'||!/^[1-9][0-9]?$/.test(raw.limit)||Number(raw.limit)>50)||raw.cursor!==undefined&&(typeof raw.cursor!=='string'||!raw.cursor||raw.cursor.length>4096))fail('INPUT_INVALID',400);
  const limit=raw.limit===undefined?20:Number(raw.limit),row=await this.#row(db,actor,pid,id,version,raw.targetHash),ref={id,version,contentHash:row.content_hash};await this.#source(db,pid,ref,row);const now=Date.parse(await this.#clock(db,actor)),scope={actorId:actor.actorId,projectId:pid,targetRef:ref,limit},inventory=await this.#inventory(db,pid,ref),cursor=raw.cursor===undefined?null:this.#decode(raw.cursor as string,scope,now),upper=cursor?.upper??inventory,before=cursor?.before??null;
  const rows=(await db.query(`/*FN02_REVIEW_PAGE*/ SELECT * FROM (${reviewSelect} WHERE ${scopeWhere}) q WHERE q.audit_sequence::bigint<=$5 AND ($6::bigint IS NULL OR q.audit_sequence::bigint<$6) ORDER BY q.audit_sequence::bigint DESC LIMIT $7`,[pid,id,version,ref.contentHash,upper,before,limit+1])).rows;
  const all=rows.map(r=>this.#review(r,pid,ref,row.created_by));let previous=before;
  for(const item of all){if(item.serverSequence>upper||previous!==null&&item.serverSequence>=previous)fail();previous=item.serverSequence;}
  if(new Set(all.map(x=>x.ref.id)).size!==all.length)fail();const items=all.slice(0,limit),hasMore=all.length>limit;
  const nextCursor=hasMore?this.#encode({kind:'FN02_METHOD_REVIEW_HISTORY',version:1,scope,upper,before:items.at(-1)!.serverSequence,issuedAt:cursor?.issuedAt??now,expiresAt:cursor?.expiresAt??now+1800000}):null;
  const observedAt=await this.#end(db,actor,pid);return size({targetRef:ref,upperSequence:upper,items,hasMore,nextCursor,observedAt});
 }
}
