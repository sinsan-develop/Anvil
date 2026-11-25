import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {hashV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../contracts/runtime/validation-v1.ts';
import {parse0076NegativeLinuxFdProofProtectedEvidence,type NegativeLinuxFdProofProtectedEvidence} from './qa-ix01-0076-negative-linux-fd-proof-issuer.ts';
import {readSubnetWindowsFinalReadinessResult,type SubnetWindowsFinalReadinessComparison} from './qa-ix01-subnet-observation-windows-readiness-result.ts';
import {create0076BenignFdProofWindowsCarrier,type SubnetWindowsPorts,type SubnetWindowsReview} from './qa-ix01-subnet-observation-windows.ts';

const purpose='IX01_0076_BENIGN_FD_PROOF_WINDOWS_RELEASE' as const;
const readinessSourceHash='ad2254c843f97ff420eee2d35cf6968783f199694ee5b6404bdde69dd74cd3d8';
const unknown=Object.freeze({status:'UNKNOWN',code:'WINDOWS_BENIGN_FD_PROOF_INVOCATION_UNCONFIRMED'} as const);
const bytesPrototype=Object.getPrototypeOf(Uint8Array.prototype),byteLength=Object.getOwnPropertyDescriptor(bytesPrototype,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(bytesPrototype,'buffer')!.get!;
const invalid=():never=>{throw Error('IX01_0076_BENIGN_FD_PROOF_WINDOWS_ENTRY_INVALID');};

type ReadinessIdentity=Readonly<{imageSha256:string;configurationSha256:string;knownHostsSha256:string}>;
export interface BenignFdProofWindowsReleaseDecision{
 readonly schemaVersion:1;readonly purpose:typeof purpose;readonly attemptId:string;readonly approvalRef:Readonly<RuntimeRefV1>;readonly sourceHead:string;readonly approvalHash:string;readonly planHash:string;readonly sourceHash:string;readonly graphHash:string;
 /** 같은 원 실행의 readiness 관측 뒤 기존 단일 release 결정에 결박되는 값이다. 별도 선조회나 두 번째 사람 승인이 아니다. */
 readonly issuedAt:number;readonly expiresAt:number;readonly stdinSha256:string;readonly readinessOutputSha256:string;readonly readinessMetadataSha256:string;readonly readinessIdentity:ReadinessIdentity;
}
export interface BenignFdProofWindowsReleaseAuthority{
 readonly recipient:object;readonly decision:Readonly<BenignFdProofWindowsReleaseDecision>;now():number;monotonic():number;
 assertCurrent(this:object,phase:'PREPARE'|'READINESS'|'CARRIER_REVIEW'|'RESULT',decision:Readonly<BenignFdProofWindowsReleaseDecision>,readiness:SubnetWindowsFinalReadinessComparison,binding:unknown):void;
}
export type BenignFdProofWindowsPortsFactory=(review:SubnetWindowsReview)=>SubnetWindowsPorts;

function exact(raw:unknown,keys:readonly string[]){return !!raw&&typeof raw==='object'&&!types.isProxy(raw)&&recordV1(raw,keys);}
function integer(raw:unknown):raw is number{return typeof raw==='number'&&Number.isSafeInteger(raw)&&raw>=0;}
function decisionShape(raw:unknown):raw is Readonly<BenignFdProofWindowsReleaseDecision>{
 if(!exact(raw,['schemaVersion','purpose','attemptId','approvalRef','sourceHead','approvalHash','planHash','sourceHash','graphHash','issuedAt','expiresAt','stdinSha256','readinessOutputSha256','readinessMetadataSha256','readinessIdentity']))return false;
 const value=raw as Record<string,unknown>,identity=value.readinessIdentity;
 if(!exact(identity,['imageSha256','configurationSha256','knownHostsSha256']))return false;
 const hashes=identity as Record<string,unknown>;
 return value.schemaVersion===1&&value.purpose===purpose&&uuidV1(value.attemptId)&&refV1(value.approvalRef)&&Object.isFrozen(value.approvalRef)&&Object.isFrozen(identity)&&value.approvalRef.contentHash===value.approvalHash&&typeof value.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(value.sourceHead)
  &&[value.approvalHash,value.planHash,value.sourceHash,value.graphHash,value.stdinSha256,value.readinessOutputSha256,value.readinessMetadataSha256].every(hashV1)&&integer(value.issuedAt)&&integer(value.expiresAt)&&value.issuedAt<value.expiresAt&&value.expiresAt-value.issuedAt<=10000
  &&[hashes.imageSha256,hashes.configurationSha256,hashes.knownHostsSha256].every(hashV1);
}
function ownedBytes(raw:unknown,max:number){
 if(types.isProxy(raw)||!types.isUint8Array(raw)||types.isSharedArrayBuffer(backing.call(raw)))return invalid();const length=byteLength.call(raw);if(length<1||length>max)return invalid();const bytes=new Uint8Array(length);Uint8Array.prototype.set.call(bytes,raw);return bytes;
}
function sameRef(left:Readonly<RuntimeRefV1>,right:Readonly<RuntimeRefV1>){return left.id===right.id&&left.version===right.version&&left.contentHash===right.contentHash;}
function sameEvidence(decision:Readonly<BenignFdProofWindowsReleaseDecision>,evidence:Readonly<NegativeLinuxFdProofProtectedEvidence>,stdinSha256:string){return decision.attemptId===evidence.attemptId&&sameRef(decision.approvalRef,evidence.approvalRef)
 &&decision.sourceHead===evidence.sourceHead&&decision.approvalHash===evidence.approvalHash&&decision.planHash===evidence.planHash&&decision.sourceHash===evidence.sourceHash&&decision.graphHash===evidence.graphHash
 &&decision.issuedAt===evidence.issuedAt&&decision.expiresAt===evidence.expiresAt&&decision.stdinSha256===stdinSha256;}
function sameIdentity(left:ReadinessIdentity,right:ReadinessIdentity){return left.imageSha256===right.imageSha256&&left.configurationSha256===right.configurationSha256&&left.knownHostsSha256===right.knownHostsSha256;}
function carrierBinding(raw:unknown,decision:Readonly<BenignFdProofWindowsReleaseDecision>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','approvalRef','sourceHead','planHash','approvalHash','sourceHash','graphHash','issuedAt','expiresAt','stdinSha256','sourceRoot','launcher','command']))return false;
 const value=raw as Record<string,unknown>,compact=decision.attemptId.replaceAll('-',''),sourceRoot='/home/daon/anvil-ix01-0076-negative-'+compact+'-qa';
 return value.schemaVersion===1&&value.purpose==='IX01_0076_BENIGN_FD_PROOF_WINDOWS_SEND'&&value.attemptId===decision.attemptId&&refV1(value.approvalRef)&&sameRef(value.approvalRef,decision.approvalRef)
  &&value.sourceHead===decision.sourceHead&&value.planHash===decision.planHash&&value.approvalHash===decision.approvalHash&&value.sourceHash===decision.sourceHash&&value.graphHash===decision.graphHash
  &&value.issuedAt===decision.issuedAt&&value.expiresAt===decision.expiresAt&&value.stdinSha256===decision.stdinSha256&&value.sourceRoot===sourceRoot&&value.launcher===sourceRoot+'/scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts';
}

/** 실제 readiness 조회나 release 발급을 하지 않는 고정 invocation 경계다.
 * argv/자동 CLI는 없으며 정상 실행담당자가 보유한 비직렬 authority와 두 원 byte 입력만 소비한다. */
export function create0076BenignFdProofWindowsInvocation(rawAuthority:BenignFdProofWindowsReleaseAuthority,portsFactory?:BenignFdProofWindowsPortsFactory){
 const authorityKeys=['recipient','decision','now','monotonic','assertCurrent'] as const;
 if(!exact(rawAuthority,authorityKeys)||!Object.isFrozen(rawAuthority)||!decisionShape(rawAuthority.decision)||!Object.isFrozen(rawAuthority.decision)||typeof rawAuthority.now!=='function'||typeof rawAuthority.monotonic!=='function'||typeof rawAuthority.assertCurrent!=='function'||types.isProxy(rawAuthority.now)||types.isProxy(rawAuthority.monotonic)||types.isProxy(rawAuthority.assertCurrent))invalid();
 if(!rawAuthority.recipient||typeof rawAuthority.recipient!=='object'||types.isProxy(rawAuthority.recipient)||!Object.isFrozen(rawAuthority.recipient)||portsFactory!==undefined&&(typeof portsFactory!=='function'||types.isProxy(portsFactory)))invalid();
 const descriptors=Object.getOwnPropertyDescriptors(rawAuthority),recipient=rawAuthority.recipient,decision=rawAuthority.decision;let spent=false,lastWall=-1,lastMono=-1,wallEnd=-1,monoEnd=-1;
 const current=(phase:'PREPARE'|'READINESS'|'CARRIER_REVIEW'|'RESULT',readiness:SubnetWindowsFinalReadinessComparison,binding:unknown)=>{
  if(authorityKeys.some(key=>Object.getOwnPropertyDescriptor(rawAuthority,key)?.value!==descriptors[key]!.value))return invalid();const wall=Reflect.apply(descriptors.now!.value as Function,rawAuthority,[]),mono=Reflect.apply(descriptors.monotonic!.value as Function,rawAuthority,[]);
  if(!Number.isSafeInteger(wall)||typeof mono!=='number'||!Number.isFinite(mono)||mono<0||wall<decision.issuedAt||wall<lastWall||mono<lastMono)return invalid();if(lastWall<0){wallEnd=Math.min(decision.expiresAt,wall+10000);monoEnd=mono+wallEnd-wall;}if(wall>=wallEnd||mono>=monoEnd)return invalid();lastWall=wall;lastMono=mono;
  if(Reflect.apply(descriptors.assertCurrent!.value as Function,recipient,[phase,decision,readiness,binding])!==undefined)return invalid();
 };
 return Object.freeze({async run(rawReadiness:unknown,rawProtectedStart:unknown){
  if(spent)return unknown;spent=true;let protectedBytes:Uint8Array|undefined,readinessBytes:Uint8Array|undefined;
  try{
   protectedBytes=ownedBytes(rawProtectedStart,16384);readinessBytes=ownedBytes(rawReadiness,4096);const stdinSha256=contentHash(protectedBytes),text=new TextDecoder('utf-8',{fatal:true}).decode(protectedBytes),evidence=parse0076NegativeLinuxFdProofProtectedEvidence(parseWireJson(text));
   if(!evidence||canonicalJson(evidence)!==text||!sameEvidence(decision,evidence,stdinSha256))return unknown;
   const expectedReadiness=Object.freeze({attemptId:decision.attemptId,approvalHash:decision.approvalHash,planHash:decision.planHash,sourceHash:readinessSourceHash,issuedAt:decision.issuedAt,expiresAt:decision.expiresAt});
   const readiness=readSubnetWindowsFinalReadinessResult(readinessBytes,expectedReadiness);if(readiness.status!=='COMPARISON_ONLY'||readiness.outputSha256!==decision.readinessOutputSha256||readiness.metadataSha256!==decision.readinessMetadataSha256||!sameIdentity(readiness.identity,decision.readinessIdentity))return unknown;
   current('PREPARE',readiness,undefined);current('READINESS',readiness,undefined);
   const review:SubnetWindowsReview=binding=>{if(!carrierBinding(binding,decision))return Object.freeze({status:'UNKNOWN'});current('CARRIER_REVIEW',readiness,binding);return Object.freeze({status:'CURRENT',reviewHash:contentHash(canonicalJson(binding))});};
   const carrier=create0076BenignFdProofWindowsCarrier(review,portsFactory?portsFactory(review):undefined),result=await carrier.run(protectedBytes);current('RESULT',readiness,undefined);return result;
  }catch{return unknown;}finally{protectedBytes?.fill(0);readinessBytes?.fill(0);}
 }});
}
