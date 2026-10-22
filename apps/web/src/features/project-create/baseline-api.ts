import { ApiClient, ApiError } from '../../api/client.ts';
import type {ApprovalRequestWork} from '../decisions/api.ts';
export interface BaselineUploadApproval {request:ApprovalRequestWork|null;requestId:string;commandHash:string|null;rejectedRequests?:{command:NonNullable<ApprovalRequestWork['pending']>;failure:{code:string;status:number}}[]}
import { postDocumentCommand, type DocumentSession, type DocumentWrite } from '../design-trace/editor-api.ts';
import { documentFailure, documentMutationUncertain, isKnownDocumentRejection } from '../design-trace/mutation-result.ts';
import { ordered } from '../knowledge/review-view.ts';
import { artifact, checkCurrent, checkSourceBinding, digestBytes, exact, flagKeys, flagsFalse, reference, same, snapshotHash, timestamp, uuid, validateBaselineConfirmation, validateBaselineInput, validateBaselineReview, type BaselineContentReview, type BaselineDraftInput, type BaselineEvidenceRef, type Ref } from './baseline-validation.ts';
export type { BaselineContentReview, BaselineDraftInput, BaselineEvidenceRef, Ref } from './baseline-validation.ts';
export type BaselineOperation='saveBaselineDraft'|'reviewBaselineContent'|'confirmBaseline';
export interface BaselineDraftView {projectId:string;ref:Ref;snapshot:any;headVersion:number;currentCheck:{state:string;issues:string[]};contentConfirmed:false;observedAt:string}
export interface BaselineDecision {projectId:string;draftRef:Ref;reviews:{ref:Ref;snapshot:{input:BaselineContentReview;reviewedBy:{kind:'HUMAN';userId:string};reviewedAt:string;independence:'NOT_CLAIMED'};serverSequence:number}[];hasMoreReviews:boolean;latestReviewAccepted:boolean;adoptedRef:Ref|null;draftIsHead:boolean;currentCheck:{state:string;issues:string[]};contentConfirmed:boolean;observedAt:string}
export interface BaselinePage {projectId:string;items:({ref:Ref;status:'DRAFT'|'STORED_ADOPTION_NOT_RECHECKED'}|{ref:null;legacyRef:Ref;status:'LEGACY_UNVERIFIED'})[];hasMore:boolean;nextCursor:string|null;metadataIntegrity:'NOT_RECHECKED'}
type BaselineFailure={code:string;status:number;quarantinedArtifactId?:string};
export interface BaselineBuffer {bindingId:string;projectId:string;ownerUserId:string;ownerClientId:string;controlGeneration:number;input:BaselineDraftInput;saved:BaselineDraftView|null;review:BaselineContentReview|null;confirmation:{reason:string;acknowledged:boolean};pending:DocumentWrite|null;upload:{itemId:string;bytes:Uint8Array<ArrayBuffer>;mediaType:string}|null;dirty:boolean;reviewDirty:boolean;uncertain:boolean;failure:BaselineFailure|null;uploadApproval?:BaselineUploadApproval;rejectedCommands:{command:DocumentWrite;failure:BaselineFailure;uploadApproval?:BaselineUploadApproval}[]}
const fail=():never=>{throw new ApiError('RESPONSE_INVALID');};
const base=(pid:string)=>{if(!uuid(pid))throw new ApiError('CLIENT_PATH_INVALID');return `/api/v1/projects/${pid}`;};
function subject(b:BaselineBuffer,s:DocumentSession):void {if(!uuid(b.projectId)||!uuid(b.bindingId)||b.ownerUserId!==s.user.id||b.ownerClientId!==s.clientId||!uuid(s.user.id)||!uuid(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(b.controlGeneration)||b.controlGeneration<1)throw new ApiError('BASELINE_BINDING_INVALID');}
function envelope(c:DocumentWrite,s:DocumentSession):void {base(c.projectId);if(!exact(c,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||c.schemaVersion!==1||!uuid(c.commandId)||c.clientId!==s.clientId||!uuid(s.user.id)||!uuid(s.clientId)||!/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken)||!Number.isSafeInteger(c.controlGeneration)||c.controlGeneration<1||(c.approvalRef!==null&&(c.operation!=='uploadArtifact'||!exact(c.approvalRef,['requestId','decisionId','scopeDigest'])||!uuid(c.approvalRef.requestId)||!uuid(c.approvalRef.decisionId)||!/^[0-9a-f]{64}$/.test(c.approvalRef.scopeDigest)))||!Array.isArray(c.baselineRefs)||c.baselineRefs.length)throw new ApiError('BASELINE_BINDING_INVALID');}
export function newBaselineBuffer(pid:string,s:DocumentSession,generation:number,declarationRef:Ref|null):BaselineBuffer {
 const b:BaselineBuffer={bindingId:crypto.randomUUID(),projectId:pid,ownerUserId:s.user.id,ownerClientId:s.clientId,controlGeneration:generation,input:{baseRef:null,source:{kind:declarationRef?'DECLARATION_ONLY':'NONE_SELECTED',declarationRef,sourceRootRef:null,snapshotRef:null,grantRef:null,unverifiedReason:''},items:[],coverageReason:'',reason:''},saved:null,review:null,confirmation:{reason:'',acknowledged:false},pending:null,upload:null,dirty:true,reviewDirty:false,uncertain:false,failure:null,rejectedCommands:[]};
 subject(b,s);if(declarationRef!==null&&!reference(declarationRef))throw new ApiError('BASELINE_BINDING_INVALID');return structuredClone(b);
}
export function mergeBaselineBuffer(previous:BaselineBuffer|null,expected:BaselineBuffer,update:(b:BaselineBuffer)=>BaselineBuffer):BaselineBuffer|null {
 if(!previous||previous.bindingId!==expected.bindingId||previous.projectId!==expected.projectId||previous.ownerUserId!==expected.ownerUserId||previous.ownerClientId!==expected.ownerClientId||previous.controlGeneration!==expected.controlGeneration||!same(previous.pending,expected.pending))return previous;
 return update(previous);
}
export function baselineMutationFailed(b:BaselineBuffer,previouslyUncertain:boolean,error:ApiError):BaselineBuffer {
 return {...b,uncertain:documentMutationUncertain(previouslyUncertain,error),failure:documentFailure(error)};
}
export function releaseRejectedBaseline(b:BaselineBuffer,s:DocumentSession):BaselineBuffer {
 subject(b,s);if(b.uploadApproval?.request?.pending||b.uploadApproval?.request?.uncertain||!b.pending||b.uncertain||!b.failure||!isKnownDocumentRejection(b.failure))throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');
 return {...b,rejectedCommands:[...b.rejectedCommands,{command:structuredClone(b.pending),failure:{...b.failure},...(b.uploadApproval?{uploadApproval:structuredClone(b.uploadApproval)}:{})}],pending:null,upload:null,uploadApproval:undefined,uncertain:false,failure:null};
}
export function restartBaselineDraft(b:BaselineBuffer,s:DocumentSession,generation:number,declarationRef:Ref|null):BaselineBuffer {
 subject(b,s);if(b.pending||b.uncertain||b.upload)throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');
 return {...newBaselineBuffer(b.projectId,s,generation,declarationRef),rejectedCommands:structuredClone(b.rejectedCommands)};
}
export function restoreBaselineDraft(b:BaselineBuffer,s:DocumentSession,view:BaselineDraftView):BaselineBuffer {
 subject(b,s);if(b.pending||b.upload||view.projectId!==b.projectId||!reference(view.ref))throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');
 return {...b,input:structuredClone(view.snapshot.input),saved:structuredClone(view),review:null,confirmation:{reason:'',acknowledged:false},dirty:false,reviewDirty:false,uncertain:false,failure:null};
}
export function beginBaselineReview(b:BaselineBuffer,s:DocumentSession):BaselineBuffer {
 subject(b,s);if(b.pending||b.upload||!b.saved||b.dirty||!same(b.input,b.saved.snapshot.input)||b.saved.headVersion!==b.saved.ref.version||b.saved.currentCheck.state!=='MATCHED_METADATA')throw new ApiError('BASELINE_SAVED_DRAFT_REQUIRED');
 return {...b,review:{draftRef:{...b.saved.ref},criteriaVersion:1,reviewerKind:'HUMAN',items:b.input.items.map(i=>({itemId:i.itemId,featureState:i.featureState,outcome:'NOT_EXECUTED',reason:'',evidenceRefs:structuredClone(i.evidenceRefs),coreEvidence:null})),coverage:{outcome:'NOT_EXECUTED',reason:''},outcome:'NOT_EXECUTED',reason:''},reviewDirty:true,confirmation:{reason:'',acknowledged:false},failure:null};
}
export function recheckBaselineCommand(b:BaselineBuffer,s:DocumentSession):DocumentWrite {
 subject(b,s);const c=b.pending;if(!c||b.upload)throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');envelope(c,s);
 if(c.controlGeneration!==b.controlGeneration)throw new ApiError('BASELINE_BINDING_INVALID');
 if(c.operation==='confirmBaseline'){
  validateBaselineConfirmation(c.payload);
  if(!b.saved||b.dirty||b.reviewDirty||!same(b.input,b.saved.snapshot.input)||!same(c.payload.draftRef,b.saved.ref)||!same(c.payload.reason,b.confirmation.reason)||c.payload.acknowledged!==b.confirmation.acknowledged||c.targetId!==b.saved.ref.id||c.expectedVersion!==b.saved.ref.version)throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');return structuredClone(c);
 }
 if(c.operation!=='saveBaselineDraft'&&c.operation!=='reviewBaselineContent')throw new ApiError('BASELINE_BINDING_INVALID');
 return prepareBaselineCommand(b,s,c.operation);
}
export function prepareBaselineCommand(b:BaselineBuffer,s:DocumentSession,operation:BaselineOperation):DocumentWrite {
 subject(b,s);if(b.upload)throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');let payload:any,target:Ref|null;
 if(operation==='saveBaselineDraft'){validateBaselineInput(b.input);payload=b.input;target=b.input.baseRef;if(target!==null&&!same(b.saved?.ref,target))throw new ApiError('BASELINE_BINDING_INVALID');}
 else {
  if(!b.saved||b.dirty||!same(b.input,b.saved.snapshot.input)||b.saved.headVersion!==b.saved.ref.version||b.saved.currentCheck.state!=='MATCHED_METADATA')throw new ApiError('BASELINE_SAVED_DRAFT_REQUIRED');target=b.saved.ref;
  if(operation==='reviewBaselineContent'){validateBaselineReview(b.review);if(!same(b.review.draftRef,target)||b.review.items.length!==b.input.items.length||b.input.items.some(i=>{const reviewed=b.review!.items.find(v=>v.itemId===i.itemId);return !reviewed||reviewed.featureState!==i.featureState||i.evidenceRefs.some(a=>!reviewed.evidenceRefs.some(v=>same(v,a)));}))throw new ApiError('BASELINE_BINDING_INVALID');payload=b.review;}
  else if(operation==='confirmBaseline'){payload={draftRef:target,reviewRefs:[],reason:b.confirmation.reason,acknowledged:b.confirmation.acknowledged};throw new ApiError('BASELINE_REVIEW_REFRESH_REQUIRED');}
  else throw new ApiError('BASELINE_BINDING_INVALID');
 }
 const command:DocumentWrite={schemaVersion:1,projectId:b.projectId,commandId:b.pending?.commandId??crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation,targetId:target?.id??null,expectedVersion:target?.version??0,baselineRefs:[],approvalRef:null,payload:structuredClone(payload)};
 if(b.pending&&!same(b.pending,command))throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');return structuredClone(command);
}
export function prepareBaselineAdoption(b:BaselineBuffer,s:DocumentSession,d:BaselineDecision):DocumentWrite {
 subject(b,s);const r=d.reviews[0];
 if(b.upload||!b.saved||b.dirty||b.reviewDirty||!same(b.input,b.saved.snapshot.input)||d.projectId!==b.projectId||!same(d.draftRef,b.saved.ref)||!d.draftIsHead||d.currentCheck.state!=='MATCHED_METADATA'||!d.latestReviewAccepted||d.adoptedRef||!r||r.snapshot.input.outcome!=='ACCEPTED')throw new ApiError('BASELINE_REVIEW_REQUIRED');
 const payload={draftRef:b.saved.ref,reviewRefs:[r.ref],reason:b.confirmation.reason,acknowledged:b.confirmation.acknowledged};validateBaselineConfirmation(payload);
 const c:DocumentWrite={schemaVersion:1,projectId:b.projectId,commandId:b.pending?.commandId??crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'confirmBaseline',targetId:b.saved.ref.id,expectedVersion:b.saved.ref.version,baselineRefs:[],approvalRef:null,payload:{...payload}};
 if(b.pending&&!same(b.pending,c))throw new ApiError('BASELINE_RECONCILIATION_REQUIRED');return structuredClone(c);
}
async function draftSnapshot(s:any,r:Ref):Promise<void> {
 if(!exact(s,['schemaVersion','input','sourceBinding','evidenceBindings','issues','recordedBy','recordedAt','contentConfirmed',...flagKeys])||s.schemaVersion!==1||s.contentConfirmed!==false||!flagsFalse(s)||!exact(s.recordedBy,['kind','userId'])||s.recordedBy.kind!=='HUMAN'||!uuid(s.recordedBy.userId)||!timestamp(s.recordedAt))fail();
 validateBaselineInput(s.input);checkSourceBinding(s.sourceBinding,s.input);
 if(!same(s.evidenceBindings,s.input.items.map((i:any)=>({itemId:i.itemId,evidenceRefs:i.evidenceRefs})))||!same(s.issues,[{code:'CONTENT_REVIEW_REQUIRED',location:'items'},{code:'SOURCE_UNVERIFIED',location:'source'},{code:'COVERAGE_UNVERIFIED',location:'coverageReason'},{code:'EXECUTION_NOT_CONNECTED',location:'execution'}])||(r.version===1?s.input.baseRef!==null:!reference(s.input.baseRef)||s.input.baseRef.id!==r.id||s.input.baseRef.version!==r.version-1))fail();await snapshotHash(s,r);
}
async function reviewSnapshot(s:any,r:Ref):Promise<void>{if(!exact(s,['input','reviewedBy','reviewedAt','independence'])||!exact(s.reviewedBy,['kind','userId'])||s.reviewedBy.kind!=='HUMAN'||!uuid(s.reviewedBy.userId)||!timestamp(s.reviewedAt)||s.independence!=='NOT_CLAIMED'||r.version!==1)fail();validateBaselineReview(s.input);await snapshotHash(s,r);}
async function adoptionSnapshot(s:any,r:Ref):Promise<void>{
 if(!exact(s,['schemaVersion','kind','draftRef','input','sourceBinding','evidenceBindings','reviewRefs','previousBaselineRef','reason','acknowledged','adoptedBy','adoptedAt','contentConfirmed',...flagKeys])||s.schemaVersion!==1||s.kind!=='FEATURE_STATUS_V1'||s.contentConfirmed!==true||!flagsFalse(s)||!exact(s.adoptedBy,['kind','userId'])||s.adoptedBy.kind!=='HUMAN'||!uuid(s.adoptedBy.userId)||!timestamp(s.adoptedAt)||s.previousBaselineRef!==null&&!reference(s.previousBaselineRef))fail();
 validateBaselineInput(s.input);validateBaselineConfirmation({draftRef:s.draftRef,reviewRefs:s.reviewRefs,reason:s.reason,acknowledged:s.acknowledged});checkSourceBinding(s.sourceBinding,s.input);if(!same(s.evidenceBindings,s.input.items.map((i:any)=>({itemId:i.itemId,evidenceRefs:i.evidenceRefs}))))fail();await snapshotHash(s,r);
}
export async function sendBaselineCommand(client:ApiClient,c:DocumentWrite,s:DocumentSession):Promise<{ref:Ref;snapshot:any;observedAt:string}> {
 envelope(c,s);
 if(c.operation==='saveBaselineDraft')validateBaselineInput(c.payload);else if(c.operation==='reviewBaselineContent')validateBaselineReview(c.payload);else if(c.operation==='confirmBaseline')validateBaselineConfirmation(c.payload);else throw new ApiError('BASELINE_BINDING_INVALID');
 const target=c.operation==='saveBaselineDraft'?(c.payload as unknown as BaselineDraftInput).baseRef:(c.payload as unknown as {draftRef:Ref}).draftRef;
 if(c.targetId!==(target?.id??null)||c.expectedVersion!==(target?.version??0))throw new ApiError('BASELINE_BINDING_INVALID');
 const result=await postDocumentCommand(client,c,s.csrfToken),d=result.data,r=d?.ref;
 if(!reference(r)||result.targetId!==r.id||result.version!==r.version)fail();
 if(c.operation==='saveBaselineDraft'){if(d.status!=='BASELINE_DRAFT_STORED'||r.version!==c.expectedVersion+1||c.targetId!==null&&r.id!==c.targetId)fail();await draftSnapshot(d.snapshot,r);if(!same(d.snapshot.input,c.payload)||d.snapshot.recordedBy.userId!==s.user.id)fail();}
 else if(c.operation==='reviewBaselineContent'){if(d.status!=='BASELINE_CONTENT_REVIEWED')fail();await reviewSnapshot(d.snapshot,r);if(!same(d.snapshot.input,c.payload)||d.snapshot.reviewedBy.userId!==s.user.id)fail();}
 else{if(d.status!=='FEATURE_BASELINE_ADOPTED')fail();await adoptionSnapshot(d.snapshot,r);if(!same({draftRef:d.snapshot.draftRef,reviewRefs:d.snapshot.reviewRefs,reason:d.snapshot.reason,acknowledged:d.snapshot.acknowledged},c.payload)||d.snapshot.adoptedBy.userId!==s.user.id)fail();}
 return {ref:r,snapshot:d.snapshot,observedAt:result.serverReceivedAt};
}
export async function readBaselineDraft(client:ApiClient,pid:string,r:Ref):Promise<BaselineDraftView>{
 if(!reference(r))throw new ApiError('CLIENT_PATH_INVALID');const d:any=await client.get(`${base(pid)}/baseline-drafts/${r.id}/versions/${r.version}`);
 if(!exact(d,['projectId','ref','snapshot','headVersion','currentCheck','contentConfirmed',...flagKeys,'observedAt'])||d.projectId!==pid||!same(d.ref,r)||!Number.isSafeInteger(d.headVersion)||d.headVersion<r.version||d.contentConfirmed!==false||!flagsFalse(d)||!timestamp(d.observedAt))fail();checkCurrent(d.currentCheck);await draftSnapshot(d.snapshot,r);return d;
}
export async function readBaselineDecision(client:ApiClient,pid:string,r:Ref):Promise<BaselineDecision>{
 if(!reference(r))throw new ApiError('CLIENT_PATH_INVALID');const d:any=await client.get(`${base(pid)}/baseline-drafts/${r.id}/versions/${r.version}/decision`);
 if(!exact(d,['projectId','draftRef','criteriaVersion','reviews','hasMoreReviews','latestReviewAccepted','adoptedRef','draftIsHead','currentCheck','contentConfirmed',...flagKeys,'observedAt'])||d.projectId!==pid||!same(d.draftRef,r)||d.criteriaVersion!==1||!Array.isArray(d.reviews)||d.reviews.length>200||typeof d.hasMoreReviews!=='boolean'||typeof d.latestReviewAccepted!=='boolean'||typeof d.draftIsHead!=='boolean'||typeof d.contentConfirmed!=='boolean'||d.adoptedRef!==null&&!reference(d.adoptedRef)||!flagsFalse(d)||!timestamp(d.observedAt))fail();checkCurrent(d.currentCheck);
 let last=Infinity;const ids=new Set<string>();for(const v of d.reviews){if(!exact(v,['ref','snapshot','serverSequence'])||!reference(v.ref)||ids.has(v.ref.id)||!Number.isSafeInteger(v.serverSequence)||v.serverSequence<1||v.serverSequence>=last)fail();await reviewSnapshot(v.snapshot,v.ref);if(!same(v.snapshot.input.draftRef,r))fail();ids.add(v.ref.id);last=v.serverSequence;}
 if(d.latestReviewAccepted!==(d.reviews[0]?.snapshot.input.outcome==='ACCEPTED'))fail();return d;
}
async function adopted(d:any,pid:string,r?:Ref):Promise<any>{
 if(d?.projectId!==pid||!flagsFalse(d)||r&&!same(d.status==='LEGACY_UNVERIFIED'?d.legacyRef:d.ref,r))fail();
 if(d.status==='LEGACY_UNVERIFIED'){if(!exact(d,['projectId','status','ref','legacyRef','snapshot','contentConfirmed','currentCheck',...flagKeys])||d.ref!==null||!reference(d.legacyRef)||d.snapshot!==null||d.contentConfirmed!==false||d.currentCheck?.state!=='UNAVAILABLE')fail();checkCurrent(d.currentCheck);return d;}
 if(!exact(d,['projectId','status','ref','snapshot','currentCheck','currentContentReviewValid','contentConfirmed',...flagKeys,'observedAt'])||d.status!=='FEATURE_STATUS_V1'||!reference(d.ref)||d.contentConfirmed!==true||typeof d.currentContentReviewValid!=='boolean'||!timestamp(d.observedAt)||d.currentCheck?.state!=='MATCHED_METADATA'&&d.currentContentReviewValid)fail();checkCurrent(d.currentCheck);await adoptionSnapshot(d.snapshot,d.ref);return d;
}
export async function readCurrentBaseline(client:ApiClient,pid:string):Promise<any>{const d:any=await client.get(`${base(pid)}/baseline-current`);if(d?.status==='UNCONFIRMED'){if(!exact(d,['projectId','status','ref','contentConfirmed',...flagKeys])||d.projectId!==pid||d.ref!==null||d.contentConfirmed!==false||!flagsFalse(d))fail();return d;}return adopted(d,pid);}
export async function readAdoptedBaseline(client:ApiClient,pid:string,r:Ref):Promise<any>{if(!reference(r))throw new ApiError('CLIENT_PATH_INVALID');return adopted(await client.get(`${base(pid)}/baselines/${r.id}/versions/${r.version}`),pid,r);}
export async function listBaselineRecords(client:ApiClient,pid:string,kind:'drafts'|'adoptions',cursor:string|null):Promise<BaselinePage>{
 if(!['drafts','adoptions'].includes(kind)||cursor!==null&&(typeof cursor!=='string'||!cursor||cursor.length>4096))throw new ApiError('CLIENT_PATH_INVALID');const query=new URLSearchParams({limit:'50'});if(cursor!==null)query.set('cursor',cursor);
 const p:any=await client.get(`${base(pid)}/${kind==='drafts'?'baseline-drafts':'baselines'}?${query}`);
 if(!exact(p,['projectId','items','hasMore','nextCursor','metadataIntegrity',...flagKeys])||p.projectId!==pid||p.metadataIntegrity!=='NOT_RECHECKED'||!flagsFalse(p)||!Array.isArray(p.items)||p.items.length>50||typeof p.hasMore!=='boolean'||(p.hasMore?typeof p.nextCursor!=='string'||!p.nextCursor||p.nextCursor.length>4096:p.nextCursor!==null))fail();
 const ids=new Set<string>();for(const i of p.items){if(i?.status==='LEGACY_UNVERIFIED'){if(kind!=='adoptions'||!exact(i,['ref','legacyRef','status'])||i.ref!==null||!reference(i.legacyRef))fail();}else if(!exact(i,['ref','status'])||!reference(i.ref)||i.status!==(kind==='drafts'?'DRAFT':'STORED_ADOPTION_NOT_RECHECKED'))fail();const id=(i.ref??i.legacyRef).id;if(ids.has(id))fail();ids.add(id);}return p;
}
export async function prepareBaselineUpload(b:BaselineBuffer,s:DocumentSession,itemId:string,bytes:Uint8Array<ArrayBuffer>,mediaType:string):Promise<BaselineBuffer>{
 subject(b,s);if(b.pending||b.upload||bytes.length>20*1024*1024||typeof itemId!=='string'||!itemId.trim()||itemId.length>200||/[\u0000-\u001f\u007f]/.test(itemId)||b.input.items.filter(i=>i.itemId===itemId).length!==1||typeof mediaType!=='string'||!mediaType.trim()||mediaType.length>200||/[\u0000-\u001f\u007f]/.test(mediaType))throw new ApiError('BASELINE_UPLOAD_INPUT_INVALID');
 const copy=bytes.slice(),payload={bytes:copy.length,contentHash:await digestBytes(copy),mediaType};
 return {...structuredClone(b),upload:{itemId,bytes:copy,mediaType},pending:{schemaVersion:1,projectId:b.projectId,commandId:crypto.randomUUID(),clientId:s.clientId,controlGeneration:b.controlGeneration,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload},uncertain:false,failure:null};
}
export async function sendBaselineUpload(client:ApiClient,b:BaselineBuffer,s:DocumentSession):Promise<BaselineBuffer>{
 subject(b,s);const c=b.pending,u=b.upload;if(!c||!u)throw new ApiError('BASELINE_UPLOAD_INPUT_INVALID');envelope(c,s);
 if(b.uploadApproval&&!b.uploadApproval.commandHash||c.approvalRef!==null&&(!b.uploadApproval||b.uploadApproval.requestId!==c.approvalRef.requestId||b.uploadApproval.commandHash!==await digestBytes(new TextEncoder().encode(ordered(c)))))throw new ApiError('BASELINE_UPLOAD_APPROVAL_MISMATCH');
 if(c.operation!=='uploadArtifact'||c.targetId!==null||c.expectedVersion!==0||c.controlGeneration!==b.controlGeneration||!same(c.payload,{bytes:u.bytes.length,contentHash:await digestBytes(u.bytes),mediaType:u.mediaType})||!u.itemId.trim()||b.input.items.filter(i=>i.itemId===u.itemId).length!==1)throw new ApiError('BASELINE_UPLOAD_INPUT_INVALID');
 const result=await postDocumentCommand(client,c,s.csrfToken,u.bytes),a=result.data?.artifactRef;
 if(result.data?.status!=='ARTIFACT_READY'||!artifact(a)||!same({bytes:a.bytes,contentHash:a.contentHash,mediaType:a.mediaType},c.payload)||result.targetId!==a.artifactId||result.version!==null)fail();
 return {...b,pending:null,upload:null,uploadApproval:undefined,dirty:true,uncertain:false,failure:null,input:{...b.input,items:b.input.items.map(i=>i.itemId===u.itemId?{...i,evidenceRefs:[...i.evidenceRefs.filter(e=>e.artifactId!==a.artifactId),a]}:i)}};
}
export async function readBaselineEvidence(client:ApiClient,pid:string,r:BaselineEvidenceRef):Promise<Uint8Array<ArrayBuffer>>{
 if(!artifact(r))throw new ApiError('CLIENT_PATH_INVALID');let response:Response;
 try{response=await client.transport.call(globalThis,`${base(pid)}/files/${r.artifactId}`,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/octet-stream'}});}catch{throw new ApiError('CONNECTION_LOST');}
 if(!response.ok)throw new ApiError('ARTIFACT_READ_FAILED',response.status);const stream=response.body;if(!/^application\/octet-stream\b/i.test(response.headers.get('content-type')??'')||!stream)return fail();
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>r.bytes){await reader.cancel();throw new ApiError('ARTIFACT_INTEGRITY_FAILED');}chunks.push(v.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}if(size!==r.bytes||await digestBytes(bytes)!==r.contentHash)throw new ApiError('ARTIFACT_INTEGRITY_FAILED');return bytes;
}
