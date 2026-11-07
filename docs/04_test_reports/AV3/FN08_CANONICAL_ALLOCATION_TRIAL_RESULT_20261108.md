# FN08 정규 직렬화 할당 보완 후보 결과

판정은 미채택이다. 원 aggregate의 10초·기대값은 유지됐고, 후보 적용 뒤 지정 1회가 실패했다. 전체 gate와 계획은 미완료다.

- 기준 branch codex/av3-fn09-origin-decision-storage, HEAD c8beee71017cdecef1431466a44557533ef07de4.
- 원 구현 추가 검산 71bfd0 6PASS, 보완 뒤 8164ca 6PASS/skip0. type35908f·diff479804 exit0.
- 지정 종단 40294b는 exit1/1FAIL/skip0, 내부10034.7665ms·전체10919.4353ms, spawnSync ETIMEDOUT·status null이다. nested PID/signal/실제 정착은 출력에 없어 미확인이다.
- LF/CRLF 치환 가정의 준비 구문오류0f16f2는 정정했고 제품 반례와 구분한다. 같은 후보 재실행·timeout 변경·검사 생략은 없다.
- contentHash/parseWireJson 본문과 기존 시험1385B 접두사는 보존했다. 실제 DB·권한·키·서비스·Agent 실행0, 현재 handle/pending0.

## 재현 명령

```text
node --experimental-test-module-mocks --test --test-name-pattern='실제 보호 Context/Options→원 START queue/구체 proof/receiver' tests/unit/FN08/execution-start-context-source.test.ts
```

## 원본·후보 지문

| 경로 | Git 원본 bytes/SHA256 | 후보 bytes/SHA256 |
|---|---|---|
| contracts/canonical.ts | 2986 / 5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143 | 3049 / 7c6d9cda67529a834a3d25a38621be04e57e934060bffdc96d3000e9a8f36ef7 |
| tests/unit/contracts/canonical.test.ts | 1385 / 926c3abe7bce9925c2045b140fad86561c2253cda08d4b99b60f0ab2c1deaf75 | 5097 / f604c10963f5ab59af1b3bccfd334c7444a652c597cd03eab973ec7bc58c8dde |

후보 diff SHA256 8a78df922d2621887c4c7e48b613bace3609081ce5cfd7668a7d7882a5538abb이다. 이 기록 저장을 확인한 뒤 Main 지시로 정확한 소유 두 파일만 원 기준선으로 철회한다. 다른 backend/UI 변경·Git 이력은 보존한다.

## 보존 후보 diff

