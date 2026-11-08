import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('0086은 원 발급·소비 v2·예약 v1을 결박하고 기존 분기의 guard를 보존한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0086_normal_request_challenge.sql.pending',import.meta.url),'utf8');
 for(const fragment of ['NORMAL_CREDENTIAL_ISSUED','EXECUTION_DISPATCH_ONLY','normal_credential_reservation_valid','normal_exchange_current',
  'EXECUTION_REQUEST','EXECUTION_CHALLENGE_REQUEST','interval \'30 seconds\'','interval \'1 minute\'','10000','60',
  'normal_request_challenge_complete','DEFERRABLE INITIALLY DEFERRED','guard_normal_exchange_issue()','clock_timestamp()'])
  assert.ok(sql.includes(fragment),fragment);
 assert.doesNotMatch(sql,/DISABLE\s+TRIGGER|SECURITY\s+DEFINER|DROP\s+TABLE|UPDATE\s+anvil\.execution_credentials\s+SET/i);
});
