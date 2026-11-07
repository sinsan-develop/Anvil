import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyMethodBuffer} from '../../../apps/web/src/features/methodology-editor/common-api.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
const m=await import('../../../apps/web/src/features/methodology-editor/method-draft-import.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const user='22222222-2222-4222-8222-222222222222';
const payload=()=>({name:'가져온 절차',purpose:'사용자가 정의한 개발 절차',scope:'USER_COMMON',reason:'기존 절차 재사용',graph:{nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[]}});
function read(text:string,scope='USER_COMMON'){assert.equal(typeof m?.readMethodDraftFile,'function');return m!.readMethodDraftFile(text,scope);}
test('기존 저장 payload를 새 미저장 초안으로 읽고 권한/명령/확정 참조를 가져오지 않는다',()=>{
 const value=payload(),source=JSON.stringify(value),draft=read(source);
 const buffer=m!.importMethodDraft(emptyMethodBuffer(),user,draft);
 assert.equal(buffer.name,'가져온 절차');assert.equal(buffer.purpose,value.purpose);assert.equal(buffer.reason,value.reason);
 assert.equal(buffer.ownerUserId,user);assert.equal(buffer.targetId,null);assert.equal(buffer.version,0);assert.equal(buffer.pending,null);assert.equal(buffer.review,null);assert.equal(buffer.application,undefined);assert.equal(buffer.dirty,true);
 assert.deepEqual(buffer.graph,value.graph);buffer.graph.entryNodeId='changed';assert.equal(draft.graph.entryNodeId,'');
});
test('다른 scope·명령/권한 혼입·중복 key·깨진 graph·크기/Unicode·알려진 비밀을 거절한다',()=>{
 const value=payload();
 for(const change of [{scope:'PROJECT'},{targetId:user},{graph:{...value.graph,nodes:[{}]}},{graph:{...value.graph,nodes:[],entryNodeId:9}},{reason:'password=synthetic-secret-value'}])
  assert.throws(()=>read(JSON.stringify({...value,...change})),e=>e instanceof Error&&'code'in e&&['METHOD_DRAFT_FILE_INVALID','METHOD_DRAFT_FILE_SENSITIVE'].includes(String(e.code)));
 assert.throws(()=>read('{"name":"A","name":"B"}'),e=>e instanceof Error&&'code'in e&&e.code==='METHOD_DRAFT_FILE_INVALID');
 assert.throws(()=>read(JSON.stringify({...value,purpose:'\\ud800'}).replace('\\\\ud800','\\ud800')));
 assert.throws(()=>read(' '.repeat(2097153)));
 assert.throws(()=>read(JSON.stringify({...value,graph:{...value.graph,edges:[{condition:{not:{}}}]}})));
});
test('기존 재작업 정책과 문서 양식/노드 참조를 그대로 보존한다',()=>{
 const value:any=payload(),ref={id:user,version:1,contentHash:'a'.repeat(64)};
 value.graph.nodes=[{nodeId:'A',name:'정의',purpose:'목적',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[{itemId:'REQ',formRef:ref,required:true,reviewCriteria:['내용']}],taskScope:{included:[],excluded:[]},completionCriteria:[],approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:[]}];
 value.graph.entryNodeId='A';value.graph.terminalNodeIds=['A'];
 value.graph.edges=[{edgeId:'again',fromNodeId:'A',toNodeId:'A',kind:'REWORK',condition:null,reason:'보완',retryPolicy:{maxAttempts:3,onExhausted:'USER_DECISION',counting:'SAME_FAILURE_FINGERPRINT'}}];
 assert.deepEqual(read(JSON.stringify(value)).graph,value.graph);
});
test('미확인 명령·준비/검토/적용·다른 사용자의 입력은 가져오기로 교체하지 않는다',()=>{
 const draft=read(JSON.stringify(payload())),base={...emptyMethodBuffer(),ownerUserId:user};
 for(const change of [{pending:{}},{preparationId:'pending'},{review:{dirty:true}},{application:{reason:'남은 적용'}},{ownerUserId:'33333333-3333-4333-8333-333333333333'}]){
  const buffer={...base,...change} as any,before=structuredClone(buffer);
  assert.throws(()=>m!.importMethodDraft(buffer,user,draft));assert.deepEqual(buffer,before);
 }
});
test('프로젝트 공간 payload만 해당 공간에 가져오며 구조적 보완은 서버 검수에 남긴다',()=>{
 const value=payload();value.scope='PROJECT';
 assert.equal(read(JSON.stringify(value),'PROJECT').scope,'PROJECT');
 assert.throws(()=>read(JSON.stringify(value),'SYSTEM'),e=>e instanceof Error&&'code'in e&&e.code==='METHOD_DRAFT_FILE_INVALID');
 const raw=JSON.stringify({...payload(),graph:{nodes:[],edges:[],entryNodeId:'',terminalNodeIds:[],commandId:user}});
 assert.throws(()=>read(raw),e=>e instanceof Error&&'code'in e&&e.code==='METHOD_DRAFT_FILE_INVALID');
});
test('기존 서버 문법이 수용한 201개 노드/완료조건과 긴 판단값을 가져오기만 새 제한으로 거절하지 않는다',()=>{
 const value:any=payload();
 const node={nodeId:'A',name:'정의',purpose:'목적',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:[],excluded:[]},completionCriteria:Array.from({length:201},(_,i)=>'확인'+i),approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:[]};
 value.graph.nodes=Array.from({length:201},(_,i)=>({...node,nodeId:'N'+i}));
 value.graph.entryNodeId='N0';value.graph.terminalNodeIds=['N200'];
 value.graph.edges=[{edgeId:'E',fromNodeId:'N0',toNodeId:'N1',kind:'BRANCH',condition:{fieldRef:{nodeId:'N0',field:'USER_DECISION'},operator:'EQ',value:'판단'.repeat(1001)},reason:'사용자 판단'}];
 assert.equal(validateMethodologyGraph(value.graph,[]).issues.some(i=>i.code==='INPUT_INVALID'),false);
 assert.deepEqual(read(JSON.stringify(value)).graph,value.graph);
});
