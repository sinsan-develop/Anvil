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
