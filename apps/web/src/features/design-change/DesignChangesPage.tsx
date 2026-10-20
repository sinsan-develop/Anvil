import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { readDesignChange, type DesignChangePage, type ImpactTargetRef } from './api.ts';
import type { PlanRef } from '../design-trace/work-plan-api.ts';
import type { DocumentSession } from '../design-trace/editor-api.ts';
import type { ChangeRequestBuffer } from './request-api.ts';
import { DesignChangeRequest } from './DesignChangeRequest.tsx';
import { ImpactReviewEditor } from './ImpactReviewEditor.tsx';
import type { ImpactReviewBuffer } from './impact-review-api.ts';
import { StoredChangeComparison } from './StoredChangeComparison.tsx';
import { StoredChangeSources } from './StoredChangeSources.tsx';
import { ImpactPlanTaskOriginal } from './ImpactPlanTaskOriginal.tsx';
import { ImpactDocumentOriginal } from './ImpactDocumentOriginal.tsx';

const reference = (value: PlanRef) => `${value.id} · v${value.version} · ${value.contentHash}`;
export interface ChangeEditorGate { acquire: () => boolean; release: () => void; allowed: () => boolean }
const targetLabel = (value: ImpactTargetRef) => `${value.kind} · ${value.localCode ?? value.id} · v${value.versionRef.version}${value.anchor ? ' · ' + value.anchor : ''}`;
export function DesignChangesPage({ client, projectId, session, buffer, onChange, reviewBuffer, onReviewChange, onAuthenticationLost }: { client: ApiClient; projectId: string; session: DocumentSession; buffer: ChangeRequestBuffer | null; onChange: Dispatch<SetStateAction<ChangeRequestBuffer | null>>; reviewBuffer: ImpactReviewBuffer | null; onReviewChange: Dispatch<SetStateAction<ImpactReviewBuffer | null>>; onAuthenticationLost: () => void }) {
  const [requestId, setRequestId] = useState(''), [value, setValue] = useState<DesignChangePage | null>(null), [error, setError] = useState<ApiError | null>(null), [busy, setBusy] = useState(false), [before, setBefore] = useState<number | null>(null);
  const alive = useRef(true), flight = useRef(false);
  const editorFlight=useRef(false), latest=useRef({buffer,reviewBuffer});latest.current={buffer,reviewBuffer};
  const [editorBusy,setEditorBusy]=useState(false);
  const acquire=()=>{if(editorFlight.current)return false;editorFlight.current=true;setEditorBusy(true);return true;};
  const release=()=>{editorFlight.current=false;if(alive.current)setEditorBusy(false);};
  const requestGate:ChangeEditorGate={acquire,release,allowed:()=>!latest.current.reviewBuffer||!!latest.current.reviewBuffer.result};
  const reviewGate:ChangeEditorGate={acquire,release,allowed:()=>!latest.current.buffer||!!latest.current.buffer.result};
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load(id: string, beforeVersion: number | null) {
    if (flight.current) return; flight.current = true; setBusy(true); setValue(null); setError(null); setBefore(beforeVersion);
    try { const page = await readDesignChange(client, projectId, id, beforeVersion); if (alive.current) setValue(page); }
    catch (cause) { if (!alive.current) return; const failure = cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID'); setError(failure); if (failure.status === 401) onAuthenticationLost(); }
    finally { flight.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="editor-page" aria-label="설계 변경 조회"><h2>변경 요청·영향 이력</h2>
    <DesignChangeRequest client={client} projectId={projectId} session={session} buffer={buffer} onChange={onChange} gate={requestGate} reading={busy} blocked={editorBusy||!!reviewBuffer&&!reviewBuffer.result} onOpen={id=>{setRequestId(id);void load(id,null);}} onAuthenticationLost={onAuthenticationLost}/>
    <ImpactReviewEditor client={client} projectId={projectId} session={session} page={value} buffer={reviewBuffer} onChange={onReviewChange} gate={reviewGate} canPrepare={!buffer||!!buffer.result} reading={busy||editorBusy} onOpen={id=>{setRequestId(id);void load(id,null);}} onAuthenticationLost={onAuthenticationLost}/>
    <p className="meta">저장된 변경 요청 ID로 원문과 영향 검토 이력을 조회합니다. 승인·기준 적용·작업 재개는 아직 연결되지 않았습니다.</p>
    <form onSubmit={event => { event.preventDefault(); void load(requestId, null); }}><fieldset disabled={busy}><legend>저장된 요청 찾기</legend>
      <label>변경 요청 ID<input value={requestId} maxLength={36} autoComplete="off" spellCheck={false} onChange={event => { setRequestId(event.target.value); setValue(null); setError(null); }} /></label><button type="submit" disabled={!requestId}>변경 요청 조회</button>
    </fieldset></form>
    {busy ? <p role="status">변경 요청·영향 이력 조회 중</p> : null}{error ? <p role="alert">{error.code} · 요청과 영향은 현재 미확인입니다. 이전 조회 원문은 숨겼습니다.</p> : null}
    {value ? <section aria-label="보관 설계 변경"><h3>변경 요청 · 제안 상태</h3><p>{reference(value.change.ref)}</p><dl>
      <div><dt>변경 이유</dt><dd><pre>{value.change.reason}</pre></dd></div><div><dt>요청자</dt><dd>사람 · {value.change.requestedBy.userId}</dd></div><div><dt>요청 시각</dt><dd><time dateTime={value.change.createdAt}>{value.change.createdAt}</time></dd></div>
      <div><dt>변경 전 설계</dt><dd>{reference(value.change.beforeRef)}</dd></div><div><dt>변경 후 수정 제안 ID · 원문은 별도 조회</dt><dd>{value.change.afterProposalRef}</dd></div>
    </dl><StoredChangeSources key={JSON.stringify([projectId,session.user.id,session.clientId,value.change.ref])} client={client} projectId={projectId} session={session} change={value.change} onAuthenticationLost={onAuthenticationLost}/>
      <p>기준 미적용 · 이 조회는 승인·계획 개정·작업 재개를 실행하지 않습니다.</p>
      <StoredChangeComparison key={value.change.ref.id+':'+value.change.ref.contentHash} client={client} projectId={projectId} change={value.change} onAuthenticationLost={onAuthenticationLost}/>
      <h3>영향 검토 이력</h3><p className="meta">최신 영향 참조: {reference(value.latestImpactRef)} · {before === null ? '최신부터 조회' : `v${before} 이전 구간`} · 관측 {value.observedAt}</p>
      {!value.impactVersions.length ? <p>이 구간에 저장된 이력 없음 · 영향 없음이라는 판정이 아닙니다.</p> : value.impactVersions.map((impact, index) => <details key={impact.ref.id + ':' + impact.ref.version} open={index === 0}>
        <summary>영향 v{impact.ref.version} · {impact.sourceKind === 'HUMAN_REVIEW' ? '사람 검토' : '기계적 연결 추적'}</summary>
        <p className="meta">{reference(impact.ref)} · 관측 {impact.observedAt}</p><p>별도 검토 필요 · 실제 실행·시험·권한의 현재 유효성은 이 조회로 확인되지 않습니다.</p>
        {impact.reviewer ? <p>검토자: 사람 · {impact.reviewer.userId}</p> : null}{impact.reason ? <pre>{impact.reason}</pre> : null}{impact.baseImpactRef ? <p className="meta">검토 전 영향 참조: {reference(impact.baseImpactRef)}</p> : null}
        <table><caption>저장된 영향 항목 · 검토 출처와 미확인을 구분합니다</caption><thead><tr><th>대상</th><th>판정</th><th>근거</th><th>증거 참조</th></tr></thead><tbody>{impact.items.map((item, n) => <tr key={n}><td>{targetLabel(item.targetRef)}<details><summary>대상 고정 참조</summary><p>{reference(item.targetRef.versionRef)}</p><p>대상 ID {item.targetRef.id}</p></details><ImpactPlanTaskOriginal key={JSON.stringify([projectId,session.user.id,session.clientId,value.change.ref,impact.ref,before,item.targetRef])} client={client} projectId={projectId} session={session} changeRef={value.change.ref} impactRef={impact.ref} beforeVersion={before} target={item.targetRef} onAuthenticationLost={onAuthenticationLost}/><ImpactDocumentOriginal key={'document:'+JSON.stringify([projectId,session.user.id,session.clientId,value.change.ref,impact.ref,before,item.targetRef])} client={client} projectId={projectId} session={session} changeRef={value.change.ref} impactRef={impact.ref} beforeVersion={before} target={item.targetRef} onAuthenticationLost={onAuthenticationLost}/></td><td>{item.state === 'UNKNOWN' ? '미확인 · 영향 없음 아님' : item.state === 'UNAFFECTED' ? '사람의 영향 없음 검토 · 자동 안전 판정 아님' : '재확인 대상'}</td><td><pre>{item.reason}</pre></td><td>{item.evidenceRefs.length ? <ul>{item.evidenceRefs.map((evidence, n) => <li key={n}>{targetLabel(evidence)} · {reference(evidence.versionRef)}</li>)}</ul> : '저장된 증거 참조 없음'}</td></tr>)}</tbody></table>
        <h4>범위·근거 미확인</h4>{impact.coverageGaps.length ? <ul>{impact.coverageGaps.map((gap, n) => <li key={n}><span>{gap.code}</span>{gap.targetRef ? ' · ' + targetLabel(gap.targetRef) : ''}</li>)}</ul> : <p>기록된 범위 누락 없음 · 전체 영향 확인 완료가 아닙니다.</p>}
        <details><summary>계산에 사용한 고정 계획</summary><p>{impact.inputs.indexedDesign ? '설계 항목 인덱스가 계산에 포함됨' : '설계 항목 인덱스 미준비'}</p><ul>{impact.inputs.planRefs.map(ref => <li key={ref.id + ':' + ref.version}>{reference(ref)}</li>)}</ul></details>
      </details>)}
      {value.hasMoreImpacts ? <button disabled={busy} onClick={() => void load(value.change.ref.id, value.nextBeforeVersion)}>이전 영향 이력 조회</button> : null}
    </section> : null}
  </section>;
}
