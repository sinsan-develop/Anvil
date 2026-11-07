import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {contentHash} from '../../../contracts/canonical.ts';
const sql=await readFile(new URL('../../../db/migrations/0020_execution_recovery.sql',import.meta.url),'utf8');
test('회수 SQL 파일은 종전2연산 전용 helper를 재사용하지 않고 회수 전용 정책을 대조한다(실제SQL 검증 아님)',()=>{
 assert.match(sql,/CREATE FUNCTION anvil\.recovery_policy_deadline\(/);assert.match(sql,/policy_deadline=anvil\.recovery_policy_deadline\(/);assert(!sql.includes('policy_deadline=anvil.execution_policy_deadline('));assert.match(sql,/rule->>'disposition'='DENY'/);assert.match(sql,/rule->>'disposition'='REQUIRE_APPROVAL'/);
});
test('forward 파일은 기존3SQL 지문과 초기 EXECUTION graph 검사를 보존한다(실제DDL 검증 아님)',async()=>{
 for(const [name,hash]of [['0017_execution_authority','40c8666fe6fb8f9d1d027d9f15d03e8a71f2b608887343e9a92b49c72220b1f3'],['0018_execution_observation','547debde0fa13f24401ddcf538a8a178147d5c9bcb60863b634a798b4bb896e5'],['0019_understanding_reviews','5ffc3ee4db2fc53614794e6f2d1f3cec81b48548e2237259307e5c17bae14008']])assert.equal(contentHash(await readFile(new URL('../../../db/migrations/'+name+'.sql',import.meta.url))),hash);
 assert.deepEqual(sql.match(/DROP TRIGGER[^;]+;/g),['DROP TRIGGER initial_execution_row_guard ON anvil.execution_grants;','DROP TRIGGER initial_execution_complete ON anvil.execution_grants;']);assert(sql.includes('anvil.execution_queue_authorized(NEW.project_id,NEW.command_id)'));assert(sql.includes('anvil.check_initial_execution_graph(NEW.project_id,NEW.command_id)'));assert(!/SECURITY DEFINER|GRANT .* TO anvil_v3_app/i.test(sql));
});
