import assert from 'node:assert/strict';
import test from 'node:test';
import type {MethodologyGraph,MethodologyNode} from '../../../contracts/methodologies.ts';
const module=await import(new URL('../../../apps/web/src/features/methodology-editor/node-deletion-impact.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const ref={id:'a6f20000-0000-4000-8000-000000000001',version:1,contentHash:'a'.repeat(64)};
const node=(nodeId:string):MethodologyNode=>({nodeId,name:nodeId,purpose:'단계 목적',kind:'HUMAN',role:'USER',position:{x:0,y:0},inputs:[],outputs:[],taskScope:{included:[],excluded:[]},completionCriteria:[],approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:[]});
const condition={fieldRef:{nodeId:'A',field:'USER_DECISION' as const},operator:'EQ' as const,value:'CONTINUE'};
function fixture():MethodologyGraph{const a=node('A'),b=node('B'),c=node('C');a.outputs=[{itemId:'original',formRef:ref,required:true,reviewCriteria:[]}];b.inputs=[{itemId:'dependent',formRef:ref,required:true,sourceNodeId:'A',reviewCriteria:[]}];c.joinRule={mode:'DECLARED_CONDITION',condition:{not:{any:[condition]}}};return{nodes:[a,b,c],entryNodeId:'A',terminalNodeIds:['A','C'],edges:[{edgeId:'direct',fromNodeId:'A',toNodeId:'B',kind:'SEQUENCE',condition:null,reason:'직접 연결'},{edgeId:'retained',fromNodeId:'B',toNodeId:'C',kind:'BRANCH',condition:{all:[condition]},reason:'다른 연결의 판단 참조'}]};}
const impact=(graph:MethodologyGraph,id:string)=>{assert.equal(typeof module?.nodeDeletionImpact,'function');return module!.nodeDeletionImpact(graph,id);};
test('단계 제거 전 직접 연결·자체 문서와 남아 깨질 참조·시작/종료 영향을 구분하고 원본은 보존한다',()=>{
 const graph=fixture(),before=structuredClone(graph),value=impact(graph,'A');
 assert.equal(value.nodeId,'A');assert.equal(value.removesEntry,true);assert.equal(value.removesTerminal,true);assert.deepEqual(value.removedEdges.map((e:{edgeId:string})=>e.edgeId),['direct']);
 assert.deepEqual(value.removedDocuments,[{direction:'산출',itemId:'original',required:true,formRef:ref}]);
 assert.deepEqual(value.retainedReferences,['nodes.B.inputs.dependent','nodes.C.joinRule.condition','edges.retained.condition']);assert.deepEqual(graph,before);
});
test('영향 없는 단계는 빈 목록이며 없는 대상과 유한 수집 한도 초과는 삭제 가능한 목록으로 위장하지 않는다',()=>{
 const graph=fixture();graph.nodes.push(node('D'));const value=impact(graph,'D');assert.deepEqual(value.removedEdges,[]);assert.deepEqual(value.removedDocuments,[]);assert.deepEqual(value.retainedReferences,[]);assert.equal(value.removesEntry,false);assert.equal(value.removesTerminal,false);
 assert.throws(()=>impact(graph,'missing'),/METHOD_DELETION_IMPACT_UNVERIFIED/);
 const cyclic:any={not:null};cyclic.not=cyclic;graph.edges[1]!.condition=cyclic;assert.throws(()=>impact(graph,'A'),/METHOD_DELETION_IMPACT_UNVERIFIED/);
});
