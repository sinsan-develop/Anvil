import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeCorrectionBuffer,KnowledgeCorrectionChange} from './correction-api.ts';
import type {KnowledgeDocumentSource} from './knowledge-document-source.ts';
import {KnowledgeDocumentPicker} from './KnowledgeDocumentPicker.tsx';
import {attachKnowledgeCorrectionDocument,detachKnowledgeCorrectionDocument} from './knowledge-correction-sources.ts';
export function KnowledgeCorrectionDocumentSources({client,session,buffer,disabled,isLocked,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeCorrectionBuffer;disabled:boolean;isLocked:()=>boolean;onChange:(change:KnowledgeCorrectionChange)=>void;onAuthenticationLost:()=>void}){
 const latest=useRef(buffer),alive=useRef(true),[error,setError]=useState<string|null>(null);latest.current=buffer;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const frozen=disabled||!!buffer.pending||!!buffer.savedRef||buffer.uncertain;
 function change(source:KnowledgeDocumentSource,detach=false){
  if(!alive.current||frozen||isLocked()||latest.current!==buffer)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');
  const next=(detach?detachKnowledgeCorrectionDocument:attachKnowledgeCorrectionDocument)(buffer,session,buffer.projectId,source),expected=buffer;
  onChange(current=>current===expected?next:current);setError(null);
 }
 const pickerKey=JSON.stringify([buffer.projectId,session.user.id,session.clientId,buffer.controlGeneration,buffer.target.ref]);
 return <section aria-label="지식 정정 문서 근거"><h4>이번 정정에 추가할 문서 근거</h4><p>확인한 문서의 버전·hash만 선택합니다. 기존 출처·원문·본문은 보존하며 별도 정정 저장 전에는 서버에 반영하지 않습니다.</p>
  <KnowledgeDocumentPicker key={pickerKey} client={client} projectId={buffer.projectId} disabled={frozen} onAttach={source=>change(source)} isAttached={source=>(buffer.additionalDocumentSources??[]).some(item=>item.id===source.id&&item.version===source.version&&item.contentHash===source.contentHash)} onAuthenticationLost={onAuthenticationLost}/>
  {(buffer.additionalDocumentSources??[]).map(source=><p key={JSON.stringify(source)}>{source.id} · v{source.version} · {source.contentHash}<button type="button" disabled={frozen} onClick={()=>{try{change(source,true);}catch(cause){setError(cause instanceof ApiError?cause.code:'KNOWLEDGE_SOURCE_INVALID');}}}>이번 문서 근거 선택 해제</button></p>)}
  <details><summary>보존하는 이전 출처</summary><pre>{JSON.stringify(buffer.target.entry.sourceRefs,null,2)}</pre></details>
  {error?<p role="alert">{error}</p>:null}{frozen?<p>저장 중·결과 미확인·저장 완료 입력의 근거는 바꾸지 않습니다.</p>:null}
 </section>;
}
