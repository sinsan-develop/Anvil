import {useEffect, useState} from 'react';
import {ApiClient, ApiError} from '../../api/client.ts';
import {DesignAnchorOriginal} from '../design-trace/DesignAnchorOriginal.tsx';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ImpactTargetRef} from './api.ts';
import {readImpactDesignItem, type ImpactDesignItemSelection} from './impact-design-item-read.ts';

function Original({client, selection, onClose, onAuthenticationLost}: {client: ApiClient; selection: ImpactDesignItemSelection; onClose: () => void; onAuthenticationLost: () => void}) {
  const [result, setResult] = useState<{client: ApiClient; selection: ImpactDesignItemSelection; value: Awaited<ReturnType<typeof readImpactDesignItem>> | null; error: ApiError | null} | null>(null);
  const [highlight, setHighlight] = useState(true);
  useEffect(() => {
    let active = true;
    readImpactDesignItem(client, selection, () => active).then(value => {
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
  const context = value ? {projectId: selection.projectId, documentRef: value.item.documentRef, bodyHash: value.document.content.body.contentHash} : null;
  return <section aria-label="영향 설계 항목 고정 원문">
    <button type="button" onClick={onClose}>영향 설계 항목 원문 닫기</button>
    <p className="meta">저장된 영향 이력의 등록 항목 · 현재 상태·권한은 미확인 · 검토·승인·기준 적용 없음</p>
    {current?.error ? <p role="alert">{current.error.code} · 설계 항목과 원문을 채택하지 않았습니다. 닫은 뒤 현재 영향 구간에서 다시 조회하세요.</p>
      : value && context ? <>
        <h4>{value.item.localCode} · {value.item.title}</h4>
        <dl><div><dt>설계 항목 ID</dt><dd>{value.item.id}</dd></div><div><dt>항목 hash</dt><dd>{value.item.itemHash}</dd></div>
          <div><dt>고정 문서</dt><dd>{value.document.title} · {value.item.documentRef.id} · v{value.item.documentRef.version} · {value.item.documentRef.contentHash}</dd></div>
          <div><dt>등록 위치</dt><dd>{value.item.anchor}</dd></div></dl>
        <DesignAnchorOriginal body={value.body} context={context} selection={highlight ? {...context, anchor: value.item.anchor} : null} onClear={() => setHighlight(false)}/>
      </> : <p role="status">영향 설계 항목 원문 확인 중</p>}
  </section>;
}

export function ImpactDesignItemOriginal({client, projectId, session, changeRef, impactRef, beforeVersion, target, onAuthenticationLost}: {client: ApiClient; projectId: string; session: DocumentSession; changeRef: PlanRef; impactRef: PlanRef; beforeVersion: number | null; target: ImpactTargetRef; onAuthenticationLost: () => void}) {
  const context = JSON.stringify([projectId, session.user.id, session.clientId, changeRef, impactRef, beforeVersion, target]);
  const [selection, setSelection] = useState<{client: ApiClient; context: string; value: ImpactDesignItemSelection; nonce: number} | null>(null);
  const current = selection?.client === client && selection.context === context ? selection : null;
  if (target.kind !== 'DESIGN_ITEM') return null;
  return <><button type="button" aria-label={'영향 설계 항목 ' + (target.localCode ?? target.id) + ' 고정 원문 보기'} onClick={() => setSelection(old => ({client, context, nonce: (old?.nonce ?? 0) + 1,
    value: structuredClone({projectId, userId: session.user.id, clientId: session.clientId, changeRef, impactRef, beforeVersion, target})}))}>영향 설계 항목 고정 원문 보기</button>
    {current ? <Original key={current.nonce} client={client} selection={current.value} onClose={() => setSelection(null)} onAuthenticationLost={onAuthenticationLost}/> : null}</>;
}
