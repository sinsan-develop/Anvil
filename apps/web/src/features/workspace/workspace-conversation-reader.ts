import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import {listConversations,listConversationMessages,readConversationMessage,type ConversationView,type MessageSummary} from '../knowledge/conversation-api.ts';

export interface WorkspaceConversationState {
 conversations:Awaited<ReturnType<typeof listConversations>>|null;
 selectedConversation:{id:string;head:number}|null;
 messages:Awaited<ReturnType<typeof listConversationMessages>>|null;
 source:ConversationView|null;pending:boolean;error:ApiError|null;
}
export const newWorkspaceConversationState=():WorkspaceConversationState=>({conversations:null,selectedConversation:null,messages:null,source:null,pending:false,error:null});

/** 기존 허가된 GET만 소비한다. 현재 지시 선별·임무 편입·전달·쓰기 권한을 만들지 않는다. */
export class WorkspaceConversationReader {
 readonly #client:ApiClient;readonly #projectId:string;
 readonly #onState:(value:WorkspaceConversationState)=>void;readonly #onAuthenticationLost:()=>void;
 #state=newWorkspaceConversationState();#active=true;#sequence=0;
 constructor(client:ApiClient,projectId:string,onState:(value:WorkspaceConversationState)=>void,onAuthenticationLost:()=>void){this.#client=client;this.#projectId=projectId;this.#onState=onState;this.#onAuthenticationLost=onAuthenticationLost;}
 get state():Readonly<WorkspaceConversationState>{return this.#state;}
 #publish(patch:Partial<WorkspaceConversationState>){if(!this.#active)return;this.#state={...this.#state,...patch};this.#onState(this.#state);}
 async #run(reset:Partial<WorkspaceConversationState>,action:()=>Promise<Partial<WorkspaceConversationState>>){
  if(!this.#active||this.#state.pending)return;
  const sequence=++this.#sequence,current=()=>this.#active&&sequence===this.#sequence;
  this.#publish({...reset,source:null,pending:true,error:null});
  try{if(!current())return;const result=await action();if(current())this.#publish(result);}
  catch(cause){if(current()){const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');this.#publish({source:null,error});if(error.status===401&&current())this.#onAuthenticationLost();}}
  finally{if(current())this.#publish({pending:false});}
 }
 list(cursor:string|null=null){return this.#run({conversations:null,selectedConversation:null,messages:null},async()=>({conversations:await listConversations(this.#client,this.#projectId,cursor)}));}
 open(conversationId:string,cursor:string|null=null){
  const listed=this.#state.conversations?.items.some(item=>item.id===conversationId);
  return this.#run({selectedConversation:null,messages:null},async()=>{
   if(!listed)throw new ApiError('CONVERSATION_SELECTION_INVALID');
   const messages=await listConversationMessages(this.#client,this.#projectId,conversationId,cursor);
   return{selectedConversation:{id:conversationId,head:messages.observedHeadSequence},messages};
  });
 }
 read(sourceRef:MessageSummary['sourceRef']){
  const conversation=this.#state.selectedConversation,listed=this.#state.messages?.items.some(item=>ordered(item.sourceRef)===ordered(sourceRef));
  return this.#run({},async()=>{
   if(!conversation||!listed)throw new ApiError('CONVERSATION_SELECTION_INVALID');
   return{source:await readConversationMessage(this.#client,this.#projectId,conversation.id,sourceRef)};
  });
 }
 /** 이미 전송된 GET의 즉시 네트워크 중단을 보장하지 않는다. 결과·콜백·메모리 참조를 해제한다. */
 dispose(){this.#active=false;this.#sequence++;this.#state=newWorkspaceConversationState();}
}
