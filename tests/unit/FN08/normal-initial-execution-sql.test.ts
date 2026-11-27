import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

test('normal 원자료 부모 forward는 기존 실행 PK/원 hash를 재사용하고 새 저장·공개 형상 없이 기존 app의 부모 boolean 조회만 연다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0111_normal_start_origin_parent.sql.pending',import.meta.url),'utf8');
 assert.ok(sql.trim().startsWith('-- FN08:'));
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;\s*$/);
 assert.equal((sql.match(/^COMMIT;/gm)??[]).length,1);
 assert.doesNotMatch(sql,/CREATE TABLE|DISABLE TRIGGER|ALTER FUNCTION.*RENAME|CREATE (?:OR REPLACE )?FUNCTION anvil\.guard_normal_outbox/);
 for(const token of ['fn111_normal_parent','normal_start_origin_parent_complete','DEFERRABLE INITIALLY DEFERRED',"'originRef','reservationRef'",'FOR SHARE','own_command IS NULL OR e.command_id IS DISTINCT FROM own_command',"'RESERVED_NOT_ISSUED'",'fn09_execution_start_origin_complete(p)','fn09_execution_start_origin_source(p,v,fresh)','CREATE OR REPLACE FUNCTION anvil.fn105_current'])assert.ok(sql.includes(token),token);
 assert.ok(!sql.includes("v->'observedPolicyRef' IS DISTINCT FROM q#>'{payload,permissionPolicyRef}'"));
 assert.deepEqual(sql.match(/^GRANT .*$/gm),['GRANT EXECUTE ON FUNCTION anvil.fn111_normal_start_parent_current(uuid,uuid,uuid,uuid,jsonb,text) TO anvil_v3_app;']);
 assert.ok(sql.includes('FOR SHARE OF auth,u,cl'));assert.ok(sql.includes('FOR UPDATE OF pr FOR SHARE OF m,pc'));
 assert.ok(sql.includes("cmd.xmin=pg_current_xact_id()::xid"));
 assert.ok(sql.includes("prior.snapshot_json#>>'{request,payload,executionId}'=o.execution_id::text"));
 assert.ok(sql.includes("prior.snapshot_json->>'requestHash' IS DISTINCT FROM anvil.execution_json_hash(q)"));
 assert.ok(sql.includes("least((o.snapshot_json->>'expiresAt')::timestamptz,(o.reservation_json->>'expiresAt')::timestamptz)"));
 for(const name of ['normal_initial_graph','normal_start_material_complete']){
  const start=sql.indexOf('CREATE OR REPLACE FUNCTION anvil.'+name+'('),open=sql.indexOf('$$',start),end=sql.indexOf('$$;',open+2),fn=sql.slice(start,end);
  assert.ok(start>=0&&end>open);
  assert.match(fn,/IF c\.request_hash IS DISTINCT FROM anvil\.execution_json_hash\(request\) THEN[\s\S]*jsonb_set\(request,'\{payload,originParent\}'/);
  assert.match(fn,/origin\.credential_id::text=f#>>'\{executionCredentialReservation,id\}'/);
  assert.match(fn,/sr\.phase='SETTLED'[\s\S]*sr\.part_kind='EXECUTION_START_ORIGIN'/);
 }
 const schema=readFileSync(new URL('../../../db/migrations/0017_execution_authority.sql',import.meta.url),'utf8');
 assert.match(schema,/PRIMARY KEY\(project_id,id,generation\),UNIQUE\(project_id,command_id\)/);
 const origin=readFileSync(new URL('../../../db/migrations/0081_execution_start_origins.sql.pending',import.meta.url),'utf8');
 assert.match(origin,/execution_id uuid NOT NULL UNIQUE/);
});

