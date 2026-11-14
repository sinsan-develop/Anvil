import{matchesConversationInput,validateConversationUploadApproval,validateConversationUploadBinding,type ConversationUploadApproval}from'./conversation-upload-approval.ts';
import{ApiClient,ApiError}from'../../api/client.ts';
import{postDocumentCommand,type DocumentSession,type DocumentWrite}from'../design-trace/editor-api.ts';
import type{ConversationInput,MessageRef}from'../../../../server/modules/knowledge/conversation-input.ts';
type Snapshot={body:string;kind:'USER_MESSAGE'|'USER_INSTRUCTION';conversationId:string|null;headSequence:number;supersedesInstructionRef:MessageRef|null;replyTo?:MessageRef|null};
export interface ConversationPending{bindingId:string;uploadApproval?:ConversationUploadApproval;upload:DocumentWrite;append:DocumentWrite|null;appendId:string;snapshot:Snapshot}
export interface ConversationResult{conversationId:string;serverSequence:number;sourceRef:MessageRef}
export interface ConversationBuffer extends Snapshot{bindingId:string;projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;pending:ConversationPending|null;result:ConversationResult|null;failure:{code:string;status:number;quarantinedArtifactId?:string}|null;uncertain:boolean;dirty:boolean}
export interface ConversationView extends ConversationResult{authorRef:{kind:'HUMAN';userId:string};message:ConversationInput['message'];body:string;deliveryState:'STORED';redactionState:'NOT_REDACTED';sensitiveInspection:'KNOWN_PATTERNS_ONLY';recordedAt:string}
export interface ConversationSummary{id:string;headSequence:number;targetRoleRef:null;updatedAt:string;integrity:'NOT_RECHECKED'}
export interface MessageSummary{sourceRef:MessageRef;serverSequence:number;authorRef:{kind:'HUMAN';userId:string};kind:'USER_MESSAGE'|'USER_INSTRUCTION';replyTo:MessageRef|null;supersedesInstructionRef:MessageRef|null;recordedAt:string;deliveryState:'STORED'}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const normalize=(v:any):any=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v,canonical=(v:any)=>JSON.stringify(normalize(v));
async function digest(bytes:Uint8Array<ArrayBuffer>){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const ref=(r:MessageRef)=>r&&r.kind==='CONVERSATION'&&uuid.test(r.id)&&hash.test(r.contentHash)&&Object.keys(r).sort().join(',')==='contentHash,id,kind';
function bound(b:ConversationBuffer,s:DocumentSession){if(!uuid.test(b.bindingId)||!uuid.test(b.projectId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid.test(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1||!Number.isSafeInteger(b.headSequence)||b.headSequence<0||!Number.isSafeInteger(b.headSequence+1)||b.conversationId===null&&b.headSequence!==0||b.conversationId!==null&&(!uuid.test(b.conversationId)||b.headSequence<1)||b.replyTo!=null&&(!ref(b.replyTo)||b.conversationId===null)||!['USER_MESSAGE','USER_INSTRUCTION'].includes(b.kind)||b.supersedesInstructionRef!==null&&(!ref(b.supersedesInstructionRef)||b.kind!=='USER_INSTRUCTION'))throw new ApiError('CONVERSATION_BINDING_INVALID');}
export function newConversation(pid:string,s:DocumentSession,generation:number,conversationId:string|null=null,headSequence=0):ConversationBuffer{
 const b:ConversationBuffer={bindingId:crypto.randomUUID(),projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,conversationId,headSequence,body:'',kind:'USER_MESSAGE',supersedesInstructionRef:null,replyTo:null,pending:null,result:null,failure:null,uncertain:false,dirty:false};bound(b,s);return b;
}
const snapshot=(b:ConversationBuffer):Snapshot=>({body:b.body,kind:b.kind,conversationId:b.conversationId,headSequence:b.headSequence,supersedesInstructionRef:b.supersedesInstructionRef,replyTo:b.replyTo??null});
/** 기존 보호 조회로 원발언을 대조한다. 새 head/권한은 저장 시 서버가 다시 검사한다. */
export async function prepareConversationReply(client:ApiClient,pid:string,s:DocumentSession,generation:number,cid:string,head:number,sourceRef:MessageRef):Promise<ConversationBuffer>{
 const b=newConversation(pid,s,generation,cid,head),original=await readConversationMessage(client,pid,cid,sourceRef);
 if(original.serverSequence>head)throw new ApiError('CONVERSATION_REPLY_INVALID');
 return {...b,replyTo:structuredClone(original.sourceRef),dirty:true};
}
export async function prepareConversation(b:ConversationBuffer,s:DocumentSession):Promise<ConversationPending>{
 bound(b,s);if(b.pending||b.result||!b.body.trim()||!b.body.isWellFormed())throw new ApiError('CONVERSATION_INPUT_INVALID');const bytes=new TextEncoder().encode(b.body);if(bytes.length>2*1024*1024)throw new ApiError('CONVERSATION_BODY_TOO_LARGE');
 return{bindingId:b.bindingId,snapshot:structuredClone(snapshot(b)),upload:{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:await digest(bytes)}},appendId:crypto.randomUUID(),append:null};
}
function messageValid(m:ConversationInput['message'],pid:string){return m&&Object.keys(m).sort().join(',')==='attachmentRefs,bodyRef,effectiveScope,kind,replyTo,supersedesInstructionRef'&&['USER_MESSAGE','USER_INSTRUCTION'].includes(m.kind)&&Array.isArray(m.attachmentRefs)&&!m.attachmentRefs.length&&(m.replyTo===null||ref(m.replyTo))&&(m.supersedesInstructionRef===null||ref(m.supersedesInstructionRef)&&m.kind==='USER_INSTRUCTION')&&canonical(m.effectiveScope)===canonical({projectId:pid,stageRefs:[],taskRefs:[]})&&m.bodyRef&&uuid.test(m.bodyRef.artifactId)&&Number.isSafeInteger(m.bodyRef.bytes)&&m.bodyRef.bytes>=0&&m.bodyRef.bytes<=2*1024*1024&&hash.test(m.bodyRef.contentHash)&&['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(m.bodyRef.mediaType);}
export async function sendConversation(client:ApiClient,b:ConversationBuffer,s:DocumentSession,checkpoint:(p:ConversationPending)=>void,active:()=>boolean):Promise<ConversationResult>{
 bound(b,s);let p=b.pending;if(!p||!matchesConversationInput(b,p,s)||!uuid.test(p.appendId)||canonical({...p.snapshot,replyTo:p.snapshot.replyTo??null})!==canonical(snapshot(b)))throw new ApiError('CONVERSATION_INPUT_INVALID');const u=p.upload,bytes=new TextEncoder().encode(p.snapshot.body),metadata={mediaType:'text/plain;charset=utf-8',bytes:bytes.length,contentHash:await digest(bytes)};
 if(u.schemaVersion!==1||u.projectId!==b.projectId||u.clientId!==s.clientId||u.controlGeneration!==b.controlGeneration||!uuid.test(u.commandId)||u.operation!=='uploadArtifact'||u.targetId!==null||u.expectedVersion!==0||u.baselineRefs.length||(u.approvalRef!==null&&!p.uploadApproval?.commandHash)||(u.approvalRef===null&&!!p.uploadApproval)||canonical(u.payload)!==canonical(metadata))throw new ApiError('CONVERSATION_INPUT_INVALID');
 if(!active())throw new ApiError('CONVERSATION_CONTINUATION_PAUSED');
 if(u.approvalRef!==null)await validateConversationUploadBinding(p,s,active);
 if(!p.append){if(u.approvalRef!==null)await validateConversationUploadApproval(client,p,s,active);if(!active())throw new ApiError('CONVERSATION_CONTINUATION_PAUSED');const r=await postDocumentCommand(client,u,s.csrfToken,bytes);if(!active())throw new ApiError('CONVERSATION_CONTINUATION_PAUSED');const a=r.data?.artifactRef;if(!a||!uuid.test(a.artifactId)||canonical({bytes:a.bytes,contentHash:a.contentHash,mediaType:a.mediaType})!==canonical(metadata)||r.targetId!==a.artifactId||r.version!==null||r.data.status!=='ARTIFACT_READY')throw new ApiError('RESPONSE_INVALID');
  p={...p,append:{...u,approvalRef:null,commandId:p.appendId,operation:'appendConversation',targetId:b.conversationId,expectedVersion:b.headSequence,payload:{conversationId:b.conversationId,targetRoleRef:null,message:{kind:b.kind,bodyRef:a,attachmentRefs:[],replyTo:b.replyTo??null,supersedesInstructionRef:b.supersedesInstructionRef,effectiveScope:{projectId:b.projectId,stageRefs:[],taskRefs:[]}},sourceRefs:[]}}};checkpoint(p);
 }
 if(!active())throw new ApiError('CONVERSATION_CONTINUATION_PAUSED');const c=p.append!,v=c.payload as unknown as ConversationInput;
 if(c.schemaVersion!==1||c.commandId!==p.appendId||c.projectId!==u.projectId||c.clientId!==u.clientId||c.controlGeneration!==u.controlGeneration||c.operation!=='appendConversation'||c.targetId!==b.conversationId||c.expectedVersion!==b.headSequence||c.baselineRefs.length||c.approvalRef!==null||v.conversationId!==b.conversationId||v.targetRoleRef!==null||!Array.isArray(v.sourceRefs)||v.sourceRefs.length||!messageValid(v.message,b.projectId)||v.message.kind!==b.kind||canonical(v.message.replyTo)!==canonical(b.replyTo??null)||canonical(v.message.supersedesInstructionRef)!==canonical(b.supersedesInstructionRef)||canonical({bytes:v.message.bodyRef.bytes,contentHash:v.message.bodyRef.contentHash,mediaType:v.message.bodyRef.mediaType})!==canonical(metadata))throw new ApiError('CONVERSATION_INPUT_INVALID');
 const r=await postDocumentCommand(client,c,s.csrfToken),d=r.data;
 if(!d||d.status!=='CONVERSATION_STORED'||d.deliveryState!=='STORED'||!ref(d.sourceRef)||!uuid.test(d.conversationId)||b.conversationId!==null&&d.conversationId!==b.conversationId||d.serverSequence!==b.headSequence+1||r.targetId!==d.sourceRef.id||r.version!==1||canonical(d.message)!==canonical({conversationId:d.conversationId,targetRoleRef:null,message:v.message,sourceRefs:[],serverSequence:d.serverSequence,authorRef:{kind:'HUMAN',userId:b.ownerUserId}})||await digest(new TextEncoder().encode(canonical(d.message)))!==d.sourceRef.contentHash)throw new ApiError('RESPONSE_INVALID');
 if(!active())throw new ApiError('CONVERSATION_CONTINUATION_PAUSED');return{conversationId:d.conversationId,serverSequence:d.serverSequence,sourceRef:d.sourceRef};
}
export async function readConversationMessage(client:ApiClient,pid:string,cid:string,sourceRef:MessageRef):Promise<ConversationView>{
 if(!uuid.test(pid)||!uuid.test(cid)||!ref(sourceRef))throw new ApiError('CLIENT_PATH_INVALID');const v=await client.get<ConversationView>(`/api/v1/projects/${pid}/conversations/${cid}/messages/${sourceRef.id}`);
 if(!v||canonical(v.sourceRef)!==canonical(sourceRef)||v.conversationId!==cid||!Number.isSafeInteger(v.serverSequence)||v.serverSequence<1||v.authorRef?.kind!=='HUMAN'||!uuid.test(v.authorRef.userId)||!messageValid(v.message,pid)||typeof v.body!=='string'||!v.body.isWellFormed()||v.deliveryState!=='STORED'||v.redactionState!=='NOT_REDACTED'||v.sensitiveInspection!=='KNOWN_PATTERNS_ONLY'||!Number.isFinite(Date.parse(v.recordedAt)))throw new ApiError('RESPONSE_INVALID');
 const bytes=new TextEncoder().encode(v.body),s={conversationId:cid,targetRoleRef:null,message:v.message,sourceRefs:[],serverSequence:v.serverSequence,authorRef:v.authorRef};
 if(bytes.length!==v.message.bodyRef.bytes||await digest(bytes)!==v.message.bodyRef.contentHash||await digest(new TextEncoder().encode(canonical(s)))!==sourceRef.contentHash)throw new ApiError('CONVERSATION_INTEGRITY_FAILED');return v;
}
function pageValid(v:any){return v&&Array.isArray(v.items)&&v.items.length<=50&&typeof v.hasMore==='boolean'&&(v.hasMore?typeof v.nextCursor==='string'&&v.nextCursor.length>0&&v.nextCursor.length<=4096:v.nextCursor===null)&&Number.isFinite(Date.parse(v.observedAt));}
function pageQuery(pid:string,cursor:string|null){if(!uuid.test(pid)||cursor!==null&&(typeof cursor!=='string'||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');const q=new URLSearchParams({limit:'50'});if(cursor)q.set('cursor',cursor);return q;}
export async function listConversations(client:ApiClient,pid:string,cursor:string|null=null){const q=pageQuery(pid,cursor),v=await client.get<{items:ConversationSummary[];hasMore:boolean;nextCursor:string|null;observedAt:string}>(`/api/v1/projects/${pid}/conversations?${q}`);if(!pageValid(v)||v.items.some(i=>!i||!uuid.test(i.id)||!Number.isSafeInteger(i.headSequence)||i.headSequence<1||i.targetRoleRef!==null||i.integrity!=='NOT_RECHECKED'||!Number.isFinite(Date.parse(i.updatedAt))))throw new ApiError('RESPONSE_INVALID');return v;}
export async function listConversationMessages(client:ApiClient,pid:string,cid:string,cursor:string|null=null){const q=pageQuery(pid,cursor);if(!uuid.test(cid))throw new ApiError('CLIENT_PATH_INVALID');const v=await client.get<{conversationId:string;observedHeadSequence:number;items:MessageSummary[];hasMore:boolean;nextCursor:string|null;observedAt:string}>(`/api/v1/projects/${pid}/conversations/${cid}/messages?${q}`);if(!pageValid(v)||v.conversationId!==cid||!Number.isSafeInteger(v.observedHeadSequence)||v.observedHeadSequence<1||v.items.some((i,n)=>!i||!ref(i.sourceRef)||!Number.isSafeInteger(i.serverSequence)||i.serverSequence<1||i.serverSequence>v.observedHeadSequence||n>0&&i.serverSequence>=v.items[n-1]!.serverSequence||i.authorRef?.kind!=='HUMAN'||!uuid.test(i.authorRef.userId)||!['USER_MESSAGE','USER_INSTRUCTION'].includes(i.kind)||i.deliveryState!=='STORED'||i.replyTo!==null&&!ref(i.replyTo)||i.supersedesInstructionRef!==null&&!ref(i.supersedesInstructionRef)||!Number.isFinite(Date.parse(i.recordedAt))))throw new ApiError('RESPONSE_INVALID');return v;}


export interface InstructionPartsResult {
 instructionRef:{id:string;version:1;contentHash:string};
 partsRef:{id:string;version:1;contentHash:string};
 plan:{schemaVersion:1;purpose:'INSTRUCTION_PARTS_PLAN';algorithm:'UTF8_CODEPOINT_64K_V1';bodyRef:ConversationInput['message']['bodyRef'];limits:{maxSourceBytes:2097152;maxPartBytes:65536;maxParts:200};parts:{partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string}[]};
}
const partsInvalid=():never=>{throw new ApiError('INSTRUCTION_PARTS_INVALID');};
// Closed data only: capture once before awaits; getters are never used as response data.
function partsData(value:unknown,depth=0):any{
 if(depth>12)return partsInvalid();
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'){if(value.length>2097152)return partsInvalid();return value;}
 if(typeof value!=='object')return partsInvalid();
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
 if(array?proto!==Array.prototype||value.length>200:proto!==Object.prototype&&proto!==null)return partsInvalid();
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(k=>typeof k!=='string')||keys.length>201)return partsInvalid();
 const out:any=array?[]:{};
 for(const k of keys as string[]){if(array&&k==='length')continue;const d=descriptors[k]!;if(!('value'in d)||!d.enumerable||array&&!/^(0|[1-9][0-9]*)$/.test(k))return partsInvalid();Object.defineProperty(out,k,{value:partsData(d.value,depth+1),enumerable:true,writable:true,configurable:true});}
 if(array&&Object.keys(out).length!==value.length)return partsInvalid();return out;
}
const partsExact=(v:any,keys:string)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
/** Read-only validation, not SEND admission. active invalidates late responses; it does not cancel transport. */
export async function readInstructionParts(client:ApiClient,pid:string,cid:string,original:ConversationView,active:()=>boolean):Promise<InstructionPartsResult>{
 const live=()=>{if(!active())throw new ApiError('INSTRUCTION_PARTS_STALE');};live();
 const v=partsData(original) as ConversationView,encoded=canonical(v);
 const check=()=>{live();if(canonical(partsData(original))!==encoded)return partsInvalid();};
 const hashed=async(bytes:Uint8Array<ArrayBuffer>)=>{check();const result=await digest(bytes);check();return result;};
 try{
  if(!uuid.test(pid)||!uuid.test(cid)||!v||!ref(v.sourceRef)||v.conversationId!==cid||!messageValid(v.message,pid)||v.message.kind!=='USER_INSTRUCTION'||!partsExact(v.message.bodyRef,'artifactId,bytes,contentHash,mediaType')||!Number.isSafeInteger(v.serverSequence)||v.serverSequence<1||!partsExact(v.authorRef,'kind,userId')||v.authorRef.kind!=='HUMAN'||!uuid.test(v.authorRef.userId)||typeof v.body!=='string'||!v.body.isWellFormed()||v.deliveryState!=='STORED'||v.redactionState!=='NOT_REDACTED'||v.sensitiveInspection!=='KNOWN_PATTERNS_ONLY'||!Number.isFinite(Date.parse(v.recordedAt)))return partsInvalid();
  const bytes=new TextEncoder().encode(v.body);
  if(bytes.length<1||bytes.length>2097152||bytes.length!==v.message.bodyRef.bytes||await hashed(bytes)!==v.message.bodyRef.contentHash)return partsInvalid();
  const snapshot={conversationId:cid,targetRoleRef:null,message:v.message,sourceRefs:[],serverSequence:v.serverSequence,authorRef:v.authorRef};
  if(await hashed(new TextEncoder().encode(canonical(snapshot)))!==v.sourceRef.contentHash)return partsInvalid();
  check();const raw=await client.get<unknown>(`/api/v1/projects/${pid}/conversations/${cid}/messages/${v.sourceRef.id}/instruction-parts`);check();
  const r=partsData(raw);
  if(!partsExact(r,'instructionRef,partsRef,plan')||!partsExact(r.instructionRef,'contentHash,id,version')||canonical(r.instructionRef)!==canonical({id:v.sourceRef.id,version:1,contentHash:v.sourceRef.contentHash})||!partsExact(r.partsRef,'contentHash,id,version')||r.partsRef.id!==v.message.bodyRef.artifactId||r.partsRef.version!==1||!hash.test(r.partsRef.contentHash)||!partsExact(r.plan,'algorithm,bodyRef,limits,parts,purpose,schemaVersion')||r.plan.schemaVersion!==1||r.plan.purpose!=='INSTRUCTION_PARTS_PLAN'||r.plan.algorithm!=='UTF8_CODEPOINT_64K_V1'||canonical(r.plan.bodyRef)!==canonical(v.message.bodyRef)||canonical(r.plan.limits)!==canonical({maxSourceBytes:2097152,maxPartBytes:65536,maxParts:200})||!Array.isArray(r.plan.parts)||r.plan.parts.length<1||r.plan.parts.length>200)return partsInvalid();
  let offset=0,index=0;
  while(offset<bytes.length){
   let end=Math.min(offset+65536,bytes.length);while(end<bytes.length&&(bytes[end]!&0xc0)===0x80)end--;
   const part=r.plan.parts[index];if(!partsExact(part,'byteOffset,contentHash,partIndex,utf8Bytes')||part.partIndex!==index+1||part.byteOffset!==offset||part.utf8Bytes!==end-offset||part.contentHash!==await hashed(bytes.slice(offset,end)))return partsInvalid();offset=end;index++;
  }
  if(index!==r.plan.parts.length||await hashed(new TextEncoder().encode(canonical(r.plan)))!==r.partsRef.contentHash)return partsInvalid();check();return r as InstructionPartsResult;
 }catch(e){check();throw e;}
}
