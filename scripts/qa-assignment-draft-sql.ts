import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { assignmentDraftSqlQaResource as resource, assertAssignmentDraftSqlQaBinding, buildAssignmentDraftSqlQa, readAssignmentDraftSqlQaResult } from './assignment-draft-sql-qa.ts';
import { assertSourceRootQaTmpfs } from './source-root-qa-guard.ts';
import { assertSourceReadQaDaemon, sourceReadQaError } from './source-read-qa-guard.ts';
import { sourceReadPsqlError } from './source-read-psql-batches.ts';

if (process.argv.length !== 3 || !['--plan', '--run'].includes(process.argv[2]!)) throw Error('QA_MODE_REQUIRED');
if (process.argv[2] === '--plan') console.log(JSON.stringify({ ...resource, scope: 'NEW_EMPTY_SCHEMA_SQL_BOUNDARY_ONLY', migrations: 47, previousMigrations: 46, storage: 'NEW_TMPFS_256M', network: resource.network, networkIsolation: 'NEW_INTERNAL_NETWORK', retention: 'EXACT_OWN_CONTAINER_NETWORK_REMOVE', formalDbChanges: 0, actualWorkflowVerified: false, actualExecuted: false }));
else {
  let phase = 'PREFLIGHT', containerId: string | null = null, networkId: string | null = null, failure: string | null = null, cleanupFailure: string | null = null, diagnostic: unknown = null, report: unknown = null, deadline = 0, cleanup = false, created = false;
  const instance = randomBytes(16).toString('hex'), owner = 'FN09_ASSIGNMENT_DRAFT_SQL_QA';
  function fresh() { if (!Number.isFinite(deadline) || Date.now() >= deadline) throw Error('QA_EXPIRED'); }
  function docker(args: string[], input?: string, env = process.env, timeout = 30000) {
    if (!cleanup) fresh();
    try { return execFileSync('/usr/bin/docker', ['--host', 'unix:///var/run/docker.sock', ...args], { input, env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: cleanup ? Math.min(timeout, 30000) : Math.max(1, Math.min(timeout, deadline - Date.now())), maxBuffer: 2 * 1024 * 1024 }).trim(); }
    catch (e) { if (args.includes('psql')) { diagnostic = sourceReadPsqlError(e); throw Error('QA_PSQL_STEP_FAILED'); } throw Error('QA_DOCKER_STEP_FAILED'); }
  }
  const inspect = (kind: 'container' | 'network', id: string) => JSON.parse(docker([kind, 'inspect', id]))[0];
  function owned(item: any, id: string, kind: 'container' | 'network') {
    const labels = kind === 'container' ? item?.Config?.Labels : item?.Labels;
    if (!/^[0-9a-f]{64}$/.test(id) || item?.Id !== id || labels?.['anvil.owner'] !== owner || labels?.['anvil.project'] !== 'v3' || labels?.['anvil.instance'] !== instance || (kind === 'container' ? item.Name !== '/' + resource.container : item.Name !== resource.network)) throw Error('QA_CLEANUP_IDENTITY_MISMATCH');
  }
  function safeContainer(item: any, actualMounts: string) {
    assertSourceRootQaTmpfs(item, resource.imageId, actualMounts);
    const requested = item?.HostConfig?.PortBindings, actual = item?.NetworkSettings?.Ports, networks = item?.NetworkSettings?.Networks;
    if (item?.HostConfig?.PublishAllPorts !== false || requested != null && Object.keys(requested).length || !actual || Object.keys(actual).length !== 1 || actual['5432/tcp'] !== null || !networkId || !networks || Object.keys(networks).length !== 1 || networks[resource.network]?.NetworkID !== networkId) throw Error('QA_PUBLISH_OR_NETWORK_INVALID');
  }
  function psql(role: string, password: string, sql: string) {
    return docker(['exec', '-i', '--env', 'PGPASSWORD', '--env', 'PGCONNECT_TIMEOUT=5', containerId!, 'psql', '--no-psqlrc', '--no-password', '--quiet', '--no-align', '--tuples-only', '--host=127.0.0.1', '--port=5432', '--username=' + role, '--dbname=' + resource.database, '--set=ON_ERROR_STOP=on', '--set=VERBOSITY=sqlstate', '--set=SHOW_CONTEXT=never', '--set=ECHO=none', '--file=-'], sql, { ...process.env, PGPASSWORD: password }, 90000);
  }
  try {
    if (process.platform !== 'linux' || process.getuid?.() !== 1000) throw Error('QA_FN09_RUN_BINDING_INVALID');
    deadline = assertAssignmentDraftSqlQaBinding(await realpath(process.cwd()), await realpath(new URL(import.meta.url)), process.env);
    const expected = process.env.ANVIL_FN09_DRAFT_QA_COMMIT!, sqlHash = process.env.ANVIL_FN09_DRAFT_QA_SQL_HASH!;
    if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== expected || execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() || execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim() !== 'git@github-sinsan-develop:sinsan-develop/Anvil.git') throw Error('QA_GIT_TARGET_INVALID');
    const batches = await buildAssignmentDraftSqlQa(); if (batches.sqlHash !== sqlHash) throw Error('QA_SQL_HASH_MISMATCH');
    const socket = await stat('/var/run/docker.sock'); if (!socket.isSocket() || socket.uid !== 0 || await realpath('/usr/bin/docker') !== '/usr/bin/docker') throw Error('QA_LOCAL_DOCKER_ENDPOINT_INVALID');
    assertSourceReadQaDaemon(JSON.parse(docker(['info', '--format', '{{json .}}'])), process.env.ANVIL_FN09_DRAFT_QA_DAEMON_ID ?? '', process.env.ANVIL_FN09_DRAFT_QA_DAEMON_NAME ?? '');
    if (docker(['container', 'ls', '-a', '--format', '{{.Names}}']).split('\n').includes(resource.container) || docker(['network', 'ls', '--format', '{{.Name}}']).split('\n').includes(resource.network)) throw Error('QA_RESOURCE_ALREADY_EXISTS');
    if (docker(['image', 'inspect', resource.image, '--format', '{{.Id}}']) !== resource.imageId) throw Error('QA_IMAGE_MISMATCH');
    const bootstrap = randomBytes(32).toString('hex'), migrator = randomBytes(32).toString('hex'), app = randomBytes(32).toString('hex'), labels = ['--label', 'anvil.project=v3', '--label', 'anvil.owner=' + owner, '--label', 'anvil.instance=' + instance];
    created = true; phase = 'CREATE_INTERNAL_NETWORK'; networkId = docker(['network', 'create', '--internal', ...labels, resource.network]); const network = inspect('network', networkId); owned(network, networkId, 'network'); if (network.Internal !== true) throw Error('QA_NETWORK_NOT_INTERNAL');
    phase = 'CREATE_UNPUBLISHED_PG'; containerId = docker(['run', '-d', '--name', resource.container, ...labels, '--network', resource.network, '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456', '--env', 'POSTGRES_USER=anvil_v3_bootstrap', '--env', 'POSTGRES_DB=' + resource.database, '--env', 'POSTGRES_PASSWORD', resource.image, '-c', 'log_statement=none', '-c', 'log_min_error_statement=fatal'], undefined, { ...process.env, POSTGRES_PASSWORD: bootstrap });
    let item = inspect('container', containerId); owned(item, containerId, 'container'); safeContainer(item, docker(['exec', containerId, 'cat', '/proc/mounts']));
    phase = 'PG_READY'; let ready = false; for (let n = 0; n < 30; n++) { fresh(); try { docker(['exec', containerId, 'pg_isready', '-h', '127.0.0.1', '-U', 'anvil_v3_bootstrap', '-d', resource.database]); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); } } if (!ready) throw Error('QA_PG_NOT_READY');
    phase = 'QA_BOOTSTRAP'; psql('anvil_v3_bootstrap', bootstrap, "BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '" + migrator + "' NOSUPERUSER NOCREATEDB NOCREATEROLE;CREATE ROLE anvil_v3_app LOGIN PASSWORD '" + app + "' NOSUPERUSER NOCREATEDB NOCREATEROLE;REVOKE ALL ON DATABASE " + resource.database + ' FROM PUBLIC;GRANT CONNECT ON DATABASE ' + resource.database + " TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;");
    phase = 'SCHEMA_COMMIT'; const schema = readAssignmentDraftSqlQaResult(psql('anvil_v3_migrator', migrator, batches.schema), 'SCHEMA');
    phase = 'APP_READ_ONLY'; const readOnly = readAssignmentDraftSqlQaResult(psql('anvil_v3_app', app, batches.readOnly), 'READ_ONLY');
    phase = 'APP_UNAUTHORIZED_WRITE'; const denied = readAssignmentDraftSqlQaResult(psql('anvil_v3_app', app, batches.deniedWrite), 'DENIED_WRITE'); fresh();
    report = { commit: expected, sqlHash, node: process.version, schema, readOnly, denied, actualWorkflowVerified: false, actualAgentCalls: 0, formalDbChanges: 0 }; phase = 'SQL_BOUNDARY_DONE';
  } catch (e) { diagnostic ??= sourceReadQaError(e); failure = sourceReadQaError(e).failure; }
  finally {
    cleanup = true;
    if (created) try {
      if (!containerId && docker(['container', 'ls', '-a', '--format', '{{.Names}}']).split('\n').includes(resource.container)) { const item = inspect('container', resource.container); owned(item, item.Id, 'container'); containerId = item.Id; }
      if (!networkId && docker(['network', 'ls', '--format', '{{.Name}}']).split('\n').includes(resource.network)) { const item = inspect('network', resource.network); owned(item, item.Id, 'network'); networkId = item.Id; }
      if (containerId) { const item = inspect('container', containerId); owned(item, containerId, 'container'); safeContainer(item, docker(['exec', containerId, 'cat', '/proc/mounts'])); docker(['rm', '-f', containerId]); }
      if (networkId) { const item = inspect('network', networkId); owned(item, networkId, 'network'); if (!item.Internal || Object.keys(item.Containers ?? {}).length) throw Error('QA_NETWORK_NOT_EMPTY_OR_NOT_INTERNAL'); docker(['network', 'rm', networkId]); }
      if (docker(['container', 'ls', '-a', '--format', '{{.Names}}']).split('\n').includes(resource.container) || docker(['network', 'ls', '--format', '{{.Name}}']).split('\n').includes(resource.network)) throw Error('QA_RESOURCES_REMAIN');
    } catch { cleanupFailure = 'QA_EXACT_CLEANUP_FAILED_PRESERVE_AND_REPORT'; }
  }
  console.log(JSON.stringify({ status: failure || cleanupFailure ? 'FAIL' : 'PASS', failure, cleanupFailure, phase, diagnostic, report, resourceIdentity: { containerId, networkId, instance }, formalDbChanges: 0, actualWorkflowVerified: false })); if (failure || cleanupFailure) process.exitCode = 1;
}
