import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { writeCommonMethod as writeCommonFormDraft, type MethodCommand } from '../methodology-editor/common-api.ts';
import { getForm, type FormVersion } from './forms-api.ts';
import { emptyFormBuffer, formBuffer, removeFormRepeatField, removeDuplicateFormRepeatField, changeFormItemType, moveFormEntry, type FormBuffer, type DuplicateFormFieldSelection } from './form-editor-state.ts';
import type { FormDefinition, FormItem } from '../../../../server/modules/documents/forms.ts';

export function CommonFormEditor({ client, session, source, buffer, onChange, onAuthenticationLost, onSaved, copySelection }: {
  client: ApiClient; session: { user: { id: string }; clientId: string; csrfToken: string }; source: FormVersion | null;
  buffer: FormBuffer; onChange: Dispatch<SetStateAction<FormBuffer>>; onAuthenticationLost: () => void; onSaved: () => void; copySelection?: {source:FormVersion;current:()=>boolean;clear:()=>void};
}) {
  const fieldId = useId();
  const [copyName, setCopyName] = useState(''), [pending, setPending] = useState(false), [error, setError] = useState<ApiError | null>(null), [saved, setSaved] = useState<number | null>(null);
  const definition = buffer.definition, item = definition?.items.find(value => value.itemId === buffer.itemId), locked = pending || !!buffer.pending || !!buffer.review?.pending;
  const [duplicateSelection,setDuplicateSelection]=useState<DuplicateFormFieldSelection|null>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const latest=useRef({buffer,locked,client,userId:session.user.id,clientId:session.clientId,csrfToken:session.csrfToken,source,onChange});
  latest.current={buffer,locked,client,userId:session.user.id,clientId:session.clientId,csrfToken:session.csrfToken,source,onChange};
  const executionScope=useRef<{session:typeof session;userId:string;clientId:string;csrf:string;client:ApiClient;transport:typeof fetch;source:FormVersion|null;sourceRef:string}|null>(null),sending=useRef(false);
  const observed=executionScope.current,sourceRef=JSON.stringify(source?.ref);
  if(!observed||observed.session!==session||observed.userId!==session.user.id||observed.clientId!==session.clientId||observed.csrf!==session.csrfToken||observed.client!==client||observed.transport!==client.transport||observed.source!==source||observed.sourceRef!==sourceRef)executionScope.current={session,userId:session.user.id,clientId:session.clientId,csrf:session.csrfToken,client,transport:client.transport,source,sourceRef};
  const scope=executionScope.current!;
  const executionCurrent=()=>alive.current&&executionScope.current===scope&&client.transport===scope.transport&&session.user.id===scope.userId&&session.clientId===scope.clientId&&session.csrfToken===scope.csrf&&JSON.stringify(source?.ref)===scope.sourceRef;
  const duplicateFields=item?.fields.flatMap((field,index)=>item.fields.filter(value=>value.fieldId===field.fieldId).length>1?[{field,index}]:[])??[];
  const selectedDuplicate=duplicateSelection?.buffer===buffer&&duplicateSelection.fields===item?.fields&&duplicateSelection.contextFingerprint===JSON.stringify(buffer)?duplicateFields.find(value=>value.index===duplicateSelection.index&&value.field===duplicateSelection.field&&JSON.stringify(value.field)===duplicateSelection.fingerprint):undefined;
  function removeDuplicateField(){
    if(!alive.current||locked||!selectedDuplicate||!duplicateSelection)return;
    const selected=duplicateSelection,captured=latest.current;
    function current(){const now=latest.current;return alive.current&&!now.locked&&now.buffer===selected.buffer&&now.client===captured.client&&now.userId===captured.userId&&now.clientId===captured.clientId&&now.csrfToken===captured.csrfToken&&now.source===captured.source&&now.onChange===captured.onChange;}
    try{
      if(!current())return;removeDuplicateFormRepeatField(captured.buffer,captured.userId,selected);
      if(!confirm(`현재 초안의 ${selected.index+1}번째 반복 필드 정의 ${selected.field.title||'제목 미작성'} (${selected.field.fieldId}, ${selected.field.required?'필수':'선택'}) 하나만 제거할까요? 같은 ID의 다른 정의·항목 규칙·저장 원본은 유지하며 저장은 별도입니다.`))return;
      if(!current())return;removeDuplicateFormRepeatField(latest.current.buffer,latest.current.userId,selected);
      latest.current.onChange(previous=>{if(!current())return previous;try{return removeDuplicateFormRepeatField(previous,latest.current.userId,selected);}catch{return previous;}});
      setDuplicateSelection(null);setSaved(null);setError(null);
    }catch(cause){if(alive.current)setError(cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID'));}
  }
  function replaceAllowed() { return !buffer.pending && !buffer.review?.pending && (!(buffer.dirty || buffer.review?.dirty) || confirm('미저장 양식 편집·내용 검토 입력을 바꿀까요?')); }
  function change(patch: Partial<FormDefinition>) { onChange(previous => previous.definition ? { ...previous, dirty: true, definition: { ...previous.definition, ...patch } } : previous); setSaved(null); }
  function changeItem(patch: Partial<FormItem>) { if (definition) change({ items: definition.items.map(value => value.itemId === buffer.itemId ? { ...value, ...patch } : value) }); }
  async function submit(request: MethodCommand, name: string, formCode: string,copyCurrent?:()=>boolean) {
    if (sending.current || pending || request.clientId !== session.clientId || !executionCurrent() || copyCurrent&&!copyCurrent()) return;
    const work = { request, name, formCode };sending.current=true;
    onChange(previous => ({ ...previous, ownerUserId: session.user.id, pending: work })); setPending(true); setError(null); setSaved(null);
    const current=()=>executionCurrent()&&(!copyCurrent||copyCurrent());
    let applied = false;
    try {
      const ref = await writeCommonFormDraft(client, request, session.csrfToken, session.user.id); applied = true;
      if(!current())return;
      const value = await getForm(client, { ref, name, formCode, scope: 'USER_COMMON' });
      if(!current())return;
      onChange(previous => current()&&previous.pending?.request.commandId === request.commandId&&!previous.review?.pending ? { ...formBuffer(value, session.user.id), review: previous.review } : previous);
      setSaved(ref.version); onSaved();
    } catch (cause: unknown) {
      if(!current())return;
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (!applied && failure.status >= 400 && failure.status < 500 && failure.code !== 'RESPONSE_INVALID') onChange(previous => current()&&previous.pending?.request.commandId===request.commandId ? { ...previous, pending: null } : previous);
      if (failure.status === 401) onAuthenticationLost();
    } finally { sending.current=false;if(alive.current)setPending(false); }
  }
  function copy() {
    const copySource=copySelection?.source??source,guard=copySelection?.current;
    if (!copySource || locked || sending.current || !copyName.trim() || !executionCurrent() || guard&&!guard() || !replaceAllowed() || !executionCurrent() || guard&&!guard()) return;
    void submit({ schemaVersion: 1, commandId: crypto.randomUUID(), operation: 'copyForm', targetId: null, expectedVersion: 0, clientId: session.clientId,
      payload: { sourceRef: copySource.ref, name: copyName, scope: 'USER_COMMON', reason: '선택한 원본을 내 양식으로 복사' } }, copyName, copySource.definition.formCode,guard);
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
  function moveEntry(fieldId:string|null,direction:-1|1){
    if(locked||!item)return;
    try{const updated=moveFormEntry(buffer,session.user.id,item.itemId,fieldId,direction);onChange(previous=>previous===buffer?updated:previous);if(updated!==buffer){setSaved(null);setError(null);}}
    catch(cause){setError(cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID'));}
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
    {copySelection&&copySelection.current()?<p className="meta">복사 전용 과거 원본: v{copySelection.source.ref.version} · {copySelection.source.definition.formCode} {copySelection.source.definition.name}<button disabled={locked} onClick={()=>{if(!locked&&executionCurrent()&&copySelection.current())copySelection.clear();}}>과거 복사 원본 해제</button></p>:null}
    <fieldset disabled={locked}><label>양식 복사본 이름<input maxLength={200} value={copyName} onChange={event => setCopyName(event.target.value)} /></label><button disabled={!(copySelection?.source??source) || !copyName.trim() || !!copySelection&&!copySelection.current()} onClick={copy}>내 공통 양식으로 복사</button>
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
        <button type="button" disabled={definition.items[0]===item} aria-label={'양식 항목 '+item.itemId+' 위로 이동'} onClick={()=>moveEntry(null,-1)}>이 항목 위로</button><button type="button" disabled={definition.items.at(-1)===item} aria-label={'양식 항목 '+item.itemId+' 아래로 이동'} onClick={()=>moveEntry(null,1)}>이 항목 아래로</button>
        <label htmlFor={fieldId+'-item-type'}>양식 항목 형식</label><select id={fieldId+'-item-type'} value={item.valueType} onChange={event=>changeType(event.target.value as 'TEXT'|'RECORDS')}><option value="TEXT">일반 텍스트</option><option value="RECORDS">반복 행</option></select>
        {item.valueType==='RECORDS'&&!item.fields.length?<p role="status">반복 항목의 필드를 추가해야 합니다. 초안 저장과 내용 확정은 다릅니다.</p>:null}
        <label htmlFor={fieldId + '-rules'}>항목 작성 규칙</label><textarea id={fieldId + '-rules'} value={item.authoringRules.join('\n')} onChange={event => changeItem({ authoringRules: event.target.value.split('\n') })} />
        <label htmlFor={fieldId + '-review'}>항목 검토 기준</label><textarea id={fieldId + '-review'} value={item.reviewCriteria.join('\n')} onChange={event => changeItem({ reviewCriteria: event.target.value.split('\n') })} />
        {duplicateFields.length&&item.valueType==='RECORDS'&&item.repeated?<section aria-label="중복 반복 필드 복구"><h4>중복 반복 필드 정의 확인</h4>
          <p role="alert">같은 필드 ID가 여러 번 정의되어 해당 필드의 일반 수정·이동·제거를 중단했습니다. 각 정의의 위치·제목·필수 여부를 확인하고 불필요한 정의 하나씩 제거하세요.</p>
          <label htmlFor={fieldId+'-duplicate-field'}>제거할 중복 반복 필드 정의</label><select id={fieldId+'-duplicate-field'} value={selectedDuplicate?.index??''} onChange={event=>{const index=Number(event.target.value),field=item.fields[index];setDuplicateSelection(event.target.value===''||!field?null:{buffer,itemId:item.itemId,fields:item.fields,index,field,fingerprint:JSON.stringify(field),contextFingerprint:JSON.stringify(buffer)});}}><option value="">제거할 정의를 선택하세요</option>{duplicateFields.map(({field,index})=><option key={index} value={index}>{index+1}번째 · {field.fieldId} · {field.title||'제목 미작성'} · {field.required?'필수':'선택'}</option>)}</select>
          {selectedDuplicate?<pre aria-label="선택한 중복 반복 필드 정의" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(selectedDuplicate.field,null,2)}</pre>:null}
          <button type="button" disabled={!selectedDuplicate||locked} onClick={removeDuplicateField}>확인한 중복 필드 정의 하나만 제거</button><p className="meta">같은 ID의 다른 정의와 다른 필드·항목 규칙은 유지합니다. 이 초안의 선택 정의만 제거하며 서버 저장·내용 검토·확정은 별도입니다.</p>
        </section>:null}
        {item.fields.map((field,index) => {const duplicate=duplicateFields.some(value=>value.index===index);return <div key={index}><label>반복 필드 {field.fieldId}<input disabled={duplicate} value={field.title} onChange={event => {if(!duplicate)changeItem({ fields: item.fields.map(value => value.fieldId === field.fieldId ? { ...value, title: event.target.value } : value) });}} /></label><label><input type="checkbox" disabled={duplicate} aria-label={'반복 필드 '+field.fieldId+' 필수'} checked={field.required} onChange={event => {if(!duplicate)changeItem({ fields: item.fields.map(value => value.fieldId === field.fieldId ? { ...value, required: event.target.checked } : value) });}} />필수 필드</label><button type="button" disabled={!!duplicateFields.length||item.fields[0]===field} aria-label={'반복 필드 '+field.fieldId+' 왼쪽 이동'} onClick={()=>moveEntry(field.fieldId,-1)}>이 열 왼쪽</button><button type="button" disabled={!!duplicateFields.length||item.fields.at(-1)===field} aria-label={'반복 필드 '+field.fieldId+' 오른쪽 이동'} onClick={()=>moveEntry(field.fieldId,1)}>이 열 오른쪽</button><button type="button" disabled={duplicate} aria-label={'반복 필드 '+field.fieldId+' 제거'} onClick={()=>removeField(item.itemId,field.fieldId)}>이 반복 필드 제거</button></div>;})}
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
