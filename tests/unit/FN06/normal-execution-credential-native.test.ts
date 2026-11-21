import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);

test('FIRST SID는 exact private 인계에서만 원 scope의 canonical 문자열 SHA와 대조하고 실행 권위를 발급하지 않는다',()=>{
 const s=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8');
 const first=s.slice(s.indexOf('FirstInspection InspectFirstSource('),s.indexOf('Dictionary<string,object> SdkEnvelope('));
 assert.match(first,/Exact\(h,"startEnvelope,sendEnvelope,grantRef,startReadyRef,localAttemptRef,dispatchAttemptRef,permit,proofResultRef,scope,executionAuthority,plannedSid"\)/);
 assert.match(first,/string plannedSid=S\(h,"plannedSid"\)/);
 assert.match(first,/plannedSid.Length<1\|\|plannedSid.Length>512\|\|plannedSid.Any\(c=>c<32\|\|c==127\)/);
 assert.match(first,/H\(plannedSid\)!=S\(request.Scope,"plannedSidDigest"\)/);
 assert(first.indexOf('H(plannedSid)')<first.indexOf('ReadSdkFirstAttempt('));
 assert.match(first,/J\(h\["scope"\]\)!=J\(request.Scope\)/);
 assert.match(first,/expectedScope=new Dictionary<string,object>\(Map\(slot\["scope"\]\)\)/);
 assert.match(first,/Check\(\);if\(expires<=clock\(\)\)throw Invalid\(\)/);
 assert.doesNotMatch(first,/claudeQueryParams|MAX_BUDGET_USD|Write|Append|Console|CreateProcess|new NormalSdkChildHostSource/);
 assert.match(s,/void ClearFirst\(\)\{if\(firstBytes!=null\)Array.Clear\(firstBytes,0,firstBytes.Length\);firstBytes=null;/);
 assert.match(s,/return new Dictionary<string,object>\{\{"state","SDK_CONFIGURATION_UNAVAILABLE"\}\}/);
 const spool=readFileSync(new URL('apps/connector/runtime/normal-owned-spool-profile.ts',root),'utf8');
 assert.match(spool,/finished=true;bytes.fill\(0\)/);
 const source=readFileSync(new URL('apps/connector/runtime/normal-first-send-owner.ts',root),'utf8');
 assert.match(source,/firstPermitHandoffs.delete\(request\)/);
 assert.match(source,/pending.finally\(\(\)=>firstPermitHandoffs.delete\(request\)\)/);
});
test('갱신 native source는 결정적 marker와 receipt 슬롯을 연결하고 만료 예외를 갱신 검산에 한정한다',()=>{
 const s=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8');
 for(const literal of ['NORMAL_EXECUTION_RENEW','RenewalMarker','previousSlotRef','ReadSlotChain','LoadSlot(Id(previous,"slotId"),record,true)',
  'slotId=Id(Map(answer["receiptRef"]),"id")','FileMode.CreateNew'])assert.ok(s.includes(literal),literal);
 assert.ok(s.indexOf('"exchange",B(marker)')<s.indexOf('var challenge=Challenge'));
 assert.ok(s.includes('LoadSlot(Id(h,"slotId"),record)'));
 assert.doesNotMatch(s,/FileMode\.(?:Create|Truncate)\b|File\.Delete/);
});
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

test('FN09 native Target은 TS와 같은 목적 literal/UUID·빈 query 및 기존 body hash/상한을 유지한다',()=>{
 const s=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8'),target=s.slice(s.indexOf('Dictionary<string,object> Target('),s.indexOf(' object Call('));
 assert.ok(target.includes('path==basePath+"/understanding-response-read"'));
 assert.ok(target.includes('parts.Length==4&&parts[1]=="understanding-response-read"&&parts[3]=="result"'));
 assert.ok(target.includes('[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}'));
 assert.ok(target.includes('path!=basePath+"/commands"'));assert.ok(target.includes('(method=="GET"&&body!=null)'));assert.ok(target.includes('(body==null||query!="")'));
 assert.ok(target.includes('H(Parse(Encoding.UTF8.GetBytes(body)))'));assert.ok(s.includes('2097152'));
 assert.ok(s.indexOf('target=Target(scope,r,body)')<s.indexOf('var reply=Challenge(record,scope,request,S(slot,"credential")'));
});
