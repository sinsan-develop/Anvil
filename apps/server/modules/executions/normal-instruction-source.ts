import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,type ProjectCommand} from '../access/project-command.ts';
import {ProjectConversations,readProtectedInstruction,readRegisteredInstruction} from '../knowledge/conversations.ts';
import {instructionPartsPlan} from './instruction-parts-plan.ts';
import {readCurrent} from './normal-exchange-challenge.ts';
import {requestCredential} from './normal-request-challenge.ts';
import {readNormalInstructionRecord} from './normal-instruction-command.ts';
import type {InstructionGrantRead} from '../context/read-access.ts';
const registered=new WeakMap<object,{db:PoolClient;query:PoolClient['query'];projectId:string;conversationId:string;messageId:string;fingerprint:string}>();
export function registeredInstructionReadMatches(access:unknown,db?:PoolClient,projectId?:string,conversationId?:string,messageId?:string){
 if(!access||typeof access!=='object'||types.isProxy(access))return false;const s=registered.get(access);if(!s)return false;
 try{return s.db===db&&s.query===db?.query&&s.projectId===projectId&&s.conversationId===conversationId&&s.messageId===messageId&&s.fingerprint===canonicalJson(access);}catch{return false;}
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw new AuthFailure('NORMAL_INSTRUCTION_SOURCE_REQUIRED',412);};

/** 원 메시지/append 영수증/정정·격리와 원 artifact를 읽고 계획을 다시 생성한다. 외부 JSON reader를 받지 않는다. */
export class NormalInstructionSource {
 readonly #conversations:ProjectConversations;
 constructor(conversations:ProjectConversations){this.#conversations=conversations;this.#ports();}
 #ports(){if(!this.#conversations||types.isProxy(this.#conversations)||Object.getPrototypeOf(this.#conversations)!==ProjectConversations.prototype||this.#conversations.readInstruction!==readProtectedInstruction||ProjectConversations.prototype.readInstruction!==readProtectedInstruction||this.#conversations.readRegisteredInstruction!==readRegisteredInstruction||ProjectConversations.prototype.readRegisteredInstruction!==readRegisteredInstruction)fail();}
 async read(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand){
  this.#ports();const query=db.query,p=cloneV1(request.payload),pid=request.projectId;if(!refV1(p.instructionRef)||!refV1(p.partsRef))return fail();
  await projectMember(db,actor,pid);
  const rows=(await db.query('SELECT conversation_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2 AND content_hash=$3 LIMIT 2',[pid,p.instructionRef.id,p.instructionRef.contentHash])).rows;
  if(rows.length!==1)throw new AuthFailure('NOT_FOUND',404);
  const original=await readProtectedInstruction.call(this.#conversations,db,actor,pid,rows[0].conversation_id,p.instructionRef.id);this.#ports();if(db.query!==query)return fail();
  const {partsRef,plan}=instructionPartsPlan(original.message.bodyRef,Buffer.from(original.body,'utf8'));
  if(!same(original.instructionRef,p.instructionRef)||!same(partsRef,p.partsRef))throw new AuthFailure('NORMAL_INSTRUCTION_SOURCE_CHANGED',409);
  const sourceRef=cloneV1(original.instructionRef),bodyRef={id:plan.bodyRef.artifactId,version:1,contentHash:plan.bodyRef.contentHash};
  return {sourceRef,bodyRef,partsRef,originRef:cloneV1(sourceRef),contentHash:plan.bodyRef.contentHash,sourceBytes:plan.bodyRef.bytes,mediaType:plan.bodyRef.mediaType,parts:plan.parts};
 }
 /** 같은 보호 거래에서 credential/current/원 SEND를 먼저 재검산한 뒤만 잠깐 표식을 만든다. */
 async readRegistered(db:PoolClient,tokenDigest:string,connector:string,execution:string,proof:any,commandId:string,manifestRef:unknown){
  this.#ports();const query=db.query,cred=await requestCredential(db,tokenDigest,connector,execution,proof),current=await readCurrent(db,cred.project,connector,execution,proof),b=current.binding;
  if(cred.expiresAt<=current.now.getTime())return fail();
  const rows=(await db.query('SELECT * FROM anvil.normal_instruction_record($1,$2,$3,$4)',[cred.project,execution,b.executionGeneration,commandId])).rows;
  if(rows.length!==1||rows[0].valid!==true)return fail();const r=rows[0],record=readNormalInstructionRecord({ref:r.result_ref?.data?.ref,snapshot:r.snapshot_json},{projectId:cred.project,executionId:execution,executionGeneration:b.executionGeneration}),binding=record.snapshot.currentBinding;
  if(!same(binding.grantRef,proof.grantRef)||!same(binding.materialManifestRef,manifestRef)||binding.fact.executionCredentialReservation.generation!==b.credentialGeneration||Date.parse(record.snapshot.expiresAt)<=current.now.getTime())return fail();
  const instructionRef=binding.instructionRef,partsRef=binding.partsRef,found=(await db.query('SELECT conversation_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2 AND content_hash=$3 LIMIT 2',[cred.project,instructionRef.id,instructionRef.contentHash])).rows;
  if(found.length!==1)return fail();const conversationId=found[0].conversation_id,messageId=instructionRef.id;
  const tx=(await db.query('SELECT txid_current()::text AS transaction_id')).rows[0]?.transaction_id;if(typeof tx!=='string'||!/^\d+$/.test(tx)||tx==='0'||db.query!==query)return fail();
  const access=Object.freeze(cloneV1({kind:'INSTRUCTION_GRANT',projectId:cred.project,conversationId,messageId,transactionId:tx,credentialRef:cred.ref,grantRef:proof.grantRef,commandRef:record.ref,authorizationReceiptRef:record.snapshot.envelope.context.authorizationReceiptRef,manifestRef,instructionRef,partsRef,bodyRef:r.original?.bodyRef}));
  registered.set(access,{db,query,projectId:cred.project,conversationId,messageId,fingerprint:canonicalJson(access)});
  try{
   const original=await readRegisteredInstruction.call(this.#conversations,db,access as unknown as InstructionGrantRead,cred.project,conversationId,messageId);this.#ports();
   const planned=instructionPartsPlan(original.message.bodyRef,Buffer.from(original.body,'utf8'));
   if(!same(original.instructionRef,instructionRef)||!same(planned.partsRef,partsRef)||!same({id:planned.plan.bodyRef.artifactId,version:1,contentHash:planned.plan.bodyRef.contentHash},r.original?.bodyRef))return fail();
   const last=await readCurrent(db,cred.project,connector,execution,proof),lastCred=await requestCredential(db,tokenDigest,connector,execution,proof),end=(await db.query('SELECT txid_current()::text AS transaction_id')).rows[0]?.transaction_id;
   if(end!==tx||db.query!==query||!same(last.binding,b)||!same(lastCred,cred)||last.now<current.now||last.now.getTime()>=Math.min(cred.expiresAt,Date.parse(record.snapshot.expiresAt)))return fail();
   return original.body;
  }finally{registered.delete(access);}
 }

}
export const readRegisteredInstructionBody=NormalInstructionSource.prototype.readRegistered;
