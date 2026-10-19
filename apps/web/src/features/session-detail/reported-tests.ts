export const reportedTestStatuses=['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE'] as const;
export type ReportedTestStatus=typeof reportedTestStatuses[number];
type Ref={id:string;version:number;contentHash:string};
export interface ReportedTest{criterionId:string;testId:string;baselineRefs:Ref[];expected:string;actual:string;status:ReportedTestStatus;evidence:{sourceKind:string;ref:Ref;contentHash:string;environmentRef:Ref;recordedAt:string}[]}
const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const ref=(v:any)=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v),text=(v:unknown)=>typeof v==='string'&&v.length<=20000&&v.isWellFormed();
function valid(v:any):v is ReportedTest{
 return exact(v,['criterionId','testId','baselineRefs','expected','actual','status','evidence'])&&code(v.criterionId)&&code(v.testId)&&text(v.expected)&&text(v.actual)&&reportedTestStatuses.includes(v.status)&&Array.isArray(v.baselineRefs)&&v.baselineRefs.length<=200&&v.baselineRefs.every(ref)&&Array.isArray(v.evidence)&&v.evidence.length<=20&&v.evidence.every((e:any)=>exact(e,['sourceKind','ref','contentHash','environmentRef','recordedAt'])&&['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].includes(e.sourceKind)&&ref(e.ref)&&ref(e.environmentRef)&&hash(e.contentHash)&&typeof e.recordedAt==='string'&&Number.isFinite(Date.parse(e.recordedAt))&&new Date(e.recordedAt).toISOString()===e.recordedAt);
}
/** 표시할 형식만 검사한다. status/sourceKind는 원 제출자의 주장으로 유지하며 검수·진위·현재성을 판정하지 않는다. */
export function inspectReportedTests(raw:unknown):{rows:{index:number;value:ReportedTest}[];invalidIndices:number[];listInvalid:boolean}{
 if(!Array.isArray(raw)||raw.length>200)return{rows:[],invalidIndices:[],listInvalid:true};
 const rows:{index:number;value:ReportedTest}[]=[],invalidIndices:number[]=[];
 raw.forEach((value,index)=>{if(valid(value))rows.push({index,value:structuredClone(value)});else invalidIndices.push(index);});
 return{rows,invalidIndices,listInvalid:false};
}
