import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
export const resultTestKinds=['BUILD','TYPECHECK','UNIT','INTEGRATION','BROWSER','AGENT','DEPLOYMENT','SECURITY'] as const;
export interface CriteriaRow{field:'acceptanceCriteria'|'verificationRequirements';index:number;criterionId:string;testId:string;kind:string}
export type CriteriaInput={assignmentRef:PlanRef;baseRef:PlanRef|null;items:{criterionId:string;testId:string;kind:string;environmentRef:PlanRef;sources:{field:CriteriaRow['field'];index:number;contentHash:string}[]}[];reason:string};
export interface CriteriaRegistration{ownerUserId:string;assignment:ConfirmedAssignmentView;base?:RegisteredCriteria;command:{schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;operation:'saveResultCriteria';targetId:string|null;expectedVersion:number;baselineRefs:[];approvalRef:null;payload:CriteriaInput}}
/** POST APPLIED 이후 조회 거절은 저장 명령 자체의 확정 거절이 아니다. */
export class CriteriaReadbackUnconfirmed extends ApiError{readonly writeMayHaveApplied=true;}
export interface RegisteredCriteria{projectId:string;ref:PlanRef;snapshot:{assignmentRef:PlanRef;baselineRefs:PlanRef[];items:{criterionId:string;testId:string;kind:string;environmentRef:PlanRef;required:true}[]};input:CriteriaInput;sourceBindings:{criterionId:string;sources:CriteriaInput['items'][number]['sources']}[];createdBy:string;registeredAt:string;registryStored:true;reviewStored:false;completionAccepted:false;executionAuthorized:false;dispatchPerformed:false;observedAt:string}
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(','),same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),ref=(v:any):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const code=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(v),date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function fail(code='RESULT_CRITERIA_INPUT_INVALID'):never{throw new ApiError(code);}
async function hash(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function criteriaRows(assignment:ConfirmedAssignmentView):CriteriaRow[]{return (['acceptanceCriteria','verificationRequirements'] as const).flatMap(field=>assignment.snapshot.definition[field].map((_text,index)=>({field,index,criterionId:'',testId:'',kind:''})));}
async function inputFor(assignment:ConfirmedAssignmentView,rows:CriteriaRow[],reason:string):Promise<CriteriaInput>{
 const a=structuredClone(assignment),d=a.snapshot?.definition;
 if(!exact(a,['projectId','ref','snapshot','observedAt'])||!uuid(a.projectId)||!ref(a.ref)||!date(a.observedAt)||!d||a.snapshot.contentConfirmed!==true||a.snapshot.ready!==false||a.snapshot.executionAuthorized!==false||a.snapshot.dispatchPerformed!==false||await hash(a.snapshot)!==a.ref.contentHash||!ref(d.environmentRef)||!Array.isArray(d.baselineRefs)||!d.baselineRefs.length||!d.baselineRefs.every(ref)||!Array.isArray(rows)||rows.length<1||rows.length>100||typeof reason!=='string'||!reason.trim()||reason.length>20000)fail();
 const expected=criteriaRows(a);if(expected.length!==rows.length||!d.acceptanceCriteria.length||!d.verificationRequirements.length||new Set(rows.map(r=>r.criterionId)).size!==rows.length)fail();
 const seen=new Set<string>();const items=[];
 for(const raw of rows){const r=structuredClone(raw),key=r.field+':'+r.index;if(!exact(r,['field','index','criterionId','testId','kind'])||!['acceptanceCriteria','verificationRequirements'].includes(r.field)||!Number.isSafeInteger(r.index)||r.index<0||!code(r.criterionId)||!code(r.testId)||!resultTestKinds.includes(r.kind as any)||seen.has(key)||!expected.some(e=>e.field===r.field&&e.index===r.index))fail();seen.add(key);const text=d[r.field][r.index];if(typeof text!=='string'||!text.trim()||text.length>20000)fail();items.push({criterionId:r.criterionId,testId:r.testId,kind:r.kind,environmentRef:structuredClone(d.environmentRef),sources:[{field:r.field,index:r.index,contentHash:await hash(text)}]});}
 const payload={assignmentRef:a.ref,baseRef:null,items,reason};if(new TextEncoder().encode(ordered({assignment:a,input:payload})).length>2*1024*1024)fail();return payload;
}
function sessionBinding(session:DocumentSession){if(!uuid(session?.user?.id)||!uuid(session.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken))fail('RESULT_CRITERIA_BINDING_INVALID');}
/** 원조건 한 항목당 사용자 명시 시험 한 건. 종류/환경을 추측하거나 저장을 자동 실행하지 않는다. */
export async function prepareCriteriaRegistration(assignment:ConfirmedAssignmentView,rows:CriteriaRow[],reason:string,session:DocumentSession,generation:number):Promise<CriteriaRegistration>{
 sessionBinding(session);if(!Number.isSafeInteger(generation)||generation<1)fail('RESULT_CRITERIA_BINDING_INVALID');const a=structuredClone(assignment),payload=await inputFor(a,rows,reason);
 return{ownerUserId:session.user.id,assignment:a,command:{schemaVersion:1,projectId:a.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:generation,operation:'saveResultCriteria',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload}};
}
/** 선택 원문을 보호 reader와 동일하게 검증하고 원조건 배열을 보존한다. */
async function revisionInputFor(assignment:ConfirmedAssignmentView,base:RegisteredCriteria,items:CriteriaInput['items'],reason:string):Promise<CriteriaInput>{
 try{
  if(!base||!ref(base.ref))fail();
  const selected={ref:base.ref,createdBy:base.createdBy,registeredAt:base.registeredAt,conditionCount:base.input?.items?.length,registryStored:true as const,reviewStored:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  await readStoredCriteria(new ApiClient(async()=>Response.json(base)),assignment,selected,()=>true);
  if(!Array.isArray(items)||items.length!==base.input.items.length||typeof reason!=='string'||!reason.trim()||reason.length>20000)fail();
  const ids=new Set<string>();
  for(let index=0;index<items.length;index++){
   const item=items[index]!,original=base.input.items[index]!;
   if(!exact(item,['criterionId','testId','kind','environmentRef','sources'])||!code(item.criterionId)||ids.has(item.criterionId)||!code(item.testId)||!resultTestKinds.includes(item.kind as any)||!same(item.environmentRef,original.environmentRef)||!same(item.sources,original.sources))fail();
   ids.add(item.criterionId);
  }
  const input={assignmentRef:structuredClone(assignment.ref),baseRef:structuredClone(base.ref),items:structuredClone(items),reason};
  if(new TextEncoder().encode(ordered({assignment,input})).length>2*1024*1024)fail();
  return input;
 }catch{fail('RESULT_CRITERIA_BINDING_INVALID');}
}
export async function prepareCriteriaRevision(assignment:ConfirmedAssignmentView,base:RegisteredCriteria,items:CriteriaInput['items'],reason:string,session:DocumentSession,generation:number):Promise<CriteriaRegistration>{
 sessionBinding(session);if(!Number.isSafeInteger(generation)||generation<1)fail('RESULT_CRITERIA_BINDING_INVALID');
 const a=structuredClone(assignment),b=structuredClone(base),payload=await revisionInputFor(a,b,items,reason);
 return{ownerUserId:session.user.id,assignment:a,base:b,command:{schemaVersion:1,projectId:a.projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration:generation,operation:'saveResultCriteria',targetId:b.ref.id,expectedVersion:b.ref.version,baselineRefs:[],approvalRef:null,payload}};
}
function projection(a:ConfirmedAssignmentView,input:CriteriaInput){return{snapshot:{assignmentRef:input.assignmentRef,baselineRefs:a.snapshot.definition.baselineRefs,items:input.items.map(i=>({criterionId:i.criterionId,testId:i.testId,kind:i.kind,environmentRef:i.environmentRef,required:true as const}))},sourceBindings:input.items.map(i=>({criterionId:i.criterionId,sources:i.sources}))};}
async function validateView(v:RegisteredCriteria,p:CriteriaRegistration,r:PlanRef,registeredAt:string){
 const expected=projection(p.assignment,p.command.payload);
 if(!exact(v,['projectId','ref','snapshot','input','sourceBindings','createdBy','registeredAt','registryStored','reviewStored','completionAccepted','executionAuthorized','dispatchPerformed','observedAt'])||v.projectId!==p.command.projectId||!same(v.ref,r)||!same(v.snapshot,expected.snapshot)||!same(v.input,p.command.payload)||!same(v.sourceBindings,expected.sourceBindings)||v.createdBy!==p.ownerUserId||v.registeredAt!==registeredAt||!date(v.observedAt)||v.registryStored!==true||v.reviewStored!==false||v.completionAccepted!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false||await hash(v.snapshot)!==r.contentHash)fail('RESULT_CRITERIA_RESPONSE_INVALID');
}
/** 같은 pending 명령의 수동 재확인만 허용한다. 단절에 새 command ID를 자동 생성하지 않는다. */
export async function saveCriteriaRegistration(client:ApiClient,pending:CriteriaRegistration,session:DocumentSession,active:()=>boolean):Promise<RegisteredCriteria|null>{
 sessionBinding(session);const p=structuredClone(pending),c=p.command;
 if(p.ownerUserId!==session.user.id||!exact(c,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||c.schemaVersion!==1||!uuid(c.commandId)||c.clientId!==session.clientId||c.projectId!==p.assignment.projectId||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||c.operation!=='saveResultCriteria'||!same(c.baselineRefs,[])||c.approvalRef!==null||!exact(c.payload,['assignmentRef','baseRef','items','reason'])||!Array.isArray(c.payload.items))fail('RESULT_CRITERIA_BINDING_INVALID');
 if(c.payload.baseRef===null){
  if(c.targetId!==null||c.expectedVersion!==0||p.base!==undefined||c.payload.items.some(i=>!Array.isArray(i.sources)||i.sources.length!==1))fail('RESULT_CRITERIA_BINDING_INVALID');
  const rows=c.payload.items.map(i=>({field:i.sources[0]!.field,index:i.sources[0]!.index,criterionId:i.criterionId,testId:i.testId,kind:i.kind}));
  if(!same(c.payload,await inputFor(p.assignment,rows,c.payload.reason)))fail('RESULT_CRITERIA_BINDING_INVALID');
 }else{
  if(!p.base||!ref(c.payload.baseRef)||!same(c.payload.baseRef,p.base.ref)||c.targetId!==p.base.ref.id||c.expectedVersion!==p.base.ref.version||!same(c.payload,await revisionInputFor(p.assignment,p.base,c.payload.items,c.payload.reason)))fail('RESULT_CRITERIA_BINDING_INVALID');
 }
 if(!active())return null;
 let response:Response;try{response=await client.transport.call(globalThis,`/api/v1/projects/${c.projectId}/commands`,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json','Content-Type':'application/json','X-Anvil-CSRF':session.csrfToken,'Idempotency-Key':c.commandId},body:JSON.stringify(c)});}catch{throw new ApiError('CONNECTION_LOST');}
 if(!active())return null;let v:any;try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();v=await response.json();}catch{fail('RESULT_CRITERIA_RESPONSE_INVALID');}if(!response.ok)throw new ApiError(typeof v?.code==='string'&&/^[A-Z_]{1,80}$/.test(v.code)?v.code:'REQUEST_FAILED',response.status);
 const d=v?.data,expected=projection(p.assignment,c.payload);if(v?.commandId!==c.commandId||!uuid(v.operationId)||v.projectId!==c.projectId||v.status!=='APPLIED'||!date(v.serverReceivedAt)||!ref(d?.ref)||d.ref.version!==c.expectedVersion+1||v.targetId!==d.ref.id||v.version!==c.expectedVersion+1||c.targetId!==null&&d.ref.id!==c.targetId||!same(d,{ref:d.ref,status:'RESULT_CRITERIA_STORED',...expected,registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false})||await hash(expected.snapshot)!==d.ref.contentHash)fail('RESULT_CRITERIA_RESPONSE_INVALID');
 if(!active())return null;let value:RegisteredCriteria;
 try{value=await client.get<RegisteredCriteria>(`/api/v1/projects/${c.projectId}/result-criteria/${d.ref.id}/versions/${d.ref.version}`);}catch(cause){const error=cause instanceof ApiError?cause:new ApiError('RESULT_CRITERIA_RESPONSE_INVALID');throw new CriteriaReadbackUnconfirmed(error.code,error.status);}
 if(!active())return null;await validateView(value,p,d.ref,v.serverReceivedAt);return active()?structuredClone(value):null;
}
export interface StoredCriteriaSummary{ref:PlanRef;createdBy:string;registeredAt:string;conditionCount:number;registryStored:true;reviewStored:false;completionAccepted:false;executionAuthorized:false;dispatchPerformed:false}
export interface StoredCriteriaList{projectId:string;assignmentRef:PlanRef;items:StoredCriteriaSummary[];hasMore:boolean;selectionState:'NOT_SELECTED';observedAt:string}
const summary=(v:any)=>exact(v,['ref','createdBy','registeredAt','conditionCount','registryStored','reviewStored','completionAccepted','executionAuthorized','dispatchPerformed'])&&ref(v.ref)&&uuid(v.createdBy)&&date(v.registeredAt)&&Number.isSafeInteger(v.conditionCount)&&v.conditionCount>0&&v.conditionCount<=100&&v.registryStored===true&&v.reviewStored===false&&v.completionAccepted===false&&v.executionAuthorized===false&&v.dispatchPerformed===false;
async function storedAssignment(a:ConfirmedAssignmentView){if(!exact(a,['projectId','ref','snapshot','observedAt'])||!uuid(a.projectId)||!ref(a.ref)||!date(a.observedAt)||a.snapshot?.contentConfirmed!==true||a.snapshot.ready!==false||a.snapshot.executionAuthorized!==false||a.snapshot.dispatchPerformed!==false||await hash(a.snapshot)!==a.ref.contentHash)fail('RESULT_CRITERIA_RESPONSE_INVALID');}
/** 목록과 원문을 따로 명시 조회한다. 최근 버전은 활성/선택된 검수 기준이 아니다. */
export async function readStoredCriteriaList(client:ApiClient,assignment:ConfirmedAssignmentView,active:()=>boolean):Promise<StoredCriteriaList|null>{
 const a=structuredClone(assignment);await storedAssignment(a);if(!active())return null;const v=await client.get<StoredCriteriaList>(`/api/v1/projects/${a.projectId}/assignments/${a.ref.id}/versions/${a.ref.version}/result-criteria`);if(!active())return null;
 if(!exact(v,['projectId','assignmentRef','items','hasMore','selectionState','observedAt'])||v.projectId!==a.projectId||!same(v.assignmentRef,a.ref)||!Array.isArray(v.items)||v.items.length>20||typeof v.hasMore!=='boolean'||v.hasMore&&v.items.length!==20||v.selectionState!=='NOT_SELECTED'||!date(v.observedAt)||v.items.some(i=>!summary(i)||Date.parse(i.registeredAt)>Date.parse(v.observedAt))||new Set(v.items.map(i=>i.ref.id+':'+i.ref.version)).size!==v.items.length)fail('RESULT_CRITERIA_RESPONSE_INVALID');
 for(let i=1;i<v.items.length;i++){const p=v.items[i-1]!,n=v.items[i]!;if(p.registeredAt<n.registeredAt||p.registeredAt===n.registeredAt&&(p.ref.id<n.ref.id||p.ref.id===n.ref.id&&p.ref.version<=n.ref.version))fail('RESULT_CRITERIA_RESPONSE_INVALID');}
 return active()?structuredClone(v):null;
}
/** 읽기는 서버의 다중 source 매핑/이전 버전도 지원한다. 작성 UI의 1원조건=1행 제한을 강제하지 않는다. */
export async function readStoredCriteria(client:ApiClient,assignment:ConfirmedAssignmentView,item:StoredCriteriaSummary,active:()=>boolean):Promise<RegisteredCriteria|null>{
 const a=structuredClone(assignment),selected=structuredClone(item);await storedAssignment(a);if(!summary(selected))fail('RESULT_CRITERIA_RESPONSE_INVALID');if(!active())return null;
 const v=await client.get<RegisteredCriteria>(`/api/v1/projects/${a.projectId}/result-criteria/${selected.ref.id}/versions/${selected.ref.version}`);if(!active())return null;
 try{
  const d=a.snapshot.definition,input=v?.input;
  if(!exact(v,['projectId','ref','snapshot','input','sourceBindings','createdBy','registeredAt','registryStored','reviewStored','completionAccepted','executionAuthorized','dispatchPerformed','observedAt'])||v.projectId!==a.projectId||!same(v.ref,selected.ref)||v.createdBy!==selected.createdBy||v.registeredAt!==selected.registeredAt||!date(v.observedAt)||Date.parse(v.observedAt)<Date.parse(v.registeredAt)||v.registryStored!==true||v.reviewStored!==false||v.completionAccepted!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false||!exact(input,['assignmentRef','baseRef','items','reason'])||!same(input.assignmentRef,a.ref)||!Array.isArray(input.items)||input.items.length!==selected.conditionCount||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>20000||!ref(d.environmentRef)||!Array.isArray(d.baselineRefs)||!d.baselineRefs.length||!d.baselineRefs.every(ref)||new TextEncoder().encode(ordered({assignment:a,input})).length>2*1024*1024)fail('RESULT_CRITERIA_RESPONSE_INVALID');
  if(v.ref.version===1?input.baseRef!==null:!ref(input.baseRef)||input.baseRef.id!==v.ref.id||input.baseRef.version!==v.ref.version-1)fail('RESULT_CRITERIA_RESPONSE_INVALID');
  const ids=new Set<string>(),covered=new Set<string>();
  for(const i of input.items){if(!exact(i,['criterionId','testId','kind','environmentRef','sources'])||!code(i.criterionId)||ids.has(i.criterionId)||!code(i.testId)||!resultTestKinds.includes(i.kind as any)||!same(i.environmentRef,d.environmentRef)||!Array.isArray(i.sources)||!i.sources.length||i.sources.length>20)fail('RESULT_CRITERIA_RESPONSE_INVALID');ids.add(i.criterionId);const local=new Set<string>();
   for(const source of i.sources){if(!exact(source,['field','index','contentHash'])||!['acceptanceCriteria','verificationRequirements'].includes(source.field)||!Number.isSafeInteger(source.index)||source.index<0)fail('RESULT_CRITERIA_RESPONSE_INVALID');const key=source.field+':'+source.index,text=d[source.field]?.[source.index];if(local.has(key)||typeof text!=='string'||!text.trim()||text.length>20000||await hash(text)!==source.contentHash)fail('RESULT_CRITERIA_RESPONSE_INVALID');local.add(key);covered.add(key);}
  }
  for(const field of ['acceptanceCriteria','verificationRequirements'] as const){if(!Array.isArray(d[field])||!d[field].length)fail('RESULT_CRITERIA_RESPONSE_INVALID');for(let index=0;index<d[field].length;index++)if(!covered.has(field+':'+index))fail('RESULT_CRITERIA_RESPONSE_INVALID');}
  const expected=projection(a,input);if(!same(v.snapshot,expected.snapshot)||!same(v.sourceBindings,expected.sourceBindings)||await hash(v.snapshot)!==selected.ref.contentHash)fail('RESULT_CRITERIA_RESPONSE_INVALID');
 }catch(cause){if(cause instanceof ApiError)throw cause;fail('RESULT_CRITERIA_RESPONSE_INVALID');}
 return active()?structuredClone(v):null;
}
