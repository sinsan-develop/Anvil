import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {CommonFormEditor} from '../../../apps/web/src/features/methodologies/CommonFormEditor.tsx';
import {getPinnedForm,type FormVersion} from '../../../apps/web/src/features/methodologies/forms-api.ts';
import {emptyFormBuffer,type FormBuffer} from '../../../apps/web/src/features/methodologies/form-editor-state.ts';

const w=window as any,owner='22222222-2222-4222-8222-222222222222',clientId='33333333-3333-4333-8333-333333333333';
const qa:any=w.__duplicateFieldQA={buffer:null,source:null,requests:[] as string[],authLost:0};
const client=new ApiClient(async(input,init)=>{
 const key=(init?.method??'GET')+' '+String(input);qa.requests.push(key);
 if(key!==`GET /api/v1/forms/${w.__duplicateFieldSeed.ref.id}/versions/${w.__duplicateFieldSeed.ref.version}`)throw new Error('예상하지 않은 요청');
 return new Response(JSON.stringify(w.__duplicateFieldSeed),{status:200,headers:{'Content-Type':'application/json'}});
});
function Harness(){
 const [source,setSource]=useState<FormVersion|null>(null),[buffer,setBuffer]=useState<FormBuffer>(emptyFormBuffer()),[visible,setVisible]=useState(true),[userId,setUserId]=useState(owner);
 useEffect(()=>{void getPinnedForm(client,w.__duplicateFieldSeed.ref).then(setSource);},[]);
 qa.buffer=buffer;qa.source=source;qa.replace=setBuffer;qa.hide=()=>setVisible(false);qa.user=setUserId;
 qa.lock=(kind:string)=>setBuffer(prior=>({...prior,pending:kind==='save'?{request:{commandId:'qa',clientId},name:'확인 중',formCode:'QA'} as any:null,review:kind==='review'?{pending:{commandId:'qa-review'}} as any:null}));
 qa.confirmWith=(kind:string,next?:FormBuffer)=>{const native=window.confirm;window.confirm=()=>{window.confirm=native;flushSync(()=>{if(kind==='replace')setBuffer(next!);else if(kind==='hide')setVisible(false);else if(kind==='user')setUserId('55555555-5555-4555-8555-555555555555');else if(kind==='mutate'){buffer.definition!.items[0]!.fields[1]!.title='확인 중 원문 변경';setBuffer({...buffer});}else qa.lock(kind);});return true;};};
 return visible?<CommonFormEditor client={client} session={{user:{id:userId},clientId,csrfToken:'c'.repeat(43)}} source={source} buffer={buffer} onChange={setBuffer} onAuthenticationLost={()=>qa.authLost++} onSaved={()=>{throw new Error('저장 금지');}}/>:null;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
