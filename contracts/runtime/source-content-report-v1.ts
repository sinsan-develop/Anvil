import {canonicalJson,contentHash,parseWireJson} from '../canonical.ts';
import {recordV1,arrayV1,refV1,uuidV1,hashV1,isoV1,type RuntimeRefV1} from './validation-v1.ts';
import {readSourceContentRequestV1,type SourceContentRequestV1} from './source-content-request-v1.ts';

export interface SourceContentScopeV1 extends SourceContentRequestV1 {
 protocolVersion:1;purpose:'SOURCE_DOCUMENT_CONTENT_HASH';installationId:string;projectId:string;
 hostFingerprint:string;pathHintHash:string;userId:string;clientId:string;credentialGeneration:number;controlGeneration:number;
 basePolicyRef:RuntimeRefV1;contentPolicyRef:RuntimeRefV1;requestedAt:string;
}
export interface SourceContentReportContextV1 {
 scope:SourceContentScopeV1;declaredPathHint:string;requestRef:RuntimeRefV1;observationRequestRef:RuntimeRefV1;observationNonce:string;
 issuedAt:string;observeBefore:string;receivedAt:string;
}
interface Identity {volumeSerialHex:string;fileIdHex:string;reparse:false}
type FailureState='MISSING'|'DENIED'|'CHANGED'|'TOO_LARGE'|'TIMEOUT'|'CANCELLED'|'UNVERIFIED';
interface RootFact extends Identity {declaredRootRef:RuntimeRefV1;kind:'DIRECTORY';canonicalPath:string}
interface FileFact extends Identity {
 kind:'REGULAR_FILE';linkCountDecimal:'1';sizeBytesDecimal:string;lastWriteFileTimeDecimal:string;
 blobHash:string;bytesReadDecimal:string;eof:true;identityBeforeHash:string;identityAfterHash:string;
}
export interface SourceContentReportV1 {
 protocolVersion:1;purpose:'SOURCE_CONTENT_REPORT';commandId:string;installationId:string;projectId:string;
 requestRef:RuntimeRefV1;scopeDigest:string;observationRequestRef:RuntimeRefV1;observationNonce:string;
 connectorRef:RuntimeRefV1;registrationRef:RuntimeRefV1;observerRef:RuntimeRefV1;hostFingerprint:string;
 observedAt:string;finishedAt:string;root:{state:'OBSERVED'|FailureState;facts:RootFact|null;reasonCode:string|null};
 files:{relativePath:string;documentRef:RuntimeRefV1;state:'HASHED'|FailureState;facts:FileFact|null;reasonCode:string|null}[];
 localEvidence:{kind:'NATIVE_CONTENT_HASH_REPORT';observerRef:RuntimeRefV1;ownedProcessRef:RuntimeRefV1;observationRequestRef:RuntimeRefV1;completed:boolean};
 reportHash:string;signature:string;
}
const invalid=():never=>{throw Error('SOURCE_CONTENT_INPUT_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const uint64=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v)&&BigInt(v)<=18446744073709551615n;
const identity=(v:Record<string,any>)=>typeof v.volumeSerialHex==='string'&&/^[0-9a-f]{16}$/.test(v.volumeSerialHex)&&typeof v.fileIdHex==='string'&&/^[0-9a-f]{32}$/.test(v.fileIdHex)&&v.reparse===false;
const encoded=(v:unknown,n:number)=>typeof v==='string'&&/^[A-Za-z0-9_-]+$/.test(v)&&v.length<=256&&Buffer.from(v,'base64url').length===n&&Buffer.from(v,'base64url').toString('base64url')===v;
const requestKeys=['sourceRootRef','connectorRef','registrationRef','observerRef','targets','limits','expiresAt','reason'];
const scopeKeys=[...requestKeys,'protocolVersion','purpose','installationId','projectId','hostFingerprint','pathHintHash','userId','clientId','credentialGeneration','controlGeneration','basePolicyRef','contentPolicyRef','requestedAt'];
const reportKeys=['protocolVersion','purpose','commandId','installationId','projectId','requestRef','scopeDigest','observationRequestRef','observationNonce','connectorRef','registrationRef','observerRef','hostFingerprint','observedAt','finishedAt','root','files','localEvidence','reportHash','signature'];
const reasons:Record<FailureState,readonly string[]>={MISSING:['PATH_NOT_FOUND'],DENIED:['ACCESS_DENIED','REPARSE_DENIED','OUTSIDE_ROOT','NOT_REGULAR_FILE','ROOT_KIND_INVALID','HARDLINK_DENIED'],CHANGED:['IDENTITY_CHANGED','LENGTH_CHANGED'],TOO_LARGE:['FILE_LIMIT_REACHED','TOTAL_LIMIT_REACHED'],TIMEOUT:['TIME_LIMIT_REACHED'],CANCELLED:['CANCEL_REQUESTED'],UNVERIFIED:['OBSERVER_UNAVAILABLE','UNSUPPORTED_FILESYSTEM','ROOT_UNAVAILABLE','NOT_ATTEMPTED']};
function snapshot(v:unknown,max=1048576):unknown {const raw=canonicalJson(v);if(Buffer.byteLength(raw,'utf8')>max)return invalid();return JSON.parse(raw);}
/** 중복 키·크기 검사용 wire 파서다. 반환값의 계약 및 진위는 별도 검사한다. */
export function parseSourceContentWireV1(raw:unknown):unknown {
 try{if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>1048576)return invalid();return parseWireJson(raw);}catch{return invalid();}
}
/** 형태와 원 요청의 유한 경계만 확인하며 현재 로그인/정책/등록 권위는 확인하지 않는다. */
export function readSourceContentScopeV1(value:unknown):SourceContentScopeV1 {
 try {
  const v=snapshot(value);
  if(!recordV1(v,scopeKeys)||v.protocolVersion!==1||v.purpose!=='SOURCE_DOCUMENT_CONTENT_HASH'||!['installationId','projectId','userId','clientId'].every(k=>uuidV1(v[k]))||!['hostFingerprint','pathHintHash'].every(k=>hashV1(v[k]))||!positive(v.credentialGeneration)||!positive(v.controlGeneration)||!refV1(v.basePolicyRef)||!refV1(v.contentPolicyRef)||!isoV1(v.requestedAt))return invalid();
  readSourceContentRequestV1(Object.fromEntries(requestKeys.map(k=>[k,v[k]])),Date.parse(v.requestedAt));
  return v as unknown as SourceContentScopeV1;
 }catch{return invalid();}
}
function failure(v:Record<string,any>):boolean {
 return typeof v.state==='string'&&Object.hasOwn(reasons,v.state)&&v.facts===null&&typeof v.reasonCode==='string'&&reasons[v.state as FailureState].includes(v.reasonCode);
}
/** 주장 보고의 구조/원 context/hash만 검증한다. 서명 진위·OS·nonce 소비·현재 권한/DB·LINK 허가는 만들지 않는다. */
export function readSourceContentReportV1(value:unknown,context:unknown):SourceContentReportV1 {
 try {
  const c=snapshot(context);
  if(!recordV1(c,['scope','declaredPathHint','requestRef','observationRequestRef','observationNonce','issuedAt','observeBefore','receivedAt']))return invalid();
  const scope=readSourceContentScopeV1(c.scope),digest=contentHash(canonicalJson(scope));
  if(typeof c.declaredPathHint!=='string'||!c.declaredPathHint.trim()||c.declaredPathHint.length>4096||/[\u0000-\u001f\u007f]/.test(c.declaredPathHint)||contentHash(c.declaredPathHint)!==scope.pathHintHash)return invalid();
  if(!refV1(c.requestRef)||c.requestRef.version!==1||c.requestRef.contentHash!==digest||!refV1(c.observationRequestRef)||c.observationRequestRef.version!==1||!encoded(c.observationNonce,32)||![c.issuedAt,c.observeBefore,c.receivedAt].every(isoV1))return invalid();
  const issued=Date.parse(c.issuedAt),expires=Date.parse(c.observeBefore),received=Date.parse(c.receivedAt);
  if(issued<Date.parse(scope.requestedAt)||expires<=issued||expires-issued>60000||expires>Date.parse(scope.expiresAt)||received<issued||received>=expires)return invalid();
  const v=snapshot(value,scope.limits.maxReportBytes);
  if(!recordV1(v,reportKeys)||v.protocolVersion!==1||v.purpose!=='SOURCE_CONTENT_REPORT'||!uuidV1(v.commandId)||!hashV1(v.reportHash)||!isoV1(v.observedAt)||!isoV1(v.finishedAt)||!encoded(v.signature,64)||v.installationId!==scope.installationId||v.projectId!==scope.projectId||v.hostFingerprint!==scope.hostFingerprint||v.scopeDigest!==digest||!same(v.requestRef,c.requestRef)||!same(v.observationRequestRef,c.observationRequestRef)||v.observationNonce!==c.observationNonce||!['connectorRef','registrationRef','observerRef'].every(k=>same(v[k],scope[k as 'connectorRef']))||!recordV1(v.root,['state','facts','reasonCode'])||!arrayV1(v.files,200)||v.files.length!==scope.targets.length)return invalid();
  const start=Date.parse(v.observedAt),end=Date.parse(v.finishedAt);
  if(start<issued-5000||start>end||end>received+5000||end>=expires||end-start>scope.limits.maxObservationMs)return invalid();
  const root=v.root;
  if(root.state==='OBSERVED'){
   const f=root.facts;
   // canonical 경로는 원 선언 문자열과 다를 수 있다. 실제 handle 귀속은 별도 verifier의 책임이다.
   if(root.reasonCode!==null||!recordV1(f,['declaredRootRef','kind','canonicalPath','volumeSerialHex','fileIdHex','reparse'])||!same(f.declaredRootRef,scope.sourceRootRef)||f.kind!=='DIRECTORY'||!identity(f)||typeof f.canonicalPath!=='string'||!f.canonicalPath.length||f.canonicalPath.length>4096||/[\u0000-\u001f\u007f]/.test(f.canonicalPath))return invalid();
  }else if(!failure(root))return invalid();
  let total=0,complete=root.state==='OBSERVED',stopped=false;
  for(let i=0;i<v.files.length;i++){
   const file=v.files[i],target=scope.targets[i]!;
   if(!recordV1(file,['relativePath','documentRef','state','facts','reasonCode'])||file.relativePath!==target.relativePath||!same(file.documentRef,target.documentRef))return invalid();
   if(root.state!=='OBSERVED'&&(file.state!=='UNVERIFIED'||file.reasonCode!=='ROOT_UNAVAILABLE'))return invalid();
   if(root.state==='OBSERVED'&&stopped&&(file.state!=='UNVERIFIED'||file.reasonCode!=='NOT_ATTEMPTED'))return invalid();
   if(file.state==='HASHED'){
    const f=file.facts;
    if(file.reasonCode!==null||!recordV1(f,['kind','volumeSerialHex','fileIdHex','reparse','linkCountDecimal','sizeBytesDecimal','lastWriteFileTimeDecimal','blobHash','bytesReadDecimal','eof','identityBeforeHash','identityAfterHash'])||f.kind!=='REGULAR_FILE'||!identity(f)||f.volumeSerialHex!==root.facts.volumeSerialHex||f.linkCountDecimal!=='1'||!uint64(f.sizeBytesDecimal)||!uint64(f.lastWriteFileTimeDecimal)||f.bytesReadDecimal!==f.sizeBytesDecimal||f.eof!==true||!hashV1(f.blobHash)||!hashV1(f.identityBeforeHash)||f.identityBeforeHash!==f.identityAfterHash)return invalid();
    const original={kind:f.kind,volumeSerialHex:f.volumeSerialHex,fileIdHex:f.fileIdHex,reparse:f.reparse,linkCountDecimal:f.linkCountDecimal,sizeBytesDecimal:f.sizeBytesDecimal,lastWriteFileTimeDecimal:f.lastWriteFileTimeDecimal};
    if(contentHash(canonicalJson(original))!==f.identityBeforeHash||BigInt(f.sizeBytesDecimal)>BigInt(scope.limits.maxFileBytes))return invalid();
    total+=Number(f.sizeBytesDecimal);if(total>scope.limits.maxTotalBytes)return invalid();
   }else {if(!failure(file))return invalid();complete=false;stopped=true;}
  }
  const e=v.localEvidence;
  if(!recordV1(e,['kind','observerRef','ownedProcessRef','observationRequestRef','completed'])||e.kind!=='NATIVE_CONTENT_HASH_REPORT'||!same(e.observerRef,scope.observerRef)||!refV1(e.ownedProcessRef)||!same(e.observationRequestRef,c.observationRequestRef)||e.completed!==complete)return invalid();
  const {signature,reportHash,...unsigned}=v;
  if(contentHash(canonicalJson(unsigned))!==reportHash)return invalid();
  return v as unknown as SourceContentReportV1;
 }catch{return invalid();}
}
/** 새 domain의 서명 입력 바이트만 생성한다. 키 사용·서명·서명 검증·허가 발행을 하지 않는다. */
export function sourceContentReportProofBytesV1(value:unknown,context:SourceContentReportContextV1):Buffer {
 try {
 const c=snapshot(context) as SourceContentReportContextV1,report=readSourceContentReportV1(value,c),s=c.scope;
 const proof={protocolVersion:1,purpose:'SOURCE_CONTENT_REPORT_PROOF',installationId:s.installationId,projectId:s.projectId,connectorRef:s.connectorRef,registrationRef:s.registrationRef,observerRef:s.observerRef,requestRef:c.requestRef,scopeDigest:c.requestRef.contentHash,observationRequestRef:c.observationRequestRef,observationNonce:c.observationNonce,reportHash:report.reportHash};
 return Buffer.concat([Buffer.from('ANVIL_SOURCE_CONTENT_REPORT_V1\0','ascii'),Buffer.from(canonicalJson(proof),'utf8')]);
 }catch{return invalid();}
}
