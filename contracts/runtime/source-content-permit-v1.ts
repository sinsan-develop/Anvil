import {canonicalJson,contentHash} from '../canonical.ts';
import {recordV1,refV1,isoV1,type RuntimeRefV1} from './validation-v1.ts';
import {readSourceContentScopeV1,type SourceContentScopeV1,type SourceContentReportContextV1} from './source-content-report-v1.ts';

export interface SourceContentPermitBasisV1 {
 scope:SourceContentScopeV1;requestRef:RuntimeRefV1;observationRequestRef:RuntimeRefV1;observationNonce:string;
 credentialIssuedAt:string;credentialExpiresAt:string;issuedAt:string;observeBefore:string;
}
export interface SourceContentPermitV1 {
 protocolVersion:1;purpose:'SOURCE_CONTENT_PERMIT';scope:SourceContentScopeV1;requestRef:RuntimeRefV1;scopeDigest:string;
 root:{sourceRootRef:RuntimeRefV1;pathHint:string;pathHintHash:string};
 credential:{scope:'SOURCE_DOCUMENT_CONTENT_HASH_ONLY';issuedAt:string;expiresAt:string};
 observationRequestRef:RuntimeRefV1;observationNonce:string;issuedAt:string;observeBefore:string;serverNow:string;
 executionAuthorized:false;agentDispatchPerformed:false;baselineConfirmed:false;linkAuthorized:false;
}
const invalid=():never=>{throw Error('SOURCE_CONTENT_INPUT_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const nonce=(v:unknown)=>typeof v==='string'&&v.length===43&&/^[A-Za-z0-9_-]+$/.test(v)&&Buffer.from(v,'base64url').length===32&&Buffer.from(v,'base64url').toString('base64url')===v;
const basisKeys=['scope','requestRef','observationRequestRef','observationNonce','credentialIssuedAt','credentialExpiresAt','issuedAt','observeBefore'];
const permitKeys=['protocolVersion','purpose','scope','requestRef','scopeDigest','root','credential','observationRequestRef','observationNonce','issuedAt','observeBefore','serverNow','executionAuthorized','agentDispatchPerformed','baselineConfirmed','linkAuthorized'];
function copy(value:unknown):unknown {const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>1048576)return invalid();return JSON.parse(raw);}
/** 서버가 고정한 원자료와의 순수 대조다. 입력 자체의 인증/현재 권한·OS 관측/키·credential 발급은 하지 않는다. */
export function readSourceContentPermitV1(value:unknown,expected:unknown,nowMs:number):SourceContentPermitV1 {
 try {
  const e=copy(expected),v=copy(value);
  if(!Number.isSafeInteger(nowMs)||!recordV1(e,basisKeys)||!recordV1(v,permitKeys))return invalid();
  const scope=readSourceContentScopeV1(e.scope),digest=contentHash(canonicalJson(scope));
  if(!refV1(e.requestRef)||e.requestRef.version!==1||e.requestRef.contentHash!==digest||!refV1(e.observationRequestRef)||e.observationRequestRef.version!==1||!nonce(e.observationNonce)||!['credentialIssuedAt','credentialExpiresAt','issuedAt','observeBefore'].every(k=>isoV1(e[k])))return invalid();
  if(v.protocolVersion!==1||v.purpose!=='SOURCE_CONTENT_PERMIT'||!same(v.scope,scope)||!same(v.requestRef,e.requestRef)||v.scopeDigest!==digest||!same(v.observationRequestRef,e.observationRequestRef)||v.observationNonce!==e.observationNonce||v.issuedAt!==e.issuedAt||v.observeBefore!==e.observeBefore||!isoV1(v.serverNow)||!['executionAuthorized','agentDispatchPerformed','baselineConfirmed','linkAuthorized'].every(k=>v[k]===false))return invalid();
  if(!recordV1(v.root,['sourceRootRef','pathHint','pathHintHash'])||!same(v.root.sourceRootRef,scope.sourceRootRef)||v.root.pathHintHash!==scope.pathHintHash||typeof v.root.pathHint!=='string'||!v.root.pathHint.trim()||v.root.pathHint.length>4096||/[\u0000-\u001f\u007f]/.test(v.root.pathHint)||contentHash(v.root.pathHint)!==scope.pathHintHash)return invalid();
  if(!recordV1(v.credential,['scope','issuedAt','expiresAt'])||v.credential.scope!=='SOURCE_DOCUMENT_CONTENT_HASH_ONLY'||v.credential.issuedAt!==e.credentialIssuedAt||v.credential.expiresAt!==e.credentialExpiresAt)return invalid();
  const credentialStart=Date.parse(e.credentialIssuedAt),credentialEnd=Date.parse(e.credentialExpiresAt),issued=Date.parse(e.issuedAt),end=Date.parse(e.observeBefore),server=Date.parse(v.serverNow);
  if(credentialStart<Date.parse(scope.requestedAt)||credentialEnd<=credentialStart||credentialEnd-credentialStart>60000||credentialEnd>Date.parse(scope.expiresAt)||issued<credentialStart||issued>=credentialEnd||end<=issued||end>credentialEnd||server<issued||server>end||server>nowMs||nowMs<issued||nowMs>=end)return invalid();
  return v as unknown as SourceContentPermitV1;
 }catch{return invalid();}
}
/** 보호 원자료에서 보고 구조 검사 context만 만든다. credential·실행/링크 허가를 전달하지 않는다. */
export function sourceContentReportContextFromPermitV1(value:unknown,expected:unknown,receivedAt:string):SourceContentReportContextV1 {
 if(!isoV1(receivedAt))return invalid();
 const p=readSourceContentPermitV1(value,expected,Date.parse(receivedAt));
 return {scope:p.scope,declaredPathHint:p.root.pathHint,requestRef:p.requestRef,observationRequestRef:p.observationRequestRef,observationNonce:p.observationNonce,issuedAt:p.issuedAt,observeBefore:p.observeBefore,receivedAt};
}
