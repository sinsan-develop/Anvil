import {useEffect,useId,useRef,useState} from 'react';
import type {MethodologyGraph} from '../../../../../contracts/methodologies.ts';

/** 잘못된 초안의 중복 정의만 고른다. 동일 ID의 연결·참조는 재해석하지 않는다. */
export function DuplicateNodeRepair({graph,locked,onRemove}:{graph:MethodologyGraph;locked:boolean;onRemove:(graph:MethodologyGraph,index:number)=>void}){
 const id=useId(),[selection,setSelection]=useState<{graph:MethodologyGraph;index:number}|null>(null);
 const latest=useRef({graph,locked,onRemove});latest.current={graph,locked,onRemove};
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const counts=new Map<string,number>();for(const node of graph.nodes)counts.set(node.nodeId,(counts.get(node.nodeId)??0)+1);
 const duplicates=graph.nodes.flatMap((node,index)=>(counts.get(node.nodeId)??0)>1?[{node,index}]:[]);
 const selected=selection?.graph===graph?duplicates.find(item=>item.index===selection.index):undefined;
 if(!duplicates.length)return null;
 function remove(){
  if(!alive.current||locked||!selected)return;
  const captured=latest.current,index=selected.index,node=selected.node;
  if(captured.graph!==graph||captured.locked||graph.nodes.filter(item=>item.nodeId===node.nodeId).length<2)return;
  if(!confirm(`현재 초안의 ${index+1}번째 단계 정의 ${node.name} (${node.nodeId}) 하나만 제거할까요? 같은 ID의 다른 정의와 연결·참조는 유지합니다.`))return;
  if(!alive.current||latest.current.graph!==graph||latest.current.locked||graph.nodes[index]!==node)return;
  latest.current.onRemove(graph,index);setSelection(null);
 }
 return <section aria-label="중복 단계 정의 복구">
  <h4>중복 단계 정의 확인</h4>
  <p role="alert">같은 단계 ID가 여러 번 정의되어 있습니다. 해당 ID의 일반 편집·이동·단계 제거는 중단했습니다. 남길 정의를 확인하고 불필요한 정의 하나씩 제거하세요.</p>
  <label htmlFor={id}>제거할 중복 단계 정의</label><select id={id} disabled={locked} value={selected?.index??''} onChange={event=>setSelection(event.target.value===''?null:{graph,index:Number(event.target.value)})}>
   <option value="">제거할 정의를 선택하세요</option>
   {duplicates.map(({node,index})=><option key={index} value={index}>{index+1}번째 · {node.nodeId} · {node.name||'이름 미작성'}</option>)}
  </select>
  {selected?<><p>{selected.index+1}번째 정의 · {selected.node.name||'이름 미작성'} ({selected.node.nodeId})</p><pre aria-label="선택한 중복 단계 정의" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(selected.node,null,2)}</pre></>:null}
  <p className="meta">선택한 정의의 입력·출력 문서 등 현재 초안 내용만 제거합니다. 같은 ID의 다른 정의, 연결·시작·종료 단계와 다른 단계의 참조는 유지합니다. 남은 참조의 의미는 저장 후 구조 검사·내용 검토에서 확인하세요. 문서 원본은 삭제하지 않습니다.</p>
  <button type="button" disabled={locked||!selected} onClick={remove}>확인한 중복 정의 하나만 제거</button>
 </section>;
}
