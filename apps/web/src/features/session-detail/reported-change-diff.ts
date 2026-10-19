import type {PlanRef} from '../design-trace/work-plan-api.ts';
const exact=(v:any,k:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(',');
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash(v.contentHash);
/** 제출된 변경 선언과 등록 산출물 참조만 결박한다. 경로 접근·실제 Git/diff 일치·출처 검증은 하지 않는다. */
export function resolveReportedChangeDiff(raw:unknown,artifacts:unknown):PlanRef|null{
 const v=raw as any;
 if(!exact(v,['path','kind','diffRef','beforeHash','afterHash'])||typeof v.path!=='string'||!v.path.trim()||v.path.length>2000||/^[\\/]|^[A-Za-z]:|[\u0000-\u001f]/.test(v.path)||v.path.replaceAll('\\','/').split('/').some((s:string)=>s==='..'||s==='.'||!s)||!['ADDED','MODIFIED','DELETED'].includes(v.kind)||!ref(v.diffRef)||v.diffRef.version!==1||v.beforeHash!==null&&!hash(v.beforeHash)||v.afterHash!==null&&!hash(v.afterHash)||!Array.isArray(artifacts)||artifacts.length>200||!artifacts.every(ref))return null;
 const matches=artifacts.filter(r=>r.id===v.diffRef.id);
 return matches.length===1&&matches[0]!.version===v.diffRef.version&&matches[0]!.contentHash===v.diffRef.contentHash?structuredClone(v.diffRef):null;
}
