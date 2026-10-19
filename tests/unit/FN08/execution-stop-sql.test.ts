import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {contentHash} from '../../../contracts/canonical.ts';
const sql=await readFile(new URL('../../../db/migrations/0021_execution_stop.sql',import.meta.url),'utf8');
test('중지 forward 파일의 정책/예약·실영수증/봉투·보류outbox와역방향검사(실제SQL PASS 아님)',()=>{
 assert(sql.includes("op NOT IN('requestExecutionStop')"));assert(sql.includes('deadline=anvil.stop_policy_deadline('));assert(sql.includes("b->'budgetReservationRef' IS DISTINCT FROM original.snapshot_json->'binding'->'budgetReservationRef'"));assert(sql.includes("e->'context'->'authorizationReceiptRef' IS DISTINCT FROM auth_ref"));assert(sql.includes("NEW.state IS DISTINCT FROM 'HELD_SYNTHETIC_ONLY'"));assert(sql.includes('STOP_COMMAND_REVERSE_ATOMIC_REQUIRED'));assert(sql.includes('anvil.check_initial_execution_graph(NEW.project_id,NEW.created_command_id)'));assert(!/SECURITY DEFINER|GRANT .* TO anvil_v3_app/i.test(sql));
});
test('기존4SQL 지문과중지명령2trigger이외의초기graph·회수grant는보존한다(실제DDL PASS 아님)',async()=>{
 for(const [name,hash]of [['0017_execution_authority','40c8666fe6fb8f9d1d027d9f15d03e8a71f2b608887343e9a92b49c72220b1f3'],['0018_execution_observation','547debde0fa13f24401ddcf538a8a178147d5c9bcb60863b634a798b4bb896e5'],['0019_understanding_reviews','5ffc3ee4db2fc53614794e6f2d1f3cec81b48548e2237259307e5c17bae14008'],['0020_execution_recovery','a81c04227ecd0ef85fdb604c1e37085bd83afce6bebae39426c97dd16d22e918']])assert.equal(contentHash(await readFile(new URL('../../../db/migrations/'+name+'.sql',import.meta.url))),hash);
 assert.deepEqual(sql.match(/DROP TRIGGER[^;]+;/g),['DROP TRIGGER initial_execution_row_guard ON anvil.execution_commands;','DROP TRIGGER initial_execution_complete ON anvil.execution_commands;']);
});
