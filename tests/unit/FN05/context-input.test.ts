import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const url = new URL('../../../apps/server/modules/context/context-input.ts', import.meta.url);
const module = existsSync(url) ? await import(url.href) : {};
const ref = { id: '10000000-0000-4000-8000-000000000001', version: 1, contentHash: 'a'.repeat(64) };
const codes = ['PURPOSE_REASON', 'RULES_SCOPE', 'LATEST_INSTRUCTIONS', 'DECISIONS_REASON', 'CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'];
const knowledge = { kind: 'KNOWLEDGE_VERSION', versionRef: ref };
const instruction = (id: string) => ({ kind: 'USER_INSTRUCTION', conversationId: ref.id, messageRef: { kind: 'CONVERSATION', id, contentHash: ref.contentHash } });
function input(): any { return { assignmentRef: ref, budgetRef: null, slots: codes.map(code => ({ code, sources: [], reason: '필수 원문 선택 전' })), limits: { maxPartBytes: 4096, maxParts: 100 }, reason: '임무 맥락 준비' }; }
function parse(value: unknown) { assert.equal(typeof module.readContextPreparationInput, 'function'); return module.readContextPreparationInput(value); }
test('필수7 빈 선택을 누락하지 않고 복수 지시·원문과 고정 순서를 보존하며 권한을 만들지 않는다', () => {
 const original = input(); original.slots[0].sources = [structuredClone(knowledge)]; original.slots[2].sources = [instruction(ref.id), instruction('20000000-0000-4000-8000-000000000002')]; original.slots.reverse();
 const result = parse(original); assert.deepEqual(result.slots.map((slot: any) => slot.code), codes); assert.equal(result.slots[2].sources.length, 2); assert.equal(result.budgetRef, null); assert.deepEqual(result.slots[1].sources, []);
 assert.equal('ready' in result, false); assert.equal('authorization' in result, false); original.slots.at(-1).sources[0].versionRef.contentHash = 'b'.repeat(64); assert.equal(result.slots[0].sources[0].versionRef.contentHash, 'a'.repeat(64));
});
test('필수 슬롯 삭제·중복·필수여부/READY 위조·다른 종류/가짜 ref·중복 원문을 거절한다', () => {
 const values = [(() => { const value = input(); value.slots.pop(); return value; })(), (() => { const value = input(); value.slots[6] = value.slots[0]; return value; })(), { ...input(), ready: true }];
 for (const [index, source] of [[0, { ...knowledge, versionRef: { ...ref, contentHash: 'fake' } }], [2, knowledge], [1, instruction(ref.id)]] as const) { const value = input(); value.slots[index].sources = [source]; values.push(value); }
 const duplicate = input(); duplicate.slots[3].sources = [knowledge, knowledge]; values.push(duplicate);
 const optional = input(); optional.slots[0].required = false; values.push(optional);
 for (const value of values) assert.throws(() => parse(value), /CONTEXT_PREPARATION_INPUT_INVALID/);
});
test('과도한 부분/전체 선택·민감 이유를 거절하고 슬롯 사이 같은 원문 사용은 임의 삭제하지 않는다', () => {
 const valid = input(); valid.slots[4].sources = [knowledge]; valid.slots[5].sources = [knowledge]; assert.equal(parse(valid).slots[5].sources.length, 1);
 const large = input(); large.slots[2].sources = Array.from({ length: 201 }, (_, n) => instruction('10000000-0000-4000-8000-' + String(n).padStart(12, '0')));
 const total = input(); total.slots[3].sources = Array.from({ length: 100 }, (_, n) => ({ ...knowledge, versionRef: { ...ref, version: n + 1 } })); total.slots[4].sources = Array.from({ length: 101 }, (_, n) => ({ ...knowledge, versionRef: { ...ref, version: n + 1 } }));
 for (const value of [large, total, { ...input(), limits: { maxPartBytes: 0, maxParts: 100 } }, { ...input(), limits: { maxPartBytes: 4096, maxParts: 201 } }]) assert.throws(() => parse(value), /CONTEXT_PREPARATION_INPUT_INVALID/);
 assert.throws(() => parse({ ...input(), reason: 'api_key=abcdefghijklmnop' }), /CONTEXT_PREPARATION_SENSITIVE_CONTENT_SUSPECTED/);
});
