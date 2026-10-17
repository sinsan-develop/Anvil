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
