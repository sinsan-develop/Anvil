import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
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

function capture(graph: MethodologyGraph, onChange: (next: MethodologyGraph) => void) {
  let tree: ReactNode;
  function Capture() { tree = GraphRelationsEditor({ graph, onChange }); return tree; }
  renderToStaticMarkup(createElement(Capture));
  const elements: ReactElement<Record<string, any>>[] = [];
  function visit(value: ReactNode) {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!isValidElement<Record<string, any>>(value)) return;
    elements.push(value); visit(value.props.children);
  }
  visit(tree);
  return elements;
}

test('없는 종료 참조·빈 ID·중복 ID는 렌더 중 보존하고 원 ID를 안전하게 보여준다', () => {
  const graph = fixture(); graph.terminalNodeIds = ['A', '<script>없는 종료</script>', '', 'A', '없는 종료'];
  const before = structuredClone(graph), html = render(graph);
  assert.match(html, /&lt;script&gt;없는 종료&lt;\/script&gt;/);
  assert.match(html, /빈 ID/); assert.match(html, /중복/);
  assert.doesNotMatch(html, /<script>/);
  const tree = capture(graph, () => assert.fail('명시 조작 전 변경 금지'));
  const removals = tree.filter(value => value.type === 'button' && /^종료 참조 \d+ 제거$/.test(value.props['aria-label'] ?? ''));
  assert.deepEqual(removals.map(value => value.props['aria-label']), ['종료 참조 2 제거', '종료 참조 3 제거', '종료 참조 4 제거', '종료 참조 5 제거']);
  assert.deepEqual(graph, before);
});

test('종료 참조 제거 콜백은 선택한 배열 항목만 빼고 다른 잘못된 참조·순서·원 그래프를 보존한다', () => {
  const graph = fixture(); graph.entryNodeId = '없는 시작'; graph.edges[0]!.toNodeId = '없는 도착';
  graph.terminalNodeIds = ['A', '없는 종료', '', '없는 종료', 'A', '<img src=x onerror=alert(1)>'];
  const before = structuredClone(graph);
  const cases = [
    { label: '종료 참조 2 제거', expected: ['A', '', '없는 종료', 'A', '<img src=x onerror=alert(1)>'] },
    { label: '종료 참조 3 제거', expected: ['A', '없는 종료', '없는 종료', 'A', '<img src=x onerror=alert(1)>'] },
    { label: '종료 참조 4 제거', expected: ['A', '없는 종료', '', 'A', '<img src=x onerror=alert(1)>'] },
    { label: '종료 참조 5 제거', expected: ['A', '없는 종료', '', '없는 종료', '<img src=x onerror=alert(1)>'] },
    { label: '종료 참조 6 제거', expected: ['A', '없는 종료', '', '없는 종료', 'A'] },
  ];
  for (const { label, expected } of cases) {
    const calls: MethodologyGraph[] = [];
    const button = capture(graph, next => calls.push(next)).find(value => value.type === 'button' && value.props['aria-label'] === label);
    assert.ok(button, label); assert.equal(button.props.type, 'button'); assert.equal(calls.length, 0);
    button.props.onClick();
    assert.equal(calls.length, 1); assert.deepEqual(calls[0], { ...before, terminalNodeIds: expected });
    assert.notEqual(calls[0], graph); assert.equal(calls[0]!.nodes, graph.nodes); assert.equal(calls[0]!.edges, graph.edges);
    assert.deepEqual(graph, before);
  }
});

test('정상 종료 참조만 있으면 보완용 제거 버튼 없이 기존 종료 선택을 유지한다', () => {
  const graph = fixture(), before = structuredClone(graph);
  const tree = capture(graph, () => assert.fail('렌더 중 변경 금지'));
  assert.equal(tree.filter(value => value.type === 'button' && /^종료 참조 \d+ 제거$/.test(value.props['aria-label'] ?? '')).length, 0);
  const checkbox = tree.find(value => value.type === 'input' && value.props.type === 'checkbox');
  assert.ok(checkbox); assert.equal(checkbox.props.checked, true); assert.deepEqual(graph, before);
});
