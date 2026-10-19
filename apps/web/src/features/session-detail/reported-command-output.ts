import type {PlanRef} from '../design-trace/work-plan-api.ts';
const exact=(v:any,k:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(',');
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
const same=(a:PlanRef,b:PlanRef)=>a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;
const time=(v:any)=>v===null||typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const evidence=(v:any)=>Array.isArray(v)&&v.length<=20&&v.every(e=>exact(e,['sourceKind','ref','contentHash','environmentRef','recordedAt'])&&['WORKER_CLAIM','CONNECTOR_OBSERVED','TEST_ARTIFACT','REVIEWER_CONFIRMED'].includes(e.sourceKind)&&ref(e.ref)&&hash(e.contentHash)&&ref(e.environmentRef)&&e.recordedAt!==null&&time(e.recordedAt));
/** 선언된 원실행·출력 참조만 결박한다. 명령 실행·exit 성공 판정·출처 검증은 하지 않는다. */
export function resolveReportedCommandOutput(raw:unknown,artifacts:unknown,executionRef:unknown):PlanRef|null{
 const v=raw as any;
 if(!exact(v,['profileRef','argv','cwdRef','hostRef','executionRef','startedAt','finishedAt','exitCode','outputRef','evidence'])||!ref(v.profileRef)||!ref(v.cwdRef)||!ref(v.hostRef)||!ref(v.executionRef)||!ref(executionRef)||!same(v.executionRef,executionRef)||!Array.isArray(v.argv)||v.argv.length>200||!v.argv.every((a:unknown)=>typeof a==='string'&&a.length<=2000)||!time(v.startedAt)||!time(v.finishedAt)||v.startedAt!==null&&v.finishedAt!==null&&Date.parse(v.finishedAt)<Date.parse(v.startedAt)||v.exitCode!==null&&(!Number.isSafeInteger(v.exitCode)||v.exitCode<0)||!evidence(v.evidence)||!ref(v.outputRef)||v.outputRef.version!==1||!Array.isArray(artifacts)||artifacts.length>200||!artifacts.every(ref))return null;
 const matches=artifacts.filter(r=>r.id===v.outputRef.id);
 return matches.length===1&&same(matches[0]!,v.outputRef)?structuredClone(v.outputRef):null;
}
