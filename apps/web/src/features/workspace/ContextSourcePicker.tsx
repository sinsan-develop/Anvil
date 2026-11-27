import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../api/client.ts';
import { loadContextKnowledgeCandidates } from './context-knowledge-search.ts';
import { listDocuments, readDocument } from '../design-trace/api.ts';
import { listConversations, listConversationMessages, readConversationMessage } from '../knowledge/conversation-api.ts';
import type { ContextSlotCode, ContextSourceSelection } from '../../../../server/modules/context/context-input.ts';
import type {KnowledgeScope} from '../../../../server/modules/knowledge/knowledge-entry.ts';
import {KnowledgeScopeSummary} from '../knowledge/KnowledgeScopePicker.tsx';
import type { KnowledgeSearchScope } from '../knowledge/knowledge-search-scope.ts';
import { ordered } from '../knowledge/review-view.ts';
import { readProjectConstitution, type ConstitutionView } from '../knowledge/constitution-api.ts';
import { ConstitutionReadOnly } from '../knowledge/constitution-read-only.ts';
import type { ConfirmedAssignmentView } from './assignment-confirmation-api.ts';

interface Preview { selection: ContextSourceSelection; body: string; label: string;knowledgeScope?:KnowledgeScope }
type Kind = 'KNOWLEDGE' | 'DOCUMENT' | 'INSTRUCTION';
type Active = () => boolean;
type TaskRef = ConfirmedAssignmentView['snapshot']['definition']['taskRef'];
const scopeLabels = {PROJECT:'프로젝트 전체',STAGE:'확정 임무의 적용 단계',TASK:'확정 임무의 업무',STAGE_OR_TASK:'확정 임무의 단계 또는 업무'} as const;
type ScopeMode = keyof typeof scopeLabels;
type KnowledgeFilter = {mode: ScopeMode; includeProjectWide: boolean};
interface Candidate { key: string; label: string; inspect: (active: Active) => Promise<Preview | null> }
interface List { kind: Kind; items: Candidate[]; query: string; next: ((active: Active) => Promise<void>) | null }
interface PickerProps {
 client: ApiClient;
 projectId: string;
 taskRef?: TaskRef;
 code: ContextSlotCode;
 disabled: boolean;
 selectionBlocked?: boolean;
 isSourceCurrent?: Active;
 run: (action: () => Promise<void>) => void;
 onSelect: (selection: ContextSourceSelection) => void;
}

function CurrentConstitutionPicker({client, projectId, disabled, selectionBlocked, isSourceCurrent, run, onSelect}: PickerProps) {
 type Read = {view: ConstitutionView; active: Active};
 const [shown, setShown] = useState<Read | null>(null);
 const picked = useRef<Read | null>(null), request = useRef(0);
 const transport = client.transport;
 const controls = useRef({disabled, selectionBlocked});
 useLayoutEffect(() => { controls.current = {disabled, selectionBlocked}; });
 const owner = useRef<object | null>(null);
 useLayoutEffect(() => {
  owner.current = {};
  setShown(null);
  return () => { owner.current = null; picked.current = null; };
 }, [client, transport, projectId, isSourceCurrent]);
 function read() {
  const bound = owner.current;
  const inScope = () => !!bound && owner.current === bound && client.transport === transport && (isSourceCurrent?.() ?? true);
  if (controls.current.disabled || !inScope()) return;
  run(async () => {
   if (!inScope()) return;
   const ticket = ++request.current;
   const active = () => inScope() && request.current === ticket;
   picked.current = null;
   setShown(null);
   try {
    const view = await readProjectConstitution(client, projectId);
    if (!active()) return;
    const result = {view, active};
    picked.current = result;
    setShown(result);
   } catch (cause) {
    if (active()) throw cause;
   }
  });
 }
 const current = shown?.view.current;
 function add(read: Read) {
  const constitution = read.view.current;
  if (!constitution?.eligibility.usable || controls.current.disabled || controls.current.selectionBlocked
    || picked.current !== read || !read.active()) return;
  picked.current = null;
  setShown(null);
  onSelect({kind:'KNOWLEDGE_VERSION',versionRef:constitution.application.versionRef});
 }
 return <section aria-label="맥락 원문 선택">
  <button type="button" disabled={disabled} onClick={read}>현재 적용 헌법 원문 조회</button>
  {shown && !disabled && shown.active() ? <>
   <ConstitutionReadOnly current={shown.view.current} observedAt={shown.view.observedAt}/>
   {current?.eligibility.usable ? <button type="button" disabled={selectionBlocked} onClick={() => add(shown)}>이 정확 원문을 선택 슬롯에 추가</button> : null}
  </> : null}
 </section>;
}

