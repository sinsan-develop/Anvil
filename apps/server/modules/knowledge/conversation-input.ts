import {AuthFailure} from '../access/repository.ts';
import {exact,textArtifact,uuid,type TextArtifactRef} from './knowledge-entry.ts';
export interface MessageRef{kind:'CONVERSATION';id:string;contentHash:string}
export interface ConversationInput{conversationId:string|null;targetRoleRef:null;message:{kind:'USER_INSTRUCTION'|'USER_MESSAGE';bodyRef:TextArtifactRef;attachmentRefs:never[];replyTo:MessageRef|null;supersedesInstructionRef:MessageRef|null;effectiveScope:{projectId:string;stageRefs:never[];taskRefs:never[]}};sourceRefs:never[]}
const reference=(r:unknown):r is MessageRef=>exact(r,['kind','id','contentHash'])&&r.kind==='CONVERSATION'&&uuid(r.id)&&typeof r.contentHash==='string'&&/^[0-9a-f]{64}$/.test(r.contentHash);
export function readConversationInput(value:unknown,pid:string):ConversationInput{
 if(!exact(value,['conversationId','targetRoleRef','message','sourceRefs'])||value.conversationId!==null&&!uuid(value.conversationId)||!exact(value.message,['kind','bodyRef','attachmentRefs','replyTo','supersedesInstructionRef','effectiveScope'])||!textArtifact(value.message.bodyRef)||!Array.isArray(value.message.attachmentRefs)||!Array.isArray(value.sourceRefs)||!exact(value.message.effectiveScope,['projectId','stageRefs','taskRefs'])||value.message.effectiveScope.projectId!==pid||!Array.isArray(value.message.effectiveScope.stageRefs)||!Array.isArray(value.message.effectiveScope.taskRefs)||value.message.replyTo!==null&&!reference(value.message.replyTo)||value.message.supersedesInstructionRef!==null&&!reference(value.message.supersedesInstructionRef))throw new AuthFailure('CONVERSATION_INPUT_INVALID',422);
 if(!['USER_INSTRUCTION','USER_MESSAGE'].includes(String(value.message.kind))||value.targetRoleRef!==null||value.message.attachmentRefs.length||value.sourceRefs.length||value.message.effectiveScope.stageRefs.length||value.message.effectiveScope.taskRefs.length)throw new AuthFailure('CONVERSATION_BINDING_NOT_READY',412);
 if(value.message.supersedesInstructionRef!==null&&value.message.kind!=='USER_INSTRUCTION')throw new AuthFailure('CONVERSATION_CORRECTION_INVALID',422);
 return structuredClone(value) as unknown as ConversationInput;
}
