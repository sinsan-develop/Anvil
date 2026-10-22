import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgeCorrectionDocumentSources} from '../../../apps/web/src/features/knowledge/KnowledgeCorrectionDocumentSources.tsx';
const w=window as any,seed=w.__correctionSeed;
const qa=w.__correctionQA={reject:false,calls:[] as string[],buffer:seed.buffer};
function Harness(){
 const [buffer,setBuffer]=useState(seed.buffer);qa.buffer=buffer;
 const client=useMemo(()=>new ApiClient(async(path,options)=>{
  qa.calls.push((options?.method??'GET')+' '+String(path));
  if(options?.method!=='GET')throw Error('UNEXPECTED_WRITE');
  if(String(path).includes('/documents?'))return Response.json(seed.list);
  if(String(path).includes('/documents/'))return Response.json(seed.document);
  if(String(path).includes('/files/'))return new Response(seed.body,{headers:{'content-type':'application/octet-stream'}});
  throw Error('UNEXPECTED_QA_PATH');
 }),[]);
 return <KnowledgeCorrectionDocumentSources client={client} session={seed.session} buffer={buffer} disabled={false} isLocked={()=>false}
  onChange={change=>setBuffer((current:any)=>typeof change==='function'?change(qa.reject?{...current}:current):change)} onAuthenticationLost={()=>{throw Error('UNEXPECTED_AUTH');}}/>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
