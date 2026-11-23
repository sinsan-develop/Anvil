'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const read=p=>readFileSync(path.resolve(__dirname,'../../',p),'utf8');

test('원 FIRST caller는 같은 등록 host의 전용 준비·supervisor ACK·물리 close·opposite endpoint 소비만 잇는다',async()=>{
 const {prepareNormalSdkChildHandoff}=await import('../../apps/connector/runtime/normal-owned-spool-profile.ts');
 assert.equal(typeof prepareNormalSdkChildHandoff,'function');
 const runtime=read('apps/connector/runtime/normal-owned-spool-profile.ts');
 assert.match(runtime,/await this\.#prepareSdkFirst\(handoff,life,verify\)/);
 const native=read('apps/connector/native/DesktopTrustKeyHostSource.cs');
 assert.match(native,/--normal-sdk-child/);assert.match(native,/RunSdkChildSupervisorAsync/);
});

test('FIRST 검산 Options와 SID만 같은 pinned recipe의 비실행 계획에 결박한다',()=>{
 const spool=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs'),credential=read('apps/connector/native/NormalExecutionCredentialSource.cs'),config=read('apps/connector/native/NormalExecutionConfigurationSource.cs');
 assert.match(spool,/out SdkStartOptions options,bool verifyOptions/);
 assert.match(spool,/options=candidate;return digest/);
 assert.match(credential,/readonly NormalExecutionSpoolProfileSource.SdkStartOptions Options/);
 assert.match(credential,/h,out options,verifyOptions/);
 assert.match(config,/inspected.Options.OriginalRef!=Canonical\(Map\(Map\(source\["startEnvelope"\]\)\["payload"\]\)\["optionsRef"\]\)/);
 assert.match(config,/Hash\(sid\)!=S\(Map\(source\["scope"\]\),"plannedSidDigest"\)/);
 assert.match(config,/bound=BuildFirstInputs\(package,pins,recipe,sid,options\)/);
 assert.match(config,/options.MaxBudgetUsd.HasValue/);
 assert.match(config,/token=="MAX_BUDGET_USD"\)throw Invalid\(\)/);
 assert.match(config,/options.MaxTurns.HasValue!=dynamic.Contains\("MAX_TURNS"\)/);
 assert.match(config,/options.MaxTurns.Value.ToString\(CultureInfo.InvariantCulture\)/);
 assert.match(config,/StringComparer.OrdinalIgnoreCase/);
 assert.match(config,/if\(bound!=null\)bound.Clear\(\)/);
 const build=config.slice(config.indexOf('static Row BuildFirstInputs('),config.indexOf('internal sealed class FirstConfiguration'));
 assert.match(build,/application=kind=="IMAGE"\?package.Cli:package.Runtime/);
 assert.match(build,/token=="SCRIPT"\)\{if\(kind!="SCRIPT"\)throw Invalid\(\);value=package.Cli/);
 assert.match(build,/token=="SESSION_ID"\)value=sid/);assert.match(build,/token=="MODEL"\)value=options.Model/);
 assert.match(build,/ArrayOf\(r\["argvTokens"\],200\)/);assert.match(build,/args.Add\(value\)/);
 assert.match(build,/!dynamic.Contains\("SESSION_ID"\)\|\|!dynamic.Contains\("MODEL"\)/);
 assert.match(build,/\(kind=="SCRIPT"\)!=dynamic.Contains\("SCRIPT"\)/);
 assert.match(build,/env.ContainsKey\(name\)/);assert.match(build,/env.Count>6/);
 for(const literal of ['CLAUDE_CODE_ENTRYPOINT','sdk-ts','CLAUDE_AGENT_SDK_VERSION','0.3.224','commandLength>=32767','StringComparer.Ordinal'])assert.ok(build.includes(literal),literal);
 assert.match(build,/NormalSdkChildHostSource.HookDigest\(S\(bound,"application"\),S\(bound,"cwd"\),\(string\[\]\)bound\["args"\],env\)/);
 assert.match(config,/expectedHookHash=FirstHookHash\(bound\)/);assert.match(config,/FirstHookHash\(bound\)!=expectedHookHash/);
 assert.doesNotMatch(build,/SDK_HOOK_OBSERVED_V1|GetByteCount/);
 const child=read('apps/connector/native/NormalSdkChildHostSource.cs');
 assert.match(child,/internal static string HookDigest\(/);
 assert.match(child,/buffer.Length\+prefix.Length\+length>65536/);assert.match(child,/new UTF8Encoding\(false,true\)/);
 assert.doesNotMatch(build,/profileArgs|GetEnvironment|ExpandEnvironment|Split\(|Double.ToString|MaxBudgetUsd.Value/);
 assert.match(config,/Hash\(bound\)!=boundHash\|\|S\(bound,"cwd"\)!=pins.Cwd/);
 assert.match(spool,/return H\(new object\[\]\{scope,start,send\}\)/);
 assert.match(spool,/SdkStartOptions ignored;return ReadSdkFirstAttempt\(record,slot,scope,startCommand,sendCommand,handoff,out ignored,verifyOptions\)/);
 assert.match(spool,/readonly string Model,OriginalRef,BytesHash;internal readonly long\? MaxTurns;internal readonly double\? MaxBudgetUsd/);
 assert.match(spool,/return parsed;[\s\S]*finally\{Array.Clear\(optionRaw,0,optionRaw.Length\);\}/);
 assert.doesNotMatch(config,/Environment.GetEnvironment|Process.Start|new NormalSdkChildHostSource|CreateProcess/);
 assert.match(credential,/return new Dictionary<string,object>\{\{"state","SDK_CONFIGURATION_UNAVAILABLE"\}\}/);
});

