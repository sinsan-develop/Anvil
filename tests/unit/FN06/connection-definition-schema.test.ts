import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const migration=new URL('../../../db/migrations/0065_connection_definitions.sql.pending',import.meta.url);
// source SQL을 읽는 정적 준비검사이며 실제 PG/DDL 실행이 아니다.
test('미적용0065에는 정의head/불변버전과 기존원장 결합한도 guard가 준비된다',()=>{
 assert(existsSync(migration),'0065 source migration 부재 — 준비 RED');const sql=readFileSync(migration,'utf8');assert.match(sql,/CREATE TABLE anvil\.agent_connections/);assert.match(sql,/project_storage_accounts/);assert.match(sql,/DEFERRABLE INITIALLY DEFERRED/);
});

test('0065는 감사1행과 exact receipt/원command proof를 deferred 양방향 검사에 실제 연결한다',()=>{
 const sql=readFileSync(migration,'utf8'),proof=sql.slice(sql.indexOf('CREATE FUNCTION anvil.connection_definition_proof'),sql.indexOf('CREATE FUNCTION anvil.connection_definition_capacity'));
 for(const token of ["count(*) FROM anvil.audit_events","e.command_id=c.id","e.operation_id=c.operation_id","e.scope_digest=ar.scope_digest","e.actor_ref=jsonb_build_object","e.client_ref=v.client_id","e.target_ref=c.result_ref","e.policy_ref=c.policy_ref","e.approval_ref IS NOT DISTINCT FROM","e.outcome='APPLIED'","e.source_kind='HUMAN_COMMAND'"])assert(proof.includes(token),token);
 assert(sql.includes('OR NOT anvil.connection_definition_proof(v)'));for(const table of ['audit_events','authorization_receipts','project_storage_accounts','project_storage_reservations'])assert(new RegExp('AFTER INSERT OR UPDATE OR DELETE ON anvil\\.'+table+' DEFERRABLE INITIALLY DEFERRED').test(sql),table);
 assert(sql.includes("TG_TABLE_NAME='authorization_receipts'"));assert(sql.includes('p=COALESCE(NEW.scope_id,OLD.scope_id)'));assert(!sql.includes('GRANT UPDATE'));assert(sql.includes("IF NOT EXISTS(SELECT 1 FROM anvil.agent_connections WHERE project_id=p) THEN RETURN"));
});
test('합산 저장량 모델은 미확인/상반합계와 미래예약 초과를 닫고 정의없는 프로젝트는 기존검사에 위임한다',()=>{
 const sql=readFileSync(migration,'utf8');for(const token of ["ac.coverage_state<>'VERIFIED'","anvil.quota_complete(p)",'ac.used_bytes+ac.held_bytes+b>10737418240','h>1000','n>10000','b>67108864',"octet_length(convert_to(v.canonical_json,'UTF8'))"])assert(sql.includes(token),token);
 // 수치 분류 모델이며 PostgreSQL trigger/role/경합 실행 증거는 아니다.
 const allowed=(definitionBytes:bigint,used:bigint,held:bigint,verified:boolean)=>verified&&definitionBytes<=67108864n&&definitionBytes+used+held<=10737418240n;
 assert(allowed(64n,10737418176n,0n,true));assert(!allowed(64n,10737418176n,1n,true));assert(!allowed(64n,0n,0n,false));assert(!allowed(67108865n,0n,0n,true));
});

test('I3 AUTO 감사의 실제 SQL NULL은 request JSON null과 정규화해 대조하고 누락/위조는 거절한다',()=>{
 const sql=readFileSync(migration,'utf8');assert(sql.includes("e.approval_ref IS NOT DISTINCT FROM CASE WHEN v.request_json->'approvalRef'='null'::jsonb THEN NULL ELSE v.request_json->'approvalRef' END"),'AUTO SQL NULL/JSON null exact 정규화');assert(sql.includes("v.request_json ? 'approvalRef'"),'missing은 null로 치환하지 않는다');
 const matches=(request:any,audit:any)=>Object.hasOwn(request,'approvalRef')&&JSON.stringify(request.approvalRef===null?null:request.approvalRef)===JSON.stringify(audit);const ref={requestId:'request',decisionId:'decision',scopeDigest:'a'.repeat(64)};assert(matches({approvalRef:null},null));assert(matches({approvalRef:ref},ref));assert(!matches({},null));assert(!matches({approvalRef:ref},null));assert(!matches({approvalRef:null},ref));assert(!matches({approvalRef:ref},{...ref,decisionId:'다른 결정'}));
});
