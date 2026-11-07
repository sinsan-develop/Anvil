import {ApiClient,ApiError} from '../../api/client.ts';
import {browserCanonical} from '../control-handoff/api.ts';
import {commonSetupWireHash,readCommonSetupRequest,writeCommonSetupCommand,type CommonSetupSession,type CommonSetupCommand,type CommonSetupReceipt,type CommonSetupVersion} from './common-setup-api.ts';
import {readCommonSetupDefinition,readSetupSelection,setupRef,type SetupSlot,type SetupSelection} from '../../../../../contracts/runtime/user-common-setup-v1.ts';
import type {DraftEditorState} from './api.ts';
export interface SetupWork {ownerUserId:string;clientId:string;draftContext:string;command:CommonSetupCommand;body:string;requestHash:string;phase:'PREPARED'|'SENDING'|'UNKNOWN'|'APPLIED'|'REJECTED';receipt:CommonSetupReceipt|null;error:string|null;errorStatus:number|null}
const seals=new WeakMap<object,{api:ApiClient;transport:typeof fetch;body:string}>(),inflight=new WeakSet<object>();
const fail=():never=>{throw new ApiError('COMMON_SETUP_CONTEXT_CHANGED',412);};
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;}
function sealed(work:SetupWork,seal:{api:ApiClient;transport:typeof fetch;body:string}){freeze(work);seals.set(work,seal);return work;}
function scope(work:SetupWork,api:ApiClient,session:CommonSetupSession,context:string,active:()=>boolean){const seal=seals.get(work);if(!seal||seal.api!==api||seal.transport!==api.transport||seal.body!==work.body||work.ownerUserId!==session.user.id||work.clientId!==session.clientId||work.draftContext!==context||!active())fail();return seal!;}
export async function prepareSetupWork(api:ApiClient,session:CommonSetupSession,draftContext:string,raw:unknown,active:()=>boolean=()=>true):Promise<SetupWork>{
 const command=readCommonSetupRequest(raw,session),ownerUserId=session.user.id,clientId=session.clientId,transport=api.transport,csrf=session.csrfToken,body=browserCanonical(command);if(!active())fail();const requestHash=await commonSetupWireHash(command);if(!active()||ownerUserId!==session.user.id||clientId!==session.clientId||csrf!==session.csrfToken||transport!==api.transport)fail();return sealed({ownerUserId,clientId,draftContext,command,body,requestHash,phase:'PREPARED',receipt:null,error:null,errorStatus:null},{api,transport,body});
}
export async function sendSetupWork(api:ApiClient,session:CommonSetupSession,context:string,work:SetupWork,active:()=>boolean,apply:(before:SetupWork,next:SetupWork)=>boolean):Promise<void>{
 const seal=scope(work,api,session,context,active);if(!['PREPARED','UNKNOWN','SENDING'].includes(work.phase)||inflight.has(work))fail();const sending=sealed({...work,phase:'SENDING',error:null,errorStatus:null},seal);if(!apply(work,sending))return;inflight.add(sending);const current=()=>{try{scope(sending,api,session,context,active);return true;}catch{return false;}};
 try{const receipt=await writeCommonSetupCommand(api,session,sending.command,current);if(current())apply(sending,sealed({...sending,phase:'APPLIED',receipt,error:null,errorStatus:null},seal));}
 catch(error){if(!current())return;const e=error instanceof ApiError?error:new ApiError('CONNECTION_LOST');const known=[400,401,403,404,409,413,422].includes(e.status)&&!['RESPONSE_INVALID','CONNECTION_LOST','COMMON_SETUP_CONTEXT_CHANGED'].includes(e.code);apply(sending,sealed({...sending,phase:known?'REJECTED':'UNKNOWN',error:e.code,errorStatus:e.status},seal));}
 finally{inflight.delete(sending);}
}
export async function selectSetupForDraft(buffer:DraftEditorState,session:CommonSetupSession,slot:SetupSlot,value:CommonSetupVersion|null,active:()=>boolean=()=>true):Promise<DraftEditorState>{
 const owner=session.user.id,client=session.clientId;if(!active()||buffer.ownerUserId!==null&&buffer.ownerUserId!==owner||buffer.upload||buffer.pendingAction||buffer.pendingCommand||buffer.createdProject)fail();
 if(!['COORDINATOR_TOOL','CODING_TOOL','ENVIRONMENT'].includes(slot))fail();let selected=null;
 if(value!==null){if(value.status!=='ACTIVE'||!value.configurationCurrent||value.headVersion!==value.ref.version||value.snapshot.createdBy!==owner||value.snapshot.kind!==(slot==='ENVIRONMENT'?'ENVIRONMENT':'TOOL')||value.executionAuthorized!==false||value.support!=='UNVERIFIED'||!setupRef(value.ref)||value.snapshot.id!==value.ref.id||value.snapshot.version!==value.ref.version)fail();readCommonSetupDefinition(value.snapshot.kind,value.snapshot.definition);if(await commonSetupWireHash(value.snapshot)!==value.ref.contentHash)fail();selected={...value.ref};}
 if(!active()||session.user.id!==owner||session.clientId!==client)fail();const original=readSetupSelection((buffer.input as any).setupSelection),selection:SetupSelection=original??{coordinatorToolRef:null,codingToolRef:null,environmentRef:null};const key=slot==='COORDINATOR_TOOL'?'coordinatorToolRef':slot==='CODING_TOOL'?'codingToolRef':'environmentRef';return{...buffer,ownerUserId:owner,dirty:true,input:{...buffer.input,setupSelection:{...selection,[key]:selected}}} as DraftEditorState;
}
