import test from 'node:test';import assert from 'node:assert/strict';
import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {assignmentPlanFixture} from '../UI05/assignment-plan-original-fixture.ts';
import type {WorkPlanView} from '../../../apps/web/src/features/design-trace/work-plan-api.ts';
const m:any=await import('../../../apps/web/src/features/design-trace/WorkPlanVersionComparison.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function render(before:any,after:any){assert.equal(typeof m.WorkPlanVersionComparison,'function');return renderToStaticMarkup(createElement(m.WorkPlanVersionComparison,{before,after}));}
test('계획 업무·선행·설계/문서 참조 차이를 읽기 표시하고 원문을 변경하지 않는다',()=>{
 const before:WorkPlanView=assignmentPlanFixture().plan,after=structuredClone(before);after.ref={...after.ref,version:3};after.tasks[0]!.purpose='새 목적 <script>bad()</script>';after.dependencies=[{taskCode:'FN09',dependencyTaskCode:'FN01',phase:'START'}];after.designRef={...after.designRef,version:2};const original=structuredClone({before,after}),html=render(before,after);
 assert.match(html,/기준 계획 v3/);assert.match(html,/보관 계획 v2/);assert.match(html,/새 목적 &lt;script&gt;/);assert.match(html,/dependencyTaskCode/);assert.match(html,/designRef/);assert.doesNotMatch(html,/<script>|<button|<input/);assert.deepEqual({before,after},original);
});
test('버전·관측시각만 다르면 표시 내용 동일이며 적용·검수 동일로 주장하지 않는다',()=>{
 const before=assignmentPlanFixture().plan,after=structuredClone(before);after.ref={...after.ref,version:3};after.observedAt='2026-10-20T10:00:00Z';const html=render(before,after);assert.match(html,/표시 내용이 같습니다/);assert.match(html,/검토·확정·적용 상태가 같다는 뜻은 아닙니다/);
});
test('다른 계획은 비교하지 않으며 표시 한도 초과는 변경없음으로 판정하지 않는다',()=>{
 const before=assignmentPlanFixture().plan,after=structuredClone(before);after.ref.id=before.designRef.id;assert.match(render(before,after),/동일 계획의 버전이 아니므로 비교하지 않습니다/);after.ref.id=before.ref.id;after.reason='가'.repeat(131073);const html=render(before,after);assert.match(html,/비교 미확인/);assert.doesNotMatch(html,/표시 내용이 같습니다/);
});
