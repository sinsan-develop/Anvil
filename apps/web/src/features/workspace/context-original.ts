import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readKnowledge} from '../knowledge/api.ts';
import {readDocument} from '../design-trace/api.ts';
import {readConversationMessage} from '../knowledge/conversation-api.ts';
import {readContextPreparation} from './context-api.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
/** 저장 준비의 선택을 다시 읽는다. 원문/준비/명령 변경과 Agent 전달은 하지 않는다. */
async function readOriginal(client:ApiClient,projectId:string,contextRef:PlanRef,assignmentRef:PlanRef,itemId:string,active:()=>boolean,kind:'KNOWLEDGE_VERSION'|'DOCUMENT_VERSION'|'USER_INSTRUCTION'){
 if(!active())return null;
 try{
  if(typeof itemId!=='string'||!/^[A-Z_]+_[1-9][0-9]*$/.test(itemId))throw new ApiError('CONTEXT_SOURCE_INVALID');
  const context=await readContextPreparation(client,projectId,contextRef);if(!active())return null;
  const m=context.manifest;if(!same(m.assignmentRef,assignmentRef))throw new ApiError('CONTEXT_ASSIGNMENT_INVALID');
  const items=m.items.filter(i=>i.itemId===itemId),bindings=m.sourceBindings.filter(b=>b.itemId===itemId);
  if(items.length!==1||bindings.length!==1)throw new ApiError('CONTEXT_SOURCE_INVALID');
  const item=items[0]!,binding=bindings[0]!,selection=binding.selection;
  if(item.includedState!=='INCLUDED'||item.issue!==null||!selection||selection.kind!==kind||!binding.bodyRef)throw new ApiError('CONTEXT_SOURCE_UNAVAILABLE');
  const sourceRef=selection.kind==='USER_INSTRUCTION'?selection.messageRef:selection.versionRef;
  const slot=m.preparationInput.slots.find(s=>s.code===item.category),index=slot?.sources.findIndex(s=>same(s,selection))??-1;
  if(!slot||index<0||itemId!==slot.code+'_'+(index+1)||!same(item.sourceRef,sourceRef)||item.sourceHash!==sourceRef.contentHash)throw new ApiError('CONTEXT_SOURCE_INVALID');
  let body:string,title:string,state:string;
  if(selection.kind==='KNOWLEDGE_VERSION'){
   const value=await readKnowledge(client,projectId,selection.versionRef);if(!active())return null;
   if(value.state==='EXCLUDED'||!same(value.entry.contentRef,binding.bodyRef))throw new ApiError('CONTEXT_SOURCE_UNAVAILABLE');
   body=value.body;title=value.entry.title;state=value.state;
  }else if(selection.kind==='DOCUMENT_VERSION'){
   const value=await readDocument(client,projectId,selection.versionRef.id,selection.versionRef.version,{active});if(!active())return null;
   if(value.document.contentHash!==selection.versionRef.contentHash||!same(value.document.content.body,binding.bodyRef))throw new ApiError('CONTEXT_SOURCE_UNAVAILABLE');
   body=value.body;title=value.document.title;state=value.document.confirmed?'CONFIRMED_HISTORY':'UNCONFIRMED';
  }else{
   const value=await readConversationMessage(client,projectId,selection.conversationId,selection.messageRef);if(!active())return null;
   if(value.message.kind!=='USER_INSTRUCTION'||!same(value.message.bodyRef,binding.bodyRef))throw new ApiError('CONTEXT_SOURCE_UNAVAILABLE');
   body=value.body;title='저장된 사용자 지시';state='EFFECTIVENESS_UNVERIFIED';
  }
  return{contextRef:structuredClone(contextRef),sourceRef:selection.kind==='USER_INSTRUCTION'?{id:sourceRef.id,version:null,contentHash:sourceRef.contentHash}:structuredClone(selection.versionRef),title,body,state,executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch(cause){if(!active())return null;throw cause;}
}
export const readContextKnowledgeOriginal=(c:ApiClient,p:string,r:PlanRef,a:PlanRef,i:string,current:()=>boolean)=>readOriginal(c,p,r,a,i,current,'KNOWLEDGE_VERSION');
export const readContextDocumentOriginal=(c:ApiClient,p:string,r:PlanRef,a:PlanRef,i:string,current:()=>boolean)=>readOriginal(c,p,r,a,i,current,'DOCUMENT_VERSION');
export const readContextInstructionOriginal=(c:ApiClient,p:string,r:PlanRef,a:PlanRef,i:string,current:()=>boolean)=>readOriginal(c,p,r,a,i,current,'USER_INSTRUCTION');
