import {assertArtifactBackupReadBudget,type ArtifactBackupReadBudget} from '../../storage/artifact-backup-budget-read.ts';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { documentStageBinding, documentStageOptions, readStageNodeRef } from './document-stage.ts';
import type { PoolClient } from 'pg';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { FormDefinition } from './forms.ts';
import { ArtifactStore } from '../../storage/artifact-store.ts';
import{assertStoredArtifactReadable}from'../../storage/sensitive-inspection.ts';
import { ProjectListCodec } from '../projects/service.ts';
import { documentReviewCriteria, documentReviews, writeDocumentReview } from './project-content-review.ts';
import { validateDocumentConfirmation } from './document-validation.ts';
import { confirmProjectDocument } from './project-confirmation.ts';
import { createDocumentImport, readDocumentImport, checkImportSelection } from './project-imports.ts';
import { createDocumentProposal, readDocumentProposal, checkProposalSelection } from './project-proposals.ts';
import { listDocumentMaterials } from './material-list.ts';
import { readApplicationSnapshot } from '../methodologies/application-snapshot.ts';
import {readDocumentSourceLinks} from './document-source-link-list.ts';

interface ArtifactRef { artifactId: string; bytes: number; contentHash: string; mediaType: string }
interface DocumentContent { body: ArtifactRef; attachments: ArtifactRef[]; sections: { itemId: string; anchor: string }[]; sourceRefs: [] }
function exact(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
function artifactRef(value: unknown): value is ArtifactRef { return exact(value, ['artifactId', 'bytes', 'contentHash', 'mediaType']) && typeof value.artifactId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.artifactId) && Number.isSafeInteger(value.bytes) && Number(value.bytes) >= 0 && Number(value.bytes) <= 20 * 1024 * 1024 && typeof value.contentHash === 'string' && /^[0-9a-f]{64}$/.test(value.contentHash) && typeof value.mediaType === 'string' && value.mediaType.length <= 200; }
export class ProjectDocuments {
  #store: ArtifactStore | null;
  constructor(root?: string) { this.#store = root ? new ArtifactStore(root) : null; }
  async import(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    return createDocumentImport(db, actor, request, policyRef, (client, projectId, ref) => this.#artifact(client, projectId, ref));
  }
  async imported(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string) {
    return readDocumentImport(db, actor, projectId, id, (client, pid, ref) => this.#artifact(client, pid, ref));
  }
  async propose(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    if (!request.targetId) throw new AuthFailure('PROPOSAL_INPUT_INVALID', 422);
    const base = await this.version(db, actor, request.projectId, request.targetId, request.expectedVersion);
    return createDocumentProposal(db, actor, request, policyRef, base, (client, pid, ref) => this.#artifact(client, pid, ref), async (pid, id, bytes) => { if (!this.#store) throw new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412); return this.#store.put(pid, id, bytes); });
  }
  async proposal(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string) {
    return readDocumentProposal(db, actor, projectId, id, (client, pid, ref) => this.#artifact(client, pid, ref));
  }
  async confirm(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    if (!request.targetId) throw new AuthFailure('DOCUMENT_CONFIRMATION_INPUT_INVALID', 422);
    const document = await this.version(db, actor, request.projectId, request.targetId, request.expectedVersion);
    for (const ref of document.content.attachments) await this.#artifact(db, request.projectId, ref);
    return confirmProjectDocument(db, actor, request, policyRef, document);
  }
  async review(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    if (!request.targetId) throw new AuthFailure('REVIEW_INPUT_INVALID', 422);
    // 검토를 기록하기 직전에도 원본 파일과 불변 버전 무결성을 검사한다.
    await this.version(db, actor, request.projectId, request.targetId, request.expectedVersion);
    return writeDocumentReview(db, actor, request, policyRef);
  }
  async list(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, query: Record<string, unknown>, codec: ProjectListCodec) {
    await projectMember(db, actor, projectId);
    if (Object.keys(query).some(key => !['limit', 'cursor', 'applicationId', 'nodeId'].includes(key)) || query.limit !== undefined && (typeof query.limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(query.limit) || Number(query.limit) > 200) || query.cursor !== undefined && (typeof query.cursor !== 'string' || query.cursor.length > 4096)) throw new AuthFailure('INPUT_INVALID', 400);
    let stage: ReturnType<typeof readStageNodeRef> = null;
    if (query.applicationId !== undefined || query.nodeId !== undefined) {
      try { stage = readStageNodeRef({ applicationId: query.applicationId, nodeId: query.nodeId }); } catch { throw new AuthFailure('INPUT_INVALID', 400); }
    }
    const limit = query.limit === undefined ? 50 : Number(query.limit), filter = { query: stage ? canonicalJson({ projectId, ...stage }) : projectId, archived: false, limit };
    let position: { at: string; id: string } | null = null;
    if (query.cursor !== undefined) { try { position = codec.read(String(query.cursor), actor.actorId, filter); } catch { throw new AuthFailure('CURSOR_INVALID', 400); } }
    const params = [projectId, position?.at ?? null, position?.id ?? null, limit + 1];
    let rows;
    if (stage) {
      // 회원·현재 적용·문서 head를 한 문장의 MVCC snapshot으로 읽는다. 확인 뒤 별도 목록 SELECT를 하지 않는다.
      const atomic = (await db.query(`WITH member_scope AS (
        SELECT p.id FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$7 AND m.revoked_at IS NULL
      ), current_application AS (
        SELECT a.* FROM anvil.project_methodologies a WHERE a.project_id IN (SELECT id FROM member_scope) ORDER BY a.application_version DESC LIMIT 1
      ) SELECT membership.is_member,row_to_json(a) AS application,d.*
        FROM (SELECT EXISTS(SELECT 1 FROM member_scope) AS is_member) membership LEFT JOIN current_application a ON true
        LEFT JOIN LATERAL (
          SELECT d.id,d.title,d.head_version,d.confirmed_version,d.updated_at,to_char(d.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') cursor_at
          FROM anvil.documents d JOIN anvil.document_versions v ON v.project_id=d.project_id AND v.document_id=d.id AND v.version=d.head_version
          WHERE d.project_id=$1 AND v.stage_ref_json=jsonb_build_object('applicationId',$5::text,'nodeId',$6::text)
            AND ($2::timestamptz IS NULL OR (d.updated_at,d.id)<($2::timestamptz,$3::uuid))
          ORDER BY d.updated_at DESC,d.id DESC LIMIT $4
        ) d ON membership.is_member AND a.id=$5::uuid ORDER BY d.updated_at DESC,d.id DESC`, [...params, stage.applicationId, stage.nodeId, actor.actorId])).rows;
      if (!atomic[0]?.is_member) throw new AuthFailure('NOT_FOUND', 404);
      const current = readApplicationSnapshot(projectId, atomic[0].application ? [atomic[0].application] : []);
      if (!current.applicationRef || current.applicationRef.id !== stage.applicationId) throw new AuthFailure('METHODOLOGY_APPLICATION_CHANGED', 409);
      if (!(current.snapshot.graph as { nodes: { nodeId: string }[] }).nodes.some(node => node.nodeId === stage.nodeId)) throw new AuthFailure('NOT_FOUND', 404);
      rows = atomic.filter(row => row.id !== null);
    } else rows = (await db.query("SELECT id,title,head_version,confirmed_version,updated_at,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.documents WHERE project_id=$1 AND ($2::timestamptz IS NULL OR (updated_at,id)<($2::timestamptz,$3::uuid)) ORDER BY updated_at DESC,id DESC LIMIT $4", params)).rows;
    const hasMore = rows.length > limit, visible = rows.slice(0, limit), last = visible.at(-1);
    return { items: visible.map(row => ({ id: row.id, title: row.title, headVersion: Number(row.head_version), confirmedVersion: row.confirmed_version === null ? null : Number(row.confirmed_version), updatedAt: row.updated_at.toISOString() })), hasMore, nextCursor: hasMore ? codec.create(actor.actorId, filter, { at: last!.cursor_at, id: last!.id }) : null, observedAt: new Date().toISOString() };
  }
  async #artifact(db: PoolClient, projectId: string, ref: ArtifactRef, backupBudget?: ArtifactBackupReadBudget) {
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const row = (await db.query("SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5", [ref.artifactId, projectId, ref.contentHash, ref.bytes, ref.mediaType])).rows[0];
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    if (!row) throw new AuthFailure('ARTIFACT_NOT_READY', 422);
    if(row.state==='QUARANTINED')throw new AuthFailure('ARTIFACT_QUARANTINED',412);
    if (!this.#store) throw new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412);
    if (row.storage_key !== `blobs/${projectId}/${ref.artifactId}`) throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED', 503);
    const bytes=await (backupBudget===undefined?this.#store.read(projectId, ref.artifactId, ref):this.#store.read(projectId, ref.artifactId, ref,backupBudget));if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);assertStoredArtifactReadable(row,bytes);if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);return bytes;
  }
  async originalText(db:PoolClient,projectId:string,ref:ArtifactRef,backupBudget?:ArtifactBackupReadBudget) {
    if(backupBudget!==undefined){
      assertArtifactBackupReadBudget(backupBudget);
      if(!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(ref.mediaType)||ref.bytes>2*1024*1024)throw new AuthFailure('DOCUMENT_TEXT_FORMAT_NOT_SUPPORTED',412);
      const bytes=await this.#artifact(db,projectId,ref,backupBudget);assertArtifactBackupReadBudget(backupBudget);
      let text:string;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new AuthFailure('DOCUMENT_UTF8_INVALID',422);}
      assertArtifactBackupReadBudget(backupBudget);return text;
    }
    if(!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(ref.mediaType)||ref.bytes>2*1024*1024) throw new AuthFailure('DOCUMENT_TEXT_FORMAT_NOT_SUPPORTED',412);
    const bytes=await this.#artifact(db,projectId,ref);
    try {return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);} catch {throw new AuthFailure('DOCUMENT_UTF8_INVALID',422);}
  }
  async save(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const p = request.payload;
    if (!(exact(p, ['title', 'formRef', 'stageNodeRef', 'content', 'importCandidateRef', 'reason']) || exact(p, ['title', 'formRef', 'stageNodeRef', 'content', 'importCandidateRef', 'reason', 'proposalRef'])) || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 200 || typeof p.reason !== 'string' || !p.reason.trim() || p.reason.length > 20_000 || !isVersionRef(p.formRef)
      || !exact(p.content, ['body', 'attachments', 'sections', 'sourceRefs']) || !artifactRef(p.content.body) || !Array.isArray(p.content.attachments) || p.content.attachments.length > 200 || !p.content.attachments.every(artifactRef) || !Array.isArray(p.content.sections) || p.content.sections.length > 200 || !Array.isArray(p.content.sourceRefs)) throw new AuthFailure('INPUT_INVALID', 422);
    if (p.content.sourceRefs.length) throw new AuthFailure('DOCUMENT_REFERENCE_CONNECTION_PENDING', 412);
    const stageNodeRef = readStageNodeRef(p.stageNodeRef);
    const stageBinding = await documentStageBinding(db, request.projectId, stageNodeRef, p.formRef, true);
    const content = p.content as unknown as DocumentContent;
    if (!['text/plain;charset=utf-8', 'text/markdown;charset=utf-8'].includes(content.body.mediaType) || content.body.bytes > 2 * 1024 * 1024) throw new AuthFailure('DOCUMENT_TEXT_FORMAT_NOT_SUPPORTED', 412);
    const form = (await db.query("SELECT v.definition_json,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3) FOR SHARE OF d", [p.formRef.id, p.formRef.version, actor.actorId])).rows[0];
    if (!form || form.content_hash !== p.formRef.contentHash || contentHash(canonicalJson(form.definition_json)) !== p.formRef.contentHash) throw new AuthFailure('FORM_REFERENCE_INVALID', 422);
    const definition = form.definition_json as FormDefinition;
    const bytes = await this.#artifact(db, request.projectId, content.body);
    let body: string;
    try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new AuthFailure('DOCUMENT_UTF8_INVALID', 422); }
    const refs = new Set([content.body.artifactId]);
    for (const attachment of content.attachments) { if (refs.has(attachment.artifactId)) throw new AuthFailure('DUPLICATE_ARTIFACT', 422); refs.add(attachment.artifactId); await this.#artifact(db, request.projectId, attachment); }
    if (p.importCandidateRef !== null) await checkImportSelection(db, actor, request.projectId, p.importCandidateRef, p.formRef, [content.body, ...content.attachments], (client, pid, ref) => this.#artifact(client, pid, ref));
    if (p.proposalRef != null) await checkProposalSelection(db, actor, request, (client, pid, ref) => this.#artifact(client, pid, ref));
    const lines = body.split(/\r\n|\n|\r/), sections = new Set<string>();
    for (const section of content.sections) {
      if (!exact(section, ['itemId', 'anchor']) || typeof section.itemId !== 'string' || typeof section.anchor !== 'string' || !/^line:[1-9][0-9]{0,7}$/.test(section.anchor) || Number(section.anchor.slice(5)) > lines.length || sections.has(section.itemId) || !definition.items.some(item => item.itemId === section.itemId)) throw new AuthFailure('DOCUMENT_SECTION_INVALID', 422);
      sections.add(section.itemId);
    }
    const issues = definition.items.filter(item => item.required && !sections.has(item.itemId)).map(item => ({ code: 'REQUIRED_SECTION_MISSING', location: 'sections.' + item.itemId, severity: 'ERROR', message: '양식의 필수 항목과 원문 위치를 연결하세요.' }));
    const validation = { validForConfirmation: issues.length === 0, issues, formatOnly: true, contentReview: 'NOT_PERFORMED', userAcceptance: 'NOT_PERFORMED' };
    let id = request.targetId, version = 1;
    if (id === null) { if (request.expectedVersion !== 0) throw new AuthFailure('VERSION_CONFLICT', 409); id = randomUUID(); }
    else {
      const existing = (await db.query('SELECT * FROM anvil.documents WHERE id=$1 AND project_id=$2 FOR UPDATE', [id, request.projectId])).rows[0];
      if (!existing) throw new AuthFailure('NOT_FOUND', 404);
      if (Number(existing.head_version) !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      version = request.expectedVersion + 1; if (!Number.isSafeInteger(version)) throw new AuthFailure('VERSION_CONFLICT', 409);
    }
    const authorRef = { kind: 'HUMAN', userId: actor.actorId }, ref = { id, version, contentHash: contentHash(canonicalJson({ title: p.title, formRef: p.formRef, stageNodeRef, content })) };
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'DRAFT', validation, stageNodeRef, stageBinding, importCandidateRef: p.importCandidateRef, proposalRef: p.proposalRef ?? null }, policyRef, 'EXPLICIT_DOCUMENT_DRAFT');
    if (request.targetId === null) await db.query('INSERT INTO anvil.documents(id,project_id,title,head_version,created_by) VALUES($1,$2,$3,1,$4)', [id, request.projectId, p.title, actor.actorId]);
    else await db.query('UPDATE anvil.documents SET title=$2,head_version=$3,updated_at=now() WHERE id=$1', [id, p.title, version]);
    await db.query('INSERT INTO anvil.document_versions(project_id,document_id,version,form_definition_id,form_version,form_hash,body_artifact_id,title,source_refs_json,content_json,content_hash,sections_json,author_ref_json,validation_json,reason,client_id,command_id,stage_ref_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)', [request.projectId, id, version, p.formRef.id, p.formRef.version, p.formRef.contentHash, content.body.artifactId, p.title, '[]', JSON.stringify(content), ref.contentHash, JSON.stringify(content.sections), JSON.stringify(authorRef), JSON.stringify(validation), p.reason, actor.clientId, receipt.id, stageNodeRef ? JSON.stringify(stageNodeRef) : null]);
    for (const [kind, artifact] of [['BODY', content.body], ...content.attachments.map(ref => ['ATTACHMENT', ref])] as ['BODY' | 'ATTACHMENT', ArtifactRef][]) await db.query('INSERT INTO anvil.document_artifact_links(project_id,document_id,version,artifact_id,kind) VALUES($1,$2,$3,$4,$5)', [request.projectId, id, version, artifact.artifactId, kind]);
    if (p.importCandidateRef !== null) await db.query('INSERT INTO anvil.document_import_selections(id,project_id,import_id,document_id,version,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), request.projectId, p.importCandidateRef, id, version, actor.actorId, actor.clientId, receipt.id]);
    if (p.proposalRef != null) await db.query('INSERT INTO anvil.document_proposal_selections(id,project_id,proposal_id,document_id,version,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), request.projectId, p.proposalRef, id, version, actor.actorId, actor.clientId, receipt.id]);
    await db.query("INSERT INTO anvil.document_version_events(id,project_id,document_id,version,event_kind,actor_ref,reason,command_id) VALUES($1,$2,$3,$4,'DRAFT_SAVED',$5,$6,$7)", [randomUUID(), request.projectId, id, version, JSON.stringify(authorRef), p.reason, receipt.id]);
    return receipt.result;
  }
  async version(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number, backupBudget?: ArtifactBackupReadBudget) {
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    await projectMember(db, actor, projectId);
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const row = (await db.query('SELECT v.*,d.confirmed_version FROM anvil.document_versions v JOIN anvil.documents d ON d.id=v.document_id AND d.project_id=v.project_id WHERE v.project_id=$1 AND v.document_id=$2 AND v.version=$3', [projectId, id, version])).rows[0];
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    const formRef = { id: row.form_definition_id, version: Number(row.form_version), contentHash: row.form_hash }, content = row.content_json as DocumentContent;
    if (contentHash(canonicalJson({ title: row.title, formRef, stageNodeRef: row.stage_ref_json, content })) !== row.content_hash) throw new AuthFailure('DOCUMENT_INTEGRITY_FAILED', 503);
    const stageBinding = await documentStageBinding(db, projectId, row.stage_ref_json, formRef, false);
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const raw = await (backupBudget===undefined?this.#artifact(db, projectId, content.body):this.#artifact(db, projectId, content.body,backupBudget));
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    let body: string; try { body = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw); } catch { throw new AuthFailure('DOCUMENT_UTF8_INVALID', 422); }
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const form = (await db.query('SELECT definition_json FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3', [formRef.id, formRef.version, formRef.contentHash])).rows[0];
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    if (!form || contentHash(canonicalJson(form.definition_json)) !== formRef.contentHash) throw new AuthFailure('FORM_INTEGRITY_FAILED', 503);
    const reviews = await documentReviews(db, projectId, { id, version, contentHash: row.content_hash });
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const events = (await db.query("SELECT event_kind,actor_ref,reason,created_at,id FROM anvil.document_version_events WHERE project_id=$1 AND document_id=$2 AND version=$3 UNION ALL SELECT 'CONFIRMED',jsonb_build_object('kind','HUMAN','userId',confirmed_by),'별도 명시 확정',created_at,id FROM anvil.document_confirmations WHERE project_id=$1 AND document_id=$2 AND version=$3 ORDER BY created_at,id", [projectId, id, version])).rows;
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const imports = (await db.query('SELECT import_id FROM anvil.document_import_selections WHERE project_id=$1 AND document_id=$2 AND version=$3', [projectId, id, version])).rows.map(value => value.import_id as string);
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const proposals = (await db.query('SELECT p.id FROM anvil.document_proposals p WHERE p.project_id=$1 AND p.document_id=$2 AND (p.base_version=$3 OR EXISTS(SELECT 1 FROM anvil.document_proposal_selections s WHERE s.project_id=p.project_id AND s.proposal_id=p.id AND s.version=$3)) ORDER BY p.created_at,p.id', [projectId, id, version])).rows.map(value => value.id as string);
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    const result = { id, version, title: row.title, formRef, stageNodeRef: row.stage_ref_json, stageBinding, content, contentHash: row.content_hash, sourceRefs: row.source_refs_json, authorRef: row.author_ref_json, createdAt: row.created_at.toISOString(), confirmed: Number(row.confirmed_version) === version, validation: { ...row.validation_json, ...validateDocumentConfirmation(body, content.sections, form.definition_json) }, statusHistory: events.map(event => ({ kind: event.event_kind, actorRef: event.actor_ref, reason: event.reason, at: event.created_at.toISOString() })), contentReviewCriteria: documentReviewCriteria(formRef, form.definition_json), contentReviews: reviews, reviewRefs: reviews.map(review => review.ref), proposalRefs: proposals, sourceLinks: [], importCandidateRefs: imports };
    if(backupBudget!==undefined)assertArtifactBackupReadBudget(backupBudget);
    return result;
  }
}
export function registerProjectDocumentReads(app: FastifyInstance, options: AccessRoutesOptions, documents: ProjectDocuments) {
  const idSchema = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' };
  const codec = new ProjectListCodec(value => options.repository.signProjectCursor('DOCUMENTS:' + value));
  app.get<{Params:{projectId:string;documentId:string};Querystring:Record<string,unknown>}>('/api/v1/projects/:projectId/documents/:documentId/source-links',{schema:{params:{type:'object',additionalProperties:false,required:['projectId','documentId'],properties:{projectId:idSchema,documentId:idSchema}},querystring:{type:'object',additionalProperties:false,required:['version','contentHash'],properties:{version:{type:'string',pattern:'^[1-9][0-9]{0,14}$'},contentHash:{type:'string',pattern:'^[0-9a-f]{64}$'}}}}},request=>options.repository.authenticated(readToken(request),null,(db,actor)=>readDocumentSourceLinks(db,actor,request.params.projectId,request.params.documentId,request.query)));
  app.get<{ Params: { projectId: string }; Querystring: Record<string, unknown> }>('/api/v1/projects/:projectId/documents/stage-options', { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId'], properties: { projectId: idSchema } } } }, request => options.repository.authenticated(readToken(request), null, (db, actor) => documentStageOptions(db, actor, request.params.projectId, request.query)));
  function readToken(request: FastifyRequest) {
    if (request.headers.host !== new URL(options.origin).host) throw new AuthFailure('ORIGIN_INVALID', 403);
    const cookies = (request.headers.cookie ?? '').split(';').map(item => item.trim()).filter(item => item.startsWith('__Host-anvil.sid='));
    return cookies.length === 1 ? cookies[0]!.slice('__Host-anvil.sid='.length) : '';
  }
  app.get<{ Params: { projectId: string }; Querystring: Record<string, unknown> }>('/api/v1/projects/:projectId/documents', { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId'], properties: { projectId: idSchema } } } }, request => options.repository.authenticated(readToken(request), null, (db, actor) => documents.list(db, actor, request.params.projectId, request.query, codec)));
  for (const [kind, path] of [['IMPORTS','imports'], ['PROPOSALS','proposals']] as const) {
    const materialCodec = new ProjectListCodec(value => options.repository.signProjectCursor(kind + ':' + value));
    app.get<{ Params: { projectId: string }; Querystring: Record<string, unknown> }>(`/api/v1/projects/:projectId/${path}`, { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId'], properties: { projectId: idSchema } } } }, request => options.repository.authenticated(readToken(request), null, (db, actor) => listDocumentMaterials(db, actor, request.params.projectId, kind, request.query, materialCodec)));
  }
  app.get<{ Params: { projectId: string; importId: string } }>('/api/v1/projects/:projectId/imports/:importId', { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId','importId'], properties: { projectId: idSchema, importId: idSchema } } } }, request => options.repository.authenticated(readToken(request), null, (db, actor) => documents.imported(db, actor, request.params.projectId, request.params.importId)));
  app.get<{ Params: { projectId: string; proposalId: string } }>('/api/v1/projects/:projectId/proposals/:proposalId', { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId','proposalId'], properties: { projectId: idSchema, proposalId: idSchema } } } }, request => options.repository.authenticated(readToken(request), null, (db, actor) => documents.proposal(db, actor, request.params.projectId, request.params.proposalId)));
  app.get<{ Params: { projectId: string; documentId: string; version: string } }>('/api/v1/projects/:projectId/documents/:documentId/versions/:version', { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId', 'documentId', 'version'], properties: { projectId: idSchema, documentId: idSchema, version: { type: 'string', pattern: '^[1-9][0-9]{0,14}$' } } } } }, request => {
    return options.repository.authenticated(readToken(request), null, (db, actor) => documents.version(db, actor, request.params.projectId, request.params.documentId, Number(request.params.version)));
  });
}
