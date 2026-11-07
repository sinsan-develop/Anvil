import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertFn03Owned, fn03CallBudget, fn03Resources as r, assertFn03FileIdentity } from '../../../scripts/fn03-resource-guard.ts';

const instance = 'a'.repeat(32), nid = 'b'.repeat(64);
const pg = () => ({ Id: 'c'.repeat(64), Name: '/' + r.pg, Image: r.pgId,
  Config: { Labels: { 'anvil.project': 'v3', 'anvil.owner': r.owner, 'anvil.instance': instance } }, Mounts: [],
  HostConfig: { PublishAllPorts: false, PortBindings: {}, Tmpfs: { '/var/lib/postgresql/data': 'rw,noexec,nosuid,size=268435456' } },
  NetworkSettings: { Ports: { '5432/tcp': null }, Networks: { [r.net]: { NetworkID: nid } } } });

test('소유 label·image·내부 network·mount·비공개 port를 모두 맞춘 PG만 정리 대상으로 인정한다', () => {
  assert.doesNotThrow(() => assertFn03Owned(pg(), 'pg', instance, nid));
  for (const changed of [
    { ...pg(), Name: '/anvil-v3-development-pg' }, { ...pg(), Image: 'wrong' },
    { ...pg(), Config: { Labels: {} } }, { ...pg(), Mounts: [{ Type: 'volume' }] },
    { ...pg(), HostConfig: { ...pg().HostConfig, PortBindings: { '5432/tcp': [{ HostPort: '5546' }] } } },
  ]) assert.throws(() => assertFn03Owned(changed, 'pg', instance, nid));
  assert.throws(() => assertFn03Owned(pg(), 'pg', 'd'.repeat(32), nid));
  assert.throws(() => assertFn03Owned(pg(), 'pg', instance, 'e'.repeat(64)));
});

test('남은 수명보다 긴 Docker 호출을 만들지 않고 만료 시 새 호출을 거절한다', () => {
  assert.equal(fn03CallBudget(10100, 10000), 100);
  assert.equal(fn03CallBudget(100000, 10000), 30000);
  for (const deadline of [10000, 9999, NaN, Infinity]) assert.throws(() => fn03CallBudget(deadline, 10000));
});

test('Node는 source·공개 의존성·합성 설정의 읽기 전용 mount만 허용한다', () => {
  const item = { Id: 'c'.repeat(64), Name: '/' + r.node, Image: r.nodeId,
    Config: { Labels: pg().Config.Labels, User: '1000:1000', WorkingDir: '/qa-source' },
    Mounts: [
      { Type: 'bind', Source: r.root, Destination: '/qa-source', RW: false },
      { Type: 'bind', Source: r.dependencies, Destination: '/qa-source/node_modules', RW: false },
      { Type: 'bind', Source: r.protected, Destination: '/qa-config', RW: false },
    ], HostConfig: { PublishAllPorts: false, PortBindings: {}, ReadonlyRootfs: true,
      Tmpfs: { '/qa-data': 'rw,noexec,nosuid,size=67108864,uid=1000,gid=1000,mode=0700', '/tmp': 'rw,noexec,nosuid,size=16777216' } },
    NetworkSettings: { Ports: {}, Networks: { [r.net]: { NetworkID: nid } } } };
  assert.doesNotThrow(() => assertFn03Owned(item, 'node', instance, nid));
  assert.throws(() => assertFn03Owned({ ...item, Mounts: [...item.Mounts, { Source: '/var/run/docker.sock' }] }, 'node', instance, nid));
  assert.throws(() => assertFn03Owned({ ...item, Mounts: item.Mounts.map(m => ({ ...m, RW: true })) }, 'node', instance, nid));
  assert.throws(() => assertFn03Owned({ ...item, Config: { ...item.Config, User: '0' } }, 'node', instance, nid));
  assert.throws(() => assertFn03Owned({ ...item, HostConfig: { ...item.HostConfig, ReadonlyRootfs: false } }, 'node', instance, nid));
});

test('같은 경로·소유자라도 교체된 inode·내용·hardlink는 생성 파일로 삭제하지 않는다', () => {
  const expected = { dev: 1, ino: 2, hash: 'a'.repeat(64) }, actual = { ...expected, uid: 1000, nlink: 1 };
  assert.doesNotThrow(() => assertFn03FileIdentity(actual, expected));
  for (const changed of [{ dev: 9 }, { ino: 9 }, { hash: 'b'.repeat(64) }, { uid: 0 }, { nlink: 2 }])
    assert.throws(() => assertFn03FileIdentity({ ...actual, ...changed }, expected), /CHANGED_PRESERVE/);
});
