import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';

test('공식8종은 승인 원문/공통 기준을 보존하고 종류·목차·반복항목·고정 버전 hash를 갖는다', async () => {
  const source = await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url));
  const standard = await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url));
  const catalog = buildOfficialForms(source, standard);
  assert.equal(catalog.forms.length, 8);
  assert.deepEqual(catalog.forms.map(form => form.definition.formCode), ['AF01', 'AF02', 'AF03', 'AF04', 'AF05', 'AF06', 'AF07', 'AF08']);
  assert.equal(catalog.forms[6]!.definition.name, '작업진행상황');
  assert.equal(catalog.forms[7]!.definition.name, '개발환경 정의서');
  for (const form of catalog.forms) {
    assert.equal(form.ref.version, 1); assert.equal(form.definition.scope, 'SYSTEM');
    assert.equal(form.definition.items.length, 6);
    assert.equal(new Set(form.definition.items.map(item => item.itemId)).size, 6);
    assert.equal(form.ref.contentHash, contentHash(canonicalJson(form.definition)));
    assert.deepEqual(form.definition.authoringStandardRef, catalog.standard.ref);
    assert(form.definition.items.every(item => item.required && item.authoringRules.length > 0 && item.reviewCriteria.length > 0));
  }
  const requirements = catalog.forms[0]!.definition.items[2]!;
  assert.equal(requirements.repeated, true); assert(requirements.fields.some(field => field.title === 'R ID'));
  assert.equal(catalog.standard.body.equals(standard), true);
  assert.equal(catalog.standard.ref.contentHash, contentHash(standard));
  assert.throws(() => buildOfficialForms(Buffer.concat([source, Buffer.from('\n변경')]), standard), /CATALOG_SOURCE_NOT_APPROVED/);
  assert.throws(() => buildOfficialForms(source, Buffer.concat([standard, Buffer.from('\n변경')])), /AUTHORING_STANDARD_SOURCE_CHANGED/);
});
