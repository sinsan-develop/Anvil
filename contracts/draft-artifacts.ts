/** FN01 r3의 원문 전송 계약. 경로·주체·파일명은 명령에 받지 않는다. */
export interface DraftArtifactRef { artifactId: string; bytes: number; contentHash: string; mediaType: string }
export interface DraftUploadCommand { schemaVersion: 1; commandId: string; clientId: string; expectedVersion: number; payload: Omit<DraftArtifactRef, 'artifactId'> }
export interface DraftUploadReceipt { scopeKind: 'DRAFT'; draftId: string; commandId: string; clientId: string; version: number; status: 'APPLIED'; data: { artifactRef: DraftArtifactRef; status: 'ARTIFACT_READY' | 'ARTIFACT_QUARANTINED'; inspection: unknown } }
export interface DraftStoredArtifact { commandId: string; expectedVersion: number; state: 'RESERVED' | 'BYTES_VERIFIED' | 'FINALIZED' | 'UNKNOWN' | 'REJECTED'; ref: DraftArtifactRef; artifactState: 'READY' | 'QUARANTINED' | null; projectId: string | null }
export const draftArtifactLimits = Object.freeze({ fileBytes: 20 * 1024 * 1024, headerBytes: 8000, draftCount: 20, selectedBytes: 100 * 1024 * 1024, ownerBytes: 500 * 1024 * 1024, ownerCount: 200, projectBytes: 10 * 1024 * 1024 * 1024 });
export const draftArtifactMediaTypes = ['text/plain;charset=utf-8', 'text/markdown;charset=utf-8', 'application/octet-stream', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/html;charset=utf-8', 'image/svg+xml', 'image/png', 'image/jpeg'] as const;
export const draftUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function exactDraftObject(v: unknown, keys: string[]): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.getOwnPropertySymbols(v).length) return false;
  const p = Object.getPrototypeOf(v), d = Object.getOwnPropertyDescriptors(v);
  return (p === Object.prototype || p === null) && Object.keys(d).sort().join(',') === [...keys].sort().join(',') && Object.values(d).every(x => x.enumerable && 'value' in x);
}
export function validDraftArtifactRef(v: unknown): v is DraftArtifactRef {
  return exactDraftObject(v, ['artifactId', 'bytes', 'contentHash', 'mediaType']) && draftUuid(v.artifactId) && validDraftArtifactPayload({ bytes: v.bytes, contentHash: v.contentHash, mediaType: v.mediaType });
}
export function validDraftArtifactPayload(v: unknown): v is DraftUploadCommand['payload'] {
  return exactDraftObject(v, ['bytes', 'contentHash', 'mediaType']) && Number.isSafeInteger(v.bytes) && Number(v.bytes) >= 0 && Number(v.bytes) <= draftArtifactLimits.fileBytes && typeof v.contentHash === 'string' && /^[0-9a-f]{64}$/.test(v.contentHash) && draftArtifactMediaTypes.includes(v.mediaType as never);
}
export function validDraftUploadCommand(v: unknown): v is DraftUploadCommand {
  return exactDraftObject(v, ['schemaVersion', 'commandId', 'clientId', 'expectedVersion', 'payload']) && v.schemaVersion === 1 && draftUuid(v.commandId) && draftUuid(v.clientId) && Number.isSafeInteger(v.expectedVersion) && Number(v.expectedVersion) >= 1 && validDraftArtifactPayload(v.payload);
}
export function readDraftArtifactRefs(v: unknown): DraftArtifactRef[] {
  if (!Array.isArray(v) || v.length > draftArtifactLimits.draftCount || !v.every(validDraftArtifactRef) || new Set(v.map(r => r.artifactId)).size !== v.length || v.reduce((n, r) => n + r.bytes, 0) > draftArtifactLimits.selectedBytes) throw Error('DRAFT_ARTIFACT_REFS_INVALID');
  return v.map(r => ({ ...r }));
}
