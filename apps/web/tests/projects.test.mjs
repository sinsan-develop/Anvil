import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectsState, reduceProjects, projectsApiPath } from '../src/features/projects/projects-state.js';
import {scanProjects} from '../src/api/projects-client.js';

test('projects starts disconnected and never invents a baseline', () => {
  const state = createProjectsState();
  assert.equal(state.status, 'NOT_CONNECTED');
  assert.equal(state.repository, null);
  assert.equal(state.baseline.status, 'UNAVAILABLE');
  assert.equal(state.mutationAllowed, false);
});

test('read-only scan projects real git state and preserves dirty/untracked blockers', () => {
  const state = reduceProjects(createProjectsState(), {type: 'SCAN_RECEIVED', payload: {
    ok: true,
    scan: {status: 'SCANNED_READ_ONLY', repository: {branch: 'codex/test', head: 'abc', trackedDirtyPaths: 1, untrackedPaths: 2}, noWriteIdentical: true},
  }});
  assert.equal(state.status, 'BLOCKED');
  assert.equal(state.repository.dirtyPaths, 1);
  assert.equal(state.repository.untrackedPaths, 2);
  assert.equal(state.baseline.status, 'BLOCKED');
  assert.equal(state.mutationAllowed, false);
});

test('clean scan remains read-only and same-origin', () => {
  const state = reduceProjects(createProjectsState(), {type: 'SCAN_RECEIVED', payload: {
    ok: true,
    scan: {status: 'SCANNED_READ_ONLY', repository: {branch: 'main', head: 'abc', trackedDirtyPaths: 0, untrackedPaths: 0}, noWriteIdentical: true},
  }});
  assert.equal(state.status, 'READY');
  assert.equal(state.baseline.status, 'READY_TO_REVIEW');
  assert.equal(state.mutationAllowed, false);
  assert.equal(projectsApiPath(), '/api/projects/scan');
});

test('failed scan is explicit and clears stale repository data', () => {
  const state = reduceProjects(createProjectsState(), {type: 'SCAN_FAILED', message: '권한이 없습니다.'});
  assert.equal(state.status, 'ERROR');
  assert.equal(state.repository, null);
  assert.match(state.reason, /권한/);
});

test('projects client uses only the relative same-origin scan endpoint', async () => {
  const calls = [];
  const payload = await scanProjects(async (url, options) => {
    calls.push([url, options]);
    return {ok: true, json: async () => ({ok: true})};
  });
  assert.deepEqual(payload, {ok: true});
  assert.equal(calls[0][0], '/api/projects/scan');
  assert.equal(calls[0][1].credentials, 'same-origin');
  assert.equal(calls[0][1].method, 'GET');
});

