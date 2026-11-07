import assert from 'node:assert/strict';
import test from 'node:test';
import {newKnowledge,prepareKnowledge} from '../../../apps/web/src/features/knowledge/api.ts';
const m=await import('../../../apps/web/src/features/knowledge/rejected-knowledge-draft.ts').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const pid='11111111-1111-4111-8111-111111111111',s={user:{id:'22222222-2222-4222-8222-222222222222'},clientId:'33333333-3333-4333-8333-333333333333',csrfToken:'C'.repeat(43)};
async function fixture(){const b=newKnowledge(pid,s,1);b.title='작성 중 제목';b.body='작성한 본문';b.reason='기록 이유';b.pending=await prepareKnowledge(b,s);b.failure={code:'KNOWLEDGE_INPUT_INVALID',status:422};return b;}
test('확실거절 뒤 명시 편집 재개는 입력/출처·기준·세대는 보존하고 원명령만 새 작성과 분리한다',async()=>{
 const b=await fixture(),before=structuredClone(b);assert.equal(typeof m?.reopenRejectedKnowledgeDraft,'function');
 assert.equal(m!.canReopenRejectedKnowledgeDraft(b,pid,s),true);const value=m!.reopenRejectedKnowledgeDraft(b,pid,s);
 assert.equal(value.pending,null);assert.equal(value.failure,null);assert.equal(value.dirty,true);assert.equal(value.body,b.body);assert.deepEqual(value.sourceRefs,b.sourceRefs);assert.equal(value.controlGeneration,1);assert.equal(value.resultRef,null);assert.deepEqual(b,before);
 const next=await prepareKnowledge(value,s);assert.notEqual(next.saveId,b.pending!.saveId);assert.notEqual(next.upload.commandId,b.pending!.upload.commandId);
});
test('미확인/유실/본문불명·격리·완료·다른주체/프로젝트는 입력재개로 우회하지 않는다',async()=>{
 const b=await fixture();assert.equal(typeof m?.canReopenRejectedKnowledgeDraft,'function');
 for(const change of [{uncertain:true},{failure:{code:'CONNECTION_LOST',status:0}},{failure:{code:'RESPONSE_INVALID',status:422}},{failure:{code:'REQUEST_FAILED',status:403}},{failure:{code:'ARTIFACT_QUARANTINED',status:412}},{resultRef:{id:pid,version:1,contentHash:'a'.repeat(64)}},{pending:null},{ownerUserId:pid},{ownerClientId:pid},{projectId:s.clientId}]){
  const value={...b,...change} as any,before=structuredClone(value);assert.equal(m!.canReopenRejectedKnowledgeDraft(value,pid,s),false);
  assert.throws(()=>m!.reopenRejectedKnowledgeDraft(value,pid,s),e=>e instanceof Error&&'code'in e&&e.code==='KNOWLEDGE_DRAFT_REOPEN_BLOCKED');assert.deepEqual(value,before);
 }
});
