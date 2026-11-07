import {canonicalJson,contentHash,parseWireJson} from '../canonical.ts';
import {arrayV1,recordV1,refV1,uuidV1,hashV1,isoV1,cloneV1,type RuntimeRefV1} from './validation-v1.ts';
import {isRelativeSourceFileV1} from './source-scope-v1.ts';
export interface SourceReadTargetV1{relativePath:string;kind:'FILE';access:'READ_ATTRIBUTES';recursive:false}
export interface SourceReadRequestV1{sourceRootRef:RuntimeRefV1;connectorRef:RuntimeRefV1;registrationRef:RuntimeRefV1;targets:SourceReadTargetV1[];expiresAt:string;reason:string}
export interface SourceReadScopeV1 extends SourceReadRequestV1{protocolVersion:1;purpose:'SOURCE_READ_OBSERVATION';installationId:string;projectId:string;pathHintHash:string;hostFingerprint:string;userId:string;clientId:string;credentialGeneration:number;controlGeneration:number;policyRef:RuntimeRefV1;requestedAt:string}
export interface SourceReadPermitV1{protocolVersion:1;grantRef:RuntimeRefV1;scopeDigest:string;scope:SourceReadScopeV1;root:{sourceRootRef:RuntimeRefV1;pathHint:string;pathHintHash:string};issuedAt:string;expiresAt:string;serverNow:string;executionAuthorized:false;agentDispatchPerformed:false;baselineConfirmed:false}
export interface SourceReadPreflightV1{protocolVersion:1;purpose:'SOURCE_READ_PREFLIGHT';installationId:string;projectId:string;connectorId:string;registrationId:string;connectorGeneration:number;grantRef:RuntimeRefV1;scopeDigest:string;publicKeyFingerprint:string;clientNonce:string;expiresAt:string}
export interface SourceReadChallengeV1 extends Omit<SourceReadPreflightV1,'purpose'>{purpose:'SOURCE_READ_EXCHANGE';serverNonce:string;issuedAt:string}
const input=():never=>{throw Error('SOURCE_READ_INPUT_INVALID');};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reason=(v:unknown)=>typeof v==='string'&&!!v.trim()&&v.length<=20000&&v.isWellFormed()&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const requestKeys=['sourceRootRef','connectorRef','registrationRef','targets','expiresAt','reason'];
const scopeKeys=['protocolVersion','purpose','installationId','projectId','sourceRootRef','connectorRef','registrationRef','pathHintHash','hostFingerprint','userId','clientId','credentialGeneration','controlGeneration','policyRef','targets','requestedAt','expiresAt','reason'];
const preflightKeys=['protocolVersion','purpose','installationId','projectId','connectorId','registrationId','connectorGeneration','grantRef','scopeDigest','publicKeyFingerprint','clientNonce','expiresAt'];
export function sourceReadBase64V1(value:unknown,size:number):Buffer{
 if(typeof value!=='string'||value.length>4096||!/^[A-Za-z0-9_-]+$/.test(value))return input();
 const bytes=Buffer.from(value,'base64url');if(bytes.length!==size||bytes.toString('base64url')!==value)return input();return bytes;
}
function bounded(value:unknown,max:number){if(Buffer.byteLength(canonicalJson(value),'utf8')>max)return input();}
function targets(value:unknown):value is SourceReadTargetV1[]{
 if(!arrayV1(value,200)||!value.length)return false;const seen=new Set<string>();
 for(const t of value){if(!recordV1(t,['relativePath','kind','access','recursive'])||!isRelativeSourceFileV1(t.relativePath)||t.kind!=='FILE'||t.access!=='READ_ATTRIBUTES'||t.recursive!==false||seen.has(t.relativePath.toUpperCase()))return false;seen.add(t.relativePath.toUpperCase());}return true;
}
function base(v:Record<string,any>){return refV1(v.sourceRootRef)&&refV1(v.connectorRef)&&refV1(v.registrationRef)&&targets(v.targets)&&isoV1(v.expiresAt)&&reason(v.reason);}
/** wire 구조만 확인한다. 중복 키는 이미 parse된 객체에서 소급 탐지할 수 없다. */
export function parseSourceReadWireV1(raw:string,kind:'SCOPE'|'PERMIT'|'REPORT'):unknown{
 const max=({SCOPE:256*1024,PERMIT:512*1024,REPORT:1024*1024} as const)[kind];if(typeof raw!=='string'||!max||Buffer.byteLength(raw,'utf8')>max)return input();try{return parseWireJson(raw);}catch{return input();}
}
export function readSourceReadRequestV1(value:unknown,nowMs:number):SourceReadRequestV1{
 if(!recordV1(value,requestKeys)||!base(value)||!Number.isSafeInteger(nowMs))return input();
 const expiry=Date.parse(value.expiresAt);if(expiry<=nowMs||expiry-nowMs>7200000)return input();bounded(value,256*1024);return cloneV1(value) as unknown as SourceReadRequestV1;
}
export function readSourceReadRevokeV1(value:unknown):{grantRef:RuntimeRefV1;reason:string}{
 if(!recordV1(value,['grantRef','reason'])||!refV1(value.grantRef)||value.grantRef.version!==1||!reason(value.reason))return input();bounded(value,256*1024);return cloneV1(value) as any;
}
/** 형태/hash는 현재 서버 권한·exact 선언의 전체 hash 또는 실제 OS를 검증하지 않는다. */
export function readSourceReadScopeV1(value:unknown):SourceReadScopeV1{
 if(!recordV1(value,scopeKeys)||!base(value)||value.protocolVersion!==1||value.purpose!=='SOURCE_READ_OBSERVATION'||!['installationId','projectId','userId','clientId'].every(k=>uuidV1(value[k]))||!['pathHintHash','hostFingerprint'].every(k=>hashV1(value[k]))||!positive(value.credentialGeneration)||!positive(value.controlGeneration)||!refV1(value.policyRef)||!isoV1(value.requestedAt))return input();
 const ttl=Date.parse(value.expiresAt)-Date.parse(value.requestedAt);if(ttl<=0||ttl>7200000)return input();bounded(value,256*1024);return cloneV1(value) as unknown as SourceReadScopeV1;
}
export function readSourceReadPermitV1(value:unknown,expected:{scope:SourceReadScopeV1;grantRef:RuntimeRefV1},nowMs:number):SourceReadPermitV1{
 if(!recordV1(value,['protocolVersion','grantRef','scopeDigest','scope','root','issuedAt','expiresAt','serverNow','executionAuthorized','agentDispatchPerformed','baselineConfirmed'])||value.protocolVersion!==1||!refV1(value.grantRef)||value.grantRef.version!==1||!hashV1(value.scopeDigest)||!recordV1(value.root,['sourceRootRef','pathHint','pathHintHash'])||!refV1(value.root.sourceRootRef)||typeof value.root.pathHint!=='string'||!value.root.pathHint.trim()||value.root.pathHint.length>4096||!value.root.pathHint.isWellFormed()||/[\u0000-\u001f\u007f]/.test(value.root.pathHint)||!hashV1(value.root.pathHintHash)||!['issuedAt','expiresAt','serverNow'].every(k=>isoV1(value[k]))||value.executionAuthorized!==false||value.agentDispatchPerformed!==false||value.baselineConfirmed!==false||!Number.isSafeInteger(nowMs))return input();
 const scope=readSourceReadScopeV1(value.scope),basis=readSourceReadScopeV1(expected?.scope),digest=contentHash(canonicalJson(scope));
 if(!refV1(expected?.grantRef)||expected.grantRef.version!==1||!same(value.grantRef,expected.grantRef)||!same(scope,basis)||value.scopeDigest!==digest||value.grantRef.contentHash!==digest||!same(value.root.sourceRootRef,scope.sourceRootRef)||value.root.pathHintHash!==scope.pathHintHash||contentHash(value.root.pathHint)!==scope.pathHintHash)return input();
 const issued=Date.parse(value.issuedAt),expiry=Date.parse(value.expiresAt),server=Date.parse(value.serverNow);if(issued<Date.parse(scope.requestedAt)||expiry<=issued||expiry-issued>300000||expiry>Date.parse(scope.expiresAt)||server<issued||server>=expiry)return input();
 if(nowMs<issued||nowMs>=expiry)throw Error('SOURCE_READ_EXPIRED');bounded(value,512*1024);return cloneV1(value) as unknown as SourceReadPermitV1;
}
function proofBase(v:Record<string,any>){return v.protocolVersion===1&&['installationId','projectId','connectorId','registrationId'].every(k=>uuidV1(v[k]))&&positive(v.connectorGeneration)&&refV1(v.grantRef)&&v.grantRef.version===1&&hashV1(v.scopeDigest)&&v.scopeDigest===v.grantRef.contentHash&&hashV1(v.publicKeyFingerprint)&&isoV1(v.expiresAt);}
export function readSourceReadPreflightV1(value:unknown):SourceReadPreflightV1{
 if(!recordV1(value,preflightKeys)||!proofBase(value)||value.purpose!=='SOURCE_READ_PREFLIGHT')return input();sourceReadBase64V1(value.clientNonce,32);bounded(value,256*1024);return cloneV1(value) as unknown as SourceReadPreflightV1;
}
export function readSourceReadChallengeV1(value:unknown):SourceReadChallengeV1{
 if(!recordV1(value,[...preflightKeys,'serverNonce','issuedAt'])||!proofBase(value)||value.purpose!=='SOURCE_READ_EXCHANGE'||!isoV1(value.issuedAt))return input();sourceReadBase64V1(value.clientNonce,32);sourceReadBase64V1(value.serverNonce,32);const ttl=Date.parse(value.expiresAt)-Date.parse(value.issuedAt);if(ttl<=0||ttl>120000)return input();bounded(value,256*1024);return cloneV1(value) as unknown as SourceReadChallengeV1;
}
