import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';

const source = new URL('../../../scripts/p03-pg-discovery-host.ts', import.meta.url);
async function subject() {
  assert.ok(existsSync(source), 'HOST_CONTROL_SOURCE_MISSING');
  return import(source.href);
}

test('import와 기본 plan은 FS/Git/Docker port를 호출하지 않는다', async () => {
  const host = await subject();
  const forbidden = new Proxy({}, { get() { throw new Error('PORT_CALLED'); } });
  const plan = await host.runDiscoveryHost({ mode: 'plan' }, forbidden);
  assert.equal(plan.status, 'PREPARATION_ONLY');
  assert.equal(plan.externalUserApprovalVerified, false);
  assert.equal(plan.complete, false);
  assert.deepEqual(await host.runDiscoveryHost({}, forbidden), plan);
});

test('CLI는 고정 plan/apply 외 주소·명령·한도 override를 거절한다', async () => {
  const host = await subject();
  assert.equal(host.parseArguments([]), 'plan');
  assert.equal(host.parseArguments(['--plan']), 'plan');
  assert.equal(host.parseArguments(['--apply']), 'apply');
  for (const args of [['--apply', '--host=x'], ['--apply', '--apply'], ['--command=x'], ['--plan', '--limit=9']]) {
    assert.throws(() => host.parseArguments(args), /ARGUMENTS_REJECTED/);
  }
});

function child() {
  const value = new EventEmitter() as EventEmitter & {
    stdout: PassThrough; stderr: PassThrough; stdin: PassThrough; signals: string[]; kill: (signal: string) => boolean; unref: () => void;
  };
  value.stdout = new PassThrough(); value.stderr = new PassThrough(); value.stdin = new PassThrough();
  value.signals = []; value.kill = signal => { value.signals.push(signal); return true; };
  value.unref = () => { throw new Error('UNREF_FORBIDDEN'); };
  return value;
}

test('실제 Docker adapter handler는 고정 endpoint/실행파일/shell false와 최소 env만 쓴다', async () => {
  const host = await subject();
  const calls: unknown[][] = [];
  const spawn = (...args: unknown[]) => {
    calls.push(args);
    const process = child();
    queueMicrotask(() => { process.stdout.write('"fixture"'); process.emit('close', 0, null); });
    return process;
  };
  const adapter = host.createDockerAdapter({ spawn, now: () => 0 });
  const result = await adapter.command({ kind: 'daemon' }, 60000);
  assert.equal(result.code, 0);
  assert.equal(calls.length, 1);
  const [binary, argv, options] = calls[0] as [string, string[], { shell: boolean; env: Record<string, string> }];
  assert.equal(binary, '/usr/bin/docker');
  assert.deepEqual(argv, ['--host', 'unix:///var/run/docker.sock', 'info', '--format', '{{json .ID}}']);
  assert.equal(options.shell, false);
  assert.deepEqual(Object.keys(options.env).sort(), ['LANG', 'LC_ALL', 'PATH']);
  assert.equal(options.env.PATH, '/usr/bin:/bin');
});

test('raw metadata stdout+stderr 합계 초과는 원문을 반환하지 않고 고정 오류로 닫는다', async () => {
  const host = await subject();
  const spawn = () => {
    const process = child();
    queueMicrotask(() => { process.stdout.write('x'.repeat(8192)); process.stderr.write('private-filename'); process.emit('close', 0, null); });
    return process;
  };
  const adapter = host.createDockerAdapter({ spawn, now: () => 0 });
  const result = await adapter.command({ kind: 'start', id: 'a'.repeat(64), script: Buffer.from('exact-blob') }, 60000);
  assert.equal(result.error, 'OUTPUT_LIMIT');
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.equal(JSON.stringify(result).includes('private-filename'), false);
});

