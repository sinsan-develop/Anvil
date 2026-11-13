import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
test('normal native source는 소유 host closure와 별도 슬롯을 사용하고 일반 SIGN_PROOF를 확대하지 않는다',()=>{
 const s=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8');
 for(const guard of ['NORMAL_EXECUTION_BOOTSTRAP','NORMAL_EXECUTION_CALL','NORMAL_EXECUTION_READ','FileMode.CreateNew','NORMAL_EXECUTION_SLOT_V1','EXECUTION_CREDENTIAL_EXCHANGE','EXECUTION_CHALLENGE_REQUEST','EXECUTION_REQUEST_PROOF','2812587','48000'])assert.ok(s.includes(guard),guard);
 assert.equal(s.includes('grantSnapshot'),false);
 assert.ok(s.includes('var bootstrap=Map(challenge["bootstrapBinding"]);CheckBootstrap(record,scope,c,bootstrap);'));
 assert.ok(s.includes('J(b["registrationRef"])!=J(registration["registrationRef"])'));
 assert.ok(s.includes('S(b,"publicKeyFingerprint")!=S(key,"fingerprint")'));
 assert.ok(s.includes('At(b,"expiresAt")>At(challenge,"expiresAt")'));
 const host=readFileSync(new URL('apps/connector/native/DesktopTrustKeyHostSource.cs',root),'utf8');
 assert.ok(host.includes('normalExecution.Dispatch'));
 assert.ok(host.includes('new[]{"PROOF_PENDING","ISSUE_PENDING"}'));
 const store=readFileSync(new URL('apps/connector/native/ProtectedStore.cs',root),'utf8');assert.ok(store.includes('av3ct1_'));
 const build=readFileSync(new URL('apps/desktop/scripts/desktop-trust-key-host-build.cjs',root),'utf8');assert.ok(build.includes('NormalExecutionCredentialSource.cs'));
});
