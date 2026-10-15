import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalJson, contentHash, parseWireJson } from '../../../contracts/canonical.ts';

test('객체 키순서와 음수0은 정규화하고 배열순서는 보존한다', () => {
  assert.equal(canonicalJson({ z: -0, a: ['한글', 1.5] }), '{"a":["한글",1.5],"z":0}');
  assert.equal(contentHash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test('사라지거나 변형될 값과 잘못된 Unicode·getter를 거절한다', () => {
  for (const value of [undefined, NaN, Infinity, 9007199254740992, '\ud800', { x: undefined }, new Date(), [, 1]]) {
    assert.throws(() => canonicalJson(value), /INPUT_INVALID/);
  }
  const getter = Object.defineProperty({}, 'secret', { enumerable: true, get() { throw Error('접근하면 안됨'); } });
  assert.throws(() => canonicalJson(getter), /INPUT_INVALID/);
});

test('wire 중복키·escape로 위장한 중복키와 범위 밖 숫자를 거절한다', () => {
  for (const raw of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"x":{"a":0,"a":1}}', '{"n":9007199254740993}']) {
    assert.throws(() => parseWireJson(raw), /INPUT_INVALID/);
  }
  assert.deepEqual(parseWireJson('{"a":[{"a":1},{"a":2}],"b":true}'), { a: [{ a: 1 }, { a: 2 }], b: true });
});
