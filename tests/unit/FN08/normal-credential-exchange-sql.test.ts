import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('0085는 예약 v1과 기존 synthetic guard를 보존하고 소비 v2와 발급 영수증을 양방향으로 강제한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0085_normal_credential_exchange.sql.pending',import.meta.url),'utf8');
 for(const invariant of ['normal_credential_reservation_valid','normal_exchange_current','NORMAL_CREDENTIAL_ISSUED','EXECUTION_DISPATCH_ONLY',
  'CREATE UNIQUE INDEX','DEFERRABLE INITIALLY DEFERRED','normal_credential_consumption_complete','normal_credential_receipt_complete',
  'guard_synthetic_execution_receipt()','guard_normal_exchange_issue()','guard_execution_challenge_complete()',
  'interval \'15 minutes\'','clock_timestamp()','storageEvidenceRefs','tokenDigest','execution_json_hash'])assert.ok(sql.includes(invariant),invariant);
 assert.doesNotMatch(sql,/UPDATE\s+anvil\.execution_credentials\s+SET|DROP\s+TABLE|DISABLE\s+TRIGGER|SECURITY\s+DEFINER/i);
});
