import { createHash } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import { constants, promises as fs, type Stats } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWireJson } from '../contracts/canonical.ts';

// 고정 P03 준비 실행기. import/default/plan에는 환경 조회나 부작용이 없다.
export const FIXED = Object.freeze({
  sourceRoot: '/home/daon/anvil-v3-pgdiscovery-20261027-r2-src',
  ledgerRoot: '/home/daon/.local/share/anvil-v3-pgdiscovery-20261027-r2',
  node: '/opt/node-v24.21.0-linux-x64/bin/node',
  nodeSha256: '7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c',
  branch: 'codex/av3-stage-b', remote: 'git@github-sinsan-develop:sinsan-develop/Anvil.git',
  name: 'anvil-v3-pgdiscovery-20261027-r2',
  image: 'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',
  daemon: 'e3349f1d-dbfc-478a-96d9-295bf6c6839e',
  volume: 'anvil-v3-development-pgdata', volumeInstance: 'dc22a0629e79f259dcd935845e88e58e',
  volumeCreated: '2026-10-16T03:53:33+09:00', mount: '/var/lib/postgresql/data',
  shellPath: 'scripts/pg-recovery-discovery-readonly.sh', controllerPath: 'scripts/p03-pg-discovery-host.ts',
  shellSha256: '156867ef53948c2a18cf439eba8db46ecf461ab11fd86116239b2e5fec9a480b',
  scope: 'P03_RO_METADATA_R2', totalMs: 60000, startMinimumMs: 57500, reserveMs: 2500,
  metadataBytes: 8192, controlBytes: 262144, grantMs: 1800000,
});
const hash = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const fullId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize)
  : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
const same = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Fault(code); }
class Fault extends Error {
  readonly code: string; readonly clientTermRequested: boolean; readonly clientCloseUnconfirmed: boolean;
  constructor(code: string, facts?: { clientTermRequested?: boolean; clientCloseUnconfirmed?: boolean }) {
    super(code); this.code = code; this.clientTermRequested = facts?.clientTermRequested === true; this.clientCloseUnconfirmed = facts?.clientCloseUnconfirmed === true;
  }
}
const codeOf = (error: unknown) => error instanceof Fault ? error.code : 'IO_UNKNOWN';
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const ownerTrustStatus = 'OWNER_UNRESOLVED_RESIDUAL_RISK' as const;
const numericOwnerRiskAcknowledgement = 'P03_UID1001_OWNER_UNRESOLVED_REPLACEMENT_RISK_ACCEPTED_FOR_THIS_RUN';
const nodeParents = Object.freeze([
  Object.freeze({ path: '/', uid: 0, gid: 0, mode: 0o755 }),
  Object.freeze({ path: '/opt', uid: 0, gid: 0, mode: 0o755 }),
  Object.freeze({ path: '/opt/node-v24.21.0-linux-x64', uid: 1001, gid: 1001, mode: 0o755 }),
  Object.freeze({ path: '/opt/node-v24.21.0-linux-x64/bin', uid: 1001, gid: 1001, mode: 0o755 }),
]);
function keys(value: unknown, allowed: string[]) {
  return object(value) && Object.keys(value).sort().join('|') === [...allowed].sort().join('|');
}

export type Command = { kind: 'daemon' | 'image' | 'volume' | 'consumers' | 'named' }
  | { kind: 'create'; instance: string }
  | { kind: 'inspect' | 'term' | 'remove'; id: string }
  | { kind: 'start'; id: string; script: Buffer };
export type CommandResult = { code: number | null; signal: string | null; closed: boolean; stdout: string; stderr: string; error?: string; clientTermRequested?: boolean; clientCloseUnconfirmed?: boolean };
export type Grant = {
  schema: 1; scope: string; branch: string; commit: string; controllerSha256: string; shellSha256: string;
  nodeSha256: string; runInstance: string; issuedAt: string; expiresAt: string;
  totalMs: number; metadataBytes: number; maxCreates: 1; maxStarts: 1;
  numericOwnerRiskAcknowledgement: typeof numericOwnerRiskAcknowledgement;
};
export type HostBinding = { platform: string; uid: number; safePaths: boolean; nodePath: string; nodeSha256: string;
  sourceRoot: string; ledgerRoot: string; grant: unknown; consumed: boolean; grantFingerprint: string };
export type GitBinding = { branch: string; commit: string; remote: string; clean: boolean;
  controllerSha256: string; shellSha256: string; shell: Buffer };
export type Ports = {
  now(): number; wallNow(): number;
  fs: { binding(deadline: number): Promise<HostBinding>; consume(value: Record<string, unknown>, deadline: number): Promise<void>; receipt(value: Record<string, unknown>, deadline: number): Promise<void> };
  git: { binding(deadline: number): Promise<GitBinding> };
  docker: { command(command: Command, deadline: number): Promise<CommandResult> };
};
export function parseArguments(args: string[]): 'plan' | 'apply' {
  if (!args.length || same(args, ['--plan'])) return 'plan';
  if (same(args, ['--apply'])) return 'apply';
  throw new Fault('ARGUMENTS_REJECTED');
}
export function proposal() {
  return { status: 'PREPARATION_ONLY', complete: false, externalUserApprovalVerified: false,
    scope: FIXED.scope, totalMs: FIXED.totalMs, metadataBytes: FIXED.metadataBytes,
    actualExecutionAuthorized: false, ownerTrustStatus };
}
type NodeBinaryFacts = { path: string; canonical: string; isFile: boolean; isSymbolicLink: boolean;
  uid: number; gid: number; mode: number; nlink: number; dev: number; ino: number; size: number; mtimeMs: number };
type NodeParentFacts = { path: string; canonical: string; isDirectory: boolean; isSymbolicLink: boolean;
  uid: number; gid: number; mode: number; dev: number; ino: number };
