import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MethodologyGraph } from '../../../contracts/methodologies.ts';

const compiler = await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' });
after(async () => { await compiler.close(); });
const { GraphRelationsEditor } = await compiler.ssrLoadModule('/src/features/methodology-editor/GraphRelationsEditor.tsx');
function fixture(): MethodologyGraph {
  return { nodes: [{ nodeId: 'A', name: '현존 단계' } as MethodologyGraph['nodes'][number]], edges: [{ edgeId: 'E', fromNodeId: 'A', toNodeId: 'A', kind: 'SEQUENCE', condition: null, reason: '' }], entryNodeId: 'A', terminalNodeIds: ['A'] };
}
function render(graph: MethodologyGraph) {
  return renderToStaticMarkup(createElement(GraphRelationsEditor, { graph, onChange: () => { throw Error('렌더 중 변경 금지'); } }));
}
function selected(html: string, suffix: string) {
  const select = html.match(new RegExp(`<select id="[^"]*-${suffix}">([\\s\\S]*?)</select>`));
  assert.ok(select); return select[1]!;
}
test('없는 시작·출발·도착 참조는 원 ID를 선택 항목으로 보존하고 정상 노드로 꾸미지 않는다', () => {
  const graph = fixture(); graph.entryNodeId = '사라진 시작'; graph.edges[0]!.fromNodeId = '사라진 출발'; graph.edges[0]!.toNodeId = '<script>사라진 도착</script>';
  const before = structuredClone(graph), html = render(graph);
  for (const [field, text] of [['entry', '사라진 시작'], ['from', '사라진 출발'], ['to', '&lt;script&gt;사라진 도착&lt;/script&gt;']]) {
    const options = selected(html, field!); assert.match(options, /selected=""/); assert.ok(options.includes(`없는 단계: ${text}`));
    assert.doesNotMatch(options, /value="A" selected=""/);
  }
  assert.doesNotMatch(html, /<script>/); assert.deepEqual(graph, before);
});
test('빈 연결 참조는 미지정으로 보존하고 정상 참조에는 없는 단계 표시를 만들지 않는다', () => {
  const graph = fixture(); graph.edges[0]!.fromNodeId = ''; graph.edges[0]!.toNodeId = '';
  const before = structuredClone(graph), html = render(graph);
  for (const field of ['from', 'to']) assert.match(selected(html, field), /<option value=""[^>]*selected=""[^>]*>미지정<\/option>/);
  assert.deepEqual(graph, before);
  const normal = render(fixture()); assert.doesNotMatch(normal, /없는 단계:/);
  for (const field of ['entry', 'from', 'to']) assert.match(selected(normal, field), /value="A" selected=""/);
});
