import type { OfficialForm } from '../documents/forms.ts';
import type { BuiltinMethodology, MethodologyNode, MethodologyEdge } from '../../../../contracts/methodologies.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';

export const builtinSourceHash = '1373688f969e578da3a38c52f619b878d01fdf999b717fd516ebf638d8c897d1';
const prefixes = ['ST', 'OO', 'AG'];
const names = ['구조적 방법론', '객체지향 방법론', '애자일 방법론'];
const goals = ['기능·처리·데이터 흐름을 실제 사용자 화면·저장·조회와 연결한다.', '사용 시나리오와 객체의 책임·협력·상태·데이터 수명을 연결한다.', '전체 미구현 목록을 유지하며 사용 가능한 증분을 선택·설계·구현·검토한다.'];
const outputs = [
  ['AF01', 'AF07', 'AF08'], ['AF02'], ['AF02', 'AF03'], ['AF04', 'AF05'], ['AF07'], ['AF06'], ['AF06', 'AF07'],
];

export function buildBuiltinMethodologies(source: Buffer, forms: OfficialForm[]): BuiltinMethodology[] {
  if (contentHash(source) !== builtinSourceHash) throw Error('BUILTIN_SOURCE_NOT_APPROVED');
  if (forms.length !== 8 || new Set(forms.map(form => form.definition.formCode)).size !== 8
    || forms.some(form => !/^AF0[1-8]$/.test(form.definition.formCode) || form.definition.scope !== 'SYSTEM' || contentHash(canonicalJson(form.definition)) !== form.ref.contentHash)) throw Error('OFFICIAL_FORM_CATALOG_INCOMPLETE');
  const formByCode = new Map(forms.map(form => [form.definition.formCode, form]));
  const rows = [...source.toString('utf8').matchAll(/^\| (ST|OO|AG)(0[1-7]) (.+?) \/ (.+?) \| (.+?) \| (.+?) \| (.+?) \|\r?$/gm)];
  if (rows.length !== 21) throw Error('BUILTIN_STRUCTURE_INVALID');
  return prefixes.map((prefix, index): BuiltinMethodology => {
    const stages = rows.filter(row => row[1] === prefix);
    const knownDocuments = new Map<string, string>();
    const nodes = stages.map((row, stage): MethodologyNode => {
      const nodeId = `${prefix}${String(stage + 1).padStart(2, '0')}`;
      if (row[2] !== String(stage + 1).padStart(2, '0')) throw Error('BUILTIN_STRUCTURE_INVALID');
      const human = stage === 6 || prefix === 'AG' && (stage === 0 || stage === 5);
      const approvalBoundary: string[] = [];
      if (stage === 0) approvalBoundary.push('USER_REQUIREMENTS_CONFIRMATION');
      if (prefix === 'AG' && stage === 1) approvalBoundary.push('USER_ITERATION_SCOPE_CONFIRMATION');
      if (stage === 2) approvalBoundary.push('USER_DESIGN_AND_SCREEN_CONFIRMATION');
      if (stage === 3) approvalBoundary.push('USER_WORK_AND_TEST_PLAN_CONFIRMATION');
      if (prefix === 'AG' && stage === 5) approvalBoundary.push('USER_INCREMENT_ACCEPTANCE');
      if (stage === 6) approvalBoundary.push(prefix === 'AG' ? 'USER_NEXT_ITERATION_OR_COMPLETION' : 'USER_PROJECT_COMPLETION');
      const inputs = [...knownDocuments].map(([code, sourceNodeId]) => ({ itemId: `${nodeId}.INPUT.${code}`, formRef: { ...formByCode.get(code)!.ref }, required: true, sourceNodeId, reviewCriteria: ['앞 단계의 정확 버전·원문·검토 상태와 현재 임무의 관련성을 확인한다.'] }));
      const resultCodes = prefix === 'AG' && stage === 1 ? ['AF04', 'AF07'] : outputs[stage]!;
      const resultItems = resultCodes.map(code => ({ itemId: `${nodeId}.OUTPUT.${code}`, formRef: { ...formByCode.get(code)!.ref }, required: true, reviewCriteria: [row[6]!, '양식 충족·원문 근거·실제 결과를 별도로 검토한다. 제출을 사람 승인이나 완료로 간주하지 않는다.'] }));
      for (const code of resultCodes) knownDocuments.set(code, nodeId);
      return {
        nodeId, name: row[3]!, purpose: `${row[4]}: ${row[5]}`, kind: human ? 'HUMAN' : 'AGENT',
        role: human ? 'USER' : prefix === 'AG' && stage === 1 ? 'COORDINATOR' : 'STAGE_OWNER',
        position: { x: stage * 240, y: 0 }, inputs, outputs: resultItems,
        taskScope: { included: [row[6]!], excluded: ['정의된 범위 밖 작업·외부 비용·실제 배포', '사용자 승인 지점 생략·권한/한도 확대'] },
        completionCriteria: [row[6]!, '미확인·부분·미구현을 구분하고 앞 단계가 완료한 작업을 이유 없이 반복하지 않는다.'],
        approvalBoundary, mode: 'CASE_BY_CASE', limitPolicyRef: null,
        recordRequirements: ['목적·기준 버전·단계/책임 세션·현재 위치', '변경 파일·실제 명령/exit·증거·미실행', '오류 지문/횟수·원인·조치·남은 조건', '안전 checkpoint·다음 행동·복구/인계'],
        ...(human ? {} : { requirements: { capabilities: ['지시·입력 수신', '진행·결과 회수', '중지·쓰기 회수'], environment: ['프로젝트의 확정된 허용 경로·도구·환경', '실행 전 실제 지원·현재 권한·유한 한도 확인'] } }),
      };
    });
    const edges: MethodologyEdge[] = nodes.slice(0, -1).map((node, stage) => ({
      edgeId: `${prefix}.SEQ.${stage + 1}`, fromNodeId: node.nodeId, toNodeId: nodes[stage + 1]!.nodeId,
      kind: 'SEQUENCE', condition: { fieldRef: { nodeId: node.nodeId, field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'ACCEPTED' }, reason: '정확 기준의 결과 검수와 필요한 사용자 확인 뒤 다음 단계로 진행한다.',
    }));
    const reworks = [[0, 0], [1, 0], [1, 1], [2, 2], [3, 2], [4, 4], [5, 4], [6, prefix === 'AG' ? 1 : 5]];
    reworks.forEach(([from, to], edgeIndex) => {
      const node = nodes[from!]!;
      const iteration = prefix === 'AG' && from === 6;
      edges.push({ edgeId: `${prefix}.REWORK.${edgeIndex + 1}`, fromNodeId: node.nodeId, toNodeId: nodes[to!]!.nodeId,
        kind: 'REWORK', condition: iteration ? { fieldRef: { nodeId: node.nodeId, field: 'USER_DECISION' }, operator: 'EQ', value: 'NEXT_ITERATION' } : { fieldRef: { nodeId: node.nodeId, field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'REWORK' },
        reason: stages[from!]![7]! + ' · 영향받은 미충족 범위만 보완, 의미/중요 위험 변경은 영향·승인·계획 개정 절차를 거친다.',
        retryPolicy: { maxAttempts: 3, onExhausted: 'USER_DECISION', counting: 'SAME_FAILURE_FINGERPRINT' } });
    });
    const graph = { nodes, edges, entryNodeId: nodes[0]!.nodeId, terminalNodeIds: [nodes[6]!.nodeId] };
    return { id: `a6f20000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, version: 2,
      systemCode: `SYS-M0${index + 1}`, name: names[index]!, purpose: goals[index]!, graph,
      contentHash: contentHash(canonicalJson(graph)), sourceHash: builtinSourceHash, runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
  });
}
