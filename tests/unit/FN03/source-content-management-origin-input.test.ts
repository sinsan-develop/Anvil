import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const path='../../../apps/server/modules/documents/source-content-policy-management-origin-input.ts';
const api=await import(path).catch((error:unknown)=>{if((error as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const id=(n:number)=>`89000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const at='2026-11-20T00:00:00.000Z',now=Date.parse(at);
function fixture(){
 const context={operation:'defineSourceContentPolicy',projectId:id(1),actorId:id(2),clientId:id(3),authSessionId:id(4),credentialGeneration:2,controlGeneration:3,permissionPolicyRef:ref(5),transactionId:'9007199254740993',authorizedUntil:'2026-11-20T00:00:10.000Z'};
 const ids={serverCommandId:id(10),operationId:id(11),authorizationReceiptId:id(12),auditEventId:id(13),policyEventId:id(14),originId:id(15)};
 const payload={previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(2),disposition:'AUTO',expiresAt:'2027-11-20T00:00:00.000Z',allowedOperations:['linkDocumentSource','requestSourceContentHash','revokeSourceContentHash'],sourceRootRef:ref(20),connectorRef:ref(21),registrationRef:ref(22),observerRef:ref(23),targets:[{relativePath:'src/a.ts',documentRef:ref(24),documentBlobRef:{artifactId:id(25),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 정책 정의'};
 const request={schemaVersion:1,projectId:id(1),commandId:id(6),clientId:id(3),controlGeneration:3,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload};
 return {context,ids,request,event:{sequence:1,recordedAt:at}};
}
function prepare(f=fixture(),request:unknown=f.request){return api.prepareSourceContentManagementOriginInput(request,f.context,f.ids,f.event,now);}
const rejects=(fn:()=>unknown)=>assert.throws(fn,{message:'SOURCE_CONTENT_MANAGEMENT_ORIGIN_INPUT_INVALID'});

test('원 envelope와 exact16 event/exact10 origin을 독립 해시로 결박하고 권위는 발급하지 않는다',()=>{
 const f=fixture(),v=prepare(f);
 assert.equal(v.status,'UNVERIFIED');assert.equal(v.currentAuthorityVerified,false);assert.equal(v.storageMutationPerformed,false);assert.equal(v.executionAuthorized,false);
 assert.equal(v.requestHash,contentHash(canonicalJson(f.request)));assert.deepEqual(v.originalRequest,f.request);
 assert.equal(Object.keys(v.policySnapshot).length,16);assert.equal(Object.keys(v.originSnapshot).length,10);
 assert.equal(v.policyEventRef.contentHash,contentHash(canonicalJson(v.policySnapshot)));
 assert.equal(v.originRef.contentHash,contentHash(canonicalJson(v.originSnapshot)));
 assert.equal(v.originSnapshot.managementCommandId,f.ids.serverCommandId);assert.deepEqual(v.originSnapshot.policyEventRef,v.policyEventRef);
 assert.equal(v.context.transactionId,'9007199254740993');
 assert.ok(Buffer.byteLength(canonicalJson(v.originSnapshot))<=2097152);
});
test('await 뒤 원 입력 변경은 동결 사본·hash·context·ids에 반영되지 않는다',async()=>{
 const f=fixture(),v=prepare(f),before=canonicalJson(v);await Promise.resolve();
 f.request.payload.reason='바뀐 원문';f.context.permissionPolicyRef.contentHash='b'.repeat(64);f.ids.originId=id(90);f.event.sequence=9;
 assert.equal(canonicalJson(v),before);assert.ok(Object.isFrozen(v.originalRequest.payload.definition.targets));assert.ok(Object.isFrozen(v.context.permissionPolicyRef));
 assert.throws(()=>{v.originSnapshot.originalRequest.payload.reason='변경';},TypeError);
});
test('중복 JSON/추가 키/Proxy/getter는 거절하고 사용자 코드는 호출하지 않는다',()=>{
 const f=fixture(),raw=JSON.stringify(f.request);rejects(()=>prepare(f,raw.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1')));
 rejects(()=>prepare(f,{...f.request,extra:1}));let calls=0;
 rejects(()=>prepare(f,new Proxy(f.request,{ownKeys(){calls++;return [];}})));
 rejects(()=>prepare(f,{...f.request,payload:{get definition(){calls++;return {};}}}));assert.equal(calls,0);
});
test('다른 프로젝트/client/control·목적·subject·ref와 ids 오염은 거절한다',()=>{
 for(const patch of [{projectId:id(99)},{clientId:id(99)},{controlGeneration:4},{operation:'readSourceContentPolicyManagementOrigin'},{targetId:id(99)},{approvalRef:ref(99)}]){const f=fixture();rejects(()=>prepare(f,{...f.request,...patch}));}
 let f=fixture();f.request.payload.definition.subjectUserId=id(99);rejects(()=>prepare(f));
 f=fixture();f.context.permissionPolicyRef.contentHash='x';rejects(()=>prepare(f));
 f=fixture();f.ids.originId=f.ids.policyEventId;rejects(()=>prepare(f));
 f=fixture();rejects(()=>api.prepareSourceContentManagementOriginInput(f.request,f.context,{...f.ids,extra:id(99)},f.event,now));
});
test('주입 시각의 경계와 xid/세대 형상을 검사하되 DB 현재성을 주장하지 않는다',()=>{
 const f=fixture();for(const n of [now-1,now+10000,NaN,Infinity])rejects(()=>api.prepareSourceContentManagementOriginInput(f.request,f.context,f.ids,f.event,n));
 for(const patch of [{transactionId:9007199254740992},{transactionId:'01'},{credentialGeneration:'2'},{controlGeneration:0},{authorizedUntil:'2026-11-20T00:00:10Z'}])rejects(()=>api.prepareSourceContentManagementOriginInput(f.request,{...f.context,...patch},f.ids,f.event,now));
});
test('원 wire와 canonical envelope의 1MiB UTF8 한도를 지키며 도출 origin은 별도 2MiB 방어 상한이다',()=>{
 const f=fixture(),raw=JSON.stringify(f.request),padding=1048576-Buffer.byteLength(raw);
 assert.equal(prepare(f,raw+' '.repeat(padding)).requestHash,prepare(f).requestHash);
 rejects(()=>prepare(f,raw+' '.repeat(padding+1)));
 rejects(()=>prepare(f,{...f.request,payload:{...f.request.payload,reason:'한'.repeat(349526)}}));
 // 유효 envelope 1MiB + 고정 metadata만으로 도출하므로 2MiB짜리 origin을 외부 입력하지 않는다.
 assert.ok(Buffer.byteLength(canonicalJson(prepare(f).originSnapshot))<1048576+4096);
});
test('exact3 내부 조회 선택은 고정 refs/관리 command와 읽기 목적에만 결박하고 원문을 반환하지 않는다',()=>{
 const f=fixture(),v=prepare(f),selection={originRef:v.originRef,policyEventRef:v.policyEventRef,managementCommandId:f.ids.serverCommandId};
 const context={...f.context,operation:'readSourceContentPolicyManagementOrigin'};
 const read=api.readSourceContentManagementOriginSelection(selection,context,now);
 assert.deepEqual(read.selection,selection);assert.equal(read.status,'UNVERIFIED');assert.equal(read.currentAuthorityVerified,false);assert.equal('originalRequest' in read,false);
 rejects(()=>api.readSourceContentManagementOriginSelection(selection,f.context,now));
 rejects(()=>api.readSourceContentManagementOriginSelection({...selection,projectId:id(1)},context,now));
 rejects(()=>api.readSourceContentManagementOriginSelection({...selection,originRef:{...v.originRef,version:2}},context,now));
 rejects(()=>api.readSourceContentManagementOriginSelection(selection,context,now+10000));
});

test('별도 O 시각은 E 이후 독립 hash로 봉인하며 생략한 기존 동일시각 호출을 보존한다',()=>{
 const f=fixture(),later='2026-11-20T00:00:00.001Z';
 const call=(event:unknown)=>api.prepareSourceContentManagementOriginInput(f.request,f.context,f.ids,event,now+2);
 const original=call(f.event),explicit=call({...f.event,originRecordedAt:at}),separate=call({...f.event,originRecordedAt:later});
 assert.deepEqual(explicit,original);assert.equal(separate.policySnapshot.recordedAt,at);assert.equal(separate.originSnapshot.recordedAt,later);
 assert.deepEqual(separate.policyEventRef,original.policyEventRef);assert.equal(separate.requestHash,original.requestHash);
 assert.notEqual(separate.originRef.contentHash,original.originRef.contentHash);assert.equal(separate.originRef.contentHash,contentHash(canonicalJson(separate.originSnapshot)));
 for(const originRecordedAt of ['2026-11-19T23:59:59.999Z','2026-11-20T00:00:00.003Z','2026-11-20T00:00:00.001000Z',null,undefined])rejects(()=>call({...f.event,originRecordedAt}));
 rejects(()=>call({...f.event,originRecordedAt:later,extra:true}));
});