const toolPaths = ['/bin/bash', '/usr/bin/timeout', '/usr/bin/find', '/usr/bin/stat', '/usr/bin/sha256sum', '/usr/bin/id', '/usr/bin/readlink', '/usr/bin/awk', '/usr/lib/postgresql/15/bin/postgres'];
function metadata() {
  return { status: 'DISCOVERY_METADATA_COMPLETE', complete: true,
    tools: toolPaths.map(path => ({ path, canonical: path, sha256: '1'.repeat(64) })),
    postgresAccount: { uid: 999, gid: 999 }, sourceRoot: { type: 'directory', uid: 999, gid: 999, mode: '700' },
    metadata: { status: 'METADATA_COMPLETE', complete: true, entries: 2, uniqueInodes: 2, regularEntries: 1,
      directoryEntries: 1, symlinkEntries: 0, specialEntries: 0, regularUniqueInodes: 1, regularLogicalBytes: 5, regularAllocatedBytes: 4096 } };
}
function success(value: unknown) {
  return { code: 0, signal: null, closed: true, stdout: JSON.stringify(value), stderr: '' };
}
async function fixture() {
  const host = await subject(); const f = host.FIXED;
  const wall = Date.parse('2026-10-27T10:00:00.000Z');
  const id = 'a'.repeat(64); const instance = 'b'.repeat(32);
  const grant = { schema: 1, scope: f.scope, branch: f.branch, commit: 'c'.repeat(40), controllerSha256: 'd'.repeat(64),
    shellSha256: f.shellSha256, nodeSha256: f.nodeSha256, runInstance: instance,
    issuedAt: new Date(wall - 1000).toISOString(), expiresAt: new Date(wall + 60000).toISOString(),
    totalMs: 60000, metadataBytes: 8192, maxCreates: 1, maxStarts: 1,
    numericOwnerRiskAcknowledgement: 'P03_UID1001_OWNER_UNRESOLVED_REPLACEMENT_RISK_ACCEPTED_FOR_THIS_RUN' };
  const env = ['PATH=/usr/bin:/bin', 'LANG=en_US.utf8', 'LC_ALL=C', 'BASH_ENV=', 'ENV=',
    'GOSU_VERSION=1.19', 'PG_MAJOR=15', 'PG_VERSION=15.18-1.pgdg13+1', `PGDATA=${f.mount}`];
  const image = { Id: f.image, Config: { Volumes: { [f.mount]: {} }, Env: env.filter(v => !['LC_ALL=', 'BASH_ENV=', 'ENV='].some(key => v.startsWith(key)))
    .map(v => v.startsWith('PATH=') ? 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/15/bin' : v) } };
  const volume = { Name: f.volume, Driver: 'local', Scope: 'local', CreatedAt: f.volumeCreated, Options: null,
    Labels: { 'anvil.project': 'v3', 'anvil.owner': 'P03', 'anvil.instance': f.volumeInstance } };
  const container = { Id: id, Name: `/${f.name}`, Image: f.image, Created: new Date(wall).toISOString(), RestartCount: 0,
    Config: { Labels: { 'anvil.project': 'v3', 'anvil.owner': 'project-main', 'anvil.runid': f.name, 'anvil.instance': instance },
      User: '999:999', Entrypoint: ['/usr/bin/timeout'], Cmd: ['--signal=TERM', '55', '/bin/bash', '--noprofile', '--norc', '-s', '--', '--discover-p03-metadata-r2'],
      OpenStdin: true, Tty: false, Env: env, ExposedPorts: null },
    HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, CapDrop: ['ALL'], CapAdd: null, SecurityOpt: ['no-new-privileges'], Privileged: false,
      PidsLimit: 32, Memory: 134217728, NanoCpus: 200000000, PortBindings: {}, Binds: null, Tmpfs: null,
      Mounts: [{ Type: 'volume', Source: f.volume, Target: f.mount, ReadOnly: true, VolumeOptions: { NoCopy: true } }] },
    Mounts: [{ Type: 'volume', Name: f.volume, Destination: f.mount, RW: false, Driver: 'local' }],
    NetworkSettings: { Ports: {}, Networks: { none: {} } },
    State: { Status: 'created', Running: false, OOMKilled: false, ExitCode: 0, FinishedAt: '0001-01-01T00:00:00Z' } };
  const state = { now: 0, wall, consumed: false, exists: false, started: false, removed: false, fingerprint: 'fixed',
    calls: [] as any[], receipts: [] as any[], hook: null as null | ((command: any) => any), receiptError: false, consumeError: false };
  const binding = { platform: 'linux', uid: 1000, safePaths: true, nodePath: f.node, nodeSha256: f.nodeSha256,
    sourceRoot: f.sourceRoot, ledgerRoot: f.ledgerRoot, grant, consumed: false, grantFingerprint: 'fixed' };
  const git = { branch: f.branch, commit: grant.commit, remote: f.remote, clean: true,
    controllerSha256: grant.controllerSha256, shellSha256: f.shellSha256,
    shell: readFileSync(new URL('../../../scripts/pg-recovery-discovery-readonly.sh', import.meta.url)) };
  const ports = { now: () => state.now, wallNow: () => state.wall,
    fs: { async binding() { return { ...binding, consumed: state.consumed, grantFingerprint: state.fingerprint }; },
      async consume(value: any) { if (state.consumeError || state.consumed) throw new Error('private-payload'); state.consumed = true; state.receipts.push({ consumed: value }); },
      async receipt(value: any) { if (state.receiptError) throw new Error('private-payload'); state.receipts.push(structuredClone(value)); } },
    git: { async binding() { return git; } },
    docker: { async command(command: any, deadline: number) {
      state.calls.push({ ...command, deadline }); state.now++;
      const override = state.hook?.(command); if (override) return override;
      switch (command.kind) {
        case 'daemon': return success(f.daemon);
        case 'named': return { ...success(null), stdout: state.exists ? JSON.stringify(id) : '' };
        case 'image': return success(image);
        case 'volume': return success(volume);
        case 'consumers': return { ...success(null), stdout: state.exists ? JSON.stringify(id) : '' };
        case 'create': state.exists = true; return { ...success(null), stdout: id + '\n' };
        case 'inspect': return success(container);
        case 'start': state.started = true; container.State.Status = 'exited'; container.State.FinishedAt = new Date(wall + 1000).toISOString(); return success(metadata());
        case 'term': container.State.Running = false; container.State.Status = 'exited'; container.State.FinishedAt = new Date(wall + 1000).toISOString(); return { ...success(null), stdout: id };
        case 'remove': state.exists = false; state.removed = true; return { ...success(null), stdout: id };
        default: throw new Error('UNEXPECTED_COMMAND');
      }
    } } };
  return { host, f, id, instance, grant, binding, git, ports, state, container, image, volume };
}

test('합성 apply는 단1 consume/create/start와 exact blob·정상 종료·소유 정리·별도 부재를 관측한다', async () => {
  const x = await fixture(); const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
  assert.equal(r.complete, true); assert.equal(r.externalUserApprovalVerified, false);
  assert.equal(r.helperAbsent, true); assert.equal(r.sourceVolumeObserved, true);
  for (const kind of ['create', 'start', 'remove']) assert.equal(x.state.calls.filter(v => v.kind === kind).length, 1);
  assert.equal(x.state.calls.filter(v => v.kind === 'term').length, 0);
  assert.deepEqual(x.state.calls.find(v => v.kind === 'start').script, x.git.shell);
  assert.equal(x.state.calls.find(v => v.kind === 'start').deadline, 57500);
  assert.equal(x.state.calls.filter(v => v.kind !== 'start').every(v => v.deadline === 60000), true);
  assert.equal(x.state.receipts[0].consumed.scope, x.f.scope);
  assert.equal(x.state.receipts.every(v => !JSON.stringify(v).includes('PG_VERSION=')), true);
  const second = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
  assert.equal(second.error, 'ALREADY_CONSUMED');
  assert.equal(x.state.calls.filter(v => v.kind === 'create').length, 1);
});

test('기한·host·소진·hash·Git·scope 변조는 Docker와 소비 전에 거절한다', async () => {
  const mutations = [
    (x: any) => { x.grant.expiresAt = new Date(x.state.wall).toISOString(); },
    (x: any) => { x.grant.issuedAt = new Date(x.state.wall + 1).toISOString(); },
    (x: any) => { x.grant.expiresAt = new Date(x.state.wall + 1800001).toISOString(); },
    (x: any) => { x.binding.platform = 'win32'; }, (x: any) => { x.binding.uid = 0; },
    (x: any) => { x.binding.safePaths = false; }, (x: any) => { x.state.consumed = true; },
    (x: any) => { x.git.shell = Buffer.from('changed'); }, (x: any) => { x.git.clean = false; },
    (x: any) => { x.git.remote = 'unapproved'; }, (x: any) => { x.grant.controllerSha256 = '0'.repeat(64); },
    (x: any) => { x.grant.scope = 'other'; }, (x: any) => { x.grant.maxCreates = 2; },
  ];
  for (const mutate of mutations) {
    const x = await fixture(); mutate(x); const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false); assert.equal(x.state.calls.length, 0);
    assert.equal(x.state.receipts.length, 0); assert.equal(JSON.stringify(r).includes('changed'), false);
  }
});

test('fresh daemon/image·선언volume·Env/원volume/foreign 소비자 불일치는 create0이다', async () => {
  for (const kind of ['daemon', 'image', 'image-volume', 'image-env', 'volume', 'volume-options', 'volume-label', 'consumer', 'named']) {
    const x = await fixture();
    if (kind === 'image') x.image.Id = 'sha256:' + '0'.repeat(64);
    if (kind === 'image-volume') (x.image.Config.Volumes as any)['/extra'] = {};
    if (kind === 'image-env') x.image.Config.Env.push('NODE_OPTIONS=private-payload');
    if (kind === 'volume') x.volume.CreatedAt = 'changed';
    if (kind === 'volume-options') (x.volume as any).Options = { device: 'private-payload' };
    if (kind === 'volume-label') x.volume.Labels['anvil.instance'] = 'old-generation';
    x.state.hook = command => command.kind === kind && kind === 'daemon' ? success('wrong-daemon')
      : command.kind === 'consumers' && kind === 'consumer' ? { ...success(null), stdout: JSON.stringify('e'.repeat(64)) }
        : command.kind === 'named' && kind === 'named' ? { ...success(null), stdout: JSON.stringify('e'.repeat(64)) } : undefined;
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false, kind); assert.equal(r.createAttempted, false, kind); assert.equal(x.state.consumed, false, kind);
    assert.equal(JSON.stringify(r).includes('private-payload'), false);
  }
});

