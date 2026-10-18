import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const file = new URL('../../../apps/web/src/features/workspace/work-plan-task-original.ts', import.meta.url);
const module = existsSync(file) ? await import(file.href) : {};
const ref = { id: '10000000-0000-4000-8000-000000000001', version: 2, contentHash: 'a'.repeat(64) };
const task = { taskCode: 'FN01', type: 'FUNCTION', title: '등록 처리', purpose: '사용자가 지식을 소유', designRefs: [], screenRefs: [], ownerRole: '단계책임자', inputs: ['확정 요구'], outputs: ['저장 결과'], included: ['정상 처리'], excluded: ['외부 공유'], allowedFileRefs: ['apps/server/feature.ts'], startPrerequisites: ['FN00'], acceptancePrerequisites: ['IX01'], steps: ['요구 원문 읽기', '변경 수행'], testCases: [{ id: 'TC01', kind: 'NORMAL', steps: ['화면에서 등록', '재조회'], expected: '원문 유지', environment: 'WSL 개발' }], acceptanceCriteria: ['실제 저장'], evidenceRequirements: ['정확 명령/종료 코드'], rollback: '이전 검증본으로 명시 복구', recoveryNotes: '미완료 내용을 인계' };
const plan: any = { ref, designRef: ref, documentRef: ref, tasks: [task, { ...task, taskCode: 'FN02', title: '다른 업무', steps: ['다른 수행 절차'] }] };
function html(taskCode = 'FN01') { assert.equal(typeof module.WorkPlanTaskOriginal, 'function'); return renderToStaticMarkup(createElement(module.WorkPlanTaskOriginal, { plan, taskCode })); }
test('선택한 저장 업무의 수행·선행·시험 절차/환경·증거와 복구 원문을 빠뜨리지 않는다', () => {
 const before = structuredClone(plan), text = html();
 for (const expected of ['등록 처리', '사용자가 지식을 소유', '단계책임자', '확정 요구', '저장 결과', '정상 처리', '외부 공유', 'FN00', 'IX01', '요구 원문 읽기', '변경 수행', '화면에서 등록', '재조회', '원문 유지', 'WSL 개발', '실제 저장', '정확 명령/종료 코드', '이전 검증본으로 명시 복구', '미완료 내용을 인계', 'apps/server/feature.ts', ref.contentHash]) assert.ok(text.includes(expected), expected);
 assert.deepEqual(plan, before); assert.match(text, /실제 권한.*선행 완료.*판정하지 않습니다/);
});
test('선택 변경·알 수 없는 업무에서는 앞 업무 원문을 남기거나 첫 업무로 대체하지 않는다', () => {
 const other = html('FN02'); assert.match(other, /다른 수행 절차/); assert.equal(other.includes('요구 원문 읽기'), false);
 const absent = html('NOT_FOUND'); assert.equal(absent.includes('등록 처리'), false); assert.equal(absent.includes('요구 원문 읽기'), false); assert.match(absent, /선택 업무 원문 없음/);
});
test('업무 카드의 markup 같은 문자열은 실행 가능한 HTML이 아니라 텍스트로 표시한다', () => {
 const hostile: any = structuredClone(plan); hostile.tasks[0].steps = ['<img src=x onerror=alert(1)>'];
 assert.equal(typeof module.WorkPlanTaskOriginal, 'function'); const text = renderToStaticMarkup(createElement(module.WorkPlanTaskOriginal, { plan: hostile, taskCode: 'FN01' }));
 assert.equal(text.includes('<img'), false); assert.ok(text.includes('&lt;img')); assert.equal(hostile.tasks[0].steps[0], '<img src=x onerror=alert(1)>');
});
