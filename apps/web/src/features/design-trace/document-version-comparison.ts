export type DocumentBodyComparison =
  | { kind: 'IDENTICAL' }
  | { kind: 'CHANGED'; commonBeforeLines: number; commonAfterLines: number; before: string; after: string }
  | { kind: 'UNVERIFIED'; reason: 'DISPLAY_LIMIT' };

// 공통 양끝을 제외한 구간 비교다. 중간의 최소 편집 경로를 추정하지 않는다.
export function compareDocumentBodies(before: string, after: string): DocumentBodyComparison {
  if (before.length > 131072 || after.length > 131072) return { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' };
  const left = before.split(/(?<=\n)/), right = after.split(/(?<=\n)/);
  const lines = (value: string) => value.split('\n').length;
  if (lines(before) > 4000 || lines(after) > 4000) return { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' };
  if (before === after) return { kind: 'IDENTICAL' };
  if (!before) left.length = 0;
  if (!after) right.length = 0;
  let prefix = 0, suffix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++;
  while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
  return {
    kind: 'CHANGED', commonBeforeLines: prefix, commonAfterLines: suffix,
    before: left.slice(prefix, left.length - suffix).join(''),
    after: right.slice(prefix, right.length - suffix).join(''),
  };
}
