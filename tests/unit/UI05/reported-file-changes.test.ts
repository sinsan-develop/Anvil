import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const file='../../../apps/web/src/features/session-detail/ReportedFileChanges.ts';
const ref={id:'11000000-0000-4000-8000-000000000001',version:1,contentHash:'a'.repeat(64)};
test('변경 탐색은 보고된 경로·종류·hash와 등록diff 참조를 실제 파일 검증과 분리한다',async()=>{
 const {ReportedFileChanges}=await import(file),changes=[{path:'src/<script>x</script>.ts',kind:'MODIFIED',diffRef:ref,beforeHash:null,afterHash:'b'.repeat(64)},{path:'src/new.ts',kind:'ADDED',diffRef:null,beforeHash:null,afterHash:null},{path:'src/old.ts',kind:'DELETED',diffRef:{...ref,id:'22000000-0000-4000-8000-000000000002'},beforeHash:'c'.repeat(64),afterHash:null}],before=structuredClone(changes);
 const html=renderToStaticMarkup(createElement(ReportedFileChanges,{changes,artifacts:[ref]}));
 for(const text of ['제출 변경 파일 보고 탐색','보고 변경 종류','보고 경로 찾기','MODIFIED','ADDED','DELETED','변경 전 hash 미보고','diff 근거 참조 미보고','동일 제출의 등록 diff 참조 일치','등록 diff 참조 연결 미확인','실제 파일 변경·Git diff 검증이 아닙니다'])assert.ok(html.includes(text),text);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|href=|<button/);assert.deepEqual(changes,before);
});
test('잘못된 행·목록은 누락을 드러내고 정상 변경이나 완료로 승격하지 않는다',async()=>{
 const {ReportedFileChanges}=await import(file),html=renderToStaticMarkup(createElement(ReportedFileChanges,{changes:[{path:'../private',kind:'MODIFIED'}],artifacts:[]}));
 assert.match(html,/형식 미확인 1건/);assert.match(html,/원문 위치 1/);assert.match(html,/형식 확인된 변경 보고 0건/);assert.doesNotMatch(html,/href=|검수 완료|실행 완료/);
 const invalid=renderToStaticMarkup(createElement(ReportedFileChanges,{changes:null,artifacts:[]}));assert.match(invalid,/변경 보고 목록 형식·범위 미확인/);
});