test('create 뒤 교차세대·Env·추가mount·쓰기mount·foreign 소비자는 start/삭제 없이 보존한다', async () => {
  for (const kind of ['instance', 'createdAt', 'env', 'mount', 'rw', 'consumer', 'entrypoint', 'network', 'limit']) {
    const x = await fixture();
    if (kind === 'instance') x.container.Config.Labels['anvil.instance'] = 'old-generation';
    if (kind === 'createdAt') x.container.Created = '2020-01-01T00:00:00.000Z';
    if (kind === 'env') x.container.Config.Env.push('LD_PRELOAD=private-payload');
    if (kind === 'mount') x.container.Mounts.push({ ...x.container.Mounts[0]!, Name: 'foreign' });
    if (kind === 'rw') x.container.Mounts[0]!.RW = true;
    if (kind === 'entrypoint') x.container.Config.Entrypoint = ['/bin/other'];
    if (kind === 'network') x.container.HostConfig.NetworkMode = 'bridge';
    if (kind === 'limit') x.container.HostConfig.Memory++;
    x.state.hook = command => command.kind === 'consumers' && x.state.exists && kind === 'consumer'
      ? { ...success(null), stdout: [x.id, 'e'.repeat(64)].map(value => JSON.stringify(value)).join('\n') } : undefined;
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false, kind); assert.equal(r.startAttempted, false, kind);
    assert.equal(r.removeAttempted, false, kind); assert.equal(r.sourcePreservationRequired, true);
    assert.equal(JSON.stringify(r).includes('private-payload'), false);
  }
});

