import React,{useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {ProjectCreatePage} from '../../../apps/web/src/features/project-create/ProjectCreatePage.tsx';
import type {DraftEditorState} from '../../../apps/web/src/features/project-create/api.ts';

// 시험 전용 진입점. 제품 컴포넌트의 판단·상태 전이 코드는 복제하지 않는다.
const w=window as any,seed=w.__anvilPinnedSeed;
type Plan={status?:number;delayJSON?:boolean};
type RequestRecord={path:string;client:number;method:string|undefined;credentials:RequestCredentials|undefined;jsonStarted:boolean;jsonConsumed:boolean;settled:boolean;release:null|(()=>void)};
type DigestRecord={pending:boolean;settled:boolean;release:null|(()=>void)};
const qa=w.__anvilPinnedQA={requests:[] as RequestRecord[],listRequests:[] as RequestRecord[],digests:[] as DigestRecord[],plans:[] as Plan[],holdDigest:false,authLost:0,changes:0,render:0,buffer:null as DraftEditorState|null,unexpected:[] as string[],
 enqueue(plan:Plan){qa.plans.push(plan);},
 releaseJSON(index:number){const release=qa.requests[index]?.release;if(!release)throw Error('대기 JSON 없음');release();},
 releaseDigest(index:number){const release=qa.digests[index]?.release;if(!release)throw Error('대기 해시 없음');release();},
};
const originalDigest=crypto.subtle.digest.bind(crypto.subtle);
crypto.subtle.digest=async(algorithm,data)=>{
 const hold=qa.holdDigest;qa.holdDigest=false;
 const record:DigestRecord={pending:false,settled:false,release:null};qa.digests.push(record);
 const value=await originalDigest(algorithm,data);
 if(hold)await new Promise<void>(resolve=>{record.pending=true;record.release=resolve;});
 record.pending=false;record.release=null;record.settled=true;return value;
};
class ObservedApiClient extends ApiClient{
 override async get<T=unknown>(path:string):Promise<T>{
  const records=path==='/api/v1/methodologies'?qa.listRequests:qa.requests,index=records.length;
  try{return await super.get<T>(path);}finally{const record=records[index];if(record)record.settled=true;}
 }
}
// 목록은 기존2단계 mount의 별도 GET이며, 원문 계획/횟수/지연 인덱스를 소비하지 않는다.
function syntheticTransport(client:number):typeof fetch{return async(path,options)=>{
 const list=options?.method==='GET'&&String(path)==='/api/v1/methodologies';
 const record:RequestRecord={path:String(path),client,method:options?.method,credentials:options?.credentials,jsonStarted:false,jsonConsumed:false,settled:false,release:null};(list?qa.listRequests:qa.requests).push(record);
 const selected=Object.values(seed.values).find((value:any)=>String(path)===`/api/v1/methodologies/${value.ref.id}/versions/${value.ref.version}`) as any;
 if(options?.method!=='GET'||!list&&!selected){qa.unexpected.push(`${options?.method} ${String(path)}`);throw Error('허용되지 않은 합성 요청');}
 const plan=list?{}:qa.plans.shift()??{},status=plan.status??200;
 const response=Response.json(list?{items:[],nextCursor:null,hasMore:false,observedAt:'2026-10-25T00:00:00.000Z',baselineVersion:null}:status===200?selected:{code:status===401?'AUTH_REQUIRED':status===403?'ACCESS_DENIED':'NOT_FOUND',raw:'비공개 오류 원문',graph:selected.graph},{status});
 const json=response.json.bind(response);
 response.json=async()=>{
  record.jsonStarted=true;
  if(plan.delayJSON)await new Promise<void>(resolve=>record.release=resolve);
  const value=await json();record.jsonConsumed=true;record.release=null;return value;
 };
 return response;
};}
const clients=[0,1].map(client=>new ObservedApiClient(syntheticTransport(client)));
function initial(){return{buffer:structuredClone(seed.buffer) as DraftEditorState,user:seed.userA as string,clientId:seed.clientA as string,client:0,epoch:0};}
function Harness(){
 const [model,setModel]=useState(initial);
 useLayoutEffect(()=>{qa.buffer=structuredClone(model.buffer);qa.render++;});
 const switchValue=(kind:'선택'|'주체'|'클라이언트 객체'|'기기'|'초안',side:'A'|'B')=>setModel(previous=>{
  if(kind==='선택')return{...previous,buffer:{...previous.buffer,input:{...previous.buffer.input,methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:seed.values[side].ref}}}};
  if(kind==='주체'){const user=side==='A'?seed.userA:seed.userB;return{...previous,user,buffer:{...previous.buffer,ownerUserId:user}};}
  if(kind==='클라이언트 객체')return{...previous,client:side==='A'?0:1};
  if(kind==='기기')return{...previous,clientId:side==='A'?seed.clientA:seed.clientB};
  return{...previous,buffer:{...previous.buffer,draftId:side==='A'?seed.draftA:seed.draftB}};
 });
 return <>
  <nav aria-label="합성 시험 문맥">
   <button type="button" onClick={()=>setModel(previous=>({...initial(),epoch:previous.epoch+1}))}>시험 초기화</button>
   <button type="button" onClick={()=>setModel(previous=>({...previous,buffer:{...previous.buffer,wizardStep:3}}))}>합성 준비 단계 열기</button>
   {(['선택','주체','클라이언트 객체','기기','초안'] as const).map(kind=><React.Fragment key={kind}>{(['A','B'] as const).map(side=><button type="button" key={side} onClick={()=>switchValue(kind,side)}>{kind} {side}</button>)}</React.Fragment>)}
   <button type="button" onClick={()=>setModel(previous=>({...previous,buffer:{...previous.buffer,pendingCommand:{draftId:previous.buffer.draftId,fingerprint:'합성 미확인 저장 명령',body:{schemaVersion:1,commandId:seed.command,clientId:previous.clientId,expectedVersion:2,step:3,input:structuredClone(previous.buffer.input)}}}}))}>미확인 저장 명령 설정</button>
   <button type="button" onClick={()=>setModel(previous=>({...previous,buffer:{...previous.buffer,pendingAction:{kind:'create',draftId:previous.buffer.draftId!,body:{schemaVersion:1,commandId:seed.command,clientId:previous.clientId,draftId:previous.buffer.draftId,draftVersion:2}}}}))}>미확인 생성 명령 설정</button>
  </nav>
  <ProjectCreatePage key={model.epoch} client={clients[model.client]!} session={{user:{id:model.user},clientId:model.clientId,csrfToken:'C'.repeat(43)}} buffer={model.buffer}
   onChange={update=>{qa.changes++;setModel(previous=>({...previous,buffer:typeof update==='function'?update(previous.buffer):update}));}} onAuthenticationLost={()=>{qa.authLost++;}}/>
 </>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
