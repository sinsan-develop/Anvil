import { ApiClient, ApiError } from '../../api/client.ts';
import { ordered } from '../knowledge/review-view.ts';
import type { PlanRef } from '../design-trace/work-plan-api.ts';
import type { SourceRef } from '../../../../server/modules/knowledge/knowledge-entry.ts';
export interface ImpactTargetRef { kind: 'DOCUMENT_VERSION' | 'DESIGN_ITEM' | 'SCREEN_REGION' | 'PLAN_TASK' | 'EXECUTION' | 'TEST_EVIDENCE'; id: string; versionRef: PlanRef; localCode?: string; anchor?: string }
export interface ImpactVersion { ref: PlanRef; changeRef: PlanRef; sourceKind: 'MECHANICAL_TRACE' | 'HUMAN_REVIEW'; beforeRef: PlanRef; items: { targetRef: ImpactTargetRef; state: 'AFFECTED' | 'UNAFFECTED' | 'UNKNOWN'; reason: string; evidenceRefs: ImpactTargetRef[] }[]; coverageGaps: { code: string; targetRef?: ImpactTargetRef }[]; requiresReview: true; inputs: { planRefs: PlanRef[]; indexedDesign: boolean }; observedAt: string; baseImpactRef?: PlanRef; reason?: string; reviewer?: { kind: 'HUMAN'; userId: string } }
export interface DesignChangePage { change: { ref: PlanRef; status: 'PROPOSED'; beforeRef: PlanRef; afterProposalRef: string; reason: string; sourceRefs: SourceRef[]; requestedBy: { kind: 'HUMAN'; userId: string }; createdAt: string }; impactVersions: ImpactVersion[]; latestImpactRef: PlanRef; hasMoreImpacts: boolean; nextBeforeVersion: number | null; activatedAsBaseline: false; observedAt: string }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const exact = (v: any, keys: string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(',');
const ref = (v: any): v is PlanRef => exact(v, ['id', 'version', 'contentHash']) && uuid(v.id) && Number.isSafeInteger(v.version) && v.version > 0 && typeof v.contentHash === 'string' && /^[0-9a-f]{64}$/.test(v.contentHash);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 20000 && v.isWellFormed();
const at = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);
function target(v: any): v is ImpactTargetRef {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => ['kind', 'id', 'versionRef', 'localCode', 'anchor'].includes(k)) && ['DOCUMENT_VERSION', 'DESIGN_ITEM', 'SCREEN_REGION', 'PLAN_TASK', 'EXECUTION', 'TEST_EVIDENCE'].includes(v.kind) && uuid(v.id) && ref(v.versionRef)
    && (v.localCode === undefined || typeof v.localCode === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v.localCode)) && (v.anchor === undefined || typeof v.anchor === 'string' && /^line:[1-9][0-9]{0,7}$/.test(v.anchor))
    && (v.kind !== 'PLAN_TASK' || v.id === v.versionRef.id && !!v.localCode && v.anchor === undefined) && (v.kind !== 'DOCUMENT_VERSION' || v.id === v.versionRef.id && v.localCode === undefined && v.anchor === undefined);
}
function source(v: any) {
  return !!v && (v.kind === 'DOCUMENT_VERSION' ? exact(v, ['kind', 'id', 'version', 'contentHash']) && ref({ id: v.id, version: v.version, contentHash: v.contentHash }) : ['ARTIFACT', 'CONVERSATION', 'USER_INSTRUCTION'].includes(v.kind) && exact(v, ['kind', 'id', 'contentHash']) && ref({ id: v.id, version: 1, contentHash: v.contentHash }));
}
async function digest(value: unknown) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ordered(value))))].map(n => n.toString(16).padStart(2, '0')).join(''); }
export async function readDesignChange(client: ApiClient, projectId: string, changeId: string, beforeVersion: number | null): Promise<DesignChangePage> {
  if (!uuid(projectId) || !uuid(changeId) || beforeVersion !== null && (!Number.isSafeInteger(beforeVersion) || beforeVersion < 1 || beforeVersion > 999999999999999)) throw new ApiError('CLIENT_PATH_INVALID');
  const query = new URLSearchParams({ limit: '10' }); if (beforeVersion !== null) query.set('beforeVersion', String(beforeVersion));
  const page: any = await client.get(`/api/v1/projects/${projectId}/design-changes/${changeId}?${query}`), fail = (): never => { throw new ApiError('RESPONSE_INVALID'); };
  if (!exact(page, ['change', 'impactVersions', 'latestImpactRef', 'hasMoreImpacts', 'nextBeforeVersion', 'activatedAsBaseline', 'observedAt']) || page.activatedAsBaseline !== false || !at(page.observedAt) || !ref(page.latestImpactRef) || !Array.isArray(page.impactVersions) || page.impactVersions.length > 10 || typeof page.hasMoreImpacts !== 'boolean') fail();
  const c = page.change;
  if (!exact(c, ['ref', 'status', 'beforeRef', 'afterProposalRef', 'reason', 'sourceRefs', 'requestedBy', 'createdAt']) || !ref(c.ref) || c.ref.id !== changeId || c.ref.version !== 1 || c.status !== 'PROPOSED' || !ref(c.beforeRef) || !uuid(c.afterProposalRef) || !text(c.reason) || !Array.isArray(c.sourceRefs) || c.sourceRefs.length > 200 || !c.sourceRefs.every(source) || new Set(c.sourceRefs.map(ordered)).size !== c.sourceRefs.length || !exact(c.requestedBy, ['kind', 'userId']) || c.requestedBy.kind !== 'HUMAN' || !uuid(c.requestedBy.userId) || !at(c.createdAt)) fail();
  const { ref: changeRef, status, requestedBy, createdAt, ...changeSnapshot } = c;
  if (await digest(changeSnapshot) !== changeRef.contentHash) throw new ApiError('DESIGN_CHANGE_INTEGRITY_FAILED');
  let previous = beforeVersion ?? Number.MAX_SAFE_INTEGER;
  for (const impact of page.impactVersions) {
    const human = impact?.sourceKind === 'HUMAN_REVIEW';
    const fields = ['ref', 'changeRef', 'sourceKind', 'beforeRef', 'items', 'coverageGaps', 'requiresReview', 'inputs', 'observedAt', ...(human ? ['baseImpactRef', 'reason', 'reviewer'] : [])];
    if (!exact(impact, fields) || !ref(impact.ref) || impact.ref.id !== page.latestImpactRef.id || impact.ref.version >= previous || impact.ref.version > page.latestImpactRef.version || !same(impact.changeRef, changeRef) || !same(impact.beforeRef, c.beforeRef) || impact.requiresReview !== true || !at(impact.observedAt) || !['HUMAN_REVIEW', 'MECHANICAL_TRACE'].includes(impact.sourceKind)) fail();
    previous = impact.ref.version;
    if (human ? !ref(impact.baseImpactRef) || impact.baseImpactRef.id !== impact.ref.id || impact.baseImpactRef.version !== impact.ref.version - 1 || !text(impact.reason) || !exact(impact.reviewer, ['kind', 'userId']) || impact.reviewer.kind !== 'HUMAN' || !uuid(impact.reviewer.userId) : impact.ref.version !== 1) fail();
    if (!exact(impact.inputs, ['planRefs', 'indexedDesign']) || typeof impact.inputs.indexedDesign !== 'boolean' || !Array.isArray(impact.inputs.planRefs) || impact.inputs.planRefs.length > 8 || !impact.inputs.planRefs.every(ref) || !Array.isArray(impact.items) || impact.items.length > 2000 || !Array.isArray(impact.coverageGaps) || impact.coverageGaps.length > 5000) fail();
    const seen = new Set<string>();
    for (const item of impact.items) {
      if (!exact(item, ['targetRef', 'state', 'reason', 'evidenceRefs']) || !target(item.targetRef) || !text(item.reason) || !(human ? ['AFFECTED', 'UNAFFECTED', 'UNKNOWN'] : ['AFFECTED', 'UNKNOWN']).includes(item.state) || !Array.isArray(item.evidenceRefs) || (human ? item.evidenceRefs.length > 200 || !item.evidenceRefs.every((r: any) => target(r) && r.kind === 'DOCUMENT_VERSION') : item.evidenceRefs.length !== 0) || item.state === 'UNAFFECTED' && !item.evidenceRefs.length) fail();
      const key = ordered(item.targetRef); if (seen.has(key)) fail(); seen.add(key);
    }
    for (const gap of impact.coverageGaps) if (!gap || typeof gap !== 'object' || Array.isArray(gap) || Object.keys(gap).some(k => !['code', 'targetRef'].includes(k)) || typeof gap.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(gap.code) || gap.targetRef !== undefined && !target(gap.targetRef)) fail();
    const { ref: impactRef, observedAt, ...snapshot } = impact; if (await digest(snapshot) !== impactRef.contentHash) throw new ApiError('DESIGN_CHANGE_INTEGRITY_FAILED');
  }
  if (beforeVersion === null && (!page.impactVersions.length || !same(page.impactVersions[0].ref, page.latestImpactRef)) || (page.hasMoreImpacts ? page.impactVersions.length !== 10 || page.nextBeforeVersion !== page.impactVersions.at(-1)?.ref.version : page.nextBeforeVersion !== null)) fail();
  return page;
}
