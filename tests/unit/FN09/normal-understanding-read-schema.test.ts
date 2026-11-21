import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../../../db/migrations/0102_normal_understanding_responses.sql.pending',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
test('FN09 original START queue/envelope retain the 0083 execution hash; new request C/A/U keep their own hash',async()=>{
 const original=await readFile(new URL('../../../db/migrations/0083_normal_initial_execution.sql.pending',import.meta.url),'utf8');
 assert.ok(original.includes('x.content_hash IS DISTINCT FROM anvil.execution_json_hash(q)'));
 assert.ok(original.includes("x.envelope_hash IS DISTINCT FROM anvil.execution_json_hash(env-'envelopeHash')"));
 assert.ok(sql.includes("x.content_hash IS DISTINCT FROM anvil.execution_json_hash(x.snapshot_json-'envelope')"));
 assert.ok(sql.includes("x.envelope_hash IS DISTINCT FROM anvil.execution_json_hash((x.snapshot_json->'envelope')-'envelopeHash')"));
 assert.equal((sql.match(/anvil\.execution_json_hash\(/g)??[]).length,2);
 for(const fragment of ['r.content_hash IS DISTINCT FROM anvil.fn01_hash(s)','c.request_hash IS DISTINCT FROM anvil.fn01_hash(q)','scope_hash=anvil.fn01_hash(',"ref->>'contentHash' IS DISTINCT FROM anvil.fn01_hash(snapshot)"])assert.ok(sql.includes(fragment));
});
test('FN09 request forward is a bounded metadata-only immutable pending ledger, not an output or dispatch table',()=>{
 assert.match(sql,/CREATE TABLE anvil\.normal_understanding_read_requests/);assert.match(sql,/sourceScope.*null/);assert.match(sql,/PENDING_SOURCE/);
 assert.match(sql,/octet_length.*8192/);assert.match(sql,/count\(\*\).*1000/s);assert.match(sql,/BEFORE UPDATE OR DELETE/);
 assert.doesNotMatch(sql,/GRANT .* ON anvil\.(execution_commands|execution_challenges|execution_observations|understanding_reviews)/);
});
test('FN09 request SQL rechecks original HUMAN/current policy and normal source instead of GUC/verified claims',()=>{
 assert.match(sql,/anvil\.fn01_active\(s,a,c\)/);assert.match(sql,/FOR UPDATE/);assert.match(sql,/normal_exchange_current/);assert.match(sql,/normal_start_material_complete/);
 assert.match(sql,/CONTEX[T]_REVIEW/);assert.match(sql,/disposition.*AUTO/s);assert.match(sql,/txid_current\(\)::text/);assert.doesNotMatch(sql,/set_config|get_setting|current_setting/);
});
test('FN09 request graph requires C/A/U in both directions and never grants public function execution',()=>{
 assert.match(sql,/authorization_receipts/);assert.match(sql,/audit_events/);assert.match(sql,/CREATE CONSTRAINT TRIGGER fn09_understanding_request_command_complete/);
 assert.match(sql,/DEFERRABLE INITIALLY DEFERRED/);assert.match(sql,/REVOKE ALL ON FUNCTION.*FROM PUBLIC/s);assert.match(sql,/REVOKE ALL ON anvil\.normal_understanding_read_requests FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/CREATE ROLE|GRANT .*execution_grants|INSERT INTO anvil\.delivery_outbox/);
 assert.doesNotMatch(sql,/GRANT SELECT ON anvil\.normal_understanding_read_requests|GRANT EXECUTE[^;]*request_complete/);
 assert.match(sql,/fn09_normal_understanding_request_replay\(s uuid,a uuid,c uuid,q jsonb,policy jsonb,expected_tx text\)/);
});
