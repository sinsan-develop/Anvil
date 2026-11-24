import {PassThrough} from 'node:stream';
import type {PoolClient} from 'pg';
export {nativeReceiveClassifyFailure} from './native-first-receive-input.ts';
import {ProjectRegistrationReads} from '../connections/project-registration-reads.ts';
import {randomBytes,randomUUID,verify as verifySignature} from 'node:crypto';
import {canonicalBase64,readHostPublicKey,publicKeyFingerprint} from '../connections/registration-proof.ts';
import {readNormalStartPreparationRequest,readNormalStartPreparationResult,readNormalStartPreparationResultProof,matchNormalStartPreparationResult,normalStartPreparationRequestRef,encodeNormalStartPreparationFrame,type NormalStartPreparationRequest,type NormalStartPreparationResult,type NormalStartPreparationResultProof} from '../../../../contracts/runtime/normal-start-preparation-v1.ts';
export {verifyNativeReceiveOpenProof,consumeNativeReceiveOpenProof,withNativeReceiveOpenContext,withNativeReceiveOpenTransaction} from './native-first-receive-store.ts';
import {NativeChannelProfileRepository} from './native-first-receive-profile.ts';
import {ProjectNativePreparations} from './project-native-preparations.ts';
import {contentHash} from '../../../../contracts/canonical.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {NativeFirstReceiveStore,withNativeReceiveOpenTransaction,verifyNativeReceiveOpenProof,withNativeReceivePhaseTransaction,verifyNativeReceivePhaseProof,type ReceiveDb} from './native-first-receive-store.ts';
import type {AccessRepository} from '../access/repository.ts';
import {projectMember,currentGeneralProjectController,authorizeMaterial,projectReplay,persistProjectReceipt,type ProjectCommand} from '../access/project-command.ts';
import {readNativeReceiveHumanCommand,receiveHumanCommandCanonical,readNativeReceiveChallengeInput,readNativeReceivePhaseBody,readNativeReceivePhaseCurrentInput,nativeReceiveClassifyFailure} from './native-first-receive-input.ts';
import {AuthFailure} from '../access/repository.ts';
import {receiveLimits,receiveRecord,receiveRef,receiveUuid,receiveSame,receiveCopy,receiveHash,receiveAt,receiveResultCanonical,readReceiveSlotReceipt,readReceiveWindow,readReceiveSigningCurrent,readReceiveChallenge,readReceiveProof,receiveCanonical,type ReceiveRef} from '../../../../contracts/runtime/native-first-receive-v1.ts';
/** 원 인증 STREAM의 연결 출처만 증명한다. 준비 발급/normal 전송/실행 권한이 아니다. */
export interface NormalStartPreparationReceiverScope {
 purpose:'NORMAL_START_PREPARATION_RECEIVER_V1';installationId:string;projectId:string;
 registrationRef:ReceiveRef;
 connectorRef:ReceiveRef;
 windowRef:ReceiveRef;
 receiveSessionRef:ReceiveRef;
 localReceiveAttemptId:string;actorId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number;
}
export interface NormalStartPreparationReceiver {
 read(scope:NormalStartPreparationReceiverScope):Readonly<{purpose:'NORMAL_START_PREPARATION_RECEIVER_PROVENANCE';scope:NormalStartPreparationReceiverScope;
  streamProofHash:string;streamChallengeRef:ReceiveRef;
  observedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false}>;
 revoke():void;
}
type ReceiverLease={read:(scope:NormalStartPreparationReceiverScope)=>ReturnType<NormalStartPreparationReceiver['read']>;revoke:()=>void};
const preparationReceivers=new WeakMap<object,ReceiverLease>();
function receiverScope(raw:unknown):NormalStartPreparationReceiverScope {
 if(!receiveRecord(raw,['purpose','installationId','projectId','registrationRef','connectorRef','windowRef','receiveSessionRef',
  'localReceiveAttemptId','actorId','clientId','humanSessionId','credentialGeneration','controlGeneration'])
  ||raw.purpose!=='NORMAL_START_PREPARATION_RECEIVER_V1'
  ||!['installationId','projectId','localReceiveAttemptId','actorId','clientId','humanSessionId'].every(k=>receiveUuid(raw[k]))
  ||!['registrationRef','connectorRef','windowRef','receiveSessionRef'].every(k=>receiveRef(raw[k]))
  ||!['credentialGeneration','controlGeneration'].every(k=>Number.isSafeInteger(raw[k])&&raw[k]>0))return denied();
 return receiveCopy(raw) as NormalStartPreparationReceiverScope;
}
function readReceiver(this:object,scope:NormalStartPreparationReceiverScope){
 const entry=preparationReceivers.get(this);if(!entry)return denied();return entry.read(scope);
}
function revokeReceiver(this:object){const entry=preparationReceivers.get(this);if(!entry)return;entry.revoke();}
type PreparationStreamCustody={claimed:boolean;revoked:boolean;expires:number;monoEnd:number;lastWall:number;lastMono:number;token:object|null;timer:ReturnType<typeof setTimeout>|undefined;invalidate:()=>void;
 normalResult?:{requestHash:string;resultHash:string;proofHash:string;state:'IN_FLIGHT'|'SETTLED'|'UNKNOWN'}};
type ReceiveStreamOwner={stream:PassThrough;close:()=>void;ownership:any;last:number;preparation:PreparationStreamCustody;normalFrameNegotiated:boolean;frameAttempt?:'RESERVING'|'COMMITTED'|'IN_FLIGHT'|'EOF'|'UNKNOWN'};
type NormalFrameCandidate={broker:NativeFirstReceiveBroker;entry:ReceiveStreamOwner;scope:NormalStartPreparationReceiverScope};
const normalFrameCandidates=new WeakMap<object,NormalFrameCandidate>();
type NormalFrameCommit={service:NativeFirstReceiveService;candidate:object;request:NormalStartPreparationRequest;claimRef:ReceiveRef;used:boolean;waited?:boolean;current:()=>void};
const normalFrameCommits=new WeakMap<object,NormalFrameCommit>();
type NormalFrameTerminal={entry:ReceiveStreamOwner;request:NormalStartPreparationRequest;state:'SENDING'|'EOF'|'UNKNOWN';preparation:PreparationStreamCustody;current:()=>void;
 rejection?:{ref:ReceiveRef;snapshot:Record<string,unknown>};notify?:()=>void};
const committedNormalRejections=new WeakMap<object,{service:NativeFirstReceiveService;requestHash:string;commandId:string;scope:NormalStartPreparationReceiverScope}>();
/** 원 service의 확정 거래/EOF가 발급한 오류만 식별한다. 문자열·호출자 boolean은 근거가 아니다. */
export function isCommittedNormalStartPreparationRejection(error:unknown,service:NativeFirstReceiveService,command:ProjectCommand,scope:NormalStartPreparationReceiverScope){
 const value=error&&typeof error==='object'?committedNormalRejections.get(error):undefined;
 return !!value&&error instanceof AuthFailure&&error.message==='NORMAL_START_PREPARATION_REJECTED'&&error.statusCode===412
  &&value.service===service&&value.commandId===command.commandId&&value.requestHash===receiveHash(command)&&receiveSame(value.scope,scope);
}

