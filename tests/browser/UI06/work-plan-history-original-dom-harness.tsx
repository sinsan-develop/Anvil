import React,{useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {WorkPlanLibrary} from '../../../apps/web/src/features/design-trace/WorkPlanLibrary.tsx';

// 제품 컴포넌트를 그대로 실행하며 transport와 부모 문맥만 시험에서 제어한다.
const w=window as any,seed=w.__historyOriginalSeed;
type Pending={status?:number;delayJSON?:boolean};
type RecordEntry={path:string;client:number;method:string|undefined;jsonStarted:boolean;settled:boolean;release:null|(()=>void)};
const qa=w.__historyOriginalQA={requests:[] as RecordEntry[],pending:null as Pending|null,authLost:0,render:0,unexpected:[] as string[],
 release(index:number){const release=qa.requests[index]?.release;if(!release)throw Error('대기 JSON 없음');release();},
};
function transport(client:number):typeof fetch{return async(path,options)=>{
 const route=String(path),record:RecordEntry={path:route,client,method:options?.method,jsonStarted:false,settled:false,release:null};qa.requests.push(record);
 if(options?.method!=='GET'){qa.unexpected.push(`${options?.method} ${route}`);throw Error('GET 외 요청 금지');}
 let value:unknown,bytes:string|null=null;
 const base=`/api/v1/projects/${seed.pid}/`;
 if(route.startsWith(base+'work-plans?'))value={items:[{ref:seed.plans[3].ref,status:'DRAFT',title:'합성 보관 계획',documentRef:seed.plans[3].documentRef,designRef:seed.plans[3].designRef,issueCount:0,updatedAt:seed.at,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:seed.at};
 else if(route===base+`design-index?documentId=${seed.plans[3].designRef.id}&version=3`)value={documentRef:seed.plans[3].designRef,items:[],screenRegions:[],status:'NOT_INDEXED',observedAt:seed.at};
 else{const plan=Object.values(seed.plans).find((p:any)=>route===base+`work-plans/${p.ref.id}/versions/${p.ref.version}`) as any;
  const document=Object.values(seed.documents).find((d:any)=>route===base+`documents/${d.id}/versions/${d.version}`) as any;
  const file=Object.entries(seed.documents).find(([,d]:any)=>route===base+`files/${d.content.body.artifactId}`);
  if(plan)value=plan;else if(document)value=document;else if(file)bytes=seed.bodies[file[0]];
  else if(route===`/api/v1/forms/${seed.form.ref.id}/versions/1`)value=seed.form;
  else{qa.unexpected.push(route);throw Error('미지원 합성 요청');}
 }
 const pending=route.includes('/documents/')?qa.pending:null;if(pending)qa.pending=null;
 const response=bytes===null?Response.json(pending?.status?{code:pending.status===401?'AUTH_REQUIRED':pending.status===403?'ACCESS_DENIED':'NOT_FOUND',raw:'비공개 오류 원문'}:value,{status:pending?.status??200}):new Response(new TextEncoder().encode(bytes),{headers:{'content-type':'application/octet-stream'}});
 if(bytes!==null){record.settled=true;return response;}
 const json=response.json.bind(response);response.json=async()=>{record.jsonStarted=true;if(pending?.delayJSON)await new Promise<void>(resolve=>record.release=resolve);try{return await json();}finally{record.release=null;record.settled=true;}};return response;
};}
const clients=[new ApiClient(transport(0)),new ApiClient(transport(1))];
function Harness(){
 const [model,setModel]=useState({user:seed.userA,clientId:seed.clientA,client:0,epoch:0,visible:true});
 useLayoutEffect(()=>{qa.render++;});
 return <><nav aria-label="합성 부모 문맥"><button onClick={()=>setModel(p=>({...p,epoch:p.epoch+1}))}>시험 초기화</button><button onClick={()=>setModel(p=>({...p,visible:!p.visible}))}>보관함 표시 전환</button>{(['주체','기기','클라이언트 객체'] as const).map(kind=>(['A','B'] as const).map(side=><button key={kind+side} onClick={()=>setModel(p=>kind==='주체'?{...p,user:side==='A'?seed.userA:seed.userB}:kind==='기기'?{...p,clientId:side==='A'?seed.clientA:seed.clientB}:{...p,client:side==='A'?0:1})}>{kind} {side}</button>))}</nav>
 {model.visible?<WorkPlanLibrary key={model.epoch} client={clients[model.client]!} projectId={seed.pid} session={{user:{id:model.user},clientId:model.clientId,csrfToken:'C'.repeat(43)}} documents={[]} canPrepare={false} onPrepared={()=>{throw Error('개정 준비 금지');}} onBusy={()=>{throw Error('쓰기 금지');}} onAuthenticationLost={()=>{qa.authLost++;}}/>:null}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