test('normal 초기 graph와 START 자료는 새 forward에서 기존 0082 경로와 분리한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0083_normal_initial_execution.sql.pending',import.meta.url),'utf8');
 for(const fn of ['normal_queue_authorized','normal_initial_graph','normal_start_material_complete'])
   assert.match(sql,new RegExp('FUNCTION anvil\\.'+fn+'\\('));
 assert.doesNotMatch(sql,/DISABLE TRIGGER|SECURITY DEFINER|GRANT (INSERT|UPDATE|DELETE)/i);
 for(const name of ['execution_queue_authorized','check_initial_execution_graph','material_registration_complete','material_descriptor_valid']){
   assert.match(sql,new RegExp('ELSE anvil\\.'+name+'_pre0083\\('),name);
 }
 assert.match(sql,/BEFORE INSERT OR UPDATE OR DELETE ON anvil\.delivery_outbox[\s\S]*EXECUTE FUNCTION anvil\.guard_normal_outbox\(\)/);
 assert.match(sql,/OLD\.kind='EXECUTION_NORMAL'[\s\S]+NEW\.kind='EXECUTION_NORMAL'[\s\S]+normal_queue_authorized\(NEW\.project_id,NEW\.command_id\)/);
});

test('normal grant는 같은 명령에서 별도 실행 credential 예약 1개와 자료 세대를 검산한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0083_normal_initial_execution.sql.pending',import.meta.url),'utf8');
 assert.match(sql,/CREATE FUNCTION anvil\.normal_credential_reservation_valid\(/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION anvil\.guard_synthetic_credential_reservation\(\)[\s\S]+SYNTHETIC_CREDENTIAL_EXACT_CURRENT_GRANT_REQUIRED/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION anvil\.guard_execution_challenge_complete\(\)[\s\S]+SYNTHETIC_CREDENTIAL_CHALLENGE_REQUIRED/);
 assert.match(sql,/f->'executionCredentialReservation'->'generation'/);
 assert.doesNotMatch(sql,/sc->'credentialGeneration' IS DISTINCT FROM f->'subject'->'credentialGeneration'/);
 assert.match(sql,/NOT anvil\.normal_credential_reservation_valid\(pid,g\.id,g\.version\)/);
});


test('linked WORK forward는 정착 선택·새 실행 ID·현재 head와 원 START 역사 목적을 분리한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0104_normal_work_start_understanding.sql.pending',import.meta.url),'utf8');
 for(const name of ['fn09_work_start_identity','fn09_work_start_authority','fn09_work_start_basis','fn09_work_start_replay','fn09_work_start_fact_current','fn09_work_start_grant_guard','fn09_work_start_grant_complete','fn09_work_start_permit_guard'])assert.ok(sql.includes('FUNCTION anvil.'+name+'('),name);
 for(const token of ['fn09_work_prepare_current_source','fn09_registered_prepare_reservation_complete','normal_start_material_complete','WORK_START_BASIS','WORK_START_REPLAY','DEFERRABLE INITIALLY DEFERRED','FOR SHARE OF auth,u,cl','FOR UPDATE OF p'])assert.ok(sql.includes(token),token);
 assert.ok(!/fn01_active|GRANT\s|DISABLE TRIGGER|DROP TRIGGER|CREATE TABLE/i.test(sql));
 assert.ok(sql.includes("basis#>>'{scope,executionId}'=eid::text"));assert.ok(sql.includes("f->'understandingReviewRef' IS DISTINCT FROM basis->'reviewRef'"));assert.ok(sql.includes("'budgetPolicyRef',f#>'{intent,budgetPolicyRef}'"));assert.ok(!sql.includes("'budgetPolicyRef',f->'budgetPolicyRef'"));
 const history=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn09_work_start_replay('),sql.indexOf('CREATE FUNCTION anvil.fn09_work_start_fact_current('));
 assert.ok(!/current_source|normal_initial_graph/.test(history));assert.ok(history.includes('normal_start_material_complete'));
 const metadata=readFileSync(new URL('../../../db/migrations/0102_normal_understanding_responses.sql.pending',import.meta.url),'utf8');assert.ok(metadata.includes("selection->>'purpose'='WORK_START_BASIS'"));assert.ok(metadata.includes("selection->>'purpose'='WORK_START_REPLAY'"));
});

