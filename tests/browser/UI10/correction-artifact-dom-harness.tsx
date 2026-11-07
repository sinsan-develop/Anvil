import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgeCorrectionArtifactSources} from '../../../apps/web/src/features/knowledge/KnowledgeCorrectionArtifactSources.tsx';
const w=window as any,seed=w.__artifactSeed;
const qa=w.__artifactQA={mode:'NORMAL',calls:[] as string[],buffer:seed.buffer,pending:false,consumed:0,release:null as null|(()=>void),reject:false};
function Harness(){
 const [buffer,setBuffer]=useState(seed.buffer);qa.buffer=buffer;
 const client=useMemo(()=>new ApiClient(async(path,options)=>{
  const url=String(path);qa.calls.push((options?.method??'GET')+' '+url);if(options?.method!=='GET')throw Error('UNEXPECTED_WRITE');
  if(url.includes('/imports?'))return Response.json(seed.list);
  if(url.includes('/imports/')){
   if(qa.mode==='DENY')return Response.json({code:'ARTIFACT_READ_DENIED'},{status:403});
   const response=Response.json(seed.candidate);if(qa.mode==='DELAY'){const json=response.json.bind(response);response.json=async()=>{qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);const value=await json();qa.consumed++;return value;};}return response;
  }
  if(url.includes('/files/'))return new Response(seed.body,{headers:{'content-type':'application/octet-stream'}});
  throw Error('UNEXPECTED_QA_PATH');
 }),[]);
 return <><button type="button" onClick={()=>setBuffer({...buffer,uncertain:true})}>QA 미확인 전환</button><KnowledgeCorrectionArtifactSources client={client} session={seed.session} buffer={buffer} disabled={false} isLocked={()=>false}
  onChange={change=>setBuffer((current:any)=>typeof change==='function'?change(qa.reject?{...current}:current):change)} onAuthenticationLost={()=>{throw Error('UNEXPECTED_AUTH');}}/></>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
