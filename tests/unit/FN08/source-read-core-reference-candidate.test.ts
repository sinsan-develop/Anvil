import assert from 'node:assert/strict';
import test from 'node:test';
const module=await import(new URL('../../../scripts/source-read-core-reference-candidate.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const input={sourceRoot:'D:\\src\\Anvil',sourceHash:'3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC',compilerHash:'46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00',mscorlibHash:'11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C',systemHash:'2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71',systemCoreHash:'8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D'};
function build(v:unknown=input){assert.equal(typeof module?.buildA3CoreReferenceCandidate,'function');return module!.buildA3CoreReferenceCandidate(v);}
test('새 비교 후보는 같은 절대 source·cwd·flags에서 System.Core 참조 하나만 추가하고 실행하지 않는다',()=>{
 const value=build();assert.equal(value.args.length,11);assert.equal(value.comparisonArgs.length,10);assert.equal(value.addedArgumentIndex,8);
 assert.deepEqual(value.args.filter((_:string,i:number)=>i!==8),value.comparisonArgs);assert.equal(value.args[8],'/reference:C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\System.Core.dll');assert.equal(value.args[10],input.sourceRoot+'\\apps\\connector\\native\\SourceReadObserver.cs');assert.equal(value.cwd,input.sourceRoot);
 for(const key of ['executionAuthorized','processStarted','osVerified','baselineConfirmed','callerFactsVerified'])assert.equal(value[key],false);assert.equal(value.candidateOnly,true);assert.deepEqual(value.limits,{timeoutMs:15000,combinedOutputBytes:16384,compilerStarts:1,retries:0});assert.match(value.commandHash,/^[0-9a-f]{64}$/);
});
test('후보는 소진된 QA/소비경로와 분리하고 새 외부결정·실제 metadata 대조를 요구한다',()=>{
 const value=build();assert.equal(value.runId,'a3-core-reference-compile-01');assert.equal(value.childEnvironment.TMP,'D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01-qa\\temp');assert.equal(value.childEnvironment.TMP,value.childEnvironment.TEMP);assert.equal(value.receiptProposed,'D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01.consumed.json');assert.ok(value.mustVerifyBeforeStart.includes('NEW_EXACT_REFERENCE_PATH_COMMIT_WINDOW_DECISION'));assert.ok(value.mustVerifyBeforeStart.includes('PRIOR_CONSUMED_RECORD_PRESERVED'));
 assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.args));assert.ok(Object.isFrozen(value.comparisonArgs));assert.ok(Object.isFrozen(value.childEnvironment));assert.ok(Object.isFrozen(value.expectedHashes));
});
test('변조 hash·경로겹침·추가승인필드·getter·Proxy는 후보 생성 전에 거절한다',()=>{
 assert.equal(typeof module?.buildA3CoreReferenceCandidate,'function');
 for(const value of [{...input,systemCoreHash:'0'.repeat(64)},{...input,sourceHash:'0'.repeat(64)},{...input,sourceRoot:'D:\\Project\\Anvil'},{...input,sourceRoot:'D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01-qa'},{...input,executionAuthorized:true}])assert.throws(()=>build(value));
 let traps=0;const getter={...input};Object.defineProperty(getter,'systemCoreHash',{enumerable:true,get(){traps++;return input.systemCoreHash;}});assert.throws(()=>build(getter));assert.throws(()=>build(new Proxy(input,{ownKeys(){traps++;return Reflect.ownKeys(input);},getPrototypeOf(){traps++;return Object.prototype;}})));assert.equal(traps,0);
});
