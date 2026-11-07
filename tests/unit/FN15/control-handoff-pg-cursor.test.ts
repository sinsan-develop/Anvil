import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { openControlRequestCursor, sealControlRequestCursor } from '../../../apps/server/modules/control-handoff/control-request-cursor.ts';
import { baseControl, controller, controllerClient, projectId, requestId,
  requester, requesterClient } from './control-handoff-summary-fixture.ts';

test('기존 인증 키의 FN15 고정 도메인 wrapper만 cursor를 서명·검증하고 키는 반환하지 않는다', () => {
  const pool = new Pool();
  const repository = new AccessRepository(pool, { installationId: projectId, key: Buffer.alloc(32, 7) });
  assert.equal(typeof repository.signControlRequestCursor, 'function', 'FN15 sign wrapper가 있어야 한다');
  assert.equal(typeof repository.verifyControlRequestCursor, 'function', 'FN15 verify wrapper가 있어야 한다');
  const signer = { sign: (message: string) => repository.signControlRequestCursor(message),
    verify: (message: string, signature: string) => repository.verifyControlRequestCursor(message, signature) };
  const body = { schemaVersion: 1 as const, actorId: requester, clientId: requesterClient,
    credentialGeneration: 3, projectId, view: 'CONTROLLER' as const, limit: 50,
    controllerBasis: structuredClone(baseControl),
    last: { requestRef: { id: requestId, version: 1, contentHash: 'a'.repeat(64) },
      createdAt: '2026-10-25T08:00:00.000Z' },
    issuedAt: '2026-10-25T08:00:00.000Z', expiresAt: '2026-10-25T08:30:00.000Z' };
  const expected = { actorId: requester, clientId: requesterClient, credentialGeneration: 3,
    projectId, view: 'CONTROLLER' as const, limit: 50, controllerBasis: structuredClone(baseControl),
    now: '2026-10-25T08:10:00.000Z' };
  const cursor = sealControlRequestCursor(body, signer);
  assert.deepEqual(openControlRequestCursor(cursor, expected, signer).last, body.last);
  const message = 'anvil:fn15-control-request-cursor:v1:sample';
  const signature = repository.signControlRequestCursor(message);
  assert.equal(repository.verifyControlRequestCursor(message, signature), true);
  assert.equal(repository.verifyControlRequestCursor(message, repository.signProjectCursor(message)), false);
  assert.equal(repository.verifyControlRequestCursor(message, repository.signMethodCursor(message)), false);
  assert.equal(repository.verifyControlRequestCursor(message, repository.signProviderClaimCursor(message)), false);
  assert.equal(repository.verifyControlRequestCursor(message + 'x', signature), false);
  assert.equal(signature.includes(Buffer.alloc(32, 7).toString('hex')), false);
  assert.equal('key' in repository, false);
  void pool.end();
});
