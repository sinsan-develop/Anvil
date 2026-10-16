import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTextImport } from '../../apps/server/modules/documents/text-import.ts';

test('가져오기 파서는 UTF-8 원문의 BOM·줄바꿈·문서 지시를 실행/정규화하지 않는다', () => {
  const bytes = Buffer.from('\uFEFF# 제목\r\n<script>throw Error()</script>  \r\n');
  const parsed = parseTextImport(bytes, 'text/markdown;charset=utf-8');
  assert.equal(parsed.status, 'READY'); assert.equal(parsed.parserVersion, 'UTF8_IDENTITY_1');
  assert.deepEqual(parsed.losses, []); assert.deepEqual(parsed.issues, []);
});
test('지원하지 않는 형식·잘못된 UTF-8·본문 상한 초과는 추출 성공이 아니다', () => {
  assert.equal(parseTextImport(Buffer.from('<script>x</script>'), 'text/html').status, 'UNSUPPORTED');
  assert.equal(parseTextImport(Buffer.from([0xc3, 0x28]), 'text/plain;charset=utf-8').status, 'FAILED');
  assert.equal(parseTextImport(Buffer.alloc(2 * 1024 * 1024 + 1), 'text/plain;charset=utf-8').status, 'FAILED');
});
