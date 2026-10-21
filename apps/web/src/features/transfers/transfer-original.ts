import {ApiClient,ApiError} from '../../api/client.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {readDocument} from '../design-trace/api.ts';
import {readKnowledge} from '../knowledge/api.ts';
import {readConversationMessage} from '../knowledge/conversation-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readTransferContext} from './transfer-read.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
function fail():never{throw new ApiError('TRANSFER_ORIGINAL_BINDING_INVALID',412);}
/** 사용자 선택 항목 한 건만 읽는다. 저장된 링크를 현재 안전·의미·전달 허가로 승격하지 않는다. */
export async function readTransferOriginal(client:ApiClient,projectId:string,assignmentRef:PlanRef,contextRef:PlanRef,itemId:string,active:()=>boolean=()=>true){
 if(typeof itemId!=='string'||!itemId.length||itemId.length>200)fail();
 const context=await readTransferContext(client,projectId,assignmentRef,contextRef,active);if(!active()||!context)return null;
 if(context.currentCheck.state!=='MATCHED_METADATA'||context.currentCheck.issues.length)throw new ApiError('TRANSFER_SOURCE_CURRENTNESS_UNAVAILABLE',412);
 const items=context.manifest.items.filter(item=>item.itemId===itemId),bindings=context.manifest.sourceBindings.filter(binding=>binding.itemId===itemId);
 if(items.length!==1||bindings.length!==1)fail();
 const item=items[0]!,binding=bindings[0]!,selection=binding.selection,expected:any=binding.bodyRef;
 if(item.includedState!=='INCLUDED'||item.issue!==null||!selection||!expected||expected.bytes<0||expected.bytes>2*1024*1024||!Number.isSafeInteger(expected.bytes))fail();
 const reference=selection.kind==='USER_INSTRUCTION'?selection.messageRef:selection.versionRef;
 if(!same(item.sourceRef,reference)||item.sourceHash!==reference.contentHash)fail();
 let body:string,title:string,currentRef:unknown,currentBody:unknown;
 if(selection.kind==='DOCUMENT_VERSION'){
  const r=selection.versionRef,value=await readDocument(client,projectId,r.id,r.version,{expectedContentHash:r.contentHash,active});if(!active())return null;
  const d=value.document,review=d.contentReviews.find(r=>r.sourceKind==='HUMAN_REVIEW'&&r.ref.criteriaVersion===1);
  if(binding.sourceState!=='CONFIRMED'||!d.confirmed||!review||review.ref.outcome!=='ACCEPTED'||!same(review.ref.targetRef,r))throw new ApiError('TRANSFER_SOURCE_CURRENTNESS_UNAVAILABLE',412);
  body=value.body;title=d.title;currentRef={id:d.id,version:d.version,contentHash:d.contentHash};currentBody=d.content.body;
 }else if(selection.kind==='KNOWLEDGE_VERSION'){
  const value=await readKnowledge(client,projectId,selection.versionRef);if(!active())return null;
  if(binding.sourceState!=='CONFIRMED'||value.state!=='CONFIRMED'||value.currentConfirmationValid!==true)throw new ApiError('TRANSFER_SOURCE_CURRENTNESS_UNAVAILABLE',412);
  body=value.body;title=value.entry.title;currentRef=value.ref;currentBody=value.entry.contentRef;
 }else if(selection.kind==='USER_INSTRUCTION'){
  const value=await readConversationMessage(client,projectId,selection.conversationId,selection.messageRef);if(!active())return null;
  if(binding.sourceState!=='STORED_NOT_EFFECTIVENESS_APPROVED'||value.message.kind!=='USER_INSTRUCTION')fail();
  body=value.body;title='사용자 지시 원문 · 현재 효력은 별도 확인';currentRef=value.sourceRef;currentBody=value.message.bodyRef;
 }else return fail();
 if(!active())return null;
 if(!same(currentRef,reference)||!same(currentBody,expected))fail();
 return{itemId,kind:selection.kind,title,body,sourceRef:structuredClone(reference),bodyRef:structuredClone(expected),transferred:false as const};
}
