import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDocumentConfirmation } from '../../../apps/server/modules/documents/document-validation.ts';
import type { FormDefinition } from '../../../apps/server/modules/documents/forms.ts';
const definition = { items: [
  { itemId: 'PURPOSE', title: '목적', required: true, valueType: 'TEXT', fields: [] },
  { itemId: 'REQ', title: '요구', required: true, valueType: 'RECORDS', fields: [{ fieldId: 'R_ID', title: '요구 ID', required: true }, { fieldId: 'DETAIL', title: '상세 요구', required: true }] },
] } as FormDefinition;
const sections = [{ itemId: 'PURPOSE', anchor: 'line:1' }, { itemId: 'REQ', anchor: 'line:3' }];
test('실제 필수 본문과 반복 행의 필수 필드가 있어야 형식상 확정 가능하다', () => {
  const valid = '## 목적\n사용자가 절차를 정의하고 도구를 교체한다.\n## 요구\n| 요구 ID | 상세 요구 |\n| --- | --- |\n| R01 | 같은 원문을 보존한다. |';
  assert.equal(validateDocumentConfirmation(valid, sections, definition).validForConfirmation, true);
  for (const body of [valid.replace('상세 요구 |', '다른 열 |'), valid.replace('같은 원문을 보존한다.', ''), valid.replace('사용자가 절차를 정의하고 도구를 교체한다.', 'TODO'), valid.split('\n').slice(0, -1).join('\n')]) assert.equal(validateDocumentConfirmation(body, sections, definition).validForConfirmation, false);
});
test('목차만 있거나 같은 줄을 여러 필수 항목으로 재사용해도 실제 본문 합격으로 세지 않는다', () => {
  assert.equal(validateDocumentConfirmation('## 목적\n## 요구', [{ itemId: 'PURPOSE', anchor: 'line:1' }, { itemId: 'REQ', anchor: 'line:2' }], definition).validForConfirmation, false);
  assert.equal(validateDocumentConfirmation('실제 본문 한 줄', [{ itemId: 'PURPOSE', anchor: 'line:1' }, { itemId: 'REQ', anchor: 'line:1' }], definition).validForConfirmation, false);
  assert.equal(validateDocumentConfirmation('실제 본문', [], definition).validForConfirmation, false);
});
test('코드 블록 속 가짜 표를 반복 자료로 세지 않고 파이프 이스케이프는 원래 셀로 처리한다', () => {
  const table = '| R_ID | DETAIL |\n| --- | --- |\n| R01 | A\\|B를 보존 |';
  assert.equal(validateDocumentConfirmation('## 목적\n실제 설명\n## 요구\n' + table, sections, definition).validForConfirmation, true);
  assert.equal(validateDocumentConfirmation('## 목적\n실제 설명\n## 요구\n```\n' + table + '\n```', sections, definition).validForConfirmation, false);
});
