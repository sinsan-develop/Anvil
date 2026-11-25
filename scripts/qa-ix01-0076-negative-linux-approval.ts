import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {arrayV1,hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {readCurrentSchemaManifest,verifyCurrentSchemaSources} from '../tests/integration/IX01/current-schema-baseline.ts';
import {current0076NegativeContract as stageContract,type NegativeStageInput} from './qa-ix01-0076-atomicity-negative.ts';

const selectionPurpose='IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION' as const;
const verifiedPurpose='IX01_0076_NEGATIVE_LINUX_APPROVAL_VERIFIED' as const;
const dependencyPaths=Object.freeze([
 'contracts/canonical.ts',
 'contracts/runtime/validation-v1.ts',
 'scripts/qa-ix01-current-journey.ts',
 'scripts/qa-ix01-0076-atomicity-negative.ts',
 'scripts/qa-ix01-0076-negative-claim.ts',
 'scripts/qa-ix01-0076-atomicity-negative-receiver.ts',
 'scripts/qa-ix01-0076-negative-psql.ts',
 'scripts/qa-ix01-0076-negative-linux-process.ts',
 'scripts/qa-ix01-0076-negative-linux-approval.ts',
 'scripts/qa-ix01-0076-negative-linux-protected-reader.ts',
 'scripts/qa-ix01-0076-negative-linux-journal.ts',
 'scripts/qa-ix01-0076-negative-linux-entry.ts',
 'scripts/qa-ix01-0076-negative-linux-host.ts',
 'scripts/qa-ix01-0076-negative-linux-r9.ts',
 'scripts/qa-ix01-0076-negative-linux-container.ts',
 'scripts/qa-ix01-0076-negative-linux-docker.ts',
 'scripts/qa-ix01-0076-negative-linux-native-docker.ts',
 'scripts/qa-ix01-0076-negative-linux-schema-stage.ts',
 'tests/integration/IX01/current-schema-baseline.ts',
 'tests/integration/IX01/current-schema-installation.ts',
] as const);
const protectedSourcePaths=Object.freeze([...dependencyPaths,stageContract.parserPath] as const);
const manifestPath='docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv' as const;
const manifestBytes=15807,manifestSha256='0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd';
export const current0076NegativeLinuxApprovalContract=Object.freeze({selectionPurpose,verifiedPurpose,dependencyPaths,protectedSourcePaths,manifestPath,manifestBytes,manifestSha256,
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

const protectedInputs=new WeakMap<object,Readonly<{input:Readonly<NegativeStageInput>;r9:Uint8Array;fresh:()=>void}>>();

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
 const paths=Object.freeze([receipt+'-plan.json',receipt+'-approval.json',receipt+'-graph.json',...protectedSourcePaths,manifestPath]);
 const unchanged=()=>rawPorts.recipient===ports.recipient&&rawPorts.now===ports.now&&rawPorts.monotonic===ports.monotonic&&rawPorts.assertCurrent===ports.current&&rawPorts.read===ports.read;
 const current=()=>{if(!unchanged()||ports.current.call(ports.recipient,selection)!==undefined)invalid();};
 const start=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));current();
 let rawRows:readonly Readonly<NegativeLinuxApprovalReadObservation>[]|undefined;try{rawRows=await ports.read.call(ports.recipient,paths);}catch{invalid();}
 const afterRead=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));if(afterRead.wall<start.wall||afterRead.monotonic<start.monotonic)invalid();current();
 const copies:Uint8Array[]=[],sourceCopies:Uint8Array[]=[],identities=new Set<object>();let custody:object|undefined;
 const collect=(raw:unknown,expected:readonly string[],limits:readonly number[],target:Uint8Array[])=>{
  const rows=exactArray(raw,expected.length) as readonly Readonly<NegativeLinuxApprovalReadObservation>[];
  for(let index=0;index<rows.length;index++){
   const row=rows[index]!;
   if(!exact(row,['path','bytes','custody','fileIdentity','closed'])||!Object.isFrozen(row)||row.path!==expected[index]||row.closed!==true)invalid();
   if(!row.custody||typeof row.custody!=='object'||types.isProxy(row.custody)||!Object.isFrozen(row.custody)||custody&&row.custody!==custody)invalid();custody??=row.custody;
   if(!row.fileIdentity||typeof row.fileIdentity!=='object'||types.isProxy(row.fileIdentity)||!Object.isFrozen(row.fileIdentity)||identities.has(row.fileIdentity))invalid();identities.add(row.fileIdentity);
   target.push(owned(row.bytes,limits[index]!));
  }
 };
 try{
   collect(rawRows,paths,Object.freeze([32768,16384,2097152,...dependencyPaths.map(()=>4194304),35588,manifestBytes]),copies);
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
   const r9=copies[3+dependencyPaths.length]!,r9Row=graphRows.get(stageContract.parserPath);
   if(r9.byteLength!==35588||contentHash(r9)!==stageContract.parserSourceSha256||r9Row?.bytes!==r9.byteLength||r9Row.sha256!==stageContract.parserSourceSha256)invalid();
   const manifest=copies[4+dependencyPaths.length]!;if(manifest.byteLength!==manifestBytes||contentHash(manifest)!==manifestSha256)invalid();
  const manifestRows=readCurrentSchemaManifest(manifest);if(manifestRows.length!==130||plan.sourceManifestHash!==contentHash(canonicalJson(manifestRows)))invalid();
  const sourcePaths=Object.freeze(manifestRows.map(row=>row.path));current();let rawSources:readonly Readonly<NegativeLinuxApprovalReadObservation>[]|undefined;
  try{rawSources=await ports.read.call(ports.recipient,sourcePaths);}catch{invalid();}
  const afterSources=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));if(afterSources.wall<afterRead.wall||afterSources.monotonic<afterRead.monotonic||afterSources.wall>=expiresAt
   ||afterSources.monotonic-start.monotonic>=lifetime)invalid();current();
  collect(rawSources,sourcePaths,manifestRows.map(row=>row.bytes),sourceCopies);
  const sourceInput=Object.freeze(manifestRows.map((row,index)=>Object.freeze({id:row.id,path:row.path,bytes:sourceCopies[index]!})));
  const verifiedRows=verifyCurrentSchemaSources(manifest,sourceInput);if(verifiedRows.length!==130||verifiedRows[106]?.id!==stageContract.sourceId)invalid();
  current();const end=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));if(end.wall<afterSources.wall||end.monotonic<afterSources.monotonic||end.wall>=expiresAt
   ||end.monotonic-start.monotonic>=lifetime||issuedAt>end.wall)invalid();
  const projection=Object.freeze({schemaVersion:1,purpose:verifiedPurpose,attemptId:selection.attemptId,sourceHead:selection.sourceHead,planHash:selection.planHash,
   approvalHash:selection.approvalHash,graphHash:selection.graphHash,dependencyHashes:Object.freeze(dependencyHashes),evidence:'PROTECTED_READ_SOURCE_ONLY',runtimeVerified:false,executionAuthorized:false});
  const input=Object.freeze({planRaw,planHash:selection.planHash,approvalRaw,approvalHash:selection.approvalHash,graphRaw,historicalTsv:new Uint8Array(manifest),
   sql:Object.freeze(manifestRows.map((row,index)=>Object.freeze({id:row.id,path:row.path,bytes:new Uint8Array(sourceCopies[index]!)})))}) satisfies Readonly<NegativeStageInput>;
  const fresh=()=>{current();const found=clock(ports.now.call(ports.recipient),ports.monotonic.call(ports.recipient));
   if(found.wall<end.wall||found.monotonic<end.monotonic||found.wall>=expiresAt||found.monotonic-start.monotonic>=lifetime)invalid();};
   protectedInputs.set(projection,Object.freeze({input,r9:new Uint8Array(r9),fresh}));return projection;
 }finally{for(const bytes of [...copies,...sourceCopies])bytes.fill(0);}
}

/** 다음 보호 entry가 동일 승인 projection의 원 입력을 한 번만 소비한다. callback 종료 뒤 byte 입력은 즉시 지운다. */
export async function use0076NegativeLinuxProtectedStageInput<T>(projection:Readonly<NegativeLinuxApprovalProjection>,consume:(input:Readonly<NegativeStageInput>,fresh:()=>void,r9:Uint8Array)=>Promise<T>):Promise<T>{
 const retained=protectedInputs.get(projection);if(retained===undefined||typeof consume!=='function')throw Error('IX01_0076_NEGATIVE_LINUX_APPROVAL_INVALID');protectedInputs.delete(projection);const {input,r9}=retained;
 try{retained.fresh();return await consume(input,retained.fresh,r9);}finally{r9.fill(0);input.historicalTsv.fill(0);for(const row of input.sql)row.bytes.fill(0);}
}
