import{randomUUID}from'node:crypto';
import type{PoolClient}from'pg';
import{AuthFailure,type AuthenticatedIdentity}from'../access/repository.ts';
import{projectMember,persistProjectReceipt,type ProjectCommand}from'../access/project-command.ts';
import type{ProjectDocuments}from'../documents/project-documents.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';
import{assertKnowledgeTextSafe}from'./knowledge-entry.ts';
import{readConversationInput,type MessageRef}from'./conversation-input.ts';
import type{ProjectListCodec}from'../projects/service.ts';
function pageInput(q:Record<string,unknown>){
 if(Object.keys(q).some(k=>!['limit','cursor'].includes(k))||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(q.limit)||Number(q.limit)>200)||q.cursor!==undefined&&(typeof q.cursor!=='string'||q.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
 return{limit:q.limit===undefined?50:Number(q.limit),cursor:q.cursor as string|undefined};
}
export class ProjectConversations{
 #documents:ProjectDocuments;
 constructor(documents:ProjectDocuments){this.#documents=documents;}
 async append(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const p=readConversationInput(c.payload,c.projectId);let conversationId=p.conversationId,sequence=1;
  if(conversationId===null){if(c.targetId!==null||c.expectedVersion!==0)throw new AuthFailure('VERSION_CONFLICT',409);conversationId=randomUUID();}
  else{
   if(c.targetId!==conversationId)throw new AuthFailure('CONVERSATION_INPUT_INVALID',422);
   const row=(await db.query('SELECT head_sequence,target_role_ref FROM anvil.conversations WHERE project_id=$1 AND id=$2 FOR UPDATE',[c.projectId,conversationId])).rows[0];
   if(!row)throw new AuthFailure('NOT_FOUND',404);
   if(Number(row.head_sequence)!==c.expectedVersion||!Number.isSafeInteger(c.expectedVersion+1))throw new AuthFailure('VERSION_CONFLICT',409);
   if(row.target_role_ref!==null)throw new AuthFailure('CONVERSATION_BINDING_NOT_READY',412);sequence=c.expectedVersion+1;
  }
  const body=await this.#documents.originalText(db,c.projectId,p.message.bodyRef);assertKnowledgeTextSafe(body);
  for(const [kind,ref]of[['reply',p.message.replyTo],['supersedes',p.message.supersedesInstructionRef]]as const){
   if(!ref)continue;const existing=await this.readMessage(db,actor,c.projectId,conversationId,ref.id);
   if(existing.sourceRef.contentHash!==ref.contentHash)throw new AuthFailure('CONVERSATION_SOURCE_MISMATCH',409);
   if(kind==='supersedes'&&existing.message.kind!=='USER_INSTRUCTION')throw new AuthFailure('CONVERSATION_CORRECTION_INVALID',422);
  }
  const authorRef={kind:'HUMAN',userId:actor.actorId},snapshot={conversationId,targetRoleRef:null,message:p.message,sourceRefs:[],serverSequence:sequence,authorRef};
  const id=randomUUID(),hash=contentHash(canonicalJson(snapshot)),sourceRef:MessageRef={kind:'CONVERSATION',id,contentHash:hash};
  const receipt=await persistProjectReceipt(db,actor,c,{id,version:1,contentHash:hash},{status:'CONVERSATION_STORED',sourceRef,conversationId,serverSequence:sequence,deliveryState:'STORED',message:snapshot},policyRef,'EXPLICIT_HUMAN_CONVERSATION');
  if(p.conversationId===null)await db.query('INSERT INTO anvil.conversations(id,project_id,target_role_ref,head_sequence,created_by,last_client_id,last_command_id) VALUES($1,$2,NULL,1,$3,$4,$5)',[conversationId,c.projectId,actor.actorId,actor.clientId,receipt.id]);
  else await db.query('UPDATE anvil.conversations SET head_sequence=$3,last_client_id=$4,last_command_id=$5,updated_at=now() WHERE project_id=$1 AND id=$2',[c.projectId,conversationId,sequence,actor.clientId,receipt.id]);
  await db.query("INSERT INTO anvil.conversation_messages(project_id,conversation_id,sequence,id,author_ref,kind,body_artifact_id,source_refs,reply_to,supersedes_instruction_id,effective_scope,message_json,content_hash,redaction_state,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,'[]',$8,$9,$10,$11,$12,'NOT_REDACTED',$13,$14)",[c.projectId,conversationId,sequence,id,JSON.stringify(authorRef),p.message.kind,p.message.bodyRef.artifactId,p.message.replyTo?.id??null,p.message.supersedesInstructionRef?.id??null,JSON.stringify(p.message.effectiveScope),JSON.stringify(snapshot),hash,actor.clientId,receipt.id]);
  return receipt.result;
 }
 async readMessage(db:PoolClient,actor:AuthenticatedIdentity,pid:string,conversationId:string,id:string){
  await projectMember(db,actor,pid);
  const r=(await db.query('SELECT * FROM anvil.conversation_messages WHERE project_id=$1 AND conversation_id=$2 AND id=$3',[pid,conversationId,id])).rows[0];if(!r)throw new AuthFailure('NOT_FOUND',404);
  const s=r.message_json,p=readConversationInput({conversationId:s.conversationId,targetRoleRef:s.targetRoleRef,message:s.message,sourceRefs:s.sourceRefs},pid);
  if(s.conversationId!==conversationId||s.serverSequence!==Number(r.sequence)||canonicalJson(s.authorRef)!==canonicalJson(r.author_ref)||s.authorRef?.kind!=='HUMAN'||p.message.kind!==r.kind||p.message.bodyRef.artifactId!==r.body_artifact_id||p.message.replyTo?.id!==(r.reply_to??undefined)||p.message.supersedesInstructionRef?.id!==(r.supersedes_instruction_id??undefined)||canonicalJson(p.message.effectiveScope)!==canonicalJson(r.effective_scope)||canonicalJson(p.sourceRefs)!==canonicalJson(r.source_refs)||contentHash(canonicalJson(s))!==r.content_hash||r.redaction_state!=='NOT_REDACTED')throw new AuthFailure('CONVERSATION_INTEGRITY_FAILED',503);
  const body=await this.#documents.originalText(db,pid,p.message.bodyRef);assertKnowledgeTextSafe(body);
  return{sourceRef:{kind:'CONVERSATION' as const,id,contentHash:r.content_hash},conversationId,serverSequence:Number(r.sequence),authorRef:s.authorRef,message:p.message,body,deliveryState:'STORED',redactionState:r.redaction_state,sensitiveInspection:'KNOWN_PATTERNS_ONLY',recordedAt:r.recorded_at.toISOString()};
 }
 async list(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){
  await projectMember(db,actor,pid);const{limit,cursor}=pageInput(q),filter={query:pid,archived:false,limit};
  let pos:{at:string;id:string}|null=null;if(cursor!==undefined){try{pos=codec.read(cursor,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
  const rows=(await db.query("SELECT id,head_sequence,target_role_ref,updated_at,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.conversations WHERE project_id=$1 AND ($2::timestamptz IS NULL OR (updated_at,id)<($2::timestamptz,$3::uuid)) ORDER BY updated_at DESC,id DESC LIMIT $4",[pid,pos?.at??null,pos?.id??null,limit+1])).rows;
  const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);
  return{items:rows.slice(0,limit).map(r=>({id:r.id,headSequence:Number(r.head_sequence),targetRoleRef:r.target_role_ref,updatedAt:r.updated_at.toISOString(),integrity:'NOT_RECHECKED'})),hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:new Date().toISOString()};
 }
 async messages(db:PoolClient,actor:AuthenticatedIdentity,pid:string,cid:string,q:Record<string,unknown>,codec:ProjectListCodec){
  await projectMember(db,actor,pid);const{limit,cursor}=pageInput(q),filter={query:canonicalJson({projectId:pid,conversationId:cid}),archived:false,limit};
  const conversation=(await db.query('SELECT head_sequence FROM anvil.conversations WHERE project_id=$1 AND id=$2',[pid,cid])).rows[0];if(!conversation)throw new AuthFailure('NOT_FOUND',404);
  let before:number|null=null;if(cursor!==undefined){
   let pos:{at:string;id:string};try{pos=codec.read(cursor,actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}
   const row=(await db.query('SELECT sequence FROM anvil.conversation_messages WHERE project_id=$1 AND conversation_id=$2 AND id=$3 AND recorded_at=$4::timestamptz',[pid,cid,pos.id,pos.at])).rows[0];if(!row)throw new AuthFailure('CURSOR_INVALID',400);before=Number(row.sequence);
  }
  const rows=(await db.query("SELECT id,sequence,to_char(recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.conversation_messages WHERE project_id=$1 AND conversation_id=$2 AND ($3::bigint IS NULL OR sequence<$3) ORDER BY sequence DESC LIMIT $4",[pid,cid,before,limit+1])).rows;
  const items=[];for(const row of rows.slice(0,limit)){
   const m=await this.readMessage(db,actor,pid,cid,row.id);items.push({sourceRef:m.sourceRef,serverSequence:m.serverSequence,authorRef:m.authorRef,kind:m.message.kind,replyTo:m.message.replyTo,supersedesInstructionRef:m.message.supersedesInstructionRef,recordedAt:m.recordedAt,deliveryState:m.deliveryState});
  }
  const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);
  return{conversationId:cid,observedHeadSequence:Number(conversation.head_sequence),items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,observedAt:new Date().toISOString()};
 }
}
