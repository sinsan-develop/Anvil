import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../canonical.ts';
import {cloneV1,recordV1,refV1,hashV1,isoV1,uuidV1,type RuntimeRefV1 as Ref} from './validation-v1.ts';
export interface NormalStopTargetV1 {kind:'NORMAL_STOP_SCOPE_V1';projectId:string;executionId:string;executionGeneration:number;grantRef:Ref;parentStartCommandRef:Ref;parentStartEnvelopeHash:string;executorRegistrationRef:Ref;sessionBindingRef:Ref;roleBindingRef:Ref;bindingGeneration:number;ownershipRef:Ref;mode:'COOPERATIVE_REQUEST_ONLY';forceKillAllowed:false}
export interface NormalStopProjectionV1 {transport:'NORMAL_PROTECTED';grantRef:Ref;sessionBindingRef:Ref;stopScopeRef:Ref;target:NormalStopTargetV1;checkedAt:string;expiresAt:string;executionAuthorized:false;dispatchPerformed:false;writerReleaseVerified:false}
const keys=['kind','projectId','executionId','executionGeneration','grantRef','parentStartCommandRef','parentStartEnvelopeHash','executorRegistrationRef','sessionBindingRef','roleBindingRef','bindingGeneration','ownershipRef','mode','forceKillAllowed'];
const refs=['grantRef','parentStartCommandRef','executorRegistrationRef','sessionBindingRef','roleBindingRef','ownershipRef'];
const bad=():never=>{throw Error('NORMAL_STOP_TARGET_INVALID');};
const plain=(v:unknown)=>!!v&&typeof v==='object'&&!types.isProxy(v);
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 닫힌 참조의 문법 검사. 참조 생성·판독은 현재 ownership 증명이 아니다. */
export function readNormalStopTargetV1(raw:unknown):NormalStopTargetV1 {
 if(!plain(raw)||!recordV1(raw,keys)||raw.kind!=='NORMAL_STOP_SCOPE_V1'||raw.mode!=='COOPERATIVE_REQUEST_ONLY'||raw.forceKillAllowed!==false||
  !uuidV1(raw.projectId)||!uuidV1(raw.executionId)||!hashV1(raw.parentStartEnvelopeHash)||!Number.isSafeInteger(raw.executionGeneration)||raw.executionGeneration<1||!Number.isSafeInteger(raw.bindingGeneration)||raw.bindingGeneration<1||
  !refs.every(k=>plain(raw[k])&&refV1(raw[k])))return bad();
 return cloneV1(raw) as unknown as NormalStopTargetV1;
}
/** UUIDv5 namespace는 HUMAN 원 START envelope.commandId다. 저장 commandRef.id와 혼동하지 않는다. */
export function normalStopScopeRefV1(raw:unknown,originalStartCommandId:string):Ref {
 const target=readNormalStopTargetV1(raw);if(!uuidV1(originalStartCommandId))return bad();
 const name=canonicalJson(target),bytes=createHash('sha1').update(Buffer.from(originalStartCommandId.replaceAll('-',''),'hex')).update(name,'utf8').digest().subarray(0,16);
 bytes[6]=(bytes[6]!&15)|80;bytes[8]=(bytes[8]!&63)|128;const h=bytes.toString('hex');
 return {id:`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`,version:1,contentHash:contentHash(name)};
}
export function readNormalStopProjectionV1(raw:unknown,originalStartCommandId:string,now:number):NormalStopProjectionV1 {
 if(!plain(raw)||!recordV1(raw,['transport','grantRef','sessionBindingRef','stopScopeRef','target','checkedAt','expiresAt','executionAuthorized','dispatchPerformed','writerReleaseVerified'])||
  raw.transport!=='NORMAL_PROTECTED'||raw.executionAuthorized!==false||raw.dispatchPerformed!==false||raw.writerReleaseVerified!==false||
  !['grantRef','sessionBindingRef','stopScopeRef'].every(k=>plain(raw[k])&&refV1(raw[k]))||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||!Number.isSafeInteger(now))return bad();
 const target=readNormalStopTargetV1(raw.target),start=Date.parse(raw.checkedAt),end=Date.parse(raw.expiresAt);
 if(start>now||end<=now||end<=start||end>start+30000||!same(raw.grantRef,target.grantRef)||!same(raw.sessionBindingRef,target.sessionBindingRef)||!same(raw.stopScopeRef,normalStopScopeRefV1(target,originalStartCommandId)))return bad();
 return cloneV1({...raw,target}) as unknown as NormalStopProjectionV1;
}
