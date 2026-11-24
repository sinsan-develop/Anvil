'use strict';
const path=require('node:path'),{createHash}=require('node:crypto'),{types}=require('node:util');
const {createCompileOnlyPlan}=require('./fn07-trust-host-compile-only-plan.cjs');
const {canonical,verifyDesktopTrustKeyHost}=require('../apps/desktop/scripts/verify-desktop-trust-key-host.cjs');

const ATTEMPT_PURPOSE='FN07_TRUST_HOST_COMPILE_ONLY_ATTEMPT_V1';
const AUTHORITY_PURPOSE='FN07_TRUST_HOST_COMPILE_ONLY_EXTERNAL_APPROVAL_V1';
const AUTHORITY_EVIDENCE='EXTERNAL_SOURCE_CURRENT_NOT_HUMAN_PROOF';
const attemptedRoots=new Set();
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')?.get;

function invalid(){throw Error('FN07_COMPILE_ONLY_RUN_INVALID');}
function exact(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(descriptors);
 return own.length===keys.length&&keys.every(key=>descriptors[key]?.enumerable&&'value'in descriptors[key]);
}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function ownedBuffer(value,max){
 if(!byteLength||types.isProxy(value)||!Buffer.isBuffer(value)||Object.getPrototypeOf(value)!==Buffer.prototype)invalid();
 for(const key of ['length','byteLength','copy','equals','subarray','slice','constructor',Symbol.iterator,Symbol.toPrimitive])if(Object.getOwnPropertyDescriptor(value,key))invalid();
 const size=Reflect.apply(byteLength,value,[]);if(!Number.isSafeInteger(size)||size<0||size>max)invalid();
 const result=Buffer.alloc(size);Reflect.apply(Uint8Array.prototype.set,result,[value]);return result;
}
function authoritySnapshot(value,plan){
 const keys=['schemaVersion','purpose','approvalId','attemptId','planHash','sourceCommit','startsAt','expiresAt','state'];
 if(!exact(value,keys))invalid();
 const descriptors=Object.getOwnPropertyDescriptors(value),copy=Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
 if(copy.schemaVersion!==1||copy.purpose!==AUTHORITY_PURPOSE||copy.attemptId!==plan.attemptId||copy.planHash!==plan.planHash||
  copy.sourceCommit!==plan.sourceCommit||copy.startsAt!==plan.window.startsAt||copy.expiresAt!==plan.window.expiresAt||copy.state!=='CURRENT'||
  typeof copy.approvalId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(copy.approvalId))invalid();
 return freeze(copy);
}
function methods(value,keys){
 if(!exact(value,keys))invalid();const descriptors=Object.getOwnPropertyDescriptors(value),result={};
 for(const key of keys){if(typeof descriptors[key].value!=='function')invalid();result[key]=descriptors[key].value;}
 return Object.freeze(result);
}
function stringList(value){
 if(!Array.isArray(value)||types.isProxy(value))invalid();const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.length!==value.length+1||!descriptors.length||descriptors.length.value!==value.length||Array.from({length:value.length},(_,index)=>String(index)).some(key=>!descriptors[key]?.enumerable||!('value'in descriptors[key])||typeof descriptors[key].value!=='string'))invalid();
 return Array.from({length:value.length},(_,index)=>descriptors[String(index)].value);
}
function response(plan,state,reason,extra={}){
 return freeze({state,planHash:plan.planHash,reason,authorityEvidence:AUTHORITY_EVIDENCE,outputMayExecute:false,assemblyLoaded:false,
  compilerExecutionVerified:false,outputFileIdentityVerified:false,originalWindowsAuthorityVerified:false,actualCleanupPerformed:false,...extra});
}
class RunFailure extends Error{constructor(state,reason,extra={}){super(reason);this.state=state;this.reason=reason;this.extra=extra;}}
const failed=(reason,extra)=>new RunFailure('FAILED_PRESERVED',reason,extra);
const unknown=(reason,extra)=>new RunFailure('UNKNOWN_PRESERVED',reason,extra);

