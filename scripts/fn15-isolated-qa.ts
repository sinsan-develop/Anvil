import type { Fn15QaManifest } from './fn15-isolated-qa-manifest.ts';

const ROOT = '/home/daon/deploy/anvil-v3-fn15-source-qa-01';
const CONTAINER = 'anvil-v3-fn15-source-qa-pg-01';
const NETWORK = 'anvil-v3-fn15-source-qa-net-01';
const OWNER_LABEL = 'AV3_FN15_SOURCE_QA';
const TMPFS = 'tmpfs:/var/lib/postgresql/data:512MiB';
const ID = /^[a-f0-9]{64}$/;
const IMAGE_ID = /^sha256:[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const EXPIRES = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface Fn15QaBinding {
  readonly sourceSha?: string;
  readonly instanceId?: string;
  readonly expiresAt?: string;
  readonly imageId?: string;
  readonly containerId?: string;
  readonly networkId?: string;
}

export interface Fn15QaPlan {
  readonly status: 'UNVERIFIED';
  readonly effectPort: 'NOT_CONNECTED';
  readonly executionAuthorized: false;
  readonly sourceSha: string;
  readonly instanceId: string;
  readonly expiresAt: string;
  readonly manifest: Fn15QaManifest;
  readonly resources: {
    readonly wslRoot: typeof ROOT;
    readonly container: typeof CONTAINER;
    readonly network: typeof NETWORK;
    readonly database: 'anvil_v3_fn15_source_qa_01';
    readonly ownerRole: 'anvil_fn15_qa_owner';
    readonly runtimeRole: 'anvil_fn15_qa_app';
    readonly ownerLabel: typeof OWNER_LABEL;
    readonly tmpfsMiB: 512;
    readonly hostPortPublished: false;
    readonly imagePull: false;
    readonly imageId: string;
    readonly containerId: string;
    readonly networkId: string;
  };
  readonly timeBudgetMinutes: { readonly total: 30; readonly verify: 25; readonly cleanup: 5 };
  readonly preparation: readonly string[];
  readonly verification: readonly string[];
  readonly rolePlan: {
    readonly owner: 'NOLOGIN';
    readonly runtime: 'LOGIN';
    readonly schemaUsage: readonly ['anvil', 'anvil_qa'];
    readonly select: readonly string[];
    readonly insert: readonly string[];
    readonly updateForRowLocksCandidate: readonly string[];
    readonly delete: false;
    readonly publicGrant: false;
    readonly unresolvedSourceRole: 'anvil_v3_app';
  };
  readonly seedPlan: {
    readonly projects: 1;
    readonly users: 2;
    readonly clients: 3;
    readonly sessions: 3;
    readonly controlGeneration: 1;
    readonly controlVersion: 1;
    readonly protectedInputsRequired: readonly ['QA_DB_PASSWORD', 'THREE_TOKEN_DIGESTS', 'THREE_CSRF_DIGESTS'];
  };
  readonly excluded: readonly string[];
}

const sourceTables = ['anvil.schema_migrations', 'anvil.users', 'anvil.clients', 'anvil.auth_sessions',
  'anvil.projects', 'anvil.project_members', 'anvil.project_control'] as const;
const fn15Tables = ['anvil.control_handoff_source_requests', 'anvil.control_handoff_source_summaries',
  'anvil.control_handoff_source_commands', 'anvil.control_handoff_source_receipts',
  'anvil.control_handoff_source_audits'] as const;

export function createFn15QaPlan(manifest: Fn15QaManifest, binding: Fn15QaBinding = {}): Fn15QaPlan {
  if (manifest.helpers.status !== 'PARTIAL_HELPERS_ONLY' || manifest.helpers.byteLength !== 4250 ||
      manifest.helpers.blocks.length !== 7 || manifest.ledger.length !== 3) {
    throw new Error('FN15_QA_MANIFEST_NOT_VERIFIED');
  }
  return {
    status: 'UNVERIFIED', effectPort: 'NOT_CONNECTED', executionAuthorized: false,
    sourceSha: binding.sourceSha ?? 'UNVERIFIED', instanceId: binding.instanceId ?? 'UNVERIFIED',
    expiresAt: binding.expiresAt ?? 'UNVERIFIED', manifest,
    resources: {
      wslRoot: ROOT, container: CONTAINER, network: NETWORK, database: 'anvil_v3_fn15_source_qa_01',
      ownerRole: 'anvil_fn15_qa_owner', runtimeRole: 'anvil_fn15_qa_app', ownerLabel: OWNER_LABEL,
      tmpfsMiB: 512, hostPortPublished: false, imagePull: false,
      imageId: binding.imageId ?? 'UNVERIFIED', containerId: binding.containerId ?? 'UNVERIFIED',
      networkId: binding.networkId ?? 'UNVERIFIED',
    },
    timeBudgetMinutes: { total: 30, verify: 25, cleanup: 5 },
    preparation: [
      'READ_ONLY_PREFLIGHT: root/name absence, realpath, daon owner, mount/link, final exact Git SHA, clean tree',
      'READ_ONLY_PREFLIGHT: existing local PG15 full image ID/RepoDigest, daemon ID, Node24 version/realpath, lockfile and deps realpath/owner',
      'ISOLATED_RESOURCE_PROPOSAL: one internal network, one PG15 tmpfs container, no host port, no volume, no image pull',
      'ISOLATED_DB_PROPOSAL: create anvil/anvil_qa schemas, NOLOGIN owner and LOGIN runtime role only after source role dependency resolution',
      'SQL_ORDER: exact full 0000, exact full 0001, seven exact helper blocks, exact full 0041',
      'LEDGER: full 0000/0001/0041 only; helper provenance PARTIAL_HELPERS_ONLY in separate QA manifest',
      'GRANT_PROPOSAL: schema USAGE, source/ledger/five tables SELECT, five tables INSERT, minimal row-lock UPDATE candidate; no DELETE/PUBLIC',
      'SEED_PROPOSAL: project1, users2 (A OWNER/B HANDOFF_ELIGIBLE), A clients2/B client1, sessions3, A1 control generation/version1',
    ],
    verification: [
      'IN_PROCESS_FASTIFY_INJECT_AND_NONADMIN_PG: request, self/current controller reads and list, unknown summary, original re-read',
      'CANONICAL_AND_STORAGE: source ref/hash, TS/PG canonical, Unicode/nonblank, metadata, four bundles, FK/immutable/orphan/partial commit',
      'GUARDS_AND_CONCURRENCY: replay, same command, real lock race, revocation, expiry, older generation, cross-project/actor, cursor',
      'PRIVILEGE_PROBE: row lock without UPDATE then minimal UPDATE; separate privilege failures from FK/trigger/immutable failures',
      'COMMIT_UNKNOWN: distinguish injected response loss from uncertain connection; explicit same-command reconcile, no automatic retry',
    ],
    rolePlan: {
      owner: 'NOLOGIN', runtime: 'LOGIN', schemaUsage: ['anvil', 'anvil_qa'],
      select: [...sourceTables, ...fn15Tables], insert: [...fn15Tables],
      updateForRowLocksCandidate: ['anvil.users', 'anvil.clients', 'anvil.auth_sessions',
        'anvil.projects', 'anvil.project_members', 'anvil.project_control', ...fn15Tables],
      delete: false, publicGrant: false, unresolvedSourceRole: 'anvil_v3_app',
    },
    seedPlan: {
      projects: 1, users: 2, clients: 3, sessions: 3, controlGeneration: 1, controlVersion: 1,
      protectedInputsRequired: ['QA_DB_PASSWORD', 'THREE_TOKEN_DIGESTS', 'THREE_CSRF_DIGESTS'],
    },
    excluded: ['existing production or development DB', 'full 0017/0025 or all 68 migrations',
      'socket HTTP/TLS/browser/UI', 'real login/reauth and Agent/control acceptance or transfer',
      'OS helper, service, Oracle, scheduler, registry'],
  };
}

export interface Fn15QaObservation {
  readonly approval?: boolean; // untrusted self declaration; deliberately ignored
  readonly imageId?: string; // untrusted CLI/ENV field; deliberately ignored
  readonly sourceSha?: string;
  readonly root?: { readonly absent: boolean; readonly realpath: string; readonly owner: string; readonly link: boolean; readonly mount: boolean };
  readonly containerAbsent?: boolean;
  readonly networkAbsent?: boolean;
  readonly image?: { readonly fullId: string; readonly repoDigest: string; readonly pgMajor: 15 };
  readonly daemonId?: string;
  readonly node?: { readonly version: string; readonly realpath: string };
  readonly deps?: { readonly lockfileSha: string; readonly realpath: string; readonly owner: string; readonly readOnlyLink: true };
  readonly cleanCheckout?: boolean;
}

export function evaluateFn15QaReadiness(plan: Fn15QaPlan, observed: Fn15QaObservation = {}) {
  const refusals: string[] = [];
  if (!COMMIT.test(plan.sourceSha) || observed.sourceSha !== plan.sourceSha || observed.cleanCheckout !== true) {
    refusals.push('FINAL_EXACT_COMMIT_UNVERIFIED');
  }
  const root = observed.root;
  if (!root || root.absent !== true || root.realpath !== ROOT || root.owner !== 'daon' || root.link !== false || root.mount !== false) {
    refusals.push('WSL_ROOT_ABSENCE_REALPATH_OWNER_UNVERIFIED');
  }
  if (observed.containerAbsent !== true || observed.networkAbsent !== true) refusals.push('RESOURCE_ABSENCE_UNVERIFIED');
  if (!IMAGE_ID.test(plan.resources.imageId) || observed.image?.fullId !== plan.resources.imageId ||
      !/^.+@sha256:[a-f0-9]{64}$/.test(observed.image.repoDigest) ||
      observed.image.pgMajor !== 15 || !observed.daemonId) {
    refusals.push('PG15_IMAGE_DAEMON_UNVERIFIED');
  }
  if (!observed.node?.version.startsWith('v24.') || !observed.node.realpath.startsWith('/') ||
      !observed.deps?.readOnlyLink || !observed.deps.realpath.startsWith('/') || !observed.deps.owner ||
      !/^[a-f0-9]{64}$/i.test(observed.deps.lockfileSha)) {
    refusals.push('NODE_DEPS_LOCKFILE_UNVERIFIED');
  }
  refusals.push('SOURCE_ROLE_ANVIL_V3_APP_DEPENDENCY_UNRESOLVED');
  refusals.push('EXTERNAL_EFFECT_PORT_NOT_CONNECTED');
  refusals.push('SEPARATE_EXECUTION_DECISION_NOT_PRESENT');
  return { state: 'UNVERIFIED' as const, executionAuthorized: false as const, actualPgVerified: false as const, refusals };
}

export interface Fn15QaCleanupObservation {
  readonly path?: { readonly realpath: string; readonly owner: string; readonly link: boolean; readonly mount: boolean;
    readonly ownerLabel: string; readonly instanceId: string; readonly sourceSha: string;
    readonly exists?: boolean; readonly onlyOwnedEntries?: boolean;
    readonly depsOriginalUntouched?: boolean; readonly activeProcessIds?: readonly string[] };
  readonly containerAbsent?: boolean;
  readonly networkAbsent?: boolean;
  readonly container?: { readonly name: string; readonly fullId?: string; readonly imageId: string; readonly ownerLabel: string;
    readonly instanceId: string; readonly sourceSha: string; readonly expiresAt: string;
    readonly mounts: readonly string[]; readonly networks: readonly string[];
    readonly hostPorts?: readonly string[]; readonly volumes?: readonly string[] };
  readonly network?: { readonly name: string; readonly fullId?: string; readonly ownerLabel: string; readonly instanceId: string;
    readonly sourceSha: string; readonly expiresAt: string; readonly containers: readonly string[]; readonly internal?: boolean };
}

export function eligibleFn15QaCleanup(plan: Fn15QaPlan, observed: Fn15QaCleanupObservation) {
  const candidates: { kind: 'container' | 'network' | 'path'; identity: string; executionAuthorized: false; status: 'REQUIRES_INDEPENDENT_OBSERVATION' }[] = [];
  const container = observed.container;
  const network = observed.network;
  const path = observed.path;
  const pinned = COMMIT.test(plan.sourceSha) && plan.instanceId !== 'UNVERIFIED' &&
    EXPIRES.test(plan.expiresAt) && !Number.isNaN(Date.parse(plan.expiresAt));
  const containerMatch = pinned && IMAGE_ID.test(plan.resources.imageId) && ID.test(plan.resources.containerId) &&
    !!container && container.name === CONTAINER &&
    container.fullId === plan.resources.containerId && container.imageId === plan.resources.imageId &&
    container.ownerLabel === OWNER_LABEL && container.instanceId === plan.instanceId &&
    container.sourceSha === plan.sourceSha && container.expiresAt === plan.expiresAt &&
    container.mounts.length === 1 && container.mounts[0] === TMPFS &&
    container.networks.length === 1 && container.networks[0] === NETWORK &&
    container.hostPorts?.length === 0 && container.volumes?.length === 0;
  const networkMatch = pinned && ID.test(plan.resources.networkId) && observed.containerAbsent === true &&
    !!network && network.name === NETWORK &&
    network.fullId === plan.resources.networkId && network.ownerLabel === OWNER_LABEL &&
    network.instanceId === plan.instanceId && network.sourceSha === plan.sourceSha &&
    network.expiresAt === plan.expiresAt && network.internal === true &&
    network.containers.length === 0;
  const pathMatch = pinned && observed.containerAbsent === true && observed.networkAbsent === true &&
    !!path && path.realpath === ROOT && path.owner === 'daon' && path.ownerLabel === OWNER_LABEL &&
    path.link === false && path.mount === false && path.exists === true && path.instanceId === plan.instanceId &&
    path.sourceSha === plan.sourceSha &&
    path.onlyOwnedEntries === true && path.depsOriginalUntouched === true && path.activeProcessIds?.length === 0;
  if (containerMatch) candidates.push({ kind: 'container', identity: plan.resources.containerId,
    executionAuthorized: false, status: 'REQUIRES_INDEPENDENT_OBSERVATION' });
  if (networkMatch) candidates.push({ kind: 'network', identity: plan.resources.networkId,
    executionAuthorized: false, status: 'REQUIRES_INDEPENDENT_OBSERVATION' });
  if (pathMatch) candidates.push({ kind: 'path', identity: ROOT,
    executionAuthorized: false, status: 'REQUIRES_INDEPENDENT_OBSERVATION' });
  return candidates;
}
