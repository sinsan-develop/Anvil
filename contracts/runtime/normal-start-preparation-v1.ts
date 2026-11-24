import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from './validation-v1.ts';

/** 기존 native credential/delivery wire와 분리된 normal 준비 전용 형상이다. 실행 권위가 아니다. */
export const normalStartPreparationLimits=Object.freeze({control:8192,requestMs:10000,observationMs:2000,nonceBytes:32});
export const normalStartPreparationHeaders=Object.freeze({proof:'x-anvil-native-normal-start-preparation-proof',signature:'x-anvil-native-normal-start-preparation-signature'});
const fail=():never=>{throw Error('NORMAL_START_PREPARATION_INPUT_INVALID');};
function check(v:unknown):asserts v{if(!v)fail();}
function object(raw:unknown,keys:readonly string[]){check(!types.isProxy(raw)&&recordV1(raw,keys));return raw;}
function copy<T>(raw:T):T{const text=canonicalJson(raw);check(Buffer.byteLength(text)<=8192);return JSON.parse(text);}
function span(v:Record<string,any>,max:number){check(isoV1(v.issuedAt)&&isoV1(v.expiresAt)&&Date.parse(v.expiresAt)>Date.parse(v.issuedAt)&&Date.parse(v.expiresAt)-Date.parse(v.issuedAt)<=max);}
function nonce(v:unknown){check(typeof v==='string'&&/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(v));const bytes=Buffer.from(v,'base64url');check(bytes.length===32&&bytes.toString('base64url')===v);}
const scopeKeys=['installationId','projectId','registrationRef','connectorRef','windowRef','receiveSessionRef','profileRef','hostPublicKeyFingerprint','authBindingHash','localReceiveAttemptId',
 'actorId','clientId','humanSessionId','credentialGeneration','controlGeneration','admissionRef','claimRef','normalCommandId','normalRequestHash','executionId','executionGeneration','executionPreparationRef','writerNoneRef'] as const;
export interface NormalStartPreparationRequest{
 schemaVersion:1;purpose:'NORMAL_START_PREPARATION_REQUEST_V1';requestId:string;attemptId:string;
 installationId:string;projectId:string;registrationRef:RuntimeRefV1;connectorRef:RuntimeRefV1;windowRef:RuntimeRefV1;receiveSessionRef:RuntimeRefV1;profileRef:RuntimeRefV1;
 hostPublicKeyFingerprint:string;authBindingHash:string;localReceiveAttemptId:string;actorId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number;
 admissionRef:RuntimeRefV1;claimRef:RuntimeRefV1;normalCommandId:string;normalRequestHash:string;executionId:string;executionGeneration:number;executionPreparationRef:RuntimeRefV1;writerNoneRef:RuntimeRefV1;
 serverNonce:string;issuedAt:string;expiresAt:string;
}
function scope(v:Record<string,any>){
 for(const k of ['installationId','projectId','localReceiveAttemptId','actorId','clientId','humanSessionId','normalCommandId','executionId'])check(uuidV1(v[k]));
 for(const k of ['registrationRef','connectorRef','windowRef','receiveSessionRef','profileRef','admissionRef','claimRef','executionPreparationRef','writerNoneRef'])check(refV1(v[k]));
 for(const k of ['windowRef','receiveSessionRef','admissionRef','claimRef'])check(v[k].version===1);
 for(const k of ['credentialGeneration','controlGeneration','executionGeneration'])check(Number.isSafeInteger(v[k])&&v[k]>0);
 for(const k of ['hostPublicKeyFingerprint','authBindingHash','normalRequestHash'])check(hashV1(v[k]));
 check(v.admissionRef.id!==v.claimRef.id&&v.windowRef.id!==v.receiveSessionRef.id);
}
export function readNormalStartPreparationRequest(raw:unknown):NormalStartPreparationRequest{
 const v=object(raw,['schemaVersion','purpose','requestId','attemptId',...scopeKeys,'serverNonce','issuedAt','expiresAt']);
 check(v.schemaVersion===1&&v.purpose==='NORMAL_START_PREPARATION_REQUEST_V1'&&uuidV1(v.requestId)&&uuidV1(v.attemptId));scope(v);nonce(v.serverNonce);span(v,10000);return copy(v) as NormalStartPreparationRequest;
}
export function normalStartPreparationRequestRef(raw:unknown):RuntimeRefV1{const v=readNormalStartPreparationRequest(raw);return{id:v.requestId,version:1,contentHash:contentHash(canonicalJson(v))};}
export function encodeNormalStartPreparationFrame(raw:unknown):Buffer{
 const request=readNormalStartPreparationRequest(raw),body=Buffer.from(canonicalJson(request),'utf8');check(body.length+4<=8192);
 const frame=Buffer.alloc(body.length+4);frame.writeUInt32BE(body.length);body.copy(frame,4);return frame;
}
export interface NormalStartProtectedPreparationBasis{ref:RuntimeRefV1;snapshot:{schemaVersion:1;purpose:'NORMAL_START_PREPARATION_PROTECTED_BASIS_V1';basisId:string;requestRef:RuntimeRefV1;attemptId:string;
 objectRef:RuntimeRefV1;sourceRef:RuntimeRefV1;writerNoneRef:RuntimeRefV1;osFenceRef:RuntimeRefV1;issuedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false}}
