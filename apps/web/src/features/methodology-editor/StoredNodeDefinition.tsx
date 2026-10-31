import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import {readLimitPolicy,type LimitPolicyRecord} from '../connections/limit-policy-api.ts';
import type { MethodologyDocumentItem, MethodologyNode } from '../../../../../contracts/methodologies.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import { PinnedFormOriginal, type PinnedFormAccess } from '../methodologies/PinnedFormOriginal.tsx';

const kinds = { HUMAN: '사용자 판단', AGENT: '도구 수행 역할', DECISION: '조건 판단', JOIN: '결과 합류' };
const roles = { USER: '사용자', COORDINATOR: '총괄', STAGE_OWNER: '단계책임자' };

function Values({ title, values }: { title: string; values: readonly string[] }) {
 return <div><h5>{title}</h5>{values.length ? <ul>{values.map((value, index) => <li key={index}>{value}</li>)}</ul> : <p>{title} 미작성</p>}</div>;
}
function Reference({ value }: { value: VersionRef }) {
 return <span className="meta" style={{ overflowWrap: 'anywhere' }}>{value.id} · v{value.version} · {value.contentHash}</span>;
}
export function StoredMethodDocuments({ side, items, formAccess }: { side: '입력' | '산출'; items: readonly MethodologyDocumentItem[]; formAccess?: PinnedFormAccess }) {
 return <section aria-label={side + ' 문서 정의'}><h5>{side} 문서</h5>{items.length ? items.map(item => <div key={item.itemId} className="status-card">
  <p>{item.itemId} · {item.required ? '필수' : '선택'}</p><p>양식 고정 참조 <Reference value={item.formRef} /></p>
  {side === '입력' ? <p>입력 출처 단계: {item.sourceNodeId ?? '외부 입력·단계 미지정'}</p> : null}
  <Values title="문서 검수 조건" values={item.reviewCriteria} />
  {formAccess ? <PinnedFormOriginal key={JSON.stringify([formAccess.contextKey, side, item.itemId, item.formRef])} client={formAccess.client} formRef={item.formRef} onAuthenticationLost={formAccess.onAuthenticationLost} /> : null}
 </div>) : <p>{side} 문서 미작성</p>}</section>;
}

// 서버가 돌려준 고정 버전의 정의만 표시한다. 조회·편집·평가·명령/권한 발급 없음.
export function StoredNodeResponsibilities({ node }: { node: MethodologyNode }) {
 return <section aria-label="원본 단계 책임·실행 조건">
  <dl><dt>책임 역할</dt><dd>{roles[node.role]}</dd><dt>진행 방식</dt><dd>{node.mode === 'AUTO' ? '허용 범위 안 자동' : '건별'}</dd></dl>
  <p className="meta">저장 원본 정의입니다. 실제 도구 배정·권한·한도 검증이 아닙니다.</p>
  <details><summary>작업 범위·환경·한도·합류 정의</summary>
   <Values title="포함 작업" values={node.taskScope.included} /><Values title="제외 작업" values={node.taskScope.excluded} />
   <Values title="요구 능력" values={node.requirements?.capabilities ?? []} /><Values title="요구 환경" values={node.requirements?.environment ?? []} />
   <h5>한도 정책 고정 참조</h5>{node.limitPolicyRef ? <p><Reference value={node.limitPolicyRef} /></p> : <p>연결된 한도 정책 없음</p>}
   {node.kind === 'JOIN' ? <section aria-label="원본 합류 정의"><h5>합류 규칙</h5>{node.joinRule?.mode === 'ALL' ? <p>모든 선행 결과</p> : node.joinRule?.mode === 'DECLARED_CONDITION' ? <><p>명시한 결과 조건 · 평가하지 않은 원문</p>{node.joinRule.condition ? <pre>{JSON.stringify(node.joinRule.condition, null, 2)}</pre> : <p>합류 조건 미작성</p>}</> : <p>합류 규칙 미작성</p>}</section> : null}
  </details>
 </section>;
}

interface LimitReadAccess {client:ApiClient;projectId:string;userId:string;clientId:string;sourceRef:VersionRef;onAuthenticationLost:()=>void}
export function StoredNodeDefinition({ node, formAccess,limitAccess }: { node: MethodologyNode; formAccess?: PinnedFormAccess;limitAccess?:LimitReadAccess }) {
 return <div><h4>{node.nodeId}: {node.name}</h4><p>{node.purpose}</p>
  <dl><dt>단계 유형</dt><dd>{kinds[node.kind]}</dd><dt>책임 역할</dt><dd>{roles[node.role]}</dd><dt>진행 방식</dt><dd>{node.mode === 'AUTO' ? '허용 범위 안 자동' : '건별'}</dd></dl>
  <p className="meta">저장 원본 조회이며 편집·실행하지 않습니다. 실제 도구 배정·권한·한도 검증이 아닙니다.</p>
  <Values title="완료·검수 조건" values={node.completionCriteria} />
  <p>입력 문서 {node.inputs.length}건 · 산출 문서 {node.outputs.length}건</p>
  <details><summary>단계 정의 상세</summary>
   <Values title="포함 작업" values={node.taskScope.included} /><Values title="제외 작업" values={node.taskScope.excluded} />
   <StoredMethodDocuments side="입력" items={node.inputs} formAccess={formAccess} /><StoredMethodDocuments side="산출" items={node.outputs} formAccess={formAccess} />
   <Values title="사용자 확인 지점" values={node.approvalBoundary} />
   <Values title="요구 능력" values={node.requirements?.capabilities ?? []} /><Values title="요구 환경" values={node.requirements?.environment ?? []} />
   <Values title="기록 요구" values={node.recordRequirements} />
   <h5>한도 정책 고정 참조</h5>{node.limitPolicyRef ? <p><Reference value={node.limitPolicyRef} /></p> : <p>연결된 한도 정책 없음</p>}
   {limitAccess&&node.limitPolicyRef?<StoredLimitPolicy access={limitAccess} nodeId={node.nodeId} reference={node.limitPolicyRef}/>:null}
   {node.kind === 'JOIN' ? <section aria-label="저장된 합류 정의"><h5>합류 규칙</h5>
    {node.joinRule?.mode === 'ALL' ? <p>모든 선행 결과</p> : node.joinRule?.mode === 'DECLARED_CONDITION' ? <><p>명시한 결과 조건 · 평가하지 않은 원문</p>{node.joinRule.condition ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(node.joinRule.condition, null, 2)}</pre> : <p>합류 조건 미작성</p>}</> : <p>합류 규칙 미작성</p>}
   </section> : null}
  </details>
 </div>;
}