async function createCompileOnlyLifecycle(rawPlan,rawAuthority,rawPorts){
 const plan=createCompileOnlyPlan(rawPlan),authority=methods(rawAuthority,['read','check']),ports=methods(rawPorts,['now','monotonic','schedule','read','openExclusive','inspectWorkspace','inspectOutput']);
 const startsAt=Date.parse(plan.window.startsAt),expiresAt=Date.parse(plan.window.expiresAt);let used=false,initial,initialCanonical,activeAnchor,lastClock;
 const clock=anchor=>{let wall,mono;try{wall=ports.now();mono=ports.monotonic();}catch{throw unknown('CLOCK_UNAVAILABLE');}
  if(!Number.isSafeInteger(wall)||!Number.isSafeInteger(mono)||wall<startsAt||wall>=expiresAt)throw failed('EXECUTION_WINDOW_NOT_CURRENT');
  if(anchor&&(wall<anchor.wall||mono<anchor.mono))throw unknown('CLOCK_REVERSED');if(lastClock&&(wall<lastClock.wall||mono<lastClock.mono))throw unknown('CLOCK_REVERSED');
  if(anchor&&mono-anchor.mono>=plan.limits.totalMs)throw failed('EXECUTION_WINDOW_NOT_CURRENT');lastClock={wall,mono};return{wall,mono};};
 const within=async(anchor,reason,operation)=>{const before=clock(anchor),remaining=Math.min(expiresAt-before.wall,plan.limits.totalMs-(before.mono-anchor.mono),120000);
  const controller=new AbortController();let cancel,expired=false,resolveTimeout;const timeout=new Promise(resolve=>{resolveTimeout=resolve;});
  try{cancel=ports.schedule(()=>{expired=true;controller.abort();resolveTimeout({timeout:true});},remaining);if(typeof cancel!=='function')throw Error();if(expired){try{cancel();}catch{}throw unknown(reason);}clock(anchor);}
  catch(error){controller.abort();if(typeof cancel==='function')try{cancel();}catch{}if(error instanceof RunFailure)throw error;throw unknown('TIMER_UNAVAILABLE');}
  const work=Promise.resolve().then(()=>{if(controller.signal.aborted)throw unknown(reason);return operation(controller.signal,remaining);}).then(value=>({value}),error=>({error}));
  let result;try{result=await Promise.race([work,timeout]);}finally{try{cancel();}catch{expired=true;}}if(expired||result?.timeout)throw unknown(reason);if(result?.error)throw result.error;clock(anchor);return result.value;};
 const currentAuthority=async signal=>{let current;try{current=authoritySnapshot(await authority.read(signal),plan);clock(activeAnchor);if(!initial){initial=current;initialCanonical=canonical(current);}else if(canonical(current)!==initialCanonical)throw failed('AUTHORITY_CHANGED');
   if(signal.aborted)throw unknown('AUTHORITY_CHECK_DEADLINE_UNCONFIRMED');if(await authority.check(current,signal)!==true)throw failed('AUTHORITY_NOT_CURRENT');}catch(error){if(error instanceof RunFailure)throw error;throw failed('AUTHORITY_NOT_CURRENT');}return current;};
 const captureHandle=raw=>{const keys=['identity','rootIdentity','write','sync','read','close'];if(!exact(raw,keys))throw unknown('OWNED_HANDLE_INVALID');const d=Object.getOwnPropertyDescriptors(raw),result={};
  for(const key of keys){const value=d[key].value;if(key==='identity'||key==='rootIdentity'){if(typeof value!=='string'||!value)throw unknown('OWNED_HANDLE_INVALID');}else if(typeof value!=='function')throw unknown('OWNED_HANDLE_INVALID');result[key]=value;}return Object.freeze(result);};
 const closeHandle=async(handle,signal)=>{try{await handle.close(signal);return true;}catch{return false;}};
 const ownedRoundTrip=async(file,bytes,kind,signal)=>{let raw;try{raw=await ports.openExclusive(file,signal);}catch(error){if(kind==='ATTEMPT'&&error?.code==='EXISTS')throw failed('EXCLUSIVE_ATTEMPT_UNAVAILABLE');throw unknown(kind+'_OPEN_UNKNOWN');}
  let handle;try{handle=captureHandle(raw);}catch(error){const d=raw&&typeof raw==='object'&&!types.isProxy(raw)?Object.getOwnPropertyDescriptors(raw):{},close=d.close?.value;if(typeof close==='function')try{await close(signal);}catch{}throw error;}
  const expected=Buffer.from(bytes),outbound=Buffer.from(bytes);let problem;try{if(signal.aborted)throw unknown(kind+'_DEADLINE_UNCONFIRMED');const written=await handle.write(outbound,signal);clock(activeAnchor);if(written!==outbound.length)problem=unknown(kind+'_WRITE_UNKNOWN');
   outbound.fill(0);if(!problem){if(signal.aborted)throw unknown(kind+'_DEADLINE_UNCONFIRMED');await handle.sync(signal);clock(activeAnchor);}if(!problem){if(signal.aborted)throw unknown(kind+'_DEADLINE_UNCONFIRMED');const readback=ownedBuffer(await handle.read(expected.length+1,signal),expected.length+1);clock(activeAnchor);try{if(readback.length!==expected.length||!readback.equals(expected))problem=failed(kind+'_READBACK_MISMATCH');}finally{readback.fill(0);}}}
  catch(error){problem=error instanceof RunFailure?error:unknown(kind+'_IO_UNKNOWN');}finally{outbound.fill(0);expected.fill(0);}if(!await closeHandle(handle,signal))problem=unknown(kind+'_CLOSE_UNKNOWN');if(problem)throw problem;return Object.freeze({identity:handle.identity,rootIdentity:handle.rootIdentity});};
 const readInputs=async signal=>{const observed=[],bindings=[...plan.compilation.sources.map(source=>({path:path.win32.join(plan.compilation.workingDirectory,...source.path.split('/')),sha256:source.sha256,max:1024*1024})),
   {path:plan.compilation.compiler.path,sha256:plan.compilation.compiler.sha256,max:64*1024*1024},...plan.compilation.references.map(reference=>({path:reference.path,sha256:reference.sha256,max:64*1024*1024}))];
  for(const binding of bindings){clock(activeAnchor);if(signal.aborted)throw unknown('INPUT_READ_DEADLINE_UNCONFIRMED');let bytes;try{bytes=ownedBuffer(await ports.read(binding.path,binding.max,signal),binding.max);clock(activeAnchor);}catch(error){if(error instanceof RunFailure)throw error;throw unknown('INPUT_READ_UNKNOWN');}
   try{const digest=createHash('sha256').update(bytes).digest('hex');if(digest!==binding.sha256)throw failed('INPUT_HASH_MISMATCH');observed.push([binding.path,digest,bytes.length]);}finally{bytes.fill(0);}}
  return createHash('sha256').update(canonical(observed)).digest('hex');};
 const readClaim=async(claimPath,claimBytes,signal)=>{let bytes;try{bytes=ownedBuffer(await ports.read(claimPath,claimBytes.length+1,signal),claimBytes.length+1);}catch{throw unknown('ATTEMPT_RECHECK_UNKNOWN');}
  try{if(bytes.length!==claimBytes.length||!bytes.equals(claimBytes))throw failed('ATTEMPT_RECORD_CHANGED');}finally{bytes.fill(0);}};
 const inspectWorkspace=async(binding,signal)=>{let raw;try{raw=await ports.inspectWorkspace(Object.freeze({attemptId:plan.attemptId,planHash:plan.planHash,outputPath:plan.compilation.outputPath,
   rootIdentity:binding.rootIdentity,attemptIdentity:binding.attemptIdentity,basisIdentity:binding.basisIdentity}),signal);}catch{throw unknown('WORKSPACE_PREFLIGHT_UNKNOWN');}
  const keys=['state','attemptId','planHash','outputPath','rootIdentity','attemptIdentity','basisIdentity','outputAbsent','entries'];if(!exact(raw,keys))throw unknown('WORKSPACE_PREFLIGHT_INVALID');const d=Object.getOwnPropertyDescriptors(raw),v=Object.fromEntries(keys.map(key=>[key,d[key].value]));let entries;
  try{entries=stringList(v.entries);}catch{throw unknown('WORKSPACE_PREFLIGHT_INVALID');}
  if(v.state!=='OWNED_ROOT_PREFLIGHT_NOT_OS_VERIFIED'||v.attemptId!==plan.attemptId||v.planHash!==plan.planHash||v.outputPath!==plan.compilation.outputPath||v.rootIdentity!==binding.rootIdentity||
   v.attemptIdentity!==binding.attemptIdentity||v.basisIdentity!==binding.basisIdentity||v.outputAbsent!==true||canonical(entries)!==canonical(['ParentBasis.json','attempt.json']))throw failed('WORKSPACE_PREFLIGHT_MISMATCH');
 };
 const inspectOutput=async(binding,signal)=>{let raw;try{raw=await ports.inspectOutput(Object.freeze({attemptId:plan.attemptId,planHash:plan.planHash,outputPath:plan.compilation.outputPath,
   rootIdentity:binding.rootIdentity,attemptIdentity:binding.attemptIdentity,basisIdentity:binding.basisIdentity}),plan.limits.outputBytes,signal);}catch{throw unknown('OUTPUT_CUSTODY_UNKNOWN');}
  const keys=['state','attemptId','planHash','outputPath','rootIdentity','attemptIdentity','basisIdentity','outputIdentity','bytes'];if(!exact(raw,keys))throw unknown('OUTPUT_CUSTODY_INVALID');const d=Object.getOwnPropertyDescriptors(raw),v=Object.fromEntries(keys.map(k=>[k,d[k].value]));
  if(v.state!=='OWNED_OUTPUT_CAPTURED_NOT_OS_VERIFIED'||v.attemptId!==plan.attemptId||v.planHash!==plan.planHash||v.outputPath!==plan.compilation.outputPath||v.rootIdentity!==binding.rootIdentity||
   v.attemptIdentity!==binding.attemptIdentity||v.basisIdentity!==binding.basisIdentity||typeof v.outputIdentity!=='string'||!v.outputIdentity||[v.attemptIdentity,v.basisIdentity].includes(v.outputIdentity))throw failed('OUTPUT_CUSTODY_MISMATCH');
  try{return ownedBuffer(v.bytes,plan.limits.outputBytes);}catch{throw failed('OUTPUT_LIMIT_EXCEEDED');}};

 return freeze({run:async driver=>{if(used||typeof driver!=='function')invalid();used=true;let anchor,claimBytes,output;
  try{anchor=clock();activeAnchor=anchor;await within(anchor,'AUTHORITY_CHECK_DEADLINE_UNCONFIRMED',currentAuthority);if(attemptedRoots.has(plan.qaRoot))throw failed('PROCESS_LOCAL_ATTEMPT_ALREADY_USED');attemptedRoots.add(plan.qaRoot);
   const claimPath=path.win32.join(plan.qaRoot,'attempt.json');claimBytes=Buffer.from(canonical({schemaVersion:1,purpose:ATTEMPT_PURPOSE,attemptId:plan.attemptId,planHash:plan.planHash,sourceCommit:plan.sourceCommit,
    qaRoot:plan.qaRoot,startsAt:plan.window.startsAt,expiresAt:plan.window.expiresAt,authorityApprovalId:initial.approvalId}));
   const attempt=await within(anchor,'ATTEMPT_WRITE_DEADLINE_UNCONFIRMED',signal=>ownedRoundTrip(claimPath,claimBytes,'ATTEMPT',signal));
   const firstInputHash=await within(anchor,'INPUT_READ_DEADLINE_UNCONFIRMED',readInputs),basisBytes=Buffer.from(canonical(plan.compilation.parentBasis));let basis;
   try{basis=await within(anchor,'BASIS_WRITE_DEADLINE_UNCONFIRMED',signal=>ownedRoundTrip(plan.compilation.basisPath,basisBytes,'BASIS',signal));}finally{basisBytes.fill(0);}if(basis.rootIdentity!==attempt.rootIdentity)throw failed('OWNED_ROOT_IDENTITY_MISMATCH');
   await within(anchor,'AUTHORITY_CHECK_DEADLINE_UNCONFIRMED',currentAuthority);const beforeHash=await within(anchor,'INPUT_READ_DEADLINE_UNCONFIRMED',readInputs);if(beforeHash!==firstInputHash)throw failed('INPUT_SET_CHANGED');
   const custody={rootIdentity:attempt.rootIdentity,attemptIdentity:attempt.identity,basisIdentity:basis.identity};
   await within(anchor,'WORKSPACE_PREFLIGHT_DEADLINE_UNCONFIRMED',signal=>inspectWorkspace(custody,signal));
   const driverResult=await within(anchor,'DRIVER_DEADLINE_UNCONFIRMED',async(signal,remaining)=>{const invocation=Object.freeze({executable:plan.compilation.compiler.path,args:Object.freeze([...plan.compilation.arguments]),
    cwd:plan.compilation.workingDirectory,env:Object.freeze({SystemRoot:'C:\\Windows',windir:'C:\\Windows'}),basisPath:plan.compilation.basisPath,outputPath:plan.compilation.outputPath,timeoutMs:remaining,signal});
    try{return await driver(invocation);}catch{throw unknown('EXTERNAL_DRIVER_OUTCOME_UNKNOWN');}});
   const resultKeys=['state','exitCode','stdout','stderr','output'];if(!exact(driverResult,resultKeys)||driverResult.state!=='EXITED'||!Number.isSafeInteger(driverResult.exitCode)||driverResult.output!==null)throw unknown('EXTERNAL_DRIVER_RESULT_INVALID');
   let stdout,stderr;try{stdout=ownedBuffer(driverResult.stdout,plan.limits.stdoutBytes);stderr=ownedBuffer(driverResult.stderr,plan.limits.stderrBytes);}catch{throw failed('DIAGNOSTIC_LIMIT_EXCEEDED');}finally{stdout?.fill(0);stderr?.fill(0);}
   if(driverResult.exitCode!==0)throw failed('EXTERNAL_DRIVER_FAILED',{externalDriverReportedExit:driverResult.exitCode});
   output=await within(anchor,'OUTPUT_CUSTODY_DEADLINE_UNCONFIRMED',signal=>inspectOutput(custody,signal));if(output.length<512)throw failed('OUTPUT_PE_CLI_INVALID');
   await within(anchor,'AUTHORITY_CHECK_DEADLINE_UNCONFIRMED',currentAuthority);const afterHash=await within(anchor,'INPUT_READ_DEADLINE_UNCONFIRMED',readInputs);if(afterHash!==firstInputHash)throw failed('INPUT_SET_CHANGED');
   await within(anchor,'ATTEMPT_RECHECK_DEADLINE_UNCONFIRMED',signal=>readClaim(claimPath,claimBytes,signal));
   const verified=await within(anchor,'OUTPUT_VERIFY_DEADLINE_UNCONFIRMED',()=>verifyDesktopTrustKeyHost(output,plan.compilation.parentBasis));clock(anchor);
   return response(plan,'SYNTHETIC_PE_SHAPE_VERIFIED','NOT_EXECUTABLE_OR_OS_PROVEN',{inputHash:firstInputHash,outputHash:verified.helperHash,outputBytes:verified.helperBytes,parentBasisKind:'SYNTHETIC_NOT_ADMISSION',
    workspacePreflightEvidence:'EXTERNAL_PORT_CONTRACT_NOT_OS_VERIFIED',outputCustodyEvidence:'EXTERNAL_PORT_CONTRACT_NOT_OS_VERIFIED',externalDriverReportedExit:0});
  }catch(error){const known=error instanceof RunFailure?error:unknown('INTERNAL_OUTCOME_UNKNOWN');return response(plan,known.state,known.reason,known.extra);}
  finally{claimBytes?.fill(0);output?.fill(0);}
 }});
}

module.exports={createCompileOnlyLifecycle};
