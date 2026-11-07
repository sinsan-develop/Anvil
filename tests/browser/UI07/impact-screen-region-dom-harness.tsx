import React,{useMemo,useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {DesignChangesPage} from '../../../apps/web/src/features/design-change/DesignChangesPage.tsx';

const w=window as any,seed=w.__impactScreenRegionSeed;
type Request={path:string;method:string|undefined;kind:string;jsonStarted:boolean;responseStarted:boolean;settled:boolean;release:null|(()=>void)};
const qa=w.__impactScreenRegionQA={requests:[] as Request[],pending:null as null|{kind:string;status?:number},hashPending:null as null|string,authLost:0,unexpected:[] as string[],mode:'NORMAL',
 release(index:number){const release=qa.requests[index]?.release;if(!release)throw Error('대기 응답 없음');release();}};
const originalDigest=crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{
 const result=await originalDigest(...args),text=new TextDecoder().decode(args[1] as ArrayBuffer);
 const kind=text.includes('"title":"저장 등록된 오류 복구"')?'index-hash':text===seed.body?'body-hash':null;
 if(kind&&qa.hashPending===kind){qa.hashPending=null;const record:Request={kind,path:'hash:'+kind,method:undefined,jsonStarted:false,responseStarted:true,settled:false,release:null};qa.requests.push(record);await new Promise<void>(resolve=>record.release=resolve);record.settled=true;record.release=null;}return result;
};
function transport():typeof fetch{return async(path,init)=>{
 const route=String(path),kind=route.includes('/design-changes/')?'change':route.includes('/design-index?')?'index':route.includes('/documents/')?'document':route.includes('/files/')?'file':route.includes('/forms/')?'form':null;
 const record:Request={path:route,method:init?.method,kind:kind??'unknown',jsonStarted:false,responseStarted:false,settled:false,release:null};qa.requests.push(record);
 const base='/api/v1/projects/'+seed.selection.projectId;
 const expected=kind==='change'?route===base+'/design-changes/'+seed.selection.changeRef.id+'?limit=10'||route===base+'/design-changes/'+seed.selection.changeRef.id+'?limit=10&beforeVersion=2':kind==='index'?route===base+'/design-index?documentId='+seed.sourceRef.id+'&version=1':kind==='document'?route===base+'/documents/'+seed.document.id+'/versions/1':kind==='file'?route===base+'/files/'+seed.document.content.body.artifactId:kind==='form'?route==='/api/v1/forms/'+seed.form.ref.id+'/versions/1':false;
 if(init?.method!=='GET'||!expected){qa.unexpected.push((init?.method??'')+' '+route);throw Error('등록하지 않은 합성 요청');}
 let value:any=kind==='change'?(route.includes('beforeVersion=2')?seed.history:seed.page):kind==='index'?seed.index:kind==='form'?seed.form:seed.document;
 if(kind==='index'&&qa.mode==='ABSENT')value={...value,screenRegions:[]};
 if(kind==='index'&&qa.mode==='REGION_HASH')value={...value,screenRegions:[{...value.screenRegions[0],regionHash:'e'.repeat(64)}]};
 if(kind==='form'&&qa.mode==='WRONG_FORM')value={...value,definition:{...value.definition,formCode:'AF02'}};
 if(kind==='document'&&qa.mode==='DOCUMENT_HASH')value={...value,contentHash:'e'.repeat(64)};
 const pending=qa.pending?.kind===kind?qa.pending:null;if(pending)qa.pending=null;
 // 보호 파일의 오류 상태는 JSON을 읽지 않으므로 transport 응답 경계에서 기다린다.
 if(kind==='file'&&pending?.status){
  record.responseStarted=true;await new Promise<void>(resolve=>record.release=resolve);record.settled=true;record.release=null;
  return Response.json({code:pending.status===401?'AUTH_REQUIRED':'ACCESS_DENIED',raw:'노출 금지 오류 원문'},{status:pending.status});
 }
 if(kind==='file'&&!pending?.status){
  const bytes=new TextEncoder().encode(qa.mode==='BODY_HASH'?'변조된 본문':seed.body);
  return new Response(new ReadableStream({async start(controller){record.responseStarted=true;if(pending)await new Promise<void>(resolve=>record.release=resolve);controller.enqueue(bytes);controller.close();record.settled=true;record.release=null;}}),{headers:{'content-type':'application/octet-stream'}});
 }
 const response=Response.json(pending?.status?{code:pending.status===401?'AUTH_REQUIRED':'ACCESS_DENIED',raw:'노출 금지 오류 원문'}:value,{status:pending?.status??200}),json=response.json.bind(response);
 response.json=async()=>{record.jsonStarted=true;if(pending)await new Promise<void>(resolve=>record.release=resolve);try{return await json();}finally{record.settled=true;record.release=null;}};
 return response;
};}
function Harness(){
 const initial={projectId:seed.selection.projectId,userId:seed.selection.userId,clientId:seed.selection.clientId,clientVersion:0,epoch:0,shown:true};
 const [model,setModel]=useState(initial),clients=useMemo(()=>[new ApiClient(transport()),new ApiClient(transport())],[]),client=clients[model.clientVersion%2]!;
 qa.reset=()=>{qa.mode='NORMAL';qa.pending=null;qa.hashPending=null;flushSync(()=>setModel(p=>({...initial,epoch:p.epoch+1})));};
 qa.context=(kind:string)=>flushSync(()=>setModel(p=>kind==='unmount'?{...p,shown:false}:kind==='user'?{...p,userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}:kind==='device'?{...p,clientId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}:kind==='project'?{...p,projectId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}:{...p,clientVersion:p.clientVersion+1}));
 return model.shown?<DesignChangesPage key={model.epoch} client={client} projectId={model.projectId} session={{user:{id:model.userId},clientId:model.clientId,csrfToken:'C'.repeat(43)}} buffer={null} onChange={()=>{throw Error('입력 변경 금지');}} reviewBuffer={null} onReviewChange={()=>{throw Error('판단 변경 금지');}} onAuthenticationLost={()=>qa.authLost++}/>:<p>다른 화면</p>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
