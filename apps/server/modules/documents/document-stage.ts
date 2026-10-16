import { AuthFailure } from '../access/repository.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
export interface StageNodeRef { applicationId: string; nodeId: string }
export function readStageNodeRef(value: unknown): StageNodeRef | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'applicationId,nodeId') throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID', 422);
  const ref = value as Record<string, unknown>;
  if (typeof ref.applicationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.applicationId) || typeof ref.nodeId !== 'string' || !ref.nodeId.trim() || ref.nodeId.length > 200 || !ref.nodeId.isWellFormed() || /[\u0000-\u001f\u007f]/.test(ref.nodeId)) throw new AuthFailure('DOCUMENT_STAGE_INPUT_INVALID', 422);
  return { applicationId: ref.applicationId, nodeId: ref.nodeId };
}
export function nodeUsesForm(node: { inputs: { formRef: VersionRef }[]; outputs: { formRef: VersionRef }[] }, ref: VersionRef): ('INPUT' | 'OUTPUT')[] {
  return (['INPUT', 'OUTPUT'] as const).filter(kind => node[kind === 'INPUT' ? 'inputs' : 'outputs'].some(item => item.formRef.id === ref.id && item.formRef.version === ref.version && item.formRef.contentHash === ref.contentHash));
}