export function ContextSourcePicker(props: PickerProps) {
 return props.code === 'RULES_SCOPE' ? <CurrentConstitutionPicker {...props}/> : <OtherContextSourcePicker {...props}/>;
}

function OtherContextSourcePicker({ client, projectId, taskRef, code, disabled, selectionBlocked=false, run, onSelect }: PickerProps) {
 const [list, setList] = useState<List | null>(null), [preview, setPreview] = useState<{value:Preview;list:List;active:Active} | null>(null);
 const [knowledgeQuery, setKnowledgeQuery] = useState('');
 const [knowledgeFilter,setKnowledgeFilter]=useState<KnowledgeFilter>({mode:'PROJECT',includeProjectWide:false});
 const selectedFilter=useRef(knowledgeFilter);
 const {mode,includeProjectWide}=knowledgeFilter;
 const transport = client.transport, taskKey = ordered(taskRef ?? null);
 const owner = useRef<object | null>(null), request = useRef(0), listed = useRef<List | null>(null), activity = useRef<Kind | null>(null);
 function clearList() { listed.current = null; setList(null); setPreview(null); }
 useLayoutEffect(() => {
  owner.current = {};
  activity.current = null;
  clearList();
  return () => { owner.current = null; listed.current = null; };
 }, [client, transport, projectId, taskKey, code]);
 useEffect(() => { if (disabled) setPreview(null); }, [disabled]);
 const scoped = !!taskRef && ['DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'].includes(code);
 const scope:KnowledgeSearchScope|null = !scoped || mode === 'PROJECT' || !taskRef ? null : {
  stageRef: mode === 'TASK' ? null : {applicationRef:taskRef.applicationRef,nodeId:taskRef.nodeId},
  taskRef: mode === 'STAGE' ? null : {planRef:taskRef.planRef,taskCode:taskRef.taskCode},
  includeProjectWide,
 };
 function changeFilter(change:Partial<KnowledgeFilter>) {
  const next={...selectedFilter.current,...change};
  if(next.mode===selectedFilter.current.mode&&next.includeProjectWide===selectedFilter.current.includeProjectWide)return;
  selectedFilter.current=next;
  if(activity.current==='KNOWLEDGE'){++request.current;clearList();}
  setKnowledgeFilter(next);
 }
 function start(kind: Kind, action: (active: Active) => Promise<void>) {
  const bound = owner.current;
  if (disabled || !bound || client.transport !== transport) return;
  const inScope=()=>owner.current===bound&&client.transport===transport&&(kind!=='KNOWLEDGE'||selectedFilter.current===knowledgeFilter);
  run(async () => {
   if (!inScope()) return;
   const ticket=++request.current;
   activity.current=kind;
   const active=()=>inScope()&&request.current===ticket;
   try { await action(active); } catch (cause) { if (active()) throw cause; }
  });
 }
 async function load(active: Active, kind: Kind, cursor: string | null = null, conversationId: string | null = null, searchQuery=knowledgeQuery, searchScope=scope) {
  clearList();
  let candidates: Candidate[], nextCursor: string | null;
  if (kind === 'KNOWLEDGE') {
   const page=await loadContextKnowledgeCandidates(client,projectId,code,searchQuery,cursor,searchScope);nextCursor=page.nextCursor;searchQuery=page.query;candidates=page.items;
  } else if (kind === 'DOCUMENT') {
   const page = await listDocuments(client, projectId, cursor); nextCursor = page.nextCursor;
   candidates = page.items.map(hit => ({ key: hit.id, label: hit.title + ' · 확정 v' + (hit.confirmedVersion ?? '없음') + ' · 최신 v' + hit.headVersion,
    inspect: async () => { const value = await readDocument(client, projectId, hit.id, hit.confirmedVersion ?? hit.headVersion), d = value.document; return { selection: { kind: 'DOCUMENT_VERSION', versionRef: { id: d.id, version: d.version, contentHash: d.contentHash } }, body: value.body, label: d.title + ' · v' + d.version + ' · ' + (d.confirmed ? '확정 이력 있음' : '미확정') + ' · 현재 검토는 저장 시 재확인' }; } }));
  } else if (!conversationId) {
   const page = await listConversations(client, projectId, cursor); nextCursor = page.nextCursor;
   candidates = page.items.map(hit => ({ key: hit.id, label: '대화 ' + hit.id + ' · 순번 ' + hit.headSequence, inspect: async active => { await load(active, 'INSTRUCTION', null, hit.id); return null; } }));
  } else {
   const page = await listConversationMessages(client, projectId, conversationId, cursor); nextCursor = page.nextCursor;
   candidates = page.items.filter(hit => hit.kind === 'USER_INSTRUCTION').map(hit => ({ key: hit.sourceRef.id, label: '사용자 지시 · 감사 순번 ' + hit.serverSequence,
    inspect: async () => { const value = await readConversationMessage(client, projectId, conversationId, hit.sourceRef); return { selection: { kind: 'USER_INSTRUCTION', conversationId, messageRef: value.sourceRef }, body: value.body, label: '사용자 지시 원문 · 관련성/정정·효력은 저장 시 별도 확인' }; } }));
  }
  if (!active()) return;
  const page:List = {kind,items:candidates,query:searchQuery,next:nextCursor ? active => load(active,kind,nextCursor,conversationId,searchQuery,searchScope) : null};
  listed.current = page;
  setList(page);
 }
 function inspect(page: List, candidate: Candidate) {
  if (listed.current !== page) return;
  start(page.kind,async active => {
   if (listed.current !== page) return;
   setPreview(null);
   const value = await candidate.inspect(active);
   if (active() && listed.current === page && value) setPreview({value,list:page,active});
  });
 }
 const shown = preview && preview.list === list && preview.active() ? preview.value : null;
 return <section aria-label="맥락 원문 선택"><p>서버에서 조회한 정확 버전만 추가합니다. 본문은 준비 입력에 복사하지 않습니다.</p>
  {code!=='LATEST_INSTRUCTIONS'?<label>지식 제목·이유 검색<input aria-label="지식 제목·이유 검색" maxLength={200} disabled={disabled} value={knowledgeQuery} onChange={event=>setKnowledgeQuery(event.target.value)}/></label>:null}
  {scoped ? <><label>지식 검색 범위<select aria-label="지식 검색 범위" disabled={disabled} value={mode} onChange={event=>{const value=event.target.value;if(Object.hasOwn(scopeLabels,value))changeFilter({mode:value as ScopeMode});}}>{Object.entries(scopeLabels).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>
   {mode !== 'PROJECT' ? <label><input type="checkbox" disabled={disabled} checked={includeProjectWide} onChange={event=>changeFilter({includeProjectWide:event.target.checked})}/>프로젝트 공통 지식 포함</label> : null}</> : null}
  {code !== 'LATEST_INSTRUCTIONS' ? <button disabled={disabled} onClick={() => start('KNOWLEDGE',active=>load(active,'KNOWLEDGE'))}>지식 원문 목록</button> : <button disabled={disabled} onClick={() => start('INSTRUCTION',active=>load(active,'INSTRUCTION'))}>사용자 지시 대화 목록</button>}
  {['CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'].includes(code) ? <button disabled={disabled} onClick={() => start('DOCUMENT',active=>load(active,'DOCUMENT'))}>문서 원문 목록</button> : null}
  {list?.kind==='KNOWLEDGE'?<p className="meta">이 지식 목록의 제목·이유 검색 조건: {list.query||'전체'} · 다음 목록도 같은 조건으로 조회합니다.</p>:null}
  <ul>{list?.items.map(item => <li key={item.key}>{item.label}<button disabled={disabled} onClick={() => inspect(list,item)}>원문 열기</button></li>)}</ul>
  {list?.next ? <button disabled={disabled} onClick={() => { const next=list.next;if(next&&listed.current===list)start(list.kind,next); }}>원문 다음 목록</button> : null}{list && !list.items.length ? <p>이 목록에 선택 가능한 원문이 없습니다. 필수 누락은 그대로 남깁니다.</p> : null}
  {shown && !disabled ? <><p>{shown.label}</p>{shown.knowledgeScope?<KnowledgeScopeSummary scope={shown.knowledgeScope} label="맥락 선택 지식 관련성"/>:null}<pre>{shown.body}</pre><button disabled={disabled||selectionBlocked} onClick={() => { if(disabled||selectionBlocked||!preview?.active()||preview.list!==listed.current)return;onSelect(shown.selection); setPreview(null); }}>이 정확 원문을 선택 슬롯에 추가</button></> : null}
 </section>;
}
