import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createFn15QaPlan, evaluateFn15QaReadiness } from './fn15-isolated-qa.ts';
import type { Fn15QaPlan } from './fn15-isolated-qa.ts';
import { snapshotFn15QaManifest, readFn15QaManifest } from './fn15-isolated-qa-manifest.ts';

export interface Fn15QaFakeStep {
  readonly ok: boolean;
  readonly code?: string;
  readonly elapsedMinutes?: number;
}

// In-memory test callbacks are deliberately separate from the default launcher.
// No OS, Docker, SQL, network, or process transport is imported or connected here.
export interface Fn15QaFakePort {
  readonly inspect: (plan: Fn15QaPlan) => Promise<Fn15QaFakeStep>;
  readonly prepare: (plan: Fn15QaPlan) => Promise<Fn15QaFakeStep>;
  readonly verify: (plan: Fn15QaPlan) => Promise<Fn15QaFakeStep>;
  readonly cleanup: (plan: Fn15QaPlan) => Promise<Fn15QaFakeStep>;
}

type Phase = 'inspect' | 'prepare' | 'verify' | 'cleanup';
interface HistoryEntry { readonly phase: Phase; readonly code: string; readonly status: 'SYNTHETIC_PASS' | 'FAILED' | 'SKIPPED' }

function safeCode(phase: Phase, value: string | undefined, fallback: string): string {
  if (fallback === 'SYNTHETIC_PASS') return fallback;
  if (value === 'SYNTHETIC_PHASE_THROW') return value;
  if (phase === 'verify' && value === 'SYNTHETIC_VERIFY_FAILED') return value;
  if (phase === 'cleanup' && value === 'SYNTHETIC_CLEANUP_FAILED') return value;
  return fallback;
}

async function fakeStep(phase: Phase, port: Fn15QaFakePort, plan: Fn15QaPlan): Promise<Fn15QaFakeStep> {
  try {
    return await port[phase](plan);
  } catch {
    return { ok: false, code: 'SYNTHETIC_PHASE_THROW' };
  }
}

export async function launchFn15Qa(plan: Fn15QaPlan,
  _input: { readonly argv?: readonly string[]; readonly env?: Readonly<Record<string, string>> } = {}) {
  // --execute, environment variables and even self-declared approval fields have no activation path.
  return {
    status: 'PLAN_ONLY' as const,
    effectPort: 'NOT_CONNECTED' as const,
    executionAuthorized: false as const,
    actualPgVerified: false as const,
    sourceMode: 'NOT_CONNECTED' as const,
    readiness: evaluateFn15QaReadiness(plan),
    cleanup: { status: 'NOT_RUN' as const, residual: 'UNVERIFIED' as const },
    history: [] as readonly HistoryEntry[],
  };
}

