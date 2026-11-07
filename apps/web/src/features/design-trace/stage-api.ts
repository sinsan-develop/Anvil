import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { StageNodeRef } from '../../../../../apps/server/modules/documents/document-stage.ts';
export type { StageNodeRef };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const stageRef = (value: unknown): value is StageNodeRef => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'applicationId,nodeId') return false;
  const r = value as Record<string, unknown>;
  return typeof r.applicationId === 'string' && uuid.test(r.applicationId) && typeof r.nodeId === 'string' && !!r.nodeId.trim() && r.nodeId.length <= 200 && r.nodeId.isWellFormed() && !/[\u0000-\u001f\u007f]/.test(r.nodeId);
};
export const nullableStageRef = (value: unknown): value is StageNodeRef | null => value === null || stageRef(value);
export const sameStageRef = (a: unknown, b: unknown) => a === null && b === null || stageRef(a) && stageRef(b) && a.applicationId === b.applicationId && a.nodeId === b.nodeId;
const ref = (r: VersionRef) => !!r && uuid.test(r.id) && Number.isSafeInteger(r.version) && r.version > 0 && /^[0-9a-f]{64}$/.test(r.contentHash);
export interface StageBinding { applicationRef: VersionRef; methodologyName: string; nodeId: string; nodeName: string; uses: ('INPUT' | 'OUTPUT')[] }
export interface StageOptions { projectId: string; formRef: VersionRef; applicationRef: VersionRef | null; methodologyName: string | null; items: { stageNodeRef: StageNodeRef; nodeName: string; nodeKind: string; uses: ('INPUT' | 'OUTPUT')[] }[]; status: 'READY' | 'NO_APPLICATION' | 'FORM_NOT_LINKED'; observedAt: string }
export function validStageBinding(value: StageBinding, selected: StageNodeRef): boolean { return !!value && ref(value.applicationRef) && value.applicationRef.id === selected.applicationId && value.nodeId === selected.nodeId && typeof value.nodeName === 'string' && typeof value.methodologyName === 'string' && Array.isArray(value.uses) && value.uses.length > 0 && value.uses.length <= 2 && new Set(value.uses).size === value.uses.length && value.uses.every(item => ['INPUT', 'OUTPUT'].includes(item)); }
export async function readDocumentStageOptions(client: ApiClient, projectId: string, formRef: VersionRef): Promise<StageOptions> {
  if (!uuid.test(projectId) || !ref(formRef)) throw new ApiError('CLIENT_PATH_INVALID');
  const value = await client.get<StageOptions>(`/api/v1/projects/${projectId}/documents/stage-options?formId=${formRef.id}&formVersion=${formRef.version}&formHash=${formRef.contentHash}`);
  if (!value || value.projectId !== projectId || !ref(value.formRef) || value.formRef.id !== formRef.id || value.formRef.version !== formRef.version || value.formRef.contentHash !== formRef.contentHash || !['READY', 'NO_APPLICATION', 'FORM_NOT_LINKED'].includes(value.status) || !Array.isArray(value.items) || value.items.length > 1000 || !Number.isFinite(Date.parse(value.observedAt)) || value.status === 'READY' !== (value.items.length > 0) || value.status === 'NO_APPLICATION' !== (value.applicationRef === null) || value.applicationRef !== null && !ref(value.applicationRef) || value.methodologyName !== null && typeof value.methodologyName !== 'string' || value.items.some(item => !item || !stageRef(item.stageNodeRef) || item.stageNodeRef.applicationId !== value.applicationRef?.id || typeof item.nodeName !== 'string' || !['HUMAN', 'AGENT', 'DECISION', 'JOIN'].includes(item.nodeKind) || !Array.isArray(item.uses) || !item.uses.length || item.uses.length > 2 || item.uses.some(v => !['INPUT', 'OUTPUT'].includes(v))) || new Set(value.items.map(item => item.stageNodeRef.nodeId)).size !== value.items.length) throw new ApiError('RESPONSE_INVALID');
  return value;
}
