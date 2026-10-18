import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe, exact, textArtifact, uuid } from '../knowledge/knowledge-entry.ts';

const MAX_BYTES = 2 * 1024 * 1024;
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
const source = (value: any) => isVersionRef(value) || value && (
 exact(value, ['kind', 'id', 'contentHash']) && typeof value.kind === 'string' && ['ARTIFACT', 'CONVERSATION', 'USER_INSTRUCTION'].includes(value.kind)
 || exact(value, ['kind', 'id', 'version', 'contentHash']) && value.kind === 'DOCUMENT_VERSION' && Number.isSafeInteger(value.version) && Number(value.version) >= 1
) && uuid(value.id) && typeof value.contentHash === 'string' && /^[a-f0-9]{64}$/.test(value.contentHash);
interface TextPart { partId: string; itemId: string; text: string; utf8Bytes: number; contentHash: string }

/** 이미 조회된 원문의 분할 계산만 수행한다. 권한·원본 선택/효력·저장·전달·이해를 검증하지 않는다. */
export function planContextText(input: unknown, limits: { maxPartBytes: number; maxParts: number }) {
 const invalid = (): never => { throw new AuthFailure('CONTEXT_TEXT_INPUT_INVALID', 422); };
 let items: any[];
 try {
  const serialized = canonicalJson(input);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) return invalid();
  items = JSON.parse(serialized);
 } catch { return invalid(); }
 if (!Array.isArray(items) || !items.length || items.length > 200 || !exact(limits, ['maxPartBytes', 'maxParts'])
  || !Number.isSafeInteger(limits.maxPartBytes) || limits.maxPartBytes < 1 || limits.maxPartBytes > MAX_BYTES
  || !Number.isSafeInteger(limits.maxParts) || limits.maxParts < 1 || limits.maxParts > 200) return invalid();
 const seen = new Set<string>();
 const resultItems: { itemId: string; category: string; required: boolean; sourceRef: any; sourceHash: string | null; reason: string; includedState: 'INCLUDED' | 'MISSING' | 'REDACTED' | 'EXCLUDED'; deliveryParts: string[]; issue: string | null }[] = [];
 const parts: TextPart[] = [];
 for (const item of items) {
  if (!exact(item, ['itemId', 'category', 'required', 'sourceRef', 'reason', 'state', 'bodyRef', 'body']) || !identifier(item.itemId) || seen.has(item.itemId)
   || !identifier(item.category) || typeof item.required !== 'boolean' || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 20000
   || item.sourceRef !== null && !source(item.sourceRef) || typeof item.state !== 'string' || !['AVAILABLE', 'MISSING', 'REDACTED', 'EXCLUDED'].includes(item.state)) return invalid();
  seen.add(item.itemId);
  // 외부로 반환하는 이유에도 알려진 비밀 표식이 있으면 본문과 별도로 거절한다.
  try { assertKnowledgeTextSafe(item.reason); } catch { throw new AuthFailure('CONTEXT_TEXT_SENSITIVE_METADATA', 412); }
  const sourceRef = item.sourceRef as { contentHash: string } | null;
  const record = { itemId: item.itemId, category: item.category, required: item.required, sourceRef, sourceHash: sourceRef?.contentHash ?? null, reason: item.reason,
   includedState: (item.state === 'AVAILABLE' ? 'INCLUDED' : item.state) as 'INCLUDED' | 'MISSING' | 'REDACTED' | 'EXCLUDED', deliveryParts: [] as string[], issue: null as string | null };
  resultItems.push(record);
  if (item.state !== 'AVAILABLE') {
   if (item.body !== null || item.bodyRef !== null) return invalid();
   record.issue = 'SOURCE_' + item.state;
   continue;
  }
  if (!item.sourceRef || !textArtifact(item.bodyRef) || typeof item.body !== 'string' || !item.body.isWellFormed()) return invalid();
  if (Buffer.byteLength(item.body, 'utf8') !== item.bodyRef.bytes || contentHash(item.body) !== item.bodyRef.contentHash) throw new AuthFailure('CONTEXT_TEXT_INTEGRITY_INVALID', 422);
  try { assertKnowledgeTextSafe(item.body); } catch { record.includedState = 'REDACTED'; record.issue = 'SENSITIVE_CONTENT_SUSPECTED'; continue; }
  const pieces: string[] = []; let buffer = '', bytes = 0;
  for (const character of item.body) {
   const width = Buffer.byteLength(character, 'utf8');
   if (width > limits.maxPartBytes) { record.issue = 'CHARACTER_EXCEEDS_PART_LIMIT'; break; }
   if (bytes + width > limits.maxPartBytes) { pieces.push(buffer); buffer = ''; bytes = 0; }
   buffer += character; bytes += width;
   if (pieces.length >= limits.maxParts - parts.length) { record.issue = 'PART_LIMIT_EXCEEDED'; break; }
  }
  if (!record.issue && buffer) pieces.push(buffer);
  if (!record.issue && !pieces.length) record.issue = 'SOURCE_EMPTY';
  if (record.issue) { record.includedState = 'MISSING'; continue; }
  pieces.forEach((text, index) => {
   const partId = item.itemId + ':' + (index + 1); record.deliveryParts.push(partId);
   parts.push({ partId, itemId: record.itemId, text, utf8Bytes: Buffer.byteLength(text, 'utf8'), contentHash: contentHash(text) });
  });
 }
 return { items: resultItems, parts, missingRequired: resultItems.filter(item => item.required && item.includedState !== 'INCLUDED').map(item => item.itemId),
  excluded: resultItems.filter(item => item.includedState === 'EXCLUDED').map(item => item.itemId), multipartRequired: parts.length > 1,
  ready: false as const, executionAuthorized: false as const, dispatchPerformed: false as const, sourceAuthorizationVerified: false as const, budgetVerified: false as const };
}
