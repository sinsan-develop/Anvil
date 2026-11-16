import { AuthFailure } from '../access/repository.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { PoolClient } from 'pg';
import type { AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { MethodologyGraph } from '../../../../contracts/methodologies.ts';
export interface StageNodeRef { applicationId: string; nodeId: string }
export interface StageOutputItem { applicationRef:VersionRef; itemId:string }
const draftReason='EXPLICIT_DOCUMENT_DRAFT', outputReason='EXPLICIT_DOCUMENT_DRAFT_STAGE_OUTPUT';
export const documentDraftReason=(item?:StageOutputItem)=>item?outputReason:draftReason;
const outputIntegrity=()=>new AuthFailure('DOCUMENT_INTEGRITY_FAILED',503);
const equal=(a:unknown,b:unknown)=>a!==undefined&&b!==undefined&&canonicalJson(a)===canonicalJson(b);
export function readStageOutputItem(value:unknown):StageOutputItem {
  const v=value as Partial<StageOutputItem>|null;
  if(!v||Object.keys(v).sort().join(',')!=='applicationRef,itemId'||!isVersionRef(v.applicationRef)||
     Object.keys(v.applicationRef).sort().join(',')!=='contentHash,id,version'||typeof v.itemId!=='string'||
     !v.itemId.trim()||v.itemId.length>200||!v.itemId.isWellFormed()||/[\u0000-\u001f\u007f]/.test(v.itemId))
    throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID',422);
  return {applicationRef:{...v.applicationRef},itemId:v.itemId};
}
/** 원 버전·명령·감사만 사용한다. 목록의 최신 명령이나 요청자의 현재 주체로 대체하지 않는다. */
export async function storedStageOutput(db:PoolClient,projectId:string,id:string,version:number,revision?:{stage:StageNodeRef|null;form:VersionRef}){
  const rows=(await db.query(`SELECT v.document_id,v.version,v.content_hash,v.stage_ref_json,v.title,v.content_json,v.reason,v.form_definition_id,v.form_version,v.form_hash,v.author_ref_json,
    c.command_id,c.client_id,c.actor_id,c.operation_id,c.control_generation,c.request_hash,c.policy_ref,c.payload_ref,c.result_ref,
    a.reason_code,a.approval_ref,ar.approval_decision_ref,ar.scope_digest,ac.id AS consumed,ac.scope_digest AS consumed_digest,ad.request_id AS approved_request,
    c.approval_consumption_id,i.import_id,s.proposal_id
    FROM anvil.document_versions v
    JOIN anvil.commands c ON c.id=v.command_id AND c.project_id=v.project_id AND c.scope_kind='PROJECT' AND c.scope_id=v.project_id
      AND c.operation='saveDocumentDraft' AND c.state='APPLIED' AND c.expected_version=v.version-1 AND c.actor_id::text=v.author_ref_json->>'userId' AND c.client_id=v.client_id
    JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind=c.scope_kind AND ar.scope_id=c.scope_id
      AND ar.policy_ref IS NOT DISTINCT FROM c.policy_ref AND ar.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)
    JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id
      AND a.actor_ref=v.author_ref_json AND a.client_ref=c.client_id AND a.policy_ref IS NOT DISTINCT FROM c.policy_ref AND a.scope_digest=ar.scope_digest
      AND a.target_ref=jsonb_build_object('id',v.document_id,'version',v.version,'contentHash',v.content_hash) AND a.source_kind='HUMAN_COMMAND' AND a.outcome='APPLIED'
    LEFT JOIN anvil.approval_consumptions ac ON ac.project_id=c.project_id AND ac.id=c.approval_consumption_id AND ac.command_id=c.id
      AND ac.decision_id=ar.approval_decision_ref AND ac.policy_id::text=c.policy_ref->>'id' AND ac.policy_version::text=c.policy_ref->>'version'
    LEFT JOIN anvil.approval_decisions ad ON ad.project_id=c.project_id AND ad.id=ac.decision_id AND ad.decision='APPROVE' AND ad.scope_digest=ac.scope_digest
    LEFT JOIN anvil.document_import_selections i ON i.project_id=v.project_id AND i.document_id=v.document_id AND i.version=v.version AND i.command_id=c.id
    LEFT JOIN anvil.document_proposal_selections s ON s.project_id=v.project_id AND s.document_id=v.document_id AND s.version=v.version AND s.command_id=c.id
    WHERE v.project_id=$1 AND v.document_id=$2 AND v.version=$3`,[projectId,id,version])).rows;
  if(rows.length!==1)throw outputIntegrity();
  const r=rows[0],result=r.result_ref,data=result?.data,ref={id,version,contentHash:r.content_hash};
  if(!data||result.projectId!==projectId||result.targetId!==id||result.version!==version||result.operationId!==r.operation_id||
     result.commandId!==r.command_id||result.status!=='APPLIED'||data.status!=='DRAFT'||!equal(data.ref,ref)||
     !equal(data.stageNodeRef??null,r.stage_ref_json)||!equal(r.author_ref_json,{kind:'HUMAN',userId:r.actor_id}))throw outputIntegrity();
  const scopeDigest=contentHash(canonicalJson({projectId,actorId:r.actor_id,clientId:r.client_id,controlGeneration:Number(r.control_generation),requestHash:r.request_hash,policyRef:r.policy_ref,targetRef:ref}));
  if(scopeDigest!==r.scope_digest)throw outputIntegrity();
  if(r.approval_ref===null&&(r.payload_ref!==null||r.approval_consumption_id!==null||r.approval_decision_ref!==null||r.consumed!==null))throw outputIntegrity();
  if(r.approval_ref!==null&&(!r.consumed||r.consumed!==r.approval_consumption_id||r.approval_ref?.decisionId!==r.approval_decision_ref||r.approval_ref?.requestId!==r.approved_request||r.consumed_digest!==r.approval_ref?.scopeDigest))throw outputIntegrity();
  if(r.reason_code===draftReason&&!Object.hasOwn(data,'stageOutputItem'))return undefined;
  if(r.reason_code!==outputReason||!r.stage_ref_json)throw outputIntegrity();
  let item:StageOutputItem;try{item=readStageOutputItem(data.stageOutputItem);}catch{throw outputIntegrity();}
  const formRef={id:r.form_definition_id,version:Number(r.form_version),contentHash:r.form_hash};
  const binding=await documentStageBinding(db,projectId,r.stage_ref_json,formRef,false,item).catch(error=>{
    if(error instanceof AuthFailure&&error.statusCode===404)throw outputIntegrity();
    throw error;
  });
  if(!equal(data.stageBinding,binding)||data.importCandidateRef!==r.import_id||data.proposalRef!==r.proposal_id)throw outputIntegrity();
  const payload={title:r.title,formRef,stageNodeRef:r.stage_ref_json,content:r.content_json,reason:r.reason,importCandidateRef:r.import_id,
    ...(r.proposal_id===null?{}:{proposalRef:r.proposal_id}),stageOutputItem:item};
  const request={schemaVersion:1,projectId,commandId:r.command_id,clientId:r.client_id,controlGeneration:Number(r.control_generation),
    operation:'saveDocumentDraft',targetId:version===1?null:id,expectedVersion:version-1,baselineRefs:[],approvalRef:r.approval_ref,payload};
  const requestHash=contentHash(canonicalJson(request));
  if(requestHash!==r.request_hash)throw outputIntegrity();
  if(r.approval_ref!==null&&!equal(r.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:contentHash(canonicalJson(payload)),scopeDigest:r.consumed_digest}))throw outputIntegrity();
  if(revision&&(!equal(r.stage_ref_json,revision.stage)||!equal(formRef,revision.form)))throw new AuthFailure('DOCUMENT_STAGE_OUTPUT_CONFLICT',409);
  return item;
}
export function readStageNodeRef(value: unknown): StageNodeRef | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'applicationId,nodeId') throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID', 422);
  const ref = value as Record<string, unknown>;
  if (typeof ref.applicationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.applicationId) || typeof ref.nodeId !== 'string' || !ref.nodeId.trim() || ref.nodeId.length > 200 || !ref.nodeId.isWellFormed() || /[\u0000-\u001f\u007f]/.test(ref.nodeId)) throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID', 422);
  return { applicationId: ref.applicationId, nodeId: ref.nodeId };
}
export function nodeUsesForm(node: { inputs: { formRef: VersionRef }[]; outputs: { formRef: VersionRef }[] }, ref: VersionRef): ('INPUT' | 'OUTPUT')[] {
  return (['INPUT', 'OUTPUT'] as const).filter(kind => node[kind === 'INPUT' ? 'inputs' : 'outputs'].some(item => item.formRef.id === ref.id && item.formRef.version === ref.version && item.formRef.contentHash === ref.contentHash));
}
async function application(db: PoolClient, projectId: string, id: string | null) {
  const row = (await db.query('SELECT * FROM anvil.project_methodologies WHERE project_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY application_version DESC LIMIT 1', [projectId, id])).rows[0];
  if (!row) { if (id) throw new AuthFailure('NOT_FOUND', 404); return null; }
  const snapshot = row.snapshot_json;
  if (!snapshot || typeof snapshot.name !== 'string' || typeof snapshot.purpose !== 'string' || !isVersionRef(snapshot.sourceRef) || snapshot.sourceRef.id !== row.source_definition_id || snapshot.sourceRef.version !== Number(row.source_version) || snapshot.sourceRef.contentHash !== row.source_hash || contentHash(canonicalJson(snapshot)) !== row.snapshot_hash || contentHash(canonicalJson(snapshot.graph)) !== row.source_hash || !Array.isArray(snapshot.graph?.nodes) || !Array.isArray(snapshot.graph?.edges)) throw new AuthFailure('METHODOLOGY_APPLICATION_INTEGRITY_FAILED', 503);
  return { ref: { id: row.id, version: Number(row.application_version), contentHash: row.snapshot_hash }, name: snapshot.name as string, graph: snapshot.graph as MethodologyGraph };
}
export async function documentStageBinding(db: PoolClient, projectId: string, raw: unknown, formRef: VersionRef, requireCurrent: boolean, item?:StageOutputItem) {
  const ref = readStageNodeRef(raw);
  if (!ref) {if(item)throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID',requireCurrent?422:503);return null;}
  const applied = (await application(db, projectId, ref.applicationId))!;
  if (requireCurrent) { const current = await application(db, projectId, null); if (current?.ref.id !== applied.ref.id) throw new AuthFailure('METHODOLOGY_APPLICATION_CHANGED', 409); }
  const node = applied.graph.nodes.find(item => item.nodeId === ref.nodeId);
  if(item){
    if(!equal(item.applicationRef,applied.ref))throw new AuthFailure(requireCurrent?'METHODOLOGY_APPLICATION_CHANGED':'DOCUMENT_INTEGRITY_FAILED',requireCurrent?409:503);
    const outputs=node?.outputs.filter(o=>o.itemId===item.itemId);
    if(applied.graph.nodes.filter(n=>n.nodeId===ref.nodeId).length!==1||outputs?.length!==1||!equal(outputs[0]?.formRef,formRef))
      throw new AuthFailure(requireCurrent?'DOCUMENT_STAGE_OUTPUT_INVALID':'DOCUMENT_INTEGRITY_FAILED',requireCurrent?422:503);
  }
  if (!node) throw new AuthFailure('DOCUMENT_STAGE_NODE_INVALID', requireCurrent ? 422 : 503);
  const uses = nodeUsesForm(node, formRef);
  if (!uses.length) throw new AuthFailure('DOCUMENT_STAGE_FORM_MISMATCH', requireCurrent ? 422 : 503);
  return { applicationRef: applied.ref, methodologyName: applied.name, nodeId: node.nodeId, nodeName: node.name, uses };
}
export async function documentStageOptions(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, raw: Record<string, unknown>) {
  await projectMember(db, actor, projectId);
  if (Object.keys(raw).sort().join(',') !== 'formHash,formId,formVersion' || typeof raw.formVersion !== 'string' || !/^[1-9][0-9]{0,14}$/.test(raw.formVersion)) throw new AuthFailure('INPUT_INVALID', 400);
  const ref = { id: raw.formId, version: Number(raw.formVersion), contentHash: raw.formHash };
  if (!isVersionRef(ref)) throw new AuthFailure('INPUT_INVALID', 400);
  const form = (await db.query("SELECT v.definition_json,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [ref.id, ref.version, actor.actorId])).rows[0];
  if (!form || form.content_hash !== ref.contentHash || contentHash(canonicalJson(form.definition_json)) !== ref.contentHash) throw new AuthFailure('FORM_REFERENCE_INVALID', 422);
  const applied = await application(db, projectId, null);
  const items = applied ? applied.graph.nodes.flatMap(node => { const uses = nodeUsesForm(node, ref); return uses.length ? [{ stageNodeRef: { applicationId: applied.ref.id, nodeId: node.nodeId }, nodeName: node.name, nodeKind: node.kind, uses }] : []; }) : [];
  return { projectId, formRef: ref, applicationRef: applied?.ref ?? null, methodologyName: applied?.name ?? null, items, status: !applied ? 'NO_APPLICATION' : items.length ? 'READY' : 'FORM_NOT_LINKED', observedAt: new Date().toISOString() };
}
