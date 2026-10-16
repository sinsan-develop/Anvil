import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { FormDefinition } from './forms.ts';
import { ArtifactStore } from '../../storage/artifact-store.ts';

interface ArtifactRef { artifactId: string; bytes: number; contentHash: string; mediaType: string }
interface DocumentContent { body: ArtifactRef; attachments: ArtifactRef[]; sections: { itemId: string; anchor: string }[]; sourceRefs: [] }
function exact(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
function artifactRef(value: unknown): value is ArtifactRef { return exact(value, ['artifactId', 'bytes', 'contentHash', 'mediaType']) && typeof value.artifactId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.artifactId) && Number.isSafeInteger(value.bytes) && Number(value.bytes) >= 0 && Number(value.bytes) <= 20 * 1024 * 1024 && typeof value.contentHash === 'string' && /^[0-9a-f]{64}$/.test(value.contentHash) && typeof value.mediaType === 'string' && value.mediaType.length <= 200; }
export class ProjectDocuments {
  #store: ArtifactStore | null;
  constructor(root?: string) { this.#store = root ? new ArtifactStore(root) : null; }
  async #artifact(db: PoolClient, projectId: string, ref: ArtifactRef) {
    const row = (await db.query("SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND state='READY' AND content_hash=$3 AND bytes=$4 AND media_type=$5", [ref.artifactId, projectId, ref.contentHash, ref.bytes, ref.mediaType])).rows[0];
    if (!row) throw new AuthFailure('ARTIFACT_NOT_READY', 422);
    if (!this.#store) throw new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412);
    if (row.storage_key !== `blobs/${projectId}/${ref.artifactId}`) throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED', 503);
    return this.#store.read(projectId, ref.artifactId, ref);
  }
  async save(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const p = request.payload;
    if (!exact(p, ['title', 'formRef', 'stageNodeRef', 'content', 'importCandidateRef', 'reason']) || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 200 || typeof p.reason !== 'string' || !p.reason.trim() || p.reason.length > 20_000 || !isVersionRef(p.formRef)
      || !exact(p.content, ['body', 'attachments', 'sections', 'sourceRefs']) || !artifactRef(p.content.body) || !Array.isArray(p.content.attachments) || p.content.attachments.length > 200 || !p.content.attachments.every(artifactRef) || !Array.isArray(p.content.sections) || p.content.sections.length > 200 || !Array.isArray(p.content.sourceRefs)) throw new AuthFailure('INPUT_INVALID', 422);
    if (p.stageNodeRef !== null || p.importCandidateRef !== null || p.content.sourceRefs.length) throw new AuthFailure('DOCUMENT_REFERENCE_CONNECTION_PENDING', 412);
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
    const authorRef = { kind: 'HUMAN', userId: actor.actorId }, ref = { id, version, contentHash: contentHash(canonicalJson({ title: p.title, formRef: p.formRef, stageNodeRef: null, content })) };
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'DRAFT', validation }, policyRef, 'EXPLICIT_DOCUMENT_DRAFT');
    if (request.targetId === null) await db.query('INSERT INTO anvil.documents(id,project_id,title,head_version,created_by) VALUES($1,$2,$3,1,$4)', [id, request.projectId, p.title, actor.actorId]);
    else await db.query('UPDATE anvil.documents SET title=$2,head_version=$3,updated_at=now() WHERE id=$1', [id, p.title, version]);
    await db.query('INSERT INTO anvil.document_versions(project_id,document_id,version,form_definition_id,form_version,form_hash,body_artifact_id,title,source_refs_json,content_json,content_hash,sections_json,author_ref_json,validation_json,reason,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)', [request.projectId, id, version, p.formRef.id, p.formRef.version, p.formRef.contentHash, content.body.artifactId, p.title, '[]', JSON.stringify(content), ref.contentHash, JSON.stringify(content.sections), JSON.stringify(authorRef), JSON.stringify(validation), p.reason, actor.clientId, receipt.id]);
    for (const [kind, artifact] of [['BODY', content.body], ...content.attachments.map(ref => ['ATTACHMENT', ref])] as ['BODY' | 'ATTACHMENT', ArtifactRef][]) await db.query('INSERT INTO anvil.document_artifact_links(project_id,document_id,version,artifact_id,kind) VALUES($1,$2,$3,$4,$5)', [request.projectId, id, version, artifact.artifactId, kind]);
    await db.query("INSERT INTO anvil.document_version_events(id,project_id,document_id,version,event_kind,actor_ref,reason,command_id) VALUES($1,$2,$3,$4,'DRAFT_SAVED',$5,$6,$7)", [randomUUID(), request.projectId, id, version, JSON.stringify(authorRef), p.reason, receipt.id]);
    return receipt.result;
  }
  async version(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    const row = (await db.query('SELECT v.*,d.confirmed_version FROM anvil.document_versions v JOIN anvil.documents d ON d.id=v.document_id AND d.project_id=v.project_id WHERE v.project_id=$1 AND v.document_id=$2 AND v.version=$3', [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    const formRef = { id: row.form_definition_id, version: Number(row.form_version), contentHash: row.form_hash }, content = row.content_json as DocumentContent;
    if (contentHash(canonicalJson({ title: row.title, formRef, stageNodeRef: row.stage_ref_json, content })) !== row.content_hash) throw new AuthFailure('DOCUMENT_INTEGRITY_FAILED', 503);
    await this.#artifact(db, projectId, content.body);
    const events = (await db.query('SELECT event_kind,actor_ref,reason,created_at FROM anvil.document_version_events WHERE project_id=$1 AND document_id=$2 AND version=$3 ORDER BY created_at,id', [projectId, id, version])).rows;
    return { id, version, title: row.title, formRef, stageNodeRef: row.stage_ref_json, content, contentHash: row.content_hash, sourceRefs: row.source_refs_json, authorRef: row.author_ref_json, createdAt: row.created_at.toISOString(), confirmed: Number(row.confirmed_version) === version, validation: row.validation_json, statusHistory: events.map(event => ({ kind: event.event_kind, actorRef: event.actor_ref, reason: event.reason, at: event.created_at.toISOString() })), reviewRefs: [], proposalRefs: [], sourceLinks: [] };
  }
}
export function registerProjectDocumentReads(app: FastifyInstance, options: AccessRoutesOptions, documents: ProjectDocuments) {
  const idSchema = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' };
  app.get<{ Params: { projectId: string; documentId: string; version: string } }>('/api/v1/projects/:projectId/documents/:documentId/versions/:version', { schema: { params: { type: 'object', additionalProperties: false, required: ['projectId', 'documentId', 'version'], properties: { projectId: idSchema, documentId: idSchema, version: { type: 'string', pattern: '^[1-9][0-9]{0,14}$' } } } } }, request => {
    if (request.headers.host !== new URL(options.origin).host) throw new AuthFailure('ORIGIN_INVALID', 403);
    const cookies = (request.headers.cookie ?? '').split(';').map(item => item.trim()).filter(item => item.startsWith('__Host-anvil.sid='));
    const token = cookies.length === 1 ? cookies[0]!.slice('__Host-anvil.sid='.length) : '';
    return options.repository.authenticated(token, null, (db, actor) => documents.version(db, actor, request.params.projectId, request.params.documentId, Number(request.params.version)));
  });
}
