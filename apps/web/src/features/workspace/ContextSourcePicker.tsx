import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../../api/client.ts';
import { readKnowledge, searchKnowledge } from '../knowledge/api.ts';
import { listDocuments, readDocument } from '../design-trace/api.ts';
import { listConversations, listConversationMessages, readConversationMessage } from '../knowledge/conversation-api.ts';
import type { ContextSlotCode, ContextSourceSelection } from '../../../../server/modules/context/context-input.ts';

interface Preview { selection: ContextSourceSelection; body: string; label: string }
interface Candidate { key: string; label: string; inspect: () => Promise<Preview | null> }
export function ContextSourcePicker({ client, projectId, code, disabled, run, onSelect }: { client: ApiClient; projectId: string; code: ContextSlotCode; disabled: boolean; run: (action: () => Promise<void>) => void; onSelect: (selection: ContextSourceSelection) => void }) {
 const [items, setItems] = useState<Candidate[]>([]), [preview, setPreview] = useState<Preview | null>(null), [next, setNext] = useState<(() => Promise<void>) | null>(null), [loaded, setLoaded] = useState(false);
 const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
 useEffect(() => { if (disabled) setPreview(null); }, [disabled]);
 async function load(kind: 'KNOWLEDGE' | 'DOCUMENT' | 'INSTRUCTION', cursor: string | null = null, conversationId: string | null = null) {
  if (disabled) return; setPreview(null); setItems([]); setNext(null); setLoaded(false);
  let candidates: Candidate[], nextCursor: string | null;
  if (kind === 'KNOWLEDGE') {
   const filter = ({ PURPOSE_REASON: 'PURPOSE', RULES_SCOPE: 'CONSTITUTION', DECISIONS_REASON: 'DECISION' } as Record<string, string>)[code] ?? '';
   const page = await searchKnowledge(client, projectId, '', filter, cursor); nextCursor = page.nextCursor;
   candidates = page.items.map(hit => ({ key: hit.versionRef.id + ':' + hit.versionRef.version, label: hit.title + ' · ' + hit.kind + ' · ' + hit.state,
    inspect: async () => { const value = await readKnowledge(client, projectId, hit.versionRef); return { selection: { kind: 'KNOWLEDGE_VERSION', versionRef: value.ref }, body: value.body, label: value.entry.title + ' · ' + value.state + ' · 의미 적합/효력 미확인' }; } }));
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
  if (!alive.current) return; setItems(candidates); setLoaded(true); setNext(nextCursor ? () => () => load(kind, nextCursor, conversationId) : null);
 }
 async function inspect(candidate: Candidate) { if (disabled) return; setPreview(null); const value = await candidate.inspect(); if (alive.current && value) setPreview(value); }
 return <section aria-label="맥락 원문 선택"><p>서버에서 조회한 정확 버전만 추가합니다. 본문은 준비 입력에 복사하지 않습니다.</p>
  {code !== 'LATEST_INSTRUCTIONS' ? <button disabled={disabled} onClick={() => run(() => load('KNOWLEDGE'))}>지식 원문 목록</button> : <button disabled={disabled} onClick={() => run(() => load('INSTRUCTION'))}>사용자 지시 대화 목록</button>}
  {['CURRENT_POSITION', 'ACTUAL_GAPS', 'NEXT_ACTION'].includes(code) ? <button disabled={disabled} onClick={() => run(() => load('DOCUMENT'))}>문서 원문 목록</button> : null}
  <ul>{items.map(item => <li key={item.key}>{item.label}<button disabled={disabled} onClick={() => run(() => inspect(item))}>원문 열기</button></li>)}</ul>
  {next ? <button disabled={disabled} onClick={() => run(next)}>원문 다음 목록</button> : null}{loaded && !items.length ? <p>이 목록에 선택 가능한 원문이 없습니다. 필수 누락은 그대로 남깁니다.</p> : null}
  {preview && !disabled ? <><p>{preview.label}</p><pre>{preview.body}</pre><button disabled={disabled} onClick={() => { onSelect(preview.selection); setPreview(null); }}>이 정확 원문을 선택 슬롯에 추가</button></> : null}
 </section>;
}
