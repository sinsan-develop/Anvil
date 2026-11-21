import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = (name: string) => readFileSync(new URL('../../../apps/connector/native/' + name, import.meta.url), 'utf8');

test('FN09 reader 감독은 원 handle 종료와 보호 원장 재검산 후에만 봉인한다 (정적)', () => {
  const supervisor = source('NormalUnderstandingReadSupervisorSource.cs');
  assert.match(supervisor, /WaitForSingleObject/);
  assert.match(supervisor, /GetExitCodeProcess/);
  assert.doesNotMatch(supervisor, /Process\.GetProcessById|TerminateProcess|ProtectedStore|SignNativeOwned/);
  const profile = source('NormalExecutionSpoolProfileSource.cs');
  assert.match(profile, /OpenExistingForUnderstanding/);
  assert.match(profile, /ReadDelegatedUnderstanding/);
  assert.match(profile, /FinishSupervisedUnderstanding/);
});

// C#을 실행/컴파일하지 않는다. 실제 source의 순수 조건식만 RAM으로 대조한다.
test('원 stdin 닫힘/양 stdout 끝/원 process exit0/원 handle 회수 중 하나라도 없으면 봉인 불가 (source RAM)', () => {
  const text = source('NormalUnderstandingReadSupervisorSource.cs');
  const expression = text.match(/internal static bool ClosedFacts\([^)]*\)\{\s*return ([^;]+);/)?.[1];
  assert.ok(expression);
  const closed = new Function('inputClosed', 'stdoutEnded', 'stderrEnded', 'stderrBytes', 'signaled', 'exitCode', 'handlesClosed', 'return ' + expression);
  assert.equal(closed(true, true, true, 0, true, 0, true), true);
  for (const at of [0, 1, 2, 4, 6]) {
    const facts: (number | boolean)[] = [true, true, true, 0, true, 0, true]; facts[at] = false;
    assert.equal(closed(...facts), false, String(at));
  }
  assert.equal(closed(true, true, true, 1, true, 0, true), false);
  for (const exit of [1, 259, 0xe1000002]) assert.equal(closed(true, true, true, 0, true, exit, true), false);
  const writer = text.slice(text.indexOf('var write=Task.Run'), text.indexOf('readTask=Task.Run'));
  assert.ok(writer.indexOf('Close(ref stdinWrite)') < writer.indexOf('inputClosed=true'));
  assert.match(writer, /input\.Dispose\(\);\}finally\{Close\(ref stdinWrite\)/);
  assert.ok(text.indexOf('Wait(io)') > text.indexOf('var write=Task.Run'));
  assert.ok(text.indexOf('new ClosedRead') > text.indexOf('child.Run(input)'));
});

test('동일 설치 native parent/원 Anvil/실제 ancestry가 아닌 PID·이미지·birth·죽은 peer는 거절 (source RAM)', () => {
  const text = source('DesktopTrustKeyPeerSource.cs');
  const expression = text.match(/internal static bool UnderstandingChain\([^)]*\)\{\s*return ([^;]+);/)?.[1];
  assert.ok(expression);
  const chain = new Function('own', 'supervisor', 'anvil', 'actualParent', 'actualRoot', 'sameImage',
    'return ' + expression.replace('String.Equals(supervisor.Image,own.Image,StringComparison.OrdinalIgnoreCase)', 'sameImage(supervisor.Image,own.Image)'));
  const anvil = { Pid: 1, Created: 100, Alive: true, Image: 'C:\\Anvil\\Anvil.exe' };
  const supervisor = { Pid: 2, Created: 200, Alive: true, Image: 'C:\\Anvil\\TrustHost.exe' };
  const own = { Pid: 3, Created: 300, Alive: true, Image: supervisor.Image };
  const invoke = (o = own, s = supervisor, a = anvil, p = 2, r = 1) => chain(o, s, a, p, r, (x: string, y: string) => x.toLowerCase() === y.toLowerCase());
  assert.equal(invoke(), true);
  for (const changed of [{ ...own, Alive: false }, { ...own, Pid: 2 }, { ...own, Created: 199 }, { ...own, Image: 'C:\\other\\TrustHost.exe' }]) assert.equal(invoke(changed), false);
  assert.equal(invoke(own, { ...supervisor, Alive: false }), false);
  assert.equal(invoke(own, supervisor, { ...anvil, Alive: false }), false);
  assert.equal(invoke(own, supervisor, { ...anvil, Created: 201 }), false);
  assert.equal(invoke(own, supervisor, anvil, 4, 1), false);
  assert.equal(invoke(own, supervisor, anvil, 2, 4), false);
  assert.match(text, /kernel\.PipeFlags\(input\)!=0\|\|kernel\.PipeFlags\(output\)!=0/);
  assert.match(text, /kernel\.ParentPid\(delegatingParent\)!=parentInstance\.Pid/);
  assert.match(text, /Same\(delegatingInstance,kernel\.Process\(delegatingParent\)\)/);
});

