import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgePage} from '../../../apps/web/src/features/knowledge/KnowledgePage.tsx';
import '../../../apps/web/src/styles/tokens.css';
import '../../../apps/web/src/styles/app.css';
const w=window as any,s=w.__scopeSearchSeed;
const qa=w.__scopeSearchQA={calls:[] as any[],unknown:[] as string[],deniedReads:[] as {context:string;path:string;method:string;status:number;response:{code:string}}[],posts:0,authLost:0,delay:false,deny:false,releases:[] as (()=>void)[],change:(_kind:string)=>{}};
function transport(context:string):typeof fetch{return async(input,init)=>{const path=String(input),method=init?.method??'GET',call={path,method,jsonStarted:false,settled:false},base='/api/v1/projects/'+s.pid;qa.calls.push(call);const json=(data:any,status=200)=>{const r=Response.json(data,{status}),read=r.json.bind(r);r.json=async()=>{call.jsonStarted=true;try{return await read();}finally{call.settled=true;}};return r;};if(method!=='GET'){qa.posts++;qa.unknown.push(method+' '+path);return json({code:'NOT_FOUND'},404);}
 if(context!=='A'||path.startsWith('/api/v1/projects/'+s.other)){
  const selected='/api/v1/projects/'+(context==='PROJECT'?s.other:s.pid),knowledge=selected+'/knowledge?query=%EC%A7%80%EC%97%B0&limit=50';
  const allowed=(context==='ACTOR'||context==='CLIENT')&&path===knowledge||context==='PROJECT'&&(path===knowledge||path===selected+'/conversations?limit=50');
  if(allowed){const response={code:'NOT_FOUND'};qa.deniedReads.push({context,path,method,status:404,response});return json(response,404);}
  qa.unknown.push(method+' '+path);return json({code:'UNEXPECTED_SYNTHETIC_REQUEST'},500);
 }
 if(path===base)return json(s.project);
 if(path===base+'/methodology-application')return qa.deny?json({code:'PROJECT_OPERATION_DENIED'},403):json(s.method);
 if(path===base+'/work-plans?limit=50')return json(s.plans);
 if(path===base+'/work-plans/'+s.plan.ref.id+'/versions/'+s.plan.ref.version)return json(s.plan);
 if(path===base+'/conversations?limit=50')return json({items:[],hasMore:false,nextCursor:null,observedAt:s.at});
 if(path.startsWith(base+'/knowledge?')){const url=new URL(path,'https://anvil.invalid'),scope=url.searchParams.get('scope'),cursor=url.searchParams.get('cursor'),query=url.searchParams.get('query');const value={items:scope?[{versionRef:{id:s.kid,version:1,contentHash:'b'.repeat(64)},title:query==='지연'?'늦은 검색 결과':cursor?'다음 범위 결과':'선택 범위 결과',kind:'FACT',state:'PROPOSED',sourceRefs:[],reasonSnippet:'범위 관련성'}]:[],hasMore:!!scope&&!cursor,nextCursor:scope&&!cursor?'scope-page-2':null,searchScope:'TITLE_REASON',observedAt:s.at};if(qa.delay){qa.delay=false;return{ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>{call.jsonStarted=true;await new Promise<void>(resolve=>qa.releases.push(resolve));call.settled=true;return value;}} as Response;}return json(value);}
 qa.unknown.push(method+' '+path);return json({code:'UNEXPECTED_SYNTHETIC_REQUEST'},500);
};}
function Harness(){const[context,setContext]=useState('A');const client=useMemo(()=>new ApiClient(transport(context)),[context]),session={user:{id:context==='ACTOR'?s.other:s.uid},clientId:context==='CLIENT'?s.other:s.uid,csrfToken:'C'.repeat(43)};qa.change=kind=>flushSync(()=>setContext(kind));return <KnowledgePage client={client} projectId={context==='PROJECT'?s.other:s.pid} session={session} buffer={null} onChange={()=>{throw Error('검색 중 작성buffer 변경 금지');}} conversationBuffer={null} onConversationChange={()=>{throw Error('검색 중 대화변경 금지');}} exclusion={null} onExclusionChange={()=>{}} correction={null} onCorrectionChange={()=>{}} decision={null} onDecisionChange={()=>{}} onAuthenticationLost={()=>qa.authLost++}/>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
