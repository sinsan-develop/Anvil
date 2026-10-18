import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { listDocumentMaterials, type MaterialPage, type ProposalSummary } from '../design-trace/materials-api.ts';
import { readStoredProposal, type ProposalComparison } from '../design-trace/proposal-api.ts';
import { getPinnedForm } from '../methodologies/forms-api.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import { newDesignChangeRequest, prepareDesignChangeRequest, sendDesignChangeRequest, type ChangeRequestBuffer } from './request-api.ts';
import type {ChangeEditorGate} from './DesignChangesPage.tsx';

export function DesignChangeRequest({ client, projectId, session, buffer, onChange, onOpen, reading, blocked = false, gate, onAuthenticationLost }: { client: ApiClient; projectId: string; session: DocumentSession; buffer: ChangeRequestBuffer | null; onChange: Dispatch<SetStateAction<ChangeRequestBuffer | null>>; onOpen: (id: string) => void; reading: boolean; blocked?: boolean; gate:ChangeEditorGate; onAuthenticationLost: () => void }) {
  const [page, setPage] = useState<MaterialPage<ProposalSummary> | null>(null), [comparison, setComparison] = useState<ProposalComparison | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<ApiError | null>(null), [ack, setAck] = useState(false);
  const alive = useRef(true), flight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setAck(false); }, [buffer?.bindingId]);
  const bound = !buffer || buffer.projectId === projectId && buffer.ownerUserId === session.user.id && buffer.ownerClientId === session.clientId;
  async function perform(action: () => Promise<void>) { if(flight.current||!gate.acquire())return;flight.current=true;setBusy(true);setError(null);try{await action();}catch(cause){if(!alive.current)return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(failure);if(failure.status===401)onAuthenticationLost();}finally{flight.current=false;gate.release();if(alive.current)setBusy(false);} }
  async function list(cursor: string | null) { setPage(null); const value = await listDocumentMaterials(client, projectId, 'proposals', cursor, 'PENDING'); if(alive.current)setPage(value); }
  async function select(id: string) {
    if(blocked||!bound||buffer?.pending||buffer?.dirty&&!confirm('미저장 변경 요청 입력을 버리고 다른 제안을 준비할까요?'))return;
    setComparison(null); const selected = await readStoredProposal(client, projectId, id), source = selected.base.document;
    const form = await getPinnedForm(client, source.formRef);
    if(form.definition.formCode!=='AF02'||!source.confirmed||!source.validation.validForConfirmation||source.contentReviews[0]?.ref.outcome!=='ACCEPTED'||selected.proposal.selections.length)throw new ApiError('DESIGN_CHANGE_BASE_NOT_READY',422);
    const generation = await documentControl(client, projectId, session); if(!alive.current)return;if(!gate.allowed())throw new ApiError('CHANGE_EDITOR_CONFLICT',409);
    const value = newDesignChangeRequest(projectId, session, generation, selected.proposal.baseRef, selected.proposal.id), oldBinding=buffer?.bindingId;
    onChange(current=>current?.bindingId===oldBinding?value:current);setComparison(selected);
  }
  async function save() {
    if(blocked||!buffer||!bound)return;const binding=buffer.bindingId,previouslyUncertain=!!buffer.pending&&buffer.uncertain;
    try {
      const generation=await documentControl(client,projectId,session);if(!alive.current)return;if(!gate.allowed())throw new ApiError('CHANGE_EDITOR_CONFLICT',409);if(generation!==buffer.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
      const pending=prepareDesignChangeRequest(buffer,session,buffer.pending?true:ack), staged={...buffer,pending,uncertain:true,failure:null};
      onChange(current=>current?.bindingId===binding?staged:current);
      const result=await sendDesignChangeRequest(client,staged,session);if(!alive.current)return;
      onChange(current=>current?.bindingId===binding?{...current,pending:null,result,dirty:false,uncertain:false,failure:null}:current);
    } catch(cause) { if(!alive.current)return;const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');onChange(current=>current?.bindingId===binding?{...current,failure:{code:failure.code,status:failure.status},uncertain:previouslyUncertain||!!current.pending&&(failure.status===0||failure.status>=500||failure.code==='RESPONSE_INVALID')}:current);throw failure; }
  }
  return <section aria-label="설계 변경 요청 등록"><h3>수정 제안으로 변경 요청 준비</h3><p className="meta">이미 저장한 미선택 수정 제안과 확정 설계만 사용합니다. 요청 등록은 제안 선택·설계 변경 적용·승인·작업 재개가 아닙니다. 현재 head/확정/정책은 서버가 다시 검사합니다.</p>
    {error?<p role="alert">{error.code} · 원입력·미확인 명령은 자동으로 다시 만들지 않습니다.</p>:null}
    <button disabled={busy||!!buffer?.pending} onClick={()=>void perform(()=>list(null))}>변경용 수정 제안 목록 조회</button>
    {page?<ul>{page.items.map(item=><li key={item.id}>{item.title} · 기준 v{item.baseRef.version}<button disabled={blocked||busy||!!buffer?.pending} onClick={()=>void perform(()=>select(item.id))}>변경 요청 준비: {item.title}</button></li>)}</ul>:null}
    {page?.hasMore?<button disabled={busy||!!buffer?.pending} onClick={()=>{const cursor=page.nextCursor;void perform(()=>list(cursor));}}>수정 제안 다음 목록</button>:null}
    {comparison?<details><summary>선택한 변경 전후 원문</summary><p>준비 당시 고정 버전 비교 · 현재 유효성은 등록 시 재검사</p><h4>변경 전</h4><pre aria-label="변경 전 설계 원문">{comparison.base.body}</pre><h4>변경 제안</h4><pre aria-label="변경 제안 원문">{comparison.proposedBody}</pre></details>:null}
    {buffer&&bound?<><p className="meta">준비한 설계 {buffer.beforeRef.id} · v{buffer.beforeRef.version} · {buffer.beforeRef.contentHash}<br/>수정 제안 {buffer.proposalId} · 제어 세대 {buffer.controlGeneration}</p>
      <fieldset disabled={blocked||busy||!!buffer.pending||!!buffer.result}><legend>변경 요청 입력</legend><label>변경 요청 이유<textarea maxLength={20000} value={buffer.reason} onChange={event=>{const binding=buffer.bindingId,reason=event.target.value;onChange(current=>current?.bindingId===binding?{...current,reason,dirty:true,failure:null}:current);}}/></label><label><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}/>변경 요청만 등록하며 승인·적용·재개하지 않음을 확인합니다</label></fieldset>
      {!buffer.result?<><button disabled={blocked||busy||!buffer.pending&&(!ack||!buffer.reason.trim())} onClick={()=>void perform(save)}>{buffer.pending?'같은 변경 요청 명령 결과 확인':'설계 변경 요청 등록'}</button>{buffer.pending&&buffer.failure&&!buffer.uncertain?<button disabled={busy} onClick={()=>{if(!confirm('미적용 거절을 확인했습니다. 원 입력을 수정할까요?'))return;const binding=buffer.bindingId;onChange(current=>current?.bindingId===binding?{...current,pending:null,failure:null}:current);}}>거절 확인 후 변경 요청 입력 수정</button>:null}</>:<><p role="status">변경 요청 등록 영수증 확인 · 기준 미적용</p><p>등록 요청 ID: {buffer.result.change.ref.id}</p><p className="meta">현재 최신 상태는 별도 재조회가 필요합니다.</p><button disabled={busy||reading} onClick={()=>onOpen(buffer.result!.change.ref.id)}>등록한 변경 요청 재조회</button></>}
      {!buffer.pending&&!buffer.result?<button disabled={blocked||busy} onClick={()=>{if(buffer.dirty&&!confirm('미전송 변경 요청 입력을 닫을까요?'))return;const binding=buffer.bindingId;onChange(current=>current?.bindingId===binding?null:current);setComparison(null);}}>미전송 변경 요청 입력 닫기</button>:null}
    </>:null}
  </section>;
}
