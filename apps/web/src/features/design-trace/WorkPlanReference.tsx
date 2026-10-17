import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from './editor-api.ts';
import type {WorkPlanView} from './work-plan-api.ts';
import {readStoredPlanReference,type StoredPlanSelection} from './work-plan-reference-api.ts';
import {DesignAnchorOriginal} from './DesignAnchorOriginal.tsx';

function Original({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:StoredPlanSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
 const [value,setValue]=useState<Awaited<ReturnType<typeof readStoredPlanReference>>|null>(null),[error,setError]=useState<ApiError|null>(null),[cleared,setCleared]=useState(false);
 useEffect(()=>{let active=true;readStoredPlanReference(client,selection,()=>active).then(v=>{if(active)setValue(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
 return <section className="status-card" aria-label="계획 참조 고정 원문"><h3>{selection.taskCode} · {selection.target.localCode} 고정 원문</h3><button onClick={onClose}>고정 원문 닫기</button><p className="meta">읽기 전용 · 계획 v{selection.planRef.version} · 원문 v{selection.target.versionRef.version} · 최신 버전/실행·완료 증거 미확인</p><p className="meta">문서 SHA256 {selection.target.versionRef.contentHash}</p>{error?<p role="alert">{error.message} · {error.code} · 원문으로 채택하지 않았습니다.</p>:value?<><h4>{value.document.title}</h4><DesignAnchorOriginal body={value.body} context={value.anchorSelection} selection={cleared?null:value.anchorSelection} onClear={()=>setCleared(true)}/></>:<p role="status">고정 참조 원문 확인 중</p>}</section>;
}

/** 독립 조회만 수행하며 문서 편집 buffer/명령 pending을 건드리지 않는다. */
export function WorkPlanReferences({client,projectId,session,view,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;view:WorkPlanView;onAuthenticationLost:()=>void}){
 const [selected,setSelected]=useState<{selection:StoredPlanSelection;nonce:number}|null>(null);
 return <section aria-label="보관 업무의 설계·시안 원문"><h3>업무별 고정 설계·시안 원문</h3>{view.relationalProjection!=='STORED'?<p>저장된 업무 관계를 확인할 수 없어 원문 열기를 제공하지 않습니다.</p>:view.tasks.map((t,n)=><section key={n} aria-label={t.taskCode+' 고정 참조'}><h4>{t.taskCode} · {t.title}</h4>{!t.designRefs.length?<p>연결 설계 없음</p>:null}{!t.screenRefs.length?<p>연결 시안 없음</p>:null}{[...t.designRefs,...t.screenRefs].map((r,i)=><p key={i}>{r.kind==='DESIGN_ITEM'?'설계':'시안'} · {r.localCode} · v{r.versionRef.version} · {r.anchor} <button aria-label={r.localCode+' 고정 원문 보기'} onClick={()=>setSelected(old=>({selection:{projectId,userId:session.user.id,clientId:session.clientId,planRef:structuredClone(view.ref),taskCode:t.taskCode,target:structuredClone(r)},nonce:(old?.nonce??0)+1}))}>고정 원문 보기</button></p>)}</section>)}{selected?<Original key={selected.nonce} client={client} selection={selected.selection} onClose={()=>setSelected(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</section>;
}