export interface NormalStartPreparationPeerReceipt{
 ref:RuntimeRefV1;snapshot:{schemaVersion:1;purpose:'NORMAL_START_PREPARATION_PEER_RECEIPT_V1';receiptId:string;requestRef:RuntimeRefV1;attemptId:string;
  outcome:'PREPARED'|'REJECTED';preparationBasis:NormalStartProtectedPreparationBasis|null;issuedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false};
}
export interface NormalStartPreparationResult{schemaVersion:1;purpose:'NORMAL_START_PREPARATION_RESULT_V1';requestRef:RuntimeRefV1;receipt:NormalStartPreparationPeerReceipt}
export function readNormalStartPreparationResult(raw:unknown):NormalStartPreparationResult{
 const v=object(raw,['schemaVersion','purpose','requestRef','receipt']);check(v.schemaVersion===1&&v.purpose==='NORMAL_START_PREPARATION_RESULT_V1'&&refV1(v.requestRef)&&v.requestRef.version===1);
 const receipt=object(v.receipt,['ref','snapshot']),r=object(receipt.snapshot,['schemaVersion','purpose','receiptId','requestRef','attemptId','outcome','preparationBasis','issuedAt','expiresAt','executionAuthorized','dispatchPerformed']);
 check(refV1(receipt.ref)&&receipt.ref.version===1&&r.schemaVersion===1&&r.purpose==='NORMAL_START_PREPARATION_PEER_RECEIPT_V1'&&uuidV1(r.receiptId)&&uuidV1(r.attemptId)
  &&r.receiptId===receipt.ref.id&&r.receiptId!==v.requestRef.id&&same(r.requestRef,v.requestRef)&&['PREPARED','REJECTED'].includes(r.outcome)
  &&r.executionAuthorized===false&&r.dispatchPerformed===false&&receipt.ref.contentHash===contentHash(canonicalJson(r)));
 if(r.outcome==='REJECTED')check(r.preparationBasis===null);
 else{
  const basis=object(r.preparationBasis,['ref','snapshot']),b=object(basis.snapshot,['schemaVersion','purpose','basisId','requestRef','attemptId','objectRef','sourceRef','writerNoneRef','osFenceRef','issuedAt','expiresAt','executionAuthorized','dispatchPerformed']);
  check(refV1(basis.ref)&&basis.ref.version===1&&b.schemaVersion===1&&b.purpose==='NORMAL_START_PREPARATION_PROTECTED_BASIS_V1'&&uuidV1(b.basisId)&&basis.ref.id===b.basisId
   &&basis.ref.id!==receipt.ref.id&&basis.ref.id!==v.requestRef.id&&same(b.requestRef,v.requestRef)&&b.attemptId===r.attemptId&&['objectRef','sourceRef','writerNoneRef','osFenceRef'].every(k=>refV1(b[k]))
   &&b.executionAuthorized===false&&b.dispatchPerformed===false&&basis.ref.contentHash===contentHash(canonicalJson(b)));
  span(b,10000);check(Date.parse(r.issuedAt)>=Date.parse(b.issuedAt)&&Date.parse(r.expiresAt)<=Date.parse(b.expiresAt));
 }
 span(r,10000);return copy(v) as NormalStartPreparationResult;
}
export function normalStartPreparationResultPath(sessionId:string){check(uuidV1(sessionId));return '/api/v1/native-first-receive/sessions/'+sessionId+'/normal-start-preparation-result';}
export interface NormalStartPreparationResultProof{
 schemaVersion:1;purpose:'NORMAL_START_PREPARATION_RESULT_PROOF_V1';requestRef:RuntimeRefV1;attemptId:string;
 installationId:string;projectId:string;registrationRef:RuntimeRefV1;connectorRef:RuntimeRefV1;windowRef:RuntimeRefV1;receiveSessionRef:RuntimeRefV1;
 hostPublicKeyFingerprint:string;serverNonce:string;target:{method:'POST';path:string;queryHash:string;bodyHash:string};issuedAt:string;expiresAt:string;
}
export function readNormalStartPreparationResultProof(raw:unknown):NormalStartPreparationResultProof{
 const v=object(raw,['schemaVersion','purpose','requestRef','attemptId','installationId','projectId','registrationRef','connectorRef','windowRef','receiveSessionRef','hostPublicKeyFingerprint','serverNonce','target','issuedAt','expiresAt']);
 check(v.schemaVersion===1&&v.purpose==='NORMAL_START_PREPARATION_RESULT_PROOF_V1'&&refV1(v.requestRef)&&v.requestRef.version===1&&uuidV1(v.attemptId)&&uuidV1(v.installationId)&&uuidV1(v.projectId)
  &&['registrationRef','connectorRef','windowRef','receiveSessionRef'].every(k=>refV1(v[k]))&&v.windowRef.version===1&&v.receiveSessionRef.version===1&&hashV1(v.hostPublicKeyFingerprint));
 const t=object(v.target,['method','path','queryHash','bodyHash']);check(t.method==='POST'&&t.path===normalStartPreparationResultPath(v.receiveSessionRef.id)&&t.queryHash===contentHash(canonicalJson({}))&&hashV1(t.bodyHash));
 nonce(v.serverNonce);span(v,2000);return copy(v) as NormalStartPreparationResultProof;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 원 요청/결과/목적 proof의 exact 결박만 검산한다. 물리 준비 receipt의 진위·정착은 원 producer가 검산한다. */
export function matchNormalStartPreparationResult(requestRaw:unknown,resultRaw:unknown,proofRaw:unknown){
 const request=readNormalStartPreparationRequest(requestRaw),result=readNormalStartPreparationResult(resultRaw),proof=readNormalStartPreparationResultProof(proofRaw),ref=normalStartPreparationRequestRef(request);
 check(same(ref,result.requestRef)&&same(ref,proof.requestRef)&&proof.attemptId===request.attemptId&&result.receipt.snapshot.attemptId===request.attemptId
  &&proof.serverNonce===request.serverNonce&&proof.target.bodyHash===contentHash(canonicalJson(result)));
 const basis=result.receipt.snapshot.preparationBasis;
 if(basis){
  check(same(basis.snapshot.writerNoneRef,request.writerNoneRef));
  const forbidden=new Set([request.requestId,request.attemptId,request.normalCommandId,request.executionId,result.receipt.ref.id,
   ...['registrationRef','connectorRef','windowRef','receiveSessionRef','profileRef','admissionRef','claimRef','executionPreparationRef','writerNoneRef'].map(k=>(request as any)[k].id)]);
  for(const r of [basis.ref,basis.snapshot.objectRef,basis.snapshot.sourceRef,basis.snapshot.osFenceRef])check(!forbidden.has(r.id));
  check(new Set([basis.ref.id,basis.snapshot.objectRef.id,basis.snapshot.sourceRef.id,basis.snapshot.osFenceRef.id]).size===4);
  check(Date.parse(basis.snapshot.issuedAt)>=Date.parse(request.issuedAt)&&Date.parse(basis.snapshot.expiresAt)<=Date.parse(request.expiresAt));
 }
 for(const k of ['installationId','projectId','registrationRef','connectorRef','windowRef','receiveSessionRef','hostPublicKeyFingerprint'] as const)check(same(proof[k],request[k]));
 check(Date.parse(proof.issuedAt)>=Date.parse(request.issuedAt)&&Date.parse(proof.expiresAt)<=Date.parse(request.expiresAt)
  &&Date.parse(result.receipt.snapshot.issuedAt)>=Date.parse(request.issuedAt)&&Date.parse(result.receipt.snapshot.expiresAt)<=Date.parse(request.expiresAt)
  &&Date.parse(proof.issuedAt)>=Date.parse(result.receipt.snapshot.issuedAt)&&Date.parse(proof.expiresAt)<=Date.parse(result.receipt.snapshot.expiresAt));
 return {request,result,proof};
}
export function readNormalStartPreparationResultHeaders(headers:unknown,rawHeaders:unknown){
 check(headers&&typeof headers==='object'&&!types.isProxy(headers)&&Array.isArray(rawHeaders)&&!types.isProxy(rawHeaders)&&rawHeaders.length%2===0);
 const values=new Map<string,string>(),allowed:readonly string[]=Object.values(normalStartPreparationHeaders);
 for(let n=0;n<rawHeaders.length;n+=2){
  const k=Object.getOwnPropertyDescriptor(rawHeaders,String(n)),v=Object.getOwnPropertyDescriptor(rawHeaders,String(n+1));
  check(k&&v&&Object.hasOwn(k,'value')&&Object.hasOwn(v,'value')&&typeof k.value==='string'&&typeof v.value==='string');
  const name=k.value.toLowerCase();if(!name.startsWith('x-anvil-native-'))continue;check(allowed.includes(name)&&!values.has(name));values.set(name,v.value);
 }
 for(const name of Object.getOwnPropertyNames(headers))if(name.toLowerCase().startsWith('x-anvil-native-'))check(allowed.includes(name));
 for(const name of allowed){const d=Object.getOwnPropertyDescriptor(headers,name);check(d&&Object.hasOwn(d,'value')&&typeof d.value==='string'&&d.value===values.get(name));}
 const encoded=values.get(normalStartPreparationHeaders.proof),signature=values.get(normalStartPreparationHeaders.signature);
 check(typeof encoded==='string'&&encoded.length<=Math.ceil(8192*4/3)&&/^[A-Za-z0-9_-]+$/.test(encoded)&&typeof signature==='string'&&/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature));
 const bytes=Buffer.from(encoded,'base64url'),sig=Buffer.from(signature,'base64url');check(bytes.length<=8192&&bytes.toString('base64url')===encoded&&sig.length===64&&sig.toString('base64url')===signature);
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),proof=readNormalStartPreparationResultProof(parseWireJson(text));check(canonicalJson(proof)===text);return{proof,signature};
}
