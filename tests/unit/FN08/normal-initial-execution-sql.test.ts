import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('normal 초기 graph와 START 자료는 새 forward에서 기존 0082 경로와 분리한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0083_normal_initial_execution.sql.pending',import.meta.url),'utf8');
 for(const fn of ['normal_queue_authorized','normal_initial_graph','normal_start_material_complete'])
   assert.match(sql,new RegExp('FUNCTION anvil\\.'+fn+'\\('));
 assert.doesNotMatch(sql,/DISABLE TRIGGER|SECURITY DEFINER|GRANT (INSERT|UPDATE|DELETE)/i);
 for(const name of ['execution_queue_authorized','check_initial_execution_graph','material_registration_complete','material_descriptor_valid']){
   assert.match(sql,new RegExp('ELSE anvil\\.'+name+'_pre0083\\('),name);
 }
 assert.match(sql,/BEFORE INSERT OR UPDATE OR DELETE ON anvil\.delivery_outbox[\s\S]*EXECUTE FUNCTION anvil\.guard_normal_outbox\(\)/);
 assert.match(sql,/OLD\.kind='EXECUTION_NORMAL'[\s\S]+NEW\.kind='EXECUTION_NORMAL'[\s\S]+normal_queue_authorized\(NEW\.project_id,NEW\.command_id\)/);
});

test('normal grant는 같은 명령에서 별도 실행 credential 예약 1개와 자료 세대를 검산한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0083_normal_initial_execution.sql.pending',import.meta.url),'utf8');
 assert.match(sql,/CREATE FUNCTION anvil\.normal_credential_reservation_valid\(/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION anvil\.guard_synthetic_credential_reservation\(\)[\s\S]+SYNTHETIC_CREDENTIAL_EXACT_CURRENT_GRANT_REQUIRED/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION anvil\.guard_execution_challenge_complete\(\)[\s\S]+SYNTHETIC_CREDENTIAL_CHALLENGE_REQUIRED/);
 assert.match(sql,/f->'executionCredentialReservation'->'generation'/);
 assert.doesNotMatch(sql,/sc->'credentialGeneration' IS DISTINCT FROM f->'subject'->'credentialGeneration'/);
 assert.match(sql,/NOT anvil\.normal_credential_reservation_valid\(pid,g\.id,g\.version\)/);
});


test('linked WORK forward는 정착 선택·새 실행 ID·현재 head와 원 START 역사 목적을 분리한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0104_normal_work_start_understanding.sql.pending',import.meta.url),'utf8');
 for(const name of ['fn09_work_start_identity','fn09_work_start_authority','fn09_work_start_basis','fn09_work_start_replay','fn09_work_start_fact_current','fn09_work_start_grant_guard','fn09_work_start_grant_complete','fn09_work_start_permit_guard'])assert.ok(sql.includes('FUNCTION anvil.'+name+'('),name);
 for(const token of ['fn09_work_prepare_current_source','fn09_registered_prepare_reservation_complete','normal_start_material_complete','WORK_START_BASIS','WORK_START_REPLAY','DEFERRABLE INITIALLY DEFERRED','FOR SHARE OF auth,u,cl','FOR UPDATE OF p'])assert.ok(sql.includes(token),token);
 assert.ok(!/fn01_active|GRANT\s|DISABLE TRIGGER|DROP TRIGGER|CREATE TABLE/i.test(sql));
 assert.ok(sql.includes("basis#>>'{scope,executionId}'=eid::text"));assert.ok(sql.includes("f->'understandingReviewRef' IS DISTINCT FROM basis->'reviewRef'"));assert.ok(sql.includes("'budgetPolicyRef',f#>'{intent,budgetPolicyRef}'"));assert.ok(!sql.includes("'budgetPolicyRef',f->'budgetPolicyRef'"));
 const history=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn09_work_start_replay('),sql.indexOf('CREATE FUNCTION anvil.fn09_work_start_fact_current('));
 assert.ok(!/current_source|normal_initial_graph/.test(history));assert.ok(history.includes('normal_start_material_complete'));
 const metadata=readFileSync(new URL('../../../db/migrations/0102_normal_understanding_responses.sql.pending',import.meta.url),'utf8');assert.ok(metadata.includes("selection->>'purpose'='WORK_START_BASIS'"));assert.ok(metadata.includes("selection->>'purpose'='WORK_START_REPLAY'"));
});
