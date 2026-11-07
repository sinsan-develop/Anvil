import {useLayoutEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readProjectSetupCopy,readSetupCopyRefs,type SetupCopyRef,type SetupCopyRead,type CommonSetupSession} from './common-setup-api.ts';
import {readProjectSetupRefs} from '../projects/api.ts';
export function ProjectSetupCopies({client,session,projectId,initialRefs,disabled=false,onAuthenticationLost}:{client:ApiClient;session:CommonSetupSession;projectId:string;initialRefs?:SetupCopyRef[];disabled?:boolean;onAuthenticationLost:()=>void}){
 const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[refs,setRefs]=useState<{scope:object;value:SetupCopyRef[]|undefined}|null>(null),[body,setBody]=useState<{scope:object;value:SetupCopyRead}|null>(null),mounted=useRef(true),generation=useRef(0);
 const key=JSON.stringify([session.user.id,session.clientId,session.csrfToken,projectId,disabled]),scope=useRef({key,client,transport:client.transport});if(scope.current.key!==key||scope.current.client!==client||scope.current.transport!==client.transport)scope.current={key,client,transport:client.transport};
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);useLayoutEffect(()=>{setPending(false);setError(null);},[key,client,disabled]);
 let fromReceipt:SetupCopyRef[]|undefined;try{if(initialRefs!==undefined)fromReceipt=readSetupCopyRefs(initialRefs);}catch{return <p role="alert">사본 참조 응답이 유효하지 않습니다. 원 생성 결과는 보존합니다.</p>;}
 const visible=refs?.scope===scope.current?refs.value:fromReceipt,copy=body?.scope===scope.current&&!disabled?body.value:null;
 async function run(action:(active:()=>boolean,captured:object)=>Promise<void>){if(disabled||pending)return;const captured=scope.current,attempt=++generation.current,active=()=>mounted.current&&scope.current===captured&&generation.current===attempt;setPending(true);setError(null);try{await action(active,captured);}catch(cause){if(active()){const e=cause instanceof ApiError?cause:new ApiError('RESPONSE_INVALID');setError(e.code);setBody(null);if(e.status===401)onAuthenticationLost();}}finally{if(active())setPending(false);}}
 return <section aria-label="프로젝트 설정 사본"><h3>프로젝트 도구·환경 사본</h3><p className="meta">UNBOUND · 실행 권한 없음. 조회 권한 준비 여부와 프로젝트 생성 성공은 별개입니다.</p>
 <button type="button" disabled={disabled||pending} onClick={()=>void run(async(active,captured)=>{const value=await readProjectSetupRefs(client,projectId,active);if(active()){setRefs({scope:captured,value});setBody(null);}})}>저장된 사본 참조 조회</button>
 {!disabled&&visible?.length?<ul>{visible.map(ref=><li key={ref.id}>{ref.slot} · {ref.id} · v1 · SHA256 {ref.contentHash}<button type="button" disabled={pending} onClick={()=>void run(async(active,captured)=>{const value=await readProjectSetupCopy(client,projectId,ref,active);if(active())setBody({scope:captured,value});})}>사본 원문 조회 · {ref.slot}</button></li>)}</ul>:!disabled&&refs?.scope===scope.current?<p>이 프로젝트에 선택한 설정 사본이 없습니다.</p>:null}
 {pending?<p role="status">보호된 프로젝트 설정을 확인하고 있습니다.</p>:null}{error?<p role="alert">{error} · 조회 준비가 필요합니다. 저장된 사본 참조와 생성 결과는 보존합니다.</p>:null}
 {copy?<section aria-label="고정 프로젝트 설정 원문"><h4>{copy.copy.definitionSnapshot.label}</h4><p>출처 {copy.copy.sourceRef.id} · v{copy.copy.sourceRef.version} · {copy.copy.sourceRef.contentHash}</p><pre>{JSON.stringify(copy.copy.definitionSnapshot,null,2)}</pre><p>미연결 · 실행 권한 없음</p><button type="button" onClick={()=>{generation.current++;setPending(false);setError(null);setBody(null);}}>사본 원문 닫기</button></section>:null}
 </section>;
}
