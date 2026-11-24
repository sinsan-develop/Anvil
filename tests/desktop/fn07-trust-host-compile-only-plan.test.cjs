'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const build=require('../../apps/desktop/scripts/desktop-trust-key-host-build.cjs');
let createCompileOnlyPlan;try{({createCompileOnlyPlan}=require('../../scripts/fn07-trust-host-compile-only-plan.cjs'));}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const id='11111111-1111-4111-8111-111111111111';
function fixture(){const qaRoot='C:\\QA\\fn07-compile-only-'+id;return{attemptId:id,sourceCommit:'1'.repeat(40),qaRoot,
 window:{startsAt:'2030-01-01T00:00:00.000Z',expiresAt:'2030-01-01T00:02:00.000Z'},
 configuration:{signerId:id,signerVersion:1,repoRoot:'C:\\Source',basisPath:qaRoot+'\\ParentBasis.json',outputPath:qaRoot+'\\TrustHost.CompileOnly.exe',
 compiler:{path:'C:\\Tools\\csc.exe',sha256:'a'.repeat(64)},references:build.REFERENCE_FILES.map(name=>({path:'C:\\References\\'+name,sha256:'b'.repeat(64)})),sources:build.SOURCE_FILES.map(path=>({path,sha256:'c'.repeat(64)}))}};}
