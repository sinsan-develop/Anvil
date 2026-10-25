import type { VersionRef } from '../../../../contracts/generated-types.ts';
import type { GraphCondition, MethodologyGraph } from '../../../../contracts/methodologies.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { canonicalJson } from '../../../../contracts/canonical.ts';

export interface ValidationIssue { code: string; location: string; severity: 'ERROR' | 'WARNING'; message: string; relatedRefs: VersionRef[] }
type RecordValue = Record<string, unknown>;
function object(value: unknown, keys: string[], required = keys): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value, key));
}
const texts = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const nonempty = (value: string) => value.trim().length > 0;
function condition(value: unknown): boolean {
  if (object(value, ['all'])) return Array.isArray(value.all) && value.all.length > 0 && value.all.every(condition);
  if (object(value, ['any'])) return Array.isArray(value.any) && value.any.length > 0 && value.any.every(condition);
  if (object(value, ['not'])) return condition(value.not);
  if (!object(value, ['fieldRef', 'operator', 'value']) || !object(value.fieldRef, ['nodeId', 'field']) || typeof value.fieldRef.nodeId !== 'string' || typeof value.fieldRef.field !== 'string' || !['REVIEW_OUTCOME', 'USER_DECISION'].includes(value.fieldRef.field) || typeof value.operator !== 'string') return false;
  const validValue = (item: unknown) => typeof item === 'string' && nonempty(item) && (value.fieldRef as RecordValue).field === 'USER_DECISION'
    || typeof item === 'string' && ['ACCEPTED', 'REWORK', 'BLOCKED'].includes(item);
  return value.operator === 'IS_PRESENT' ? value.value === null
    : value.operator === 'IN' ? Array.isArray(value.value) && value.value.length > 0 && value.value.every(validValue)
    : ['EQ', 'NE'].includes(value.operator) && validValue(value.value);
}
function shape(input: unknown): input is MethodologyGraph {
  if (!object(input, ['nodes', 'edges', 'entryNodeId', 'terminalNodeIds']) || typeof input.entryNodeId !== 'string' || !texts(input.terminalNodeIds) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) return false;
  for (const node of input.nodes) {
    const required = ['nodeId', 'name', 'purpose', 'kind', 'position', 'role', 'inputs', 'outputs', 'taskScope', 'completionCriteria', 'approvalBoundary', 'mode', 'limitPolicyRef', 'recordRequirements'];
    if (!object(node, [...required, 'requirements', 'joinRule'], required) || typeof node.nodeId !== 'string' || typeof node.name !== 'string' || typeof node.purpose !== 'string'
      || !['HUMAN', 'AGENT', 'DECISION', 'JOIN'].includes(String(node.kind)) || !['USER', 'COORDINATOR', 'STAGE_OWNER'].includes(String(node.role)) || !['AUTO', 'CASE_BY_CASE'].includes(String(node.mode))
      || !object(node.position, ['x', 'y']) || typeof node.position.x !== 'number' || !Number.isFinite(node.position.x) || typeof node.position.y !== 'number' || !Number.isFinite(node.position.y)
      || !object(node.taskScope, ['included', 'excluded']) || !texts(node.taskScope.included) || !texts(node.taskScope.excluded)
      || !texts(node.completionCriteria) || !texts(node.approvalBoundary) || !texts(node.recordRequirements) || node.limitPolicyRef !== null && !isVersionRef(node.limitPolicyRef)
      || !Array.isArray(node.inputs) || !Array.isArray(node.outputs)) return false;
    for (const item of [...node.inputs, ...node.outputs]) {
      if (!object(item, ['itemId', 'formRef', 'required', 'sourceNodeId', 'reviewCriteria'], ['itemId', 'formRef', 'required', 'reviewCriteria']) || typeof item.itemId !== 'string' || !isVersionRef(item.formRef) || typeof item.required !== 'boolean' || !texts(item.reviewCriteria) || item.sourceNodeId !== undefined && typeof item.sourceNodeId !== 'string') return false;
    }
    if (node.requirements !== undefined && (!object(node.requirements, ['capabilities', 'environment']) || !texts(node.requirements.capabilities) || !texts(node.requirements.environment))) return false;
    if (node.joinRule !== undefined && (!object(node.joinRule, ['mode', 'condition'], ['mode']) || !['ALL', 'DECLARED_CONDITION'].includes(String(node.joinRule.mode)) || node.joinRule.condition !== undefined && !condition(node.joinRule.condition))) return false;
  }
  for (const edge of input.edges) {
    if (!object(edge, ['edgeId', 'fromNodeId', 'toNodeId', 'kind', 'condition', 'reason', 'retryPolicy'], ['edgeId', 'fromNodeId', 'toNodeId', 'kind', 'condition', 'reason']) || typeof edge.edgeId !== 'string' || typeof edge.fromNodeId !== 'string' || typeof edge.toNodeId !== 'string' || typeof edge.reason !== 'string' || !['SEQUENCE', 'BRANCH', 'JOIN', 'REWORK'].includes(String(edge.kind)) || edge.condition !== null && !condition(edge.condition)) return false;
    if (edge.retryPolicy !== undefined && (!object(edge.retryPolicy, ['maxAttempts', 'onExhausted', 'counting']) || typeof edge.retryPolicy.maxAttempts !== 'number' || edge.retryPolicy.onExhausted !== 'USER_DECISION' || edge.retryPolicy.counting !== 'SAME_FAILURE_FINGERPRINT')) return false;
  }
  return true;
}

