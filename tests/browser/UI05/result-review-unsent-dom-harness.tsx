import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {StoredCriteria} from '../../../apps/web/src/features/session-detail/ResultReviewSources.tsx';
import {resultReviewBufferKey,type ResultReviewBuffer} from '../../../apps/web/src/features/session-detail/result-review-write-api.ts';
import {ordered} from '../../../apps/web/src/features/knowledge/review-view.ts';

// 실제 화면/prepare/save와 App 방식 함수형 저장소를 소비하는 시험 전용 진입점.
const w=window as any,seed=w.__reviewUnsentSeed;
const qa=w.__reviewUnsentQA={buffers:{} as Record<string,ResultReviewBuffer|null>,calls:[] as any[],mode:'NORMAL',pending:false,release:null as null|(()=>void),defer:false,queued:null as null|(()=>void),views:{} as Record<string,unknown>,unexpected:[] as string[]};
async function hash(value:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ordered(value))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function Harness(){
 const [buffers,setBuffers]=useState<Record<string,ResultReviewBuffer|null>>({}),[shown,setShown]=useState(true),[session,setSession]=useState(seed.session);
 const key=resultReviewBufferKey(session,seed.result,seed.criteria);qa.buffers=buffers;qa.key=key;
 qa.show=(value:boolean)=>flushSync(()=>setShown(value));qa.session=(value:any)=>flushSync(()=>setSession(value));
 qa.replace=(value:ResultReviewBuffer|null)=>flushSync(()=>setBuffers(prior=>({...prior,[key]:value})));
 qa.put=(changedKey:string,value:ResultReviewBuffer|null)=>flushSync(()=>setBuffers(prior=>({...prior,[changedKey]:value})));
 const client=useMemo(()=>new ApiClient(async(path,options)=>{
  const url=String(path),method=options?.method??'GET',base='/api/v1/projects/'+seed.assignment.projectId;
  qa.calls.push({path:url,method,body:options?.body?JSON.parse(String(options.body)):null});
  if(url===base)return Response.json({id:seed.assignment.projectId,participation:'OWNER',controlState:{actorId:seed.session.user.id,clientId:seed.session.clientId,generation:3,status:'HELD'}});
  if(url===base+'/assignments/'+seed.assignment.ref.id+'/versions/1/result-criteria')return Response.json(seed.list);
  if(url===base+'/result-criteria/'+seed.criteria.ref.id+'/versions/1')return Response.json(seed.criteria);
  if(method==='POST'&&url===base+'/commands'){
   if(qa.mode==='DELAY'){qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);qa.pending=false;}
   if(qa.mode==='LOSS')throw new Error('synthetic connection loss');
   if(qa.mode==='REJECT')return Response.json({code:'VERSION_CONFLICT'},{status:409});
   const command=JSON.parse(String(options?.body)),at='2026-10-25T00:00:00.000Z',snapshot={scope:seed.result.snapshot.scope,input:command.payload,reviewedBy:{kind:'HUMAN',userId:seed.session.user.id,clientId:seed.session.clientId},sameAsSubmitter:seed.result.snapshot.submittedByRef.id===seed.session.user.id,reviewedAt:at,evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false},ref={id:seed.reviewId,version:1,contentHash:await hash(snapshot)},flags={reviewStored:true,completionAccepted:false,formalFailureCounted:false,evidenceProvenanceVerified:false,executionAuthorized:false,dispatchPerformed:false};
   qa.views[ref.id]={projectId:command.projectId,ref,snapshot,...flags,observedAt:at};
   return Response.json({commandId:command.commandId,operationId:seed.operationId,projectId:command.projectId,status:'APPLIED',targetId:ref.id,version:1,data:{ref,status:'RESULT_REVIEW_RECORDED',snapshot,...flags},serverReceivedAt:at});
  }
  if(url.startsWith(base+'/result-reviews/'))return Response.json(qa.views[url.slice(url.lastIndexOf('/')+1)]);
  qa.unexpected.push(url);throw Error('Unexpected synthetic transport');
 }),[]);
 return shown?<StoredCriteria client={client} assignment={seed.assignment} result={seed.result} session={session} reviews={{buffers,onChange:(changedKey,change)=>{
  const apply=()=>setBuffers(prior=>({...prior,[changedKey]:typeof change==='function'?change(prior[changedKey]??null):change}));
  if(qa.defer){qa.queued=apply;qa.defer=false;}else apply();
 }}} onAuthenticationLost={()=>{}} onAccessUnavailable={()=>{}}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