test('순수 compile-only 후보는 정본 31/5 입력·x64 EXE·private 합성 basis만 조립한다',()=>{
 assert.equal(typeof createCompileOnlyPlan,'function');const input=fixture(),p=createCompileOnlyPlan(input);
 assert.equal(p.state,'CANDIDATE_ONLY');assert.equal(p.compilerExecuted,false);assert.equal(p.executionAuthorized,false);assert.equal(p.nativeAdmissionVerified,false);
 assert.equal(p.compilation.sources.length,31);assert.equal(p.compilation.references.length,5);
 assert.deepEqual(p.compilation.sources.map(s=>s.path),build.SOURCE_FILES);
 assert.equal(p.compilation.sources[12].path,'apps/connector/native/NormalUnderstandingReadSupervisorSource.cs');
 assert.deepEqual(p.compilation.references.map(r=>r.path.split('\\').at(-1)),build.REFERENCE_FILES);
 assert.deepEqual(p.compilation,build.createCompileInput(input.configuration,p.compilation.parentBasis));
 assert.ok(p.compilation.arguments.includes('/target:exe'));assert.ok(p.compilation.arguments.includes('/platform:x64'));
 assert.ok(p.compilation.arguments.includes('/resource:'+input.configuration.basisPath+',Anvil.Desktop.TrustKeyHost.ParentBasis.v1,private'));
 assert.equal(p.parentBasisKind,'SYNTHETIC_NOT_ADMISSION');assert.equal(p.compilerIdentity,'UNVERIFIED');
 assert.deepEqual(p.limits,{compileAttempts:1,totalMs:120000,stdoutBytes:65536,stderrBytes:65536,outputBytes:67108864});
 assert.equal(p.cleanup.failure,'PRESERVE');assert.equal(p.cleanup.recursive,false);assert.deepEqual(p.cleanup.files,[input.configuration.basisPath,input.configuration.outputPath]);
 assert.ok(p.cleanup.requires.includes('ORIGINAL_CHILD_CLOSED'));assert.ok(p.cleanup.requires.includes('SAME_ROOT_OWNER_AND_IDENTITY'));
 assert.equal(p.planHash.length,64);assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.compilation));
 input.configuration.sources[0].sha256='d'.repeat(64);assert.equal(p.compilation.sources[0].sha256,'c'.repeat(64));
});
test('누락·추가 소스/참조·무효 SHA와 임의 compiler/인수는 후보를 만들지 않는다',()=>{
 for(const alter of [x=>x.configuration.sources.pop(),x=>x.configuration.sources.splice(12,1),x=>x.configuration.sources.push(x.configuration.sources[0]),x=>x.configuration.sources.reverse(),x=>x.configuration.sources[0].sha256='0'.repeat(64),x=>x.configuration.references.push(x.configuration.references[0]),x=>x.configuration.compiler.path='csc.exe',x=>x.configuration.arguments=['/target:library'],x=>x.configuration.compiler.sha256='unknown']){const x=fixture();alter(x);assert.throws(()=>createCompileOnlyPlan(x),/FN07_COMPILE_ONLY_PLAN_INVALID/);}
});
test('새 전용 root와 정확 두 파일 외 경로·소스/도구 겹침을 거절한다',()=>{
 for(const alter of [x=>x.qaRoot='C:\\QA',x=>x.configuration.outputPath='C:\\other.exe',x=>x.configuration.basisPath=x.qaRoot+'\\nested\\ParentBasis.json',x=>x.configuration.repoRoot=x.qaRoot,x=>x.configuration.repoRoot='C:\\QA',x=>x.configuration.compiler.path=x.qaRoot+'\\csc.exe',x=>x.configuration.references[0].path=x.qaRoot+'\\mscorlib.dll']){const x=fixture();alter(x);assert.throws(()=>createCompileOnlyPlan(x),/FN07_COMPILE_ONLY_PLAN_INVALID/);}
});
test('단일 유한 window·결박 오염과 승인 자기선언은 거절한다',()=>{
 for(const alter of [x=>x.window.expiresAt=x.window.startsAt,x=>x.window.expiresAt='2030-01-01T00:02:00.001Z',x=>x.window.startsAt='2030-02-30T00:00:00.000Z',x=>x.configuration.signerId='22222222-2222-4222-8222-222222222222',x=>x.sourceCommit='main',x=>x.executionAuthorized=true]){const x=fixture();alter(x);assert.throws(()=>createCompileOnlyPlan(x),/FN07_COMPILE_ONLY_PLAN_INVALID/);}
});
test('입력 getter/Proxy를 평가하거나 외부 효과 포트를 받지 않는다',()=>{
 let calls=0;const x=fixture();Object.defineProperty(x.configuration.compiler,'sha256',{enumerable:true,get(){calls++;return'a'.repeat(64);}});
 assert.throws(()=>createCompileOnlyPlan(x),/FN07_COMPILE_ONLY_PLAN_INVALID/);assert.equal(calls,0);
 assert.throws(()=>createCompileOnlyPlan(new Proxy(fixture(),{get(){calls++;throw Error('RAW');}})),/FN07_COMPILE_ONLY_PLAN_INVALID/);assert.equal(calls,0);
 const callback=fixture();callback.invoke=()=>calls++;assert.throws(()=>createCompileOnlyPlan(callback),/FN07_COMPILE_ONLY_PLAN_INVALID/);assert.equal(calls,0);
});
test('같은 후보는 같은 지문이며 실제 관측/권위·환경 검산으로 승격되지 않는다',()=>{
 const a=createCompileOnlyPlan(fixture()),b=createCompileOnlyPlan(fixture());assert.equal(a.planHash,b.planHash);
 // 현재 31-source 합성 벡터다. 과거 승인 plan의 교체·실제 실행 허가가 아니다.
 assert.equal(a.planHash,'99770060f1263086cb9e94d4fd55e42a66c4a16f56ba4e7b84cf509bc1218796');
 const x=fixture();x.configuration.compiler.sha256='d'.repeat(64);assert.notEqual(createCompileOnlyPlan(x).planHash,a.planHash);
 assert.ok(a.requiredEvidence.includes('CURRENT_COMPILER_AND_REFERENCE_BYTES'));
 assert.ok(a.requiredEvidence.includes('EXCLUSIVE_ATTEMPT_RECORD'));
 assert.equal(a.outputMayExecute,false);assert.equal(a.actualCleanupPerformed,false);
 assert.notEqual(a.compilation.parentBasis.parentExeHash,a.compilation.compiler.sha256);
 assert.equal(a.compilation.parentBasis.parentExeHash,createHash('sha256').update('FN07_COMPILE_ONLY_SYNTHETIC_PARENT_EXE_V1').digest('hex'));
});
