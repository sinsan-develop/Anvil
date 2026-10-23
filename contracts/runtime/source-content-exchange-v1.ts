import {canonicalJson,contentHash} from '../canonical.ts';
import {recordV1,refV1,hashV1,isoV1,type RuntimeRefV1} from './validation-v1.ts';
import {readSourceContentScopeV1,type SourceContentScopeV1} from './source-content-report-v1.ts';

export interface SourceContentExchangeContextV1 {scope:SourceContentScopeV1;requestRef:RuntimeRefV1;publicKeyFingerprint:string}
export interface SourceContentPreflightV1 {
 protocolVersion:1;purpose:'SOURCE_CONTENT_PREFLIGHT';installationId:string;projectId:string;connectorRef:RuntimeRefV1;
 registrationRef:RuntimeRefV1;observerRef:RuntimeRefV1;requestRef:RuntimeRefV1;scopeDigest:string;
 publicKeyFingerprint:string;clientNonce:string;expiresAt:string;
}
export interface SourceContentChallengeV1 extends Omit<SourceContentPreflightV1,'purpose'> {
 purpose:'SOURCE_CONTENT_EXCHANGE';serverNonce:string;issuedAt:string;
}
const invalid=():never=>{throw Error('SOURCE_CONTENT_INPUT_INVALID');};
const keys=['protocolVersion','purpose','installationId','projectId','connectorRef','registrationRef','observerRef','requestRef','scopeDigest','publicKeyFingerprint','clientNonce','expiresAt'];
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const nonce=(v:unknown):v is string=>typeof v==='string'&&v.length===43&&/^[A-Za-z0-9_-]+$/.test(v)&&Buffer.from(v,'base64url').length===32&&Buffer.from(v,'base64url').toString('base64url')===v;
function copy(v:unknown):unknown {const raw=canonicalJson(v);if(Buffer.byteLength(raw,'utf8')>1048576)return invalid();return JSON.parse(raw);}
function basis(value:unknown,nowMs:number):SourceContentExchangeContextV1 {
 const c=copy(value);
 if(!recordV1(c,['scope','requestRef','publicKeyFingerprint'])||!hashV1(c.publicKeyFingerprint)||!refV1(c.requestRef)||c.requestRef.version!==1||!Number.isSafeInteger(nowMs))return invalid();
 const scope=readSourceContentScopeV1(c.scope);
 if(c.requestRef.contentHash!==contentHash(canonicalJson(scope))||nowMs<Date.parse(scope.requestedAt)||nowMs>=Date.parse(scope.expiresAt))return invalid();
 return {...c,scope} as SourceContentExchangeContextV1;
}
/** 신뢰된 서버 context의 결박/형식만 검사한다. 등록 진위·현재 권한·nonce 소비·키 사용은 하지 않는다. */
export function readSourceContentPreflightV1(value:unknown,expected:unknown,nowMs:number):SourceContentPreflightV1 {
 try {
  const c=basis(expected,nowMs),s=c.scope,v=copy(value);
  if(!recordV1(v,keys)||v.protocolVersion!==1||v.purpose!=='SOURCE_CONTENT_PREFLIGHT'||v.installationId!==s.installationId||v.projectId!==s.projectId||!['connectorRef','registrationRef','observerRef'].every(k=>same(v[k],s[k as 'connectorRef']))||!same(v.requestRef,c.requestRef)||v.scopeDigest!==c.requestRef.contentHash||v.publicKeyFingerprint!==c.publicKeyFingerprint||!nonce(v.clientNonce)||!isoV1(v.expiresAt))return invalid();
  if(Date.parse(v.expiresAt)<=nowMs||Date.parse(v.expiresAt)>Date.parse(s.expiresAt))return invalid();
  return v as unknown as SourceContentPreflightV1;
 }catch{return invalid();}
}
/** 원 preflight와 짧은 challenge만 결박하며 실제 challenge 발행·권한 부여를 하지 않는다. */
export function readSourceContentChallengeV1(value:unknown,originalPreflight:unknown,expected:unknown,nowMs:number):SourceContentChallengeV1 {
 try {
  const c=basis(expected,nowMs),p=readSourceContentPreflightV1(originalPreflight,c,nowMs),v=copy(value);
  if(!recordV1(v,[...keys,'serverNonce','issuedAt'])||v.purpose!=='SOURCE_CONTENT_EXCHANGE'||!nonce(v.serverNonce)||v.serverNonce===p.clientNonce||!isoV1(v.issuedAt)||!isoV1(v.expiresAt))return invalid();
  for(const k of keys)if(k!=='purpose'&&k!=='expiresAt'&&!same(v[k],p[k as keyof SourceContentPreflightV1]))return invalid();
  const issued=Date.parse(v.issuedAt),expires=Date.parse(v.expiresAt);
  if(issued<Date.parse(c.scope.requestedAt)||issued>nowMs||expires<=issued||expires-issued>60000||expires>Date.parse(p.expiresAt)||nowMs>=expires)return invalid();
  return v as unknown as SourceContentChallengeV1;
 }catch{return invalid();}
}
/** 입력 바이트만 생성하며 서명 키·credential 발급·네트워크를 사용하지 않는다. */
export function sourceContentPreflightProofBytesV1(value:unknown,expected:unknown,nowMs:number):Buffer {
 const p=readSourceContentPreflightV1(value,expected,nowMs);
 return Buffer.concat([Buffer.from('ANVIL_SOURCE_CONTENT_PREFLIGHT_V1\0','ascii'),Buffer.from(canonicalJson(p),'utf8')]);
}
export function sourceContentChallengeProofBytesV1(value:unknown,originalPreflight:unknown,expected:unknown,nowMs:number):Buffer {
 const c=readSourceContentChallengeV1(value,originalPreflight,expected,nowMs);
 return Buffer.concat([Buffer.from('ANVIL_SOURCE_CONTENT_EXCHANGE_V1\0','ascii'),Buffer.from(canonicalJson(c),'utf8')]);
}
