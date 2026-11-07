import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildOfficialForms } from '../../../apps/server/modules/documents/forms.ts';
import { validateCustomForm } from '../../../apps/server/modules/documents/form-validation.ts';

const catalog = buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md', import.meta.url)), await readFile(new URL('../../../docs/design/문서작성_공통기준.md', import.meta.url)));
const definition = { ...structuredClone(catalog.forms[0]!.definition), scope: 'USER_COMMON', name: '내 요구 정의 양식' };
test('사용자 양식은 코드/실행 필드를 받지 않고 안정 항목·반복 필드·작성/검토 기준을 검사한다', () => {
  assert.equal(validateCustomForm(definition).validForConfirmation, true);
  for (const value of [{ ...definition, scope: 'SYSTEM' }, { ...definition, script: 'execute' }, { ...definition, authoringStandardRef: { ...definition.authoringStandardRef, access: true } }]) {
    assert.equal(validateCustomForm(value).issues.some(issue => issue.code === 'INPUT_INVALID'), true);
  }
  const duplicate = structuredClone(definition); duplicate.items[1]!.itemId = duplicate.items[0]!.itemId;
  assert.equal(validateCustomForm(duplicate).issues.some(issue => issue.code === 'DUPLICATE_ITEM_ID'), true);
  const missing = { ...definition, purpose: '', items: [] };
  assert.equal(validateCustomForm(missing).validForConfirmation, false);
  assert.equal(validateCustomForm(missing).issues.some(issue => issue.code === 'INPUT_INVALID'), false);
});