test('consume 동기화/receipt 실패·grant변경과 기한/잔여부족은 mutating 확대 없이 닫힌다', async () => {
  for (const kind of ['consume', 'receipt', 'fingerprint', 'expiry', 'budget']) {
    const x = await fixture(); x.state.consumeError = kind === 'consume'; x.state.receiptError = kind === 'receipt';
    x.state.hook = command => {
      if (command.kind === 'consumers' && !x.state.exists) {
        if (kind === 'fingerprint') x.state.fingerprint = 'changed';
        if (kind === 'expiry') x.state.wall += 60000;
        if (kind === 'budget') x.state.now = 2501;
      }
    };
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false, kind); assert.equal(r.createAttempted, false, kind);
    assert.equal(x.state.calls.some(v => ['create', 'start', 'term', 'remove'].includes(v.kind)), false, kind);
  }
});

test('start직전 만료/예산부족은 이미 생성한 helper를 재시도/삭제하지 않는다', async () => {
  for (const kind of ['expiry', 'budget']) {
    const x = await fixture();
    x.state.hook = command => {
      if (command.kind === 'consumers' && x.state.exists) {
        if (kind === 'expiry') x.state.wall += 60000; else x.state.now = 2501;
      }
    };
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.startAttempted, false); assert.equal(r.removeAttempted, false);
    assert.equal(r.sourcePreservationRequired, true); assert.equal(x.state.calls.filter(v => v.kind === 'create').length, 1);
  }
});

test('시간/출력/close불명에서 소유running만 TERM1·정상종료 뒤 rm1·부분성공은 false다', async () => {
  for (const error of ['DEADLINE', 'OUTPUT_LIMIT', 'STREAM_UNKNOWN', 'closed']) {
    const x = await fixture();
    x.state.hook = command => {
      if (command.kind !== 'start') return;
      x.container.State.Running = true; x.container.State.Status = 'running';
      return { code: null, signal: null, closed: false, stdout: '', stderr: '', ...(error === 'closed' ? {} : { error }) };
    };
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false); assert.equal(r.termAttempted, true); assert.equal(r.helperAbsent, true);
    assert.equal(x.state.calls.filter(v => v.kind === 'term').length, 1);
    assert.equal(x.state.calls.filter(v => v.kind === 'start').length, 1);
    assert.equal(r.metadata, null);
  }
});

