import {useEffect,useRef} from 'react';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {AssignmentBuffer} from './assignment-api.ts';
import {reduceAssignmentSourceScope} from './assignment-scope-reduction.ts';
export function AssignmentScopeReduction({buffer,session,locked,update,run}:{buffer:AssignmentBuffer;session:DocumentSession;locked:boolean;update:(change:(current:AssignmentBuffer)=>AssignmentBuffer)=>void;run:(action:()=>Promise<void>)=>void}){
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const disabled=locked||!!buffer.pending||!!buffer.result||buffer.uncertain||buffer.ownerUserId!==session.user.id||buffer.ownerClientId!==session.clientId;
 const remove=(scope:number,target:number|null)=>{if(disabled)return;run(async()=>reduceAssignmentSourceScope(buffer,session,scope,target,update,()=>active.current));};
 return <section aria-label="임무 소스 범위 축소"><h6>작성 범위에서 제거</h6><p>미저장 임무에서만 제거합니다. 원본 파일 삭제·기존 허가 회수·실행 중지는 아닙니다.</p>
 {buffer.input.definition.allowedScopes.length?<ol>{buffer.input.definition.allowedScopes.map((scope,index)=><li key={index}>
  <p>소스 범위 {index+1} · {scope.sourceRootRef.id} · v{scope.sourceRootRef.version}</p>
  <button type="button" disabled={disabled} onClick={()=>remove(index,null)}>소스 범위 {index+1} 전체 제외</button>
  <ul>{scope.targets.map((target,targetIndex)=><li key={targetIndex}><code>{target.relativePath}</code> · {target.access}
   <button type="button" disabled={disabled} onClick={()=>remove(index,targetIndex)} aria-label={'소스 범위 '+(index+1)+'에서 '+target.relativePath+' 제외'}>파일 제외</button>
  </li>)}</ul>
 </li>)}</ol>:<p>선택 범위 없음 · 범위 미충족이며 전체 접근 허가가 아닙니다.</p>}</section>;
}
