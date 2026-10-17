import { useEffect, useState } from 'react';
import { ApiClient, ApiError } from '../../api/client.ts';
import type { VersionRef } from '../../../../../contracts/generated-types.ts';
import type { MethodologyDocumentItem } from '../../../../../contracts/methodologies.ts';
import { readWorkspaceMethodology, type WorkspaceMethodology } from './api.ts';
import { WorkspaceForm } from './WorkspaceForm.tsx';

const kindLabel = { HUMAN: '사람 판단 정의', AGENT: 'Agent 수행 정의', DECISION: '분기 판단 정의', JOIN: '합류 정의' };
const edgeLabel = { SEQUENCE: '순차', BRANCH: '분기', JOIN: '합류', REWORK: '재작업' };
const roleLabel = { USER: '사용자', COORDINATOR: '총괄', STAGE_OWNER: '단계 책임자' };
function DeclaredDocuments({ title, items, client, onAuthenticationLost }: { title: string; items: MethodologyDocumentItem[]; client: ApiClient; onAuthenticationLost: () => void }) {
  return <><h5>{title}</h5>{items.length ? <ul>{items.map(item => <li key={item.itemId}>{item.itemId} · {item.required ? '필수' : '선택'}
    <p className="meta">양식 {item.formRef.id} v{item.formRef.version}<br />{item.formRef.contentHash}</p>
    {item.reviewCriteria.map((text, index) => <p key={index}>{text}</p>)}
    <WorkspaceForm key={[item.itemId, item.formRef.id, item.formRef.version, item.formRef.contentHash].join(':')} client={client} title={item.itemId} formRef={item.formRef} onAuthenticationLost={onAuthenticationLost} />
  </li>)}</ul> : <p>정의 없음</p>}</>;
}
export function WorkspaceMethodology({ client, projectId, expectedRef, onAuthenticationLost }: { client: ApiClient; projectId: string; expectedRef: VersionRef | null; onAuthenticationLost: () => void }) {
  const [value, setValue] = useState<WorkspaceMethodology | null>(null), [error, setError] = useState<ApiError | null>(null);
  const [revision, setRevision] = useState(0), [pending, setPending] = useState(false), [selectedId, setSelectedId] = useState('');
  useEffect(() => {
    if (!revision) return;
    let current = true;
    readWorkspaceMethodology(client, projectId, expectedRef).then(result => { if (current) { setValue(result); setSelectedId(result.snapshot?.graph.entryNodeId ?? ''); } }).catch((cause: unknown) => {
      if (!current) return; const failure = cause instanceof ApiError ? cause : new ApiError('METHODOLOGY_APPLICATION_INTEGRITY_FAILED'); setError(failure);
      if (failure.status === 401) onAuthenticationLost();
    }).finally(() => { if (current) setPending(false); });
    return () => { current = false; };
  }, [client, projectId, expectedRef?.id, expectedRef?.version, expectedRef?.contentHash, revision]);
  const snapshot = value?.snapshot, graph = snapshot?.graph, selected = graph?.nodes.find(node => node.nodeId === selectedId);
  const names = new Map(graph?.nodes.map(node => [node.nodeId, node.name]));
  return <section aria-label="적용된 개발 절차">
    <button disabled={pending} onClick={() => { setValue(null); setError(null); setSelectedId(''); setPending(true); setRevision(previous => previous + 1); }}>{revision ? '적용 절차 새로고침' : '적용 절차 조회'}</button>
    {pending ? <p role="status">고정 적용 절차 조회 중</p> : null}
    {error ? <p role="alert">{error.code} · 적용 절차 미확인. 상단 프로젝트 원본을 새로고침한 뒤 다시 조회하세요.</p> : null}
    {value && !pending && !error ? snapshot && graph ? <>
      <h4>{snapshot.name}</h4><p>{snapshot.purpose}</p><p className="meta">정의 조회 · 실제 실행 상태 미연결 · 적용 세대 {value.applicationRef!.version} · 관측 {value.observedAt}</p>
      <p className="meta">원 정의 {snapshot.sourceRef.id} v{snapshot.sourceRef.version}. 적용 참조와 별개입니다. 목록 순서는 실행 순서가 아니며 연결 조건을 확인하세요.</p>
      <div className="methodology-flow">{graph.nodes.map(node => <button key={node.nodeId} aria-label={`절차 정의: ${node.name}`} aria-pressed={selectedId === node.nodeId} onClick={() => setSelectedId(node.nodeId)}>{node.name}{node.nodeId === graph.entryNodeId ? ' · 시작 정의' : graph.terminalNodeIds.includes(node.nodeId) ? ' · 종료 정의' : ''}</button>)}</div>
      {selected ? <section aria-label="선택한 절차 정의"><h4>{selected.name}</h4><p>{selected.purpose}</p>
        <p>{kindLabel[selected.kind]} · {roleLabel[selected.role]} · {selected.mode === 'AUTO' ? '정의상 자동 방식' : '정의상 건별 방식'}</p><p className="meta">책임 세션·도구 배정/시작 권한이 아니며 선택해도 실행하지 않습니다.</p>
        <dl>{([['허용 업무', selected.taskScope.included], ['제외 업무', selected.taskScope.excluded], ['완료조건', selected.completionCriteria], ['승인 경계', selected.approvalBoundary], ['상황 기록', selected.recordRequirements]] as const).map(([title, texts]) => <div key={title}><dt>{title}</dt><dd>{texts.length ? <ul>{texts.map((text, index) => <li key={index}>{text}</li>)}</ul> : '정의 없음'}</dd></div>)}</dl>
        <DeclaredDocuments key={selectedId + ':input'} title="입력 산출물 양식" items={selected.inputs} client={client} onAuthenticationLost={onAuthenticationLost} /><DeclaredDocuments key={selectedId + ':output'} title="출력 산출물 양식" items={selected.outputs} client={client} onAuthenticationLost={onAuthenticationLost} />
        <p className="meta">고정 양식 참조이며 현재 양식 원문 접근/유효성이나 단계별 실제 문서·실행 결과는 별도 확인이 필요합니다.</p>
        <h5>선행·후속 연결 정의</h5><ul>{graph.edges.filter(edge => edge.fromNodeId === selectedId || edge.toNodeId === selectedId).map(edge => <li key={edge.edgeId}>{names.get(edge.fromNodeId)} → {names.get(edge.toNodeId)} · {edgeLabel[edge.kind]} · {edge.reason}{edge.condition !== null ? <pre className="document-plain">{JSON.stringify(edge.condition, null, 2)}</pre> : <p className="meta">연결 조건 정의 없음</p>}</li>)}</ul>
      </section> : null}
    </> : <p>조회된 적용본 없음 · 실행 상태는 미연결입니다.</p> : null}
  </section>;
}
