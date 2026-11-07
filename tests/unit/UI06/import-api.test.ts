import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rejectedDocumentImport, type DocumentImportBuffer } from '../../../apps/web/src/features/design-trace/import-api.ts';
import { prepareDocumentSave, type DocumentBuffer } from '../../../apps/web/src/features/design-trace/editor-api.ts';
test('확실한 거절과 결과 미확인을 구별하고 파일 준비 중에는 초안 저장을 시작하지 않는다', async () => {
  for (const failure of [{ status: 0, code: 'CONNECTION_LOST' }, { status: 503, code: 'REQUEST_FAILED' }, { status: 409, code: 'RESPONSE_INVALID' }]) assert.equal(rejectedDocumentImport({ failure } as DocumentImportBuffer), false);
  assert.equal(rejectedDocumentImport({ failure: { status: 409, code: 'CONTROL_GENERATION_CONFLICT' } } as DocumentImportBuffer), true);
  assert.equal(rejectedDocumentImport({ uncertain: true, failure: { status: 409, code: 'CONTROL_GENERATION_CONFLICT' } } as DocumentImportBuffer), false, '과거 미확인 명령은 이후4xx만으로 미적용이 되지 않는다');
  await assert.rejects(prepareDocumentSave({ importPreparationId: 'reserved-before-file-read' } as DocumentBuffer, {} as any), (e: unknown) => (e as { code: string }).code === 'IMPORT_SELECTION_REQUIRED');
});
