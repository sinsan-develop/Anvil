import {useEffect,useMemo,useRef} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {KnowledgeCorrectionBuffer,KnowledgeCorrectionChange} from './correction-api.ts';
import {KnowledgeArtifactPicker} from './KnowledgeArtifactPicker.tsx';
import {attachKnowledgeCorrectionArtifact,detachKnowledgeCorrectionArtifact} from './knowledge-correction-sources.ts';
export function KnowledgeCorrectionArtifactSources({client,session,buffer,disabled,isLocked,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:KnowledgeCorrectionBuffer;disabled:boolean;isLocked:()=>boolean;onChange:(value:KnowledgeCorrectionChange)=>void;onAuthenticationLost:()=>void}){
 const latest=useRef(buffer),alive=useRef(true);latest.current=buffer;useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const selected=useMemo(()=>({projectId:buffer.projectId,sourceRefs:buffer.additionalArtifactSources??[]}),[buffer]);
 const frozen=disabled||!!buffer.pending||!!buffer.savedRef||buffer.uncertain;
 function update(next:()=>KnowledgeCorrectionBuffer){if(!alive.current||frozen||isLocked()||latest.current!==buffer)throw new ApiError('KNOWLEDGE_SOURCE_LOCKED');const value=next(),expected=buffer;onChange(current=>current===expected?value:current);}
 return <section aria-label="지식 정정 보관파일 근거"><h4>이번 정정에 추가할 보관 파일 근거</h4><KnowledgeArtifactPicker client={client} buffer={selected} disabled={frozen}
  onAttach={source=>update(()=>attachKnowledgeCorrectionArtifact(buffer,session,source))}
  onDetach={source=>update(()=>detachKnowledgeCorrectionArtifact(buffer,session,buffer.projectId,source))} onAuthenticationLost={onAuthenticationLost}/>
  {frozen?<p>저장 중·결과 미확인·저장 완료 근거는 바꾸지 않습니다.</p>:null}
 </section>;
}
