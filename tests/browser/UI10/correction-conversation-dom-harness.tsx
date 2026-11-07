import React,{useMemo,useState} from 'react';import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgeCorrectionConversationSources} from '../../../apps/web/src/features/knowledge/KnowledgeCorrectionConversationSources.tsx';
const w=window as any,seed=w.__conversationSeed;
const qa=w.__conversationQA={mode:'NORMAL',calls:[] as string[],pending:false,release:null as null|(()=>void),hashSettled:0,buffer:seed.buffer,reject:false};
const digest=crypto.subtle.digest.bind(crypto.subtle),expected=new TextEncoder().encode(seed.serialized);
crypto.subtle.digest=async(algorithm,data)=>{const bytes=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data),target=bytes.length===expected.length&&bytes.every((v,i)=>v===expected[i]);const value=await digest(algorithm,data);if(target)qa.hashSettled++;return value;};
function Harness(){
 const [buffer,setBuffer]=useState(seed.buffer);qa.buffer=buffer;
 const client=useMemo(()=>new ApiClient(async(path,options)=>{
  const url=String(path);qa.calls.push((options?.method??'GET')+' '+url);if(options?.method!=='GET')throw Error('UNEXPECTED_WRITE');
  if(url.includes('/conversations?'))return Response.json(seed.conversations);
  if(url.includes('/messages?'))return Response.json(seed.messages);
  if(url.includes('/messages/')){
   if(qa.mode==='DENY')return Response.json({code:'CONVERSATION_READ_DENIED'},{status:403});
   const response=Response.json(qa.mode==='BAD_BODY'?{...seed.view,body:'변조본문'}:seed.view);
   if(qa.mode==='DELAY'){const json=response.json.bind(response);response.json=async()=>{qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);return json();};}return response;
  }throw Error('UNEXPECTED_QA_PATH');
 }),[]);
 return <><button type="button" onClick={()=>setBuffer({...buffer,body:'사용자가 조회중 변경한 본문'})}>QA 입력 변경</button><button type="button" onClick={()=>setBuffer({...buffer,uncertain:true})}>QA 결과 미확인</button><KnowledgeCorrectionConversationSources client={client} session={seed.session} buffer={buffer} disabled={false} isLocked={()=>false}
  onChange={change=>setBuffer((current:any)=>typeof change==='function'?change(qa.reject?{...current}:current):change)} onAuthenticationLost={()=>{throw Error('UNEXPECTED_AUTH');}}/></>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
