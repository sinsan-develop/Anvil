import { useId } from 'react';
import type { MethodologyDocumentItem, MethodologyNode } from '../../../../../contracts/methodologies.ts';
import type { FormSummary } from '../methodologies/forms-api.ts';
import {PinnedFormOriginal,type PinnedFormAccess} from '../methodologies/PinnedFormOriginal.tsx';

const refKey = (ref: MethodologyDocumentItem['formRef']) => `${ref.id}:${ref.version}:${ref.contentHash}`;
export function NodeDocumentFields({ node, nodes, forms, onChange,formAccess }: { node: MethodologyNode; nodes: MethodologyNode[]; forms: FormSummary[]; onChange: (patch: Partial<MethodologyNode>) => void;formAccess?:PinnedFormAccess }) {
  const id = useId();
  function patch(side: 'inputs' | 'outputs', itemId: string, patch: Partial<MethodologyDocumentItem>) { onChange({ [side]: node[side].map(item => item.itemId === itemId ? { ...item, ...patch } : item) }); }
  function add(side: 'inputs' | 'outputs') {
    const first = forms[0]; if (!first || node[side].length >= 200) return;
    onChange({ [side]: [...node[side], { itemId: node.nodeId + (side === 'inputs' ? '-IN-' : '-OUT-') + crypto.randomUUID().slice(0, 8), formRef: first.ref, required: true, reviewCriteria: [] }] });
  }
  return <details><summary>단계의 입력·산출 문서 양식</summary><p className="meta">양식 ID/버전/hash를 고정합니다. 선택만으로 문서·검토·실제 작업을 생성하지 않습니다.</p>
    {(['inputs', 'outputs'] as const).map(side => <section key={side}><h4>{side === 'inputs' ? '입력 문서' : '산출 문서'}</h4><button disabled={!forms.length || node[side].length >= 200} onClick={() => add(side)}>{side === 'inputs' ? '입력 문서 추가' : '산출 문서 추가'}</button>
      {node[side].map((item, index) => <div className="graph-fields" key={item.itemId}><p className="meta">{item.itemId}</p><label htmlFor={`${id}-${side}-${index}-form`}>{side === 'inputs' ? '입력' : '산출'} {index + 1} 양식</label><select id={`${id}-${side}-${index}-form`} value={refKey(item.formRef)} onChange={event => { const selected = forms.find(form => refKey(form.ref) === event.target.value); if (selected) patch(side, item.itemId, { formRef: selected.ref }); }}>
        {!forms.some(form => refKey(form.ref) === refKey(item.formRef)) ? <option value={refKey(item.formRef)}>기존 고정 양식 {item.formRef.id} / v{item.formRef.version} · 현재 목록에서 미확인</option> : null}{forms.map(form => <option key={refKey(form.ref)} value={refKey(form.ref)}>{form.formCode} {form.name} / v{form.ref.version}</option>)}
      </select><label><input type="checkbox" checked={item.required} onChange={event => patch(side, item.itemId, { required: event.target.checked })} />필수 문서</label>
        {formAccess?<section aria-label={`${side==='inputs'?'입력':'산출'} 문서 ${index+1} 고정 양식 확인`}><PinnedFormOriginal key={JSON.stringify([formAccess.contextKey,node.nodeId,side,item.itemId,item.formRef])} client={formAccess.client} formRef={item.formRef} onAuthenticationLost={formAccess.onAuthenticationLost}/></section>:null}
        {side === 'inputs' ? <><label htmlFor={`${id}-${side}-${index}-source`}>입력 {index + 1} 원본 단계</label><select id={`${id}-${side}-${index}-source`} value={item.sourceNodeId ?? ''} onChange={event => {
          const next = { ...item }; if (event.target.value) next.sourceNodeId = event.target.value; else delete next.sourceNodeId;
          onChange({ inputs: node.inputs.map(value => value.itemId === item.itemId ? next : value) });
        }}><option value="">외부 입력·단계 미지정</option>{item.sourceNodeId && !nodes.some(value => value.nodeId === item.sourceNodeId) ? <option value={item.sourceNodeId}>없는 단계 {item.sourceNodeId}</option> : null}{nodes.filter(value => value.nodeId !== node.nodeId).map(value => <option key={value.nodeId} value={value.nodeId}>{value.name || value.nodeId}</option>)}</select></> : null}
        <label htmlFor={`${id}-${side}-${index}-criteria`}>{side === 'inputs' ? '입력' : '산출'} {index + 1} 내용 검수 기준</label><textarea id={`${id}-${side}-${index}-criteria`} value={item.reviewCriteria.join('\n')} onChange={event => patch(side, item.itemId, { reviewCriteria: event.target.value.split('\n') })} />
        <button onClick={() => { if (confirm('이 초안의 문서 항목을 뺄까요? 원본 양식·저장된 버전은 유지합니다.')) onChange({ [side]: node[side].filter(value => value.itemId !== item.itemId) }); }}>이 문서 항목 제거</button>
      </div>)}
    </section>)}
  </details>;
}
