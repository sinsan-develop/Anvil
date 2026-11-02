import {listSourceRoots,type RootHit} from '../connections/source-roots-api.ts';
import type {DocumentSession} from './editor-api.ts';
import {readSourceObservationOptions,type SourceObservationOption,SourceLinkScope,newSourceLinkCommand,changeSourceLinkDraft,prepareSourceLinkCommand,sendSourceLinkCommand,verifySourceLinkCommand,sourceLinkOwned,sourceLinkCloseable,readSourceObservationPage,type SourceLinkBuffer,type SourceLinkChange,type SourceObservationView} from './source-link-command-api.ts';
import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readSourceLinks,type SourceLinksView,type SourceLinkView} from './source-links-api.ts';
type Ref={id:string;version:number;contentHash:string};
export function DocumentSourceLinks({client,projectId,documentRef,onDetach,onAuthenticationLost,session,commandBuffer=null,onCommandChange}:{session?:DocumentSession;commandBuffer?:SourceLinkBuffer|null;onCommandChange?:(change:SourceLinkChange)=>void;client:ApiClient;projectId:string;documentRef:Ref;onDetach?:(value:SourceLinkView)=>void;onAuthenticationLost:()=>void}){
 const [observations,setObservations]=useState<{linkId:string;items:SourceObservationView[];nextCursor:string|null}|null>(null),[observing,setObserving]=useState(false);
 const sourceScope=useRef(new SourceLinkScope());
 if(session)sourceScope.current.bind(client,session,projectId,JSON.stringify([commandBuffer?.bindingId??null,documentRef]));
 useEffect(()=>()=>sourceScope.current.dispose(),[]);
 async function history(linkId:string,next=false){if(observing)return;const active=sourceScope.current.capture();setObserving(true);try{const page=await readSourceObservationPage(client,projectId,documentRef,linkId,active,next?observations?.nextCursor??null:null);if(active())setObservations({linkId,items:next?[...(observations?.items??[]),...page.items]:page.items,nextCursor:page.nextCursor});}catch(e){if(active())setError(e instanceof ApiError?e:new ApiError('DOCUMENT_SOURCE_RESPONSE_INVALID'));}finally{if(active())setObserving(false);}}
 const [value,setValue]=useState<SourceLinksView|null>(null),[error,setError]=useState<ApiError|null>(null),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 const {id,version,contentHash}=documentRef;
 useEffect(()=>{setObservations(null);setObserving(false);},[client,client.transport,projectId,id,version,contentHash,session]);
 useEffect(()=>{
  let current=true;setValue(null);setError(null);setLoading(true);
  readSourceLinks(client,projectId,{id,version,contentHash},()=>current).then(v=>{if(current)setValue(v);}).catch(cause=>{if(!current)return;const e=cause instanceof ApiError?cause:new ApiError('DOCUMENT_SOURCE_LINK_RESPONSE_INVALID');setValue(null);setError(e);if(e.status===401)onAuthenticationLost();}).finally(()=>{if(current)setLoading(false);});
  return()=>{current=false;};
 },[client,projectId,id,version,contentHash,reload]);
 return <section className="status-card" aria-label="문서 소스 연결 이력"><h3>문서 소스 연결</h3><button disabled={loading} onClick={()=>{setValue(null);setError(null);setLoading(true);setReload(n=>n+1);}}>소스 연결 새로고침</button>
  {session&&onCommandChange?<button disabled={!!commandBuffer} onClick={()=>onCommandChange(previous=>previous??newSourceLinkCommand(client,session,projectId,documentRef))}>새 소스 연결 준비</button>:null}
  {commandBuffer&&session&&onCommandChange?(JSON.stringify(commandBuffer.documentRef)===JSON.stringify(documentRef)?<SourceLinkCommandEditor client={client} session={session} buffer={commandBuffer} onChange={onCommandChange} onAuthenticationLost={onAuthenticationLost}/>:<p role="status">다른 문서의 원 소스 명령을 보존 중입니다. 원 문서로 돌아가 확인하세요.</p>):null}
  {loading?<p role="status">보관된 연결 이력 확인 중</p>:null}{error?<p role="alert">{error.code} · 연결을 확인하지 못했습니다.</p>:null}
  {!loading&&!error&&value?<><p className="meta">문서 v{version} · 현재 파일 내용과의 일치는 확인하지 않았습니다.</p>{value.hasMore?<p role="status">처음 20개만 표시한 부분 목록입니다. 나머지 연결은 미조회입니다.</p>:null}
   {!value.items.length?<p>이 문서 버전에 보관된 연결이 없습니다. 실제 소스 관측 결과는 아닙니다.</p>:<ul>{value.items.map(item=><li key={item.ref.id}><strong>{item.state==='DETACHED'?'분리됨':'미확인'}</strong><p className="meta">연결 {item.ref.id} v{item.ref.version} · SHA256 {item.ref.contentHash}</p>{item.rawAllowed&&item.state==='ACTIVE'&&onDetach?<button onClick={()=>onDetach(item)}>이 연결 해제 준비</button>:null}
    {item.rawAllowed?<><button disabled={observing} onClick={()=>void history(item.ref.id)}>이 연결의 관측·선택 이력 조회</button>{item.state==='ACTIVE'&&session&&onCommandChange?<button disabled={!!commandBuffer} onClick={()=>onCommandChange(previous=>previous??newSourceLinkCommand(client,session,projectId,documentRef,item.ref))}>이 연결의 관측 선택 준비</button>:null}</>:null}
    {item.rawAllowed&&item.history?<ol>{item.history.map(e=><li key={e.ref.version}><p>{e.snapshot.relativePath}</p><p>{e.snapshot.kind==='DETACHED'?'연결 분리':'연결 보관'} · {e.snapshot.reason}</p><p className="meta">기록 {e.snapshot.recordedAt} · 소스 blob SHA256 {e.snapshot.blobHash}</p></li>)}</ol>:<p>현재 참여 권한에서는 경로·사유·상세 이력을 표시하지 않습니다.</p>}
   </li>)}</ul>}<p className="meta">문서·파일은 변경하지 않습니다. 자동 관측·자동 수집·본문 적용·확정은 하지 않습니다. 새 명령은 보호 관측 공급자의 서버 검산이 필요합니다.</p></>:null}
  {observations?<section aria-label="관측 선택 이력"><h4>보관된 관측·선택</h4><p className="meta">당시 비교 결과이며 현재 파일 관측의 검증이 아닙니다.</p><ol>{observations.items.map(item=><li key={item.ref.id+':'+item.ref.version}>{item.comparison} · {item.rawAllowed?String(item.record?.snapshot.choice??'초기 관측'):'상세 비공개'}{item.rawAllowed?<p>{String(item.record?.snapshot.reason??'')}</p>:null}{item.record?.snapshot.proposalId?<a href={'#/projects/'+projectId+'/documents'}>수집 제안 {String(item.record.snapshot.proposalId)} · 본문 적용 전</a>:null}</li>)}</ol>{observations.nextCursor?<button disabled={observing} onClick={()=>void history(observations.linkId,true)}>다음 관측 이력</button>:null}</section>:null}
 </section>;
}

