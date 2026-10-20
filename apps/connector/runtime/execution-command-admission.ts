import {canonicalJson} from '../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import {SyntheticExecutionClient} from './execution-client.ts';
import {readClientOperation,readClientScope} from './execution-ledger.ts';
import {SyntheticStartReceiver} from './execution-start-receiver.ts';
import {SyntheticPrimaryInstructionTransport} from '../adapters/primary/instruction-transport.ts';
import {SyntheticPrimaryStopTransport} from '../adapters/primary/session-transport.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
class CommandAdmissionFailure extends Error{}
const fail=(code:string):never=>{throw new CommandAdmissionFailure(code);};

/** P1의 명시 선택→시작 명령 내구 수신만 연결한다. polling loop/다음page/permit/start/wire를 호출하지 않는다.
 * caller 봉투를 받지 않고 기존 client의 검증·내구 기록을 다시 소비한다. 실제 HTTP/Agent 권위가 아니다. */
export class SyntheticExecutionCommandAdmission {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly client:SyntheticExecutionClient;readonly receiver:SyntheticStartReceiver;#clock:()=>number;
 constructor(client:SyntheticExecutionClient,receiver:SyntheticStartReceiver,options:{clock:()=>number}){
  this.client=client;this.receiver=receiver;this.#ports();if(typeof options?.clock!=='function')fail('COMMAND_ADMISSION_CONFIG_INVALID');this.#clock=options.clock;
 }
 #ports(){if(!(this.client instanceof SyntheticExecutionClient)||!(this.receiver instanceof SyntheticStartReceiver))fail('COMMAND_ADMISSION_PORTS_REQUIRED');}
 #now(){const at=this.#clock();if(!Number.isSafeInteger(at)||!Number.isFinite(new Date(at).getTime()))return fail('COMMAND_ADMISSION_CLOCK_INVALID');return at;}
 /** 명시 호출 하나만 전송기로 연결한다. 선택은 허가가 아니며 sender의 현재자료/세션/이해/permit 검사는 유지한다. */
 async sendInstruction(rawScope:unknown,rawOperation:unknown,rawCommandRef:unknown,sender:SyntheticPrimaryInstructionTransport){
  try{
   if(!(sender instanceof SyntheticPrimaryInstructionTransport))return fail('COMMAND_ADMISSION_SENDER_REQUIRED');
   const selected=await this.readInstruction(rawScope,rawOperation,rawCommandRef);
   const sent=await sender.send(selected.envelope,{grantRef:selected.grantRef,expiresAt:selected.expiresAt});
   return{transport:'SYNTHETIC_ONLY' as const,commandRef:cloneV1(selected.commandRef),pageResultRef:cloneV1(selected.pageResultRef),envelopeHash:selected.envelope.envelopeHash,sent,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof CommandAdmissionFailure)throw error;return fail('COMMAND_ADMISSION_SEND_UNAVAILABLE');}
 }
 /** 후속 지시 원봉투의 명시 선택 읽기만 한다. START 수신·지시전송/permit·자동 다음 page를 수행하지 않는다.
  * 반환값은 저장된 합성 page의 선택 사실이며 실제 서버/Agent 현재권한이나 전송 허가가 아니다. */
 async readInstruction(rawScope:unknown,rawOperation:unknown,rawCommandRef:unknown){
  try{
   this.#ports();const scope=readClientScope(rawScope),operation=readClientOperation(scope,cloneV1(rawOperation),this.#now()).operation;
   if(scope.mode!=='EXECUTION'||operation.kind!=='COMMANDS'||!refV1(rawCommandRef))return fail('COMMAND_ADMISSION_SELECTION_INVALID');
   const commandRef=cloneV1(rawCommandRef),result=await this.client.execute(scope,operation);this.#ports();
   if(result.transport!=='SYNTHETIC_ONLY'||result.state!=='RESPONSE_RECORDED'||!refV1(result.resultRef)||result.executionAuthorized!==false||result.dispatchPerformed!==false||result.writerReleaseVerified!==false||result.ackAudited!==false)return fail('COMMAND_ADMISSION_PAGE_UNCERTAIN');
   const page=result.response,now=this.#now();
   if(!recordV1(page,['transport','proofResultRef','items','nextCursor','hasMore','observedAt','expiresAt','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||page.transport!=='SYNTHETIC_ONLY'||!refV1(page.proofResultRef)||!arrayV1(page.items,50)||!isoV1(page.observedAt)||!isoV1(page.expiresAt)||Date.parse(page.observedAt)>now||Date.parse(page.expiresAt)<=now||page.nonceConsumed!==true||page.executionAuthorized!==false||page.dispatchPerformed!==false||page.cacheControl!=='no-store')return fail('COMMAND_ADMISSION_PAGE_INVALID');
   const selected=page.items.filter((i:any)=>same(i?.commandRef,commandRef));if(selected.length!==1)return fail('COMMAND_ADMISSION_NOT_SELECTED');const item=selected[0];
   if(!recordV1(item,['sequence','commandRef','envelope'])||!Number.isSafeInteger(item.sequence)||item.sequence<1)return fail('COMMAND_ADMISSION_ITEM_INVALID');
   const envelope=readDispatchEnvelopeV1(item.envelope,now);if(envelope.operation!=='SEND_INSTRUCTION'||envelope.context.projectId!==scope.projectId||envelope.context.executionId!==scope.executionId||envelope.context.executionGeneration!==scope.executionGeneration)return fail('COMMAND_ADMISSION_OPERATION_UNSUPPORTED');
   const end=Math.min(Date.parse(page.expiresAt),Date.parse(envelope.expiresAt));this.#ports();if(this.#now()>=end)return fail('COMMAND_ADMISSION_EXPIRED');
   return{transport:'SYNTHETIC_ONLY' as const,state:'SELECTED_NOT_DISPATCHED' as const,commandRef,pageResultRef:cloneV1(result.resultRef),grantRef:cloneV1(scope.grantRef),envelope:cloneV1(envelope),expiresAt:new Date(end).toISOString(),executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof CommandAdmissionFailure)throw error;return fail('COMMAND_ADMISSION_UNAVAILABLE');}
 }
 /** 정확 page의 중지 요청을 명시 전달한다. 선택은 권한이 아니며 실제 target/소유 검사는 stop이 수행한다. */
 async requestStop(rawScope:unknown,rawOperation:unknown,rawCommandRef:unknown,stopper:SyntheticPrimaryStopTransport){
  try{
   this.#ports();if(!(stopper instanceof SyntheticPrimaryStopTransport))return fail('COMMAND_ADMISSION_STOPPER_REQUIRED');
   const selected=await this.readStop(rawScope,rawOperation,rawCommandRef);
   const stopped=await stopper.stop(selected.envelope,{expiresAt:selected.expiresAt});this.#ports();
   return{transport:'SYNTHETIC_ONLY' as const,commandRef:cloneV1(selected.commandRef),pageResultRef:cloneV1(selected.pageResultRef),envelopeHash:selected.envelope.envelopeHash,stopped,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof CommandAdmissionFailure)throw error;return fail('COMMAND_ADMISSION_STOP_UNAVAILABLE');}
 }
 /** 중지 원봉투의 명시 선택 읽기만 한다. START 수신·중지/permit·자동 다음 page를 수행하지 않는다.
  * 반환값은 저장된 합성 page의 선택 사실이며 실제 서버/Agent 현재권한이나 전송 허가가 아니다. */
 async readStop(rawScope:unknown,rawOperation:unknown,rawCommandRef:unknown){
  try{
   this.#ports();const scope=readClientScope(rawScope),operation=readClientOperation(scope,cloneV1(rawOperation),this.#now()).operation;
   if(scope.mode!=='EXECUTION'||operation.kind!=='COMMANDS'||!refV1(rawCommandRef))return fail('COMMAND_ADMISSION_SELECTION_INVALID');
   const commandRef=cloneV1(rawCommandRef),result=await this.client.execute(scope,operation);this.#ports();
   if(result.transport!=='SYNTHETIC_ONLY'||result.state!=='RESPONSE_RECORDED'||!refV1(result.resultRef)||result.executionAuthorized!==false||result.dispatchPerformed!==false||result.writerReleaseVerified!==false||result.ackAudited!==false)return fail('COMMAND_ADMISSION_PAGE_UNCERTAIN');
   const page=result.response,now=this.#now();
   if(!recordV1(page,['transport','proofResultRef','items','nextCursor','hasMore','observedAt','expiresAt','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||page.transport!=='SYNTHETIC_ONLY'||!refV1(page.proofResultRef)||!arrayV1(page.items,50)||!isoV1(page.observedAt)||!isoV1(page.expiresAt)||Date.parse(page.observedAt)>now||Date.parse(page.expiresAt)<=now||page.nonceConsumed!==true||page.executionAuthorized!==false||page.dispatchPerformed!==false||page.cacheControl!=='no-store')return fail('COMMAND_ADMISSION_PAGE_INVALID');
   const selected=page.items.filter((i:any)=>same(i?.commandRef,commandRef));if(selected.length!==1)return fail('COMMAND_ADMISSION_NOT_SELECTED');const item=selected[0];
   if(!recordV1(item,['sequence','commandRef','envelope'])||!Number.isSafeInteger(item.sequence)||item.sequence<1)return fail('COMMAND_ADMISSION_ITEM_INVALID');
   const envelope=readDispatchEnvelopeV1(item.envelope,now);if(envelope.operation!=='REQUEST_STOP'||envelope.context.projectId!==scope.projectId||envelope.context.executionId!==scope.executionId||envelope.context.executionGeneration!==scope.executionGeneration)return fail('COMMAND_ADMISSION_OPERATION_UNSUPPORTED');
   const end=Math.min(Date.parse(page.expiresAt),Date.parse(envelope.expiresAt));this.#ports();if(this.#now()>=end)return fail('COMMAND_ADMISSION_EXPIRED');
   return{transport:'SYNTHETIC_ONLY' as const,state:'SELECTED_NOT_DISPATCHED' as const,commandRef,pageResultRef:cloneV1(result.resultRef),grantRef:cloneV1(scope.grantRef),envelope:cloneV1(envelope),expiresAt:new Date(end).toISOString(),executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof CommandAdmissionFailure)throw error;return fail('COMMAND_ADMISSION_UNAVAILABLE');}
 }
 async receive(rawScope:unknown,rawOperation:unknown,rawCommandRef:unknown){
  try{
   this.#ports();const scope=readClientScope(rawScope),operation=readClientOperation(scope,cloneV1(rawOperation),this.#now()).operation;
   if(scope.mode!=='EXECUTION'||operation.kind!=='COMMANDS'||!refV1(rawCommandRef))return fail('COMMAND_ADMISSION_SELECTION_INVALID');
   const commandRef=cloneV1(rawCommandRef),result=await this.client.execute(scope,operation);this.#ports();
   if(result.transport!=='SYNTHETIC_ONLY'||result.state!=='RESPONSE_RECORDED'||!refV1(result.resultRef)||result.executionAuthorized!==false||result.dispatchPerformed!==false||result.writerReleaseVerified!==false||result.ackAudited!==false)return fail('COMMAND_ADMISSION_PAGE_UNCERTAIN');
   const page=result.response,now=this.#now();
   if(!recordV1(page,['transport','proofResultRef','items','nextCursor','hasMore','observedAt','expiresAt','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||page.transport!=='SYNTHETIC_ONLY'||!refV1(page.proofResultRef)||!arrayV1(page.items,50)||!isoV1(page.observedAt)||!isoV1(page.expiresAt)||Date.parse(page.observedAt)>now||Date.parse(page.expiresAt)<=now||page.nonceConsumed!==true||page.executionAuthorized!==false||page.dispatchPerformed!==false||page.cacheControl!=='no-store')return fail('COMMAND_ADMISSION_PAGE_INVALID');
   const selected=page.items.filter((i:any)=>same(i?.commandRef,commandRef));if(selected.length!==1)return fail('COMMAND_ADMISSION_NOT_SELECTED');const item=selected[0];
   if(!recordV1(item,['sequence','commandRef','envelope'])||!Number.isSafeInteger(item.sequence)||item.sequence<1)return fail('COMMAND_ADMISSION_ITEM_INVALID');
   const envelope=readDispatchEnvelopeV1(item.envelope,now);if(envelope.operation!=='START_SESSION'||envelope.context.projectId!==scope.projectId||envelope.context.executionId!==scope.executionId||envelope.context.executionGeneration!==scope.executionGeneration)return fail('COMMAND_ADMISSION_OPERATION_UNSUPPORTED');
   const received=await this.receiver.receive(envelope,scope.grantRef),end=Math.min(Date.parse(page.expiresAt),Date.parse(envelope.expiresAt));this.#ports();
   if(this.#now()>=end)return fail('COMMAND_ADMISSION_EXPIRED');
   if(!recordV1(received,['transport','key','envelopeHash','state','reason','responseRef','executionAuthorized','dispatchPerformed'])||received.transport!=='SYNTHETIC_ONLY'||!same(received.key,receiptKeyV1(envelope))||received.envelopeHash!==envelope.envelopeHash||!['RECEIVED','START_ATTEMPTED','PERMIT_RECORDED','RESPONSE_RECORDED','UNKNOWN'].includes(received.state)||received.executionAuthorized!==false||received.dispatchPerformed!==false)return fail('COMMAND_ADMISSION_RECEIVER_INVALID');
   return{transport:'SYNTHETIC_ONLY' as const,state:received.state,commandRef,pageResultRef:cloneV1(result.resultRef),envelopeHash:envelope.envelopeHash,received:cloneV1(received),executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){if(error instanceof CommandAdmissionFailure)throw error;return fail('COMMAND_ADMISSION_UNAVAILABLE');}
 }
}
