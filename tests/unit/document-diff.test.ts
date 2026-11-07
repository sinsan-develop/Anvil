import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentTextDiff } from '../../apps/server/modules/documents/document-diff.ts';
test('서버 차이 비교는 BOM/CRLF·빈 줄·스크립트를 실행/정규화하지 않고 실제 변경 구간을 보존한다', () => {
  assert.deepEqual(documentTextDiff('\uFEFF제목\r\n이전  \r\n끝\r\n', '\uFEFF제목\r\n<script>x</script>\r\n끝\r\n'), { format: 'ANVIL_TEXT_DIFF_1', startLine: 2, before: ['이전  \r\n'], after: ['<script>x</script>\r\n'], unchangedBefore: 1, unchangedAfter: 1 });
  assert.deepEqual(documentTextDiff('', '새 원문'), { format: 'ANVIL_TEXT_DIFF_1', startLine: 1, before: [], after: ['새 원문'], unchangedBefore: 0, unchangedAfter: 0 });
  assert.deepEqual(documentTextDiff('같음\n', '같음\n').before, []);
});
