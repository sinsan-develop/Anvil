import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,hashV1,refV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

/** 내부 구조화 DTO 전용. 외부 입력 parser·저장·권한·복원 연결은 제공하지 않는다. */
export type HistoryJson=null|boolean|number|string|readonly HistoryJson[]|{readonly[key:string]:HistoryJson};
export interface DocumentHistoryNamespace{readonly kind:'ANVIL_DOCUMENT_HISTORY_NAMESPACE_V1';readonly originProjectId:string;readonly sourceManifestHash:string}
export interface DocumentHistoryRef{readonly kind:'ANVIL_DOCUMENT_HISTORY_REF_V1';readonly namespaceHash:string;readonly originalRef:Readonly<RuntimeRefV1>;readonly recordHash:string}
export interface HistoryArtifactRef{readonly artifactId:string;readonly bytes:number;readonly contentHash:string;readonly mediaType:string}
export interface HistorySection{readonly itemId:string;readonly anchor:string}
export interface HistoryDocumentContent{readonly body:HistoryArtifactRef;readonly attachments:readonly HistoryArtifactRef[];readonly sections:readonly HistorySection[];readonly sourceRefs:readonly HistoryJson[]}
export interface DocumentHistoryRecord{
 readonly projectId:string;readonly documentId:string;readonly version:number;readonly formRef:Readonly<RuntimeRefV1>;
 readonly stageNodeRef:null|{readonly applicationId:string;readonly nodeId:string};readonly bodyArtifactId:string;readonly title:string;
 readonly sourceRefs:readonly HistoryJson[];readonly content:HistoryDocumentContent;readonly contentHash:string;readonly sections:readonly HistorySection[];
 readonly authorRef:{readonly kind:'HUMAN';readonly userId:string};readonly validation:HistoryJson;readonly reason:string;
 readonly clientId:string;readonly commandRecordId:string;readonly createdAt:string;
}
export interface HistoricalUserRef{readonly kind:'HISTORICAL_USER_REF_V1';readonly namespaceHash:string;readonly userId:string}
export interface HistoricalClientRef{readonly kind:'HISTORICAL_CLIENT_REF_V1';readonly namespaceHash:string;readonly userId:string;readonly clientId:string}
export type HistoryEvidenceKind='DOCUMENT_HEAD'|'FORM_VERSION'|'METHODOLOGY_APPLICATION'|'ARTIFACT_METADATA'|'DOCUMENT_ARTIFACT_LINK'|'PROJECT_COMMAND'|'AUTHORIZATION_RECEIPT'|'AUDIT_EVENT'|'PRINCIPAL_LINK';
export interface DocumentHistoryEvidenceRef{readonly kind:'SOURCE_HISTORY_EVIDENCE_REF_V1';readonly namespaceHash:string;readonly recordKind:HistoryEvidenceKind;readonly key:readonly(string|number)[];readonly recordHash:string}
export interface DocumentDerivationSlot{readonly kind:'DOCUMENT_DERIVATION_SLOT_V1';readonly sourceHistoryRef:DocumentHistoryRef;readonly currentAccountLink:null;readonly derivedRef:null;readonly state:'NOT_CREATED_UNSUPPORTED'}
export interface DocumentHistoryEnvelope{
 readonly kind:'ANVIL_DOCUMENT_HISTORY_ENVELOPE_V1';readonly namespace:DocumentHistoryNamespace;readonly namespaceHash:string;
 readonly recordSchema:'DOCUMENT_VERSION_PROJECTION_V1';readonly originalRef:Readonly<RuntimeRefV1>;readonly originalRecord:DocumentHistoryRecord;readonly recordHash:string;
 readonly principals:{readonly user:HistoricalUserRef;readonly client:HistoricalClientRef};readonly evidenceRefs:readonly DocumentHistoryEvidenceRef[];readonly derivation:DocumentDerivationSlot;
}
export type DocumentHistoryCheck='NOT_RUN'|'VERIFIED'|'MISSING'|'UNSUPPORTED'|'MISMATCH';
export interface DocumentHistoryChecks{readonly sourceBinding:DocumentHistoryCheck;readonly recordHash:DocumentHistoryCheck;readonly documentContentHash:DocumentHistoryCheck;readonly principalRelation:DocumentHistoryCheck;readonly formStageRelations:DocumentHistoryCheck;readonly artifactLinks:DocumentHistoryCheck;readonly commandReceiptAudit:DocumentHistoryCheck;readonly artifactBytes:DocumentHistoryCheck}
export type DocumentHistoryState='INVALID'|'ENVELOPE_ONLY'|'INCOMPLETE'|'SOURCE_UNVERIFIED'|'HISTORICAL_DOCUMENT_VERIFIED';
export interface DocumentHistoryInspection{
 readonly kind:'DOCUMENT_HISTORY_VALIDATION_V1';readonly historyRef:DocumentHistoryRef;readonly checks:DocumentHistoryChecks;readonly historyState:DocumentHistoryState;
 readonly currentGraphState:'NOT_CREATED_UNSUPPORTED';readonly currentAccountLink:null;readonly derivedRef:null;readonly fullRestore:false;readonly executionAuthorized:false;readonly snapshot:DocumentHistoryEnvelope;
}
const checkKeys=['sourceBinding','recordHash','documentContentHash','principalRelation','formStageRelations','artifactLinks','commandReceiptAudit','artifactBytes'] as const;
const statuses=['NOT_RUN','VERIFIED','MISSING','UNSUPPORTED','MISMATCH'] as const;
const recordKeys=['projectId','documentId','version','formRef','stageNodeRef','bodyArtifactId','title','sourceRefs','content','contentHash','sections','authorRef','validation','reason','clientId','commandRecordId','createdAt'] as const;
function fail():never{throw new Error('DOCUMENT_HISTORY_STRUCTURE_INVALID');}
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const text=(v:unknown):v is string=>typeof v==='string'&&v.isWellFormed();
function exact(v:unknown,keys:readonly string[]):asserts v is Record<string,any>{if(!recordV1(v,keys))fail();}
function list(v:unknown):asserts v is any[]{if(!arrayV1(v,Number.MAX_SAFE_INTEGER))fail();}
/** data descriptor를 한 번만 잡으며 getter/Proxy get/JSON parser를 사용하지 않는다. */
function snapshot<T>(input:T):T{
 const active=new Set<object>();
 function copy(v:unknown,depth:number):any{
  if(depth>64)fail();if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string'){if(!v.isWellFormed())fail();return v;}
  if(typeof v==='number'){if(!Number.isFinite(v)||Number.isInteger(v)&&!Number.isSafeInteger(v))fail();return v;}
  if(typeof v!=='object'||active.has(v))fail();
  const proto=Object.getPrototypeOf(v),array=Array.isArray(v);if(!array&&proto!==Object.prototype&&proto!==null)fail();
  const d=Object.getOwnPropertyDescriptors(v),keys=Reflect.ownKeys(d);if(keys.some(k=>typeof k!=='string'))fail();active.add(v);
  try{
   if(array){const length=d.length;if(!length||!('value'in length)||!Number.isSafeInteger(length.value)||length.value<0||keys.length!==length.value+1)fail();const out=[];for(let i=0;i<length.value;i++){const p=d[String(i)];if(!p||!p.enumerable||!('value'in p))fail();out.push(copy(p.value,depth+1));}return Object.freeze(out);}
   const out=Object.create(null);for(const key of keys as string[]){const p=d[key]!;if(!key.isWellFormed()||!p.enumerable||!('value'in p))fail();out[key]=copy(p.value,depth+1);}return Object.freeze(out);
  }finally{active.delete(v);}
 }
 try{return copy(input,0);}catch{fail();}
}
function namespaceShape(n:unknown):asserts n is DocumentHistoryNamespace{
 exact(n,['kind','originProjectId','sourceManifestHash']);if(n.kind!=='ANVIL_DOCUMENT_HISTORY_NAMESPACE_V1'||!uuidV1(n.originProjectId)||!hashV1(n.sourceManifestHash))fail();
}
function artifact(a:unknown):asserts a is HistoryArtifactRef{exact(a,['artifactId','bytes','contentHash','mediaType']);if(!uuidV1(a.artifactId)||typeof a.bytes!=='number'||!Number.isSafeInteger(a.bytes)||a.bytes<0||a.bytes>20971520||!hashV1(a.contentHash)||!text(a.mediaType)||a.mediaType.length>200)fail();}
function sections(a:unknown):void{list(a);for(const s of a){exact(s,['itemId','anchor']);if(!text(s.itemId)||!text(s.anchor)||!/^line:[1-9][0-9]{0,7}$/.test(s.anchor)||/[\r\n]/.test(s.anchor))fail();}}
function recordShape(r:unknown):asserts r is DocumentHistoryRecord{
 exact(r,recordKeys);if(!uuidV1(r.projectId)||!uuidV1(r.documentId)||!positive(r.version)||!refV1(r.formRef)||!uuidV1(r.bodyArtifactId)||!text(r.title)||!hashV1(r.contentHash)||!text(r.reason)||!uuidV1(r.clientId)||!uuidV1(r.commandRecordId)||!isoV1(r.createdAt))fail();
 exact(r.authorRef,['kind','userId']);if(r.authorRef.kind!=='HUMAN'||!uuidV1(r.authorRef.userId))fail();
 if(r.stageNodeRef!==null){exact(r.stageNodeRef,['applicationId','nodeId']);const n=r.stageNodeRef;if(!uuidV1(n.applicationId)||!text(n.nodeId)||!n.nodeId.trim()||n.nodeId.length>200||/[\u0000-\u001f\u007f]/.test(n.nodeId))fail();}
 exact(r.content,['body','attachments','sections','sourceRefs']);artifact(r.content.body);list(r.content.attachments);for(const a of r.content.attachments)artifact(a);sections(r.content.sections);sections(r.sections);list(r.content.sourceRefs);list(r.sourceRefs);
}
function recordHashes(r:DocumentHistoryRecord){return{documentContentHash:hash({title:r.title,formRef:r.formRef,stageNodeRef:r.stageNodeRef,content:r.content}),recordProjectionHash:hash(r)};}
function duplicatesMatch(r:DocumentHistoryRecord){return r.bodyArtifactId===r.content.body.artifactId&&same(r.sourceRefs,r.content.sourceRefs)&&same(r.sections,r.content.sections);}
export function hashDocumentHistoryNamespace(namespace:DocumentHistoryNamespace):string{const n=snapshot(namespace);namespaceShape(n);return hash(n);}
export function computeDocumentHistoryRecordHashes(record:DocumentHistoryRecord):Readonly<{documentContentHash:string;recordProjectionHash:string}>{const r=snapshot(record);recordShape(r);if(!duplicatesMatch(r))fail();return Object.freeze(recordHashes(r));}
function historyRefShape(r:unknown):asserts r is DocumentHistoryRef{exact(r,['kind','namespaceHash','originalRef','recordHash']);if(r.kind!=='ANVIL_DOCUMENT_HISTORY_REF_V1'||!hashV1(r.namespaceHash)||!refV1(r.originalRef)||!hashV1(r.recordHash))fail();}
function evidenceShape(v:unknown):asserts v is DocumentHistoryEvidenceRef{
 exact(v,['kind','namespaceHash','recordKind','key','recordHash']);if(v.kind!=='SOURCE_HISTORY_EVIDENCE_REF_V1'||!hashV1(v.namespaceHash)||!hashV1(v.recordHash))fail();list(v.key);const k=v.key;
 switch(v.recordKind){
  case'DOCUMENT_HEAD':case'ARTIFACT_METADATA':case'PROJECT_COMMAND':case'AUTHORIZATION_RECEIPT':if(k.length!==1||!uuidV1(k[0]))fail();break;
  case'FORM_VERSION':case'METHODOLOGY_APPLICATION':if(k.length!==2||!uuidV1(k[0])||!positive(k[1]))fail();break;
  case'PRINCIPAL_LINK':if(k.length!==2||!uuidV1(k[0])||!uuidV1(k[1]))fail();break;
  case'AUDIT_EVENT':if(k.length!==2||!positive(k[0])||!uuidV1(k[1]))fail();break;
  case'DOCUMENT_ARTIFACT_LINK':if(k.length!==4||!uuidV1(k[0])||!positive(k[1])||!uuidV1(k[2])||!['BODY','ATTACHMENT','SOURCE'].includes(k[3]))fail();break;
  default:fail();
 }
}
function envelopeShape(e:unknown):asserts e is DocumentHistoryEnvelope{
 exact(e,['kind','namespace','namespaceHash','recordSchema','originalRef','originalRecord','recordHash','principals','evidenceRefs','derivation']);
 if(e.kind!=='ANVIL_DOCUMENT_HISTORY_ENVELOPE_V1'||e.recordSchema!=='DOCUMENT_VERSION_PROJECTION_V1'||!hashV1(e.namespaceHash)||!hashV1(e.recordHash)||!refV1(e.originalRef))fail();namespaceShape(e.namespace);recordShape(e.originalRecord);
 exact(e.principals,['user','client']);exact(e.principals.user,['kind','namespaceHash','userId']);exact(e.principals.client,['kind','namespaceHash','userId','clientId']);
 const u=e.principals.user,c=e.principals.client;if(u.kind!=='HISTORICAL_USER_REF_V1'||c.kind!=='HISTORICAL_CLIENT_REF_V1'||!hashV1(u.namespaceHash)||!hashV1(c.namespaceHash)||!uuidV1(u.userId)||!uuidV1(c.userId)||!uuidV1(c.clientId))fail();
 list(e.evidenceRefs);for(const v of e.evidenceRefs)evidenceShape(v);
 exact(e.derivation,['kind','sourceHistoryRef','currentAccountLink','derivedRef','state']);const d=e.derivation;if(d.kind!=='DOCUMENT_DERIVATION_SLOT_V1'||d.currentAccountLink!==null||d.derivedRef!==null||d.state!=='NOT_CREATED_UNSUPPORTED')fail();historyRefShape(d.sourceHistoryRef);
}
/** 순수 상태분류이며 성공 태그를 실제 검산으로 공급하는 port는 없다. */
export function classifyDocumentHistoryChecks(checks:DocumentHistoryChecks):DocumentHistoryState{
 const c=snapshot(checks);exact(c,checkKeys);for(const k of checkKeys)if(!statuses.includes(c[k]))fail();
 if(checkKeys.some(k=>c[k]==='MISMATCH'))return'INVALID';
 if(c.recordHash==='VERIFIED'&&checkKeys.filter(k=>k!=='recordHash').every(k=>c[k]==='NOT_RUN'))return'ENVELOPE_ONLY';
 if(checkKeys.filter(k=>k!=='sourceBinding').some(k=>c[k]!=='VERIFIED'))return'INCOMPLETE';
 return c.sourceBinding==='VERIFIED'?'HISTORICAL_DOCUMENT_VERIFIED':'SOURCE_UNVERIFIED';
}
export function inspectDocumentHistoryEnvelope(envelope:DocumentHistoryEnvelope):DocumentHistoryInspection{
 const e=snapshot(envelope);envelopeShape(e);const r=e.originalRecord,h=recordHashes(r),ns=hash(e.namespace),u=e.principals.user,c=e.principals.client;
 const historyRef:DocumentHistoryRef={kind:'ANVIL_DOCUMENT_HISTORY_REF_V1',namespaceHash:e.namespaceHash,originalRef:e.originalRef,recordHash:e.recordHash};
 const checks:{-readonly[K in keyof DocumentHistoryChecks]:DocumentHistoryCheck}={sourceBinding:'NOT_RUN',recordHash:h.recordProjectionHash===e.recordHash?'VERIFIED':'MISMATCH',documentContentHash:h.documentContentHash===r.contentHash&&r.contentHash===e.originalRef.contentHash?'VERIFIED':'MISMATCH',principalRelation:'MISSING',formStageRelations:'MISSING',artifactLinks:'MISSING',commandReceiptAudit:'MISSING',artifactBytes:'NOT_RUN'};
 if(ns!==e.namespaceHash||r.projectId!==e.namespace.originProjectId||e.namespace.sourceManifestHash===e.namespaceHash||e.namespace.sourceManifestHash===e.recordHash)checks.sourceBinding='MISMATCH';
 if(e.originalRef.id!==r.documentId||e.originalRef.version!==r.version||!same(e.derivation.sourceHistoryRef,historyRef))checks.recordHash='MISMATCH';
 const refs=e.evidenceRefs,has=(kind:HistoryEvidenceKind,key?:readonly(string|number)[])=>refs.some(v=>v.recordKind===kind&&(key===undefined||same(v.key,key)));
 checks.principalRelation=has('PRINCIPAL_LINK',[u.userId,c.clientId])?'UNSUPPORTED':'MISSING';
 if(u.namespaceHash!==ns||c.namespaceHash!==ns||u.userId!==r.authorRef.userId||c.userId!==u.userId||c.clientId!==r.clientId||refs.some(v=>v.recordKind==='PRINCIPAL_LINK'&&!same(v.key,[u.userId,c.clientId])))checks.principalRelation='MISMATCH';
 const stage=r.stageNodeRef,form=has('FORM_VERSION',[r.formRef.id,r.formRef.version]),application=stage!==null&&refs.some(v=>v.recordKind==='METHODOLOGY_APPLICATION'&&v.key[0]===stage.applicationId);
 checks.formStageRelations=form&&(stage===null||application)?'UNSUPPORTED':'MISSING';
 if(refs.some(v=>v.recordKind==='FORM_VERSION'&&!same(v.key,[r.formRef.id,r.formRef.version])||v.recordKind==='METHODOLOGY_APPLICATION'&&(stage===null||v.key[0]!==stage.applicationId)))checks.formStageRelations='MISMATCH';
 const declared=[r.content.body,...r.content.attachments],declaredIds=declared.map(a=>a.artifactId);
 const artifacts=declared.every(a=>has('ARTIFACT_METADATA',[a.artifactId])),links=has('DOCUMENT_ARTIFACT_LINK',[r.documentId,r.version,r.content.body.artifactId,'BODY'])&&r.content.attachments.every(a=>has('DOCUMENT_ARTIFACT_LINK',[r.documentId,r.version,a.artifactId,'ATTACHMENT']));
 checks.artifactLinks=artifacts&&links?'UNSUPPORTED':'MISSING';
 if(!duplicatesMatch(r)||new Set(declaredIds).size!==declaredIds.length||refs.some(v=>v.recordKind==='DOCUMENT_ARTIFACT_LINK'&&(v.key[0]!==r.documentId||v.key[1]!==r.version||v.key[3]==='BODY'&&v.key[2]!==r.bodyArtifactId||v.key[3]==='ATTACHMENT'&&!r.content.attachments.some(a=>a.artifactId===v.key[2]))))checks.artifactLinks='MISMATCH';
 checks.commandReceiptAudit=has('DOCUMENT_HEAD',[r.documentId])&&has('PROJECT_COMMAND',[r.commandRecordId])&&has('AUTHORIZATION_RECEIPT')&&has('AUDIT_EVENT')?'UNSUPPORTED':'MISSING';
 if(refs.some(v=>v.recordKind==='DOCUMENT_HEAD'&&v.key[0]!==r.documentId||v.recordKind==='PROJECT_COMMAND'&&v.key[0]!==r.commandRecordId))checks.commandReceiptAudit='MISMATCH';
 const seen=new Set<string>();for(const v of refs){const key=canonicalJson([v.recordKind,v.key]);if(v.namespaceHash!==ns||seen.has(key))checks.recordHash='MISMATCH';seen.add(key);}
 // 원source·관계codec·실bytes는 공급/실행하지 않으며 caller 검산 결과를 받지 않는다.
 const result:DocumentHistoryInspection={kind:'DOCUMENT_HISTORY_VALIDATION_V1',historyRef,checks,historyState:classifyDocumentHistoryChecks(checks),currentGraphState:'NOT_CREATED_UNSUPPORTED',currentAccountLink:null,derivedRef:null,fullRestore:false,executionAuthorized:false,snapshot:e};
 return snapshot(result);
}
export function compareDocumentHistoryIdentity(left:DocumentHistoryEnvelope,right:DocumentHistoryEnvelope):'SAME_RECORD'|'KEY_CONFLICT'|'DISTINCT_KEY'{
 const l=inspectDocumentHistoryEnvelope(left),r=inspectDocumentHistoryEnvelope(right);if(l.historyState==='INVALID'||r.historyState==='INVALID')throw new Error('DOCUMENT_HISTORY_IDENTITY_INVALID');
 const a=l.historyRef,b=r.historyRef;if(a.namespaceHash!==b.namespaceHash||a.originalRef.id!==b.originalRef.id||a.originalRef.version!==b.originalRef.version)return'DISTINCT_KEY';
 return a.recordHash===b.recordHash&&same(a.originalRef,b.originalRef)&&same(l.snapshot,r.snapshot)?'SAME_RECORD':'KEY_CONFLICT';
}