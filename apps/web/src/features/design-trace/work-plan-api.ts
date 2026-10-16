import {ApiClient,ApiError} from '../../api/client.ts';
import {postDocumentCommand,type DocumentBuffer,type DocumentSession,type DocumentWrite} from './editor-api.ts';
import type {TaskCard} from '../../../../server/modules/traceability/work-plan-card.ts';
export type PlanRef={id:string;version:number;contentHash:string};
export interface WorkPlanInput{documentRef:PlanRef;designRef:PlanRef|null;screenReviewRefs:unknown[];tasks:TaskCard[];reason:string}
export interface WorkPlanView{ref:PlanRef;status:'DRAFT';documentRef:PlanRef;designRef:PlanRef;screenReviewRefs:unknown[];tasks:TaskCard[];dependencies:{taskCode:string;dependencyTaskCode:string;phase:'START'|'ACCEPTANCE'}[];reason:string;issues:{code:string;location:string;message:string}[];relationalProjection:'STORED'|'ISSUES_ONLY';executionEvidence:'NOT_CONNECTED';observedAt:string}
export interface WorkPlanBuffer{bindingId:string;input:WorkPlanInput;planRef:PlanRef|null;pending:DocumentWrite|null;result:WorkPlanView|null;uncertain:boolean;failure:{code:string;status:number}|null;designDocumentId:string;designVersion:string;designIndex:import('./design-index-api.ts').DesignIndexView|null}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,hash=/^[0-9a-f]{64}$/;
const ref=(v:any):v is PlanRef=>!!v&&Object.keys(v).sort().join(',')==='contentHash,id,version'&&uuid.test(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&hash.test(v.contentHash);
const normalized=(v:any):any=>Array.isArray(v)?v.map(normalized):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalized(v[k])])):v;
const same=(a:unknown,b:unknown)=>JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const strings=(v:any)=>Array.isArray(v)&&v.length<=200&&v.every(s=>typeof s==='string'&&s.length<=20_000&&s.isWellFormed());
function card(v:any){
  const arrays=['inputs','outputs','included','excluded','allowedFileRefs','startPrerequisites','acceptancePrerequisites','steps','acceptanceCriteria','evidenceRequirements'];
  const links=(a:any,kind:string)=>Array.isArray(a)&&a.length<=200&&a.every(r=>exact(r,['kind','id','versionRef','localCode','anchor'])&&r.kind===kind&&uuid.test(r.id)&&ref(r.versionRef)&&typeof r.localCode==='string'&&typeof r.anchor==='string');
  return exact(v,['taskCode','type','title','purpose','designRefs','screenRefs','ownerRole',...arrays,'testCases','rollback','recoveryNotes'])&&typeof v.taskCode==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v.taskCode)&&['SCREEN','FUNCTION','INTEGRATION','PREPARATION'].includes(v.type)&&['title','purpose','ownerRole','rollback','recoveryNotes'].every(k=>typeof v[k]==='string'&&v[k].length<=20_000)&&arrays.every(k=>strings(v[k]))&&links(v.designRefs,'DESIGN_ITEM')&&links(v.screenRefs,'SCREEN_REGION')&&Array.isArray(v.testCases)&&v.testCases.length<=200&&v.testCases.every((c:any)=>exact(c,['id','kind','steps','expected','environment'])&&typeof c.id==='string'&&['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'].includes(c.kind)&&strings(c.steps)&&typeof c.expected==='string'&&typeof c.environment==='string');
}
async function digest(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalized(v)))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function validate(value:WorkPlanView,expected?:PlanRef){
  if(!value||!ref(value.ref)||expected&&!same(value.ref,expected)||value.status!=='DRAFT'||!ref(value.documentRef)||!ref(value.designRef)||!Array.isArray(value.screenReviewRefs)||value.screenReviewRefs.length>200||!Array.isArray(value.tasks)||value.tasks.length>200||!Array.isArray(value.dependencies)||value.dependencies.length>80_000||!Array.isArray(value.issues)||value.issues.length>250_000||value.issues.some(i=>!i||typeof i.code!=='string'||typeof i.location!=='string'||typeof i.message!=='string')||typeof value.reason!=='string'||!['STORED','ISSUES_ONLY'].includes(value.relationalProjection)||value.executionEvidence!=='NOT_CONNECTED'||!Number.isFinite(Date.parse(value.observedAt))) throw new ApiError('RESPONSE_INVALID');
  if(!exact(value,['ref','status','documentRef','designRef','screenReviewRefs','tasks','dependencies','reason','issues','relationalProjection','executionEvidence','observedAt'])||!value.tasks.every(card)||value.dependencies.some(d=>!exact(d,['taskCode','dependencyTaskCode','phase'])||typeof d.taskCode!=='string'||typeof d.dependencyTaskCode!=='string'||!['START','ACCEPTANCE'].includes(d.phase)))throw new ApiError('RESPONSE_INVALID');
  const snapshot={documentRef:value.documentRef,designRef:value.designRef,screenReviewRefs:value.screenReviewRefs,tasks:value.tasks,dependencies:value.dependencies,reason:value.reason,issues:value.issues,relationalProjection:value.relationalProjection};
  if(await digest(snapshot)!==value.ref.contentHash) throw new ApiError('WORK_PLAN_INTEGRITY_FAILED');
  return value;
}
export async function readWorkPlan(client:ApiClient,projectId:string,planRef:PlanRef){
  if(!uuid.test(projectId)||!ref(planRef)) throw new ApiError('CLIENT_PATH_INVALID');
  return validate(await client.get<WorkPlanView>(`/api/v1/projects/${projectId}/work-plans/${planRef.id}/versions/${planRef.version}`),planRef);
}
export function newWorkPlan(buffer:DocumentBuffer):WorkPlanBuffer{
  const documentRef={id:buffer.documentId,version:buffer.baseVersion,contentHash:buffer.baseHash};if(!ref(documentRef)) throw new ApiError('WORK_PLAN_INPUT_INVALID');
  return {bindingId:crypto.randomUUID(),input:{documentRef,designRef:null,screenReviewRefs:[],tasks:[],reason:''},planRef:null,pending:null,result:null,uncertain:false,failure:null,designDocumentId:'',designVersion:'1',designIndex:null};
}
function work(buffer:DocumentBuffer,session:DocumentSession){
  const s=buffer.workPlanState;
  if(!s||buffer.pending||buffer.designIndexState||buffer.proposalState||buffer.importState||buffer.importPreparationId||buffer.ownerUserId!==session.user.id||!uuid.test(s.bindingId)||!uuid.test(buffer.projectId)||!uuid.test(session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)||!Number.isSafeInteger(buffer.controlGeneration)||buffer.controlGeneration<1||!ref(s.input.documentRef)||!same(s.input.documentRef,{id:buffer.documentId,version:buffer.baseVersion,contentHash:buffer.baseHash})||!ref(s.input.designRef)||s.planRef!==null&&!ref(s.planRef)||!Array.isArray(s.input.tasks)||s.input.tasks.length>200||!Array.isArray(s.input.screenReviewRefs)||s.input.screenReviewRefs.length>200||typeof s.input.reason!=='string'||!s.input.reason.trim()||s.input.reason.length>20_000) throw new ApiError('WORK_PLAN_INPUT_INVALID');return s;
}
export function prepareWorkPlan(buffer:DocumentBuffer,session:DocumentSession):DocumentWrite{
  const s=work(buffer,session);if(s.pending||s.result)throw new ApiError('WORK_PLAN_PENDING_RESULT');
  const command:DocumentWrite={schemaVersion:1,projectId:buffer.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:buffer.controlGeneration,operation:'saveWorkPlanDraft',targetId:s.planRef?.id??null,expectedVersion:s.planRef?.version??0,baselineRefs:[],approvalRef:null,payload:{...structuredClone(s.input)}};
  if(new TextEncoder().encode(JSON.stringify(command)).length>2*1024*1024)throw new ApiError('WORK_PLAN_INPUT_TOO_LARGE');return command;
}
export async function sendWorkPlan(client:ApiClient,buffer:DocumentBuffer,session:DocumentSession,active:()=>boolean){
  const s=work(buffer,session),c=s.pending;
  if(!c||c.schemaVersion!==1||!uuid.test(c.commandId)||c.projectId!==buffer.projectId||c.clientId!==session.clientId||c.controlGeneration!==buffer.controlGeneration||c.operation!=='saveWorkPlanDraft'||c.targetId!==(s.planRef?.id??null)||c.expectedVersion!==(s.planRef?.version??0)||c.baselineRefs.length||c.approvalRef!==null||!same(c.payload,s.input))throw new ApiError('WORK_PLAN_INPUT_INVALID');
  if(!active())throw new ApiError('WORK_PLAN_CONTINUATION_PAUSED');
  const r=await postDocumentCommand(client,c,session.csrfToken);
  if(r.data?.status!=='WORK_PLAN_DRAFT_SAVED'||!ref(r.data.ref)||r.targetId!==r.data.ref.id||r.version!==c.expectedVersion+1||r.data.ref.version!==r.version||c.targetId!==null&&r.data.ref.id!==c.targetId)throw new ApiError('RESPONSE_INVALID');
  if(!exact(r.data.workPlan,['ref','status','documentRef','designRef','screenReviewRefs','tasks','dependencies','reason','issues','relationalProjection']))throw new ApiError('RESPONSE_INVALID');
  const value=await validate({...r.data.workPlan,executionEvidence:'NOT_CONNECTED',observedAt:r.serverReceivedAt},r.data.ref);
  for(const k of ['documentRef','designRef','screenReviewRefs','tasks','reason'] as const)if(!same(value[k],s.input[k]))throw new ApiError('RESPONSE_INVALID');return value;
}
export function blankPlanTask():TaskCard{return {taskCode:'',type:'FUNCTION',title:'',purpose:'',designRefs:[],screenRefs:[],ownerRole:'',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],testCases:[],acceptanceCriteria:[],evidenceRequirements:[],rollback:'',recoveryNotes:''};}
