import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {CodexHandshakeQa,checkHandshakeRunBinding,HandshakeHostFrames} from '../../../apps/connector/adapters/primary/handshake-qa.ts';

const home='D:\\tmp\\anvil-v3-fn06-handshake-0161-qa\\home';
const response=(patch:Record<string,unknown>={})=>Buffer.from(JSON.stringify({id:'anvil-fn06-init-01',result:{codexHome:home,platformFamily:'windows',platformOs:'windows',userAgent:'synthetic-only',...patch}})+'\n');
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex').toUpperCase();
const binding={policy:'AV3-PMO-FN06-HANDSHAKE-OWNERSHIP-01',runId:'1f26792e-ef0c-4d79-859c-476f2f2da5b1',sourceSha:'a'.repeat(40),hostSourceHash:'b'.repeat(64),issuedAt:'2026-10-17T06:30:00.000Z',expiresAt:'2026-10-17T07:00:00.000Z'};
// 유효한 helper 프레임 여러 개가 한 pipe chunk로 묶여도 개별 한도로 판정해야 한다.
test('helper frame은 같은 바이트열의 16KiB 초과 병합·분할에서 같은 결과를 낸다',()=>{
 const event={kind:'STDOUT',bytes:Buffer.alloc(2048,65).toString('base64')},bytes=Buffer.from((JSON.stringify(event)+'\r\n').repeat(8));assert.ok(bytes.length>16384);
 const merged=new HandshakeHostFrames(),split=new HandshakeHostFrames(),mergedOut=merged.push(bytes);assert.equal(mergedOut.length,8);for(const v of mergedOut)assert.deepEqual(v,event);
 assert.deepEqual(split.push(bytes.subarray(0,19)),[]);const splitOut=split.push(bytes.subarray(19));assert.equal(splitOut.length,8);for(const v of splitOut)assert.deepEqual(v,event);merged.finish();split.finish();
});
// 미완성/잘못된/초과 입력을 허용하거나 오류 뒤 새 프레임으로 복구하면 실패한다.
test('helper frame은 개별8192·총512KiB·256개·UTF8/중복key/부분EOF를 거절한다',()=>{
 for(const bytes of [Buffer.alloc(8194,65),Buffer.alloc(524289,65),Buffer.from('{}\n'.repeat(257)),Buffer.from('{"kind":1,"kind":2}\n'),Buffer.from([0xff,10])]){const f=new HandshakeHostFrames();assert.throws(()=>f.push(bytes),/QA_HOST_FRAME_INVALID/);assert.throws(()=>f.push(Buffer.from('{}\n')),/QA_HOST_FRAME_INVALID/);}
 const partial=new HandshakeHostFrames();partial.push(Buffer.from('{'));assert.throws(()=>partial.finish(),/QA_HOST_FRAME_INVALID/);
});
// 이 검사는 실행 권한을 발급하지 않는다. 한시 실행 소비자의 정확 후보/창 입력이 어긋나면 막는다.
test('한시 실행 입력은 정확 정책·commit·hosthash·run과 최대30분 창에만 맞는다',()=>{
 const now=Date.parse('2026-10-17T06:40:00.000Z');assert.equal(checkHandshakeRunBinding(binding,'a'.repeat(40),'b'.repeat(64),now),true);
 for(const changed of [{...binding,policy:'OTHER'},{...binding,sourceSha:'c'.repeat(40)},{...binding,hostSourceHash:'c'.repeat(64)},{...binding,runId:'bad'},{...binding,extra:true},{...binding,expiresAt:'2026-10-17T07:00:00.001Z'}])assert.equal(checkHandshakeRunBinding(changed,'a'.repeat(40),'b'.repeat(64),now),false);
 assert.equal(checkHandshakeRunBinding(binding,'a'.repeat(40),'b'.repeat(64),Date.parse(binding.issuedAt)-1),false);assert.equal(checkHandshakeRunBinding(binding,'a'.repeat(40),'b'.repeat(64),Date.parse(binding.expiresAt)-19_999),false);assert.equal(checkHandshakeRunBinding(binding,'a'.repeat(40),'b'.repeat(64),NaN),false);
});
function started(){const c=new CodexHandshakeQa();const actions=c.start(0);assert.equal(actions.length,1);assert.equal(actions[0]?.kind,'WRITE_STDIN');return c;}

