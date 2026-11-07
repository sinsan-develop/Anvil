import {useState} from 'react';
import {ApiError} from '../../api/client.ts';
import {capabilityNames} from './api.ts';
import {changeCandidateDocumentation,type CandidateDocumentation,type CapabilityCode} from './candidate-documentation.ts';
export function CandidateDocumentationEditor({candidate,disabled,onChange}:{candidate:Record<string,unknown>&{label:string};disabled:boolean;onChange:(value:Record<string,unknown>&{label:string})=>void}){
 const [error,setError]=useState<string|null>(null),provided=Object.hasOwn(candidate,'documentation'),docs=Array.isArray(candidate.documentation)?candidate.documentation as CandidateDocumentation[]:[];
 function change(code:CapabilityCode,patch:Partial<Omit<CandidateDocumentation,'code'>>|null){if(disabled)return;try{const next=changeCandidateDocumentation(candidate,code,patch);setError(null);onChange(next);}catch(cause){setError(cause instanceof ApiError?cause.code:'CANDIDATE_DOCUMENTATION_EDIT_INVALID');}}
 return <section aria-label="도구 후보 문서 근거"><h4>능력별 문서 근거</h4><p>문서 출처와 호환성에 대한 사용자 보고입니다. 확인됨·미지원 선택도 실제 Agent 능력·통제의 실측 결과가 아닙니다.</p>
 <label><input type="checkbox" disabled={disabled} checked={provided} onChange={event=>{if(disabled)return;const next=structuredClone(candidate);if(event.target.checked)next.documentation=[];else delete next.documentation;setError(null);onChange(next);}}/>문서 근거 목록 제공</label>
 {error?<p role="alert">{error} · 원입력을 보존합니다.</p>:null}
 {provided?<fieldset disabled={disabled}><legend>문서 근거 선택·작성</legend>{(Object.keys(capabilityNames) as CapabilityCode[]).map(code=>{const doc=docs.find(d=>d.code===code),name=capabilityNames[code];return <div key={code}>
  <label><input type="checkbox" checked={!!doc} onChange={event=>change(code,event.target.checked?{}:null)}/>{name} 문서 근거 제공</label>
  {doc?<><label>{name} 문서 URL<input type="text" maxLength={2048} value={doc.source} onChange={event=>change(code,{source:event.target.value})}/></label>
   <label>{name} 문서 확인 시각 UTC<input type="text" maxLength={24} placeholder="2026-10-20T00:00:00.000Z" value={doc.observedAt} onChange={event=>change(code,{observedAt:event.target.value})}/></label>
   <label>{name} 문서 버전 호환성<select value={doc.versionCompatibility} onChange={event=>change(code,{versionCompatibility:event.target.value as CandidateDocumentation['versionCompatibility']})}><option value="UNVERIFIED">미확인 · 사용자 보고</option><option value="CONFIRMED">문서상 확인됨 · 사용자 보고</option><option value="UNSUPPORTED">문서상 미지원 · 사용자 보고</option></select></label>
  </>:null}
 </div>;})}</fieldset>:<p>목록 미제공 · 알려진 근거 없음과 구분합니다.</p>}</section>;
}
export function CandidateDocumentationFact({documentation}:{documentation:CandidateDocumentation|undefined}){
 return documentation?<><p>보관 입력 · USER_REPORTED · 실측 아님</p><p>출처: <code>{documentation.source}</code></p><p>문서 확인 시각: <time dateTime={documentation.observedAt}>{documentation.observedAt}</time></p><p>문서 버전 호환성 보고: {documentation.versionCompatibility}</p></>:<>문서 근거 미제공</>;
}
