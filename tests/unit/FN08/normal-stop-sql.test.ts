import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../../../db/migrations/'+file,import.meta.url),'utf8');
const sql=()=>read('0098_normal_stop_target_page.sql.pending');
const fn=(s:string,name:string)=>{const m=s.match(new RegExp('CREATE (?:OR REPLACE )?FUNCTION anvil\\.'+name+'\\([\\s\\S]*?\\$\\$;'));assert(m,name);return m[0];};
test('0098은 CURRENT 부재를 닫고 원 synthetic·행/명령 역완결·append-only/한도를 보존한다',()=>{
 const s=sql();assert.match(s,/BEGIN;/);assert.match(s,/COMMIT;/);
 assert.doesNotMatch(s,/CREATE TABLE|CREATE ROLE|SECURITY DEFINER|GRANT (?:SELECT|INSERT|UPDATE|DELETE)|DROP (?:TRIGGER|CONSTRAINT|INDEX)/);
 const guard=fn(s,'check_stop_command');assert.match(guard,/check_stop_command_pre0098/);assert.match(guard,/NORMAL_STOP_CURRENT_NOT_CONNECTED/);assert.match(guard,/RETURN false/);
 for(const v of ['FOR UPDATE','requestedBy','humanSessionId','credentialGeneration','controlGeneration','authorization_receipts','audit_events','normal_start_material_complete','parentStartCommandRef','parentStartEnvelopeHash','ownershipRef','stopScopeRef','100','2097152'])assert(s.includes(v),v);
 for(const n of ['guard_execution_command_kind','guard_execution_command_complete','guard_stop_shared_complete','guard_stop_command_history'])assert(!s.includes('CREATE OR REPLACE FUNCTION anvil.'+n+'('),n+' original body');
 const original=read('0021_execution_stop.sql');assert.match(original,/STOP_COMMAND_REVERSE_ATOMIC_REQUIRED/);assert.match(original,/DEFERRABLE INITIALLY DEFERRED/);
});
test('STOP page만 material receipt 두필드 null이며 START/SEND 자료·최신 nonce검산과 제한은 보존한다',()=>{
 const s=sql(),page=fn(s,'normal_command_page_valid');assert.match(page,/REQUEST_STOP/);assert.match(page,/'materialsManifestRef',NULL,'materialsDescriptorHash',NULL/);
 for(const v of ['normal_material_graph','normal_start_material_descriptor','parts<=200','normal_request_credential','normal_exchange_current','normal_stop_graph'])assert(page.includes(v),v);
 assert.doesNotMatch(s,/CREATE (?:OR REPLACE )?FUNCTION anvil.normal_command_consumption_valid/);
 const rows=fn(s,'normal_command_page_rows');assert.match(rows,/NORMAL_STOP_STORED/);assert.match(rows,/requestExecutionStop/);assert.match(rows,/LIMIT 51/);assert.match(rows,/NORMAL_COMMAND_PAGE_SOURCE_INVALID/);
});
test('SQL은 target SHA256 관계만, UUIDv5는 Node 원 정본 최종검산이며 새 암호/확장/권한은 없다',()=>{
 const s=sql();assert.doesNotMatch(s,/public\.digest|CREATE EXTENSION|sha1|uuid_send/);assert.match(s,/anvil\.execution_json_hash\(t\)/);assert.match(s,/FROM PUBLIC/);assert.doesNotMatch(s,/TO PUBLIC|BYPASSRLS|DISABLE ROW LEVEL/);
 const graph=fn(s,'normal_stop_graph');assert.doesNotMatch(graph,/normal_initial_graph|normal_queue_authorized|current_setting|clock_timestamp/);
 const node=readFileSync(new URL('../../../apps/server/modules/executions/normal-command-pages.ts',import.meta.url),'utf8');assert.match(node,/readNormalStopRecord[\s\S]*parent\.commandId/);
});

test('기존 synthetic outbox 본문은 normal 선행거절 분기 외 그대로이며 원 check_stop 본문은 rename만 한다',()=>{
 const old=fn(read('0021_execution_stop.sql'),'guard_stop_outbox').replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
 const next=fn(sql(),'guard_stop_outbox'),begin=next.indexOf(' -- normal 분기는'),end=next.indexOf(" IF v->>'kind'='EXECUTION_STOP_SYNTHETIC_ONLY'",begin);
 assert(begin>0&&end>begin);assert.equal(next.slice(0,begin)+next.slice(end),old);
 assert.match(sql(),/ALTER FUNCTION anvil\.check_stop_command\(uuid,uuid,jsonb,boolean\) RENAME TO check_stop_command_pre0098;/);
 const guard=fn(sql(),'check_stop_command');assert.match(guard,/IS DISTINCT FROM 'NORMAL_PROTECTED' THEN RETURN anvil\.check_stop_command_pre0098\(pid,cid,row_json,require_outbox\)/);
});
