import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzePlanDependencies } from '../../../apps/server/modules/traceability/plan-dependencies.ts';

test('착수 선행과 연결 검수 선행은 별개이며 UI 착수를 기능 검수 때문에 막지 않는다', () => {
  const result=analyzePlanDependencies(['UI00','UI01','FN01'],[
    {taskCode:'UI01',dependencyTaskCode:'UI00',phase:'START'},
    {taskCode:'UI01',dependencyTaskCode:'FN01',phase:'ACCEPTANCE'},
  ]);
  assert.deepEqual(result.issues,[]); assert.equal(result.formatOnly,true); assert.equal(result.readiness,'REFERENCE_AND_PERMISSION_CHECKS_REQUIRED');
  assert.deepEqual(result.dependencies.filter(e=>e.phase==='START').map(e=>e.dependencyTaskCode),['UI00']);
});

test('중복 업무·없는 선행·자기 의존·동일 edge와 phase별 순환을 위치별로 반환한다', () => {
  const result=analyzePlanDependencies(['UI01','FN01','UI01'],[
    {taskCode:'UI01',dependencyTaskCode:'MISSING',phase:'START'},
    {taskCode:'FN01',dependencyTaskCode:'FN01',phase:'START'},
    {taskCode:'UI01',dependencyTaskCode:'FN01',phase:'ACCEPTANCE'},
    {taskCode:'UI01',dependencyTaskCode:'FN01',phase:'ACCEPTANCE'},
    {taskCode:'FN01',dependencyTaskCode:'UI01',phase:'ACCEPTANCE'},
  ]);
  for(const code of ['DUPLICATE_TASK_CODE','DEPENDENCY_TASK_NOT_FOUND','SELF_DEPENDENCY','DUPLICATE_DEPENDENCY','DEPENDENCY_CYCLE']) assert.ok(result.issues.some(i=>i.code===code),code);
  assert.ok(result.issues.every(i=>i.location.length>0));
});

test('순환이 없는 순차 2000업무는 재귀 stack 없이 검사하고 원 입력을 변형하지 않는다', () => {
  const codes=Array.from({length:2000},(_,i)=>'T'+i), edges=codes.slice(1).map((taskCode,i)=>({taskCode,dependencyTaskCode:codes[i]!,phase:'START' as const}));
  const before=structuredClone(edges), result=analyzePlanDependencies(codes,edges);
  assert.deepEqual(result.issues,[]); assert.deepEqual(edges,before); assert.notEqual(result.dependencies,edges);
});

test('알 수 없는 단계나 결과 상태를 선행 데이터에 숨겨 넣으면 형식 오류다', () => {
  const result=analyzePlanDependencies(['A'],[{taskCode:'A',dependencyTaskCode:'A',phase:'COMPLETED',status:'PASS'}] as any);
  assert.ok(result.issues.some(i=>i.code==='DEPENDENCY_INPUT_INVALID')); assert.equal(result.dependencies.length,0);
});
