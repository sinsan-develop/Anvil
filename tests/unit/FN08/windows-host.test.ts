import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as host from '../../../apps/connector/runtime/windows-host.ts';
const spec={runId:'11111111-1111-4111-8111-111111111111',generation:1,expiresAt:'2026-10-17T04:00:00.000Z',profile:'SYNTHETIC_WORKER',mode:'COOPERATIVE',executableHash:'a'.repeat(64)};
test('소유 helper의 QA 명세는 고정 프로필·정확 UUID/세대/hash/유한 수명만 허용한다',()=>{
 assert.equal(typeof (host as any).validateOwnershipQaSpec,'function');const check=(host as any).validateOwnershipQaSpec,now=Date.parse('2026-10-17T03:30:00.000Z');
 assert.deepEqual(check(spec,now),spec);
 for(const change of [{runId:'../outside'},{generation:0},{generation:1.5},{profile:'SHELL'},{mode:'AGENT'},{executableHash:'main'},{expiresAt:'2026-10-17T04:00:00.001Z'},{cwd:'C:\\'},{arguments:['-c','anything']}])assert.throws(()=>check({...spec,...change},now),{message:'OWNERSHIP_SPEC_INVALID'});
 assert.throws(()=>check(spec,Date.parse(spec.expiresAt)),{message:'OWNERSHIP_SPEC_INVALID'});
});
test('PID·시작시각·실행세대/job 불일치나 UNKNOWN 관측을 회수 완료로 채택하지 않는다',()=>{
 assert.equal(typeof (host as any).ownershipReclaimed,'function');const check=(host as any).ownershipReclaimed,ref={runId:spec.runId,generation:1,jobId:'22222222-2222-4222-8222-222222222222',pid:123,startTicks:'133000000000000000',executableHash:spec.executableHash};
 assert.equal(check(ref,{processRef:ref,state:'RECLAIMED',active:0,processes:[]}),true);
 for(const value of [{processRef:{...ref,pid:124},state:'RECLAIMED',active:0,processes:[]},{processRef:{...ref,generation:2},state:'RECLAIMED',active:0,processes:[]},{processRef:{...ref,startTicks:'133000000000000001'},state:'RECLAIMED',active:0,processes:[]},{processRef:ref,state:'UNKNOWN',active:0,processes:[]},{processRef:ref,state:'RECLAIMED',active:1,processes:[]},{processRef:ref,state:'RECLAIMED',active:0,processes:[{pid:123}]}])assert.equal(check(ref,value),false);
});
test('실패 이미지 진단은 유한 비밀없는 별도 UNKNOWN 타입이며 실행 사실/권한으로 승격되지 않는다',()=>{
 assert.equal(typeof (host as any).ownershipFailureDiagnostic,'function');const decode=(host as any).ownershipFailureDiagnostic;
 const value={basename:'conhost.exe',imageHash:'b'.repeat(64),pid:456,parentPid:123,startTicks:'133000000000000000',inJob:true,pathMatches:false,hashMatches:false};
 assert.deepEqual(decode(value),{kind:'OWNERSHIP_DIAGNOSTIC',state:'UNKNOWN',...value});
 for(const change of [{basename:'C:\\PRIVATE\\secret.exe'},{basename:'../secret'},{imageHash:'private'},{pid:0},{parentPid:-1},{startTicks:'raw secret'},{inJob:'true'},{commandLine:'SECRET'},{state:'RECLAIMED'}])assert.equal(decode({...value,...change}),null);
 assert.equal(host.ownershipReclaimed({runId:spec.runId,generation:1,jobId:spec.runId,pid:456,startTicks:value.startTicks,executableHash:spec.executableHash},decode(value)),false);
});

