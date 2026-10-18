import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const module=await import(new URL('../../../apps/web/src/features/workspace/stage-requirements.ts',import.meta.url).href).catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
function render(props:any){assert.equal(typeof module.StageRequirements,'function');return renderToStaticMarkup(createElement(module.StageRequirements,props));}
test('선택 단계의 필요 능력·환경과 정확한 한도 참조를 고정 정의로 표시한다',()=>{
 const html=render({requirements:{capabilities:['파일 수정','시험 실행'],environment:['Windows']},limitPolicyRef:{id:'11111111-1111-4111-8111-111111111111',version:7,contentHash:'d'.repeat(64)}});
 for(const value of ['단계 필요조건 정의','파일 수정','시험 실행','Windows','11111111-1111-4111-8111-111111111111','v7','d'.repeat(64),'실제 능력·환경·예산 검증이나 실행 허가가 아닙니다.'])assert.ok(html.includes(value),value);
 assert.equal(html.includes('<button'),false);
});
test('다른 단계의 누락·빈 정의는 없음으로 표시하고 앞 단계 조건을 남기지 않는다',()=>{
 const first=render({requirements:{capabilities:['이전 능력'],environment:['이전 환경']},limitPolicyRef:null});assert.ok(first.includes('이전 능력'));
 for(const props of [{limitPolicyRef:null},{requirements:{capabilities:[],environment:[]},limitPolicyRef:null}]){const next=render(props);for(const value of ['필요 능력 정의 없음','개발환경 정의 없음','한도 정책 참조 없음'])assert.ok(next.includes(value),value);assert.equal(next.includes('이전 능력'),false);assert.equal(next.includes('이전 환경'),false);}
});
test('사용자 정의 필요조건은 HTML이 아닌 text로 렌더링하고 입력을 수정하지 않는다',()=>{
 const props={requirements:{capabilities:['<script>window.RUN=1</script>'],environment:['<img src=x onerror=RUN()>']},limitPolicyRef:null},before=JSON.stringify(props),html=render(props);
 assert.ok(html.includes('&lt;script&gt;window.RUN=1&lt;/script&gt;'));assert.ok(html.includes('&lt;img src=x onerror=RUN()&gt;'));assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img'),false);assert.equal(JSON.stringify(props),before);
});
