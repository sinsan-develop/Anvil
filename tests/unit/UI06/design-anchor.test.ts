import{test}from'node:test';import assert from'node:assert/strict';
import * as anchor from '../../../apps/web/src/features/design-trace/design-anchor.ts';
const context={projectId:'11111111-1111-4111-8111-111111111111',documentRef:{id:'22222222-2222-4222-8222-222222222222',version:2,contentHash:'a'.repeat(64)},bodyHash:'b'.repeat(64)};
const pick=(line:string)=>({...structuredClone(context),anchor:line});
// 줄 위치를 정규화/추측하거나 원문 바이트를 바꿔 강조하면 실패한다.
test('정확한 원문 줄은 BOM·CRLF·빈줄·태그를 그대로 보존한 세 조각으로 나눈다',()=>{
 const resolve=(anchor as any).resolveDesignAnchor;assert.equal(typeof resolve,'function');
 const body='\uFEFF첫줄\r\n<img src=x onerror="bad()">\r\n\r마지막\n';
 const r=resolve(body,context,pick('line:2'));assert.equal(r.kind,'READY');assert.equal(r.lineNumber,2);assert.equal(r.line,'<img src=x onerror="bad()">');assert.equal(r.before+r.line+r.after,body);
 assert.equal(resolve(body,context,pick('line:3')).line,'');assert.equal(resolve(body,context,pick('line:5')).line,'');
});
// 다른 project/버전/메타데이터·본문hash를 현재 위치로 재사용하면 실패한다.
test('다른 프로젝트·문서·버전·원문hash의 선택과 잘못된 anchor는 미확인이다',()=>{
 const resolve=(anchor as any).resolveDesignAnchor;assert.equal(typeof resolve,'function');
 for(const selection of [{...pick('line:1'),projectId:'33333333-3333-4333-8333-333333333333'},{...pick('line:1'),documentRef:{...context.documentRef,version:1}},{...pick('line:1'),documentRef:{...context.documentRef,contentHash:'c'.repeat(64)}},{...pick('line:1'),documentRef:{...context.documentRef,id:'33333333-3333-4333-8333-333333333333'}},{...pick('line:1'),bodyHash:'c'.repeat(64)}])assert.deepEqual(resolve('본문',context,selection),{kind:'UNVERIFIED',reason:'CONTEXT_CHANGED'});
 for(const line of ['line:0','line:01','line:-1','line:1x','line:1 ','<script>','line:100000000'])assert.deepEqual(resolve('본문',context,pick(line)),{kind:'UNVERIFIED',reason:'INVALID_ANCHOR'});
 assert.deepEqual(resolve('본문',context,pick('line:2')),{kind:'UNVERIFIED',reason:'LINE_NOT_FOUND'});assert.deepEqual(resolve('본문',context,null),{kind:'IDLE'});
});
// 큰 문서의 앞부분을 임의로 대신 강조하거나 한도를 무시해 DOM/계산을 늘리면 실패한다.
test('131072 UTF16·4000줄 한도는 전체 원문 기준이고 입력을 수정하지 않는다',()=>{
 const resolve=(anchor as any).resolveDesignAnchor;assert.equal(typeof resolve,'function');
 assert.equal(resolve('가'.repeat(131072),context,pick('line:1')).kind,'READY');
 assert.deepEqual(resolve('가'.repeat(131073),context,pick('line:1')),{kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'});
 assert.equal(resolve('\n'.repeat(3999),context,pick('line:4000')).kind,'READY');assert.deepEqual(resolve('\n'.repeat(4000),context,pick('line:1')),{kind:'UNVERIFIED',reason:'DISPLAY_LIMIT'});
 assert.equal(context.documentRef.version,2);assert.equal(context.bodyHash,'b'.repeat(64));
});