function StoredLimitPolicy({access,nodeId,reference}:{access:LimitReadAccess;nodeId:string;reference:VersionRef}){
 const context=JSON.stringify([access.projectId,access.userId,access.clientId,access.sourceRef,nodeId,reference]);
 const [owner,setOwner]=useState({client:access.client,transport:access.client.transport,context,generation:0});
 if(owner.client!==access.client||owner.transport!==access.client.transport||owner.context!==context){setOwner({client:access.client,transport:access.client.transport,context,generation:owner.generation+1});return null;}
 return <LimitPolicyRead key={owner.generation} access={access} reference={reference}/>;
}
function LimitPolicyRead({access,reference}:{access:LimitReadAccess;reference:VersionRef}){
 const [read,setRead]=useState<{token:object;transport:typeof access.client.transport;value:LimitPolicyRecord|null;error:ApiError|null;busy:boolean}|null>(null);
 const current=useRef<object|null>(null),running=useRef(false),alive=useRef(true),lost=useRef(access.onAuthenticationLost);lost.current=access.onAuthenticationLost;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;current.current=null;};},[]);
 const shown=read?.token===current.current&&read.transport===access.client.transport?read:null;
 async function open(){
  if(running.current)return;
  const token={},client=access.client,transport=client.transport,selected=structuredClone(reference),projectId=access.projectId;
  const active=()=>alive.current&&current.current===token&&client.transport===transport;
  running.current=true;current.current=token;setRead({token,transport,value:null,error:null,busy:true});
  try{const value=await readLimitPolicy(client,projectId,selected);if(active())setRead({token,transport,value,error:null,busy:false});}
  catch(cause){if(!active())return;const error=cause instanceof ApiError?cause:new ApiError('LIMIT_POLICY_RESPONSE_INVALID');setRead({token,transport,value:null,error,busy:false});if(error.status===401)lost.current();}
  finally{if(current.current===token)running.current=false;}
 }
 const value=shown?.value,limits=value?.snapshot.limits;
 return <section aria-label="연결 한도 정책 보관 원문">
  <button type="button" disabled={!!shown?.busy} onClick={()=>void open()}>연결 한도 정책 원문 보기</button>
  {shown?<button type="button" onClick={()=>{current.current=null;running.current=false;setRead(null);}}>연결 한도 정책 원문 닫기</button>:null}
  {shown?.busy?<p role="status">연결 한도 정책 보관본 검산 중</p>:null}
  {shown?.error?<p role="alert">{shown.error.message} · {shown.error.code} · 연결 한도 미확인. 원문 보기로 다시 조회하세요.</p>:null}
  {value&&limits?<>
   <p className="meta" style={{overflowWrap:'anywhere'}}>정책 {value.ref.id} · v{value.ref.version} · SHA256 {value.ref.contentHash}</p>
   <p>{value.snapshot.state==='APPLIED'?'보관 적용 상태 (APPLIED)':'보관 회수 상태 (REVOKED)'}</p>
   <p>결정 시각 <time dateTime={value.snapshot.decidedAt}>{value.snapshot.decidedAt}</time> · 기록 만료 시각 <time dateTime={value.snapshot.expiresAt}>{value.snapshot.expiresAt}</time></p>
   <dl><dt>최대 시도</dt><dd>{limits.maxAttempts}회</dd><dt>최대 경과 시간</dt><dd>{limits.maxElapsedMs} ms</dd><dt>최대 호출</dt><dd>{limits.maxCalls}회</dd><dt>동시 임무</dt><dd>{limits.maxConcurrentAssignments}개</dd><dt>최대 임시 보관량</dt><dd>{limits.maxSpoolBytes} bytes</dd><dt>최대 오프라인 시간</dt><dd>{limits.maxOfflineMs} ms</dd></dl>
   {Object.hasOwn(limits,'maxCost')?<p>보관 비용 한도 {limits.maxCost} {limits.currency}</p>:<p>비용 한도 미기록 · 0원 또는 무제한으로 해석하지 않습니다.</p>}
   <p>보관 이유: {value.snapshot.reason}</p><p className="meta">결정자 {value.snapshot.decidedBy.userId}</p>
   <p className="meta">저장 당시 상태와 기한입니다. 현재 정책 효력·잔여 예산·OS/Agent 강제·실행 허가는 미확인입니다. 원본·초안·정책을 변경하지 않습니다.</p>
  </>:null}
 </section>;
}
