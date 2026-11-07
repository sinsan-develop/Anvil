import { useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { watchPinnedForm, type PinnedFormState } from './pinned-form-read.ts';

export interface PinnedFormAccess { client: ApiClient; contextKey: string; onAuthenticationLost: () => void }

export function PinnedFormResult({ state }: { state: PinnedFormState }) {
 if (state.status === 'LOADING') return <p role="status">고정 양식 원문 조회 중</p>;
 if (state.status === 'ERROR') return <p role="alert">{state.error.message} · {state.error.code} · 고정 원문 미확인. 다른 버전으로 대체하지 않습니다.</p>;
 const { ref, definition: form, authoringStandard } = state.data;
 return <section aria-label="고정 양식 원문" className="status-card"><h4>{form.formCode} {form.name}</h4>
  <p className="meta" style={{ overflowWrap: 'anywhere' }}>{ref.id} · v{ref.version} · {ref.contentHash}</p><p>{form.purpose}</p>
  <p className="meta">지정된 버전의 읽기 조회입니다. 내용 적합·사용자 확정·프로젝트 적용·실제 작성 완료를 뜻하지 않습니다.</p>
  {form.items.length ? form.items.map(item => <section key={item.itemId}><h5>{item.itemId}: {item.title}</h5><p>{item.required ? '필수' : '선택'} · {item.repeated ? '반복' : '단일'} · {item.valueType}</p>
   <h6>작성 규칙</h6>{item.authoringRules.length ? <ul>{item.authoringRules.map((rule, i) => <li key={i}>{rule}</li>)}</ul> : <p>작성 규칙 미작성</p>}
   {item.fields.length ? <ul>{item.fields.map(field => <li key={field.fieldId}>{field.fieldId}: {field.title} · {field.required ? '필수' : '선택'} · {field.valueType}</li>)}</ul> : null}
   <details><summary>항목 검수 규칙</summary>{item.reviewCriteria.length ? <ul>{item.reviewCriteria.map((rule, i) => <li key={i}>{rule}</li>)}</ul> : <p>검수 규칙 미작성</p>}</details>
  </section>) : <p>양식 항목 미작성</p>}
  <details><summary>작성·검토·확정 역할과 필수 입력</summary><p>작성 {form.authorRole} · 검토 {form.reviewerRole} · 확정 {form.confirmerRole}</p>{form.requiredInputs.length ? <ul>{form.requiredInputs.map((input, i) => <li key={i}>{input}</li>)}</ul> : <p>필수 입력 미작성</p>}</details>
  <details><summary>이 양식에 고정된 문서 작성 공통 기준</summary><p className="meta" style={{ overflowWrap: 'anywhere' }}>{authoringStandard.ref.id} · v{authoringStandard.ref.version} · {authoringStandard.ref.contentHash}</p><pre className="document-plain">{authoringStandard.content}</pre></details>
 </section>;
}

export function PinnedFormOriginal({ client, formRef, onAuthenticationLost }: { client: ApiClient; formRef: VersionRef; onAuthenticationLost: () => void }) {
 const identity = JSON.stringify([formRef.id, formRef.version, formRef.contentHash]);
 const [result, setResult] = useState<{ client: ApiClient; identity: string; state: PinnedFormState } | null>(null);
 const cancel = useRef<(() => void) | null>(null);
 useEffect(() => () => { cancel.current?.(); }, [client, identity]);
 const state = result?.client === client && result.identity === identity ? result.state : null;
 function open() {
  cancel.current?.(); setResult({ client, identity, state: { status: 'LOADING' } });
  cancel.current = watchPinnedForm(client, formRef, next => setResult({ client, identity, state: next }), onAuthenticationLost);
 }
 function close() { cancel.current?.(); cancel.current = null; setResult(null); }
 return <div><button type="button" disabled={state?.status === 'LOADING'} onClick={open}>고정 양식 원문 보기</button>
  {state ? <><button type="button" onClick={close}>양식 원문 닫기</button><PinnedFormResult state={state} /></> : null}
 </div>;
}