test('linked WORK의 부모 포함 원 hash를 authority와 grant·permit이 같은 부모로 검산한다',()=>{
 const file=new URL('../../../db/migrations/0112_normal_work_start_origin_parent.sql.pending',import.meta.url);
 assert.ok(existsSync(file),'0111의 originParent를 WORK authority와 fact_current에 연결하는 forward가 필요하다');
 const sql=readFileSync(file,'utf8');
 const previous=readFileSync(new URL('../../../db/migrations/0104_normal_work_start_understanding.sql.pending',import.meta.url),'utf8');
 const functionBody=(source:string,name:string)=>{
  const start=source.indexOf(`FUNCTION anvil.${name}(`),open=source.indexOf('$$',start),end=source.indexOf('$$;',open+2);
  assert(start>=0&&end>open,name);
  return source.slice(start,end);
 };
 assert.match(sql,/^BEGIN;[\s\S]*^COMMIT;\s*$/m);
 assert.equal((sql.match(/^COMMIT;/gm)??[]).length,1);
 assert.deepEqual([...sql.matchAll(/^CREATE OR REPLACE FUNCTION anvil\.(\w+)/gm)].map(m=>m[1]),['fn09_work_start_authority','fn09_work_start_fact_current']);
 assert.doesNotMatch(sql,/^GRANT\s|^CREATE (?:CONSTRAINT )?TRIGGER|^CREATE TABLE|^DROP|EXECUTE format\(/im);
 const authority=functionBody(sql,'fn09_work_start_authority');
 assert.match(authority,/execution_json_shape\(q->'payload',ARRAY\['operation','executionId','executionGeneration','preparationRef','permissionPolicyRef','budgetPolicyRef','payload','originParent'\]\)/);
 assert.match(authority,/IF has_parent THEN[\s\S]*fn111_normal_parent\(p,q,a,c,s,false,NULL\)[\s\S]*ELSE[\s\S]*cmd\.command_id=\(q->>'commandId'\)::uuid[\s\S]*cmd\.request_hash=anvil\.execution_json_hash\(q\)[\s\S]*normal_start_material_complete\(p,stored_command\)/);
 const locks=['FOR SHARE OF auth,u,cl','FOR UPDATE OF p FOR SHARE OF m,pc','FOR SHARE OF h','fn111_normal_parent(p,q,a,c,s,false,NULL)'].map(part=>authority.indexOf(part));
 assert(locks[0]!>=0&&locks.every((at,n)=>n===0||locks[n-1]!<at),'현재 auth·project·policy 잠금 뒤에만 부모 원행을 잠근다');
 const fact=functionBody(sql,'fn09_work_start_fact_current');
 assert.match(fact,/IF h\.request_hash IS DISTINCT FROM anvil\.execution_json_hash\(q\) THEN[\s\S]*FROM anvil\.execution_start_origins[\s\S]*project_id=p[\s\S]*execution_id=\(q#>>'\{payload,executionId\}'\)::uuid[\s\S]*execution_generation=\(q#>>'\{payload,executionGeneration\}'\)::bigint[\s\S]*preparationRef[\s\S]*jsonb_set\(q,'\{payload,originParent\}',parent\)/);
 assert.match(fact,/h\.request_hash IS DISTINCT FROM anvil\.execution_json_hash\(q\)[\s\S]*ends=anvil\.fn09_work_start_authority\(/);
 assert.match(fact,/basis=anvil\.fn09_work_prepare_current_source\([\s\S]*ends>clock_timestamp\(\)/);
 assert.doesNotMatch(fact,/fn111_normal_parent|FOR SHARE OF o|FROM anvil\.execution_start_origins[^;]*FOR (?:SHARE|UPDATE)/);
 for(const name of ['fn09_work_start_authority','fn09_work_start_fact_current']){
  assert.match(functionBody(sql,name),/SECURITY DEFINER SET search_path=pg_catalog/);
  for(const line of previous.split(/\r?\n/).filter(line=>line.startsWith(`ALTER FUNCTION anvil.${name}(`)||line.startsWith(`REVOKE ALL ON FUNCTION anvil.${name}(`)))assert.ok(sql.includes(line),line);
 }
 assert.match(previous,/fn09_work_start_replay\([\s\S]*ends=anvil\.fn09_work_start_authority\(/);
 assert.match(previous,/fn09_work_start_permit_guard\([\s\S]*fn09_work_start_fact_current\(/);
});
