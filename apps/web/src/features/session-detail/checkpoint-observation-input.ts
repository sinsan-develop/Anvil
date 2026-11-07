import {ApiError} from '../../api/client.ts';
import type {CheckpointState} from '../../../../server/modules/checkpoints/checkpoint-input.ts';
export interface CheckpointReferenceForm{id:string;version:string;contentHash:string}
export interface CheckpointObservationForm{executionRefs:CheckpointReferenceForm[];lastLocalSequence:string;ackSequence:string;ackRef:CheckpointReferenceForm}
export const emptyCheckpointObservations=():CheckpointObservationForm=>({executionRefs:[],lastLocalSequence:'',ackSequence:'',ackRef:{id:'',version:'',contentHash:''}});
const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function fail():never{throw new ApiError('CHECKPOINT_OBSERVATION_INPUT_INVALID');}
function number(v:unknown){if(typeof v!=='string'||!/^(0|[1-9][0-9]*)$/.test(v)||!Number.isSafeInteger(Number(v)))fail();return Number(v);}
function reference(v:any){if(!exact(v,['id','version','contentHash'])||!uuid(v.id)||typeof v.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(v.contentHash))fail();const version=number(v.version);if(version<1)fail();return{id:v.id as string,version,contentHash:v.contentHash as string};}
/** 사용자 선언 입력만 변환한다. 현재 실행·수신 사실을 관측하거나 파일/DB에 저장하지 않는다. */
export function checkpointObservationInput(raw?:CheckpointObservationForm):Pick<CheckpointState,'executionRefs'|'lastLocalSequence'|'lastServerAck'>{
 const v=structuredClone(raw??emptyCheckpointObservations());if(!exact(v,['executionRefs','lastLocalSequence','ackSequence','ackRef'])||!Array.isArray(v.executionRefs)||v.executionRefs.length>200||!exact(v.ackRef,['id','version','contentHash']))fail();
 const executionRefs=v.executionRefs.map(reference);if(new Set(executionRefs.map(r=>r.id+':'+r.version)).size!==executionRefs.length)fail();const lastLocalSequence=v.lastLocalSequence===''?null:number(v.lastLocalSequence),sequence=v.ackSequence===''?null:number(v.ackSequence),blank=v.ackRef.id===''&&v.ackRef.version===''&&v.ackRef.contentHash==='';
 if(sequence===null&&!blank||sequence!==null&&lastLocalSequence!==null&&sequence>lastLocalSequence)fail();const batchRef=blank?null:reference(v.ackRef);if(sequence!==null&&sequence>0&&!batchRef)fail();
 return{executionRefs,lastLocalSequence,lastServerAck:sequence===null?null:{sequence,batchRef}};
}
