import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {DocumentsPage} from '../../../apps/web/src/features/design-trace/DocumentsPage.tsx';
import {editDocument} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import '../../../apps/web/src/styles/tokens.css';
import '../../../apps/web/src/styles/app.css';
const w=window as any,s=w.__documentProvenanceSeed;
const qa=w.__documentProvenanceQA={calls:[] as {path:string;method:string;jsonStarted:boolean;settled:boolean}[],unknown:[] as string[],posts:0,changes:0,authLost:0,deny:0,delay:false,optional:false,digestStarted:0,digestDone:0,releases:[] as (()=>void)[],buffer:null as any,change:(_kind:string)=>{}};
const digest=crypto.subtle.digest.bind(crypto.subtle);Object.defineProperty(crypto.subtle,'digest',{configurable:true,value:async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{qa.digestStarted++;try{return await digest(algorithm,data);}finally{qa.digestDone++;}}});
function transport(context:string):typeof fetch{return async(input,init)=>{const path=String(input),method=init?.method??'GET',call={path,method,jsonStarted:false,settled:false};qa.calls.push(call);const json=(value:any,status=200)=>{const r=Response.json(value,{status}),read=r.json.bind(r);r.json=async()=>{call.jsonStarted=true;try{return await read();}finally{call.settled=true;}};return r;};if(method!=='GET'){qa.posts++;qa.unknown.push(method+' '+path);return json({code:'UNEXPECTED_SYNTHETIC_REQUEST'},500);}const base='/api/v1/projects/'+s.pid;
 if(context==='PROJECT'&&path==='/api/v1/projects/'+s.other+'/documents?limit=50')return json({code:'NOT_FOUND'},404);
 if(path===base+'/documents?limit=50')return json({items:[{id:s.id,title:'고정 문서',headVersion:2,confirmedVersion:2,updatedAt:s.at}],hasMore:false,nextCursor:null,observedAt:s.at});
 if(path===base+'/documents/'+s.id+'/versions/1'||path===base+'/documents/'+s.id+'/versions/2'){if(qa.deny){const status=qa.deny;qa.deny=0;return json({code:status===401?'AUTH_REQUIRED':'PROJECT_OPERATION_DENIED'},status);}const version=path.endsWith('/1')?1:2,value=structuredClone(s.documents[version]);if(qa.optional){delete value.authorRef;delete value.createdAt;for(const event of value.statusHistory)delete event.actorRef;}if(qa.delay){qa.delay=false;return{ok:true,status:200,headers:new Headers({'content-type':'application/json'}),json:async()=>{call.jsonStarted=true;await new Promise<void>(resolve=>qa.releases.push(resolve));call.settled=true;return value;}} as Response;}return json(value);}
 if(path===base+'/files/'+s.aid){call.settled=true;return new Response(new Uint8Array(s.bytes),{headers:{'content-type':'application/octet-stream'}});}
 qa.unknown.push(method+' '+path);return json({code:'UNEXPECTED_SYNTHETIC_REQUEST'},500);
};}
function Harness(){const[context,setContext]=useState('A'),[buffer]=useState(()=>({...editDocument(s.pid,{document:s.documents[2],body:s.body},s.uid,7),body:'작성 중 원문 보존',reason:'미전송 이유',dirty:true})),client=useMemo(()=>new ApiClient(transport(context)),[context]);qa.buffer=buffer;qa.change=value=>flushSync(()=>setContext(value));const change=()=>{qa.changes++;throw Error('조회 중 버퍼 변경 금지');};return <DocumentsPage client={client} projectId={context==='PROJECT'?s.other:s.pid} session={{user:{id:context==='ACTOR'?s.other:s.uid},clientId:context==='CLIENT'?s.other:s.uid,csrfToken:'C'.repeat(43)}} buffer={buffer} onChange={change} review={null} onReviewChange={change} confirmation={null} onConfirmationChange={change} onAuthenticationLost={()=>qa.authLost++}/>;}
createRoot(document.getElementById('root')!).render(<Harness/>);
