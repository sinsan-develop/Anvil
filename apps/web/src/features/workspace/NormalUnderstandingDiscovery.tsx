import {NormalUnderstandingRangeHistory} from './NormalUnderstandingRangeHistory.tsx';
import {NormalInitialUnderstandingReview} from './NormalInitialUnderstandingReview.tsx';
import type {NormalInitialUnderstandingReviewStorage} from '../session-detail/understanding-review-write.ts';
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
const metadataAuthStatuses=new Map([['AUTH_REQUIRED',401],['CSRF_INVALID',403],['REAUTHENTICATION_REQUIRED',412]]);
const metadataCurrentStatuses=new Map([['PROJECT_OPERATION_DENIED',403],['PROJECT_WRITE_DENIED',403],['PROJECT_CONTROL_REQUIRED',403],
 ['CONTROL_GENERATION_CONFLICT',409],['PROJECT_ARCHIVED',412],['PERMISSION_POLICY_UNCONFIGURED',412],['NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED',412]]);

type Scope={projectId:string;executionId:string;executionGeneration:number;assignmentRef:PlanRef;preparationRef:PlanRef;observedAt:string;expiresAt:string};
type Basis={scope:Scope;controlGeneration:number;clientId:string};
type Command={schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;operation:'readNormalUnderstandingResponse';targetId:string;expectedVersion:number;baselineRefs:[];approvalRef:null;payload:{assignmentRef:PlanRef;preparationRef:PlanRef}};
type Retained={command:Command;body:string;state:'SENDING'|'UNKNOWN'|'DENIED'|'PENDING_SOURCE';code?:string;requestRef?:PlanRef};
export type NormalUnderstandingMetadataRequest=Pick<Scope,'projectId'|'executionId'|'executionGeneration'|'assignmentRef'|'preparationRef'>&{requestRef:PlanRef};
type MetadataRange={outputRef:PlanRef;sequence:number;payloadDigest:string;textBlocks:number;textBytes:number};
export type NormalUnderstandingMetadataResult=
 | {status:'PENDING_SOURCE'|'CURRENT_UNAVAILABLE';request:NormalUnderstandingMetadataRequest}
 | {status:'METADATA_STORED';request:NormalUnderstandingMetadataRequest;resultRef:PlanRef;currentness:'CURRENT';observedAt:string;expiresAt:string;
    metadata:{contextBundleRef:PlanRef;initConfirmationRef:PlanRef;tailRef:PlanRef;attribution:'SESSION_ONLY';wholeConversationComplete:false;ranges:MetadataRange[]};selectionAvailable:false};
export type NormalUnderstandingMetadataReader=(request:Readonly<NormalUnderstandingMetadataRequest>,signal:AbortSignal)=>Promise<NormalUnderstandingMetadataResult>;
type StoredMetadata=Extract<NormalUnderstandingMetadataResult,{status:'METADATA_STORED'}>;
export type NormalUnderstandingRangeDraft=Readonly<{
 request:NormalUnderstandingMetadataRequest;resultRef:PlanRef;contextBundleRef:PlanRef;
 initConfirmationRef:PlanRef;tailRef:PlanRef;firstSequence:number;lastSequence:number;ranges:ReadonlyArray<Readonly<MetadataRange>>;
}>;
type RangeSelection=Pick<NormalUnderstandingRangeDraft,'resultRef'|'initConfirmationRef'|'tailRef'|'firstSequence'|'lastSequence'|'ranges'>&{requestRef:PlanRef};
type RangeCommand=Omit<Command,'payload'>&{payload:Command['payload']&{selection:RangeSelection}};
type RangeRetained={command:RangeCommand;body:string;state:'SENDING'|'UNKNOWN'|'PENDING_SOURCE';requestRef?:PlanRef;expiresAt?:string};
export type NormalUnderstandingRangeRequester=(draft:NormalUnderstandingRangeDraft,signal:AbortSignal,active:()=>boolean)=>Promise<PlanRef|void>;
export type NormalUnderstandingRangeRecovery=(key:string,signal:AbortSignal)=>Promise<PlanRef|void>;
/** expiresAt은 원 요청의 전달 기한이다. 정착 BODY의 새 조회 기한은 각 명시 호출에서 따로 고정한다. */
export type NormalUnderstandingRangeReadRequest={request:NormalUnderstandingMetadataRequest;controlGeneration:number;expiresAt:string;selection:RangeSelection};
type RangePart={outputRef:PlanRef;sequence:number;payloadDigest:string;blockIndex:number;kind:'ASSISTANT_TEXT';text:string;textHash:string};
export type NormalUnderstandingRangeResult=
 | {status:'PENDING_SOURCE'|'CURRENT_UNAVAILABLE';request:NormalUnderstandingMetadataRequest}
 | {status:'RANGE_STORED';request:NormalUnderstandingMetadataRequest;resultRef:PlanRef;responseRef:PlanRef;partRefs:PlanRef[];currentness:'CURRENT';observedAt:string;expiresAt:string;selectionAvailable:true;
    body:{schemaVersion:1;kind:'FIXED_RANGE_SELECTION';attribution:'SESSION_ONLY';projectId:string;executionId:string;executionGeneration:number;requestRef:PlanRef;acquisitionRef:PlanRef;sourceRequestRef:PlanRef;sourceResultRef:PlanRef;contextBundleRef:PlanRef;initConfirmationRef:PlanRef;tailRef:PlanRef;firstSequence:number;lastSequence:number;beforeRef:PlanRef|null;afterRef:PlanRef|null;parts:RangePart[];wholeConversationComplete:false;executionAuthorized:false}};
export type NormalUnderstandingRangeReader=(request:Readonly<NormalUnderstandingRangeReadRequest>,signal:AbortSignal)=>Promise<NormalUnderstandingRangeResult>;
export type NormalUnderstandingRangeHistoryResult={status:'RANGE_STORED_HISTORICAL';requestRef:PlanRef;resultRef:PlanRef;responseRef:PlanRef;partRefs:PlanRef[];currentness:'NOT_RECHECKED';observedAt:string;expiresAt:string;selectionAvailable:false;reviewAvailable:false;executionAuthorized:false;dispatchPerformed:false;body:Extract<NormalUnderstandingRangeResult,{status:'RANGE_STORED'}>['body']};
export type NormalUnderstandingRangeHistoryReader=(request:Readonly<NormalUnderstandingRangeReadRequest>,signal:AbortSignal)=>Promise<NormalUnderstandingRangeHistoryResult>;
type Props={reviewStorage?:NormalInitialUnderstandingReviewStorage;client:ApiClient;session:DocumentSession;projectId:string;assignmentRef:PlanRef;preparations:PreparationRecord[];busy:boolean;
 metadataReader?:NormalUnderstandingMetadataReader;rangeRequester?:NormalUnderstandingRangeRequester;rangeRecovery?:NormalUnderstandingRangeRecovery;rangeReader?:NormalUnderstandingRangeReader;rangeHistoryReader?:NormalUnderstandingRangeHistoryReader};
type SessionRecords={csrf:string;userId:string;clientId:string;commands:Map<string,Retained>};
const clientRecords=new WeakMap<ApiClient,WeakMap<typeof fetch,SessionRecords[]>>();
const ownerRangeRecords=new WeakMap<Map<string,Retained>,{records:Map<string,RangeRetained>;checkingControl:Set<string>}>();

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
function rangeLedger(session:DocumentSession,client:ApiClient){
 const owner=normalUnderstandingRecords(session,client);
 let ledger=ownerRangeRecords.get(owner);
 if(!ledger){ledger={records:new Map(),checkingControl:new Set()};ownerRangeRecords.set(owner,ledger);}
 return ledger;
}
const hasRangeRequest=(records:Map<string,RangeRetained>,scope:NormalUnderstandingMetadataRequest)=>[...records.values()].some(({command})=>
 command.projectId===scope.projectId&&command.targetId===scope.executionId&&command.expectedVersion===scope.executionGeneration);

