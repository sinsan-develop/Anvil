type Mode='NORMAL'|'AUTO'|'QUARANTINE'|'UNKNOWN'|'LOST_UPLOAD'|'LOST_REQUEST'|'SAVE_DENIED';
type QA=any;
declare global {interface Window {__importUploadQA:QA;__importUploadMode:Mode}}
import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '/apps/web/src/api/client.ts';
import {DocumentImport} from '/apps/web/src/features/design-trace/DocumentImport.tsx';
import type {DocumentBuffer,DocumentWrite} from '/apps/web/src/features/design-trace/editor-api.ts';
import type {ApprovalView,ApprovalCommand} from '/apps/web/src/features/decisions/api.ts';
import {ordered} from '/apps/web/src/features/knowledge/review-view.ts';
import {digestBytes} from '/apps/web/src/features/project-create/baseline-validation.ts';
const pid='ae600000-0000-4000-8000-000000000001',uid='ae600000-0000-4000-8000-000000000002',device='ae600000-0000-4000-8000-000000000003',rid='ae600000-0000-4000-8000-000000000004',did='ae600000-0000-4000-8000-000000000005',aid='ae600000-0000-4000-8000-000000000006',at='2026-10-26T00:00:00.000Z';
const mode=window.__importUploadMode,h=(v:unknown)=>digestBytes(new TextEncoder().encode(ordered(v)));
type Plan={target:'upload'|'approval'|'policy'|'control';status?:number;delayJSON?:boolean;delayHash?:boolean};
const plans:Plan[]=[],releases=new Map<number,()=>void>();let releaseHash=()=>{},holdNextHash=false;
const qa=window.__importUploadQA={uploads:[],commands:[],unknown:[],saved:0,authLost:0,calls:[],hashStarted:false,enqueue:(p:Plan)=>plans.push(p),release:(i:number)=>releases.get(i)?.(),releaseHash:()=>releaseHash(),set:()=>{},approve:async()=>{},existing:async()=>{},invalidate:()=>{}};
const realDigest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{if(holdNextHash){holdNextHash=false;qa.hashStarted=true;await new Promise<void>(resolve=>releaseHash=resolve);}return realDigest(...args);};
const policyBody={rules:[{ruleId:'UPLOAD',subjectRef:{kind:'HUMAN',userId:uid},operations:['uploadArtifact'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:new Date(Date.now()+300000).toISOString()}],reason:'원문 업로드 승인',reviewRefs:[]};
let view:ApprovalView|null=null,requestReceipt:unknown=null,lostRequest=false,lostUpload=false,unknown=false;
const policyRef={id:aid,version:1,contentHash:''};
const details=()=>({reason:'정확 원문 보관',risks:{data:'합성 원문',security:'현재 권한 확인',cost:'없음',interruption:'없음',unverified:'DB 미확인'},rollback:{method:'원문 보존',limitations:'자동 삭제 안 함',evidenceRefs:[]},expiresAt:new Date(Date.now()+60000).toISOString()});
async function request(c:ApprovalCommand){const body={projectId:pid,details:c.payload.details,scopeDigest:await h(c.payload.details.actionScope),requiredDecider:{kind:'HUMAN' as const,userId:uid},policyRef,requestedBy:{kind:'HUMAN' as const,userId:uid,clientId:device},controlGeneration:4},requestRef={id:rid,version:1,contentHash:await h(body)};view={request:{id:rid,version:1,status:'PENDING',...body,createdAt:at},requestRef,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at};return{ref:requestRef,status:'APPROVAL_REQUESTED',request:view.request};}
qa.approve=async()=>{if(!view)throw Error('요청 없음');const body={requestId:rid,requestVersion:1,requestRef:view.requestRef,scopeDigest:view.request.scopeDigest,decision:'APPROVE' as const,reason:'별도 사람 결정',decidedBy:view.request.requestedBy,controlGeneration:4,policyRef};view={...view,currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED',decision:{id:did,...body,ref:{id:did,version:1,contentHash:await h(body)},decidedAt:at}};};
qa.existing=async()=>{const c=qa.uploads[0].command;await request({...c,operation:'requestApproval',payload:{details:{...details(),candidateCommandId:c.commandId,actionScope:{operation:'uploadArtifact',targetRef:null,expectedVersion:0,payloadHash:await h(c.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:uid,clientId:device},controlGeneration:4}}}});await qa.approve();};
qa.invalidate=(kind:string)=>{if(!view)throw Error('요청 없음');if(kind==='EXPIRED'){view.expired=true;view.effectiveState='EXPIRED';}if(kind==='REVOKED'){view.basisCurrent=false;view.effectiveState='REVOKED';}if(kind==='OTHER_CONSUMED'){view.currentVersion=3;view.storedStatus='CONSUMED';view.effectiveState='CONSUMED';view.consumption={id:aid,status:'CONSUMED',commandId:aid,serverCommandId:aid,requestHash:'b'.repeat(64),scopeDigest:view.request.scopeDigest,policyRef,consumedAt:at};}};
const receipt=(c:DocumentWrite,data:unknown,targetId:string,version:number|null)=>({operationId:aid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId,version,serverReceivedAt:at,data});
const clients=[0,1].map(()=>new ApiClient(async(path,init)=>{
 const url=String(path),method=init?.method??'GET',index=qa.calls.length,call={path:url,started:false,settled:false};qa.calls.push(call);
 const take=(target:Plan['target'])=>{const i=plans.findIndex(p=>p.target===target);return i<0?undefined:plans.splice(i,1)[0];};
 const reply=(value:unknown,status=200,plan?:Plan)=>{const r=Response.json(plan?.status?{code:plan.status===401?'AUTH_REQUIRED':'ACCESS_DENIED'}:value,{status:plan?.status??status}),json=r.json.bind(r);r.json=async()=>{call.started=true;if(plan?.delayJSON)await new Promise<void>(resolve=>releases.set(index,resolve));if(plan?.delayHash)holdNextHash=true;try{return await json();}finally{call.settled=true;}};return r;};
 if(method==='POST'&&url.endsWith('/files')){
  const c:DocumentWrite=JSON.parse(new Headers(init.headers).get('X-Anvil-Command')!),bytes=Array.from(new Uint8Array(await new Response(init.body).arrayBuffer()));qa.uploads.push({command:c,body:bytes});const plan=take('upload');
  if(mode==='UNKNOWN'&&!unknown){unknown=true;throw Error('원 업로드 결과 불명');}
  if(c.approvalRef===null&&mode!=='AUTO'&&mode!=='QUARANTINE')return reply({code:'APPROVAL_REQUIRED'},412,plan);
  const artifactRef={artifactId:aid,...c.payload};
  if(mode==='QUARANTINE')return reply(receipt(c,{status:'ARTIFACT_QUARANTINED',artifactRef,inspection:{policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'SUSPECTED',reasonCodes:['SECRET_ASSIGNMENT_MARKER']}},aid,null),200,plan);
  if(mode==='LOST_UPLOAD'&&!lostUpload){lostUpload=true;if(!view)throw Error('승인 없음');view={...view,currentVersion:3,storedStatus:'CONSUMED',effectiveState:'CONSUMED',consumption:{id:aid,status:'CONSUMED',commandId:c.commandId,serverCommandId:aid,requestHash:await h(c),scopeDigest:view.request.scopeDigest,policyRef,consumedAt:at}};throw Error('동일 소비 업로드 응답 유실');}
  return reply(receipt(c,{status:'ARTIFACT_READY',artifactRef},aid,null),200,plan);
 }
 if(method==='POST'&&url.endsWith('/commands')){
  const c=JSON.parse(String(init.body));qa.commands.push(c);
  if(c.operation==='requestApproval'){requestReceipt??=receipt(c,await request(c),rid,1);if(mode==='LOST_REQUEST'&&!lostRequest){lostRequest=true;throw Error('승인 요청 응답 유실');}return reply(requestReceipt);}
  if(c.operation==='importDocument'){if(mode==='SAVE_DENIED')return reply({code:'DOCUMENT_APPROVAL_NOT_CONNECTED'},412);qa.saved++;const candidate={id:did,originalRef:c.payload.fileRef,extractedContentRef:c.payload.fileRef,intendedFormRef:c.payload.intendedFormRef,parserVersion:'UTF8_IDENTITY_1',status:'READY',issues:[],losses:[]};return reply(receipt(c,{status:'IMPORT_CANDIDATE',candidate},aid,null));}
 }
 if(url.endsWith('/permission-policy'))return reply({configured:true,policy:{ref:policyRef,...policyBody,createdAt:at}},200,take('policy'));
 if(url.endsWith('/approvals/'+rid))return reply(view,200,take('approval'));
 if(url==='/api/v1/projects/'+pid)return reply({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:device,generation:4}},200,take('control'));
 qa.unknown.push(method+' '+url);return reply({code:'UNEXPECTED_QA_API'},503);
}));
const initial:DocumentBuffer={ownerUserId:uid,projectId:pid,documentId:null,baseVersion:0,formRef:{id:uid,version:1,contentHash:'a'.repeat(64)},title:'원문 승인 문서',body:'기존 편집 입력',mediaType:'text/markdown;charset=utf-8',content:{attachments:[],sections:[],sourceRefs:[]},criteria:[],reason:'사람이 명시한 개정',controlGeneration:4,dirty:true,pending:null,savedRef:null,failure:null};let restore:DocumentBuffer|null=null;
function Harness(){const [buffer,setBuffer]=useState<DocumentBuffer|null>(initial),[user,setUser]=useState(uid),[clientId,setClientId]=useState(device),[object,setObject]=useState(0),[shown,setShown]=useState(true),[csrf,setCsrf]=useState('C'.repeat(43));qa.snapshot=()=>structuredClone(buffer);
 const session=useMemo(()=>({user:{id:user},clientId,csrfToken:csrf}),[user,clientId,csrf]);
 qa.set=(kind:string,side:string)=>flushSync(()=>{if(kind==='csrf')setCsrf((side==='B'?'D':'C').repeat(43));if(kind==='clone')setBuffer(b=>b?structuredClone(b):b);if(kind==='user')setUser(side==='B'?aid:uid);if(kind==='device')setClientId(side==='B'?aid:device);if(kind==='client')setObject(side==='B'?1:0);if(kind==='hide')setShown(side!=='B');if(kind==='buffer'||kind==='generation')setBuffer(b=>{if(side==='B'){restore=b;return b?{...b,body:kind==='buffer'?'다른 미저장 입력':b.body,controlGeneration:kind==='generation'?5:b.controlGeneration}:b;}return restore;});});
 return shown&&buffer?<><textarea aria-label="보존한 편집 본문" readOnly value={buffer.body}/><DocumentImport client={clients[object]!} session={session} buffer={buffer} onChange={setBuffer} onAuthenticationLost={()=>qa.authLost++}/></>:<p>다른 화면</p>;}
void h(policyBody).then(value=>{policyRef.contentHash=value;createRoot(document.getElementById('root')!).render(<Harness/>);});
