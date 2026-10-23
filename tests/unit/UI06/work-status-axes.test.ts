import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const ui:any=await import(new URL('../../../apps/web/src/features/design-trace/WorkStatusAxes.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`89000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:2,contentHash:'a'.repeat(64)});
function fixture():any{return {projectId:id(1),planRef:ref(2),taskCode:'FN04-01',progress:'IN_PROGRESS',feature:'PARTIAL',verification:'NOT_EXECUTED',scope:'지정 업무의 화면·기능 연결',environment:'WSL 개발 환경 · 실제 검증 미실행',evidenceRefs:[ref(3)],unverified:['API/DB 핵심 흐름 미확인']};}
const expected=()=>({projectId:id(1),planRef:ref(2),taskCode:'FN04-01'});
function render(value:unknown,e:unknown=expected()){assert.equal(typeof ui.WorkStatusAxes,'function','세 상태축 읽기전용 표시 미구현');return renderToStaticMarkup(createElement(ui.WorkStatusAxes,{value,expected:e}));}
test('완료진행·부분구현·실패검증을 서로 승격하거나 하나의합격으로 합치지 않는다',()=>{
 const html=render({...fixture(),progress:'COMPLETED',feature:'PARTIAL',verification:'FAIL'});assert.match(html,/업무 진행/);assert.match(html,/기능 사용 가능성/);assert.match(html,/검증 결과/);assert.match(html,/>완료</);assert.match(html,/>부분 구현</);assert.match(html,/>실패</);assert.doesNotMatch(html,/구현 완료·핵심 동작 확인|전체 완료|전체 통과|<button|<input|<form|<a\s/);assert.match(html,/표시 후보/);assert.match(html,/실제 상태·검수는 미확인/);
});
test('공식 상태값을 축별로 표시하고 기존baseline 약칭을 섞지 않는다',()=>{
 const rows=[['progress','NOT_STARTED','시작 전'],['progress','IN_PROGRESS','작업 중'],['progress','REVIEW','검토'],['progress','TESTING','테스트'],['progress','REWORK','보완 필요'],['progress','COMPLETED','완료'],['feature','IMPLEMENTED_VERIFIED','구현 완료·핵심 동작 확인'],['feature','IMPLEMENTED_UNVERIFIED','구현했지만 동작 미확인'],['feature','PARTIAL','부분 구현'],['feature','NOT_IMPLEMENTED','미구현'],['verification','PASS','통과'],['verification','FAIL','실패'],['verification','NOT_EXECUTED','미실행'],['verification','BLOCKED','차단'],['verification','NOT_APPLICABLE','해당 없음']];
 for(const [field,code,label] of rows){const html=render({...fixture(),[field!]:code});assert.ok(html.includes('>'+label+'<'),String(code));assert.doesNotMatch(html,/표시 자료를 확인하지 못했습니다/);}
 for(const code of ['IMPLEMENTED_CORE_CHECKED','IMPLEMENTED_UNCHECKED'])assert.match(render({...fixture(),feature:code}),/표시 자료를 확인하지 못했습니다/);
});
test('범위·환경·근거와 미확인을 함께 표시하며 문자열은 markup이나동작으로 실행하지 않는다',()=>{
 const f=fixture();f.scope='<img src=x onerror=alert(1)>';f.unverified=['<script>private()</script>'];const html=render(f);assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.doesNotMatch(html,/<img|<script|<iframe|href=/);assert.ok(html.includes(f.environment));assert.ok(html.includes(id(3)));assert.match(html,/v2/);assert.match(html,/미확인 항목/);
 const missing=render({...fixture(),evidenceRefs:[],unverified:[]});assert.match(missing,/연결 근거 없음/);assert.match(missing,/미확인 항목이 제공되지 않았습니다/);assert.doesNotMatch(missing,/미확인 없음/);
});
test('다른project/계획fullref/업무·미지코드·추가원문/권위·범위누락은 고정경고로 닫힌다',()=>{
 for(const patch of [{projectId:id(99)},{planRef:{...ref(2),contentHash:'b'.repeat(64)}},{taskCode:'FN04-02'},{progress:'READY'},{feature:'PASS'},{verification:'COMPLETED'},{scope:''},{environment:''},{evidenceRefs:[{...ref(3),version:0}]},{executionAuthorized:true},{body:'PRIVATE_SENTINEL'},{scope:'x'.repeat(2001)}]){const html=render({...fixture(),...patch});assert.match(html,/표시 자료를 확인하지 못했습니다/);assert.doesNotMatch(html,/PRIVATE_SENTINEL|FN04-02|업무 진행<|기능 사용 가능성</);}
 for(const patch of [{progress:'COMPLETED'},{feature:'IMPLEMENTED_VERIFIED'},{verification:'PASS'}])assert.match(render({...fixture(),...patch,evidenceRefs:[]}),/표시 자료를 확인하지 못했습니다/);
});
test('getter·배열getter·expected 변조는 평가하거나 다른업무 상태로 표시하지 않는다',()=>{
 let gets=0;const f=fixture();Object.defineProperty(f,'progress',{enumerable:true,get(){gets++;return 'COMPLETED';}});assert.match(render(f),/표시 자료를 확인하지 못했습니다/);const g=fixture();Object.defineProperty(g.evidenceRefs,'0',{enumerable:true,get(){gets++;return ref(3);}});assert.match(render(g),/표시 자료를 확인하지 못했습니다/);const e=expected();Object.defineProperty(e,'planRef',{enumerable:true,get(){gets++;return ref(2);}});assert.match(render(fixture(),e),/표시 자료를 확인하지 못했습니다/);assert.equal(gets,0);
});
