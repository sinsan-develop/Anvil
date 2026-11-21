import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {documentControl,type DocumentSession} from '../design-trace/editor-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {PreparationRecord} from './responsible-session-api.ts';

const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const version=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const ref=(v:unknown):v is PlanRef=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&version(v.version)&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
const instant=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v);
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
const denied=new Set(['AUTH_REQUIRED','CSRF_INVALID','PERMISSION_POLICY_UNCONFIGURED','PROJECT_OPERATION_DENIED','PROJECT_CONTROL_REQUIRED','CONTROL_GENERATION_CONFLICT','PROJECT_WRITE_DENIED','PROJECT_ARCHIVED','NORMAL_UNDERSTANDING_REQUEST_INVALID','REAUTHENTICATION_REQUIRED','INPUT_INVALID']);

type Scope={projectId:string;executionId:string;executionGeneration:number;assignmentRef:PlanRef;preparationRef:PlanRef;observedAt:string;expiresAt:string};
type Basis={scope:Scope;controlGeneration:number;clientId:string};
type Command={schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;operation:'readNormalUnderstandingResponse';targetId:string;expectedVersion:number;baselineRefs:[];approvalRef:null;payload:{assignmentRef:PlanRef;preparationRef:PlanRef}};
type Retained={command:Command;body:string;state:'SENDING'|'UNKNOWN'|'DENIED'|'PENDING_SOURCE';code?:string;requestRef?:PlanRef};
type Props={client:ApiClient;session:DocumentSession;projectId:string;assignmentRef:PlanRef;preparations:PreparationRecord[];busy:boolean};
type SessionRecords={csrf:string;userId:string;clientId:string;commands:Map<string,Retained>};
const clientRecords=new WeakMap<ApiClient,WeakMap<typeof fetch,SessionRecords[]>>();

// /session refreshes its projection without changing the cookie-derived CSRF. A login or
// reauthentication changes clientId or CSRF and must never inherit an earlier command.
export function normalUnderstandingRecords(session:DocumentSession,client:ApiClient){
 let transports=clientRecords.get(client);
 if(!transports){transports=new WeakMap();clientRecords.set(client,transports);}
 let owners=transports.get(client.transport);
 if(!owners){owners=[];transports.set(client.transport,owners);}
 const {csrfToken:csrf,clientId}=session,userId=session.user.id;
 const existing=owners.find(owner=>owner.userId===userId&&owner.clientId===clientId&&owner.csrf===csrf);
 if(existing)return existing.commands;
 const commands=new Map<string,Retained>();owners.push({csrf,userId,clientId,commands});
 return commands;
}

