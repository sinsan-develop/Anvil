import {types} from 'node:util';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from './validation-v1.ts';
import {nativeBytes,nativeHash,nativeInvalid,nativeSame,readNativeAuthority,type NativeAuthority} from './native-preparation-authority-v1.ts';
import {readOwnershipProcessRefV1,readOwnershipObservationRequestV1,readOwnershipObservationV1,matchOwnershipObservationFactsV1,type OwnershipObservationRequestV1,type OwnershipObservationV1,type OwnershipObservationFactsV1,type OwnershipProcessRefV1} from './ownership-observation-v1.ts';

export const nativeReturnOperations=Object.freeze(['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION','RETURN_NATIVE_PREPARATION_OWNERSHIP'] as const);
export interface NativeReturnAuthority extends Omit<NativeAuthority,'schemaVersion'|'allowedOperations'>{schemaVersion:2;allowedOperations:typeof nativeReturnOperations}
export type NativePreparationAuthority=NativeAuthority|NativeReturnAuthority;
const authorityFields=['schemaVersion','purpose','authorityId','credentialId','credentialGeneration','scope','subject','parent','policyRef','channelProfileRef','allowedOperations','issuedAt','expiresAt','codingAgentExecutionAuthorized','agentDispatchPerformed'];
function dataSnapshot(value:unknown,keys:readonly string[]):Record<string,any>{
 const seen=new Set<object>();let objects=0;
 const data=(v:unknown,depth:number):void=>{
  if(v===null||typeof v!=='object')return;
  if(types.isProxy(v)||depth>16||++objects>4096||seen.has(v))return nativeInvalid();
  seen.add(v);
  for(const d of Object.values(Object.getOwnPropertyDescriptors(v))){if(!('value'in d))return nativeInvalid();data(d.value,depth+1);}
  seen.delete(v);
 };
 data(value,0);if(!recordV1(value,keys))return nativeInvalid();
 return cloneV1(value);
}
function returnSnapshot(v:Record<string,any>):NativeReturnAuthority{
 if(v.schemaVersion!==2||!nativeSame(v.allowedOperations,nativeReturnOperations))return nativeInvalid();
 readNativeAuthority({...v,schemaVersion:1,allowedOperations:['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION']});
 return v as NativeReturnAuthority;
}
/** v1 판독기는 그대로다. 신규 v2를 선택한 호출부만 이 진입점을 사용한다. */
export function readNativeReturnAuthority(value:unknown):NativeReturnAuthority{
 return returnSnapshot(dataSnapshot(value,authorityFields));
}
export function readNativePreparationAuthority(value:unknown):NativePreparationAuthority{
 const v=dataSnapshot(value,authorityFields);
 return v.schemaVersion===2?returnSnapshot(v):readNativeAuthority(v);
}
export interface NativeOwnershipRequest{
 schemaVersion:1;requestId:string;authorityRef:RuntimeRefV1;consumeReceiptRef:RuntimeRefV1;localAttemptRef:RuntimeRefV1;processRef:OwnershipProcessRefV1;
}
export function readNativeOwnershipRequest(value:unknown):NativeOwnershipRequest{
 value=dataSnapshot(value,['schemaVersion','requestId','authorityRef','consumeReceiptRef','localAttemptRef','processRef']);
 if(!recordV1(value,['schemaVersion','requestId','authorityRef','consumeReceiptRef','localAttemptRef','processRef'])||value.schemaVersion!==1||!uuidV1(value.requestId)||!['authorityRef','consumeReceiptRef','localAttemptRef'].every(k=>refV1(value[k])&&value[k].version===1)||nativeBytes(value)>16384)return nativeInvalid();
 readOwnershipProcessRefV1(value.processRef);
 return cloneV1(value) as NativeOwnershipRequest;
}
export interface NativeOwnershipAnchor{
 schemaVersion:2;purpose:'PROCESS_OWNERSHIP_ANCHOR';transport:'NATIVE_PREPARATION_RETURN';
 scope:{installationId:string;projectId:string;executionId:string;executionGeneration:number;executorRegistrationRef:RuntimeRefV1};
 parent:{authorityRef:RuntimeRefV1;consumeReceiptRef:RuntimeRefV1;localAttemptRef:RuntimeRefV1};
 processRef:OwnershipProcessRefV1;observerRef:RuntimeRefV1;recordedAt:string;expiresAt:string;state:'BOUND';
 fileSandboxVerified:false;executionAuthorized:false;dispatchPerformed:false;
}
const firstRef=(v:unknown):v is RuntimeRefV1=>refV1(v)&&v.version===1;
export function readNativeOwnershipAnchor(value:unknown):NativeOwnershipAnchor{
 const v=dataSnapshot(value,['schemaVersion','purpose','transport','scope','parent','processRef','observerRef','recordedAt','expiresAt','state','fileSandboxVerified','executionAuthorized','dispatchPerformed']);
 if(v.schemaVersion!==2||v.purpose!=='PROCESS_OWNERSHIP_ANCHOR'||v.transport!=='NATIVE_PREPARATION_RETURN'||v.state!=='BOUND'||v.fileSandboxVerified!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false)return nativeInvalid();
 if(!recordV1(v.scope,['installationId','projectId','executionId','executionGeneration','executorRegistrationRef'])||!['installationId','projectId','executionId'].every(k=>uuidV1(v.scope[k]))||!Number.isSafeInteger(v.scope.executionGeneration)||v.scope.executionGeneration<1||!refV1(v.scope.executorRegistrationRef))return nativeInvalid();
 if(!recordV1(v.parent,['authorityRef','consumeReceiptRef','localAttemptRef'])||!Object.values(v.parent).every(firstRef)||!refV1(v.observerRef)||!isoV1(v.recordedAt)||!isoV1(v.expiresAt)||Date.parse(v.expiresAt)<=Date.parse(v.recordedAt)||Date.parse(v.expiresAt)-Date.parse(v.recordedAt)>10000)return nativeInvalid();
 readOwnershipProcessRefV1(v.processRef);return v as NativeOwnershipAnchor;
}
export interface NativeOwnershipResponse{bindingRef:RuntimeRefV1;request:OwnershipObservationRequestV1;candidateAnchor:{ref:RuntimeRefV1;snapshot:NativeOwnershipAnchor}}
/** 역사 응답의 형상/원 부모 검산이다. 신규 수용의 현재 기한과 등록 검산은 서버 거래가 담당한다. */
export function matchNativeOwnershipResponse(value:unknown,inputValue:unknown,authorityValue:unknown):NativeOwnershipResponse{
 const v=dataSnapshot(value,['bindingRef','request','candidateAnchor']),input=readNativeOwnershipRequest(inputValue),a=readNativeReturnAuthority(authorityValue);
 if(!firstRef(v.bindingRef)||!recordV1(v.candidateAnchor,['ref','snapshot'])||!firstRef(v.candidateAnchor.ref)||nativeBytes(v)>16384)return nativeInvalid();
 const anchor=readNativeOwnershipAnchor(v.candidateAnchor.snapshot),r=readOwnershipObservationRequestV1(v.request),ar={id:a.authorityId,version:1,contentHash:nativeHash(a)};
 if(!nativeSame(ar,input.authorityRef)||!nativeSame(anchor.parent,{authorityRef:ar,consumeReceiptRef:input.consumeReceiptRef,localAttemptRef:input.localAttemptRef})||!nativeSame(anchor.processRef,input.processRef)||v.candidateAnchor.ref.contentHash!==nativeHash(anchor))return nativeInvalid();
 if(!nativeSame(anchor.scope,{installationId:a.scope.installationId,projectId:a.scope.projectId,executionId:a.scope.executionId,executionGeneration:a.scope.executionGeneration,executorRegistrationRef:a.scope.registrationRef}))return nativeInvalid();
 if(r.phase!=='BOOTSTRAP_PREPARED'||r.expectedHeadRef!==null||r.installationId!==a.scope.installationId||r.projectId!==a.scope.projectId||r.executionId!==a.scope.executionId||r.executionGeneration!==a.scope.executionGeneration||!nativeSame(r.registrationRef,a.scope.registrationRef)||r.publicKeyFingerprint!==a.scope.hostPublicKeyFingerprint||!nativeSame(r.preparationRef,a.scope.preparationRef)||!nativeSame(r.anchorRef,v.candidateAnchor.ref)||!nativeSame(r.observerRef,anchor.observerRef)||r.requestedAt!==anchor.recordedAt||r.expiresAt!==anchor.expiresAt||Date.parse(r.requestedAt)<Date.parse(a.issuedAt)||Date.parse(r.expiresAt)>Date.parse(a.expiresAt))return nativeInvalid();
 return v as NativeOwnershipResponse;
}
export interface NativeOwnershipResult{
 schemaVersion:1;authorityRef:RuntimeRefV1;consumeReceiptRef:RuntimeRefV1;localAttemptRef:RuntimeRefV1;bindingRef:RuntimeRefV1;
 report:OwnershipObservationV1;facts:OwnershipObservationFactsV1;signature:string;
}
export function readNativeOwnershipResult(value:unknown):NativeOwnershipResult{
 const v=dataSnapshot(value,['schemaVersion','authorityRef','consumeReceiptRef','localAttemptRef','bindingRef','report','facts','signature']);
 if(v.schemaVersion!==1||!['authorityRef','consumeReceiptRef','localAttemptRef','bindingRef'].every(k=>firstRef(v[k]))||nativeBytes(v)>65536||typeof v.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(v.signature))return nativeInvalid();
 const sig=Buffer.from(v.signature,'base64url');if(sig.length!==64||sig.toString('base64url')!==v.signature)return nativeInvalid();
 const report=readOwnershipObservationV1(v.report);if(report.phase!=='BOOTSTRAP_PREPARED'||report.expectedHeadRef!==null)return nativeInvalid();
 matchOwnershipObservationFactsV1(report,v.facts,v.facts.processRef);return v as NativeOwnershipResult;
}
