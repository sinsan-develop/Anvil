import type {ControlAcceptCommand} from '../../../../server/modules/control-handoff/control-grant.ts';
import type {ProtectedHandoffSummary} from '../../../../server/modules/control-handoff/control-handoff-protected-summary.ts';
import {ApiError} from '../../api/errors.ts';
import {basis,iso,same,uuid,type ControlCommand,type ControlSession,type ControlStateResult} from './api.ts';
import type {ControlRequestCommand} from '../../../../server/modules/control-handoff/control-request-store.ts';
export type ControlPending={bindingId:string;status:'READY'|'SENDING'|'UNKNOWN'|'CONFIRMED'}&({command:ControlCommand;kind?:'PROTECTED_PREPARE'}|{command:ControlAcceptCommand;kind:'ACCEPT';summary:ProtectedHandoffSummary});
export interface ControlBuffer {bindingId:string;ownerUserId:string;ownerClientId:string;projectId:string;reason:string;expiresAt:string;pending:ControlPending|null}
export function emptyControlBuffer(session:ControlSession,projectId:string):ControlBuffer{return{bindingId:crypto.randomUUID(),ownerUserId:session.user.id,ownerClientId:session.clientId,projectId,reason:'',expiresAt:'',pending:null};}
export function mergeControlBuffer(current:ControlBuffer|null,expected:string|null,next:ControlBuffer):ControlBuffer|null{
 if((current?.bindingId??null)!==expected||current&&(current.projectId!==next.projectId||current.ownerUserId!==next.ownerUserId||current.ownerClientId!==next.ownerClientId))return current;
 return next;
}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;}
export function freezeControlCommand(buffer:ControlBuffer,command:ControlCommand):ControlBuffer{
 if(buffer.pending&&buffer.pending.status!=='CONFIRMED'||buffer.projectId!==command.projectId||buffer.ownerClientId!==command.clientId)throw new ApiError('REQUEST_FAILED');
 const copy:ControlCommand=JSON.parse(JSON.stringify(command));return{...buffer,bindingId:crypto.randomUUID(),pending:{bindingId:crypto.randomUUID(),command:freeze(copy),status:'READY'}};
}
/** 수락은 고정 보호요약과 원 명령을 함께 App 소유 메모리에 선보존한다. 조회가 권한을 발급하지 않는다. */
export function freezeControlAcceptance(buffer:ControlBuffer,command:ControlAcceptCommand,summary:ProtectedHandoffSummary):ControlBuffer{
 const s=summary.snapshot;
 if(buffer.pending&&buffer.pending.status!=='CONFIRMED'||buffer.projectId!==command.projectId||buffer.ownerClientId!==command.clientId||s.projectId!==command.projectId||s.transferState!=='READY'||Date.parse(s.validUntil)<=Date.now()||s.targetActorRef.userId!==buffer.ownerUserId||s.targetClientRef.clientId!==buffer.ownerClientId||!same(s.requestRef,command.payload.requestRef)||command.payload.summaryVersion!==summary.ref.version||!command.payload.reason.trim()||command.payload.reason.length>20000||!uuid(command.commandId))throw new ApiError('REQUEST_FAILED');
 return{...buffer,bindingId:crypto.randomUUID(),pending:{bindingId:crypto.randomUUID(),kind:'ACCEPT',command:freeze(JSON.parse(JSON.stringify(command))),summary:freeze(JSON.parse(JSON.stringify(summary))),status:'READY'}};
}
export function selfRequestCommand(session:ControlSession,projectId:string,state:ControlStateResult,reason:string,expiresAt:string,commandId=crypto.randomUUID()):ControlRequestCommand{
 const b=state.control.basis;
 if(state.projectId!==projectId||state.actorId!==session.user.id||state.clientId!==session.clientId||state.control.state!=='OTHER_CLIENT'||!basis(b)||b.actorId===session.user.id&&b.clientId===session.clientId||!iso(state.observedAt)||!iso(expiresAt)||Date.parse(expiresAt)<=Date.parse(state.observedAt)||Date.parse(expiresAt)-Date.parse(state.observedAt)>30*60000||!reason.trim()||reason.length>20000||!uuid(commandId))throw new ApiError('REQUEST_FAILED');
 return{schemaVersion:1,operation:'requestControl',commandId,projectId,clientId:session.clientId,payload:{targetActorRef:{userId:session.user.id},targetClientRef:{userId:session.user.id,clientId:session.clientId},baseControl:{...b},reason,expiresAt}};
}
export interface ControlTicket {revision:number;sequence:number;session:ControlSession|null;projectId:string;actorId:string|null;clientId:string|null;binding:string|null}
/** Render-time binding plus unmount disposal fences session ABA and delayed JSON/hash results. */
export class ControlScope{
 private session:ControlSession|null=null;private projectId='';private actorId:string|null=null;private clientId:string|null=null;private revision=0;private sequence=0;private alive=true;
 bind(session:ControlSession|null,projectId:string):void{if(this.session!==session||this.projectId!==projectId||this.actorId!==(session?.user.id??null)||this.clientId!==(session?.clientId??null)){this.revision++;this.sequence++;this.session=session;this.projectId=projectId;this.actorId=session?.user.id??null;this.clientId=session?.clientId??null;}this.alive=true;}
 ticket(binding:string|null=null):ControlTicket{return{revision:this.revision,sequence:++this.sequence,session:this.session,projectId:this.projectId,actorId:this.actorId,clientId:this.clientId,binding};}
 current(ticket:ControlTicket,binding:string|null=null):boolean{return this.alive&&ticket.session===this.session&&ticket.revision===this.revision&&ticket.sequence===this.sequence&&ticket.projectId===this.projectId&&ticket.actorId===this.actorId&&ticket.clientId===this.clientId&&ticket.actorId===(this.session?.user.id??null)&&ticket.clientId===(this.session?.clientId??null)&&ticket.binding===binding;}
 dispose():void{this.alive=false;this.revision++;this.sequence++;}
}
export function sameControlBasis(a:unknown,b:unknown):boolean{return same(a,b);}
