import { ApiClient, ApiError } from '../../api/client.ts';
import { readDocument } from './api.ts';
import { documentControl, documentDraftHash, editDocument, postDocumentCommand, prepareDocumentSave, type DocumentBuffer, type DocumentContent, type DocumentSession, type DocumentWrite, type PendingDocumentSave } from './editor-api.ts';
type Ref = { id: string; version: number; contentHash: string };
type Artifact = DocumentContent['body'];
export interface Proposal { id: string; baseRef: Ref; proposedContentRef: Artifact; diffRef: Artifact; status: 'PENDING' }
interface ProposalDetail extends Proposal { proposedContent: DocumentContent; reason: string; createdAt: string; proposedBy: string; selections: { documentId: string; version: number; selectedBy: string; at: string }[] }
export interface ProposalComparison { proposal: ProposalDetail; base: Awaited<ReturnType<typeof readDocument>>; proposedBody: string; diff: { startLine: number; before: string[]; after: string[]; unchangedBefore: number; unchangedAfter: number } }
export interface DocumentProposalBuffer { ownerUserId: string; bindingId: string; baseRef: Ref; snapshot: PendingDocumentSave | null; restored?: { kind: 'STORED_PROPOSAL'; projectId: string; clientId: string; controlGeneration: number; proposalId: string; reason: string }; command: DocumentWrite | null; proposal: Proposal | null; comparison: ProposalComparison | null; applyCommand: DocumentWrite | null; savedRef: Ref | null; uncertain: boolean; failure: { code: string; status: number; quarantinedArtifactId?:string } | null }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, hash = /^[0-9a-f]{64}$/;
const sameRef = (a: Ref, b: Ref) => a?.id === b?.id && a?.version === b?.version && a?.contentHash === b?.contentHash;
const validRef = (r: Ref) => r && uuid.test(r.id) && Number.isSafeInteger(r.version) && r.version > 0 && hash.test(r.contentHash);
const validArtifact = (r: Artifact) => r && uuid.test(r.artifactId) && Number.isSafeInteger(r.bytes) && r.bytes >= 0 && r.bytes <= 20 * 1024 * 1024 && hash.test(r.contentHash) && typeof r.mediaType === 'string';
const sameArtifact = (a: Artifact, b: Artifact) => a?.artifactId === b?.artifactId && a?.bytes === b?.bytes && a?.contentHash === b?.contentHash && a?.mediaType === b?.mediaType;
const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => [k,normalize(x)])) : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
async function digest(bytes: Uint8Array<ArrayBuffer>) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join(''); }
function subject(state: DocumentProposalBuffer, session: DocumentSession) {
  if (state.ownerUserId !== session.user.id || !uuid.test(state.bindingId) || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !validRef(state.baseRef)) throw new ApiError('PROPOSAL_INPUT_INVALID');
  if (!state.snapshot) {
    const r = state.restored;
    if (!r || r.kind !== 'STORED_PROPOSAL' || !uuid.test(r.projectId) || r.clientId !== session.clientId || r.proposalId !== state.proposal?.id || !uuid.test(r.proposalId) || !Number.isSafeInteger(r.controlGeneration) || r.controlGeneration < 1 || typeof r.reason !== 'string' || !r.reason.trim() || r.reason.length > 20_000) throw new ApiError('PROPOSAL_INPUT_INVALID');
    return;
  }
  const u = state.snapshot.upload;
  if (state.ownerUserId !== session.user.id || u.clientId !== session.clientId || !uuid.test(u.projectId) || !uuid.test(u.commandId) || !uuid.test(state.snapshot.saveCommandId) || !uuid.test(session.clientId) || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken) || !validRef(state.baseRef) || state.baseRef.id !== state.snapshot.documentId || state.baseRef.version !== state.snapshot.baseVersion || !Number.isSafeInteger(u.controlGeneration) || u.controlGeneration < 1 || u.schemaVersion !== 1 || u.operation !== 'uploadArtifact' || u.targetId !== null || u.expectedVersion !== 0 || u.baselineRefs.length || u.approvalRef !== null) throw new ApiError('PROPOSAL_INPUT_INVALID');
}
function context(state: DocumentProposalBuffer) { return state.snapshot ? { ...state.snapshot.upload, reason: state.snapshot.reason } : { ...state.restored!, reason: state.restored!.reason }; }
function validProposal(p: Proposal, base: Ref, body: Artifact) { return p && uuid.test(p.id) && validRef(p.baseRef) && sameRef(p.baseRef, base) && sameArtifact(p.proposedContentRef, body) && validArtifact(p.diffRef) && p.diffRef.mediaType === 'application/json;charset=utf-8' && p.status === 'PENDING'; }
export async function prepareDocumentProposal(buffer: DocumentBuffer, session: DocumentSession): Promise<DocumentProposalBuffer> {
  if (!buffer.documentId || !buffer.baseHash || !hash.test(buffer.baseHash) || buffer.title !== buffer.baseTitle || buffer.proposalState) throw new ApiError('PROPOSAL_BASE_REQUIRED');
  const snapshot = await prepareDocumentSave(buffer, session);
  return { ownerUserId: buffer.ownerUserId, bindingId: snapshot.upload.commandId, baseRef: { id: buffer.documentId, version: buffer.baseVersion, contentHash: buffer.baseHash }, snapshot, command: null, proposal: null, comparison: null, applyCommand: null, savedRef: null, uncertain: false, failure: null };
}
export async function continueDocumentProposal(client: ApiClient, state: DocumentProposalBuffer, session: DocumentSession, checkpoint: (s: DocumentProposalBuffer) => void, active: () => boolean): Promise<DocumentProposalBuffer> {
  subject(state, session); const s = state.snapshot;
  if (!s) throw new ApiError('PROPOSAL_ALREADY_STORED');
  const u = s.upload, bytes = new TextEncoder().encode(s.body);
  if (bytes.length > 2 * 1024 * 1024 || bytes.length !== u.payload.bytes || await digest(bytes) !== u.payload.contentHash || !['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(String(u.payload.mediaType))) throw new ApiError('PROPOSAL_INPUT_INVALID');
  let next = state;
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  if (!next.command) {
    const r = await postDocumentCommand(client, u, session.csrfToken, bytes), artifact = r.data?.artifactRef as Artifact;
    if (!validArtifact(artifact) || artifact.bytes !== bytes.length || artifact.contentHash !== u.payload.contentHash || artifact.mediaType !== u.payload.mediaType || r.targetId !== artifact.artifactId || r.version !== null || r.data.status !== 'ARTIFACT_READY') throw new ApiError('RESPONSE_INVALID');
    next = { ...next, uncertain: false, command: { ...u, commandId: s.saveCommandId, operation: 'proposeDocumentChange', targetId: state.baseRef.id, expectedVersion: state.baseRef.version, payload: { baseRef: state.baseRef, proposedContent: { body: artifact, ...s.content }, reason: s.reason, sourceRefs: [] } } }; checkpoint(next);
  }
  const c = next.command!, body = (c.payload.proposedContent as DocumentContent)?.body;
  if (c.operation !== 'proposeDocumentChange' || c.commandId !== s.saveCommandId || c.projectId !== u.projectId || c.clientId !== u.clientId || c.controlGeneration !== u.controlGeneration || c.schemaVersion !== 1 || c.targetId !== state.baseRef.id || c.expectedVersion !== state.baseRef.version || c.baselineRefs.length || c.approvalRef !== null || !sameRef(c.payload.baseRef as Ref, state.baseRef) || c.payload.reason !== s.reason || !equal(c.payload.sourceRefs, []) || !validArtifact(body) || body.bytes !== bytes.length || body.contentHash !== u.payload.contentHash || body.mediaType !== u.payload.mediaType || !equal(c.payload.proposedContent, { body, ...s.content })) throw new ApiError('PROPOSAL_INPUT_INVALID');
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  const result = await postDocumentCommand(client, c, session.csrfToken), proposal = result.data?.proposal as Proposal;
  if (!validProposal(proposal, state.baseRef, body) || result.data.status !== 'PROPOSAL_RECORDED' || !sameRef(result.data.ref, state.baseRef) || result.targetId !== state.baseRef.id || result.version !== state.baseRef.version) throw new ApiError('RESPONSE_INVALID');
  return { ...next, proposal, uncertain: false, failure: null };
}
async function readBytes(client: ApiClient, pid: string, ref: Artifact, maximum: number) {
  if (!uuid.test(pid) || !validArtifact(ref) || ref.bytes > maximum) throw new ApiError('RESPONSE_INVALID');
  let r: Response; try { r = await client.transport.call(globalThis, `/api/v1/projects/${pid}/files/${ref.artifactId}`, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/octet-stream' } }); } catch { throw new ApiError('CONNECTION_LOST'); }
  if (!r.ok) throw new ApiError('ARTIFACT_READ_FAILED', r.status);
  if (!/^application\/octet-stream\b/i.test(r.headers.get('content-type') ?? '') || !r.body) throw new ApiError('RESPONSE_INVALID');
  const reader = r.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const v = await reader.read(); if (v.done) break; size += v.value.byteLength; if (size > ref.bytes) { await reader.cancel(); throw new ApiError('ARTIFACT_INTEGRITY_FAILED'); } chunks.push(v.value); } } catch (e) { throw e instanceof ApiError ? e : new ApiError('CONNECTION_LOST'); } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let n = 0; for (const chunk of chunks) { bytes.set(chunk,n); n += chunk.length; }
  if (size !== ref.bytes || await digest(bytes) !== ref.contentHash) throw new ApiError('ARTIFACT_INTEGRITY_FAILED');
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new ApiError('DOCUMENT_UTF8_INVALID'); }
}
export async function readPreservedDocumentText(client: ApiClient, projectId: string, ref: Artifact): Promise<string> {
  if (!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(ref.mediaType)) throw new ApiError('DOCUMENT_TEXT_FORMAT_NOT_SUPPORTED');
  return readBytes(client, projectId, ref, 2 * 1024 * 1024);
}
export async function compareDocumentProposal(client: ApiClient, state: DocumentProposalBuffer, session: DocumentSession): Promise<ProposalComparison> {
  subject(state, session); const p = state.proposal, pid = context(state).projectId;
  if (!p || !uuid.test(p.id)) throw new ApiError('PROPOSAL_RESULT_REQUIRED');
  return compareResolvedProposal(client, pid, await client.get<ProposalDetail>(`/api/v1/projects/${pid}/proposals/${p.id}`), state);
}
async function compareResolvedProposal(client: ApiClient, pid: string, value: ProposalDetail, expected?: DocumentProposalBuffer): Promise<ProposalComparison> {
  const p = expected?.proposal ?? value, content = value?.proposedContent;
  if (!value || !validRef(value.baseRef) || !content || !validProposal(value, value.baseRef, content.body) || expected && (value.id !== p.id || !sameRef(value.baseRef,expected.baseRef) || !sameArtifact(value.diffRef,p.diffRef) || expected.command && !equal(content,expected.command.payload.proposedContent)) || typeof value.reason !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !uuid.test(value.proposedBy) || !Array.isArray(value.selections) || value.selections.length > 1 || value.selections.some(s => !uuid.test(s.documentId) || !Number.isSafeInteger(s.version) || s.version < 1 || !uuid.test(s.selectedBy) || !Number.isFinite(Date.parse(s.at)))) throw new ApiError('RESPONSE_INVALID');
  const [base, proposedBody, rawDiff] = await Promise.all([readDocument(client, pid, p.baseRef.id, p.baseRef.version), readBytes(client, pid, content.body, 2 * 1024 * 1024), readBytes(client, pid, value.diffRef, 20 * 1024 * 1024)]);
  let diff: any; try { diff = JSON.parse(rawDiff); } catch { throw new ApiError('PROPOSAL_DIFF_INVALID'); }
  if (base.document.contentHash !== p.baseRef.contentHash || await documentDraftHash(base.document.title, base.document.formRef, base.document.content as DocumentContent) !== p.baseRef.contentHash || diff?.format !== 'ANVIL_TEXT_DIFF_1' || !sameRef(diff.baseRef, p.baseRef) || !sameArtifact(diff.baseBodyRef, base.document.content.body) || !sameArtifact(diff.proposedBodyRef, content.body) || !equal(diff.beforeContent, base.document.content) || !equal(diff.afterContent, content) || !Array.isArray(diff.before) || !Array.isArray(diff.after) || diff.before.some((s: unknown) => typeof s !== 'string') || diff.after.some((s: unknown) => typeof s !== 'string') || !Number.isSafeInteger(diff.unchangedBefore) || diff.unchangedBefore < 0 || !Number.isSafeInteger(diff.unchangedAfter) || diff.unchangedAfter < 0 || diff.startLine !== diff.unchangedBefore + 1) throw new ApiError('PROPOSAL_DIFF_INVALID');
  const lines = base.body ? base.body.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g)! : [];
  if (diff.unchangedBefore + diff.unchangedAfter > lines.length || lines.slice(diff.unchangedBefore, lines.length - diff.unchangedAfter).join('') !== diff.before.join('') || [...lines.slice(0,diff.unchangedBefore), ...diff.after, ...lines.slice(lines.length - diff.unchangedAfter)].join('') !== proposedBody) throw new ApiError('PROPOSAL_DIFF_INVALID');
  return { proposal: value, base, proposedBody, diff };
}
export async function prepareProposalApplication(client: ApiClient, state: DocumentProposalBuffer, session: DocumentSession, acknowledged: boolean): Promise<DocumentWrite> {
  subject(state, session); const c = state.comparison, scope = context(state);
  if (!acknowledged || !c || c.proposal.id !== state.proposal?.id || c.proposal.selections.length || state.savedRef || state.applyCommand) throw new ApiError('PROPOSAL_SELECTION_REQUIRED');
  const generation = await documentControl(client, scope.projectId, session);
  return { schemaVersion: 1, projectId: scope.projectId, commandId: crypto.randomUUID(), clientId: session.clientId, controlGeneration: generation, operation: 'saveDocumentDraft', targetId: state.baseRef.id, expectedVersion: state.baseRef.version, baselineRefs: [], approvalRef: null, payload: { title: c.base.document.title, formRef: c.base.document.formRef, stageNodeRef: null, content: c.proposal.proposedContent, importCandidateRef: null, proposalRef: c.proposal.id, reason: scope.reason } };
}
export async function applyDocumentProposal(client: ApiClient, state: DocumentProposalBuffer, session: DocumentSession, active: () => boolean): Promise<Ref> {
  subject(state, session); const c = state.applyCommand, comparison = state.comparison, scope = context(state);
  if (!c || !comparison || c.clientId !== session.clientId || c.operation !== 'saveDocumentDraft' || !uuid.test(c.commandId) || c.projectId !== scope.projectId || c.targetId !== state.baseRef.id || c.expectedVersion !== state.baseRef.version || c.payload.proposalRef !== state.proposal?.id || c.payload.title !== comparison.base.document.title || !sameRef(c.payload.formRef as Ref, comparison.base.document.formRef) || c.payload.stageNodeRef !== null || c.payload.importCandidateRef !== null || !equal(c.payload.content, comparison.proposal.proposedContent) || c.payload.reason !== scope.reason) throw new ApiError('PROPOSAL_SELECTION_REQUIRED');
  if (!active()) throw new ApiError('SAVE_CONTINUATION_PAUSED');
  const result = await postDocumentCommand(client, c, session.csrfToken), ref = result.data?.ref;
  if (!validRef(ref) || ref.id !== state.baseRef.id || ref.version !== state.baseRef.version + 1 || ref.contentHash !== await documentDraftHash(comparison.base.document.title, comparison.base.document.formRef, comparison.proposal.proposedContent) || result.data.status !== 'DRAFT' || result.data.proposalRef !== state.proposal!.id || result.targetId !== ref.id || result.version !== ref.version) throw new ApiError('RESPONSE_INVALID');
  return ref;
}
export async function resumeStoredProposal(client: ApiClient, projectId: string, proposalId: string, session: DocumentSession): Promise<DocumentBuffer> {
  if (!uuid.test(projectId) || !uuid.test(proposalId)) throw new ApiError('CLIENT_PATH_INVALID');
  const [comparison, generation] = await Promise.all([readStoredProposal(client,projectId,proposalId), documentControl(client, projectId, session)]), value = comparison.proposal;
  // 저장 완료 자료를 여는 읽기 binding이다. 과거 업로드/제안 명령을 새로 만들거나 위장하지 않는다.
  const state: DocumentProposalBuffer = { ownerUserId: session.user.id, bindingId: crypto.randomUUID(), baseRef: value.baseRef, snapshot: null, restored: { kind: 'STORED_PROPOSAL', projectId, clientId: session.clientId, controlGeneration: generation, proposalId, reason: value.reason }, command: null, proposal: value, comparison: null, applyCommand: null, savedRef: null, uncertain: false, failure: null };
  subject(state, session); state.comparison = comparison;
  return { ...editDocument(projectId, state.comparison.base, session.user.id, generation), reason: value.reason, proposalState: state };
}
export async function readStoredProposal(client: ApiClient, projectId: string, proposalId: string): Promise<ProposalComparison> {
  if (!uuid.test(projectId) || !uuid.test(proposalId)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<ProposalDetail>(`/api/v1/projects/${projectId}/proposals/${proposalId}`);
  if (!value || value.id !== proposalId) throw new ApiError('RESPONSE_INVALID');
  return compareResolvedProposal(client, projectId, value);
}
