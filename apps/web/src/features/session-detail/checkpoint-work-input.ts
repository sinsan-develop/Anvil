import {ApiError} from '../../api/client.ts';
import type {CheckpointItem,CheckpointState} from '../../../../server/modules/checkpoints/checkpoint-input.ts';
import type {CheckpointReferenceForm} from './checkpoint-observation-input.ts';
export interface CheckpointWorkText{completed:string;progress:string;remaining:string;decisions:string;reason:string;workRows?:CheckpointWorkRows}
export interface CheckpointWorkRow{id:string;text:string}
export type CheckpointWorkRows=Record<'completed'|'progress'|'remaining'|'decisions'|'forbidden',CheckpointWorkRow[]>;
export interface CheckpointWorkDetails{evidence:{itemId:string;description:string;evidenceRefs:CheckpointReferenceForm[]}[];decisions:{decisionId:string;question:string;reason:string;requiredFrom:'HUMAN'|'COORDINATOR'|'STAGE_OWNER';sourceRef:CheckpointReferenceForm}[]}
export const emptyCheckpointWorkDetails=():CheckpointWorkDetails=>({evidence:[],decisions:[]});
const exact=(v:any,k:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(','),lines=(v:string)=>v.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
function fail():never{throw new ApiError('CHECKPOINT_WORK_INPUT_INVALID');}
const rowKeys=['completed','progress','remaining','decisions','forbidden'] as const;
function validRow(row:CheckpointWorkRow){
 return exact(row,['id','text'])&&typeof row.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(row.id)
  &&typeof row.text==='string'&&row.text.length<=20000;
}
const uniqueIds=(rows:CheckpointWorkRow[])=>new Set(rows.map(row=>row.id)).size===rows.length;
function parse(t:CheckpointWorkText){
 if(!t||typeof t.reason!=='string'||t.reason.length>20000)fail();
 const rows=t.workRows;
 if(rows!==undefined){
  if(!exact(rows,[...rowKeys])||rowKeys.some(key=>!Array.isArray(rows[key])||rows[key].length>200||!rows[key].every(validRow)))fail();
  const items=[...rows.completed,...rows.progress,...rows.remaining];
  if(!uniqueIds(items)||!uniqueIds(rows.decisions)||!uniqueIds(rows.forbidden))fail();
 }else if(['completed','progress','remaining','decisions'].some(k=>typeof(t as any)[k]!=='string'||(t as any)[k].length>20000))fail();
 const list=(key:'completed'|'progress'|'remaining'|'decisions',prefix:string)=>rows?.[key]??lines(t[key]).map((text,i)=>({id:prefix+'-'+(i+1),text}));
 const items=(key:'completed'|'progress'|'remaining'):CheckpointItem[]=>list(key,key).map(row=>({itemId:row.id,description:row.text,evidenceRefs:[]}));
 return{completedItems:items('completed'),inProgress:items('progress'),remaining:items('remaining'),pendingDecisions:list('decisions','decision').map(row=>({decisionId:row.id,question:row.text,reason:t.reason,requiredFrom:'HUMAN' as const,sourceRef:null}))};
}
/** 화면 선택은 200개씩만 제공한다. 준비는 초과 입력을 거절하므로 잘라 저장하지 않는다. */
export function checkpointWorkChoices(text:CheckpointWorkText){const w=parse(text);return{items:[...w.completedItems.slice(0,200),...w.inProgress.slice(0,200),...w.remaining.slice(0,200)],decisions:w.pendingDecisions.slice(0,200)};}
function reference(v:any){if(!exact(v,['id','version','contentHash'])||typeof v.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.id)||typeof v.version!=='string'||!/^[1-9][0-9]*$/.test(v.version)||!Number.isSafeInteger(Number(v.version))||typeof v.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(v.contentHash))fail();return{id:v.id,version:Number(v.version),contentHash:v.contentHash};}
function refs(v:any){if(!Array.isArray(v)||v.length>200)fail();const a=v.map(reference);if(new Set(a.map(r=>r.id+':'+r.version)).size!==a.length)fail();return a;}
function optional(v:any){if(!exact(v,['id','version','contentHash']))fail();return v.id===''&&v.version===''&&v.contentHash===''?null:reference(v);}
/** 상세 참조는 정확한 작성 본문에만 연결한다. 본문 변경을 다른 내용에 자동 재결박하지 않는다. */
export function checkpointWorkInput(rawText:CheckpointWorkText,rawDetails?:CheckpointWorkDetails):Pick<CheckpointState,'completedItems'|'inProgress'|'remaining'|'pendingDecisions'>{
 const text=structuredClone(rawText),d=structuredClone(rawDetails??emptyCheckpointWorkDetails()),w=parse(text);if(Object.values(w).some(a=>a.length>200)||!exact(d,['evidence','decisions'])||!Array.isArray(d.evidence)||d.evidence.length>600||!Array.isArray(d.decisions)||d.decisions.length>200)fail();
 if(text.workRows&&Object.values(text.workRows).some(rows=>rows.some(row=>!row.text.trim()||!row.text.isWellFormed()||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(row.text))))fail();
 const items=new Map([...w.completedItems,...w.inProgress,...w.remaining].map(i=>[i.itemId,i])),seen=new Set<string>();for(const e of d.evidence){if(!exact(e,['itemId','description','evidenceRefs'])||seen.has(e.itemId))fail();const item=items.get(e.itemId);if(!item||item.description!==e.description)fail();seen.add(e.itemId);item.evidenceRefs=refs(e.evidenceRefs);}
 const decisions:CheckpointState['pendingDecisions']=w.pendingDecisions,seenDecisions=new Set<string>();for(const v of d.decisions){if(!exact(v,['decisionId','question','reason','requiredFrom','sourceRef'])||seenDecisions.has(v.decisionId)||typeof v.reason!=='string'||v.reason.length>20000||!['HUMAN','COORDINATOR','STAGE_OWNER'].includes(v.requiredFrom))fail();const q=decisions.find(q=>q.decisionId===v.decisionId);if(!q||q.question!==v.question)fail();seenDecisions.add(v.decisionId);q.reason=v.reason||text.reason;q.requiredFrom=v.requiredFrom;q.sourceRef=optional(v.sourceRef);}
 return{completedItems:w.completedItems,inProgress:w.inProgress,remaining:w.remaining,pendingDecisions:decisions};
}