test('원 Node·relay의 실제 존재/시작시각·3830 소유가 없으면 새 QA를 거절한다',()=>{
 const gate=(host as any).validateOwnershipOriginalRuntime;assert.equal(typeof gate,'function');
 const value={processes:[{pid:19960,startedAt:'2026-10-17T04:02:09.6293870Z'},{pid:26052,startedAt:'2026-10-15T12:28:17.5262970Z'}],listeners:[{port:3830,pid:19960,address:'127.0.0.1'}]};
 assert.doesNotThrow(()=>gate(value));
 for(const bad of [null,{...value,processes:[]},{...value,processes:[value.processes[1]]},{...value,processes:[{...value.processes[0],startedAt:'2026-10-17T03:00:00.0000000Z'},value.processes[1]]},{...value,processes:[{pid:40744,startedAt:'2026-10-15T20:25:42.3705850Z'},value.processes[1]]},{...value,listeners:[]},{...value,listeners:[{port:3830,pid:1,address:'127.0.0.1'}]},{...value,listeners:[{...value.listeners[0],address:'0.0.0.0'}]},{...value,listeners:[...value.listeners,{port:3830,pid:1}]}])assert.throws(()=>gate(bad),{message:'OWNERSHIP_ORIGINAL_RUNTIME_UNVERIFIED'});
});

test('승인된 최초 run·절대 기한을 새 환경 입력이나 상대 수명으로 갱신하지 않는다',()=>{
 const gate=(host as any).validateOwnershipQaApproval;assert.equal(typeof gate,'function');
 const lease={runId:'8c10a7c8-bfa8-458c-a24b-1f0578119407',sourceSha:'a'.repeat(40),createdAt:'2026-10-17T04:25:00.000Z',expiresAt:'2026-10-17T04:55:00.000Z'},now=Date.parse('2026-10-17T04:30:00.000Z');
 assert.doesNotThrow(()=>gate(lease,now));
 for(const change of [{runId:spec.runId},{createdAt:'2026-10-17T04:26:00.000Z',expiresAt:'2026-10-17T04:56:00.000Z'},{expiresAt:'2026-10-17T04:55:00.001Z'},{sourceSha:'HEAD'},{extra:true}])assert.throws(()=>gate({...lease,...change},now),{message:'OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID'});
 for(const time of ['2026-10-17T04:24:59.999Z','2026-10-17T04:53:00.001Z','2026-10-17T04:55:00.000Z','2026-10-18T04:30:00.000Z'])assert.throws(()=>gate(lease,Date.parse(time)),{message:'OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID'});
});

test('미시작 준비취소는 정확 ref·소유 확인과 실제 종결/빈 job 관측 전 완료가 아니다',()=>{
 const check=(host as any).ownershipPreparationCancelled;assert.equal(typeof check,'function');
 const ref={runId:spec.runId,generation:1,jobId:spec.runId,pid:123,startTicks:'133000000000000000',executableHash:spec.executableHash};
 const value={processRef:ref,state:'PREPARATION_CANCELLED',neverResumed:true,identityVerified:true,terminationObserved:true,active:0,processes:[]};assert.equal(check(ref,value),true);
 for(const change of [{state:'UNKNOWN'},{state:'RECLAIMED'},{processRef:{...ref,generation:2}},{neverResumed:false},{identityVerified:false},{terminationObserved:false},{active:1},{processes:[123]}])assert.equal(check(ref,{...value,...change}),false);
});

