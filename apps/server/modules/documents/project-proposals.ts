import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember, persistProjectReceipt, type ProjectCommand } from '../access/project-command.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isImportArtifact, importUuid, type ImportArtifact } from './project-imports.ts';
import { documentTextDiff } from './document-diff.ts';
import { documentStageBinding } from './document-stage.ts';
interface Content { body: ImportArtifact; attachments: ImportArtifact[]; sections: { itemId: string; anchor: string }[]; sourceRefs: [] }
interface BaseDocument { id: string; version: number; contentHash: string; title: string; formRef: VersionRef; stageNodeRef: unknown; content: Content; contentReviewCriteria: { items: { criterionId: string }[] } }
export interface DocumentProposal { id: string; baseRef: VersionRef; proposedContentRef: ImportArtifact; diffRef: ImportArtifact; status: 'PENDING' }
type Read = (db: PoolClient, pid: string, ref: ImportArtifact) => Promise<Buffer>;
type Put = (pid: string, id: string, bytes: Buffer) => Promise<string>;
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const text = (bytes: Buffer) => { try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new AuthFailure('DOCUMENT_UTF8_INVALID', 422); } };
export interface DocumentProposalPlan { proposal:DocumentProposal; content:Content; reason:string; diff:Buffer }
export async function prepareDocumentProposal(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, base: BaseDocument, read: Read, fixedIds?:{artifactId:string;proposalId:string}):Promise<DocumentProposalPlan> {
  const p = request.payload;
  if (!exact(p, ['baseRef','proposedContent','reason','sourceRefs']) || !isVersionRef(p.baseRef) || p.baseRef.id !== request.targetId || p.baseRef.version !== request.expectedVersion || typeof p.reason !== 'string' || !p.reason.trim() || p.reason.length > 20_000 || !Array.isArray(p.sourceRefs) || !exact(p.proposedContent, ['body','attachments','sections','sourceRefs']) || !isImportArtifact(p.proposedContent.body) || !Array.isArray(p.proposedContent.attachments) || p.proposedContent.attachments.length > 200 || !p.proposedContent.attachments.every(isImportArtifact) || !Array.isArray(p.proposedContent.sections) || p.proposedContent.sections.length > 200 || !Array.isArray(p.proposedContent.sourceRefs)) throw new AuthFailure('PROPOSAL_INPUT_INVALID', 422);
  if (p.sourceRefs.length || p.proposedContent.sourceRefs.length) throw new AuthFailure('DOCUMENT_REFERENCE_CONNECTION_PENDING', 412);
  await documentStageBinding(db, request.projectId, base.stageNodeRef, base.formRef, false);
  const current = (await db.query('SELECT head_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE', [request.projectId, base.id])).rows[0];
  if (!current || Number(current.head_version) !== base.version || base.contentHash !== p.baseRef.contentHash) throw new AuthFailure('VERSION_CONFLICT', 409);
  const content = p.proposedContent as unknown as Content;
  if (!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(content.body.mediaType) || content.body.bytes > 2 * 1024 * 1024) throw new AuthFailure('DOCUMENT_TEXT_FORMAT_NOT_SUPPORTED', 412);
  const proposed = text(await read(db, request.projectId, content.body)), original = text(await read(db, request.projectId, base.content.body));
  const ids = new Set([content.body.artifactId]);
  for (const ref of content.attachments) { if (ids.has(ref.artifactId)) throw new AuthFailure('DUPLICATE_ARTIFACT', 422); ids.add(ref.artifactId); await read(db, request.projectId, ref); }
  const mapped = new Set<string>(), lines = proposed.split(/\r\n|\r|\n/).length;
  for (const section of content.sections) {
    if (!exact(section, ['itemId','anchor']) || typeof section.itemId !== 'string' || typeof section.anchor !== 'string' || !/^line:[1-9][0-9]{0,7}$/.test(section.anchor) || Number(section.anchor.slice(5)) > lines || mapped.has(section.itemId) || !base.contentReviewCriteria.items.some(i => i.criterionId === section.itemId)) throw new AuthFailure('DOCUMENT_SECTION_INVALID', 422);
    mapped.add(section.itemId);
  }
  if (canonicalJson(content) === canonicalJson(base.content)) throw new AuthFailure('PROPOSAL_NO_CHANGE', 422);
  const diff = Buffer.from(canonicalJson({ ...documentTextDiff(original, proposed), baseRef: p.baseRef, baseBodyRef: base.content.body, proposedBodyRef: content.body, beforeContent: base.content, afterContent: content }));
  if (diff.length > 20 * 1024 * 1024) throw new AuthFailure('PROPOSAL_DIFF_TOO_LARGE', 413);
  const diffRef = { artifactId: fixedIds?.artifactId??randomUUID(), bytes: diff.length, contentHash: contentHash(diff), mediaType: 'application/json;charset=utf-8' };
  const proposal: DocumentProposal = { id: fixedIds?.proposalId??randomUUID(), baseRef: p.baseRef, proposedContentRef: content.body, diffRef, status: 'PENDING' };
  return {proposal,content,reason:p.reason,diff:Buffer.from(diff)};
}
export async function storeDocumentProposal(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef,plan:DocumentProposalPlan,storageKey:string){
  const {proposal,content,reason}=plan,diffRef=proposal.diffRef,p={baseRef:proposal.baseRef,reason};
  const receipt = await persistProjectReceipt(db, actor, request, p.baseRef, { status: 'PROPOSAL_RECORDED', proposal }, policyRef, 'EXPLICIT_DOCUMENT_PROPOSAL');
  await db.query("INSERT INTO anvil.artifacts(id,project_id,bytes,content_hash,media_type,storage_key,state,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,'READY',$7,$8,$9)", [diffRef.artifactId, request.projectId, diffRef.bytes, diffRef.contentHash, diffRef.mediaType, storageKey, actor.actorId, actor.clientId, receipt.id]);
  await db.query('INSERT INTO anvil.document_proposals(id,project_id,document_id,base_version,base_hash,body_artifact_id,diff_artifact_id,content_json,proposal_json,content_hash,reason,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [proposal.id, request.projectId, proposal.baseRef.id, proposal.baseRef.version, proposal.baseRef.contentHash, content.body.artifactId, diffRef.artifactId, JSON.stringify(content), JSON.stringify(proposal), contentHash(canonicalJson({ proposal, content, reason: p.reason })), p.reason, actor.actorId, actor.clientId, receipt.id]);
  return receipt;
}
export async function createDocumentProposal(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef,base:BaseDocument,read:Read,put:Put){
 const plan=await prepareDocumentProposal(db,actor,request,base,read),key=await put(request.projectId,plan.proposal.diffRef.artifactId,plan.diff);
 return (await storeDocumentProposal(db,actor,request,policyRef,plan,key)).result;
}
export async function readDocumentProposal(db: PoolClient, actor: AuthenticatedIdentity, pid: string, id: string, read: Read) {
  await projectMember(db, actor, pid);
  const row = (await db.query('SELECT * FROM anvil.document_proposals WHERE project_id=$1 AND id=$2', [pid, id])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  const proposal = row.proposal_json as DocumentProposal, content = row.content_json as Content;
  if (contentHash(canonicalJson({ proposal, content, reason: row.reason })) !== row.content_hash) throw new AuthFailure('PROPOSAL_INTEGRITY_FAILED', 503);
  await read(db, pid, proposal.diffRef); await read(db, pid, content.body);
  for (const ref of content.attachments) await read(db, pid, ref);
  const selections = (await db.query('SELECT document_id,version,created_at,created_by FROM anvil.document_proposal_selections WHERE project_id=$1 AND proposal_id=$2 ORDER BY created_at,id', [pid, id])).rows;
  return { ...proposal, proposedContent: content, reason: row.reason as string, createdAt: row.created_at.toISOString(), proposedBy: row.created_by as string, selections: selections.map(s => ({ documentId: s.document_id as string, version: Number(s.version), selectedBy: s.created_by as string, at: s.created_at.toISOString() })) };
}
export async function checkProposalSelection(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, read: Read) {
  const p = request.payload;
  if (typeof p.proposalRef !== 'string' || !importUuid.test(p.proposalRef) || !request.targetId) throw new AuthFailure('PROPOSAL_INPUT_INVALID', 422);
  const proposal = await readDocumentProposal(db, actor, request.projectId, p.proposalRef, read);
  if (proposal.baseRef.id !== request.targetId || proposal.baseRef.version !== request.expectedVersion || proposal.selections.length) throw new AuthFailure('VERSION_CONFLICT', 409);
  const base = (await db.query('SELECT title,form_definition_id,form_version,form_hash,content_hash,stage_ref_json FROM anvil.document_versions WHERE project_id=$1 AND document_id=$2 AND version=$3', [request.projectId, request.targetId, request.expectedVersion])).rows[0];
  if (!base || base.content_hash !== proposal.baseRef.contentHash || base.title !== p.title || canonicalJson(p.stageNodeRef) !== canonicalJson(base.stage_ref_json) || canonicalJson(p.formRef) !== canonicalJson({ id: base.form_definition_id, version: Number(base.form_version), contentHash: base.form_hash }) || canonicalJson(p.content) !== canonicalJson(proposal.proposedContent)) throw new AuthFailure('PROPOSAL_SELECTION_MISMATCH', 409);
}