function channel(client:ApiClient,session:DocumentSession,signal:AbortSignal,active:()=>boolean){
 const transport=client.transport,{csrfToken:csrf,clientId}=session,userId=session.user.id;
 const check=()=>{if(signal.aborted||!active()||client.transport!==transport||session.csrfToken!==csrf||session.clientId!==clientId||session.user.id!==userId)throw new ApiError('DISCOVERY_SCOPE_CHANGED');};
 check();if(!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new ApiError('AUTH_REQUIRED',401);
 return {check,transport,csrf};
}

async function wire(owner:ReturnType<typeof channel>,path:string,signal:AbortSignal,body?:string){
 owner.check();
 const headers:Record<string,string>={Accept:'application/json','X-Anvil-CSRF':owner.csrf};
 if(body!==undefined)headers['Content-Type']='application/json';
 let response:Response;
 try{response=await owner.transport.call(globalThis,path,{method:body===undefined?'GET':'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers,signal,body});}
 catch{owner.check();throw new ApiError('CONNECTION_LOST');}
 owner.check();
 let value:unknown;
 try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();value=await response.json();}
 catch{owner.check();throw new ApiError('RESPONSE_INVALID',response.status);}
 owner.check();
 if(!response.ok){const body=value as {code?:unknown}|null;throw new ApiError(typeof body?.code==='string'&&/^[A-Z_]{1,64}$/.test(body.code)?body.code:'REQUEST_FAILED',response.status);}
 return value;
}

export async function readNormalUnderstandingBasis(client:ApiClient,session:DocumentSession,projectId:string,assignmentRef:PlanRef,preparationRef:PlanRef,signal:AbortSignal,active=()=>true):Promise<Basis>{
 if(!uuid(projectId)||!uuid(session.clientId)||!ref(assignmentRef)||!ref(preparationRef)||signal.aborted)throw new ApiError('INPUT_INVALID',422);
 const owner=channel(client,session,signal,active),assignment=structuredClone(assignmentRef),preparation=structuredClone(preparationRef);
 const controlGeneration=await documentControl(new ApiClient(owner.transport),projectId,session).catch(error=>{owner.check();throw error;});owner.check();
 if(!same(assignment,assignmentRef)||!same(preparation,preparationRef))throw new ApiError('DISCOVERY_SCOPE_CHANGED');
 const query=new URLSearchParams({controlGeneration:String(controlGeneration),assignmentId:assignment.id,assignmentVersion:String(assignment.version),assignmentHash:assignment.contentHash,
  preparationId:preparation.id,preparationVersion:String(preparation.version),preparationHash:preparation.contentHash});
 const v=await wire(owner,`/api/v1/projects/${projectId}/understanding-response-readiness?${query}`,signal);
 if(!exact(v,['projectId','executionId','executionGeneration','assignmentRef','preparationRef','observedAt','expiresAt'])||v.projectId!==projectId
  ||!uuid(v.executionId)||!version(v.executionGeneration)||!ref(v.assignmentRef)||!ref(v.preparationRef)||!same(v.assignmentRef,assignment)||!same(v.preparationRef,preparation)
  ||!instant(v.observedAt)||!instant(v.expiresAt)||Date.parse(v.observedAt)>=Date.parse(v.expiresAt)||Date.parse(v.expiresAt)<=Date.now()||signal.aborted)throw new ApiError('RESPONSE_INVALID');
 return {scope:{projectId,executionId:v.executionId,executionGeneration:v.executionGeneration,assignmentRef:v.assignmentRef,preparationRef:v.preparationRef,observedAt:v.observedAt,expiresAt:v.expiresAt},controlGeneration,clientId:session.clientId};
}

export function prepareNormalUnderstandingCommand(basis:Basis):Command{
 const {scope,clientId,controlGeneration}=basis;
 if(!instant(scope.expiresAt)||Date.parse(scope.expiresAt)<=Date.now())throw new ApiError('NORMAL_UNDERSTANDING_READINESS_UNAVAILABLE',412);
 return {schemaVersion:1,projectId:scope.projectId,commandId:crypto.randomUUID(),clientId,controlGeneration,operation:'readNormalUnderstandingResponse',
  targetId:scope.executionId,expectedVersion:scope.executionGeneration,baselineRefs:[],approvalRef:null,payload:structuredClone({assignmentRef:scope.assignmentRef,preparationRef:scope.preparationRef})};
}

export async function sendNormalUnderstandingCommand(client:ApiClient,session:DocumentSession,command:Command,body:string,signal:AbortSignal,active=()=>true){
 if(command.clientId!==session.clientId||JSON.stringify(command)!==body||!uuid(command.projectId)||!uuid(command.targetId)||!uuid(command.commandId))throw new ApiError('INPUT_INVALID',422);
 const owner=channel(client,session,signal,active);
 const v=await wire(owner,`/api/v1/projects/${command.projectId}/executions/${command.targetId}/understanding-response-read-requests`,signal,body);
 if(!exact(v,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||!uuid(v.operationId)
  ||v.commandId!==command.commandId||v.projectId!==command.projectId||v.status!=='APPLIED'||!instant(v.serverReceivedAt)
  ||!Array.isArray(v.evidenceRefs)||v.evidenceRefs.length||!Array.isArray(v.warnings)||v.warnings.length
  ||!exact(v.data,['ref','status','requestRef','state','sourceAvailable','selectionAvailable','expiresAt'])||v.data.status!=='NORMAL_UNDERSTANDING_METADATA_REQUESTED'
  ||!ref(v.data.requestRef)||v.data.requestRef.version!==1||v.targetId!==v.data.requestRef.id||v.version!==1||!same(v.data.ref,v.data.requestRef)
  ||!instant(v.data.expiresAt)||Date.parse(v.data.expiresAt)<=Date.parse(v.serverReceivedAt)||v.data.state!=='PENDING_SOURCE'||v.data.sourceAvailable!==false||v.data.selectionAvailable!==false)throw new ApiError('RESPONSE_INVALID');
 return v.data.requestRef;
}

export function NormalUnderstandingDiscovery({client,session,projectId,assignmentRef,preparations,busy}:Props){
 const [selection,setSelection]=useState(''),[basis,setBasis]=useState<Basis|null>(null),[notice,setNotice]=useState(''),[working,setWorking]=useState(false),[,render]=useState(0);
 const local=normalUnderstandingRecords(session,client),key=ordered([projectId,assignmentRef,session.user.id,session.clientId]);
 const scope=useRef({key,records:local}),flight=useRef<AbortController|null>(null);
 if(scope.current.key!==key||scope.current.records!==local)scope.current={key,records:local};
 const owner=scope.current;
 const active=(operation:AbortController)=>scope.current===owner&&normalUnderstandingRecords(session,client)===owner.records&&!operation.signal.aborted;
 useEffect(()=>{setSelection('');setBasis(null);setNotice('');setWorking(false);return()=>{flight.current?.abort();flight.current=null;};},[owner]);
 const available=preparations.filter(p=>p.projectId===projectId&&p.snapshot.intent?.mode==='CONTEXT_REVIEW'&&p.snapshot.intent?.connectionKind==='REGISTERED_DEFINITION'&&same(p.snapshot.intent?.assignmentRef,assignmentRef));
 const selected=available.find(p=>ordered(p.ref)===selection);
 const recordsForAssignment=[...local.entries()].filter(([,record])=>record.command.projectId===projectId&&same(record.command.payload.assignmentRef,assignmentRef));
 const picked=useRef<PlanRef|null>(null);picked.current=selected?.ref??null;
 const current=basis&&selected&&same(basis.scope.assignmentRef,assignmentRef)&&same(basis.scope.preparationRef,selected.ref)?basis:null;
 const selectedKey=current?ordered([key,current.scope.preparationRef,current.scope.executionId,current.scope.executionGeneration]):null;
 const kept=selectedKey===null?undefined:local.get(selectedKey);
 async function run(work:(operation:AbortController)=>Promise<void>){
  if(flight.current||busy||scope.current!==owner)return;
  const operation=new AbortController();flight.current=operation;setWorking(true);setNotice('');
  try{await work(operation);}catch(cause){if(active(operation)&&(!(cause instanceof ApiError)||cause.code!=='DISCOVERY_SCOPE_CHANGED'))setNotice(cause instanceof ApiError?cause.code:'RESPONSE_INVALID');}
  finally{if(flight.current===operation)flight.current=null;if(active(operation)){setWorking(false);render(value=>value+1);}}
 }
 async function check(){if(!selected)return;setBasis(null);await run(async operation=>{
  const expected=structuredClone(selected.ref),isCurrent=()=>active(operation)&&same(picked.current,expected);
  const value=await readNormalUnderstandingBasis(client,session,projectId,assignmentRef,expected,operation.signal,isCurrent);
  if(isCurrent())setBasis(value);
 });}
 async function submit(recoveryKey?:string){
  await run(async operation=>{
   const writeKey=recoveryKey??selectedKey;if(writeKey===null)return;
   const saved=local.get(writeKey);
   if(recoveryKey?saved?.state!=='UNKNOWN':!current||!!saved)return;
   const command=saved?.command??prepareNormalUnderstandingCommand(current!);
   const body=saved?.body??JSON.stringify(command);
   const isCurrent=()=>active(operation)&&(!!recoveryKey||same(picked.current,command.payload.preparationRef));
   if(!isCurrent())return;
   const pending:Retained={command,body,state:'SENDING'};local.set(writeKey,pending);
   try{
    const requestRef=await sendNormalUnderstandingCommand(client,session,command,body,operation.signal,isCurrent);
    local.set(writeKey,isCurrent()?{...pending,state:'PENDING_SOURCE',requestRef}:{...pending,state:'UNKNOWN'});
   }catch(cause){
    const error=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');
    local.set(writeKey,{...pending,state:!recoveryKey&&error.status>=400&&error.status<500&&denied.has(error.code)?'DENIED':'UNKNOWN',code:error.code});
   }
  });
 }
 if(!available.length&&!recordsForAssignment.length)return null;
 return <section aria-label="최초 이해 자료 탐색"><h6>최초 이해 자료 탐색</h6>
  <fieldset disabled={busy||working}><legend>등록 실행 준비 선택</legend>
   <select aria-label="이해 자료 탐색 준비" value={selection} onChange={event=>{setSelection(event.target.value);setBasis(null);setNotice('');}}>
    <option value="">실행 준비 선택</option>{available.map(p=><option key={ordered(p.ref)} value={ordered(p.ref)}>준비 {p.ref.id} · v{p.ref.version}</option>)}
   </select>
   <button type="button" disabled={!selected} onClick={()=>void check()}>탐색 근거 확인</button>
   {current&&!kept?<><p>실행 {current.scope.executionId} · 세대 {current.scope.executionGeneration} · 확인 기한 {current.scope.expiresAt}</p>
    <button type="button" onClick={()=>void submit()}>최초 이해 자료 탐색 요청</button></>:null}
  </fieldset>
  {notice?<p role="alert">탐색 근거 확인 불가 · {notice}</p>:null}
  {recordsForAssignment.length?<ul>{recordsForAssignment.map(([writeKey,record])=><li key={writeKey}>
   <p>준비 {record.command.payload.preparationRef.id} · 실행 {record.command.targetId} · 세대 {record.command.expectedVersion}</p>
   {record.state==='PENDING_SOURCE'?<p role="status">탐색 요청 보관 · 자료 대기 · {record.requestRef?.id}</p>:null}
   {record.state==='DENIED'?<><p role="alert">탐색 요청 거절 · {record.code}</p>
    <button type="button" disabled={busy||working} onClick={()=>{if(local.get(writeKey)!==record)return;local.delete(writeKey);setBasis(null);render(value=>value+1);}}>거절 확인 후 다시 선택</button></>:null}
   {record.state==='UNKNOWN'?<><p role="status">요청 결과 불명 · 원 명령 보존 · {record.command.commandId}</p>
    <button type="button" disabled={busy||working} onClick={()=>void submit(writeKey)}>같은 탐색 명령 결과 확인</button></>:null}
   {record.state==='SENDING'?<p role="status">원 명령 결과 확인 중</p>:null}
  </li>)}</ul>:null}
  {working?<p role="status">확인 중</p>:null}
 </section>;
}