export async function runFn15QaFake(plan: Fn15QaPlan, port: Fn15QaFakePort) {
  const history: HistoryEntry[] = [];
  let elapsed = 0;
  let proceed = true;
  for (const phase of ['inspect', 'prepare', 'verify'] as const) {
    if (!proceed) {
      history.push({ phase, code: 'PRIOR_PHASE_FAILED', status: 'SKIPPED' });
      continue;
    }
    const outcome = await fakeStep(phase, port, plan);
    const minutes = outcome.elapsedMinutes ?? 0;
    if (!Number.isFinite(minutes) || minutes < 0) {
      history.push({ phase, code: 'SYNTHETIC_TIME_INVALID', status: 'FAILED' });
      proceed = false;
      continue;
    }
    elapsed += minutes;
    if (elapsed > plan.timeBudgetMinutes.verify) {
      history.push({ phase, code: 'SYNTHETIC_VERIFY_BUDGET_EXCEEDED', status: 'FAILED' });
      proceed = false;
      continue;
    }
    history.push({ phase, code: safeCode(phase, outcome.code, outcome.ok ? 'SYNTHETIC_PASS' : 'SYNTHETIC_PHASE_FAILED'),
      status: outcome.ok ? 'SYNTHETIC_PASS' : 'FAILED' });
    proceed = outcome.ok;
  }
  // Cleanup is finite and attempted once even after inspection, preparation or verification failure.
  const cleanup = await fakeStep('cleanup', port, plan);
  const cleanupMinutes = cleanup.elapsedMinutes ?? 0;
  const cleanupWithinBudget = Number.isFinite(cleanupMinutes) && cleanupMinutes >= 0 &&
    cleanupMinutes <= plan.timeBudgetMinutes.cleanup && elapsed + cleanupMinutes <= plan.timeBudgetMinutes.total;
  const cleanupStatus = cleanup.ok && cleanupWithinBudget ? 'SYNTHETIC_PASS' : 'FAILED';
  history.push({ phase: 'cleanup', status: cleanupStatus,
    code: cleanupWithinBudget ? safeCode('cleanup', cleanup.code, cleanup.ok ? 'SYNTHETIC_PASS' : 'SYNTHETIC_CLEANUP_FAILED')
      : 'SYNTHETIC_CLEANUP_BUDGET_EXCEEDED' });
  return {
    status: 'SYNTHETIC_ONLY' as const,
    effectPort: 'TEST_FAKE' as const,
    executionAuthorized: false as const,
    actualPgVerified: false as const,
    sourceMode: 'TEST_FAKE' as const,
    history,
    cleanup: { status: cleanupStatus, residual: cleanupStatus === 'FAILED' ? 'UNVERIFIED' as const : 'SYNTHETIC_NONE' as const },
  };
}

// Direct CLI use reports a safe plan. It cannot invoke the fake port or an external transport.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = createFn15QaPlan(readFn15QaManifest());
  const result = await launchFn15Qa(plan, { argv: process.argv.slice(2) });
  process.stdout.write(JSON.stringify(result) + '\n');
}

// Source preparation only. Calling this function does not supply an external
// execution decision; the caller must separately bind and authorize the exact
// commit, argv, newly owned resources, protected inputs and cleanup procedure.
export interface Fn15QaPreparedPgInput {
  readonly sourceMode: 'POSTGRES_SOURCE';
  readonly adminPool: import('pg').Pool;
  readonly runtimePool: import('pg').Pool;
  readonly adminRole: string;
  readonly protectedInputs: {
    readonly runtimePassword: string;
    readonly authenticationKey: Uint8Array;
    readonly tokens: readonly [string, string, string];
    readonly csrfTokens: readonly [string, string, string];
  };
}
interface PgMarker { readonly code: string; readonly status: 'PASS' | 'NOT_RUN' }
const PG_NOT_RUN = ['ROW_LOCK_PRIVILEGE_MINIMALITY', 'REAL_LOCK_RACE', 'RESPONSE_LOSS',
  'IMMUTABILITY_AND_PARTIAL_COMMIT', 'REVOCATION_EXPIRY_AND_STALE_GENERATION',
  'REAL_COLLECTORS', 'SOCKET_TLS_BROWSER', 'FORMAL_SCHEMA_AND_LOGIN', 'AGENT_ACCEPT_CONTROL'];
const QA_IDS = {
  installation: 'f1500000-0000-4000-8000-000000000001',
  project: 'f1500000-0000-4000-8000-000000000002',
  actorA: 'f1500000-0000-4000-8000-000000000003',
  actorB: 'f1500000-0000-4000-8000-000000000004',
  clients: ['f1500000-0000-4000-8000-000000000005', 'f1500000-0000-4000-8000-000000000006',
    'f1500000-0000-4000-8000-000000000007'],
  sessions: ['f1500000-0000-4000-8000-000000000008', 'f1500000-0000-4000-8000-000000000009',
    'f1500000-0000-4000-8000-000000000010'],
  requestCommand: 'f1500000-0000-4000-8000-000000000011',
  summaryCommand: 'f1500000-0000-4000-8000-000000000012',
  otherProject: 'f1500000-0000-4000-8000-000000000013',
} as const;

