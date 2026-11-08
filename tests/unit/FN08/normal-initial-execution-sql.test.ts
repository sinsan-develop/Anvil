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
