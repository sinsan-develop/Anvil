import {randomUUID,randomBytes} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {matchNormalStartPreparationResult,readNormalStartPreparationRequest,normalStartPreparationRequestRef,type NormalStartPreparationRequest} from '../../../../contracts/runtime/normal-start-preparation-v1.ts';
import {canonicalBase64,publicKeyFingerprint} from '../connections/registration-proof.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import type {ReceiveDb} from './native-first-receive-store.ts';
import {NativeFirstReceiveService,type NormalStartPreparationResultSource} from './native-first-receive-service.ts';

const fail=():never=>{throw new AuthFailure('NATIVE_RECEIVE_SOURCE_UNAVAILABLE',503);};
function check(v:unknown):asserts v{if(!v)fail();}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
async function query(db:ReceiveDb,text:string,args:unknown[],current:()=>void){
 const original=db.query;check(typeof original==='function');current();
 let out:Awaited<ReturnType<ReceiveDb['query']>>;
 try{out=await Reflect.apply(original,db,[text,args]);}catch{throw new AuthFailure('NATIVE_RECEIVE_OUTCOME_UNKNOWN',503);}
 current();check(db.query===original&&out.rowCount===1&&out.rows.length===1);return out;
}
async function tx(db:ReceiveDb,current:()=>void){
 const out=await query(db,'SELECT txid_current()::text AS transaction_id',[],current);
 check(recordV1(out.rows[0],['transaction_id'])&&typeof out.rows[0].transaction_id==='string'&&/^[1-9][0-9]{0,18}$/.test(out.rows[0].transaction_id)
  &&BigInt(out.rows[0].transaction_id)<=9223372036854775807n);return out.rows[0].transaction_id as string;
}
async function result(db:ReceiveDb,text:string,args:unknown[],current:()=>void){
 const out=await query(db,text,args,current);check(recordV1(out.rows[0],['result']));const encoded=canonicalJson(out.rows[0].result);check(Buffer.byteLength(encoded)<=8192);return JSON.parse(encoded);
}
type Material=Parameters<NormalStartPreparationResultSource['recordResult']>[1];
function material(raw:Material){
 check(recordV1(raw,['request','result','proof','signature','credentialDigest','transactionId'])&&hashV1(raw.credentialDigest)&&typeof raw.transactionId==='string'&&/^[1-9][0-9]{0,18}$/.test(raw.transactionId));
 const matched=matchNormalStartPreparationResult(raw.request,raw.result,raw.proof);canonicalBase64(raw.signature,64);
 return {...matched,signature:raw.signature,credentialDigest:raw.credentialDigest,transactionId:raw.transactionId};
}
function stored(raw:unknown,m:Material,nullable=false){
 if(nullable&&raw===null)return null;
 check(recordV1(raw,['ref','snapshot'])&&refV1(raw.ref)&&raw.ref.version===1&&recordV1(raw.snapshot,['schemaVersion','purpose','recordId','requestRef','peerReceiptRef','resultHash','proofHash','recordedAt','executionAuthorized','dispatchPerformed']));
 const s=raw.snapshot;
 check(s.schemaVersion===1&&s.purpose==='NORMAL_START_PREPARATION_RESULT_RECORD_V1'&&s.recordId===raw.ref.id&&same(s.requestRef,m.result.requestRef)&&same(s.peerReceiptRef,m.result.receipt.ref)
  &&s.resultHash===contentHash(canonicalJson(m.result))&&s.proofHash===contentHash(canonicalJson(m.proof))&&isoV1(s.recordedAt)&&s.executionAuthorized===false&&s.dispatchPerformed===false&&raw.ref.contentHash===contentHash(canonicalJson(s)));
 return raw;
}
/** 실제 동거래 adapter다. pool/BEGIN/COMMIT/회수/기한을 만들지 않고 원 service owner만 소비한다.
 * 0106 미설치·root/수신기 미공급에서 성공을 대신 반환하지 않는다. 생성/조립 자체는 IO0이다. */
