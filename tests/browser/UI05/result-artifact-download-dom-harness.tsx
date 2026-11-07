import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ResultReviewSources} from '../../../apps/web/src/features/session-detail/ResultReviewSources.tsx';
const w=window as any,seed=w.__artifactDownloadSeed;
const qa=w.__artifactDownloadQA={calls:[] as any[],mode:'NORMAL',releases:[] as (()=>void)[],cancelled:0,unavailable:[] as string[],authLost:0,created:[] as string[],revoked:[] as string[]};
const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
URL.createObjectURL=(blob:Blob)=>{const value=create(blob);qa.created.push(value);return value;};URL.revokeObjectURL=(value:string)=>{qa.revoked.push(value);revoke(value);};
function Harness(){
 const [session,setSession]=useState(seed.session),[result,setResult]=useState(seed.result),[shown,setShown]=useState(true),[revision,setRevision]=useState(0);
 qa.session=(value:any)=>flushSync(()=>setSession(value));qa.result=(value:any)=>flushSync(()=>setResult(value));qa.show=(value:boolean)=>flushSync(()=>setShown(value));
 const makeTransport=()=>async(path:any,options:any)=>{
  qa.calls.push({path:String(path),method:options?.method,credentials:options?.credentials,redirect:options?.redirect,cache:options?.cache,accept:options?.headers?.Accept});
  if(!String(path).includes('/files/'))throw Error('예상 밖 합성 요청');
  const mode=qa.mode;if(mode==='LOSS')throw Error('비밀 전송 오류');
  if(/^STATUS_/.test(mode))return new Response('비밀 서버 본문',{status:Number(mode.slice(7))});
  const id=String(path).split('/').at(-1),data=seed.files[id],bytes=new Uint8Array(mode==='HASH'?[1,2,3]:data);
  const response=()=>new Response(new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();},cancel(){qa.cancelled++;}}),{headers:{'content-type':mode==='TYPE'?'text/html':'application/octet-stream','content-disposition':'attachment; filename="unsafe.html"'}});
  if(mode==='DELAY')await new Promise<void>(resolve=>qa.releases.push(resolve));return response();
 };
 const client=useMemo(()=>new ApiClient(makeTransport()),[revision]);
 qa.client=()=>flushSync(()=>setRevision(v=>v+1));qa.transport=()=>{client.transport=makeTransport();flushSync(()=>setSession((v:any)=>({...v})));};
 return shown?<ResultReviewSources client={client} projectId={result.snapshot.scope.projectId} result={result} assignment={seed.assignment} criteria={{session,buffer:null,onChange:()=>{}}} onAuthenticationLost={()=>qa.authLost++} onAccessUnavailable={code=>qa.unavailable.push(code)}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