// Pure checks over the exact metadata/protected execution binding. They do not
// query a DB, authorize an execution or certify that a caller ran real SQL.
function fn15QaRow(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length !== 0) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.keys(descriptors).sort().join(',') === [...keys].sort().join(',')
    && Object.values(descriptors).every(item => item.enumerable && 'value' in item);
}
export function checkFn15QaFreshDatabase(value: unknown, adminRole: string): boolean {
  if (!fn15QaRow(value, ['db','role','session_role','version','superuser','namespace_names',
    'extension_names','public_class_count','public_function_count','public_type_count','fixed_roles_count'])) return false;
  const namespaces = value.namespace_names, extensions = value.extension_names;
  return value.db === 'anvil_v3_fn15_source_qa_01' && value.role === adminRole
    && value.session_role === adminRole && value.superuser === true
    && typeof value.version === 'number' && Number.isInteger(value.version)
    && value.version >= 150000 && value.version < 160000
    && Array.isArray(namespaces) && namespaces.length === 4
    && namespaces.every(item => typeof item === 'string')
    && [...namespaces].sort().join(',') === 'information_schema,pg_catalog,pg_toast,public'
    && Array.isArray(extensions) && extensions.length === 1 && extensions[0] === 'plpgsql'
    && value.public_class_count === 0 && value.public_function_count === 0
    && value.public_type_count === 0 && value.fixed_roles_count === 0;
}
export function checkFn15QaDatabaseBinding(value: unknown,
  expected: Readonly<{ nonce: string; instanceId: string; sourceSha: string }>): boolean {
  if (!fn15QaRow(value, ['schemaVersion','nonce','instanceId','sourceSha'])) return false;
  return /^[a-f0-9]{64}$/.test(expected.nonce) && /^[a-f0-9]{40}$/.test(expected.sourceSha)
    && /^[A-Za-z0-9_-]{1,80}$/.test(expected.instanceId) && expected.instanceId !== 'UNVERIFIED'
    && value.schemaVersion === 1 && value.nonce === expected.nonce
    && value.instanceId === expected.instanceId && value.sourceSha === expected.sourceSha;
}

/** Receives dedicated QA pools only; creates no pool/DSN/process/resource.
 * Returns narrow source markers, never whole-FN15 verification or permission.
 * Caller owns pools and resource removal; only acquired clients are released.
 */
