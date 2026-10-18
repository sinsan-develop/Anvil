import{useEffect,useRef,useState}from'react';
import{ApiClient,ApiError}from'../../api/client.ts';
import{readProjectConstitution,type ConstitutionView}from'./constitution-api.ts';
import type{KnowledgeRef}from'./review-view.ts';
import {ConstitutionReadOnly} from './constitution-read-only.ts';
type Props={client:ApiClient;projectId:string;onAuthenticationLost:()=>void}&({history?:true;onOpen:(ref:KnowledgeRef)=>void}|{history:false;onOpen?:never});
export function ProjectConstitutionPanel(props:Props){
 const {client,projectId,onAuthenticationLost}=props;
 const[page,setPage]=useState<ConstitutionView|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(false),alive=useRef(true),sequence=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;sequence.current++;};},[]);
 async function read(before:number|null=null){const id=++sequence.current;setLoading(true);setError(null);try{const result=await readProjectConstitution(client,projectId,before);if(!alive.current||id!==sequence.current)return;setPage(previous=>before!==null&&previous&&JSON.stringify(previous.current?.ref)===JSON.stringify(result.current?.ref)?{...result,history:[...previous.history,...result.history]}:result);}catch(e){if(!alive.current||id!==sequence.current)return;const a=e instanceof ApiError?e:new ApiError('RESPONSE_INVALID');setPage(null);setError(a);if(a.status===401)onAuthenticationLost();}finally{if(alive.current&&id===sequence.current)setLoading(false);}}
 return<section aria-label="프로젝트 적용 헌법"><h3>프로젝트 적용 헌법</h3><button type="button" disabled={loading} onClick={()=>void read()}>프로젝트 헌법 조회</button>{loading?<p aria-live="polite">적용 이력 확인 중</p>:null}{error?<p role="alert">{error.code}</p>:null}{page?<>
  <ConstitutionReadOnly current={page.current} observedAt={page.observedAt}/>
  {props.history!==false?<><ol>{page.history.map(r=><li key={r.ref.version}>적용 세대 {r.ref.version} · 지식 v{r.application.versionRef.version} · {r.appliedAt}<p>{r.application.reason}</p><button type="button" onClick={()=>props.onOpen(r.application.versionRef)}>적용 세대 {r.ref.version} 원문 열기</button></li>)}</ol>{page.hasMore?<button type="button" disabled={loading} onClick={()=>void read(page.nextBeforeVersion)}>헌법 이전 적용 이력</button>:null}</>:null}
 </>:null}</section>;
}
