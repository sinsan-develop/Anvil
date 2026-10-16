import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readDocument,type DocumentSummary} from './api.ts';
import {getPinnedForm} from '../methodologies/forms-api.ts';
import type {DocumentBuffer,DocumentSession} from './editor-api.ts';
import {prepareDesignIndex,sendDesignIndex,type DesignIndexBuffer} from './design-index-api.ts';
import {documentMutationUncertain,isKnownDocumentRejection} from './mutation-result.ts';

export function DesignIndexEditor({client,session,buffer,documents,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:DocumentBuffer;documents:DocumentSummary[];onChange:Dispatch<SetStateAction<DocumentBuffer|null>>;onAuthenticationLost:()=>void}) {
  const state=buffer.designIndexState!,[busy,setBusy]=useState(false),running=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const locked=busy||!!state.pending||!!state.result;
  function update(change:(s:DesignIndexBuffer)=>DesignIndexBuffer,dirty=true) {onChange(b=>b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.designIndexState?.bindingId===state.bindingId?{...b,designIndexState:change(b.designIndexState),dirty:dirty||b.dirty}:b);}
  function input(change:(s:DesignIndexBuffer['input'])=>DesignIndexBuffer['input']) {if(!locked)update(s=>({...s,input:change(s.input),failure:null}));}
  function draft(patch:Partial<DesignIndexBuffer['screenDraft']>) {if(!locked)update(s=>({...s,screenDraft:{...s.screenDraft,...patch},failure:null}));}
  function failure(cause:unknown,mutation=false) {const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');update(s=>({...s,failure:{code:e.code,status:e.status},uncertain:mutation?documentMutationUncertain(s.uncertain,e):s.uncertain}),false);if(mounted.current&&e.status===401)onAuthenticationLost();}
  async function loadScreen() {
    if(locked||running.current||!state.screenDraft.documentId||!/^[1-9][0-9]{0,14}$/.test(state.screenDraft.version))return;
    running.current=true;setBusy(true);const selected={...state.screenDraft};
    try {const value=await readDocument(client,buffer.projectId,selected.documentId,Number(selected.version)),form=await getPinnedForm(client,value.document.formRef);if(form.definition.formCode!=='AF03')throw new ApiError('SCREEN_DOCUMENT_KIND_INVALID',422);if(mounted.current)update(s=>s.screenDraft.documentId===selected.documentId&&s.screenDraft.version===selected.version?{...s,screenDraft:{...s.screenDraft,preview:{documentRef:{id:value.document.id,version:value.document.version,contentHash:value.document.contentHash},title:value.document.title,body:value.body}},failure:null}:s,false);}
    catch(e){failure(e);}finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  function addScreen() {
    const s=state.screenDraft;if(locked)return;if(!s.preview||state.input.screens.length>=200||!state.input.items.some(i=>i.localCode===s.designLocalCode)||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(s.screenCode)||!/^[1-9][0-9]{0,7}$/.test(s.line)){failure(new ApiError('SCREEN_REGION_INPUT_INVALID',422));return;}
    const value={designLocalCode:s.designLocalCode,screenCode:s.screenCode,documentRef:s.preview.documentRef,anchor:'line:'+s.line};input(p=>({...p,screens:[...p.screens,value]}));
  }
  async function save() {
    if(running.current||state.result)return;running.current=true;setBusy(true);let next=state;
    try {
      if(!next.pending){next={...next,pending:prepareDesignIndex(buffer,session),failure:null};const prepared=next;update(()=>prepared);}
      const result=await sendDesignIndex(client,{...buffer,designIndexState:next},session,()=>mounted.current),commandId=next.pending!.commandId;
      onChange(b=>b?.ownerUserId===session.user.id&&b.projectId===buffer.projectId&&b.designIndexState?.pending?.commandId===commandId?{...b,dirty:false,designIndexState:{...b.designIndexState,result,failure:null,uncertain:false}}:b);
    } catch(e){failure(e,!!next.pending);}finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  const canClose=!state.uncertain&&(!state.pending||!!state.result||isKnownDocumentRejection(state.failure));
  return <section className="status-card definition-editor" aria-label="설계·화면 위치 등록"><h2>설계·화면 위치 등록</h2><p>{buffer.title} · 정확 버전 {state.documentRef.version}</p><p className="meta">원문은 바꾸지 않습니다. D 코드/제목과 S 코드가 있는 실제 시작 줄만 연결합니다. 그림 내부 좌표·업무 완료·기준 활성화는 아직 연결 전입니다.</p>
    <pre className="document-original" aria-label="추적 등록 설계 원문">{buffer.body}</pre>
    {state.failure?<p role="alert">{new ApiError(state.failure.code,state.failure.status).message} · {state.failure.code} · 입력과 명령을 보존했습니다.</p>:null}
    {state.pending&&!state.result?<p>같은 명령의 결과만 확인합니다. 원문이나 등록 대상을 자동 교체하지 않습니다.</p>:null}
    {state.result?<p role="status">설계·화면 위치 등록 확인 · 문서/구현 완료 아님</p>:null}
    <fieldset disabled={locked}><legend>설계 항목</legend>{state.input.items.map((i,n)=><section key={n}><label>설계 항목 {n+1} 코드<input value={i.localCode} maxLength={64} onChange={e=>input(p=>({...p,items:p.items.map((v,k)=>k===n?{...v,localCode:e.target.value}:v)}))}/></label><label>설계 항목 {n+1} 제목<input value={i.title} maxLength={200} onChange={e=>input(p=>({...p,items:p.items.map((v,k)=>k===n?{...v,title:e.target.value}:v)}))}/></label><label>설계 항목 {n+1} 시작 줄<input type="number" min="1" value={i.anchor.slice(5)} onChange={e=>input(p=>({...p,items:p.items.map((v,k)=>k===n?{...v,anchor:'line:'+e.target.value}:v)}))}/></label><button disabled={state.input.items.length===1} onClick={()=>input(p=>({...p,items:p.items.filter((_,k)=>k!==n)}))}>설계 항목 {n+1} 제거</button></section>)}<button disabled={state.input.items.length>=200} onClick={()=>input(p=>({...p,items:[...p.items,{localCode:'',title:'',anchor:'line:1'}]}))}>설계 항목 추가</button></fieldset>
    <fieldset disabled={locked}><legend>화면시안 원문 위치</legend><label htmlFor="index-screen-document">화면시안 문서 선택</label><select id="index-screen-document" value={state.screenDraft.documentId} onChange={e=>{const d=documents.find(v=>v.id===e.target.value);draft({documentId:e.target.value,version:String(d?.headVersion??1),preview:null});}}><option value="">문서 선택</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title} · v{d.headVersion}</option>)}</select><label>화면시안 버전<input type="number" min="1" value={state.screenDraft.version} onChange={e=>draft({version:e.target.value,preview:null})}/></label><button onClick={()=>{void loadScreen();}}>화면시안 원문 확인</button>
      {state.screenDraft.preview?<><p>{state.screenDraft.preview.title} · v{state.screenDraft.preview.documentRef.version}</p><pre className="document-original" aria-label="등록할 화면시안 원문">{state.screenDraft.preview.body}</pre></>:null}
      <label htmlFor="index-design-code">연결할 설계 코드</label><select id="index-design-code" value={state.screenDraft.designLocalCode} onChange={e=>draft({designLocalCode:e.target.value})}><option value="">설계 항목 선택</option>{state.input.items.filter(i=>i.localCode).map((i,n)=><option key={n} value={i.localCode}>{i.localCode} · {i.title}</option>)}</select><label>화면 코드<input value={state.screenDraft.screenCode} maxLength={64} onChange={e=>draft({screenCode:e.target.value})}/></label><label>화면 위치 시작 줄<input type="number" min="1" value={state.screenDraft.line} onChange={e=>draft({line:e.target.value})}/></label><button disabled={!state.screenDraft.preview||state.input.screens.length>=200} onClick={addScreen}>확인한 화면 위치 추가</button>
      <ul>{state.input.screens.map((s,n)=><li key={n}>{s.designLocalCode} → {s.screenCode} · 문서 v{s.documentRef.version} · {s.anchor}<button onClick={()=>input(p=>({...p,screens:p.screens.filter((_,k)=>k!==n)}))}>화면 위치 {n+1} 제거</button></li>)}</ul>
    </fieldset>
    <label>추적 등록 이유<textarea value={state.input.reason} maxLength={20_000} readOnly={locked} onChange={e=>input(p=>({...p,reason:e.target.value}))}/></label><button disabled={busy||!!state.result} onClick={()=>{void save();}}>{state.pending?'같은 추적 등록 명령 결과 확인':'설계·화면 위치 등록'}</button><button disabled={busy||!canClose} onClick={()=>{if(!buffer.dirty||confirm('이 등록 작업의 미저장 입력을 버리고 닫을까요?'))onChange(b=>b?.designIndexState?.bindingId===state.bindingId?null:b);}}>설계 위치 등록 닫기</button>
  </section>;
}