test('신원불명/미종료/비정상종료/inspect nonzero는 부재로 합성하거나 삭제하지 않는다', async () => {
  for (const kind of ['foreign', 'running', 'exit', 'inspect', 'post-volume', 'absence']) {
    const x = await fixture();
    x.state.hook = command => {
      if (command.kind === 'start') {
        x.state.started = true; x.container.State.Running = kind === 'running'; x.container.State.Status = kind === 'running' ? 'running' : 'exited';
        x.container.State.FinishedAt = '2026-10-27T10:00:01.000Z';
        if (kind === 'foreign') x.container.Config.Labels['anvil.instance'] = 'foreign';
        if (kind === 'exit') x.container.State.ExitCode = 1;
        return success(metadata());
      }
      if (command.kind === 'inspect' && x.state.started && kind === 'inspect') return { ...success(null), code: 1, stdout: '', stderr: 'private-payload' };
      if (command.kind === 'term' && kind === 'running') return { ...success(null), stdout: x.id };
      if (command.kind === 'named' && x.state.removed && kind === 'absence') return { ...success(null), code: 1, stdout: '' };
      if (command.kind === 'volume' && x.state.removed && kind === 'post-volume') return success({ ...x.volume, CreatedAt: 'changed' });
    };
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false, kind); assert.equal(r.sourcePreservationRequired, true);
    if (!['post-volume', 'absence'].includes(kind)) assert.equal(r.removeAttempted, false, kind);
    if (kind === 'inspect') assert.equal(r.helperAbsent, null);
    assert.equal(JSON.stringify(r).includes('private-payload'), false);
  }
});

test('metadata는 원schema·닫힌path/status/키·안전정수/부분실패를 검사한다', async () => {
  const host = await subject(); assert.deepEqual(host.parseMetadata(JSON.stringify(metadata())), metadata());
  for (const mutate of [
    (v: any) => { v.extra = 'private-payload'; }, (v: any) => { v.complete = false; },
    (v: any) => { v.tools[0].canonical = '/private'; }, (v: any) => { v.metadata.entries = 100001; },
    (v: any) => { v.metadata.regularLogicalBytes = 9007199254740992; },
    (v: any) => { v.metadata.status = 'TRAVERSAL_FAILED'; }, (v: any) => { v.sourceRoot.mode = 'xyz'; },
  ]) { const value = metadata(); mutate(value); assert.throws(() => host.parseMetadata(JSON.stringify(value)), /METADATA_/); }
  assert.throws(() => host.parseMetadata(JSON.stringify({ status: 'TRAVERSAL_FAILED', complete: false })), /METADATA_/);
  assert.throws(() => host.parseMetadata('{}\n{}'), /METADATA_/);
});

test('고정adapter create/start/TERM/rm 인자는 임의명령·force/volume삭제로 확장하지 않는다', async () => {
  const host = await subject(); const calls: any[] = []; let received = Buffer.alloc(0);
  const spawn = (...args: any[]) => {
    calls.push(args); const process = child(); process.stdin.on('data', b => { received = Buffer.concat([received, b]); });
    queueMicrotask(() => process.emit('close', 0, null)); return process;
  };
  const adapter = host.createDockerAdapter({ spawn, now: () => 0 }); const id = 'a'.repeat(64);
  await adapter.command({ kind: 'create', instance: 'b'.repeat(32) }, 60000);
  await adapter.command({ kind: 'start', id, script: Buffer.from('fixed-blob') }, 60000);
  await adapter.command({ kind: 'term', id }, 60000); await adapter.command({ kind: 'remove', id }, 60000);
  assert.deepEqual(calls[0][1].slice(2), host.createArguments('b'.repeat(32)));
  assert.deepEqual(calls[1][1].slice(2), ['container', 'start', '--attach', '--interactive', id]);
  assert.deepEqual(calls[2][1].slice(2), ['container', 'kill', '--signal=TERM', id]);
  assert.deepEqual(calls[3][1].slice(2), ['container', 'rm', id]);
  assert.deepEqual(received, Buffer.from('fixed-blob'));
  assert.equal(calls.flat(2).some(v => v === '-f' || v === '-v' || v === 'SIGKILL'), false);
  assert.throws(() => adapter.command({ kind: 'remove', id: 'foreign-name' }, 60000), /ID_REJECTED/);
});

