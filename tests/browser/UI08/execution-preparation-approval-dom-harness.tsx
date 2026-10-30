import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ApprovalsPage} from '../../../apps/web/src/features/decisions/ApprovalsPage.tsx';
import '../../../apps/web/src/styles/tokens.css';
import '../../../apps/web/src/styles/app.css';
const w=window as any,seed=w.__prepareSeed;
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
async function hash(v:any){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const qa=w.__prepareQA={calls:[] as any[],writes:[] as any[],buffer:null as any,view:structuredClone(seed.view),view2:structuredClone(seed.view2),next:seed.next??'NORMAL',decisionNext:'NORMAL',release:null as null|(()=>void),authLost:0,clientCreations:0,holdCrypto:false,cryptoRelease:null as null|(()=>void),cryptoRestored:false,restoreCrypto:()=>{},change:(_v:string)=>{}};
// 실제 digest 결과는 변경하지 않고 완료 반환만 대기한다. 새 페이지/명시 복구로 spy를 회수한다.
if(seed.cryptoHarness){const original=crypto.subtle.digest;qa.restoreCrypto=()=>{(crypto.subtle as any).digest=original;qa.cryptoRestored=crypto.subtle.digest===original;};(crypto.subtle as any).digest=async(...args:any[])=>{const result=await (original as any).apply(crypto.subtle,args);if(qa.holdCrypto){qa.holdCrypto=false;await new Promise<void>(r=>qa.cryptoRelease=r);}return result;};}
async function transport(input:any,init?:RequestInit):Promise<Response>{
 const path=String(input),method=init?.method??'GET',call={path,method,settled:false};qa.calls.push(call);const json=(v:any,status=200)=>{call.settled=true;return Response.json(v,{status});},base='/api/v1/projects/'+seed.projectId;
 if(method==='GET'&&path.startsWith(base+'/approvals?'))return json({items:[],hasMore:false,nextCursor:null,observedAt:seed.at});
 if(method==='GET'&&(path===base+'/approvals/'+seed.view.request.id||path===base+'/approvals/'+seed.view2.request.id)){const mode=qa.next;qa.next='NORMAL';if(mode==='DELAY')await new Promise<void>(r=>qa.release=r);if(mode==='FORBIDDEN')return json({code:'PROJECT_READ_DENIED'},403);const v=structuredClone(path.endsWith('/'+seed.view2.request.id)?qa.view2:qa.view);if(mode==='CORRUPT')v.candidatePreparation.payload.reason='원문 변조';if(mode==='DELAY_JSON')return{ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>{await new Promise<void>(r=>qa.release=r);call.settled=true;return v;}}as Response;return json(v);}
 if(method==='GET'&&path===base)return json(seed.project);
 if(method==='POST'&&path===base+'/commands'){
  const c=JSON.parse(String(init?.body));qa.writes.push(c);if(c.operation!=='decideApproval')return json({code:'UNEXPECTED_OPERATION'},500);const mode=qa.decisionNext;qa.decisionNext='NORMAL';const r=qa.view.request;
  const body={requestId:r.id,requestVersion:1,requestRef:qa.view.requestRef,scopeDigest:r.scopeDigest,decision:c.payload.decision,reason:c.payload.reason,decidedBy:r.requestedBy,controlGeneration:c.controlGeneration,policyRef:r.policyRef},ref={id:seed.decisionId,version:1,contentHash:await hash(body)},decision={ref,id:ref.id,...body,decidedAt:seed.at};qa.view={...qa.view,decision,currentVersion:2,storedStatus:c.payload.decision==='APPROVE'?'APPROVED':c.payload.decision==='REJECT'?'REJECTED':'CHANGE_REQUESTED',effectiveState:c.payload.decision==='APPROVE'?'APPROVED':c.payload.decision==='REJECT'?'REJECTED':'CHANGE_REQUESTED'};
  if(mode==='LOST'){call.settled=true;throw Error('SYNTHETIC_DECISION_RESPONSE_LOST');}
  return json({operationId:seed.operationId,commandId:c.commandId,projectId:seed.projectId,status:'APPLIED',targetId:ref.id,version:1,data:{ref,status:'APPROVAL_DECIDED',decision:{id:decision.id,...body,decidedAt:seed.at}},evidenceRefs:[],warnings:[],serverReceivedAt:seed.at});
 }
 return json({code:'UNEXPECTED_SYNTHETIC_PATH'},500);
}
function Harness(){const[context,setContext]=useState('A'),[buffer,setBuffer]=useState<any>(null);const session=useMemo(()=>context==='USER'?{...seed.session,user:{id:seed.otherUser}}:context==='CLIENT'?{...seed.session,clientId:seed.otherClient}:seed.session,[context]);const client=useMemo(()=>{qa.clientCreations++;return new ApiClient(transport);},[seed.stableClient?'STABLE':context]);const pid=context==='PROJECT'?seed.otherProject:seed.projectId;qa.buffer=buffer;qa.change=v=>flushSync(()=>setContext(v));return <ApprovalsPage client={client} projectId={pid} requestId={seed.view.request.id} session={session} buffer={buffer} onChange={setBuffer} candidate={null} onCandidateChange={()=>{}} onAuthenticationLost={()=>qa.authLost++}/>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
