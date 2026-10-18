import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe, textArtifact, uuid } from '../knowledge/knowledge-entry.ts';
import { readContextPreparationInput, type ContextPreparationInput, type ContextSourceSelection } from './context-input.ts';
import type { ProjectContextSources } from './context-sources.ts';

type Prepared = Awaited<ReturnType<ProjectContextSources['resolve']>>;
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const selectedRef = (selection: ContextSourceSelection | null) => !selection ? null : selection.kind === 'USER_INSTRUCTION' ? selection.messageRef : selection.versionRef;

/** resolver 결과의 불변 metadata만 만든다. 원문·현재 권한·전달/실행 허가를 저장하지 않는다. */
export function buildContextManifest(id: string, projectId: string, prepared: Prepared) {
 const invalid = (): never => { throw new AuthFailure('CONTEXT_MANIFEST_INVALID', 422); };
 try {
  if (!uuid(id) || !uuid(projectId)) return invalid();
  const serialized = canonicalJson(prepared);
  if (Buffer.byteLength(serialized, 'utf8') > 32 * 1024 * 1024) return invalid();
  const p = JSON.parse(serialized) as Prepared, input = readContextPreparationInput(p.preparationInput);
  if (!same(input.assignmentRef, p.assignmentRef) || !same(input.budgetRef, p.budgetRef)
   || !Array.isArray(p.baselineRefs) || p.baselineRefs.length > 200 || p.baselineRefs.some(ref => !isVersionRef(ref))
   || p.constitutionRef !== null && !isVersionRef(p.constitutionRef)
   || p.ready !== false || p.executionAuthorized !== false || p.dispatchPerformed !== false || p.sourceAuthorizationVerified !== false || p.budgetVerified !== false
   || !Array.isArray(p.items) || !Array.isArray(p.bindings) || !Array.isArray(p.parts) || p.parts.length > input.limits.maxParts) return invalid();
  const expected = input.slots.flatMap<{ itemId: string; slot: ContextPreparationInput['slots'][number]; selection: ContextSourceSelection | null }>(slot => slot.sources.length ? slot.sources.map((selection, index) => ({ itemId: slot.code + '_' + (index + 1), slot, selection })) : [{ itemId: slot.code, slot, selection: null }]);
  if (p.items.length !== expected.length || p.bindings.length !== expected.length) return invalid();
  const parts: { partId: string; itemId: string; sourceRef: unknown; bodyRef: unknown; order: number; byteOffset: number; utf8Bytes: number; contentHash: string }[] = [];
  const items: Prepared['items'] = [], sourceBindings: { itemId: string; selection: ContextSourceSelection | null; bodyRef: unknown; sourceState: string }[] = [];
  let totalBytes = 0;
  for (const [index, entry] of expected.entries()) {
   const item = p.items[index]!, binding = p.bindings[index]!, ref = selectedRef(entry.selection), bodyRef: any = binding.bodyRef;
   if (item.itemId !== entry.itemId || binding.itemId !== entry.itemId || item.category !== entry.slot.code || item.required !== true
    || !same(item.sourceRef, ref) || item.sourceHash !== (ref?.contentHash ?? null) || item.reason !== entry.slot.reason
    || !same(binding.selection, entry.selection) || typeof binding.sourceState !== 'string' || binding.sourceState.length > 100
    || !['INCLUDED', 'MISSING', 'REDACTED', 'EXCLUDED'].includes(item.includedState) || !Array.isArray(item.deliveryParts)
    || bodyRef !== null && (!textArtifact(bodyRef) || typeof bodyRef.mediaType !== 'string')) return invalid();
   assertKnowledgeTextSafe(binding.sourceState);
   if (item.issue !== null) { if (typeof item.issue !== 'string' || item.issue.length > 100) return invalid(); assertKnowledgeTextSafe(item.issue); }
   if (!entry.selection && (item.includedState !== 'MISSING' || bodyRef !== null)) return invalid();
   if (item.includedState !== 'INCLUDED') { if (item.deliveryParts.length) return invalid(); }
   else {
    if (!bodyRef || !item.deliveryParts.length || item.issue !== null) return invalid();
    let offset = 0; const text: string[] = [];
    for (const [localIndex, partId] of item.deliveryParts.entries()) {
     const part = p.parts[parts.length];
     if (!part || part.partId !== partId || partId !== item.itemId + ':' + (localIndex + 1) || part.itemId !== item.itemId
      || typeof part.text !== 'string' || !part.text.length || !part.text.isWellFormed() || part.utf8Bytes !== Buffer.byteLength(part.text, 'utf8')
      || part.utf8Bytes > input.limits.maxPartBytes || part.contentHash !== contentHash(part.text)) return invalid();
     assertKnowledgeTextSafe(part.text);
     parts.push({ partId, itemId: item.itemId, sourceRef: ref, bodyRef, order: parts.length + 1, byteOffset: offset, utf8Bytes: part.utf8Bytes, contentHash: part.contentHash });
     offset += part.utf8Bytes; text.push(part.text);
    }
    totalBytes += offset;
    if (offset !== bodyRef.bytes || contentHash(text.join('')) !== bodyRef.contentHash || totalBytes > 2 * 1024 * 1024) return invalid();
   }
   items.push({ itemId: item.itemId, category: item.category, required: true, sourceRef: ref, sourceHash: item.sourceHash, reason: item.reason, includedState: item.includedState, deliveryParts: [...item.deliveryParts], issue: item.issue });
   sourceBindings.push({ itemId: item.itemId, selection: entry.selection, bodyRef: bodyRef === null ? null : { artifactId: bodyRef.artifactId, bytes: bodyRef.bytes, contentHash: bodyRef.contentHash, mediaType: bodyRef.mediaType }, sourceState: binding.sourceState });
  }
  if (parts.length !== p.parts.length) return invalid();
  const slotRefs = (code: string) => input.slots.find(slot => slot.code === code)!.sources.map(selectedRef);
  const positions = slotRefs('CURRENT_POSITION');
  const manifest = { id, projectId, version: 1, preparationInput: input, assignmentRef: input.assignmentRef, baselineRefs: p.baselineRefs,
   purposeRef: slotRefs('PURPOSE_REASON')[0] ?? null, constitutionRef: p.constitutionRef, latestInstructionRefs: slotRefs('LATEST_INSTRUCTIONS'), currentPositionRef: positions.length === 1 ? positions[0]! : null,
   items, sourceBindings, missingRequired: items.filter(item => item.includedState !== 'INCLUDED').map(item => item.itemId), excluded: items.filter(item => item.includedState === 'EXCLUDED').map(item => item.itemId),
   deliveryPlan: { state: 'PREPARATION_ONLY', parts, multipartRequired: parts.length > 1, limits: input.limits }, budgetRef: input.budgetRef,
   unverified: ['CONTEXT_SELECTION_REVIEW_REQUIRED', 'INSTRUCTION_EFFECTIVENESS_UNVERIFIED', 'CURRENT_STATE_MEANING_UNVERIFIED', 'BUDGET_UNVERIFIED', 'DELIVERY_NOT_CONNECTED', 'UNDERSTANDING_NOT_REVIEWED', 'EXECUTION_NOT_CONNECTED', ...(positions.length > 1 ? ['CURRENT_POSITION_AMBIGUOUS'] : [])],
   sourceAuthorizationVerified: false, budgetVerified: false, ready: false, executionAuthorized: false, dispatchPerformed: false };
  const encoded = canonicalJson(manifest); if (Buffer.byteLength(encoded, 'utf8') > 2 * 1024 * 1024) return invalid();
  return { manifest: JSON.parse(encoded) as typeof manifest, ref: { id, version: 1, contentHash: contentHash(encoded) } };
 } catch { return invalid(); }
}