test('START Options 원 SHA 뒤 닫힌 model·선택 숫자 검사와 바이트 소거가 연결된다',async()=>{
 const spool=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
 const intake=spool.slice(spool.indexOf('SdkStartOptions ReadSdkStartOptions('),spool.indexOf('static void RequireSdkFirst('));
 assert.match(intake,/new byte\[checked\(\(int\)N\(options\["sourceBytes"\]\)\)\]/);
 assert.match(intake,/Buffer.BlockCopy\(bytes,0,optionRaw,checked\(\(int\)optionBytes\),bytes.Length\)/);
 assert(intake.indexOf('ValidateSdkStartOptions(optionRaw,')>intake.indexOf('digest.TransformFinalBlock('));
 assert.match(intake,/finally\{Array.Clear\(optionRaw,0,optionRaw.Length\);\}/);
 const validator=spool.slice(spool.indexOf('SdkStartOptions ValidateSdkStartOptions('),spool.indexOf('static void RequireSdkFirst('));
 assert.match(validator,/new UTF8Encoding\(false,true\).GetString\(bytes\)/);
 assert.match(validator,/new SdkOptionsReader\(text,Check\).Read\(originalRef,bytesHash\)/);
 assert.match(validator,/key!="claudeQueryParams"/);
 assert.match(validator,/!keys.Add\(key\)/);
 assert.match(validator,/key!="maxTurns"&&key!="maxBudgetUsd"/);
 assert.match(validator,/model.Length<1\|\|model.Length>200/);
 assert.match(validator,/model.Any\(c=>Char.IsControl\(c\)\)/);
 assert.match(validator,/Double.TryParse\(token,System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out value\)/);
 assert.match(validator,/Double.IsNaN\(value\)\|\|Double.IsInfinity\(value\)/);
 assert.match(validator,/value<0\|\|value>9007199254740991d/);
 assert.match(validator,/value<1\|\|Math.Truncate\(value\)!=value/);
 assert.doesNotMatch(validator,/DesktopTrustKeyHostSource.Parse|Canonical|Write|Append|Console|Process|Query\(/);
 // 원 TS 계약의 RAM 기준이다. C# parser를 실행한 증거가 아니다.
 const {readClaudeQueryParams}=await import('../../apps/connector/adapters/secondary/start-options.ts');
 const {parseWireJson}=await import('../../contracts/canonical.ts');
 for(const raw of ['{"claudeQueryParams":{"model":"auto"}}',' { "claudeQueryParams": {"maxTurns":1e0,"model":" 모델 🙂 ","maxBudgetUsd":0.125} }',
  '{"claudeQueryParams":{"model":"m","maxTurns":9007199254740991,"maxBudgetUsd":-0}}'])assert.ok(readClaudeQueryParams(parseWireJson(raw)));
 for(const raw of ['{"claudeQueryParams":{"model":"m","model":"n"}}','{"claudeQueryParams":{"model":"m","maxTurns":1.5}}',
  '{"claudeQueryParams":{"model":"m","maxBudgetUsd":1e400}}','{"claudeQueryParams":{"model":"m","maxBudgetUsd":null}}',
  '{"claudeQueryParams":{"model":"m","extra":1}}','{"claudeQueryParams":{"model":"m"},"extra":1}',
  '{"claudeQueryParams":{"model":"\\u0085"}}','{"claudeQueryParams":{"model":"\\ud800"}}','{"claudeQueryParams":{"model":"   "}}'])assert.throws(()=>readClaudeQueryParams(parseWireJson(raw)));
});

test('기존 FIRST 읽기 Inspect의 Options 검산 1회와 원문 비반환은 별도 source 준비와 분리해 유지한다',()=>{
 const credential=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 const spool=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
 const inspection=credential.slice(credential.indexOf('internal object InspectSdkFirst('),credential.indexOf('object PrepareSdkChildSource('));
 assert.equal((inspection.match(/InspectFirstSource\(request,record,slot,true\)/g)||[]).length,1);
 assert.equal((credential.match(/InspectFirstSource\(request,record,slot,true\)/g)||[]).length,2);
 assert.match(credential,/ReadSdkFirstAttempt\(record,slot,request.Scope,request.StartId,request.SendId,h,out options,verifyOptions\)/);
 assert.match(credential,/InspectFirstSource\(RowRequest request,[^\n]*bool verifyOptions=false\)/);
 assert.match(spool,/if\(verifyOptions\)candidate=ReadSdkStartOptions\(rows,id,dir,scope,startCommand,handoff,startReceived\)/);
 assert.match(spool,/SdkStartOptions ReadSdkStartOptions\(/);
 assert.doesNotMatch(credential,/claudeQueryParams|MAX_BUDGET_USD/);
 assert.match(credential,/H\(plannedSid\)!=S\(request.Scope,"plannedSidDigest"\)/);
});

test('FIRST 보호 설정은 원 환경의 유일 현재 head와 저장 원 그래프를 재판독하고 원 cwd 핀을 보유한다',()=>{
 const config=read('apps/connector/native/NormalExecutionConfigurationSource.cs');
 const consume=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 assert.match(consume,/using\(var configuration=source.PinFirst\(inspected,package\)\)[\s\S]*configuration.Check\(\)/);
 assert.match(config,/internal FirstConfiguration PinFirst\(/);
 assert.match(config,/internal Row UniqueFirstEnvelope\(/);
 assert.match(config,/candidates.Length!=1/);
 assert.match(config,/Graph\(Map\(envelope\["environment"\]\),Map\(envelope\["profile"\]\)/);
 assert.match(config,/pins=new DirectoryPins\(peer,[\s\S]*pins.Require\(envelope\["physical"\]\)/);
 assert.match(config,/headHash!=Hash\(records.UniqueFirstEnvelope\(fact,original,recipe\)\)/);
 assert.match(config,/package.Check\(\);pins.Check\(\);check\(\)/);
 const method=config.slice(config.indexOf('internal Row UniqueFirstEnvelope('),config.indexOf('internal Row Head('));
 assert.doesNotMatch(method,/New\(|Open\(true\)|Confirm\(|Revoke\(|OrderByDescending/);
 assert.doesNotMatch(consume,/new NormalSdkChildHostSource|CreateProcess|ResumeThread/);
});

test('FIRST 설정 재판독은 원 검산 객체와 기한에 묶이고 원문 대신 hash만 임시 수집한다',()=>{
 const config=read('apps/connector/native/NormalExecutionConfigurationSource.cs');
 const consume=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 assert.match(config,/PinFirst\(NormalExecutionCredentialSource.FirstInspection inspected,/);
 assert.match(config,/Hash\(original\)!=inspected.RecordHash/);
 assert.match(config,/wall\(\)>=expires/);
 assert.match(config,/Scan\(bool firstHashes=false\)/);
 assert.match(config,/if\(firstHashes\)result.envelopeHashes.Add/);
 assert.doesNotMatch(config,/Dictionary<string,Row> envelopes/);
 assert.match(config,/Hash\(envelope\)!=envelopeHash/);
 assert.match(config,/heads.Where\(r=>S\(r,"state"\)=="CONFIRMED"&&Same\(r\["environmentRef"\],environmentRef\)/);
 assert.match(config,/group.Single\(r=>DesktopTrustKeyHostSource.Positive\(r\["revision"\]\)==revision\)/);
 assert.match(config,/S\(d,"access"\)=="READ"/);
 assert.match(config,/if\(closed\)throw Invalid\(\)/);
 assert.match(config,/public void Dispose\(\)\{if\(closed\)return;closed=true;if\(bound!=null\)bound.Clear\(\);pins.Dispose\(\);\}/);
 assert.match(consume,/final.CanonicalSource!=inspected.CanonicalSource[\s\S]*configuration.Check\(\);originalCheck\(\)/);
 assert.match(consume,/return new Dictionary<string,object>\{\{"state","SDK_CONFIGURATION_UNAVAILABLE"\}\}/);
});

test('FIRST 보호 인계는 원 core의 전용 준비에서 FIRST3와 C hash를 독립 대조하고 INSPECT를 보존한다',()=>{
 const runtime=read('apps/connector/runtime/normal-owned-spool-profile.ts');
 assert.match(runtime,/takeNormalFirstPermitHandoff\(request,source\)/);
 assert.match(runtime,/await this\.#prepareSdkFirst\(handoff,life,verify\)/);
 const host=read('apps/connector/native/DesktopTrustKeyHostSource.cs');
 assert.match(host,/value.ContainsKey\("transferId"\)[\s\S]*ReceiveSdkFirstPart\(value,peer\)/);
 const credential=read('apps/connector/native/NormalExecutionCredentialSource.cs');
 assert.match(credential,/sealed class FirstInspection/);
 assert.match(credential,/S\(permitRef,"contentHash"\)!=H\(snapshot\)/);
 assert.match(credential,/J\(scope\)!=J\(expectedScope\)/);
 assert.match(credential,/J\(snapshot\["authorizationReceiptRef"\]\)!=J\(context\["authorizationReceiptRef"\]\)/);
 assert.match(credential,/J\(snapshot\["reservationRef"\]\)!=J\(context\["budgetRef"\]\)/);
 assert.match(credential,/firstConsumed=true;unknown=true;ClearFirst\(\);throw/);
 assert.match(credential,/public void Dispose\(\)[^\n]*ClearFirst\(\)/);
 assert.match(host,/normalExecution.IncompleteSdkFirstTransfer/);
 assert.match(host,/normalExecution.HasSdkFirstTransfer&&\(operation!="NORMAL_SDK_FIRST_INSPECT"/);
 const spool=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
 assert.match(spool,/RequireSdkFirst\(snapshot,reference,handoff,start,i\)/);
 assert.doesNotMatch(credential,/new NormalSdkChildHostSource|CreateProcess|ResumeThread/);
});

test('native hook 지문은 원 pinned 입력에서 독립 생성하고 첫 OS 효과 전에 단발 검산한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 const ctor=source.slice(source.indexOf('private NormalSdkChildHostSource('),source.indexOf('static Exception Invalid('));
 assert.match(ctor,/string observedHookHash/);
 assert.match(ctor,/observedHookHash.Length!=64/);
 assert.match(ctor,/observedHookHash.Any\(c=>!\(c>='0'&&c<='9'\|\|c>='a'&&c<='f'\)\)/);
 assert.match(ctor,/boundArguments=\(string\[\]\)boundArguments.Clone\(\)/);
 assert.match(ctor,/expectedHookHash=HookDigest\(application,directories.Cwd,boundArguments,env\)/);
 assert.match(source,/new UTF8Encoding\(false,true\)/);
 assert.match(source,/put\("SDK_HOOK_OBSERVED_V1"\);put\(command\);put\(cwd\)/);
 assert.match(source,/args.Length.ToString\(CultureInfo.InvariantCulture\)/);
 assert.match(source,/OrderBy\(v=>v.Key,StringComparer.Ordinal\)/);
 assert.match(source,/length.ToString\(CultureInfo.InvariantCulture\)\+":"/);
 assert.match(source,/buffer.Length\+prefix.Length\+length>65536/);
 assert.match(source,/value.IndexOf\('\\0'\)>=0/);
 assert.match(source,/catch\(EncoderFallbackException\)\{throw Invalid\(\);\}/);
 const check=source.slice(source.indexOf('void Check()'),source.indexOf('static bool Valid('));
 assert.match(check,/cancellation.IsCancellationRequested/);assert.match(check,/now>=deadline\|\|watch.Elapsed.TotalMilliseconds>=budgetMs/);
 assert.match(source,/finally\{Array.Clear\(buffer.GetBuffer\(\),0,\(int\)buffer.Length\);\}/);
 const create=source.slice(source.indexOf('void CreateSuspended()'),source.indexOf('void VerifyOriginal('));
 assert.match(create,/if\(attempted\)throw Invalid\(\);attempted=true;[\s\S]*Check\(\);[\s\S]*String.Equals\(expectedHookHash,observedHookHash,StringComparison.Ordinal\)[\s\S]*Check\(\);[\s\S]*try\{[\s\S]*CreateJobObjectW/);
 assert.match(create,/catch\{unknown=!creationRejected;Dispose\(\);throw;\}/);
 assert.match(ctor,/package.Kind=="IMAGE"\?package.Cli:package.Kind=="SCRIPT"\?package.Runtime:null/);
 assert.equal((source.match(/new NormalSdkChildHostSource\(/g)||[]).length,0);
});
test('SDK 원 child 소유 primitive는 atomic Job와 자식 stdio 세 끝만 생성 전에 결박한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 const create=source.slice(source.indexOf('void CreateSuspended()'),source.indexOf('void VerifyOriginal('));
 assert.match(create,/attempted=true[\s\S]*CreateJobObjectW[\s\S]*ActiveProcessLimit=1/);
 assert.match(create,/new IntPtr\(0x00020002\)[\s\S]*new IntPtr\(0x0002000D\)[\s\S]*CreateProcessW/);
 assert.match(create,/Marshal.WriteIntPtr\(handles,stdinRead\)[\s\S]*Marshal.WriteIntPtr\(handles,IntPtr.Size,stdoutWrite\)[\s\S]*Marshal.WriteIntPtr\(handles,IntPtr.Size\*2,stderrWrite\)/);
 assert.match(create,/created=ok\|\|original.Process!=IntPtr.Zero\|\|original.Thread!=IntPtr.Zero\|\|original.Pid!=0\|\|original.Tid!=0;[\s\S]*if\(!created\)\{creationRejected=true;throw Invalid\(\);\}[\s\S]*VerifyOriginal\(true\)/);
 assert.doesNotMatch(source,/AssignProcessToJobObject|OpenProcess|GetEnvironmentVariables|Process\.Start|Console\.|public static/);
 assert.match(require('../../apps/desktop/scripts/desktop-trust-key-host-build.cjs').SOURCE_FILES.join('\n'),/apps\/connector\/native\/NormalSdkChildHostSource\.cs/);
});

test('SDK 원 child 소유 primitive는 원 핸들 검산 뒤 resume·stdio 인계를 각 한 번만 허용한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 assert.match(source,/void VerifyOriginal\(bool first\)[\s\S]*GetProcessId\(original.Process\)[\s\S]*GetProcessIdOfThread\(original.Thread\)[\s\S]*GetThreadId\(original.Thread\)[\s\S]*GetProcessTimes[\s\S]*GetThreadTimes[\s\S]*IsProcessInJob[\s\S]*Members\(\)!=1[\s\S]*QueryFullProcessImageNameW/);
 const resume=source.slice(source.indexOf('void ResumeOriginal()'),source.indexOf('StreamSet TakeStreams()'));
 assert.match(resume,/resumeAttempted=true;[\s\S]*Check\(\);VerifyOriginal\(false\);Check\(\);[\s\S]*ResumeThread\(original.Thread\)!=1[\s\S]*resumed=true/);
 assert.match(source,/if\(streamsTaken\|\|!resumed\)[\s\S]*streamsTaken=true/);
 assert.match(source,/cancellation.IsCancellationRequested[\s\S]*watch.Elapsed.TotalMilliseconds>=budgetMs/);
 assert.match(source,/package.Check\(\);directories.Check\(\)/);
 assert.match(source,/if\(returned<8\|\|returned>\(uint\)bytes\)throw Invalid\(\);[\s\S]*Marshal.ReadInt32\(buffer\)[\s\S]*returned<\(uint\)\(8\+count\*IntPtr.Size\)[\s\S]*Marshal.ReadIntPtr\(buffer,8\)/);
 assert.match(resume,/catch\{unknown=true;Dispose\(\);throw;\}/);
 // 원 lease 소비자는 다음 구간이다. 임의 callback/JSON 또는 공개 factory로 기술 primitive를 활성화하지 않는다.
 assert.match(source,/private NormalSdkChildHostSource\(/);
 assert.doesNotMatch(source,/internal static .*Create|internal .*Open\(/);
});

test('SDK 원 child 소유 primitive는 종료 불명과 닫힘 실패의 원 핸들을 보존한다',()=>{
 const source=read('apps/connector/native/NormalSdkChildHostSource.cs');
 assert.match(source,/WaitForSingleObject\(original.Process,0\)[\s\S]*GetExitCodeProcess\(original.Process,out code\)/);
 assert.match(source,/TerminateProcess\(original.Process/);
 assert.match(source,/if\(!CloseHandle\(handle\)\)[\s\S]*return;[\s\S]*handle=IntPtr.Zero/);
 const dispose=source.slice(source.indexOf('public void Dispose()'));
 assert.match(dispose,/if\(cleanupAttempted\)[\s\S]*cleanupAttempted=true/);
 assert.match(dispose,/CloseOwned\(ref stdinRead[\s\S]*CloseOwned\(ref stdoutWrite[\s\S]*CloseOwned\(ref stderrWrite/);
 assert.match(dispose,/if\(created&&!exitConfirmed\)[\s\S]*failed=true/);
 assert.match(dispose,/if\(exitConfirmed&&streams.Input!=null\)/);
 assert.match(dispose,/if\(failed\)[\s\S]*unconfirmed.Add\(this\)[\s\S]*throw Unknown\(\)/);
 assert.doesNotMatch(dispose,/original=default|unconfirmed.Clear|GC.Collect/);
});
test('native 원 FIRST3 판독은 두 채널의 최근 정산·정확 3행/원바이트·참조연쇄를 검사하는 읽기 전용 경로다',()=>{
  const file=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
  const part=file.slice(file.indexOf('internal string ReadSdkFirstAttempt('),file.indexOf('static Row LastOutputPhase('));
  assert.match(part,/Log\(false,[\s\S]*Has\(rows,"REGISTERED",H\(record\)\)[\s\S]*S\(r,"slotHash"\)==H\(slot\)[\s\S]*Allocate\(rows,log,Normal,tuple,true\)/);
  assert.match(part,/OutputScope\(scope,rows,allocation,record,slot\)[\s\S]*startCommand,true[\s\S]*sendCommand,false/);
  assert.match(part,/Unsettled\(rows\)[\s\S]*"SETTLED"[\s\S]*N\(summary\["count"\]\)!=3[\s\S]*Inspect\(/);
  assert.match(part,/FileMode.Open,FileAccess.Read,FileShare.Read[\s\S]*FileIdentity\(f,path\)[\s\S]*DesktopTrustKeyHostSource.Parse\(bytes,true\)/);
  assert.match(part,/S\(reference,"contentHash"\)!=H\(snapshot\)[\s\S]*J\(snapshot\["previousRef"\]\)!=J\(previous\)/);
  assert.match(part,/hashes\[2\]!=S\(summary,"tail"\)/);
  assert.doesNotMatch(part,/Append\(|FileMode.Create|FileAccess.Write/);
});
test('원 slot 재판독과 cwd·env 권위 부재 거절은 신규 SDK/CLI 실행을 발급하지 않는다',()=>{
  const src=read('apps/connector/native/NormalExecutionCredentialSource.cs');
  const fn=src.slice(src.indexOf('internal object InspectSdkFirst'),src.indexOf('internal sealed class RowRequest'));
  assert.match(fn,/Record\(request.AttemptId\)[\s\S]*LoadSlot\(request.SlotId,record\)[\s\S]*ReadSdkFirstAttempt[\s\S]*Acquire\(peer\)[\s\S]*H\(LoadSlot\(request.SlotId,record\)\)!=H\(slot\)[\s\S]*ReadSdkFirstAttempt[\s\S]*SDK_CONFIGURATION_UNAVAILABLE/);
  assert.doesNotMatch(fn,/CreateProcess|ResumeThread|Process.Start|CLOSED_CONFIRMED/);
});

test('등록 전 SDK bootstrap은 별도 고정 mode에서 원 peer/package만 검산하고 등록 root를 만들지 않는다',()=>{
 const code=read('apps/connector/native/DesktopTrustKeyHostSource.cs');
 assert.match(code,/args.Length==1&&args\[0\]=="--normal-sdk-bootstrap"/);
 const body=code.slice(code.indexOf('internal async Task<int> RunSdkBootstrapAsync()'),code.indexOf('void Check()'));
 assert(body.length>0);
 assert.match(body,/DesktopTrustKeyPeerSource.Open[\s\S]*NormalSdkWorkerPackageSource.Acquire[\s\S]*ExecutionRecipe/);
 assert.match(body,/SDK_BOOTSTRAP_PREPARE[\s\S]*SDK_BOOTSTRAP_ACCEPT/);
 assert.doesNotMatch(body,/RootSource.Open|IssueFreshRoot|BindingStore|Dispatch\(|CreateKey|CreateProcess|ReadSdkFirstAttempt/);
 assert.match(body,/package.Dispose\(\)/);
});

const {EventEmitter}=require('node:events');
const {createHash,randomUUID}=require('node:crypto');
const {canonicalJson}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
const {createSdkBootstrapClient}=require('../../apps/desktop/src/trust-key-host-client.cjs');
function bootstrapCarrier(change=x=>x,normal=false,extra={}){
 const image=Buffer.from('synthetic-helper'),sha=createHash('sha256').update(image).digest('hex'),calls=[];
 const endpoint={stdin:new EventEmitter(),stdout:new EventEmitter(),stderr:new EventEmitter()};Object.setPrototypeOf(endpoint,EventEmitter.prototype);EventEmitter.call(endpoint);
 let seq=0;endpoint.stdin.write=(bytes,_encoding,callback)=>{const f=JSON.parse(bytes.toString());calls.push(f.operation);seq++;let data;
  if(f.operation==='SDK_BOOTSTRAP_PREPARE')data={state:'SDK_BOOTSTRAP_PREPARED',...f.payload,manifestHash:'a'.repeat(64),recipeRef:{id:randomUUID(),version:1,contentHash:'b'.repeat(64)},expiresAt:new Date(end).toISOString()};
  else data={state:'SDK_BOOTSTRAP_ACCEPTED',...f.payload};
  queueMicrotask(()=>{callback();endpoint.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:f.requestId,sequence:seq,rootIdentity:'SDK_BOOTSTRAP',data:change(data)})+'\n'));});return true;
 };
 endpoint.stdin.end=()=>queueMicrotask(()=>endpoint.emit('close',0));
 const abort=new AbortController();let end=Date.now()+9000;
 const lease={signal:abort.signal,narrow:value=>{end=Math.min(end,value);},check(){if(abort.signal.aborted)throw Error('CONTEXT_CHANGED');},remainingMs:()=>end-Date.now(),callExpiresAt:()=>new Date(end).toISOString()};
 const factory=normal?require('../../apps/desktop/src/trust-key-host-client.cjs').createTrustKeyHostClient:createSdkBootstrapClient;
 const client=factory({path:'C:\\Anvil\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:sha},helperHash:sha},{readImage:async()=>Buffer.from(image),companion:async()=> 'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:(_exe,args)=>{assert.deepEqual(args,normal?[]:['--normal-sdk-bootstrap']);extra.spawned?.();return endpoint;},...extra});
 return{client,lease,calls,abort,child:endpoint};
}

test('FIRST 읽기 수송 예산은 실제 채널의 선행 READ_STATE PUBLIC_KEY 사용분을 제외한다',async()=>{
 const fixture=bootstrapCarrier(x=>x,true),channel=await fixture.client.open(fixture.lease);
 try{
  assert.equal(channel.inspectionBudget().frames,64);
  await channel.send('READ_STATE',{});await channel.send('PUBLIC_KEY',{});
  assert.equal(channel.inspectionBudget().frames,62);assert(channel.inspectionBudget().remainingMs>0);
  await channel.send('NORMAL_SDK_FIRST_INSPECT',{});assert.equal(channel.inspectionBudget().frames,61);
  assert.deepEqual(fixture.calls,['READ_STATE','PUBLIC_KEY','NORMAL_SDK_FIRST_INSPECT']);
 }finally{assert.equal((await channel.close()).state,'CLOSED_CONFIRMED');}
 assert.throws(()=>channel.inspectionBudget());
});
test('원 bootstrap 채널만 같은 endpoint·epoch에서 한 번 수령하고 확정 폐쇄한다',async()=>{
 const m=bootstrapCarrier(),lease=await m.client.open(m.lease,4),proof=lease.read();assert.equal(proof.epoch,4);
 await lease.accept();await assert.rejects(lease.accept());assert.equal((await lease.close()).state,'CLOSED_CONFIRMED');assert.throws(()=>lease.read());
 assert.deepEqual(m.calls,['SDK_BOOTSTRAP_PREPARE','SDK_BOOTSTRAP_ACCEPT']);await assert.rejects(m.client.open(m.lease,4));
});
test('bootstrap 교차 endpoint·세대·불명 recipe는 수령0이며 취소 뒤 다시 열지 않는다',async()=>{
 for(const change of [x=>({...x,endpointId:randomUUID()}),x=>({...x,epoch:x.epoch+1}),x=>({...x,recipeRef:null})]){
  const m=bootstrapCarrier(change);await assert.rejects(m.client.open(m.lease,4));assert.deepEqual(m.calls,['SDK_BOOTSTRAP_PREPARE']);
 }
 const m=bootstrapCarrier(),lease=await m.client.open(m.lease,4);m.abort.abort();assert.throws(()=>lease.read());await assert.rejects(lease.accept());await lease.close();assert.deepEqual(m.calls,['SDK_BOOTSTRAP_PREPARE']);
});

const {createRegistrationSessionEndpoint,createRegistrationWorkerChannel,createWorkerRegistrationClient}=require('../../apps/desktop/src/normal-sdk-worker-entry.cjs');
async function registrationEndpoint(session,context){const m=bootstrapCarrier(),original=await m.client.open(m.lease,4);await original.accept();const endpoint=createRegistrationSessionEndpoint(original,session,context);assert.equal((await original.close()).state,'CLOSED_CONFIRMED');return endpoint;}
function registrationHuman(){
 const id='11111111-1111-4111-8111-111111111111',now=Date.now(),fp='a'.repeat(64),policy={id,version:1,contentHash:'b'.repeat(64)};
 const scope={kind:'HOST_TRUST_REGISTRATION',installationId:id,projectId:id,subject:{kind:'HUMAN',userId:id,clientId:id,credentialGeneration:1,controlGeneration:1},policyRef:policy,expectedHostFingerprint:fp,hostLabel:'합성 등록',expiresAt:new Date(now+60000).toISOString(),credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
 const hash=v=>createHash('sha256').update(canonicalJson(v)).digest('hex'),digest=hash(scope),state='CREATED',version=1;
 return{registrationRef:{id,version,contentHash:hash({registrationId:id,version,state,scopeDigest:digest})},connectorRef:{id,version:7,contentHash:hash({connectorId:id,registrationId:id,scopeDigest:digest,generation:7})},scopeDigest:digest,grants:[],executionAuthorized:false,
 projectId:id,hostLabel:scope.hostLabel,state,connectorState:'REGISTRATION_PENDING',derivedExpired:false,expiresAt:scope.expiresAt,proofedAt:null,revokedAt:null,expectedHostFingerprint:fp,observedHostFingerprint:null,scope,policyRef:policy,createdAt:new Date(now).toISOString(),issuedAt:null,failedAttempts:0,credential:{issued:false,expiresAt:null,revokedAt:null,status:'NOT_ISSUED'},basis:{current:true,reasons:[]},confirmation:{allowed:false,reasons:['PROOF_NOT_READY']},observedAt:new Date(now).toISOString()};
}
function registrationLease(){const abort=new AbortController();let end=Date.now()+8000;return{abort,lease:{signal:abort.signal,check(){if(abort.signal.aborted||Date.now()>=end)throw Error('CONTEXT_CHANGED');},callExpiresAt:()=>new Date(end).toISOString(),narrow:n=>{end=Math.min(end,n);}}};}
test('원 bootstrap을 소비한 전용 Session endpoint만 기존 등록 GET을 원 origin·lease로 중계한다',async()=>{
 const human=registrationHuman(),calls=[],context={origin:'https://project.invalid',identity:'view-1',authEpoch:2};
 const session={fetch:async function(url,options){assert.equal(this,session);calls.push(url);assert.equal(url,context.origin+'/api/v1/projects/'+human.projectId+'/connector-registrations/'+human.registrationRef.id);assert.equal(options.method,'GET');assert.equal(options.credentials,'include');return new Response(JSON.stringify(human),{headers:{'content-type':'application/json'}});}};
 const bridge=await registrationEndpoint(session,()=>context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
 try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease);assert.deepEqual(await client.human(human.projectId,human.registrationRef.id),human);assert.equal(calls.length,1);}finally{worker.close();bridge.close();}
 assert.throws(()=>createRegistrationSessionEndpoint({},session,()=>context));
});
test('등록 Session endpoint는 원 auth 문맥 변경 후 늦은 200/401을 폐기하고 임의 요청을 중계하지 않는다',async()=>{
 for(const status of [200,401]){
  const human=registrationHuman();let epoch=2,release;const pending=new Promise(resolve=>{release=resolve;});let fetched=false;
  const session={fetch:async()=>{fetched=true;await pending;return new Response(JSON.stringify(status===200?human:{code:'AUTH_REQUIRED'}),{status,headers:{'content-type':'application/json'}});}};
  const context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:epoch});
  const bridge=await registrationEndpoint(session,context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
  try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease),result=client.human(human.projectId,human.registrationRef.id);while(!fetched)await new Promise(resolve=>setImmediate(resolve));epoch++;release();await assert.rejects(result,/CONTEXT_CHANGED/);}finally{worker.close();bridge.close();}
 }
 let calls=0;const context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2}),bridge=await registrationEndpoint({fetch:async()=>{calls++;throw Error('MUST_NOT_CALL');}},context),worker=createRegistrationWorkerChannel(bridge.port);
 try{await assert.rejects(worker.request({...bridge.endpoint,operationId:randomUUID(),deadline:Date.now()+8000,method:'fetch',args:['https://other.invalid']}));assert.equal(calls,0);}finally{worker.close();bridge.close();}
});

test('등록 endpoint는 원 package 채널이 열린 수령 직후에만 생성되고 폐쇄 뒤 재사용은 거절한다',async()=>{
 const context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2}),session={fetch:async()=>{throw Error('MUST_NOT_CALL');}};
 const m=bootstrapCarrier(),cap=await m.client.open(m.lease,4);await cap.accept();let endpoint;
 try{endpoint=createRegistrationSessionEndpoint(cap,session,context);assert.throws(()=>createRegistrationSessionEndpoint(cap,session,context));}finally{endpoint?.close();await cap.close();}
 const n=bootstrapCarrier(),closed=await n.client.open(n.lease,4);await closed.accept();await closed.close();assert.throws(()=>createRegistrationSessionEndpoint(closed,session,context));
});

test('등록 endpoint는 생성 때 원 Session transport를 보존하고 교체 뒤 GET을 발행하지 않는다',async()=>{
 const human=registrationHuman();let calls=0;const session={fetch:async()=>{calls++;return new Response(JSON.stringify(human),{headers:{'content-type':'application/json'}});}},context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2});
 const bridge=await registrationEndpoint(session,context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
 try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease);session.fetch=async()=>{calls++;throw Error('MUST_NOT_CALL');};await assert.rejects(client.human(human.projectId,human.registrationRef.id),/CONTEXT_CHANGED/);assert.equal(calls,0);}finally{worker.close();bridge.close();}
});

test('worker 등록 변이는 원 lease에 송신을 표시하며 표시 실패 때 중계를 시작하지 않는다',async()=>{
 const events=[],endpoint={endpointId:randomUUID(),epoch:4},owned=registrationLease(),channel={request:async()=>{events.push('SEND');return{ok:false,code:'OUTCOME_UNKNOWN'};},cancel:()=>{}};
 const lease={...owned.lease,markEffect:()=>events.push('EFFECT')},client=createWorkerRegistrationClient(endpoint,channel,lease);
 await assert.rejects(client.enroll({},{}),/OUTCOME_UNKNOWN/);assert.deepEqual(events,['EFFECT','SEND']);
 events.length=0;const denied=createWorkerRegistrationClient(endpoint,channel,{...owned.lease,markEffect:()=>{throw Error('CONTEXT_CHANGED');}});await assert.rejects(denied.enroll({},{}),/CONTEXT_CHANGED/);assert.equal(events.length,0);
});

test('등록 endpoint의 끝난 요청은 native host frame 한도로 누적 제한하지 않는다',async()=>{
 const human=registrationHuman();let calls=0;const session={fetch:async()=>{calls++;return new Response(JSON.stringify(human),{headers:{'content-type':'application/json'}});}},context=()=>({origin:'https://project.invalid',identity:'view-1',authEpoch:2});
 const bridge=await registrationEndpoint(session,context),worker=createRegistrationWorkerChannel(bridge.port),owned=registrationLease();
 try{const client=createWorkerRegistrationClient(bridge.endpoint,worker,owned.lease);for(let i=0;i<65;i++)await client.human(human.projectId,human.registrationRef.id);assert.equal(calls,65);}finally{worker.close();bridge.close();}
});

test('등록 session은 설정과 첫 수신을 같은 원 owner에 보유하고 미등록에는 보호 기능을 열지 않는다',async()=>{
 const {createTrustEnrollmentSession}=require('../../apps/desktop/src/trust-enrollment-owner.cjs');
 const session=createTrustEnrollmentSession(()=>({origin:'https://project.invalid',identity:'one',authEpoch:1}),null);
 assert.equal(session.getState().attemptId,null);assert.equal(session.isBusy(),false);
 const result=await session.handleReceive('native-receive-status',{attemptId:randomUUID(),epoch:1});assert.equal(result.ok,false);
 assert.equal((await session.configuration('PREPARE',{attemptId:randomUUID(),epoch:1,selection:{}})).ok,false);
 assert.equal('createNativeFirstReceiveReceiver'in session,false);assert.equal('createExecutionConfigurationController'in session,false);
 session.invalidate();assert.equal(session.getState().attemptId,null);
});

test('열린 package 채널의 조기 종료 뒤에는 원 endpoint를 발급하지 않는다',async()=>{
 const m=bootstrapCarrier(),original=await m.client.open(m.lease,4);await original.accept();
 m.child.emit('close',0);
 assert.throws(()=>require('../../apps/desktop/src/trust-key-host-client.cjs').takeSdkBootstrapEndpoint(original),/PROTECTION_UNAVAILABLE|OUTCOME_UNKNOWN/);
 assert.equal((await original.close()).state,'UNKNOWN');
});

function isolatedWorkerFixture(closeState='CLOSED_CONFIRMED'){
 const Module=require('node:module'),threads=require('node:worker_threads'),instances=[],owners=[];
 const compile=(name,overrides)=>{const file=require.resolve('../../apps/desktop/src/'+name),loaded=new Module(file,module),base=Module.createRequire(file);loaded.filename=file;loaded.paths=module.paths;loaded.require=id=>Object.hasOwn(overrides,id)?overrides[id]:base(id);loaded._compile(readFileSync(file,'utf8'),file);return loaded.exports;};
 const realOwner=require('../../apps/desktop/src/trust-enrollment-owner.cjs'),dependencies=[];
 const deps={uuid:randomUUID,now:Date.now,monotonic:()=>performance.now(),schedule:(f,ms)=>{const timer=setTimeout(f,ms);return()=>clearTimeout(timer);},createOperation:async(lease,pending)=>{
  let record=structuredClone(pending);const material={value:{snapshot:{expiresAt:new Date(Date.now()+8000).toISOString(),entries:[{sha256:'a'.repeat(64)}]}}};
  return{current:async()=>material,readState:async()=>({record}),appendRecord:async row=>{record=structuredClone(row);return{record};},createKey:async id=>({keyId:id,publicKeySpki:'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Z5A_4QCLi8maQa6elWKLxk8vGyDC1-n1F3o8KU1EYimQ',fingerprint:'5a7a78cca4a0f420d9bc62bb669c3c2759e39f723d3ae10dcbe0f0815a07ecd4'}),close:async()=>({state:closeState})};
 }};
 class RamWorker extends EventEmitter{
  constructor(file,options){super();instances.push(this);this.stdout=new EventEmitter();this.stderr=new EventEmitter();this.file=file;this.options=options;this.parent=new EventEmitter();this.parent.postMessage=v=>queueMicrotask(()=>this.emit('message',structuredClone(v)));queueMicrotask(()=>{try{compile('normal-sdk-worker-entry.cjs',{'node:worker_threads':{...threads,isMainThread:false,workerData:options.workerData,parentPort:this.parent},'./trust-enrollment-owner.cjs':{...realOwner,createDesktopTrustDependencies:()=>({...deps}),createTrustEnrollmentSession:(...args)=>{const owner=realOwner.createTrustEnrollmentSession(...args);owners.push(owner);dependencies.push(args[1]);return owner;}}});}catch(e){this.emit('error',e);}});}
  async terminate(){this.terminations=(this.terminations??0)+1;this.parent.emit('close');this.emit('exit',0);return 0;}
 }
 const host=compile('trust-key-host-client.cjs',{'node:worker_threads':{...threads,Worker:RamWorker}}),entry=compile('normal-sdk-worker-entry.cjs',{'./trust-key-host-client.cjs':host});
 return{host,entry,instances,owners,dependencies,deps};
}
test('고정 worker entry는 열린 package와 원 endpoint 안에서 등록 owner 하나를 처음 생성한다',async()=>{
 const f=isolatedWorkerFixture(),m=bootstrapCarrier(),context={origin:'https://project.invalid',identity:'view-1',authEpoch:2};
 // 같은 원 carrier fixture를 새 host 모듈에 그대로 연결한다. 실제 Worker/OS child는 0이다.
 const image=Buffer.from('synthetic-helper'),hash=createHash('sha256').update(image).digest('hex');
 const native=f.host.createSdkBootstrapClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:hash},helperHash:hash},{readImage:async()=>Buffer.from(image),companion:async()=>'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:()=>m.child});
 const original=await native.open(m.lease,4);await original.accept();
 const proxy=await f.entry.createSdkEnrollmentSession(original,{fetch:async()=>{assert.fail('unexpected HUMAN');}},()=>context,'1.0.0',async()=>{assert.fail('unexpected dialog');},()=>{});
 try{
  assert.equal(f.instances.length,1);assert.equal(f.owners.length,1);assert.equal(proxy.getState().contextEpoch,4);assert.equal(proxy.getState().phase,'IDLE');
  assert.equal(f.instances[0].file,'C:\\Anvil\\resources\\app.asar\\src\\normal-sdk-worker-entry.cjs');assert.deepEqual(f.instances[0].options.execArgv,[]);assert.deepEqual(f.instances[0].options.env,{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'});
  const pending=proxy.handle('trust-begin',{requestId:randomUUID(),epoch:4,confirmNewKey:true,label:'원 worker'});assert.equal(proxy.isBusy(),true);const result=await pending;
  assert.equal(result.ok,true);assert.equal(result.state.phase,'KEY_READY');assert.equal(proxy.getState().attemptId,f.owners[0].getState().attemptId);assert.equal(proxy.isBusy(),false);
  assert.equal((await proxy.handleReceive('native-receive-status',{attemptId:result.state.attemptId,epoch:4})).ok,false);
  assert.equal((await proxy.configuration('PREPARE',{attemptId:result.state.attemptId,epoch:4,selection:{}})).ok,false);
  await assert.rejects(f.host.launchSdkBootstrapWorker(original,{},context,'1.0.0'));assert.equal(f.instances.length,1);
 }finally{assert.equal((await proxy.close()).state,'CLOSED_CONFIRMED');}
});

async function openWorkerModel(session,directory=async()=>null,options={}){
 const f=isolatedWorkerFixture(options.closeState),m=bootstrapCarrier(),context=options.context??{origin:'https://project.invalid',identity:'view-1',authEpoch:2},image=Buffer.from('synthetic-helper'),hash=createHash('sha256').update(image).digest('hex');
 const native=f.host.createSdkBootstrapClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:hash},helperHash:hash},{readImage:async()=>Buffer.from(image),companion:async()=>'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:()=>m.child});
 const original=await native.open(m.lease,options.epoch??4);await original.accept();
 const proxy=await f.entry.createSdkEnrollmentSession(original,session,options.current??(()=>context),'1.0.0',directory,()=>{});
 return{...f,proxy,context};
}
function existingConfigurationFixture(){
 // 기존 설정 fixture의 원 정의만 RAM으로 재사용한다. 기존 시험/실제 파일 포트는 실행하지 않는다.
 const file=require.resolve('./normal-execution-configuration.test.cjs'),source=readFileSync(file,'utf8'),end=source.indexOf('function harness(');
 return new Function('require',source.slice(0,end)+'\nreturn fixture();')(require('node:module').createRequire(file));
}
test('원 worker 설정 client는 고정 HUMAN 두 GET과 원기한 폴더 대화만 main에 중계한다',async()=>{
 const fixture=existingConfigurationFixture(),calls=[];let dialog=0;
 const h=await openWorkerModel({fetch:async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');assert.equal(options.credentials,'include');return new Response(canonicalJson(fixture.views[calls.length-1]),{headers:{'content-type':'application/json'}});}},async lease=>{lease.check();dialog++;return'C:\\source';});
 try{const life=new AbortController(),lease={signal:life.signal,check:()=>{},expiresAt:Date.now()+3000},reader=await h.dependencies[0].createExecutionConfigurationClient(lease);
  const result=await reader.read(fixture.selection);assert.deepEqual(result.environment.snapshot,fixture.views[0].snapshot);assert.deepEqual(result.profile.snapshot,fixture.views[1].snapshot);assert.equal(calls.length,2);
  assert.equal(await h.dependencies[0].selectExecutionDirectory(lease),'C:\\source');assert.equal(dialog,1);assert.equal(h.owners.length,1);
  await assert.rejects(h.dependencies[0].selectExecutionDirectory({...lease,expiresAt:undefined}));assert.equal(dialog,1);
 }finally{assert.equal((await h.proxy.close()).state,'CLOSED_CONFIRMED');}
});
test('원 worker 폴더 대기 중 인증 세대가 바뀌면 늦은 선택을 폐기하고 원 채널을 회수한다',async()=>{
 let release,entered;const waiting=new Promise(resolve=>{entered=resolve;});
 const h=await openWorkerModel({fetch:async()=>assert.fail('GET0')},lease=>{lease.check();entered();return new Promise(resolve=>{release=resolve;});});
 const result=h.dependencies[0].selectExecutionDirectory({check:()=>{},expiresAt:Date.now()+3000});await waiting;h.context.authEpoch++;
 release('C:\\source');await assert.rejects(result);assert.equal((await h.proxy.close()).state,'CLOSED_CONFIRMED');assert.equal(h.instances.length,1);
});
test('원 worker HUMAN 첫 응답 중 문맥 상실은 두 번째 GET과 설정 채택을 막는다',async()=>{
 const fixture=existingConfigurationFixture();let h,calls=0;
 h=await openWorkerModel({fetch:async()=>{calls++;h.context.authEpoch++;return new Response(canonicalJson(fixture.views[0]),{headers:{'content-type':'application/json'}});}});
 const reader=await h.dependencies[0].createExecutionConfigurationClient({signal:new AbortController().signal,check:()=>{}});
 await assert.rejects(reader.read(fixture.selection));assert.equal(calls,1);assert.equal((await h.proxy.close()).state,'CLOSED_CONFIRMED');
});

function existingElectronFixture(){
 const s=readFileSync(require.resolve('./desktop-trust-registration.test.cjs'),'utf8'),start=s.indexOf('function electronFixture(){'),end=s.indexOf('async function until',start);
 return new Function('require','assert','EventEmitter',s.slice(start,end)+'return electronFixture();')(require,assert,EventEmitter);
}
async function shellModel(bootstrap){
 const e=existingElectronFixture(),f=isolatedWorkerFixture(),Module=require('node:module'),file=require.resolve('../../apps/desktop/src/shell.cjs'),m=new Module(file,module),base=Module.createRequire(file),owner=require('../../apps/desktop/src/trust-enrollment-owner.cjs');
 e.electron.app.getVersion=()=> '1.0.0';e.electron.session.fromPartition('persist:anvil-web').fetch=async()=>assert.fail('unexpected Session request');m.filename=file;m.paths=module.paths;m.require=id=>id==='node:fs/promises'?e.io:id==='./trust-enrollment-owner.cjs'?{...owner,createDesktopTrustDependencies:()=>({...f.deps}),createDesktopSdkEnrollmentSession:bootstrap}:base(id);m._compile(readFileSync(file,'utf8'),file);const shell=await m.exports.createShell(e.electron);
 const call=(name,input)=>{const w=e.windows[0].webContents;return e.handlers.get('anvil:'+name)({sender:w,senderFrame:w.mainFrame},input);};
 await call('connect',{serverOrigin:'https://project.invalid',replaceInvalidConfig:false});return{...e,shell,call};
}
test('shell은 원 KEY_READY 등록을 신규 SDK owner로 자동 교체하지 않는다',async()=>{
 let bootstraps=0;const h=await shellModel(async()=>{bootstraps++;return null;});let status=await h.call('trust-status',{attemptId:null,epoch:null});
 const first=await h.call('trust-begin',{requestId:randomUUID(),epoch:status.state.contextEpoch,confirmNewKey:true,label:'원 등록'});assert.equal(first.ok,true);assert.equal(first.state.phase,'KEY_READY');assert.equal(bootstraps,1);
 const second=await h.call('trust-begin',{requestId:randomUUID(),epoch:first.state.contextEpoch,confirmNewKey:true,label:'새 시도'});assert.equal(second.ok,false);assert.equal(bootstraps,1);
 status=await h.call('trust-status',{attemptId:first.state.attemptId,epoch:first.state.contextEpoch});assert.equal(status.state.attemptId,first.state.attemptId);
});
test('shell 인증 전환 중 늦은 bootstrap은 일반 등록을 재개하지 않고 새 owner도 채택하지 않는다',async()=>{
 let release,entered;const started=new Promise(resolve=>{entered=resolve;});let bootstraps=0;
 const h=await shellModel(async()=>{bootstraps++;entered();return new Promise(resolve=>{release=resolve;});});const status=await h.call('trust-status',{attemptId:null,epoch:null});
 const work=h.call('trust-begin',{requestId:randomUUID(),epoch:status.state.contextEpoch,confirmNewKey:true,label:'원 시도'});await started;
 await assert.rejects(h.call('client-quit',{ackUnverifiedRuntime:true}),/CLIENT_BUSY_OR_UNKNOWN/);assert.equal(h.quits(),0);
 h.sessions.get('persist:anvil-web').cookies.emit('changed');release(null);const result=await work;assert.equal(result.ok,false);assert.equal(result.error.code,'CONTEXT_CHANGED');
 const current=await h.call('trust-status',{attemptId:null,epoch:null});assert.equal(current.state.attemptId,null);assert.equal(current.state.phase,'IDLE');
 const retry=await h.call('trust-begin',{requestId:randomUUID(),epoch:current.state.contextEpoch,confirmNewKey:true,label:'새 시도'});assert.equal(retry.error.code,'OUTCOME_UNKNOWN');assert.equal(bootstraps,1);
});

test('shell 정상 종료는 신규 원 worker의 native close 후 두 endpoint와 worker를 한 번 회수한다',async()=>{
 let model;const h=await shellModel(async(_electron,session,current,epoch,directory)=>{model=await openWorkerModel(session,directory,{context:current(),current,epoch});return model.proxy;});
 const status=await h.call('trust-status',{attemptId:null,epoch:null}),begun=await h.call('trust-begin',{requestId:randomUUID(),epoch:status.state.contextEpoch,confirmNewKey:true,label:'고정 worker'});
 assert.equal(begun.ok,true,JSON.stringify({code:begun.error?.code,phase:begun.state?.phase,model:model?.proxy.getState().phase,epoch:model?.proxy.getState().contextEpoch}));assert.equal(begun.state.phase,'KEY_READY');assert.equal(model.owners.length,1);
 await h.call('client-quit',{ackUnverifiedRuntime:true});assert.equal(h.quits(),1);assert.equal(model.instances[0].terminations,1);assert.equal((await model.proxy.close()).state,'CLOSED_CONFIRMED');assert.equal(model.instances[0].terminations,1);
});
test('원 worker native close 불명은 정상 종료와 재발급을 열지 않는다',async()=>{
 const h=await openWorkerModel({fetch:async()=>assert.fail('GET0')},undefined,{closeState:'UNKNOWN'});
 const result=await h.proxy.handle('trust-begin',{requestId:randomUUID(),epoch:4,confirmNewKey:true,label:'종료 불명'});assert.equal(result.ok,false);assert.equal(h.proxy.getState().phase,'UNKNOWN');
 assert.equal((await h.proxy.close()).state,'UNKNOWN');assert.equal((await h.proxy.close()).state,'UNKNOWN');assert.equal(h.instances[0].terminations??0,0);
 assert.equal(h.proxy.getState().phase,'UNKNOWN');
 // 보존 판정 뒤 시험 소유 RAM MessagePort만 해제한다. 제품 close 재시도나 OS 회수가 아니다.
 h.instances[0].options.workerData.port.close();h.instances[0].options.workerData.registrationPort.close();h.instances[0].parent.emit('close');
});
test('고정 배포 profile이 없으면 shell bootstrap은 파일·원 worker·SDK를 열지 않는다',async()=>{
 let reads=0;const electron=new Proxy({}, {get(){reads++;assert.fail('no application observation');}});
 assert.equal(await require('../../apps/desktop/src/trust-enrollment-owner.cjs').createDesktopSdkEnrollmentSession(electron,null,()=>{assert.fail('no context');},1,()=>{assert.fail('no dialog');},()=>{}),null);assert.equal(reads,0);
});

test('복사한 endpoint·다른 port 또는 폐쇄한 native 채널은 고정 worker 생성0이다',async()=>{
 for(const kind of ['copy','port','closed']){
  const f=isolatedWorkerFixture(),m=bootstrapCarrier(),image=Buffer.from('synthetic-helper'),hash=createHash('sha256').update(image).digest('hex');
  const native=f.host.createSdkBootstrapClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',signerRef:{id:randomUUID(),version:1,contentHash:hash},helperHash:hash},{readImage:async()=>Buffer.from(image),companion:async()=>'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),uuid:randomUUID,spawn:()=>m.child});
  const original=await native.open(m.lease,4);await original.accept();const endpoint=f.host.createSdkBootstrapEndpoint(original);
  const other=new(require('node:worker_threads').MessageChannel)();try{if(kind==='closed')await original.close();await assert.rejects(f.host.launchSdkBootstrapWorker(original,kind==='copy'?{...endpoint}:kind==='port'?{...endpoint,port:other.port2}:endpoint,{origin:'https://project.invalid',identity:'view',authEpoch:1},'1.0.0'));assert.equal(f.instances.length,0);}finally{other.port1.close();other.port2.close();endpoint.close();await original.close();}
 }
});


test('원 등록 native SOURCE_PREPARE는 INSPECT와 분리된 실제 분할 입구에서 FIRST·C·원 slot을 다시 검산하고 소유 pins를 보유한다 · 정적',()=>{
 const host=read('apps/connector/native/DesktopTrustKeyHostSource.cs'),credential=read('apps/connector/native/NormalExecutionCredentialSource.cs'),configuration=read('apps/connector/native/NormalExecutionConfigurationSource.cs'),child=read('apps/connector/native/NormalSdkChildHostSource.cs');
 assert.match(host,/operation=="NORMAL_SDK_CHILD_SOURCE_PREPARE"/);assert.match(host,/normalExecution.ReceiveSdkChildSourcePart\(value,peer\)/);
 assert.match(credential,/return PrepareSdkChildSource\(request,peer\)/);
 const prepare=credential.slice(credential.indexOf('object PrepareSdkChildSource('),credential.indexOf('internal sealed class RowRequest'));
 assert.match(prepare,/InspectFirstSource\(request,record,slot,true\)/);assert.match(prepare,/source.PinFirst\(inspected,package\)/);
 assert.match(prepare,/NormalSdkChildHostSource.OriginalLease.Bind/);assert.match(prepare,/preparedSdkSource=lease/);assert.doesNotMatch(prepare,/CreateSuspended|ResumeThread|SIGN_|SignNormal/);
 assert.match(configuration,/internal string OriginalBindingHash/);assert.match(child,/internal sealed class OriginalLease/);
 assert.match(child,/SDK_CHILD_SOURCE_PREPARED/);assert.match(child,/childCreated",false/);assert.match(child,/executionAuthorized",false/);
 assert.match(child,/if\(failed\)\{lock\(unconfirmedLeases\)/);assert.match(child,/SDK_CHILD_SOURCE_CLEANUP_UNKNOWN/);assert.match(child,/재시작 소진 원장이 아니다/);
 assert.doesNotMatch(prepare,/SaveNormalOwned|CreateProcess|ResumeThread|Append\(/);
 assert.match(host,/args.Length==1&&args\[0\]=="--normal-sdk-child"/);
 assert.match(host,/DesktopTrustKeyPeerSource.OpenSdkSupervisor[\s\S]*DesktopTrustKeyRootSource.OpenExistingForSdkSupervisor/);
 const reader=host.slice(host.indexOf('internal async Task<int> RunUnderstandingReaderAsync'),host.indexOf('// FN07 B:'));assert.doesNotMatch(reader,/OpenSdkSupervisor|OpenExistingForSdkSupervisor/);
 const inspect=credential.slice(credential.indexOf('internal object InspectSdkFirst('),credential.indexOf('object PrepareSdkChildSource('));
 assert.match(inspect,/SDK_CONFIGURATION_UNAVAILABLE/);assert.doesNotMatch(inspect,/OriginalLease.Bind|preparedSdkSource=/);
});


test('실제 private host source 준비는 같은 원바이트만 native에 분할 송신하고 비실행 opaque 결과·단회·UNKNOWN를 보존한다 · RAM',async()=>{
 for(const kind of ['NORMAL','HASH','AUTHORITY','PART','UNKNOWN','EXPIRES']){
  const raw={attemptId:randomUUID(),slotId:randomUUID(),startCommandId:randomUUID(),sendCommandId:randomUUID(),scope:{fixture:'scope-only'},handoff:{fixture:'C-source-only',padding:'x'.repeat(40000)}};
  const body=Buffer.from(canonicalJson(raw)),sourceHash=createHash('sha256').update(body).digest('hex');let offset=0,parts=0;
  const fixture=bootstrapCarrier(x=>x,true),frames=[];
  fixture.child.stdin.write=(bytes,encoding,callback)=>{
   const f=JSON.parse(bytes.toString());frames.push(f);assert.equal(f.operation,'NORMAL_SDK_CHILD_SOURCE_PREPARE');const p=f.payload;assert.equal(p.contentHash,sourceHash);assert.equal(p.index,parts++);assert.equal(p.attemptId,raw.attemptId);assert.equal(p.slotId,raw.slotId);const decoded=Buffer.from(p.data,'base64');assert.deepEqual(decoded,body.subarray(offset,offset+decoded.length));offset+=decoded.length;
   const data=p.final?{state:'SDK_CHILD_SOURCE_PREPARED',leaseId:randomUUID(),sourceHash:kind==='HASH'?'f'.repeat(64):sourceHash,bindingHash:'b'.repeat(64),expiresAt:kind==='EXPIRES'?new Date(Date.now()+1000).toISOString():fixture.lease.callExpiresAt(),childCreated:false,executionAuthorized:kind==='AUTHORITY',dispatchPerformed:false}:{state:'PART_ACCEPTED',transferId:kind==='PART'?randomUUID():p.transferId,index:p.index};
   if(p.final&&kind==='UNKNOWN')data.state='UNKNOWN';
   queueMicrotask(()=>{callback();fixture.child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:f.requestId,sequence:f.sequence,rootIdentity:'SDK_FIXTURE_ROOT',data})+'\n'));});return true;
  };
  const channel=await fixture.client.open(fixture.lease);let source;
  try{
   if(['HASH','AUTHORITY','PART','UNKNOWN'].includes(kind)){await assert.rejects(channel.prepareSdkChildSource(raw),/OUTCOME_UNKNOWN/);const sent=frames.length;await assert.rejects(channel.prepareSdkChildSource(raw));assert.equal(frames.length,sent);}
   else{source=await channel.prepareSdkChildSource(raw);assert.equal(source.read().sourceHash,sourceHash);assert.equal(source.read().executionAuthorized,false);assert.equal(source.read().childCreated,false);assert.equal(offset,body.length);assert.equal(parts,2);await assert.rejects(channel.prepareSdkChildSource(raw));assert.deepEqual(Object.keys(source),['read']);assert.equal('handoff' in source.read(),false);
    if(kind==='EXPIRES'){const now=Date.now;try{const end=Date.parse(source.read().expiresAt);Date.now=()=>end;assert.throws(()=>source.read(),/PROTECTION_UNAVAILABLE/);}finally{Date.now=now;}}
   }
   assert.equal(frames.some(f=>f.operation==='NORMAL_SDK_FIRST_INSPECT'),false);
  }finally{await channel.close();body.fill(0);}
  if(source)assert.throws(()=>source.read());
 }
});


test('원 FIRST 전용 source→native 감독 준비→broker ACK→원 host 물리 close→opposite 소비는 실제 CJS와 TS를 단회 연결한다 · RAM',async()=>{
 const {prepareNormalSdkChildHandoff}=await import('../../apps/connector/runtime/normal-owned-spool-profile.ts');
 for(const kind of ['OK','CROSS','EXPIRED','ACK','CLOSE','EARLY','DUPLICATE','LOST','STALE']){
  const trace=[];let spawned=0,socket,sourceHash,metadata,requested,sequence=0,current=true;
  const endpointId=randomUUID(),leaseId=randomUUID(),bindingHash='b'.repeat(64),ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)}),signal=new AbortController();
  const fixture=bootstrapCarrier(x=>x,true,{spawned:()=>spawned++,openSdkBroker:name=>{
   trace.push('BROKER_CONNECT');assert.equal(name,['','','.','pipe','anvil-sdk-'+endpointId].join(String.fromCharCode(92)));
   socket=new EventEmitter();socket.destroy=()=>{trace.push('BROKER_CLOSE');};
   socket.write=(bytes,callback)=>{const ack=JSON.parse(bytes.toString());trace.push('BROKER_ACK');assert.equal(ack.purpose,'NORMAL_SDK_BROKER_ACK_V1');
    queueMicrotask(()=>{callback();if(kind==='LOST'){signal.abort();return;}socket.emit('data',Buffer.from(canonicalJson({...ack,purpose:kind==='ACK'?'BAD_ACK':'NORMAL_SDK_BROKER_ACKED_V1',endpointId:kind==='ACK'?randomUUID():endpointId})+'\n'));});return true;};return socket;
  }});
  const end=fixture.lease.callExpiresAt(),slot={slotId:randomUUID(),receiptRef:ref(),expiresAt:end};
  const scope={slotRef:slot.receiptRef,plannedSidDigest:createHash('sha256').update(canonicalJson('synthetic-sid')).digest('hex')};
  const handoff={startEnvelope:{commandId:randomUUID()},sendEnvelope:{commandId:randomUUID()},grantRef:ref(),startReadyRef:ref(),localAttemptRef:ref(),dispatchAttemptRef:ref(),permit:{expiresAt:end},proofResultRef:ref(),scope,executionAuthority:{fixture:'native-independent-first-validation'},plannedSid:'synthetic-sid'};
  const attemptId=randomUUID();
  fixture.child.stdin.write=(bytes,encoding,callback)=>{
   const f=JSON.parse(bytes.toString());sequence++;trace.push(f.operation);let data;
   if(f.operation==='NORMAL_SDK_CHILD_SOURCE_PREPARE'){
    sourceHash=f.payload.contentHash;assert.equal(f.payload.final,true);requested=JSON.parse(Buffer.from(f.payload.data,'base64').toString());assert.deepEqual(requested.handoff,handoff);
    data={state:'SDK_CHILD_SOURCE_PREPARED',leaseId,sourceHash,bindingHash,expiresAt:end,childCreated:false,executionAuthorized:false,dispatchPerformed:false};
   }else if(f.operation==='NORMAL_SDK_CHILD_SUPERVISOR_BEGIN'){
    metadata={state:'SDK_SUPERVISOR_ENDPOINT',leaseId,endpointId,pipeName:['','','.','pipe','anvil-sdk-'+endpointId].join(String.fromCharCode(92)),sourceHash:kind==='CROSS'?'c'.repeat(64):sourceHash,bindingHash,expiresAt:kind==='EXPIRED'?new Date(Date.now()-1).toISOString():end,childCreated:false,executionAuthorized:false,dispatchPerformed:false};data=metadata;
   }else{assert.equal(f.operation,'NORMAL_SDK_CHILD_SUPERVISOR_ACK');trace.push('NATIVE_INDEPENDENT_ACK');data={state:'SDK_SUPERVISOR_ACKNOWLEDGED',leaseId,endpointId,sourceHash,bindingHash};}
   queueMicrotask(()=>{callback();fixture.child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:f.requestId,sequence:f.sequence,rootIdentity:'SDK_FIXTURE_ROOT',data})+'\n'));});return true;
  };
  fixture.child.stdin.end=()=>{trace.push('HOST_END');queueMicrotask(()=>{fixture.child.emit('close',kind==='CLOSE'?1:0);trace.push('HOST_CLOSED');if(kind==='STALE')current=false;if(socket&&kind!=='CLOSE')queueMicrotask(()=>socket.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:kind==='EARLY'?'NORMAL_SDK_BROKER_ACKED_V1':'NORMAL_SDK_BROKER_CONSUMED_V1',leaseId,endpointId,sourceHash,bindingHash})+'\n')));});};
  let prepared,channel;
  const factory={open:async()=>{channel=await fixture.client.open(fixture.lease);return{send:channel.send,close:channel.close,prepareSdkChildSource:async raw=>{
   const own=await channel.prepareSdkChildSource(raw);prepared=await channel.beginSdkChildSupervisor(own);return prepared;
  }};}};
  const ports={attemptId,slot,host:factory,now:Date.now,signal:signal.signal,check(){if(!current)throw Error('CONTEXT_CHANGED');}};
  if(['OK','DUPLICATE'].includes(kind)){
   const owner=await prepareNormalSdkChildHandoff(handoff,ports);assert.equal(owner.read().sourceHash,sourceHash);assert.equal(owner.read().childCreated,false);assert.equal('handoff'in owner.read(),false);
   assert(trace.indexOf('NATIVE_INDEPENDENT_ACK')<trace.indexOf('HOST_END'));assert(trace.indexOf('HOST_CLOSED')>trace.indexOf('HOST_END'));
   if(kind==='DUPLICATE'){const n=sequence;await assert.rejects(prepared.acknowledge());await assert.rejects(prepared.afterClose());await assert.rejects(prepareNormalSdkChildHandoff(handoff,ports));assert.equal(sequence,n);}
   assert.deepEqual(await owner.close(),{state:'UNKNOWN'});assert.throws(()=>owner.read());
  }else await assert.rejects(prepareNormalSdkChildHandoff(handoff,ports));
  assert.equal(spawned,1);assert.equal(trace.some(x=>/CLI|SPAWN|RESUME/.test(x)),false);assert.equal(trace.filter(x=>x==='NORMAL_SDK_CHILD_SUPERVISOR_BEGIN').length,1);
  await channel?.close();
 }
});


