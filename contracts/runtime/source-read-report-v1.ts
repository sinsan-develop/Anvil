import {canonicalJson,contentHash} from '../canonical.ts';
import {arrayV1,recordV1,refV1,uuidV1,hashV1,isoV1,cloneV1,type RuntimeRefV1} from './validation-v1.ts';
import {readSourceReadScopeV1,sourceReadBase64V1,type SourceReadScopeV1} from './source-read-observation-v1.ts';
export interface SourceReadReportContextV1{scope:SourceReadScopeV1;grantRef:RuntimeRefV1;credentialIssuedAt:string;credentialExpiresAt:string;receivedAt:string}
interface IdentityFacts{volumeSerialHex:string;fileIdHex:string;reparse:false}
export type SourceReadItemStateV1='OBSERVED'|'MISSING'|'DENIED'|'CHANGED'|'UNVERIFIED';
export interface SourceReadReportV1{protocolVersion:1;commandId:string;grantRef:RuntimeRefV1;scopeDigest:string;connectorRef:RuntimeRefV1;hostFingerprint:string;observedAt:string;finishedAt:string;root:{state:SourceReadItemStateV1;facts:(IdentityFacts&{declaredRootRef:RuntimeRefV1;kind:'DIRECTORY';canonicalPath:string})|null;reasonCode:string|null};files:{relativePath:string;state:SourceReadItemStateV1;facts:(IdentityFacts&{kind:'REGULAR_FILE';sizeBytesDecimal:string;lastWriteFileTimeDecimal:string})|null;reasonCode:string|null}[];localEvidence:{kind:'NATIVE_METADATA_REPORT'|'OBSERVER_UNAVAILABLE';observerProtocolVersion:1;observerImageHash:string|null;ownedProcessRef:RuntimeRefV1|null};contentHash:string;signature:string}
const fail=():never=>{throw Error('SOURCE_READ_INPUT_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const identity=(v:Record<string,any>)=>typeof v.volumeSerialHex==='string'&&/^[0-9a-f]{16}$/.test(v.volumeSerialHex)&&typeof v.fileIdHex==='string'&&/^[0-9a-f]{32}$/.test(v.fileIdHex)&&v.reparse===false;
const uint64=(v:unknown)=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const reasons:Record<string,readonly string[]>={MISSING:['PATH_NOT_FOUND'],DENIED:['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','NOT_REGULAR_FILE'],CHANGED:['IDENTITY_CHANGED'],UNVERIFIED:['OBSERVER_UNAVAILABLE','UNSUPPORTED_FILESYSTEM','TIME_LIMIT_REACHED','ROOT_UNAVAILABLE']};
function state(v:Record<string,any>,root=false){if(typeof v.state!=='string')return false;if(v.state==='OBSERVED')return v.reasonCode===null&&v.facts!==null;if(v.facts!==null||typeof v.reasonCode!=='string'||!Object.hasOwn(reasons,v.state))return false;const allowed=root&&v.state==='DENIED'?['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','ROOT_KIND_INVALID']:reasons[v.state]!;return allowed.includes(v.reasonCode);}
/** 구조·해시·주장 시각의 검증이며 OS/서명/현재권한·baseline 검증과는 별개다. */
export function readSourceReadReportV1(value:unknown,context:SourceReadReportContextV1):SourceReadReportV1{
 if(!recordV1(value,['protocolVersion','commandId','grantRef','scopeDigest','connectorRef','hostFingerprint','observedAt','finishedAt','root','files','localEvidence','contentHash','signature'])||value.protocolVersion!==1||!uuidV1(value.commandId)||!refV1(value.grantRef)||value.grantRef.version!==1||!hashV1(value.scopeDigest)||!refV1(value.connectorRef)||!hashV1(value.hostFingerprint)||!isoV1(value.observedAt)||!isoV1(value.finishedAt)||!hashV1(value.contentHash)||!recordV1(value.root,['state','facts','reasonCode'])||!state(value.root,true)||!arrayV1(value.files,200)||!recordV1(value.localEvidence,['kind','observerProtocolVersion','observerImageHash','ownedProcessRef']))return fail();
 const scope=readSourceReadScopeV1(context?.scope),root=value.root,e=value.localEvidence;
 if(!refV1(context.grantRef)||context.grantRef.version!==1||context.grantRef.contentHash!==contentHash(canonicalJson(scope))||!same(value.grantRef,context.grantRef)||value.scopeDigest!==context.grantRef.contentHash||!same(value.connectorRef,scope.connectorRef)||value.hostFingerprint!==scope.hostFingerprint||value.files.length!==scope.targets.length)return fail();
 if(root.state==='OBSERVED'){const f=root.facts;if(!recordV1(f,['declaredRootRef','kind','canonicalPath','volumeSerialHex','fileIdHex','reparse'])||!refV1(f.declaredRootRef)||!same(f.declaredRootRef,scope.sourceRootRef)||f.kind!=='DIRECTORY'||!identity(f)||typeof f.canonicalPath!=='string'||!f.canonicalPath.trim()||f.canonicalPath.length>4096||!f.canonicalPath.isWellFormed()||/[\u0000-\u001f\u007f]/.test(f.canonicalPath))return fail();}
 for(let i=0;i<value.files.length;i++){
  const file=value.files[i];if(!recordV1(file,['relativePath','state','facts','reasonCode'])||file.relativePath!==scope.targets[i]!.relativePath||!state(file))return fail();
  if(root.state!=='OBSERVED'&&(file.state!=='UNVERIFIED'||file.reasonCode!=='ROOT_UNAVAILABLE'))return fail();
  if(file.state==='OBSERVED'){const f=file.facts;if(!recordV1(f,['kind','volumeSerialHex','fileIdHex','sizeBytesDecimal','lastWriteFileTimeDecimal','reparse'])||f.kind!=='REGULAR_FILE'||!identity(f)||!uint64(f.sizeBytesDecimal)||!uint64(f.lastWriteFileTimeDecimal)||f.volumeSerialHex!==root.facts.volumeSerialHex)return fail();}
 }
 if(!['NATIVE_METADATA_REPORT','OBSERVER_UNAVAILABLE'].includes(e.kind)||e.observerProtocolVersion!==1||e.observerImageHash!==null&&!hashV1(e.observerImageHash)||e.ownedProcessRef!==null&&!refV1(e.ownedProcessRef)||e.kind==='OBSERVER_UNAVAILABLE'&&(e.observerImageHash!==null||e.ownedProcessRef!==null||root.state!=='UNVERIFIED'||root.reasonCode!=='OBSERVER_UNAVAILABLE'))return fail();
 sourceReadBase64V1(value.signature,64);
 if(![context.credentialIssuedAt,context.credentialExpiresAt,context.receivedAt].every(isoV1))return fail();
 const issued=Date.parse(context.credentialIssuedAt),expires=Date.parse(context.credentialExpiresAt),received=Date.parse(context.receivedAt),start=Date.parse(value.observedAt),end=Date.parse(value.finishedAt);
 if(issued<Date.parse(scope.requestedAt)||expires<=issued||expires-issued>300000||expires>Date.parse(scope.expiresAt)||received<issued)return fail();
 if(received>=expires||received>=Date.parse(scope.expiresAt))throw Error('SOURCE_READ_EXPIRED');
 if(start<issued-30000||start>end||end>received+30000||end-start>30000)throw Error('SOURCE_READ_TIME_INVALID');
 const {signature,contentHash:hash,...unsigned}=value;if(Buffer.byteLength(canonicalJson(value),'utf8')>1024*1024||contentHash(canonicalJson(unsigned))!==hash)return fail();
 return cloneV1(value) as unknown as SourceReadReportV1;
}
export function sourceReadReportProofBytesV1(value:unknown,context:SourceReadReportContextV1):Buffer{
 const report=readSourceReadReportV1(value,context),s=context.scope;
 return Buffer.from('ANVIL_V3_SOURCE_READ_RESULT\n'+canonicalJson({protocolVersion:1,purpose:'SOURCE_READ_RESULT',installationId:s.installationId,projectId:s.projectId,connectorId:s.connectorRef.id,connectorGeneration:s.connectorRef.version,grantRef:context.grantRef,scopeDigest:report.scopeDigest,contentHash:report.contentHash}),'utf8');
}
