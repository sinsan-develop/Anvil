import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
const migration=new URL('../../../db/migrations/0022_execution_grant_revocation.sql',import.meta.url);
test('회수 forward 후보는 별도 불변 ledger·정확 HUMAN 검증·역방향 COMMIT guard를 정의한다 (정적 계약만)',async()=>{
 const sql=await readFile(migration,'utf8');
 for(const text of ['CREATE TABLE anvil.execution_grant_revocations','UNIQUE(project_id,grant_id,grant_version)','check_execution_grant_revocation','grant_revocation_policy_deadline','GRANT_REVOCATION_REVERSE_ATOMIC_REQUIRED','DEFERRABLE INITIALLY DEFERRED','GRANT_REVOCATION_HISTORY_IMMUTABLE'])assert(sql.includes(text),text);
 assert(!/\b(?:DROP TABLE|TRUNCATE|DISABLE TRIGGER)\b/i.test(sql));
 assert(!/UPDATE anvil\.(?:execution_grants|writer_claims|execution_acknowledgements|execution_credentials)/i.test(sql));
});
test('새 전달 current/deadline은 자기 명령 예외 없이 회수 ledger를 검사하고 6종 INSERT를 보호한다 (정적 계약만)',async()=>{
 const sql=await readFile(migration,'utf8'),deadline=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION anvil.synthetic_grant_deadline'));
 assert(deadline.includes('execution_grant_revocations'));assert(!deadline.includes('created_command_id IS DISTINCT FROM'));assert(sql.includes('EXECUTION_GRANT_REVOKED'));
 for(const table of ['execution_credentials','execution_challenges','execution_receipts','execution_commands','execution_observations','execution_acknowledgements'])assert(sql.includes(`BEFORE INSERT ON anvil.${table}`),table);
});
