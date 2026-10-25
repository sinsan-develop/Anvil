import React,{useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {KnowledgeVersionComparison} from '../../../apps/web/src/features/knowledge/KnowledgeVersionComparison.tsx';
import {KnowledgeCorrectionForm} from '../../../apps/web/src/features/knowledge/KnowledgeCorrectionForm.tsx';
import {newKnowledgeCorrection,type KnowledgeCorrectionBuffer} from '../../../apps/web/src/features/knowledge/correction-api.ts';

const w=window as any,seed=w.__scopeComparisonSeed;
type Pending={status?:number;delayJSON?:boolean;target:'knowledge'|'plan'|'method'};
type Request={path:string;method:string|undefined;client:number;jsonStarted:boolean;settled:boolean;release:null|(()=>void)};
const qa=w.__scopeComparisonQA={requests:[] as Request[],pending:null as Pending|null,authLost:0,unexpected:[] as string[],buffer:null as KnowledgeCorrectionBuffer|null,render:0,
 release(index:number){const release=qa.requests[index]?.release;if(!release)throw Error('대기 JSON 없음');release();}};
function transport(client:number):typeof fetch{return async(path,options)=>{
 const route=String(path),record:Request={path:route,method:options?.method,client,jsonStarted:false,settled:false,release:null};qa.requests.push(record);
 if(options?.method!=='GET'){qa.unexpected.push(`${options?.method} ${route}`);throw Error('GET 외 요청 금지');}
 const base=`/api/v1/projects/${seed.pid}`,knowledge=Object.values(seed.knowledge).find((v:any)=>route===`${base}/knowledge/${v.ref.id}/versions/${v.ref.version}`),plan=Object.values(seed.plans).find((v:any)=>route===`${base}/work-plans/${v.ref.id}/versions/${v.ref.version}`);
 const target=knowledge?'knowledge':plan?'plan':route===`${base}/methodology-application`?'method':null;
 const value=knowledge??plan??(target==='method'?seed.method:route===base?seed.project:null);
 if(!value){qa.unexpected.push(route);throw Error('미지원 합성 요청');}
 const pending=qa.pending?.target===target?qa.pending:null;if(pending)qa.pending=null;
 const response=Response.json(pending?.status?{code:pending.status===401?'AUTH_REQUIRED':pending.status===403?'ACCESS_DENIED':'NOT_FOUND',raw:'비공개 오류 원문'}:value,{status:pending?.status??200});
 const json=response.json.bind(response);response.json=async()=>{record.jsonStarted=true;if(pending?.delayJSON)await new Promise<void>(resolve=>record.release=resolve);try{return await json();}finally{record.release=null;record.settled=true;}};return response;
};}
const clients=[new ApiClient(transport(0)),new ApiClient(transport(1))];
const session={user:{id:seed.userA},clientId:seed.clientA,csrfToken:'C'.repeat(43)};
const otherHash={...seed.knowledge[2],ref:{...seed.knowledge[2].ref,contentHash:'f'.repeat(64)}};
function Harness(){
 const [model,setModel]=useState({user:seed.userA,device:seed.clientA,client:0,project:seed.pid,selected:2,hash:false,epoch:0,visible:true});
 const [buffer,setBuffer]=useState<KnowledgeCorrectionBuffer|null>(()=>newKnowledgeCorrection(seed.pid,seed.knowledge[2],session,1));
 useLayoutEffect(()=>{qa.render++;qa.buffer=buffer;});
 const selected=model.hash?otherHash:seed.knowledge[model.selected],lost=()=>{qa.authLost++;};
 return <><nav aria-label="합성 부모 문맥"><button onClick={()=>setModel(p=>({...p,epoch:p.epoch+1}))}>시험 초기화</button><button onClick={()=>setModel(p=>({...p,visible:!p.visible}))}>비교 표시 전환</button>{(['주체','기기','클라이언트 객체','프로젝트','선택 버전','선택 해시'] as const).map(kind=>(['A','B'] as const).map(side=><button key={kind+side} onClick={()=>setModel(p=>kind==='주체'?{...p,user:side==='A'?seed.userA:seed.userB}:kind==='기기'?{...p,device:side==='A'?seed.clientA:seed.clientB}:kind==='클라이언트 객체'?{...p,client:side==='A'?0:1}:kind==='프로젝트'?{...p,project:side==='A'?seed.pid:seed.otherProject}:kind==='선택 해시'?{...p,hash:side==='B'}:{...p,selected:side==='A'?2:3})}>{kind} {side}</button>))}</nav>
 {model.visible?<KnowledgeVersionComparison key={model.epoch} client={clients[model.client]!} projectId={model.project} session={{user:{id:model.user},clientId:model.device,csrfToken:session.csrfToken}} view={selected} onAuthenticationLost={lost}/>:null}
 {buffer?<KnowledgeCorrectionForm client={clients[0]!} session={session} buffer={buffer} onChange={setBuffer} onSaved={()=>{throw Error('저장 금지');}} onAuthenticationLost={lost}/>:null}</>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