export function createNormalStartPreparationResultStore():Readonly<NormalStartPreparationResultSource>{
 const source:NormalStartPreparationResultSource={purpose:'NORMAL_START_PREPARATION_RESULT_SOURCE_V1',
  async readResultBasis(db,sid,digest,requestRef,current){
   check(uuidV1(sid)&&hashV1(digest)&&refV1(requestRef)&&requestRef.version===1);const transaction=await tx(db,current);
   const value=await result(db,'SELECT anvil.fn08_normal_start_preparation_result_basis($1,$2,$3::jsonb,$4) AS result',[sid,digest,canonicalJson(requestRef),transaction],current);
   check(recordV1(value,['request','publicKeySpki','expiresAt'])&&recordV1(value.request,['ref','snapshot'])&&same(value.request.ref,requestRef)&&isoV1(value.expiresAt));
   const request=readNormalStartPreparationRequest(value.request.snapshot);
   check(same(normalStartPreparationRequestRef(request),requestRef)&&request.receiveSessionRef.id===sid&&request.expiresAt===value.expiresAt&&publicKeyFingerprint(value.publicKeySpki)===request.hostPublicKeyFingerprint);
   return value;
  },
  async recordResult(db,raw,current){
   const m=material(raw);check(await tx(db,current)===m.transactionId);
   return stored(await result(db,'SELECT anvil.fn08_normal_start_preparation_result_commit($1,$2::jsonb,$3) AS result',[m.request.receiveSessionRef.id,canonicalJson(m),m.transactionId],current),m);
  },
  async readRecordedResult(db,raw,current){
   const m=material(raw);check(await tx(db,current)===m.transactionId);
   return stored(await result(db,'SELECT anvil.fn08_normal_start_preparation_result_replay($1,$2::jsonb,$3) AS result',[m.request.receiveSessionRef.id,canonicalJson(m),m.transactionId],current),m,true);
  },
 };return Object.freeze(source);
}
/** 기존 원 service에만 명시 연결한다. app/main/default/외부 설정은 변경하지 않는다. */
export function connectNormalStartPreparationResultStore(service:NativeFirstReceiveService){
 check(service instanceof NativeFirstReceiveService&&Object.getPrototypeOf(service)===NativeFirstReceiveService.prototype
  &&service.connectNormalStartPreparationResultSource===NativeFirstReceiveService.prototype.connectNormalStartPreparationResultSource);
 const source=createNormalStartPreparationResultStore();service.connectNormalStartPreparationResultSource(source);return source;
}

/** 사전 admission 이후의 별도 인증 거래 내부에서만 사용한다. 반환은 아직 COMMIT/전송/물리 준비 증거가 아니다. */
export async function reserveNormalStartPreparationDispatch(db:ReceiveDb,actor:AuthenticatedIdentity,command:ProjectCommand,admissionRef:RuntimeRefV1,provenance:unknown,current:()=>void){
 check(actor.authSession&&uuidV1(actor.actorId)&&uuidV1(actor.clientId)&&uuidV1(command.projectId)&&command.clientId===actor.clientId&&command.operation==='queueExecutionCommand'&&refV1(admissionRef)&&admissionRef.version===1);
 const transaction=await tx(db,current),nonce=randomBytes(32);let proposal:{requestId:string;attemptId:string;recordId:string;serverNonce:string};
 try{proposal={requestId:randomUUID(),attemptId:randomUUID(),recordId:randomUUID(),serverNonce:nonce.toString('base64url')};}finally{nonce.fill(0);}
 const value=await result(db,'SELECT anvil.fn08_normal_start_preparation_dispatch_claim($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9) AS result',
  [actor.authSession.id,actor.actorId,actor.clientId,command.projectId,canonicalJson(command),canonicalJson(admissionRef),canonicalJson(provenance),canonicalJson(proposal),transaction],current);
 check(recordV1(value,['disposition','request','claimRef','expiresAt','dispatchPerformed'])&&['FIRST_COMMIT','REPLAY_ONLY'].includes(value.disposition)&&value.dispatchPerformed===false
  &&recordV1(value.request,['ref','snapshot'])&&refV1(value.claimRef)&&value.claimRef.version===1&&isoV1(value.expiresAt));
 const request:NormalStartPreparationRequest=readNormalStartPreparationRequest(value.request.snapshot);
 check(same(normalStartPreparationRequestRef(request),value.request.ref)&&same(request.admissionRef,admissionRef)&&same(request.claimRef,value.claimRef)&&request.normalCommandId===command.commandId
  &&request.normalRequestHash===contentHash(canonicalJson(command))&&request.projectId===command.projectId&&request.clientId===actor.clientId&&request.actorId===actor.actorId&&request.humanSessionId===actor.authSession.id&&request.expiresAt===value.expiresAt);
 if(value.disposition==='FIRST_COMMIT')check(request.requestId===proposal.requestId&&request.attemptId===proposal.attemptId&&request.serverNonce===proposal.serverNonce);
 return value;
}
