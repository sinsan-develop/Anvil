import assert from 'node:assert/strict';
import test from 'node:test';
import type {MethodologyGraph} from '../../../contracts/methodologies.ts';
const module=await import(new URL('../../../apps/web/src/features/methodology-editor/method-issue-targets.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const graph={nodes:[{nodeId:'A',name:'분석'},{nodeId:'B',name:'설계'}],edges:[{edgeId:'AB',fromNodeId:'A',toNodeId:'B'}],entryNodeId:'A',terminalNodeIds:['B']} as MethodologyGraph;
const targets=(g:MethodologyGraph,location:string)=>{assert.equal(typeof module?.methodIssueNodeTargets,'function');return module!.methodIssueNodeTargets(g,location);};
test('서버 구조 오류의 노드·문서·중첩 조건과 연결 위치는 같은 원본의 실제 단계만 반환한다',()=>{
 for(const location of ['nodes.B','nodes.B.documents.in','nodes.B.joinRule.not.all.0'])assert.deepEqual(targets(graph,location),[{nodeId:'B',name:'설계'}]);
 assert.deepEqual(targets(graph,'edges.AB.condition.all.0'),[{nodeId:'A',name:'분석'},{nodeId:'B',name:'설계'}]);assert.deepEqual(targets(graph,'entryNodeId'),[{nodeId:'A',name:'분석'}]);assert.deepEqual(targets(graph,'terminalNodeIds'),[{nodeId:'B',name:'설계'}]);
});
test('없는 대상·유사 접두사·모호한 ID는 다른 단계로 추측하지 않고 연결의 같은 대상은 중복하지 않는다',()=>{
 for(const location of ['graph','nodes.BOGUS','edges.ABC','nodes.missing','edges.missing',''])assert.deepEqual(targets(graph,location),[]);
 const ambiguous=structuredClone(graph);ambiguous.nodes.push({...ambiguous.nodes[0]!,nodeId:'A.documents'});assert.deepEqual(targets(ambiguous,'nodes.A.documents.item'),[]);
 ambiguous.edges.push({...ambiguous.edges[0]!,edgeId:'AB.condition'});assert.deepEqual(targets(ambiguous,'edges.AB.condition.item'),[]);
 const missing=structuredClone(graph);missing.entryNodeId='gone';missing.terminalNodeIds=['gone','B','B'];missing.edges[0]!.fromNodeId='gone';assert.deepEqual(targets(missing,'entryNodeId'),[]);assert.deepEqual(targets(missing,'edges.AB'),[{nodeId:'B',name:'설계'}]);assert.deepEqual(targets(missing,'terminalNodeIds'),[{nodeId:'B',name:'설계'}]);
});