```diff
diff --git a/contracts/canonical.ts b/contracts/canonical.ts
index fba0375e..4b6aa8b2 100644
--- a/contracts/canonical.ts
+++ b/contracts/canonical.ts
@@ -20,20 +20,22 @@ export function canonicalJson(value: unknown): string {
       const descriptors = Object.getOwnPropertyDescriptors(item);
       if (Array.isArray(item)) {
         if (Object.keys(descriptors).length !== item.length + 1) return invalid();
-        const parts = [];
+        let result = '[';
         for (let n = 0; n < item.length; n++) {
           const descriptor = descriptors[String(n)];
           if (!descriptor || !('value' in descriptor)) return invalid();
-          parts.push(encode(descriptor.value, depth + 1));
+          result += (n === 0 ? '' : ',') + encode(descriptor.value, depth + 1);
         }
-        return '[' + parts.join(',') + ']';
+        return result + ']';
       }
-      const parts = Object.keys(descriptors).sort().map(key => {
+      let result = '{', separator = '';
+      for (const key of Object.keys(descriptors).sort()) {
         const descriptor = descriptors[key]!;
         if (!key.isWellFormed() || !descriptor.enumerable || !('value' in descriptor)) return invalid();
-        return JSON.stringify(key) + ':' + encode(descriptor.value, depth + 1);
-      });
-      return '{' + parts.join(',') + '}';
+        result += separator + JSON.stringify(key) + ':' + encode(descriptor.value, depth + 1);
+        separator = ',';
+      }
+      return result + '}';
     } finally { active.delete(item); }
   }
   return encode(value, 0);
diff --git a/tests/unit/contracts/canonical.test.ts b/tests/unit/contracts/canonical.test.ts
index be2a3f7b..9d420634 100644
--- a/tests/unit/contracts/canonical.test.ts
+++ b/tests/unit/contracts/canonical.test.ts
@@ -22,3 +22,58 @@ test('wire 중복키·escape로 위장한 중복키와 범위 밖 숫자를 거
   }
   assert.deepEqual(parseWireJson('{"a":[{"a":1},{"a":2}],"b":true}'), { a: [{ a: 1 }, { a: 2 }], b: true });
 });
+
+
+test('고정 Unicode·escape·UTF16 키 정렬의 문자열과 UTF8 hash를 보존한다', () => {
+  const expected = '{"a":["한글","😀","\\\"\\\\\\n",0,1.5,true,null],"z":{},"😀":1,"\ue000":2}';
+  const value = { '\ue000': 2, '😀': 1, z: Object.create(null), a: ['한글', '😀', '"\\\n', -0, 1.5, true, null] };
+  assert.equal(canonicalJson(value), expected);
+  assert.deepEqual(Buffer.from(canonicalJson(value), 'utf8'), Buffer.from(expected, 'utf8'));
+  assert.equal(contentHash(canonicalJson(value)), contentHash(Buffer.from(expected, 'utf8')));
+  const shared = { b: 2, a: 1 };
+  assert.equal(canonicalJson([shared, shared]), '[{"a":1,"b":2},{"a":1,"b":2}]');
+  const customArray = Object.setPrototypeOf([1, 2], null);
+  assert.equal(canonicalJson(customArray), '[1,2]');
+  const hiddenIndex = Object.defineProperty([1], '0', { value: 3, enumerable: false });
+  assert.equal(canonicalJson(hiddenIndex), '[3]');
+});
+
+test('깊이64·65·cycle·prototype·descriptor와 모든 거절 경계를 유지한다', () => {
+  const nested = (depth: number) => { let value: unknown = 0; for (let n = 0; n < depth; n++) value = [value]; return value; };
+  assert.equal(canonicalJson(nested(64)), '['.repeat(64) + '0' + ']'.repeat(64));
+  const cycle: unknown[] = []; cycle.push(cycle);
+  let getters = 0;
+  const accessor = Object.defineProperty({}, 'x', { enumerable: true, get() { getters++; return 1; } });
+  const arrayAccessor = Object.defineProperty([1], '0', { get() { getters++; return 1; } });
+  const extraArray = Object.assign([1], { extra: 2 });
+  for (const value of [nested(65), cycle, Object.create({ x: 1 }), { [Symbol('x')]: 1 },
+    Object.defineProperty({}, 'x', { value: 1 }), accessor, arrayAccessor, extraArray,
+    { '\ud800': 1 }, '\udfff', -Infinity, 1n, () => 1, Symbol('x'), Number.MAX_SAFE_INTEGER + 1]) {
+    assert.throws(() => canonicalJson(value), /^Error: INPUT_INVALID$/);
+  }
+  assert.equal(getters, 0);
+  assert.equal(canonicalJson({ after: [1] }), '{"after":[1]}');
+});
+
+test('원 객체·배열 Proxy 관측 순서와 length 재관측을 그대로 유지한다', () => {
+  const observe = (target: object) => {
+    const trace: string[] = [];
+    const proxy = new Proxy(target, {
+      ownKeys(t) { trace.push('keys'); return Reflect.ownKeys(t); },
+      getPrototypeOf(t) { trace.push('proto'); return Reflect.getPrototypeOf(t); },
+      getOwnPropertyDescriptor(t, key) { trace.push('desc:' + String(key)); return Reflect.getOwnPropertyDescriptor(t, key); },
+      get(t, key, receiver) { trace.push('get:' + String(key)); return Reflect.get(t, key, receiver); },
+    });
+    return { result: canonicalJson(proxy), trace };
+  };
+  assert.deepEqual(observe({ z: 1, a: [2] }), { result: '{"a":[2],"z":1}', trace: ['keys', 'proto', 'keys', 'desc:z', 'desc:a'] });
+  assert.deepEqual(observe([1, 2]), { result: '[1,2]', trace: ['keys', 'proto', 'keys', 'desc:0', 'desc:1', 'desc:length', 'get:length', 'get:length', 'get:length', 'get:length'] });
+  const target = { a: {} as object, z: 1 };
+  target.a = new Proxy({}, { ownKeys(t) { target.z = 99; return Reflect.ownKeys(t); } });
+  assert.equal(canonicalJson(target), '{"a":{},"z":1}', '자식 인코딩 전 획득한 descriptor snapshot 유지');
+  const failure = new Error('고정 관측 실패'), trace: string[] = [];
+  const throwing = new Proxy({ a: 1, z: 2 }, { getOwnPropertyDescriptor(t, key) { trace.push(String(key)); if (key === 'a') throw failure; return Reflect.getOwnPropertyDescriptor(t, key); } });
+  assert.throws(() => canonicalJson(throwing), error => error === failure);
+  assert.deepEqual(trace, ['a']);
+  assert.equal(canonicalJson([target, target]), '[{"a":{},"z":99},{"a":{},"z":99}]');
+});

```
