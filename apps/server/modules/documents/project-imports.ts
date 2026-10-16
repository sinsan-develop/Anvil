import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { parseTextImport } from './text-import.ts';
export interface ImportArtifact { artifactId: string; bytes: number; contentHash: string; mediaType: string }
export interface ImportCandidate { id: string; originalRef: ImportArtifact; extractedContentRef: ImportArtifact | null; intendedFormRef: VersionRef | null; parserVersion: string | null; losses: string[]; issues: { code: string; message: string }[]; status: 'READY' | 'FAILED' | 'UNSUPPORTED' }
type ReadArtifact = (db: PoolClient, projectId: string, ref: ImportArtifact) => Promise<Buffer>;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
export const importUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function isImportArtifact(value: unknown): value is ImportArtifact { return exact(value, ['artifactId','bytes','contentHash','mediaType']) && typeof value.artifactId === 'string' && importUuid.test(value.artifactId) && Number.isSafeInteger(value.bytes) && Number(value.bytes) >= 0 && Number(value.bytes) <= 20 * 1024 * 1024 && typeof value.contentHash === 'string' && /^[0-9a-f]{64}$/.test(value.contentHash) && typeof value.mediaType === 'string' && value.mediaType.length <= 200; }
export async function createDocumentImport(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef, read: ReadArtifact) {
  const p = request.payload;
  if (request.targetId !== null || request.expectedVersion !== 0 || !exact(p, ['fileRef','intendedFormRef','sourceRefs']) || !isImportArtifact(p.fileRef) || p.intendedFormRef !== null && !isVersionRef(p.intendedFormRef) || !Array.isArray(p.sourceRefs)) throw new AuthFailure('INPUT_INVALID', 422);
  if (p.sourceRefs.length) throw new AuthFailure('DOCUMENT_REFERENCE_CONNECTION_PENDING', 412);
  const formRef = p.intendedFormRef as VersionRef | null;
  if (formRef) {
    const form = (await db.query("SELECT v.definition_json,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3) FOR SHARE OF d", [formRef.id, formRef.version, actor.actorId])).rows[0];
    if (!form || form.content_hash !== formRef.contentHash || contentHash(canonicalJson(form.definition_json)) !== formRef.contentHash) throw new AuthFailure('FORM_REFERENCE_INVALID', 422);
  }
  const parsed = parseTextImport(await read(db, request.projectId, p.fileRef), p.fileRef.mediaType);
  const candidate: ImportCandidate = { id: randomUUID(), originalRef: p.fileRef, extractedContentRef: parsed.status === 'READY' ? p.fileRef : null, intendedFormRef: formRef, ...parsed };
  const receipt = await persistProjectReceipt(db, actor, request, p.fileRef, { status: 'IMPORT_CANDIDATE', candidate }, policyRef, 'EXPLICIT_DOCUMENT_IMPORT');
  await db.query('INSERT INTO anvil.document_imports(id,project_id,original_artifact_id,form_definition_id,form_version,form_hash,candidate_json,content_hash,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [candidate.id, request.projectId, p.fileRef.artifactId, formRef?.id ?? null, formRef?.version ?? null, formRef?.contentHash ?? null, JSON.stringify(candidate), contentHash(canonicalJson(candidate)), actor.actorId, actor.clientId, receipt.id]);
  return receipt.result;
}
export async function readDocumentImport(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, read: ReadArtifact) {
  await projectMember(db, actor, projectId);
  const row = (await db.query('SELECT candidate_json,content_hash,created_at FROM anvil.document_imports WHERE project_id=$1 AND id=$2', [projectId, id])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  const candidate = row.candidate_json as ImportCandidate;
  if (contentHash(canonicalJson(candidate)) !== row.content_hash) throw new AuthFailure('IMPORT_INTEGRITY_FAILED', 503);
  await read(db, projectId, candidate.originalRef);
  const selections = (await db.query('SELECT document_id,version,created_at,created_by FROM anvil.document_import_selections WHERE project_id=$1 AND import_id=$2 ORDER BY created_at,id', [projectId, id])).rows;
  return { ...candidate, createdAt: row.created_at.toISOString(), selections: selections.map(s => ({ documentId: s.document_id, version: Number(s.version), selectedBy: s.created_by, at: s.created_at.toISOString() })) };
}
export async function checkImportSelection(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: unknown, formRef: VersionRef, refs: ImportArtifact[], read: ReadArtifact) {
  if (typeof id !== 'string' || !importUuid.test(id)) throw new AuthFailure('INPUT_INVALID', 422);
  const candidate = await readDocumentImport(db, actor, projectId, id, read);
  if (candidate.status !== 'READY' || !candidate.extractedContentRef) throw new AuthFailure('IMPORT_NOT_READY', 412);
  if (candidate.intendedFormRef && canonicalJson(candidate.intendedFormRef) !== canonicalJson(formRef)) throw new AuthFailure('IMPORT_FORM_CONFLICT', 409);
  if (!refs.some(ref => canonicalJson(ref) === canonicalJson(candidate.originalRef))) throw new AuthFailure('IMPORT_ORIGINAL_REQUIRED', 422);
}
