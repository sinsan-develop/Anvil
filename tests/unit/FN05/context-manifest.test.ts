import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { readContextPreparationInput, contextSlotCodes } from '../../../apps/server/modules/context/context-input.ts';
import { planContextText } from '../../../apps/server/modules/context/context-text-plan.ts';
const file = new URL('../../../apps/server/modules/context/context-manifest.ts', import.meta.url);
const module = existsSync(file) ? await import(file.href) : {};
const id = '10000000-0000-4000-8000-000000000001', projectId = '20000000-0000-4000-8000-000000000002';
const ref = { id, version: 1, contentHash: 'a'.repeat(64) };
function fixture() {
 const body = '사용자 소유😀원문', bodyRef = { artifactId: id, bytes: Buffer.byteLength(body), contentHash: contentHash(body), mediaType: 'text/plain;charset=utf-8' };
 const input = readContextPreparationInput({ assignmentRef: ref, budgetRef: null, slots: contextSlotCodes.map(code => ({ code, sources: code === 'PURPOSE_REASON' ? [{ kind: 'KNOWLEDGE_VERSION', versionRef: ref }] : [], reason: '정확 원문 선택 또는 미선택' })), limits: { maxPartBytes: 7, maxParts: 200 }, reason: '준비 후보 저장' });
 const originals = input.slots.map(slot => ({ itemId: slot.sources.length ? slot.code + '_1' : slot.code, category: slot.code, required: true, sourceRef: slot.sources.length ? ref : null, reason: slot.reason, state: slot.sources.length ? 'AVAILABLE' : 'MISSING', bodyRef: slot.sources.length ? bodyRef : null, body: slot.sources.length ? body : null }));
 const planned = planContextText(originals, input.limits);
 const prepared: any = { preparationInput: input, assignmentRef: ref, baselineRefs: [ref], constitutionRef: null, budgetRef: null, bindings: originals.map((item, index) => ({ itemId: item.itemId, selection: input.slots[index]!.sources[0] ?? null, bodyRef: item.bodyRef, sourceState: item.bodyRef ? 'CONFIRMED' : 'NOT_SELECTED' })), ...planned, unverified: [] };
 return { body, bodyRef, input, originals, prepared };
}
test('불변 manifest는 원문을 중복 저장하지 않고 정확 부분 순서·바이트 범위·hash를 결박한다', () => {
 assert.equal(typeof module.buildContextManifest, 'function'); const f = fixture(), { manifest, ref: saved } = module.buildContextManifest(id, projectId, f.prepared);
 assert.equal(saved.contentHash, contentHash(canonicalJson(manifest))); assert.equal(saved.id, id); assert.equal(saved.version, 1);
 assert.equal(manifest.projectId, projectId); assert.deepEqual(manifest.assignmentRef, ref); assert.deepEqual(manifest.purposeRef, ref);
 const source = Buffer.from(f.body); let offset = 0;
 for (const [index, part] of manifest.deliveryPlan.parts.entries()) { assert.equal(part.order, index + 1); assert.equal(part.byteOffset, offset); assert.equal(part.contentHash, contentHash(source.subarray(offset, offset + part.utf8Bytes))); offset += part.utf8Bytes; assert.equal('text' in part, false); }
 assert.equal(offset, f.bodyRef.bytes); assert.equal(JSON.stringify(manifest).includes(f.body), false); assert.equal(manifest.missingRequired.length, 6);
 assert.equal(manifest.ready, false); assert.equal(manifest.dispatchPerformed, false); assert.equal(manifest.executionAuthorized, false); assert.ok(manifest.unverified.includes('BUDGET_UNVERIFIED'));
 f.input.slots[0]!.reason = '사후 변경'; assert.equal(manifest.preparationInput.slots[0]!.reason, '정확 원문 선택 또는 미선택');
});
test('원문·부분·선택 혼입과 실행 합격 위조를 저장 metadata로 승격하지 않는다', () => {
 for (const mutate of [
  (p: any) => { p.parts[0].text = '변조'; }, (p: any) => { p.parts[0].contentHash = 'f'.repeat(64); },
  (p: any) => { p.items[0].deliveryParts.reverse(); }, (p: any) => { p.bindings[0].bodyRef.contentHash = 'f'.repeat(64); },
  (p: any) => { p.bindings[0].selection.versionRef.contentHash = 'f'.repeat(64); }, (p: any) => { p.parts.push({ ...p.parts[0], partId: 'orphan:1' }); },
  (p: any) => { p.ready = true; }, (p: any) => { p.items[1].includedState = 'INCLUDED'; }
 ]) { const f = fixture(); mutate(f.prepared); assert.throws(() => module.buildContextManifest(id, projectId, f.prepared), /CONTEXT_MANIFEST_INVALID/); }
});
test('복수 현재 위치를 첫 원문으로 축약하지 않고 모든 선택과 미확인·누락을 보존한다', () => {
 const f = fixture(); f.input.slots[4]!.sources = [{ kind: 'DOCUMENT_VERSION', versionRef: ref }, { kind: 'DOCUMENT_VERSION', versionRef: { ...ref, version: 2 } }];
 const extra = f.input.slots[4]!.sources.map((selection, index) => ({ itemId: 'CURRENT_POSITION_' + (index + 1), category: 'CURRENT_POSITION', required: true, sourceRef: selection.kind === 'USER_INSTRUCTION' ? selection.messageRef : selection.versionRef, reason: f.input.slots[4]!.reason, state: 'MISSING', bodyRef: null, body: null }));
 const originals = [...f.originals.slice(0, 4), ...extra, ...f.originals.slice(5)];
 Object.assign(f.prepared, planContextText(originals, f.input.limits));
 f.prepared.bindings.splice(4, 1, ...extra.map((item, index) => ({ itemId: item.itemId, selection: f.input.slots[4]!.sources[index], bodyRef: null, sourceState: 'CURRENT_CONFIRMATION_REVIEW_REQUIRED' })));
 const { manifest } = module.buildContextManifest(id, projectId, f.prepared);
 assert.equal(manifest.currentPositionRef, null); assert.equal(manifest.sourceBindings.filter((binding: any) => binding.itemId.startsWith('CURRENT_POSITION_')).length, 2);
 assert.ok(manifest.unverified.includes('CURRENT_POSITION_AMBIGUOUS')); assert.ok(manifest.missingRequired.includes('CURRENT_POSITION_1')); assert.ok(manifest.missingRequired.includes('CURRENT_POSITION_2'));
});
