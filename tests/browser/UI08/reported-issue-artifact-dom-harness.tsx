import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ReportedResultIssue} from '../../../apps/web/src/features/decisions/ReportedResultIssue.tsx';
const w=window as any,seed=w.__issueArtifactSeed;
type Request={path:string;method:string|undefined;client:number;held:boolean;settled:boolean;release:null|(()=>void)};
const qa=w.__issueArtifactQA={requests:[] as Request[],pending:null as null|{status?:number;delay?:boolean;tamper?:boolean;mismatch?:boolean},authLost:0,unexpected:[] as string[],
 release(index:number){const release=qa.requests[index]?.release;if(!release)throw Error('대기 응답 없음');release();}};
function transport(client:number):typeof fetch{return async(path,options)=>{
 const route=String(path),record:Request={path:route,method:options?.method,client,held:false,settled:false,release:null};qa.requests.push(record);
 if(options?.method!=='GET'||options.credentials!=='same-origin'){qa.unexpected.push(route);throw Error('허용되지 않은 요청');}
 const match=seed.results.find((r:any)=>route===`/api/v1/projects/${seed.pid}/results/${r.entry.ref.id}`);
 const artifact=seed.results.flatMap((r:any)=>r.artifacts).find((a:any)=>route===a.path);
 if(!match&&!artifact){qa.unexpected.push(route);throw Error('지원하지 않는 합성 경로');}
 const pending=artifact?qa.pending:null;if(artifact)qa.pending=null;
 const value=structuredClone(match?.entry??artifact.response);
 if(pending?.tamper)value.text+='변조';if(pending?.mismatch)value.artifactRef.contentHash='f'.repeat(64);
 const status=pending?.status??200,response=Response.json(status===200?value:{code:status===401?'AUTH_REQUIRED':status===403?'ACCESS_DENIED':'ARTIFACT_QUARANTINED',raw:'비공개 오류 원문'},{status});
 const json=response.json.bind(response);response.json=async()=>{if(pending?.delay){record.held=true;await new Promise<void>(resolve=>record.release=resolve);}try{return await json();}finally{record.release=null;record.settled=true;}};return response;
};}
const clients=[new ApiClient(transport(0)),new ApiClient(transport(1))];
function Harness(){
 const [model,setModel]=useState({selected:0,client:0,project:seed.pid,epoch:0,closed:false,hash:false});
 const selection=structuredClone(seed.results[model.selected].selection);if(model.hash)selection.item.ref.contentHash='f'.repeat(64);
 return <><nav aria-label="합성 조회 문맥"><button onClick={()=>setModel(p=>({...p,epoch:p.epoch+1,closed:false,selected:0,client:0,project:seed.pid,hash:false}))}>시험 초기화</button>{(['선택','선택 해시','클라이언트','프로젝트'] as const).map(kind=>(['A','B'] as const).map(side=><button key={kind+side} onClick={()=>setModel(p=>kind==='선택'?{...p,selected:side==='A'?0:1,closed:false}:kind==='선택 해시'?{...p,hash:side==='B'}:kind==='클라이언트'?{...p,client:side==='A'?0:1}:{...p,project:side==='A'?seed.pid:seed.otherProject})}>{kind} {side}</button>))}</nav>
 <ReportedResultIssue key={model.epoch} client={clients[model.client]!} projectId={model.project} selection={model.closed?null:selection} onClose={()=>setModel(p=>({...p,closed:true}))} onAuthenticationLost={()=>{qa.authLost++;}}/>
 </>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
