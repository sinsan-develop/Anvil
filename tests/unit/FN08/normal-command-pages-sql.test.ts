import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('페이지 원순번·원자적 결과와 이전 합성 guard가 유지된다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0087_normal_command_pages.sql.pending',import.meta.url),'utf8');
 for(const text of ['audit_events','server_sequence','created_command_id','authorization_receipts','delivery_outbox','item.audits<>1','item.outboxes<>1','NORMAL_COMMAND_PAGE','normal_request_credential','DEFERRABLE INITIALLY DEFERRED','guard_normal_credential_exchange','guard_synthetic_execution_receipt'])assert.ok(sql.includes(text),text);
 assert.doesNotMatch(sql,/anvil\.normal_initial_graph\s*\(/i);
 assert.doesNotMatch(sql,/DISABLE TRIGGER/i);
});
