import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../../../db/migrations/0095_native_worker_deployment.sql.pending',import.meta.url);
test('0095 source: 목적 owner/RLS/함수 경계와 append-only·회수 용량 예약을 보존한다',()=>{
 const sql=readFileSync(path,'utf8');
 for(const role of ['worker_owner','worker_publisher'])assert.match(sql,new RegExp('CREATE ROLE '+role+' NOLOGIN NOINHERIT NOBYPASSRLS'));
 for(const name of ['worker_deployment_bundles','worker_deployment_heads']){assert.ok(sql.includes('ALTER TABLE anvil.'+name+' FORCE ROW LEVEL SECURITY'));assert.ok(sql.includes('REVOKE ALL ON anvil.'+name+' FROM PUBLIC, anvil_v3_app, worker_publisher'));}
 for(const fn of ['worker_deployment_read','worker_deployment_publish','worker_deployment_revoke','worker_deployment_lookup'])assert.ok(sql.includes('FUNCTION anvil.'+fn+'('));
 assert.match(sql,/LOCK TABLE anvil\.worker_deployment_bundles IN EXCLUSIVE MODE/);
 assert.match(sql,/67108864/);assert.match(sql,/1000/);assert.match(sql,/8192/);
 assert.match(sql,/WORKER_APPEND_ONLY/);assert.match(sql,/READ COMMITTED|read committed/);
 assert.match(sql,/UNIQUE INDEX worker_factory_identity[\s\S]*factory_ref->>'id'[\s\S]*factory_ref->>'version'/);
 assert.doesNotMatch(sql,/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE|SELECT)\s+ON\s+anvil\.worker_deployment_(?:bundles|heads)\s+TO\s+(?:anvil_app|worker_publisher)/i);
});
