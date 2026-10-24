import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {prepareDesignDependency,sendDesignDependency,keepDependencyFailure,type DesignDependency} from './design-dependency.ts';
import {isKnownDocumentRejection} from './mutation-result.ts';
import {TraceViewer} from './TraceViewer.tsx';
export function DesignDependencyEditor({client,session,buffer,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}){
 const s=buffer.designDependencyState!,[busy,setBusy]=useState(false),[showTrace,setShowTrace]=useState(false),alive=useRef(true),running=useRef(false);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const refinement=s.relation==='REFINES',name=refinement?'화면 상세화':'설계 의존';
 const locked=busy||!!s.pending||!!s.result;
 function update(change:(s:DesignDependency)=>DesignDependency,dirty=true){onChange(b=>b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.designDependencyState?.bindingId===s.bindingId?{...b,dirty:dirty||b.dirty,designDependencyState:change(b.designDependencyState)}:b);}
 async function save(){if(running.current||s.result)return;running.current=true;setBusy(true);let next=s;
  try{if(!next.pending){next={...next,pending:prepareDesignDependency(s.context,s,session),failure:null};const captured=next;update(()=>captured);}
   const result=await sendDesignDependency(client,next.context,next,session,()=>alive.current),commandId=next.pending!.commandId;
   onChange(b=>b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.designDependencyState?.bindingId===s.bindingId&&b.designDependencyState.pending?.commandId===commandId?{...b,dirty:false,designDependencyState:{...b.designDependencyState,result,failure:null,uncertain:false}}:b);
  }catch(cause){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');update(v=>keepDependencyFailure(v,next.pending?.commandId,e),false);if(alive.current&&e.status===401)onAuthenticationLost();}finally{running.current=false;if(alive.current)setBusy(false);}}
 const canClose=!busy&&!s.uncertain&&(!s.pending||!!s.result||isKnownDocumentRejection(s.failure));
 return <section className="status-card" aria-label="설계 의존 관계 편집"><h3>{refinement?'화면시안과 설계 항목의 상세화 관계':'설계 항목 간 의존 관계'}</h3><p>{refinement?'등록 화면이 설계 항목을 상세화한다는 추적 기록입니다.':'앞 항목이 뒤 항목에 의존한다는 추적 기록입니다.'} 실행 순서·업무 완료·실행 권한을 자동 변경하지 않습니다.</p>
 {(['fromId','toId'] as const).map((key,n)=><label key={key}>{n===0?(refinement?'상세화하는 화면 위치':'의존하는 설계 항목'):(refinement?'상세화 대상 설계 항목':'의존 대상 설계 항목')}<select aria-label={n===0?(refinement?'상세화하는 화면 위치':'의존하는 설계 항목'):(refinement?'상세화 대상 설계 항목':'의존 대상 설계 항목')} disabled={locked} value={s[key]} onChange={e=>{const value=e.target.value;if(!locked)update(v=>({...v,[key]:value,failure:null}));}}><option value="">항목 선택</option>{(n===0&&refinement?(s.context.screenRegions??[]).map(r=>({id:r.id,localCode:r.screenCode,title:'화면 v'+r.documentRef.version,anchor:r.anchor})):s.context.items).map(i=><option key={i.id} value={i.id}>{i.localCode} · {i.title} · {i.anchor}</option>)}</select></label>)}
 <label>{name} 관계 이유<textarea readOnly={locked} maxLength={20000} value={s.reason} onChange={e=>{const value=e.target.value;if(!locked)update(v=>({...v,reason:value,failure:null}));}}/></label>
 {s.failure?<p role="alert">{s.failure.code} · 입력과 동일 명령 보존</p>:null}<button disabled={busy||!!s.result} onClick={()=>{void save();}}>{s.pending?'같은 '+name+' 명령 결과 확인':name+' 관계 저장'}</button>
 <button disabled={!canClose} onClick={()=>{if(!buffer.dirty||confirm('미저장 설계 의존 입력을 버리고 닫을까요?'))onChange(b=>b?.designDependencyState?.bindingId===s.bindingId?{...b,dirty:false,designDependencyState:null}:b);}}>{name} 편집 닫기</button>
 {s.result?<><p role="status">{name} 관계 저장 확인 · 실행/완료 판정 아님</p><p className="meta">{s.result.id} · SHA256 {s.result.edgeHash}</p><button onClick={()=>setShowTrace(v=>!v)}>저장 관계 양방향 조회</button>{showTrace?<TraceViewer client={client} projectId={buffer.projectId} designRef={s.result.designRefs[0]!} onAuthenticationLost={onAuthenticationLost}/>:null}</>:null}</section>;
}
