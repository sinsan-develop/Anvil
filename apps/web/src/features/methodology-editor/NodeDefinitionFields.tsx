import { useId } from 'react';
import type { MethodologyNode } from '../../../../../contracts/methodologies.ts';
import { ConditionEditor } from './ConditionEditor.tsx';

export function NodeDefinitionFields({ node, nodes, onChange }: { node: MethodologyNode; nodes: MethodologyNode[]; onChange: (patch: Partial<MethodologyNode>) => void }) {
  const id = useId();
  function kind(kind: MethodologyNode['kind']) {
    const next = { ...node, kind };
    if (kind === 'HUMAN') { next.role = 'USER'; next.mode = 'CASE_BY_CASE'; }
    if (kind === 'JOIN') next.joinRule ??= { mode: 'ALL' }; else delete next.joinRule;
    // 다른 속성은 보존하되 합류 규칙 제거는 kind 변경의 명시한 효과다.
    onChange({ ...next, joinRule: next.joinRule });
  }
  return <div className="graph-fields"><label htmlFor={id + '-kind'}>단계 유형</label><select id={id + '-kind'} value={node.kind} onChange={event => kind(event.target.value as MethodologyNode['kind'])}><option value="HUMAN">사용자 판단</option><option value="AGENT">도구 수행 역할</option><option value="DECISION">조건 판단</option><option value="JOIN">결과 합류</option></select>
    <label htmlFor={id + '-role'}>단계 책임 역할</label><select id={id + '-role'} value={node.role} onChange={event => onChange({ role: event.target.value as MethodologyNode['role'] })}><option value="USER">사용자</option><option value="COORDINATOR">총괄</option><option value="STAGE_OWNER">단계책임자</option></select>
    <label htmlFor={id + '-mode'}>단계 진행 방식</label><select id={id + '-mode'} value={node.mode} onChange={event => onChange({ mode: event.target.value as MethodologyNode['mode'] })}><option value="CASE_BY_CASE">건별</option><option value="AUTO">허용 범위 안 자동</option></select>
    <label htmlFor={id + '-included'}>포함 작업</label><textarea id={id + '-included'} value={node.taskScope.included.join('\n')} onChange={event => onChange({ taskScope: { ...node.taskScope, included: event.target.value.split('\n') } })} />
    <label htmlFor={id + '-excluded'}>제외 작업</label><textarea id={id + '-excluded'} value={node.taskScope.excluded.join('\n')} onChange={event => onChange({ taskScope: { ...node.taskScope, excluded: event.target.value.split('\n') } })} />
    <label htmlFor={id + '-approval'}>사용자 확인 지점 코드 · 한 줄에 하나</label><textarea id={id + '-approval'} value={node.approvalBoundary.join('\n')} onChange={event => onChange({ approvalBoundary: event.target.value ? event.target.value.split('\n') : [] })} />
    {node.kind === 'AGENT' ? <details><summary>도구에 요구할 능력·환경</summary><label htmlFor={id + '-capabilities'}>필요한 도구 능력</label><textarea id={id + '-capabilities'} value={node.requirements?.capabilities.join('\n') ?? ''} onChange={event => onChange({ requirements: { capabilities: event.target.value.split('\n'), environment: node.requirements?.environment ?? [] } })} /><label htmlFor={id + '-environment'}>필요한 개발환경</label><textarea id={id + '-environment'} value={node.requirements?.environment.join('\n') ?? ''} onChange={event => onChange({ requirements: { capabilities: node.requirements?.capabilities ?? [], environment: event.target.value.split('\n') } })} /><p className="meta">능력/환경 요구의 정의이며 실제 도구 배정·권한·한도 정책 연결은 아닙니다.</p></details> : null}
    {node.kind === 'JOIN' ? <><label htmlFor={id + '-join'}>합류 규칙</label><select id={id + '-join'} value={node.joinRule?.mode ?? 'ALL'} onChange={event => onChange({ joinRule: event.target.value === 'ALL' ? { mode: 'ALL' } : { mode: 'DECLARED_CONDITION', condition: node.joinRule?.condition ?? { fieldRef: { nodeId: nodes[0]?.nodeId ?? '', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'ACCEPTED' } } })}><option value="ALL">모든 선행 결과</option><option value="DECLARED_CONDITION">명시한 결과 조건</option></select>{node.joinRule?.mode === 'DECLARED_CONDITION' ? <ConditionEditor value={node.joinRule.condition ?? null} nodes={nodes} label="합류 조건" allowNone={false} onChange={condition => { if (condition) onChange({ joinRule: { mode: 'DECLARED_CONDITION', condition } }); }} /> : null}</> : null}
  </div>;
}