export function validateMethodologyGraph(input: unknown, forms: readonly VersionRef[]): { issues: ValidationIssue[]; validForConfirmation: boolean; runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' } {
  const issues: ValidationIssue[] = [];
  const issue = (code: string, location: string, message: string, severity: 'ERROR' | 'WARNING' = 'ERROR') => issues.push({ code, location, severity, message, relatedRefs: [] });
  const result = () => ({ issues, validForConfirmation: !issues.some(item => item.severity === 'ERROR'), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' as const });
  try { if (Buffer.byteLength(canonicalJson(input), 'utf8') > 2 * 1024 * 1024) throw Error('size'); }
  catch { issue('INPUT_INVALID', 'graph', '지원하지 않는 값·순환 자료·크기 초과입니다.'); return result(); }
  if (!shape(input)) { issue('INPUT_INVALID', 'graph', '정의하지 않은 필드·조건 또는 잘못된 자료형입니다. 실행 코드와 credential을 받지 않습니다.'); return result(); }
  const graph = input, nodes = new Map(graph.nodes.map(node => [node.nodeId, node]));
  const seenNodes = new Set<string>(), seenEdges = new Set<string>(), formMap = new Map(forms.map(ref => [`${ref.id}:${ref.version}`, ref.contentHash]));
  const forward = new Map([...nodes.keys()].map(id => [id, [] as string[]]));
  const incoming = new Map([...nodes.keys()].map(id => [id, 0]));
  if (!graph.nodes.length) issue('EMPTY_GRAPH', 'nodes', '단계가 없는 초안은 확정할 수 없습니다.');
  if (!nodes.has(graph.entryNodeId)) issue('ENTRY_NODE_MISSING', 'entryNodeId', '시작 단계가 없습니다.');
  if (!graph.terminalNodeIds.length || new Set(graph.terminalNodeIds).size !== graph.terminalNodeIds.length || graph.terminalNodeIds.some(id => !nodes.has(id))) issue('TERMINAL_NODE_MISSING', 'terminalNodeIds', '종료 단계가 없거나 중복/잘못된 참조입니다.');
  const checkCondition = (value: GraphCondition | null | undefined, location: string) => {
    if (!value) return;
    if ('all' in value) { value.all.forEach((item, index) => checkCondition(item, `${location}.all.${index}`)); return; }
    if ('any' in value) { value.any.forEach((item, index) => checkCondition(item, `${location}.any.${index}`)); return; }
    if ('not' in value) { checkCondition(value.not, location + '.not'); return; }
    const referenced = nodes.get(value.fieldRef.nodeId);
    if (!referenced) issue('CONDITION_REFERENCE_MISSING', location, '판단 대상 단계가 없습니다.');
    else if (value.fieldRef.field === 'USER_DECISION' && (referenced.role !== 'USER' || !['HUMAN', 'DECISION'].includes(referenced.kind))) issue('HUMAN_DECISION_REQUIRED', location, '사용자 선택은 사람 판단 단계를 참조해야 합니다.');
  };
  for (const node of graph.nodes) {
    const location = `nodes.${node.nodeId}`;
    if (!nonempty(node.nodeId) || seenNodes.has(node.nodeId)) issue('DUPLICATE_NODE_ID', location, '단계 ID는 비어 있거나 중복될 수 없습니다.');
    seenNodes.add(node.nodeId);
    if (!nonempty(node.name) || !nonempty(node.purpose) || !node.taskScope.included.length || node.taskScope.included.some(text => !nonempty(text))) issue('NODE_SCOPE_REQUIRED', location, '단계 이름·목적·허용 업무가 필요합니다.');
    if (!node.completionCriteria.length || node.completionCriteria.some(text => !nonempty(text))) issue('COMPLETION_CRITERIA_REQUIRED', location, '실제 완료·검수 조건이 필요합니다.');
    if (!node.recordRequirements.length || node.recordRequirements.some(text => !nonempty(text))) issue('RECORD_REQUIREMENTS_REQUIRED', location, '현재 작업·오류·안전 재개 기록 조건이 필요합니다.');
    if (node.kind === 'HUMAN' && node.role !== 'USER' || node.kind === 'AGENT' && node.role === 'USER') issue('HUMAN_ROLE_INVALID', location, '사람의 판단을 Agent 수행 역할로 바꿀 수 없습니다.');
    if (node.kind === 'AGENT' && (!node.requirements?.capabilities.length || !node.requirements.environment.length)) issue('AGENT_REQUIREMENTS_REQUIRED', location, '실제 연결 전에 역할에 필요한 능력·환경을 정의해야 합니다.');
    if (node.kind === 'AGENT') issue(node.limitPolicyRef ? 'LIMIT_POLICY_NOT_VERIFIED' : 'LIMIT_POLICY_UNBOUND', location, '구조 검증은 실제 유한 정책·지원·환경·권한을 검증하지 않습니다.', 'WARNING');
    if (node.kind === 'JOIN' && (!node.joinRule || node.joinRule.mode === 'DECLARED_CONDITION' && !node.joinRule.condition)) issue('JOIN_RULE_REQUIRED', location, '모든 선행 또는 명시한 결과 조건으로 합류해야 합니다.');
    if (node.kind !== 'JOIN' && node.joinRule) issue('JOIN_RULE_INVALID', location, '합류 규칙은 합류 단계에만 둡니다.');
    checkCondition(node.joinRule?.condition, location + '.joinRule');
    const itemIds = new Set<string>();
    for (const item of [...node.inputs, ...node.outputs]) {
      const at = `${location}.documents.${item.itemId}`;
      if (!nonempty(item.itemId) || itemIds.has(item.itemId)) issue('DUPLICATE_DOCUMENT_ITEM', at, '문서 항목 ID가 비어 있거나 중복입니다.');
      itemIds.add(item.itemId);
      if (formMap.get(`${item.formRef.id}:${item.formRef.version}`) !== item.formRef.contentHash) issue('FORM_REFERENCE_UNAVAILABLE', at, '허가된 양식의 정확 버전/hash를 확인할 수 없습니다.');
      if (!item.reviewCriteria.length || item.reviewCriteria.some(text => !nonempty(text))) issue('DOCUMENT_REVIEW_REQUIRED', at, '문서 항목의 내용 검수 조건이 필요합니다.');
      if (item.sourceNodeId && !nodes.has(item.sourceNodeId)) issue('NODE_REFERENCE_MISSING', at, '선행 문서 단계가 없습니다.');
    }
  }
  for (const edge of graph.edges) {
    const at = `edges.${edge.edgeId}`;
    if (!nonempty(edge.edgeId) || seenEdges.has(edge.edgeId)) issue('DUPLICATE_EDGE_ID', at, '연결 ID가 비어 있거나 중복입니다.');
    seenEdges.add(edge.edgeId);
    if (!nodes.has(edge.fromNodeId) || !nodes.has(edge.toNodeId)) { issue('NODE_REFERENCE_MISSING', at, '연결 대상 단계가 없습니다.'); continue; }
    checkCondition(edge.condition, at + '.condition');
    if (edge.kind === 'REWORK') {
      if (!edge.condition || !nonempty(edge.reason) || !edge.retryPolicy || !Number.isSafeInteger(edge.retryPolicy.maxAttempts) || edge.retryPolicy.maxAttempts < 1) issue('REWORK_POLICY_REQUIRED', at, '재작업에는 이유·재개 조건·유한 동일 실패 정책이 필요합니다.');
    } else {
      forward.get(edge.fromNodeId)!.push(edge.toNodeId);
      incoming.set(edge.toNodeId, incoming.get(edge.toNodeId)! + 1);
      if (edge.kind === 'BRANCH' && !edge.condition) issue('BRANCH_CONDITION_REQUIRED', at, '분기에는 명시한 판단 조건이 필요합니다.');
      if (edge.retryPolicy) issue('REWORK_POLICY_INVALID', at, '재작업 외 연결에 재시도 정책을 둘 수 없습니다.');
    }
  }
  const reachable = (start: string) => {
    const visited = new Set<string>(), queue = [start];
    for (let index = 0; index < queue.length; index++) { const id = queue[index]!; if (!nodes.has(id) || visited.has(id)) continue; visited.add(id); for (const next of forward.get(id)!) if (!visited.has(next)) queue.push(next); }
    return visited;
  };
  const fromEntry = reachable(graph.entryNodeId);
  for (const node of graph.nodes) {
    if (!fromEntry.has(node.nodeId)) issue('UNREACHABLE_NODE', `nodes.${node.nodeId}`, '정상 흐름으로 시작 단계에서 도달할 수 없습니다.');
    if (node.kind === 'JOIN' && incoming.get(node.nodeId)! < 2) issue('JOIN_PREDECESSORS_REQUIRED', `nodes.${node.nodeId}`, '합류할 선행 단계가 두 개 이상 필요합니다.');
    if (!forward.get(node.nodeId)!.length && !graph.terminalNodeIds.includes(node.nodeId)) issue('NONTERMINAL_DEAD_END', `nodes.${node.nodeId}`, '정상 흐름이 끝나는 단계는 종료로 명시해야 합니다.');
    if (forward.get(node.nodeId)!.length && graph.terminalNodeIds.includes(node.nodeId)) issue('TERMINAL_HAS_SUCCESSOR', `nodes.${node.nodeId}`, '후속 정상 작업이 남은 단계를 종료로 표시할 수 없습니다.');
    for (const item of node.inputs) if (item.sourceNodeId && (item.sourceNodeId === node.nodeId || !reachable(item.sourceNodeId).has(node.nodeId))) issue('SOURCE_NODE_NOT_PREDECESSOR', `nodes.${node.nodeId}.documents.${item.itemId}`, '입력 문서는 정상 흐름의 선행 단계에서 와야 합니다.');
  }
  const degrees = new Map(incoming), queue = [...nodes.keys()].filter(id => degrees.get(id) === 0);
  for (let index = 0; index < queue.length; index++) for (const next of forward.get(queue[index]!)!) { degrees.set(next, degrees.get(next)! - 1); if (degrees.get(next) === 0) queue.push(next); }
  if (queue.length < nodes.size) for (const [id, degree] of degrees) if (degree > 0) issue('UNINTENDED_CYCLE', `nodes.${id}`, '명시 재작업 외 순환은 허용하지 않습니다.');
  return result();
}
