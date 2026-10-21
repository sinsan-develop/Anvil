import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readKnowledge} from '../knowledge/api.ts';
import {readContextPreparation} from './context-api.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 저장 준비의 선택을 다시 읽는다. 원문/준비/명령 변경과 Agent 전달은 하지 않는다. */
export async function readContextKnowledgeOriginal(client:ApiClient,projectId:string,contextRef:PlanRef,assignmentRef:PlanRef,itemId:string,active:()=>boolean){
 if(!active())return null;
 try{
  if(typeof itemId!=='string'||!/^[A-Z_]+_[1-9][0-9]*$/.test(itemId))throw new ApiError('CONTEXT_SOURCE_INVALID');
  const context=await readContextPreparation(client,projectId,contextRef);if(!active())return null;
  const m=context.manifest;if(!same(m.assignmentRef,assignmentRef))throw new ApiError('CONTEXT_ASSIGNMENT_INVALID');
  const items=m.items.filter(i=>i.itemId===itemId),bindings=m.sourceBindings.filter(b=>b.itemId===itemId);
  if(items.length!==1||bindings.length!==1)throw new ApiError('CONTEXT_SOURCE_INVALID');
  const item=items[0]!,binding=bindings[0]!,selection=binding.selection;
  if(item.includedState!=='INCLUDED'||item.issue!==null||!selection||selection.kind!=='KNOWLEDGE_VERSION'||!binding.bodyRef)throw new ApiError('CONTEXT_SOURCE_UNAVAILABLE');
  const slot=m.preparationInput.slots.find(s=>s.code===item.category),index=slot?.sources.findIndex(s=>same(s,selection))??-1;
  if(!slot||index<0||itemId!==slot.code+'_'+(index+1)||!same(item.sourceRef,selection.versionRef)||item.sourceHash!==selection.versionRef.contentHash)throw new ApiError('CONTEXT_SOURCE_INVALID');
  const value=await readKnowledge(client,projectId,selection.versionRef);if(!active())return null;
  if(value.state==='EXCLUDED'||!same(value.entry.contentRef,binding.bodyRef))throw new ApiError('CONTEXT_SOURCE_UNAVAILABLE');
  return{contextRef:structuredClone(contextRef),sourceRef:structuredClone(selection.versionRef),title:value.entry.title,body:value.body,state:value.state,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch(cause){if(!active())return null;throw cause;}
}