export type NodeTrustFacts = {
  platform: string; executionUid: number; execPath: string; binary: NodeBinaryFacts; opened: NodeBinaryFacts;
  openedAfter: NodeBinaryFacts; after: NodeBinaryFacts; sha256: string;
  procSelfExe: { canonical: string; isFile: boolean; dev: number; ino: number; size: number };
  parentsBefore: NodeParentFacts[]; parentsAfter: NodeParentFacts[];
};
export function assertNodeTrustFacts(facts: NodeTrustFacts) {
  const validBinary = (value: NodeBinaryFacts) => object(value) && value.path === FIXED.node && value.canonical === FIXED.node
    && value.isFile === true && value.isSymbolicLink === false && value.uid === 1001 && value.gid === 1001
    && value.mode === 0o755 && value.nlink === 1 && integer(value.dev) && integer(value.ino)
    && integer(value.size) && value.size <= 268435456 && Number.isFinite(value.mtimeMs);
  requireValue(object(facts) && facts.platform === 'linux' && facts.executionUid === 1000 && facts.execPath === FIXED.node
    && [facts.binary, facts.opened, facts.openedAfter, facts.after].every(validBinary)
    && same(facts.binary, facts.opened) && same(facts.binary, facts.openedAfter) && same(facts.binary, facts.after)
    && facts.sha256 === FIXED.nodeSha256, 'NODE_BINDING');
  const validParents = (values: NodeParentFacts[]) => Array.isArray(values) && values.length === nodeParents.length
    && values.every((value, i) => { const expected = nodeParents[i]!;
      return object(value) && value.path === expected.path && value.canonical === expected.path
        && value.isDirectory === true && value.isSymbolicLink === false && value.uid === expected.uid
        && value.gid === expected.gid && value.mode === expected.mode && integer(value.dev) && integer(value.ino); });
  requireValue(validParents(facts.parentsBefore) && validParents(facts.parentsAfter)
    && same(facts.parentsBefore, facts.parentsAfter), 'NODE_BINDING');
  const proc = facts.procSelfExe;
  requireValue(object(proc) && proc.canonical === FIXED.node && proc.isFile === true && proc.dev === facts.binary.dev
    && proc.ino === facts.binary.ino && proc.size === facts.binary.size, 'NODE_BINDING');
  return { status: ownerTrustStatus };
}
export function parseGrantRecord(raw: Uint8Array): unknown {
  requireValue(raw.byteLength <= 8192, 'GRANT_REJECTED');
  try { return parseWireJson(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch { throw new Fault('GRANT_REJECTED'); }
}
const expectedEnvironment = Object.freeze({
  PATH: '/usr/bin:/bin', LANG: 'en_US.utf8', LC_ALL: 'C', BASH_ENV: '', ENV: '',
  GOSU_VERSION: '1.19', PG_MAJOR: '15', PG_VERSION: '15.18-1.pgdg13+1', PGDATA: FIXED.mount,
});
// image Env의 알려지지 않은 배포판/버전도 추정 수락하지 않는다. fresh 실측/검수 전 fail-closed다.
function safeEnv(value: unknown, image: boolean) {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) return false;
  const parsed: Record<string, string> = {};
  for (const item of value as string[]) {
    const split = item.indexOf('='); if (split <= 0) return false;
    const key = item.slice(0, split); if (Object.hasOwn(parsed, key)) return false;
    parsed[key] = item.slice(split + 1);
    if (!Object.hasOwn(expectedEnvironment, key)) return false;
    if (image && key === 'PATH') {
      // 기본 image PATH도 검사한다. 이후 고정 PATH로 override한다.
      if (parsed[key] !== '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/15/bin') return false;
    } else if (parsed[key] !== expectedEnvironment[key as keyof typeof expectedEnvironment]) return false;
  }
  const needed = image ? ['PATH', 'LANG', 'GOSU_VERSION', 'PG_MAJOR', 'PG_VERSION', 'PGDATA'] : Object.keys(expectedEnvironment);
  return keys(parsed, needed);
}
const labels = (instance: string) => ({ 'anvil.project': 'v3', 'anvil.owner': 'project-main', 'anvil.runid': FIXED.name, 'anvil.instance': instance });
const args = ['--signal=TERM', '55', '/bin/bash', '--noprofile', '--norc', '-s', '--', '--discover-p03-metadata-r2'];
export function createArguments(instance: string): string[] {
  requireValue(/^[a-f0-9]{32}$/.test(instance), 'INSTANCE_REJECTED');
  return ['create', '--name', FIXED.name, ...Object.entries(labels(instance)).flatMap(([k, v]) => ['--label', `${k}=${v}`]),
    '--pull=never', '--network', 'none', '--read-only', '--user', '999:999', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--pids-limit', '32', '--memory', '128m', '--cpus', '0.2',
    '--mount', `type=volume,source=${FIXED.volume},target=${FIXED.mount},readonly,volume-nocopy`,
    '--env', 'BASH_ENV=', '--env', 'ENV=', '--env', 'PATH=/usr/bin:/bin', '--env', 'LC_ALL=C',
    '--interactive', '--entrypoint', '/usr/bin/timeout', FIXED.image, ...args];
}
function argv(command: Command): string[] {
  switch (command.kind) {
    case 'daemon': return ['info', '--format', '{{json .ID}}'];
    case 'image': return ['image', 'inspect', FIXED.image, '--format', '{{json .}}'];
    case 'volume': return ['volume', 'inspect', FIXED.volume, '--format', '{{json .}}'];
    case 'named': return ['container', 'ls', '--all', '--no-trunc', '--filter', `name=^/${FIXED.name}$`, '--format', '{{json .ID}}'];
    case 'consumers': return ['container', 'ls', '--all', '--no-trunc', '--filter', `volume=${FIXED.volume}`, '--format', '{{json .ID}}'];
    case 'create': return createArguments(command.instance);
    default: {
      requireValue(fullId(command.id), 'ID_REJECTED');
      if (command.kind === 'inspect') return ['container', 'inspect', command.id, '--format', '{{json .}}'];
      if (command.kind === 'term') return ['container', 'kill', '--signal=TERM', command.id];
      if (command.kind === 'remove') return ['container', 'rm', command.id];
      if (command.kind === 'start') return ['container', 'start', '--attach', '--interactive', command.id];
      throw new Fault('COMMAND_REJECTED');
    }
  }
}
type Spawn = (...args: any[]) => any;
// 실제 프로세스 API는 이 좁은 adapter에만 있다. tests는 같은 handler에 fake child를 주입한다.
export function createDockerAdapter(options: { spawn?: Spawn; now: () => number }) {
  const spawn = options.spawn ?? nodeSpawn;
  return { command(command: Command, deadline: number): Promise<CommandResult> {
    const invocation = argv(command);
    const cap = command.kind === 'start' ? FIXED.metadataBytes : FIXED.controlBytes;
    return boundedChild(spawn, '/usr/bin/docker', ['--host', 'unix:///var/run/docker.sock', ...invocation],
      { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' }, options.now, deadline,
      cap, command.kind === 'start' ? command.script : undefined);
  } };
}
function boundedChild(spawn: Spawn, binary: string, invocation: string[], env: Record<string, string>,
  now: () => number, deadline: number, cap: number, input?: Buffer): Promise<CommandResult> {
  return new Promise(resolve => {
    let settled = false; let child: any; let stdout = Buffer.alloc(0); let stderr = Buffer.alloc(0); let total = 0;
    const remaining = deadline - now();
    if (remaining <= 0) { resolve({ code: null, signal: null, closed: false, stdout: '', stderr: '', error: 'DEADLINE' }); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: CommandResult) => { if (settled) return; settled = true; clearTimeout(timer); resolve(result); };
    const failure = (error: string) => {
      if (settled) return; settled = true; clearTimeout(timer);
      let clientTermRequested = false;
      if (child) {
        // 원 spawn handle만 대상으로 정상 TERM 최대1. 전역 PID 검색/kill/unref는 없다.
        clientTermRequested = true; try { child.kill('SIGTERM'); } catch { /* 원문은 내보내지 않는다. */ }
        for (const stream of [child.stdin, child.stdout, child.stderr]) { try { stream.destroy(); } catch { /* 보존 */ } }
      }
      resolve({ code: null, signal: null, closed: false, stdout: '', stderr: '', error, clientTermRequested, clientCloseUnconfirmed: !!child });
    };
    try {
      child = spawn(binary, invocation, { shell: false, env, stdio: ['pipe', 'pipe', 'pipe'], cwd: '/', windowsHide: true });
      timer = setTimeout(() => failure('DEADLINE'), Math.max(1, remaining));
      const collect = (isError: boolean) => (data: Buffer | string) => {
        if (settled) return; const bytes = Buffer.from(data); total += bytes.length;
        if (total > cap) { stdout = Buffer.alloc(0); stderr = Buffer.alloc(0); failure('OUTPUT_LIMIT'); return; }
        if (isError) stderr = Buffer.concat([stderr, bytes]); else stdout = Buffer.concat([stdout, bytes]);
      };
      child.stdout.on('data', collect(false)); child.stderr.on('data', collect(true));
      child.stdout.on('error', () => failure('STREAM_UNKNOWN')); child.stderr.on('error', () => failure('STREAM_UNKNOWN'));
      child.stdin.on('error', () => failure('STDIN_UNKNOWN'));
      child.on('error', () => failure('SPAWN_UNKNOWN'));
      child.on('close', (code: number | null, signal: string | null) => {
        if (now() >= deadline) { failure('DEADLINE'); return; }
        try { finish({ code, signal, closed: true, stdout: new TextDecoder('utf-8', { fatal: true }).decode(stdout), stderr: new TextDecoder('utf-8', { fatal: true }).decode(stderr) }); }
        catch { failure('STREAM_ENCODING'); }
      });
      child.stdin.end(input);
    } catch { failure('SPAWN_UNKNOWN'); }
    // host client TERM과 별개로 helper 신원을 다시 관측해 helper TERM을 판단한다.
  });
}
function decode(result: CommandResult): unknown {
  requireValue(!result.error && result.closed && result.code === 0 && result.signal === null && !result.stderr, 'CONTROL_UNKNOWN');
  try { return parseWireJson(result.stdout); } catch { throw new Fault('CONTROL_JSON'); }
}
function ids(result: CommandResult): string[] {
  requireValue(!result.error && result.closed && result.code === 0 && result.signal === null && !result.stderr, 'LIST_UNKNOWN');
  if (!result.stdout.trim()) return [];
  const values = result.stdout.trim().split('\n').map(line => { try { return parseWireJson(line); } catch { throw new Fault('LIST_UNKNOWN'); } });
  requireValue(values.every(fullId) && new Set(values).size === values.length, 'LIST_UNKNOWN'); return values;
}
function volumeValid(value: unknown) {
  return object(value) && value.Name === FIXED.volume && value.Driver === 'local' && value.Scope === 'local'
    && value.CreatedAt === FIXED.volumeCreated && (value.Options === null || keys(value.Options, []))
    && keys(value.Labels, ['anvil.project', 'anvil.owner', 'anvil.instance'])
    && value.Labels['anvil.project'] === 'v3' && value.Labels['anvil.owner'] === 'P03'
    && value.Labels['anvil.instance'] === FIXED.volumeInstance;
}
function exposureValid(value: unknown) {
  return value === undefined || value === null || keys(value, [])
    || keys(value, ['5432/tcp']) && keys((value as Record<string, unknown>)['5432/tcp'], []);
}
function imageValid(value: unknown) {
  return object(value) && value.Id === FIXED.image && object(value.Config)
    && keys(value.Config.Volumes, [FIXED.mount]) && safeEnv(value.Config.Env, true) && exposureValid(value.Config.ExposedPorts);
}
function own(value: unknown, id: string, instance: string, imageExposure: unknown): value is Record<string, any> {
  if (!object(value) || value.Id !== id || value.Name !== `/${FIXED.name}` || value.Image !== FIXED.image
    || !object(value.Config) || !object(value.HostConfig) || !object(value.State)) return false;
  const c = value.Config; const h = value.HostConfig;
  return typeof value.Created === 'string' && Number.isFinite(Date.parse(value.Created))
    && same(c.Labels, labels(instance)) && c.User === '999:999' && same(c.Entrypoint, ['/usr/bin/timeout'])
    && same(c.Cmd, args) && c.OpenStdin === true && c.Tty === false && safeEnv(c.Env, false)
    && h.NetworkMode === 'none' && h.ReadonlyRootfs === true && same(h.CapDrop, ['ALL'])
    && (h.CapAdd === null || same(h.CapAdd, [])) && same(h.SecurityOpt, ['no-new-privileges'])
    && h.Privileged === false && h.PidsLimit === 32 && h.Memory === 134217728 && h.NanoCpus === 200000000
    && (h.PortBindings === null || keys(h.PortBindings, [])) && exposureValid(c.ExposedPorts) && same(c.ExposedPorts ?? null, imageExposure)
    && (!h.Binds || same(h.Binds, [])) && (!h.Tmpfs || keys(h.Tmpfs, []))
    && Array.isArray(h.Mounts) && h.Mounts.length === 1 && h.Mounts[0].Type === 'volume'
    && h.Mounts[0].Source === FIXED.volume && h.Mounts[0].Target === FIXED.mount && h.Mounts[0].ReadOnly === true
    && object(h.Mounts[0].VolumeOptions) && h.Mounts[0].VolumeOptions.NoCopy === true
    && Array.isArray(value.Mounts) && value.Mounts.length === 1 && value.Mounts[0].Type === 'volume'
    && value.Mounts[0].Name === FIXED.volume && value.Mounts[0].Destination === FIXED.mount
    && value.Mounts[0].RW === false && value.Mounts[0].Driver === 'local'
    && object(value.NetworkSettings) && (value.NetworkSettings.Ports === null || keys(value.NetworkSettings.Ports, []))
    && keys(value.NetworkSettings.Networks, ['none']) && typeof value.State.Running === 'boolean'
    && value.State.OOMKilled === false && value.RestartCount === 0;
}
const toolPaths = ['/bin/bash', '/usr/bin/timeout', '/usr/bin/find', '/usr/bin/stat', '/usr/bin/sha256sum', '/usr/bin/id', '/usr/bin/readlink', '/usr/bin/awk', '/usr/lib/postgresql/15/bin/postgres'];
export function parseMetadata(raw: string): unknown {
  requireValue(Buffer.byteLength(raw) <= FIXED.metadataBytes, 'OUTPUT_LIMIT');
  let value: any; try { value = parseWireJson(raw); } catch { throw new Fault('METADATA_INVALID'); }
  requireValue(keys(value, ['status', 'complete', 'tools', 'postgresAccount', 'sourceRoot', 'metadata'])
    && value.status === 'DISCOVERY_METADATA_COMPLETE' && value.complete === true, 'METADATA_INCOMPLETE');
  requireValue(Array.isArray(value.tools) && value.tools.length === toolPaths.length && value.tools.every((tool: any, i: number) => {
    const path = toolPaths[i]; const canonical = path === '/bin/bash' ? ['/bin/bash', '/usr/bin/bash']
      : path === '/usr/bin/awk' ? ['/usr/bin/awk', '/usr/bin/mawk', '/usr/bin/gawk'] : [path];
    return keys(tool, ['path', 'canonical', 'sha256']) && tool.path === path && canonical.includes(tool.canonical) && fullId(tool.sha256);
  }), 'METADATA_INVALID');
  requireValue(keys(value.postgresAccount, ['uid', 'gid']) && integer(value.postgresAccount.uid) && integer(value.postgresAccount.gid)
    && value.postgresAccount.uid <= 9999999999 && value.postgresAccount.gid <= 9999999999, 'METADATA_INVALID');
  requireValue(keys(value.sourceRoot, ['type', 'uid', 'gid', 'mode']) && value.sourceRoot.type === 'directory'
    && integer(value.sourceRoot.uid) && integer(value.sourceRoot.gid) && value.sourceRoot.uid <= 9999999999 && value.sourceRoot.gid <= 9999999999
    && typeof value.sourceRoot.mode === 'string' && /^[0-7]{1,4}$/.test(value.sourceRoot.mode), 'METADATA_INVALID');
  const fields = ['entries', 'uniqueInodes', 'regularEntries', 'directoryEntries', 'symlinkEntries', 'specialEntries', 'regularUniqueInodes', 'regularLogicalBytes', 'regularAllocatedBytes'];
  const m = value.metadata;
  requireValue(keys(m, ['status', 'complete', ...fields]) && m.status === 'METADATA_COMPLETE' && m.complete === true
    && fields.every(k => integer(m[k])) && m.entries <= 100000 && m.uniqueInodes <= m.entries
    && m.regularEntries + m.directoryEntries + m.symlinkEntries + m.specialEntries === m.entries
    && m.regularUniqueInodes <= m.regularEntries && m.regularUniqueInodes <= m.uniqueInodes, 'METADATA_INVALID');
  return value;
}
function grantValid(binding: HostBinding, git: GitBinding, wall: number): Grant {
  const g = binding.grant;
  requireValue(binding.platform === 'linux' && binding.uid === 1000 && binding.safePaths
    && binding.sourceRoot === FIXED.sourceRoot && binding.ledgerRoot === FIXED.ledgerRoot
    && binding.nodePath === FIXED.node && binding.nodeSha256 === FIXED.nodeSha256, 'HOST_BINDING');
  requireValue(!binding.consumed, 'ALREADY_CONSUMED');
  requireValue(keys(g, ['schema', 'scope', 'branch', 'commit', 'controllerSha256', 'shellSha256', 'nodeSha256', 'runInstance', 'issuedAt', 'expiresAt', 'totalMs', 'metadataBytes', 'maxCreates', 'maxStarts', 'numericOwnerRiskAcknowledgement']), 'GRANT_REJECTED');
  const grant = g as unknown as Grant; const issued = Date.parse(grant.issuedAt); const expiry = Date.parse(grant.expiresAt);
  requireValue(grant.schema === 1 && grant.scope === FIXED.scope && grant.branch === FIXED.branch
    && /^[a-f0-9]{40}$/.test(grant.commit) && fullId(grant.controllerSha256) && /^[a-f0-9]{32}$/.test(grant.runInstance)
    && grant.shellSha256 === FIXED.shellSha256 && grant.nodeSha256 === FIXED.nodeSha256
    && grant.totalMs === FIXED.totalMs && grant.metadataBytes === FIXED.metadataBytes && grant.maxCreates === 1 && grant.maxStarts === 1
    && grant.numericOwnerRiskAcknowledgement === numericOwnerRiskAcknowledgement
    && Number.isFinite(issued) && Number.isFinite(expiry) && issued <= wall && wall < expiry
    && expiry > issued && expiry - issued <= FIXED.grantMs, 'GRANT_REJECTED');
  requireValue(git.branch === FIXED.branch && git.commit === grant.commit && git.remote === FIXED.remote && git.clean
    && git.controllerSha256 === grant.controllerSha256 && git.shellSha256 === FIXED.shellSha256
    && hash(git.shell) === FIXED.shellSha256, 'SOURCE_BINDING');
  return grant;
}
export async function runDiscoveryHost(input: { mode?: 'plan' | 'apply' }, ports?: Ports) {
  if (!input.mode || input.mode === 'plan') return proposal();
  requireValue(input.mode === 'apply' && ports, 'MODE_REJECTED');
  const deadline = ports.now() + FIXED.totalMs;
  let phase = 'binding'; let id: string | null = null; let instance: string | null = null; let createdAt: string | null = null;
  let imageExposure: unknown = null;
  let issuedAt = 0; let expiresAt = 0;
  let consumed: boolean | null = false; let consumeAttempted = false; let pendingIO = false;
  let clientTermRequested = false; let clientCloseUnconfirmed = false;
  let failurePhase: string | null = null; let helperExitCode: number | null = null; let helperSignal: string | null = null; let helperCloseObserved: boolean | null = null;
  let createAttempted = false; let startAttempted = false; let termAttempted = false; let removeAttempted = false;
  let helperAbsent: boolean | null = null; let sourcePreflightObserved: boolean | null = null; let sourceObserved: boolean | null = null; let metadata: unknown = null;
  let failure: string | null = null; let receiptFailed = false;
  const step = async <T>(operation: () => Promise<T>, io = false, end = deadline): Promise<T> => {
    requireValue(ports.now() < end, 'DEADLINE');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { if (io) pendingIO = true; reject(new Fault('DEADLINE')); }, Math.max(1, end - ports.now()));
      })]);
      if (ports.now() >= end) { if (io) pendingIO = true; throw new Fault('DEADLINE'); } return result;
    } finally { clearTimeout(timer); }
  };
  const receipt = async () => {
    try { await step(() => ports.fs.receipt({ schema: 1, scope: FIXED.scope, phase, id, instance, consumed, consumeAttempted, pendingIO, createAttempted, startAttempted,
      termAttempted, removeAttempted, helperAbsent, sourcePreflightObserved, sourceObserved, clientTermRequested, clientCloseUnconfirmed,
      helperExitCode, helperSignal, helperCloseObserved, failurePhase, ownerTrustStatus, error: failure, externalUserApprovalVerified: false }, deadline), true); }
    catch { receiptFailed = true; throw new Fault('RECEIPT_UNKNOWN'); }
  };
  const command = async (value: Command, end = deadline) => {
    requireValue(ports.now() < end, 'DEADLINE');
    // adapter가 자체 deadline에 원 child를 닫을 수 있게 여기는 별도 조기 race를 만들지 않는다.
    const result = await ports.docker.command(value, end);
    clientTermRequested ||= result.clientTermRequested === true; clientCloseUnconfirmed ||= result.clientCloseUnconfirmed === true;
    requireValue(ports.now() < end || result.error, 'DEADLINE'); return result;
  };
  const inspect = async () => {
    requireValue(id && instance, 'IDENTITY_UNKNOWN'); const value = decode(await command({ kind: 'inspect', id }));
    requireValue(own(value, id, instance, imageExposure) && Date.parse(value.Created) >= issuedAt && Date.parse(value.Created) < expiresAt
      && Date.parse(value.Created) <= ports.wallNow() && (!createdAt || value.Created === createdAt), 'IDENTITY_UNKNOWN'); return value;
  };
  try {
    const binding = await step(() => ports.fs.binding(deadline), true); const git = await step(() => ports.git.binding(deadline), true);
    const grant = grantValid(binding, git, ports.wallNow()); instance = grant.runInstance;
    issuedAt = Date.parse(grant.issuedAt); expiresAt = Date.parse(grant.expiresAt);
    phase = 'preflight';
    requireValue(decode(await command({ kind: 'daemon' })) === FIXED.daemon, 'DAEMON_MISMATCH');
    requireValue(ids(await command({ kind: 'named' })).length === 0, 'HELPER_EXISTS');
    const image = decode(await command({ kind: 'image' }));
    requireValue(imageValid(image), 'IMAGE_MISMATCH');
    imageExposure = structuredClone((image as Record<string, any>).Config.ExposedPorts ?? null);
    requireValue(volumeValid(decode(await command({ kind: 'volume' }))), 'VOLUME_MISMATCH'); sourcePreflightObserved = true;
    requireValue(ids(await command({ kind: 'consumers' })).length === 0, 'FOREIGN_CONSUMER');
    const fresh = await step(() => ports.fs.binding(deadline), true);
    requireValue(fresh.grantFingerprint === binding.grantFingerprint, 'GRANT_CHANGED');
    grantValid(fresh, git, ports.wallNow());
    requireValue(deadline - ports.now() >= FIXED.startMinimumMs, 'START_BUDGET');
    phase = 'consume'; consumeAttempted = true; consumed = null;
    await step(() => ports.fs.consume({ schema: 1, scope: FIXED.scope, instance, commit: grant.commit,
      controllerSha256: grant.controllerSha256, ownerTrustStatus, numericOwnerRiskAcknowledgement,
      externalUserApprovalVerified: false }, deadline), true); consumed = true; await receipt();
    phase = 'create'; createAttempted = true; await receipt();
    requireValue(deadline - ports.now() >= FIXED.startMinimumMs, 'START_BUDGET');
    const create = await command({ kind: 'create', instance });
    requireValue(!create.error && create.closed && create.code === 0 && create.signal === null && !create.stderr
      && fullId(create.stdout.trim()), 'CREATE_UNKNOWN'); id = create.stdout.trim(); await receipt();
    phase = 'identity'; const value = await inspect(); createdAt = value.Created;
    requireValue(value.State.Status === 'created' && value.State.Running === false, 'STATE_UNKNOWN');
    requireValue(volumeValid(decode(await command({ kind: 'volume' }))), 'VOLUME_MISMATCH');
    requireValue(same(ids(await command({ kind: 'consumers' })), [id]), 'FOREIGN_CONSUMER');
    // grant 소진 후에는 소진부재를 다시 요구하지 않지만 동일 record/기한을 확인한다.
    const beforeStart = await step(() => ports.fs.binding(deadline), true);
    requireValue(beforeStart.grantFingerprint === binding.grantFingerprint, 'GRANT_CHANGED');
    grantValid({ ...beforeStart, consumed: false }, git, ports.wallNow());
    requireValue(deadline - ports.now() >= FIXED.startMinimumMs, 'START_BUDGET');
    phase = 'start'; startAttempted = true; await receipt();
    requireValue(deadline - ports.now() >= FIXED.startMinimumMs, 'START_BUDGET');
    const output = await command({ kind: 'start', id, script: git.shell }, deadline - FIXED.reserveMs);
    helperExitCode = integer(output.code) ? output.code : null; helperSignal = output.signal ? output.signal === 'SIGTERM' ? 'SIGTERM' : 'OTHER' : null;
    helperCloseObserved = output.closed === true;
    requireValue(!output.error, output.error === 'OUTPUT_LIMIT' ? 'OUTPUT_LIMIT' : output.error === 'DEADLINE' ? 'DEADLINE' : 'START_UNKNOWN');
    requireValue(output.closed && output.code === 0 && output.signal === null && !output.stderr, 'START_UNKNOWN');
    metadata = parseMetadata(output.stdout); phase = 'collect'; await receipt();
  } catch (error) {
    failure = codeOf(error); failurePhase = phase;
    if (error instanceof Fault) { clientTermRequested ||= error.clientTermRequested; clientCloseUnconfirmed ||= error.clientCloseUnconfirmed; }
  }
  if (id && instance && ports.now() < deadline) {
    phase = 'cleanup';
    try {
      requireValue(decode(await command({ kind: 'daemon' })) === FIXED.daemon, 'DAEMON_MISMATCH');
      let value = await inspect();
      if (value.State.Running) {
        termAttempted = true; await receipt();
        const term = await command({ kind: 'term', id });
        requireValue(!term.error && term.closed && term.code === 0 && !term.signal && !term.stderr && term.stdout.trim() === id, 'STOP_UNCONFIRMED');
        value = await inspect();
      }
      requireValue(value.State.Running === false && value.State.Status === 'exited'
        && integer(value.State.ExitCode) && typeof value.State.FinishedAt === 'string'
        && Number.isFinite(Date.parse(value.State.FinishedAt)) && Date.parse(value.State.FinishedAt) > 0, 'STOP_UNCONFIRMED');
      // 정상 종료 증거가 없는 created/unknown/foreign은 삭제하지 않는다.
      requireValue(value.State.ExitCode === 0 && value.State.OOMKilled === false, 'EXIT_NOT_NORMAL');
      removeAttempted = true; await receipt();
      const removed = await command({ kind: 'remove', id });
      requireValue(!removed.error && removed.closed && removed.code === 0 && !removed.signal && !removed.stderr && removed.stdout.trim() === id, 'REMOVE_UNKNOWN');
      requireValue(ids(await command({ kind: 'named' })).length === 0, 'ABSENCE_UNKNOWN'); helperAbsent = true;
      requireValue(volumeValid(decode(await command({ kind: 'volume' }))), 'VOLUME_MISMATCH'); sourceObserved = true;
    } catch (error) { if (!failure) { failure = codeOf(error); failurePhase = phase; } }
  }
  if (createAttempted && helperAbsent !== true) failure ??= 'PRESERVE_REQUIRED';
  phase = 'finished';
  if (consumed) { try { await receipt(); } catch { failure = 'RECEIPT_UNKNOWN'; failurePhase ??= phase; } }
  const complete = !failure && !receiptFailed && !!metadata && helperAbsent === true && sourceObserved === true;
  return { status: complete ? 'METADATA_COLLECTED_AND_CLEANED' : 'NOT_COMPLETE', complete,
    externalUserApprovalVerified: false, ownerTrustStatus, phase, failurePhase, error: failure, helperExitCode, helperSignal, helperCloseObserved, consumed, consumeAttempted, pendingIO, clientTermRequested, clientCloseUnconfirmed, createAttempted, startAttempted, termAttempted,
    removeAttempted, helperId: id, helperAbsent, sourcePreflightObserved, sourceVolumeObserved: sourceObserved,
    sourcePreservationRequired: createAttempted || consumed !== false, receiptFailed, metadata: complete ? metadata : null };
}

