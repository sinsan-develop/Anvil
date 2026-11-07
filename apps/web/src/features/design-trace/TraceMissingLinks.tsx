import type { DesignAnchorSelection } from './design-anchor.ts';
import type { TraceView } from './trace-api.ts';
import type { PlanRef } from './work-plan-api.ts';
import { traceAnchorSelection } from './trace-anchor-selection.ts';

export function TraceMissingLinks({ projectId, documentRef, bodyHash, missingLinks, loading, onAnchorSelect }: {
 projectId: string; documentRef: PlanRef; bodyHash?: string; missingLinks: TraceView['missingLinks']; loading: boolean;
 onAnchorSelect?: (selection: DesignAnchorSelection | null) => void;
}) {
 if (!missingLinks.length) return null;
 return <><h4>계획 업무 연결 누락</h4><ul>{missingLinks.map((item, index) => {
  const selection = bodyHash ? traceAnchorSelection({ projectId, documentRef, bodyHash }, item.ref) : null;
  const allowed = !!selection && !!onAnchorSelect && !loading;
  return <li key={item.ref.id + ':' + index}>{item.ref.localCode} · {item.ref.anchor} · {item.code}
   <button disabled={!allowed} onClick={() => { if (allowed && selection && onAnchorSelect) onAnchorSelect(selection); }}>{item.ref.localCode} 누락 설계 원문 보기</button>
  </li>;
 })}</ul></>;
}