export async function runFn15QaPreparedDatabase(plan: Fn15QaPlan,
  input?: Fn15QaPreparedPgInput | { readonly sourceMode: 'TEST_FAKE' }) {
  const markers: PgMarker[] = PG_NOT_RUN.map(code => ({ code, status: 'NOT_RUN' }));
  let sourceMode: 'NOT_CONNECTED' | 'TEST_FAKE' | 'POSTGRES_SOURCE' = 'NOT_CONNECTED';
  const cleanup = { resources: 'CALLER_OWNED_NOT_REMOVED' as const, connections: 'NOT_ACQUIRED', fastify: 'NOT_OPENED' };
  let lastResult: { status: 'NOT_CONNECTED' | 'REFUSED' | 'SOURCE_CHECKED' | 'FAILED'; code: string } | undefined;
  const result = (status: 'NOT_CONNECTED' | 'REFUSED' | 'SOURCE_CHECKED' | 'FAILED', code: string) => {
    const outcome = {
    status, code, sourceMode, executionAuthorized: false as const, actualPgVerified: false as const,
    externalExecutionDecision: 'REQUIRED_SEPARATELY' as const, sourceMarkers: markers,
    cleanup,
    };
    lastResult = outcome;
    return outcome;
  };
  if (!input) return result('NOT_CONNECTED', 'FN15_QA_PG_NOT_CONNECTED');
  if (input.sourceMode === 'TEST_FAKE') {
    sourceMode = 'TEST_FAKE';
    return result('REFUSED', 'FN15_QA_TEST_FAKE_NOT_POSTGRES');
  }
  // Reverify the complete sealed manifest before reading any connection input.
  let manifest: import('./fn15-isolated-qa-manifest.ts').Fn15QaManifest;
  try { manifest = snapshotFn15QaManifest(plan.manifest); }
  catch { return result('REFUSED', 'FN15_QA_MANIFEST_NOT_VERIFIED'); }
  const pg = await import('pg').catch(() => null);
  if (!pg) return result('REFUSED', 'FN15_QA_PG_DEPENDENCY_UNAVAILABLE');
  const { Pool } = pg;
  const finiteTimeout = (value: unknown): boolean => typeof value === 'number'
    && Number.isInteger(value) && value > 0 && value <= 10_000;
  const boundedPool = (pool: import('pg').Pool): boolean => pool instanceof Pool
    && finiteTimeout(pool.options.connectionTimeoutMillis) && finiteTimeout(pool.options.query_timeout)
    && finiteTimeout(pool.options.statement_timeout) && pool.options.max === 1;
  if (!/^[a-f0-9]{40}$/.test(plan.sourceSha) || !/^[A-Za-z0-9_-]{1,80}$/.test(plan.instanceId)
    || plan.instanceId === 'UNVERIFIED' || !/^sha256:[a-f0-9]{64}$/.test(plan.resources.imageId)
    || !/^[a-f0-9]{64}$/.test(plan.resources.containerId) || !/^[a-f0-9]{64}$/.test(plan.resources.networkId)
    || !Number.isFinite(Date.parse(plan.expiresAt)) || Date.parse(plan.expiresAt) <= Date.now()
    || Date.parse(plan.expiresAt) - Date.now() > 30 * 60_000
    || !/^[a-z_][a-z0-9_]{0,62}$/.test(input.adminRole)
    || ['anvil_fn15_qa_owner', 'anvil_fn15_qa_app', 'anvil_v3_app'].includes(input.adminRole)
    || !boundedPool(input.adminPool) || !boundedPool(input.runtimePool)
    || input.adminPool === input.runtimePool) return result('REFUSED', 'FN15_QA_CONNECTION_BASIS_INVALID');
  const secret = input.protectedInputs;
  if (!secret || typeof secret.runtimePassword !== 'string' || secret.runtimePassword.length < 24
    || secret.runtimePassword.length > 128 || /[\u0000-\u001f\u007f]/.test(secret.runtimePassword)
    || !(secret.authenticationKey instanceof Uint8Array) || secret.authenticationKey.length !== 32
    || !Array.isArray(secret.tokens) || !Array.isArray(secret.csrfTokens)
    || secret.tokens.length !== 3 || secret.csrfTokens.length !== 3
    || [...secret.tokens, ...secret.csrfTokens].some(value => typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
    || new Set([...secret.tokens, ...secret.csrfTokens]).size !== 6)
    return result('REFUSED', 'FN15_QA_PROTECTED_INPUT_INVALID');
  // Copy protected inputs; never include them or exception text in results/logs.
  const tokens = [...secret.tokens], csrf = [...secret.csrfTokens];
  const key = Buffer.from(secret.authenticationKey);
  const password = secret.runtimePassword;
  const started = Date.now();
  const sourceSha = plan.sourceSha, instanceId = plan.instanceId, expiresAt = plan.expiresAt;
  const deadline = Math.min(started + 25 * 60_000, Date.parse(expiresAt) - 5 * 60_000);
  const requireCheck = (condition: boolean): void => { if (!condition || Date.now() >= deadline) throw Error('FN15_QA_CHECK_FAILED'); };
  const mark = (code: string): void => { requireCheck(true); markers.push({ code, status: 'PASS' }); };
  let admin: import('pg').PoolClient | undefined;
  let transaction = false;
  let app: ReturnType<typeof import('../apps/server/app.ts').buildApp> | undefined;
  let phase = 'FN15_QA_PREFLIGHT_FAILED';
  sourceMode = 'POSTGRES_SOURCE';
  try {
    admin = await input.adminPool.connect(); cleanup.connections = 'ACQUIRED';
    // These are SELECTs only. Wrong DB, role, PG major, reused namespace or role
    // is refused before BEGIN, timeout setting, bootstrap, role or seed writes.
    const basis = (await admin.query<Record<string, unknown>>(`SELECT current_database() AS db,
      current_user AS role, session_user AS session_role, current_setting('server_version_num')::int AS version,
      (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser,
      ARRAY(SELECT nspname::text FROM pg_namespace ORDER BY nspname) AS namespace_names,
      ARRAY(SELECT extname::text FROM pg_extension ORDER BY extname) AS extension_names,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public') AS public_class_count,
      (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public') AS public_function_count,
      (SELECT count(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public') AS public_type_count,
      (SELECT count(*)::int FROM pg_roles WHERE rolname IN
        ('anvil_fn15_qa_owner','anvil_fn15_qa_app','anvil_v3_app')) AS fixed_roles_count`)).rows[0];
    if (!checkFn15QaFreshDatabase(basis, input.adminRole))
      return result('REFUSED', 'FN15_QA_DATABASE_NOT_FRESH');
    requireCheck(true);
    phase = 'FN15_QA_PREPARATION_FAILED';
    await admin.query('BEGIN'); transaction = true;
    await admin.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='2s'; SET LOCAL idle_in_transaction_session_timeout='15s'");
    await admin.query(`CREATE ROLE anvil_fn15_qa_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      CREATE ROLE anvil_fn15_qa_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      CREATE ROLE anvil_v3_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      CREATE SCHEMA anvil AUTHORIZATION anvil_fn15_qa_owner;
      CREATE SCHEMA anvil_qa AUTHORIZATION anvil_fn15_qa_owner;
      REVOKE ALL ON SCHEMA anvil,anvil_qa FROM PUBLIC`);
    await admin.query("SELECT set_config('anvil_qa.runtime_password',$1,true)", [password]);
    await admin.query(`DO $$ BEGIN EXECUTE format('ALTER ROLE anvil_fn15_qa_app PASSWORD %L',
      current_setting('anvil_qa.runtime_password')); END $$`);
    await admin.query('SET LOCAL ROLE anvil_fn15_qa_owner');
    for (const index of [0, 1] as const) {
      const full = manifest.fullSql[index]; requireCheck(!!full);
      await admin.query(full!.sql);
    }
    await admin.query(manifest.helpers.sql);
    const pending = manifest.fullSql[2]; requireCheck(!!pending); await admin.query(pending!.sql);
    for (const ledger of manifest.ledger) await admin.query(
      'INSERT INTO anvil.schema_migrations(id,checksum) VALUES($1,$2)', [ledger.id, ledger.checksum]);
    await admin.query(`GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_fn15_qa_app;
      GRANT SELECT ON anvil.schema_migrations,anvil.users,anvil.clients,anvil.auth_sessions,
        anvil.projects,anvil.project_members,anvil.project_control TO anvil_fn15_qa_app;
      GRANT SELECT,INSERT,UPDATE ON anvil.control_handoff_source_requests,anvil.control_handoff_source_summaries,
        anvil.control_handoff_source_commands,anvil.control_handoff_source_receipts,anvil.control_handoff_source_audits TO anvil_fn15_qa_app;
      GRANT UPDATE ON anvil.users,anvil.clients,anvil.auth_sessions,anvil.projects,anvil.project_members,anvil.project_control TO anvil_fn15_qa_app;
      REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA anvil FROM PUBLIC;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA anvil TO anvil_fn15_qa_app`);
    const { createHash, randomBytes } = await import('node:crypto');
    // Per-invocation nonce stays inside the ephemeral QA DB and this closure.
    // Public plan fields alone cannot distinguish another same-name database.
    const binding = { schemaVersion: 1, nonce: randomBytes(32).toString('hex'), instanceId, sourceSha };
    await admin.query('INSERT INTO anvil_qa.fixtures(name,payload) VALUES($1,$2::jsonb)',
      ['fn15-prepared-source-binding', JSON.stringify(binding)]);
    await admin.query('GRANT SELECT ON anvil_qa.fixtures TO anvil_fn15_qa_app');
    const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
    await admin.query(`INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status,server_owner)
      VALUES($1,'fn15qa-a','fn15qa-a','검증 A','ACTIVE',false),($2,'fn15qa-b','fn15qa-b','검증 B','ACTIVE',false)`, [QA_IDS.actorA, QA_IDS.actorB]);
    for (let i = 0; i < 3; i++) await admin.query(
      'INSERT INTO anvil.clients(id,user_id,label) VALUES($1,$2,$3)',
      [QA_IDS.clients[i], i === 2 ? QA_IDS.actorB : QA_IDS.actorA, ['A1','A2','B1'][i]]);
    await admin.query(`INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'FN15 QA','소스 검증','한정 증거');
      `, [QA_IDS.project]);
    await admin.query(`INSERT INTO anvil.project_members(project_id,user_id,participation)
      VALUES($1,$2,'OWNER'),($1,$3,'HANDOFF_ELIGIBLE')`, [QA_IDS.project, QA_IDS.actorA, QA_IDS.actorB]);
    await admin.query(`INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation,version)
      VALUES($1,$2,$3,1,1)`, [QA_IDS.project, QA_IDS.actorA, QA_IDS.clients[0]]);
    for (let i = 0; i < 3; i++) await admin.query(`INSERT INTO anvil.auth_sessions
      (id,token_digest,user_id,client_id,credential_generation,csrf_digest,idle_expires_at,absolute_expires_at,reauth_until)
      VALUES($1,$2,$3,$4,1,$5,clock_timestamp()+interval '25 minutes',clock_timestamp()+interval '25 minutes',clock_timestamp()+interval '25 minutes')`,
      [QA_IDS.sessions[i], digest(tokens[i]!), i === 2 ? QA_IDS.actorB : QA_IDS.actorA, QA_IDS.clients[i], digest(csrf[i]!)]);
    await admin.query('COMMIT'); transaction = false;
    mark('SEALED_MINIMAL_SCHEMA_SEED_COMMITTED');
    phase = 'FN15_QA_RUNTIME_BASIS_FAILED';
    const runtime = await input.runtimePool.connect();
    try {
      const basis = (await runtime.query<Record<string, unknown>>(`SELECT current_database() AS db,current_user AS role,
        session_user AS session_role,(SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls
          FROM pg_roles WHERE rolname=current_user) AS elevated,
        EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS member`)).rows[0];
      requireCheck(basis?.db === 'anvil_v3_fn15_source_qa_01' && basis.role === 'anvil_fn15_qa_app'
        && basis.session_role === 'anvil_fn15_qa_app' && basis.elevated === false && basis.member === false);
      // Check the admin-written execution binding before buildApp/source or POST.
      const bound = (await runtime.query<Record<string, unknown>>(
        'SELECT payload FROM anvil_qa.fixtures WHERE name=$1', ['fn15-prepared-source-binding'])).rows;
      requireCheck(bound.length === 1 && checkFn15QaDatabaseBinding(bound[0]?.payload, binding));
    } finally { runtime.release(); }
    const { buildApp } = await import('../apps/server/app.ts');
    const { AccessRepository } = await import('../apps/server/modules/access/repository.ts');
    const { createControlHandoffPgSource } = await import('../apps/server/modules/control-handoff/control-handoff-pg.ts');
    const { canonicalJson, contentHash } = await import('../contracts/canonical.ts');
    const repository = new AccessRepository(input.runtimePool, { installationId: QA_IDS.installation, key });
    const source = createControlHandoffPgSource({ pool: input.runtimePool, access: repository, enabled: true });
    const origin = 'https://fn15-qa.invalid';
    app = buildApp({}, undefined, undefined, undefined, { source, origin, enabled: true }); cleanup.fastify = 'OPENED';
    await app.ready();
    phase = 'FN15_QA_SOURCE_FLOW_FAILED';
    const headers = (client: number) => ({ host: 'fn15-qa.invalid', origin,
      cookie: `__Host-anvil.sid=${tokens[client]}`, 'x-anvil-csrf': csrf[client]!, 'content-type': 'application/json' });
    const request = async (method: 'GET' | 'POST', url: string, client: number, payload?: object,
      status = 200): Promise<Record<string, unknown>> => {
      requireCheck(true);
      const response = await app!.inject({ method, url, headers: headers(client), ...(payload ? { payload } : {}) });
      requireCheck(response.statusCode === status);
      const value: unknown = JSON.parse(response.body);
      requireCheck(value !== null && typeof value === 'object' && !Array.isArray(value));
      return value as Record<string, unknown>;
    };
    const base = `/api/v1/projects/${QA_IDS.project}`;
    await request('GET', `${base}/control-state`, 1); mark('CONTROL_STATE_REAL_ACCESS');
    const wire = { schemaVersion: 1, operation: 'requestControl', commandId: QA_IDS.requestCommand,
      projectId: QA_IDS.project, clientId: QA_IDS.clients[1], payload: {
        targetActorRef: { userId: QA_IDS.actorA }, targetClientRef: { userId: QA_IDS.actorA, clientId: QA_IDS.clients[1] },
        baseControl: { actorId: QA_IDS.actorA, clientId: QA_IDS.clients[0], generation: 1, version: 1 },
        reason: '검증 인수 요청', expiresAt: new Date(Date.now()+10*60_000).toISOString() } };
    const created = await request('POST', `${base}/control-requests`, 1, wire, 201);
    const ref = created.requestRef;
    requireCheck(ref !== null && typeof ref === 'object' && !Array.isArray(ref));
    const requestRef = ref as Record<string, unknown>;
    requireCheck(typeof requestRef.id === 'string' && requestRef.version === 1
      && typeof requestRef.contentHash === 'string' && /^[a-f0-9]{64}$/.test(requestRef.contentHash));
    const fixed = `${base}/control-requests/${requestRef.id}/versions/1`;
    const listed = await request('GET', `${base}/control-requests?view=OWN`, 1);
    requireCheck(Array.isArray(listed.items) && listed.items.length === 1);
    const fixedRequest = await request('GET', `${fixed}?contentHash=${requestRef.contentHash}`, 1);
    requireCheck(canonicalJson(fixedRequest.snapshot) === canonicalJson(created.snapshot));
    mark('SELF_REQUEST_OWN_LIST_FIXED_READ');
    const replay = await request('POST', `${base}/control-requests`, 1, wire, 201);
    requireCheck(canonicalJson(replay.requestRef) === canonicalJson(created.requestRef));
    mark('SAME_COMMAND_REPLAY');
    const summary = await request('POST', `${fixed}/handoff-summaries`, 0, {
      schemaVersion: 1, operation: 'prepareControlHandoff', commandId: QA_IDS.summaryCommand,
      projectId: QA_IDS.project, clientId: QA_IDS.clients[0], payload: { requestRef } }, 201);
    const summaryRef = summary.summaryRef as Record<string, unknown>;
    const body = summary.body as Record<string, unknown>;
    requireCheck(!!summaryRef && !!body && body.safetyState === 'UNVERIFIED'
      && body.realCollectorsConnected === false && body.acceptanceEnabled === false
      && body.executionAuthorized === false && body.controlTransferred === false);
    const head = await request('GET', `${fixed}/handoff-summaries/head?requestHash=${requestRef.contentHash}`, 1);
    const pointer = head.head as Record<string, unknown>;
    requireCheck(pointer?.state === 'AVAILABLE' && canonicalJson(pointer.summaryRef) === canonicalJson(summaryRef));
    const fixedSummary = await request('GET', `${fixed}/handoff-summaries/${summaryRef.version}?requestHash=${requestRef.contentHash}&summaryHash=${summaryRef.contentHash}`, 1);
    requireCheck(canonicalJson(fixedSummary.body) === canonicalJson(body));
    mark('CONTROLLER_UNVERIFIED_SUMMARY_HEAD_FIXED_READ');
    const denied = await request('GET', `${fixed}?contentHash=${requestRef.contentHash}`, 2, undefined, 403);
    requireCheck(denied.code === 'ACCESS_DENIED');
    const projectDenied = await request('GET', `/api/v1/projects/${QA_IDS.otherProject}/control-state`, 1, undefined, 403);
    requireCheck(projectDenied.code === 'ACCESS_DENIED');
    mark('OTHER_ACTOR_AND_PROJECT_DENIED');
    const stored = (await admin.query<Record<string, unknown>>(`SELECT content_hash,snapshot_json,
      anvil.execution_json_hash(snapshot_json) AS pg_hash FROM anvil.control_handoff_source_requests
      WHERE project_id=$1 AND id=$2`, [QA_IDS.project, requestRef.id])).rows;
    requireCheck(stored.length === 1 && stored[0]?.content_hash === requestRef.contentHash
      && stored[0]?.pg_hash === requestRef.contentHash
      && contentHash(canonicalJson(stored[0]?.snapshot_json)) === requestRef.contentHash
      && canonicalJson(stored[0]?.snapshot_json) === canonicalJson(created.snapshot));
    const counts = (await admin.query<Record<string, unknown>>(`SELECT
      (SELECT count(*)::int FROM anvil.control_handoff_source_requests) AS requests,
      (SELECT count(*)::int FROM anvil.control_handoff_source_summaries) AS summaries,
      (SELECT count(*)::int FROM anvil.control_handoff_source_commands) AS commands,
      (SELECT count(*)::int FROM anvil.control_handoff_source_receipts) AS receipts,
      (SELECT count(*)::int FROM anvil.control_handoff_source_audits) AS audits`)).rows[0];
    requireCheck(counts?.requests === 1 && counts.summaries === 1 && counts.commands === 2
      && counts.receipts === 2 && counts.audits === 2);
    mark('REQUEST_STORAGE_HASH_CANONICAL_AND_BUNDLE_COUNTS');
    return result('SOURCE_CHECKED', 'FN15_QA_BOUNDED_SOURCE_MARKERS_ONLY');
  } catch { return result('FAILED', phase); }
  finally {
    if (app) {
      try { await app.close(); cleanup.fastify = 'CLOSED'; }
      catch { cleanup.fastify = 'CLOSE_FAILED'; markers.push({ code: 'FASTIFY_CLOSE_FAILED', status: 'NOT_RUN' }); }
    }
    if (admin) {
      if (transaction) await admin.query('ROLLBACK').catch(() => { markers.push({ code: 'ROLLBACK_FAILED', status: 'NOT_RUN' }); });
      try { admin.release(transaction ? Error('FN15_QA_DISCARD_CONNECTION') : undefined); cleanup.connections = 'RETURNED'; }
      catch { cleanup.connections = 'RELEASE_FAILED'; markers.push({ code: 'CONNECTION_RELEASE_FAILED', status: 'NOT_RUN' }); }
    }
    if (lastResult && (cleanup.fastify === 'CLOSE_FAILED' || cleanup.connections === 'RELEASE_FAILED'
      || markers.some(marker => marker.code === 'ROLLBACK_FAILED'))) {
      lastResult.status = 'FAILED'; lastResult.code = 'FN15_QA_CONNECTION_CLEANUP_FAILED';
    }
    key.fill(0);
  }
}
