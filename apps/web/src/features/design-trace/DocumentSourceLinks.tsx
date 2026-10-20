import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readSourceLinks,type SourceLinksView} from './source-links-api.ts';
type Ref={id:string;version:number;contentHash:string};
export function DocumentSourceLinks({client,projectId,documentRef,onAuthenticationLost}:{client:ApiClient;projectId:string;documentRef:Ref;onAuthenticationLost:()=>void}){
 const [value,setValue]=useState<SourceLinksView|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 const {id,version,contentHash}=documentRef;
 useEffect(()=>{
  let current=true;setValue(null);setError(null);setLoading(true);
  readSourceLinks(client,projectId,{id,version,contentHash},()=>current).then(v=>{if(current)setValue(v);}).catch(cause=>{if(!current)return;const e=cause instanceof ApiError?cause:new ApiError('DOCUMENT_SOURCE_LINK_RESPONSE_INVALID');setValue(null);setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;};
 },[client,projectId,id,version,contentHash,reload]);
 return <section className="status-card" aria-label="문서 소스 연결 이력"><h3>문서 소스 연결</h3><button disabled={loading} onClick={()=>{setValue(null);setError(null);setLoading(true);setReload(n=>n+1);}}>소스 연결 새로고침</button>
  {loading?<p role="status">보관된 연결 이력 확인 중</p>:null}{error?<p role="alert">{error.code} · 연결을 확인하지 못했습니다.</p>:null}
  {!loading&&!error&&value?<><p className="meta">문서 v{version} · 현재 파일 내용과의 일치는 확인하지 않았습니다.</p>{value.hasMore?<p role="status">처음 20개만 표시한 부분 목록입니다. 나머지 연결은 미조회입니다.</p>:null}
   {!value.items.length?<p>이 문서 버전에 보관된 연결이 없습니다. 실제 소스 관측 결과는 아닙니다.</p>:<ul>{value.items.map(item=><li key={item.ref.id}><strong>{item.state==='DETACHED'?'분리됨':'미확인'}</strong><p className="meta">연결 {item.ref.id} v{item.ref.version} · SHA256 {item.ref.contentHash}</p>
    {item.rawAllowed&&item.history?<ol>{item.history.map(e=><li key={e.ref.version}><p>{e.snapshot.relativePath}</p><p>{e.snapshot.kind==='DETACHED'?'연결 분리':'연결 보관'} · {e.snapshot.reason}</p><p className="meta">기록 {e.snapshot.recordedAt} · 소스 blob SHA256 {e.snapshot.blobHash}</p></li>)}</ol>:<p>현재 참여 권한에서는 경로·사유·상세 이력을 표시하지 않습니다.</p>}
   </li>)}</ul>}<p className="meta">문서·파일은 변경하지 않습니다. 새 연결·현재 관측·자동 동기화는 이 화면에서 수행하지 않습니다.</p></>:null}
 </section>;
}
