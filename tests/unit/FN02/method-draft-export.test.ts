import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyMethodBuffer} from '../../../apps/web/src/features/methodology-editor/common-api.ts';
import {readMethodDraftFile,importMethodDraft} from '../../../apps/web/src/features/methodology-editor/method-draft-import.ts';
const m:any=await import('../../../apps/web/src/features/methodology-editor/method-draft-export.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const user='22222222-2222-4222-8222-222222222222';
const buffer=()=>({...emptyMethodBuffer(),ownerUserId:user,name:'내 개발 절차',purpose:'Agent와 무관하게 정의 재사용',reason:'사용자 보관',dirty:true});
function output(b:any,scope='USER_COMMON',owner=user){assert.equal(typeof m.exportMethodDraftFile,'function');return m.exportMethodDraftFile(b,owner,scope);}
test('편집 초안의 기존 5필드만 파일로 왕복하고 새 초안은 명령/확정/적용을 상속하지 않는다',()=>{
 for(const scope of ['USER_COMMON','PROJECT']){
  const b=buffer();b.targetId=user;b.version=7;b.graph={nodes:[{nodeId:'REQ',name:'요구 정의',purpose:'사용자 목적 보존',kind:'HUMAN',position:{x:120,y:-40},role:'USER',inputs:[],outputs:[{itemId:'REQ_DOC',formRef:{id:user,version:3,contentHash:'a'.repeat(64)},required:true,reviewCriteria:['내용 확인']}],taskScope:{included:['요구 작성'],excluded:['실행']},completionCriteria:['검토'],approvalBoundary:['HUMAN'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['판단 근거']}],edges:[{edgeId:'RETRY',fromNodeId:'REQ',toNodeId:'REQ',kind:'REWORK',condition:{fieldRef:{nodeId:'REQ',field:'REVIEW_OUTCOME'},operator:'EQ',value:'REWORK'},reason:'보완',retryPolicy:{maxAttempts:3,counting:'SAME_FAILURE_FINGERPRINT',onExhausted:'USER_DECISION'}}],entryNodeId:'REQ',terminalNodeIds:['REQ']};const before=structuredClone(b),raw=output(b,scope),draft=readMethodDraftFile(raw,scope),restored=importMethodDraft(emptyMethodBuffer(),user,draft);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['graph','name','purpose','reason','scope']);assert.deepEqual(draft,{name:b.name,purpose:b.purpose,reason:b.reason,scope,graph:b.graph});assert.deepEqual(b,before);
  assert.equal(restored.targetId,null);assert.equal(restored.version,0);assert.equal(restored.pending,null);assert.equal(restored.review,null);assert.equal(restored.application,undefined);assert.equal(restored.dirty,true);
 }
});
test('다른 사용자·미확인 명령/검토/적용·비밀/초과/손상 초안은 파일로 내보내지 않는다',()=>{
 assert.equal(typeof m.exportMethodDraftFile,'function');
 for(const change of [{ownerUserId:null},{ownerUserId:'33333333-3333-4333-8333-333333333333'},{pending:{}},{preparationId:'pending'},{review:{}},{application:{}},{reason:'password=synthetic-export-marker'},{purpose:'x'.repeat(2097153)},{graph:{nodes:[{}],edges:[],entryNodeId:'',terminalNodeIds:[]}}]){
  const b={...buffer(),...change},before=structuredClone(b);assert.throws(()=>output(b));assert.deepEqual(b,before);
 }
 assert.throws(()=>output(buffer(),'SYSTEM'));
});
