import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRoute, routeHref } from '../../../apps/web/src/shell/routes.ts';

test('프로젝트가 첫 화면이며 정확 프로젝트 ID를 URL에 유지하고 잘못된 경로는 다른 프로젝트로 대체하지 않는다', () => {
  assert.deepEqual(parseRoute(''), { screen: 'projects', projectId: null });
  const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
  assert.deepEqual(parseRoute(`#/projects/${id}/workspace`), { screen: 'workspace', projectId: id });
  assert.equal(routeHref('documents', id), `#/projects/${id}/documents`);
  for (const route of ['#/dashboard', '#/projects/' + '-'.repeat(36) + '/workspace', '#/projects/private-name/workspace', '#//other.test']) {
    assert.equal(parseRoute(route).screen, 'not-found');
    assert.equal(parseRoute(route).projectId, null);
  }
});
