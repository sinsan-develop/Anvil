import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ReportedResultIssue} from '../../../apps/web/src/features/decisions/ReportedResultIssue.tsx';
const w=window as any,seed=w.__reportedDownloadSeed;
const qa=w.__reportedDownloadQA={calls:[] as any[],mode:'NORMAL',resultDelay:false,releases:[] as any[],cancelled:0,authLost:0,unexpected:[] as string[]};
function makeTransport(index:number):typeof fetch{return async(path,options)=>{
 const route=String(path),call={path:route,method:options?.method,credentials:options?.credentials,redirect:options?.redirect,cache:options?.cache,accept:(options?.headers as Record<string,string>)?.Accept,transport:index,held:false,settled:false};qa.calls.push(call);
 if(options?.method!=='GET'||options.credentials!=='same-origin'){qa.unexpected.push(route);throw Error('허용되지 않은 합성 요청');}
 const original=seed.results.find((r:any)=>route===`/api/v1/projects/${seed.pid}/results/${r.entry.ref.id}`);
 if(original){const response=Response.json(structuredClone(original.entry)),json=response.json.bind(response),delayed=qa.resultDelay;qa.resultDelay=false;response.json=async()=>{if(delayed){call.held=true;await new Promise<void>(resolve=>qa.releases.push({kind:'result',release:resolve}));}try{return await json();}finally{call.settled=true;}};return response;}
 const file=seed.results.find((r:any)=>route===`/api/v1/projects/${seed.pid}/files/${r.artifact.id}`);
 if(!file){qa.unexpected.push(route);throw Error('지원하지 않는 합성 경로');}
 const mode=qa.mode;if(mode==='LOSS')throw Error('비밀 전송 오류');
 if(mode.startsWith('DELAY')){call.held=true;await new Promise<void>(resolve=>qa.releases.push({kind:'file',release:resolve}));}
 call.settled=true;
 const status=mode==='DELAY_401'?401:mode.startsWith('STATUS_')?Number(mode.slice(7)):200;
 return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(status===200?(mode==='HASH'?[1,2,3]:file.bytes):[1]));controller.close();},cancel(){qa.cancelled++;}}),{status,headers:{'content-type':mode==='TYPE'?'text/html':'application/octet-stream','content-disposition':'attachment; filename="unsafe.html"'}});
};}
const transports=[makeTransport(0),makeTransport(1)];
function Harness(){
 const initial={selected:0,client:0,transport:0,session:seed.session,closed:false,shown:true,epoch:0};
 const [model,setModel]=useState(initial),clients=useMemo(()=>[new ApiClient(transports[0]),new ApiClient(transports[0])],[]);
 qa.reset=()=>{qa.mode='NORMAL';qa.resultDelay=false;flushSync(()=>setModel(p=>({...initial,epoch:p.epoch+1})));};
 qa.change=(kind:string,side:string)=>flushSync(()=>setModel(p=>{
  const b=side==='B';
  if(kind==='user')return{...p,session:{...p.session,user:{id:b?seed.otherUser:seed.session.user.id}}};
  if(kind==='device')return{...p,session:{...p.session,clientId:b?seed.otherClient:seed.session.clientId}};
  if(kind==='session')return{...p,session:{...p.session,csrfToken:b?'b'.repeat(43):seed.session.csrfToken}};
  if(kind==='client')return{...p,client:b?1:0};
  if(kind==='transport')return{...p,transport:b?1:0};
  if(kind==='selection')return{...p,selected:b?1:0};
  if(kind==='unmount')return{...p,shown:!b};
  throw Error('지원하지 않는 문맥');
 }));
 const client=clients[model.client]!;client.transport=transports[model.transport]!;
 return model.shown?<ReportedResultIssue key={model.epoch} client={client} projectId={seed.pid} {...{session:model.session}} selection={model.closed?null:structuredClone(seed.results[model.selected].selection)} onClose={()=>setModel(p=>({...p,closed:true}))} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
