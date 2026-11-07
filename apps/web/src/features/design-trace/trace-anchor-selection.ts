import type { DesignAnchorContext, DesignAnchorSelection } from './design-anchor.ts';
import type { TraceRef } from './trace-api.ts';

export function traceAnchorSelection(context: DesignAnchorContext, endpoint: TraceRef): DesignAnchorSelection | null {
  if (endpoint.kind !== 'DESIGN_ITEM'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(context.projectId)
    || !/^[0-9a-f]{64}$/.test(context.bodyHash)
    || endpoint.versionRef.id !== context.documentRef.id
    || endpoint.versionRef.version !== context.documentRef.version
    || endpoint.versionRef.contentHash !== context.documentRef.contentHash
    || !/^line:[1-9][0-9]{0,7}$/.test(endpoint.anchor ?? '')) return null;
  return { projectId: context.projectId, documentRef: { ...context.documentRef }, bodyHash: context.bodyHash, anchor: endpoint.anchor! };
}
