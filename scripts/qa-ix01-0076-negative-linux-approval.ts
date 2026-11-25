import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {arrayV1,hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {current0076NegativeContract as stageContract} from './qa-ix01-0076-atomicity-negative.ts';

const selectionPurpose='IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION' as const;
const verifiedPurpose='IX01_0076_NEGATIVE_LINUX_APPROVAL_VERIFIED' as const;
const dependencyPaths=Object.freeze([
 'scripts/qa-ix01-0076-negative-claim.ts',
 'scripts/qa-ix01-0076-atomicity-negative-receiver.ts',
 'scripts/qa-ix01-0076-negative-psql.ts',
 'scripts/qa-ix01-0076-negative-linux-process.ts',
 'scripts/qa-ix01-0076-negative-linux-approval.ts',
] as const);
export const current0076NegativeLinuxApprovalContract=Object.freeze({selectionPurpose,verifiedPurpose,dependencyPaths,
 evidence:'PROTECTED_READ_SOURCE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const});

export interface NegativeLinuxApprovalSelection{
 readonly schemaVersion:1;readonly purpose:typeof selectionPurpose;readonly attemptId:string;readonly sourceHead:string;
 readonly planHash:string;readonly approvalHash:string;readonly graphHash:string;
}
export interface NegativeLinuxApprovalReadObservation{
 readonly path:string;readonly bytes:Uint8Array;readonly custody:object;readonly fileIdentity:object;readonly closed:true;
}
export interface NegativeLinuxApprovalReadPorts{
 readonly recipient:object;
 now(this:object):number;monotonic(this:object):number;
 assertCurrent(this:object,selection:Readonly<NegativeLinuxApprovalSelection>):void;
 read(this:object,paths:readonly string[]):Promise<readonly Readonly<NegativeLinuxApprovalReadObservation>[]>;
}
export interface NegativeLinuxApprovalProjection{
 readonly schemaVersion:1;readonly purpose:typeof verifiedPurpose;readonly attemptId:string;readonly sourceHead:string;
 readonly planHash:string;readonly approvalHash:string;readonly graphHash:string;
 readonly dependencyHashes:readonly Readonly<{path:string;bytes:number;sha256:string}>[];
 readonly evidence:'PROTECTED_READ_SOURCE_ONLY';readonly runtimeVerified:false;readonly executionAuthorized:false;
}

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_APPROVAL_INVALID');};
function exact(value:unknown,keys:readonly string[]){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);return Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>!!descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key]!,'value'));
}
function selectionShape(raw:Readonly<NegativeLinuxApprovalSelection>){
 if(!exact(raw,['schemaVersion','purpose','attemptId','sourceHead','planHash','approvalHash','graphHash'])||!Object.isFrozen(raw)||raw.schemaVersion!==1
  ||raw.purpose!==selectionPurpose||!uuidV1(raw.attemptId)||!/^[a-f0-9]{40}$/.test(raw.sourceHead)||![raw.planHash,raw.approvalHash,raw.graphHash].every(hashV1))invalid();
 return raw;
}
function portsShape(raw:NegativeLinuxApprovalReadPorts){
 const keys=['recipient','now','monotonic','assertCurrent','read'];if(!exact(raw,keys)||!Object.isFrozen(raw))invalid();const d=Object.getOwnPropertyDescriptors(raw),recipient=d.recipient!.value as object;
 if(!recipient||typeof recipient!=='object'||types.isProxy(recipient)||!Object.isFrozen(recipient)||keys.slice(1).some(key=>typeof d[key]!.value!=='function'))invalid();
 return{recipient,now:d.now!.value as NegativeLinuxApprovalReadPorts['now'],monotonic:d.monotonic!.value as NegativeLinuxApprovalReadPorts['monotonic'],
  current:d.assertCurrent!.value as NegativeLinuxApprovalReadPorts['assertCurrent'],read:d.read!.value as NegativeLinuxApprovalReadPorts['read']};
}
function clock(wall:unknown,monotonic:unknown){if(!Number.isSafeInteger(wall)||Number(wall)<0||!Number.isFinite(monotonic)||Number(monotonic)<0)invalid();return{wall:wall as number,monotonic:monotonic as number};}
function owned(raw:unknown,max:number){
 if(!types.isUint8Array(raw)||types.isProxy(raw))invalid();const bytes=raw as Uint8Array;
 if(types.isSharedArrayBuffer(bytes.buffer)||bytes.byteLength<1||bytes.byteLength>max)invalid();return new Uint8Array(bytes);
}
function text(bytes:Uint8Array,max:number){
 if(bytes.byteLength>max)invalid();let value:string;try{value=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{invalid();}
 if(!value!.isWellFormed()||!Buffer.from(value!,'utf8').equals(bytes))invalid();return value!;
}
function json(raw:string,hash:string):Record<string,unknown>{
 if(contentHash(raw)!==hash)invalid();let value:unknown;try{value=parseWireJson(raw);}catch{invalid();}
 if(!value||typeof value!=='object'||Array.isArray(value)||canonicalJson(value)!==raw)invalid();return value as Record<string,unknown>;
}
function exactArray(raw:unknown,length:number):readonly unknown[]{
 if(types.isProxy(raw)||!Array.isArray(raw)||!Object.isFrozen(raw)||raw.length!==length)invalid();const descriptors=Object.getOwnPropertyDescriptors(raw);
 if(Reflect.ownKeys(descriptors).length!==length+1||!Object.hasOwn(descriptors.length!,'value')||descriptors.length!.value!==length)invalid();
 for(let index=0;index<length;index++){const descriptor=descriptors[String(index)];if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))invalid();}
 return raw as readonly unknown[];
}
function namespace(attemptId:string){const compact=attemptId.replaceAll('-','');return Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,
 receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'});}

/**
 * 보호 Linux entry가 공급한 동일 custody read를 검산한다. 이 함수는 POSIX read, 승인 발급, 실행 권위 또는 기한을 만들지 않는다.
 */
export async function verify0076NegativeLinuxApproval(rawSelection:Readonly<NegativeLinuxApprovalSelection>,rawPorts:NegativeLinuxApprovalReadPorts):Promise<Readonly<NegativeLinuxApprovalProjection>>{
 const selection=selectionShape(rawSelection),ports=portsShape(rawPorts),receipt=namespace(selection.attemptId).receipt;
 const paths=Object.freeze([receipt+'-plan.json',receipt+'-approval.json',receipt+'-graph.json',...dependencyPaths]);
 const unchanged=()=>rawPorts.recipient===ports.recipient&&rawPorts.now===ports.now&&rawPorts.monotonic===ports.monotonic&&rawPorts.assertCurrent===ports.current&&rawPorts.read===ports.read;
 const current=()=>{if(!unchanged()||ports.current.call(ports.recipient,selection)!==undefined)invalid();};
 const start=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));current();
 let rawRows:readonly Readonly<NegativeLinuxApprovalReadObservation>[]|undefined;try{rawRows=await ports.read.call(ports.recipient,paths);}catch{invalid();}
 const afterRead=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));if(afterRead.wall<start.wall||afterRead.monotonic<start.monotonic)invalid();current();
 const rows=exactArray(rawRows,paths.length) as readonly Readonly<NegativeLinuxApprovalReadObservation>[];
 const copies:Uint8Array[]=[],identities=new Set<object>();let custody:object|undefined;
 try{
  for(let index=0;index<rows.length;index++){
   const row=rows[index];if(row===undefined)throw Error('IX01_0076_NEGATIVE_LINUX_APPROVAL_INVALID');if(!exact(row,['path','bytes','custody','fileIdentity','closed'])||!Object.isFrozen(row)||row.path!==paths[index]||row.closed!==true)invalid();
   if(!row.custody||typeof row.custody!=='object'||types.isProxy(row.custody)||!Object.isFrozen(row.custody)||custody&&row.custody!==custody)invalid();custody??=row.custody;
   if(!row.fileIdentity||typeof row.fileIdentity!=='object'||types.isProxy(row.fileIdentity)||!Object.isFrozen(row.fileIdentity)||identities.has(row.fileIdentity))invalid();identities.add(row.fileIdentity);
   copies.push(owned(row.bytes,index===0?32768:index===1?16384:index===2?2097152:4194304));
  }
  const planRaw=text(copies[0]!,32768),approvalRaw=text(copies[1]!,16384),graphRaw=text(copies[2]!,2097152);
  const plan=json(planRaw,selection.planHash),approval=json(approvalRaw,selection.approvalHash),graph=json(graphRaw,selection.graphHash),expectedNamespace=namespace(selection.attemptId);
  const planIssuedAt=plan.issuedAt,planExpiresAt=plan.expiresAt;
  if(!recordV1(plan,['schemaVersion','purpose','attemptId','sourceHead','graphHash','issuedAt','expiresAt','namespace','sourceManifestHash','sourceSha256','executionSha256','sentinelSqlHash','catalogSqlHash'])
   ||plan.schemaVersion!==1||plan.purpose!==stageContract.purpose||plan.attemptId!==selection.attemptId||plan.sourceHead!==selection.sourceHead||plan.graphHash!==selection.graphHash
   ||typeof planIssuedAt!=='number'||typeof planExpiresAt!=='number'||!Number.isSafeInteger(planIssuedAt)||!Number.isSafeInteger(planExpiresAt)||planIssuedAt>start.wall||afterRead.wall>=planExpiresAt||planExpiresAt-planIssuedAt>1800000
   ||canonicalJson(plan.namespace)!==canonicalJson(expectedNamespace)||!hashV1(plan.sourceManifestHash)||plan.sourceSha256!==stageContract.sourceSha256
   ||plan.executionSha256!==stageContract.executionSha256||plan.sentinelSqlHash!==stageContract.sentinelSqlHash||plan.catalogSqlHash!==stageContract.catalogSqlHash)invalid();
  const issuedAt=planIssuedAt as number,expiresAt=planExpiresAt as number,lifetime=expiresAt-start.wall;
  if(lifetime<=0||afterRead.monotonic-start.monotonic>=lifetime)invalid();
  if(!recordV1(approval,['schemaVersion','purpose','decision','approvalId','attemptId','sourceHead','planHash','graphHash','issuedAt','expiresAt'])||approval.schemaVersion!==1
   ||approval.purpose!==stageContract.purpose+'_APPROVAL'||approval.decision!=='ALLOW_ONE_ISOLATED_NEGATIVE_STAGE'||!uuidV1(approval.approvalId)
   ||approval.attemptId!==selection.attemptId||approval.sourceHead!==selection.sourceHead||approval.planHash!==selection.planHash||approval.graphHash!==selection.graphHash
   ||approval.issuedAt!==plan.issuedAt||approval.expiresAt!==plan.expiresAt)invalid();
  if(!recordV1(graph,['schemaVersion','sourceHead','files'])||graph.schemaVersion!==1||graph.sourceHead!==selection.sourceHead||!arrayV1(graph.files,1000))invalid();
  let previous='',total=0;const graphRows=new Map<string,{bytes:number;sha256:string}>();for(const value of graph.files as unknown[]){
   if(!value||typeof value!=='object'||types.isProxy(value))invalid();const graphRow=value as Record<string,unknown>;
   if(!recordV1(graphRow,['path','bytes','sha256'])||typeof graphRow.path!=='string'||graphRow.path<=previous||!/^[A-Za-z0-9_@.+/-]{1,400}$/.test(graphRow.path)
    ||graphRow.path.startsWith('/')||graphRow.path.split('/').some(segment=>segment===''||segment==='.'||segment==='..')
    ||typeof graphRow.bytes!=='number'||!Number.isSafeInteger(graphRow.bytes)||graphRow.bytes<0||graphRow.bytes>16777216||!hashV1(graphRow.sha256)||graphRows.has(graphRow.path))invalid();
   const path=graphRow.path as string,bytes=graphRow.bytes as number,sha256=graphRow.sha256 as string;
   total+=bytes;if(total>268435456)invalid();previous=path;graphRows.set(path,{bytes,sha256});
  }
  for(const path of stageContract.graphPaths)if(!graphRows.has(path))invalid();
  const dependencyHashes=dependencyPaths.map((path,index)=>{const bytes=copies[index+3]!,row=graphRows.get(path);if(row===undefined)throw Error('IX01_0076_NEGATIVE_LINUX_APPROVAL_INVALID');if(row.bytes!==bytes.byteLength||row.sha256!==contentHash(bytes))invalid();return Object.freeze({path,bytes:bytes.byteLength,sha256:row.sha256});});
  current();const end=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));if(end.wall<afterRead.wall||end.monotonic<afterRead.monotonic||end.wall>=expiresAt
   ||end.monotonic-start.monotonic>=lifetime||issuedAt>end.wall)invalid();
  return Object.freeze({schemaVersion:1,purpose:verifiedPurpose,attemptId:selection.attemptId,sourceHead:selection.sourceHead,planHash:selection.planHash,
   approvalHash:selection.approvalHash,graphHash:selection.graphHash,dependencyHashes:Object.freeze(dependencyHashes),evidence:'PROTECTED_READ_SOURCE_ONLY',runtimeVerified:false,executionAuthorized:false});
 }finally{for(const bytes of copies)bytes.fill(0);}
}
