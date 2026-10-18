import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { MessageRef } from '../knowledge/conversation-input.ts';
import { exact, uuid, assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';
import { AuthFailure } from '../access/repository.ts';

export const contextPreparationOperations = ['buildTaskContext'] as const;
export const contextSlotCodes = ['PURPOSE_REASON', 'RULES_SCOPE', 'LATEST_INSTRUCTIONS', 'DECISIONS_REASON', 'CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'] as const;
export type ContextSlotCode = typeof contextSlotCodes[number];
export type ContextSourceSelection = { kind: 'KNOWLEDGE_VERSION'; versionRef: VersionRef } | { kind: 'DOCUMENT_VERSION'; versionRef: VersionRef } | { kind: 'USER_INSTRUCTION'; conversationId: string; messageRef: MessageRef };
export interface ContextPreparationInput {
 assignmentRef: VersionRef; budgetRef: VersionRef | null;
 slots: { code: ContextSlotCode; sources: ContextSourceSelection[]; reason: string }[];
 limits: { maxPartBytes: number; maxParts: number }; reason: string;
}
const reason = (value: unknown): value is string => typeof value === 'string' && value.isWellFormed() && !!value.trim() && value.length <= 20000;
function sourceValid(value: unknown, code: ContextSlotCode): boolean {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 if (exact(value, ['kind', 'versionRef']) && isVersionRef(value.versionRef)) {
  if (value.kind === 'KNOWLEDGE_VERSION') return code !== 'LATEST_INSTRUCTIONS';
  return value.kind === 'DOCUMENT_VERSION' && ['CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'].includes(code);
 }
 if (!exact(value, ['kind', 'conversationId', 'messageRef']) || value.kind !== 'USER_INSTRUCTION' || code !== 'LATEST_INSTRUCTIONS' || !uuid(value.conversationId)) return false;
 const ref = value.messageRef;
 return exact(ref, ['kind', 'id', 'contentHash']) && ref.kind === 'CONVERSATION' && uuid(ref.id) && typeof ref.contentHash === 'string' && /^[a-f0-9]{64}$/.test(ref.contentHash);
}

/** 입력 문법과 선택 보존만 검사한다. 실제 저장 임무/원문·같은 프로젝트·효력/권한은 resolver에서 재검사한다. */
export function readContextPreparationInput(value: unknown): ContextPreparationInput {
 const invalid = (): never => { throw new AuthFailure('CONTEXT_PREPARATION_INPUT_INVALID', 422); };
 let parsed: unknown;
 try { const serialized = canonicalJson(value); if (Buffer.byteLength(serialized, 'utf8') > 2 * 1024 * 1024) return invalid(); parsed = JSON.parse(serialized); } catch { return invalid(); }
 if (!exact(parsed, ['assignmentRef', 'budgetRef', 'slots', 'limits', 'reason']) || !isVersionRef(parsed.assignmentRef) || parsed.budgetRef !== null && !isVersionRef(parsed.budgetRef)
  || !reason(parsed.reason) || !Array.isArray(parsed.slots) || parsed.slots.length !== contextSlotCodes.length || !exact(parsed.limits, ['maxPartBytes', 'maxParts'])
  || !Number.isSafeInteger(parsed.limits.maxPartBytes) || Number(parsed.limits.maxPartBytes) < 1 || Number(parsed.limits.maxPartBytes) > 2 * 1024 * 1024
  || !Number.isSafeInteger(parsed.limits.maxParts) || Number(parsed.limits.maxParts) < 1 || Number(parsed.limits.maxParts) > 200) return invalid();
 const seen = new Set<string>(); let total = 0;
 for (const slot of parsed.slots) {
  if (!exact(slot, ['code', 'sources', 'reason']) || typeof slot.code !== 'string' || !contextSlotCodes.includes(slot.code as ContextSlotCode) || seen.has(slot.code)
   || !reason(slot.reason) || !Array.isArray(slot.sources) || slot.sources.length > 200 || ['PURPOSE_REASON', 'RULES_SCOPE'].includes(slot.code) && slot.sources.length > 1
   || slot.sources.some(source => !sourceValid(source, slot.code as ContextSlotCode)) || new Set(slot.sources.map(source => canonicalJson(source))).size !== slot.sources.length) return invalid();
  seen.add(slot.code); total += slot.sources.length;
  if (total > 200) return invalid();
  try { assertKnowledgeTextSafe(slot.reason); } catch { throw new AuthFailure('CONTEXT_PREPARATION_SENSITIVE_CONTENT_SUSPECTED', 412); }
 }
 try { assertKnowledgeTextSafe(parsed.reason); } catch { throw new AuthFailure('CONTEXT_PREPARATION_SENSITIVE_CONTENT_SUSPECTED', 412); }
 const input = parsed as unknown as ContextPreparationInput;
 input.slots = contextSlotCodes.map(code => input.slots.find(slot => slot.code === code)!);
 return input;
}