// 같은 codec의 유효 initialize 결과 이전에 두 번째 wire를 발행하거나 ACK/OS 성공을 꾸미면 실패한다.
test('정확 첫 wire 이후 유효 결과에서만 initialized와 EOF를 한 번 준비하고 OS 검증과 구분한다',()=>{
 const c=new CodexHandshakeQa(),first=c.start(0);assert.equal(first.length,1);assert.equal(first[0]?.kind,'WRITE_STDIN');
 if(first[0]?.kind!=='WRITE_STDIN')throw Error('EXPECTED_WIRE');
 assert.equal(first[0].wire.byteLength,223);assert.equal(hash(first[0].wire),'6A3A06BE869354E0440C50163EE6CD5034367B45BEE452284FD9AE101B8E10FE');
 const raw=response();assert.deepEqual(c.stdout(raw.subarray(0,10),1),[]);const second=c.stdout(raw.subarray(10),2);
 assert.deepEqual(second.map(a=>a.kind),['WRITE_STDIN','CLOSE_STDIN']);if(second[0]?.kind!=='WRITE_STDIN')throw Error('EXPECTED_WIRE');
 assert.equal(second[0].wire.byteLength,25);assert.equal(hash(second[0].wire),'A7A46480650892067559EC67217B69DCE68C1EEF6B65EC48662DDDF6CCEF0893');
 assert.equal(c.report().phase,'WAIT_EXIT');assert.deepEqual(c.stdoutEnded(3),[]);assert.deepEqual(c.stderrEnded(3),[]);assert.deepEqual(c.processExited(0,4),[]);
 const result=c.report();assert.equal(result.phase,'PROTOCOL_COMPLETE');assert.equal(result.stdinMessages,2);assert.equal(result.actualExecutionVerified,false);assert.equal(result.executionAuthorized,false);assert.equal(result.workAccepted,false);assert.equal(result.ownership,'UNVERIFIED');
 assert.deepEqual(c.tick(20_000),[]);assert.equal(c.report().phase,'PROTOCOL_COMPLETE');
});

// id/schema/전용 home/Windows 확인이나 단일 응답을 생략해 initialized를 보내면 실패한다.
test('잘못된 원문·id·결과·경로·부가 통지는 고정 실패이고 두 번째 송신/원문 반사가 없다',()=>{
 const bad=[response({codexHome:'C:\\PRIVATE_TOKEN'}),response({platformFamily:'unix'}),response({platformOs:'linux'}),Buffer.from('{"id":"PRIVATE_TOKEN","result":{}}\n'),Buffer.from('{"id":"anvil-fn06-init-01","id":"anvil-fn06-init-01","result":{}}\n'),Buffer.from('{"id":"anvil-fn06-init-01","error":{"code":1,"message":"PRIVATE_TOKEN"}}\n'),Buffer.concat([response(),Buffer.from('PRIVATE_TOKEN')]),Buffer.from('\n'),Buffer.from([0xff,10])];
 for(const raw of bad){const c=started(),actions=c.stdout(raw,1);assert.equal(c.report().phase,'UNKNOWN');assert.equal(c.report().stdinMessages,1);assert.equal(actions.some(a=>a.kind==='WRITE_STDIN'),false);assert.equal(JSON.stringify(c.report()).includes('PRIVATE_TOKEN'),false);assert.deepEqual(c.stdout(response(),2),[]);assert.equal(c.report().stdinMessages,1);}
});

// 시간 경계를 넘은 응답을 허용하거나 exact process 이외 회수/재시도를 만들면 실패한다.
test('15초 미완료는 EOF·18초 exact process 정리요청1회·20초 미관측으로 구분한다',()=>{
 const c=started();assert.deepEqual(c.tick(14_999),[]);assert.deepEqual(c.tick(15_000).map(a=>a.kind),['CLOSE_STDIN']);assert.equal(c.report().code,'HANDSHAKE_TIMEOUT');
 assert.deepEqual(c.stdout(response(),15_001),[]);assert.deepEqual(c.tick(18_000).map(a=>a.kind),['STOP_EXACT_PROCESS']);assert.deepEqual(c.tick(18_001),[]);assert.deepEqual(c.tick(20_000),[]);assert.equal(c.report().exitObservationExpired,true);assert.equal(c.report().phase,'UNKNOWN');assert.equal(c.report().stdinMessages,1);
});

// 비정상 시간/역행/두 번째 시작으로 상태를 초기화해 추가 wire를 만들면 실패한다.
test('시각 역행·비유한·중복 시작은 UNKNOWN이고 다시 시작하지 않는다',()=>{
 for(const t of [NaN,Infinity,-1]){const c=new CodexHandshakeQa();assert.equal(c.start(t).some(a=>a.kind==='WRITE_STDIN'),false);assert.equal(c.report().phase,'UNKNOWN');}
 const c=started();c.tick(10);c.stdout(response(),9);assert.equal(c.report().code,'CLOCK_INVALID');assert.equal(c.report().stdinMessages,1);
 const twice=started();assert.equal(twice.start(0).some(a=>a.kind==='WRITE_STDIN'),false);assert.equal(twice.report().phase,'UNKNOWN');assert.equal(twice.report().stdinMessages,1);
});

