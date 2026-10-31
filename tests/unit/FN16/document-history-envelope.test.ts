import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
// 구조화 메모리 DTO만 사용한다. parser·FS·DB·원문 공급/권한·복원은 실행하지 않는다.
const H=(v:unknown)=>contentHash(canonicalJson(v));
const id=(n:number)=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number,version=1)=>({id:id(n),version,contentHash:H({fixture:n})});
const checkKeys=['sourceBinding','recordHash','documentContentHash','principalRelation','formStageRelations','artifactLinks','commandReceiptAudit','artifactBytes'];
async function api(){
 let m:any={};try{m=await import('../../../apps/server/modules/backups/document-history-envelope.ts');}catch(e:any){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
 assert.equal(typeof m.inspectDocumentHistoryEnvelope,'function','DOCUMENT_VERSION 논리봉투 검산기 미구현');return m;
}
function fixture(stage:boolean=false):any{
 const namespace={kind:'ANVIL_DOCUMENT_HISTORY_NAMESPACE_V1',originProjectId:id(1),sourceManifestHash:H({source:'fixed-before-envelope'})},namespaceHash=H(namespace);
 const body={artifactId:id(3),bytes:7,contentHash:contentHash('본문'+String.fromCharCode(10)),mediaType:'text/plain;charset=utf-8'};
 const content={body,attachments:[],sections:[{itemId:'purpose',anchor:'line:1'}],sourceRefs:[]};
 const r={projectId:id(1),documentId:id(2),version:1,formRef:ref(4),stageNodeRef:stage?{applicationId:id(5),nodeId:'implement'}:null,bodyArtifactId:id(3),title:'보관 문서',sourceRefs:[],content,contentHash:'',sections:content.sections,authorRef:{kind:'HUMAN',userId:id(6)},validation:{validForConfirmation:true,issues:[],formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'},reason:'명시 저장',clientId:id(7),commandRecordId:id(8),createdAt:'2026-10-31T00:00:00.000Z'};
 r.contentHash=H({title:r.title,formRef:r.formRef,stageNodeRef:r.stageNodeRef,content:r.content});
 const originalRef={id:r.documentId,version:r.version,contentHash:r.contentHash},recordHash=H(r),historyRef={kind:'ANVIL_DOCUMENT_HISTORY_REF_V1',namespaceHash,originalRef,recordHash};
 return{kind:'ANVIL_DOCUMENT_HISTORY_ENVELOPE_V1',namespace,namespaceHash,recordSchema:'DOCUMENT_VERSION_PROJECTION_V1',originalRef,originalRecord:r,recordHash,principals:{user:{kind:'HISTORICAL_USER_REF_V1',namespaceHash,userId:id(6)},client:{kind:'HISTORICAL_CLIENT_REF_V1',namespaceHash,userId:id(6),clientId:id(7)}},evidenceRefs:[],derivation:{kind:'DOCUMENT_DERIVATION_SLOT_V1',sourceHistoryRef:historyRef,currentAccountLink:null,derivedRef:null,state:'NOT_CREATED_UNSUPPORTED'}};
}
function evidence(e:any,recordKind:string,key:unknown[]){return{kind:'SOURCE_HISTORY_EVIDENCE_REF_V1',namespaceHash:e.namespaceHash,recordKind,key,recordHash:H({recordKind,key})};}
function invalid(m:any,value:any){assert.throws(()=>m.inspectDocumentHistoryEnvelope(value),(e:any)=>e.message==='DOCUMENT_HISTORY_STRUCTURE_INVALID'&&e.cause===undefined);}

test('historyEnvelope 정상 typed DTO는 독립 hash와 미지원 검산을 분리한다',async()=>{
 const m=await api(),e=fixture(),before=structuredClone(e),r=m.inspectDocumentHistoryEnvelope(e);
 assert.equal(m.hashDocumentHistoryNamespace(e.namespace),H(e.namespace));
 assert.deepEqual(m.computeDocumentHistoryRecordHashes(e.originalRecord),{documentContentHash:e.originalRef.contentHash,recordProjectionHash:H(e.originalRecord)});
 assert.equal(r.checks.recordHash,'VERIFIED');assert.equal(r.checks.documentContentHash,'VERIFIED');assert.equal(r.checks.sourceBinding,'NOT_RUN');assert.equal(r.checks.principalRelation,'MISSING');assert.equal(r.checks.formStageRelations,'MISSING');assert.equal(r.checks.artifactBytes,'NOT_RUN');assert.equal(r.historyState,'INCOMPLETE');
 assert.equal(r.fullRestore,false);assert.equal(r.executionAuthorized,false);assert.equal(r.currentAccountLink,null);assert.equal(r.derivedRef,null);assert.equal(r.currentGraphState,'NOT_CREATED_UNSUPPORTED');
 assert.deepEqual(e,before);assert.notEqual(r.snapshot,e);e.originalRecord.title='나중 변경';assert.equal(r.snapshot.originalRecord.title,before.originalRecord.title);assert(Object.isFrozen(r.snapshot.originalRecord.content));
});

test('historyEnvelope hash·원ref·주체 값 단독변조는 재봉인 없이 INVALID다',async()=>{
 const m=await api();
 for(const change of [(e:any)=>e.namespaceHash='f'.repeat(64),(e:any)=>e.recordHash='f'.repeat(64),(e:any)=>e.originalRecord.contentHash='f'.repeat(64),(e:any)=>e.originalRef.contentHash='f'.repeat(64),(e:any)=>e.originalRecord.title='변조',(e:any)=>e.originalRecord.bodyArtifactId=id(99),(e:any)=>e.principals.user.userId=id(99),(e:any)=>e.principals.client.userId=id(99),(e:any)=>e.principals.client.clientId=id(99),(e:any)=>e.derivation.sourceHistoryRef.recordHash='f'.repeat(64)]){
  const e=fixture(),old=structuredClone(e);change(e);const changed=structuredClone(e),r=m.inspectDocumentHistoryEnvelope(e);assert.equal(r.historyState,'INVALID');assert.deepEqual(e,changed);assert.notDeepEqual(e,old);
 }
});

test('historyEnvelope account/check 태그·getter·symbol·cycle·비정규값을 거절한다',async()=>{
 const m=await api();let getters=0;
 for(const change of [(e:any)=>e.checks={recordHash:'VERIFIED'},(e:any)=>e.principals.user.email='forbidden',(e:any)=>e.evidenceRefs.push({...evidence(e,'FORM_VERSION',[id(4),1]),verified:true}),(e:any)=>e.derivation.currentAccountLink=id(6),(e:any)=>e.originalRecord.version=1.5,(e:any)=>e.originalRecord.createdAt='2026-10-31T00:00:00Z',(e:any)=>e.originalRecord.validation.self=e.originalRecord.validation,(e:any)=>e.originalRecord.validation.value=Infinity,(e:any)=>e.originalRecord.validation.value='\ud800',(e:any)=>e[Symbol('extra')]=true,(e:any)=>Object.defineProperty(e.originalRecord,'title',{enumerable:true,get(){getters++;throw Error('do-not-read');}})]){const e=fixture();change(e);invalid(m,e);}
 invalid(m,'{"kind":"ANVIL_DOCUMENT_HISTORY_ENVELOPE_V1"}');invalid(m,Uint8Array.of(1));assert.equal(getters,0);
 const proxy=new Proxy(fixture(),{ownKeys(){throw Error('private-detail');}});invalid(m,proxy);
});

test('historyEnvelope stage implement/null은 정상이고 버전은 추정하지 않는다',async()=>{
 const m=await api();for(const stage of [false,true]){
  const e=fixture(stage),r=m.inspectDocumentHistoryEnvelope(e);assert.notEqual(r.historyState,'INVALID');assert.equal(r.checks.formStageRelations,'MISSING');
  e.evidenceRefs=[evidence(e,'FORM_VERSION',[id(4),1])];assert.equal(m.inspectDocumentHistoryEnvelope(e).checks.formStageRelations,stage?'MISSING':'UNSUPPORTED');
  if(stage){e.evidenceRefs.push(evidence(e,'METHODOLOGY_APPLICATION',[id(5),7]));assert.equal(m.inspectDocumentHistoryEnvelope(e).checks.formStageRelations,'UNSUPPORTED','참조만으로 버전/원snapshot 관계 검산 성공을 만들지 않는다');}
  else{e.evidenceRefs.push(evidence(e,'METHODOLOGY_APPLICATION',[id(5),7]));assert.equal(m.inspectDocumentHistoryEnvelope(e).historyState,'INVALID');}
 }
 for(const nodeId of ['', ' ', 'a\u0000b','a\u007fb','\ud800','a'.repeat(201)]){const e=fixture(true);e.originalRecord.stageNodeRef.nodeId=nodeId;invalid(m,e);}
 const e=fixture(true);e.originalRecord.stageNodeRef.version=7;invalid(m,e);
});

test('historyEnvelope 참조가 있어도 원codec/bytes/source 자기주장은 VERIFIED가 아니다',async()=>{
 const m=await api(),e=fixture();e.evidenceRefs=[evidence(e,'FORM_VERSION',[id(4),1]),evidence(e,'DOCUMENT_HEAD',[id(2)]),evidence(e,'ARTIFACT_METADATA',[id(3)]),evidence(e,'DOCUMENT_ARTIFACT_LINK',[id(2),1,id(3),'BODY']),evidence(e,'PROJECT_COMMAND',[id(8)]),evidence(e,'AUTHORIZATION_RECEIPT',[id(9)]),evidence(e,'AUDIT_EVENT',[1,id(10)]),evidence(e,'PRINCIPAL_LINK',[id(6),id(7)])];
 const r=m.inspectDocumentHistoryEnvelope(e);for(const key of ['principalRelation','formStageRelations','artifactLinks','commandReceiptAudit'])assert.equal(r.checks[key],'UNSUPPORTED');assert.equal(r.checks.sourceBinding,'NOT_RUN');assert.equal(r.checks.artifactBytes,'NOT_RUN');assert.equal(r.historyState,'INCOMPLETE');
 const wrong=fixture();wrong.evidenceRefs=[evidence(wrong,'PRINCIPAL_LINK',[id(99),id(7)])];assert.equal(m.inspectDocumentHistoryEnvelope(wrong).historyState,'INVALID');
});

test('historyEnvelope 분류는 독립 표로 전체8check의 불일치 우선과 미수행을 보존한다',async()=>{
 const m=await api(),all=(v:string)=>Object.fromEntries(checkKeys.map(k=>[k,v]));
 assert.equal(m.classifyDocumentHistoryChecks(all('VERIFIED')),'HISTORICAL_DOCUMENT_VERIFIED','순수 분류이며 실제 검증 증명이 아니다');
 assert.equal(m.classifyDocumentHistoryChecks({...all('VERIFIED'),sourceBinding:'NOT_RUN'}),'SOURCE_UNVERIFIED');
 assert.equal(m.classifyDocumentHistoryChecks({...all('NOT_RUN'),recordHash:'VERIFIED'}),'ENVELOPE_ONLY');
 assert.equal(m.classifyDocumentHistoryChecks({...all('VERIFIED'),recordHash:'NOT_RUN'}),'INCOMPLETE');
 for(const key of checkKeys){assert.equal(m.classifyDocumentHistoryChecks({...all('VERIFIED'),[key]:'MISMATCH'}),'INVALID');}
 for(const status of ['NOT_RUN','MISSING','UNSUPPORTED'])for(const key of checkKeys.filter(k=>k!=='sourceBinding'))assert.equal(m.classifyDocumentHistoryChecks({...all('VERIFIED'),[key]:status}),'INCOMPLETE');
 assert.throws(()=>m.classifyDocumentHistoryChecks({...all('VERIFIED'),extra:'VERIFIED'}),/DOCUMENT_HISTORY_STRUCTURE_INVALID/);
});

test('historyEnvelope 같은 논리키의 동일 원형/충돌과 다른 namespace를 구별한다',async()=>{
 const m=await api(),left=fixture(),same=fixture();assert.equal(m.compareDocumentHistoryIdentity(left,same),'SAME_RECORD');
 const conflict=fixture();conflict.originalRecord.reason='다른 원기록';conflict.recordHash=H(conflict.originalRecord);conflict.derivation.sourceHistoryRef.recordHash=conflict.recordHash;
 assert.equal(m.compareDocumentHistoryIdentity(left,conflict),'KEY_CONFLICT');
 const other=fixture();other.namespace.sourceManifestHash=H({source:'other-fixed-manifest'});other.namespaceHash=H(other.namespace);other.principals.user.namespaceHash=other.namespaceHash;other.principals.client.namespaceHash=other.namespaceHash;other.derivation.sourceHistoryRef.namespaceHash=other.namespaceHash;
 assert.equal(m.compareDocumentHistoryIdentity(left,other),'DISTINCT_KEY');
 const damaged=fixture();damaged.recordHash='f'.repeat(64);assert.throws(()=>m.compareDocumentHistoryIdentity(left,damaged),/DOCUMENT_HISTORY_IDENTITY_INVALID/);
});
test('historyEnvelope 알려진 sections anchor 문법은 본문 줄수 검증과 별도로 거절한다',async()=>{
 const m=await api();for(const anchor of ['purpose','line:0','line:01','line:100000000','line:1\n']){const e=fixture();e.originalRecord.content.sections[0].anchor=anchor;e.originalRecord.sections=structuredClone(e.originalRecord.content.sections);invalid(m,e);}
});
test('historyEnvelope descriptor snapshot은 Proxy get과 재관측 변조를 소비하지 않는다',async()=>{
 const m=await api(),source=fixture(),counts=new Map<PropertyKey,number>();let gets=0;
 const wrapped=new Proxy(source,{get(){gets++;throw Error('private-detail');},getOwnPropertyDescriptor(target,key){const count=(counts.get(key)??0)+1;counts.set(key,count);const d=Reflect.getOwnPropertyDescriptor(target,key);return d&&'value'in d&&count>1?{...d,value:null}:d;}});
 const r=m.inspectDocumentHistoryEnvelope(wrapped);assert.equal(r.checks.recordHash,'VERIFIED');assert.equal(gets,0);assert([...counts.values()].every(n=>n===1));
});

test('historyEnvelope 증빙 중복·다른 namespace·잘못된 key와 source hash 역할혼동을 닫는다',async()=>{
 const m=await api();
 const e=fixture(),f=evidence(e,'FORM_VERSION',[id(4),1]);e.evidenceRefs=[f,structuredClone(f)];assert.equal(m.inspectDocumentHistoryEnvelope(e).historyState,'INVALID');
 const other=fixture();other.evidenceRefs=[{...evidence(other,'FORM_VERSION',[id(4),1]),namespaceHash:'e'.repeat(64)}];assert.equal(m.inspectDocumentHistoryEnvelope(other).historyState,'INVALID');
 const role=fixture();role.namespace.sourceManifestHash=role.namespaceHash;assert.equal(m.inspectDocumentHistoryEnvelope(role).historyState,'INVALID');
 for(const key of [[id(4),0],[id(4),Number.MAX_SAFE_INTEGER+1],[id(4),'1'],[id(4),1,2]]){const x=fixture();x.evidenceRefs=[{...evidence(x,'FORM_VERSION',[id(4),1]),key}];invalid(m,x);}
 const statuses=['NOT_RUN','MISSING','UNSUPPORTED'];const all=Object.fromEntries(checkKeys.map(k=>[k,'VERIFIED']));
 for(const status of statuses)assert.equal(m.classifyDocumentHistoryChecks({...all,sourceBinding:status}),'SOURCE_UNVERIFIED');
 assert.throws(()=>m.classifyDocumentHistoryChecks({...all,sourceBinding:'APPROVED'}),/DOCUMENT_HISTORY_STRUCTURE_INVALID/);
});