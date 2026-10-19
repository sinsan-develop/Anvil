import {useEffect,useRef,useState} from 'react';
import {ApiClient,ApiError} from '../../api/client.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {prepareCheckpointRecord,type CheckpointInput,type CheckpointRecordDraft} from './checkpoint-api.ts';
const fields=[['position','현재 작업 위치'],['completed','완료한 내용 · 수행자 주장'],['progress','진행 중인 작업'],['remaining','남은 작업'],['decisions','판단·승인 대기'],['next','다음 행동'],['forbidden','금지 행동'],['reason','기록 이유']] as const;
type Form=Record<typeof fields[number][0],string>;
const empty:Form={position:'',completed:'',progress:'',remaining:'',decisions:'',next:'',forbidden:'자동 재개\n확인되지 않은 완료 처리',reason:''};
const lines=(v:string)=>v.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
export function CheckpointEditor({client,assignment,session,onUnavailable}:{client:ApiClient;assignment:ConfirmedAssignmentView;session:DocumentSession;onUnavailable:(code:string)=>void}){
 const [form,setForm]=useState<Form>(empty),[value,setValue]=useState<CheckpointRecordDraft|null>(null),[error,setError]=useState<string|null>(null),[pending,setPending]=useState(false),generation=useRef(0),unavailable=useRef(onUnavailable);unavailable.current=onUnavailable;
 useEffect(()=>()=>{generation.current++;},[client,assignment.projectId,assignment.ref.id,assignment.ref.version,assignment.ref.contentHash,session.csrfToken]);
 function change(key:keyof Form,text:string){generation.current++;setPending(false);setValue(null);setError(null);setForm(v=>({...v,[key]:text}));}
 async function prepare(){const ticket=++generation.current;setPending(true);setValue(null);setError(null);const active=()=>generation.current===ticket;
  const items=(text:string,prefix:string)=>lines(text).map((description,i)=>({itemId:prefix+'-'+(i+1),description,evidenceRefs:[]}));
  const input:CheckpointInput={baseRef:null,reason:form.reason,state:{assignmentRef:assignment.ref,executionRefs:[],baselineRefs:assignment.snapshot.definition.baselineRefs,currentPosition:{taskRef:assignment.snapshot.definition.taskRef,description:form.position},completedItems:items(form.completed,'completed'),inProgress:items(form.progress,'progress'),remaining:items(form.remaining,'remaining'),sourceSnapshotRefs:[],changedFiles:[],verificationRefs:[],errorFingerprints:[],attemptCounts:[],lastLocalSequence:null,lastServerAck:null,untransmittedRefs:[],pendingDecisions:lines(form.decisions).map((question,i)=>({decisionId:'decision-'+(i+1),question,reason:form.reason,requiredFrom:'HUMAN',sourceRef:null})),nextAction:form.next,forbiddenActions:lines(form.forbidden),recordFileRef:null}};
  try{const result=await prepareCheckpointRecord(client,assignment,input,session,active);if(active()&&result)setValue(result);}catch(cause){if(!active())return;const e=cause instanceof ApiError?cause:new ApiError('CHECKPOINT_RESPONSE_INVALID'),code=/^[A-Z_]{1,80}$/.test(e.code)?e.code:'CHECKPOINT_RESPONSE_INVALID';setError(code);if([401,403,404].includes(e.status))unavailable.current(e.status===401?'AUTH_REQUIRED':code);}finally{if(active())setPending(false);}
 }
 return <section className="status-card" aria-label="상세 작업현황 초안" lang="ko"><h3>상세 작업현황 초안</h3><p>선택한 확정 임무에 연결합니다. 완료·변경·시험은 수행자 기록이며 실제 검수나 안전 재개 판정이 아닙니다.</p><form onSubmit={e=>{e.preventDefault();void prepare();}}>{fields.map(([key,label])=><label key={key}>{label}<textarea value={form[key]} maxLength={20000} required={['position','next','reason'].includes(key)} rows={key==='position'?2:3} onChange={e=>change(key,e.target.value)}/></label>)}<p>목록은 한 줄에 한 항목입니다. 이 화면의 미입력 변경·시험·오류/시도·관측 참조는 ‘없음’으로 검증하지 않으며 로컬 순번/서버 ACK는 미확인으로 남깁니다. 상세 참조 입력과 실제 저장 연결은 미완료입니다.</p><button type="submit" disabled={pending}>{pending?'기록 준비 중':'기록 초안 준비'}</button></form>
 {pending?<p role="status">정확 임무와 대조 중 · 이전 기록 숨김</p>:null}{error?<p role="alert">{error} · 기록 준비 미확인. 자동 저장·재시도하지 않습니다.</p>:null}
 {value?<section aria-label="준비된 현황 기록"><p>서버·파일 저장 미수행 · 완료/안전 재개 승인 아님</p><p>누락·미확인: {value.gaps.join(', ')}</p><p>기록 초안 {value.recordFile.bytes}바이트 · SHA-256 {value.recordFile.contentHash}</p><details><summary>작업현황 기록 초안 보기</summary><pre>{value.recordText}</pre></details></section>:null}
 </section>;
}
