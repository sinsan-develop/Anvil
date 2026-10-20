import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ImpactTargetRef} from './api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readImpactDocument,type ImpactDocumentSelection} from './impact-document-read.ts';

function Original({client,selection,onClose,onAuthenticationLost}:{client:ApiClient;selection:ImpactDocumentSelection;onClose:()=>void;onAuthenticationLost:()=>void}){
  const name=selection.evidenceFor===undefined?'영향 문서':'영향 증거 문서';
  const [result,setResult]=useState<{client:ApiClient;selection:ImpactDocumentSelection;value:Awaited<ReturnType<typeof readImpactDocument>>|null;error:ApiError|null}|null>(null);
  useEffect(()=>{let active=true;readImpactDocument(client,selection,()=>active).then(value=>{if(active)setResult({client,selection,value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setResult({client,selection,value:null,error});if(error.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,selection]);
  const current=result?.client===client&&result.selection===selection?result:null;
  return <section aria-label={name+' 고정 원문'}><button type="button" onClick={onClose}>{name} 원문 닫기</button><p className="meta">저장된 영향 이력의 고정 문서 · 현재 업무 상태/완료·권한은 미확인 · 검토/확정·계획 개정·실행 없음</p>
    {current?.error?<p role="alert">{current.error.code} · 문서 원문을 채택하지 않았습니다. 현재 영향 구간을 다시 확인하세요.</p>:current?.value?<><h4>{current.value.document.title}</h4><p className="meta">v{current.value.document.version} · {current.value.document.contentHash}</p><pre className="document-plain" aria-label={name+' 보관 원문'}>{current.value.body}</pre></>:<p role="status">{name} 원문 확인 중</p>}
  </section>;
}

export function ImpactDocumentOriginal({client,projectId,session,changeRef,impactRef,beforeVersion,target,evidenceFor,onAuthenticationLost}:{client:ApiClient;projectId:string;session:DocumentSession;changeRef:PlanRef;impactRef:PlanRef;beforeVersion:number|null;target:ImpactTargetRef;evidenceFor?:ImpactTargetRef;onAuthenticationLost:()=>void}){
  const name=evidenceFor===undefined?'영향 문서':'영향 증거 문서',context=JSON.stringify([projectId,session.user.id,session.clientId,changeRef,impactRef,beforeVersion,target,evidenceFor]);
  const [selection,setSelection]=useState<{client:ApiClient;context:string;value:ImpactDocumentSelection;nonce:number}|null>(null);
  const current=selection?.client===client&&selection.context===context?selection:null;
  if(target.kind!=='DOCUMENT_VERSION')return null;
  return <><button type="button" aria-label={name+' '+target.id+' 고정 원문 보기'} onClick={()=>setSelection(old=>({client,context,nonce:(old?.nonce??0)+1,value:structuredClone({projectId,userId:session.user.id,clientId:session.clientId,changeRef,impactRef,beforeVersion,target,...(evidenceFor===undefined?{}:{evidenceFor})})}))}>{name} 고정 원문 보기</button>{current?<Original key={current.nonce} client={client} selection={current.value} onClose={()=>setSelection(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</>;
}
