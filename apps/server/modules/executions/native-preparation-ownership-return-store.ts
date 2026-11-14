import type {PoolClient} from 'pg';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {nativeHash,nativeSame,readNativeConsumeReceipt} from '../../../../contracts/runtime/native-preparation-authority-v1.ts';
import {readNativeReturnAuthority,readNativeOwnershipRequest,readNativeOwnershipResult} from '../../../../contracts/runtime/native-preparation-ownership-return-v1.ts';
import {planNativeOwnershipRequest,planNativeOwnershipAcceptance,readNativeOwnershipBasis,type NativeOwnershipBasis,type NativeOwnershipRequestPlan} from './native-preparation-ownership-return.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';
import {AuthFailure} from '../access/repository.ts';

function fail(code='NATIVE_CONTEXT_CHANGED',status=412):never{throw new AuthFailure(code,status);}
type Fresh={authority:ReturnType<typeof readNativeReturnAuthority>;receipt:ReturnType<typeof readNativeConsumeReceipt>;basis:NativeOwnershipBasis;nowMs:number;expiresAt:string;spki:string};
function observation<T>(signal:AbortSignal,invoke:()=>Promise<T>):Promise<T>{
 if(signal.aborted)return Promise.reject(new AuthFailure('NATIVE_OUTCOME_UNKNOWN',503));
 return new Promise((resolve,reject)=>{
  let done=false;const finish=(error:unknown,value?:T)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);error?reject(error):resolve(value!);};
  const abort=()=>finish(new AuthFailure('NATIVE_OUTCOME_UNKNOWN',503));signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  try{Promise.resolve(invoke()).then(v=>finish(null,v),e=>finish(e));}catch(e){finish(e);}
 });
}
/** 원 authority/consume만 제공한다. 후보 PID/본문은 공급자에 전달하지 않는다. 실제 공급자는 기본 미등록. */
export interface NativeOwnershipBasisSource{current(input:{authority:unknown;consumeReceipt:unknown;consumeRecordRef:RuntimeRefV1;checkedAt:string;signal:AbortSignal}):Promise<unknown>}
export interface NativeOwnershipTransaction{
 db:Pick<PoolClient,'query'>;authority:unknown;consumeReceipt:unknown;consumeRecordRef:RuntimeRefV1;
 current():Promise<{checkedAt:string;expiresAt:string;publicKeySpki:string}>;check():void;signal:AbortSignal;
}
/** 이미 인증된 원 preparation 거래에만 stage한다. 외부 DB client/commit 권한을 공급자에게 전달하지 않는다. */
export class NativeOwnershipReturnStore{
 #source:NativeOwnershipBasisSource|null;#current:NativeOwnershipBasisSource['current']|null;
 #allocate:(count:number)=>string[];#nonce:()=>string;
 constructor(source:NativeOwnershipBasisSource|null,allocate:(count:number)=>string[],nonce:()=>string){
  const d=source&&!types.isProxy(source)?Object.getOwnPropertyDescriptor(source,'current'):null;
  if(source&&(!d||!('value'in d)||typeof d.value!=='function'))fail('NATIVE_SOURCE_UNAVAILABLE',503);
  this.#source=source;this.#current=d?.value??null;this.#allocate=allocate;this.#nonce=nonce;
 }
 #connected(c:NativeOwnershipTransaction){c.check();if(c.signal.aborted||!this.#source||!this.#current||Object.getOwnPropertyDescriptor(this.#source,'current')?.value!==this.#current)fail('NATIVE_SOURCE_UNAVAILABLE',503);}
 async #query(c:NativeOwnershipTransaction,sql:string,args:unknown[]=[]){this.#connected(c);const r=await c.db.query(sql,args);this.#connected(c);return r;}
 async #fresh(c:NativeOwnershipTransaction){
  this.#connected(c);const current=await c.current();this.#connected(c);
  const a=readNativeReturnAuthority(c.authority),receipt=readNativeConsumeReceipt(c.consumeReceipt);
  if(!recordV1(current,['checkedAt','expiresAt','publicKeySpki'])||!isoV1(current.checkedAt)||!isoV1(current.expiresAt)||Date.parse(current.expiresAt)<=Date.parse(current.checkedAt)||publicKeyFingerprint(current.publicKeySpki)!==a.scope.hostPublicKeyFingerprint)fail();
  // 상위 host transaction budget이 공급자 무응답/늦은 결과를 봉인한다. 여기서는 raw DB를 노출하지 않는다.
  const b=await observation(c.signal,()=>this.#current!.call(this.#source,{authority:cloneV1(a),consumeReceipt:cloneV1(receipt),consumeRecordRef:cloneV1(c.consumeRecordRef),checkedAt:current.checkedAt,signal:c.signal}));this.#connected(c);
  const after=await c.current();this.#connected(c);
  if(!isoV1(after.checkedAt)||!isoV1(after.expiresAt)||after.publicKeySpki!==current.publicKeySpki||Date.parse(after.checkedAt)<Date.parse(current.checkedAt)||Date.parse(after.expiresAt)<=Date.parse(after.checkedAt))fail();
  return {authority:a,receipt,basis:readNativeOwnershipBasis(b,a,receipt,Date.parse(after.checkedAt)),nowMs:Date.parse(after.checkedAt),expiresAt:new Date(Math.min(Date.parse(current.expiresAt),Date.parse(after.expiresAt))).toISOString(),spki:after.publicKeySpki};
 }
 #plan(c:NativeOwnershipTransaction,f:Fresh,input:unknown,allocated:readonly string[],nonce:string){return planNativeOwnershipRequest({authority:f.authority,consumeReceipt:f.receipt,consumeRecordRef:c.consumeRecordRef,input,basis:f.basis,nowMs:f.nowMs,expiresAt:f.expiresAt,ids:allocated,nonce});}
 async #prior(c:NativeOwnershipTransaction,planInput:unknown){
  const a=readNativeReturnAuthority(c.authority),rows=(await this.#query(c,'SELECT * FROM anvil.native_preparation_ownership_bindings WHERE project_id=$1 AND authority_id=$2',[a.scope.projectId,a.authorityId])).rows;
  if(rows.length>1)fail();if(!rows.length)return null;
  const row=rows[0],stored=row.plan_json as NativeOwnershipRequestPlan;
  if(!stored||!nativeSame(stored.authority,a)||!nativeSame(stored.consumeReceipt,c.consumeReceipt)||!nativeSame(stored.consumeRecordRef,c.consumeRecordRef)||!nativeSame(stored.input,planInput))fail('NATIVE_REQUEST_CONFLICT',409);
  const rebuilt=planNativeOwnershipRequest({authority:a,consumeReceipt:c.consumeReceipt,consumeRecordRef:c.consumeRecordRef,input:stored.input,basis:stored.basis,nowMs:Date.parse(stored.requestEvent.snapshot.at),expiresAt:stored.requestEvent.snapshot.expiresAt,nonce:stored.response.request.nonce,ids:[stored.binding.ref.id,stored.response.candidateAnchor.ref.id,stored.requestEvent.ref.id]});
  if(!nativeSame(rebuilt,stored)||row.id!==stored.binding.ref.id||row.content_hash!==stored.binding.ref.contentHash||!nativeSame(row.snapshot_json,stored.binding.snapshot))fail();
  return rebuilt;
 }
 #sameBasis(original:NativeOwnershipRequestPlan,current:Fresh){
  const {checkedAt:_a,expiresAt:_b,...old}=original.basis,{checkedAt:_c,expiresAt:_d,...fresh}=current.basis;
  if(!nativeSame(old,fresh))fail();
 }
 async #sequence(c:NativeOwnershipTransaction,pid:string){const v=Number((await this.#query(c,'SELECT COALESCE(MAX(project_sequence),0) AS value FROM anvil.execution_ownership_events WHERE project_id=$1',[pid])).rows[0]?.value);if(!Number.isSafeInteger(v)||v<0||!Number.isSafeInteger(v+3))fail();return v;}
 async #insertEvent(c:NativeOwnershipTransaction,p:NativeOwnershipRequestPlan,e:NativeOwnershipRequestPlan['requestEvent'],sequence:number,candidate:unknown|null){
  const s=e.snapshot,r=await this.#query(c,'INSERT INTO anvil.execution_ownership_events(project_id,execution_id,execution_generation,event_id,sequence,project_sequence,content_hash,snapshot_json,candidate_anchor_json,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)',[s.scope.projectId,s.scope.executionId,s.scope.executionGeneration,e.ref.id,s.sequence,sequence,e.ref.contentHash,canonicalJson(s),candidate===null?null:canonicalJson(candidate),s.kind==='OBSERVATION_ACCEPTED'?p.requestEvent.ref.id:null]);if(r.rowCount!==1)fail();
 }
 async request(c:NativeOwnershipTransaction,value:unknown){
  const input=readNativeOwnershipRequest(value),f=await this.#fresh(c),prior=await this.#prior(c,input);
  // 검산용 재계산은 저장된 원 nonce/ID를 사용한다. 신규 request 발급이나 TTL 갱신이 아니다.
  if(prior){
   this.#sameBasis(prior,f);
   return {payload:prior.response,expiresAt:f.expiresAt};
  }
  const p=this.#plan(c,f,input,this.#allocate(3),this.#nonce()),scope=p.binding.snapshot.scope,args=[scope.projectId,scope.executionId,scope.executionGeneration];
  if((await this.#query(c,'SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',args)).rows.length||(await this.#query(c,'SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1',args)).rows.length)fail('NATIVE_REQUEST_CONFLICT',409);
  const sequence=await this.#sequence(c,scope.projectId);
  const inserted=await this.#query(c,'INSERT INTO anvil.native_preparation_ownership_bindings(project_id,execution_id,execution_generation,id,authority_id,consume_receipt_id,request_id,content_hash,snapshot_json,plan_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)',[...args,p.binding.ref.id,p.authority.authorityId,p.input.consumeReceiptRef.id,p.input.requestId,p.binding.ref.contentHash,canonicalJson(p.binding.snapshot),canonicalJson(p)]);if(inserted.rowCount!==1)fail();
  await this.#insertEvent(c,p,p.requestEvent,sequence+1,p.response.candidateAnchor);
  const last=await this.#fresh(c);this.#sameBasis(p,last);
  if(last.nowMs>=Date.parse(p.response.request.expiresAt)||Math.min(Date.parse(last.expiresAt),Date.parse(last.basis.expiresAt))<Date.parse(p.response.request.expiresAt))fail('NATIVE_SOURCE_EXPIRED');
  return {payload:p.response,expiresAt:p.response.request.expiresAt};
 }
 async accept(c:NativeOwnershipTransaction,value:unknown){
  const input=readNativeOwnershipResult(value),f=await this.#fresh(c),a=f.authority;
  const rows=(await this.#query(c,'SELECT * FROM anvil.native_preparation_ownership_bindings WHERE project_id=$1 AND authority_id=$2',[a.scope.projectId,a.authorityId])).rows;if(rows.length!==1)fail();
  const p=await this.#prior(c,rows[0].plan_json?.input);if(!p||!nativeSame(input.bindingRef,p.binding.ref))fail('NATIVE_REQUEST_CONFLICT',409);
  this.#sameBasis(p,f);
  const existing=(await this.#query(c,'SELECT * FROM anvil.native_preparation_ownership_results WHERE project_id=$1 AND binding_id=$2',[a.scope.projectId,p.binding.ref.id])).rows;
  if(existing.length){
   if(existing.length!==1)fail();const r=existing[0],s=r.snapshot_json;
   if(r.packet_hash!==nativeHash(input))fail('NATIVE_REQUEST_CONFLICT',409);
   if(!recordV1(s,['schemaVersion','purpose','bindingRef','packetHash','observationRef','headRef','acceptedAt','executionAuthorized','dispatchPerformed'])||s.schemaVersion!==1||s.purpose!=='NATIVE_PREPARATION_OWNERSHIP_RECEIPT'||!nativeSame(s.bindingRef,p.binding.ref)||s.packetHash!==r.packet_hash||!refV1(s.observationRef)||!refV1(s.headRef)||!isoV1(s.acceptedAt)||s.executionAuthorized!==false||s.dispatchPerformed!==false||nativeHash(s)!==r.content_hash)fail();
   return {payload:{receiptRef:{id:r.id,version:1,contentHash:r.content_hash},observationRef:s.observationRef,headRef:s.headRef,acceptedAt:s.acceptedAt,executionAuthorized:false as const,dispatchPerformed:false as const},expiresAt:f.expiresAt};
  }
  const args=[a.scope.projectId,a.scope.executionId,a.scope.executionGeneration];
  if((await this.#query(c,'SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',args)).rows.length)fail('NATIVE_REQUEST_CONFLICT',409);
  const tail=(await this.#query(c,'SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1',args)).rows;
  if(tail.length!==1||tail[0].content_hash!==p.requestEvent.ref.contentHash||tail[0].event_id!==p.requestEvent.ref.id||!nativeSame(tail[0].snapshot_json,p.requestEvent.snapshot))fail();
  const accepted=planNativeOwnershipAcceptance({request:p,input,spki:f.spki,nowMs:f.nowMs,ids:this.#allocate(5)});let sequence=await this.#sequence(c,a.scope.projectId);
  const insert=async(sql:string,values:unknown[])=>{if((await this.#query(c,sql,values)).rowCount!==1)fail();};
  await insert('INSERT INTO anvil.execution_ownership_observations(project_id,execution_id,execution_generation,observation_id,request_id,content_hash,snapshot_json,accepted_event_ref,nonce_digest) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)',[...args,accepted.observation.ref.id,p.requestEvent.ref.id,accepted.observation.ref.contentHash,canonicalJson(accepted.observation.snapshot),canonicalJson(accepted.events[0]!.ref),contentHash(Buffer.from(p.response.request.nonce,'base64url'))]);
  for(const e of accepted.events)await this.#insertEvent(c,p,e,++sequence,null);
  await insert('INSERT INTO anvil.execution_ownership_anchors(project_id,execution_id,execution_generation,anchor_id,content_hash,snapshot_json,preparation_event_ref,adoption_event_ref,native_return_binding_ref) VALUES($1,$2,$3,$4,$5,$6::jsonb,NULL,$7::jsonb,$8::jsonb)',[...args,p.response.candidateAnchor.ref.id,p.response.candidateAnchor.ref.contentHash,canonicalJson(p.response.candidateAnchor.snapshot),canonicalJson(accepted.events[1]!.ref),canonicalJson(p.binding.ref)]);
  await insert('INSERT INTO anvil.execution_ownership_heads(project_id,execution_id,execution_generation,id,head_generation,content_hash,snapshot_json) VALUES($1,$2,$3,$4,1,$5,$6::jsonb)',[...args,accepted.head.ref.id,accepted.head.ref.contentHash,canonicalJson(accepted.head.snapshot)]);
  await insert('INSERT INTO anvil.native_preparation_ownership_results(project_id,binding_id,id,packet_hash,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[a.scope.projectId,p.binding.ref.id,accepted.receipt.ref.id,nativeHash(input),accepted.receipt.ref.contentHash,canonicalJson(accepted.receipt.snapshot)]);
  const last=await this.#fresh(c);this.#sameBasis(p,last);
  if(last.nowMs>=Date.parse(p.response.request.expiresAt)||Math.min(Date.parse(last.expiresAt),Date.parse(last.basis.expiresAt))<Date.parse(p.response.request.expiresAt))fail('NATIVE_SOURCE_EXPIRED');
  return {payload:accepted.response,expiresAt:p.response.request.expiresAt};
 }
}
