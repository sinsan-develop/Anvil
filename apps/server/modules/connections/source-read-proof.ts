import {verify} from 'node:crypto';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readSourceReadPreflightV1,readSourceReadChallengeV1,sourceReadBase64V1} from '../../../../contracts/runtime/source-read-observation-v1.ts';
import {readSourceReadReportV1,sourceReadReportProofBytesV1,type SourceReadReportContextV1} from '../../../../contracts/runtime/source-read-report-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {readHostPublicKey,publicKeyFingerprint} from './registration-proof.ts';
function proof(value:unknown){
 const purpose=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'purpose')?.value:undefined;
 if(purpose==='SOURCE_READ_PREFLIGHT')return readSourceReadPreflightV1(value);
 if(purpose==='SOURCE_READ_EXCHANGE')return readSourceReadChallengeV1(value);
 throw Error('SOURCE_READ_PROOF_INVALID');
}
/** 등록 key 서명 자체와 현재 grant/nonce 적합성은 다르다. true만으로 상태를 변경하면 안 된다. */
export function hasValidSourceReadSignature(spki:unknown,signature:unknown,payload:unknown):boolean{
 try{const p=proof(payload),key=readHostPublicKey(spki);if(publicKeyFingerprint(spki)!==p.publicKeyFingerprint)return false;return verify('sha256',Buffer.from(canonicalJson(p),'utf8'),{key,dsaEncoding:'ieee-p1363'},sourceReadBase64V1(signature,64));}catch{return false;}
}
export function verifySourceReadProof(spki:unknown,signature:unknown,payload:unknown,expected:unknown,now:Date):true{
 try{
  const p=proof(payload),basis=proof(expected);
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error();
  if(Date.parse(basis.expiresAt)<=now.getTime())throw new AuthFailure('SOURCE_READ_EXPIRED',412);
  if('issuedAt'in basis&&Date.parse(basis.issuedAt)>now.getTime())throw Error();
  if(canonicalJson(p)!==canonicalJson(basis)||!hasValidSourceReadSignature(spki,signature,p))throw Error();return true;
 }catch(cause){if(cause instanceof AuthFailure&&cause.message==='SOURCE_READ_EXPIRED')throw cause;throw new AuthFailure('SOURCE_READ_PROOF_INVALID',412);}
}
/** 보고 서명은 출처/현재 권한·OS 사실을 대신하지 않는다. key는 서버의 현재 등록에서만 공급한다. */
export function verifySourceReadReportProof(spki:unknown,value:unknown,context:SourceReadReportContextV1):true{
 try{
  const report=readSourceReadReportV1(value,context),key=readHostPublicKey(spki);
  if(publicKeyFingerprint(spki)!==context.scope.hostFingerprint||!verify('sha256',sourceReadReportProofBytesV1(report,context),{key,dsaEncoding:'ieee-p1363'},sourceReadBase64V1(report.signature,64)))throw Error();return true;
 }catch{throw new AuthFailure('SOURCE_READ_PROOF_INVALID',412);}
}
