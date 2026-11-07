import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ReportedCommandEvidenceFiles} from '../../../apps/web/src/features/session-detail/ReportedCommandEvidenceFiles.tsx';

// Test-only entry, never imported by the product or a served application.
const w=window as any,seed=w.__anvilEvidenceSeed;
const qa=w.__anvilEvidenceQA={mode:'NORMAL',calls:[] as any[],pending:false,jsonConsumed:0,getSettled:0,release:null as null|(()=>void),unavailable:[] as string[],authLost:0};
class ObservedApiClient extends ApiClient{
 override async get<T=unknown>(path:string):Promise<T>{try{return await super.get<T>(path);}finally{qa.getSettled++;}}
}
function Harness(){
 const [denied,setDenied]=useState(false);
 const client=useMemo(()=>new ObservedApiClient(async(path,options)=>{
  qa.calls.push({path:String(path),method:options?.method,credentials:options?.credentials});
  if(qa.mode==='DENY')return Response.json({code:'ACCESS_DENIED'},{status:403});
  const response=Response.json(seed.file);
  if(qa.mode==='DELAY'){
   const json=response.json.bind(response);response.json=async()=>{
    qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);
    const value=await json();qa.jsonConsumed++;qa.pending=false;qa.release=null;return value;
   };
  }
  return response;
 }),[]);
 return denied?<p role="alert">조회 권한 회수됨 · 원문 숨김</p>:<ReportedCommandEvidenceFiles client={client} result={seed.result}
  onAuthenticationLost={()=>qa.authLost++} onAccessUnavailable={code=>{qa.unavailable.push(code);setDenied(true);}}/>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
