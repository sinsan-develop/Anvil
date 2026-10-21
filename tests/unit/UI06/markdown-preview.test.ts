import test from 'node:test';import assert from 'node:assert/strict';
const mod:any=await import(new URL('../../../apps/web/src/features/design-trace/markdown-preview.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function preview(body:string){assert.equal(typeof mod.parseMarkdownPreview,'function','Markdown 서식 조회가 필요합니다');return mod.parseMarkdownPreview(body);}
test('BOM/CRLF 원문을 수정하지 않고 제목·문단·단순목록·인용·코드를 표시 구조로 만든다',()=>{
 const source='\uFEFF# 목적\r\n\r\n첫 문장\r\n다음 문장\r\n\r\n- 첫째\r\n- 둘째\r\n\r\n3. 셋째\r\n4. 넷째\r\n9. 아홉째\r\n\r\n> 인용\r\n\r\n```js\r\n<script>bad()</script>\r\n```';
 assert.deepEqual(preview(source),{kind:'READY',unclosedCode:false,blocks:[{kind:'HEADING',level:1,text:'목적'},{kind:'PARAGRAPH',text:'첫 문장\n다음 문장'},{kind:'LIST',ordered:false,start:1,items:['첫째','둘째']},{kind:'LIST',ordered:true,start:3,items:['셋째','넷째']},{kind:'LIST',ordered:true,start:9,items:['아홉째']},{kind:'QUOTE',text:'인용'},{kind:'CODE',info:'js',text:'<script>bad()</script>'}]});assert(source.startsWith('\uFEFF# 목적\r\n'));
});
test('표의 escaped pipe·정렬과 각 셀을 보존하고 열 수 다른 후속 줄을 버리지 않는다',()=>{
 assert.deepEqual(preview('| ID | 내용 |\n| :--- | ---: |\n| A | 가\\|나 |\n| 잘못 | 열 | 개수 |').blocks,[{kind:'TABLE',headers:['ID','내용'],align:['left','right'],rows:[['A','가|나']]},{kind:'PARAGRAPH',text:'| 잘못 | 열 | 개수 |'}]);
});
test('HTML/링크/이미지와 미지원 inline 표기를 실행 지시나 URL 노드로 변환하지 않는다',()=>{
 assert.deepEqual(preview('<iframe src=x></iframe>\n[x](javascript:bad())\n![비밀](https://outside.invalid/p)\n**강조**').blocks,[{kind:'PARAGRAPH',text:'<iframe src=x></iframe>\n[x](javascript:bad())\n![비밀](https://outside.invalid/p)\n**강조**'}]);
 const r=preview('~~~\n코드\n끝');assert.equal(r.unclosedCode,true);assert.deepEqual(r.blocks,[{kind:'CODE',info:'',text:'코드\n끝'}]);
});
test('크기·줄·블록·표 열 한도 초과는 부분 성공 없이 전체 미리보기 미확인이다',()=>{
 for(const source of ['가'.repeat(131073),'\n'.repeat(4000),Array.from({length:2001},()=> '# 절').join('\n'),'|'+Array(51).fill('열').join('|')+'|\n|'+Array(51).fill('---').join('|')+'|'])assert.deepEqual(preview(source),{kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'});
 assert.equal(preview('가'.repeat(131072)).kind,'READY');assert.deepEqual(preview(''),{kind:'READY',blocks:[],unclosedCode:false});
});
test('표 셀 누적이 표시 항목 한도를 넘으면 부분 표를 성공으로 반환하지 않는다',()=>{
 const header='|'+Array(50).fill('열').join('|')+'|',delimiter='|'+Array(50).fill('---').join('|')+'|',row='|'+Array(50).fill('').join('|')+'|';
 // 398행: 표1+머리50+셀19900=19951, 399행: 표1+머리50+셀19950=20001.
 assert.equal(preview([header,delimiter,...Array(398).fill(row)].join('\n')).kind,'READY');
 assert.deepEqual(preview([header,delimiter,...Array(399).fill(row)].join('\n')),{kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'});
});
