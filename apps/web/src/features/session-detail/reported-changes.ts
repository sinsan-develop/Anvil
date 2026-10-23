import type {PlanRef} from '../design-trace/work-plan-api.ts';
export const reportedChangeKinds=['ADDED','MODIFIED','DELETED'] as const;
export interface ReportedChange {path:string;kind:typeof reportedChangeKinds[number];diffRef:PlanRef|null;beforeHash:string|null;afterHash:string|null}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ref=(v:any)=>exact(v,['id','version','contentHash'])&&typeof v.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
function valid(v:any):v is ReportedChange {
 return exact(v,['path','kind','diffRef','beforeHash','afterHash'])&&typeof v.path==='string'&&!!v.path.trim()&&v.path.length<=2000&&v.path.isWellFormed()&&!/^[\\/]|^[A-Za-z]:|[\u0000-\u001f]/.test(v.path)&&!v.path.replaceAll('\\','/').split('/').some((s:string)=>s==='..'||s==='.'||!s)&&reportedChangeKinds.includes(v.kind)&&(v.diffRef===null||ref(v.diffRef))&&(v.beforeHash===null||hash(v.beforeHash))&&(v.afterHash===null||hash(v.afterHash));
}
/** 제출된 형식의 표시용 검사다. 실제 파일/변경·해시의 진위나 완료를 판정하지 않는다. */
export function inspectReportedChanges(raw:unknown){
 const rows:{index:number;value:ReportedChange}[]=[],invalidIndices:number[]=[];
 if(!Array.isArray(raw)||raw.length>200)return{rows,invalidIndices,listInvalid:true};
 raw.forEach((value,index)=>{if(valid(value))rows.push({index,value:structuredClone(value)});else invalidIndices.push(index);});
 return{rows,invalidIndices,listInvalid:false};
}
