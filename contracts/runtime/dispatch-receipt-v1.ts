import {canonicalJson} from '../canonical.ts';
import {recordV1,hashV1,isoV1,cloneV1} from './validation-v1.ts';
import type {DispatchEnvelopeV1} from './dispatch-envelope-v1.ts';
export interface ReceiptKeyV1{projectId:string;executionId:string;executionGeneration:number;commandId:string}
export interface DispatchReceiptV1{schemaVersion:1;key:ReceiptKeyV1;envelopeHash:string;state:'RECORDED'|'DELIVERY_REQUESTED'|'DELIVERY_CONFIRMED'|'UNKNOWN'|'REJECTED';reasonCode:'UNVERIFIED_INBOX_ONLY'|'ADAPTER_REPORT_UNVERIFIED'|'CONTEXT_MISMATCH'|'ENVELOPE_EXPIRED'|'RECORD_CONFLICT'|'RECORD_UNREADABLE'|'STORAGE_UNAVAILABLE'|'INBOX_BUSY'|'LIMIT_REACHED';duplicate:boolean;recordedAt:string;executionAuthorized:false;dispatchPerformed:false}
export const receiptKeyV1=(e:DispatchEnvelopeV1):ReceiptKeyV1=>({projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration,commandId:e.commandId});
/** 수신/전달의 구조화 주장이다. DELIVERY_*도 실제 전달 관측이나 실행 권한으로 승격하지 않는다. */
export function readDispatchReceiptV1(value:unknown,e:DispatchEnvelopeV1):DispatchReceiptV1{
 if(!recordV1(value,['schemaVersion','key','envelopeHash','state','reasonCode','duplicate','recordedAt','executionAuthorized','dispatchPerformed'])||value.schemaVersion!==1||canonicalJson(value.key)!==canonicalJson(receiptKeyV1(e))||!hashV1(value.envelopeHash)||value.envelopeHash!==e.envelopeHash||!['RECORDED','DELIVERY_REQUESTED','DELIVERY_CONFIRMED','UNKNOWN','REJECTED'].includes(value.state)||!['UNVERIFIED_INBOX_ONLY','ADAPTER_REPORT_UNVERIFIED','CONTEXT_MISMATCH','ENVELOPE_EXPIRED','RECORD_CONFLICT','RECORD_UNREADABLE','STORAGE_UNAVAILABLE','INBOX_BUSY','LIMIT_REACHED'].includes(value.reasonCode)||typeof value.duplicate!=='boolean'||!isoV1(value.recordedAt)||value.executionAuthorized!==false||value.dispatchPerformed!==false)throw Error('RECEIPT_INVALID');
 if(value.state==='RECORDED'&&value.reasonCode!=='UNVERIFIED_INBOX_ONLY'||value.state.startsWith('DELIVERY_')&&value.reasonCode!=='ADAPTER_REPORT_UNVERIFIED')throw Error('RECEIPT_INVALID');return cloneV1(value) as DispatchReceiptV1;
}
