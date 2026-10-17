import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { readDocument, type DocumentVersion } from './api.ts';
import { compareDocumentBodies } from './document-version-comparison.ts';

type OpenedDocument = { document: DocumentVersion; body: string };

export function DocumentVersionComparison({ client, projectId, base, maxVersion, onAuthenticationLost }: {
  client: ApiClient; projectId: string; base: OpenedDocument; maxVersion: number; onAuthenticationLost: () => void;
}) {
  const [version, setVersion] = useState(String(Math.max(1, base.document.version - 1)));
  const [result, setResult] = useState<OpenedDocument | null>(null);
  const [error, setError] = useState<ApiError | null>(null), [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const requested = Number(version), valid = Number.isSafeInteger(requested) && requested >= 1 && requested <= maxVersion;
  const comparison = useMemo(() => result ? compareDocumentBodies(base.body, result.body) : null, [base.body, result]);

  async function compare() {
    if (!valid || loading) return;
    const request = ++generation.current;
    setLoading(true); setError(null); setResult(null);
    try {
      const value = await readDocument(client, projectId, base.document.id, requested);
      if (request === generation.current) setResult(value);
    } catch (cause) {
      if (request !== generation.current) return;
      const next = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      setError(next);
      if (next.status === 401) onAuthenticationLost();
    } finally { if (request === generation.current) setLoading(false); }
  }

  return <section aria-label="저장 버전 비교" className="status-card">
    <h3>저장 버전 비교</h3>
    <p>기준 v{base.document.version} · {base.document.title}</p>
    <label>비교할 저장 버전<input type="number" min="1" max={maxVersion} value={version} onChange={event => {
      generation.current++; setVersion(event.target.value); setResult(null); setError(null); setLoading(false);
    }} /></label>
    <button disabled={!valid || loading} onClick={() => { void compare(); }}>지정 저장 버전과 비교</button>
    {loading ? <p role="status">비교할 저장 원문 무결성 확인 중</p> : null}
    {error ? <p role="alert">{error.message} · {error.code}</p> : null}
    {result && comparison ? <>
      <p>기준 v{base.document.version} ↔ 비교 v{result.document.version}</p>
      <details><summary>버전 식별 정보와 비교 방식</summary>
        <p className="meta">기준 문서 SHA256 {base.document.contentHash} · 본문 SHA256 {base.document.content.body.contentHash}</p>
        <p className="meta">비교 문서 SHA256 {result.document.contentHash} · 본문 SHA256 {result.document.content.body.contentHash}</p>
        <p>줄바꿈·BOM을 포함한 원문 문자열 비교입니다. 공통 앞뒤 줄을 제외한 차이 포함 구간이며 최소 편집 diff가 아닙니다. 구간 안에 같은 줄이 포함될 수 있습니다. 미저장 입력·저장/확정 상태는 바꾸지 않습니다.</p>
      </details>
      {comparison.kind === 'IDENTICAL' ? <p>두 저장 버전의 본문이 같습니다. 검토·확정 상태가 같다는 뜻은 아닙니다.</p>
        : comparison.kind === 'UNVERIFIED' ? <p role="status">비교 미확인 · 각 원문 131072자/4000줄 표시 한도 초과. 기존 원문 조회는 유지합니다.</p>
          : <>
            <p className="meta">공통 앞 {comparison.commonBeforeLines}줄 · 뒤 {comparison.commonAfterLines}줄 제외</p>
            <h4>기준 v{base.document.version}의 차이 포함 구간</h4>
            <pre aria-label="기준 버전 차이 구간" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comparison.before}</pre>
            {!comparison.before ? <p>기준 구간은 비어 있습니다.</p> : null}
            <h4>비교 v{result.document.version}의 차이 포함 구간</h4>
            <pre aria-label="비교 버전 차이 구간" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comparison.after}</pre>
            {!comparison.after ? <p>비교 구간은 비어 있습니다.</p> : null}
          </>}
    </> : null}
  </section>;
}
