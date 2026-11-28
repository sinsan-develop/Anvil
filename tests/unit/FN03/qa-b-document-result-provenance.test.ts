import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import * as contract from '../../../contracts/runtime/qa-b-document-result-provenance-v1.ts';
import {prepareDocumentProposal,storeDocumentProposal,storeDocumentProposalMaterial} from '../../../apps/server/modules/documents/project-proposals.ts';
import {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const ref=(n:number,version=1)=>({id:id(n),version,contentHash:digest(n)});
const seal=(n:number,snapshot:unknown)=>({ref:{id:id(n),version:1,contentHash:digest(snapshot)},snapshot});
const bytes=Buffer.from('# QA B 설계\r\n작성 SEND 원 결과입니다.\r\n');
const invalid={message:'QA_B_DOCUMENT_RESULT_PROVENANCE_INVALID'};
function evidence(){
 const binding={projectId:id(1),executionId:id(2),executionGeneration:2,credentialGeneration:3,registrationRef:ref(3,2),grantRef:ref(4),assignmentRef:ref(5,2),sessionBindingRef:ref(6,2),sessionDigest:digest('protected session'),dispatchAttemptRef:ref(7),instructionRef:ref(8),partsRef:ref(9),envelopeHash:digest('envelope'),inputReceiptRef:ref(10)};
 const input=seal(11,{schemaVersion:1,kind:'QA_B_DOCUMENT_SEND_INPUT',binding,documentKind:'DESIGN',userMessageId:id(12),inputMessageDigest:digest('sdk user input'),yieldedAt:'2026-11-28T01:00:00.000Z'});
 const result=seal(13,{schemaVersion:1,kind:'QA_B_DOCUMENT_SEND_RESULT',binding,documentKind:'DESIGN',inputRef:input.ref,providerCorrelationRef:ref(14),outputRef:ref(15),payloadDigest:digest('original SDK payload'),userMessageId:id(12),resultFamily:'RESULT_SUCCESS',observedAt:'2026-11-28T01:00:01.000Z',resultText:bytes.toString('utf8')});
 const expected={binding:structuredClone(binding),documentKind:'DESIGN' as const,inputRef:input.ref,resultRef:result.ref,providerCorrelationRef:ref(14),outputRef:ref(15)};
 return {input,result,expected};
}

test('고정 작성 SEND·독립 검산값·원 결과·제안 bytes가 같을 때만 메타데이터 결박',()=>{
 const f=evidence(),result=contract.verifyQaBDocumentResultProvenanceV1(f.input,f.result,f.expected,bytes);
 assert.deepEqual(result,{inputRef:f.input.ref,resultRef:f.result.ref,providerCorrelationRef:ref(14),outputRef:ref(15),bodyHash:contentHash(bytes),bodyBytes:bytes.length});
 assert(!('resultText' in result));
 assert.throws(()=>contract.verifyQaBDocumentResultProvenanceV1(f.input,f.result,f.expected,Buffer.from(bytes.toString().replaceAll('\r\n','\n'))),invalid);
});

test('같은 세션/UUID만으로 교차 실행·세대·등록·작성 SEND·결과를 귀속하지 않는다',()=>{
 const f=evidence();
 for(const field of ['projectId','executionId','executionGeneration','credentialGeneration','registrationRef','assignmentRef','sessionBindingRef','dispatchAttemptRef','inputReceiptRef','envelopeHash'] as const){
  const wrong=structuredClone(f.expected);const value=wrong.binding[field];
  Object.assign(wrong.binding,{[field]:typeof value==='number'?value+1:typeof value==='string'?field==='envelopeHash'?digest('other'):id(99):ref(99)});
  assert.throws(()=>contract.verifyQaBDocumentResultProvenanceV1(f.input,f.result,wrong,bytes),invalid,field);
 }
 for(const snapshot of [{providerCorrelationRef:ref(99)},{outputRef:ref(99)},{resultFamily:'RESULT_ERROR'},{userMessageId:id(99)},{documentKind:'WORK_PLAN'},{observedAt:'2026-11-28T00:59:59.999Z'},{providerVerified:true},{outputRef:f.input.ref}]){
  const changed=seal(13,{...f.result.snapshot as object,...snapshot});
  assert.throws(()=>contract.verifyQaBDocumentResultProvenanceV1(f.input,changed,{...f.expected,resultRef:changed.ref},bytes),invalid);
 }
 assert.throws(()=>contract.verifyQaBDocumentResultProvenanceV1(f.input,f.result,{...f.expected,providerCorrelationRef:null},bytes),invalid);
 const suspect=new Proxy(f.expected,{ownKeys(){assert.fail('NO PROXY EFFECT');}});
 assert.throws(()=>contract.verifyQaBDocumentResultProvenanceV1(f.input,f.result,suspect,bytes),invalid);
});

test('실제 FN03 계획은 보호 callback의 정확 body를 대조하며 출처 포트가 없는 저장은 효과 전 거절한다',async()=>{
 const f=evidence();
 const proposed={artifactId:id(17),bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'};
 const before=Buffer.from('QA B 대상 원문');const original={...proposed,artifactId:id(18),bytes:before.length,contentHash:contentHash(before)};
 const baseRef=ref(16),formRef=ref(19);
 const command={schemaVersion:1,projectId:id(1),commandId:id(20),clientId:id(21),controlGeneration:1,operation:'proposeDocumentChange',targetId:baseRef.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{baseRef,proposedContent:{body:proposed,attachments:[],sections:[],sourceRefs:[]},reason:'QA B 원문 결과',sourceRefs:[]}} as const;
 const base={...baseRef,title:'설계',formRef,stageNodeRef:null,content:{body:original,attachments:[],sections:[],sourceRefs:[]},contentReviewCriteria:{items:[]}};
 const db={query:async(sql:string)=>{assert.match(sql,/SELECT head_version/);return{rows:[{head_version:1}]};}} as unknown as PoolClient;
 const actor={} as never;
 const read=async(_db:PoolClient,_pid:string,a:{artifactId:string})=>a.artifactId===proposed.artifactId?Buffer.from(bytes):Buffer.from(before);
 const fixed={artifactId:id(22),proposalId:id(23)};
 const material={...f,baseRef,formRef};
 const plain=await prepareDocumentProposal(db,actor,command as never,base,read,fixed);
 const sourced=await prepareDocumentProposal(db,actor,command as never,base,read,fixed,material);
 assert.deepEqual(sourced.proposal,plain.proposal);assert.deepEqual(sourced.diff,plain.diff);
 assert.equal(sourced.qaBSource?.bodyHash,proposed.contentHash);assert.equal(plain.qaBSource,undefined);
 await assert.rejects(prepareDocumentProposal(db,actor,command as never,base,async(...args)=>args[2].artifactId===proposed.artifactId?Buffer.from('복사 뒤 편집'):read(...args),fixed,material),{message:'QA_B_DOCUMENT_RESULT_PROVENANCE_INVALID',statusCode:412});
 await assert.rejects(prepareDocumentProposal(db,actor,command as never,base,read,fixed,{...material,baseRef:ref(99)}),{message:'QA_B_DOCUMENT_RESULT_PROVENANCE_INVALID',statusCode:412});
 await assert.rejects(prepareDocumentProposal({query:()=>assert.fail('NO READ')} as never,actor,command as never,base,read,fixed,null as never),{message:'QA_B_DOCUMENT_RESULT_PROVENANCE_INVALID',statusCode:412});
 const storage={query:()=>assert.fail('NO INSERT')} as never;
 await assert.rejects(storeDocumentProposalMaterial(storage,actor,id(1),id(20),sourced,'unused'),{message:'QA_B_DOCUMENT_PROVENANCE_STORAGE_UNAVAILABLE',statusCode:412});
 await assert.rejects(storeDocumentProposal(storage,actor,command as never,ref(24),sourced,'unused'),{message:'QA_B_DOCUMENT_PROVENANCE_STORAGE_UNAVAILABLE',statusCode:412});
 const unexpected=new Proxy({}, {get(){assert.fail('NO AUTH/QUOTA/FILE EFFECT');}}) as never;
 await assert.rejects(new ProjectDocuments().proposeCommand(unexpected,unexpected,'session','csrf',command as never,{inputRef:f.input.ref,resultRef:f.result.ref}),{message:'QA_B_DOCUMENT_PROVENANCE_SOURCE_UNAVAILABLE',statusCode:412});
});
