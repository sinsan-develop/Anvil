import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, newDocument, type DocumentSession, type DocumentBuffer } from './editor-api.ts';
import { getPinnedForm } from '../methodologies/forms-api.ts';
import { readPreservedDocumentText, type Proposal } from './proposal-api.ts';
import type { ImportCandidate } from '../../../../server/modules/documents/project-imports.ts';
type Ref = DocumentBuffer['formRef'];
export interface ImportSummary extends ImportCandidate { createdAt: string; integrity: 'NOT_RECHECKED' }
export interface ProposalSummary extends Omit<Proposal, 'status'> { status: 'PENDING' | 'SELECTED'; title: string; createdAt: string; integrity: 'NOT_RECHECKED' }
export interface MaterialPage<T> { items: T[]; hasMore: boolean; nextCursor: string | null; observedAt: string }
export interface StoredImportView { candidate: ImportCandidate & { createdAt: string; selections: { documentId: string; version: number; selectedBy: string; at: string }[] }; body: string | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, hash = /^[0-9a-f]{64}$/;
const validRef = (r: Ref) => r && uuid.test(r.id) && Number.isSafeInteger(r.version) && r.version > 0 && hash.test(r.contentHash);
const sameRef = (a: Ref, b: Ref) => a.id === b.id && a.version === b.version && a.contentHash === b.contentHash;
const artifact = (r: ImportCandidate['originalRef']) => r && uuid.test(r.artifactId) && Number.isSafeInteger(r.bytes) && r.bytes >= 0 && r.bytes <= 20 * 1024 * 1024 && hash.test(r.contentHash) && typeof r.mediaType === 'string';
const sameArtifact = (a: ImportCandidate['originalRef'], b: ImportCandidate['originalRef']) => artifact(a) && artifact(b) && a.artifactId === b.artifactId && a.bytes === b.bytes && a.contentHash === b.contentHash && a.mediaType === b.mediaType;
function validImport(c: ImportCandidate) { return c && uuid.test(c.id) && artifact(c.originalRef) && (c.intendedFormRef === null || validRef(c.intendedFormRef)) && ['READY','UNSUPPORTED','FAILED'].includes(c.status) && Array.isArray(c.losses) && c.losses.length <= 200 && c.losses.every(v => typeof v === 'string') && Array.isArray(c.issues) && c.issues.length <= 200 && c.issues.every(v => v && typeof v.code === 'string' && typeof v.message === 'string') && (c.status === 'READY' ? c.parserVersion === 'UTF8_IDENTITY_1' && c.extractedContentRef !== null && sameArtifact(c.extractedContentRef, c.originalRef) : c.extractedContentRef === null); }
function path(projectId: string) { if (!uuid.test(projectId)) throw new ApiError('CLIENT_PATH_INVALID'); return `/api/v1/projects/${projectId}`; }
export async function listDocumentMaterials(client: ApiClient, projectId: string, kind: 'imports', cursor: string | null, status?: string): Promise<MaterialPage<ImportSummary>>;
export async function listDocumentMaterials(client: ApiClient, projectId: string, kind: 'proposals', cursor: string | null, status?: string): Promise<MaterialPage<ProposalSummary>>;
export async function listDocumentMaterials(client: ApiClient, projectId: string, kind: 'imports' | 'proposals', cursor: string | null, status = ''): Promise<MaterialPage<ImportSummary | ProposalSummary>> {
  if (cursor !== null && (!cursor || cursor.length > 4096) || status && !(kind === 'imports' ? ['READY','UNSUPPORTED','FAILED'] : ['PENDING','SELECTED']).includes(status)) throw new ApiError('CLIENT_PATH_INVALID');
  const params = new URLSearchParams({ limit: '50' }); if (cursor) params.set('cursor',cursor); if (status) params.set('status',status);
  const value = await client.get<MaterialPage<ImportSummary | ProposalSummary>>(`${path(projectId)}/${kind}?${params}`);
  if (!value || !Array.isArray(value.items) || value.items.length > 50 || typeof value.hasMore !== 'boolean' || value.hasMore !== (typeof value.nextCursor === 'string' && value.nextCursor.length > 0 && value.nextCursor.length <= 4096) || !value.hasMore && value.nextCursor !== null || !Number.isFinite(Date.parse(value.observedAt)) || new Set(value.items.map(v => v?.id)).size !== value.items.length || value.items.some(v => !v || !uuid.test(v.id) || v.integrity !== 'NOT_RECHECKED' || !Number.isFinite(Date.parse(v.createdAt)) || (kind === 'imports' ? !validImport(v as ImportSummary) : !validRef((v as ProposalSummary).baseRef) || !artifact((v as ProposalSummary).diffRef) || !artifact((v as ProposalSummary).proposedContentRef) || !['PENDING','SELECTED'].includes(v.status) || typeof (v as ProposalSummary).title !== 'string'))) throw new ApiError('RESPONSE_INVALID');
  return value;
}
export async function readStoredImport(client: ApiClient, projectId: string, id: string, options?:{expectedOriginalRef?:ImportCandidate['originalRef'];active?:()=>boolean}): Promise<StoredImportView> {
  const check=()=>{if(options?.active&&!options.active())throw new ApiError('IMPORT_SOURCE_READ_PAUSED');};check();
  if(options?.expectedOriginalRef!==undefined&&!artifact(options.expectedOriginalRef))throw new ApiError('CLIENT_PATH_INVALID');
  if (!uuid.test(id)) throw new ApiError('CLIENT_PATH_INVALID');
  const c = await client.get<StoredImportView['candidate']>(`${path(projectId)}/imports/${id}`);
  check();if(options?.expectedOriginalRef!==undefined&&!sameArtifact(c?.originalRef,options.expectedOriginalRef))throw new ApiError('IMPORT_SOURCE_CHANGED');
  if (!validImport(c) || c.id !== id || !Number.isFinite(Date.parse(c.createdAt)) || !Array.isArray(c.selections) || c.selections.length > 2000 || c.selections.some(s => !uuid.test(s.documentId) || !Number.isSafeInteger(s.version) || s.version < 1 || !uuid.test(s.selectedBy) || !Number.isFinite(Date.parse(s.at)))) throw new ApiError('RESPONSE_INVALID');
  const body=c.status==='READY'?await readPreservedDocumentText(client, projectId, c.originalRef):null;check();return { candidate: c, body };
}
export async function prepareStoredImport(client: ApiClient, projectId: string, value: StoredImportView, session: DocumentSession, selectedForm: Ref | null): Promise<DocumentBuffer> {
  const c = value.candidate, ref = c.intendedFormRef ?? selectedForm;
  if (!validImport(c) || c.status !== 'READY' || value.body === null || !ref || !validRef(ref)) throw new ApiError('IMPORT_SELECTION_REQUIRED');
  const bytes = new TextEncoder().encode(value.body), digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
  if (bytes.length > 2 * 1024 * 1024 || bytes.length !== c.originalRef.bytes || digest !== c.originalRef.contentHash || !['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(c.originalRef.mediaType) || c.intendedFormRef && !sameRef(c.intendedFormRef,ref)) throw new ApiError('IMPORT_INTEGRITY_FAILED');
  const [form, generation] = await Promise.all([getPinnedForm(client,ref), documentControl(client,projectId,session)]);
  return { ...newDocument(projectId,form,session.user.id,generation), title: '가져온 문서', body: value.body, mediaType: c.originalRef.mediaType, content: { attachments: [c.originalRef], sections: [], sourceRefs: [] }, importCandidateRef: c.id, dirty: true };
}
