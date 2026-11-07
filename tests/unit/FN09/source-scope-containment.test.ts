import assert from 'node:assert/strict';
import test from 'node:test';
const implementation = await import('../../../apps/server/modules/assignments/source-scope-containment.ts').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
const inspect = (parent: unknown, child: unknown) => {
  assert.equal(typeof (implementation as any).inspectSourceScopeContainment, 'function', '하위 임무 범위 판정이 구현되어야 한다');
  return (implementation as any).inspectSourceScopeContainment(parent, child);
};
const ref = { id: '11111111-1111-4111-8111-111111111111', version: 1, contentHash: 'a'.repeat(64) };
const scope = () => [{ sourceRootRef: { ...ref }, mappingRef: null, observationRef: { ...ref }, baselineRef: { ...ref }, targets: [
  { relativePath: 'src/a.ts', kind: 'FILE', access: 'READ', recursive: false },
  { relativePath: 'src/b.ts', kind: 'FILE', access: 'WRITE', recursive: false },
] }];
// 검출할 결함: 부모 밖 경로/연산 또는 다른 관측·기준/매핑을 하위 임무가 재사용하는 것.
test('부모 범위 일부의 구조 일치만 확인하고 실행 허가·입력 변경은 만들지 않는다', () => {
  const parent = scope(), child = scope(); child[0]!.targets.pop(); const before = JSON.stringify({ parent, child });
  assert.deepEqual(inspect(parent, child), { scopeContained: true, reasonCode: 'EXACT_SCOPE_SUBSET', executionAuthorized: false });
  assert.equal(JSON.stringify({ parent, child }), before); assert.equal(inspect(parent, parent).scopeContained, true);
});
test('추가 root·비허가 파일·다른 경로 대소문자·prefix 유사·상위 경로는 거절한다', () => {
  for (const path of ['src/other.ts', 'src/a.ts/extra', 'src/A.ts', '../outside.ts']) { const child = scope(); child[0]!.targets[0]!.relativePath = path; assert.equal(inspect(scope(), child).scopeContained, false); }
  const child = scope(); child[0]!.sourceRootRef.id = '22222222-2222-4222-8222-222222222222'; assert.equal(inspect(scope(), child).scopeContained, false);
});
test('READ/WRITE는 묵시적 포함을 추정하지 않고 동일 연산만 비교한다', () => {
  for (const index of [0, 1]) { const child = scope(); child[0]!.targets[index]!.access = index === 0 ? 'WRITE' : 'READ'; assert.deepEqual(inspect(scope(), child), { scopeContained: false, reasonCode: 'TARGET_NOT_CONTAINED', executionAuthorized: false }); }
});
test('root·관측·기준의 id/version/hash와 null/고정 매핑은 정확 일치해야 한다', () => {
  for (const field of ['sourceRootRef', 'observationRef', 'baselineRef'] as const) for (const key of ['id', 'version', 'contentHash']) { const child = scope(); (child[0]![field] as any)[key] = key === 'id' ? '22222222-2222-4222-8222-222222222222' : key === 'version' ? 2 : 'b'.repeat(64); assert.equal(inspect(scope(), child).scopeContained, false); }
  const child: any = scope(); child[0].mappingRef = { ...ref }; assert.equal(inspect(scope(), child).scopeContained, false);
  const parent: any = scope(); parent[0].mappingRef = { ...ref }; assert.equal(inspect(parent, child).scopeContained, true);
  child[0].mappingRef.version = 2; assert.equal(inspect(parent, child).scopeContained, false);
});
test('비정상 부모/자식·중복·상한·getter는 고정 사유로 거절하고 비밀을 반사하지 않는다', () => {
  const invalids: unknown[] = [null, [], [{ private: 'DO_NOT_REFLECT' }], [...scope(), ...scope()]];
  const tooMany = scope(); tooMany[0]!.targets = Array.from({ length: 201 }, (_, i) => ({ relativePath: `src/${i}.ts`, kind: 'FILE', access: 'READ', recursive: false })); invalids.push(tooMany);
  let calls = 0; const getter = scope(); Object.defineProperty(getter[0], 'targets', { enumerable: true, get() { calls++; throw Error('DO_NOT_REFLECT'); } }); invalids.push(getter);
  for (const invalid of invalids) { assert.deepEqual(inspect(invalid, scope()), { scopeContained: false, reasonCode: 'PARENT_SCOPE_INVALID', executionAuthorized: false }); assert.deepEqual(inspect(scope(), invalid), { scopeContained: false, reasonCode: 'CHILD_SCOPE_INVALID', executionAuthorized: false }); }
  assert.equal(calls, 0);
});
test('Proxy root/targets와 중첩 ref/항목은 trap을 호출하기 전에 거절한다', () => {
  for (const location of ['root', 'targets', 'scope', 'ref', 'target']) {
    const malformed: any = scope(); malformed[0].targets[0].kind = 'DIRECTORY'; let traps = 0;
    const wrap = (value: object) => new Proxy(value, { get(target, key, receiver) { traps++; return key === Symbol.iterator ? function* () {} : Reflect.get(target, key, receiver); } });
    let input = malformed;
    if (location === 'root') input = wrap(malformed);
    if (location === 'targets') malformed[0].targets = wrap(malformed[0].targets);
    if (location === 'scope') malformed[0] = wrap(malformed[0]);
    if (location === 'ref') malformed[0].sourceRootRef = wrap(malformed[0].sourceRootRef);
    if (location === 'target') malformed[0].targets[0] = wrap(malformed[0].targets[0]);
    assert.deepEqual(inspect(scope(), input), { scopeContained: false, reasonCode: 'CHILD_SCOPE_INVALID', executionAuthorized: false });
    assert.deepEqual(inspect(input, scope()), { scopeContained: false, reasonCode: 'PARENT_SCOPE_INVALID', executionAuthorized: false });
    assert.equal(traps, 0);
  }
});
test('사용자 정의 배열 iterator가 FILE/recursive 검사를 우회하거나 실행되지 않는다', () => {
  let calls = 0;
  const prototype = Object.create(Array.prototype, { [Symbol.iterator]: { value: function* () { calls++; } } });
  for (const location of ['root', 'targets']) for (const change of ['kind', 'recursive']) {
    const malformed: any = scope(); malformed[0].targets[0][change] = change === 'kind' ? 'DIRECTORY' : true;
    Object.setPrototypeOf(location === 'root' ? malformed : malformed[0].targets, prototype);
    assert.deepEqual(inspect(scope(), malformed), { scopeContained: false, reasonCode: 'CHILD_SCOPE_INVALID', executionAuthorized: false });
    assert.deepEqual(inspect(malformed, scope()), { scopeContained: false, reasonCode: 'PARENT_SCOPE_INVALID', executionAuthorized: false });
  }
  assert.equal(calls, 0);
});