function channel(client:ApiClient,session:DocumentSession,signal:AbortSignal,active:()=>boolean){
 const transport=client.transport,{csrfToken:csrf,clientId}=session,userId=session.user.id;
 const check=()=>{if(signal.aborted||!active()||client.transport!==transport||session.csrfToken!==csrf||session.clientId!==clientId||session.user.id!==userId)throw new ApiError('DISCOVERY_SCOPE_CHANGED');};
 check();if(!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new ApiError('AUTH_REQUIRED',401);
 return {check,transport,csrf};
}

async function boundedRangeJson(response:Response,check:()=>void,signal:AbortSignal){
 if(!response.body)throw Error();const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,bytes:Uint8Array|undefined;
 let cancelled=false;
 const abort=()=>{if(cancelled)return;cancelled=true;try{void reader.cancel().catch(()=>{});}catch{}};signal.addEventListener('abort',abort,{once:true});
 try{
  while(true){check();const r=await reader.read();try{check();}catch(error){if(!r.done)r.value.fill(0);throw error;}if(r.done)break;chunks.push(r.value);size+=r.value.byteLength;if(size>2097152)throw Error();}
  check();
  bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  check();const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);check();
  const value:unknown=JSON.parse(raw),stack:{keys:Set<string>|null;key:boolean}[]=[];
  for(const token of raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[]){
   if(token==='{'||token==='[')stack.push({keys:token==='{'?new Set():null,key:token==='{'});else if(token==='}'||token===']')stack.pop();else{
    const frame=stack.at(-1);if(!frame?.keys)continue;if(token===',')frame.key=true;else if(token===':')frame.key=false;else if(frame.key&&token.startsWith('"')){const k=JSON.parse(token);if(frame.keys.has(k))throw Error();frame.keys.add(k);}
   }
  }
  check();return value;
 }finally{
  signal.removeEventListener('abort',abort);try{abort();reader.releaseLock();}finally{bytes?.fill(0);for(const chunk of chunks)chunk.fill(0);}
 }
}
async function wire(owner:ReturnType<typeof channel>,path:string,signal:AbortSignal,body?:string,bounded=false,rangeCheck?:()=>void){
 const check=rangeCheck??owner.check;check();
 const headers:Record<string,string>={Accept:'application/json','X-Anvil-CSRF':owner.csrf};
 if(body!==undefined)headers['Content-Type']='application/json';
 let response:Response;
 try{response=await owner.transport.call(globalThis,path,{method:body===undefined?'GET':'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers,signal,body});}
 catch{check();throw new ApiError('CONNECTION_LOST');}
 const cancel=()=>{if(bounded)try{void response.body?.cancel().catch(()=>{});}catch{}};
 try{check();}catch(error){cancel();throw error;}
 let value:unknown;
 try{if(!/^application\/json\b/i.test(response.headers.get('content-type')??''))throw Error();value=bounded?await boundedRangeJson(response,check,signal):await response.json();}
 catch{cancel();check();throw new ApiError('RESPONSE_INVALID',response.status);}
 check();
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

async function sendUnderstandingCommandReceipt(client:ApiClient,session:DocumentSession,command:Command|RangeCommand,body:string,signal:AbortSignal,active:()=>boolean){
 if(command.clientId!==session.clientId||JSON.stringify(command)!==body||!uuid(command.projectId)||!uuid(command.targetId)||!uuid(command.commandId))throw new ApiError('INPUT_INVALID',422);
 const owner=channel(client,session,signal,active);
 const v=await wire(owner,`/api/v1/projects/${command.projectId}/executions/${command.targetId}/understanding-response-read-requests`,signal,body);
 if(!exact(v,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||!uuid(v.operationId)
  ||v.commandId!==command.commandId||v.projectId!==command.projectId||v.status!=='APPLIED'||!instant(v.serverReceivedAt)
  ||!Array.isArray(v.evidenceRefs)||v.evidenceRefs.length||!Array.isArray(v.warnings)||v.warnings.length
  ||!exact(v.data,['ref','status','requestRef','state','sourceAvailable','selectionAvailable','expiresAt'])
  ||v.data.status!==('selection' in command.payload?'NORMAL_UNDERSTANDING_RANGE_REQUESTED':'NORMAL_UNDERSTANDING_METADATA_REQUESTED')
  ||!ref(v.data.requestRef)||v.data.requestRef.version!==1||v.targetId!==v.data.requestRef.id||v.version!==1||!same(v.data.ref,v.data.requestRef)
  ||'selection' in command.payload&&v.data.requestRef.id===command.payload.selection.requestRef.id
  ||!instant(v.data.expiresAt)||Date.parse(v.data.expiresAt)<=Date.parse(v.serverReceivedAt)||v.data.state!=='PENDING_SOURCE'||v.data.sourceAvailable!==false||v.data.selectionAvailable!==false)throw new ApiError('RESPONSE_INVALID');
 return {requestRef:v.data.requestRef,expiresAt:v.data.expiresAt};
}
export async function sendNormalUnderstandingCommand(client:ApiClient,session:DocumentSession,command:Command,body:string,signal:AbortSignal,active=()=>true){
 return (await sendUnderstandingCommandReceipt(client,session,command,body,signal,active)).requestRef;
}

export function createNormalUnderstandingRangeCommands(client:ApiClient,session:DocumentSession,projectId:string,assignmentKey:string,active:()=>boolean){
 const ledger=rangeLedger(session,client),{records:retained,checkingControl}=ledger;
 const activeOwner=()=>active()&&rangeLedger(session,client)===ledger;
 const isAssignment=(command:RangeCommand)=>command.projectId===projectId&&ordered(command.payload.assignmentRef)===assignmentKey;
 const readControl=(signal:AbortSignal,current:()=>boolean)=>{
  const owner=channel(client,session,signal,current);
  return documentControl(new ApiClient((input,options)=>{
   owner.check();return owner.transport.call(globalThis,input,{...options,signal});
  }),projectId,session);
 };
 async function transmit(key:string,pending:RangeRetained,signal:AbortSignal,current:()=>boolean){
  const withOwner=()=>activeOwner()&&current()&&!signal.aborted&&retained.get(key)===pending;
  try{
   const {requestRef,expiresAt}=await sendUnderstandingCommandReceipt(client,session,pending.command,pending.body,signal,withOwner);
   if(!withOwner())throw new ApiError('CONNECTION_LOST');
   retained.set(key,{...pending,state:'PENDING_SOURCE',requestRef,expiresAt});return requestRef;
  }catch(error){
   if(retained.get(key)===pending)retained.set(key,{...pending,state:'UNKNOWN'});
   throw error;
  }
 }
 const request:NormalUnderstandingRangeRequester=async(draft,signal,selectionCurrent)=>{
  const {request:origin,resultRef,initConfirmationRef,tailRef,firstSequence,lastSequence,ranges}=structuredClone(draft);
  const current=()=>activeOwner()&&selectionCurrent()&&!signal.aborted;
  if(!current()||origin.projectId!==projectId||ordered(origin.assignmentRef)!==assignmentKey)throw new ApiError('DISCOVERY_SCOPE_CHANGED');
  const payload={assignmentRef:origin.assignmentRef,preparationRef:origin.preparationRef,
   selection:{requestRef:origin.requestRef,resultRef,initConfirmationRef,tailRef,firstSequence,lastSequence,ranges}};
  const key=ordered([origin.projectId,origin.executionId,origin.executionGeneration,payload]);
  const previous=retained.get(key);
  if(previous?.state==='PENDING_SOURCE')return structuredClone(previous.requestRef);
  const scopeKey=ordered([origin.projectId,origin.executionId,origin.executionGeneration]);
  if(checkingControl.has(scopeKey)||hasRangeRequest(retained,origin))throw new ApiError('NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED');
  checkingControl.add(scopeKey);
  try{
   const controlGeneration=await readControl(signal,current);
   if(!current())throw new ApiError('DISCOVERY_SCOPE_CHANGED');
   if(hasRangeRequest(retained,origin))throw new ApiError('NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED');
   const command:RangeCommand={schemaVersion:1,projectId,commandId:crypto.randomUUID(),clientId:session.clientId,controlGeneration,
    operation:'readNormalUnderstandingResponse',targetId:origin.executionId,expectedVersion:origin.executionGeneration,baselineRefs:[],approvalRef:null,payload};
   const pending:RangeRetained={command,body:JSON.stringify(command),state:'SENDING'};
   retained.set(key,pending);
   return await transmit(key,pending,signal,selectionCurrent);
  }finally{checkingControl.delete(scopeKey);}
 };
 const recover:NormalUnderstandingRangeRecovery=async(key,signal)=>{
  const saved=retained.get(key);
  if(!activeOwner()||!saved||saved.state!=='UNKNOWN'||!isAssignment(saved.command))throw new ApiError('DISCOVERY_SCOPE_CHANGED');
  const generation=await readControl(signal,activeOwner);
  if(!activeOwner()||signal.aborted||retained.get(key)!==saved)throw new ApiError('DISCOVERY_SCOPE_CHANGED');
  if(generation!==saved.command.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
  const pending:RangeRetained={...saved,state:'SENDING'};
  retained.set(key,pending);
  return transmit(key,pending,signal,activeOwner);
 };
 return {request,recover};
}

function currentMetadata(value:NormalUnderstandingMetadataResult,request:NormalUnderstandingMetadataRequest):NormalUnderstandingMetadataResult{
 const invalid=()=>{throw new ApiError('RESPONSE_INVALID');};
 if(!value||!same(value.request,request))return invalid();
 if(value.status==='PENDING_SOURCE'||value.status==='CURRENT_UNAVAILABLE'){
  if(!exact(value,['status','request']))return invalid();
  return {status:value.status,request};
 }
 if(value.status!=='METADATA_STORED'||!exact(value,['status','request','resultRef','currentness','observedAt','expiresAt','metadata','selectionAvailable'])
    ||value.currentness!=='CURRENT'||value.selectionAvailable!==false||!ref(value.resultRef)||value.resultRef.version!==1||
    !instant(value.observedAt)||!instant(value.expiresAt)||Date.parse(value.expiresAt)<=Math.max(Date.now(),Date.parse(value.observedAt)))return invalid();
 const m=value.metadata;
 if(!exact(m,['contextBundleRef','initConfirmationRef','tailRef','attribution','wholeConversationComplete','ranges'])||
    !ref(m.contextBundleRef)||!ref(m.initConfirmationRef)||!ref(m.tailRef)||m.initConfirmationRef.version!==1||m.tailRef.version!==1||
    m.attribution!=='SESSION_ONLY'||m.wholeConversationComplete!==false||!Array.isArray(m.ranges)||m.ranges.length>200)return invalid();
 if(m.initConfirmationRef.id===m.tailRef.id&&(!same(m.initConfirmationRef,m.tailRef)||m.ranges.length!==0))return invalid();
 let sequence=0,blocks=0;const outputs=new Set<string>();
 for(const range of m.ranges){
  if(!exact(range,['outputRef','sequence','payloadDigest','textBlocks','textBytes'])||!ref(range.outputRef)||range.outputRef.version!==1||
     outputs.has(range.outputRef.id)||range.outputRef.id===m.initConfirmationRef.id||
     range.outputRef.id===m.tailRef.id&&(!same(range.outputRef,m.tailRef)||range!==m.ranges.at(-1))||
     !version(range.sequence)||range.sequence<=sequence||range.sequence>10000||
     typeof range.payloadDigest!=='string'||!/^[a-f0-9]{64}$/.test(range.payloadDigest)||
     !version(range.textBlocks)||(blocks+=range.textBlocks)>200||!version(range.textBytes)||range.textBytes>2*1024*1024)return invalid();
  outputs.add(range.outputRef.id);sequence=range.sequence;
 }
 return structuredClone(value);
}

export async function readNormalUnderstandingMetadata(client:ApiClient,session:DocumentSession,request:NormalUnderstandingMetadataRequest,signal:AbortSignal,active:()=>boolean):Promise<NormalUnderstandingMetadataResult>{
 const expected=structuredClone(request),{projectId,executionId,executionGeneration,requestRef,assignmentRef,preparationRef}=expected;
 if(!uuid(projectId)||!uuid(executionId)||!uuid(session.clientId)||!version(executionGeneration)||!ref(requestRef)||requestRef.version!==1||
    !ref(assignmentRef)||!ref(preparationRef))throw new ApiError('INPUT_INVALID',422);
 const owner=channel(client,session,signal,active);
 const controlClient=new ApiClient((input,options)=>{
  owner.check();
  return owner.transport.call(globalThis,input,{...options,signal});
 });
 const check=()=>{owner.check();if(!same(expected,request))throw new ApiError('DISCOVERY_SCOPE_CHANGED');};
 try{
  const controlGeneration=await documentControl(controlClient,projectId,session);check();
  const query=new URLSearchParams({
   controlGeneration:String(controlGeneration),executionGeneration:String(executionGeneration),requestVersion:String(requestRef.version),requestHash:requestRef.contentHash,
   assignmentId:assignmentRef.id,assignmentVersion:String(assignmentRef.version),assignmentHash:assignmentRef.contentHash,
   preparationId:preparationRef.id,preparationVersion:String(preparationRef.version),preparationHash:preparationRef.contentHash
  }).toString();
  if(query.length>1024)throw new ApiError('INPUT_INVALID',422);
  const response=await wire(owner,`/api/v1/projects/${projectId}/executions/${executionId}/understanding-response-read-requests/${requestRef.id}/current?${query}`,signal);
  check();return currentMetadata(response as NormalUnderstandingMetadataResult,expected);
 }catch(error){
  check();
  if(error instanceof ApiError&&metadataCurrentStatuses.get(error.code)===error.status){
   return {status:'CURRENT_UNAVAILABLE',request:expected};
  }
  throw error;
 }
}

function rangeReadInput(raw:NormalUnderstandingRangeReadRequest){
 const v=structuredClone(raw),r=v.request,s=v.selection;
 if(!exact(v,['request','controlGeneration','expiresAt','selection'])||!version(v.controlGeneration)||!instant(v.expiresAt)||!exact(r,['projectId','executionId','executionGeneration','requestRef','assignmentRef','preparationRef'])||!uuid(r.projectId)||!uuid(r.executionId)||!version(r.executionGeneration)
  ||!ref(r.requestRef)||r.requestRef.version!==1||!ref(r.assignmentRef)||!ref(r.preparationRef)
  ||!exact(s,['requestRef','resultRef','initConfirmationRef','tailRef','firstSequence','lastSequence','ranges'])||!['requestRef','resultRef','initConfirmationRef','tailRef'].every(k=>ref((s as any)[k])&&(s as any)[k].version===1)
  ||s.requestRef.id===r.requestRef.id||!version(s.firstSequence)||!version(s.lastSequence)||s.lastSequence<s.firstSequence||s.lastSequence>10000||!Array.isArray(s.ranges)||!s.ranges.length||s.ranges.length>200||s.ranges.length!==s.lastSequence-s.firstSequence+1)throw new ApiError('INPUT_INVALID',422);
 let blocks=0,bytes=0;const ids=new Set<string>();
 for(const [i,row]of s.ranges.entries()){
  if(!exact(row,['outputRef','sequence','payloadDigest','textBlocks','textBytes'])||!ref(row.outputRef)||row.outputRef.version!==1||ids.has(row.outputRef.id)||row.outputRef.id===s.initConfirmationRef.id
   ||row.outputRef.id===s.tailRef.id&&(!same(row.outputRef,s.tailRef)||i!==s.ranges.length-1)||row.sequence!==s.firstSequence+i||typeof row.payloadDigest!=='string'||!/^[a-f0-9]{64}$/.test(row.payloadDigest)
   ||!version(row.textBlocks)||(blocks+=row.textBlocks)>200||!version(row.textBytes)||(bytes+=row.textBytes)>2097152)throw new ApiError('INPUT_INVALID',422);ids.add(row.outputRef.id);
 }
 return v;
}
/** BODY의 원 선택·부분 해시만 대조한다. 조회 상태나 검토 자격을 만들지 않는다. */
async function verifyRangeBody(v:any,input:NormalUnderstandingRangeReadRequest,check:()=>void,invalid:()=>never){
 check();const r=input.request,s=input.selection;
 const b=v.body;
 if(!exact(b,['schemaVersion','kind','attribution','projectId','executionId','executionGeneration','requestRef','acquisitionRef','sourceRequestRef','sourceResultRef','contextBundleRef','initConfirmationRef','tailRef','firstSequence','lastSequence','beforeRef','afterRef','parts','wholeConversationComplete','executionAuthorized'])
  ||b.schemaVersion!==1||b.kind!=='FIXED_RANGE_SELECTION'||b.attribution!=='SESSION_ONLY'||b.projectId!==r.projectId||b.executionId!==r.executionId||b.executionGeneration!==r.executionGeneration||!same(b.requestRef,r.requestRef)
  ||!ref(b.acquisitionRef)||b.acquisitionRef.version!==1||!same(b.sourceRequestRef,s.requestRef)||!same(b.sourceResultRef,s.resultRef)||!ref(b.contextBundleRef)||!same(b.initConfirmationRef,s.initConfirmationRef)||!same(b.tailRef,s.tailRef)
  ||b.firstSequence!==s.firstSequence||b.lastSequence!==s.lastSequence||b.wholeConversationComplete!==false||b.executionAuthorized!==false
  ||![b.beforeRef,b.afterRef].every(x=>x===null||ref(x)&&x.version===1)||(s.firstSequence===1)!==(b.beforeRef===null)
  ||s.ranges.some(row=>[ref(b.beforeRef)?b.beforeRef.id:null,ref(b.afterRef)?b.afterRef.id:null].includes(row.outputRef.id))||same(s.ranges.at(-1)?.outputRef,s.tailRef)&&b.afterRef!==null
  ||ref(b.beforeRef)&&b.beforeRef.id===s.initConfirmationRef.id&&!same(b.beforeRef,s.initConfirmationRef)||ref(b.afterRef)&&b.afterRef.id===s.tailRef.id&&!same(b.afterRef,s.tailRef)
  ||!Array.isArray(b.parts)||b.parts.length!==s.ranges.reduce((n,row)=>n+row.textBlocks,0)||!Array.isArray(v.partRefs)||v.partRefs.length!==b.parts.length)return invalid();
 const digest=async(text:string)=>{check();const bytes=new TextEncoder().encode(text);try{const out=await crypto.subtle.digest('SHA-256',bytes);check();return [...new Uint8Array(out)].map(n=>n.toString(16).padStart(2,'0')).join('');}finally{bytes.fill(0);}};
 const known=new Set<string>([r.requestRef.id,b.acquisitionRef.id,s.requestRef.id,s.resultRef.id,s.initConfirmationRef.id,s.tailRef.id,...s.ranges.map(row=>row.outputRef.id)]);
 if(known.has(v.resultRef.id))return invalid();known.add(v.resultRef.id);if(known.has(v.responseRef.id))return invalid();known.add(v.responseRef.id);
 if(await digest(ordered(b))!==v.responseRef.contentHash)return invalid();
 let i=0;
 for(const row of s.ranges){let bytes=0;
  for(let block=0;block<row.textBlocks;block++,i++){
   const p=b.parts[i],pr=v.partRefs[i];
   if(!exact(p,['outputRef','sequence','payloadDigest','blockIndex','kind','text','textHash'])||!same(p.outputRef,row.outputRef)||p.sequence!==row.sequence||p.payloadDigest!==row.payloadDigest||p.blockIndex!==block||p.kind!=='ASSISTANT_TEXT'
    ||typeof p.text!=='string'||!p.text.isWellFormed()||!ref(pr)||pr.version!==1||known.has(pr.id)||await digest(p.text)!==p.textHash||await digest(ordered(p))!==pr.contentHash)return invalid();
   bytes+=new TextEncoder().encode(p.text).byteLength;known.add(pr.id);
  }
  if(bytes!==row.textBytes)return invalid();
 }
 check();
}
async function currentRange(raw:unknown,input:NormalUnderstandingRangeReadRequest,check:()=>void):Promise<NormalUnderstandingRangeResult>{
 check();const v:any=structuredClone(raw),r=input.request,s=input.selection,invalid=():never=>{throw new ApiError('RESPONSE_INVALID');};
 if(!v||!same(v.request,r))return invalid();
 if(v.status==='PENDING_SOURCE'||v.status==='CURRENT_UNAVAILABLE'){if(!exact(v,['status','request']))return invalid();return {status:v.status==='PENDING_SOURCE'&&Date.parse(input.expiresAt)<=Date.now()?'CURRENT_UNAVAILABLE':v.status,request:r};}
 if(!exact(v,['status','request','resultRef','responseRef','partRefs','currentness','observedAt','expiresAt','selectionAvailable','body'])||v.status!=='RANGE_STORED'||v.currentness!=='CURRENT'||v.selectionAvailable!==true
  ||!ref(v.resultRef)||v.resultRef.version!==1||!ref(v.responseRef)||v.responseRef.version!==1||!instant(v.observedAt)||!instant(v.expiresAt)||Date.parse(v.expiresAt)-Date.parse(v.observedAt)>30000||Date.parse(v.expiresAt)<=Math.max(Date.now(),Date.parse(v.observedAt))||new TextEncoder().encode(ordered(v)).byteLength>2097152)return invalid();
 await verifyRangeBody(v,input,check,invalid);
 check();if(Date.parse(v.expiresAt)<=Date.now())return invalid();return v as NormalUnderstandingRangeResult;
}

/** 저장 명령의 정확 범위만 명시 조회한다. 본문은 복구 원장에 보관하지 않는다. */
export async function readNormalUnderstandingRange(client:ApiClient,session:DocumentSession,input:NormalUnderstandingRangeReadRequest,signal:AbortSignal,active:()=>boolean):Promise<NormalUnderstandingRangeResult>{
 const expected=rangeReadInput(input),owned=new AbortController();if(signal.aborted)owned.abort();
 const owner=channel(client,session,owned.signal,active),r=expected.request;
 // 원 요청의 전달 기한은 pending에만 적용한다. 정착 원문의 명시 GET은 별도의 유한 호출이다.
 let wall=Date.now(),mono=performance.now(),end=wall+30000,monoEnd=mono+30000;
 const check=()=>{owner.check();const w=Date.now(),m=performance.now();if(!same(expected,input)||w<wall||m<mono||m>=monoEnd||w>=end)throw new ApiError('DISCOVERY_SCOPE_CHANGED');wall=w;mono=m;};
 const controlClient=new ApiClient((url,options)=>{check();return owner.transport.call(globalThis,url,{...options,signal:owned.signal});});
 let timer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>owned.abort();signal.addEventListener('abort',abort,{once:true});
 const arm=()=>{if(timer!==undefined)clearTimeout(timer);const remaining=Math.min(end-Date.now(),monoEnd-performance.now());
  if(remaining<=0)owned.abort();else timer=setTimeout(abort,Math.min(2147483647,remaining));};
 try{
  arm();check();
  const generation=await documentControl(controlClient,r.projectId,session);check();if(generation!==expected.controlGeneration)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
  const query=new URLSearchParams({controlGeneration:String(generation),executionGeneration:String(r.executionGeneration),requestVersion:String(r.requestRef.version),requestHash:r.requestRef.contentHash,
   assignmentId:r.assignmentRef.id,assignmentVersion:String(r.assignmentRef.version),assignmentHash:r.assignmentRef.contentHash,preparationId:r.preparationRef.id,preparationVersion:String(r.preparationRef.version),preparationHash:r.preparationRef.contentHash});
  const queryWall=wall,queryMono=mono;
  const value=await wire(owner,`/api/v1/projects/${r.projectId}/executions/${r.executionId}/understanding-response-read-requests/${r.requestRef.id}/range-current?${query}`,owned.signal,undefined,true,check);check();
  if(value&&typeof value==='object'&&'expiresAt'in value&&instant(value.expiresAt)&&Date.parse(value.expiresAt)>wall){end=Math.min(end,Date.parse(value.expiresAt));monoEnd=Math.min(monoEnd,queryMono+Date.parse(value.expiresAt)-queryWall);}
  arm();check();
  const result=await currentRange(value,expected,check);check();const after=await documentControl(controlClient,r.projectId,session);check();if(after!==generation)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
  if(result.status==='RANGE_STORED'&&Date.parse(result.expiresAt)<=Date.now())throw new ApiError('RESPONSE_INVALID');return result;
 }catch(error){check();if(error instanceof ApiError&&(metadataCurrentStatuses.get(error.code)===error.status||error.code==='NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED'&&error.status===412))return {status:'CURRENT_UNAVAILABLE',request:r};throw error;}
 finally{signal.removeEventListener('abort',abort);if(timer!==undefined)clearTimeout(timer);}
}

/** 역사 응답의 별도 닫힌 판독기다. current DTO로 변환하거나 editor에 전달하지 않는다. */
export async function verifyNormalUnderstandingRangeHistory(raw:unknown,input:NormalUnderstandingRangeReadRequest,check:()=>void):Promise<NormalUnderstandingRangeHistoryResult>{
 check();const v:any=structuredClone(raw),expected=rangeReadInput(input),invalid=():never=>{throw new ApiError('RESPONSE_INVALID');};
 if(!exact(v,['status','requestRef','resultRef','responseRef','partRefs','currentness','observedAt','expiresAt','selectionAvailable','reviewAvailable','executionAuthorized','dispatchPerformed','body'])
  ||v.status!=='RANGE_STORED_HISTORICAL'||v.currentness!=='NOT_RECHECKED'||v.selectionAvailable!==false||v.reviewAvailable!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false
  ||!same(v.requestRef,expected.request.requestRef)||!ref(v.resultRef)||v.resultRef.version!==1||!ref(v.responseRef)||v.responseRef.version!==1
  ||!instant(v.observedAt)||!instant(v.expiresAt)||Date.parse(v.expiresAt)<=Math.max(Date.now(),Date.parse(v.observedAt))||Date.parse(v.expiresAt)-Date.parse(v.observedAt)>30000
  ||new TextEncoder().encode(ordered(v)).byteLength>2097152)return invalid();
 await verifyRangeBody(v,expected,check,invalid);check();if(Date.parse(v.expiresAt)<=Date.now())return invalid();return v as NormalUnderstandingRangeHistoryResult;
}
/** 원 요청의 전달 기한과 현재 실행 자격은 이 과거 읽기의 새 권위가 아니다. */
export async function readNormalUnderstandingRangeHistory(client:ApiClient,session:DocumentSession,input:NormalUnderstandingRangeReadRequest,signal:AbortSignal,active:()=>boolean):Promise<NormalUnderstandingRangeHistoryResult>{
 const expected=rangeReadInput(input),owned=new AbortController();if(signal.aborted)owned.abort();
 const owner=channel(client,session,owned.signal,active),r=expected.request;
 let wall=Date.now(),mono=performance.now(),end=wall+30000,monoEnd=mono+30000;
 const check=()=>{owner.check();const w=Date.now(),m=performance.now();if(!same(expected,input)||w<wall||m<mono||w>=end||m>=monoEnd)throw new ApiError('DISCOVERY_SCOPE_CHANGED');wall=w;mono=m;};
 const controlClient=new ApiClient((url,options)=>{check();return owner.transport.call(globalThis,url,{...options,signal:owned.signal});});
 let timer:ReturnType<typeof setTimeout>|undefined;
 const abort=()=>owned.abort();signal.addEventListener('abort',abort,{once:true});
 const arm=()=>{if(timer!==undefined)clearTimeout(timer);const remaining=Math.min(end-Date.now(),monoEnd-performance.now());if(remaining<=0)owned.abort();else timer=setTimeout(abort,Math.min(2147483647,remaining));};
 try{
  arm();check();
  const generation=await documentControl(controlClient,r.projectId,session);check();
  const query=new URLSearchParams({controlGeneration:String(generation),executionGeneration:String(r.executionGeneration),requestVersion:String(r.requestRef.version),requestHash:r.requestRef.contentHash,
   assignmentId:r.assignmentRef.id,assignmentVersion:String(r.assignmentRef.version),assignmentHash:r.assignmentRef.contentHash,preparationId:r.preparationRef.id,preparationVersion:String(r.preparationRef.version),preparationHash:r.preparationRef.contentHash});
  const queryWall=wall,queryMono=mono;
  const value=await wire(owner,`/api/v1/projects/${r.projectId}/executions/${r.executionId}/understanding-response-read-requests/${r.requestRef.id}/range-history?${query}`,owned.signal,undefined,true,check);check();
  if(value&&typeof value==='object'&&'expiresAt'in value&&'observedAt'in value&&instant(value.expiresAt)&&instant(value.observedAt)){
   const remaining=Date.parse(value.expiresAt)-Date.parse(value.observedAt);
   if(remaining>0&&remaining<=30000){const absolute=Date.parse(value.expiresAt);end=Math.min(end,absolute,queryWall+remaining);monoEnd=Math.min(monoEnd,queryMono+remaining,performance.now()+absolute-Date.now());}
  }
  arm();check();
  const result=await verifyNormalUnderstandingRangeHistory(value,expected,check);check();
  const after=await documentControl(controlClient,r.projectId,session);check();
  if(after!==generation)throw new ApiError('CONTROL_GENERATION_CONFLICT',409);
  return result;
 }finally{signal.removeEventListener('abort',abort);if(timer!==undefined)clearTimeout(timer);}
}

function prepareRangeDraft(current:StoredMetadata,firstSequence:number,lastSequence:number):NormalUnderstandingRangeDraft|null{
 if(Date.parse(current.expiresAt)<=Date.now()||!version(firstSequence)||!version(lastSequence)||lastSequence<firstSequence||lastSequence-firstSequence>=200)return null;
 const ranges=current.metadata.ranges.filter(range=>range.sequence>=firstSequence&&range.sequence<=lastSequence);
 if(ranges.length!==lastSequence-firstSequence+1||ranges.some((range,index)=>range.sequence!==firstSequence+index)||
    ranges.reduce((count,range)=>count+range.textBlocks,0)>200||ranges.reduce((bytes,range)=>bytes+range.textBytes,0)>2*1024*1024)return null;
 const {request,resultRef,metadata:{contextBundleRef,initConfirmationRef,tailRef}}=current;
 return structuredClone({request,resultRef,contextBundleRef,initConfirmationRef,tailRef,firstSequence,lastSequence,ranges});
}

function UnderstandingRangeSelection({current,requestRange,active,disabled,onSettled}:{current:StoredMetadata;requestRange:NormalUnderstandingRangeRequester;active:()=>boolean;disabled:boolean;onSettled:()=>void}){
 const [first,setFirst]=useState(''),[last,setLast]=useState(''),[notice,setNotice]=useState('');
 const ownerRef=useRef({current,requestRange});
 if(ownerRef.current.current!==current||ownerRef.current.requestRange!==requestRange)ownerRef.current={current,requestRange};
 const owner=ownerRef.current,view=useRef({owner,active,disabled});view.current={owner,active,disabled};
 const firstOwner=useRef(owner),activeSelection=firstOwner.current===owner;
 const inFlight=useRef<{owner:typeof owner;controller:AbortController}|null>(null);
 const live=useRef(false);
 const dispatched=useRef<{current:StoredMetadata;keys:Set<string>}>({current,keys:new Set()});
 if(dispatched.current.current!==current)dispatched.current={current,keys:new Set()};
 const range=activeSelection?prepareRangeDraft(current,Number(first),Number(last)):null;
 const selection=useRef(range);selection.current=range;
 useEffect(()=>{
  live.current=true;firstOwner.current=owner;selection.current=null;setFirst('');setLast('');setNotice('');
  return()=>{
   live.current=false;selection.current=null;
   if(inFlight.current?.owner===owner){inFlight.current.controller.abort();inFlight.current=null;}
  };
 },[owner]);
 function cancel(){
  if(ownerRef.current!==owner)return;
  inFlight.current?.controller.abort();inFlight.current=null;
  selection.current=null;setFirst('');setLast('');setNotice('');
 }
 async function confirm(){
  if(!live.current||ownerRef.current!==owner||view.current.owner!==owner||!view.current.active()||view.current.disabled||inFlight.current||
     !range||!selection.current||!same(selection.current,range))return;
  const draft=prepareRangeDraft(current,range.firstSequence,range.lastSequence);
  if(!draft||!same(draft,range))return;
  const key=ordered([draft.firstSequence,draft.lastSequence]),used=dispatched.current.keys;
  if(used.has(key))return;
  used.add(key);
  const flight={owner,controller:new AbortController()};inFlight.current=flight;setNotice('구간 요청 전달 중');
  const isCurrent=()=>inFlight.current===flight&&ownerRef.current===owner&&view.current.active()&&!flight.controller.signal.aborted&&Date.parse(current.expiresAt)>Date.now();
  try{const receipt=await requestRange(draft,flight.controller.signal,isCurrent);if(isCurrent())setNotice(receipt?'':'구간 요청 전달');}
  catch{if(isCurrent())setNotice('구간 요청 결과 미확인');}
  finally{if(inFlight.current===flight)inFlight.current=null;onSettled();}
 }
 const busy=inFlight.current?.owner===owner;
 const used=range!==null&&dispatched.current.keys.has(ordered([range.firstSequence,range.lastSequence]));
 return <div>
  <fieldset disabled={disabled||busy}>
   <legend>조회할 출력 구간</legend>
   <label>시작 순번<select aria-label="출력 구간 시작 순번" value={activeSelection?first:''} onChange={event=>{selection.current=null;setFirst(event.target.value);setNotice('');}}>
    <option value="">시작 순번 선택</option>{current.metadata.ranges.map(row=><option key={row.sequence} value={row.sequence}>{row.sequence}</option>)}
   </select></label>
   <label>끝 순번<select aria-label="출력 구간 끝 순번" value={activeSelection?last:''} onChange={event=>{selection.current=null;setLast(event.target.value);setNotice('');}}>
    <option value="">끝 순번 선택</option>{current.metadata.ranges.map(row=><option key={row.sequence} value={row.sequence}>{row.sequence}</option>)}
   </select></label>
   {activeSelection&&first&&last&&!range?<p role="status">목록에 있는 연속 순번을 한도 안에서 선택하세요.</p>:null}
   <button type="button" disabled={!range||used} onClick={()=>void confirm()}>선택 구간 조회 요청</button>
  </fieldset>
  {activeSelection&&(first||last||notice)?<button type="button" onClick={cancel}>구간 선택 취소</button>:null}
  {activeSelection&&notice?<p role="status">{notice}</p>:null}
 </div>;
}

export function NormalUnderstandingDiscovery({reviewStorage,client,session,projectId,assignmentRef,preparations,busy,metadataReader,rangeRequester,rangeRecovery,rangeReader,rangeHistoryReader}:Props){
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
 const rangeRequests=rangeRecovery?rangeLedger(session,client).records:null;
 const retainedRanges=rangeRequests?[...rangeRequests].filter(([,entry])=>entry.command.projectId===projectId&&same(entry.command.payload.assignmentRef,assignmentRef)):[];
 const now=Date.now(),rangeExpiry=Math.min(Infinity,...retainedRanges.flatMap(([,entry])=>{
  const expires=entry.expiresAt?Date.parse(entry.expiresAt):0;
  return expires>now?[expires]:[];
 }));
 useEffect(()=>{
  if(!Number.isFinite(rangeExpiry))return;
  const timer=setTimeout(()=>render(value=>value+1),Math.min(2147483647,Math.max(0,rangeExpiry-Date.now())));
  return()=>clearTimeout(timer);
 },[rangeExpiry]);
 const picked=useRef<PlanRef|null>(null);picked.current=selected?.ref??null;
 const current=basis&&selected&&same(basis.scope.assignmentRef,assignmentRef)&&same(basis.scope.preparationRef,selected.ref)?basis:null;
 const selectedKey=current?ordered([key,current.scope.preparationRef,current.scope.executionId,current.scope.executionGeneration]):null;
 const kept=selectedKey===null?undefined:local.get(selectedKey);
 const metadataScope=useRef({owner,reader:metadataReader});
 if(metadataScope.current.owner!==owner||metadataScope.current.reader!==metadataReader)metadataScope.current={owner,reader:metadataReader};
 const readOwner=metadataScope.current;
 const [metadata,setMetadata]=useState<{key:string;record:Retained;owner:typeof readOwner;
  value:NormalUnderstandingMetadataResult|'READING'|'UNKNOWN'|'AUTH_REQUIRED'}|null>(null);
 const metadataFlight=useRef<{owner:typeof readOwner;controller:AbortController}|null>(null);
 const metadataView=useRef<typeof metadata>(null);
 function cancelMetadata(){
  metadataFlight.current?.controller.abort();
  metadataFlight.current=null;
  metadataView.current=null;
  setMetadata(null);
 }
 useEffect(()=>{
  setMetadata(current=>current&&current.owner!==readOwner?null:current);
  return()=>{
   if(metadataFlight.current?.owner===readOwner){
    metadataFlight.current.controller.abort();metadataFlight.current=null;
   }
  };
 },[readOwner]);
 async function readMetadata(writeKey:string,record:Retained){
  if(!metadataReader||busy||working||scope.current!==owner||metadataScope.current!==readOwner||flight.current||metadataFlight.current||record.state!=='PENDING_SOURCE'||
     local.get(writeKey)!==record||!ref(record.requestRef)||record.requestRef.version!==1)return;
  const command=record.command;
  if(command.projectId!==projectId||!same(command.payload.assignmentRef,assignmentRef))return;
  cancelRange();
  const request=structuredClone({requestRef:record.requestRef,projectId,executionId:command.targetId,executionGeneration:command.expectedVersion,
   assignmentRef:command.payload.assignmentRef,preparationRef:command.payload.preparationRef});
  const operation=new AbortController(),reading={owner:readOwner,controller:operation};
  metadataFlight.current=reading;
  metadataView.current=null;
  const isCurrent=()=>active(operation)&&metadataScope.current===readOwner&&local.get(writeKey)===record;
  const publish=(value:NonNullable<typeof metadata>['value'])=>{if(isCurrent())setMetadata({key:writeKey,record,owner:readOwner,value});};
  publish('READING');
  try{
   const response=await metadataReader(structuredClone(request),operation.signal);
   if(isCurrent())publish(currentMetadata(response,request));
  }catch(error){
   publish(error instanceof ApiError&&metadataAuthStatuses.get(error.code)===error.status?'AUTH_REQUIRED':'UNKNOWN');
  }
  finally{if(metadataFlight.current===reading)metadataFlight.current=null;}
 }
 const shownMetadata=metadata?.owner===readOwner?metadata:null;
 metadataView.current=shownMetadata;
 useEffect(()=>{
  const value=shownMetadata?.value;
  if(typeof value!=='object'||value.status!=='METADATA_STORED')return;
  const timer=setTimeout(()=>setMetadata(current=>current&&current===shownMetadata?{...current,value:{status:'CURRENT_UNAVAILABLE',request:value.request}}:current),
   Math.min(2147483647,Math.max(0,Date.parse(value.expiresAt)-Date.now())));
  return()=>clearTimeout(timer);
 },[shownMetadata]);
 // 원문은 이 화면의 단일 조회 상태에만 둔다. 복구 WeakMap에는 원 command/선택 metadata만 남긴다.
 const rangeRecordsKey=ordered(retainedRanges.map(([k,e])=>[k,e.command,e.requestRef??null,e.state,e.expiresAt??null]));
 const rangeScope=useRef({owner,reader:rangeReader,metadataReader,selection,records:rangeRecordsKey,busy});
 if(rangeScope.current.owner!==owner||rangeScope.current.reader!==rangeReader||rangeScope.current.metadataReader!==metadataReader||rangeScope.current.selection!==selection||rangeScope.current.records!==rangeRecordsKey||rangeScope.current.busy!==busy)
  rangeScope.current={owner,reader:rangeReader,metadataReader,selection,records:rangeRecordsKey,busy};
 const rangeReadOwner=rangeScope.current;
 const [rangeView,setRangeView]=useState<{owner:typeof rangeReadOwner;key:string;entry:RangeRetained;monoEnd?:number;value:NormalUnderstandingRangeResult|'READING'|'UNKNOWN'|'AUTH_REQUIRED'}|null>(null);
 const rangeFlight=useRef<{owner:typeof rangeReadOwner;controller:AbortController}|null>(null);
 function cancelRange(){rangeFlight.current?.controller.abort();rangeFlight.current=null;rangeViewToken.current=null;setRangeView(null);}
 useEffect(()=>{
  setRangeView(null);
  return()=>{if(rangeFlight.current?.owner===rangeReadOwner){rangeFlight.current.controller.abort();rangeFlight.current=null;}};
 },[rangeReadOwner]);
 const rangeViewToken=useRef<object|null>(null),rangeToken={};rangeViewToken.current=rangeToken;
 const shownRange=rangeView?.owner===rangeReadOwner?rangeView:null;
 useEffect(()=>{
  if(!shownRange)return;const value=shownRange.value;if(typeof value!=='object'||value.status!=='RANGE_STORED')return;
  const timer=setTimeout(()=>setRangeView(current=>current&&current===shownRange?{...current,value:{status:'CURRENT_UNAVAILABLE',request:value.request}}:current),Math.min(2147483647,Math.max(0,Math.min(Date.parse(value.expiresAt)-Date.now(),(shownRange.monoEnd??0)-performance.now()))));
  return()=>clearTimeout(timer);
 },[shownRange]);
 async function readRange(rangeKey:string,entry:RangeRetained){
  if(!rangeReader||busy||working||flight.current||metadataFlight.current||rangeFlight.current||rangeScope.current!==rangeReadOwner||scope.current!==owner||rangeRequests?.get(rangeKey)!==entry
   ||entry.state!=='PENDING_SOURCE'||!ref(entry.requestRef)||!entry.expiresAt||!instant(entry.expiresAt))return;
  const command=entry.command;if(command.projectId!==projectId||!same(command.payload.assignmentRef,assignmentRef)||entry.body!==JSON.stringify(command))return;
  const input=rangeReadInput({request:{projectId,executionId:command.targetId,executionGeneration:command.expectedVersion,assignmentRef:command.payload.assignmentRef,preparationRef:command.payload.preparationRef,requestRef:entry.requestRef},controlGeneration:command.controlGeneration,expiresAt:entry.expiresAt,selection:command.payload.selection});
  const fingerprint=ordered(entry),operation=new AbortController(),reading={owner:rangeReadOwner,controller:operation};
  const readWall=Date.now(),readMono=performance.now(),end=readWall+30000;let monoEnd=readMono+30000;
  rangeFlight.current=reading;setRangeView({owner:rangeReadOwner,key:rangeKey,entry,value:'READING'});
  const ownsRead=()=>active(operation)&&rangeScope.current===rangeReadOwner&&rangeFlight.current===reading&&rangeRequests?.get(rangeKey)===entry&&ordered(entry)===fingerprint;
  const isCurrent=()=>ownsRead()&&Date.now()<end&&performance.now()<monoEnd;
  const check=()=>{if(!isCurrent())throw new ApiError('DISCOVERY_SCOPE_CHANGED');};
  const publish=(value:NonNullable<typeof rangeView>['value'])=>{if(isCurrent())setRangeView({owner:rangeReadOwner,key:rangeKey,entry,value,monoEnd});};
  try{const response=await rangeReader(structuredClone(input),operation.signal);if(response.status==='RANGE_STORED'&&instant(response.expiresAt)&&Date.parse(response.expiresAt)>Date.now())monoEnd=Math.min(monoEnd,readMono+Date.parse(response.expiresAt)-readWall);check();publish(await currentRange(response,input,check));}
  catch(error){
   if(ownsRead()&&(Date.now()>=end||performance.now()>=monoEnd))setRangeView({owner:rangeReadOwner,key:rangeKey,entry,value:{status:'CURRENT_UNAVAILABLE',request:input.request}});
   else publish(error instanceof ApiError&&metadataAuthStatuses.get(error.code)===error.status?'AUTH_REQUIRED':'UNKNOWN');
  }
  finally{if(rangeFlight.current===reading)rangeFlight.current=null;}
 }
 async function run(work:(operation:AbortController)=>Promise<void>){
  if(flight.current||metadataFlight.current||rangeFlight.current||busy||scope.current!==owner)return;
  cancelRange();
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
 if(!available.length&&!recordsForAssignment.length&&!retainedRanges.length)return rangeHistoryReader?<p role="status">이 로그인에 정확한 구간 요청 참조가 없어 과거 원문을 열 수 없습니다.</p>:null;
 return <section aria-label="최초 이해 자료 탐색"><h6>최초 이해 자료 탐색</h6>
  <fieldset disabled={busy||working}><legend>등록 실행 준비 선택</legend>
   <select aria-label="이해 자료 탐색 준비" value={selection} onChange={event=>{cancelMetadata();cancelRange();setSelection(event.target.value);setBasis(null);setNotice('');}}>
    <option value="">실행 준비 선택</option>{available.map(p=><option key={ordered(p.ref)} value={ordered(p.ref)}>준비 {p.ref.id} · v{p.ref.version}</option>)}
   </select>
   <button type="button" disabled={!selected} onClick={()=>void check()}>탐색 근거 확인</button>
   {current&&!kept?<><p>실행 {current.scope.executionId} · 세대 {current.scope.executionGeneration} · 확인 기한 {current.scope.expiresAt}</p>
    <button type="button" onClick={()=>void submit()}>최초 이해 자료 탐색 요청</button></>:null}
  </fieldset>
  {notice?<p role="alert">탐색 근거 확인 불가 · {notice}</p>:null}
  {recordsForAssignment.length?<ul>{recordsForAssignment.map(([writeKey,record])=>{
   const view=shownMetadata?.key===writeKey&&shownMetadata.record===record?shownMetadata.value:null;
   const currentView=typeof view==='object'&&view?.status==='METADATA_STORED'&&Date.parse(view.expiresAt)<=Date.now()?{status:'CURRENT_UNAVAILABLE' as const}:view;
   return <li key={writeKey}>
   <p>준비 {record.command.payload.preparationRef.id} · 실행 {record.command.targetId} · 세대 {record.command.expectedVersion}</p>
   {record.state==='PENDING_SOURCE'?<>
    <p role="status">탐색 요청 보관{currentView===null||typeof currentView==='object'&&currentView?.status==='PENDING_SOURCE'?' · 자료 대기':''} · {record.requestRef?.id}</p>
    {metadataReader&&record.requestRef?<button type="button" disabled={busy||working||shownMetadata?.value==='READING'} onClick={()=>void readMetadata(writeKey,record)}>탐색 결과 확인</button>:null}
    {currentView==='READING'?<><p role="status">탐색 결과 확인 중</p><button type="button" onClick={cancelMetadata}>조회 취소</button></>:null}
    {currentView==='UNKNOWN'?<p role="status">조회 결과 미확인</p>:null}
    {currentView==='AUTH_REQUIRED'?<p role="status">인증을 확인한 뒤 다시 조회하세요.</p>:null}
    {typeof currentView==='object'&&currentView?.status==='CURRENT_UNAVAILABLE'?<p role="status">현재 조회 불가</p>:null}
    {typeof currentView==='object'&&currentView?.status==='METADATA_STORED'?<>
     <p role="status">출력 메타데이터 보관 · 관측 {currentView.observedAt}</p>
     <p>같은 세션 · 출력 구간 {currentView.metadata.ranges.length}개 · 결과 {currentView.resultRef.id}</p>
     <ul>{currentView.metadata.ranges.map(range=><li key={range.outputRef.id}>순번 {range.sequence} · 출력 {range.outputRef.id} · 텍스트 {range.textBlocks}개 / {range.textBytes} 바이트</li>)}</ul>
     {rangeRequester&&currentView.metadata.ranges.length&&!(rangeRequests&&hasRangeRequest(rangeRequests,currentView.request))?<UnderstandingRangeSelection current={currentView} requestRange={rangeRequester} disabled={busy||working}
      active={()=>metadataScope.current===readOwner&&metadataView.current===shownMetadata&&local.get(writeKey)===record&&normalUnderstandingRecords(session,client)===local}
      onSettled={()=>{if(scope.current===owner&&normalUnderstandingRecords(session,client)===local)render(value=>value+1);}}/>:null}
    </>:null}
   </>:null}
   {record.state==='DENIED'?<><p role="alert">탐색 요청 거절 · {record.code}</p>
    <button type="button" disabled={busy||working} onClick={()=>{if(local.get(writeKey)!==record)return;local.delete(writeKey);setBasis(null);render(value=>value+1);}}>거절 확인 후 다시 선택</button></>:null}
   {record.state==='UNKNOWN'?<><p role="status">요청 결과 불명 · 원 명령 보존 · {record.command.commandId}</p>
    <button type="button" disabled={busy||working} onClick={()=>void submit(writeKey)}>같은 탐색 명령 결과 확인</button></>:null}
   {record.state==='SENDING'?<p role="status">원 명령 결과 확인 중</p>:null}
  </li>;})}</ul>:null}
  {retainedRanges.length?<ul aria-label="이해 자료 구간 요청">{retainedRanges.map(([rangeKey,entry])=>{const view=shownRange?.key===rangeKey&&shownRange.entry===entry?shownRange.value:null;
   const source=typeof view==='object'&&view?.status==='RANGE_STORED'&&Date.parse(view.expiresAt)>now&&performance.now()<(shownRange?.monoEnd??0)?view:null;
   return <li key={rangeKey}>
   <p>원 명령 {entry.command.commandId} · 순번 {entry.command.payload.selection.firstSequence}–{entry.command.payload.selection.lastSequence}</p>
   {entry.state==='PENDING_SOURCE'?<p role="status">구간 요청 보관 · {source?'원문 보관 확인':entry.expiresAt&&Date.parse(entry.expiresAt)>now?'원문 대기':'전달 기한 경과'} · {entry.requestRef?.id}</p>:null}
   {entry.state==='PENDING_SOURCE'&&rangeReader&&entry.requestRef?<button type="button" disabled={busy||working||!!rangeFlight.current||!entry.expiresAt||!instant(entry.expiresAt)} onClick={()=>void readRange(rangeKey,entry)}>보관 원문 확인</button>:null}
   {view==='READING'?<><p role="status">보관 원문 확인 중</p><button type="button" onClick={cancelRange}>원문 조회 취소</button></>:null}
   {view==='UNKNOWN'?<p role="status">원문 조회 결과 미확인</p>:null}
   {view==='AUTH_REQUIRED'?<p role="status">인증을 확인한 뒤 원문을 다시 조회하세요.</p>:null}
   {typeof view==='object'&&view?.status==='PENDING_SOURCE'?<p role="status">선택 원문 보관 대기</p>:null}
   {typeof view==='object'&&(view?.status==='CURRENT_UNAVAILABLE'||view?.status==='RANGE_STORED'&&!source)?<p role="status">현재 원문 조회 불가</p>:null}
   {source?<div aria-label="보관된 선택 원문"><p role="status">선택 원문 보관 확인 · 결과 {source.responseRef.id} · 관측 {source.observedAt}</p>
    <p>같은 세션의 고정 출력 순번 {source.body.firstSequence}–{source.body.lastSequence} · 전체 대화가 아닙니다. 고정 지점 이후 출력은 포함하지 않습니다. 이 조회는 검토·승인·작업 실행을 뜻하지 않습니다.</p>
    {source.body.parts.map((part,index)=><div key={source.partRefs[index]!.id}><p>출력 순번 {part.sequence} · 텍스트 {part.blockIndex+1}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{part.text}</pre></div>)}
    <button type="button" onClick={cancelRange}>원문 닫기</button>
   </div>:null}
   {reviewStorage&&entry.requestRef?<NormalInitialUnderstandingReview key={rangeKey} client={client} session={session} request={{projectId,executionId:entry.command.targetId,executionGeneration:entry.command.expectedVersion,assignmentRef:entry.command.payload.assignmentRef,preparationRef:entry.command.payload.preparationRef,requestRef:entry.requestRef}} preparation={available.find(p=>same(p.ref,entry.command.payload.preparationRef))??null} source={source} viewActive={()=>!!source&&scope.current===owner&&rangeScope.current===rangeReadOwner&&rangeRequests?.get(rangeKey)===entry&&rangeViewToken.current===rangeToken&&performance.now()<(shownRange?.monoEnd??0)&&Date.parse(source.expiresAt)>Date.now()} storage={reviewStorage} busy={busy||working||view==='READING'}/>:null}
   {rangeHistoryReader&&entry.state==='PENDING_SOURCE'&&entry.requestRef&&entry.expiresAt&&instant(entry.expiresAt)?<NormalUnderstandingRangeHistory key={'history:'+rangeKey} reader={rangeHistoryReader} verify={verifyNormalUnderstandingRangeHistory} scopeOwner={owner} entryOwner={entry}
    input={{request:{projectId,executionId:entry.command.targetId,executionGeneration:entry.command.expectedVersion,assignmentRef:entry.command.payload.assignmentRef,preparationRef:entry.command.payload.preparationRef,requestRef:entry.requestRef},controlGeneration:entry.command.controlGeneration,expiresAt:entry.expiresAt,selection:entry.command.payload.selection}}
    active={()=>scope.current===owner&&normalUnderstandingRecords(session,client)===local&&rangeRequests?.get(rangeKey)===entry&&entry.body===JSON.stringify(entry.command)} disabled={busy||working}/>:null}
   {entry.state==='SENDING'?<p role="status">구간 요청 확인 중</p>:null}
   {entry.state==='UNKNOWN'?<>
    <p role="status">구간 요청 결과 미확인 · 원 명령 보존</p>
    <button type="button" disabled={busy||working} onClick={()=>void run(async operation=>{await rangeRecovery?.(rangeKey,operation.signal);})}>같은 구간 명령 결과 확인</button>
   </>:null}
  </li>;})}</ul>:null}
  {rangeHistoryReader&&!retainedRanges.length?<p role="status">이 로그인에 정확한 구간 요청 참조가 없어 과거 원문을 열 수 없습니다.</p>:null}
  {working?<p role="status">확인 중</p>:null}
 </section>;
}
