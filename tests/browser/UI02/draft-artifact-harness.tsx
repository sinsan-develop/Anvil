import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ProjectCreatePage} from '../../../apps/web/src/features/project-create/ProjectCreatePage.tsx';
import {emptyDraft,type DraftEditorState} from '../../../apps/web/src/features/project-create/api.ts';
const w=window as any,seed=w.__fn01Seed;
const qa=w.__fn01QA={buffer:null as DraftEditorState|null,calls:[] as any[],mode:'NORMAL',waiting:false,release:null as null|(()=>void),authLost:0};
function Harness(){
 const[buffer,setBuffer]=useState<DraftEditorState>(seed.empty?emptyDraft():{...emptyDraft(),ownerUserId:seed.session.user.id,draftId:seed.draftId,version:1,wizardStep:2,input:seed.input}),[session,setSession]=useState(seed.session),[shown,setShown]=useState(true),[clientVersion,setClientVersion]=useState(0);
 qa.buffer=buffer;qa.replace=(v:DraftEditorState)=>flushSync(()=>setBuffer(v));qa.session=(v:unknown)=>flushSync(()=>setSession(v));qa.show=(v:boolean)=>flushSync(()=>setShown(v));qa.client=()=>flushSync(()=>setClientVersion(v=>v+1));
 const client=useMemo(()=>new ApiClient(),[clientVersion]);
 return shown?<ProjectCreatePage client={client} session={session} buffer={buffer} onChange={setBuffer} onAuthenticationLost={()=>qa.authLost++}/>:<p>조회 화면 이탈</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
