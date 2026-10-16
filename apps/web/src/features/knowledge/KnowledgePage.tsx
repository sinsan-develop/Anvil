import{useEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import{documentControl,type DocumentSession}from'../design-trace/editor-api.ts';
import{isKnownDocumentRejection}from'../design-trace/mutation-result.ts';
import{knowledgeKinds,newKnowledge,prepareKnowledge,sendKnowledge,readKnowledge,searchKnowledge,type KnowledgeBuffer,type KnowledgeView,type KnowledgeHit}from'./api.ts';
import{ConversationPanel}from'./ConversationPanel.tsx';
import type{ConversationBuffer}from'./conversation-api.ts';
export const knowledgeLabels={PURPOSE:'목적',CONSTITUTION:'헌법',DECISION:'결정',FACT:'사실',HYPOTHESIS:'가설',FAILURE_SOLUTION:'실패·해결',CAUTION:'주의 사항'};
export function KnowledgePage({client,projectId,session,buffer,onChange,conversationBuffer,onConversationChange,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;buffer:KnowledgeBuffer|null;onChange:(b:KnowledgeBuffer|null)=>void;conversationBuffer:ConversationBuffer|null;onConversationChange:(b:ConversationBuffer|null)=>void;onAuthenticationLost:()=>void}){
  const[query,setQuery]=useState(''),[kind,setKind]=useState(''),[items,setItems]=useState<KnowledgeHit[]>([]),[next,setNext]=useState<string|null>(null),[loading,setLoading]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState<ApiError|null>(null),[view,setView]=useState<KnowledgeView|null>(null);
  const alive=useRef(true),locked=useRef(false),requestId=useRef(0);
  const work=buffer?.projectId===projectId&&buffer.ownerUserId===session.user.id&&buffer.ownerClientId===session.clientId?buffer:null;
  const ownedElsewhere=!!buffer&&!work;
  function failed(e:unknown){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setError(a);if(a.status===401)onAuthenticationLost();return a;}
  async function list(cursor:string|null=null){
    const id=++requestId.current;setLoading(true);setError(null);setView(null);if(!cursor)setItems([]);
    try{const v=await searchKnowledge(client,projectId,query,kind,cursor);if(!alive.current||id!==requestId.current)return;setItems(previous=>cursor?[...new Map([...previous,...v.items].map(i=>[i.versionRef.id,i])).values()]:v.items);setNext(v.nextCursor);}
    catch(e){if(alive.current&&id===requestId.current){setItems([]);setNext(null);failed(e);}}
    finally{if(alive.current&&id===requestId.current)setLoading(false);}
  }
  useEffect(()=>{alive.current=true;void list();return()=>{alive.current=false;requestId.current++;};},[projectId]);
  async function start(){if(locked.current||buffer)return;locked.current=true;setWorking(true);setError(null);try{const generation=await documentControl(client,projectId,session);if(alive.current)onChange(newKnowledge(projectId,session,generation));}catch(e){if(alive.current)failed(e);}finally{locked.current=false;if(alive.current)setWorking(false);}}
  function edit(patch:Partial<KnowledgeBuffer>){if(!work||work.pending||working||work.resultRef)return;onChange({...work,...patch,dirty:true,failure:null});}
  async function save(){
    if(!work||locked.current||work.resultRef)return;locked.current=true;setWorking(true);setError(null);let current=work;
    try{
      if(!current.pending){current={...current,pending:await prepareKnowledge(current,session)};onChange(current);}
      const ref=await sendKnowledge(client,current,session,p=>{current={...current,pending:p};onChange(current);},()=>alive.current);
      current={...current,resultRef:ref,pending:null,failure:null,uncertain:false,dirty:false};onChange(current);if(alive.current)void list();
    }catch(e){const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');const uncertain=current.uncertain||a.code!=='KNOWLEDGE_CONTINUATION_PAUSED'&&!isKnownDocumentRejection(a);current={...current,failure:{code:a.code,status:a.status},uncertain};onChange(current);if(alive.current)failed(a);}
    finally{locked.current=false;if(alive.current)setWorking(false);}
  }
  function close(){if(!work||working||work.uncertain||work.pending&&!isKnownDocumentRejection(work.failure))return;if((work.dirty||work.pending)&&!confirm('작성 중 입력과 명확히 거절된 명령을 닫을까요? 저장된 원문은 삭제하지 않습니다.'))return;onChange(null);}
  async function inspect(item:KnowledgeHit){if(locked.current)return;setView(null);setError(null);setLoading(true);const id=++requestId.current;try{const v=await readKnowledge(client,projectId,item.versionRef);if(alive.current&&id===requestId.current)setView(v);}catch(e){if(alive.current&&id===requestId.current)failed(e);}finally{if(alive.current&&id===requestId.current)setLoading(false);}}
  return<section className="editor-page"><header><h2>헌법·지식·결정 이유</h2><button type="button" onClick={()=>void start()} disabled={!!buffer||working}>새 지식 작성</button><span title="현재는 지식 초안과 원문 저장/조회입니다. 별도 확정·헌법 적용·정정/제외·Agent 전달은 아직 연결하지 않았습니다."> ⓘ</span></header>
    <ConversationPanel client={client} projectId={projectId} session={session} buffer={conversationBuffer} onChange={onConversationChange} onAuthenticationLost={onAuthenticationLost}/>
    {ownedElsewhere?<p role="alert">다른 사용자·기기의 작성 자료는 이 세션에서 열거나 전송하지 않습니다.</p>:null}
    {work?<section aria-label="지식 작성"><h3>지식 초안 작성</h3><fieldset disabled={working||!!work.pending||!!work.resultRef}>
      <label>지식 종류<select aria-label="지식 종류" value={work.kind} onChange={e=>edit({kind:e.target.value as KnowledgeBuffer['kind']})}>{knowledgeKinds.map(k=><option key={k} value={k}>{knowledgeLabels[k]}</option>)}</select></label>
      <label>지식 제목<input aria-label="지식 제목" maxLength={200} value={work.title} onChange={e=>edit({title:e.target.value})}/></label>
      <label>지식 원문<textarea aria-label="지식 원문" rows={10} value={work.body} onChange={e=>edit({body:e.target.value})}/></label>
      <label>지식 작성 이유<textarea aria-label="지식 작성 이유" rows={3} maxLength={20000} value={work.reason} onChange={e=>edit({reason:e.target.value})}/></label>
    </fieldset><button type="button" disabled={working||!!work.resultRef||!work.title.trim()||!work.reason.trim()} onClick={()=>void save()}>{work.pending?'같은 지식 명령 결과 확인':'지식 초안 저장'}</button><button type="button" disabled={working||work.uncertain||!!work.pending&&!isKnownDocumentRejection(work.failure)} onClick={close}>작성 닫기</button>
    {work.resultRef?<p role="status">지식 초안 저장 확인 · v{work.resultRef.version} · 별도 확정 전</p>:null}{work.failure?<p role="alert">{work.failure.code}{work.uncertain?' · 결과 미확인: 같은 명령으로 확인하세요.':''}</p>:null}</section>:null}
    {error&&!work?.failure?<p role="alert">{error.code}</p>:null}
    <form onSubmit={e=>{e.preventDefault();void list();}}><label>지식 검색<input aria-label="지식 검색" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label><label>종류 필터<select aria-label="종류 필터" value={kind} onChange={e=>setKind(e.target.value)}><option value="">전체</option>{knowledgeKinds.map(k=><option key={k} value={k}>{knowledgeLabels[k]}</option>)}</select></label><button disabled={loading} type="submit">제목·이유 검색</button></form>
    {loading?<p aria-live="polite">지식 확인 중</p>:null}
    <ul>{items.map(i=><li key={i.versionRef.id}><strong>{i.title}</strong> · {knowledgeLabels[i.kind]} · 제안 · v{i.versionRef.version}<p>{i.reasonSnippet}</p><button type="button" disabled={loading} onClick={()=>void inspect(i)}>지식 원문 보기</button></li>)}</ul>
    {!loading&&!items.length?<p>조회된 지식이 없습니다.</p>:null}{next?<button type="button" disabled={loading} onClick={()=>void list(next)}>지식 다음 목록</button>:null}
    {view?<section aria-label="보관 지식"><h3>{view.entry.title}</h3><p>{knowledgeLabels[view.entry.kind]} · 제안 상태 · 헌법 미적용</p><pre aria-label="보관 지식 원문">{view.body}</pre><p>이유: {view.entry.reason}</p><details><summary>원문 출처·이력</summary><pre>{JSON.stringify({ref:view.ref,sourceRefs:view.entry.sourceRefs,history:view.history},null,2)}</pre></details><p>Agent 전달 미연결 · 비밀 검사: 알려진 표식만 확인</p></section>:null}
  </section>;
}
