import {verify} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readHostPublicKey,publicKeyFingerprint} from './registration-proof.ts';
import {
 readSourceContentPreflightProofInputCandidate,
 readSourceContentChallengeProofInputCandidate,
} from './source-content-exchange-proof-input.ts';
import {readSourceContentReportProofInputCandidate} from './source-content-report-proof-input.ts';

function invalid():never {throw Error('SOURCE_CONTENT_SIGNATURE_INVALID');}

/** 기본 속성만 복사한다. Proxy와 getter를 서명 원문 판독에 참여시키지 않는다. */
function snapshot(value:unknown,depth=0):unknown {
 if(depth>64)return invalid();
 if(value===null||typeof value!=='object')return value;
 if(types.isProxy(value)||Object.getOwnPropertySymbols(value).length)return invalid();
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
 if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return invalid();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.values(descriptors).some(d=>!('value'in d)))return invalid();
 if(array){
  const length=descriptors.length?.value;
  if(!Number.isSafeInteger(length)||length<0||Object.keys(descriptors).length!==length+1)return invalid();
  const result:unknown[]=[];
  for(let index=0;index<length;index++){
   const descriptor=descriptors[String(index)];
   if(!descriptor||!descriptor.enumerable)return invalid();
   result.push(snapshot(descriptor.value,depth+1));
  }
  return result;
 }
 const result:Record<string,unknown>=Object.create(null);
 for(const [key,descriptor]of Object.entries(descriptors)){
  if(!descriptor.enumerable)return invalid();
  result[key]=snapshot(descriptor.value,depth+1);
 }
 // 원 reader가 일반 JSON 객체를 받도록 복사하며 __proto__도 데이터로 유지한다.
 return JSON.parse(canonicalJson(result));
}
interface SignatureInput {proofBytes:Buffer;signatureBytes:Buffer}
function mathematics(spki:unknown,input:SignatureInput,fingerprint:unknown){
 const key=readHostPublicKey(spki);
 if(publicKeyFingerprint(spki)!==fingerprint
  ||!verify('sha256',input.proofBytes,{key,dsaEncoding:'ieee-p1363'},input.signatureBytes))return invalid();
 return Object.freeze({
  signatureValid:true as const,
  registrationVerified:false as const,
  observationVerified:false as const,
  currentAuthorityVerified:false as const,
  executionAuthorized:false as const,
  linkAuthorized:false as const,
 });
}

/** 원 preflight의 목적별 bytes에 대한 서명 수학만 검산한다. */
export function verifySourceContentPreflightSignature(spki:unknown,value:unknown,expected:unknown,nowMs:number){
 try{
  const input=readSourceContentPreflightProofInputCandidate(snapshot(value),snapshot(expected),nowMs);
  return mathematics(spki,input.candidate,input.candidate.publicKeyFingerprint);
 }catch{return invalid();}
}

/** 원 preflight와 결박된 challenge의 고유 domain을 그대로 소비한다. */
export function verifySourceContentChallengeSignature(spki:unknown,value:unknown,originalPreflight:unknown,expected:unknown,nowMs:number){
 try{
  const input=readSourceContentChallengeProofInputCandidate(snapshot(value),snapshot(originalPreflight),snapshot(expected),nowMs);
  return mathematics(spki,input.candidate,input.candidate.publicKeyFingerprint);
 }catch{return invalid();}
}

/** 보관 report는 원 receivedAt/observeBefore 문맥을 적용한다. 현재 권위를 발급하지 않는다. */
export function verifySourceContentReportSignature(spki:unknown,value:unknown,context:unknown){
 try{
  const fixed=snapshot(context);
  const input=readSourceContentReportProofInputCandidate(snapshot(value),fixed);
  const fingerprint=(fixed as {scope:{hostFingerprint:unknown}}).scope.hostFingerprint;
  return mathematics(spki,input.candidate,fingerprint);
 }catch{return invalid();}
}
