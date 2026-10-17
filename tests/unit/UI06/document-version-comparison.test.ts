import { test } from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL('../../../apps/web/src/features/design-trace/document-version-comparison.ts', import.meta.url);
const implementation = await import(moduleUrl.href).catch((cause: NodeJS.ErrnoException) => {
  if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  return {};
});
function compare(before: string, after: string) {
  assert.equal(typeof implementation.compareDocumentBodies, 'function', '저장 버전 비교 기능이 필요합니다');
  return implementation.compareDocumentBodies(before, after);
}

// 앞/뒤 공통줄을 잘못 잘라 다른 원문을 표시하거나 줄바꿈을 정규화하면 실패한다.
test('공통 앞뒤 줄 밖의 두 원문 구간을 BOM·CRLF·태그 그대로 반환한다', () => {
  assert.deepEqual(compare('\uFEFF제목\r\n이전\r\n끝\n', '\uFEFF제목\r\n<script>변경</script>\r\n끝\n'), {
    kind: 'CHANGED', commonBeforeLines: 1, commonAfterLines: 1,
    before: '이전\r\n', after: '<script>변경</script>\r\n',
  });
});

test('동일·빈 원문과 추가·제거를 구분하고 EOL 차이를 같다고 숨기지 않는다', () => {
  assert.deepEqual(compare('', ''), { kind: 'IDENTICAL' });
  assert.deepEqual(compare('원문\r\n', '원문\r\n'), { kind: 'IDENTICAL' });
  assert.deepEqual(compare('', '새 줄\n'), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 0, before: '', after: '새 줄\n' });
  assert.deepEqual(compare('제거\n', ''), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 0, before: '제거\n', after: '' });
  assert.deepEqual(compare('같은줄\r\n', '같은줄\n'), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 0, before: '같은줄\r\n', after: '같은줄\n' });
});

test('공통 prefix와 suffix가 겹치거나 반복된 줄을 소비하지 않는다', () => {
  assert.deepEqual(compare('가\n나\n', '가\n가\n나\n'), { kind: 'CHANGED', commonBeforeLines: 1, commonAfterLines: 1, before: '', after: '가\n' });
  assert.deepEqual(compare('가\n나\n', '나\n'), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 1, before: '가\n', after: '' });
});

test('큰 입력은 비교 미확인으로 남기고 일부 구간을 전체 비교처럼 반환하지 않는다', () => {
  assert.deepEqual(compare('가'.repeat(131073), '나'), { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' });
  assert.deepEqual(compare('가', '\n'.repeat(4000)), { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' });
  assert.equal(compare('가'.repeat(131072), '나').kind, 'CHANGED');
  assert.equal(compare('\n'.repeat(3999), '나').kind, 'CHANGED');
});
