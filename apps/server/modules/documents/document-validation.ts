import type { FormDefinition } from './forms.ts';

export function validateDocumentConfirmation(body: string, sections: { itemId: string; anchor: string }[], definition: FormDefinition) {
  const issues: { code: string; location: string; severity: string; message: string }[] = [];
  const issue = (code: string, location: string, message: string) => { if (issues.length < 200) issues.push({ code, location, severity: 'ERROR', message }); };
  const lines = body.split(/\r\n|\n|\r/), ids = new Set<string>(), positions = new Set<number>();
  const located: { itemId: string; start: number }[] = [];
  for (const s of sections) {
    const n = Number(s.anchor?.slice(5));
    if (!/^line:[1-9][0-9]{0,7}$/.test(s.anchor) || n > lines.length || ids.has(s.itemId) || positions.has(n) || !definition.items.some(item => item.itemId === s.itemId)) issue('DOCUMENT_SECTION_INVALID', s.itemId, '항목별 원문 시작 위치는 실제로 존재하고 서로 달라야 합니다.');
    else { located.push({ itemId: s.itemId, start: n - 1 }); ids.add(s.itemId); positions.add(n); }
  }
  located.sort((a, b) => a.start - b.start);
  // 코드/예시 블록 안의 표를 실제 반복 자료로 채택하지 않는다.
  let fence: { marker: string; length: number } | null = null;
  const visible = lines.map(line => {
    const match = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (match) { if (!fence) fence = { marker: match[1]![0]!, length: match[1]!.length }; else if (match[1]![0] === fence.marker && match[1]!.length >= fence.length && !match[2]!.trim()) fence = null; return ''; }
    return fence ? '' : line;
  });
  for (const item of definition.items) {
    const index = located.findIndex(s => s.itemId === item.itemId);
    if (index < 0) { if (item.required) issue('REQUIRED_SECTION_MISSING', item.itemId, '필수 항목을 원문에 연결하세요.'); continue; }
    const text = visible.slice(located[index]!.start, located[index + 1]?.start ?? lines.length);
    if (item.valueType === 'TEXT') {
      if (!text.some(line => !/^\s{0,3}#{1,6}(?:\s|$)/.test(line) && meaningful(line))) issue('REQUIRED_CONTENT_MISSING', item.itemId, '목차나 미작성 표식이 아닌 실제 본문을 작성하세요.');
      continue;
    }
    const fields = item.fields.filter(field => field.required);
    let valid = false;
    for (let i = 0; i + 1 < text.length; i++) {
      const header = cells(text[i]!), separator = cells(text[i + 1]!);
      if (!header || !separator || separator.length !== header.length || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
      const columns = fields.map(field => header.map((cell, n) => cell === field.fieldId || cell === field.title ? n : -1).filter(n => n >= 0));
      if (columns.some(matches => matches.length !== 1) || new Set(columns.map(matches => matches[0])).size !== fields.length) continue;
      let count = 0, complete = true;
      for (let row = i + 2; row < text.length; row++) {
        const values = cells(text[row]!); if (!values) break;
        count++; if (values.length !== header.length || columns.some(matches => !meaningful(values[matches[0]!] ?? ''))) complete = false;
      }
      if (count > 0 && complete) { valid = true; break; }
    }
    if (!valid) issue('REQUIRED_RECORD_FIELDS_MISSING', item.itemId, '반복 자료는 필수 필드 ID 또는 명칭의 Markdown 표와 값이 있는 행으로 작성하세요.');
  }
  return { validForConfirmation: issues.length === 0, issues, formatOnly: true };
}
function meaningful(value: string) { const text = value.trim(); return !!text && !/^(?:TODO|TBD|미작성|작성\s*예정|추후\s*작성|예시|placeholder)(?:$|\s*[:：])/i.test(text) && !/^[-_*\s]+$/.test(text) && !/^<!--.*-->$/.test(text); }
function cells(line: string): string[] | null {
  const value = line.trim(); if (!value.startsWith('|') || !value.endsWith('|')) return null;
  const result: string[] = []; let cell = '';
  for (let i = 1; i < value.length - 1; i++) { const char = value[i]!; if (char === '\\' && i + 1 < value.length - 1 && ['|','\\'].includes(value[i + 1]!)) { cell += value[++i]; } else if (char === '|') { result.push(cell.trim()); cell = ''; } else cell += char; }
  result.push(cell.trim()); return result;
}
