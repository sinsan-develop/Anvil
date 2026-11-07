import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {DraftArtifactsPanel} from '../../../apps/web/src/features/project-create/DraftArtifactsPanel.tsx';
import {DocumentsPage} from '../../../apps/web/src/features/design-trace/DocumentsPage.tsx';
import {parseRoute} from '../../../apps/web/src/shell/routes.ts';
import type {DocumentBuffer} from '../../../apps/web/src/features/design-trace/editor-api.ts';
const w=window as any,seed=w.__originalSeed;
const qa=w.__originalQA={buffer:null as DocumentBuffer|null,calls:[] as any[],authLost:0,mode:'NORMAL',waiting:false,release:null as null|(()=>void)};
function Harness(){
 const[buffer,setBuffer]=useState<DocumentBuffer|null>(seed.buffer),[draft,setDraft]=useState(seed.draft),[session,setSession]=useState(seed.session),[route,setRoute]=useState(()=>parseRoute(location.hash)),[shown,setShown]=useState(true),[clientVersion,setClientVersion]=useState(0);
 const client=useMemo(()=>new ApiClient(),[clientVersion]);
 useEffect(()=>{const update=()=>setRoute(parseRoute(location.hash));addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update);},[]);
 qa.buffer=buffer;qa.draft=draft;qa.sessionValue=session;qa.replace=(value:DocumentBuffer|null)=>flushSync(()=>setBuffer(value));qa.session=(value:unknown)=>flushSync(()=>setSession(value));qa.show=(value:boolean)=>flushSync(()=>setShown(value));qa.client=()=>flushSync(()=>setClientVersion(v=>v+1));qa.route=(value:string)=>{location.hash=value;flushSync(()=>setRoute(parseRoute(value)));};
 if(!shown)return <p>화면 이탈</p>;
 return route.screen==='documents'&&route.projectId?<DocumentsPage client={client} projectId={route.projectId} session={session} createdOriginal={route.createdOriginal} buffer={buffer} onChange={setBuffer} review={null} onReviewChange={()=>{}} confirmation={null} onConfirmationChange={()=>{}} onAuthenticationLost={()=>qa.authLost++}/>:<DraftArtifactsPanel protectedRecords={seed.records} onMetadata={()=>{}} client={client} session={session} buffer={draft} onChange={setDraft} disabled={false} readonly projectId={seed.project} run={async work=>{await work();}} onBusy={()=>{}} onAuthenticationLost={()=>qa.authLost++}/>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