test('실제adapter의 spawn/stream/기한 불명은 payload 없이 원child TERM최대1·close불명이다', async () => {
  const host = await subject();
  for (const kind of ['spawn', 'stream', 'deadline', 'nonzero']) {
    let spawned: ReturnType<typeof child> | undefined;
    const spawn = () => {
      if (kind === 'spawn') throw new Error('private-path');
      const process = child(); spawned = process;
      queueMicrotask(() => {
        if (kind === 'stream') process.stdout.emit('error', new Error('private-path'));
        if (kind === 'nonzero') process.emit('close', 1, null);
      }); return process;
    };
    const adapter = host.createDockerAdapter({ spawn, now: () => 0 });
    const result = await adapter.command({ kind: 'daemon' }, kind === 'deadline' ? 1 : 60000);
    assert.equal(result.closed && result.code === 0, false);
    assert.equal(JSON.stringify(result).includes('private-path'), false);
    if (kind === 'stream' || kind === 'deadline') {
      assert.deepEqual(spawned!.signals, ['SIGTERM']);
      assert.equal(spawned!.stdin.destroyed && spawned!.stdout.destroyed && spawned!.stderr.destroyed, true);
      assert.equal(result.clientTermRequested, true); assert.equal(result.clientCloseUnconfirmed, true);
    } else if (spawned) assert.deepEqual(spawned.signals, []);
  }
});

test('중복JSON키·잘못된UTF8 grant/metadata/control는 실제 parser경로에서 닫힌다', async () => {
  const host = await subject();
  assert.throws(() => host.parseGrantRecord(Buffer.from('{"scope":"old","scope":"new"}')), /GRANT_REJECTED/);
  assert.throws(() => host.parseGrantRecord(Buffer.from([0xff])), /GRANT_REJECTED/);
  assert.throws(() => host.parseMetadata(JSON.stringify(metadata()).replace('"complete":true', '"complete":false,"complete":true')), /METADATA_/);
  const x = await fixture();
  x.state.hook = command => command.kind === 'image'
    ? { ...success(null), stdout: JSON.stringify(x.image).replace('"Id":', '"Id":"old","Id":') } : undefined;
  const result = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
  assert.equal(result.error, 'CONTROL_JSON'); assert.equal(result.createAttempted, false);
});

test('늦은FS binding/consume/receipt 완료는 다음 mutation0·미확정소비 null/pendingIO를 남긴다', async () => {
  for (const kind of ['binding', 'consume', 'receipt']) {
    const x = await fixture();
    if (kind === 'binding') x.ports.fs.binding = async () => { x.state.now = 60001; return { ...x.binding, consumed: false }; };
    if (kind === 'consume') x.ports.fs.consume = async () => { x.state.now = 60001; x.state.consumed = true; };
    if (kind === 'receipt') x.ports.fs.receipt = async () => { x.state.now = 60001; };
    const r = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(r.complete, false); assert.equal(r.pendingIO, true); assert.equal(r.createAttempted, false);
    assert.equal(x.state.calls.some(v => ['create', 'start', 'term', 'remove'].includes(v.kind)), false);
    if (kind === 'consume') { assert.equal(r.consumed, null); assert.equal(r.consumeAttempted, true); assert.equal(r.sourcePreservationRequired, true); }
  }
});

test('control256KiB와metadata8KiB는 별도이며 deadline전 이미닫힌child는 TERM0이다', async () => {
  const host = await subject();
  for (const kind of ['control-limit', 'control-ok', 'metadata-limit', 'closed']) {
    let spawned: ReturnType<typeof child>;
    const spawn = () => {
      spawned = child(); queueMicrotask(() => {
        spawned.stdout.write('x'.repeat(kind === 'control-limit' ? 262145 : kind === 'metadata-limit' ? 8193 : 9000));
        spawned.emit('close', 0, null);
      }); return spawned;
    };
    const adapter = host.createDockerAdapter({ spawn, now: () => 0 });
    const r = await adapter.command(kind === 'metadata-limit' ? { kind: 'start', id: 'a'.repeat(64), script: Buffer.from('x') } : { kind: 'daemon' }, 60000);
    if (kind.endsWith('limit')) { assert.equal(r.error, 'OUTPUT_LIMIT'); assert.deepEqual(spawned!.signals, ['SIGTERM']); }
    else { assert.equal(r.closed, true); assert.deepEqual(spawned!.signals, []); }
  }
});

