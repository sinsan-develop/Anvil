import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compareKnowledgeCorrection} from '../../../apps/web/src/features/knowledge/correction-diff.ts';

const fields={title:'원 제목',body:'첫 줄\n이전\n끝\n',reason:'이전 판단'};

// 바뀐 제목/판단 이유와 실제 본문 구간을 같은 상태/전문으로 뭉뚱그리면 실패한다.
test('현재 편집의 제목·판단 이유와 본문 변경 구간을 기준값에 맞게 구별한다',()=>{
 assert.deepEqual(compareKnowledgeCorrection(fields,{title:'새 제목',body:'첫 줄\n신규\n끝\n',reason:''}),{
  title:{change:'CHANGED',before:'원 제목',after:'새 제목'},
  reason:{change:'REMOVED',before:'이전 판단',after:''},
  body:{change:'CHANGED',detail:'FULL',diff:{format:'ANVIL_TEXT_DIFF_1',startLine:2,before:['이전\n'],after:['신규\n'],unchangedBefore:1,unchangedAfter:1}},
 });
});

// 빈 원문에 추가하거나 전부 삭제한 것을 변경 없음으로 판정하면 실패한다.
test('빈 값의 추가·삭제와 변경없음을 나눠 보여주고 입력을 수정하지 않는다',()=>{
 const before={title:'',body:'',reason:'판단'},after={title:'제목',body:'추가',reason:'판단'},copy=structuredClone([before,after]);
 const added=compareKnowledgeCorrection(before,after);assert.equal(added.title.change,'ADDED');assert.equal(added.body.change,'ADDED');assert.equal(added.reason.change,'UNCHANGED');
 const removed=compareKnowledgeCorrection(after,before);assert.equal(removed.title.change,'REMOVED');assert.equal(removed.body.change,'REMOVED');
 assert.equal(compareKnowledgeCorrection(fields,{...fields}).body.change,'UNCHANGED');assert.deepEqual([before,after],copy);
});

// BOM/줄끝/공백과 HTML처럼 보이는 원문을 정규화하거나 실행용 HTML로 치환하면 실패한다.
test('BOM·CRLF·공백·태그 모양 텍스트를 변경 구간 원문 그대로 보존한다',()=>{
 const value=compareKnowledgeCorrection({title:'<b>이전</b>',reason:' ',body:'\ufeff첫\r\n이전  \r\n끝\r\n'},{title:'<script>NEW</script>',reason:'  ',body:'\ufeff첫\r\n<script>NEW</script>\r\n끝\r\n'});
 assert.deepEqual(value.body,{change:'CHANGED',detail:'FULL',diff:{format:'ANVIL_TEXT_DIFF_1',startLine:2,before:['이전  \r\n'],after:['<script>NEW</script>\r\n'],unchangedBefore:1,unchangedAfter:1}});
 assert.equal(value.reason.change,'CHANGED');assert.equal(value.title.after,'<script>NEW</script>');
});

// 큰 다른 본문을 잘라 같다고 하거나 거대한 상세 diff를 만들면 실패한다.
test('본문 크기 초과는 변경 있음·상세 제한이고 동일한 큰 본문은 변경없음이다',()=>{
 const large='가'.repeat(65537),a={...fields,body:large},b={...fields,body:large+'나'};
 assert.deepEqual(compareKnowledgeCorrection(a,b).body,{change:'CHANGED',detail:'LIMITED',reason:'SIZE_LIMIT'});
 assert.deepEqual(compareKnowledgeCorrection(a,{...a}).body,{change:'UNCHANGED'});
 assert.equal(a.body.length,65537);assert.equal(b.body.length,65538);
});

// 짧은 문자열이라도 수만 줄로 나뉘면 전체 diff/DOM을 만들지 않아야 한다.
test('줄 수 초과와 정확 줄 경계를 구분하며 제한을 미변경으로 표시하지 않는다',()=>{
 const a={...fields,body:'\n'.repeat(2000)},b={...fields,body:'\n'.repeat(1999)+'끝\n'};
 assert.equal(compareKnowledgeCorrection(a,b).body.detail,'FULL');
 assert.deepEqual(compareKnowledgeCorrection(a,{...fields,body:'\n'.repeat(2001)}).body,{change:'CHANGED',detail:'LIMITED',reason:'LINE_LIMIT'});
});
