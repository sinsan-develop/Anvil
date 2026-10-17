import { canonicalJson } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { readSourceScopesV1, type SourceScopeV1 } from '../../../../contracts/runtime/source-scope-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe } from '../knowledge/knowledge-entry.ts';

export const assignmentDraftOperations = ['prepareAssignment'] as const;

export interface AssignmentTaskRef { planRef: VersionRef; taskCode: string; applicationRef: VersionRef; nodeId: string }
export interface AssignmentDefinition {
  taskRef: AssignmentTaskRef; purpose: string; goal: string; baselineRefs: VersionRef[];
  inputs: string[]; outputs: string[]; acceptanceCriteria: string[]; verificationRequirements: string[];
  included: string[]; excluded: string[]; allowedScopes: SourceScopeV1[]; environmentRef: VersionRef | null;
  requiredCapabilities: string[]; budgetRef: VersionRef | null; ownerRole: string;
  parentAssignmentRef: VersionRef | null; recordingPolicyRef: VersionRef | null; integrationResponsibility: string;
}
export interface AssignmentDraftInput { baseRef: VersionRef | null; definition: AssignmentDefinition; reason: string }
export interface AssignmentIssue { code: string; location: string }
const textFields = ['purpose', 'goal', 'ownerRole', 'integrationResponsibility'] as const;
const listFields = ['inputs', 'outputs', 'acceptanceCriteria', 'verificationRequirements', 'included', 'excluded', 'requiredCapabilities'] as const;
const nullableRefs = ['environmentRef', 'budgetRef', 'parentAssignmentRef', 'recordingPolicyRef'] as const;
const definitionFields = ['taskRef', 'baselineRefs', 'allowedScopes', ...textFields, ...listFields, ...nullableRefs];
const exact = (value: unknown, keys: readonly string[]): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const text = (value: unknown, max = 20000): value is string => typeof value === 'string' && value.length <= max && value.isWellFormed();
const code = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);

/** HTTP JSON 입력의 초안 문법/누락 검사다. 현재 권한·참조 원본/예산·실제 실행은 별도다. */
export function readAssignmentDraftInput(value: unknown) {
  const invalid = (): never => { throw new AuthFailure('ASSIGNMENT_INPUT_INVALID', 422); };
  let parsed: unknown;
  try { const serialized = canonicalJson(value); if (Buffer.byteLength(serialized, 'utf8') > 2 * 1024 * 1024) return invalid(); parsed = JSON.parse(serialized); } catch { return invalid(); }
  if (!exact(parsed, ['baseRef', 'definition', 'reason']) || parsed.baseRef !== null && !isVersionRef(parsed.baseRef) || !text(parsed.reason) || !parsed.reason.trim() || !exact(parsed.definition, definitionFields)) return invalid();
  const d = parsed.definition, task = d.taskRef;
  if (!exact(task, ['planRef', 'taskCode', 'applicationRef', 'nodeId']) || !isVersionRef(task.planRef) || !isVersionRef(task.applicationRef) || !code(task.taskCode) || typeof task.nodeId !== 'string' || !task.nodeId.trim() || !task.nodeId.isWellFormed()) return invalid();
  if (!textFields.every(field => text(d[field], field === 'ownerRole' ? 200 : 20000)) || !listFields.every(field => Array.isArray(d[field]) && d[field].length <= 200 && d[field].every((item: unknown) => text(item)))
    || !Array.isArray(d.baselineRefs) || d.baselineRefs.length > 200 || !d.baselineRefs.every(isVersionRef) || !nullableRefs.every(field => d[field] === null || isVersionRef(d[field])) || !Array.isArray(d.allowedScopes)) return invalid();
  if (new Set(d.baselineRefs.map((ref: VersionRef) => canonicalJson(ref))).size !== d.baselineRefs.length) return invalid();
  if (d.allowedScopes.length) { try { d.allowedScopes = readSourceScopesV1(d.allowedScopes); } catch { return invalid(); } }
  if (d.parentAssignmentRef !== null) throw new AuthFailure('ASSIGNMENT_PARENT_NOT_CONNECTED', 412);
  const inspectText = (item: unknown): void => {
    if (typeof item === 'string') { try { assertKnowledgeTextSafe(item); } catch { throw new AuthFailure('ASSIGNMENT_SENSITIVE_CONTENT_SUSPECTED', 412); } }
    else if (item !== null && typeof item === 'object') for (const entry of Object.values(item)) inspectText(entry);
  };
  inspectText(parsed);
  const readinessIssues: AssignmentIssue[] = [], issue = (code: string, location: string) => readinessIssues.push({ code, location });
  for (const field of textFields) if (!d[field].trim()) issue('REQUIRED_TEXT_MISSING', field);
  for (const field of listFields) if (!d[field].length || d[field].some((item: string) => !item.trim())) issue('REQUIRED_LIST_MISSING', field);
  if (!d.allowedScopes.length) issue('SOURCE_SCOPE_MISSING', 'allowedScopes');
  else issue('SOURCE_SCOPE_UNVERIFIED', 'allowedScopes');
  for (const ref of [task.planRef, task.applicationRef]) if (!d.baselineRefs.some((value: VersionRef) => canonicalJson(value) === canonicalJson(ref))) issue('BASELINE_REFERENCE_MISSING', 'baselineRefs');
  for (const [code, location] of [['CONTEXT_NOT_REVIEWED', 'taskRef'], ['EXECUTION_NOT_CONNECTED', 'taskRef'], ['BUDGET_UNVERIFIED', 'budgetRef'], ['ENVIRONMENT_UNVERIFIED', 'environmentRef'], ['CAPABILITY_UNVERIFIED', 'requiredCapabilities'], ['RECORDING_POLICY_UNVERIFIED', 'recordingPolicyRef']] as const) issue(code, location);
  return { input: parsed as unknown as AssignmentDraftInput, readinessIssues, ready: false as const, executionAuthorized: false as const, dispatchPerformed: false as const };
}
