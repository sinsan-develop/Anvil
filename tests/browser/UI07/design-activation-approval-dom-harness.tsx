import React from 'react';
import {flushSync} from 'react-dom';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ApprovalsPage} from '../../../apps/web/src/features/decisions/ApprovalsPage.tsx';
import {newDesignActivation,prepareDesignActivation} from '../../../apps/web/src/features/design-change/activation-api.ts';
import {newDesignActivationApprovalRequest} from '../../../apps/web/src/features/decisions/design-activation-approval-api.ts';
import {createRoot} from 'react-dom/client';
import {App} from '../../../apps/web/src/App.tsx';
// 실제 App/default ApiClient/native fetch를 그대로 소비한다. 합성 HTTP 응답은 시험의 same-origin route.fulfill만 제공한다.
let root=createRoot(document.getElementById('root')!);
(window as any).__activationAppQA={unmount:()=>root.unmount()};
if(!location.search.includes('controlled'))root.render(<App/>);
// 시험 전용: 실제 ApprovalsPage를 같은 mount에서 props 교체한다. 제품에는 시험 경로를 추가하지 않는다.
let controlled:any=null,originalTransport:typeof fetch;
function renderControlled(){const x=controlled;flushSync(()=>root.render(<ApprovalsPage client={x.client} session={x.session} projectId={x.projectId} activationBuffer={x.activation} buffer={x.buffer} onChange={value=>{x.buffer=typeof value==='function'?value(x.buffer):value;renderControlled();}} candidate={null} onCandidateChange={()=>{throw Error('다른후보변경금지');}} onAuthenticationLost={()=>{x.authLost++;}}/>));}
(window as any).__activationControlledQA={
 mount(seed:any){root.unmount();root=createRoot(document.getElementById('root')!);const client=new ApiClient();originalTransport=client.transport;if(seed.holdJson){let release!:()=>void;const wait=new Promise<void>(r=>release=r),state={entered:false,released:false,release:()=>{state.released=true;release();}};(window as any).__activationReadQA=state;client.transport=async(...args:Parameters<typeof fetch>)=>{const response=await originalTransport(...args);if(/\/approvals\/[0-9a-f-]{36}$/.test(String(args[0]))){const json=response.json.bind(response);response.json=async()=>{state.entered=true;await wait;return json();};}return response;};}const activation=newDesignActivation(client,seed.projectId,seed.session,1,seed.input,{projectId:seed.projectId,current:{state:'NONE'},observedAt:seed.at,executionAuthorized:false,dispatchPerformed:false});activation.pending=prepareDesignActivation(activation,seed.session);const request=newDesignActivationApprovalRequest(activation,seed.session);request.details=seed.details;if(seed.resultId)request.resultId=seed.resultId;controlled={client,session:seed.session,projectId:seed.projectId,activation,buffer:{projectId:seed.projectId,ownerUserId:seed.session.user.id,ownerClientId:seed.session.clientId,selectedId:seed.resultId??null,request,decision:null},authLost:0};renderControlled();},
 replace(kind:string,id:string){const x=controlled;if(kind==='transport')x.client.transport=((...args:Parameters<typeof fetch>)=>originalTransport(...args)) as typeof fetch;else if(kind==='csrf')x.session={...x.session,csrfToken:'D'.repeat(43)};else if(kind==='user')x.session={...x.session,user:{...x.session.user,id}};else if(kind==='device')x.session={...x.session,clientId:id};else if(kind==='client')x.client=new ApiClient(originalTransport);else if(kind==='project')x.projectId=id;else if(kind==='binding')x.activation={...x.activation,bindingId:id};else if(kind==='command')x.activation={...x.activation,pending:{...x.activation.pending,commandId:id}};renderControlled();},
 snapshot(){return JSON.parse(JSON.stringify(controlled.buffer));},
 holdHash(){const original=crypto.subtle.digest;let release!:()=>void;const wait=new Promise<void>(r=>release=r),state={entered:false,release:()=>{release();(crypto.subtle as any).digest=original;}};(crypto.subtle as any).digest=async function(algorithm:any,data:any){if(new TextDecoder().decode(data).includes('"confirmedPlanRef"')){state.entered=true;await wait;}return original.call(crypto.subtle,algorithm,data);};(window as any).__activationHashQA=state;}
};
