import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ManualResultReportForm} from '../../../apps/web/src/features/session-detail/ManualResultReportForm.tsx';
import {resultSubmissionKey} from '../../../apps/web/src/features/session-detail/result-submission-write-api.ts';
import type {ManualResultReport} from '../../../apps/web/src/features/session-detail/manual-result-report.ts';

// App과 같은 함수형 메모리 저장소를 쓰는 시험 진입점이며 서버·제품 hook은 없다.
const w=window as any,seed=w.__manualCancelSeed;
const qa=w.__manualCancelQA={calls:[] as any[],drafts:seed.drafts,buffer:seed.buffer,pending:false,release:null as null|(()=>void),defer:false,queued:null as null|(()=>void),authLost:0};
function Harness(){
 const [drafts,setDrafts]=useState<Record<string,ManualResultReport|null>>(seed.drafts),[occupied,setOccupied]=useState(false),[shown,setShown]=useState(true),[buffer,setBuffer]=useState(seed.buffer);
 const key=resultSubmissionKey(seed.session,seed.assignment.projectId,seed.assignment.ref);
 qa.drafts=drafts;qa.buffer=buffer;qa.key=key;
 qa.occupy=setOccupied;qa.show=setShown;qa.replace=(value:ManualResultReport|null)=>setDrafts(prior=>({...prior,[key]:value}));
 const client=useMemo(()=>new ApiClient(async(path,options)=>{
  qa.calls.push({path:String(path),method:options?.method});
  qa.pending=true;await new Promise<void>(resolve=>qa.release=resolve);qa.pending=false;
  return Response.json({id:seed.assignment.projectId,participation:'OWNER',controlState:{actorId:seed.session.user.id,clientId:seed.session.clientId,generation:3,status:'HELD'}});
 }),[]);
 return <>{shown?<ManualResultReportForm client={client} assignment={seed.assignment} session={seed.session} occupied={occupied||!!buffer} storage={{drafts,onChange:(changedKey,change)=>{
  const apply=()=>setDrafts(prior=>({...prior,[changedKey]:change(prior[changedKey]??null)}));
  if(qa.defer){qa.queued=apply;qa.defer=false;}else apply();
 }}} onPrepared={value=>setBuffer((old:any)=>old??value)} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
