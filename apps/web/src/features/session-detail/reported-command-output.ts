import type {PlanRef} from '../design-trace/work-plan-api.ts';
const exact=(v:any,k:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(',');
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
const same=(a:PlanRef,b:PlanRef)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const time=(v:any)=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const evidence=(v:any)=>Array.isArray(v)&&v.length<=20&&v.every(e=>exact(e,['sourceKind','ref','contentHash','environmentRef','recordedAt'])&&['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].includes(e.sourceKind)&&ref(e.ref)&&hash(e.contentHash)&&ref(e.environmentRef)&&e.recordedAt!==null&&time(e.recordedAt));
export interface ReportedCommand{profileRef:PlanRef;argv:string[];cwdRef:PlanRef;hostRef:PlanRef;executionRef:PlanRef;startedAt:string|null;finishedAt:string|null;exitCode:number|null;outputRef:PlanRef|null;evidence:{sourceKind:string;ref:PlanRef;contentHash:string;environmentRef:PlanRef;recordedAt:string}[]}
function command(v:any):v is ReportedCommand{
 return exact(v,['profileRef','argv','cwdRef','hostRef','executionRef','startedAt','finishedAt','exitCode','outputRef','evidence'])&&ref(v.profileRef)&&ref(v.cwdRef)&&ref(v.hostRef)&&ref(v.executionRef)&&Array.isArray(v.argv)&&v.argv.length<=200&&v.argv.every((a:unknown)=>typeof a==='string'&&a.length<=2000)&&time(v.startedAt)&&time(v.finishedAt)&&!(v.startedAt!==null&&v.finishedAt!==null&&Date.parse(v.finishedAt)<Date.parse(v.startedAt))&&(v.exitCode===null||Number.isSafeInteger(v.exitCode)&&v.exitCode>=0)&&evidence(v.evidence)&&(v.outputRef===null||ref(v.outputRef));
}
/** 표시할 형식만 검사한다. 종결/exit/출처는 원 제출자의 선언이며 검수·진위를 판정하지 않는다. */
export function inspectReportedCommands(raw:unknown):{rows:{index:number;value:ReportedCommand}[];invalidIndices:number[];listInvalid:boolean}{
 if(!Array.isArray(raw)||raw.length>200)return{rows:[],invalidIndices:[],listInvalid:true};
 const rows:{index:number;value:ReportedCommand}[]=[],invalidIndices:number[]=[];
 raw.forEach((value,index)=>{if(command(value))rows.push({index,value:structuredClone(value)});else invalidIndices.push(index);});
 return{rows,invalidIndices,listInvalid:false};
}
/** 선언된 원실행·출력 참조만 결박한다. 명령 실행·exit 성공 판정·출처 검증은 하지 않는다. */
export function resolveReportedCommandOutput(raw:unknown,artifacts:unknown,executionRef:unknown):PlanRef|null{
 const v=raw;
 if(!command(v)||!ref(executionRef)||!same(v.executionRef,executionRef)||!v.outputRef||v.outputRef.version!==1||!Array.isArray(artifacts)||artifacts.length>200||!artifacts.every(ref))return null;
 const output=v.outputRef,matches=artifacts.filter(r=>r.id===output.id);
 return matches.length===1&&same(matches[0]!,output)?structuredClone(output):null;
}
