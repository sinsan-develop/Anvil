import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const moduleUrl = new URL('../../../apps/server/modules/context/context-text-plan.ts', import.meta.url);
const module = existsSync(moduleUrl) ? await import(moduleUrl.href) : {};
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const ref = { id: '10000000-0000-4000-8000-000000000001', version: 1, contentHash: 'a'.repeat(64) };
function item(itemId = 'purpose', body = '목적😀이유') {
 return { itemId, category: 'PURPOSE_REASON', required: true, sourceRef: { ...ref }, reason: '사용자가 정한 개발 목적', state: 'AVAILABLE', bodyRef: { artifactId: ref.id, bytes: Buffer.byteLength(body), contentHash: digest(body), mediaType: 'text/plain;charset=utf-8' }, body };
}
test('필수 원문이 part 용량을 넘으면 UTF8 문자·내용·순서를 보존하고 전달 완료로 판정하지 않는다', () => {
 assert.equal(typeof module.planContextText, 'function');
 const original = item(); const output = module.planContextText([original], { maxPartBytes: 6, maxParts: 20 });
 assert.equal(output.items[0].includedState, 'INCLUDED');
 assert.equal(output.parts.map((part: any) => part.text).join(''), '목적😀이유');
 assert.deepEqual(output.parts.map((part: any) => part.utf8Bytes), [6, 4, 6]);
 assert.ok(output.parts.every((part: any) => part.contentHash === digest(part.text) && part.text.isWellFormed()));
 assert.deepEqual(output.missingRequired, []); assert.equal(output.multipartRequired, true);
 assert.equal(output.ready, false); assert.equal(output.executionAuthorized, false); assert.equal(output.dispatchPerformed, false);
 assert.equal(output.sourceAuthorizationVerified, false); assert.equal(output.budgetVerified, false);
 original.reason = '사후변경'; assert.equal(output.items[0].reason, '사용자가 정한 개발 목적');
});
test('제외·민감 격리·빠진 필수 자료를 명시하고 그 본문은 전달 부분에 넣지 않는다', () => {
 assert.equal(typeof module.planContextText, 'function');
 const sources = ['MISSING', 'REDACTED', 'EXCLUDED'].map((state, index) => ({ ...item('slot-' + index), state, body: null, bodyRef: null }));
 const result = module.planContextText(sources, { maxPartBytes: 100, maxParts: 20 });
 assert.deepEqual(result.missingRequired, ['slot-0', 'slot-1', 'slot-2']); assert.deepEqual(result.excluded, ['slot-2']);
 assert.deepEqual(result.parts, []); assert.deepEqual(result.items.map((x: any) => x.includedState), ['MISSING', 'REDACTED', 'EXCLUDED']);
 const sensitive = item('sensitive', 'api_key=abcdefghijklmnop');
 const protectedResult = module.planContextText([sensitive], { maxPartBytes: 100, maxParts: 20 });
 assert.deepEqual(protectedResult.missingRequired, ['sensitive']); assert.equal(protectedResult.items[0].includedState, 'REDACTED');
 assert.equal(JSON.stringify(protectedResult).includes('abcdefghijklmnop'), false);
});
test('본문 위조·중복 ID는 거절하고 부분 수 한도와 한 문자 용량 초과에서도 필수 자료 누락을 숨기지 않는다', () => {
 assert.equal(typeof module.planContextText, 'function');
 const tampered = item(); tampered.body += '변조';
 assert.throws(() => module.planContextText([tampered], { maxPartBytes: 100, maxParts: 20 }), /CONTEXT_TEXT_INTEGRITY_INVALID/);
 assert.throws(() => module.planContextText([item(), item()], { maxPartBytes: 100, maxParts: 20 }), /CONTEXT_TEXT_INPUT_INVALID/);
 const limited = module.planContextText([item()], { maxPartBytes: 6, maxParts: 1 });
 assert.deepEqual(limited.missingRequired, ['purpose']); assert.equal(limited.items[0].includedState, 'MISSING'); assert.deepEqual(limited.parts, []);
 const unicode = module.planContextText([item('unicode', '😀')], { maxPartBytes: 3, maxParts: 20 });
 assert.deepEqual(unicode.missingRequired, ['unicode']); assert.deepEqual(unicode.parts, []);
});
test('잘못된 상태·출처 형태와 한도·이유의 비밀을 거절하고 앞 항목이 한도를 쓰면 뒤 필수 항목을 누락 표시한다', () => {
 assert.equal(typeof module.planContextText, 'function');
 for (const invalid of [{ ...item(), state: ['AVAILABLE'] }, { ...item(), sourceRef: { kind: ['ARTIFACT'], id: ref.id, contentHash: ref.contentHash } }])
  assert.throws(() => module.planContextText([invalid], { maxPartBytes: 100, maxParts: 20 }), /CONTEXT_TEXT_INPUT_INVALID/);
 assert.throws(() => module.planContextText([item()], { maxPartBytes: 0, maxParts: 1 }), /CONTEXT_TEXT_INPUT_INVALID/);
 assert.throws(() => module.planContextText([{ ...item(), reason: 'api_key=abcdefghijklmnop' }], { maxPartBytes: 100, maxParts: 20 }), /CONTEXT_TEXT_SENSITIVE_METADATA/);
 const result = module.planContextText([item('first', 'a'), item('later', 'b')], { maxPartBytes: 1, maxParts: 1 });
 assert.equal(result.parts.length, 1); assert.equal(result.parts[0].text, 'a'); assert.deepEqual(result.missingRequired, ['later']);
});
