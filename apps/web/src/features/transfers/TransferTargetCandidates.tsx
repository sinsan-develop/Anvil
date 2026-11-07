import { useEffect, useRef, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { capabilityNames, listCandidates, readCandidate, type CandidateView, type Ref } from '../connections/api.ts';
import { CandidateProfile } from '../connections/CandidateProfile.ts';
import { CandidateDocumentationFact } from '../connections/CandidateDocumentation.tsx';
import type { CandidateDocumentation } from '../connections/candidate-documentation.ts';
import type { ConfirmedAssignmentView } from '../workspace/assignment-confirmation-api.ts';

type Page = Awaited<ReturnType<typeof listCandidates>>;
type Bound<T> = { key: string; client: ApiClient; value: T };
/** 보관 후보의 비교만 제공한다. 새 인계 대상·실행 허가를 저장하지 않는다. */
export function TransferTargetCandidates({ client, confirmed, onAuthenticationLost }: { client: ApiClient; confirmed: ConfirmedAssignmentView; onAuthenticationLost: () => void }) {
  const key = JSON.stringify([confirmed.projectId, confirmed.ref]), latest = useRef({ key, client }); latest.current = { key, client };
  const sequence = useRef(0), flight = useRef<Bound<number> | null>(null);
  const [page, setPage] = useState<Bound<Page> | null>(null), [view, setView] = useState<Bound<CandidateView> | null>(null);
  const [pending, setPending] = useState<Bound<boolean> | null>(null), [error, setError] = useState<Bound<string> | null>(null);
  const current = <T,>(value: Bound<T> | null) => value?.key === key && value.client === client ? value.value : null;
  const found = current(page), selected = current(view), busy = current(pending) === true, failure = current(error);
  useEffect(() => () => { sequence.current++; flight.current = null; }, [client, key]);
  async function load(ref: Ref | null, cursor: string | null = null) {
    if (flight.current?.key === key && flight.current.client === client) return;
    const ticket = ++sequence.current, bind = <T,>(value: T): Bound<T> => ({ key, client, value });
    const active = () => sequence.current === ticket && latest.current.key === key && latest.current.client === client;
    flight.current = bind(ticket); setPending(bind(true)); setView(null); setError(null); if (!ref) setPage(null);
    try {
      if (ref) {
        const result = await readCandidate(client, confirmed.projectId, structuredClone(ref));
        if (!active()) return;
        if (result.candidate.kind !== 'CONNECTION_CANDIDATE') throw new ApiError('TRANSFER_TARGET_KIND_INVALID');
        setView(bind(result));
      } else {
        const result = await listCandidates(client, confirmed.projectId, 'CONNECTION_CANDIDATE', cursor);
        if (active()) setPage(bind(result));
      }
    } catch (cause) {
      if (!active()) return;
      const e = cause instanceof ApiError ? cause : new ApiError('TRANSFER_TARGET_READ_INVALID');
      setView(null); setError(bind(/^[A-Z_]{1,80}$/.test(e.code) ? e.code : 'TRANSFER_TARGET_READ_INVALID'));
      if (e.status === 401) onAuthenticationLost();
    } finally { if (active()) { flight.current = null; setPending(bind(false)); } }
  }
  const requirements = confirmed.snapshot.definition.requiredCapabilities;
  return <section aria-label="이전 대상 후보 비교"><h3>이전 대상 후보 비교</h3>
    <p>보관된 연결 후보를 검토합니다. 대상 채택·새 세션 생성·Agent 호출·이전·재개는 수행하지 않습니다.</p>
    <p>고정 임무 요구: {requirements.length ? requirements.map(code => capabilityNames[code as keyof typeof capabilityNames] ?? code).join(', ') : '명시 요구 없음 · 필요한 능력이 없다는 판정은 아닙니다.'}</p>
    <button type="button" disabled={busy} onClick={() => void load(null)}>이전 대상 후보 목록 조회</button>
    {busy ? <p role="status">이전 후보 조회 중 · 앞선 후보 원문 숨김</p> : null}
    {failure ? <p role="alert">{failure} · 후보 미확인. 실제 이전 가능으로 처리하지 않습니다.</p> : null}
    {found ? <><p>목록 관측 {found.observedAt} · 후보 원문 무결성은 별도 조회합니다.</p>
      {!found.items.length ? <p>이 페이지의 이전 대상 후보 없음</p> : <ul>{found.items.map(item => <li key={item.ref.id}><p>{item.label} · v{item.ref.version} · {item.expiresAt} · NOT_READY</p><button type="button" disabled={busy} onClick={() => void load(item.ref)}>{item.label} 고정 후보 검토</button></li>)}</ul>}
      {found.nextCursor ? <button type="button" disabled={busy} onClick={() => void load(null, found.nextCursor)}>다음 이전 대상 후보</button> : null}
    </> : null}
    {selected && !busy ? <section aria-label="이전 검토 후보 원문"><h4>{selected.candidate.input.candidate.label}</h4>
      <p>{selected.expired ? '기한 경과' : '조회 시 기한 이내'} · NOT_READY · 실측 미확인 · 역할 배정/이전 불가</p>
      <CandidateProfile view={selected} />
      <table aria-label="임무 요구와 후보 능력"><thead><tr><th>능력</th><th>임무 요구</th><th>문서 근거</th><th>실측·통제</th></tr></thead><tbody>{selected.candidate.capabilities.map(capability => <tr key={capability.code}>
        <th scope="row">{capabilityNames[capability.code]}</th><td>{requirements.includes(capability.code) ? '임무에서 요구' : '명시 요구 없음'}</td>
        <td><CandidateDocumentationFact documentation={(selected.candidate.input.candidate.documentation as CandidateDocumentation[] | undefined)?.find(item => item.code === capability.code)} /></td><td>실측 미확인 · UNVERIFIED · 문서 보고로 통과하지 않습니다.</td>
      </tr>)}</tbody></table>
      <button type="button" disabled>이 후보로 이전·재개 · 미구현</button>
    </section> : null}
  </section>;
}
