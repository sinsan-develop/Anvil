import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const compiler = await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
after(async () => { await compiler.close(); });
const module = await compiler.ssrLoadModule('/src/features/knowledge/KnowledgePage.tsx');
const applied = { query: '원본', kind: 'FACT', status: 'ACTIVE' };
function allowed(draft: any, old: any, cursor: string | null, next: string | null) { assert.equal(typeof module.canContinueKnowledgeSearch, 'function'); return module.canContinueKnowledgeSearch(draft, old, cursor, next); }

test('성공 조회와 같은 검색어·종류·상태 및 발급 cursor일 때만 다음 목록을 허용한다', () => {
 assert.equal(allowed({ ...applied }, applied, 'issued-page', 'issued-page'), true);
 for (const patch of [{ query: '새 원본' }, { kind: 'HYPOTHESIS' }, { status: 'EXCLUDED' }, { query: '원본 ' }]) assert.equal(allowed({ ...applied, ...patch }, applied, 'issued-page', 'issued-page'), false);
 assert.equal(allowed({ ...applied }, null, 'issued-page', 'issued-page'), false);
});

test('비어 있거나 앞선 페이지 cursor는 조건이 같아도 재사용하지 않는다', () => {
 for (const [cursor, next] of [[null, null], ['', ''], ['old-page', 'new-page'], ['issued-page', null], [null, 'issued-page']]) assert.equal(allowed(applied, applied, cursor!, next!), false);
 const draft = { ...applied, query: '편집 후 다시 원본으로' }; assert.equal(allowed(draft, applied, 'issued-page', 'issued-page'), false); draft.query = '원본'; assert.equal(allowed(draft, applied, 'issued-page', 'issued-page'), true);
});