test('SDK 감독의 원 host·peer·job·기한·회수는 전용 source에만 있으며 일반 read와 CLI 실행은 열지 않는다 · 정적',()=>{
 const peer=read('apps/connector/native/DesktopTrustKeyPeerSource.cs'),root=read('apps/connector/native/DesktopTrustKeyRootSource.cs'),child=read('apps/connector/native/NormalSdkChildHostSource.cs'),host=read('apps/connector/native/DesktopTrustKeyHostSource.cs'),credential=read('apps/connector/native/NormalExecutionCredentialSource.cs'),runtime=read('apps/connector/runtime/normal-owned-spool-profile.ts');
 assert.match(peer,/OpenSdkSupervisor[\s\S]*lease.sdkSupervisor=true[\s\S]*!lease.CleanupSettled[\s\S]*sdkUnknown.Add/);
 assert.match(peer,/if\(understandingReader\|\|sdkSupervisor\)[\s\S]*UnderstandingChain\(own,delegatingInstance,parentInstance,kernel.ParentPid\(self\),kernel.ParentPid\(delegatingParent\)\)/);
 assert.match(peer,/if\(original.Alive\)return false[\s\S]*GetExitCodeProcess\(delegatingParent,out code\)\|\|code!=0[\s\S]*sdkAccepted=true/);
 assert.match(root,/OpenExistingForSdkSupervisor[\s\S]*OpenRoot\(kernel,budget,true,true\)/);assert.match(root,/if\(!result.CleanupSettled\)[\s\S]*sdkUnknownRoots.Add/);
 assert.match(child,/internal sealed class OriginalLease[\s\S]*sealed class SupervisorProcess[\s\S]*const uint Suspended/);
 assert.match(child,/var inherited=new\[\]\{inputRead,outputWrite,errorWrite,broker,job\}/);
 assert.match(child,/0x0002000D[\s\S]*CreateProcessW\(image,[\s\S]*Suspended\|UnicodeEnvironment\|ExtendedStartup\|NoWindow/);
 assert.match(child,/GetNamedPipeClientProcessId\(broker,out pid\)&&pid==expected/);
 assert.match(child,/if\(acknowledged\|\|!created\)[\s\S]*lock\(unknownOwners\)[\s\S]*throw Unknown/);
 assert.match(credential,/BindSdkSupervisorDeadline[\s\S]*!peer.IsSdkSupervisor[\s\S]*value!=budget.ExpiresAt/);
 assert.match(credential,/sdkSupervisorDeadline.Value>inspected.ExpiresAt[\s\S]*sdkSupervisorDeadline.Value>At\(slot,"expiresAt"\)/);
 const supervisor=host.slice(host.indexOf('internal async Task<int> RunSdkChildSupervisorAsync'),host.indexOf('// 등록 전 전용 pipe'));
 assert.match(supervisor,/CheckSdkDelegation[\s\S]*CheckSupervisorHandles[\s\S]*ReceiveSdkChildSourcePart[\s\S]*VerifyDelegatedSdkSource[\s\S]*CheckBrokerClient/);
 assert.match(supervisor,/while\(!peer.AcceptSdkOriginalClose\(\)\)[\s\S]*NORMAL_SDK_BROKER_CONSUMED_V1/);
 assert.doesNotMatch(supervisor,/CreateSuspended|NORMAL_EXECUTION_CALL|SignProof|IssueChildLease/);
 assert.match(runtime,/finally\{if\(this.#sdkFirstOwner\)\{this.#unknown=true;await this.#sdkFirstOwner.close\(\);\}\}[\s\S]*SDK_CONFIGURATION_UNAVAILABLE/);
 assert.match(read('apps/desktop/src/trust-enrollment-owner.cjs'),/budget.frames<Math.ceil\(bytes.length\/32768\)\+2/);
 assert.doesNotMatch(read('apps/desktop/src/trust-key-host-client.cjs'),/spawn[^\n]*--normal-sdk-child/);
});
