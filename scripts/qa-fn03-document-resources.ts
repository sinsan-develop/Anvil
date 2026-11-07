/** FN03 전용 오케스트레이터 후보. PMO exact 판정 전 --run 호출 금지. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath, readdir, rm } from 'node:fs/promises';
import { fn03Resources as r, fn03CallBudget, assertFn03Owned, assertFn03FileIdentity } from './fn03-resource-guard.ts';
import { buildExecutionPreparationQaSchema } from './execution-preparation-qa.ts';

if (process.argv[2] === '--plan' && process.argv.length === 3) {
  console.log(JSON.stringify({ ...r, maxMs: 1800000, workflowMs: 120000, cleanupMs: 60000, actualExecuted: false }));
} else if (process.argv[2] === '--run' && process.argv.length === 3) {
  try { await execute(); } catch { console.error('FN03_RESOURCE_PREFLIGHT_FAILED'); process.exitCode = 1; }
} else { console.error('FN03_RESOURCE_MODE_REFUSED'); process.exitCode = 1; }

async function execute() {
  const sha = process.env.ANVIL_FN03_QA_SHA ?? '', issued = Date.parse(process.env.ANVIL_FN03_QA_ISSUED ?? ''), until = Date.parse(process.env.ANVIL_FN03_QA_UNTIL ?? '');
  // 환경값은 위임/플랫폼 허가가 아니다. exact 승인 뒤 외부 timeout(29분+60초) 안에서만 사용한다.
  if (process.platform !== 'linux' || process.getuid?.() !== 1000 || !/^[a-f0-9]{40}$/.test(sha)
    || !Number.isFinite(issued) || !Number.isFinite(until) || issued > Date.now() || until <= Date.now() + 180000
    || until - issued > 1800000 || until <= issued
    || process.env.ANVIL_DB_CONFIG || process.env.ANVIL_MIGRATOR_CONFIG
    || Object.entries(process.env).some(([k, v]) => !!v && (k.startsWith('PG') || k.startsWith('DOCKER_') || ['NODE_OPTIONS', 'NODE_PATH'].includes(k))))
    throw Error('FN03_RESOURCE_ENTRY_REFUSED');
  assert.equal(await realpath(process.cwd()), r.root);
  assert.equal(await realpath(new URL(import.meta.url)), r.root + '/scripts/qa-fn03-document-resources.ts');
  const timeoutParent = (await readFile('/proc/' + process.ppid + '/cmdline', 'utf8')).split('\0').filter(Boolean);
  assert.deepEqual(timeoutParent, ['/usr/bin/timeout', '--signal=TERM', '--kill-after=60s', '29m',
    '/opt/node-v24.21.0-linux-x64/bin/node', r.root + '/scripts/qa-fn03-document-resources.ts', '--run'], 'FN03_HARD_TIMEOUT_PARENT_REQUIRED');
  assert.equal(await realpath(process.execPath), '/opt/node-v24.21.0-linux-x64/bin/node');
  assert.equal(createHash('sha256').update(await readFile(process.execPath)).digest('hex'), '7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c');
  const git = (args: string[]) => execFileSync('/usr/bin/git', args, { encoding: 'utf8', timeout: 10000 }).trim();
  assert.equal(git(['rev-parse', 'HEAD']), sha); assert.equal(git(['status', '--porcelain']), '');
  assert.equal(git(['remote', 'get-url', 'origin']), 'git@github-sinsan-develop:sinsan-develop/Anvil.git');
  const rootStat = await lstat(r.root); assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink() && rootStat.uid === 1000 && rootStat.birthtimeMs >= issued - 5000);
  await assert.rejects(lstat(r.protected), { code: 'ENOENT' });
  assert.equal(await realpath('/home/daon/.local/share'), '/home/daon/.local/share');
  assert.equal(await realpath(r.dependencies), r.dependencies);
  const dependencyRoot = await lstat(r.dependencies); assert.ok(dependencyRoot.isDirectory() && !dependencyRoot.isSymbolicLink());
  // 공통 공개 의존성은 읽기 전용만. 외부 참조 링크를 컨테이너에 임의 추가하지 않는다.
  async function dependencyLinks(path: string): Promise<void> {
    for (const name of await readdir(path)) {
      const item = path + '/' + name, stat = await lstat(item);
      if (stat.isSymbolicLink()) {
        const resolved = await realpath(item); assert.ok(resolved.startsWith(r.dependencies + '/'), 'FN03_DEPENDENCY_ESCAPE');
      } else if (stat.isDirectory()) await dependencyLinks(item);
    }
  }
  await dependencyLinks(r.dependencies);
  assert.deepEqual(await readFile(r.root + '/package-lock.json'), await readFile('/home/daon/deploy/anvil-v3/package-lock.json'));
  const instance = randomBytes(16).toString('hex'), ids: { node?: string; pg?: string; network?: string } = {};
  let protectedIdentity: { dev: number; ino: number } | null = null;
  const ownedFiles = new Map<string, { dev: number; ino: number; hash: string }>();
  const recordFile = async (name: string) => {
    const path = r.protected + '/' + name, stat = await lstat(path);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 1000 && stat.nlink === 1);
    ownedFiles.set(name, { dev: stat.dev, ino: stat.ino, hash: createHash('sha256').update(await readFile(path)).digest('hex') });
  };
  let closing = false, cleanupUntil = 0, protectedCreated = false, phase = 'PREFLIGHT', failure = false, cleanupFailure = false;
  let aborted = false; const abort = () => { aborted = true; };
  process.on('SIGTERM', abort); process.on('SIGINT', abort);
  const labels = ['--label', 'anvil.project=v3', '--label', 'anvil.owner=' + r.owner, '--label', 'anvil.instance=' + instance];
  const docker = (args: string[], input?: string, env = process.env, maximum = 15000) => {
    if (aborted && !closing) throw Error('FN03_RESOURCE_CANCELLED');
    return execFileSync('/usr/bin/docker', ['--host', 'unix:///var/run/docker.sock', ...args], {
    input, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 2 * 1024 * 1024,
    timeout: fn03CallBudget(closing ? cleanupUntil : until - 60000, Date.now(), maximum), killSignal: 'SIGKILL',
    }).trim();
  };
  const inspect = (kind: 'container' | 'network', id: string) => JSON.parse(docker([kind, 'inspect', id]))[0];
  const names = (kind: 'container' | 'network') => docker([kind, 'ls', ...(kind === 'container' ? ['-a'] : []), '--format', kind === 'container' ? '{{.Names}}' : '{{.Name}}']).split('\n');
  const sql = (user: string, password: string, text: string) => docker(['exec', '-i', '--env', 'PGPASSWORD', '--env', 'PGCONNECT_TIMEOUT=5', ids.pg!,
    'psql', '--no-psqlrc', '--no-password', '--quiet', '--no-align', '--tuples-only', '--host=127.0.0.1', '--username=' + user,
    '--dbname=' + r.database, '--set=ON_ERROR_STOP=on', '--set=VERBOSITY=sqlstate', '--set=SHOW_CONTEXT=never', '--set=ECHO=none', '--file=-'], text, { ...process.env, PGPASSWORD: password });
  const resolveOwned = (kind: 'node' | 'pg' | 'network') => {
    const type = kind === 'network' ? 'network' : 'container', name = kind === 'network' ? r.net : r[kind];
    if (!names(type).includes(name)) return null;
    const item = inspect(type, name); assertFn03Owned(item, kind, instance, ids.network ?? null);
    return item;
  };
  // Docker client timeout만으로 컨테이너를 중지했다고 주장하지 않는다. finally에서 exact ID를 회수한다.
  try {
    assert.ok((await lstat('/var/run/docker.sock')).isSocket());
    assert.equal(JSON.parse(docker(['info', '--format', '{{json .}}'])).ID, r.daemon);
    assert.ok(!names('container').includes(r.pg) && !names('container').includes(r.node) && !names('network').includes(r.net));
    assert.equal(docker(['image', 'inspect', r.pgImage, '--format', '{{.Id}}']), r.pgId);
    assert.equal(docker(['image', 'inspect', r.nodeImage, '--format', '{{.Id}}']), r.nodeId);
    const schema = await buildExecutionPreparationQaSchema();
    assert.equal(createHash('sha256').update(JSON.stringify(schema.manifest)).digest('hex'), 'da6f6a9102f8018e2e41d4e00545acd74ec9f2db70e3cf2a7658ec6e6c7e62b6');
    assert.equal(createHash('sha256').update(schema.schema).digest('hex'), '177c4ee11ef74e5d25ebb25a7f507258eac4cc71918af9023b08e0806e215006');
    const bootstrap = randomBytes(32).toString('hex'), appPassword = randomBytes(32).toString('hex'), migratorPassword = randomBytes(32).toString('hex');
    phase = 'PROTECTED_CONFIG'; await mkdir(r.protected, { mode: 0o700 }); protectedCreated = true;
    const protectedStat = await lstat(r.protected); protectedIdentity = { dev: protectedStat.dev, ino: protectedStat.ino };
    await writeFile(r.protected + '/run.json', JSON.stringify({ sha, appPassword, migratorPassword, issuedAt: new Date(issued).toISOString(), expiresAt: new Date(until).toISOString() }), { mode: 0o600, flag: 'wx' });
    await recordFile('run.json');
    await mkdir(r.root + '/node_modules'); // 빈 mount point만. 기존 의존성/제품 source 수정0.
    phase = 'NETWORK'; ids.network = docker(['network', 'create', '--internal', ...labels, r.net]);
    assertFn03Owned(inspect('network', ids.network), 'network', instance, ids.network);
    phase = 'PG'; ids.pg = docker(['run', '-d', '--name', r.pg, ...labels, '--network', r.net, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456',
      '--env', 'POSTGRES_USER=anvil_v3_bootstrap', '--env', 'POSTGRES_DB=' + r.database, '--env', 'POSTGRES_PASSWORD', r.pgImage, '-c', 'log_statement=none', '-c', 'log_min_error_statement=fatal'], undefined, { ...process.env, POSTGRES_PASSWORD: bootstrap });
    assertFn03Owned(inspect('container', ids.pg), 'pg', instance, ids.network);
    phase = 'READY'; let ready = false;
    for (let n = 0; n < 40; n++) { try { docker(['exec', ids.pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'anvil_v3_bootstrap', '-d', r.database]); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); } }
    assert.ok(ready, 'FN03_PG_NOT_READY');
    phase = 'SCHEMA'; sql('anvil_v3_bootstrap', bootstrap, "BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '" + migratorPassword + "' NOSUPERUSER NOCREATEDB NOCREATEROLE;CREATE ROLE anvil_v3_app LOGIN PASSWORD '" + appPassword + "' NOSUPERUSER NOCREATEDB NOCREATEROLE;REVOKE ALL ON DATABASE " + r.database + ' FROM PUBLIC;GRANT CONNECT ON DATABASE ' + r.database + " TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;");
    assert.ok(sql('anvil_v3_migrator', migratorPassword, schema.schema).includes('C1_SCHEMA_51_COMMITTED'));
    phase = 'NODE_GATE';
    const gate = "const f=await import('node:fs/promises');const end=Date.now()+30000;while(true){try{if((await f.readFile('/qa-config/go','utf8'))===process.env.QA_INSTANCE)break;}catch{}if(Date.now()>end)process.exit(1);await new Promise(r=>setTimeout(r,100));}process.argv[1]='/qa-source/scripts/qa-fn03-document-isolated.ts';process.argv[2]='--execute';await import('file:///qa-source/scripts/qa-fn03-document-isolated.ts');";
    ids.node = docker(['run', '-d', '--name', r.node, ...labels, '--network', r.net, '--user', '1000:1000', '--workdir', '/qa-source', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
      '--mount', 'type=bind,src=' + r.root + ',dst=/qa-source,readonly', '--mount', 'type=bind,src=' + r.dependencies + ',dst=/qa-source/node_modules,readonly', '--mount', 'type=bind,src=' + r.protected + ',dst=/qa-config,readonly',
      '--tmpfs', '/qa-data:rw,noexec,nosuid,size=67108864,uid=1000,gid=1000,mode=0700', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16777216',
      '--env', 'ANVIL_FN03_ISOLATED_QA=EXACT_RESOURCE_REVIEW_REQUIRED', '--env', 'ANVIL_FN03_QA_SHA=' + sha, '--env', 'QA_INSTANCE=' + instance, r.nodeImage, 'node', '--input-type=module', '-e', gate]);
    assertFn03Owned(inspect('container', ids.node), 'node', instance, ids.network);
    await writeFile(r.protected + '/go', instance, { mode: 0o600, flag: 'wx' });
    await recordFile('go');
    phase = 'WORKFLOW'; const workflowUntil = Math.min(Date.now() + 120000, until - 60000);
    // 120초 동기 docker wait는 SIGTERM handler를 막으므로 짧은 inspect 사이에 event loop를 양보한다.
    while (true) {
      assert.ok(Date.now() < workflowUntil, 'FN03_WORKFLOW_TIMEOUT');
      const item = inspect('container', ids.node); assertFn03Owned(item, 'node', instance, ids.network);
      if (!item.State.Running) { assert.equal(item.State.ExitCode, 0); break; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const output = docker(['logs', ids.node]);
    const lines = output.split('\n').filter(line => line.startsWith('{'));
    assert.equal(lines.length, 1); const result = JSON.parse(lines[0]!);
    assert.equal(result.kind, 'FN03_ISOLATED_DOCUMENT_QA'); assert.equal(result.sha, sha); assert.equal(result.actualExecuted, true);
    assert.deepEqual(result.markers, ['ISOLATED_PG15_NON_SUPER_EMPTY', 'NO_POLICY_DENIED_NO_ARTIFACT', 'RAW_BYTES_REPLAY_NON_MEMBER_DENIED_MISSING_FILE_503', 'DOCUMENT_DENY_SAVE_REPLAY_TWO_VERSIONS_OTHER_CONNECTION']);
    phase = 'WORKFLOW_DONE';
  } catch { failure = true; }
  finally {
    closing = true; cleanupUntil = Math.min(until, Date.now() + 60000);
    // 한 회수 오류로 다른 exact 자원의 회수 시도를 생략하지 않는다.
    for (const kind of ['node', 'pg'] as const) try {
      const item = resolveOwned(kind); if (item) { assert.ok(!ids[kind] || ids[kind] === item.Id); ids[kind] = item.Id; docker(['rm', '-f', item.Id]); }
    } catch { cleanupFailure = true; }
    try { const item = resolveOwned('network'); if (item) { assert.deepEqual(item.Containers, {}); docker(['network', 'rm', item.Id]); } } catch { cleanupFailure = true; }
    try { assert.ok(!names('container').includes(r.pg) && !names('container').includes(r.node) && !names('network').includes(r.net)); } catch { cleanupFailure = true; }
    // 파일 회수는 Docker 참조가 모두 사라졌을 때만. 링크·타 소유자/추가 파일은 보존한다.
    if (!cleanupFailure && protectedCreated) try {
      const stat = await lstat(r.protected); assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 1000 && await realpath(r.protected) === r.protected
        && protectedIdentity?.dev === stat.dev && protectedIdentity.ino === stat.ino);
      const files = await readdir(r.protected); assert.equal(files.length, ownedFiles.size);
      for (const name of files) {
        const path = r.protected + '/' + name, st = await lstat(path), expected = ownedFiles.get(name);
        assert.ok(expected && st.isFile() && !st.isSymbolicLink() && st.uid === 1000 && st.nlink === 1 && st.dev === expected.dev && st.ino === expected.ino);
        assertFn03FileIdentity({ dev: st.dev, ino: st.ino, uid: st.uid, nlink: st.nlink, hash: createHash('sha256').update(await readFile(path)).digest('hex') }, expected);
      }
      await rm(r.protected, { recursive: true });
    } catch { cleanupFailure = true; }
    if (!cleanupFailure) try {
      assert.equal(git(['rev-parse', 'HEAD']), sha); assert.equal(git(['status', '--porcelain']), '');
      const current = await lstat(r.root);
      assert.ok(current.dev === rootStat.dev && current.ino === rootStat.ino && await realpath(r.root) === r.root);
      async function ownedTree(path: string): Promise<void> {
        assert.ok(Date.now() < cleanupUntil, 'FN03_SOURCE_CLEANUP_EXPIRED');
        const stat = await lstat(path); assert.ok(stat.uid === 1000 && !stat.isSymbolicLink(), 'FN03_SOURCE_TREE_CHANGED');
        if (stat.isDirectory()) for (const name of await readdir(path)) await ownedTree(path + '/' + name);
        else assert.ok(stat.isFile(), 'FN03_SOURCE_SPECIAL_FILE');
      }
      await ownedTree(r.root);
      process.chdir('/home/daon/deploy');
      await rm(r.root, { recursive: true });
      await assert.rejects(lstat(r.root), { code: 'ENOENT' });
      await assert.rejects(lstat(r.protected), { code: 'ENOENT' });
    } catch { cleanupFailure = true; }
    console.log(JSON.stringify({ kind: 'FN03_RESOURCE_RESULT', sha, instance, phase, failure, cancelled: aborted, cleanupFailure, ids, formalDbChanges: 0,
      checkoutCleanup: cleanupFailure ? 'UNVERIFIED_PRESERVE' : 'EXACT_OWN_ROOT_ABSENT', independentResidueCheck: 'NOT_PERFORMED' }));
    if (failure || cleanupFailure || aborted) process.exitCode = 1;
    process.removeListener('SIGTERM', abort); process.removeListener('SIGINT', abort);
  }
}
