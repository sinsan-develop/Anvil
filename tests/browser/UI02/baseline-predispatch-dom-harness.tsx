import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ProjectBaselinePanel} from '../../../apps/web/src/features/project-create/ProjectBaselinePanel.tsx';
import {newBaselineBuffer,type BaselineBuffer} from '../../../apps/web/src/features/project-create/baseline-api.ts';
import {digestBytes} from '../../../apps/web/src/features/project-create/baseline-validation.ts';
import {ordered} from '../../../apps/web/src/features/knowledge/review-view.ts';

const w=window as any,seed=w.__baselinePredispatchSeed;
const hash=(value:unknown)=>digestBytes(new TextEncoder().encode(ordered(value)));
const qa=w.__baselinePredispatchQA={buffer:null as BaselineBuffer|null,project:structuredClone(seed.project),calls:[] as any[],unexpected:[] as string[],controlMode:'NORMAL',postMode:'NORMAL',ordinal:0,armed:false,waiting:false,release:null as null|(()=>void),approval:null as any,authLost:0,defer:false,queued:null as null|(()=>void)};
function initial(){const b=newBaselineBuffer(seed.project.id,seed.session,7,null);b.input={...b.input,coverageReason:'기능 범위 원입력',reason:'초안 원입력',source:{...b.input.source,unverifiedReason:'소스 미확인 원입력'},items:[{itemId:'F1',title:'기능 원이름',designRef:null,featureState:'PARTIAL',evidenceRefs:[],reason:'분류 원이유',limitations:'원한계'}]};return b;}
const receipt=(c:any,data:any,targetId:string,version:number|null)=>({operationId:seed.operationId,commandId:c.commandId,projectId:c.projectId,status:'APPLIED',targetId,version,data,serverReceivedAt:seed.at});
function Harness(){
 const [buffer,setBuffer]=useState<BaselineBuffer|null>(initial),[shown,setShown]=useState(true),[session,setSession]=useState(seed.session),[projectId,setProjectId]=useState(seed.project.id),[clientVersion,setClientVersion]=useState(0);
 qa.buffer=buffer;
 qa.show=(value:boolean)=>flushSync(()=>setShown(value));qa.session=(value:any)=>flushSync(()=>setSession(value));qa.replace=(value:BaselineBuffer|null)=>flushSync(()=>setBuffer(value));qa.client=()=>flushSync(()=>setClientVersion(v=>v+1));qa.projectId=(value:string)=>flushSync(()=>setProjectId(value));
 qa.arm=(mode:string)=>{qa.ordinal=0;qa.armed=true;qa.controlMode=mode;};
 qa.reset=()=>{qa.project=structuredClone(seed.project);qa.calls=[];qa.armed=false;qa.controlMode='NORMAL';qa.postMode='NORMAL';qa.approval=null;qa.defer=false;qa.queued=null;flushSync(()=>{setShown(false);setSession(seed.session);setProjectId(seed.project.id);setBuffer(initial());});flushSync(()=>setShown(true));};
 qa.approve=async()=>{const v=qa.approval,r=v.request,body={requestId:r.id,requestVersion:1,requestRef:v.requestRef,scopeDigest:r.scopeDigest,decision:'APPROVE',reason:'합성 별도 사람 결정',decidedBy:r.requestedBy,controlGeneration:7,policyRef:r.policyRef};qa.approval={...v,decision:{ref:{id:seed.decisionId,version:1,contentHash:await hash(body)},id:seed.decisionId,...body,decidedAt:seed.at},currentVersion:2,storedStatus:'APPROVED',effectiveState:'APPROVED'};};
 const client=useMemo(()=>new ApiClient(async(input,init)=>{
  const path=String(input),method=init?.method??'GET',headers=new Headers(init?.headers),command=headers.has('X-Anvil-Command')?JSON.parse(headers.get('X-Anvil-Command')!):method==='POST'?JSON.parse(String(init?.body)):null;
  const call={path,method,command,bytes:headers.has('X-Anvil-Command')?Array.from(new Uint8Array(await new Response(init?.body).arrayBuffer())):null};qa.calls.push(call);
  if(method==='GET'&&/^\/api\/v1\/projects\/[a-f0-9-]+$/.test(path)){
   const ordinal=qa.armed?++qa.ordinal:0;
   if(ordinal===2){if(qa.controlMode==='DELAY'){qa.waiting=true;await new Promise<void>(resolve=>qa.release=resolve);qa.waiting=false;}if(qa.controlMode==='LOSS')throw Error('synthetic control response loss');if(qa.controlMode==='DENY')return Response.json({code:'PROJECT_CONTROL_REQUIRED'},{status:403});if(qa.controlMode==='STALE')return Response.json({...qa.project,controlState:{...qa.project.controlState,generation:8}});}
   return Response.json({...qa.project,id:path.split('/').at(-1)});
  }
  if(method==='POST'&&path.endsWith('/files')){
   if(qa.postMode==='LOSS')throw Error('synthetic upload response loss');
   if(qa.postMode==='INVALID')return Response.json(receipt(command,{status:'ARTIFACT_READY',artifactRef:{artifactId:seed.artifactId,...command.payload,contentHash:'b'.repeat(64)}},seed.artifactId,null));
   if(qa.postMode==='APPROVAL')return Response.json({code:'APPROVAL_REQUIRED'},{status:412});
   return Response.json(receipt(command,{status:'ARTIFACT_READY',artifactRef:{artifactId:seed.artifactId,...command.payload}},seed.artifactId,null));
  }
  if(method==='GET'&&path.endsWith('/permission-policy'))return Response.json({configured:true,policy:seed.policy});
  if(method==='GET'&&path.endsWith('/approvals/'+seed.requestId))return Response.json(qa.approval);
  if(method==='POST'&&path.endsWith('/commands')&&command.operation==='requestApproval'){
   const details=command.payload.details,scopeDigest=await hash(details.actionScope),snapshot={projectId:seed.project.id,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:seed.session.user.id},policyRef:seed.policy.ref,requestedBy:{kind:'HUMAN',userId:seed.session.user.id,clientId:seed.session.clientId},controlGeneration:7},ref={id:seed.requestId,version:1,contentHash:await hash(snapshot)},request={id:seed.requestId,version:1,status:'PENDING',...snapshot,createdAt:seed.at};
   qa.approval={request,requestRef:ref,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:seed.at};
   return Response.json(receipt(command,{status:'APPROVAL_REQUESTED',ref,request},seed.requestId,1));
  }
  qa.unexpected.push(method+' '+path);throw Error('Unexpected synthetic transport');
 }),[clientVersion]);
 const change=useMemo(()=>(value:any)=>{const apply=()=>setBuffer(previous=>typeof value==='function'?value(previous):value);if(qa.defer){qa.defer=false;qa.queued=apply;}else apply();},[]);
 return shown?<ProjectBaselinePanel client={client} projectId={projectId} session={session} buffer={buffer} onChange={change} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
