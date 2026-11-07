export function parseTextImport(bytes: Uint8Array, mediaType: string): { status: 'READY' | 'FAILED' | 'UNSUPPORTED'; parserVersion: string | null; losses: string[]; issues: { code: string; message: string }[] } {
  const result = { parserVersion: 'UTF8_IDENTITY_1', losses: [], issues: [] };
  if (!['text/plain;charset=utf-8', 'text/markdown;charset=utf-8'].includes(mediaType)) return { ...result, status: 'UNSUPPORTED', parserVersion: null, issues: [{ code: 'IMPORT_FORMAT_UNSUPPORTED', message: '원본은 보존했지만 이 형식의 본문 추출은 지원하지 않습니다.' }] };
  if (bytes.byteLength > 2 * 1024 * 1024) return { ...result, status: 'FAILED', issues: [{ code: 'IMPORT_TEXT_TOO_LARGE', message: '본문 2MiB 상한을 초과했습니다. 원본은 보존하며 자르지 않습니다.' }] };
  try { new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return { ...result, status: 'FAILED', issues: [{ code: 'IMPORT_UTF8_INVALID', message: '유효한 UTF-8이 아닙니다. 원본은 보존하며 임의로 변환하지 않습니다.' }] }; }
  // 무변환 추출: 원본 artifact를 그대로 참조하며 BOM/CRLF/공백을 손실시키지 않는다.
  return { ...result, status: 'READY' };
}
