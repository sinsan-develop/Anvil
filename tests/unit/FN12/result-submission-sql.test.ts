import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../../../db/migrations/0025_result_submissions.sql',import.meta.url),'utf8').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return'';throw e;});
test('결과테이블은정본범위/원문·원명령FK와불변guard를추가하고기존공유함수를교체하지않는다',()=>{
 assert.match(sql,/CREATE TABLE anvil\.result_submissions/,'계획된 결과 원문 물리 저장 누락');for(const field of ['assignment_ref','execution_ref','manifest_ref','manifest_hash','submission_state','submitted_by','submitted_at','snapshot_json'])assert(sql.includes(field));
 assert.match(sql,/FOREIGN KEY\(project_id,execution_id,generation\) REFERENCES anvil\.executions/);assert.match(sql,/REFERENCES anvil\.commands\(project_id,id\)/);assert.match(sql,/RESULT_SUBMISSION_HISTORY_IMMUTABLE/);assert.match(sql,/REVOKE UPDATE,DELETE/);assert.doesNotMatch(sql,/CREATE OR REPLACE|DROP (?:FUNCTION|TRIGGER)|DISABLE TRIGGER/i);
});
test('새결과guard는정확정책/주체·세션/원실행·manifest와receipt/감사를요구하며완료로승격하지않는다',()=>{
 for(const token of ['submitResult','RESULT_SUBMISSION_EXACT_RECEIPT_REQUIRED','RESULT_SUBMISSION_EXECUTION_BINDING_INVALID','authorizationReceiptRef','scope_digest','project_control','auth_sessions','audit_events','completionAccepted','formalFailureCounted','evidenceProvenanceVerified','WORKER_CLAIM','DEFERRABLE INITIALLY DEFERRED'])assert(sql.includes(token),token);
 assert.doesNotMatch(sql,/UPDATE anvil\.(?:assignments|executions|writer_claims)\b/i);
});
test('검토I1의요청A/원문B재해시는정확요청재구성hash장벽을요구한다',()=>{assert.match(sql,/cmd\.request_hash IS DISTINCT FROM anvil\.execution_json_hash\(jsonb_build_object\('schemaVersion',1/);assert.match(sql,/'payload',jsonb_build_object\('scope',scope,'submissionId',NEW\.id,'manifest',m\)/);});
test('검토I2의재해시필수필드누락은전체manifest검사장벽을요구한다',()=>{assert.match(sql,/NOT COALESCE\(anvil\.result_manifest_valid\(m\),false\)/);for(const field of ['profileRef','startedAt','finishedAt','criterionId','testId','beforeHash','afterHash'])assert(sql.includes(field),field);});
