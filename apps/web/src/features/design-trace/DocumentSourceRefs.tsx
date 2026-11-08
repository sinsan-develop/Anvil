import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentDraftHash,type DocumentSession,type DocumentContent} from './editor-api.ts';
import {listDocuments,readDocument,type DocumentSummary} from './api.ts';
import {listConversations,listConversationMessages,type ConversationSummary,type MessageSummary} from '../knowledge/conversation-api.ts';
import {listDocumentMaterials,type ImportSummary} from './materials-api.ts';
import {readDocumentSource,readDocumentSourceRefs,documentSourceKey,type DocumentSourceRef,type DocumentSourcePreview} from './document-source-refs.ts';
type Kind=DocumentSourceRef['kind'];
type Scope={client:ApiClient;transport:ApiClient['transport'];pid:string;user:string;cid:string;csrf:string;generation:number;disabled:boolean;readonly:boolean};
type View={scope:Scope;kind:Kind;busy:boolean;error:string|null;docs:DocumentSummary[];rooms:ConversationSummary[];messages:MessageSummary[];imports:ImportSummary[];cursor:string|null;room:string|null;selected:DocumentSummary|null;version:string;preview:DocumentSourcePreview|null;target:DocumentSourceRef|null;names:Record<string,string>};
const same=(a:Scope,b:Scope)=>Object.keys(a).every(k=>a[k as keyof Scope]===b[k as keyof Scope]);
const empty=(scope:Scope,kind:Kind='DOCUMENT_VERSION'):View=>({scope,kind,busy:false,error:null,docs:[],rooms:[],messages:[],imports:[],cursor:null,room:null,selected:null,version:'',preview:null,target:null,names:{}});
const label=(r:DocumentSourceRef)=>r.kind==='DOCUMENT_VERSION'?'문서 v'+r.version:r.kind==='USER_INSTRUCTION'?'사용자 지시':r.kind==='CONVERSATION'?'대화 발언':'보관 텍스트';
export function DocumentSourceRefs({client,projectId,session,value,generation=0,disabled=false,onChange,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;value:DocumentSourceRef[];generation?:number;disabled?:boolean;onChange?:(refs:DocumentSourceRef[])=>void;onAuthenticationLost:()=>void}){
 const identity:Scope={client,transport:client.transport,pid:projectId,user:session.user.id,cid:session.clientId,csrf:session.csrfToken,generation,disabled,readonly:!onChange};
 const [scope,setScope]=useState(identity),[state,setState]=useState(()=>empty(identity));
 if(!same(scope,identity))setScope(identity);
 const committed=useRef<Scope|null>(null),sequence=useRef(0);
 useLayoutEffect(()=>{committed.current=scope;return()=>{if(committed.current===scope)committed.current=null;};},[scope]);
 const shown=same(scope,identity)&&state.scope===scope?state:empty(scope);
 const active=(ticket:number)=>committed.current===scope&&sequence.current===ticket&&!scope.disabled&&client.transport===scope.transport&&session.user.id===scope.user&&session.clientId===scope.cid&&session.csrfToken===scope.csrf;
 const update=(patch:Partial<View>,ticket=sequence.current)=>setState(p=>active(ticket)?({...((p.scope===scope)?p:empty(scope)),...patch,scope}):p);
 const finish=(ticket:number)=>setState(p=>committed.current===scope&&sequence.current===ticket&&p.scope===scope?{...p,busy:false}:p);
 function reset(kind=shown.kind){sequence.current++;setState(empty(scope,kind));}
 function fail(cause:unknown,ticket:number){if(!active(ticket))return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');update({error:e.code,preview:null});if(e.status===401)onAuthenticationLost();}
 async function list(kind=shown.kind,cursor:string|null=null,target:DocumentSourceRef|null=null){
  if(disabled||!active(sequence.current))return;const ticket=++sequence.current;update({kind,busy:true,error:null,preview:null,selected:null,room:null,messages:[],docs:cursor?shown.docs:[],rooms:cursor?shown.rooms:[],imports:cursor?shown.imports:[],target});
  try{
   if(kind==='DOCUMENT_VERSION'){const v=await listDocuments(client,projectId,cursor);if(active(ticket))update({docs:cursor?[...shown.docs,...v.items]:v.items,cursor:v.nextCursor});}
   else if(kind==='ARTIFACT'){const v=await listDocumentMaterials(client,projectId,'imports',cursor,'READY');if(active(ticket))update({imports:cursor?[...shown.imports,...v.items]:v.items,cursor:v.nextCursor});}
   else{const v=await listConversations(client,projectId,cursor);if(active(ticket))update({rooms:cursor?[...shown.rooms,...v.items]:v.items,cursor:v.nextCursor});}
  }catch(e){fail(e,ticket);}finally{finish(ticket);}
 }
 async function messages(room:string,cursor:string|null=null){
  if(disabled||!active(sequence.current))return;const ticket=++sequence.current;update({busy:true,error:null,preview:null,room,messages:cursor&&shown.room===room?shown.messages:[]});
  try{const v=await listConversationMessages(client,projectId,room,cursor);if(active(ticket))update({messages:cursor?[...shown.messages,...v.items]:v.items,cursor:v.nextCursor});}
  catch(e){fail(e,ticket);}finally{finish(ticket);}
 }
 async function inspect(ref:DocumentSourceRef,location:Parameters<typeof readDocumentSource>[3]={}){
  if(disabled||!active(sequence.current))return;const ticket=++sequence.current;update({busy:true,error:null,preview:null});
  try{const v=await readDocumentSource(client,projectId,ref,location,()=>active(ticket));if(active(ticket))update({preview:v,names:{...shown.names,[documentSourceKey(v.ref)]:v.name}});}
  catch(e){fail(e,ticket);}finally{finish(ticket);}
 }
 async function inspectDocument(){
  if(!shown.selected||disabled||!active(sequence.current))return;const n=Number(shown.version);if(!/^[1-9][0-9]*$/.test(shown.version)||!Number.isSafeInteger(n)){update({error:'DOCUMENT_SOURCE_INVALID'});return;}
  const ticket=++sequence.current;update({busy:true,error:null,preview:null});
  try{const v=await readDocument(client,projectId,shown.selected.id,n,{active:()=>active(ticket)});if(!active(ticket))return;if(await documentDraftHash(v.document.title,v.document.formRef,v.document.content as DocumentContent,(v.document.stageNodeRef as import('./stage-api.ts').StageNodeRef|null)??null)!==v.document.contentHash)throw new ApiError('DOCUMENT_REFERENCE_CHANGED');if(!active(ticket))return;const ref:DocumentSourceRef={kind:'DOCUMENT_VERSION',id:v.document.id,version:v.document.version,contentHash:v.document.contentHash};
   if(shown.target&&documentSourceKey(shown.target)!==documentSourceKey(ref))throw new ApiError('DOCUMENT_SOURCE_MISMATCH');
   update({preview:{ref,name:v.document.title,body:v.body},names:{...shown.names,[documentSourceKey(ref)]:v.document.title}});
  }catch(e){fail(e,ticket);}finally{finish(ticket);}
 }
 function attach(){const v=shown.preview;if(!v||disabled||shown.busy||!onChange||!active(sequence.current))return;
  try{const refs=readDocumentSourceRefs([...value,v.ref]);onChange(refs);update({preview:null,error:null});}catch(e){fail(e,sequence.current);}
 }
 function openStored(ref:DocumentSourceRef){if(ref.kind==='DOCUMENT_VERSION')void inspect(ref);else void list(ref.kind,null,ref);}
 const refs=readDocumentSourceRefs(value);
 return <section aria-label={onChange?'문서 전체 출처 편집':'문서 전체 출처 보관'}><h3>문서 전체 출처</h3>
  <ul>{refs.map(ref=><li key={documentSourceKey(ref)}>{shown.names[documentSourceKey(ref)]??label(ref)}<details><summary>출처 식별 정보</summary><p>{ref.id} {ref.kind==='DOCUMENT_VERSION'?'v'+ref.version:''}</p><code>{ref.contentHash}</code></details><button type="button" disabled={disabled||shown.busy} onClick={()=>openStored(ref)}>이 출처 원문 보기</button>{onChange?<button type="button" disabled={disabled||shown.busy} onClick={()=>{if(active(sequence.current))onChange(refs.filter(r=>documentSourceKey(r)!==documentSourceKey(ref)));}}>이 출처 해제</button>:null}</li>)}</ul>
  {onChange?<label>문서 출처 종류<select aria-label="문서 출처 종류" disabled={disabled||shown.busy} value={shown.kind} onChange={e=>reset(e.target.value as Kind)}><option value="DOCUMENT_VERSION">문서 버전</option><option value="CONVERSATION">대화 발언</option><option value="USER_INSTRUCTION">사용자 지시</option><option value="ARTIFACT">보관 텍스트</option></select></label>:null}
  {onChange||shown.target?<><button type="button" disabled={disabled||shown.busy} onClick={()=>void list(shown.kind,null,shown.target)}>출처 목록 조회</button>{shown.kind==='ARTIFACT'?<p className="meta">보관 가져오기의 READY UTF-8 텍스트 2MiB 이하만 선택합니다. 전체 파일 탐색이 아닙니다.</p>:null}</>:null}
  {shown.kind==='DOCUMENT_VERSION'?<>{shown.docs.map(d=><button type="button" key={d.id} disabled={disabled||shown.busy} onClick={()=>{sequence.current++;update({selected:d,version:String(d.headVersion),preview:null});}}>출처 문서: {d.title}</button>)}{shown.selected?<><label>출처 고정 버전<input aria-label="출처 고정 버전" value={shown.version} disabled={disabled||shown.busy} onChange={e=>{sequence.current++;update({version:e.target.value,preview:null});}}/></label><button type="button" disabled={disabled||shown.busy} onClick={()=>void inspectDocument()}>출처 버전 원문 확인</button></>:null}</>:null}
  {shown.rooms.map(r=><button type="button" key={r.id} disabled={disabled||shown.busy} onClick={()=>void messages(r.id)}>출처 대화방 #{r.headSequence}</button>)}
  {shown.messages.filter(m=>shown.kind!=='USER_INSTRUCTION'||m.kind==='USER_INSTRUCTION').filter(m=>!shown.target||m.sourceRef.id===shown.target.id&&m.sourceRef.contentHash===shown.target.contentHash).map(m=><button type="button" key={m.sourceRef.id} disabled={disabled||shown.busy} onClick={()=>void inspect({kind:shown.kind==='USER_INSTRUCTION'?'USER_INSTRUCTION':'CONVERSATION',id:m.sourceRef.id,contentHash:m.sourceRef.contentHash},{conversationId:shown.room!})}>출처 발언 #{m.serverSequence}</button>)}
  {shown.imports.filter(i=>i.status==='READY'&&i.originalRef.bytes<=2*1024*1024&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(i.originalRef.mediaType)).filter(i=>!shown.target||i.originalRef.artifactId===shown.target.id&&i.originalRef.contentHash===shown.target.contentHash).map(i=><button type="button" key={i.id} disabled={disabled||shown.busy} onClick={()=>void inspect({kind:'ARTIFACT',id:i.originalRef.artifactId,contentHash:i.originalRef.contentHash},{import:i})}>출처 보관 텍스트 {i.id}</button>)}
  {shown.cursor?<button type="button" disabled={disabled||shown.busy} onClick={()=>void(shown.room?messages(shown.room,shown.cursor):list(shown.kind,shown.cursor,shown.target))}>출처 다음 목록</button>:null}
  {shown.busy?<p role="status">출처 보호 조회 중</p>:null}{shown.error?<p role="alert">{shown.error}</p>:null}
  {shown.preview?<><p>{shown.preview.name} · {label(shown.preview.ref)}</p><pre aria-label="문서 출처 보호 원문">{shown.preview.body}</pre>{onChange?<button type="button" disabled={disabled||shown.busy||refs.length>=200} onClick={attach}>확인한 출처 추가</button>:null}</>:null}
 </section>;
}
