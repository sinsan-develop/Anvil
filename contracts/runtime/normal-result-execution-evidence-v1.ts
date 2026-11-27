import {types} from 'node:util';
import {canonicalJson,contentHash} from '../canonical.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from './validation-v1.ts';

export interface NormalResultEvidenceBindingV1 {
 projectId:string;
 executionId:string;
 executionGeneration:number;
 executorRegistrationRef:Ref;
 localAttemptRef:Ref;
 grantRef:Ref;
 dispatchCommandRef:Ref;
 dispatchEnvelopeHash:string;
 captureRef:Ref;
 environmentRef:Ref;
 environmentFingerprint:string;
 commit:{objectFormat:'SHA1'|'SHA256';oid:string};
}

export interface NormalResultEvidenceSnapshotV1 {
 schemaVersion:1;
 kind:'NORMAL_RESULT_EXECUTION_EVIDENCE_V1';
 binding:NormalResultEvidenceBindingV1;
 command:{argvSha256:string;exitCode:number;startedAt:string;exitedAt:string};
 artifacts:{name:string;bytes:number;sha256:string;artifactRef:Ref}[];
 observedAt:string;
}

export interface NormalResultExecutionEvidenceV1 {
 ref:Ref;
 snapshot:NormalResultEvidenceSnapshotV1;
}

const evidenceKind='NORMAL_RESULT_EXECUTION_EVIDENCE_V1';
const maxSnapshotBytes=64*1024;
const maxArtifacts=200;
const bindingRefs=['executorRegistrationRef','localAttemptRef','grantRef','dispatchCommandRef','captureRef','environmentRef'] as const;
const bindingKeys=['projectId','executionId','executionGeneration',...bindingRefs,'dispatchEnvelopeHash','environmentFingerprint','commit'];
const invalid=():never=>{throw Error('NORMAL_RESULT_EXECUTION_EVIDENCE_INVALID');};
const plain=(v:unknown):v is object=>v!==null&&typeof v==='object'&&!types.isProxy(v);
const record=(v:unknown,keys:readonly string[])=>plain(v)&&recordV1(v,keys);
const ref=(v:unknown)=>plain(v)&&refV1(v);
const nonnegative=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&!Object.is(v,-0);
const logicalName=(v:unknown):v is string=>typeof v==='string'&&v.length<=256&&Buffer.byteLength(v,'utf8')<=256&&
 v.trim()===v&&v.normalize('NFC')===v&&/^[\p{L}\p{N}][\p{L}\p{N}\p{M}._ -]*$/u.test(v);

function binding(raw:unknown):raw is NormalResultEvidenceBindingV1 {
 if(!record(raw,bindingKeys)||!uuidV1(raw.projectId)||!uuidV1(raw.executionId)||!nonnegative(raw.executionGeneration)||raw.executionGeneration<1||
  !bindingRefs.every(key=>ref(raw[key]))||raw.captureRef.id===raw.dispatchCommandRef.id||
  !hashV1(raw.dispatchEnvelopeHash)||!hashV1(raw.environmentFingerprint)||!record(raw.commit,['objectFormat','oid']))return false;
 const {objectFormat,oid}=raw.commit;
 return typeof oid==='string'&&(objectFormat==='SHA1'&&/^[a-f0-9]{40}$/.test(oid)||objectFormat==='SHA256'&&hashV1(oid))&&!/^0+$/.test(oid);
}

function snapshotBytes(raw:unknown):string {
 if(!record(raw,['schemaVersion','kind','binding','command','artifacts','observedAt'])||raw.schemaVersion!==1||raw.kind!==evidenceKind||
  !binding(raw.binding)||!record(raw.command,['argvSha256','exitCode','startedAt','exitedAt'])||!isoV1(raw.observedAt))return invalid();
 const {command,artifacts,observedAt}=raw;
 if(!hashV1(command.argvSha256)||!nonnegative(command.exitCode)||command.exitCode>0xffffffff||!isoV1(command.startedAt)||!isoV1(command.exitedAt)||
  command.startedAt>command.exitedAt||command.exitedAt>observedAt)return invalid();
 if(!plain(artifacts)||Object.getPrototypeOf(artifacts)!==Array.prototype||!arrayV1(artifacts,maxArtifacts))return invalid();
 const artifactIds=new Set<string>();
 let lastName='';
 for(const artifact of artifacts){
  if(!record(artifact,['name','bytes','sha256','artifactRef'])||!logicalName(artifact.name)||artifact.name<=lastName||
   !nonnegative(artifact.bytes)||!hashV1(artifact.sha256)||!ref(artifact.artifactRef)||artifact.artifactRef.version!==1||
   artifact.sha256!==artifact.artifactRef.contentHash||artifactIds.has(artifact.artifactRef.id))return invalid();
  artifactIds.add(artifact.artifactRef.id);
  lastName=artifact.name;
 }
 const bytes=canonicalJson(raw);
 if(Buffer.byteLength(bytes,'utf8')>maxSnapshotBytes)return invalid();
 return bytes;
}

/** 보호 저장에서 선택한 별도 증거 ID에 canonical 원형을 결박한다. */
export function normalResultExecutionEvidenceRefV1(id:string,snapshot:unknown):Ref {
 if(!uuidV1(id))return invalid();
 const bytes=snapshotBytes(snapshot);
 const value:NormalResultEvidenceSnapshotV1=JSON.parse(bytes);
 if(id===value.binding.captureRef.id||id===value.binding.dispatchCommandRef.id)return invalid();
 return {id,version:1,contentHash:contentHash(bytes)};
}

/** 형상과 자체 해시만 검사한다. 보관·물리 실행·검수 판정은 이 함수가 발급하지 않는다. */
export function readNormalResultExecutionEvidenceV1(raw:unknown):NormalResultExecutionEvidenceV1 {
 if(!record(raw,['ref','snapshot'])||!ref(raw.ref)||raw.ref.version!==1)return invalid();
 const bytes=snapshotBytes(raw.snapshot),snapshot:NormalResultEvidenceSnapshotV1=JSON.parse(bytes);
 if(raw.ref.id===snapshot.binding.captureRef.id||raw.ref.id===snapshot.binding.dispatchCommandRef.id||raw.ref.contentHash!==contentHash(bytes))return invalid();
 return {ref:{id:raw.ref.id,version:1,contentHash:raw.ref.contentHash},snapshot};
}

/** 호출자가 독립적으로 검산한 보호 참조·바탕과 대조한다. 바탕의 발급 권위는 호출자가 검사한다. */
export function matchNormalResultExecutionEvidenceV1(raw:unknown,expected:{ref:Ref;binding:NormalResultEvidenceBindingV1}):NormalResultExecutionEvidenceV1 {
 if(!record(expected,['ref','binding'])||!ref(expected.ref)||expected.ref.version!==1||!binding(expected.binding))return invalid();
 const value=readNormalResultExecutionEvidenceV1(raw);
 if(value.ref.id!==expected.ref.id||value.ref.contentHash!==expected.ref.contentHash||canonicalJson(value.snapshot.binding)!==canonicalJson(expected.binding))return invalid();
 return value;
}
