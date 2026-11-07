import {AuthFailure} from '../access/repository.ts';
import {refV1,uuidV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {copyControlData,controlHash,freezeControl} from './control-grant.ts';
const fail=():never=>{throw new AuthFailure('CONTROL_STORAGE_INTEGRITY_FAILED',503);};
export const controlStorageTables=['control_handoff_protected_summaries','control_handoffs','control_grant_events','control_handoff_acceptance_commands','control_handoff_acceptance_receipts','control_handoff_acceptance_audits']as const;
export type ControlStorageTable=typeof controlStorageTables[number];
export type ControlStorageRow={table:ControlStorageTable;id:string;projection:unknown};
/** 원값/NULL 정보는 보존하고 mutable 숫자·phase의 계상 폭만 고정한다. 데이터 hash와 별개다. */
export function controlCostBytes(value:unknown):number{
 const v=copyControlData(value),encode=(x:unknown,key=''):unknown=>{
  const numeric=/^(?:.*_bytes|generation|version|.*_generation|.*_version)$/.test(key),timestamp=/(?:At|_at|_until)$/.test(key),state=['phase','state'].includes(key);
  if(numeric&&(x===null||typeof x==='number')){if(x!==null&&(!Number.isSafeInteger(x)||x<0))return fail();return['I',x===null?'N'.padEnd(17,' '):'V'+String(x).padStart(16,'0')];}
  if(timestamp&&(x===null||typeof x==='string')){if(x===null)return['T','N'.padEnd(28,' ')];const match=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(\d{3}|\d{6})Z$/.exec(x);if(!match||!Number.isFinite(Date.parse(x)))return fail();return['T','V'+match[1]+'.'+match[2]!.padEnd(6,'0')+'Z'];}
  if(state&&(x===null||typeof x==='string')){if(x!==null&&x.length>64)return fail();return['S',x===null?'N'.padEnd(65,' '):'V'+x.padEnd(64,' ')];}
  if(x===null)return['N'];if(typeof x==='boolean')return['B',x?'1':'0'];
  if(typeof x==='number'){if(!Number.isSafeInteger(x)||x<0)return fail();return['I','V'+String(x).padStart(16,'0')];}
  if(typeof x==='string')return['S',x];
  if(Array.isArray(x))return['A',x.map(y=>encode(y))];
  if(x&&typeof x==='object')return['O',Object.fromEntries(Object.entries(x).map(([k,y])=>[k,encode(y,k)]))];return fail();
 };return Buffer.byteLength(canonicalJson(encode(v)));
}
/** 실제 timestamp 열의 표현만 UTC microsecond 고정형으로 정규화한다. JSON 본문/hash는 건드리지 않는다. */
export function controlPhysicalProjection(value:unknown):unknown{
 const v=copyControlData(value);if(!v||typeof v!=='object'||Array.isArray(v))return fail();const row=v as Record<string,unknown>;
 for(const [key,x]of Object.entries(row)){if(/(_at|_until)$/.test(key)&&x!==null){if(typeof x!=='string')return fail();const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(x);if(!m||!Number.isFinite(Date.parse(x)))return fail();row[key]=m[1]+'.'+(m[2]??'').padEnd(6,'0')+'Z';}}
 return row;
}
export interface ControlStorageContext{projectId:string;createdAt:string;command?:unknown;subject?:{actorId:string;clientId:string;sessionId:string;credentialGeneration:number}}
export function planControlStorage(commandRef:RuntimeRefV1,values:ControlStorageRow[],context:ControlStorageContext){
 const rows=copyControlData(values);if(!refV1(commandRef)||rows.length<1||rows.length>10||!context||!uuidV1(context.projectId)||!isoV1(context.createdAt))fail();
 const seen=new Set<string>(),parts=rows.map(r=>{const key=r.table+':'+r.id;if(!controlStorageTables.includes(r.table)||!uuidV1(r.id)||seen.has(key))fail();seen.add(key);return{table:r.table,id:r.id,bytes:controlCostBytes(r.projection),projectionHash:controlHash(controlPhysicalProjection(r.projection))};});
 const payload={schemaVersion:1,purpose:'CONTROL_STORAGE_PLAN',projectId:context.projectId,commandRef:copyControlData(commandRef),createdAt:context.createdAt,rows:parts,...(context.command!==undefined?{command:copyControlData(context.command)}:{}),...(context.subject?{subject:copyControlData(context.subject)}:{})},metadataBytes=parts.reduce((n,r)=>n+r.bytes,0),planHash=controlHash(payload);
 const initial={...payload,metadataBytes,reservationBytes:0,reservedBytes:0,planHash};
 const reservationBytes=controlCostBytes(controlReservationProjection(initial,'RESERVED')),reservedBytes=metadataBytes+reservationBytes,plan={...initial,reservationBytes,reservedBytes};
 if(!Number.isSafeInteger(reservedBytes)||reservedBytes>10*1024*1024*1024||controlCostBytes(controlReservationProjection(plan,'RESERVED'))!==reservationBytes)fail();
 return freezeControl(plan);
}
export type ControlStoragePlan=ReturnType<typeof planControlStorage>;
/** SQL actual collector가 읽는 reservation 물리열 전부와 동일한 projection이다. */
export function controlReservationProjection(plan:ControlStoragePlan,phase:'RESERVED'|'SETTLED'|'UNKNOWN'){
 const {metadataBytes:_m,reservationBytes:_s,reservedBytes:_r,planHash:_h,...payload}=plan,{projectId,commandRef,createdAt}=plan;
 return {project_id:projectId,command_id:commandRef.id,command_ref:commandRef,plan_json:payload,plan_hash:plan.planHash,phase,metadata_bytes:plan.metadataBytes,reservation_bytes:plan.reservationBytes,reserved_bytes:plan.reservedBytes,settled_bytes:phase==='SETTLED'?plan.reservedBytes:null,created_at:createdAt,updated_at:phase==='SETTLED'?createdAt:null};
}
export function settleControlStorage(plan:ControlStoragePlan,rows:ControlStorageRow[]):number{
 const actual=planControlStorage(plan.commandRef,rows,{projectId:plan.projectId,createdAt:plan.createdAt,...(plan.command!==undefined?{command:plan.command}:{}),...(plan.subject?{subject:plan.subject}:{})});
 if(actual.planHash!==plan.planHash||actual.reservedBytes!==plan.reservedBytes||controlCostBytes(controlReservationProjection(actual,'SETTLED'))!==actual.reservationBytes)fail();return actual.reservedBytes;
}
