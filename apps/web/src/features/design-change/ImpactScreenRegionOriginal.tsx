import {useEffect, useState} from 'react';
import {ApiClient, ApiError} from '../../api/client.ts';
import {DesignAnchorOriginal} from '../design-trace/DesignAnchorOriginal.tsx';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ImpactTargetRef} from './api.ts';
import {readImpactScreenRegion, type ImpactScreenRegionSelection} from './impact-screen-region-read.ts';

const reference = (value: PlanRef) => `${value.id} · v${value.version} · ${value.contentHash}`;
function Original({client, selection, onClose, onAuthenticationLost}: {client: ApiClient; selection: ImpactScreenRegionSelection; onClose: () => void; onAuthenticationLost: () => void}) {
  const [result, setResult] = useState<{client: ApiClient; selection: ImpactScreenRegionSelection; value: Awaited<ReturnType<typeof readImpactScreenRegion>> | null; error: ApiError | null} | null>(null);
  const [highlight, setHighlight] = useState(true);
  useEffect(() => {
    let active = true;
    readImpactScreenRegion(client, selection, () => active).then(value => {
      if (active) setResult({client, selection, value, error: null});
    }).catch(cause => {
      if (!active) return;
      const error = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID');
      setResult({client, selection, value: null, error});
      if (error.status === 401) onAuthenticationLost();
    });
    return () => { active = false; };
  }, [client, selection]);
  const current = result?.client === client && result.selection === selection ? result : null;
  const value = current?.value;
  const context = value ? {projectId: selection.projectId, documentRef: value.region.documentRef, bodyHash: value.region.artifactRef.contentHash} : null;
  return <section aria-label="영향 등록 시안 문서 원문">
    <button type="button" onClick={onClose}>영향 등록 시안 문서 원문 닫기</button>
    <p className="meta">저장된 영향 이력의 등록 시안 · 문서 원문 텍스트 조회 · 현재 상태·권한은 미확인 · 검토·승인·기준 적용 없음</p>
    {current?.error ? <p role="alert">{current.error.code} · 등록 시안과 문서 원문을 채택하지 않았습니다. 닫은 뒤 현재 영향 구간에서 다시 조회하세요.</p>
      : value && context ? <>
        <h4>{value.region.screenCode} · 시안 문서 원문</h4>
        <dl><div><dt>등록 화면 ID</dt><dd>{value.region.id}</dd></div><div><dt>화면 코드</dt><dd>{value.region.screenCode}</dd></div>
          <div><dt>연결 설계 항목 ID</dt><dd>{value.region.designItemId}</dd></div><div><dt>등록 hash</dt><dd>{value.region.regionHash}</dd></div>
          <div><dt>등록을 소유한 변경 전 설계</dt><dd>{reference(value.sourceRef)}</dd></div>
          <div><dt>고정 AF03 시안 문서</dt><dd>{value.document.title} · {reference(value.region.documentRef)}</dd></div>
          <div><dt>시안 원문 파일</dt><dd>{value.region.artifactRef.artifactId} · {value.region.artifactRef.bytes} bytes · {value.region.artifactRef.mediaType} · {value.region.artifactRef.contentHash}</dd></div>
          <div><dt>등록 위치</dt><dd>{value.region.anchor}</dd></div></dl>
        <DesignAnchorOriginal body={value.body} context={context} selection={highlight ? value.anchorSelection : null} onClear={() => setHighlight(false)}/>
      </> : <p role="status">영향 등록 시안 문서 원문 확인 중</p>}
  </section>;
}

export function ImpactScreenRegionOriginal({client, projectId, session, changeRef, impactRef, beforeVersion, target, onAuthenticationLost}: {client: ApiClient; projectId: string; session: DocumentSession; changeRef: PlanRef; impactRef: PlanRef; beforeVersion: number | null; target: ImpactTargetRef; onAuthenticationLost: () => void}) {
  const context = JSON.stringify([projectId, session.user.id, session.clientId, changeRef, impactRef, beforeVersion, target]);
  const [selection, setSelection] = useState<{client: ApiClient; context: string; value: ImpactScreenRegionSelection; nonce: number} | null>(null);
  useEffect(() => {
    setSelection(old => old && (old.client !== client || old.context !== context) ? null : old);
  }, [client, context]);
  const current = selection?.client === client && selection.context === context ? selection : null;
  if (target.kind !== 'SCREEN_REGION') return null;
  return <><button type="button" aria-label={'영향 등록 시안 ' + (target.localCode ?? target.id) + ' 문서 원문 보기'} onClick={() => setSelection(old => ({client, context, nonce: (old?.nonce ?? 0) + 1,
    value: structuredClone({projectId, userId: session.user.id, clientId: session.clientId, changeRef, impactRef, beforeVersion, target})}))}>영향 등록 시안 문서 원문 보기</button>
    {current ? <Original key={current.nonce} client={client} selection={current.value} onClose={() => setSelection(null)} onAuthenticationLost={onAuthenticationLost}/> : null}</>;
}
