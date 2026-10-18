import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readStoredChangeArtifactSource,type ChangeArtifactSelection} from './stored-change-artifact-source.ts';

export function StoredChangeArtifactOriginal({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:ChangeArtifactSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
  const [result,setResult]=useState<{client:ApiClient;selection:ChangeArtifactSelection;value:Awaited<ReturnType<typeof readStoredChangeArtifactSource>>|null;error:ApiError|null}|null>(null);
  useEffect(()=>{let active=true;readStoredChangeArtifactSource(client,selection,()=>active).then(value=>{if(active)setResult({client,selection,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setResult({client,selection,value:null,error});if(error.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
  const current=result?.client===client&&result.selection===selection?result:null;
  return <section aria-label="보관 변경 요청 파일 출처 원문"><h4>변경 근거 파일 · 텍스트 조회</h4><button type="button" onClick={onClose}>변경 근거 파일 원문 닫기</button>
    <p className="meta">저장 요청의 고정 파일 hash · 최대 2MiB UTF-8 텍스트만 표시 · 현재 적용/내용 승인·Agent 전달 아님</p><p className="meta">파일 SHA256 {selection.source.contentHash}</p>
    {current?.error?<p role="alert">{current.error.code} · 파일을 텍스트 원문으로 채택하지 않았습니다.</p>:current?.value?<><p>{current.value.bytes} bytes · 고정 바이트 확인</p><pre className="document-plain" aria-label="변경 근거 파일 원문">{current.value.body}</pre></>:<p role="status">변경 근거 파일 확인 중</p>}
  </section>;
}
