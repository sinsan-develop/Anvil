import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient, ApiError } from '../../../apps/web/src/api/client.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { designChangeFixture, projectId, changeId } from './design-change-fixture.ts';
const m: any = await import('../../../apps/web/src/features/design-change/api.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const reader = () => { assert.equal(typeof m.readDesignChange, 'function'); return m.readDesignChange; };
const invalid = (e: unknown) => e instanceof ApiError && ['RESPONSE_INVALID', 'DESIGN_CHANGE_INTEGRITY_FAILED'].includes(e.code);
test('설계변경 조회는 same-origin GET/유한 페이지로 기계 영향과 사람 미확인을 구분해 보존한다', async () => {
  const read = reader(), seen: any[] = [], body = designChangeFixture(), client = new ApiClient(async (url, init) => { seen.push([url, init]); return Response.json(body); });
  const value = await read(client, projectId, changeId, null); assert.equal(value.impactVersions[0].items[0].state, 'UNKNOWN'); assert.equal(value.impactVersions[1].sourceKind, 'MECHANICAL_TRACE'); assert.equal(value.activatedAsBaseline, false);
  assert.equal(seen[0][0], `/api/v1/projects/${projectId}/design-changes/${changeId}?limit=10`); assert.equal(seen[0][1].method, 'GET'); assert.equal(seen[0][1].cache, 'no-store');
  body.impactVersions = [body.impactVersions[1]!]; await read(client, projectId, changeId, 2); assert.equal(seen[1][0], `/api/v1/projects/${projectId}/design-changes/${changeId}?limit=10&beforeVersion=2`);
});
test('설계변경 조회는 잘못된 경로와 페이지를 요청 전에 거절한다', async () => {
  const read = reader(); let calls = 0; const client = new ApiClient(async () => { calls++; return Response.json({}); });
  for (const [pid, id, before] of [[projectId, '../escape', null], ['https://other.invalid', changeId, null], [projectId, changeId, 0], [projectId, changeId, Number.MAX_SAFE_INTEGER]]) await assert.rejects(read(client, pid, id, before), (e: any) => e.code === 'CLIENT_PATH_INVALID');
  assert.equal(calls, 0);
});
test('설계변경 원문·영향 hash 또는 요청 대상 결박이 바뀌면 표시하지 않는다', async () => {
  const read = reader();
  for (const mutate of [(v: any) => { v.change.reason = '변조'; }, (v: any) => { v.impactVersions[0].items[0].reason = '변조'; }, (v: any) => { v.impactVersions[0].changeRef.id = projectId; const { ref, observedAt, ...snapshot } = v.impactVersions[0]; ref.contentHash = contentHash(canonicalJson(snapshot)); }]) {
    const value = designChangeFixture(); mutate(value); await assert.rejects(read(new ApiClient(async () => Response.json(value)), projectId, changeId, null), invalid);
  }
});
test('설계변경 조회는 기준 활성화·자동 무영향·중복 이력·잘못된 페이지를 수용하지 않는다', async () => {
  const read = reader();
  for (const mutate of [(v: any) => { v.activatedAsBaseline = true; }, (v: any) => { v.impactVersions[1].items[0].state = 'UNAFFECTED'; }, (v: any) => { v.impactVersions.push(v.impactVersions[0]); }, (v: any) => { v.nextBeforeVersion = 1; }, (v: any) => { v.impactVersions[0].items[0].state = 'UNAFFECTED'; }]) {
    const value = designChangeFixture(); mutate(value); await assert.rejects(read(new ApiClient(async () => Response.json(value)), projectId, changeId, null), invalid);
  }
});
