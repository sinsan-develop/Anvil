import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { FormDefinition } from './forms.ts';

interface Issue { code: string; location: string; severity: 'ERROR'; message: string }
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function shape(input: unknown): input is FormDefinition {
  if (!object(input, ['formCode', 'name', 'purpose', 'scope', 'authorRole', 'reviewerRole', 'confirmerRole', 'requiredInputs', 'items', 'authoringStandardRef'])
    || ['formCode', 'name', 'purpose', 'authorRole', 'reviewerRole', 'confirmerRole'].some(key => typeof input[key] !== 'string') || input.scope !== 'USER_COMMON'
    || !texts(input.requiredInputs) || !isVersionRef(input.authoringStandardRef) || !Array.isArray(input.items)) return false;
  return input.items.every(item => object(item, ['itemId', 'title', 'required', 'valueType', 'repeated', 'fields', 'authoringRules', 'reviewCriteria'])
    && typeof item.itemId === 'string' && typeof item.title === 'string' && typeof item.required === 'boolean' && ['TEXT', 'RECORDS'].includes(String(item.valueType))
    && typeof item.repeated === 'boolean' && texts(item.authoringRules) && texts(item.reviewCriteria) && Array.isArray(item.fields)
    && item.fields.every(field => object(field, ['fieldId', 'title', 'required', 'valueType']) && typeof field.fieldId === 'string' && typeof field.title === 'string' && typeof field.required === 'boolean' && field.valueType === 'TEXT'));
}
export function validateCustomForm(input: unknown): { issues: Issue[]; validForConfirmation: boolean } {
  const issues: Issue[] = [];
  const issue = (code: string, location: string, message: string) => issues.push({ code, location, severity: 'ERROR', message });
  try { if (Buffer.byteLength(canonicalJson(input), 'utf8') > 2 * 1024 * 1024) throw Error(); }
  catch { issue('INPUT_INVALID', 'definition', '지원하지 않는 값·크기·실행 객체입니다.'); return { issues, validForConfirmation: false }; }
  if (!shape(input)) { issue('INPUT_INVALID', 'definition', '허용하지 않은 속성·자료형·참조·범위입니다.'); return { issues, validForConfirmation: false }; }
  for (const key of ['formCode', 'name', 'purpose', 'authorRole', 'reviewerRole', 'confirmerRole'] as const) if (!input[key].trim()) issue('REQUIRED_TEXT_MISSING', key, '확정에 필요한 내용이 비었습니다.');
  if (!input.items.length) issue('FORM_ITEMS_MISSING', 'items', '작성 항목이 없습니다.');
  const ids = new Set<string>();
  for (const item of input.items) {
    if (!item.itemId.trim() || ids.has(item.itemId)) issue('DUPLICATE_ITEM_ID', 'items.' + item.itemId, '항목 ID는 고유하고 비어 있지 않아야 합니다.');
    ids.add(item.itemId);
    if (!item.title.trim() || !item.authoringRules.some(value => value.trim()) || !item.reviewCriteria.some(value => value.trim())) issue('ITEM_CRITERIA_MISSING', 'items.' + item.itemId, '제목·작성 규칙·검토 기준을 작성하세요.');
    if (item.valueType === 'TEXT' && (item.repeated || item.fields.length) || item.valueType === 'RECORDS' && (!item.repeated || !item.fields.length)) issue('REPEAT_FIELDS_INVALID', 'items.' + item.itemId, '반복 행과 필드 구성이 맞지 않습니다.');
    const fields = new Set<string>();
    for (const field of item.fields) {
      if (!field.fieldId.trim() || fields.has(field.fieldId) || !field.title.trim()) issue('DUPLICATE_FIELD_ID', 'items.' + item.itemId, '필드 ID·제목이 없거나 중복입니다.');
      fields.add(field.fieldId);
    }
  }
  return { issues, validForConfirmation: !issues.length };
}