test('reader만 고정 exact 입력을 소비하며 create/key/일반 Dispatch 없이 원 root/원 Log를 닫는다 (정적)', () => {
  const host = source('DesktopTrustKeyHostSource.cs');
  const reader = host.slice(host.indexOf('internal async Task<int> RunUnderstandingReaderAsync'), host.indexOf('// 등록 전 전용 pipe'));
  assert.match(reader, /OpenUnderstandingReader\(basis,kernel,budget\)/);
  assert.match(reader, /CheckUnderstandingDelegation/);
  assert.ok(reader.indexOf('byte[] tail=await Frame()') < reader.indexOf('OpenExistingForUnderstanding'));
  assert.match(reader, /Exact\(f,"schemaVersion,purpose,supervisorPid,supervisorCreated,anvilPid,anvilCreated,helperHash,expiresAt,remainingMs,read"\)/);
  assert.ok(reader.indexOf('root.Dispose()') < reader.indexOf('await Reply(reply)'));
  assert.doesNotMatch(reader, /store=|Dispatch\(|ProtectedStore\.|IssueFreshRoot|\.Control\(/);
  assert.match(reader, /if\(!peer.CleanupSettled\)unknown=true/);
  const root = source('DesktopTrustKeyRootSource.cs');
  assert.match(root, /OpenExistingForUnderstanding[^\n]+OpenRoot\(kernel,budget,true\)/);
  assert.match(root, /if\(!fact.Exists\)\{if\(existingOnly\)throw Invalid\(\)/);
  assert.match(root, /if\(create&&\(existingOnly\|\|/);
  const profile = source('NormalExecutionSpoolProfileSource.cs');
  assert.match(profile, /understandingReadOnly\?FileAccess.Read:FileAccess.ReadWrite,FileShare.None/g);
  assert.match(profile, /void Append\([^\n]+\)\{\s*if\(understandingReadOnly\)throw Invalid\(\)/);
});

test('private Job/방향별 client pipes exact3만 상속, 부분 원 process는 UNKNOWN에 남긴다 (정적)', () => {
  const text = source('NormalUnderstandingReadSupervisorSource.cs');
  assert.match(text, /Flags=0x2000\|0x8,ActiveProcessLimit=1/);
  assert.match(text, /new IntPtr\(0x0002000D\),jobList/);
  assert.match(text, /new IntPtr\(0x00020002\),handleList,new UIntPtr\(\(uint\)\(IntPtr.Size\*3\)\)/);
  assert.match(text, /CreateNamedPipeW\(name,\(parentWrites\?2u:1u\)\|0x00080000u,8,1,/);
  assert.match(text, /CreateFileW\(name,parentWrites\?0x80000000u:0x40000000u,0,ref attributes,3,0x40000000u/);
  assert.doesNotMatch(text, /CreatePipe\(|TerminateProcess\(|Process\.Start\(|OpenProcess\(/);
  assert.match(text, /if\(created\)\{lock\(unknownOwners\)/);
  const late = text.slice(text.indexOf('async Task RetainUntilClosed()'), text.indexOf('[StructLayout', text.indexOf('async Task RetainUntilClosed()')));
  assert.doesNotMatch(late, /CleanupSettled=true|new ClosedRead|Consume\(/);
  assert.match(late, /WaitForSingleObject\(original.Process,UInt32.MaxValue\)/);
});

test('정상 START 이후 잠금 해제→child 원 종료→재잠금 동일 ledger/refs/expiry 검산→CLOSED 순서 (정적)', () => {
  const text = source('NormalExecutionSpoolProfileSource.cs');
  const control = text.slice(text.indexOf('internal Row Control('));
  assert.ok(control.indexOf('});if(timing!=null)') < control.indexOf('understandingSupervisor.Read(answer)'));
  assert.match(control, /PendingUnderstanding\(rows,id\)/);
  assert.match(control, /var closed=understandingSupervisor.Read\(answer\);return FinishSupervisedUnderstanding\(answer,closed,understandingFinal\)/);
  const finish = text.slice(text.indexOf('Row FinishSupervisedUnderstanding('), text.indexOf('// 이 함수는 현재 열린 할당'));
  assert.ok(finish.indexOf('understandingSupervisor.Consume') < finish.indexOf('Log(false'));
  assert.ok(finish.indexOf('CheckDelegatedSnapshot') < finish.indexOf('UNDERSTANDING_READ_CLOSED'));
  const gate = text.slice(text.indexOf('void CheckDelegatedSnapshot'), text.indexOf('// 고정 reader 모드만'));
  for (const field of ['rootIdentity', 'namespaceIdentity', 'profileId', 'logIdentity', 'anchorIdentity', 'ledgerSequence', 'ledgerTail', 'recordHash', 'slotHash', 'pickupHash', 'startedHash', 'summaryHash', 'directoryIdentity', 'requestRef', 'acquisitionRef', 'expiresAt']) assert.ok(gate.includes('"' + field + '"'), field);
  assert.match(gate, /Has\(rows,"UNDERSTANDING_READ_CLOSED",key\)/);
  assert.match(text, /MaxEntry=32768/);
  assert.match(text, /AdminCap=64\*MiB/);
  assert.match(finish, /"readerProcess",closed.OriginalProcessEvidence/);
});

test('child 전달 readBasis는 원 record/slot hash와 exact 메타만: bearer/full record/여분 credential 키 제외 (source RAM)', () => {
  const text = source('NormalExecutionSpoolProfileSource.cs');
  const method = text.slice(text.indexOf('static Row UnderstandingReadBasis('), text.indexOf('static void ReadBasisShape('));
  const expression = method.match(/return (R\([\s\S]*?\));\s*\}/)?.[1]; assert.ok(expression);
  const project = new Function('record', 'slot', 'allocation', 'reg', 'scope', 'end', 'R', 'H', 'S', 'Ref',
    'return ' + expression.replaceAll('DesktopTrustKeyHostSource.Ref', 'Ref').replace(/end\.ToString\([^)]*\)/, 'end'));
  const refs = { id: 'ref', version: 1, contentHash: 'a'.repeat(64) };
  const record = { attemptId: 'attempt', secret: 'never-record', registration: { installationId: 'install', registrationRef: refs } };
  const slot = { slotId: 'slot', credential: 'never-fixture', receiptRef: refs, scope: { projectId: 'project', connectorId: 'connector', executionId: 'execution', executionGeneration: 4, grantRef: refs } };
  const row = (...pairs: unknown[]) => Object.fromEntries(Array.from({ length: pairs.length / 2 }, (_, i) => [pairs[i * 2] as string, pairs[i * 2 + 1]]));
  const result = project(record, slot, { key: 'allocation-hash' }, record.registration, slot.scope, 'expiry', row,
    (v: unknown) => v === record ? 'original-record-hash' : 'original-slot-hash', (v: Record<string, unknown>, k: string) => v[k], (v: unknown) => v);
  assert.equal(result.recordHash, 'original-record-hash'); assert.equal(result.slotHash, 'original-slot-hash');
  assert.equal(JSON.stringify(result).includes('never-'), false);
  assert.equal('record' in result || 'slot' in result || 'credential' in result, false);
  const shape = text.slice(text.indexOf('static void ReadBasisShape('), text.indexOf('Row BeginSupervisedUnderstanding('));
  const keys = shape.match(/Exact\(basis,"([^"]+)"\)/)?.[1]?.split(','); assert.ok(keys);
  assert.deepEqual(Object.keys(result).sort(), [...keys].sort());
  assert.equal(Object.keys({ ...result, credential: slot.credential }).every(k => keys.includes(k)), false);
  const begin = text.slice(text.indexOf('Row BeginSupervisedUnderstanding('), text.indexOf('void CheckDelegatedSnapshot('));
  assert.match(begin, /"readBasis",basis/);
  assert.doesNotMatch(begin, /return R\("record",record|"slot",slot/);
  assert.match(text, /J\(started\["readBasis"\]\)!=J\(basis\)/);
  assert.match(text, /"recordHash"\)\!=S\(basis,"recordHash"\)/);
});

test('미완결 이전 read는 새 slot/기한 뒤에도 같은 execution generation의 새 pickup을 막는다 (source RAM)', () => {
  const text = source('NormalExecutionSpoolProfileSource.cs');
  const expression = text.match(/static bool SameUnderstandingGeneration\([^)]*\)\{return ([^;]+);/)?.[1]; assert.ok(expression);
  const same = new Function('a', 'b', 'S', 'N', 'return ' + expression);
  const original = { projectId: 'p', executionId: 'e', executionGeneration: 2, slotHash: 'old', expiresAt: 100 };
  const renewed = { ...original, slotHash: 'new', expiresAt: 10000 };
  const check = (b: typeof original) => same(original, b, (v: Record<string, unknown>, k: string) => v[k], (v: unknown) => v);
  assert.equal(check(renewed), true);
  assert.equal(check({ ...renewed, executionGeneration: 3 }), false);
  assert.equal(check({ ...renewed, executionId: 'other' }), false);
  const gate = text.slice(text.indexOf('static bool UnfinishedUnderstandingGeneration('), text.indexOf('internal void BindUnderstandingPickup('));
  assert.match(gate, /UNDERSTANDING_READ_STARTED/);
  assert.match(gate, /ended.Count!=1/);
  assert.match(gate, /"pickupHash"\)!=H\(pickup\)/);
  assert.doesNotMatch(gate, /DateTime.UtcNow|slotHash/);
  const bind = text.slice(text.indexOf('internal void BindUnderstandingPickup('), text.indexOf('Row ReadUnderstandingRow('));
  assert.ok(bind.indexOf('if(pickup!=null)') < bind.indexOf('UnfinishedUnderstandingGeneration(rows,context)'));
  assert.ok(bind.indexOf('UnfinishedUnderstandingGeneration(rows,context)') < bind.indexOf('Append(log,rows'));
});

test('locked pickup/credential/registration/slot의 최솟값을 부모·child·최종 close까지 단축한다 (source RAM)', () => {
  const profile = source('NormalExecutionSpoolProfileSource.cs'), supervisor = source('NormalUnderstandingReadSupervisorSource.cs'), peer = source('DesktopTrustKeyPeerSource.cs');
  const begin = profile.slice(profile.indexOf('Row BeginSupervisedUnderstanding('), profile.indexOf('void CheckDelegatedSnapshot('));
  assert.ok(begin.indexOf('TightenRead') < begin.indexOf('Inspect(rows'), '원 본문 접근 전에 기한 축소');
  assert.ok(begin.indexOf('TightenRead') < begin.indexOf('Append(log,rows,started)'));
  assert.match(profile, /DateTime end=new\[\]\{DesktopTrustKeyHostSource.Time\(pickup,"expiresAt"\),DesktopTrustKeyHostSource.Time\(slot,"expiresAt"\),DesktopTrustKeyHostSource.Time\(reg,"registrationExpiresAt"\),DesktopTrustKeyHostSource.Time\(credential,"expiresAt"\)\}.Min\(\)/);
  assert.ok(supervisor.indexOf('TightenRead(DesktopTrustKeyHostSource.Time') < supervisor.indexOf('child.Run(input)'));
  assert.match(supervisor, /budget.Tighten\(expires,budget.Remaining\(\)\)/);
  let body = peer.match(/void BoundObserved\(\)\{([^\n]+)\}/)?.[1]; assert.ok(body);
  body = body.replaceAll('Math.Min', 'Math.min').replaceAll('Math.Floor', 'Math.floor').replaceAll('Milliseconds(expiry)', 'expiry')
    .replaceAll('Double.IsNaN(value)', 'Number.isNaN(value)').replaceAll('Double.IsInfinity(value)', '!Number.isFinite(value)')
    .replace('double value=', 'let value=').replace('throw DesktopTrustKeyParentBasisSource.Invalid()', 'throw Error("EXPIRED")')
    .replace('remaining=(int)', 'let remaining=');
  const bound = new Function('deadline', 'observedMono', 'expiry', 'effectiveMilliseconds', 'rawLast', body + ';return {deadline,remaining};');
  assert.deepEqual(bound(10000, 0, 100, 0, 0), { deadline: 100, remaining: 100 });
  assert.deepEqual(bound(100, 50, 100, 50, 0), { deadline: 100, remaining: 50 });
  assert.throws(() => bound(100, 100, 100, 100, 0), /EXPIRED/, 'wall 정체에도 원 100ms 초과 거절');
  assert.throws(() => bound(100, 10, 100, 101, 101), /EXPIRED/, '원 절대기한 초과 거절');
});

test('final spool lock 안에서 원 parent 등록·slot을 재검산하고 reader의 실제 fd final path를 제한한다 (정적)', () => {
  const credential = source('NormalExecutionCredentialSource.cs'), profile = source('NormalExecutionSpoolProfileSource.cs');
  const spool = credential.slice(credential.indexOf('internal object Spool('), credential.indexOf('internal object Dispatch('));
  assert.match(spool, /operation=="NORMAL_SPOOL_CLOSE"&&S\(value,"writer"\)=="NORMAL_EXECUTION"&&value.ContainsKey\("understanding"\)/);
  assert.match(spool, /var live=Record\(attempt\);if\(H\(live\)!=recordHash\|\|H\(LoadSlot\(slotId,live\)\)!=slotHash\)throw Invalid\(\)/);
  const finish = profile.slice(profile.indexOf('Row FinishSupervisedUnderstanding('), profile.indexOf('// 이 함수는 현재 열린 할당'));
  assert.ok(finish.indexOf('Log(false') < finish.indexOf('liveParent()'));
  assert.ok(finish.indexOf('liveParent()') < finish.indexOf('Append(log,rows'));
  assert.ok(finish.lastIndexOf('liveParent()') > finish.indexOf('Append(log,rows'));
  const identity = profile.slice(profile.indexOf('string FileIdentity('), profile.indexOf('// 모든 writer'));
  assert.match(identity, /if\(understandingReadOnly\)/);
  assert.match(identity, /GetFinalPathNameByHandleW\(f.SafeFileHandle.DangerousGetHandle/);
  assert.match(identity, /expected.StartsWith\(root.PathValue\+Path.DirectorySeparatorChar/);
  assert.match(identity, /String.Equals\(observed,expected,StringComparison.OrdinalIgnoreCase\)/);
});

test('source build list는 기존 30행을 유지하고 한 reader 감독만 추가한다', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { SOURCE_FILES } = require('../../../apps/desktop/scripts/desktop-trust-key-host-build.cjs') as { SOURCE_FILES: string[] };
  assert.equal(SOURCE_FILES.length, 31);
  assert.equal(SOURCE_FILES.filter(p => p.endsWith('/NormalUnderstandingReadSupervisorSource.cs')).length, 1);
  assert.equal(new Set(SOURCE_FILES).size, SOURCE_FILES.length);
});


test('CLOSED는 기존 binding owner lock을 spool final lock 밖에서 보유하고 원 snapshot만 소비한다 (정적)', () => {
  const store = source('DesktopTrustKeyBindingStoreSource.cs'), host = source('DesktopTrustKeyHostSource.cs');
  const guard = store.slice(store.indexOf('internal Dictionary<string,object> WithUnderstandingReadGuard('), store.indexOf('// 일반 Read는'));
  assert.ok(guard.includes('using(io.Lock())'));
  assert.ok(guard.indexOf('ReadOwned()') < guard.indexOf('complete(record)'));
  assert.ok(guard.lastIndexOf('ReadOwned()') > guard.indexOf('complete(record)'));
  assert.doesNotMatch(guard, /WriteNext|Replace\(|Protect\(/);
  assert.match(host, /store.WithUnderstandingReadGuard/);
  const profile = source('NormalExecutionSpoolProfileSource.cs');
  const finish = profile.slice(profile.indexOf('Row FinishSupervisedUnderstanding('), profile.indexOf('// 이 함수는 현재 열린 할당'));
  assert.ok(finish.indexOf('return finalGuard(') < finish.indexOf('Log(false'));
  const credential = source('NormalExecutionCredentialSource.cs');
  assert.match(credential, /understandingGuard\(attempt,recordHash,live=>/);
  assert.match(credential, /ValidateUnderstandingRecord\(live,attempt,recordHash,slotId,slotHash\)/);
});


test('원 binding guard의 회수·snapshot 교체는 CLOSED callback 전에 거절하고 원 등록만 허용한다 (source RAM)', () => {
  const store = source('DesktopTrustKeyBindingStoreSource.cs');
  const method = store.slice(store.indexOf('internal Dictionary<string,object> WithUnderstandingReadGuard('), store.indexOf('// 일반 Read는'));
  const condition = method.match(/if\((record==null\|\|[^\n]+?)\)throw Invalid\(\);/)?.[1]; assert.ok(condition);
  const rejected = new Function('record', 'expectedRecordHash', 'Digest', 'Text', 'return ' + condition.replaceAll('DesktopTrustKeyHostSource.Text', 'Text'));
  let closed = 0;
  const finish = (record: {state: string; hash: string} | null) => {
    if (rejected(record, 'original', (r: {hash: string}) => r.hash, (r: Record<string, unknown>, k: string) => r[k])) throw Error('UNKNOWN');
    closed++;
  };
  for (const record of [null, {state:'REVOKED',hash:'original'}, {state:'REGISTERED',hash:'replaced'}]) assert.throws(() => finish(record), /UNKNOWN/);
  assert.equal(closed, 0); finish({state:'REGISTERED',hash:'original'}); assert.equal(closed, 1);
  assert.ok(method.indexOf('using(io.Lock())') < method.indexOf('complete(record)'));
  assert.ok(method.indexOf('RequireSettled();check();return answer') > method.lastIndexOf('ReadOwned()'));
  assert.match(method, /catch\{unknown=true;throw new DesktopTrustKeyStoreUnknownException\(\);\}finally\{busy=false;\}/);
});


test('S2-R1 목적 준비는 원 CLOSE capability를 먼저 소비하고 원장 정착 뒤에만 패킷을 반환한다 (정적)', () => {
 const p=source('NormalExecutionSpoolProfileSource.cs'), c=source('NormalExecutionCredentialSource.cs');
 assert.match(p,/sealed class UnderstandingResultCapability/);
 assert.match(c,/NORMAL_EXECUTION_UNDERSTANDING_RESULT_PREPARE/);
 const prepare=c.slice(c.indexOf('object PrepareUnderstandingResult('),c.indexOf('object SendUnderstandingResult('));
 assert.ok(prepare.indexOf('TakeUnderstandingResult(')<prepare.indexOf('ChallengeRequest('));
 assert.ok(prepare.indexOf('StoreUnderstandingPrepared(')<prepare.indexOf('NATIVE_DISCOVERY_RESULT_PREPARED'));
 assert.doesNotMatch(prepare,/SaveNormalOwned/);
 assert.match(p,/UNDERSTANDING_RESULT_PREPARED/);assert.match(p,/UNDERSTANDING_RESULT_SEND_STARTED/);
});

test('S2-R1 목적 SEND는 exact body/auth를 고정하고 STARTED/원 잠금 회수 뒤에만 HTTP를 호출한다 (정적)', () => {
 const c=source('NormalExecutionCredentialSource.cs');
 const send=c.slice(c.indexOf('object SendUnderstandingResult('),c.indexOf('object Call('));
 assert.match(send,/attemptId,slotId,requestRef,acquisitionRef,preparedHash,auth,body/);
 assert.ok(send.indexOf('StartUnderstandingSend(')<send.indexOf('Http('));
 assert.doesNotMatch(send,/ChallengeRequest\(|Sign\(/);
 assert.match(c,/kind\"\)==\"UNDERSTANDING_RESULT_SEND/);
 assert.match(c,/StartsWith\(Base\(scope\)\+\"\/understanding-response-read\/\",StringComparison.Ordinal\)\)throw Invalid/);
});


test('S2-R1 원 capability 없음/중복/다른 request·slot·body는 source gate에서 거절한다 (source RAM)', () => {
 const p=source('NormalExecutionSpoolProfileSource.cs'), c=source('NormalExecutionCredentialSource.cs');
 const take=p.slice(p.indexOf('internal Row TakeUnderstandingResult('),p.indexOf('internal Row StoreUnderstandingPrepared('));
 assert.ok(take.indexOf('understandingResultCapability=null')<take.indexOf('if(capability==null'));
 const condition=take.match(/if\((S\(value,"attemptId"\)[^\n]+?)\)throw Invalid\(\);/)?.[1]; assert.ok(condition);
 const reject=new Function('value','prior','purpose','S','J','return '+condition);
 const prior={attemptId:'attempt',slotId:'slot'}, purpose={requestRef:{id:'request'},acquisitionRef:{id:'acquisition'},bodyHash:'hash'};
 const original={...prior,...purpose};
 const rejected=(v: typeof original)=>reject(v,prior,purpose,(r:Record<string,unknown>,k:string)=>r[k],JSON.stringify);
 assert.equal(rejected(original),false);
 for(const key of ['attemptId','slotId','bodyHash'] as const)assert.equal(rejected({...original,[key]:'changed'}),true);
 for(const key of ['requestRef','acquisitionRef'] as const)assert.equal(rejected({...original,[key]:{id:'changed'}}),true);
 const prepare=c.slice(c.indexOf('object PrepareUnderstandingResult('),c.indexOf('object SendUnderstandingResult('));
 assert.ok(prepare.indexOf('understandingCloseAccepted=false')<prepare.indexOf('if(!accepted'));
 const finish=p.slice(p.indexOf('Row FinishSupervisedUnderstanding('),p.indexOf('const string PreparedKeys'));
 assert.ok(finish.indexOf('var answer=finalGuard')<finish.indexOf('understandingResultCapability=new'));
 assert.match(take,/S\(ended,"host"\)!=understandingHost/);
 assert.match(take,/Has\(rows,"UNDERSTANDING_RESULT_PREPARED"/);
});

test('S2-R1 두 관리행은 WI exact 필드만 생성하며 auth·본문·bearer는 저장하지 않는다 (source RAM)', () => {
 const p=source('NormalExecutionSpoolProfileSource.cs');
 const store=p.slice(p.indexOf('internal Row StoreUnderstandingPrepared('),p.indexOf('internal Row StartUnderstandingSend('));
 const expression=store.match(/var row=(R\([\s\S]*?\));\r?\n    DesktopTrustKeyHostSource.Exact/)?.[1];assert.ok(expression);
 const row=(...pairs:unknown[])=>Object.fromEntries(Array.from({length:pairs.length/2},(_,i)=>[pairs[i*2] as string,pairs[i*2+1]]));
 const scope={projectId:'project',connectorId:'connector',executionId:'execution',executionGeneration:1,grantRef:{id:'grant'},credentialGeneration:1};
 const pickup={requestRef:{id:'request'},acquisitionRef:{id:'acquisition'}};
 const facts={challengeRef:{id:'challenge'},proofRequestId:'proof',nonceDigest:'nonce-digest',packetHash:'packet-hash',expiresAt:'expiry'};
 const build=new Function('R','H','key','ended','origin','pickup','record','slot','scope','proofFacts','value','return '+expression);
 const prepared=build(row,(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),'request',{allocation:'allocation',host:'host'},{closeHash:'close',pickupHash:'pickup'},pickup,{state:'REGISTERED'},{slotId:'slot',receiptRef:{id:'receipt'},credential:'fixture'},scope,facts,{bodyHash:'body-hash'});
 const exact=p.match(/const string PreparedKeys="([^"]+)"/)?.[1]?.split(',');assert.ok(exact);assert.deepEqual(Object.keys(prepared),exact);
 assert.equal(Object.keys(prepared).some(k=>['auth','body','credential','path','sid'].includes(k)),false);
 assert.equal(JSON.stringify(prepared).includes('fixture'),false);
 const send=p.slice(p.indexOf('internal Row StartUnderstandingSend('),p.indexOf('// 이 함수는 현재 열린 할당'));
 const sendExpression=send.match(/var row=(R\([\s\S]*?\));\r?\n    DesktopTrustKeyHostSource.Exact/)?.[1];assert.ok(sendExpression);
 const started=new Function('R','H','key','prepared','return '+sendExpression)(row,JSON.stringify,'request',prepared);
 const sendKeys=p.match(/const string SendStartedKeys="([^"]+)"/)?.[1]?.split(',');assert.ok(sendKeys);assert.deepEqual(Object.keys(started),sendKeys);
 assert.equal(started.preparedHash,JSON.stringify(prepared));
 assert.match(store,/S\(r,"nonceDigest"\)==S\(proofFacts,"nonceDigest"\)/);assert.match(store,/S\(r,"proofRequestId"\)==S\(proofFacts,"proofRequestId"\)/);
 assert.match(store,/Append\(log,rows,row\)/);assert.match(send,/Append\(log,rows,row\)/);
 assert.match(p,/log.Flush\(true\)/);assert.match(p,/activeAnchor.Flush\(true\)/);
 assert.match(p,/log.Length\+4\+cipher.Length\+activeAnchor.Length\+32\+ManagementHold\(rows\)/);
 assert.match(p,/cipher.Length>MaxEntry/);assert.match(p,/AdminCap=64\*MiB/);
 for(const code of [store,send]){
  assert.match(code,/Log\(false,\(log,rows\)=>\{var saved=/);
  assert.match(code,/saved==null\|\|J\(saved\)!=J\(/);
  assert.match(code,/catch\{blocked=true;throw;\}/);
 }
});

test('S2-R1 SEND 원 hash·등록·slot·refs·중복 원장 검산은 같은 packet만 허용한다 (source RAM)', () => {
 const p=source('NormalExecutionSpoolProfileSource.cs');const send=p.slice(p.indexOf('internal Row StartUnderstandingSend('),p.indexOf('// 이 함수는 현재 열린 할당'));
 const condition=send.match(/if\((H\(prepared\)[^\n]+?)\)throw Invalid\(\);/)?.[1];assert.ok(condition);
 const same=JSON.stringify, H=(v:unknown)=>JSON.stringify(v), S=(r:Record<string,unknown>,k:string)=>r[k];
 const record={state:'REGISTERED'},slot={slotId:'slot',receiptRef:{id:'receipt'}};
 const ended={host:'host',allocation:'allocation'},pickup={key:'request'};
 const prepared={closeHash:H(ended),pickupHash:H(pickup),host:'host',allocation:'allocation',recordHash:H(record),slotHash:H(slot),slotId:'slot',slotReceiptRef:slot.receiptRef,requestRef:{id:'request'},acquisitionRef:{id:'acquisition'},bodyHash:'body-hash'};
 const value={preparedHash:H(prepared),requestRef:prepared.requestRef,acquisitionRef:prepared.acquisitionRef,bodyHash:'body-hash'};
 const gate=new Function('prepared','value','rows','key','ended','pickup','record','slot','H','S','J','Has','understandingHost','return '+condition);
 const reject=(v=value,r=record,t=slot,duplicate=false,host='next-host')=>gate(prepared,v,[],pickup.key,ended,pickup,r,t,H,S,same,()=>duplicate,host);
 assert.equal(reject(),false);assert.equal(reject(value,record,slot,true),true);assert.equal(reject(value,record,slot,false,'host'),true);
 assert.equal(reject({...value,preparedHash:'changed'}),true);assert.equal(reject({...value,bodyHash:'changed'}),true);
 assert.equal(reject({...value,requestRef:{id:'other'}}),true);assert.equal(reject({...value,acquisitionRef:{id:'other'}}),true);
 assert.equal(reject(value,{state:'REVOKED'}),true);assert.equal(reject(value,record,{slotId:'renewed',receiptRef:{id:'receipt'}}),true);
 assert.match(send,/new\[\]\{"challengeRef","proofRequestId","nonceDigest","packetHash"\}/);
 assert.match(send,/prepared,"expiresAt"\)>DesktopTrustKeyHostSource.Time\(origin,"expiresAt"/);
 assert.match(send,/TightenRead\(DesktopTrustKeyHostSource.Time\(prepared,"expiresAt"\)\)/);
});

test('S2-R1 목적 chunk만 exact9이고 raw generic result·추가 경로는 열리지 않는다 (정적)',()=>{
 const c=source('NormalExecutionCredentialSource.cs');
 const header=c.slice(c.indexOf('void Header('),c.indexOf('Dictionary<string,object> LoadSlot('));
 assert.match(header,/if\(inline\)throw Invalid\(\);Exact\(h,"attemptId,slotId,kind,requestRef,acquisitionRef,preparedHash,auth,bodyLength,bodyHash"\)/);
 assert.match(header,/N\(h\["bodyLength"\]\)\+Encoding.UTF8.GetByteCount\(S\(h,"auth"\)\)>2097152/);
 assert.match(c,/new UTF8Encoding\(false,true\).GetString\(body\)/);
 const send=c.slice(c.indexOf('object SendUnderstandingResult('),c.indexOf('object Call('));
 assert.match(send,/J\(metadata\)!=body/);assert.match(send,/B64\(B\(packet\)\)!=auth/);
 assert.match(send,/bodyBytes.Length\+Encoding.UTF8.GetByteCount\(auth\)>2097152/);
 assert.match(send,/finally\{Array.Clear\(bodyBytes/);
 assert.match(c,/new\[\]\{"PREPARE","REQUEST"\}/);
 assert.match(c,/serverNonce"\),32/);
});
