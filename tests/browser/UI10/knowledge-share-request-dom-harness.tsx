import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgePage} from '../../../apps/web/src/features/knowledge/KnowledgePage.tsx';
import {App} from '../../../apps/web/src/App.tsx';
import '../../../apps/web/src/styles/tokens.css';
import '../../../apps/web/src/styles/app.css';
import {newKnowledge} from '../../../apps/web/src/features/knowledge/api.ts';
import type {KnowledgeShareRequestBuffer,KnowledgeShareChange} from '../../../apps/web/src/features/knowledge/knowledge-share-request-api.ts';
const w=window as any,seed=w.__shareSeed;
function canonical(v:any):string{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
async function hash(v:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(v))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const qa=w.__shareQA={calls:[] as any[],writes:[] as any[],unknown:[] as string[],buffer:null as KnowledgeShareRequestBuffer|null,records:new Map<string,any>(),next:'NORMAL',originalMode:'NORMAL',originalReleases:new Map<number,()=>void>(),unavailable:false,sourceState:'PROPOSED',generation:1,authLost:0,releases:new Map<number,()=>void>(),change:(_value:string)=>{},reset:()=>{}};
if(seed.requests)for(const v of seed.requests)qa.records.set(v.requestRef.id,v);
const minimum=(v:any)=>({requestRef:v.requestRef,state:'RECORDED_ONLY',currentCheck:'UNAVAILABLE',reasonCode:'SOURCE_OR_TARGET_UNAVAILABLE',transferPerformed:false,sharedEventCreated:false,approvalConsumed:false,executionAuthorized:false});
async function transport(input:any,init?:RequestInit):Promise<Response>{
 const path=String(input),method=init?.method??'GET',call={path,method,jsonStarted:false,settled:false},index=qa.calls.length;qa.calls.push(call);
 const base='/api/v1/projects/'+seed.projectId;
 const json=(value:any,status=200)=>{call.settled=true;return Response.json(value,{status});};
 if(method==='GET'&&path==='/api/v1/session')return json({...seed.session,user:{id:seed.session.user.id,displayName:'합성 요청자'}});
 if(method==='GET'&&path===base)return json({...seed.project,controlState:{...seed.project.controlState,generation:qa.generation}});
 if(method==='GET'&&path.startsWith('/api/v1/projects?'))return json({items:[{id:seed.targetId,name:'허가된 합성 대상',purpose:'현재 읽기 허가만',version:1,updatedAt:seed.at}],hasMore:false,nextCursor:null,observedAt:seed.at,baselineVersion:null});
 if(method==='GET'&&path.startsWith(base+'/conversations?'))return json({items:[],hasMore:false,nextCursor:null,observedAt:seed.at});
 if(method==='GET'&&path.startsWith(base+'/knowledge?'))return json({items:[{versionRef:seed.knowledge.ref,title:seed.knowledge.entry.title,kind:'FACT',sourceRefs:[],reasonSnippet:seed.knowledge.entry.reason,state:qa.sourceState}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:seed.at});
 if(method==='GET'&&path===base+'/knowledge/'+seed.knowledge.ref.id+'/versions/1'){
  const mode=qa.originalMode;qa.originalMode='NORMAL';
  if(mode==='DELAY')await new Promise<void>(resolve=>qa.originalReleases.set(index,resolve));
  if(mode==='FORBIDDEN')return json({code:'SOURCE_FORBIDDEN'},403);
  if(mode==='UNAUTHORIZED')return json({code:'SESSION_EXPIRED'},401);
  const value={...seed.knowledge,state:qa.sourceState,headVersion:qa.sourceState==='SUPERSEDED'?2:1,history:qa.sourceState==='EXCLUDED'?[...seed.knowledge.history,{id:seed.otherProject,kind:'EXCLUDED',reason:'합성 사용 제외',actorRef:{kind:'HUMAN',userId:seed.session.user.id},recordedAt:seed.at}]:seed.knowledge.history};
  if(mode==='WRONG_REF')value.ref={...value.ref,id:seed.otherProject};
  if(mode==='WRONG_HASH')value.entry={...value.entry,reason:'변조된 선언'};
  if(mode==='WRONG_BODY')value.body='변조된 본문';
  if(mode==='QUARANTINED')value.redactionState='QUARANTINED';
  return json(value);
 }
 if(method==='POST'&&path===base+'/commands'){
  const c=JSON.parse(String(init?.body));qa.writes.push(c);if(c.operation!=='requestKnowledgeShare'){qa.unknown.push(path+':'+c.operation);return json({code:'UNEXPECTED_OPERATION'},500);}
  let view=qa.records.get(c.commandId);
  if(!view){const snapshot={projectId:c.projectId,createdBy:seed.session.user.id,clientId:c.clientId,controlGeneration:c.controlGeneration,versionRefs:c.payload.versionRefs,explicitTargets:c.payload.explicitTargets.map((t:any)=>({...t,version:1})),purpose:c.payload.purpose,policyRef:seed.policyRef,recordedAt:seed.at};view={requestRef:{id:seed.requestId,version:1,contentHash:await hash(snapshot)},state:'RECORDED_ONLY',recordedAt:seed.at,currentCheck:'METADATA_ELIGIBLE',snapshot,transferPerformed:false,sharedEventCreated:false,approvalConsumed:false,executionAuthorized:false};qa.records.set(c.commandId,view);}
  const mode=qa.next;qa.next='NORMAL';if(mode==='LOST'){call.settled=true;throw Error('SYNTHETIC_RESPONSE_LOST');}
  const result={operationId:seed.requestId,commandId:c.commandId,projectId:c.projectId,status:'APPLIED',targetId:seed.requestId,version:1,data:{ref:view.requestRef,request:qa.unavailable?minimum(view):view},evidenceRefs:[],warnings:[],serverReceivedAt:seed.at};
  if(mode==='DELAY_JSON')return{ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>{call.jsonStarted=true;await new Promise<void>(resolve=>qa.releases.set(index,resolve));call.settled=true;return result;}} as Response;
  return json(result);
 }
 if(method==='GET'&&path.startsWith(base+'/knowledge-share-requests?')){const items=[...qa.records.values()].map(v=>qa.unavailable?minimum(v):v);return json({items,hasMore:false,nextCursor:null,observedAt:seed.at});}
 if(method==='GET'&&path.startsWith(base+'/knowledge-share-requests/')){const view=seed.requests?[...qa.records.values()].find(v=>path===base+'/knowledge-share-requests/'+v.requestRef.id+'/versions/1?contentHash='+v.requestRef.contentHash):path.startsWith(base+'/knowledge-share-requests/'+seed.requestId+'/versions/1?')?[...qa.records.values()][0]:null;return view?json(qa.unavailable?minimum(view):view):json({code:'NOT_FOUND'},404);}
 qa.unknown.push(method+' '+path);return json({code:'UNEXPECTED_SYNTHETIC_REQUEST'},500);
}
w.__shareTransport=transport;
function Harness(){
 const[context,setContext]=useState('A'),[epoch,setEpoch]=useState(0),[buffer,setBuffer]=useState<KnowledgeShareRequestBuffer|null>(null);
 const session=useMemo(()=>context==='B'?{...seed.session,user:{id:seed.otherUser}}:context==='CLIENT'?{...seed.session,clientId:seed.otherClient}:seed.session,[context]);
 const pid=context==='PROJECT'?seed.otherProject:seed.projectId;
 const client=useMemo(()=>new ApiClient(transport),[context,epoch]);
 const saved=useMemo(()=>({...newKnowledge(pid,session,1),title:seed.knowledge.entry.title,body:seed.knowledge.body,reason:seed.knowledge.entry.reason,resultRef:seed.knowledge.ref,dirty:false}),[pid,session,epoch]);
 qa.buffer=buffer;qa.change=value=>flushSync(()=>setContext(value));qa.reset=()=>flushSync(()=>{setBuffer(null);setContext('A');setEpoch(v=>v+1);qa.writes=[];qa.calls=[];qa.unknown=[];qa.records.clear();qa.next='NORMAL';qa.unavailable=false;qa.sourceState='PROPOSED';qa.generation=1;});
 const share=(change:KnowledgeShareChange)=>setBuffer(previous=>typeof change==='function'?change(previous):change);
 return <KnowledgePage key={epoch} client={client} projectId={pid} session={session} buffer={saved} onChange={()=>{}} conversationBuffer={null} onConversationChange={()=>{}} exclusion={null} onExclusionChange={()=>{}} correction={null} onCorrectionChange={()=>{}} decision={null} onDecisionChange={()=>{}} shareBuffer={buffer} onShareChange={share} onAuthenticationLost={()=>qa.authLost++}/>;
}
createRoot(document.getElementById('root')!).render(seed.mode==='APP'?<App/>:<Harness/>);