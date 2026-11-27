import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
import {readWorkspaceMethodology} from '../workspace/api.ts';
import {MethodGraphCanvas} from './MethodGraphCanvas.tsx';
import {StoredNodeDefinition} from './StoredNodeDefinition.tsx';
import {StoredNodeRoutes} from './StoredNodeRoutes.tsx';
import type {AppliedStageChoice} from '../workspace/WorkspaceMethodology.tsx';
function Original({client,projectId,expected,isCurrent,onClose,onAuthenticationLost,onOpenStage}:{client:ApiClient;projectId:string;expected:VersionRef;isCurrent:()=>boolean;onClose:()=>void;onAuthenticationLost:()=>void;onOpenStage?:(value:AppliedStageChoice)=>void}){
 const [result,setResult]=useState<{value:Awaited<ReturnType<typeof readWorkspaceMethodology>>|null;error:ApiError|null}|null>(null),[nodeId,setNodeId]=useState('');
 const chosen=useRef('');
 const select=(id:string)=>{if(isCurrent()){chosen.current=id;setNodeId(id);}};
 useEffect(()=>{
  let active=true;const current=()=>active&&isCurrent();
  if(current())readWorkspaceMethodology(client,projectId,expected).then(value=>{if(current())setResult({value,error:null});}).catch(cause=>{
   if(!current())return;
   const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
   setResult({value:null,error});if(error.status===401)onAuthenticationLost();
  });
  return()=>{active=false;};
 },[client,projectId,expected]);
 const value=result?.value,snapshot=value?.snapshot,selected=snapshot?.graph.nodes.find(n=>n.nodeId===nodeId)??snapshot?.graph.nodes.find(n=>n.nodeId===snapshot.graph.entryNodeId);
 const explicit=!!nodeId&&selected?.nodeId===nodeId;
 return <section aria-label="현재 적용 절차 원문"><button type="button" onClick={onClose}>적용 절차 원문 닫기</button><p className="meta">조회한 적용 세대의 고정 정의입니다. 편집 후보와 별개이며 현재 단계 진행·도구 배정·권한·실제 실행은 확인하지 않습니다.</p>
  {result?.error?<p role="alert">{result.error.code} · 적용 절차 원문 미확인. 목록을 갱신해 적용 참조를 확인하세요.</p>:snapshot&&selected?<><h4>{snapshot.name}</h4><p>{snapshot.purpose}</p><p className="meta">원본 방법론 {snapshot.sourceRef.id} · v{snapshot.sourceRef.version} · {snapshot.sourceRef.contentHash} · 관측 {value?.observedAt}</p>
   <MethodGraphCanvas graph={snapshot.graph} selectedId={selected.nodeId} onSelect={select} label="고정 적용 방법론 흐름"/>
   <label>적용본 단계 선택<select value={selected.nodeId} onChange={e=>select(e.target.value)}>{snapshot.graph.nodes.map(n=><option key={n.nodeId} value={n.nodeId}>{n.nodeId} · {n.name}</option>)}</select></label>
   <section aria-label="고정 적용 단계 상세"><StoredNodeDefinition node={selected} formAccess={{client,contextKey:JSON.stringify([projectId,expected,snapshot.sourceRef,selected.nodeId]),onAuthenticationLost}}/><StoredNodeRoutes graph={snapshot.graph} nodeId={selected.nodeId}/></section>
   {onOpenStage?<button type="button" disabled={!explicit} onClick={()=>{
    if(isCurrent()&&explicit&&chosen.current===nodeId&&value?.applicationRef)onOpenStage({applicationRef:value.applicationRef,nodeId});
   }}>이 단계 준비 열기</button>:null}
  </>:<p role="status">적용 절차 고정 원문 확인 중</p>}
 </section>;
}
export function AppliedMethodOriginal({client,projectId,expected,onAuthenticationLost,onOpenStage}:{client:ApiClient;projectId:string;expected:VersionRef;onAuthenticationLost:()=>void;onOpenStage?:(value:AppliedStageChoice)=>void}){
 const context=JSON.stringify([projectId,expected]),ownerRef=useRef({client,context,transport:client.transport});
 if(ownerRef.current.client!==client||ownerRef.current.context!==context||ownerRef.current.transport!==client.transport)ownerRef.current={client,context,transport:client.transport};
 const owner=ownerRef.current,alive=useRef(false),sequence=useRef(0);
 const [selection,setSelection]=useState<{owner:typeof owner;ref:VersionRef;nonce:number}|null>(null),latest=useRef<typeof selection>(null);
 useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;latest.current=null;};},[]);
 const scopeCurrent=()=>alive.current&&ownerRef.current===owner&&client.transport===owner.transport;
 const current=selection?.owner===owner?selection:null;
 function open(){
  if(!scopeCurrent())return;
  const next={owner,ref:structuredClone(expected),nonce:++sequence.current};
  latest.current=next;setSelection(next);
 }
 function close(){latest.current=null;setSelection(null);}
 return <><button type="button" onClick={open}>현재 적용 절차 원문 보기</button>{current?<Original key={current.nonce} client={client} projectId={projectId} expected={current.ref}
  isCurrent={()=>scopeCurrent()&&latest.current===current} onClose={close} onOpenStage={onOpenStage} onAuthenticationLost={onAuthenticationLost}/>:null}</>;
}
