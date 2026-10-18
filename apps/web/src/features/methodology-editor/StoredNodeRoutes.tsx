import type { MethodologyGraph } from '../../../../../contracts/methodologies.ts';

const kinds = { SEQUENCE: '순차 연결', BRANCH: '조건 분기', JOIN: '결과 합류', REWORK: '재작업/반복' };

export function StoredNodeRoutes({ graph, nodeId }: { graph: MethodologyGraph; nodeId: string }) {
 if (!graph.nodes.some(node => node.nodeId === nodeId)) return <p role="status">선택 단계 미확인 · 다른 단계의 연결을 대신 표시하지 않습니다.</p>;
 const edges = graph.edges.filter(edge => edge.fromNodeId === nodeId);
 return <details><summary>다음·재작업 경로</summary>
  <p className="meta">저장된 연결 정의 조회입니다. 조건 평가·작업 시작·자동 재시작이 아닙니다.</p>
  {graph.terminalNodeIds.includes(nodeId) ? <p>방법론에 지정된 종료점 · 실제 완료 판정이 아닙니다.</p> : null}
  {edges.length ? edges.map(edge => {
   const target = graph.nodes.find(node => node.nodeId === edge.toNodeId);
   return <section className="status-card" key={edge.edgeId} aria-label={'저장 연결 ' + edge.edgeId}>
    <h5>{edge.edgeId} · {kinds[edge.kind]}</h5><p>{edge.fromNodeId} → {edge.toNodeId}: {target ? target.name : '대상 단계 미확인'}</p>
    <p>연결 이유: {edge.reason || '연결 이유 미작성'}</p><h5>조건 원문</h5>
    {edge.condition ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(edge.condition, null, 2)}</pre> : <p>{edge.kind === 'BRANCH' || edge.kind === 'REWORK' ? '조건 미작성' : '조건 없음 · 실행 판정 아님'}</p>}
    {edge.retryPolicy ? <><h5>재작업 정책</h5><p>최대 {edge.retryPolicy.maxAttempts}회 · 같은 실패 원인 기준</p><p>소진 시: 사용자 판단 요청</p><p className="meta">{edge.retryPolicy.counting} · {edge.retryPolicy.onExhausted}</p></> : edge.kind === 'REWORK' ? <p>재작업 한도 미작성</p> : null}
   </section>;
  }) : <p>선택 단계의 후속 연결 없음 · 실제 완료 판정이 아닙니다.</p>}
 </details>;
}
