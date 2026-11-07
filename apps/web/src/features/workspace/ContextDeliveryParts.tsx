import type { ContextPreparationView } from './context-api.ts';

type Parts = ContextPreparationView['manifest']['deliveryPlan']['parts'];

/** 검증된 저장 후보의 분할 metadata만 보여준다. 부분 본문 조회나 전달은 수행하지 않는다. */
export function ContextDeliveryParts({ parts }: { parts: Parts }) {
 return <details>
  <summary>부분 metadata 자세히 보기</summary>
  <p>준비 단계 · 실제 전달 0 · 부분 본문은 내려받지 않습니다.</p>
  {parts.length ? <table aria-label="저장 후보 부분 metadata">
   <thead><tr><th scope="col">partId</th><th scope="col">itemId</th><th scope="col">order</th><th scope="col">byteOffset</th><th scope="col">utf8Bytes</th><th scope="col">부분 contentHash</th><th scope="col">원참조 sourceRef</th><th scope="col">본문참조 bodyRef</th></tr></thead>
   <tbody>{parts.map(part => <tr key={part.partId}><td>{part.partId}</td><td>{part.itemId}</td><td>{part.order}</td><td>{part.byteOffset}</td><td>{part.utf8Bytes}</td><td><code>{part.contentHash}</code></td><td><code>{JSON.stringify(part.sourceRef)}</code></td><td><code>{JSON.stringify(part.bodyRef)}</code></td></tr>)}</tbody>
  </table> : <p>계획된 부분이 없습니다.</p>}
 </details>;
}
