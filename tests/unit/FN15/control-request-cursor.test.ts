import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { canonicalJson } from '../../../contracts/canonical.ts';

const source: any = await import('../../../apps/server/modules/control-handoff/control-request-cursor.ts').catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const projectId = '11111111-1111-4111-8111-111111111111';
const actorId = '22222222-2222-4222-8222-222222222222';
const clientId = '33333333-3333-4333-8333-333333333333';
const controllerId = '44444444-4444-4444-8444-444444444444';
const controllerClient = '55555555-5555-4555-8555-555555555555';
const ref = { id: '66666666-6666-4666-8666-666666666666', version: 1, contentHash: 'a'.repeat(64) };
const now = '2026-10-25T08:10:00.000Z';
const copy = <T>(value: T): T => structuredClone(value);
const signer = {
  sign: (message: string) => createHmac('sha256', 'FN15_TEST_FAKE_ONLY').update(message).digest('base64url'),
  verify: (message: string, signature: string) => {
    const want = createHmac('sha256', 'FN15_TEST_FAKE_ONLY').update(message).digest('base64url');
    const a = Buffer.from(want), b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
};
const basis = { actorId: controllerId, clientId: controllerClient, generation: 5, version: 8 };
const payload = (): any => ({ schemaVersion: 1, actorId, clientId, credentialGeneration: 3,
  projectId, view: 'CONTROLLER', limit: 50, controllerBasis: copy(basis),
  last: { requestRef: copy(ref), createdAt: '2026-10-25T08:00:00.000Z' },
  issuedAt: '2026-10-25T08:00:00.000Z', expiresAt: '2026-10-25T08:30:00.000Z' });
const expected = (): any => ({ actorId, clientId, credentialGeneration: 3, projectId,
  view: 'CONTROLLER', limit: 50, controllerBasis: copy(basis), now });
function seal(value: any = payload()): string {
  assert.equal(typeof source.sealControlRequestCursor, 'function', 'cursor 발급 export가 있어야 한다');
  return source.sealControlRequestCursor(value, signer);
}
function open(token: string, context: any = expected()): any {
  assert.equal(typeof source.openControlRequestCursor, 'function', 'cursor 검증 export가 있어야 한다');
  return source.openControlRequestCursor(token, context, signer);
}

test('정확한 signed cursor는 마지막 ref와 생성시각을 복원한다', () => {
  assert.equal(typeof source.sealControlRequestCursor, 'function');
  assert.equal(typeof source.openControlRequestCursor, 'function');
  const token = seal();
  assert.ok(Buffer.byteLength(token, 'utf8') <= 4096);
  assert.deepEqual(open(token).last, payload().last);
  assert.deepEqual(open(token).controllerBasis, basis);
});

test('서명 변조와 canonical 재인코딩 불일치는 거절한다', () => {
  assert.equal(typeof source.sealControlRequestCursor, 'function');
  assert.equal(typeof source.openControlRequestCursor, 'function');
  const token = seal();
  assert.throws(() => open(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`));
  const [encoded] = token.split('.');
  assert.ok(encoded);
  const json = Buffer.from(encoded, 'base64url').toString('utf8');
  const object = JSON.parse(json);
  const reordered = JSON.stringify(Object.fromEntries(Object.entries(object).reverse()));
  if (reordered !== canonicalJson(object)) {
    const nonCanonical = Buffer.from(reordered).toString('base64url');
    assert.throws(() => open(`${nonCanonical}.${signer.sign('anvil:fn15-control-request-cursor:v1:' + reordered)}`));
  }
  assert.throws(() => open(`${token} `));
});

test('actor·client·credential·project·view·limit·controller 기준 교차 사용은 거절한다', () => {
  assert.equal(typeof source.sealControlRequestCursor, 'function');
  assert.equal(typeof source.openControlRequestCursor, 'function');
  const token = seal();
  const changes: Array<(value: any) => void> = [
    v => { v.actorId = controllerId; },
    v => { v.clientId = controllerClient; },
    v => { v.credentialGeneration = 4; },
    v => { v.projectId = controllerId; },
    v => { v.view = 'OWN'; v.controllerBasis = null; },
    v => { v.limit = 51; },
    v => { v.controllerBasis.generation = 6; },
    v => { v.controllerBasis.version = 9; },
  ];
  for (const change of changes) { const context = expected(); change(context); assert.throws(() => open(token, context)); }
});

test('서명된 마지막 ref의 hash·version·createdAt 변조와 지나치게 큰 token은 거절한다', () => {
  assert.equal(typeof source.sealControlRequestCursor, 'function');
  assert.equal(typeof source.openControlRequestCursor, 'function');
  const token = seal();
  const [body, signature] = token.split('.');
  assert.ok(body); assert.ok(signature);
  for (const change of [
    (v: any) => { v.last.requestRef.contentHash = 'b'.repeat(64); },
    (v: any) => { v.last.requestRef.version = 2; },
    (v: any) => { v.last.createdAt = '2026-10-25T07:59:59.000Z'; },
  ]) {
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    change(value);
    const changedBody = Buffer.from(canonicalJson(value)).toString('base64url');
    assert.throws(() => open(`${changedBody}.${signature}`));
  }
  assert.throws(() => open('a'.repeat(4097)));
});

test('만료·미래 발급·30분 초과·잘못된 형식을 거절한다', () => {
  assert.equal(typeof source.sealControlRequestCursor, 'function');
  assert.equal(typeof source.openControlRequestCursor, 'function');
  const expired = expected(); expired.now = '2026-10-25T08:30:00.000Z';
  assert.throws(() => open(seal(), expired));
  const future = payload(); future.issuedAt = '2026-10-25T08:11:00.000Z';
  assert.throws(() => open(seal(future)));
  const long = payload(); long.expiresAt = '2026-10-25T08:30:00.001Z';
  assert.throws(() => seal(long));
  for (const bad of ['', 'not-token', 'a.b.c']) assert.throws(() => open(bad));
});

test('OWN cursor는 제어 불명과 무관하지만 다른 현재 client에는 묶이지 않는다', () => {
  assert.equal(typeof source.sealControlRequestCursor, 'function');
  assert.equal(typeof source.openControlRequestCursor, 'function');
  const value = payload(); value.view = 'OWN'; value.controllerBasis = null;
  const context = expected(); context.view = 'OWN'; context.controllerBasis = null;
  const token = seal(value);
  assert.deepEqual(open(token, context).last, value.last);
  context.clientId = controllerClient;
  assert.throws(() => open(token, context));
});
