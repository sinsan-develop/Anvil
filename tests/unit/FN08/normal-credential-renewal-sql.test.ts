import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('0091은 원 guard를 보존하고 grant 직렬화·비중첩을 BEFORE/지연 검산한다',()=>{
 const s=readFileSync(new URL('../../../db/migrations/0091_normal_credential_reexchange.sql.pending',import.meta.url),'utf8');
 for(const text of ['DROP INDEX anvil.normal_credential_issued_once','FOR UPDATE','NEW.id','TG_WHEN','expiresAt','issuedAt','DEFERRABLE INITIALLY DEFERRED','NORMAL_CREDENTIAL_INTERVAL_CONFLICT','REVOKE ALL','anvil_v3_app'])assert.ok(s.includes(text),text);
 assert.doesNotMatch(s,/DROP\s+(?:TABLE|TRIGGER)|DROP INDEX anvil.normal_credential_digest_once|UPDATE\s+anvil\.|DELETE\s+FROM|DISABLE\s+TRIGGER|SECURITY\s+DEFINER|ALTER\s+FUNCTION.*OWNER/i);
 assert.ok(s.indexOf('anvil.projects')<s.indexOf('anvil.execution_grants'));
 assert.ok(s.includes("current_setting('transaction_isolation') IS DISTINCT FROM 'read committed'"));
});
