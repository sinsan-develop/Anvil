import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createFn15QaPlan, evaluateFn15QaReadiness } from './fn15-isolated-qa.ts';
import type { Fn15QaPlan } from './fn15-isolated-qa.ts';
import { readFn15QaManifest } from './fn15-isolated-qa-manifest.ts';

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
