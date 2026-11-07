import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TaskCard } from '../../../apps/server/modules/traceability/work-plan-card.ts';
const file = new URL('../../../apps/web/src/features/design-trace/StoredPlanTasks.tsx', import.meta.url);
const compiler = existsSync(file) ? await createServer({ configFile: fileURLToPath(new URL('../../../apps/web/vite.config.ts', import.meta.url)), server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true }, logLevel: 'silent' }) : null;
after(async () => { await compiler?.close(); });
const module = compiler ? await compiler.ssrLoadModule('/src/features/design-trace/StoredPlanTasks.tsx') : {};
const task: TaskCard = { taskCode: 'UI01', type: 'SCREEN', title: '로그인 화면', purpose: '계정별 시작', designRefs: [], screenRefs: [], ownerRole: '개발 담당', inputs: ['요구 원문'], outputs: ['입력 화면'], included: ['폼 연결'], excluded: ['운영 배포'], allowedFileRefs: ['apps/web/login.tsx'], startPrerequisites: ['P01'], acceptancePrerequisites: ['FN01'], steps: ['구현', '저장 재조회'], testCases: [{ id: 'TC01', kind: 'IMPORTANT_FAILURE', steps: ['만료 시도'], expected: '거절', environment: '개발환경' }], acceptanceCriteria: ['권한 거절'], evidenceRequirements: ['실제 결과'], rollback: '이전 commit 복원', recoveryNotes: '중단 위치 기록' };
const tasks: TaskCard[] = [task, { ...task, taskCode: 'FN01', type: 'FUNCTION', title: '로그인 처리', purpose: '세션 확인' }, { ...task, taskCode: 'IX01', type: 'INTEGRATION', title: '저장 연결', purpose: '화면에서 재조회' }, { ...task, taskCode: 'P01', type: 'PREPARATION', title: '환경 준비', purpose: '안전한 환경' }];
function render(values: TaskCard[], query = '', type = 'ALL') { assert.equal(typeof module.StoredPlanTaskList, 'function'); return renderToStaticMarkup(createElement(module.StoredPlanTaskList, { tasks: values, query, type })); }

test('유형 필터는 화면·기능·연결·준비 업무를 구분하고 전체 조회에서는 원래 순서를 유지한다', () => {
 const all = render(tasks); for (const code of ['UI01', 'FN01', 'IX01', 'P01']) assert.ok(all.includes(code));
 const positions = ['로그인 화면', '로그인 처리', '저장 연결', '환경 준비'].map(name => all.indexOf(name)); assert.deepEqual([...positions].sort((a, b) => a - b), positions);
 for (const [type, title] of [['SCREEN', '로그인 화면'], ['FUNCTION', '로그인 처리'], ['INTEGRATION', '저장 연결'], ['PREPARATION', '환경 준비']]) { const html = render(tasks, '', type); assert.ok(html.includes(title!)); for (const other of ['로그인 화면', '로그인 처리', '저장 연결', '환경 준비'].filter(value => value !== title)) assert.equal(html.includes(other), false); }
});

test('ID·제목·목적 찾기는 유형과 함께 적용하고 입력 원본·중복 행을 삭제하지 않는다', () => {
 const values = [...tasks, { ...task, title: '중복 코드는 원문에 보존' }], before = JSON.stringify(values);
 assert.ok(render(values, ' fn01 ').includes('로그인 처리')); assert.ok(render(values, '재조회', 'INTEGRATION').includes('저장 연결')); assert.equal(render(values, '로그인', 'PREPARATION').includes('로그인 화면'), false);
 assert.ok(render(values, 'UI01').includes('중복 코드는 원문에 보존')); assert.equal(JSON.stringify(values), before);
});

test('업무 없는 계획과 검색 결과 없음은 구분하고 선행·검수·시험·복구 원문을 보존한다', () => {
 assert.ok(render([]).includes('저장된 업무 카드가 없습니다')); assert.ok(render(tasks, '없는 업무').includes('조건에 맞는 업무 카드가 없습니다'));
 const html = render([task]); for (const value of ['착수 선행', 'P01', '검수 선행', 'FN01', '요구 원문', '폼 연결', '운영 배포', 'apps/web/login.tsx', '만료 시도', '거절', '개발환경', '이전 commit 복원', '중단 위치 기록']) assert.ok(html.includes(value), value);
 const unsafe = render([{ ...task, title: '<script>not-executed</script>' }]); assert.ok(unsafe.includes('&lt;script&gt;')); assert.equal(unsafe.includes('<script>'), false);
});
