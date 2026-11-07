import test from 'node:test';import assert from 'node:assert/strict';
import type {MethodologyNode} from '../../../contracts/methodologies.ts';
const m=await import(new URL('../../../apps/web/src/features/methodology-editor/node-document-order.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
function node():MethodologyNode{const ref={id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)};return{nodeId:'N1',name:'설계 단계',purpose:'문서 구성',position:{x:0,y:0},kind:'HUMAN',role:'USER',inputs:[{itemId:'IN1',formRef:ref,required:true,sourceNodeId:'PREVIOUS',reviewCriteria:['원문 보존']},{itemId:'IN2',formRef:{...ref,version:2},required:false,reviewCriteria:['선택 항목']}],outputs:[{itemId:'OUT1',formRef:ref,required:false,reviewCriteria:['초안']},{itemId:'OUT2',formRef:ref,required:true,reviewCriteria:['최종 검토']}],taskScope:{included:['설계'],excluded:['실행']},completionCriteria:['검토'],approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']};}
test('입력과 산출 문서의 선택 순서만 변경하고 항목·양식·출처·검수·다른 목록을 보존한다',()=>{
 assert.equal(typeof m?.moveNodeDocument,'function');const n=node(),old=structuredClone(n),a=m!.moveNodeDocument(n,'inputs',1,-1);assert.deepEqual(a.inputs.map((x:any)=>x.itemId),['IN2','IN1']);assert.deepEqual(a.inputs[0],old.inputs[1]);assert.deepEqual(a.inputs[1],old.inputs[0]);assert.deepEqual(a.outputs,old.outputs);assert.deepEqual(n,old);const b=m!.moveNodeDocument(a,'outputs',0,1);assert.deepEqual(b.outputs.map((x:any)=>x.itemId),['OUT2','OUT1']);assert.deepEqual(b.inputs,a.inputs);assert.deepEqual(m!.moveNodeDocument(a,'inputs',0,1),old);
});
test('목록 경계는 no-op이고 비정상 위치·목록·방향은 원문을 바꾸지 않고 거절한다',()=>{
 assert.equal(typeof m?.moveNodeDocument,'function');const n=node();assert.equal(m!.moveNodeDocument(n,'inputs',0,-1),n);assert.equal(m!.moveNodeDocument(n,'outputs',1,1),n);
 for(const args of [['inputs',-1,1],['outputs',2,-1],['inputs',0.5,1],['other',0,1],['inputs',0,2],['inputs',NaN,1]]){const v=node(),old=structuredClone(v);assert.throws(()=>m!.moveNodeDocument(v,...args),{code:'METHOD_DOCUMENT_MOVE_INVALID'});assert.deepEqual(v,old);}
});
