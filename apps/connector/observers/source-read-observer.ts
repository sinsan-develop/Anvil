import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {readSourceReadScopeV1,readSourceReadPermitV1,readSourceReadChallengeV1,readSourceReadPreflightV1,sourceReadBase64V1,type SourceReadScopeV1,type SourceReadPermitV1} from '../../../contracts/runtime/source-read-observation-v1.ts';
import {readSourceReadReportV1,sourceReadReportProofBytesV1,type SourceReadReportV1} from '../../../contracts/runtime/source-read-report-v1.ts';
import {isRelativeSourceFileV1} from '../../../contracts/runtime/source-scope-v1.ts';
import type {SourceReadHttpsClient} from '../runtime/source-read-https.ts';
type Observation=Pick<SourceReadReportV1,'root'|'files'|'localEvidence'>;
export interface SourceReadNativeAdapter {observe(input:{permit:SourceReadPermitV1;deadlineMs:number;signal:AbortSignal}):Promise<Observation>}
interface Options {
 scope:unknown;grantRef:RuntimeRefV1;commandId:string;client:Pick<SourceReadHttpsClient,'challenge'|'issue'|'permit'|'report'|'close'>;
 nonce:()=>string;sign:(bytes:Uint8Array,signal:AbortSignal)=>Promise<string>;
 clock?:{wallNow:()=>number;monotonicNow:()=>number};native?:SourceReadNativeAdapter;
}
export class SourceReadObserverError extends Error{cleanupFailure:string|null=null;}
const safeErrors=new Set(['SOURCE_READ_OBSERVER_INVALID','SOURCE_READ_RECONCILE_REQUIRED','SOURCE_READ_CANCELLED','SOURCE_READ_EXPIRED','SOURCE_READ_OBSERVER_STOP_UNCONFIRMED','SOURCE_READ_OBSERVER_DEADLINE','SOURCE_READ_UNSUPPORTED_PATH','SOURCE_READ_INPUT_INVALID','SOURCE_READ_TIME_INVALID','SOURCE_READ_RESPONSE_INVALID','SOURCE_READ_REDIRECT_DENIED','SOURCE_READ_REQUEST_FAILED','SOURCE_READ_RESULT_UNKNOWN','SOURCE_READ_HTTPS_TIMEOUT','SOURCE_READ_BASIS_NOT_CURRENT','SOURCE_READ_PROOF_INVALID','SOURCE_READ_EXCHANGE_RECONCILE_REQUIRED','SOURCE_READ_EXCHANGE_ATTEMPT_LIMIT','SOURCE_READ_CREDENTIAL_INVALID','SOURCE_READ_REPORT_CONFLICT','SOURCE_READ_INTEGRITY_FAILED']);
const fail=(code='SOURCE_READ_OBSERVER_INVALID'):never=>{throw new SourceReadObserverError(code);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
interface NativeSnapshotInput {
 rootPath:string;sourceId:string;sourceVersion:number;sourceHash:string;targets:string[];budgetMs:number;signal:AbortSignal;
}
/**
 * 기존 C# Snapshot 경계의 인자 연결만 담당한다. invoke는 별도 허가/소유 검증된 host가
 * 공급해야 하며 이 객체/permit 구조/hash 자체는 실행 허가가 아니다. 기본 host·키·IPC는 없다.
 * root/files의 최종 의미 검사는 SourceReadObserver의 서명 전 strict report codec 책임이다.
 * 취소는 실제 OS 종료 증거가 아니며 관측 대기 상한은 바깥 observer가 집행한다.
 */
export class SourceReadSnapshotAdapter implements SourceReadNativeAdapter {
 readonly #scope:SourceReadScopeV1;readonly #grant:RuntimeRefV1;
 readonly #invoke:(input:NativeSnapshotInput)=>Promise<unknown>;readonly #now:()=>number;#used=false;
 constructor(options:{scope:unknown;grantRef:RuntimeRefV1;invoke:(input:NativeSnapshotInput)=>Promise<unknown>;now?:()=>number}){
  this.#scope=readSourceReadScopeV1(options.scope);
  if(!refV1(options.grantRef)||options.grantRef.version!==1||options.grantRef.contentHash!==contentHash(canonicalJson(this.#scope))||typeof options.invoke!=='function')fail();
  this.#grant={...options.grantRef};this.#invoke=options.invoke;this.#now=options.now??Date.now;
 }
 async observe(input:{permit:SourceReadPermitV1;deadlineMs:number;signal:AbortSignal}):Promise<Observation>{
  if(this.#used)fail('SOURCE_READ_RECONCILE_REQUIRED');this.#used=true;
  if(input.signal.aborted)fail('SOURCE_READ_CANCELLED');
  const start=this.#now(),permit=readSourceReadPermitV1(input.permit,{scope:this.#scope,grantRef:this.#grant},start);
  if(!Number.isFinite(input.deadlineMs)||input.deadlineMs<=0||input.deadlineMs>30000)fail('SOURCE_READ_OBSERVER_DEADLINE');
  const rootPath=permit.root.pathHint;
  if(!/^[A-Za-z]:\\[^\\]/.test(rootPath)||rootPath.includes('/')||!isRelativeSourceFileV1(rootPath.slice(3).replaceAll('\\','/')))fail('SOURCE_READ_UNSUPPORTED_PATH');
  const before=this.#now();if(input.signal.aborted)fail('SOURCE_READ_CANCELLED');
  if(!Number.isSafeInteger(before)||before<start)fail('SOURCE_READ_OBSERVER_DEADLINE');
  const budgetMs=Math.floor(Math.min(input.deadlineMs-(before-start),Date.parse(permit.expiresAt)-before));if(budgetMs<1)fail('SOURCE_READ_OBSERVER_DEADLINE');
  let snapshot:unknown;
  try{snapshot=await this.#invoke({rootPath,sourceId:permit.root.sourceRootRef.id,sourceVersion:permit.root.sourceRootRef.version,sourceHash:permit.root.sourceRootRef.contentHash,targets:permit.scope.targets.map(t=>t.relativePath),budgetMs,signal:input.signal});}
  catch{if(input.signal.aborted)fail('SOURCE_READ_OBSERVER_STOP_UNCONFIRMED');fail('SOURCE_READ_OBSERVER_FAILED');}
  if(input.signal.aborted)fail('SOURCE_READ_OBSERVER_STOP_UNCONFIRMED');
  const finished=this.#now();if(!Number.isSafeInteger(finished)||finished<before||finished>=Date.parse(permit.expiresAt)||finished-before>=budgetMs)fail('SOURCE_READ_OBSERVER_DEADLINE');
  try{
   if(!recordV1(snapshot,['root','files']))fail();
   const serialized=canonicalJson(snapshot);if(Buffer.byteLength(serialized,'utf8')>1024*1024)fail();
   const copy=JSON.parse(serialized) as Pick<Observation,'root'|'files'>;
   return{...copy,localEvidence:{kind:'NATIVE_METADATA_REPORT',observerProtocolVersion:1,observerImageHash:null,ownedProcessRef:null}};
  }catch{return fail();}
 }
}
/** 별도 승인된 adapter만 공급한다. 기본 native/키/프로세스/파일 접근 구현이나 Agent 실행은 없다. */
export class SourceReadObserver {
 readonly #scope:SourceReadScopeV1;readonly #grant:RuntimeRefV1;readonly #options:Options;#used=false;
 constructor(options:Options){this.#scope=readSourceReadScopeV1(options.scope);if(!refV1(options.grantRef)||options.grantRef.version!==1||options.grantRef.contentHash!==contentHash(canonicalJson(this.#scope))||!uuidV1(options.commandId))fail();this.#grant={...options.grantRef};this.#options={...options};}
 async run(externalSignal?:AbortSignal){
  if(this.#used)fail('SOURCE_READ_RECONCILE_REQUIRED');this.#used=true;
  const o=this.#options,clock=o.clock??{wallNow:Date.now,monotonicNow:()=>performance.now()},abort=new AbortController();
  const startMono=clock.monotonicNow(),startWall=clock.wallNow();let lastMono=startMono,lastWall=startWall,expiry=Date.parse(this.#scope.expiresAt),deadlineMono=startMono+30000,nativePending=false,primary:SourceReadObserverError|null=null;
  const cancel=()=>abort.abort();externalSignal?.addEventListener('abort',cancel,{once:true});if(externalSignal?.aborted)cancel();
  // 실제 OS 작업의 강제 중지는 native 소유 제공자 책임이며 이 timer는 종료 증거가 아니다.
  let timer=setTimeout(cancel,30000);
  const active=()=>{const mono=clock.monotonicNow(),wall=clock.wallNow();if(abort.signal.aborted)fail(nativePending?'SOURCE_READ_OBSERVER_STOP_UNCONFIRMED':'SOURCE_READ_CANCELLED');if(!Number.isFinite(mono)||!Number.isSafeInteger(wall)||mono<lastMono||wall<lastWall||mono>=deadlineMono||wall>=expiry||wall<Date.parse(this.#scope.requestedAt))fail('SOURCE_READ_OBSERVER_DEADLINE');lastMono=mono;lastWall=wall;return wall;};
  const wait=async<T>(action:()=>Promise<T>):Promise<T>=>{active();let onAbort:()=>void=()=>{};try{const value=await Promise.race([Promise.resolve().then(()=>{active();return action();}),new Promise<never>((_,reject)=>{onAbort=()=>reject(new SourceReadObserverError(nativePending?'SOURCE_READ_OBSERVER_STOP_UNCONFIRMED':'SOURCE_READ_CANCELLED'));abort.signal.addEventListener('abort',onAbort,{once:true});if(abort.signal.aborted)onAbort();})]);active();return value;}finally{abort.signal.removeEventListener('abort',onAbort);}};
  const sign=async(bytes:Buffer)=>{try{const signature=await wait(()=>o.sign(bytes,abort.signal));sourceReadBase64V1(signature,64);return signature;}finally{bytes.fill(0);}};
  try{
   active();const s=this.#scope,preflight=readSourceReadPreflightV1({protocolVersion:1,purpose:'SOURCE_READ_PREFLIGHT',installationId:s.installationId,projectId:s.projectId,connectorId:s.connectorRef.id,registrationId:s.registrationRef.id,connectorGeneration:s.connectorRef.version,grantRef:this.#grant,scopeDigest:this.#grant.contentHash,publicKeyFingerprint:s.hostFingerprint,clientNonce:o.nonce(),expiresAt:s.expiresAt});
   const challenge=await wait(async()=>o.client.challenge(preflight,await sign(Buffer.from(canonicalJson(preflight))),abort.signal));
   const payload=readSourceReadChallengeV1(challenge.payload);
   if(!same(payload,{...preflight,purpose:'SOURCE_READ_EXCHANGE',issuedAt:payload.issuedAt,expiresAt:payload.expiresAt,serverNonce:payload.serverNonce})||Date.parse(payload.expiresAt)<=active()||Date.parse(payload.expiresAt)>expiry)fail();
   await wait(async()=>o.client.issue(await sign(Buffer.from(canonicalJson(payload))),abort.signal));
   const permit=readSourceReadPermitV1(await wait(()=>o.client.permit(abort.signal)),{scope:s,grantRef:this.#grant},active());
   expiry=Math.min(expiry,Date.parse(permit.expiresAt));const permittedWall=active();
   deadlineMono=Math.min(deadlineMono,clock.monotonicNow()+expiry-permittedWall);
   clearTimeout(timer);timer=setTimeout(cancel,Math.max(1,Math.ceil(deadlineMono-clock.monotonicNow())));active();
   const rootPath=permit.root.pathHint;
   if(!/^[A-Za-z]:\\[^\\]/.test(rootPath)||rootPath.includes('/')||!isRelativeSourceFileV1(rootPath.slice(3).replaceAll('\\','/')))fail('SOURCE_READ_UNSUPPORTED_PATH');
   const observedAt=new Date(active()).toISOString();let result:Observation;
   if(o.native){nativePending=true;result=await wait(()=>o.native!.observe({permit:structuredClone(permit),deadlineMs:Math.max(0,deadlineMono-clock.monotonicNow()),signal:abort.signal}));nativePending=false;}
   else result={root:{state:'UNVERIFIED',facts:null,reasonCode:'OBSERVER_UNAVAILABLE'},files:s.targets.map(t=>({relativePath:t.relativePath,state:'UNVERIFIED',facts:null,reasonCode:'ROOT_UNAVAILABLE'})),localEvidence:{kind:'OBSERVER_UNAVAILABLE',observerProtocolVersion:1,observerImageHash:null,ownedProcessRef:null}};
   if(!recordV1(result,['root','files','localEvidence']))fail();
   if(result.root.state==='OBSERVED'&&result.root.facts?.canonicalPath.replace(/^\\\\\?\\/,'').toUpperCase()!==rootPath.toUpperCase())fail();
   const finishedAt=new Date(active()).toISOString(),unsigned={protocolVersion:1 as const,commandId:o.commandId,grantRef:this.#grant,scopeDigest:this.#grant.contentHash,connectorRef:s.connectorRef,hostFingerprint:s.hostFingerprint,observedAt,finishedAt,...result};
   const context={scope:s,grantRef:this.#grant,credentialIssuedAt:permit.issuedAt,credentialExpiresAt:permit.expiresAt,receivedAt:new Date(active()).toISOString()};
   const provisional=readSourceReadReportV1({...unsigned,contentHash:contentHash(canonicalJson(unsigned)),signature:Buffer.alloc(64).toString('base64url')},context);
   const signature=await sign(sourceReadReportProofBytesV1(provisional,context));
   const report=readSourceReadReportV1({...provisional,signature},{...context,receivedAt:new Date(active()).toISOString()});
   const receipt=await wait(()=>o.client.report(report,abort.signal));
   return{receipt,executionAuthorized:false as const,agentDispatchPerformed:false as const,baselineConfirmed:false as const,osVerification:'UNVERIFIED' as const};
  }catch(error){const code=error instanceof Error&&safeErrors.has(error.message)?error.message:'SOURCE_READ_OBSERVER_FAILED';primary=new SourceReadObserverError(code);throw primary;}
  finally{clearTimeout(timer);abort.abort();externalSignal?.removeEventListener('abort',cancel);try{o.client.close();}catch{if(primary)primary.cleanupFailure='SOURCE_READ_OBSERVER_CLOSE_FAILED';else throw new SourceReadObserverError('SOURCE_READ_OBSERVER_CLOSE_FAILED');}}
 }
}
