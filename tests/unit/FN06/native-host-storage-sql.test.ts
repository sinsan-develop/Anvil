import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../../../db/migrations/0094_native_host_storage_access.sql.pending',import.meta.url);
test('host material 목적 함수는 원 거래와 잠금·권위·current를 재검산하고 digest를 반환하지 않는다',()=>{
 const sql=readFileSync(path,'utf8');
 assert.match(sql,/CREATE FUNCTION anvil\.native_host_material\(authority_id uuid,digest text,purpose text,expected_tx text\)/);
 for(const token of ['txid_current()','read committed','FOR UPDATE','FOR UPDATE OF u,s,c','native_preparation_authority_complete','connector_basis_current','writerHeadRef','reauth_until'])assert(sql.includes(token),token);
 assert.match(sql,/to_jsonb\(n\)-'credential_digest'/);
 assert.match(sql,/OWNER TO anvil_v3_migrator/);assert.match(sql,/SET search_path=pg_catalog/);
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.fn94_host_scope/);
 assert.doesNotMatch(sql,/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE).*TO anvil_v3_app/i);
});
test('consume replay도 read 정책 없음·DENY·철회를 건너뛰지 않고 fresh prepare 조건만 분리한다',()=>{
 const sql=readFileSync(path,'utf8'),scope=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn94_host_scope'),sql.indexOf('ALTER FUNCTION anvil.fn94_host_scope'));
 const replay=scope.indexOf("purpose='CONSUME' AND EXISTS");assert(replay>0);
 assert(scope.indexOf('IF NOT read_allowed THEN')<replay&&scope.indexOf('IF NOT read_allowed THEN')>0);
 assert(scope.indexOf("rule->>'disposition'<>'AUTO'")<replay);
 assert(scope.indexOf('session_row.reauth_until IS NULL')>replay);
});
test('challenge와 consume은 닫힌 후보에서 event를 구성하고 일반 append/delivery를 노출하지 않는다',()=>{
 const sql=readFileSync(path,'utf8');
 for(const name of ['native_host_challenge','native_host_consume'])assert(sql.includes('CREATE FUNCTION anvil.'+name+'('));
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.fn94_native_event/);
 assert.match(sql,/REPLAY_ONLY/);assert.match(sql,/'factoryPermit',NULL/);
 assert.match(sql,/native_preparation_capacity/);assert.match(sql,/signatureDigest/);
});
test('ownership 두 목적은 원 consume에서 재구성하고 native INSERT만 원 graph guard와 함께 연다',()=>{
 const sql=readFileSync(path,'utf8');
 for(const name of ['native_host_ownership_request','native_host_ownership_accept'])assert(sql.includes('CREATE FUNCTION anvil.'+name+'('));
 for(const name of ['native_return_parent_valid','native_return_graph_valid','OWNERSHIP_AUTHORITY_NOT_ACTIVATED'])assert(sql.includes(name));
 assert.match(sql,/TG_OP<>'INSERT'/);assert.match(sql,/TG_TABLE_NAME NOT IN\('execution_ownership_events','execution_ownership_observations','execution_ownership_anchors','execution_ownership_heads'\)/);
 assert.match(sql,/created_transaction<>txid_current\(\)/);assert.doesNotMatch(sql,/DISABLE TRIGGER|GRANT.*ON anvil\.execution_ownership_bindings/i);
});
test('app COMMIT의 지연 링크 검산은 기존 본문 그대로 제한 definer 읽기를 사용한다',()=>{
 const sql=readFileSync(path,'utf8');
 assert.match(sql,/ALTER FUNCTION anvil\.ownership_observation_links_guard\(\) SECURITY DEFINER/);
 assert.match(sql,/ALTER FUNCTION anvil\.ownership_observation_links_guard\(\) SET search_path=pg_catalog/);
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.ownership_observation_links_guard\(\) FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION anvil\.ownership_observation_links_guard/);
 for(const setting of ['SECURITY DEFINER','SET search_path=pg_catalog','OWNER TO anvil_v3_migrator'])assert(sql.includes('ALTER FUNCTION anvil.ownership_anchor_links_guard() '+setting));
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.ownership_anchor_links_guard\(\) FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION anvil\.ownership_anchor_links_guard/);
});
