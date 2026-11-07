import { ApiClient, ApiError } from '../../api/client.ts';
import { exactDraftObject, draftArtifactLimits, draftArtifactMediaTypes, draftUuid, validDraftUploadCommand, validDraftArtifactRef, type DraftUploadCommand, type DraftArtifactRef, type DraftUploadReceipt } from '../../../../../contracts/draft-artifacts.ts';
export interface DraftUploadBuffer { ownerUserId: string; draftId: string; command: DraftUploadCommand; bytes: Uint8Array<ArrayBuffer>; filename: string; attempted: boolean; uncertain: boolean; receipt?: DraftUploadReceipt }
export async function draftBytesHash(bytes: Uint8Array<ArrayBuffer>) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join(''); }
export async function prepareDraftUpload(ownerUserId: string, clientId: string, draftId: string, version: number, file: File): Promise<DraftUploadBuffer> {
  if (!draftUuid(ownerUserId) || !draftUuid(clientId) || !draftUuid(draftId) || !Number.isSafeInteger(version) || version < 1 || file.size > draftArtifactLimits.fileBytes) throw new ApiError('INPUT_INVALID');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mediaType = file.type;
  if (['text/plain', 'text/markdown', 'text/html'].includes(mediaType)) mediaType += ';charset=utf-8';
  if (!draftArtifactMediaTypes.includes(mediaType as never)) mediaType = 'application/octet-stream';
  return { ownerUserId, draftId, command: { schemaVersion: 1, commandId: crypto.randomUUID(), clientId, expectedVersion: version, payload: { bytes: bytes.length, contentHash: await draftBytesHash(bytes), mediaType } }, bytes, filename: file.name, attempted: false, uncertain: false };
}
async function responseJson(response: Response) {
  let value: unknown;
  try { if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error(); value = await response.json(); } catch { throw new ApiError('RESPONSE_INVALID', response.status); }
  if (!response.ok) { const code = value && typeof value === 'object' && 'code' in value ? value.code : null; throw new ApiError(typeof code === 'string' && /^[A-Z_]{1,64}$/.test(code) ? code : 'REQUEST_FAILED', response.status); }
  return value;
}
export async function uploadDraftArtifact(client: ApiClient, csrf: string, buffer: DraftUploadBuffer): Promise<DraftUploadReceipt> {
  if (!draftUuid(buffer.draftId) || !validDraftUploadCommand(buffer.command) || !/^[A-Za-z0-9_-]{43}$/.test(csrf) || buffer.bytes.length !== buffer.command.payload.bytes || await draftBytesHash(buffer.bytes) !== buffer.command.payload.contentHash) throw new ApiError('INPUT_INVALID');
  const header = JSON.stringify(buffer.command); if (new TextEncoder().encode(header).length > draftArtifactLimits.headerBytes) throw new ApiError('INPUT_INVALID');
  let response: Response;
  try { response = await client.transport.call(globalThis, `/api/v1/project-drafts/${buffer.draftId}/files`, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { 'Content-Type': 'application/octet-stream', Accept: 'application/json', 'X-Anvil-CSRF': csrf, 'X-Anvil-Command': header }, body: buffer.bytes }); }
  catch { throw new ApiError('CONNECTION_LOST'); }
  const value = await responseJson(response);
  if (!exactDraftObject(value, ['scopeKind','draftId','commandId','clientId','version','status','data']) || !exactDraftObject(value.data, ['artifactRef','status','inspection'])) throw new ApiError('RESPONSE_INVALID');
  const data=value.data, ref=data.artifactRef, inspection=data.inspection;
  if (value.scopeKind !== 'DRAFT' || value.draftId !== buffer.draftId || value.commandId !== buffer.command.commandId || value.clientId !== buffer.command.clientId || value.version !== buffer.command.expectedVersion || value.status !== 'APPLIED'
    || !validDraftArtifactRef(ref) || ref.bytes !== buffer.command.payload.bytes || ref.contentHash !== buffer.command.payload.contentHash || ref.mediaType !== buffer.command.payload.mediaType
    || (data.status !== 'ARTIFACT_READY' && data.status !== 'ARTIFACT_QUARANTINED') || !exactDraftObject(inspection,['policyVersion','complete','method','state','reasonCodes']) || inspection.policyVersion !== 1 || inspection.complete !== false || inspection.method !== 'KNOWN_PATTERNS_RAW_BYTES'
    || inspection.state !== (data.status === 'ARTIFACT_READY' ? 'NO_KNOWN_MARKER' : 'SUSPECTED') || !Array.isArray(inspection.reasonCodes) || new Set(inspection.reasonCodes).size !== inspection.reasonCodes.length || inspection.reasonCodes.some((reason:unknown)=>typeof reason !== 'string' || !['PRIVATE_KEY_MARKER','BEARER_TOKEN_MARKER','SECRET_ASSIGNMENT_MARKER'].includes(reason))
    || (inspection.reasonCodes.length===0)!==(data.status==='ARTIFACT_READY')) throw new ApiError('RESPONSE_INVALID');
  return {scopeKind:'DRAFT',draftId:buffer.draftId,commandId:buffer.command.commandId,clientId:buffer.command.clientId,version:buffer.command.expectedVersion,status:'APPLIED',data:{artifactRef:ref,status:data.status,inspection}};
}
export async function readDraftArtifactBytes(client: ApiClient, draftId: string, ref: DraftArtifactRef, projectId: string | null = null): Promise<Uint8Array<ArrayBuffer>> {
  if (!draftUuid(draftId) || projectId !== null && !draftUuid(projectId) || !validDraftArtifactRef(ref)) throw new ApiError('CLIENT_PATH_INVALID');
  const path = projectId ? `/api/v1/projects/${projectId}/files/${ref.artifactId}` : `/api/v1/project-drafts/${draftId}/files/${ref.artifactId}`;
  let response: Response;
  try { response = await client.transport.call(globalThis, path, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/octet-stream' } }); } catch { throw new ApiError('CONNECTION_LOST'); }
  if (!response.ok) { await responseJson(response); throw new ApiError('RESPONSE_INVALID'); }
  if (!/^application\/octet-stream\b/i.test(response.headers.get('content-type') ?? '')) throw new ApiError('RESPONSE_INVALID');
  const chunks: Uint8Array[] = []; let count = 0; const reader = response.body?.getReader(); if (!reader) throw new ApiError('RESPONSE_INVALID');
  try { while (true) { const next = await reader.read(); if (next.done) break; count += next.value.length; if (count > ref.bytes || count > draftArtifactLimits.fileBytes) throw new ApiError('RESPONSE_INVALID'); chunks.push(next.value); } } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(count); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (count !== ref.bytes || await draftBytesHash(bytes) !== ref.contentHash) throw new ApiError('RESPONSE_INVALID'); return bytes;
}