test('UNKNOWN은 sticky이며 새 세대/launch·RESUME·FORCE를 막고 정리전용 요청만 남긴다',()=>{
 const State=(host as any).OwnershipQaSafetyState;assert.equal(typeof State,'function');const state=new State();
 assert.doesNotThrow(()=>state.require('PREPARE'));state.markUnknown();assert.equal(state.observationUnknown,true);
 for(const operation of ['PREPARE','RESUME','FORCE','STOP','OBSERVE'])assert.throws(()=>state.require(operation),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
 assert.doesNotThrow(()=>state.require('CANCEL_PREPARED'));state.markUnknown();assert.equal(state.observationUnknown,true);
 assert.throws(()=>state.require('PREPARE'),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
});

test('고정 helper IPC는 newline 전 누적16KiB를 초과하면 영구 거절하고 분할 UTF8·정상 EOF를 구별한다',()=>{
 const Decoder=(host as any).OwnershipFrameDecoder;assert.equal(typeof Decoder,'function');
 const decoder=new Decoder();const bytes=Buffer.from('{"reason":"가"}\r\n');assert.deepEqual(decoder.push(bytes.subarray(0,12)),[]);assert.deepEqual(decoder.push(bytes.subarray(12)),['{"reason":"가"}']);assert.doesNotThrow(()=>decoder.end());assert.throws(()=>decoder.push(Buffer.from('{}\n')),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
 const exact=new Decoder();assert.deepEqual(exact.push(Buffer.alloc(16384,32)),[]);assert.deepEqual(exact.push(Buffer.from('\n')),[' '.repeat(16384)]);assert.doesNotThrow(()=>exact.end());
 const crlf=new Decoder();crlf.push(Buffer.alloc(16384,32));assert.deepEqual(crlf.push(Buffer.from('\r\n')),[' '.repeat(16384)]);assert.doesNotThrow(()=>crlf.end());
 const oversized=new Decoder();oversized.push(Buffer.alloc(16384,32));assert.throws(()=>oversized.push(Buffer.from('x')),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});assert.throws(()=>oversized.push(Buffer.from('\n{}\n')),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
 const partial=new Decoder();partial.push(Buffer.from('{"id":'));assert.throws(()=>partial.end(),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
 const utf8=new Decoder();assert.throws(()=>utf8.push(Buffer.from([0xc0,0xaf,10])),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
});

test('고정 helper 응답의 중복 key·잘못된 JSON/상태는 정상 관측으로 전달하지 않는다',()=>{
 const decode=(host as any).decodeOwnershipReply;assert.equal(typeof decode,'function');
 const valid={id:1,ok:true,data:{state:'PREPARED'}};assert.deepEqual(decode(JSON.stringify(valid)),valid);
 for(const line of ['{"id":1,"id":2,"ok":true,"data":{"state":"PREPARED"}}','{"id":1,"\\u0069d":2,"ok":true,"data":{"state":"PREPARED"}}','{"id":','[]','{"id":1,"ok":true,"data":{"state":"SAFE"}}','{"id":1,"ok":true,"data":[]}','{"id":1.5,"ok":true,"data":{"state":"PREPARED"}}'])assert.throws(()=>decode(line),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
});

test('고정 helper 송신은 UTF8 바이트 상한을 검사한 후에만 프레임을 반환한다',()=>{
 const encode=(host as any).encodeOwnershipFrame;assert.equal(typeof encode,'function');
 assert.equal(encode({id:1}).toString(),'{"id":1}\n');
 assert.equal(encode({x:'a'.repeat(16376)}).length,16385);
 for(const v of [{x:'a'.repeat(16377)},{x:'가'.repeat(5460)}])assert.throws(()=>encode(v),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
});

test('QA-02는 새 승인창과 새 보존 대상을 준비하되 QA-01 run/시각을 되살리지 않는다',()=>{
 const gate=host.validateOwnershipQaApproval,now=Date.parse('2026-10-17T04:30:00.000Z');
 const lease={runId:'8c10a7c8-bfa8-458c-a24b-1f0578119407',sourceSha:'b'.repeat(40),createdAt:'2026-10-17T04:25:00.000Z',expiresAt:'2026-10-17T04:55:00.000Z'};
 assert.doesNotThrow(()=>gate(lease,now));assert.throws(()=>gate({...lease,runId:'2897e501-cbe9-491c-bd72-28b996f0499b'},now),{message:'OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID'});
 assert.doesNotThrow(()=>host.validateOwnershipOriginalRuntime({processes:[{pid:19960,startedAt:'2026-10-17T04:02:09.6293870Z'},{pid:26052,startedAt:'2026-10-15T12:28:17.5262970Z'}],listeners:[{port:3830,pid:19960,address:'127.0.0.1'}]}));
});
