import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const file=new URL('../../../db/migrations/0084_normal_exchange_challenge.sql.pending',import.meta.url);
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
