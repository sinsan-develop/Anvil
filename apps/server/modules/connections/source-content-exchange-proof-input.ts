import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1} from '../../../../contracts/runtime/validation-v1.ts';
import {
 readSourceContentPreflightV1,sourceContentPreflightProofBytesV1,sourceContentChallengeProofBytesV1
} from '../../../../contracts/runtime/source-content-exchange-v1.ts';

const invalid=():never=>{throw Error('SOURCE_CONTENT_PROOF_INPUT_INVALID');};
function envelope(value:unknown):{payload:unknown;signature:string} {
 try {
  const raw=canonicalJson(value);
  if(Buffer.byteLength(raw,'utf8')>1052672)return invalid();
  const v:unknown=JSON.parse(raw);
  if(!recordV1(v,['payload','signature'])||typeof v.signature!=='string'||v.signature.length!==86||!/^[A-Za-z0-9_-]+$/.test(v.signature))return invalid();
  const bytes=Buffer.from(v.signature,'base64url');
  if(bytes.length!==64||bytes.toString('base64url')!==v.signature)return invalid();
  return {payload:v.payload,signature:v.signature};
 }catch{return invalid();}
}
function candidate(proofBytes:Buffer,signature:string,publicKeyFingerprint:string) {
 return {
  status:'UNVERIFIED' as const,reason:'SIGNATURE_VERIFIER_UNAVAILABLE' as const,
  candidate:{proofBytes,signatureBytes:Buffer.from(signature,'base64url'),publicKeyFingerprint},
  signatureVerified:false as const,currentAuthorityVerified:false as const,
  executionAuthorized:false as const,linkAuthorized:false as const
 };
}
/** 비활성 입력 준비만 수행한다. 키 조회·암호학적 검증·nonce 소비·현재 권한 검증은 없다. */
export function readSourceContentPreflightProofInputCandidate(value:unknown,expected:unknown,nowMs:number) {
 const v=envelope(value),payload=readSourceContentPreflightV1(v.payload,expected,nowMs);
 return candidate(sourceContentPreflightProofBytesV1(payload,expected,nowMs),v.signature,payload.publicKeyFingerprint);
}
export function readSourceContentChallengeProofInputCandidate(value:unknown,originalPreflight:unknown,expected:unknown,nowMs:number) {
 const v=envelope(value),preflight=readSourceContentPreflightV1(originalPreflight,expected,nowMs);
 return candidate(sourceContentChallengeProofBytesV1(v.payload,preflight,expected,nowMs),v.signature,preflight.publicKeyFingerprint);
}
