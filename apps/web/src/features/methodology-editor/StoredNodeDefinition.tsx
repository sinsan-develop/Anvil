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

export function StoredNodeDefinition({ node, formAccess }: { node: MethodologyNode; formAccess?: PinnedFormAccess }) {
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
   {node.kind === 'JOIN' ? <section aria-label="저장된 합류 정의"><h5>합류 규칙</h5>
    {node.joinRule?.mode === 'ALL' ? <p>모든 선행 결과</p> : node.joinRule?.mode === 'DECLARED_CONDITION' ? <><p>명시한 결과 조건 · 평가하지 않은 원문</p>{node.joinRule.condition ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(node.joinRule.condition, null, 2)}</pre> : <p>합류 조건 미작성</p>}</> : <p>합류 규칙 미작성</p>}
   </section> : null}
  </details>
 </div>;
}