type AckBinding={windowRef:any;receiveSessionRef:any;bindingRef:any;armRef:any;deliveryRef:any;authorityRef:any;commandHash:string;metadataHash:string;expiresAt:string;operationFence:string};
type AckWaiter={binding:AckBinding;phase:'WAITING';token:object;deadline:number;lastNow:number;check:()=>void;resolve:(value:unknown)=>void;reject:(error:Error)=>void;promise:Promise<unknown>;remove:()=>void};
type AckTerminal={phase:'CANDIDATE'|'UNKNOWN';token:object;deadline:number};
type ReceiveWaiterTimers={schedule:(fn:()=>void,ms:number)=>unknown;cancel:(handle:unknown)=>void};
const receiveWaiterTimers:ReceiveWaiterTimers=Object.freeze({schedule:(fn:()=>void,ms:number)=>{const timer=setTimeout(fn,ms);timer.unref();return timer;},cancel:(handle:unknown)=>clearTimeout(handle as ReturnType<typeof setTimeout>)});
function denied():never{throw new AuthFailure('NATIVE_RECEIVE_OWNER_UNAVAILABLE',503);}
/** 원 operation 소유의 비공개 후보 전달만 맡는다. 인증/ATTEMPTED·CONFIRMED 저장이나 ACK 성공을 대체하지 않는다. */
const preEffectFailures=new WeakSet<object>();
/** 실제 효과 전 catch 또는 읽기 전용 경계만 호출한다. 원 예외 객체를 framework에 넘기지 않는다. */
export function nativeReceivePreEffectFailure(error:unknown){const value=nativeReceiveClassifyFailure(error);if(!value.safe||value.authCode===null||value.status===null)return new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);let code=value.authCode,status=value.status;if(code==='PERMISSION_POLICY_UNCONFIGURED'&&status===412||code==='NATIVE_SOURCE_UNAVAILABLE'&&status===503){code='NATIVE_RECEIVE_SOURCE_UNAVAILABLE';status=503;}const result=new AuthFailure(code,status);if(status===503&&['NATIVE_RECEIVE_SOURCE_UNAVAILABLE','NATIVE_RECEIVE_OWNER_UNAVAILABLE'].includes(code))preEffectFailures.add(result);return result;}
export function nativeReceiveIsPreEffectFailure(error:unknown){return !!error&&typeof error==='object'&&preEffectFailures.has(error);}
export class NativeFirstReceiveBroker{
 readonly #normalResults=new Map<string,NormalFrameTerminal>();
 readonly instanceId:string;readonly #now:()=>number;readonly #timers:ReceiveWaiterTimers;#waiterClock=-Infinity;readonly #waiters=new Map<string,AckWaiter|AckTerminal>();readonly #streams=new Map<string,ReceiveStreamOwner>();
 constructor(instanceId:string,now:()=>number=Date.now,timers:ReceiveWaiterTimers=receiveWaiterTimers){if(!receiveUuid(instanceId))denied();this.instanceId=instanceId;this.#now=now;this.#timers=timers;}
 /** COMMIT·원 Pool 회수가 정착된 Store capability만 실제 통로를 연다. Delivery bytes는 여기서 만들지 않는다. */
 attachStream(capability:unknown,signal:AbortSignal,observe:()=>number=this.#now,accept:unknown=undefined){
  const at=observe(),owned=NativeFirstReceiveStore.takeStreamOwnership(capability,this.instanceId,at);
  if(signal.aborted||this.#streams.has(owned.receiveSessionRef.id))denied();
  const stream=new PassThrough(),deadline=Date.parse(owned.expiresAt),mono=performance.now();
  let closed=false,timer:ReturnType<typeof setTimeout>|undefined;
  const preparation:PreparationStreamCustody={claimed:false,revoked:false,expires:deadline,
   monoEnd:mono+(deadline-at),lastWall:at,lastMono:mono,token:null,timer:undefined,invalidate:()=>{}};
  const invalidate=()=>{
   if(preparation.revoked)return;preparation.revoked=true;
   clearTimeout(preparation.timer);preparation.timer=undefined;
   if(preparation.token)preparationReceivers.delete(preparation.token);preparation.token=null;
  };preparation.invalidate=invalidate;
  const close=()=>{
   if(closed)return;closed=true;invalidate();
   if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',close);
   this.#streams.delete(owned.receiveSessionRef.id);
   if(!stream.destroyed)stream.destroy(new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503));
  };
  stream.on('error',invalidate);stream.once('end',invalidate);stream.once('finish',invalidate);stream.once('close',close);
  // Accept는 형식 협상 metadata일 뿐이다. 원 capability/등록과 별도 claim 검산을 대신하지 않는다.
  this.#streams.set(owned.receiveSessionRef.id,{stream,close,ownership:owned,last:at,preparation,normalFrameNegotiated:accept==='application/octet-stream'});
  signal.addEventListener('abort',close,{once:true});timer=setTimeout(close,Math.max(0,Math.floor(deadline-at)));timer.unref();
  preparation.timer=setTimeout(invalidate,Math.max(0,Math.floor(preparation.expires-at)));preparation.timer.unref();
  if(signal.aborted)close();return stream;
 }
 /** 실제 인증 STREAM의 같은 entry를 포착한다. 여기서는 claim·발급·송신을 하지 않는다. */
 captureNormalStartPreparationFrame(raw:NormalStartPreparationReceiverScope){
  const scope=receiverScope(raw),entry=this.#streams.get(scope.receiveSessionRef.id),origin=entry?.ownership.preparationOrigin;
  if(!entry||!origin||!entry.normalFrameNegotiated||entry.frameAttempt||this.#normalResults.has(scope.receiveSessionRef.id))return denied();
  const w=origin.window.snapshot,{authBindingHash,...binding}=w;
  if(!receiveSame(origin.window.ref,scope.windowRef)||!receiveSame(origin.session.ref,scope.receiveSessionRef)||w.installationId!==scope.installationId||w.projectId!==scope.projectId
   ||!receiveSame(w.registrationRef,scope.registrationRef)||!receiveSame(w.connectorRef,scope.connectorRef)||w.localReceiveAttemptId!==scope.localReceiveAttemptId
   ||w.human.userId!==scope.actorId||w.human.clientId!==scope.clientId||w.human.credentialGeneration!==scope.credentialGeneration||w.human.controlGeneration!==scope.controlGeneration
   ||receiveHash({authSessionId:scope.humanSessionId,window:binding})!==authBindingHash)return denied();
  const candidate=Object.freeze(Object.defineProperty({},'toJSON',{value:()=>denied()}));normalFrameCandidates.set(candidate,{broker:this,entry,scope});this.checkNormalStartPreparationFrame(candidate);return candidate;
 }
 checkNormalStartPreparationFrame(raw:object){
  const c=normalFrameCandidates.get(raw);if(!c||c.broker!==this)return denied();const {entry}=c,p=entry.preparation,wall=this.#now(),mono=performance.now();
  if(!entry.normalFrameNegotiated||this.#streams.get(c.scope.receiveSessionRef.id)!==entry||entry.stream.destroyed||entry.stream.closed||entry.stream.readableEnded||entry.stream.writableEnded||p.revoked
   ||!Number.isFinite(wall)||!Number.isFinite(mono)||wall<p.lastWall||mono<p.lastMono||wall>=p.expires||mono>=p.monoEnd)return denied();
  this.requireBindingStream(entry.ownership);p.lastWall=wall;p.lastMono=mono;return c;
 }
 /** 원 claim COMMIT/release 뒤에만 생성된 비공개 token을 소비한다. caller JSON/Boolean은 수용하지 않는다. */
 async supplyNormalStartPreparationFrame(raw:object,service:NativeFirstReceiveService,signal:AbortSignal){
  const cap=normalFrameCommits.get(raw);if(!cap||cap.service!==service||cap.used)return denied();cap.used=true;
  let c:NormalFrameCandidate;
  try{cap.current();c=this.checkNormalStartPreparationFrame(cap.candidate);if(c.entry.frameAttempt!=='COMMITTED'||signal.aborted)throw Error();}
  catch{const original=normalFrameCandidates.get(cap.candidate);if(original)original.entry.frameAttempt='UNKNOWN';throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);}
  const entry=c.entry;entry.frameAttempt='IN_FLIGHT';
  const request=receiveCopy(cap.request),sid=request.receiveSessionRef.id,wall=this.#now(),mono=performance.now(),end=Math.min(Date.parse(request.expiresAt),entry.preparation.expires);
  const p:PreparationStreamCustody={claimed:true,revoked:false,expires:end,monoEnd:Math.min(entry.preparation.monoEnd,mono+(end-wall)),lastWall:wall,lastMono:mono,token:null,timer:undefined,invalidate:()=>{}};
  const terminal:NormalFrameTerminal={entry,request,state:'SENDING',preparation:p,current:cap.current};this.#normalResults.set(sid,terminal);
  let frame:Buffer|null=null,done=false,finishSeen=false,endSeen=false;let resolve!:()=>void,reject!:(error:Error)=>void;const completed=new Promise<void>((a,b)=>{resolve=a;reject=b;});void completed.catch(()=>{});
  const invalidate=()=>{if(p.revoked)return;p.revoked=true;terminal.state='UNKNOWN';entry.frameAttempt='UNKNOWN';terminal.notify?.();if(!done){done=true;reject(new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503));}frame?.fill(0);frame=null;};p.invalidate=invalidate;
  const clean=(retain=false)=>{entry.stream.off('finish',finish);entry.stream.off('end',readEnd);entry.stream.off('close',close);if(!retain){entry.stream.off('error',bad);signal.removeEventListener('abort',bad);}};
  const expired=()=>{invalidate();clean();if(this.#normalResults.get(sid)===terminal)this.#normalResults.delete(sid);if(!entry.stream.destroyed)entry.close();};
  const check=()=>{cap.current();const w=this.#now(),m=performance.now();if(signal.aborted||p.revoked||this.#normalResults.get(sid)!==terminal||!Number.isFinite(w)||!Number.isFinite(m)||w<p.lastWall||m<p.lastMono||w>=p.expires||m>=p.monoEnd)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);p.lastWall=w;p.lastMono=m;};
  const maybe=()=>{try{check();if(!finishSeen||!endSeen)return;if(!entry.stream.readableEnded||!entry.stream.writableFinished||entry.stream.errored)throw Error();terminal.state='EOF';entry.frameAttempt='EOF';frame?.fill(0);frame=null;done=true;clean(true);resolve();}catch{bad();}};
  const finish=()=>{finishSeen=true;maybe();},readEnd=()=>{endSeen=true;maybe();},bad=()=>{invalidate();clean();entry.close();},close=()=>{if(terminal.state!=='EOF')bad();};
  try{
   check();frame=encodeNormalStartPreparationFrame(request);check();
   entry.stream.on('finish',finish);entry.stream.on('end',readEnd);entry.stream.on('error',bad);entry.stream.on('close',close);signal.addEventListener('abort',bad,{once:true});
   p.timer=setTimeout(expired,Math.max(1,Math.floor(Math.min(p.expires-this.#now(),p.monoEnd-performance.now()))));p.timer.unref();
   check();const supplied=frame;frame=null;entry.stream.end(supplied);await completed;check();
   return Object.freeze({status:'NORMAL_START_PREPARATION_FRAME_EOF' as const,requestRef:normalStartPreparationRequestRef(request),executionAuthorized:false as const,dispatchPerformed:false as const});
  }catch{bad();throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);}
 }
 /** 동일 원 frame의 EOF 뒤 한 번만 기다린다. DB 조회/새 claim/재전송 또는 PREPARED 인계가 아니다. */
 async waitNormalStartPreparationRejection(raw:object,service:NativeFirstReceiveService,signal:AbortSignal){
  const cap=normalFrameCommits.get(raw),c=cap?normalFrameCandidates.get(cap.candidate):undefined;
  const terminal=cap?this.#normalResults.get(cap.request.receiveSessionRef.id):undefined;
  if(!cap||cap.service!==service||!cap.used||cap.waited||!c||c.broker!==this||!terminal||terminal.entry!==c.entry||!receiveSame(terminal.request,cap.request))return denied();
  cap.waited=true;const p=terminal.preparation,start=this.#now(),startMono=performance.now();
  const end=Math.min(start+2000,p.expires,Date.parse(cap.request.expiresAt)),monoEnd=Math.min(startMono+2000,p.monoEnd,startMono+(end-start));
  let last=start,lastMono=startMono,timer:ReturnType<typeof setTimeout>|undefined,notify:(()=>void)|undefined;
  const check=()=>{cap.current();const at=this.#now(),mono=performance.now();if(signal.aborted||p.revoked||terminal.state!=='EOF'||this.#normalResults.get(cap.request.receiveSessionRef.id)!==terminal
    ||this.#streams.has(cap.request.receiveSessionRef.id)&&this.#streams.get(cap.request.receiveSessionRef.id)!==c.entry||c.entry.frameAttempt!=='EOF'
    ||!Number.isFinite(at)||!Number.isFinite(mono)||at<last||mono<lastMono||at>=end||mono>=monoEnd)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);last=at;lastMono=mono;};
  check();
  try{
   await new Promise<void>((resolve,reject)=>{
    const unknown=()=>reject(new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503));
    notify=()=>{try{check();if(terminal.rejection)resolve();}catch{unknown();}};
    if(terminal.notify)return unknown();terminal.notify=notify;
    signal.addEventListener('abort',notify,{once:true});timer=setTimeout(unknown,Math.max(1,Math.floor(Math.min(end-this.#now(),monoEnd-performance.now()))));notify();
   });
   check();if(!terminal.rejection)return denied();return{request:receiveCopy(cap.request),scope:receiveCopy(c.scope),record:receiveCopy(terminal.rejection),check};
  }catch{throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);}
  finally{clearTimeout(timer);if(notify){signal.removeEventListener('abort',notify);if(terminal.notify===notify)delete terminal.notify;}}
 }
 /** 정확 원 창/slot의 프로세스 내부 단회 대여다. 지속 admission/claim·목록·최신 선택·normal 송신은 없다. */
 takeNormalStartPreparationReceiver(raw:NormalStartPreparationReceiverScope,current:()=>void=()=>{}):NormalStartPreparationReceiver {
  const scope=receiverScope(raw),entry=this.#streams.get(scope.receiveSessionRef.id);
  if(!entry||typeof current!=='function')return denied();
  const origin=entry.ownership.preparationOrigin;
  if(!origin||!receiveSame(origin.window.ref,scope.windowRef)||!receiveSame(origin.session.ref,scope.receiveSessionRef))return denied();
  const w=origin.window.snapshot,{authBindingHash,...windowWithoutBinding}=w;
  if(w.installationId!==scope.installationId||w.projectId!==scope.projectId||w.localReceiveAttemptId!==scope.localReceiveAttemptId
   ||!receiveSame(w.registrationRef,scope.registrationRef)||!receiveSame(w.connectorRef,scope.connectorRef)
   ||w.human.userId!==scope.actorId||w.human.clientId!==scope.clientId||w.human.credentialGeneration!==scope.credentialGeneration
   ||w.human.controlGeneration!==scope.controlGeneration||receiveHash({authSessionId:scope.humanSessionId,window:windowWithoutBinding})!==authBindingHash)return denied();
  const p=entry.preparation;
  const check=()=>{
   try{
    current();const wall=this.#now(),mono=performance.now();
    if(p.revoked||this.#streams.get(scope.receiveSessionRef.id)!==entry||entry.stream.destroyed||entry.stream.closed
     ||entry.stream.readableEnded||entry.stream.writableEnded||!Number.isFinite(wall)||!Number.isFinite(mono)
     ||wall<p.lastWall||mono<p.lastMono||wall>=p.expires||mono>=p.monoEnd)return denied();
    this.requireBindingStream({...entry.ownership,expiresAt:new Date(p.expires).toISOString()});
    p.lastWall=wall;p.lastMono=mono;
   }catch{p.invalidate();return denied();}
  };
  check();if(p.claimed)return denied();p.claimed=true;
  const token=Object.freeze(Object.defineProperties({}, {
   read:{value:readReceiver,enumerable:true},revoke:{value:revokeReceiver,enumerable:true},
   toJSON:{value:()=>denied()}
  })) as NormalStartPreparationReceiver;
  p.token=token;preparationReceivers.set(token,{read:(value)=>{
   try{
    check();if(!receiveSame(receiverScope(value),scope))return denied();
    return receiveCopy({purpose:'NORMAL_START_PREPARATION_RECEIVER_PROVENANCE' as const,scope,
     streamProofHash:origin.proofHash,streamChallengeRef:origin.challengeRef,observedAt:entry.ownership.issuedAt,
     expiresAt:new Date(p.expires).toISOString(),executionAuthorized:false as const,dispatchPerformed:false as const});
   }catch{p.invalidate();return denied();}
  },revoke:p.invalidate});
  return token;
 }
 /** 원 STREAM의 private 등록키/digest와 같은 창에 한정한다. 새 peer 등록·frame 송신·ACK는 발급하지 않는다. */
 normalStartPreparationResultOwner(sessionId:string,digest:string,result:NormalStartPreparationResult,proof:NormalStartPreparationResultProof){
  const terminal=this.#normalResults.get(sessionId),entry=terminal?.entry??this.#streams.get(sessionId),origin=entry?.ownership.preparationOrigin;
  if(!entry||!origin||typeof origin.publicKeySpki!=='string'||origin.credentialDigest!==digest)return denied();
  if(terminal?(terminal.state!=='EOF'||!receiveSame(result.requestRef,normalStartPreparationRequestRef(terminal.request))):entry.normalFrameNegotiated||entry.frameAttempt!==undefined)return denied();
  const p=terminal?.preparation??entry.preparation,w=origin.window.snapshot;
  const check=()=>{
   const wall=this.#now(),mono=performance.now();
   if(p.revoked||(terminal?(this.#normalResults.get(sessionId)!==terminal||terminal.state!=='EOF'||this.#streams.has(sessionId)&&this.#streams.get(sessionId)!==entry):(this.#streams.get(sessionId)!==entry||entry.stream.destroyed||entry.stream.closed||entry.stream.readableEnded||entry.stream.writableEnded))
    ||!Number.isFinite(wall)||!Number.isFinite(mono)||wall<p.lastWall||mono<p.lastMono||wall>=p.expires||mono>=p.monoEnd)return denied();
   if(terminal)terminal.current();else this.requireBindingStream(entry.ownership);p.lastWall=wall;p.lastMono=mono;
  };
  check();let slot:PreparationStreamCustody['normalResult'];
  return Object.freeze({
   check,
   verify:(current:any,key:string,request:NormalStartPreparationRequest,proof:NormalStartPreparationResultProof,signature:string)=>{
    if(terminal&&!receiveSame(request,terminal.request))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);
    check();if(current.phase!=='STREAMING'||!receiveSame(current.window,origin.window)||!receiveSame(current.session,origin.session)||key!==origin.publicKeySpki
     ||publicKeyFingerprint(key)!==w.hostPublicKeyFingerprint)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
    for(const name of ['installationId','projectId','registrationRef','connectorRef','profileRef','hostPublicKeyFingerprint','authBindingHash','localReceiveAttemptId'] as const)
     if(!receiveSame(request[name],w[name]))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);
    if(!receiveSame(request.windowRef,origin.window.ref)||!receiveSame(request.receiveSessionRef,origin.session.ref)||!receiveSame(request.writerNoneRef,w.writerHeadRef)||request.actorId!==w.human.userId||request.clientId!==w.human.clientId
     ||request.credentialGeneration!==w.human.credentialGeneration||request.controlGeneration!==w.human.controlGeneration
     ||receiveHash({authSessionId:request.humanSessionId,window:Object.fromEntries(Object.entries(w).filter(([k])=>k!=='authBindingHash'))})!==w.authBindingHash
     ||Date.parse(request.issuedAt)<Date.parse(origin.session.snapshot.issuedAt)||Date.parse(request.expiresAt)>p.expires)throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);
    // 새 frame은 형상/bytes만 검산한다. old peer에 시험 송신하거나 기존 delivery를 대체하지 않는다.
    const frame=encodeNormalStartPreparationFrame(request);frame.fill(0);
    if(!verifySignature('sha256',Buffer.from(receiveCanonical(proof)),{key:readHostPublicKey(key),dsaEncoding:'ieee-p1363'},canonicalBase64(signature,64)))throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
    check();
   },
   begin:(request:NormalStartPreparationRequest,result:NormalStartPreparationResult,proof:NormalStartPreparationResultProof)=>{
    check();if(slot)return denied();
    const expected={requestHash:receiveHash(request),resultHash:receiveHash(result),proofHash:receiveHash(proof)};
    if(p.normalResult){
     if(p.normalResult.requestHash!==expected.requestHash||p.normalResult.resultHash!==expected.resultHash||p.normalResult.proofHash!==expected.proofHash)throw new AuthFailure('NATIVE_RECEIVE_CONFLICT',409);
     return 'READ_ONLY' as const;
    }
    slot={...expected,state:'IN_FLIGHT'};p.normalResult=slot;return 'WRITE' as const;
   },
   finish:(outcome:'SETTLED'|'UNKNOWN'|'RELEASE',stored?:unknown)=>{
    if(slot&&p.normalResult===slot&&slot.state==='IN_FLIGHT'){if(outcome==='RELEASE')delete p.normalResult;else slot.state=outcome;}
    if(outcome!=='SETTLED'||!terminal||result.receipt.snapshot.outcome!=='REJECTED')return;
    check();const state=p.normalResult;
    if(!state||state.requestHash!==receiveHash(terminal.request)||state.resultHash!==receiveHash(result)||state.proofHash!==receiveHash(proof)
     ||!receiveRecord(stored,['ref','snapshot'])||!receiveRef(stored.ref)||stored.ref.version!==1||stored.ref.id===result.requestRef.id||stored.ref.id===result.receipt.ref.id
     ||!receiveRecord(stored.snapshot,['schemaVersion','purpose','recordId','requestRef','peerReceiptRef','resultHash','proofHash','recordedAt','executionAuthorized','dispatchPerformed'])
     ||stored.snapshot.schemaVersion!==1||stored.snapshot.purpose!=='NORMAL_START_PREPARATION_RESULT_RECORD_V1'||stored.ref.id!==stored.snapshot.recordId||stored.ref.contentHash!==receiveHash(stored.snapshot)
     ||!receiveSame(stored.snapshot.requestRef,result.requestRef)||!receiveSame(stored.snapshot.peerReceiptRef,result.receipt.ref)||stored.snapshot.resultHash!==state.resultHash||stored.snapshot.proofHash!==state.proofHash
     ||!receiveAt(stored.snapshot.recordedAt)||stored.snapshot.executionAuthorized!==false||stored.snapshot.dispatchPerformed!==false)return denied();
    const saved={ref:receiveCopy(stored.ref),snapshot:receiveCopy(stored.snapshot)};if(terminal.rejection&&!receiveSame(terminal.rejection,saved))return denied();terminal.rejection=saved;terminal.notify?.();
   },
  });
 }
 requireBindingStream(raw:any){const entry=this.#streams.get(raw.receiveSessionRef.id),at=this.#now();if(!entry||entry.stream.destroyed||entry.stream.closed||raw.brokerInstanceId!==this.instanceId||!receiveSame(entry.ownership.windowRef,raw.windowRef)||!receiveSame(entry.ownership.receiveSessionRef,raw.receiveSessionRef)||entry.ownership.operationFence!==raw.operationFence||!Number.isFinite(at)||at<entry.last||at>=Math.min(Date.parse(entry.ownership.expiresAt),Date.parse(raw.expiresAt)))throw new AuthFailure('NATIVE_SOURCE_UNAVAILABLE',503);entry.last=at;}
 /** 비밀은 원 command의 확정 COMMIT/release 뒤 한 frame에만 복사한다. */
 async supplyDelivery(capability:unknown,opaque:Uint8Array,check:()=>void,signal:AbortSignal,remainingMs:()=>number){
  check();const at=this.#now(),owned=NativeFirstReceiveStore.takeDeliveryOwnership(capability,this.instanceId,opaque,at);this.requireBindingStream({...owned,expiresAt:owned.delivery.snapshot.expiresAt});const entry=this.#streams.get(owned.receiveSessionRef.id);if(!entry)denied();
  const d=owned.delivery,handle=this.begin({windowRef:owned.windowRef,receiveSessionRef:owned.receiveSessionRef,bindingRef:d.snapshot.bindingRef,armRef:d.snapshot.armRef,deliveryRef:d.ref,authorityRef:d.snapshot.authorityRef,commandHash:d.snapshot.commandHash,metadataHash:receiveHash(d.snapshot.metadata),expiresAt:d.snapshot.expiresAt,operationFence:owned.operationFence},signal,check,remainingMs());let frame:Buffer|null=null,supplied=false;
  try{check();const text=receiveCanonical(d),bytes=Buffer.from(text,'utf8');if(bytes.length>receiveLimits.deliverySnapshot+158||bytes.length+47>receiveLimits.deliveryFrame)denied();frame=Buffer.allocUnsafe(bytes.length+47);frame.writeUInt32BE(bytes.length,0);bytes.copy(frame,4);frame.set(opaque,bytes.length+4);check();const after=this.#now();NativeFirstReceiveStore.checkDeliveryOwnership(capability,this.instanceId,after);if(signal.aborted||!Number.isFinite(after)||after<at||after<entry.last||after>=Date.parse(d.snapshot.expiresAt)||entry.stream.closed||entry.stream.destroyed)denied();entry.last=after;
   /* 성공한 end 뒤 frame 소유권은 원 transport에만 있다. ACK 후보는 후행 COMMIT 성공이 아니다. */
   entry.stream.end(frame);supplied=true;frame=null;await handle.wait();check();NativeFirstReceiveStore.checkDeliveryOwnership(capability,this.instanceId,this.#now());if(signal.aborted)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
  }catch(error){const waiter=this.#waiters.get(owned.windowRef.id);if(waiter?.phase==='WAITING')this.#unknown(waiter);if(!supplied){frame?.fill(0);entry.close();}throw error;}
 }
 finishClose(capability:unknown,observe:()=>number=this.#now){
  const owned=NativeFirstReceiveStore.takeCloseOwnership(capability,this.instanceId,observe()),entry=this.#streams.get(owned.receiveSessionRef.id);if(owned.brokerInstanceId!==null){if(!entry||owned.brokerInstanceId!==this.instanceId||!receiveSame(entry.ownership.windowRef,owned.windowRef)||!receiveSame(entry.ownership.receiveSessionRef,owned.receiveSessionRef)||entry.ownership.operationFence!==owned.operationFence)denied();entry.close();}else if(entry)denied();return receiveCopy(owned.state);
 }
 begin(raw:unknown,signal:AbortSignal,check:()=>void,remainingMs:number){
  if(!receiveRecord(raw,['windowRef','receiveSessionRef','bindingRef','armRef','deliveryRef','authorityRef','commandHash','metadataHash','expiresAt','operationFence'])||!['windowRef','receiveSessionRef','bindingRef','armRef','deliveryRef','authorityRef'].every(k=>receiveRef(raw[k])&&raw[k].version===1)||!receiveUuid(raw.operationFence)||!['commandHash','metadataHash'].every(k=>typeof raw[k]==='string'&&/^[a-f0-9]{64}$/.test(raw[k]))||typeof raw.expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw.expiresAt)||!Number.isSafeInteger(remainingMs)||remainingMs<1||remainingMs>10000||signal.aborted||this.#waiters.has(raw.windowRef.id))denied();
  check();const at=this.#now(),expires=Date.parse(raw.expiresAt);if(!Number.isFinite(at)||at<this.#waiterClock||!Number.isFinite(expires)||expires<=at||expires>at+remainingMs)denied();this.#waiterClock=at;
  let resolve!:(v:unknown)=>void,reject!:(e:Error)=>void;const promise=new Promise<unknown>((yes,no)=>{resolve=yes;reject=no;});void promise.catch(()=>{});
  const token=Object.freeze({}),key=raw.windowRef.id;const waiter:AckWaiter={binding:receiveCopy(raw) as AckBinding,phase:'WAITING',token,deadline:Math.min(expires,at+remainingMs),lastNow:at,check,resolve,reject,promise,remove:()=>{}};
  const abort=()=>this.#unknown(waiter);waiter.remove=()=>signal.removeEventListener('abort',abort);this.#waiters.set(key,waiter);signal.addEventListener('abort',abort,{once:true});this.#timers.schedule(()=>{const current=this.#waiters.get(key);if(!current||current.token!==token)return;if(current.phase==='WAITING')this.#unknown(current);this.#waiterClock=Math.max(this.#waiterClock,current.deadline);this.#waiters.delete(key);},Math.ceil(expires-at));if(signal.aborted)this.#unknown(waiter);
  return Object.freeze({wait:()=>waiter.promise});
 }
 #terminal(waiter:AckWaiter,phase:'UNKNOWN'|'CANDIDATE'){const key=waiter.binding.windowRef.id;if(this.#waiters.get(key)!==waiter)return false;this.#waiters.set(key,{phase,token:waiter.token,deadline:waiter.deadline});waiter.remove();return true;}
 #unknown(waiter:AckWaiter){if(this.#terminal(waiter,'UNKNOWN'))waiter.reject(new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503));}
 candidate(windowId:string,operationFence:string,raw:unknown){
  if(!receiveUuid(windowId)||!receiveUuid(operationFence))denied();const waiter=this.#waiters.get(windowId);if(!waiter||waiter.phase!=='WAITING'||waiter.binding.operationFence!==operationFence)denied();
  try{waiter.check();const now=this.#now();if(!Number.isFinite(now)||now<this.#waiterClock||now<waiter.lastNow||now>=waiter.deadline)throw Error('EXPIRED');waiter.lastNow=now;this.#waiterClock=now;}catch{this.#unknown(waiter);denied();}
  if(!receiveRecord(raw,['ref','snapshot'])||!receiveRef(raw.ref)||raw.ref.version!==1)denied();const snapshot=readReceiveSlotReceipt(raw.snapshot);if(raw.ref.id!==snapshot.receiptId||raw.ref.contentHash!==receiveHash(snapshot))denied();const receipt=receiveCopy({ref:raw.ref,snapshot}),b=waiter.binding;
  if(!['windowRef','receiveSessionRef','bindingRef','armRef','deliveryRef','authorityRef'].every(k=>receiveSame(snapshot[k],b[k as keyof AckBinding]))||snapshot.commandHash!==b.commandHash||snapshot.metadataHash!==b.metadataHash||snapshot.expiresAt!==b.expiresAt||Date.parse(snapshot.acceptedAt)>this.#now())denied();
  try{waiter.check();const now=this.#now();if(!Number.isFinite(now)||now<this.#waiterClock||now<waiter.lastNow||now>=waiter.deadline)throw Error('EXPIRED');waiter.lastNow=now;this.#waiterClock=now;}catch{this.#unknown(waiter);denied();}
  if(!this.#terminal(waiter,'CANDIDATE'))denied();waiter.resolve(receiveCopy(receipt));return{candidateRef:receiveCopy(receipt.ref),disposition:'CANDIDATE_ONLY',confirmed:false} as const;
 }
}

type ReceiveCommandCheck=(()=>void)&{tighten(expires:number):void};
const humanCommands=new WeakMap<object,{actor:AuthenticatedIdentity;session:object;requestHash:string}>();
/** 원 인증 callback의 실제 db를 키로 사용한다. finally는 메모리 결박만 폐기하고 불명 뒤 SQL을 추가하지 않는다. */
export async function withNativeReceiveCommand<T>(db:ReceiveDb,actor:AuthenticatedIdentity,raw:unknown,validUntil:number,body:(command:any,check:ReceiveCommandCheck,owned:ReceiveDb)=>Promise<T>,now:()=>number=Date.now):Promise<T>{
 if(humanCommands.has(db)||!actor.authSession||!receiveUuid(actor.authSession.id)||!receiveUuid(actor.actorId)||!receiveUuid(actor.clientId)||!Number.isSafeInteger(actor.credentialGeneration)||actor.credentialGeneration<1||!Number.isFinite(validUntil))denied();
 const reauth=actor.reauthUntil,reauthAt=reauth instanceof Date?reauth.getTime():NaN;if(!Number.isFinite(reauthAt)||now()>=reauthAt)throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);
 const command=JSON.parse(receiveHumanCommandCanonical(readNativeReceiveHumanCommand(raw)));if(command.clientId!==actor.clientId)denied();
 const canonical=receiveHumanCommandCanonical(command),requestHash=contentHash(canonical),session=actor.authSession,tuple=[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt],query=db.query,binding={actor,session,requestHash};let dispatched=false,last=now(),deadline=validUntil;
 const check=(()=>{if(humanCommands.get(db)!==binding||db.query!==query||actor.authSession!==session||!receiveSame(tuple,[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt]))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);if(actor.reauthUntil!==reauth||reauth!.getTime()!==reauthAt)throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);const at=now(),limit=Math.min(deadline,reauthAt,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));if(!Number.isFinite(at)||!Number.isFinite(limit)||at<last||at>=limit)throw new AuthFailure(dispatched?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',dispatched?503:412);last=at;}) as ReceiveCommandCheck;Object.defineProperty(check,'tighten',{value:(expires:number)=>{if(!Number.isFinite(expires))denied();deadline=Math.min(deadline,expires);check();}});Object.freeze(check);
 const result=(value:any)=>{if(value.rows?.length!==1||!receiveRecord(value.rows[0],['result'])||!receiveRecord(value.rows[0].result,['requestHash','transactionId'])||value.rows[0].result.requestHash!==requestHash||typeof value.rows[0].result.transactionId!=='string'||!/^\d{1,19}$/.test(value.rows[0].result.transactionId)||BigInt(value.rows[0].result.transactionId)<1n||BigInt(value.rows[0].result.transactionId)>9223372036854775807n)denied();return value.rows[0].result.transactionId as string;};
 let active=true,queryFailed=false;const pending=new Set<Promise<unknown>>();
 const owned:ReceiveDb=Object.freeze({query:(sql:string,args?:unknown[])=>{try{if(!active)denied();check();const raw=Promise.resolve(Reflect.apply(query,db,[sql,args]));pending.add(raw);void raw.then(()=>pending.delete(raw),()=>{pending.delete(raw);queryFailed=true;});const work=raw.then(value=>{check();return value;});void work.catch(()=>{});return work;}catch(error){const rejected=Promise.reject(error);void rejected.catch(()=>{});return rejected;}}});
 const settle=async()=>{while(pending.size)await Promise.allSettled([...pending]);};humanCommands.set(db,binding);humanCommands.set(owned,binding);
 try{check();dispatched=true;const begun=await Reflect.apply(query,db,['SELECT anvil.native_receive_command_begin($1,$2,$3::jsonb) AS result',[command.projectId,session.id,canonical]]);check();const transactionId=result(begun),out=await body(command,check,owned);await settle();check();if(queryFailed)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);const ended=await Reflect.apply(query,db,['SELECT anvil.native_receive_command_end($1,$2,$3,$4) AS result',[command.projectId,session.id,requestHash,transactionId]]);check();if(result(ended)!==transactionId)denied();return out;}finally{active=false;await settle();if(humanCommands.get(owned)===binding)humanCommands.delete(owned);if(humanCommands.get(db)===binding)humanCommands.delete(db);}
}

/** 기본 import/생성은 DB·키·서비스를 열지 않는다. 실제 인증 port는 서버 조립자가 명시 주입한다. */
/** 실제 0106/root producer는 아직 없다. 이 명시 내부 source는 같은 거래의 current SPKI/claim과 목적 receipt를 독립 검산해야 한다. */
export interface NormalStartPreparationResultSource{
 purpose:'NORMAL_START_PREPARATION_RESULT_SOURCE_V1';
 readResultBasis(db:ReceiveDb,sessionId:string,credentialDigest:string,requestRef:ReceiveRef,check:()=>void):Promise<unknown>;
 recordResult(db:ReceiveDb,material:Readonly<{request:NormalStartPreparationRequest;result:NormalStartPreparationResult;proof:NormalStartPreparationResultProof;signature:string;credentialDigest:string;transactionId:string}>,check:()=>void):Promise<unknown>;
 readRecordedResult(db:ReceiveDb,material:Readonly<{request:NormalStartPreparationRequest;result:NormalStartPreparationResult;proof:NormalStartPreparationResultProof;signature:string;credentialDigest:string;transactionId:string}>,check:()=>void):Promise<unknown>;
}
export interface NormalStartPreparationFrameSource{
 purpose:'NORMAL_START_PREPARATION_FRAME_SOURCE_V1';
 reserve(db:ReceiveDb,actor:AuthenticatedIdentity,command:ProjectCommand,admissionRef:ReceiveRef,provenance:unknown,check:()=>void):Promise<unknown>;
}
export class NativeFirstReceiveService{
 #normalFrameSource:NormalStartPreparationFrameSource|null=null;
 connectNormalStartPreparationFrameSource(source:NormalStartPreparationFrameSource){
  if(this.#normalFrameSource||!receiveRecord(source,['purpose','reserve'])||source.purpose!=='NORMAL_START_PREPARATION_FRAME_SOURCE_V1'||typeof source.reserve!=='function')return denied();this.#normalFrameSource=source;
 }
 #streamBroker:NativeFirstReceiveBroker|null=null;
 #normalStartResultSource:NormalStartPreparationResultSource|null=null;
 connectNormalStartPreparationResultSource(source:NormalStartPreparationResultSource){
  if(this.#normalStartResultSource||!receiveRecord(source,['purpose','readResultBasis','recordResult','readRecordedResult'])||source.purpose!=='NORMAL_START_PREPARATION_RESULT_SOURCE_V1'
   ||typeof source.readResultBasis!=='function'||typeof source.recordResult!=='function'||typeof source.readRecordedResult!=='function')return denied();this.#normalStartResultSource=source;
 }
 readonly #access:Pick<AccessRepository,'authenticated'|'installationId'>&Partial<Pick<AccessRepository,'pool'>>;readonly #store:NativeFirstReceiveStore;readonly #now:()=>number;readonly #preparations:ProjectNativePreparations|null;readonly #credential:()=>Buffer;readonly #origin:string|null;
 constructor(access:Pick<AccessRepository,'authenticated'|'installationId'>&Partial<Pick<AccessRepository,'pool'>>,store=new NativeFirstReceiveStore(),now:()=>number=Date.now,preparations:ProjectNativePreparations|null=null,credential:()=>Buffer=()=>{const value=randomBytes(32);try{return Buffer.from(value.toString('base64url'),'ascii');}finally{value.fill(0);}},serverOrigin:string|null=null){if(!receiveUuid(access.installationId)||preparations!==null&&!(preparations instanceof ProjectNativePreparations))denied();this.#access=access;this.#store=store;this.#now=now;this.#preparations=preparations;this.#credential=credential;this.#origin=serverOrigin;if(serverOrigin!==null){try{const origin=new URL(serverOrigin);if(origin.protocol!=='https:'||origin.origin!==serverOrigin||origin.username||origin.password)denied();}catch{denied();}}}
 /** 명시 서버 내부 caller만 사용한다. HTTP/기본 app에는 노출하지 않으며 새 DB 권한 재검산은 admission의 책임이다. */
 takeNormalStartPreparationReceiver(scope:NormalStartPreparationReceiverScope):NormalStartPreparationReceiver {
  const expected=receiverScope(scope),broker=this.#streamBroker,installation=this.#access.installationId,pool=this.#access.pool;
  if(!broker||expected.installationId!==installation)return denied();
  return broker.takeNormalStartPreparationReceiver(expected,()=>{
   if(this.#streamBroker!==broker||this.#access.installationId!==installation||this.#access.pool!==pool)return denied();
  });
 }
 /** 협상/구성의 사전 검산이며 claim이나 peer 권위를 만들지 않는다. */
 assertNormalStartPreparationFrame(scope:NormalStartPreparationReceiverScope){
  if(!this.#normalFrameSource||!this.#normalStartResultSource||!this.#streamBroker||scope.installationId!==this.#access.installationId)return denied();
  const c=this.#streamBroker.captureNormalStartPreparationFrame(scope);this.#streamBroker.checkNormalStartPreparationFrame(c);
 }
 /** 기존 authenticated의 확정 COMMIT와 release 반환 뒤에만 private 원 요청 token을 봉인한다. */
 async prepareNormalStartPreparationFrame(token:string,csrf:string,command:ProjectCommand,admissionRef:ReceiveRef,provenance:unknown){
  const source=this.#normalFrameSource,broker=this.#streamBroker,pool=this.#access.pool,auth=this.#access.authenticated,installation=this.#access.installationId;
  if(!source||!this.#normalStartResultSource||!broker||!this.#origin||!receiveRef(admissionRef)||!receiveRecord(provenance,['purpose','scope','streamProofHash','streamChallengeRef','observedAt','expiresAt','executionAuthorized','dispatchPerformed'])
   ||provenance.purpose!=='NORMAL_START_PREPARATION_RECEIVER_PROVENANCE'||provenance.executionAuthorized!==false||provenance.dispatchPerformed!==false||!receiveAt(provenance.expiresAt))return denied();
  const scope=receiverScope(provenance.scope),candidate=broker.captureNormalStartPreparationFrame(scope),capture=broker.checkNormalStartPreparationFrame(candidate),entry=capture.entry,reserve=source.reserve;
  if(scope.installationId!==installation||command.projectId!==scope.projectId||command.clientId!==scope.clientId||command.controlGeneration!==scope.controlGeneration||command.operation!=='queueExecutionCommand'||command.payload.operation!=='START_SESSION')return denied();
  const q=receiveCopy(command),ar=receiveCopy(admissionRef),pv=receiveCopy(provenance),start=this.#now(),startMono=performance.now(),end=Math.min(start+10000,Date.parse(provenance.expiresAt)),monoEnd=startMono+(end-start);
  let last=start,lastMono=startMono,issued=false,expired=false;let reject!: (error:Error)=>void;const lost=new Promise<never>((_resolve,r)=>{reject=r;});void lost.catch(()=>{});
  const current=()=>{const at=this.#now(),m=performance.now();if(expired||this.#normalFrameSource!==source||source.reserve!==reserve||source.purpose!=='NORMAL_START_PREPARATION_FRAME_SOURCE_V1'||this.#streamBroker!==broker||this.#access.pool!==pool||this.#access.authenticated!==auth||this.#access.installationId!==installation
    ||!Number.isFinite(at)||!Number.isFinite(m)||at<last||m<lastMono||at>=end||m>=monoEnd)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);last=at;lastMono=m;};
  current();entry.frameAttempt='RESERVING';const timer=setTimeout(()=>{expired=true;reject(new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503));},Math.max(1,Math.floor(end-start)));timer.unref();
  try{
   const work=Reflect.apply(auth,this.#access,[token,csrf,async(db:PoolClient,actor:AuthenticatedIdentity)=>{
    current();broker.checkNormalStartPreparationFrame(candidate);
    if(!actor.authSession||actor.actorId!==scope.actorId||actor.clientId!==scope.clientId||actor.authSession.id!==scope.humanSessionId||actor.credentialGeneration!==scope.credentialGeneration)return denied();
    const query=db.query;let transaction:string|null=null,rpc:unknown=null;
    const owned:ReceiveDb=Object.freeze({query:async(text:string,args?:unknown[])=>{
     current();broker.checkNormalStartPreparationFrame(candidate);if(db.query!==query)return denied();
     if(text==='SELECT txid_current()::text AS transaction_id'){
      const out=await Reflect.apply(query,db,[text,args]);current();if(out.rowCount!==1||out.rows.length!==1||!receiveRecord(out.rows[0],['transaction_id'])||typeof out.rows[0].transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(out.rows[0].transaction_id))return denied();transaction=out.rows[0].transaction_id;return out;
     }
     if(text!=='SELECT anvil.fn08_normal_start_preparation_dispatch_claim($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9) AS result'||issued||!transaction||!Array.isArray(args)||args.length!==9
      ||!receiveSame(args.slice(0,7),[scope.humanSessionId,scope.actorId,scope.clientId,q.projectId,receiveCanonical(q),receiveCanonical(ar),receiveCanonical(pv)])||args[8]!==transaction)return denied();
     issued=true;const out=await Reflect.apply(query,db,[text,args]);current();broker.checkNormalStartPreparationFrame(candidate);
     if(out.rowCount!==1||out.rows.length!==1||!receiveRecord(out.rows[0],['result'])||Buffer.byteLength(receiveCanonical(out.rows[0].result))>8192)return denied();rpc=receiveCopy(out.rows[0].result);return out;
    }});
    const value=await Reflect.apply(reserve,source,[owned,actor,receiveCopy(q),receiveCopy(ar),receiveCopy(pv),current]);current();broker.checkNormalStartPreparationFrame(candidate);
    if(!issued||!rpc||!receiveSame(value,rpc)||!receiveRecord(value,['disposition','request','claimRef','expiresAt','dispatchPerformed'])||value.disposition!=='FIRST_COMMIT'||value.dispatchPerformed!==false
     ||!receiveRecord(value.request,['ref','snapshot'])||!receiveRef(value.claimRef)||!receiveAt(value.expiresAt))return denied();
    const request=readNormalStartPreparationRequest(value.request.snapshot);
    if(!receiveSame(value.request.ref,normalStartPreparationRequestRef(request))||!receiveSame(request.claimRef,value.claimRef)||!receiveSame(request.admissionRef,ar)||request.normalRequestHash!==receiveHash(q)||request.normalCommandId!==q.commandId
     ||request.projectId!==scope.projectId||request.actorId!==scope.actorId||request.clientId!==scope.clientId||request.humanSessionId!==scope.humanSessionId||request.expiresAt!==value.expiresAt)return denied();
    const origin=entry.ownership.preparationOrigin,w=origin.window.snapshot;
    for(const k of ['installationId','projectId','registrationRef','connectorRef','windowRef','receiveSessionRef','localReceiveAttemptId','actorId','clientId','humanSessionId','credentialGeneration','controlGeneration']as const)
     if(!receiveSame(request[k],scope[k]))return denied();
    for(const k of ['profileRef','hostPublicKeyFingerprint','authBindingHash']as const)if(!receiveSame(request[k],w[k]))return denied();
    if(!receiveSame(request.writerNoneRef,w.writerHeadRef)||request.executionId!==q.payload.executionId||request.executionGeneration!==q.payload.executionGeneration||!receiveSame(request.executionPreparationRef,q.payload.preparationRef)
     ||Date.parse(request.issuedAt)<Date.parse(origin.session.snapshot.issuedAt)||Date.parse(request.expiresAt)>entry.preparation.expires)return denied();
    return receiveCopy({request,claimRef:value.claimRef});
   }]) as Promise<{request:NormalStartPreparationRequest;claimRef:ReceiveRef}>;
   const value=await Promise.race([work,lost]);current();broker.checkNormalStartPreparationFrame(candidate);entry.frameAttempt='COMMITTED';
   const committed=Object.freeze(Object.defineProperty({},'toJSON',{value:()=>denied()}));normalFrameCommits.set(committed,{service:this,candidate,request:value.request,claimRef:value.claimRef,used:false,current});return committed;
  }catch{if(issued)entry.frameAttempt='UNKNOWN';else delete entry.frameAttempt;throw new AuthFailure(issued?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);}
  finally{clearTimeout(timer);}
 }
 async sendNormalStartPreparationFrame(capability:object,signal:AbortSignal){
  if(!this.#streamBroker)return denied();return this.#streamBroker.supplyNormalStartPreparationFrame(capability,this,signal);
 }
 async waitNormalStartPreparationRejection(capability:object,signal:AbortSignal):Promise<never>{
  const broker=this.#streamBroker;if(!broker)return denied();
  const settled=await broker.waitNormalStartPreparationRejection(capability,this,signal);
  settled.check();if(this.#streamBroker!==broker)return denied();
  const error=new AuthFailure('NORMAL_START_PREPARATION_REJECTED',412);
  committedNormalRejections.set(error,{service:this,requestHash:settled.request.normalRequestHash,commandId:settled.request.normalCommandId,scope:settled.scope});throw error;
 }
 async nativeNormalStartPreparationResult(sessionId:string,credential:unknown,raw:unknown,rawProof:unknown,signature:unknown,signal:AbortSignal){
  let result:NormalStartPreparationResult,proof:NormalStartPreparationResultProof;
  try{result=readNormalStartPreparationResult(raw);proof=readNormalStartPreparationResultProof(rawProof);}catch{throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);}
  if(!receiveUuid(sessionId)||proof.receiveSessionRef.id!==sessionId||!receiveSame(result.requestRef,proof.requestRef)||typeof signature!=='string'||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature))throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);
  if(typeof credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(credential))throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);
  const source=this.#normalStartResultSource,pool=this.#access.pool,broker=this.#streamBroker,installation=this.#access.installationId;
  if(!source||!pool||!broker||!this.#origin)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));
  const read=source.readResultBasis,record=source.recordResult,replay=source.readRecordedResult,connect=pool.connect,digest=contentHash(credential),started=performance.now(),initial=this.#now();
  let end=Math.min(initial+2000,Date.parse(proof.expiresAt)),monoEnd=started+(end-initial),last=initial,lastMono=started,effect=false,commitAttempted=false;
  let client:PoolClient|null=null,originalRelease:((destroy?:boolean)=>void)|null=null;
  let owner:ReturnType<NativeFirstReceiveBroker['normalStartPreparationResultOwner']>|null=null;
  let lost=false,closed=false,closing=false,pendingQueries=0,rollback:(()=>Promise<boolean>)|null=null;
  let resultMode:'WRITE'|'READ_ONLY'|null=null,recordIssued=false,replayIssued=false;
  let rpcReturned=false,rpcResult:unknown;
  const released=new WeakSet<object>();
  const releaseOnce=(value:PoolClient,fn:((destroy?:boolean)=>void),destroy:boolean)=>{
   if(released.has(value))return;released.add(value);Reflect.apply(fn,value,[destroy]);
  };
  const cleanup=()=>{if(closing&&client&&originalRelease&&pendingQueries===0){const raw=client;client=null;try{releaseOnce(raw,originalRelease,true);}catch{/* 원 회수 불명은 보존하며 재호출하지 않는다. */}}};
  let rejectDeadline!:(reason:Error)=>void;
  const deadline=new Promise<never>((_resolve,reject)=>{rejectDeadline=reject;});void deadline.catch(()=>{});
  const expire=()=>{if(lost||closed)return;lost=true;owner?.finish(effect||commitAttempted?'UNKNOWN':'RELEASE');rejectDeadline(new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503));};
  let timer=setTimeout(expire,Math.max(1,Math.floor(end-initial)));const abort=()=>expire();signal.addEventListener('abort',abort,{once:true});
  const wait=async<T>(work:Promise<T>,late?:(value:T)=>void)=>{
   // 이미 시작한 원 작업의 resolve/reject를 항상 구독한다. 시간 초과는 실제 DB 취소가 아니다.
   void work.then(value=>{if(lost||closed)try{late?.(value);}catch{/* 늦은 원 소유자 회수 불명 */}},()=>{});
   return Promise.race([work,deadline]);
  };
  const check=()=>{
   const at=this.#now(),mono=performance.now();
   if(lost||closed||signal.aborted||this.#normalStartResultSource!==source||source.purpose!=='NORMAL_START_PREPARATION_RESULT_SOURCE_V1'||source.readResultBasis!==read||source.recordResult!==record||source.readRecordedResult!==replay||this.#streamBroker!==broker||this.#access.pool!==pool
    ||pool.connect!==connect||this.#access.installationId!==installation||!Number.isFinite(at)||!Number.isFinite(mono)||at<last||mono<lastMono||at<Date.parse(proof.issuedAt)||at>=end||mono>=monoEnd)
    throw new AuthFailure(lost||effect||commitAttempted?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',lost||effect||commitAttempted?503:412);
   last=at;lastMono=mono;owner?.check();
  };
  try{
   check();owner=broker.normalStartPreparationResultOwner(sessionId,digest,result,proof);check();
   client=await wait(Reflect.apply(connect,pool,[]) as Promise<PoolClient>,late=>{releaseOnce(late,late.release,true);});
   originalRelease=client.release;const query=client.query,release=originalRelease;check();let active=true;
   const run=async(text:string,args?:unknown[])=>{check();if(!active||client!.query!==query||client!.release!==release)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
    pendingQueries++;let work:Promise<{rows:any[];rowCount?:number|null;command?:string}>;
    if(text==='SELECT anvil.fn08_normal_start_preparation_result_commit($1,$2::jsonb,$3) AS result')effect=true;
    try{work=Reflect.apply(query,client,[text,args]);}catch(error){pendingQueries--;throw error;}
    void Promise.resolve(work).then(()=>{pendingQueries--;cleanup();},()=>{pendingQueries--;cleanup();});
    const r=await wait(Promise.resolve(work));check();
    if(text==='SELECT anvil.fn08_normal_start_preparation_result_commit($1,$2::jsonb,$3) AS result'||text==='SELECT anvil.fn08_normal_start_preparation_result_replay($1,$2::jsonb,$3) AS result'){
     if(r.rowCount!==1||r.rows.length!==1||!receiveRecord(r.rows[0],['result']))throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
     const canonical=receiveCanonical(r.rows[0].result);if(Buffer.byteLength(canonical)>8192)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
     rpcResult=JSON.parse(canonical);rpcReturned=true;
    }
    return r;};
   rollback=async()=>{const r=await run('ROLLBACK');return r.command==='ROLLBACK';};
   if((await run('BEGIN')).command!=='BEGIN')throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
   const db:ReceiveDb=Object.freeze({query:(text:string,args?:unknown[])=>{
    if(!['SELECT anvil.native_receive_session_current($1,$2) AS result',
     'SELECT txid_current()::text AS transaction_id',
     'SELECT anvil.fn08_normal_start_preparation_result_basis($1,$2,$3::jsonb,$4) AS result',
     'SELECT anvil.fn08_normal_start_preparation_result_replay($1,$2::jsonb,$3) AS result',
     'SELECT anvil.fn08_normal_start_preparation_result_commit($1,$2::jsonb,$3) AS result'].includes(text))throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
    if(text==='SELECT anvil.fn08_normal_start_preparation_result_commit($1,$2::jsonb,$3) AS result'){
     if(resultMode!=='WRITE'||recordIssued)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);recordIssued=true;
    }
    if(text==='SELECT anvil.fn08_normal_start_preparation_result_replay($1,$2::jsonb,$3) AS result'){
     if(resultMode!=='READ_ONLY'||replayIssued)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);replayIssued=true;
    }
    return run(text,args);
   }});
   const current=await this.#store.authenticateSession(db,sessionId,credential,check);check();
   if(current.profileOrigin!==this.#origin||current.window.snapshot.installationId!==installation)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
   const basis=await wait(Reflect.apply(read,source,[db,sessionId,digest,result.requestRef,check]));check();
   if(!receiveRecord(basis,['request','publicKeySpki','expiresAt'])||typeof basis.publicKeySpki!=='string'||!receiveRecord(basis.request,['ref','snapshot'])||!receiveRef(basis.request.ref)||basis.request.ref.version!==1
    ||!receiveSame(basis.request.ref,result.requestRef)||!receiveSame(normalStartPreparationRequestRef(basis.request.snapshot),basis.request.ref)||!Number.isFinite(Date.parse(basis.expiresAt)))throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);
   let matched:ReturnType<typeof matchNormalStartPreparationResult>;
   try{matched=matchNormalStartPreparationResult(basis.request.snapshot,result,proof);}catch{throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);}
   const request=readNormalStartPreparationRequest(matched.request);
   end=Math.min(end,Date.parse(basis.expiresAt),Date.parse(request.expiresAt),Date.parse(result.receipt.snapshot.expiresAt),Date.parse(current.session.snapshot.expiresAt),Date.parse(current.window.snapshot.expiresAt));
   monoEnd=Math.min(monoEnd,performance.now()+(end-this.#now()));check();clearTimeout(timer);timer=setTimeout(expire,Math.max(1,Math.floor(Math.min(end-last,monoEnd-lastMono))));
   owner.verify(current,basis.publicKeySpki,request,proof,signature);check();
   const tx=await run('SELECT txid_current()::text AS transaction_id');
   if(tx.rowCount!==1||tx.rows.length!==1||!receiveRecord(tx.rows[0],['transaction_id'])||typeof tx.rows[0].transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(tx.rows[0].transaction_id))throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);
   const mode=owner.begin(request,result,proof);resultMode=mode;
   const material=Object.freeze({request:receiveCopy(request),result:receiveCopy(result),proof:receiveCopy(proof),signature,credentialDigest:digest,transactionId:tx.rows[0].transaction_id});
   const stored=await wait(Reflect.apply(mode==='WRITE'?record:replay,source,[db,material,check]));check();
   if(mode==='WRITE'&&!effect||mode==='READ_ONLY'&&!replayIssued||!rpcReturned||!receiveSame(stored,rpcResult))throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);
   if(stored===null)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
   if(!receiveRecord(stored,['ref','snapshot'])||!receiveRef(stored.ref)||stored.ref.version!==1||!receiveRecord(stored.snapshot,['schemaVersion','purpose','recordId','requestRef','peerReceiptRef','resultHash','proofHash','recordedAt','executionAuthorized','dispatchPerformed'])
    ||stored.snapshot.schemaVersion!==1||stored.snapshot.purpose!=='NORMAL_START_PREPARATION_RESULT_RECORD_V1'||stored.snapshot.recordId!==stored.ref.id||stored.ref.id===result.receipt.ref.id||stored.ref.id===result.requestRef.id
    ||!receiveSame(stored.snapshot.requestRef,result.requestRef)||!receiveSame(stored.snapshot.peerReceiptRef,result.receipt.ref)||stored.snapshot.resultHash!==receiveHash(result)||stored.snapshot.proofHash!==receiveHash(proof)
    ||stored.ref.contentHash!==receiveHash(stored.snapshot)||stored.snapshot.executionAuthorized!==false||stored.snapshot.dispatchPerformed!==false||!receiveAt(stored.snapshot.recordedAt)
    ||Date.parse(stored.snapshot.recordedAt)<Date.parse(proof.issuedAt)||Date.parse(stored.snapshot.recordedAt)>last)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
   const finalCurrent=await this.#store.authenticateSession(db,sessionId,credential,check),finalBasis=await wait(Reflect.apply(read,source,[db,sessionId,digest,result.requestRef,check]));check();
   if(!receiveSame(finalCurrent,current)||!receiveSame(finalBasis,basis))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);
   owner.verify(finalCurrent,basis.publicKeySpki,request,proof,signature);
   const finalTx=await run('SELECT txid_current()::text AS transaction_id');if(finalTx.rowCount!==1||finalTx.rows.length!==1||!receiveRecord(finalTx.rows[0],['transaction_id'])||finalTx.rows[0].transaction_id!==tx.rows[0].transaction_id)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
   check();commitAttempted=true;const committed=await run('COMMIT');if(committed.command!=='COMMIT')throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
   check();active=false;const original=client;client=null;releaseOnce(original,release,false);check();owner.finish('SETTLED',stored);
   return receiveCopy({status:'NORMAL_START_PREPARATION_RESULT_STORED',ref:stored.ref,snapshot:stored.snapshot});
  }catch(error){
   owner?.finish(effect||commitAttempted?'UNKNOWN':'RELEASE');
   let rollbackUnknown=false;
   if(client&&!commitAttempted&&!lost&&pendingQueries===0&&rollback)try{rollbackUnknown=!(await rollback());}catch{rollbackUnknown=true;}
   if(lost||effect||commitAttempted||rollbackUnknown)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
   throw nativeReceivePreEffectFailure(error);
  }finally{closed=true;closing=true;clearTimeout(timer);signal.removeEventListener('abort',abort);cleanup();}
 }
 async nativeOpen(wid:string,rawBody:unknown,rawProof:unknown,signature:unknown,signal?:AbortSignal){
  if(!receiveUuid(wid)||!receiveRecord(rawBody,['schemaVersion','windowRef'])||rawBody.schemaVersion!==1||!receiveRef(rawBody.windowRef)||rawBody.windowRef.version!==1||rawBody.windowRef.id!==wid||typeof signature!=='string'||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature))throw new AuthFailure('INPUT_INVALID',400);const proof=readReceiveProof(rawProof),body=receiveCopy(rawBody);if(proof.phase!=='OPEN'||!receiveSame(proof.windowRef,body.windowRef))throw new AuthFailure('INPUT_INVALID',400);const pool=this.#access.pool;if(!this.#origin||!pool||typeof pool.connect!=='function')throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));let secret:Buffer|null=null,frame:Buffer|null=null,committed=false,effectEntered=false,last=-Infinity;let window:any;const clock=()=>{if(signal?.aborted)throw new AuthFailure(effectEntered||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_CONTEXT_CHANGED',effectEntered||committed?503:409);return this.#now();};const fresh=()=>{const now=clock(),limit=Math.min(Date.parse(proof.expiresAt),window?Date.parse(window.snapshot.expiresAt):Infinity);if(!Number.isFinite(now)||now<last||now<Date.parse(proof.issuedAt)||now>=limit)throw new AuthFailure(committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',committed?503:412);last=now;};
  try{fresh();const session=await withNativeReceiveOpenTransaction(pool,wid,body,proof,async(owned,current)=>{window=receiveCopy(current.window);fresh();if(current.profileOrigin!==this.#origin)throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);if(window.snapshot.installationId!==this.#access.installationId)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);const lease=await verifyNativeReceiveOpenProof(owned,{window:current.window,challenge:current.challenge,publicKeySpki:current.publicKeySpki,proof,signature,body},clock);fresh();secret=this.#credential();if(!Buffer.isBuffer(secret)||secret.length!==43||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(secret.toString('utf8')))throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);fresh();effectEntered=true;return this.#store.consumeOpen(owned,lease,secret.toString('ascii'),fresh);},clock);committed=true;fresh();const metadata=Buffer.from(receiveCanonical({schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_CREDENTIAL',windowRef:body.windowRef,session}));if(metadata.length>receiveLimits.openMetadata||!secret)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);frame=Buffer.alloc(4+metadata.length+43);frame.writeUInt32BE(metadata.length);metadata.copy(frame,4);(secret as Buffer).copy(frame,4+metadata.length);fresh();const result=frame;frame=null;return result;
  }catch(error){if(committed)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}finally{(secret as Buffer|null)?.fill(0);frame?.fill(0);}
 }
 connectNativeCommand(preparations:ProjectNativePreparations){if(preparations!==this.#preparations||preparations.access!==this.#access)denied();const stream=(db:ReceiveDb,lease:object,check:()=>void)=>{const broker=this.#streamBroker;if(!broker)throw new AuthFailure('NATIVE_SOURCE_UNAVAILABLE',503);broker.requireBindingStream(this.#store.bindingStreamOwnership(db,lease,check));};const source=Object.freeze({access:preparations.access,history:(db:ReceiveDb,actor:AuthenticatedIdentity,command:unknown,arm:unknown,previous:unknown,check:()=>void)=>this.#store.readNativeBindingHistory(db,actor,command,arm,previous,check),admit:async(db:ReceiveDb,actor:AuthenticatedIdentity,command:unknown,arm:unknown,check:()=>void)=>{const value=await this.#store.admitNativeBinding(db,actor,command,arm,check);stream(db,value.lease,check);return value;},reserve:async(db:ReceiveDb,lease:object,intent:unknown,check:()=>void,authorityVersion:1|2)=>{stream(db,lease,check);await this.#store.reserveNativeBinding(db,lease,intent,check,authorityVersion);stream(db,lease,check);return this.#store.nativeInsertCapacity(db,lease,preparations.store,check);},complete:async(db:ReceiveDb,lease:object,authority:unknown,eventRef:unknown,operationLease:unknown,check:()=>void)=>{stream(db,lease,check);const value=await this.#store.completeNativeBinding(db,lease,authority,eventRef,operationLease,check);stream(db,lease,check);return value;},prepareDelivery:async(db:ReceiveDb,lease:object,digest:string,operationLease:unknown,check:()=>void)=>{stream(db,lease,check);const value=await this.#store.prepareNativeDelivery(db,lease,digest,operationLease,check);stream(db,lease,check);return value;},deliver:async(capability:object,opaque:Uint8Array,check:()=>void,signal:AbortSignal,remainingMs:()=>number)=>{const broker=this.#streamBroker;if(!broker)throw new AuthFailure('NATIVE_SOURCE_UNAVAILABLE',503);this.#store.releaseNativeDelivery(capability,check);await broker.supplyDelivery(capability,opaque,check,signal,remainingMs);}});preparations.connectNativeReceiveBinding(source);}
 async nativeStream(sessionId:string,credential:unknown,rawProof:unknown,signature:unknown,signal:AbortSignal,accept:unknown=undefined){
  let proof:any;try{proof=readReceiveProof(rawProof);}catch{throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);}if(!receiveUuid(sessionId)||typeof credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(credential))throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);if(proof.phase!=='STREAM'||proof.receiveSessionRef?.id!==sessionId||typeof signature!=='string'||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature)||!signal||typeof signal.aborted!=='boolean')throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);
  const pool=this.#access.pool,installation=this.#access.installationId;if(!pool||!this.#origin)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const connect=pool.connect,broker=this.#streamBroker??(this.#streamBroker=new NativeFirstReceiveBroker(randomUUID(),this.#now));let operationExpires=Infinity;let settledRejection:AuthFailure|null=null;let effect=false,committed=false,replayed=false,last=-Infinity;const clock=()=>{if(this.#access.pool!==pool||pool.connect!==connect||this.#access.installationId!==installation||this.#streamBroker!==broker||signal.aborted)throw new AuthFailure(effect||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_CONTEXT_CHANGED',effect||committed?503:409);return this.#now();};const check=()=>{const at=clock();if(!Number.isFinite(at)||at<last||at<Date.parse(proof.issuedAt)||at>=Math.min(Date.parse(proof.expiresAt),operationExpires))throw new AuthFailure(effect||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',effect||committed?503:412);last=at;};
  try{check();const cap=await withNativeReceivePhaseTransaction(pool,sessionId,credential,{},proof,async(owned,current,consumed,rejected)=>{check();if(current.window.snapshot.installationId!==installation)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);if(current.profileOrigin!==this.#origin)throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);if(rejected){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}return this.#store.readDeniedPhase(owned,signature,check);}if(!consumed&&current.phase!=='OPENED')throw new AuthFailure('NATIVE_RECEIVE_CONFLICT',409);let lease:object;try{lease=await verifyNativeReceivePhaseProof(owned,{window:current.window,session:current.session,challenge:current.challenge,proof,signature,body:{},publicKeySpki:current.publicKeySpki},clock);}catch(error){const failure=nativeReceiveClassifyFailure(error);if(!consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}const rejection=await this.#store.recordPhaseDenial(owned,signature,check);if(rejection!==null){effect=true;return rejection;}}if(consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){replayed=true;return this.#store.recordConsumedConflict(owned,signature,check);}throw error;}check();if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkBoundCurrent(owned,lease,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}if(consumed){replayed=true;return this.#store.readConsumedPhase(owned,lease,check,expiresAt=>{operationExpires=Math.min(operationExpires,expiresAt);check();});}effect=true;return this.#store.consumeStream(owned,lease,broker.instanceId,check);},clock,true);committed=true;check();settledRejection=NativeFirstReceiveStore.takeCommittedPhaseRejection(cap,last);if(settledRejection)throw settledRejection;if(replayed)return receiveCopy(cap);return broker.attachStream(cap,signal,()=>{check();return last;},accept);}catch(error){if(settledRejection!==null&&error===settledRejection)throw settledRejection;if(effect||committed)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}
 }
 async nativeClose(sessionId:string,credential:unknown,rawBody:unknown,rawProof:unknown,signature:unknown,signal:AbortSignal){
  let body:any,proof:any;try{body=readNativeReceivePhaseBody('CLOSE',rawBody);proof=readReceiveProof(rawProof);}catch{throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);}if(!receiveUuid(sessionId)||typeof credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(credential))throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);if(proof.phase!=='CLOSE'||proof.receiveSessionRef?.id!==sessionId||typeof signature!=='string'||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature)||!signal||typeof signal.aborted!=='boolean')throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);const pool=this.#access.pool,installation=this.#access.installationId;if(!pool||!this.#origin)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const connect=pool.connect,broker=this.#streamBroker??(this.#streamBroker=new NativeFirstReceiveBroker(randomUUID(),this.#now));let operationExpires=Infinity;let settledRejection:AuthFailure|null=null;let effect=false,committed=false,replayed=false,last=-Infinity;const clock=()=>{if(this.#access.pool!==pool||pool.connect!==connect||this.#access.installationId!==installation||this.#streamBroker!==broker||signal.aborted)throw new AuthFailure(effect||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_CONTEXT_CHANGED',effect||committed?503:409);return this.#now();};const check=()=>{const at=clock();if(!Number.isFinite(at)||at<last||at<Date.parse(proof.issuedAt)||at>=Math.min(Date.parse(proof.expiresAt),operationExpires))throw new AuthFailure(effect||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',effect||committed?503:412);last=at;};
  try{check();const cap=await withNativeReceivePhaseTransaction(pool,sessionId,credential,body,proof,async(owned,current,consumed,rejected)=>{check();if(current.window.snapshot.installationId!==installation)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);if(current.profileOrigin!==this.#origin)throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);if(rejected){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}return this.#store.readDeniedPhase(owned,signature,check);}if(!consumed&&!['OPENED','STREAMING','OFFERED','ARMED'].includes(current.phase))throw new AuthFailure('NATIVE_RECEIVE_IN_FLIGHT',409);let lease:object;try{lease=await verifyNativeReceivePhaseProof(owned,{window:current.window,session:current.session,challenge:current.challenge,proof,signature,body,publicKeySpki:current.publicKeySpki},clock);}catch(error){const failure=nativeReceiveClassifyFailure(error);if(!consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}const rejection=await this.#store.recordPhaseDenial(owned,signature,check);if(rejection!==null){effect=true;return rejection;}}if(consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){replayed=true;return this.#store.recordConsumedConflict(owned,signature,check);}throw error;}check();if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkBoundCurrent(owned,lease,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}if(consumed){replayed=true;return this.#store.readConsumedPhase(owned,lease,check,expiresAt=>{operationExpires=Math.min(operationExpires,expiresAt);check();});}effect=true;return this.#store.consumeClose(owned,lease,broker.instanceId,check);},clock,true);committed=true;check();settledRejection=NativeFirstReceiveStore.takeCommittedPhaseRejection(cap,last);if(settledRejection)throw settledRejection;if(replayed)return receiveCopy(cap);const state=broker.finishClose(cap,()=>{check();return last;});check();return state;}catch(error){if(settledRejection!==null&&error===settledRejection)throw settledRejection;if(effect||committed)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}
 }
 async nativeState(sessionId:string,credential:unknown,rawBody:unknown,rawProof:unknown,signature:unknown,signal?:AbortSignal){
  let body:any,proof:any;try{body=readNativeReceivePhaseBody('STATE',rawBody);proof=readReceiveProof(rawProof);}catch{throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);}if(!receiveUuid(sessionId)||typeof credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(credential))throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);if(proof.phase!=='STATE'||proof.receiveSessionRef?.id!==sessionId||typeof signature!=='string'||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature))throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);const pool=this.#access.pool,installation=this.#access.installationId;if(!pool||!this.#origin)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const connect=pool.connect;let operationExpires=Infinity;let settledRejection:AuthFailure|null=null;let effect=false,committed=false,last=-Infinity,state:any;const clock=()=>{if(this.#access.pool!==pool||pool.connect!==connect||this.#access.installationId!==installation||signal?.aborted)throw new AuthFailure(effect||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_CONTEXT_CHANGED',effect||committed?503:409);return this.#now();};const check=()=>{const at=clock();if(!Number.isFinite(at)||at<last||at<Date.parse(proof.issuedAt)||at>=Math.min(Date.parse(proof.expiresAt),operationExpires,state?Date.parse(state.expiresAt):Infinity))throw new AuthFailure(committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',committed?503:412);last=at;};
  try{check();const result=await withNativeReceivePhaseTransaction(pool,sessionId,credential,body,proof,async(owned,current,consumed,rejected)=>{check();if(current.window.snapshot.installationId!==installation)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);if(current.profileOrigin!==this.#origin)throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);if(rejected){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}return this.#store.readDeniedPhase(owned,signature,check);}if(!consumed&&!['OPENED','STREAMING','OFFERED','ARMED','BOUND','ATTEMPTED'].includes(current.phase))throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));let lease:object;try{lease=await verifyNativeReceivePhaseProof(owned,{window:current.window,session:current.session,challenge:current.challenge,proof,signature,body,publicKeySpki:current.publicKeySpki},clock);}catch(error){const failure=nativeReceiveClassifyFailure(error);if(!consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}const rejection=await this.#store.recordPhaseDenial(owned,signature,check);if(rejection!==null){effect=true;return rejection;}}if(consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){return this.#store.recordConsumedConflict(owned,signature,check);}throw error;}check();if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkBoundCurrent(owned,lease,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}if(consumed)return this.#store.readConsumedPhase(owned,lease,check,expiresAt=>{operationExpires=Math.min(operationExpires,expiresAt);check();});effect=true;state=await this.#store.consumeState(owned,lease,check);check();return state;},clock,true);committed=true;check();settledRejection=NativeFirstReceiveStore.takeCommittedPhaseRejection(result,last);if(settledRejection)throw settledRejection;const out=receiveCopy(result);check();return out;}catch(error){if(settledRejection!==null&&error===settledRejection)throw settledRejection;if(effect||committed)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}
 }
 async nativeArm(sessionId:string,credential:unknown,rawBody:unknown,rawProof:unknown,signature:unknown,signal?:AbortSignal){
  let body:any,proof:any;try{body=readNativeReceivePhaseBody('ARM',rawBody);proof=readReceiveProof(rawProof);}catch{throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);}if(!receiveUuid(sessionId)||typeof credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(credential))throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);if(proof.phase!=='ARM'||proof.receiveSessionRef?.id!==sessionId||typeof signature!=='string'||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature))throw new AuthFailure('NATIVE_RECEIVE_INPUT_INVALID',400);const pool=this.#access.pool,installation=this.#access.installationId,preparations=this.#preparations;if(!pool||!this.#origin||!preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const connect=pool.connect;let operationExpires=Infinity;let settledRejection:AuthFailure|null=null;let effect=false,committed=false,last=-Infinity,state:any;const clock=()=>{if(this.#preparations!==preparations||this.#access.pool!==pool||pool.connect!==connect||this.#access.installationId!==installation||signal?.aborted)throw new AuthFailure(effect||committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_CONTEXT_CHANGED',effect||committed?503:409);return this.#now();};const check=()=>{const at=clock();if(!Number.isFinite(at)||at<last||at<Date.parse(proof.issuedAt)||at>=Math.min(Date.parse(proof.expiresAt),operationExpires,state?Date.parse(state.snapshot.expiresAt):Infinity))throw new AuthFailure(committed?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',committed?503:412);last=at;};
  try{check();const result=await withNativeReceivePhaseTransaction(pool,sessionId,credential,body,proof,async(owned,current,consumed,rejected)=>{check();if(current.window.snapshot.installationId!==installation)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);if(current.profileOrigin!==this.#origin)throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);if(rejected){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}return this.#store.readDeniedPhase(owned,signature,check);}if(!consumed&&current.phase!=='OFFERED')throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));let lease:object;try{lease=await verifyNativeReceivePhaseProof(owned,{window:current.window,session:current.session,challenge:current.challenge,proof,signature,body,publicKeySpki:current.publicKeySpki},clock);}catch(error){const failure=nativeReceiveClassifyFailure(error);if(!consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkPhaseDenialCurrent(owned,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}const rejection=await this.#store.recordPhaseDenial(owned,signature,check);if(rejection!==null){effect=true;return rejection;}}if(consumed&&failure.safe&&failure.authCode==='NATIVE_RECEIVE_PURPOSE_DENIED'&&failure.status===403){return this.#store.recordConsumedConflict(owned,signature,check);}throw error;}check();if(['BOUND','ATTEMPTED'].includes(current.phase)){if(!this.#preparations)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const bound=await this.#store.checkBoundCurrent(owned,lease,this.#preparations,check);operationExpires=Math.min(operationExpires,Date.parse(bound.expiresAt));check();}if(consumed)return this.#store.readConsumedPhase(owned,lease,check,expiresAt=>{operationExpires=Math.min(operationExpires,expiresAt);check();});state=await this.#store.consumeArm(owned,lease,preparations,check);effect=true;check();return state;},clock,true);committed=true;check();settledRejection=NativeFirstReceiveStore.takeCommittedPhaseRejection(result,last);if(settledRejection)throw settledRejection;const out=receiveCopy(result);check();return out;}catch(error){if(settledRejection!==null&&error===settledRejection)throw settledRejection;if(effect||committed)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}
 }
 async sessionChallenge(sessionId:string,credential:unknown,raw:unknown,signal?:AbortSignal){
  let input:ReturnType<typeof readNativeReceiveChallengeInput>;try{input=readNativeReceiveChallengeInput(raw);}catch{throw new AuthFailure('INPUT_INVALID',400);}if(!receiveUuid(sessionId)||typeof credential!=='string'||!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(credential))throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);const pool=this.#access.pool;if(!pool||!this.#origin)throw nativeReceivePreEffectFailure(new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503));const connect=pool.connect;let db:import('pg').PoolClient|undefined,query:import('pg').PoolClient['query']|undefined,limit=Infinity,start=-Infinity,last=-Infinity,effect=false,commitEntered=false,complete=false;const check=()=>{if(this.#access.pool!==pool||pool.connect!==connect||db&&query&&db.query!==query)throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);if(signal?.aborted)throw new AuthFailure(effect?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_CONTEXT_CHANGED',effect?503:409);const at=this.#now();if(!Number.isFinite(at)||at<last||at<start||at>=limit)throw new AuthFailure(effect?'NATIVE_RECEIVE_OUTCOME_UNKNOWN':'NATIVE_RECEIVE_EXPIRED',effect?503:412);last=at;};
  try{check();db=await Reflect.apply(connect,pool,[]);query=db!.query;check();await db!.query('BEGIN');check();const current=await this.#store.authenticateSession(db!,sessionId,credential,check);check();if(current.window.snapshot.installationId!==this.#access.installationId||current.profileOrigin!==this.#origin)throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);start=Math.max(Date.parse(current.window.snapshot.issuedAt),Date.parse(current.session.snapshot.issuedAt));limit=Math.min(Date.parse(current.window.snapshot.expiresAt),Date.parse(current.session.snapshot.expiresAt));check();if(input.phase==='ACK')throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);effect=true;const result=await this.#store.issueSessionChallenge(db!,sessionId,credential,input,current,check);limit=Math.min(limit,Date.parse(result.snapshot.expiresAt));check();commitEntered=true;await db!.query('COMMIT');check();complete=true;return result;
  }catch(error){const failure=nativeReceiveClassifyFailure(error);if(effect||commitEntered||!failure.safe)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);if(failure.authCode!==null)throw nativeReceivePreEffectFailure(error);if(failure.sqlAuth)throw new AuthFailure('NATIVE_RECEIVE_AUTH_REQUIRED',401);throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);
  }finally{if(db)try{db.release(!complete);}catch{throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);}}
 }
 async signingCurrent(token:string,pid:string,wid:string){
  if(!receiveUuid(pid)||!receiveUuid(wid))throw new AuthFailure('INPUT_INVALID',400);let finalCheck:(()=>void)|null=null;const result=await this.#access.authenticated(token,null,async(db,actor)=>{
   const session=actor.authSession,reauth=actor.reauthUntil;if(!session||!receiveUuid(session.id))throw new AuthFailure('AUTH_REQUIRED',401);if(!(reauth instanceof Date)||!Number.isFinite(reauth.getTime()))throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);const reauthAt=reauth.getTime(),identity=[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt],query=db.query;let active=true,last=-Infinity,deadline=Math.min(reauthAt,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));const check=()=>{const at=this.#now();if(db.query!==query||actor.authSession!==session||actor.reauthUntil!==reauth||reauth.getTime()!==reauthAt||!receiveSame(identity,[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt]))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);if(!Number.isFinite(at)||!Number.isFinite(deadline)||at<last||at>=deadline)throw new AuthFailure('NATIVE_RECEIVE_EXPIRED',412);last=at;};finalCheck=check;const owned=Object.freeze({query:async(sql:string,args?:unknown[])=>{if(!active||!sql.startsWith('SELECT'))throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);check();const value=await Reflect.apply(query,db,[sql,args]);check();return value;}}) as Parameters<ProjectRegistrationReads['nativePreparationRecord']>[0];
   try{check();const member=await projectMember(owned,actor,pid,true);check();if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NOT_FOUND',404);const control=(await owned.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[pid])).rows[0];check();if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||!Number.isSafeInteger(Number(control.generation))||Number(control.generation)<1)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:Number(control.generation),operation:'readNativePreparationAuthority',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};const policy=await authorizeMaterial(owned,actor,command,true);check();if(policy.approvalRequired)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);deadline=Math.min(deadline,policy.validUntil);check();
    const value=await this.#store.readSigningCurrent(owned,actor,pid,wid,check);check();const w=value.window.snapshot;if(w.installationId!==this.#access.installationId||w.human.controlGeneration!==Number(control.generation)||!receiveSame(w.policyRef,policy.ref))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);deadline=Math.min(deadline,Date.parse(value.expiresAt));check();const registration=await new ProjectRegistrationReads(this.#access.installationId).nativePreparationRecord(owned,actor,pid,w.registrationRef.id,null);check();if(!receiveSame(registration.registrationRef,w.registrationRef)||!receiveSame(registration.connectorRef,w.connectorRef)||registration.hostPublicKeyFingerprint!==w.hostPublicKeyFingerprint)throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);deadline=Math.min(deadline,Date.parse(registration.expiresAt));check();value.registration.observedAt=registration.observedAt;value.observedAt=registration.observedAt;value.registration.expiresAt=new Date(deadline).toISOString();value.expiresAt=value.registration.expiresAt;const out=readReceiveSigningCurrent(value);check();return out;
   }finally{active=false;}
  });if(finalCheck===null)denied();(finalCheck as ()=>void)();return result;
 }
 /** 역사 원문 기한과 현재 조회 권한의 기한을 분리한다. COMMIT/release 뒤에도 본문 반환 전 재검산한다. */
 async phaseSigningCurrent(token:string,csrf:string,pid:string,wid:string,raw:unknown){
  const input=readNativeReceivePhaseCurrentInput(raw);if(!receiveUuid(pid)||!receiveUuid(wid))throw new AuthFailure('INPUT_INVALID',400);let finalCheck:(()=>void)|null=null;
  const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{const session=actor.authSession,reauth=actor.reauthUntil;if(!session||!receiveUuid(session.id))throw new AuthFailure('AUTH_REQUIRED',401);if(!(reauth instanceof Date)||!Number.isFinite(reauth.getTime()))throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);const reauthAt=reauth.getTime(),query=db.query,tuple=[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt],started=performance.now();let deadline=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt),reauthAt,this.#now()+10000),last=-Infinity;const check=()=>{const at=this.#now(),mono=performance.now();if(db.query!==query||actor.authSession!==session||actor.reauthUntil!==reauth||reauth.getTime()!==reauthAt||!receiveSame(tuple,[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt])||!Number.isFinite(at)||!Number.isFinite(deadline)||!Number.isFinite(mono)||mono<started||mono-started>=10000||at<last||at>=deadline)throw new AuthFailure('NATIVE_RECEIVE_EXPIRED',412);last=at;};finalCheck=check;check();const member=await projectMember(db,actor,pid,true);check();if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[pid])).rows[0];check();if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||!Number.isSafeInteger(Number(control.generation))||Number(control.generation)<1)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
   const request:ProjectCommand={schemaVersion:1,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:Number(control.generation),operation:'readNativePreparationAuthority',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};const policy=await authorizeMaterial(db,actor,request,true);check();if(policy.approvalRequired)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);deadline=Math.min(deadline,policy.validUntil);check();const out=await this.#store.readPhaseSigningCurrent(db,actor,pid,wid,input,this.#access.installationId,Number(control.generation),check);check();deadline=Math.min(deadline,Date.parse(out.expiresAt));check();
   if(out.value.registration.phase==='ARM'||['BOUND','ATTEMPTED'].includes(out.value.registration.headPhase)){if(this.#preparations===null)throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);const source=await this.#store.checkPhaseSigningSources(db,out,this.#preparations,check);check();deadline=Math.min(deadline,Date.parse(source.expiresAt));check();}if(Date.parse(out.value.expiresAt)>deadline){out.value.expiresAt=new Date(deadline).toISOString();out.value.registration.expiresAt=out.value.expiresAt;}
   return out.value;
  });if(finalCheck===null)denied();(finalCheck as ()=>void)();return result;
 }
 async readHuman(token:string,pid:string,kind:'ACTIVE'|'STATE'|'OFFER',target:unknown){
  if(!receiveUuid(pid)||!['ACTIVE','STATE','OFFER'].includes(kind)||(kind==='ACTIVE'?!receiveRef(target):!receiveUuid(target)))throw new AuthFailure('INPUT_INVALID',400);
  let finalCheck:(()=>void)|null=null;
  const result=await this.#access.authenticated(token,null,async(db,actor)=>{
   const session=actor.authSession;if(!session||!receiveUuid(session.id))throw new AuthFailure('AUTH_REQUIRED',401);const query=db.query,tuple=[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt];let limit=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)),last=-Infinity;
   const check=()=>{const at=this.#now();if(db.query!==query||actor.authSession!==session||!receiveSame(tuple,[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt])||!Number.isFinite(at)||!Number.isFinite(limit)||at<last||at>=limit)throw new AuthFailure('NATIVE_RECEIVE_EXPIRED',412);last=at;};finalCheck=check;check();
   const member=await projectMember(db,actor,pid,true);check();if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
   const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[pid])).rows[0];check();if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||!Number.isSafeInteger(Number(control.generation))||Number(control.generation)<1)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
   const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:Number(control.generation),operation:kind==='OFFER'?'readNativeReceiveOffer':'readNativeReceiveWindow',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
   const policy=await authorizeMaterial(db,actor,command,true);check();if(policy.approvalRequired)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);limit=Math.min(limit,policy.validUntil);check();
   const out=await this.#store.readHuman(db,actor,pid,kind,target,this.#access.installationId,Number(control.generation),check);check();limit=Math.min(limit,Date.parse(out.expiresAt));check();
   if(kind==='STATE'&&['BOUND','ATTEMPTED'].includes(out.value.phase)&&out.value.current.reason==='OWNER_UNAVAILABLE'&&this.#preparations!==null){
    try{const current=await Reflect.apply(ProjectNativePreparations.prototype.receiveWindowMetadataCurrent,this.#preparations,[db,actor,pid,target,limit,check]);check();if(!receiveSame(current.windowRef,out.value.windowRef)||!receiveSame(current.bindingRef,out.value.bindingRef)||!receiveSame(current.current.authorityRef,out.value.authorityRef)||current.current.phase!=='RESERVED')denied();limit=Math.min(limit,Date.parse(current.expiresAt));check();out.value.current={checkedAt:current.current.checkedAt,usable:true,reason:'CURRENT'};out.value.observedAt=current.current.checkedAt;out.value.expiresAt=new Date(Math.min(Date.parse(out.value.expiresAt),limit)).toISOString();}
    catch(error){const failure=nativeReceiveClassifyFailure(error);if(!failure.safe||failure.authCode===null||!['NATIVE_SOURCE_UNAVAILABLE','NATIVE_CONTEXT_CHANGED','NATIVE_SOURCE_EXPIRED'].includes(failure.authCode))throw error;out.value.current={...out.value.current,usable:false,reason:failure.authCode==='NATIVE_SOURCE_EXPIRED'?'EXPIRED':'OWNER_UNAVAILABLE'};}
   }
   check();return out.value;
  });if(finalCheck===null)denied();(finalCheck as ()=>void)();return result;
 }
 async readProfile(token:string,pid:string){
  if(!receiveUuid(pid))throw new AuthFailure('INPUT_INVALID',400);let finalCheck:(()=>void)|null=null;
  const result=await this.#access.authenticated(token,null,async(db,actor)=>{
   const session=actor.authSession;if(!session||!receiveUuid(session.id))throw new AuthFailure('AUTH_REQUIRED',401);const tuple=[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt];let limit=Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)),last=-Infinity;
   const check=()=>{const at=this.#now();if(actor.authSession!==session||!receiveSame(tuple,[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt])||!Number.isFinite(at)||!Number.isFinite(limit)||at<last||at>=limit)throw new AuthFailure('NATIVE_RECEIVE_EXPIRED',412);last=at;};finalCheck=check;check();
   const member=await projectMember(db,actor,pid,true);check();if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
   const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[pid])).rows[0];check();if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||!Number.isSafeInteger(Number(control.generation))||Number(control.generation)<1)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
   const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:Number(control.generation),operation:'readNativeChannelProfile',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
   const policy=await authorizeMaterial(db,actor,command,true);check();if(policy.approvalRequired)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);limit=Math.min(limit,policy.validUntil);check();
   const value=await new NativeChannelProfileRepository(this.#now).readCurrent(db,actor,pid,check);check();if(value.profile.snapshot.installationId!==this.#access.installationId)denied();limit=Math.min(limit,Date.parse(value.profile.snapshot.expiresAt));check();return value;
  });if(finalCheck===null)denied();(finalCheck as ()=>void)();return result;
 }
 async openChallenge(token:string,csrf:string,pid:string,wid:string,raw:unknown){
  if(!receiveUuid(pid)||!receiveUuid(wid)||!receiveRecord(raw,['schemaVersion','requestId'])||raw.schemaVersion!==1||!receiveUuid(raw.requestId))throw new AuthFailure('INPUT_INVALID',400);const request=receiveCopy(raw);let effectEntered=false,finalCheck:(()=>void)|null=null;
  try{const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
   const session=actor.authSession,reauth=actor.reauthUntil;if(!session||!receiveUuid(session.id))throw new AuthFailure('AUTH_REQUIRED',401);if(!(reauth instanceof Date)||!Number.isFinite(reauth.getTime()))throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);const reauthAt=reauth.getTime(),tuple=[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt];let deadline=Math.min(reauthAt,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)),last=-Infinity;
   const check=()=>{const at=this.#now();if(actor.authSession!==session||actor.reauthUntil!==reauth||reauth.getTime()!==reauthAt||!receiveSame(tuple,[actor.actorId,actor.clientId,actor.credentialGeneration,session.id,session.idleExpiresAt,session.absoluteExpiresAt]))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);if(!Number.isFinite(at)||!Number.isFinite(deadline)||at<last||at>=deadline)throw new AuthFailure('NATIVE_RECEIVE_EXPIRED',412);last=at;};finalCheck=check;check();
   const member=await projectMember(db,actor,pid,true);check();if(member.participation!=='OWNER'||member.archived_at)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
   const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[pid])).rows[0];check();if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||!Number.isSafeInteger(Number(control.generation))||Number(control.generation)<1)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);
   const authority:ProjectCommand={schemaVersion:1,projectId:pid,commandId:request.requestId,clientId:actor.clientId,controlGeneration:Number(control.generation),operation:'prepareNativeReceiveWindow',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
   const policy=await authorizeMaterial(db,actor,authority,true);check();if(policy.approvalRequired)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);deadline=Math.min(deadline,policy.validUntil);check();effectEntered=true;
   const challenge=await this.#store.issueOpenChallenge(db,actor,pid,wid,request,policy.ref,Number(control.generation),check);deadline=Math.min(deadline,Date.parse(challenge.snapshot.expiresAt));check();return challenge;
  });if(finalCheck===null)denied();(finalCheck as ()=>void)();return result;}catch(error){if(effectEntered)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}
 }
 async command(token:string,csrf:string,raw:unknown){
  const command=readNativeReceiveHumanCommand(raw) as ProjectCommand;
  let effectEntered=false,finalCheck:(()=>void)|null=null;try{const outcome=await this.#access.authenticated(token,csrf,async(db,actor)=>{
   const reauth=actor.reauthUntil,reauthAt=reauth instanceof Date?reauth.getTime():NaN;const recent=()=>{if(!(reauth instanceof Date)||!Number.isFinite(reauthAt)||actor.reauthUntil!==reauth||reauth.getTime()!==reauthAt||this.#now()>=reauthAt)throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);};recent();
   await currentGeneralProjectController(db,actor,command);recent();const policy=await authorizeMaterial(db,actor,command,true);recent();if(policy.approvalRequired)throw new AuthFailure('NATIVE_RECEIVE_PURPOSE_DENIED',403);
   let operationExpiry=Math.min(policy.validUntil,reauthAt);const check=()=>{recent();const session=actor.authSession,at=this.#now(),limit=session?Math.min(operationExpiry,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt)):NaN;if(!session||!receiveUuid(session.id)||!Number.isFinite(at)||!Number.isFinite(limit)||at>=limit)throw new AuthFailure('NATIVE_RECEIVE_EXPIRED',412);};finalCheck=check;check();
   const previous=await projectReplay(db,actor,command);check();
   if(previous!==undefined){const proof=await db.query('SELECT anvil.native_receive_command_replay($1,$2,$3::jsonb) AS result',[command.projectId,actor.authSession!.id,receiveHumanCommandCanonical(command)]);check();if(proof.rowCount!==1||proof.rows.length!==1||!receiveRecord(proof.rows[0],['result'])||!receiveSame(proof.rows[0].result,previous))denied();const value=JSON.parse(receiveResultCanonical(previous));if(value.commandId!==command.commandId||value.projectId!==command.projectId)denied();return value;}
   return withNativeReceiveCommand(db,actor,command,operationExpiry,async(fixed,scopeCheck,owned)=>{
    const materialDb=owned as typeof db;
    if(fixed.operation==='prepareNativeReceiveWindow'){
     const candidate=await this.#store.prepareWindow(materialDb,actor,fixed,policy.ref,this.#access.installationId,operationExpiry,scopeCheck);operationExpiry=Math.min(operationExpiry,Date.parse(candidate.snapshot.expiresAt));scopeCheck.tighten(operationExpiry);
     effectEntered=true;const persisted=await persistProjectReceipt(materialDb,actor,fixed,candidate.ref,{status:'NATIVE_RECEIVE_WINDOW_PREPARED',window:candidate},policy.ref,'EXPLICIT_NATIVE_RECEIVE_WINDOW');scopeCheck();await this.#store.insertWindow(materialDb,candidate,actor.authSession!.id,scopeCheck,this.#preparations?.nativeReceiveAuthorityVersion()??1);return JSON.parse(receiveResultCanonical(persisted.result));
    }
    const view=await this.#store.readCommandWindow(materialDb,actor,fixed,scopeCheck);if(!receiveSame(view.window.snapshot.policyRef,policy.ref))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);operationExpiry=Math.min(operationExpiry,Date.parse(view.window.snapshot.expiresAt));scopeCheck.tighten(operationExpiry);
    if(fixed.operation==='offerNativeReceiveCommand'){
     if(view.state.phase!=='STREAMING')throw new AuthFailure('NATIVE_RECEIVE_CONFLICT',409);const original=fixed.payload.command;if(!receiveSame(original.payload.registrationRef,view.window.snapshot.registrationRef)||!receiveSame(original.payload.expectedWriterHeadRef,view.window.snapshot.writerHeadRef))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);
     const preparations=this.#preparations;if(!preparations)throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);
     const current=await Reflect.apply(ProjectNativePreparations.prototype.receiveOfferCurrent,preparations,[materialDb,actor,original,operationExpiry,scopeCheck]);scopeCheck();
     if(!receiveSame(current.writerHead.ref,view.window.snapshot.writerHeadRef)||current.current.hostPublicKeyFingerprint!==view.window.snapshot.hostPublicKeyFingerprint||!receiveSame(current.current.registrationRef,view.window.snapshot.registrationRef))throw new AuthFailure('NATIVE_RECEIVE_CONTEXT_CHANGED',409);
     // 원 native channel profile과 새 수신 profile은 다른 목적이다. 동일 ref로 cast하지 않는다.
     operationExpiry=Math.min(operationExpiry,Date.parse(current.expiresAt));scopeCheck.tighten(operationExpiry);const candidate=await this.#store.prepareOffer(materialDb,actor,fixed,operationExpiry,scopeCheck);operationExpiry=Math.min(operationExpiry,Date.parse(candidate.snapshot.expiresAt));scopeCheck.tighten(operationExpiry);
     effectEntered=true;const persisted=await persistProjectReceipt(materialDb,actor,fixed,candidate.ref,{status:'NATIVE_RECEIVE_OFFERED',offer:candidate},policy.ref,'EXPLICIT_NATIVE_RECEIVE_OFFER');scopeCheck();await this.#store.insertOffer(materialDb,candidate,actor.authSession!.id,scopeCheck);return JSON.parse(receiveResultCanonical(persisted.result));
    }
    if(!['WINDOW_PREPARED','OPENED','STREAMING','OFFERED','ARMED'].includes(view.state.phase))throw new AuthFailure('NATIVE_RECEIVE_IN_FLIGHT',409);const candidate=await this.#store.prepareClose(materialDb,actor,fixed,scopeCheck);operationExpiry=Math.min(operationExpiry,Date.parse(candidate.state.expiresAt));scopeCheck.tighten(operationExpiry);
    effectEntered=true;const persisted=await persistProjectReceipt(materialDb,actor,fixed,candidate.terminal.ref,{status:'NATIVE_RECEIVE_CLOSED',state:candidate.state},policy.ref,'EXPLICIT_NATIVE_RECEIVE_CLOSE');scopeCheck();await this.#store.insertClose(materialDb,fixed.projectId,candidate,actor.authSession!.id,scopeCheck);return JSON.parse(receiveResultCanonical(persisted.result));
   },this.#now);
  });if(finalCheck===null)denied();(finalCheck as ()=>void)();return outcome;}catch(error){if(effectEntered)throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);throw nativeReceivePreEffectFailure(error);}
 }
}
