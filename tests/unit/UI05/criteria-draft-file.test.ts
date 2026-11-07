import test from 'node:test';
import assert from 'node:assert/strict';
import {criteriaFixture} from '../FN12/result-criteria-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/criteria-draft-file.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const rows=[{field:'acceptanceCriteria',index:0,criterionId:'save',testId:'',kind:''},{field:'verificationRequirements',index:0,criterionId:'',testId:'DENY-01',kind:'SECURITY'}];
test('부분 작성 기준만 파일 왕복하고 명령·주체·인증정보를 포함하지 않는다',async()=>{
 assert.equal(typeof mod.encodeCriteriaDraft,'function','기준 입력 파일 보존 미구현');const f=criteriaFixture(),before=structuredClone(rows),text=await mod.encodeCriteriaDraft(f.assignment,rows,'작성 중');const json=JSON.parse(text);
 assert.deepEqual(Object.keys(json).sort(),['assignmentRef','contentHash','format','projectId','reason','rows','schemaVersion']);assert.equal(json.format,'ANVIL_RESULT_CRITERIA_DRAFT');assert.equal(json.schemaVersion,1);
 assert.deepEqual(await mod.decodeCriteriaDraft(f.assignment,text),{rows:before,reason:'작성 중'});assert.deepEqual(rows,before);
});
test('변조·다른 임무 hash·누락 원조건·비밀 표식·초과 입력은 복원하지 않는다',async()=>{
 assert.equal(typeof mod.decodeCriteriaDraft,'function');const f=criteriaFixture(),text=await mod.encodeCriteriaDraft(f.assignment,rows,'작성 중');
 await assert.rejects(()=>mod.decodeCriteriaDraft(f.assignment,text.replace('작성 중','변조')),{code:'RESULT_CRITERIA_DRAFT_INVALID'});
 const other=structuredClone(f.assignment);other.ref.contentHash='f'.repeat(64);await assert.rejects(()=>mod.decodeCriteriaDraft(other,text),{code:'RESULT_CRITERIA_DRAFT_INVALID'});
 await assert.rejects(()=>mod.encodeCriteriaDraft(f.assignment,rows.slice(0,1),'누락'),{code:'RESULT_CRITERIA_DRAFT_INVALID'});
 await assert.rejects(()=>mod.encodeCriteriaDraft(f.assignment,rows,'api_key=not-a-real-secret-value'),{code:'RESULT_CRITERIA_DRAFT_SENSITIVE'});
 await assert.rejects(()=>mod.decodeCriteriaDraft(f.assignment,' '.repeat(2097153)),{code:'RESULT_CRITERIA_DRAFT_INVALID'});
 await assert.rejects(()=>mod.decodeCriteriaDraft(f.assignment,JSON.stringify({...JSON.parse(text),pending:{commandId:'not-transferable'}})),{code:'RESULT_CRITERIA_DRAFT_INVALID'});
});
