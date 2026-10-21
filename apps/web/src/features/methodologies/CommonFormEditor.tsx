import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { writeCommonMethod as writeCommonFormDraft, type MethodCommand } from '../methodology-editor/common-api.ts';
import { getForm, type FormVersion } from './forms-api.ts';
import { emptyFormBuffer, formBuffer, removeFormRepeatField, changeFormItemType, type FormBuffer } from './form-editor-state.ts';
import type { FormDefinition, FormItem } from '../../../../server/modules/documents/forms.ts';

export function CommonFormEditor({ client, session, source, buffer, onChange, onAuthenticationLost, onSaved }: {
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; source: FormVersion | null;
  buffer: FormBuffer; onChange: Dispatch<SetStateAction<FormBuffer>>; onAuthenticationLost: () => void; onSaved: () => void;
}) {
  const fieldId = useId();
  const [copyName, setCopyName] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [saved, setSaved] = useState<number | null>(null);
  const definition = buffer.definition, item = definition?.items.find(value => value.itemId === buffer.itemId), locked = pending || !!buffer.pending || !!buffer.review?.pending;
  function replaceAllowed() { return !buffer.pending && !buffer.review?.pending && (!(buffer.dirty || buffer.review?.dirty) || confirm('미저장 양식 편집·내용 검토 입력을 바꿀까요?')); }
  function change(patch: Partial<FormDefinition>) { onChange(previous => previous.definition ? { ...previous, dirty: true, definition: { ...previous.definition, ...patch } } : previous); setSaved(null); }
  function changeItem(patch: Partial<FormItem>) { if (definition) change({ items: definition.items.map(value => value.itemId === buffer.itemId ? { ...value, ...patch } : value) }); }
  async function submit(request: MethodCommand, name: string, formCode: string) {
    if (pending || request.clientId !== session.clientId) return;
    const work = { request, name, formCode };
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, pending: work })); setPending(true); setError(null); setSaved(null);
    let applied = false;
    try {
      const ref = await writeCommonFormDraft(client, request, session.csrfToken, session.user.id); applied = true;
      const value = await getForm(client, { ref, name, formCode, scope: 'USER_COMMON' });
      onChange(previous => previous.pending?.request.commandId === request.commandId ? { ...formBuffer(value, session.user.id), review: previous.review } : previous);
      setSaved(ref.version); onSaved();
    } catch (cause: unknown) {
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (!applied && failure.status >= 400 && failure.status < 500 && failure.code !== 'RESPONSE_INVALID') onChange(previous => ({ ...previous, pending: null }));
      if (failure.status === 401) onAuthenticationLost();
    } finally { setPending(false); }
  }
  function copy() {
    if (!source || locked || !copyName.trim() || !replaceAllowed()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'copyForm', targetId: null, expectedVersion: 0, clientId: session.clientId,
      payload: { sourceRef: source.ref, name: copyName, scope: 'USER_COMMON', reason: '선택한 원본을 내 양식으로 복사' } }, copyName, source.definition.formCode);
  }
  function save() {
    if (!definition || locked || !definition.name.trim() || !definition.formCode.trim() || !buffer.reason.trim()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'saveFormDraft', targetId: buffer.targetId, expectedVersion: buffer.version, clientId: session.clientId,
      payload: { definition, reason: buffer.reason } }, definition.name, definition.formCode);
  }
  function addItem() {
    if (!definition || definition.items.length >= 200) return;
    const itemId = 'ITEM-' + crypto.randomUUID().slice(0, 8);
    const next: FormItem = { itemId, title: '', required: true, valueType: 'TEXT', repeated: false, fields: [], authoringRules: [], reviewCriteria: [] };
    change({ items: [...definition.items, next] }); onChange(previous => ({ ...previous, itemId }));
  }
  function changeType(valueType:'TEXT'|'RECORDS'){
    if(locked||!item||item.valueType===valueType)return;
    const acknowledged=valueType!=='TEXT'||!item.fields.length||confirm('일반 텍스트로 전환하면 이 초안의 반복 필드 '+item.fields.length+'개가 사라집니다. 기존 저장 버전·항목 ID·작성/검수 규칙은 유지하며 저장은 별도입니다. 전환할까요?');
    if(!acknowledged)return;
    try{const updated=changeFormItemType(buffer,session.user.id,item.itemId,valueType,acknowledged);onChange(previous=>previous===buffer?updated:previous);setSaved(null);setError(null);}
    catch(cause){setError(cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID'));}
  }
  function removeField(itemId:string,repeatFieldId:string){
    if(locked||!confirm('이 초안의 선택 반복 필드만 제거할까요? 항목 규칙·다른 필드·서버 원본은 유지하며 저장은 별도로 합니다.'))return;
    try{const updated=removeFormRepeatField(buffer,session.user.id,itemId,repeatFieldId);onChange(previous=>previous===buffer?updated:previous);setSaved(null);setError(null);}
    catch(cause){setError(cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID'));}
  }
  if (buffer.ownerUserId && buffer.ownerUserId !== session.user.id) return <section><p role="alert">다른 로그인 사용자의 양식 편집은 표시하거나 전송하지 않습니다.</p><button onClick={() => { if (confirm('이 탭의 이전 사용자 양식 편집만 버릴까요? 서버 자료는 유지합니다.')) onChange(emptyFormBuffer()); }}>탭의 이전 양식 편집 닫기</button></section>;
  return <section className="status-card definition-editor" aria-label="내 공통 양식 작업"><h3>내 양식 작성·개정</h3><p className="meta">공식 8종·구버전은 보존합니다. 초안 저장은 내용 검토·사용자 확정이 아닙니다.</p>
    <fieldset disabled={locked}><label>양식 복사본 이름<input maxLength={200} value={copyName} onChange={event => setCopyName(event.target.value)} /></label><button disabled={!source || !copyName.trim()} onClick={copy}>내 공통 양식으로 복사</button>
      <button disabled={!source} onClick={() => { if (source && replaceAllowed()) { onChange({ ...emptyFormBuffer(), ownerUserId: session.user.id, dirty: true, definition: { formCode: 'USER01', name: '새 양식', purpose: '', scope: 'USER_COMMON', authorRole: '', reviewerRole: '', confirmerRole: '', requiredInputs: [], items: [], authoringStandardRef: source.authoringStandard.ref } }); setSaved(null); setError(null); } }}>새 양식 작성</button>
      {source?.definition.scope === 'USER_COMMON' ? <button onClick={() => { if (replaceAllowed()) { onChange(formBuffer(source, session.user.id)); setSaved(null); setError(null); } }}>이 공통 양식 편집</button> : null}
    </fieldset>
    {definition ? <section aria-label="공통 양식 편집"><p className="meta">{buffer.targetId ? `저장 기준 버전 ${buffer.version}` : '새 양식 · 저장 전'}{buffer.dirty ? ' · 미저장 변경 있음' : ''}</p><fieldset disabled={locked}>
      <label>양식 코드<input maxLength={200} value={definition.formCode} onChange={event => change({ formCode: event.target.value })} /></label><label>양식 이름<input maxLength={200} value={definition.name} onChange={event => change({ name: event.target.value })} /></label>
      <label htmlFor={fieldId + '-purpose'}>양식 목적</label><textarea id={fieldId + '-purpose'} value={definition.purpose} onChange={event => change({ purpose: event.target.value })} />
      <label>작성 역할<input value={definition.authorRole} onChange={event => change({ authorRole: event.target.value })} /></label><label>검토 역할<input value={definition.reviewerRole} onChange={event => change({ reviewerRole: event.target.value })} /></label><label>확정 역할<input value={definition.confirmerRole} onChange={event => change({ confirmerRole: event.target.value })} /></label>
      <label htmlFor={fieldId + '-inputs'}>양식 필수 입력 자료</label><textarea id={fieldId + '-inputs'} value={definition.requiredInputs.join('\n')} onChange={event => change({ requiredInputs: event.target.value.split('\n') })} />
      <div className="methodology-flow">{definition.items.map(value => <button key={value.itemId} aria-pressed={value.itemId === buffer.itemId} onClick={() => onChange(previous => ({ ...previous, itemId: value.itemId }))}>{value.title || value.itemId} 편집</button>)}</div><button disabled={definition.items.length >= 200} onClick={addItem}>양식 항목 추가</button>
      {item ? <div><p className="meta">안정 항목 ID {item.itemId}</p><label>양식 항목 제목<input value={item.title} onChange={event => changeItem({ title: event.target.value })} /></label><label><input type="checkbox" checked={item.required} onChange={event => changeItem({ required: event.target.checked })} />필수 항목</label>
        <label htmlFor={fieldId+'-item-type'}>양식 항목 형식</label><select id={fieldId+'-item-type'} value={item.valueType} onChange={event=>changeType(event.target.value as 'TEXT'|'RECORDS')}><option value="TEXT">일반 텍스트</option><option value="RECORDS">반복 행</option></select>
        {item.valueType==='RECORDS'&&!item.fields.length?<p role="status">반복 항목의 필드를 추가해야 합니다. 초안 저장과 내용 확정은 다릅니다.</p>:null}
        <label htmlFor={fieldId + '-rules'}>항목 작성 규칙</label><textarea id={fieldId + '-rules'} value={item.authoringRules.join('\n')} onChange={event => changeItem({ authoringRules: event.target.value.split('\n') })} />
        <label htmlFor={fieldId + '-review'}>항목 검토 기준</label><textarea id={fieldId + '-review'} value={item.reviewCriteria.join('\n')} onChange={event => changeItem({ reviewCriteria: event.target.value.split('\n') })} />
        {item.fields.map(field => <div key={field.fieldId}><label>반복 필드 {field.fieldId}<input value={field.title} onChange={event => changeItem({ fields: item.fields.map(value => value.fieldId === field.fieldId ? { ...value, title: event.target.value } : value) })} /></label><label><input type="checkbox" aria-label={'반복 필드 '+field.fieldId+' 필수'} checked={field.required} onChange={event => changeItem({ fields: item.fields.map(value => value.fieldId === field.fieldId ? { ...value, required: event.target.checked } : value) })} />필수 필드</label><button type="button" aria-label={'반복 필드 '+field.fieldId+' 제거'} onClick={()=>removeField(item.itemId,field.fieldId)}>이 반복 필드 제거</button></div>)}
        <button disabled={item.fields.length >= 200} onClick={() => changeItem({ valueType: 'RECORDS', repeated: true, fields: [...item.fields, { fieldId: 'FIELD-' + crypto.randomUUID().slice(0, 8), title: '', required: true, valueType: 'TEXT' }] })}>반복 필드 추가</button>
        <button onClick={() => { if (confirm('이 초안에서 선택 항목을 뺄까요? 기존 저장 버전은 유지됩니다.')) { change({ items: definition.items.filter(value => value.itemId !== item.itemId) }); onChange(previous => ({ ...previous, itemId: '' })); } }}>이 초안의 항목 제거</button>
      </div> : null}
      <label htmlFor={fieldId + '-reason'}>양식 개정 이유</label><textarea id={fieldId + '-reason'} value={buffer.reason} onChange={event => { onChange(previous => ({ ...previous, reason: event.target.value, dirty: true })); setSaved(null); }} />
      <button disabled={!buffer.dirty || !definition.name.trim() || !definition.formCode.trim() || !buffer.reason.trim()} onClick={save}>공통 양식 새 버전 저장</button>
    </fieldset></section> : null}
    {pending ? <p role="status">양식 저장·재조회를 확인하고 있습니다.</p> : null}
    {buffer.pending && !pending ? <><p role="alert">양식 저장 결과 미확인 · 새 명령 대신 같은 명령을 확인하세요.</p><button disabled={buffer.pending.request.clientId !== session.clientId} onClick={() => { const work = buffer.pending!; void submit(work.request, work.name, work.formCode); }}>같은 양식 명령 결과 확인</button></> : null}
    {error ? <p role="alert">{error.message} 입력과 미확인 명령은 보존했습니다.</p> : null}
    {saved ? <p role="status">양식 서버 저장·재조회 확인 · 버전 {saved}</p> : null}
  </section>;
}
