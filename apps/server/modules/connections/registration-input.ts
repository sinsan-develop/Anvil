import { AuthFailure } from '../access/repository.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { inspectArtifact } from '../../storage/sensitive-inspection.ts';

export interface ConnectorRegistrationInput {
  hostLabel: string;
  expectedHostFingerprint: string;
  allowedProjectRefs: VersionRef[];
  environmentRefs: VersionRef[];
  policyRef: VersionRef;
  expiresAt: string;
  reason: string;
}
export interface RegistrationInputContext { now: Date; maxAgeMs: number; maxReferences: number }
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const text = (value: unknown, limit: number) => typeof value === 'string' && !!value.trim() && value.length <= limit && value.isWellFormed() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
function refs(value: unknown, limit: number): value is VersionRef[] {
  return Array.isArray(value) && value.length > 0 && value.length <= limit && value.every(isVersionRef) && new Set(value.map(item => item.id)).size === value.length;
}
/** 입력 형식만 검사한다. 회원/현재 제어·정책/최근 재인증·실제 host 증명·참조 실재성은 서버 저장 전에 별도로 검사한다. */
export function readConnectorRegistration(value: unknown, context: RegistrationInputContext): ConnectorRegistrationInput {
  if (!(context.now instanceof Date) || !Number.isFinite(context.now.getTime()) || !Number.isSafeInteger(context.maxAgeMs) || context.maxAgeMs < 1 || !Number.isSafeInteger(context.now.getTime() + context.maxAgeMs) || !Number.isSafeInteger(context.maxReferences) || context.maxReferences < 1) throw new AuthFailure('CONNECTOR_REGISTRATION_POLICY_REQUIRED', 412);
  if (!exact(value, ['hostLabel', 'expectedHostFingerprint', 'allowedProjectRefs', 'environmentRefs', 'policyRef', 'expiresAt', 'reason']) || !text(value.hostLabel, 200) || /[\r\n\t]/.test(value.hostLabel as string) || !text(value.reason, 20_000) || typeof value.expectedHostFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(value.expectedHostFingerprint) || !refs(value.allowedProjectRefs, context.maxReferences) || !refs(value.environmentRefs, context.maxReferences) || !isVersionRef(value.policyRef) || typeof value.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.expiresAt) || !Number.isFinite(Date.parse(value.expiresAt)) || new Date(value.expiresAt).toISOString() !== value.expiresAt || Date.parse(value.expiresAt) <= context.now.getTime() || Date.parse(value.expiresAt) > context.now.getTime() + context.maxAgeMs) throw new AuthFailure('CONNECTOR_REGISTRATION_INPUT_INVALID', 422);
  if (inspectArtifact(Buffer.from([value.hostLabel, value.reason].join('\n'), 'utf8')).state === 'SUSPECTED') throw new AuthFailure('CONNECTOR_REGISTRATION_SENSITIVE_CONTENT_SUSPECTED', 412);
  return structuredClone(value) as unknown as ConnectorRegistrationInput;
}
