import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'json-schema-to-typescript';
import { contractFiles } from '../contracts/catalog.ts';

const root = new URL('../contracts/', import.meta.url);
const parts = ['/* 자동 생성. schema를 수정한 뒤 npm run contracts:generate 실행. */'];
for (const file of contractFiles) {
  const schema = JSON.parse(await readFile(new URL(file, root), 'utf8'));
  parts.push(await compile(schema, schema.title, { bannerComment: '', additionalProperties: false, style: { singleQuote: true } }));
}
const output = parts.join('\n').trimEnd() + '\n';
const target = new URL('generated-types.ts', root);
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8').catch(() => '') !== output) {
    console.error('CONTRACT_TYPES_STALE');
    process.exitCode = 1;
  }
} else {
  await writeFile(target, output, { encoding: 'utf8' });
}
