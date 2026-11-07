import { AuthFailure } from '../access/repository.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { inspectArtifact } from '../../storage/sensitive-inspection.ts';
import { canonicalJson } from '../../../../contracts/canonical.ts';

export const candidateOperations = ['registerConnection', 'saveEnvironment'] as const;
export const capabilityCodes = ['INSTRUCTION_SESSION', 'STATE_ORIGINAL', 'RESULT_EVIDENCE', 'TOOL_APPROVAL', 'STOP_RECLAIM', 'PATH_WRITE_CONTROL'] as const;
export type CandidateKind = 'CONNECTION_CANDIDATE' | 'ENVIRONMENT_CANDIDATE';
export interface CandidateInput {
  kind: CandidateKind;
  candidate: Record<string, unknown> & { label: string };
  candidateRef: VersionRef | null;
  policyRef: VersionRef;
  expiresAt: string;
  reason: string;
}
export interface CandidateInputContext { now: Date; policyExpiresAt: Date }
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && v.isWellFormed() && v.length <= max && (empty || !!v.trim()) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const references = (v: unknown) => Array.isArray(v) && v.length <= 200 && v.every(isVersionRef) && new Set(v.map(r => r.id)).size === v.length;
const connectionKeys = ['label', 'toolProduct', 'toolVersion', 'adapterKind', 'connectorRef', 'environmentRef', 'documentation'];
const environmentKeys = ['label', 'executionHostRef', 'sourceRootRefs', 'targetHostRefs', 'commandProfileRefs', 'secretRefs'];
export function readCandidateInput(operation: string, value: unknown, context: CandidateInputContext): CandidateInput {
  if (!Number.isFinite(context.now?.getTime()) || !Number.isFinite(context.policyExpiresAt?.getTime()) || context.policyExpiresAt <= context.now) throw new AuthFailure('CANDIDATE_POLICY_EXPIRED', 412);
  if (!candidateOperations.includes(operation as typeof candidateOperations[number]) || !exact(value, ['kind', 'candidate', 'candidateRef', 'policyRef', 'expiresAt', 'reason']) || value.kind !== (operation === 'registerConnection' ? 'CONNECTION_CANDIDATE' : 'ENVIRONMENT_CANDIDATE') || !isVersionRef(value.policyRef) || value.candidateRef !== null && !isVersionRef(value.candidateRef) || !instant(value.expiresAt) || Date.parse(value.expiresAt) <= context.now.getTime() || Date.parse(value.expiresAt) > context.policyExpiresAt.getTime() || !text(value.reason, 20_000)) throw new AuthFailure('CANDIDATE_INPUT_INVALID', 422);
  const c = value.candidate, allowed = value.kind === 'CONNECTION_CANDIDATE' ? connectionKeys : environmentKeys;
  if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).some(k => !allowed.includes(k)) || !text((c as Record<string, unknown>).label, 200)) throw new AuthFailure('CANDIDATE_INPUT_INVALID', 422);
  for (const [key, item] of Object.entries(c)) {
    if (['toolProduct', 'toolVersion', 'adapterKind'].includes(key) && !text(item, 200, true)) throw new AuthFailure('CANDIDATE_INPUT_INVALID', 422);
    if (['connectorRef', 'environmentRef', 'executionHostRef'].includes(key) && !isVersionRef(item)) throw new AuthFailure('CANDIDATE_REFERENCE_INVALID', 422);
    if (['sourceRootRefs', 'targetHostRefs', 'commandProfileRefs', 'secretRefs'].includes(key) && !references(item)) throw new AuthFailure('CANDIDATE_REFERENCE_INVALID', 422);
    if (key === 'documentation') {
      if (!Array.isArray(item) || item.length > 6 || new Set(item.map(x => x?.code)).size !== item.length || item.some(x => !exact(x, ['code', 'source', 'observedAt', 'versionCompatibility']) || !capabilityCodes.includes(x.code as typeof capabilityCodes[number]) || !text(x.source, 2048) || !instant(x.observedAt) || Date.parse(x.observedAt) > context.now.getTime() || !['CONFIRMED', 'UNVERIFIED', 'UNSUPPORTED'].includes(String(x.versionCompatibility)))) throw new AuthFailure('CANDIDATE_DOCUMENTATION_INVALID', 422);
      for (const evidence of item) { let url: URL; try { url = new URL(evidence.source); } catch { throw new AuthFailure('CANDIDATE_DOCUMENTATION_INVALID', 422); } if (url.protocol !== 'https:' || url.username || url.password) throw new AuthFailure('CANDIDATE_DOCUMENTATION_INVALID', 422); }
    }
  }
  if (inspectArtifact(Buffer.from(canonicalJson(value), 'utf8')).state === 'SUSPECTED') throw new AuthFailure('CANDIDATE_SENSITIVE_CONTENT_SUSPECTED', 412);
  return structuredClone(value) as unknown as CandidateInput;
}
export function candidateReadiness(input: CandidateInput) {
  const fields = input.kind === 'CONNECTION_CANDIDATE' ? ['toolProduct', 'toolVersion', 'adapterKind', 'connectorRef', 'environmentRef'] : ['executionHostRef', 'sourceRootRefs', 'targetHostRefs', 'commandProfileRefs'];
  const missingRequirements = fields.flatMap(field => {
    if (!Object.hasOwn(input.candidate, field)) return [{ field, reason: 'NOT_PROVIDED' }];
    const value = input.candidate[field];
    return Array.isArray(value) && value.length === 0 || typeof value === 'string' && !value.trim() ? [{ field, reason: 'EMPTY' }] : [];
  });
  missingRequirements.push({ field: 'hostTrust', reason: 'UNVERIFIED' }, { field: 'agentMeasurement', reason: 'NOT_EXECUTED' });
  return { state: 'NOT_READY' as const, executionAuthorized: false as const, missingRequirements };
}
export function candidateCapabilities(input: CandidateInput) {
  const docs = input.candidate.documentation as { code: string; source: string; observedAt: string; versionCompatibility: string }[] | undefined;
  return capabilityCodes.map(code => ({ code, documentation: docs?.find(item => item.code === code) ? { ...docs.find(item => item.code === code)!, sourceKind: 'USER_REPORTED' } : null, measurement: { state: 'UNVERIFIED', toolVersion: input.candidate.toolVersion ?? null, environmentRef: input.candidate.environmentRef ?? null, executionRef: null, evidenceRefs: [] }, controlLevel: 'UNVERIFIED', limitations: ['HOST_NOT_TRUSTED', 'NO_AGENT_MEASUREMENT', 'NOT_EXECUTABLE_CANDIDATE'] }));
}
