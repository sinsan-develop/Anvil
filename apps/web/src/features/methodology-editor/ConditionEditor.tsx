import { useId } from 'react';
import type { GraphCondition, MethodologyNode } from '../../../../../contracts/methodologies.ts';

function basic(nodes: MethodologyNode[]): GraphCondition { return { fieldRef: { nodeId: nodes[0]?.nodeId ?? '', field: 'REVIEW_OUTCOME' }, operator: 'EQ', value: 'ACCEPTED' }; }
export function ConditionEditor({ value, nodes, onChange, label, depth = 0, allowNone = true }: { value: GraphCondition | null; nodes: MethodologyNode[]; onChange: (value: GraphCondition | null) => void; label: string; depth?: number; allowNone?: boolean }) {
  const id = useId();
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const mode = value === null ? 'NONE' : !record ? 'UNSUPPORTED' : 'all' in record && Array.isArray(record.all) ? 'ALL' : 'any' in record && Array.isArray(record.any) ? 'ANY' : 'not' in record ? 'NOT' : 'fieldRef' in record && record.fieldRef && typeof record.fieldRef.nodeId === 'string' ? 'COMPARE' : 'UNSUPPORTED';
  if (depth > 6) return <p role="alert">깊은 조건의 원문은 유지합니다. 이 화면에서는 상위 조건을 선택해 명시적으로 개정하세요.</p>;
  const children = record && 'all' in record && Array.isArray(record.all) ? record.all : record && 'any' in record && Array.isArray(record.any) ? record.any : [];
  const compare = mode === 'COMPARE' && record && 'fieldRef' in record ? record : null;
  function select(next: string) { onChange(next === 'NONE' ? null : next === 'ALL' ? { all: [basic(nodes)] } : next === 'ANY' ? { any: [basic(nodes)] } : next === 'NOT' ? { not: basic(nodes) } : basic(nodes)); }
  return <div className="condition-editor"><label htmlFor={id + '-mode'}>{label} 형식</label><select id={id + '-mode'} value={mode} onChange={event => select(event.target.value)}>
    {allowNone ? <option value="NONE">조건 없음</option> : null}<option value="COMPARE">판단 값 비교</option><option value="ALL">모두 충족</option><option value="ANY">하나 이상 충족</option><option value="NOT">조건의 반대</option>{mode === 'UNSUPPORTED' ? <option value="UNSUPPORTED">이전 계약 조건 · 자동 변환 안 함</option> : null}
  </select>
    {compare ? <>
      <label htmlFor={id + '-node'}>{label} 판단 단계</label><select id={id + '-node'} value={compare.fieldRef.nodeId} onChange={event => onChange({ ...compare, fieldRef: { ...compare.fieldRef, nodeId: event.target.value } })}>{!nodes.some(node=>node.nodeId===compare.fieldRef.nodeId)?<option value={compare.fieldRef.nodeId}>없는 단계 {compare.fieldRef.nodeId} · 원 참조 보존</option>:null}{nodes.map(node => <option key={node.nodeId} value={node.nodeId}>{node.name || node.nodeId}</option>)}</select>
      <label htmlFor={id + '-field'}>{label} 판단 필드</label><select id={id + '-field'} value={compare.fieldRef.field} onChange={event => onChange({ ...compare, fieldRef: { ...compare.fieldRef, field: event.target.value as 'REVIEW_OUTCOME' | 'USER_DECISION' } })}><option value="REVIEW_OUTCOME">검토 결과</option><option value="USER_DECISION">사용자 결정</option></select>
      <label htmlFor={id + '-operator'}>{label} 비교 방식</label><select id={id + '-operator'} value={compare.operator} onChange={event => {
        const operator = event.target.value;
        onChange(operator === 'IS_PRESENT' ? { fieldRef: compare.fieldRef, operator, value: null } : operator === 'IN' ? { fieldRef: compare.fieldRef, operator, value: Array.isArray(compare.value) ? compare.value : [compare.value ?? 'ACCEPTED'] } : { fieldRef: compare.fieldRef, operator: operator as 'EQ' | 'NE', value: Array.isArray(compare.value) ? compare.value[0] ?? 'ACCEPTED' : compare.value ?? 'ACCEPTED' });
      }}><option value="EQ">같음</option><option value="NE">다름</option><option value="IN">목록에 포함</option><option value="IS_PRESENT">판단 값 있음</option></select>
      {compare.operator === 'IN' ? <><label htmlFor={id + '-value'}>{label} 비교 값 목록 · 한 줄에 하나</label><textarea id={id + '-value'} value={compare.value.join('\n')} onChange={event => onChange({ ...compare, value: event.target.value.split('\n') })} /></> : compare.operator !== 'IS_PRESENT' ? <><label htmlFor={id + '-value'}>{label} 비교 값</label>{compare.fieldRef.field === 'REVIEW_OUTCOME' ? <select id={id + '-value'} value={compare.value} onChange={event => onChange({ ...compare, value: event.target.value })}><option value="ACCEPTED">적합</option><option value="REWORK">보완 필요</option><option value="BLOCKED">진행 불가</option></select> : <input id={id + '-value'} value={compare.value} onChange={event => onChange({ ...compare, value: event.target.value })} />}</> : null}
    </> : null}
    {(mode === 'ALL' || mode === 'ANY') && value ? <>{children.map((child, index) => <div key={index}><ConditionEditor value={child} nodes={nodes} label={`${label} ${index + 1}`} depth={depth + 1} allowNone={false} onChange={next => { if (next) { const items = children.map((item, at) => at === index ? next : item); onChange(mode === 'ALL' ? { all: items } : { any: items }); } }} /><button disabled={children.length <= 1} onClick={() => { const items = children.filter((_, at) => at !== index); onChange(mode === 'ALL' ? { all: items } : { any: items }); }}>이 하위 조건 제거</button></div>)}<button disabled={children.length >= 20} onClick={() => onChange(mode === 'ALL' ? { all: [...children, basic(nodes)] } : { any: [...children, basic(nodes)] })}>하위 조건 추가</button></> : null}
    {record && 'not' in record ? <ConditionEditor value={record.not} nodes={nodes} label={label + ' 반대 대상'} depth={depth + 1} allowNone={false} onChange={next => { if (next) onChange({ not: next }); }} /> : null}
    <p className="meta">조건은 저장된 판단 자료를 비교하는 정의입니다. 실제 결과·승인·실행을 만들지 않습니다.</p>
  </div>;
}
