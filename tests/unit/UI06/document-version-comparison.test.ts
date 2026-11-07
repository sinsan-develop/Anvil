import { test } from 'node:test';
import assert from 'node:assert/strict';

const moduleUrl = new URL('../../../apps/web/src/features/design-trace/document-version-comparison.ts', import.meta.url);
const implementation = await import(moduleUrl.href).catch((cause: NodeJS.ErrnoException) => {
  if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  return {};
});
function compare(before: string, after: string) {
  assert.equal(typeof implementation.compareDocumentBodies, 'function', '저장 버전 비교 기능이 필요합니다');
  return implementation.compareDocumentBodies(before, after);
}

const definition=()=>({title:'원제목',formRef:{id:'F01',version:1,contentHash:'a'.repeat(64)},stageNodeRef:null,content:{sections:[{itemId:'purpose',anchor:'line:1'}],attachments:[],sourceRefs:[]}});
function definitions(before:ReturnType<typeof definition>,after:ReturnType<typeof definition>){
 assert.equal(typeof implementation.compareDocumentDefinitions,'function','저장 문서 정의의 비교 소비 누락');return implementation.compareDocumentDefinitions(before,after);
}
test('같은 본문이라도 제목·양식·단계·목차·첨부·출처의 변경을 독립 구분한다',()=>{
 const before=definition(),after:any=definition();after.title='<script>제목</script>';after.formRef.version=2;after.stageNodeRef={applicationId:'M01',nodeId:'build'};after.content.sections=[];after.content.attachments=[{artifactId:'FILE',bytes:4,contentHash:'b'.repeat(64),mediaType:'text/plain'}];after.content.sourceRefs=[{id:'SOURCE'}];
 const result=definitions(before,after);assert.deepEqual(result.map((i:any)=>[i.field,i.kind]),[['title','CHANGED'],['formRef','CHANGED'],['stageNodeRef','CHANGED'],['sections','CHANGED'],['attachments','CHANGED'],['sourceRefs','CHANGED']]);assert.equal(result[0].before,'"원제목"');assert.equal(result[0].after,'"<script>제목</script>"');assert.equal(before.formRef.version,1);
});
test('객체 키 순서는 변경으로 만들지 않고 배열 순서·누락 단계와 표시 한도는 구분한다',()=>{
 const before=definition(),same:any={...definition(),formRef:{contentHash:'a'.repeat(64),version:1,id:'F01'}};delete same.stageNodeRef;
 assert(definitions(before,same).every((i:any)=>i.kind==='IDENTICAL'));
 const after=definition();after.content.sections=[{itemId:'second',anchor:'line:2'},...after.content.sections];assert.equal(definitions(before,after).find((i:any)=>i.field==='sections').kind,'CHANGED');
 after.title='가'.repeat(131073);const limited=definitions(before,after).find((i:any)=>i.field==='title');assert.deepEqual(limited,{field:'title',kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'});
});
test('출처의 과도한 중첩·노드 수는 렌더 예외 없이 해당 항목만 미확인으로 남긴다',()=>{
 const before=definition(),after:any=definition();let nested:any='끝';for(let i=0;i<12000;i++)nested={next:nested};after.content.sourceRefs=[nested];
 const result=definitions(before,after);assert.deepEqual(result.find((i:any)=>i.field==='sourceRefs'),{field:'sourceRefs',kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'});assert.equal(result.find((i:any)=>i.field==='title').kind,'IDENTICAL');
 after.content.sourceRefs=Array.from({length:20001},()=>0);assert.equal(definitions(before,after).find((i:any)=>i.field==='sourceRefs').kind,'UNVERIFIED');
});

// 앞/뒤 공통줄을 잘못 잘라 다른 원문을 표시하거나 줄바꿈을 정규화하면 실패한다.
test('공통 앞뒤 줄 밖의 두 원문 구간을 BOM·CRLF·태그 그대로 반환한다', () => {
  assert.deepEqual(compare('\uFEFF제목\r\n이전\r\n끝\n', '\uFEFF제목\r\n<script>변경</script>\r\n끝\n'), {
    kind: 'CHANGED', commonBeforeLines: 1, commonAfterLines: 1,
    before: '이전\r\n', after: '<script>변경</script>\r\n',
  });
});

test('동일·빈 원문과 추가·제거를 구분하고 EOL 차이를 같다고 숨기지 않는다', () => {
  assert.deepEqual(compare('', ''), { kind: 'IDENTICAL' });
  assert.deepEqual(compare('원문\r\n', '원문\r\n'), { kind: 'IDENTICAL' });
  assert.deepEqual(compare('', '새 줄\n'), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 0, before: '', after: '새 줄\n' });
  assert.deepEqual(compare('제거\n', ''), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 0, before: '제거\n', after: '' });
  assert.deepEqual(compare('같은줄\r\n', '같은줄\n'), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 0, before: '같은줄\r\n', after: '같은줄\n' });
});

test('공통 prefix와 suffix가 겹치거나 반복된 줄을 소비하지 않는다', () => {
  assert.deepEqual(compare('가\n나\n', '가\n가\n나\n'), { kind: 'CHANGED', commonBeforeLines: 1, commonAfterLines: 1, before: '', after: '가\n' });
  assert.deepEqual(compare('가\n나\n', '나\n'), { kind: 'CHANGED', commonBeforeLines: 0, commonAfterLines: 1, before: '가\n', after: '' });
});

test('큰 입력은 비교 미확인으로 남기고 일부 구간을 전체 비교처럼 반환하지 않는다', () => {
  assert.deepEqual(compare('가'.repeat(131073), '나'), { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' });
  assert.deepEqual(compare('가', '\n'.repeat(4000)), { kind: 'UNVERIFIED', reason: 'DISPLAY_LIMIT' });
  assert.equal(compare('가'.repeat(131072), '나').kind, 'CHANGED');
  assert.equal(compare('\n'.repeat(3999), '나').kind, 'CHANGED');
});
