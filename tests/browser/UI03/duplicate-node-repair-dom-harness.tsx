import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {CommonMethodEditor} from '../../../apps/web/src/features/methodology-editor/CommonMethodEditor.tsx';
import {DraftMethodEditor} from '../../../apps/web/src/features/project-create/DraftMethodEditor.tsx';
import {emptyMethodBuffer,type MethodBuffer,type MethodGateway} from '../../../apps/web/src/features/methodology-editor/common-api.ts';
import {readMethodDraftFile} from '../../../apps/web/src/features/methodology-editor/method-draft-import.ts';
import type {DraftMethodSelection} from '../../../contracts/project-drafts.ts';

const w=window as any;
const owner='22222222-2222-4222-8222-222222222222',projectId='33333333-3333-4333-8333-333333333333';
const imported=readMethodDraftFile(JSON.stringify(w.__duplicateNodeSeed),'PROJECT');
type Authored=Extract<DraftMethodSelection,{kind:'NEW_PROJECT_DRAFT'}>;
const initialDraft:Authored={kind:'NEW_PROJECT_DRAFT',name:imported.name,purpose:imported.purpose,graph:imported.graph,sourceRefs:[{id:projectId,version:3,contentHash:'a'.repeat(64)}],reviewRefs:[]};
const qa:any=w.__duplicateNodeQA={common:null,draft:initialDraft,requests:[] as string[],authLost:0};
qa.confirmWithLock=(mode:'common'|'draft')=>{const native=window.confirm;window.confirm=()=>{window.confirm=native;flushSync(()=>qa[mode==='common'?'lockCommon':'lockDraft'](true));return true;};};
qa.confirmWithReplace=(mode:'common'|'draft',next:MethodBuffer|Authored)=>{const native=window.confirm;window.confirm=()=>{window.confirm=native;flushSync(()=>qa[mode==='common'?'replaceCommon':'replaceDraft'](next));return true;};};
qa.confirmWithUnmount=(mode:'common'|'draft')=>{const native=window.confirm;window.confirm=()=>{window.confirm=native;flushSync(()=>qa.hide(mode));return true;};};
const client=new ApiClient(async(input,init)=>{
 const key=(init?.method??'GET')+' '+String(input);qa.requests.push(key);
 if(key!=='GET /api/v1/forms')throw new Error('예상하지 않은 요청');
 return new Response(JSON.stringify({items:[],hasMore:false,nextCursor:null,baselineVersion:null,observedAt:'2026-10-25T00:00:00Z'}),{status:200,headers:{'Content-Type':'application/json'}});
});
const gateway:MethodGateway={prepare:async()=>{throw new Error('쓰기 금지');},write:async()=>{throw new Error('쓰기 금지');},read:async()=>{throw new Error('쓰기 금지');}};
function Harness(){
 const [common,setCommon]=useState<MethodBuffer>(emptyMethodBuffer()),[draft,setDraft]=useState<Authored>(initialDraft),[disabled,setDisabled]=useState(false);
 const [visible,setVisible]=useState({common:true,draft:true});qa.hide=(mode:'common'|'draft')=>setVisible(previous=>({...previous,[mode]:false}));
 qa.common=common;qa.draft=draft;
 qa.lockCommon=(locked:boolean)=>setCommon(prior=>({...prior,preparationId:locked?'qa-preparation':null}));
 qa.lockDraft=setDisabled;
 qa.replaceCommon=(next:MethodBuffer)=>setCommon(next);qa.replaceDraft=(next:Authored)=>setDraft(next);
 return <>
  {visible.common?<CommonMethodEditor client={client} session={{user:{id:owner},clientId:projectId,csrfToken:'c'.repeat(43)}} source={null} buffer={common} onChange={setCommon} onAuthenticationLost={()=>qa.authLost++} onSaved={()=>{throw new Error('저장 금지');}} gateway={gateway} projectId={projectId}/>:null}
  {visible.draft?<DraftMethodEditor client={client} value={draft} disabled={disabled} onChange={setDraft} onAuthenticationLost={()=>qa.authLost++}/>:null}
 </>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