for (const phase of ['create', 'start']) {
  test(`${phase} 직전 receipt가 잔여57.5초 아래로 진행하면 해당 Docker mutation0·소비상태 보존이다`, async () => {
    const x = await fixture(); const originalReceipt = x.ports.fs.receipt;
    x.ports.fs.receipt = async value => {
      await originalReceipt(value);
      if (value.phase === phase) x.state.now = 2501;
    };
    const result = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(x.state.calls.filter(value => value.kind === phase).length, 0);
    assert.equal(result.complete, false);
    assert.equal(result.consumed, true);
    assert.equal(x.state.consumed, true);
    if (phase === 'start') {
      assert.equal(x.state.calls.filter(value => value.kind === 'create').length, 1);
      assert.equal(result.helperId, x.id);
      assert.equal(result.removeAttempted, false);
      assert.equal(result.sourcePreservationRequired, true);
    }
  });
}

for (const declaration of [null, {}, { '5432/tcp': {} }]) {
  test(`image EXPOSE선언 ${JSON.stringify(declaration)}의 동일상속은 networknone/게시0이면 정상수명이다`, async () => {
    const x = await fixture();
    (x.image.Config as any).ExposedPorts = declaration;
    x.container.Config.ExposedPorts = structuredClone(declaration) as any;
    const result = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(result.complete, true);
    assert.equal(x.container.HostConfig.NetworkMode, 'none');
    assert.deepEqual(x.container.HostConfig.PortBindings, {});
    assert.deepEqual(x.container.NetworkSettings.Ports, {});
  });
}

test('EXPOSE선언의 생성후 추가/변조·실제portbinding은 start0·보존이다', async () => {
  for (const kind of ['extra', 'changed', 'value', 'binding', 'published']) {
    const x = await fixture();
    (x.image.Config as any).ExposedPorts = { '5432/tcp': {} };
    x.container.Config.ExposedPorts = { '5432/tcp': {} } as any;
    if (kind === 'extra') x.container.Config.ExposedPorts = { '5432/tcp': {}, '9999/tcp': {} } as any;
    if (kind === 'changed') x.container.Config.ExposedPorts = null;
    if (kind === 'value') x.container.Config.ExposedPorts = { '5432/tcp': { unexpected: true } } as any;
    if (kind === 'binding') x.container.HostConfig.PortBindings = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '9999' }] };
    if (kind === 'published') x.container.NetworkSettings.Ports = { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '9999' }] };
    const result = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    assert.equal(result.complete, false, kind);
    assert.equal(result.startAttempted, false, kind);
    assert.equal(result.removeAttempted, false, kind);
    assert.equal(result.sourcePreservationRequired, true, kind);
  }
});

test('실제 image관측 PATH는 고정후보로 수락하되 helper PATHoverride/unknown차단을 유지한다', async () => {
  const observed = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/15/bin';
  const x = await fixture();
  x.image.Config.Env = x.image.Config.Env.map(v => v.startsWith('PATH=') ? `PATH=${observed}` : v);
  const result = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
  assert.equal(result.complete, true);
  assert.ok(x.host.createArguments(x.instance).includes('PATH=/usr/bin:/bin'));
  assert.equal(x.container.Config.Env.find(v => v.startsWith('PATH=')), 'PATH=/usr/bin:/bin');
  for (const kind of ['image-path', 'helper-path', 'unknown']) {
    const y = await fixture(); y.image.Config.Env = y.image.Config.Env.map(v => v.startsWith('PATH=') ? `PATH=${observed}` : v);
    if (kind === 'image-path') y.image.Config.Env = y.image.Config.Env.map(v => v.startsWith('PATH=') ? v + ':/unapproved' : v);
    if (kind === 'helper-path') y.container.Config.Env = y.container.Config.Env.map(v => v.startsWith('PATH=') ? `PATH=${observed}` : v);
    if (kind === 'unknown') y.image.Config.Env.push('NODE_OPTIONS=unapproved');
    const rejected = await y.host.runDiscoveryHost({ mode: 'apply' }, y.ports);
    assert.equal(rejected.complete, false, kind); assert.equal(rejected.startAttempted, false, kind);
  }
});

