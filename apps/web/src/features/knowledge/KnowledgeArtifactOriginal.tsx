import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readKnowledgeArtifactSource,type KnowledgeArtifactSelection} from './knowledge-artifact-source.ts';
export function KnowledgeArtifactOriginal({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:KnowledgeArtifactSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
 const[value,setValue]=useState<Awaited<ReturnType<typeof readKnowledgeArtifactSource>>|null>(null),[error,setError]=useState<ApiError|null>(null);
 useEffect(()=>{let active=true;readKnowledgeArtifactSource(client,selection,()=>active).then(v=>{if(active)setValue(v);}).catch(cause=>{if(!active)return;const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e);if(e.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
 return <section className="status-card" aria-label="지식 파일 출처 원문"><h3>파일 출처 원문</h3><button type="button" onClick={onClose}>파일 출처 원문 닫기</button><p className="meta">읽기 전용 · 지식 v{selection.knowledgeRef.version}의 고정 출처 · UTF-8 텍스트 2MiB 이내만 표시 · 최신/사실 여부 미확인</p><p className="meta">원문 SHA256 {selection.source.contentHash}</p>{error?<p role="alert">{error.message} · {error.code} · 출처 원문으로 채택하지 않았습니다.</p>:value?<pre aria-label="출처 파일 원문">{value.body}</pre>:<p role="status">파일 출처 확인 중</p>}</section>;
}