// 이 factory는 apply CLI 진입에서만 만든다. 기존 provision/Secret 생성 모듈은 import하지 않는다.
export function createSystemPorts(): Ports {
  const now = () => performance.now();
  const ledger = FIXED.ledgerRoot; let receiptIdentity: { dev: number; ino: number } | null = null;
  const rootIdentity = new Map<string, { dev: number; ino: number }>();
  let activeDeadline = 0;
  const check = () => requireValue(now() < activeDeadline, 'DEADLINE');
  const io = async <T>(operation: () => Promise<T>): Promise<T> => { check(); const result = await operation(); check(); return result; };
  const open = async (path: string, flags: number, mode?: number) => {
    check(); const handle = await fs.open(path, flags, mode);
    if (now() >= activeDeadline) { await handle.close(); throw new Fault('DEADLINE'); } return handle;
  };
  const observeNodeParents = async (): Promise<NodeParentFacts[]> => {
    const out: NodeParentFacts[] = [];
    for (const expected of nodeParents) {
      const s = await io(() => fs.lstat(expected.path)); const canonical = await io(() => fs.realpath(expected.path));
      out.push({ path: expected.path, canonical, isDirectory: s.isDirectory(), isSymbolicLink: s.isSymbolicLink(),
        uid: s.uid, gid: s.gid, mode: s.mode & 0o7777, dev: s.dev, ino: s.ino });
    }
    return out;
  };
  const nodeFileFacts = (s: Stats, canonical: string): NodeBinaryFacts => ({
    path: FIXED.node, canonical, isFile: s.isFile(), isSymbolicLink: s.isSymbolicLink(), uid: s.uid, gid: s.gid,
    mode: s.mode & 0o7777, nlink: s.nlink, dev: s.dev, ino: s.ino, size: s.size, mtimeMs: s.mtimeMs,
  });
  async function safePath(path: string, file: boolean, exactMode?: number) {
    const stat = await io(() => fs.lstat(path)); requireValue(!stat.isSymbolicLink() && (file ? stat.isFile() && stat.nlink === 1 : stat.isDirectory()), 'PATH_REJECTED');
    requireValue(await io(() => fs.realpath(path)) === path, 'PATH_REJECTED');
    requireValue(stat.uid === 1000 && (stat.mode & 0o022) === 0 && (exactMode === undefined || (stat.mode & 0o777) === exactMode), 'PATH_REJECTED'); return stat;
  }
  async function fixedRoots() {
    requireValue(process.platform === 'linux' && process.getuid?.() === 1000, 'HOST_BINDING');
    for (const path of [FIXED.sourceRoot, ledger]) {
      const s = await safePath(path, false, path === ledger ? 0o700 : undefined); const initial = rootIdentity.get(path);
      requireValue(!initial || initial.dev === s.dev && initial.ino === s.ino, 'ROOT_CHANGED');
      if (!initial) rootIdentity.set(path, { dev: s.dev, ino: s.ino });
    }
    // Ancestor symlink/쓰기권한도검사한다. 시스템root는uid0,개인root는uid1000만허용한다.
    for (const root of [FIXED.sourceRoot, ledger]) {
      for (let ancestor = dirname(root);; ancestor = dirname(ancestor)) {
        const s = await io(() => fs.lstat(ancestor));
        requireValue(s.isDirectory() && !s.isSymbolicLink() && [0, 1000].includes(s.uid) && (s.mode & 0o022) === 0
          && await io(() => fs.realpath(ancestor)) === ancestor, 'PATH_REJECTED'); if (ancestor === '/') break;
      }
    }
  }
  async function readSafe(path: string, limit: number, mode?: number) {
    await safePath(path, true, mode); const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { const s = await io(() => handle.stat()); requireValue(s.isFile() && s.nlink === 1 && s.uid === 1000 && s.size <= limit
      && (s.mode & 0o022) === 0 && (mode === undefined || (s.mode & 0o777) === mode), 'PATH_REJECTED');
      const bytes = Buffer.alloc(s.size + 1); const read = await io(() => handle.read(bytes, 0, bytes.length, 0));
      const after = await io(() => handle.stat()); requireValue(read.bytesRead === s.size && after.size === s.size
        && after.dev === s.dev && after.ino === s.ino && after.mtimeMs === s.mtimeMs, 'FILE_CHANGED'); return bytes.subarray(0, s.size); }
    finally { await handle.close(); }
  }
  async function absent(path: string) {
    try { await io(() => fs.lstat(path)); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true; throw error instanceof Fault ? error : new Fault('PATH_UNKNOWN'); }
  }
  async function createNew(path: string, record: unknown) {
    await fixedRoots(); const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await io(() => handle.writeFile(JSON.stringify(record) + '\n')); await io(() => handle.sync()); } finally { await handle.close(); }
    const dir = await open(ledger, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await io(() => dir.sync()); } finally { await dir.close(); }
  }
  const docker = createDockerAdapter({ now });
  const git = async (invocation: string[], deadline: number) => {
    check(); const r = await boundedChild(nodeSpawn, '/usr/bin/git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', FIXED.sourceRoot, ...invocation],
      { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' }, now, deadline, FIXED.controlBytes);
    if (r.error || !r.closed || r.code !== 0 || r.signal || r.stderr) throw new Fault('GIT_UNKNOWN', r); check(); return r.stdout;
  };
  return { now, wallNow: () => Date.now(), docker,
    fs: {
      async binding(deadline) {
        activeDeadline = deadline; check();
        await fixedRoots(); const raw = await readSafe(join(ledger, 'grant.json'), 8192, 0o600);
        const grant = parseGrantRecord(raw);
        const parentsBefore = await observeNodeParents();
        const nodeStat = await io(() => fs.lstat(FIXED.node));
        const canonical = await io(() => fs.realpath(FIXED.node));
        requireValue(process.execPath === FIXED.node && nodeStat.isFile() && !nodeStat.isSymbolicLink() && nodeStat.nlink === 1
          && nodeStat.uid === 1001 && nodeStat.gid === 1001 && (nodeStat.mode & 0o7777) === 0o755
          && nodeStat.size <= 268435456 && canonical === FIXED.node, 'NODE_BINDING');
        const nodeHandle = await open(FIXED.node, constants.O_RDONLY | constants.O_NOFOLLOW); const nodeHash = createHash('sha256');
        let initial: Stats; let openedAfter: Stats;
        try {
          initial = await io(() => nodeHandle.stat()); requireValue(initial.dev === nodeStat.dev && initial.ino === nodeStat.ino && initial.nlink === 1, 'NODE_BINDING');
          const bytes = Buffer.alloc(1048576); let count = 0;
          for (;;) { const r = await io(() => nodeHandle.read(bytes)); count += r.bytesRead; requireValue(count <= nodeStat.size, 'NODE_BINDING');
            if (!r.bytesRead) break; nodeHash.update(bytes.subarray(0, r.bytesRead)); check(); }
          openedAfter = await io(() => nodeHandle.stat()); requireValue(count === nodeStat.size && openedAfter.size === nodeStat.size && openedAfter.mtimeMs === nodeStat.mtimeMs, 'NODE_BINDING');
        } finally { await nodeHandle.close(); }
        const after = await io(() => fs.lstat(FIXED.node)); const afterCanonical = await io(() => fs.realpath(FIXED.node));
        const procStat = await io(() => fs.stat('/proc/self/exe')); const procCanonical = await io(() => fs.realpath('/proc/self/exe'));
        const parentsAfter = await observeNodeParents(); const digest = nodeHash.digest('hex');
        assertNodeTrustFacts({ platform: process.platform, executionUid: process.getuid!(), execPath: process.execPath,
          binary: nodeFileFacts(nodeStat, canonical), opened: nodeFileFacts(initial, canonical), openedAfter: nodeFileFacts(openedAfter, canonical),
          after: nodeFileFacts(after, afterCanonical), sha256: digest, parentsBefore, parentsAfter,
          procSelfExe: { canonical: procCanonical, isFile: procStat.isFile(), dev: procStat.dev, ino: procStat.ino, size: procStat.size } });
        return { platform: process.platform, uid: process.getuid!(), safePaths: true, nodePath: process.execPath,
          nodeSha256: digest, sourceRoot: FIXED.sourceRoot, ledgerRoot: ledger,
          grant, consumed: !await absent(join(ledger, 'consumed.json')), grantFingerprint: hash(raw) };
      },
      async consume(record, deadline) {
        activeDeadline = deadline; check();
        requireValue(await absent(join(ledger, 'receipt.jsonl')), 'RECEIPT_EXISTS'); await createNew(join(ledger, 'consumed.json'), record);
      },
      async receipt(record, deadline) {
        activeDeadline = deadline; check();
        await fixedRoots(); const path = join(ledger, 'receipt.jsonl');
        if (!receiptIdentity) {
          await createNew(path, record); const s = await safePath(path, true, 0o600); receiptIdentity = { dev: s.dev, ino: s.ino }; return;
        }
        const s = await safePath(path, true, 0o600); requireValue(s.dev === receiptIdentity.dev && s.ino === receiptIdentity.ino && s.size <= 65536, 'RECEIPT_CHANGED');
        const handle = await open(path, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
        try { const opened = await io(() => handle.stat()); requireValue(opened.dev === s.dev && opened.ino === s.ino && opened.nlink === 1 && opened.uid === 1000 && (opened.mode & 0o777) === 0o600, 'RECEIPT_CHANGED');
          await io(() => handle.writeFile(JSON.stringify(record) + '\n')); await io(() => handle.sync()); } finally { await handle.close(); }
      },
    },
    git: { async binding(deadline) {
      activeDeadline = deadline; check(); await fixedRoots(); await safePath(join(FIXED.sourceRoot, '.git'), false);
      await safePath(join(FIXED.sourceRoot, 'scripts'), false); await safePath(join(FIXED.sourceRoot, 'contracts'), false);
      const branch = (await git(['branch', '--show-current'], deadline)).trim(); const commit = (await git(['rev-parse', 'HEAD'], deadline)).trim();
      requireValue(/^[a-f0-9]{40}$/.test(commit), 'SOURCE_BINDING');
      const remote = (await git(['remote', 'get-url', 'development'], deadline)).trim();
      const clean = !(await git(['status', '--porcelain', '--untracked-files=all'], deadline)).trim();
      const shell = Buffer.from(await git(['show', `${commit}:${FIXED.shellPath}`], deadline));
      const controller = Buffer.from(await git(['show', `${commit}:${FIXED.controllerPath}`], deadline));
      const shellWorking = await readSafe(join(FIXED.sourceRoot, FIXED.shellPath), 65536);
      const controllerWorking = await readSafe(join(FIXED.sourceRoot, FIXED.controllerPath), 131072);
      requireValue(hash(shellWorking) === hash(shell) && hash(controllerWorking) === hash(controller)
        && fileURLToPath(import.meta.url) === join(FIXED.sourceRoot, FIXED.controllerPath), 'SOURCE_BINDING');
      return { branch, commit, remote, clean, shell, shellSha256: hash(shell), controllerSha256: hash(controller) };
    } },
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const mode = parseArguments(process.argv.slice(2));
    const result = await runDiscoveryHost({ mode }, mode === 'apply' ? createSystemPorts() : undefined);
    process.stdout.write(JSON.stringify(result) + '\n'); process.exitCode = result.complete || mode === 'plan' ? 0 : 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 'NOT_COMPLETE', complete: false, error: codeOf(error), ownerTrustStatus, externalUserApprovalVerified: false }) + '\n'); process.exitCode = 1;
  }
}
