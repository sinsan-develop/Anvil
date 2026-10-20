import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',root='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const documentRef={id:pid,version:1,contentHash:'a'.repeat(64)},sourceSnapshotRef={id:root,version:1,contentHash:'b'.repeat(64)},scope={projectId:pid,documentRef};
const input=()=>({documentRef,sourceRootId:root,relativePath:'docs/설계.md',sourceSnapshotRef,blobHash:'c'.repeat(64),reason:'사용자가 대조한 원문 연결'});
const first=()=>{const snapshot={projectId:pid,...input(),kind:'LINKED',state:'ACTIVE',previousRef:null,recordedAt:'2026-10-21T00:00:00.000Z'};return{ref:{id,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};};
async function api(){const m=await import('../../../apps/server/modules/documents/document-source-link-history.ts').catch(()=>null);assert.ok(m,'문서 소스 연결 이력 검사 기반이 필요하다');return m;}
test('link/detach 입력은 고정 참조를 복사하고 검증권위/파일접근을 만들지 않는다',async()=>{
 const m=await api(),raw=input(),read=m.readDocumentSourceLinkInput('linkDocumentSource',raw);assert.deepEqual(read,raw);read.documentRef.version=9;assert.equal(raw.documentRef.version,1);
 assert.deepEqual(m.readDocumentSourceLinkInput('detachDocumentSource',{sourceLinkRef:first().ref,reason:'연결만 분리'}),{sourceLinkRef:first().ref,reason:'연결만 분리'});
});
test('경로이탈·불완전 참조·권위주입·비밀·지원밖 연산은 입력 단계에서 거절한다',async()=>{
 const m=await api();for(const relativePath of ['../escape','/root','C:/x','a\\b','a/%2e','CON.txt','a/../b','a/','e\u0301.md'])assert.throws(()=>m.readDocumentSourceLinkInput('linkDocumentSource',{...input(),relativePath}));
 for(const change of [{verified:true},{documentRef:{...documentRef,version:0}},{sourceSnapshotRef:{...sourceSnapshotRef,contentHash:'x'}},{blobHash:'z'.repeat(64)},{reason:'password=not-a-real-secret'}])assert.throws(()=>m.readDocumentSourceLinkInput('linkDocumentSource',{...input(),...change}));
 assert.throws(()=>m.readDocumentSourceLinkInput('proposeDocumentSourceChange',input()));
});
test('분리 준비는 exact 현재ref에서 원문/소스 참조를 보존하고 원역사를 바꾸지 않는다',async()=>{
 const m=await api(),history=[first()],before=structuredClone(history),at='2026-10-21T00:00:01.000Z';
 const snapshot=m.prepareDocumentSourceDetach(scope,history,{sourceLinkRef:history[0]!.ref,reason:'파일/문서는 남기고 연결만 분리'},at);
 assert.deepEqual(snapshot,{...before[0]!.snapshot,kind:'DETACHED',state:'DETACHED',previousRef:before[0]!.ref,reason:'파일/문서는 남기고 연결만 분리',recordedAt:at});assert.deepEqual(history,before);
 const detached={ref:{id,version:2,contentHash:contentHash(canonicalJson(snapshot))},snapshot};assert.deepEqual(m.readDocumentSourceLinkHistory(scope,[...history,detached]),[...history,detached]);
 assert.throws(()=>m.prepareDocumentSourceDetach(scope,[...history,detached],{sourceLinkRef:detached.ref,reason:'다시 분리'},at),{message:'DOCUMENT_SOURCE_LINK_VERSION_CONFLICT'});
});
test('다른 범위·변조·순번/앞참조/원문변경 체인·stale 분리는 거절한다',async()=>{
 const m=await api(),one=first();assert.throws(()=>m.readDocumentSourceLinkHistory({...scope,projectId:root},[one]));assert.throws(()=>m.readDocumentSourceLinkHistory(scope,[{...one,snapshot:{...one.snapshot,blobHash:'d'.repeat(64)}}]));
 assert.throws(()=>m.prepareDocumentSourceDetach(scope,[one],{sourceLinkRef:{...one.ref,contentHash:'d'.repeat(64)},reason:'옛 참조'},'2026-10-21T00:00:01.000Z'),{message:'DOCUMENT_SOURCE_LINK_VERSION_CONFLICT'});
 const good=m.prepareDocumentSourceDetach(scope,[one],{sourceLinkRef:one.ref,reason:'분리'},'2026-10-21T00:00:01.000Z');
 for(const change of [{previousRef:null},{documentRef:{...documentRef,version:2}},{documentRef:{...documentRef,contentHash:'d'.repeat(64)}},{sourceRootId:pid},{sourceSnapshotRef:{...sourceSnapshotRef,version:2}},{blobHash:'d'.repeat(64)},{relativePath:'other.md'},{recordedAt:'2026-10-20T23:00:00.000Z'},{state:'ACTIVE'}]){const snapshot={...good,...change};assert.throws(()=>m.readDocumentSourceLinkHistory(scope,[one,{ref:{id,version:2,contentHash:contentHash(canonicalJson(snapshot))},snapshot}]));}
 assert.throws(()=>m.readDocumentSourceLinkHistory(scope,[one,{ref:{id:root,version:2,contentHash:contentHash(canonicalJson(good))},snapshot:good}]));
 assert.throws(()=>m.readDocumentSourceLinkHistory(scope,[one,{ref:{id,version:3,contentHash:contentHash(canonicalJson(good))},snapshot:good}]));
});
test('해시 계산 전에 잘못된 앞참조를 이력 무결성 오류로 거절한다',async()=>{
 const m=await api(),entry=first();for(const previousRef of [undefined,{},['unexpected']])assert.throws(()=>m.readDocumentSourceLinkHistory(scope,[{...entry,snapshot:{...entry.snapshot,previousRef}}]),(e:any)=>e.message==='DOCUMENT_SOURCE_LINK_HISTORY_INVALID'&&e.statusCode===503);
});
