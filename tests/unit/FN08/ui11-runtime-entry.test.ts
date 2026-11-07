import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../../scripts/transition-ui11-development.ps1',import.meta.url));
function run(mode:string){return spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-File',script,mode],{encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,ANVIL_UI11_RUNTIME_APPROVAL:''}});}
test('교체 plan은 원 프로세스·파일·DB에 접근하지 않고 고정 범위만 반환한다',()=>{
 const result=run('-Plan');assert.equal(result.status,0,result.stderr);const v=JSON.parse(result.stdout);assert.equal(v.mode,'PLAN');assert.equal(v.port,3830);assert.equal(v.originalPid,23836);assert.equal(v.serviceChanges,0);assert.equal(v.secretReads,0);
});
test('무승인 apply는 원 PID 조회/종료 전 고정 오류만 반환한다',()=>{
 const result=run('-Apply');assert.equal(result.status,1);assert.deepEqual(JSON.parse(result.stdout),{status:'FAIL_BEFORE_STOP',failure:'UI11_RUNTIME_BINDING_INVALID',originalStopAttempted:false});assert.equal(result.stderr,'');
});
test('v1 GUID는 원 PID 종료 전 binding에서 거절하고 인자 생성까지 미루지 않는다',()=>{
 const now=Date.now();
 const result=spawnSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-File',script,'-Apply'],{encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,ANVIL_UI11_RUNTIME_APPROVAL:'AV3-PMO-N4-SERVICE-TRANSITION',ANVIL_UI11_RUNTIME_COMMIT:'a'.repeat(40),ANVIL_UI11_RUNTIME_SCRIPT_HASH:'b'.repeat(64),ANVIL_UI11_RUNTIME_FLOW_HASH:'c'.repeat(64),ANVIL_UI11_RUNTIME_ISSUED_AT:new Date(now-1000).toISOString(),ANVIL_UI11_RUNTIME_EXPIRES_AT:new Date(now+600000).toISOString(),ANVIL_UI11_RUNTIME_RUN_ID:'ab895197-2c6f-1f49-923e-7029d472381d'}});
 assert.equal(result.status,1);assert.deepEqual(JSON.parse(result.stdout),{status:'FAIL_BEFORE_STOP',failure:'UI11_RUNTIME_BINDING_INVALID',originalStopAttempted:false});
});
