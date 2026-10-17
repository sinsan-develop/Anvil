import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { getPinnedForm, type FormVersion } from '../methodologies/forms-api.ts';

export function WorkspaceForm({ client, title, formRef, onAuthenticationLost }: { client: ApiClient; title: string; formRef: VersionRef; onAuthenticationLost: () => void }) {
  const [revision, setRevision] = useState(0), [pending, setPending] = useState(false);
  const [value, setValue] = useState<FormVersion | null>(null), [error, setError] = useState<ApiError | null>(null);
  useEffect(() => {
    if (!revision) return;
    let current = true;
    getPinnedForm(client, formRef).then(result => { if (current) setValue(result); }).catch((cause: unknown) => {
      if (!current) return;
      const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, formRef.id, formRef.version, formRef.contentHash, revision]);
  return <section aria-label={`단계 양식 원본: ${title}`}>
    <button aria-label={`양식 원본: ${title}`} disabled={pending} onClick={() => { setValue(null); setError(null); setPending(true); setRevision(previous => previous + 1); }}>{revision ? '이 양식 다시 조회' : '연결 양식 원본 조회'}</button>
    {pending ? <p role="status">고정 양식 버전 조회 중</p> : null}
    {error ? <p role="alert">{error.code} · 양식 원본 미확인</p> : null}
    {value && !pending && !error ? <article>
      <h5>{value.definition.formCode} {value.definition.name}</h5>
      <p className="meta">버전 {value.ref.version} · {value.ref.contentHash}</p><p>{value.definition.purpose}</p>
      <p className="meta">현재 원문 조회는 단계 수행 준비·문서 확정을 뜻하지 않습니다.</p>
      <ol>{value.definition.items.map(item => <li key={item.itemId}>
        <h6>{item.title}</h6><p>{item.itemId} · {item.required ? '필수' : '선택'} · {item.repeated ? '반복 항목' : '단일 항목'}</p>
        <ul>{item.authoringRules.map((text, index) => <li key={index}>{text}</li>)}</ul>
        {item.fields.length ? <ul>{item.fields.map(field => <li key={field.fieldId}>{field.title} · {field.required ? '필수' : '선택'}</li>)}</ul> : null}
        <p>검수 기준</p><ul>{item.reviewCriteria.map((text, index) => <li key={index}>{text}</li>)}</ul>
      </li>)}</ol>
      <details><summary>작성 역할·선행 자료</summary><p>작성 {value.definition.authorRole} / 검토 {value.definition.reviewerRole} / 확정 {value.definition.confirmerRole}</p><ul>{value.definition.requiredInputs.map((text, index) => <li key={index}>{text}</li>)}</ul></details>
      <details><summary>문서 작성 공통 기준</summary><p className="meta">기준 버전 {value.authoringStandard.ref.version} · {value.authoringStandard.ref.contentHash}</p><pre className="document-plain" aria-label="단계 양식 작성 기준">{value.authoringStandard.content}</pre></details>
      <p className="meta">응답의 내용 검토 상태: {value.validation.contentReview} / 사용자 확정 상태: {value.validation.userAcceptance}. 실제 단계 산출물의 검토·확정과는 별개입니다.</p>
    </article> : null}
  </section>;
}
