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
 const value={processes:[{pid:40744,startedAt:'2026-10-15T20:25:42.3705850Z'},{pid:26052,startedAt:'2026-10-15T12:28:17.5262970Z'}],listeners:[{port:3830,pid:40744}]};
 assert.doesNotThrow(()=>gate(value));
 for(const bad of [null,{...value,processes:[]},{...value,processes:[value.processes[1]]},{...value,processes:[{...value.processes[0],startedAt:'2026-10-17T03:00:00.0000000Z'},value.processes[1]]},{...value,listeners:[]},{...value,listeners:[{port:3830,pid:1}]},{...value,listeners:[...value.listeners,{port:3830,pid:1}]}])assert.throws(()=>gate(bad),{message:'OWNERSHIP_ORIGINAL_RUNTIME_UNVERIFIED'});
});

test('승인된 최초 run·절대 기한을 새 환경 입력이나 상대 수명으로 갱신하지 않는다',()=>{
 const gate=(host as any).validateOwnershipQaApproval;assert.equal(typeof gate,'function');
 const lease={runId:'2897e501-cbe9-491c-bd72-28b996f0499b',sourceSha:'a'.repeat(40),createdAt:'2026-10-17T03:31:53.000Z',expiresAt:'2026-10-17T04:01:53.000Z'},now=Date.parse('2026-10-17T03:40:00.000Z');
 assert.doesNotThrow(()=>gate(lease,now));
 for(const change of [{runId:spec.runId},{createdAt:'2026-10-17T03:32:53.000Z',expiresAt:'2026-10-17T04:02:53.000Z'},{expiresAt:'2026-10-17T04:01:53.001Z'},{sourceSha:'HEAD'},{extra:true}])assert.throws(()=>gate({...lease,...change},now),{message:'OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID'});
 for(const time of ['2026-10-17T03:31:52.999Z','2026-10-17T04:00:00.000Z','2026-10-17T04:01:53.000Z','2026-10-18T03:40:00.000Z'])assert.throws(()=>gate(lease,Date.parse(time)),{message:'OWNERSHIP_APPROVAL_EXPIRED_OR_INVALID'});
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
