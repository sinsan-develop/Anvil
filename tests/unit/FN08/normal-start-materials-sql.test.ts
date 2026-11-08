import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('0088은 normal START 자료의 nonce, 원 영수증, proof binding을 결박한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0088_normal_start_material_delivery.sql.pending',import.meta.url),'utf8');
 for(const s of ['normal_start_material_complete','NORMAL_START_MATERIAL','execution_material_proof_bindings','normal_request_credential','DEFERRABLE INITIALLY DEFERRED','guard_normal_command_page','guard_synthetic_execution_receipt'])assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/DISABLE TRIGGER/i);
});
