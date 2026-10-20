import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import { documentControl, type DocumentSession } from '../design-trace/editor-api.ts';
import type { ConfirmedAssignmentView } from './assignment-confirmation-api.ts';
import { listCandidates, readCandidate, type CandidateHit } from '../connections/api.ts';
import { ordered } from '../knowledge/review-view.ts';
import { assertResponsibleSessionInputCurrent, canPrepareResponsibleSessionInput, prepareResponsibleSessionInput, prepareResponsibleSessionAction, readResponsibleSessionState, sendResponsibleSessionAction, type ResponsibleSessionAction, type ResponsibleSessionBuffer, type ResponsibleSessionState } from './responsible-session-api.ts';

export function WorkspaceResponsibleSessions({client,confirmed,session,buffer,onChange,owner,busy,run}:{client:ApiClient;confirmed:ConfirmedAssignmentView;session:DocumentSession;buffer:ResponsibleSessionBuffer|null;onChange:Dispatch<SetStateAction<ResponsibleSessionBuffer|null>>;owner:boolean;busy:boolean;run:(action:()=>Promise<void>)=>void}) {
  const [state,setState]=useState<ResponsibleSessionState|null>(null),[candidates,setCandidates]=useState<CandidateHit[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const alive=useRef(true),epoch=useRef(0),currentBuffer=useRef(buffer);currentBuffer.current=buffer;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
  const sameOwner=!buffer||buffer.projectId===confirmed.projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId;
  const bound=sameOwner&&(!buffer||ordered(buffer.assignmentRef)===ordered(confirmed.ref));
  const update=(change:(b:ResponsibleSessionBuffer)=>ResponsibleSessionBuffer)=>{const binding=buffer?.bindingId;onChange(current=>current&&current.bindingId===binding?change(current):current);};
  const coordinator=state?.roles.find(r=>r.snapshot.kind==='COORDINATOR'),stage=state?.roles.find(r=>r.snapshot.kind==='STAGE_OWNER'),binding=state?.bindings.find(r=>ordered(r.snapshot.roleRef)===ordered(stage?.ref??null));
  const locked=busy||!owner||!bound||!!buffer?.pending||!!buffer?.uncertain;
  const retainedSelection=buffer&&bound&&!binding&&buffer.connectionRef&&!candidates.some(hit=>ordered(hit.ref)===ordered(buffer.connectionRef))?buffer.connectionRef:null;
  async function load(cursor:string|null=null) {
    const ticket=epoch.current;setState(null);setNotice(null);
    const [value,page]=await Promise.all([readResponsibleSessionState(client,confirmed),listCandidates(client,confirmed.projectId,'CONNECTION_CANDIDATE',cursor)]);
    if(!alive.current||ticket!==epoch.current)return;setState(value);setCandidates(page.items);setNextCursor(page.nextCursor);
  }
  async function prepare() {
    if(!owner||!canPrepareResponsibleSessionInput(buffer,confirmed,session))return;
    if(buffer?.dirty&&!confirm('미저장 책임 세션 입력을 버리고 새로 준비할까요?'))return;
    const ticket=epoch.current,result=await prepareResponsibleSessionInput(client,confirmed,session,buffer,()=>{setState(null);setNotice(null);},()=>alive.current&&ticket===epoch.current);
    if(!result)return;const old=buffer?.bindingId;onChange(value=>value?.bindingId===old?result.buffer:value);setState(result.state);
  }
  async function write(action:ResponsibleSessionAction) {
    if(!owner||!bound||!buffer||!state)return;
    const ticket=epoch.current,original=buffer,previouslyUncertain=!!buffer.pending&&buffer.uncertain;
    let acknowledged=false;
    try {
      const generation=await documentControl(client,confirmed.projectId,session);if(!alive.current||ticket!==epoch.current)return;
      assertResponsibleSessionInputCurrent(currentBuffer.current,original);
      if(generation!==buffer.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
      if(action==='BIND'&&!buffer.pending) {
        if(!buffer.connectionRef)throw new ApiError('RESPONSIBLE_SESSION_SELECTION_REQUIRED');
        const candidate=await readCandidate(client,confirmed.projectId,buffer.connectionRef);
        if(candidate.expired||candidate.candidate.kind!=='CONNECTION_CANDIDATE')throw new ApiError('CONNECTION_CANDIDATE_NOT_CURRENT',412);
        if(!alive.current||ticket!==epoch.current)return;
      }
      assertResponsibleSessionInputCurrent(currentBuffer.current,original);
      const command=prepareResponsibleSessionAction(buffer,session,confirmed,state,action);
      update(b=>({...b,pending:command,uncertain:true,failure:null}));
      const receipt=await sendResponsibleSessionAction(client,command,session);acknowledged=true;
      if(!alive.current||ticket!==epoch.current)return;
      update(b=>({...b,pending:null,uncertain:false,dirty:false,failure:null}));
      setNotice((action==='BIND'?'책임 세션 예약':'역할 정의')+' 저장 영수증 확인 · v'+receipt.ref.version+' · 실제 Agent 실행 아님');
      setState(null);const current=await readResponsibleSessionState(client,confirmed);
      if(alive.current&&ticket===epoch.current)setState(current);
    }catch(cause){
      if(!alive.current||ticket!==epoch.current)return;
      const failure=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
      onChange(current=>current?.bindingId===original.bindingId?{...current,failure:{code:failure.code,status:failure.status},uncertain:acknowledged?false:previouslyUncertain||failure.status===0||failure.status>=500||failure.code==='RESPONSE_INVALID'||failure.code==='RESPONSIBLE_SESSION_INTEGRITY_FAILED'}:current);
      throw failure;
    }
  }
  const retryAction:ResponsibleSessionAction=buffer?.pending?.operation==='bindResponsibleSession'?'BIND':buffer?.pending?.payload.kind==='STAGE_OWNER'?'STAGE_OWNER':'COORDINATOR';
  return <section aria-label="책임 역할·예약 세션"><h6>책임 역할·예약 세션</h6>
    <p>확정 임무의 단계책임자와 Anvil 세션을 연결합니다. RESERVED는 외부 Agent 세션 생성·실행 허가가 아닙니다.</p>
    <button disabled={busy} onClick={()=>run(()=>load())}>현재 역할·예약·준비 이력 조회</button>
    <button disabled={busy||!owner||!canPrepareResponsibleSessionInput(buffer,confirmed,session)} onClick={()=>run(prepare)}>책임 세션 입력 준비</button>
    {!bound?<p role="alert">{sameOwner?'이전 임무 입력이 보관돼 있습니다. 미확인 명령이 없다면 입력 준비로 이 임무를 명시 선택하세요.':'다른 임무·주체의 미저장 입력/명령이 보관돼 있습니다. 원 대상으로 돌아가 확인하세요.'}</p>:null}
    {notice?<p role="status">{notice}</p>:null}
    {buffer&&bound&&buffer.pending?<p>원 명령 {buffer.pending.commandId} · {buffer.uncertain?'결과 미확인 · 새 명령을 만들지 않습니다':'명시 거절 · 원 입력 보존'}</p>:null}
    {buffer&&bound&&buffer.failure?<p role="alert">{buffer.failure.code} · {buffer.uncertain?'적용 여부 미확인':'응답 계약 확인 필요'}</p>:null}
    {state?<><p>현재성 별도 재검사 필요 · 실행 허가 없음 · Agent 전달 없음</p>
      <ul>{state.roles.map(role=><li key={role.ref.id}>{role.snapshot.kind==='COORDINATOR'?'총괄':'선택 단계 책임자'} 역할 · {role.ref.id} · v{role.ref.version}</li>)}</ul>
      {binding?<p>책임 세션 {binding.snapshot.sessionRef.id} · RESERVED · 결박 v{binding.ref.version}<br/>현재 결박 임무 {binding.snapshot.assignmentRef.id} · v{binding.snapshot.assignmentRef.version} · 도구 교체는 별도 이전 절차입니다.</p>:<p>이 단계에 저장된 책임 세션 예약이 없습니다.</p>}
      {buffer&&bound?<><fieldset disabled={locked}><legend>현재 임무 책임자 정의·예약</legend>
        <label>책임 역할·예약 이유<textarea maxLength={20000} value={buffer.reason} onChange={e=>update(b=>({...b,reason:e.target.value,dirty:true,failure:null}))}/></label>
        <label>기존 코딩 Agent 연결 후보<select value={buffer.connectionRef?ordered(buffer.connectionRef):''} disabled={!!binding} onChange={e=>{const hit=candidates.find(c=>ordered(c.ref)===e.target.value);update(b=>({...b,connectionRef:hit?structuredClone(hit.ref):null,dirty:true}));}}>
          <option value="">연결 후보 선택</option>{binding?<option value={ordered(binding.snapshot.connectionRef)}>기존 예약의 연결 유지 · {binding.snapshot.connectionRef.id}</option>:null}
          {retainedSelection?<option value={ordered(retainedSelection)}>보관 선택 · {retainedSelection.id} · v{retainedSelection.version} · 현재 페이지 밖/현재성 미확인</option>:null}
          {candidates.filter(hit=>!binding||ordered(hit.ref)!==ordered(binding.snapshot.connectionRef)).map(hit=><option key={hit.ref.id} value={ordered(hit.ref)}>{hit.label} · 후보/실제 능력 미확인</option>)}
        </select></label>
        {buffer.connectionRef?<p>선택 참조 {buffer.connectionRef.id} · v{buffer.connectionRef.version} · {buffer.connectionRef.contentHash} · 선택 보관은 현재성·실제 연결 인증이 아닙니다.</p>:null}
        <button disabled={!!coordinator||!buffer.reason.trim()} onClick={()=>run(()=>write('COORDINATOR'))}>총괄 역할 정의</button>
        <button disabled={!coordinator||!!stage||!buffer.reason.trim()} onClick={()=>run(()=>write('STAGE_OWNER'))}>선택 단계 책임 역할 정의</button>
        <button disabled={!stage||!buffer.connectionRef||!buffer.reason.trim()} onClick={()=>run(()=>write('BIND'))}>{binding?'같은 책임 세션으로 임무 결박':'책임 세션 예약'}</button>
      </fieldset>
      {buffer.pending?<button disabled={busy||!owner} onClick={()=>run(()=>write(retryAction))}>같은 책임 세션 명령 결과 확인</button>:null}
      {buffer.pending&&buffer.failure&&!buffer.uncertain?<button disabled={busy} onClick={()=>{if(confirm('명시 거절을 확인했습니다. 원 입력을 보존하며 명령만 해제할까요?'))update(b=>({...b,pending:null,failure:null}));}}>거절 확인 후 입력 수정</button>:null}
      </>:null}
      {nextCursor?<button disabled={busy} onClick={()=>run(()=>load(nextCursor))}>다음 연결 후보 조회</button>:null}
      <h6>저장된 실행 준비</h6>{state.preparations.length?<ol>{state.preparations.map(p=><li key={p.ref.id}>준비 {p.ref.id} · NOT_AUTHORIZED · {p.snapshot.checkedAt}<ul>{p.snapshot.missingConditions.map((code:string)=><li key={code}>{code}</li>)}</ul></li>)}</ol>:<p>저장된 준비 없음</p>}
      {state.hasMorePreparations?<p>최신20건 표시 · 이전 준비가 더 있습니다.</p>:null}
      <p>새 실행 준비 저장은 유효한 예산·능력 참조 연결이 필요합니다. 미구현 참조를 가짜 값으로 대체하지 않습니다.</p>
    </>:<p>역할·예약·준비 원문은 아직 조회 확인되지 않았습니다.</p>}
  </section>;
}