export function SourceLinkCommandEditor({client,session,buffer,onChange,onAuthenticationLost}:{client:ApiClient;session:DocumentSession;buffer:SourceLinkBuffer;onChange:(change:SourceLinkChange)=>void;onAuthenticationLost:()=>void}){
 const scope=useRef(new SourceLinkScope()),operation=useRef<object|null>(null),mounted=useRef(true),[busy,setBusy]=useState(false),[error,setError]=useState<ApiError|null>(null);
 const [roots,setRoots]=useState<{items:RootHit[];nextCursor:string|null}|null>(null),[rootId,setRootId]=useState(''),[options,setOptions]=useState<{items:SourceObservationOption[];nextCursor:string|null}|null>(null);
 const epoch=scope.current.bind(client,session,buffer.projectId,buffer.bindingId);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;scope.current.dispose();operation.current=null;};},[]);
 useEffect(()=>{if(operation.current){operation.current=null;setBusy(false);}setError(null);setRoots(null);setOptions(null);setRootId('');},[epoch]);
 const owned=sourceLinkOwned(buffer,client,session,buffer.projectId),matches=(b:SourceLinkBuffer|null)=>!!b&&b.bindingId===buffer.bindingId&&sourceLinkOwned(b,client,session,buffer.projectId);
 function edit(key:string,value:unknown){onChange(previous=>matches(previous)&&!previous!.pending?changeSourceLinkDraft(previous!,{...previous!.payload,[key]:value}):previous);}
 async function run(mode:'prepare'|'send'|'verify'|'roots'|'options',next=false){
  if(operation.current||!owned)return;const ticket={},captured=scope.current.capture(),active=()=>mounted.current&&operation.current===ticket&&captured();operation.current=ticket;setBusy(true);setError(null);
  const replace=(next:SourceLinkBuffer)=>onChange(previous=>active()&&matches(previous)&&previous!.pending?.command.commandId===buffer.pending?.command.commandId?next:previous);
  try{if(mode==='roots'){const page=await listSourceRoots(client,buffer.projectId,next?roots?.nextCursor??null:null);if(active())setRoots({items:[...(next?roots?.items??[]:[]),...page.items.filter(r=>r.status==='DECLARED')],nextCursor:page.nextCursor});}else if(mode==='options'){const page=await readSourceObservationOptions(client,buffer,session,buffer.operation==='linkDocumentSource'?rootId:null,active,next?options?.nextCursor??null:null);if(active())setOptions({items:[...(next?options?.items??[]:[]),...page.items],nextCursor:page.nextCursor});}else if(mode==='prepare'){const next=await prepareSourceLinkCommand(client,buffer,session,active);replace(next);}else if(mode==='send'){await sendSourceLinkCommand(client,buffer,session,active,replace);}else{const next=await verifySourceLinkCommand(client,buffer,session,active);replace(next);}}
  catch(e){if(active()){const problem=e instanceof ApiError?e:new ApiError('DOCUMENT_SOURCE_RESPONSE_INVALID');setError(problem);if(problem.status===401)onAuthenticationLost();}}
  finally{if(operation.current===ticket){operation.current=null;if(mounted.current&&captured())setBusy(false);}}
 }
 const locked=busy||!!buffer.pending||!owned,p=buffer.payload,key=buffer.operation==='linkDocumentSource'?'sourceSnapshotRef':'observedSnapshotRef';
 const selected=options?.items.findIndex(item=>JSON.stringify(item.observedSnapshotRef)===JSON.stringify(p[key]))??-1;
 function choose(index:string){if(!/^(0|[1-9][0-9]*)$/.test(index))return;const item=options?.items[Number(index)];if(!item||locked)return;onChange(previous=>matches(previous)&&!previous!.pending?changeSourceLinkDraft(previous!,buffer.operation==='linkDocumentSource'?{...previous!.payload,sourceRootId:rootId,relativePath:item.relativePath,sourceSnapshotRef:item.observedSnapshotRef,blobHash:item.blobHash}:{...previous!.payload,observedSnapshotRef:item.observedSnapshotRef}):previous);}
 return <section className="status-card definition-editor" aria-label="소스 관측 원명령"><h3>{buffer.operation==='linkDocumentSource'?'새 소스 연결':'소스 드리프트 선택'}</h3>
  <p>원 문서 {buffer.documentRef.id} v{buffer.documentRef.version} · 본문/확정본과 원본 파일은 변경하지 않습니다.</p>
  {!owned?<p role="status">이전 세션·연결의 원명령을 보존 중입니다. 현재 문맥에서 자동 재개하지 않습니다.</p>:null}
  <fieldset disabled={locked}>{buffer.operation==='linkDocumentSource'?<><button onClick={()=>void run('roots')}>등록 환경 조회</button><label>등록 환경<select aria-label="등록 환경" value={rootId} onChange={e=>{setRootId(e.target.value);setOptions(null);}}><option value="">환경을 선택하세요</option>{roots?.items.map(r=><option key={r.ref.id} value={r.ref.id}>{r.displayName} · 보고 미검증</option>)}</select></label>{roots?.nextCursor?<button onClick={()=>void run('roots',true)}>다음 등록 환경</button>:null}{roots&&!roots.items.length?<p>선택 가능한 등록 환경이 없습니다.</p>:null}</>:<><p>선택한 기존 연결의 보관 관측을 확인합니다.</p><label>관측 선택<select aria-label="관측 선택" value={String(p.choice)} onChange={e=>edit('choice',e.target.value)}><option value="KEEP_SERVER">서버 본문 유지</option><option value="COLLECT_PROPOSAL">원본 Artifact에서 변경안 수집</option></select></label></>}
   <button disabled={locked||buffer.operation==='linkDocumentSource'&&!rootId} onClick={()=>void run('options')}>보관 관측 후보 조회</button>
   <p className="meta">후보 선택은 파일 수집이나 실측 검증이 아닙니다. 저장 때 보호 공급자가 원 관측·현재성을 다시 검산합니다.</p>
   {options?<><label>보관 관측<select aria-label="보관 관측" value={selected<0?'':String(selected)} onChange={e=>choose(e.target.value)}><option value="">환경·경로·관측시각으로 선택하세요</option>{options.items.map((item,i)=><option key={item.observedSnapshotRef.id+':'+item.observedSnapshotRef.version} value={String(i)}>{item.label} · {item.relativePath} · {item.observedAt}{item.artifactRef?' · 원본 Artifact 보관':''}</option>)}</select></label>{options.nextCursor?<button onClick={()=>void run('options',true)}>다음 보관 관측</button>:null}{!options.items.length?<p>선택 가능한 보관 관측이 없습니다. 실제 보호 공급자 연결이 필요합니다.</p>:null}</>:null}
   <label>소스 명령 사유<textarea aria-label="소스 명령 사유" maxLength={20000} value={String(p.reason??'')} onChange={e=>edit('reason',e.target.value)}/></label><label><input type="checkbox" aria-label="원문 보존 확인" checked={buffer.acknowledged} onChange={e=>onChange(previous=>matches(previous)&&!previous!.pending?changeSourceLinkDraft(previous!,previous!.payload,e.target.checked):previous)}/>본문 적용·확정은 별도이며 원문을 보존함을 확인했습니다</label>
  </fieldset>
  {buffer.pending?<><p>원 명령 {buffer.pending.command.commandId} · SHA256 {buffer.pending.hash}</p><p role="status">명령 상태: {buffer.pending.state}</p>{buffer.pending.state==='UNKNOWN'?<p>결과 미확인 · 새 명령/원본 수집을 자동 시작하지 않습니다.</p>:null}{['PREPARED','REQUIRED'].includes(buffer.pending.state)&&buffer.pending.command.approvalRef===null?<a href={'#/projects/'+buffer.projectId+'/approvals'}>소스 명령 일회 승인 화면</a>:null}</>:null}
  {error||buffer.failure?<p role="alert">{error?.code??buffer.failure?.code} · 원 입력과 명령은 보존했습니다.</p>:null}
  {buffer.verified?<p role="status">고정 사건 재조회 확인 · 현재 파일·실측·본문 적용의 확인은 아닙니다.</p>:null}
  {!buffer.pending?<button disabled={busy||!owned||selected<0||!buffer.acknowledged||!String(p.reason??'').trim()} onClick={()=>void run('prepare')}>소스 원명령 준비</button>:buffer.pending.state==='STORED'?<button disabled={busy||!owned||buffer.verified} onClick={()=>void run('verify')}>소스 저장 결과 재조회</button>:<button disabled={busy||!owned} onClick={()=>void run('send')}>{buffer.pending.state==='UNKNOWN'?'같은 소스 명령 결과 확인':'소스 명령 명시 전송'}</button>}
  <button disabled={busy||!sourceLinkCloseable(buffer)} onClick={()=>onChange(previous=>matches(previous)&&sourceLinkCloseable(previous!)?null:previous)}>소스 준비 닫기</button>
 </section>;
}
