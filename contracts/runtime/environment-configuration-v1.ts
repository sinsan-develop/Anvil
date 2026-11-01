import {canonicalJson,contentHash} from '../canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,hashV1,type RuntimeRefV1} from './validation-v1.ts';
import {isRelativeSourceFileV1} from './source-scope-v1.ts';
export type EnvironmentKind='ENVIRONMENT_HOST_DECLARATION'|'COMMAND_PROFILE_METADATA'|'SECRET_REFERENCE_METADATA'|'ENVIRONMENT_VERSION';
export type MetadataKind=Exclude<EnvironmentKind,'ENVIRONMENT_VERSION'>;
export type HostRef={kind:'CONNECTOR_STATUS';connectorRef:RuntimeRefV1;registrationRef:RuntimeRefV1}|{kind:'HOST_DECLARATION';ref:RuntimeRefV1};
export type MetadataRef={kind:'COMMAND_PROFILE_METADATA'|'SECRET_REFERENCE_METADATA';ref:RuntimeRefV1};
export type PathRef={kind:'SOURCE_ROOT_DECLARATION';sourceRootRef:RuntimeRefV1;hostRef:HostRef}|{kind:'SOURCE_SNAPSHOT_ROOT_PATH';snapshotRef:RuntimeRefV1;hostRef:HostRef};
export interface EnvironmentSourceRoot{sourceRootId:string;hostId:string;displayLabel:string;registeredPathRef:PathRef;identityRef:{kind:'SOURCE_SNAPSHOT_ROOT_IDENTITY';snapshotRef:RuntimeRefV1}|null;permissionScope:{kind:'REQUESTED_SCOPE';targets:{relativePath:string;kind:'FILE';access:'READ'|'WRITE';recursive:false}[]}}
export interface EnvironmentInput{sourceRoots:EnvironmentSourceRoot[];executionHostRef:HostRef;targetHostRefs:HostRef[];commandProfileRefs:{kind:'COMMAND_PROFILE_METADATA';ref:RuntimeRefV1}[];secretRefs:{kind:'SECRET_REFERENCE_METADATA';ref:RuntimeRefV1}[];policyRef:RuntimeRefV1}
export interface EnvironmentVersion extends EnvironmentInput{id:string;version:number;contentHash:string}
export interface MetadataSnapshot{id:string;version:number;status:'DECLARED'|'REVOKED';definition:Record<string,any>}
export const environmentOperations={ENVIRONMENT_HOST_DECLARATION:{save:'saveEnvironmentHostDeclaration',revoke:'revokeEnvironmentHostDeclaration',read:'readEnvironmentHostDeclaration',collection:'environment-host-declarations'},COMMAND_PROFILE_METADATA:{save:'saveCommandProfileMetadata',revoke:'revokeCommandProfileMetadata',read:'readCommandProfileMetadata',collection:'command-profile-metadata'},SECRET_REFERENCE_METADATA:{save:'saveSecretReferenceMetadata',revoke:'revokeSecretReferenceMetadata',read:'readSecretReferenceMetadata',collection:'secret-reference-metadata'},ENVIRONMENT_VERSION:{save:'saveEnvironment',revoke:null,read:'readEnvironmentVersion',collection:'environments'}} as const;
export const environmentWriteOperations=Object.values(environmentOperations).flatMap(v=>v.revoke?[v.save,v.revoke]:[v.save]);
export const environmentReadOperations=Object.values(environmentOperations).map(v=>v.read);
export function environmentHash(v:unknown){return contentHash(canonicalJson(v));}
export function environmentInputFailure():never{throw Error('ENVIRONMENT_INPUT_INVALID');}
const fail=environmentInputFailure;
export const environmentText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.isWellFormed()&&v.length>0&&v.length<=max&&!!v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);
const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(v);
const arr=(v:unknown,max:number,min=0):v is any[]=>Array.isArray(v)&&v.length>=min&&v.length<=max;
const unique=(v:any[],key:(v:any)=>string)=>new Set(v.map(key)).size===v.length;
export function hostId(v:HostRef){return v.kind==='CONNECTOR_STATUS'?v.connectorRef.id:v.ref.id;}
export function readEnvironmentHostRef(v:unknown):HostRef{if(recordV1(v,['kind','connectorRef','registrationRef'])&&v.kind==='CONNECTOR_STATUS'&&refV1(v.connectorRef)&&refV1(v.registrationRef))return cloneV1(v) as HostRef;if(recordV1(v,['kind','ref'])&&v.kind==='HOST_DECLARATION'&&refV1(v.ref))return cloneV1(v) as HostRef;return fail();}
function metadataRef(v:any,kind:MetadataRef['kind']){if(!recordV1(v,['kind','ref'])||v.kind!==kind||!refV1(v.ref))fail();return cloneV1(v);}
export function readEnvironmentResourceDefinition(kind:MetadataKind,raw:unknown):Record<string,any>{const v=cloneV1(raw) as Record<string,any>;
 if(kind==='ENVIRONMENT_HOST_DECLARATION'){
  if(!recordV1(v,['label','hostKind','parentHostRef','endpointLabel','policyRef'])||!environmentText(v.label,200)||!['MACHINE','WSL_DISTRIBUTION','REMOTE_TARGET'].includes(v.hostKind)||!refV1(v.policyRef))fail();
  if(v.hostKind==='WSL_DISTRIBUTION'){readEnvironmentHostRef(v.parentHostRef);if(!environmentText(v.endpointLabel,200))fail();}
  else if(v.parentHostRef!==null||v.hostKind==='REMOTE_TARGET'&&!environmentText(v.endpointLabel,200)||v.hostKind==='MACHINE'&&v.endpointLabel!==null&&!environmentText(v.endpointLabel,200))fail();
 }else if(kind==='SECRET_REFERENCE_METADATA'){
  if(!recordV1(v,['label','hostRef','providerKind','logicalName','purpose','policyRef'])||!environmentText(v.label,200)||!environmentText(v.purpose,2000)||v.providerKind!=='EXECUTOR_MANAGED'||!identifier(v.logicalName)||!refV1(v.policyRef))fail();readEnvironmentHostRef(v.hostRef);
 }else if(kind==='COMMAND_PROFILE_METADATA'){
  if(!recordV1(v,['label','purpose','hostRef','toolRequirements','program','argsTemplate','workingDirectory','secretSlots','policyRef'])||!environmentText(v.label,200)||!environmentText(v.purpose,2000)||!environmentText(v.program,200)||!refV1(v.policyRef)||!arr(v.toolRequirements,20,1)||!arr(v.argsTemplate,200)||!arr(v.secretSlots,50)||!recordV1(v.workingDirectory,['sourceRootRef','relativeDirectory'])||!refV1(v.workingDirectory.sourceRootRef)||v.workingDirectory.relativeDirectory!==null&&!isRelativeSourceFileV1(v.workingDirectory.relativeDirectory))fail();readEnvironmentHostRef(v.hostRef);
  if(v.toolRequirements.some((t:any)=>!recordV1(t,['product','versionRequirement'])||!environmentText(t.product,200)||!environmentText(t.versionRequirement,200))||!unique(v.toolRequirements,t=>t.product))fail();
  for(const slot of v.secretSlots){if(!recordV1(slot,['name','secretRef'])||!identifier(slot.name))fail();metadataRef(slot.secretRef,'SECRET_REFERENCE_METADATA');}
  if(!unique(v.secretSlots,s=>s.name))fail();const used=new Set<string>();for(const a of v.argsTemplate){if(recordV1(a,['kind','value'])&&a.kind==='LITERAL'){if(typeof a.value!=='string'||!a.value.isWellFormed()||a.value.length>4096||/[\u0000-\u001f\u007f]/.test(a.value))fail();}else if(recordV1(a,['kind','name'])&&a.kind==='SECRET_SLOT'&&identifier(a.name)){used.add(a.name);}else fail();}
  if(used.size!==v.secretSlots.length||v.secretSlots.some((s:any)=>!used.has(s.name)))fail();
 }else fail();if(Buffer.byteLength(canonicalJson(v))>2097152)fail();return v;
}
export function readEnvironmentInput(raw:unknown):EnvironmentInput{const v=cloneV1(raw) as any;
 if(!recordV1(v,['sourceRoots','executionHostRef','targetHostRefs','commandProfileRefs','secretRefs','policyRef'])||!refV1(v.policyRef)||!arr(v.sourceRoots,200,1)||!arr(v.targetHostRefs,200)||!arr(v.commandProfileRefs,200,1)||!arr(v.secretRefs,200))fail();readEnvironmentHostRef(v.executionHostRef);v.targetHostRefs.forEach(readEnvironmentHostRef);
 if(!unique(v.targetHostRefs,hostId)||!unique(v.sourceRoots,r=>r.sourceRootId)||!unique(v.commandProfileRefs,r=>r?.ref?.id)||!unique(v.secretRefs,r=>r?.ref?.id))fail();v.commandProfileRefs.forEach((r:any)=>metadataRef(r,'COMMAND_PROFILE_METADATA'));v.secretRefs.forEach((r:any)=>metadataRef(r,'SECRET_REFERENCE_METADATA'));let total=0;
 for(const r of v.sourceRoots){if(!recordV1(r,['sourceRootId','hostId','displayLabel','registeredPathRef','identityRef','permissionScope'])||!uuidV1(r.sourceRootId)||!uuidV1(r.hostId)||!environmentText(r.displayLabel,200))fail();const p=r.registeredPathRef;
  if(recordV1(p,['kind','sourceRootRef','hostRef'])&&p.kind==='SOURCE_ROOT_DECLARATION'){if(!refV1(p.sourceRootRef)||p.sourceRootRef.id!==r.sourceRootId)fail();}else if(recordV1(p,['kind','snapshotRef','hostRef'])&&p.kind==='SOURCE_SNAPSHOT_ROOT_PATH'){if(!refV1(p.snapshotRef)||p.snapshotRef.version!==1)fail();}else fail();if(hostId(readEnvironmentHostRef(p.hostRef))!==r.hostId)fail();
  if(r.identityRef!==null&&(!recordV1(r.identityRef,['kind','snapshotRef'])||r.identityRef.kind!=='SOURCE_SNAPSHOT_ROOT_IDENTITY'||!refV1(r.identityRef.snapshotRef)||r.identityRef.snapshotRef.version!==1))fail();if(p.kind==='SOURCE_SNAPSHOT_ROOT_PATH'&&r.identityRef!==null&&canonicalJson(p.snapshotRef)!==canonicalJson(r.identityRef.snapshotRef))fail();
  const scope=r.permissionScope;if(!recordV1(scope,['kind','targets'])||scope.kind!=='REQUESTED_SCOPE'||!arr(scope.targets,200,1)||!unique(scope.targets,t=>String(t?.relativePath).toUpperCase()))fail();for(const t of scope.targets)if(++total>200||!recordV1(t,['relativePath','kind','access','recursive'])||!isRelativeSourceFileV1(t.relativePath)||t.kind!=='FILE'||!['READ','WRITE'].includes(t.access)||t.recursive!==false)fail();
 }if(Buffer.byteLength(canonicalJson(v))>2097152)fail();return v;
}
export function readStoredEnvironment(raw:unknown):EnvironmentVersion{const v:any=raw;if(!recordV1(v,['id','version','sourceRoots','executionHostRef','targetHostRefs','commandProfileRefs','secretRefs','policyRef','contentHash'])||!uuidV1(v.id)||!Number.isSafeInteger(v.version)||Number(v.version)<1||!hashV1(v.contentHash))fail();const {id,version,contentHash:given,...input}=v;readEnvironmentInput(input);const {contentHash:_hash,...body}=v;if(environmentHash(body)!==given)fail();return cloneV1(v) as EnvironmentVersion;}
export function readStoredEnvironmentResource(kind:MetadataKind,raw:unknown):MetadataSnapshot{const v:any=raw;if(!recordV1(v,['id','version','status','definition'])||!uuidV1(v.id)||!Number.isSafeInteger(v.version)||Number(v.version)<1||!['DECLARED','REVOKED'].includes(String(v.status))||typeof v.status!=='string')fail();readEnvironmentResourceDefinition(kind,v.definition);return cloneV1(v) as MetadataSnapshot;}
export function environmentKindForOperation(op:string):EnvironmentKind|null{return(Object.keys(environmentOperations) as EnvironmentKind[]).find(k=>environmentOperations[k].save===op||environmentOperations[k].revoke===op)??null;}
