import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);

test('고정 범위 native는 원 영수증을 전용 pickup에만 결박하고 SELECT·결과 권위를 만들지 않는다',()=>{
 const s=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8');
 for(const name of ['UNDERSTANDING_RANGE_PREPARE','UNDERSTANDING_RANGE_REQUEST','ValidateUnderstandingRangeAcquisition','NORMAL_UNDERSTANDING_RANGE_ACQUIRED','NORMAL_UNDERSTANDING_RANGE_DENIED','NORMAL_UNDERSTANDING_RANGE_EXPIRED'])assert.ok(s.includes(name),name);
 const range=s.slice(s.indexOf(' void ValidateUnderstandingRangeAcquisition('),s.indexOf(' void LoadUnderstandingCa('));
 assert.match(range,/rangeRequestRef/);assert.match(range,/registrationRef/);assert.match(range,/credentialRef/);assert.match(range,/packetHash/);assert.match(range,/lastSequence/);
 assert.match(range,/totalBytes\+=N\(row\["textBytes"\]\)\)>2097152/);
 assert.ok(s.includes('budget-elapsed.Elapsed.TotalMilliseconds'));assert.ok(s.includes('range?(DateTime?)end:null'));
 const pickup='spoolProfile.BindUnderstandingRangePickup(record,slot,requested,reference,context,selection,At(receipt,"observedAt"),At(receipt,"expiresAt"));';
 assert.equal(range.split(pickup).length,2);
 assert.match(range,/new\[\]\{"sourceAvailable","selectionAvailable","executionAuthorized","dispatchPerformed"\}\)if\(!Object\.Equals\(answer\[k\],false\)\)throw Invalid\(\)/);
 assert.doesNotMatch(range.replace(pickup,''),/BindUnderstandingPickup|spoolProfile\.|SaveNormalOwned|Sign\(|Http\(/);
 const target=s.slice(s.indexOf(' Dictionary<string,object> Target('),s.indexOf(' bool DiscoveryTarget('));
 assert.doesNotMatch(target,/understanding-response-read\/range/);assert.ok(s.includes('req.AllowAutoRedirect=false'));
});

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
 assert.match(source,/const releaseHandoffs=\(\)=>\{firstPermitHandoffs\.delete\(request\);firstDeliveryHandoffs\.delete\(request\);firstRequest=undefined;\}/);
 assert.match(source,/catch\(error\)\{releaseHandoffs\(\);throw error;\}/);
 assert.match(source,/pending\.finally\(releaseHandoffs\)/);
});
test('갱신 native source는 결정적 marker와 receipt 슬롯을 연결하고 만료 예외를 갱신 검산에 한정한다',()=>{
 const s=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8');
 for(const literal of ['NORMAL_EXECUTION_RENEW','RenewalMarker','previousSlotRef','ReadSlotChain','LoadSlot(Id(previous,"slotId"),record,true,exchangeCurrent)',
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
 const call=s.slice(s.indexOf(' object Call('),s.indexOf(' object Next('));
 assert.ok(call.indexOf('target=')>=0&&call.indexOf('Target(scope,r,body)')>=0&&call.indexOf('Target(scope,r,body)')<call.indexOf('var reply=Challenge(record,scope,request,S(slot,"credential")'));
});

test('bootstrap과 renew는 원 최단 기한을 교환과 정착에 전달하며 만료 뒤 양성 응답을 만들지 않는다',()=>{
 const source=readFileSync(new URL('apps/connector/native/NormalExecutionCredentialSource.cs',root),'utf8');
 const boot=source.slice(source.indexOf(' Dictionary<string,object> Bootstrap('),source.indexOf(' void CheckBootstrap('));
 assert.match(boot,/exchangeDeadline=new\[\]\{At\(registration,"registrationExpiresAt"\),At\(Map\(record\["credential"\]\),"expiresAt"\)\}\.Min\(\)/);
 assert.match(boot,/tightenExchange\(new\[\]\{At\(bootstrap,"expiresAt"\),At\(c,"expiresAt"\)\}\.Min\(\)\)/);
 assert.match(boot,/deadlineLeft<1\)\{exchangeBudget=0;throw Invalid\(\);\}/);
 assert.match(boot,/hostLeft<1\)throw Invalid\(\)/);
 assert.match(boot,/Math\.Min\(\(exchangeDeadline-clock\(\)\)\.TotalMilliseconds,exchangeBudget-exchangeElapsed\.Elapsed\.TotalMilliseconds\)/);
 assert.match(boot,/limitUntil:exchangeDeadline,limitRemaining:exchangeRemaining/);
 assert.match(boot,/exchangeDeadline=end<exchangeDeadline\?end:exchangeDeadline/);
 assert.match(boot,/startBound=\(exchangeDeadline-startedAt\)\.TotalMilliseconds/);
 assert.match(boot,/observedBound=exchangeElapsed\.Elapsed\.TotalMilliseconds\+\(exchangeDeadline-clock\(\)\)\.TotalMilliseconds/);
 assert.match(boot,/exchangeBudget=Math\.Min\(exchangeBudget,Math\.Min\(startBound,observedBound\)\)/);
 const http=source.slice(source.indexOf(' Dictionary<string,object> Http('),source.indexOf(' sealed class Roots:'));
 assert.match(http,/Math\.Min\(remaining\(\),limitRemaining\(\)\)/);
 const store=source.slice(source.indexOf(' internal static void SaveNormalOwned('),source.indexOf(' internal static byte\[\] LoadNormalOwned('));
 assert.match(store,/ProtectedData\.Protect[^\n]+\n\s*current\(\);owner\.Check\(\);\s*using\(var file=new FileStream/);
 const inOrder=[
  'Stopwatch.StartNew()', '"exchange",B(marker),exchangeCurrent','Challenge(record,scope,request,null,null,120000,exchangeDeadline,exchangeRemaining)',
  'tightenExchange(new[]{At(bootstrap,"expiresAt"),At(c,"expiresAt")}.Min())','EXECUTION_CREDENTIAL_EXCHANGE",proof,exchangeCurrent',
  'limitUntil:exchangeDeadline,limitRemaining:exchangeRemaining','tightenExchange(end)','"execution-ca",Encoding.UTF8.GetBytes(activeCA),exchangeCurrent',
  '"execution",B(slot),exchangeCurrent','LoadSlot(slotId,record,false,exchangeCurrent)','spoolProfile.BindSlot(record,checkedSlot,exchangeCurrent)','verifyExchangeOwner();return result;'
 ];
 let previous=-1;
 for(const key of inOrder){const offset=boot.replace(/\r/g,'').indexOf(key);assert.ok(offset>previous,key);previous=offset;}
 assert.match(source,/LoadNormalOwned\(owner,id,"execution",slotCurrent\)/);
 assert.match(source,/LoadNormalOwned\(owner,expected,"exchange",slotCurrent\)/);
 const spool=readFileSync(new URL('apps/connector/native/NormalExecutionSpoolProfileSource.cs',root),'utf8');
 const bind=spool.slice(spool.indexOf(' internal void BindSlot('),spool.indexOf(' Row Allocate('));
 assert.match(bind,/beforeSlotAppend=\(\)=>\{try\{exchangeCurrent\(\);\}catch\{exchangeRejected=true;throw;\}\}/);
 assert.match(bind,/Append\(log,rows,R\("kind","SLOT_ID"[^\n]+,beforeSlotAppend\)/);
 assert.match(bind,/catch\{blocked=true;if\(exchangeRejected\)throw;\}\s*exchangeCurrent\(\)/);
 const dispatch=source.slice(source.indexOf(' internal object Dispatch('),source.indexOf(' void Header('));
 assert.match(dispatch,/catch\{unknown=true;ClearInput\(\);ClearOutput\(\);throw;\}/);
});
