import {useState} from 'react';
import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';
import {nodeDeletionImpact} from './node-deletion-impact.ts';
export function NodeDeletionPanel({graph,nodeId,locked,onRemove}:{graph:MethodologyGraph;nodeId:string;locked:boolean;onRemove:(graph:MethodologyGraph,nodeId:string)=>void}){
 const[preview,setPreview]=useState<{graph:MethodologyGraph;nodeId:string;impact:ReturnType<typeof nodeDeletionImpact>}|null>(null),[error,setError]=useState(false);
 const current=preview?.graph===graph&&preview.nodeId===nodeId?preview:null;
 return <div><button disabled={locked} onClick={()=>{setError(false);try{setPreview({graph,nodeId,impact:nodeDeletionImpact(graph,nodeId)});}catch{setPreview(null);setError(true);}}}>이 초안의 단계 제거</button>
  {error?<p role="alert">삭제 영향을 확인하지 못했습니다. 초안은 변경하지 않았습니다.</p>:null}
  {current?<section aria-label="단계 삭제 영향 확인" className="status-card"><h4>{current.impact.nodeName} ({nodeId}) 제거 전 확인</h4>
   <p>현재 초안만 변경합니다. 서버 저장·확정·프로젝트 적용은 별도입니다.</p>
   <p>{current.impact.removesEntry?'시작 단계가 비게 됩니다. 새 시작 단계를 지정해야 합니다.':'시작 단계는 유지됩니다.'} {current.impact.removesTerminal?'종료 단계 목록에서 이 단계가 빠집니다.':'종료 단계는 유지됩니다.'}</p>
   <h5>함께 빠지는 직접 연결 {current.impact.removedEdges.length}건</h5><ul>{current.impact.removedEdges.map(e=><li key={e.edgeId}>{e.edgeId}: {e.fromNodeId} → {e.toNodeId}</li>)}</ul>
   <h5>이 단계에서 빠지는 문서 정의 {current.impact.removedDocuments.length}건</h5><ul>{current.impact.removedDocuments.map((d,i)=><li key={i}>{d.direction} {d.itemId} · {d.required?'필수':'선택'} · {d.formRef.id} v{d.formRef.version} · {d.formRef.contentHash}</li>)}</ul>
   <h5>자동 수정하지 않고 남기는 참조 {current.impact.retainedReferences.length}건</h5><ul>{current.impact.retainedReferences.map((r,i)=><li key={i}>{r}</li>)}</ul>
   <p>위 목록은 구조상 영향입니다. 문서 원본은 삭제하지 않으며, 남은 참조와 의미상 영향은 저장 후 구조 검사·내용 검토에서 확인해야 합니다.</p>
   <button disabled={locked} onClick={()=>{if(locked||preview?.graph!==graph||preview.nodeId!==nodeId)return;onRemove(graph,nodeId);setPreview(null);}}>영향 확인 후 초안에서 제거</button><button onClick={()=>setPreview(null)}>단계 제거 취소</button>
  </section>:null}
 </div>;
}
