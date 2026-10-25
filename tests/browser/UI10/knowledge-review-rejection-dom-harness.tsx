import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgeDecisionForm} from '../../../apps/web/src/features/knowledge/KnowledgeDecisionForm.tsx';
import {newKnowledgeDecision,type KnowledgeDecisionBuffer} from '../../../apps/web/src/features/knowledge/decision-api.ts';

// 실제 form/prepare/send를 소비하고 App의 함수형 저장소 경계를 그대로 재현한다.
const w=window as any,seed=w.__knowledgeReviewRejectionSeed;
const qa=w.__knowledgeReviewRejectionQA={buffer:null as KnowledgeDecisionBuffer|null,calls:[] as any[],mode:'REJECT',pending:false,release:null as null|(()=>void),defer:false,queued:null as null|(()=>void),unexpected:[] as string[],saved:0,authLost:0};
function Harness(){
 const [buffer,setBuffer]=useState<KnowledgeDecisionBuffer|null>(newKnowledgeDecision(seed.projectId,seed.view,seed.session,7,'REVIEW')),[shown,setShown]=useState(true),[session,setSession]=useState(seed.session),[clientVersion,setClientVersion]=useState(0),[changeVersion,setChangeVersion]=useState(0);
 qa.buffer=buffer;
 qa.show=(value:boolean)=>flushSync(()=>setShown(value));qa.session=(value:any)=>flushSync(()=>setSession(value));
 qa.replace=(value:KnowledgeDecisionBuffer|null)=>flushSync(()=>setBuffer(value));
 qa.mutate=(change:(value:KnowledgeDecisionBuffer)=>void)=>{if(qa.buffer)change(qa.buffer);};
 qa.client=()=>flushSync(()=>setClientVersion(v=>v+1));qa.change=()=>flushSync(()=>setChangeVersion(v=>v+1));
 qa.start=(kind:'REVIEW'|'CONFIRM'|'APPLY')=>flushSync(()=>{const b=newKnowledgeDecision(seed.projectId,kind==='APPLY'?seed.confirmed:seed.view,seed.session,7,kind);if(kind==='APPLY')b.applicationBaseRef=null;setBuffer(b);setSession(seed.session);setShown(true);});
 const client=useMemo(()=>new ApiClient(async(path,options)=>{
  const url=String(path),method=options?.method??'GET';qa.calls.push({path:url,method,body:options?.body?JSON.parse(String(options.body)):null});
  if(method!=='POST'||url!=='/api/v1/projects/'+seed.projectId+'/commands'){qa.unexpected.push(url);throw Error('Unexpected synthetic transport');}
  if(qa.mode==='DELAY'){qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);qa.pending=false;}
  if(qa.mode==='LOSS')throw Error('synthetic response loss');
  if(qa.mode==='REJECT')return Response.json({code:'KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED'},{status:412});
  const c=JSON.parse(String(options?.body));
  if(c.operation!=='recordContentReview'){qa.unexpected.push(c.operation);throw Error('Unexpected synthetic success operation');}
  return Response.json({operationId:seed.operationId,commandId:c.commandId,projectId:seed.projectId,status:'APPLIED',targetId:seed.view.ref.id,version:seed.view.ref.version,data:{status:'REVIEW_RECORDED',ref:seed.view.ref,reviewRef:{id:seed.reviewId,targetRef:seed.view.ref,criteriaVersion:1,outcome:c.payload.outcome}},serverReceivedAt:'2026-10-25T00:00:00.000Z'});
 }),[clientVersion]);
 const change=useMemo(()=>(value:any)=>{
  const apply=()=>setBuffer(previous=>typeof value==='function'?value(previous):value);
  if(qa.defer){qa.queued=apply;qa.defer=false;}else apply();
 },[changeVersion]);
 return shown&&buffer?<KnowledgeDecisionForm client={client} session={session} buffer={buffer} onChange={change} onSaved={()=>qa.saved++} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
