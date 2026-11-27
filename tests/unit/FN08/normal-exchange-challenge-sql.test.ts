import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const file=new URL('../../../db/migrations/0084_normal_exchange_challenge.sql.pending',import.meta.url);
const parentForward=new URL('../../../db/migrations/0113_normal_exchange_origin_parent.sql.pending',import.meta.url);
test('normal 발급 SQL은 예약과 현재 권위를 읽고 기존 synthetic 즉시·지연 guard를 유지한다',()=>{
 assert.ok(existsSync(file),'0084 normal 발급 guard 필요');
 const sql=readFileSync(file,'utf8');
 for(const pattern of [/normal_credential_reservation_valid\(pid,gid,ver\)/,/normal_exchange_current\(n.project_id/,/NEW::anvil.execution_challenges,TG_WHEN='AFTER'/,
  /IS DISTINCT FROM 'NORMAL_PROTECTED'\) EXECUTE FUNCTION anvil.guard_execution_challenge\(\)/,
  /IS DISTINCT FROM 'NORMAL_PROTECTED'\) EXECUTE FUNCTION anvil.guard_execution_challenge_complete\(\)/,
  /c\.policy_ref|command\.policy_ref/,/authorization_receipts/,/x.envelope_hash/,/agent_sessions/,/assignment_versions/,/execution_grant_revocations/,
  /normal_challenge_verified/,/execution_policy_deadline/,/FOR UPDATE OF p/,/ct<10000 AND recent<5/,/interval '1 minute'/,
  /serverNonceDigest/,/signedInputHash/,/cur.binding IS DISTINCT FROM b/])assert.match(sql,pattern);
 assert.doesNotMatch(sql,/DISABLE TRIGGER|GRANT (?:ALL|INSERT|UPDATE)|SECURITY DEFINER/i);
});

test('최초 normal 교환은 원 정착 명령의 구형 해시 또는 정확한 부모 포함 해시만 인정한다',()=>{
 const original=readFileSync(file,'utf8');
 assert.ok(existsSync(parentForward),'부모 포함 START를 재검산하는 교환 SQL 필요');
 const sql=readFileSync(parentForward,'utf8').replace(/\r\n/g,'\n');
 const previous=original.replace(/\r\n/g,'\n');
 assert.match(sql,/CREATE OR REPLACE FUNCTION anvil\.normal_exchange_current\(pid uuid, connector uuid, eid uuid, gid uuid, ver bigint, gh text, credential_gen bigint\)/);
 assert.match(sql,/IF c\.request_hash IS DISTINCT FROM anvil\.execution_json_hash\(request\) THEN\s+SELECT \* INTO origin FROM anvil\.execution_start_origins WHERE project_id=pid AND execution_id=eid AND execution_generation=g\.generation;/);
 for(const comparison of [
  "origin.snapshot_json->'preparationRef' IS DISTINCT FROM f->'preparationRef'",
  "origin.snapshot_json->'contextBundleRef' IS DISTINCT FROM f#>'{intent,contextBundleRef}'",
  "origin.snapshot_json->'budgetPolicyRef' IS DISTINCT FROM f#>'{intent,budgetPolicyRef}'",
  "origin.snapshot_json->'subject' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id,",
  "'humanSessionId',f#>'{subject,humanSessionId}','credentialGeneration',f#>'{subject,credentialGeneration}','controlGeneration',c.control_generation)",
  'origin.content_hash IS DISTINCT FROM anvil.execution_json_hash(origin.snapshot_json)',
  'origin.reservation_hash IS DISTINCT FROM anvil.execution_json_hash(origin.reservation_json)',
  "origin.reservation_json->'originRef' IS DISTINCT FROM parent->'originRef'",
  "origin.credential_id::text IS NOT DISTINCT FROM f#>>'{executionCredentialReservation,id}'",
  "'reservationRef',jsonb_build_object('id',origin.credential_id,'version',1,'contentHash',origin.reservation_hash)",
  "request=jsonb_set(request,'{payload,originParent}',parent);",
  'IF c.request_hash IS DISTINCT FROM anvil.execution_json_hash(request) THEN RETURN;END IF;',
 ])assert.ok(sql.includes(comparison),comparison);
 const start=previous.indexOf(' SELECT w.expires_at');
 const end=previous.indexOf('CREATE FUNCTION anvil.normal_exchange_issue_valid');
 assert.ok(start>=0&&end>start);
 assert.ok(sql.includes(previous.slice(start,end).trimEnd()),'writer/역할/등록/정책/credential/예산/응답과 기한은 기존 함수와 동일');
 assert.doesNotMatch(sql,/SECURITY DEFINER|\b(?:GRANT|REVOKE|TRIGGER)\b|project_storage_reservations|normal_start_material_complete|fn111_normal_parent/i);
});
