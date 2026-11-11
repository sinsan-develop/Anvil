import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('0088은 원 START 등록 행으로만 자료 발견 descriptor와 페이지 영수증을 결박한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0088_normal_start_material_delivery.sql.pending',import.meta.url),'utf8');
 for(const s of ['normal_start_material_rows','normal_start_material_descriptor','normal_start_material_complete','materialDiscoveryVersion',
  'materialsManifestRef','materialsDescriptorHash','NORMAL_START_MATERIAL_SOURCE_INVALID','normal_request_credential','normal_exchange_current','parts<=200',
  'CREATE OR REPLACE FUNCTION anvil.normal_command_page_valid'])assert.ok(sql.includes(s),s);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|DROP TABLE|UPDATE anvil\.execution_receipts/i);
 assert.doesNotMatch(sql,/\r/);
});
