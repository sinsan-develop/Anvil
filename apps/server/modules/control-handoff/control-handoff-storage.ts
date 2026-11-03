import {AuthFailure} from '../access/repository.ts';
import {refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {copyControlData,controlHash,freezeControl} from './control-grant.ts';
const fail=():never=>{throw new AuthFailure('CONTROL_STORAGE_INTEGRITY_FAILED',503);};
export const controlStorageTables=['control_handoff_protected_summaries','control_handoffs','control_grant_events','control_handoff_acceptance_commands','control_handoff_acceptance_receipts','control_handoff_acceptance_audits']as const;
export type ControlStorageTable=typeof controlStorageTables[number];
export type ControlStorageRow={table:ControlStorageTable;id:string;projection:unknown};
/** 원값/NULL 정보는 보존하고 mutable 숫자·phase의 계상 폭만 고정한다. 데이터 hash와 별개다. */
export function controlCostBytes(value:unknown):number{
 const v=copyControlData(value),encode=(x:unknown,key=''):unknown=>{
  if(x===null)return['N'];if(typeof x==='boolean')return['B',x?'1':'0'];
  if(typeof x==='number'){if(!Number.isSafeInteger(x)||x<0)return fail();return['I',String(x).padStart(16,'0')];}
  if(typeof x==='string')return ['phase','state'].includes(key)?['S',x.padEnd(64,' ')]:['S',x];
  if(Array.isArray(x))return['A',x.map(y=>encode(y))];
  if(x&&typeof x==='object')return['O',Object.fromEntries(Object.entries(x).map(([k,y])=>[k,encode(y,k)]))];return fail();
 };return Buffer.byteLength(canonicalJson(encode(v)));
}
export function planControlStorage(commandRef:RuntimeRefV1,values:ControlStorageRow[]){
 const rows=copyControlData(values);if(!refV1(commandRef)||rows.length<1||rows.length>10)fail();
 const seen=new Set<string>(),parts=rows.map(r=>{const key=r.table+':'+r.id;if(!controlStorageTables.includes(r.table)||seen.has(key))fail();seen.add(key);return{table:r.table,id:r.id,bytes:controlCostBytes(r.projection),projectionHash:controlHash(r.projection)};});
 const payload={schemaVersion:1,purpose:'CONTROL_STORAGE_PLAN',commandRef:copyControlData(commandRef),rows:parts},metadataBytes=parts.reduce((n,r)=>n+r.bytes,0);
 // reservation의 자체 hash/행 전체를 plan에 넣지 않아 순환을 만들지 않는다. 숫자는 고정폭이다.
 const projection=(total:number)=>({commandRef:payload.commandRef,plan:payload,phase:'RESERVED',metadataBytes,reservedBytes:total,settledBytes:0});
 const reservationBytes=controlCostBytes(projection(0)),reservedBytes=metadataBytes+reservationBytes;
 if(!Number.isSafeInteger(reservedBytes)||reservedBytes>10*1024*1024*1024||controlCostBytes(projection(reservedBytes))!==reservationBytes)fail();
 return freezeControl({...payload,metadataBytes,reservationBytes,reservedBytes,planHash:controlHash(payload)});
}
export type ControlStoragePlan=ReturnType<typeof planControlStorage>;
export function settleControlStorage(plan:ControlStoragePlan,rows:ControlStorageRow[]):number{
 const actual=planControlStorage(plan.commandRef,rows);
 if(actual.planHash!==plan.planHash||actual.reservedBytes!==plan.reservedBytes)fail();return actual.reservedBytes;
}
