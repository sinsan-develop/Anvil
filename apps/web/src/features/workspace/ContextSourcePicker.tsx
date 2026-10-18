import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../api/client.ts';
import { loadContextKnowledgeCandidates } from './context-knowledge-search.ts';
import { listDocuments, readDocument } from '../design-trace/api.ts';
import { listConversations, listConversationMessages, readConversationMessage } from '../knowledge/conversation-api.ts';
import type { ContextSlotCode, ContextSourceSelection } from '../../../../server/modules/context/context-input.ts';

interface Preview { selection: ContextSourceSelection; body: string; label: string }
interface Candidate { key: string; label: string; inspect: () => Promise<Preview | null> }
export function ContextSourcePicker({ client, projectId, code, disabled, selectionBlocked=false, run, onSelect }: { client: ApiClient; projectId: string; code: ContextSlotCode; disabled: boolean;selectionBlocked?:boolean; run: (action: () => Promise<void>) => void; onSelect: (selection: ContextSourceSelection) => void }) {
 const [items, setItems] = useState<Candidate[]>([]), [preview, setPreview] = useState<Preview | null>(null), [next, setNext] = useState<(() => Promise<void>) | null>(null), [loaded, setLoaded] = useState(false);
 const [knowledgeQuery,setKnowledgeQuery]=useState(''),[listedKnowledgeQuery,setListedKnowledgeQuery]=useState<string|null>(null);
 const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 useEffect(() => { if (disabled) setPreview(null); }, [disabled]);
 async function load(kind: 'KNOWLEDGE' | 'DOCUMENT' | 'INSTRUCTION', cursor: string | null = null, conversationId: string | null = null,searchQuery=knowledgeQuery) {
  if (disabled) return; setPreview(null); setItems([]); setNext(null); setLoaded(false);setListedKnowledgeQuery(null);
  let candidates: Candidate[], nextCursor: string | null;
  if (kind === 'KNOWLEDGE') {
   const page=await loadContextKnowledgeCandidates(client,projectId,code,searchQuery,cursor);nextCursor=page.nextCursor;searchQuery=page.query;candidates=page.items;
  } else if (kind === 'DOCUMENT') {
   const page = await listDocuments(client, projectId, cursor); nextCursor = page.nextCursor;
   candidates = page.items.map(hit => ({ key: hit.id, label: hit.title + ' · 확정 v' + (hit.confirmedVersion ?? '없음') + ' · 최신 v' + hit.headVersion,
    inspect: async () => { const value = await readDocument(client, projectId, hit.id, hit.confirmedVersion ?? hit.headVersion), d = value.document; return { selection: { kind: 'DOCUMENT_VERSION', versionRef: { id: d.id, version: d.version, contentHash: d.contentHash } }, body: value.body, label: d.title + ' · v' + d.version + ' · ' + (d.confirmed ? '확정 이력 있음' : '미확정') + ' · 현재 검토는 저장 시 재확인' }; } }));
  } else if (!conversationId) {
   const page = await listConversations(client, projectId, cursor); nextCursor = page.nextCursor;
   candidates = page.items.map(hit => ({ key: hit.id, label: '대화 ' + hit.id + ' · 순번 ' + hit.headSequence, inspect: async () => { await load('INSTRUCTION', null, hit.id); return null; } }));
  } else {
   const page = await listConversationMessages(client, projectId, conversationId, cursor); nextCursor = page.nextCursor;
   candidates = page.items.filter(hit => hit.kind === 'USER_INSTRUCTION').map(hit => ({ key: hit.sourceRef.id, label: '사용자 지시 · 감사 순번 ' + hit.serverSequence,
    inspect: async () => { const value = await readConversationMessage(client, projectId, conversationId, hit.sourceRef); return { selection: { kind: 'USER_INSTRUCTION', conversationId, messageRef: value.sourceRef }, body: value.body, label: '사용자 지시 원문 · 관련성/정정·효력은 저장 시 별도 확인' }; } }));
  }
  if (!alive.current) return; setItems(candidates); setLoaded(true);setListedKnowledgeQuery(kind==='KNOWLEDGE'?searchQuery:null); setNext(nextCursor ? () => () => load(kind, nextCursor, conversationId,searchQuery) : null);
 }
 async function inspect(candidate: Candidate) { if (disabled) return; setPreview(null); const value = await candidate.inspect(); if (alive.current && value) setPreview(value); }
 return <section aria-label="맥락 원문 선택"><p>서버에서 조회한 정확 버전만 추가합니다. 본문은 준비 입력에 복사하지 않습니다.</p>
  {code!=='LATEST_INSTRUCTIONS'?<label>지식 제목·이유 검색<input aria-label="지식 제목·이유 검색" maxLength={200} disabled={disabled} value={knowledgeQuery} onChange={event=>setKnowledgeQuery(event.target.value)}/></label>:null}
  {code !== 'LATEST_INSTRUCTIONS' ? <button disabled={disabled} onClick={() => run(() => load('KNOWLEDGE'))}>지식 원문 목록</button> : <button disabled={disabled} onClick={() => run(() => load('INSTRUCTION'))}>사용자 지시 대화 목록</button>}
  {['CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'].includes(code) ? <button disabled={disabled} onClick={() => run(() => load('DOCUMENT'))}>문서 원문 목록</button> : null}
  {listedKnowledgeQuery!==null?<p className="meta">이 지식 목록의 제목·이유 검색 조건: {listedKnowledgeQuery||'전체'} · 다음 목록도 같은 조건으로 조회합니다.</p>:null}
  <ul>{items.map(item => <li key={item.key}>{item.label}<button disabled={disabled} onClick={() => run(() => inspect(item))}>원문 열기</button></li>)}</ul>
  {next ? <button disabled={disabled} onClick={() => run(next)}>원문 다음 목록</button> : null}{loaded && !items.length ? <p>이 목록에 선택 가능한 원문이 없습니다. 필수 누락은 그대로 남깁니다.</p> : null}
  {preview && !disabled ? <><p>{preview.label}</p><pre>{preview.body}</pre><button disabled={disabled||selectionBlocked} onClick={() => { if(disabled||selectionBlocked)return;onSelect(preview.selection); setPreview(null); }}>이 정확 원문을 선택 슬롯에 추가</button></> : null}
 </section>;
}