// 출력 한도를 확인하기 전에 거대 프레임을 복사하거나 stderr를 성공/원문 로그로 만들면 실패한다.
test('stdout128KiB·stderr32KiB 초과는 추가 wire 없이 닫고 원문을 보고하지 않는다',()=>{
 const a=started();assert.deepEqual(a.stdout(Buffer.alloc(131073,65),1).map(v=>v.kind),['CLOSE_STDIN']);assert.equal(a.report().code,'STDOUT_LIMIT');
 const b=started();assert.deepEqual(b.stderr(Buffer.alloc(32768,65),1),[]);assert.equal(b.report().phase,'WAIT_RESULT');assert.deepEqual(b.stderr(Buffer.from('PRIVATE_TOKEN'),2).map(v=>v.kind),['CLOSE_STDIN']);assert.equal(b.report().code,'STDERR_LIMIT');assert.equal(JSON.stringify(b.report()).includes('PRIVATE_TOKEN'),false);
 const frame=started();frame.stdout(Buffer.alloc(65539,65),1);assert.equal(frame.report().phase,'UNKNOWN');assert.equal(frame.report().stdinMessages,1);
});

// EOF/비정상 exit·후속 출력·결과 유실을 단순 두 쓰기만으로 성공 판정하면 실패한다.
test('부분 EOF·실패 exit·initialized 후 출력·정상 EOF 미관측은 성공이 아니다',()=>{
 const partial=started();partial.stdout(response().subarray(0,10),1);partial.stdoutEnded(2);assert.equal(partial.report().phase,'UNKNOWN');
 const exit=started();exit.stdout(response(),1);exit.stdoutEnded(2);exit.processExited(1,3);assert.equal(exit.report().phase,'UNKNOWN');
 const extra=started();extra.stdout(response(),1);extra.stdout(Buffer.from('PRIVATE_TOKEN'),2);assert.equal(extra.report().phase,'UNKNOWN');assert.equal(extra.report().stdinMessages,2);
 const noEof=started();noEof.stdout(response(),1);noEof.stderrEnded(1);noEof.processExited(0,2);assert.equal(noEof.report().phase,'WAIT_EXIT');noEof.stdoutEnded(3);assert.equal(noEof.report().phase,'PROTOCOL_COMPLETE');
});

// exit0 알림만으로 stderr 수거를 끝내거나 남은 stream을 무기한 기다리면 실패한다.
test('exit0 뒤에도 양쪽 EOF 전에는 후보 완료가 아니며 수거 기한은 유한하다',()=>{
 const drain=started();drain.stdout(response(),1);drain.stdoutEnded(2);drain.processExited(0,3);assert.equal(drain.report().phase,'WAIT_EXIT');
 drain.stderr(Buffer.from('pending diagnostics'),4);drain.stderrEnded(5);assert.equal(drain.report().phase,'PROTOCOL_COMPLETE');
 const missing=started();missing.stdout(response(),1);missing.processExited(0,2);assert.deepEqual(missing.tick(18_000),[]);assert.equal(missing.report().phase,'UNKNOWN');assert.equal(missing.report().code,'EXIT_TIMEOUT');
});

