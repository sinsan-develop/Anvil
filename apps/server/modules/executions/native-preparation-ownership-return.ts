import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {nativeHash,nativeSame,readNativeConsumeReceipt} from '../../../../contracts/runtime/native-preparation-authority-v1.ts';
import {readNativeReturnAuthority,readNativeOwnershipRequest,readNativeOwnershipAnchor,matchNativeOwnershipResponse,readNativeOwnershipResult,type NativeReturnAuthority} from '../../../../contracts/runtime/native-preparation-ownership-return-v1.ts';
import {readOwnershipEventV1,ownershipRequestFromEventV1,checkOwnershipEventAppendV1,advanceOwnershipHeadV1,type OwnershipEventV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {verifyOwnershipObservationProofV1} from './ownership-observation-proof.ts';
import {AuthFailure} from '../access/repository.ts';

const fail=(code='NATIVE_CONTEXT_CHANGED',status=412):never=>{throw new AuthFailure(code,status);};
const firstRef=(v:unknown)=>refV1(v)&&v.version===1;
const wrapped=<T>(id:string,snapshot:T)=>({ref:{id,version:1,contentHash:nativeHash(snapshot)},snapshot});
function ids(value:readonly string[],count:number){if(value.length!==count||!value.every(uuidV1)||new Set(value).size!==count)fail('NATIVE_SOURCE_UNAVAILABLE',503);return value;}
/** 서버가 원 authority/factory로 조회한 근거만 받는다. HTTP process 후보는 이 포트의 입력이 아니다. */
export interface NativeOwnershipBasis{
 authorityRef:RuntimeRefV1;consumeReceiptRef:RuntimeRefV1;nativeFactoryRef:RuntimeRefV1;registrationRef:RuntimeRefV1;sourceScopeHash:string;
 observerRef:RuntimeRefV1;runId:string;processGeneration:number;workerHash:string;checkedAt:string;expiresAt:string;
}
export function readNativeOwnershipBasis(value:unknown,a:NativeReturnAuthority,receipt:ReturnType<typeof readNativeConsumeReceipt>,now:number):NativeOwnershipBasis{
 if(!recordV1(value,['authorityRef','consumeReceiptRef','nativeFactoryRef','registrationRef','sourceScopeHash','observerRef','runId','processGeneration','workerHash','checkedAt','expiresAt'])||!refV1(value.observerRef)||!uuidV1(value.runId)||!Number.isSafeInteger(value.processGeneration)||value.processGeneration<1||!hashV1(value.workerHash)||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>now||now-Date.parse(value.checkedAt)>1000||Date.parse(value.expiresAt)<=now)return fail();
 if(!nativeSame(value.authorityRef,{id:a.authorityId,version:1,contentHash:nativeHash(a)})||!nativeSame(value.consumeReceiptRef,receipt.ref)||!nativeSame(value.nativeFactoryRef,a.scope.nativeFactoryRef)||!nativeSame(value.registrationRef,a.scope.registrationRef)||value.sourceScopeHash!==a.scope.sourceScopeHash)fail();
 return cloneV1(value) as NativeOwnershipBasis;
}
interface RequestPlanInput{authority:unknown;consumeReceipt:unknown;consumeRecordRef:RuntimeRefV1;input:unknown;basis:unknown;nowMs:number;expiresAt:string;nonce:string;ids:readonly string[]}
/** 순수 저장 계획. 인증·현재성·잠금·COMMIT은 호출 서버 거래에서 따로 수행한다. */
export function planNativeOwnershipRequest(value:RequestPlanInput){
 const a=readNativeReturnAuthority(value.authority),receipt=readNativeConsumeReceipt(value.consumeReceipt),input=readNativeOwnershipRequest(value.input),now=value.nowMs;
 if(!Number.isSafeInteger(now)||!isoV1(value.expiresAt)||!firstRef(value.consumeRecordRef))fail();
 const b=readNativeOwnershipBasis(value.basis,a,receipt,now),ar={id:a.authorityId,version:1,contentHash:nativeHash(a)},r=receipt.snapshot;
 if(!nativeSame(input.authorityRef,ar)||!nativeSame(r.authorityRef,ar)||!nativeSame(r.preparationRef,a.scope.preparationRef)||!nativeSame(r.writerHeadRef,a.scope.writerHeadRef)||!nativeSame(input.consumeReceiptRef,receipt.ref)||!nativeSame(input.localAttemptRef,r.localAttemptRef)||input.processRef.runId!==b.runId||input.processRef.generation!==b.processGeneration||input.processRef.executableHash!==b.workerHash||now<Date.parse(r.at)||now<Date.parse(a.issuedAt))fail();
 const deadline=Math.min(now+10000,Date.parse(a.expiresAt),Date.parse(r.expiresAt),Date.parse(b.expiresAt),Date.parse(value.expiresAt));
 if(!Number.isFinite(deadline)||deadline<=now)fail('NATIVE_SOURCE_EXPIRED');
 const [bindingId,anchorId,requestId]=ids(value.ids,3),at=new Date(now).toISOString(),expiresAt=new Date(deadline).toISOString();
 const scope={installationId:a.scope.installationId,projectId:a.scope.projectId,executionId:a.scope.executionId,executionGeneration:a.scope.executionGeneration};
 const anchor=wrapped(anchorId!,readNativeOwnershipAnchor({schemaVersion:2,purpose:'PROCESS_OWNERSHIP_ANCHOR',transport:'NATIVE_PREPARATION_RETURN',scope:{...scope,executorRegistrationRef:a.scope.registrationRef},parent:{authorityRef:ar,consumeReceiptRef:receipt.ref,localAttemptRef:input.localAttemptRef},processRef:input.processRef,observerRef:b.observerRef,recordedAt:at,expiresAt,state:'BOUND',fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false}));
 const request={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',...scope,registrationRef:a.scope.registrationRef,publicKeyFingerprint:a.scope.hostPublicKeyFingerprint,observerRef:b.observerRef,anchorRef:anchor.ref,preparationRef:a.scope.preparationRef,phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:value.nonce,requestedAt:at,expiresAt};
 // native 최초 이벤트의 부모는 별도 binding이다. 과거 PREPARATION_GRANTED를 만들어내지 않는다.
 const requestEvent=readOwnershipEventV1(wrapped(requestId!,{schemaVersion:1,purpose:'OWNERSHIP_EVENT',scope,sequence:1,previousRef:null,kind:'OBSERVATION_REQUESTED',subject:a.subject,registrationRef:a.scope.registrationRef,...a.parent,payload:{request,processRef:input.processRef},at,expiresAt}));
 const binding=wrapped(bindingId!,{schemaVersion:1,purpose:'NATIVE_PREPARATION_OWNERSHIP_BINDING',scope,authorityRef:ar,consumeRecordRef:value.consumeRecordRef,consumeReceiptRef:receipt.ref,localAttemptRef:input.localAttemptRef,requestId:input.requestId,requestInputHash:nativeHash(input),requestInput:input,requestRef:requestEvent.ref,candidateAnchorRef:anchor.ref,basis:b,at,expiresAt});
 const response=matchNativeOwnershipResponse({bindingRef:binding.ref,request:ownershipRequestFromEventV1(requestEvent),candidateAnchor:anchor},input,a);
 return {authority:a,consumeReceipt:receipt,consumeRecordRef:cloneV1(value.consumeRecordRef),input,basis:b,requestEvent,binding,response};
}
export type NativeOwnershipRequestPlan=ReturnType<typeof planNativeOwnershipRequest>;
function checkedPlan(value:NativeOwnershipRequestPlan){
 const p=planNativeOwnershipRequest({authority:value.authority,consumeReceipt:value.consumeReceipt,consumeRecordRef:value.consumeRecordRef,input:value.input,basis:value.basis,nowMs:Date.parse(value.requestEvent.snapshot.at),expiresAt:value.requestEvent.snapshot.expiresAt,nonce:value.response.request.nonce,ids:[value.binding.ref.id,value.response.candidateAnchor.ref.id,value.requestEvent.ref.id]});
 if(!nativeSame(p,value))fail();return p;
}
/** 원 서명/nonce 및 기존 accepted/adopted/head 검산 재사용. 반환값은 아직 COMMIT 증거가 아니다. */
export function planNativeOwnershipAcceptance(value:{request:NativeOwnershipRequestPlan;input:unknown;spki:string;nowMs:number;ids:readonly string[]}){
 const p=checkedPlan(value.request),input=readNativeOwnershipResult(value.input),now=value.nowMs;
 if(!nativeSame(input.authorityRef,p.input.authorityRef)||!nativeSame(input.consumeReceiptRef,p.input.consumeReceiptRef)||!nativeSame(input.localAttemptRef,p.input.localAttemptRef)||!nativeSame(input.bindingRef,p.binding.ref))fail();
 if(!Number.isSafeInteger(now)||now>=Date.parse(p.response.request.expiresAt))fail('NATIVE_SOURCE_EXPIRED');
 const proof=verifyOwnershipObservationProofV1(value.spki,input.signature,input.report,p.response.request,input.facts,p.input.processRef,now);
 const [observationId,acceptedId,adoptedId,headId,receiptId]=ids(value.ids,5),at=new Date(now).toISOString();
 const observation=wrapped(observationId!,{schemaVersion:1,purpose:'OWNERSHIP_OBSERVATION_RECORD',report:proof.report,signature:input.signature,facts:proof.facts});
 const event=(id:string,kind:OwnershipEventV1['snapshot']['kind'],payload:Record<string,unknown>,previous:OwnershipEventV1)=>checkOwnershipEventAppendV1(previous,wrapped(id,{...previous.snapshot,sequence:previous.snapshot.sequence+1,previousRef:previous.ref,kind,payload,at}),now);
 const accepted=event(acceptedId!,'OBSERVATION_ACCEPTED',{requestRef:p.requestEvent.ref,observationRef:observation.ref,phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,anchorRef:p.response.candidateAnchor.ref,preparationRef:p.authority.scope.preparationRef},p.requestEvent);
 const adopted=event(adoptedId!,'ANCHOR_ADOPTED',{anchorRef:p.response.candidateAnchor.ref,preparationRef:p.authority.scope.preparationRef,observationEventRef:accepted.ref,expectedHeadRef:null},accepted);
 const head=advanceOwnershipHeadV1(null,adopted,headId!,now),receipt=wrapped(receiptId!,{schemaVersion:1,purpose:'NATIVE_PREPARATION_OWNERSHIP_RECEIPT',bindingRef:p.binding.ref,packetHash:nativeHash(input),observationRef:observation.ref,headRef:head.ref,acceptedAt:at,executionAuthorized:false,dispatchPerformed:false});
 return {observation,events:[accepted,adopted],head,receipt,response:{receiptRef:receipt.ref,observationRef:observation.ref,headRef:head.ref,acceptedAt:at,executionAuthorized:false as const,dispatchPerformed:false as const}};
}
