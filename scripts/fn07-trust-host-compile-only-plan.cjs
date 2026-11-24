'use strict';
const path=require('node:path'),{createHash}=require('node:crypto'),{types}=require('node:util');
const {SOURCE_FILES,REFERENCE_FILES,createCompileInput}=require('../apps/desktop/scripts/desktop-trust-key-host-build.cjs');
const {canonical}=require('../apps/desktop/scripts/verify-desktop-trust-key-host.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
function invalid(){throw Error('FN07_COMPILE_ONLY_PLAN_INVALID');}
function exact(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
// 실행 포트/파일 reader가 없는 데이터 사본. 임의 getter·Proxy·순환을 평가하지 않는다.
function copy(value){
 let nodes=0,bytes=0;const active=new Set();
 function visit(v,depth){
  if(++nodes>1024||depth>12||types.isProxy(v))invalid();
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='string'){if(!v.isWellFormed()||v.length>2048||(bytes+=Buffer.byteLength(v))>65536)invalid();return;}
  if(typeof v==='number'){if(!Number.isSafeInteger(v))invalid();return;}
  if(!v||typeof v!=='object'||active.has(v))invalid();
  if(!Array.isArray(v)&&![Object.prototype,null].includes(Object.getPrototypeOf(v)))invalid();
  const descriptors=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(descriptors);
  if(keys.some(k=>typeof k!=='string'||['__proto__','prototype','constructor','toJSON'].includes(k)))invalid();
  if(Array.isArray(v)&&(keys.length!==v.length+1||Array.from({length:v.length},(_,i)=>String(i)).some(k=>!Object.hasOwn(descriptors,k))))invalid();
  active.add(v);
  for(const k of keys){if(Array.isArray(v)&&k==='length')continue;const d=descriptors[k];if(!d.enumerable||!('value'in d))invalid();visit(d.value,depth+1);}
  active.delete(v);
 }
 visit(value,0);return JSON.parse(canonical(value));
}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function within(root,target){const r=path.win32.relative(root.toLowerCase(),target.toLowerCase());return r===''||(!r.startsWith('..\\')&&r!=='..'&&!path.win32.isAbsolute(r));}
function time(value){if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value))invalid();const n=Date.parse(value);if(!Number.isSafeInteger(n)||new Date(n).toISOString()!==value)invalid();return n;}
/** 순수 후보만 만든다. SHA/시간/경로는 향후 실행안의 입력이지 현재 관측·승인 증거가 아니다.
 * 기존 package verifier/produceCompileInput/compiler runner/출력 EXE를 호출하지 않는다.
 */
function createCompileOnlyPlan(raw){
 try{
  const input=copy(raw);
  if(!exact(input,['attemptId','sourceCommit','qaRoot','window','configuration'])||!exact(input.window,['startsAt','expiresAt'])||
   typeof input.attemptId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.attemptId)||
   typeof input.sourceCommit!=='string'||!/^[0-9a-f]{40}$/.test(input.sourceCommit)||input.sourceCommit==='0'.repeat(40))invalid();
  const root=input.qaRoot;
  if(typeof root!=='string'||!/^[A-Za-z]:\\/.test(root)||path.win32.normalize(root)!==root||root.length>1024||/[<>:"|?*\x00-\x1f\x7f,@]/.test(root.slice(2))||
   path.win32.basename(root)!=='fn07-compile-only-'+input.attemptId||root.slice(3).split('\\').some(p=>!p||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)))invalid();
  const duration=time(input.window.expiresAt)-time(input.window.startsAt);if(duration<1||duration>120000)invalid();
  const c=input.configuration;
  if(!c||c.signerId!==input.attemptId||c.signerVersion!==1||c.basisPath!==path.win32.join(root,'ParentBasis.json')||c.outputPath!==path.win32.join(root,'TrustHost.CompileOnly.exe'))invalid();
  const parent={schemaVersion:1,purpose:'DESKTOP_TRUST_SIGNER_PARENT_BASIS',namespace:'ANVIL_DESKTOP_TRUST_SIGNER_V1',signerId:input.attemptId,signerVersion:1,
   parentExeHash:hash('FN07_COMPILE_ONLY_SYNTHETIC_PARENT_EXE_V1'),parentAsarHash:hash('FN07_COMPILE_ONLY_SYNTHETIC_PARENT_ASAR_V1'),parentHeaderHash:hash('FN07_COMPILE_ONLY_SYNTHETIC_PARENT_HEADER_V1')};
  const compilation=createCompileInput(c,parent);
  if(SOURCE_FILES.length!==31||REFERENCE_FILES.length!==5||within(root,compilation.workingDirectory)||within(compilation.workingDirectory,root)||
   [compilation.compiler,...compilation.references].some(f=>within(root,f.path)))invalid();
  const body={schemaVersion:1,state:'CANDIDATE_ONLY',purpose:'FN07_TRUST_HOST_COMPILE_ONLY_PLAN',attemptId:input.attemptId,sourceCommit:input.sourceCommit,qaRoot:root,window:input.window,
   parentBasisKind:'SYNTHETIC_NOT_ADMISSION',compilerIdentity:'UNVERIFIED',compilation,
   limits:{compileAttempts:1,totalMs:duration,stdoutBytes:65536,stderrBytes:65536,outputBytes:67108864},
   diagnostics:{rawReturn:false,scope:'BOUNDED_COMPILE_DIAGNOSTICS_ONLY'},
   cleanup:{failure:'PRESERVE',recursive:false,files:[c.basisPath,c.outputPath],requires:['SUCCESS','ORIGINAL_CHILD_CLOSED','NO_PENDING_IO','WITHIN_ORIGINAL_DEADLINE','SAME_ROOT_OWNER_AND_IDENTITY','EXCLUSIVE_CREATED_FILES_UNCHANGED','NO_OTHER_ENTRIES','EXPLICIT_CLEANUP_SCOPE']},
   requiredEvidence:['EXACT_EXECUTION_APPROVAL','SOURCE_COMMIT_AND_BYTES','CURRENT_COMPILER_AND_REFERENCE_BYTES','NEW_EXCLUSIVE_QA_ROOT','CURRENT_ROOT_OWNER_AND_IDENTITY','EXCLUSIVE_ATTEMPT_RECORD','FIXED_COMPILER_ENVIRONMENT','ORIGINAL_HANDLE_WALL_AND_MONOTONIC_DEADLINE'],
   executionAuthorized:false,compilerExecuted:false,nativeAdmissionVerified:false,outputMayExecute:false,actualCleanupPerformed:false};
  return freeze({...body,planHash:hash(canonical(body))});
 }catch{invalid();}
}
module.exports={createCompileOnlyPlan};