// 이미 종료된 process에 또 종료를 요구하거나 EOF 후 출력으로 정상 결과를 꾸미면 실패한다.
test('실패 exit도 종료 관측이며 stderr EOF 뒤 추가 출력만 UNKNOWN으로 닫는다',()=>{
 const failed=started();failed.stdout(response(),1);failed.processExited(1,2);assert.equal(failed.report().phase,'UNKNOWN');assert.equal(failed.tick(18_000).some(v=>v.kind==='STOP_EXACT_PROCESS'),false);
 const late=started();late.stdout(response(),1);late.stderrEnded(2);late.stderr(Buffer.from('late'),3);assert.equal(late.report().phase,'UNKNOWN');
 const early=started();early.stderrEnded(1);early.stdout(response(),2);early.stdoutEnded(3);early.processExited(0,4);assert.equal(early.report().phase,'PROTOCOL_COMPLETE');
});
// 진단 소실/원문 반사·getter 실행과 compile-only의 실제 실행 분기 혼입을 검출한다.
import * as compileQa from '../../../apps/connector/adapters/primary/handshake-qa.ts';
test('컴파일 실패의 유한 사실과 허용 CS 위치만 남기고 원문은 버린다',()=>{
 const summarize=(compileQa as any).compileFailureReceipt;
 assert.equal(typeof summarize,'function');
 const r=summarize({status:1,signal:null,pid:1234,stdout:Buffer.from('apps/connector/native/CodexHandshakeHost.cs(12,3): error CS1002: PRIVATE_TOKEN\nC:\\private\\x.cs(1,2): error CS9999: secret'),stderr:Buffer.alloc(0),message:'PRIVATE_TOKEN'},23,'C:\\repo\\apps\\connector\\native\\CodexHandshakeHost.cs');
 assert.equal(r.classification,'NONZERO');assert.equal(r.status,1);assert.equal(r.pid,1234);assert.equal(r.elapsedMs,23);
 assert.deepEqual(r.diagnostics,[{code:'CS1002',severity:'error',source:'apps/connector/native/CodexHandshakeHost.cs',line:12,column:3},{code:'CS9999',severity:'error',source:'UNKNOWN',line:'UNKNOWN',column:'UNKNOWN'}]);
 assert.equal(r.stdout.bytes,121);assert.equal(r.stdout.truncated,false);assert.equal(r.stdout.sha256.length,64);
 assert.equal(JSON.stringify(r).includes('PRIVATE_TOKEN'),false);assert.equal(JSON.stringify(r).includes('private'),false);
});
// 위치 없는 정상 compiler 진단을 버리거나 낯선 origin을 경로로 내보내면 실패한다.
test('전역·CSC·fatal·위치없는 허용source는 CS번호만 남기고 낯선위치는 UNKNOWN이다',()=>{
 const r=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from('error CS0006: SECRET\nCSC : warning CS2008: SECRET\nfatal error CS2001: SECRET\napps/connector/native/CodexHandshakeHost.cs: error CS1002: SECRET\nC:\\SECRET\\x.cs(7,8): error CS0016: SECRET\n')},1);
 assert.deepEqual(r.diagnostics,[
  {code:'CS0006',severity:'error',source:'UNKNOWN',line:'UNKNOWN',column:'UNKNOWN'},
  {code:'CS2008',severity:'warning',source:'UNKNOWN',line:'UNKNOWN',column:'UNKNOWN'},
  {code:'CS2001',severity:'error',source:'UNKNOWN',line:'UNKNOWN',column:'UNKNOWN'},
  {code:'CS1002',severity:'error',source:'apps/connector/native/CodexHandshakeHost.cs',line:'UNKNOWN',column:'UNKNOWN'},
  {code:'CS0016',severity:'error',source:'UNKNOWN',line:'UNKNOWN',column:'UNKNOWN'},
 ]);assert.equal(JSON.stringify(r).includes('SECRET'),false);
});
test('비UTF8 message가 있어도 ASCII CS분류는 보존하고 임의메시지내 흉내는 진단이 아니다',()=>{
 const bytes=Buffer.concat([Buffer.from('error CS0006: '),Buffer.from([0xff,0xfe]),Buffer.from('\nmessage contains error CS9999: SECRET\n'+('CSC : warning CS2008: SECRET\n'.repeat(40)))]);
 const r=compileQa.compileFailureReceipt({status:1,stdout:bytes},1);
 assert.equal(r.diagnostics.length,32);assert.equal(r.diagnostics[0]!.code,'CS0006');assert.equal(r.diagnostics.some(d=>d.code==='CS9999'),false);assert.equal(r.stdout.bytes,bytes.length);assert.equal(JSON.stringify(r).includes('SECRET'),false);
});
test('진단없는 실패에서만 최대32KiB raw를 유한framing하고 stdout/stderr를 외부결과에 포함하지 않는다',()=>{
 const gate=new compileQa.CompileOnlyAttempt();assert.equal(typeof (gate as any).takeCapture,'function');
 const r=gate.run(true,()=>{throw {status:1,stdout:Buffer.alloc(40000,65),stderr:Buffer.from('PRIVATE_SECRET')};},()=>1);
 const capture=(gate as any).takeCapture();assert.equal(capture.bytes.byteLength,32768);assert.equal(capture.summary.stdoutCapturedBytes,32752);assert.equal(capture.summary.stderrCapturedBytes,0);assert.equal(capture.summary.truncated,true);assert.equal(capture.summary.framing,'AV3CRAW1');assert.equal(capture.inspection.contentClass,'NO_CS_DIAGNOSTIC');assert.equal((gate as any).takeCapture(),undefined);
 assert.equal(JSON.stringify(r).includes('PRIVATE_SECRET'),false);assert.equal(JSON.stringify(r).includes('raw'),false);
 const known=new compileQa.CompileOnlyAttempt();known.run(true,()=>{throw {status:1,stdout:Buffer.from('error CS0006: SECRET')};},()=>1);assert.equal((known as any).takeCapture(),undefined);
 const ok=new compileQa.CompileOnlyAttempt();ok.run(true,()=>Buffer.from('no diagnostic'),()=>1);assert.equal((ok as any).takeCapture(),undefined);
 let reads=0;const hostile=Object.defineProperty({status:1},'stdout',{get(){reads++;throw Error('SECRET');}});const bad=new compileQa.CompileOnlyAttempt();bad.run(true,()=>{throw hostile;},()=>1);assert.equal(reads,0);assert.equal((bad as any).takeCapture().summary.stdoutBytes,'UNKNOWN');
 const channels=new compileQa.CompileOnlyAttempt();channels.run(true,()=>{throw {status:1,stdout:Buffer.from('AB'),stderr:Buffer.from([0xff,0xfe,0x41,0])};},()=>1);
 const two=(channels as any).takeCapture();assert.equal(two.bytes.readUInt32LE(8),2);assert.equal(two.bytes.readUInt32LE(12),4);assert.equal(two.summary.truncated,false);assert.deepEqual([...two.bytes.subarray(16)],[65,66,255,254,65,0]);
 const untouched=Buffer.from('AB');const separate=new compileQa.CompileOnlyAttempt();separate.run(true,()=>{throw {status:1,stdout:untouched,stderr:Buffer.alloc(0)};},()=>1);const independent=(separate as any).takeCapture();independent.bytes.fill(0);assert.equal(untouched.toString(),'AB');
});
test('컴파일 timeout·spawn 오류는 실제 code만 분류하고 getter·proxy·위조 buffer는 실행하지 않는다',()=>{
 const summarize=(compileQa as any).compileFailureReceipt;assert.equal(typeof summarize,'function');
 assert.equal(summarize({code:'ETIMEDOUT'},15001).classification,'TIMEOUT');
 assert.equal(summarize({code:'EACCES'},1).classification,'SPAWN_ERROR');
 assert.equal(summarize({status:-1073741515},1).status,-1073741515);
 assert.equal(summarize({status:4294967295},1).classification,'NONZERO');
 assert.equal(summarize({message:'timeout',status:null},21000).classification,'UNKNOWN');
 let reads=0;const hostile=Object.defineProperty({},'status',{get(){reads++;throw Error('SECRET');}});
 const a=summarize(hostile,NaN),b=summarize(new Proxy({},{getOwnPropertyDescriptor(){reads++;throw Error('SECRET');}}),0),c=summarize({stdout:Object.create(Buffer.prototype)},0);
 assert.equal(reads,0);assert.equal(a.status,'UNKNOWN');assert.equal(a.elapsedMs,'UNKNOWN');assert.equal(b.classification,'UNKNOWN');assert.equal(c.stdout.bytes,'UNKNOWN');
 const bytes=Buffer.from('ok');Object.defineProperty(bytes,'constructor',{get(){reads++;throw Error('SECRET');}});
 const d=summarize({stdout:bytes},0);assert.equal(reads,0);assert.equal(d.stdout.bytes,2);
});
test('과대 컴파일 출력은 prefix hash로 명시하고 진단32개를 넘기지 않는다',()=>{
 const summarize=(compileQa as any).compileFailureReceipt;assert.equal(typeof summarize,'function');
 const line='apps/connector/native/CodexHandshakeHost.cs(1,2): warning CS1234: SECRET\n';
 const r=summarize({stdout:Buffer.from(line.repeat(3000)),stderr:Buffer.alloc(0),status:1},1);
 assert.equal(r.diagnostics.length,32);assert.equal(r.stdout.truncated,true);assert.equal(r.stdout.hashedBytes,131072);assert.equal(r.stdout.bytes,Buffer.byteLength(line)*3000);assert.equal(JSON.stringify(r).includes('SECRET'),false);
});
test('compile-only는 별도 policy·compiler hash·정확 후보·유한 창으로만 통과한다',()=>{
 const check=(compileQa as any).checkCompileOnlyRunBinding;assert.equal(typeof check,'function');
 const sha='a'.repeat(40),host='39111ada9ff079143507db5c2986e1f42d3f0679519ba524a82775dddc26cbac',compiler='46809206887326d2d24db1eff1f3064de972c3451abe766b49111450a5e08e00';
 const v={policy:'AV3-PMO-FN06-COMPILE-RECEIPT-01',runId:'56d83f93-1f39-4cac-874f-22df04596dad',sourceSha:sha,hostSourceHash:host,compilerHash:compiler,issuedAt:'2026-10-17T07:00:00.000Z',expiresAt:'2026-10-17T07:30:00.000Z'};
 const now=Date.parse('2026-10-17T07:01:00.000Z');assert.equal(check(v,sha,host,compiler,now),true);
 for(const bad of [{...v,policy:'AV3-PMO-FN06-HANDSHAKE-OWNERSHIP-01'},{...v,compilerHash:'0'.repeat(64)},{...v,sourceSha:'b'.repeat(40)},{...v,hostSourceHash:'0'.repeat(64)},{...v,expiresAt:'2026-10-17T08:00:00.000Z'}])assert.equal(check(bad,sha,host,compiler,now),false);
 assert.equal(check(v,sha,host,compiler,Date.parse(v.expiresAt)),false);
 assert.equal(check({...v,runId:'56d83f93-1f39-4cac-874f-22df04596dae'},sha,host,compiler,now),false);
 assert.equal(check({...v,runId:'abbe0980-d51c-46b3-ae63-b84ccf14a865'},sha,host,compiler,now),false);
});
// 새 상세를 잃거나 임의 문구/경로를 근거로 known으로 승격하는 회귀를 잡는다. OS/컴파일러 실행은 없다.
test('실패 CS1504의 정확한 source 역할과 허용 OS 문구·코드만 enum으로 남긴다',()=>{
 const source='apps/connector/native/CodexHandshakeHost.cs',absolute='C:\\repo\\apps\\connector\\native\\CodexHandshakeHost.cs';
 const cases=[
  [source,'Access is denied.','SOURCE_ARG','ACCESS_DENIED'],
  [absolute,'The process cannot access the file because it is being used by another process.','SOURCE_ARG','SHARING_VIOLATION'],
  ['C:\\PRIVATE_TOKEN\\other.cs','The system cannot find the file specified.','OTHER_SOURCE','NOT_FOUND'],
  [source,'The system cannot find the path specified.','SOURCE_ARG','NOT_FOUND'],
  [source,'The filename, directory name, or volume label syntax is incorrect.','SOURCE_ARG','OTHER_OS_REASON'],
  [source,'Win32 error 5','SOURCE_ARG','ACCESS_DENIED'],
  [source,'Win32 error 32','SOURCE_ARG','SHARING_VIOLATION'],
  [source,'0x80070002','SOURCE_ARG','NOT_FOUND'],
  [source,'0x80070003','SOURCE_ARG','NOT_FOUND'],
  [source,'0x8007007B','SOURCE_ARG','OTHER_OS_REASON'],
  [source,'PRIVATE_TOKEN','SOURCE_ARG','UNKNOWN'],
 ] as const;
 for(const [file,reason,fileRole,osReason]of cases){
  const r=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(`error CS1504: Source file '${file}' could not be opened -- '${reason}'\r\n`),stderr:Buffer.alloc(0)},1,absolute) as any;
  assert.deepEqual(r.sourceOpenFailure,{fileRole,osReason});assert.equal(JSON.stringify(r).includes('PRIVATE_TOKEN'),false);assert.equal(JSON.stringify(r).includes(absolute),false);
 }
});
test('공식 CS1504 괄호 형식과 CSC·파일 origin에서도 정확 필드만 읽는다',()=>{
 for(const prefix of ['error CS1504:','CSC : error CS1504:','apps/connector/native/CodexHandshakeHost.cs: error CS1504:']){
  const r=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(`${prefix} Source file 'apps\\connector\\native\\CodexHandshakeHost.cs' could not be opened ('Access is denied.')\n`),stderr:Buffer.alloc(0)},1) as any;
  assert.deepEqual(r.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'ACCESS_DENIED'});
 }
});
test('상세는 비0 실패와 정규화 error CS1504에만 생기고 출력 공백·잘림·한도는 UNKNOWN이다',()=>{
 const row="error CS1504: Source file 'apps/connector/native/CodexHandshakeHost.cs' could not be opened -- 'Access is denied.'\n";
 for(const error of [{status:0,stdout:Buffer.from(row),stderr:Buffer.alloc(0)},{stdout:Buffer.from(row),stderr:Buffer.alloc(0)},{status:1,stdout:Buffer.from(row.replace('error','warning')),stderr:Buffer.alloc(0)},{status:1,stdout:Buffer.from(row.replace('CS1504','CS1503')),stderr:Buffer.alloc(0)},{status:1,stdout:Buffer.from('message contains '+row),stderr:Buffer.alloc(0)}])assert.equal((compileQa.compileFailureReceipt(error,1) as any).sourceOpenFailure,undefined);
 for(const error of [{status:1,stdout:Buffer.from(row)},{status:1,stdout:Buffer.from(row+'A'.repeat(131072)),stderr:Buffer.alloc(0)},{status:1,stdout:Buffer.from(row+'warning CS2008: X\n'.repeat(32)),stderr:Buffer.alloc(0)}])assert.deepEqual((compileQa.compileFailureReceipt(error,1) as any).sourceOpenFailure,{fileRole:'UNKNOWN',osReason:'UNKNOWN'});
});
test('복수 CS1504·지역화·비ASCII/손상·문구추가·경로흉내는 상세 known으로 추측하지 않는다',()=>{
 const row="error CS1504: Source file 'apps/connector/native/CodexHandshakeHost.cs' could not be opened -- 'Access is denied.'";
 for(const stdout of [row+'\n'+row,row.replace('Access is denied.',"Access is denied.' or 'Win32 error 2"),row.replace('Source file','Source file PRIVATE_TOKEN'),row.replace('Access is denied.','Access is denied.\nWin32 error 2'),row.replace('CodexHandshakeHost.cs',"Codex'HandshakeHost.cs"),Buffer.concat([Buffer.from(row),Buffer.from([0xff])])]){
  const r=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(stdout),stderr:Buffer.alloc(0)},1) as any;
  assert.deepEqual(r.sourceOpenFailure,{fileRole:'UNKNOWN',osReason:'UNKNOWN'});assert.equal(JSON.stringify(r).includes('PRIVATE_TOKEN'),false);
 }
 const mixed=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(row),stderr:Buffer.from(row.replace('Access is denied.','Win32 error 2'))},1) as any;assert.deepEqual(mixed.sourceOpenFailure,{fileRole:'UNKNOWN',osReason:'UNKNOWN'});
 const fakePath=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(row.replace('apps/connector/native/CodexHandshakeHost.cs','PRIVATE_TOKEN')),stderr:Buffer.alloc(0)},1) as any;assert.deepEqual(fakePath.sourceOpenFailure,{fileRole:'UNKNOWN',osReason:'ACCESS_DENIED'});
 const extra=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(row.replace('Access is denied.','Access is denied. PRIVATE_TOKEN')),stderr:Buffer.alloc(0)},1) as any;assert.deepEqual(extra.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'UNKNOWN'});
 // PMO 후속 계약: 비ASCII reason은 source의 정확 일치와 별도로 판정한다. 임의 지역화는 이유 UNKNOWN.
 const localized=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(row.replace('Access is denied.','고정되지 않은 문구')),stderr:Buffer.alloc(0)},1) as any;assert.deepEqual(localized.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'UNKNOWN'});
});
test('PMO 지역화 계약: 허용 OS catalog의 UTF8·ANSI bytes만 대조하고 source는 독립 정확 일치다',()=>{
 // fixture는 실제 OS 문구/설치 locale 판정이 아니다. 실제 catalog 읽기는 별도 읽기 대조한다.
 const messages={2:{utf8:Buffer.from('정해진 파일 없음'),ansi:Buffer.from([0x81,0x41])},3:{utf8:Buffer.from('정해진 경로 없음'),ansi:Buffer.from([0x81,0x42])},5:{utf8:Buffer.from('정해진 접근 거절'),ansi:Buffer.from([0x81,0x43])},32:{utf8:Buffer.from('정해진 공유 위반'),ansi:Buffer.from([0x81,0x44])},33:{utf8:Buffer.from('정해진 잠금 위반'),ansi:Buffer.from([0x81,0x45])}};
 const source='apps/connector/native/CodexHandshakeHost.cs';
 for(const [code,want]of [[2,'NOT_FOUND'],[3,'NOT_FOUND'],[5,'ACCESS_DENIED'],[32,'SHARING_VIOLATION'],[33,'SHARING_VIOLATION']] as const){
  for(const bytes of [messages[code].utf8,messages[code].ansi]){
   const stdout=Buffer.concat([Buffer.from(`error CS1504: '${source}' 원본을 열 수 없습니다 ('`),bytes,Buffer.from("')\n")]);
   const r=(compileQa.compileFailureReceipt as any)({status:1,stdout,stderr:Buffer.alloc(0)},1,undefined,messages);
   assert.deepEqual(r.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:want});assert.equal(JSON.stringify(r).includes('정해진'),false);
  }
 }
 const row=`error CS1504: Source file '${source}' could not be opened -- 'Access is denied.'\n`;
 for(const bad of ['./'+source,'apps/connector/../connector/native/CodexHandshakeHost.cs',source.toUpperCase()]){
  const r=compileQa.compileFailureReceipt({status:1,stdout:Buffer.from(row.replace(source,bad)),stderr:Buffer.alloc(0)},1) as any;assert.deepEqual(r.sourceOpenFailure,{fileRole:'UNKNOWN',osReason:'ACCESS_DENIED'});
 }
 let reads=0;const hostile=Object.defineProperty({},'5',{get(){reads++;throw Error('PRIVATE_TOKEN');}});
 const bytes=Buffer.concat([Buffer.from(`error CS1504: Source file '${source}' could not be opened -- '`),messages[5].utf8,Buffer.from("'\n")]);
 for(const catalog of [undefined,hostile,new Proxy({},{getOwnPropertyDescriptor(){reads++;throw Error('PRIVATE_TOKEN');}}),{...messages,2:messages[5]}]){
  const r=(compileQa.compileFailureReceipt as any)({status:1,stdout:bytes,stderr:Buffer.alloc(0)},1,undefined,catalog);assert.deepEqual(r.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'UNKNOWN'});
 }
 assert.equal(reads,0);
});
test('CS1504 상세는 getter·Proxy·가짜 buffer와 message의 비밀을 읽지 않는다',()=>{
 const row="error CS1504: Source file 'apps/connector/native/CodexHandshakeHost.cs' could not be opened -- 'Win32 error 5'\n";
 let reads=0;const secret=()=>{reads++;throw Error('PRIVATE_TOKEN');};
 const hostile=Object.defineProperty({status:1,stdout:Buffer.from(row),stderr:Buffer.alloc(0)},'message',{get:secret});
 const r=compileQa.compileFailureReceipt(hostile,1) as any;assert.deepEqual(r.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'ACCESS_DENIED'});
 for(const value of [new Proxy({},{getOwnPropertyDescriptor:secret}),Object.defineProperty({status:1},'stdout',{get:secret}),{status:1,stdout:new Proxy(Buffer.from(row),{get:secret}),stderr:Buffer.alloc(0)},{status:1,stdout:Object.create(Buffer.prototype),stderr:Buffer.alloc(0)}])assert.equal((compileQa.compileFailureReceipt(value,1) as any).sourceOpenFailure,undefined);
 assert.equal(reads,0);assert.equal(JSON.stringify(r).includes('PRIVATE_TOKEN'),false);
});
test('CS1504 dispatcher 상세가 safe receipt에 이어지고 기존 raw 허용조건은 넓어지지 않는다',()=>{
 const row="error CS1504: Source file 'apps/connector/native/CodexHandshakeHost.cs' could not be opened -- 'Win32 error 32'\n";
 const gate=new compileQa.CompileOnlyAttempt();const r=gate.run(true,()=>{throw {status:1,stdout:Buffer.from(row),stderr:Buffer.alloc(0)};},()=>1);
 assert.equal(r.outcome,'COMPILE_FAILED');assert.deepEqual((r.receipt as any).sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'SHARING_VIOLATION'});assert.equal(gate.takeCapture(),undefined);assert.equal(r.nativeStarted,false);
 const ok=new compileQa.CompileOnlyAttempt();const success=ok.run(true,()=>Buffer.from(row),()=>1);assert.equal((success.receipt as any).sourceOpenFailure,undefined);assert.equal(ok.takeCapture(),undefined);
 const catalog={5:{utf8:Buffer.from('순수 접근 거절'),ansi:Buffer.alloc(0)}};const localized=new compileQa.CompileOnlyAttempt();
 const lr=localized.run(true,()=>{throw {status:1,stdout:Buffer.from("error CS1504: Source file 'apps/connector/native/CodexHandshakeHost.cs' could not be opened ('순수 접근 거절')\n"),stderr:Buffer.alloc(0)};},()=>1,undefined,catalog);
 assert.deepEqual(lr.receipt.sourceOpenFailure,{fileRole:'SOURCE_ARG',osReason:'ACCESS_DENIED'});assert.equal(localized.takeCapture(),undefined);assert.equal(JSON.stringify(lr).includes('순수 접근 거절'),false);
});
test('compile-only dispatcher는 성공·실패 모두 compile콜백1회로 끝나고 같은 gate 재호출을 거절한다',()=>{
 const Gate=(compileQa as any).CompileOnlyAttempt;assert.equal(typeof Gate,'function');
 let calls=0;const success=new Gate();
 const ok=success.run(true,()=>{calls++;return Buffer.alloc(0);},()=>10);
 assert.equal(ok.outcome,'COMPILED_NOT_EXECUTED');assert.equal(ok.nativeStarted,false);assert.equal(calls,1);
 assert.throws(()=>success.run(true,()=>{calls++;},()=>10),/QA_COMPILE_ONLY_ALREADY_USED/);assert.equal(calls,1);
 const failed=new Gate().run(true,()=>{calls++;throw {status:1,stderr:Buffer.from('SECRET')};},()=>20);
 assert.equal(failed.outcome,'COMPILE_FAILED');assert.equal(failed.receipt.classification,'NONZERO');assert.equal(failed.nativeStarted,false);assert.equal(calls,2);
 assert.throws(()=>new Gate().run(false,()=>{calls++;},()=>0),/QA_COMPILE_ONLY_NOT_AUTHORIZED/);assert.equal(calls,2);
});
