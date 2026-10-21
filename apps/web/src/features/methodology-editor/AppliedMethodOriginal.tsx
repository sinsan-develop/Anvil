import {useEffect,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {VersionRef} from '../../../../../contracts/generated-types.ts';
import {readWorkspaceMethodology} from '../workspace/api.ts';
import {MethodGraphCanvas} from './MethodGraphCanvas.tsx';
import {StoredNodeDefinition} from './StoredNodeDefinition.tsx';
import {StoredNodeRoutes} from './StoredNodeRoutes.tsx';
function Original({client,projectId,expected,onClose,onAuthenticationLost}:{client:ApiClient;projectId:string;expected:VersionRef;onClose:()=>void;onAuthenticationLost:()=>void}){
 const [result,setResult]=useState<{value:Awaited<ReturnType<typeof readWorkspaceMethodology>>|null;error:ApiError|null}|null>(null),[nodeId,setNodeId]=useState('');
 useEffect(()=>{let active=true;readWorkspaceMethodology(client,projectId,expected).then(value=>{if(active)setResult({value,error:null});}).catch(cause=>{if(!active)return;const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setResult({value:null,error});if(error.status===401)onAuthenticationLost();});return()=>{active=false;};},[client,projectId,expected]);
 const value=result?.value,snapshot=value?.snapshot,selected=snapshot?.graph.nodes.find(n=>n.nodeId===nodeId)??snapshot?.graph.nodes.find(n=>n.nodeId===snapshot.graph.entryNodeId);
 return <section aria-label="현재 적용 절차 원문"><button type="button" onClick={onClose}>적용 절차 원문 닫기</button><p className="meta">조회한 적용 세대의 고정 정의입니다. 편집 후보와 별개이며 현재 단계 진행·도구 배정·권한·실제 실행은 확인하지 않습니다.</p>
  {result?.error?<p role="alert">{result.error.code} · 적용 절차 원문 미확인. 목록을 갱신해 적용 참조를 확인하세요.</p>:snapshot&&selected?<><h4>{snapshot.name}</h4><p>{snapshot.purpose}</p><p className="meta">원본 방법론 {snapshot.sourceRef.id} · v{snapshot.sourceRef.version} · {snapshot.sourceRef.contentHash} · 관측 {value?.observedAt}</p>
   <MethodGraphCanvas graph={snapshot.graph} selectedId={selected.nodeId} onSelect={setNodeId} label="고정 적용 방법론 흐름"/>
   <label>적용본 단계 선택<select value={selected.nodeId} onChange={e=>setNodeId(e.target.value)}>{snapshot.graph.nodes.map(n=><option key={n.nodeId} value={n.nodeId}>{n.nodeId} · {n.name}</option>)}</select></label>
   <section aria-label="고정 적용 단계 상세"><StoredNodeDefinition node={selected} formAccess={{client,contextKey:JSON.stringify([projectId,expected,snapshot.sourceRef,selected.nodeId]),onAuthenticationLost}}/><StoredNodeRoutes graph={snapshot.graph} nodeId={selected.nodeId}/></section>
  </>:<p role="status">적용 절차 고정 원문 확인 중</p>}
 </section>;
}
export function AppliedMethodOriginal({client,projectId,expected,onAuthenticationLost}:{client:ApiClient;projectId:string;expected:VersionRef;onAuthenticationLost:()=>void}){
 const [selection,setSelection]=useState<{client:ApiClient;context:string;ref:VersionRef;nonce:number}|null>(null),context=JSON.stringify([projectId,expected]);
 const current=selection?.client===client&&selection.context===context?selection:null;
 return <><button type="button" onClick={()=>setSelection(old=>({client,context,ref:structuredClone(expected),nonce:(old?.nonce??0)+1}))}>현재 적용 절차 원문 보기</button>{current?<Original key={current.nonce} client={client} projectId={projectId} expected={current.ref} onClose={()=>setSelection(null)} onAuthenticationLost={onAuthenticationLost}/>:null}</>;
}