// 이미 확인된 path/owner/mode/hash는 구현 FIXED에서 복사하지 않는 독립 literal이다.
// 부모 inode·mtime/size 숫자는 순수 교체 탐지용 합성값이며 실측값 주장0이다.
function independentNodeFacts() {
  const binary = { path: '/opt/node-v24.21.0-linux-x64/bin/node', canonical: '/opt/node-v24.21.0-linux-x64/bin/node',
    isFile: true, isSymbolicLink: false, uid: 1001, gid: 1001, mode: 0o755, nlink: 1,
    dev: 2096, ino: 724935, size: 100, mtimeMs: 123 };
  const parents = [
    { path: '/', uid: 0, gid: 0, mode: 0o755 }, { path: '/opt', uid: 0, gid: 0, mode: 0o755 },
    { path: '/opt/node-v24.21.0-linux-x64', uid: 1001, gid: 1001, mode: 0o755 },
    { path: '/opt/node-v24.21.0-linux-x64/bin', uid: 1001, gid: 1001, mode: 0o755 },
  ].map((parent, index) => ({ ...parent, canonical: parent.path, isDirectory: true, isSymbolicLink: false, dev: 2096, ino: 800 + index }));
  return { platform: 'linux', executionUid: 1000, execPath: '/opt/node-v24.21.0-linux-x64/bin/node',
    binary, opened: structuredClone(binary), openedAfter: structuredClone(binary), after: structuredClone(binary),
    sha256: '7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c',
    procSelfExe: { canonical: '/opt/node-v24.21.0-linux-x64/bin/node', isFile: true, dev: 2096, ino: 724935, size: 100 },
    parentsBefore: parents, parentsAfter: structuredClone(parents) };
}
const ownerRiskAcknowledgement = 'P03_UID1001_OWNER_UNRESOLVED_REPLACEMENT_RISK_ACCEPTED_FOR_THIS_RUN';

test('독립literal Node1001:1001/0755·고정hash/부모/proc일치는 잔여위험상태로 순수수락한다', async () => {
  const host = await subject();
  assert.equal(typeof host.assertNodeTrustFacts, 'function', 'NODE_OWNER_CANDIDATE_HELPER_MISSING');
  assert.deepEqual(host.assertNodeTrustFacts(independentNodeFacts()), { status: 'OWNER_UNRESOLVED_RESIDUAL_RISK' });
});

test('Node/부모 전후소유·inode/link/hash·proc교체와 임의UID fallback을 순수거절한다', async () => {
  const host = await subject();
  assert.equal(typeof host.assertNodeTrustFacts, 'function', 'NODE_OWNER_CANDIDATE_HELPER_MISSING');
  for (const mutate of [
    (v: any) => { v.binary.uid = 0; }, (v: any) => { v.binary.uid = 1000; }, (v: any) => { v.binary.gid = 1000; },
    (v: any) => { v.binary.mode = 0o775; }, (v: any) => { v.binary.nlink = 2; }, (v: any) => { v.binary.isSymbolicLink = true; },
    (v: any) => { v.binary.canonical = '/other/node'; }, (v: any) => { v.opened.ino++; }, (v: any) => { v.openedAfter.ino++; },
    (v: any) => { v.after.ino++; }, (v: any) => { v.after.uid = 0; }, (v: any) => { v.after.mtimeMs++; },
    (v: any) => { v.sha256 = '0'.repeat(64); }, (v: any) => { v.execPath = '/other/node'; },
    (v: any) => { v.executionUid = 1001; }, (v: any) => { v.procSelfExe.ino++; },
    (v: any) => { v.procSelfExe.canonical += ' (deleted)'; },
    (v: any) => { v.parentsBefore[0].isSymbolicLink = true; },
    (v: any) => { v.parentsBefore[1].canonical = '/other'; },
    (v: any) => { v.parentsBefore[2].uid = 0; }, (v: any) => { v.parentsBefore[2].gid = 0; },
    (v: any) => { v.parentsAfter[3].mode = 0o777; }, (v: any) => { v.parentsAfter[3].ino++; },
    (v: any) => { v.parentsAfter.pop(); },
  ]) {
    const facts = independentNodeFacts(); mutate(facts);
    assert.throws(() => host.assertNodeTrustFacts(facts), /NODE_BINDING/);
  }
});

test('한정잔여위험 acknowledgement 없거나 다른값이면 Docker0·정확값도 승인인증false다', async () => {
  for (const value of [undefined, false, true, 'accepted', ownerRiskAcknowledgement]) {
    const x = await fixture();
    if (value !== undefined) (x.grant as any).numericOwnerRiskAcknowledgement = value;
    else delete (x.grant as any).numericOwnerRiskAcknowledgement;
    const result = await x.host.runDiscoveryHost({ mode: 'apply' }, x.ports);
    if (value === ownerRiskAcknowledgement) {
      assert.equal(result.complete, true);
      assert.equal(result.ownerTrustStatus, 'OWNER_UNRESOLVED_RESIDUAL_RISK');
      assert.equal(result.externalUserApprovalVerified, false);
    } else {
      assert.equal(result.complete, false, String(value));
      assert.equal(x.state.calls.length, 0, String(value));
    }
  }
});
