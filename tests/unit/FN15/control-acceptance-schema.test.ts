import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const sql=()=>readFile(new URL('../../../db/migrations/0073_control_handoff_acceptance.sql.pending',import.meta.url),'utf8');
test('0073 미적용 source는 FN15 전용 SELECT 역할/명시 RLS·fixed reader와 postflight를 닫는다',async()=>{
 const s=await sql();assert.match(s,/BEGIN;/);assert.match(s,/NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/);assert.match(s,/session_user<>'anvil_v3_app'/);assert.match(s,/fn01_active/);assert.match(s,/fn15_handoff_facts/);assert.match(s,/fn15_handoff_writer_command/);assert.match(s,/fn15_reader_postflight/);assert.doesNotMatch(s,/ALTER TABLE[^;]+DISABLE ROW LEVEL SECURITY/);assert.doesNotMatch(s,/GRANT[^;]+reader_owner TO anvil_v3_app/);
});
test('F complete는 legacy/실제새행/미생성예약/최초control anchor를 disjoint 검산한다',async()=>{
 const s=await sql();for(const name of ['fn15_storage_actual','fn15_storage_future','fn15_legacy_projection','fn15_storage_anchor','quota_complete_before_source','quota_adopt_creation','fn15_creation_anchor_guard'])assert.ok(s.includes(name),name);
 assert.match(s,/initial_manifest_json/);assert.match(s,/Factual/);assert.match(s,/Ffuture/);assert.match(s,/DEFERRABLE INITIALLY DEFERRED/);assert.match(s,/next_generation/);assert.match(s,/CONTROL_ACCEPTANCE_BASIS/);
});
