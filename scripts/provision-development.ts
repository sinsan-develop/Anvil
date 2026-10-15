import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assertResourceAbsent, assertNewResourceLabels } from './development-resource-guards.ts';

const root = '/home/daon/.local/share/anvil-v3-development';
const resource = {
  container: 'anvil-v3-development-pg', network: 'anvil-v3-development',
  volume: 'anvil-v3-development-pgdata', database: 'anvil_v3_development',
  image: 'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',
  imageId: 'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',
};
const args = process.argv.slice(2);
if (args.length !== 1 || !['--plan', '--create'].includes(args[0]!)) throw Error('PROVISION_MODE_REQUIRED');
if (args[0] === '--plan') {
  console.log(JSON.stringify({ ...resource, secretRoot: root, bind: '127.0.0.1:5546:5432', existingResources: 'never-modify', retention: 'preserve-development-db' }));
} else {
  if (process.platform !== 'linux' || process.getuid?.() !== 1000) throw Error('PROVISION_HOST_INVALID');
  function docker(args: string[], input?: string): string {
    try { return execFileSync('docker', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
    catch { throw Error('PROVISION_DOCKER_STEP_FAILED'); }
  }
  assertResourceAbsent(docker(['container', 'ls', '-a', '--format', '{{.Names}}']), resource.container);
  assertResourceAbsent(docker(['network', 'ls', '--format', '{{.Name}}']), resource.network);
  assertResourceAbsent(docker(['volume', 'ls', '--format', '{{.Name}}']), resource.volume);
  if (existsSync(root) || realpathSync('/home/daon') !== '/home/daon') throw Error('SECRET_TARGET_NOT_NEW');
  for (const parent of ['/home/daon/.local', '/home/daon/.local/share']) {
    if (!existsSync(parent) || lstatSync(parent).isSymbolicLink() || realpathSync(parent) !== parent) throw Error('SECRET_PARENT_INVALID');
  }
  if (docker(['image', 'inspect', resource.image, '--format', '{{.Id}}']) !== resource.imageId) throw Error('IMAGE_ID_MISMATCH');
  const bootstrap = randomBytes(32).toString('hex');
  const instance = randomBytes(16).toString('hex');
  const migrator = randomBytes(32).toString('hex');
  const app = randomBytes(32).toString('hex');
  mkdirSync(root, { mode: 0o700 });
  writeFileSync(root + '/bootstrap-password', bootstrap, { flag: 'wx', mode: 0o600 });
  const config = { host: '127.0.0.1', port: 5546, database: resource.database, application_name: 'anvil-v3-development', connectionTimeoutMillis: 5000 };
  writeFileSync(root + '/migrator.json', JSON.stringify({ ...config, user: 'anvil_v3_migrator', password: migrator }), { flag: 'wx', mode: 0o600 });
  writeFileSync(root + '/app.json', JSON.stringify({ ...config, user: 'anvil_v3_app', password: app }), { flag: 'wx', mode: 0o600 });
  docker(['network', 'create', '--label', 'anvil.project=v3', '--label', 'anvil.owner=P03', '--label', 'anvil.instance=' + instance, resource.network]);
  assertNewResourceLabels(JSON.parse(docker(['network', 'inspect', resource.network, '--format', '{{json .Labels}}'])), instance);
  docker(['volume', 'create', '--label', 'anvil.project=v3', '--label', 'anvil.owner=P03', '--label', 'anvil.instance=' + instance, resource.volume]);
  assertNewResourceLabels(JSON.parse(docker(['volume', 'inspect', resource.volume, '--format', '{{json .Labels}}'])), instance);
  const containerId = docker(['run', '-d', '--name', resource.container,
    '--label', 'anvil.project=v3', '--label', 'anvil.owner=P03', '--label', 'anvil.instance=' + instance, '--network', resource.network,
    '--publish', '127.0.0.1:5546:5432',
    '--mount', 'type=volume,source=' + resource.volume + ',target=/var/lib/postgresql/data',
    '--mount', 'type=bind,source=' + root + '/bootstrap-password,target=/run/secrets/bootstrap-password,readonly',
    '--env', 'POSTGRES_USER=anvil_v3_bootstrap', '--env', 'POSTGRES_DB=' + resource.database,
    '--env', 'POSTGRES_PASSWORD_FILE=/run/secrets/bootstrap-password', resource.image,
    '-c', 'log_statement=none', '-c', 'log_min_error_statement=fatal']);
  assertNewResourceLabels(JSON.parse(docker(['container', 'inspect', resource.container, '--format', '{{json .Config.Labels}}'])), instance);
  if (docker(['container', 'inspect', resource.container, '--format', '{{.Id}}|{{.Image}}']) !== containerId + '|' + resource.imageId) throw Error('NEW_CONTAINER_ID_MISMATCH');
  let ready = false;
  for (let n = 0; n < 30; n++) {
    try { docker(['exec', resource.container, 'pg_isready', '-U', 'anvil_v3_bootstrap', '-d', resource.database]); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (!ready) throw Error('NEW_DEVELOPMENT_DB_NOT_READY_PRESERVED');
  const sql = `BEGIN;
CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '${migrator}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE anvil_v3_app LOGIN PASSWORD '${app}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
REVOKE ALL ON DATABASE anvil_v3_development FROM PUBLIC;
GRANT CONNECT ON DATABASE anvil_v3_development TO anvil_v3_migrator,anvil_v3_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;
CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;
GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;
ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;
COMMIT;`;
  docker(['exec', '-i', resource.container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'anvil_v3_bootstrap', '-d', resource.database], sql);
  console.log(JSON.stringify({ ...resource, containerId, secretFiles: 'protected-no-output', roles: ['anvil_v3_migrator', 'anvil_v3_app'], state: 'created-not-product-verified' }));
}
