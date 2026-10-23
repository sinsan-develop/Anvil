import {canonicalJson, contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {analyzeWorkPlanCards, exactKeys, type PlanTraceRef} from './work-plan-card.ts';

// 미등록 순수 분석 후보. 투영 자체의 문맥·해시는 실제 원문/귀속/현재 권위를 증명하지 않는다.
const invalid = (): never => { throw new Error('PLAN_TRACE_COVERAGE_INPUT_INVALID'); };
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const uuid = (v: unknown): v is string => isVersionRef({id:v,version:1,contentHash:'0'.repeat(64)});
const text = (v: unknown, max = 20_000): v is string => typeof v === 'string' && v.length <= max && v.isWellFormed();
const code = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const anchor = (v: unknown): v is string => typeof v === 'string' && /^line:[1-9][0-9]{0,7}$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const iso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v));
const list = (v: unknown, max = 200): v is any[] => Array.isArray(v) && v.length <= max;
const refs = (v: unknown): v is VersionRef => isVersionRef(v);
type Item = {id:string;documentRef:VersionRef;localCode:string;title:string;anchor:string;itemHash:string};
type Screen = {id:string;designItemId:string;screenCode:string;documentRef:VersionRef;artifactRef:unknown;anchor:string;regionHash:string};

function analyze(input: unknown, expected: unknown) {
  // descriptor 검사를 먼저 수행하므로 getter를 실행하거나 외부 객체를 그대로 반환하지 않는다.
  const v: unknown = JSON.parse(canonicalJson(input)), e: unknown = JSON.parse(canonicalJson(expected));
  if (!exactKeys(v,['projectId','index','plan']) || !exactKeys(e,['projectId','designRef','planRef'])
    || !uuid(e.projectId) || v.projectId !== e.projectId || !refs(e.designRef) || !refs(e.planRef)) return invalid();
  const index = v.index, plan = v.plan;
  if (!exactKeys(index,['documentRef','items','screenRegions','status','observedAt'])
    || !refs(index.documentRef) || !same(index.documentRef,e.designRef) || !iso(index.observedAt)
    || !list(index.items) || !list(index.screenRegions) || !['INDEXED','NOT_INDEXED'].includes(index.status)
    || (index.status === 'INDEXED') !== (index.items.length > 0)
    || (index.status === 'NOT_INDEXED' && index.screenRegions.length > 0)) return invalid();
  const items = new Map<string,Item>(), itemCodes = new Set<string>(), screens = new Map<string,Screen>(), screenKeys = new Set<string>();
  for (const item of index.items) {
    if (!exactKeys(item,['id','documentRef','localCode','title','anchor','itemHash']) || !uuid(item.id)
      || !refs(item.documentRef) || !same(item.documentRef,index.documentRef) || !code(item.localCode)
      || !text(item.title,200) || !item.title.trim() || !anchor(item.anchor) || !hash(item.itemHash)
      || items.has(item.id) || itemCodes.has(item.localCode)) return invalid();
    const {id,itemHash,...payload} = item;
    if (contentHash(canonicalJson(payload)) !== itemHash) return invalid();
    items.set(id,item as Item); itemCodes.add(item.localCode);
  }
  for (const screen of index.screenRegions) {
    if (!exactKeys(screen,['id','designItemId','screenCode','documentRef','artifactRef','anchor','regionHash'])
      || !uuid(screen.id) || !items.has(screen.designItemId) || !code(screen.screenCode) || !refs(screen.documentRef)
      || !anchor(screen.anchor) || !hash(screen.regionHash) || screens.has(screen.id)
      || !exactKeys(screen.artifactRef,['artifactId','bytes','contentHash','mediaType'])
      || !uuid(screen.artifactRef.artifactId) || !Number.isSafeInteger(screen.artifactRef.bytes) || screen.artifactRef.bytes < 0
      || !hash(screen.artifactRef.contentHash) || !text(screen.artifactRef.mediaType,200) || !screen.artifactRef.mediaType.trim()) return invalid();
    const {id,regionHash,...payload} = screen;
    const key = canonicalJson([screen.designItemId,screen.screenCode,screen.anchor]);
    if (screenKeys.has(key) || contentHash(canonicalJson(payload)) !== regionHash) return invalid();
    screens.set(id,screen as Screen); screenKeys.add(key);
  }
  if (!exactKeys(plan,['ref','status','documentRef','designRef','screenReviewRefs','tasks','dependencies','reason','issues','relationalProjection','executionEvidence','observedAt'])
    || !refs(plan.ref) || !same(plan.ref,e.planRef) || !refs(plan.documentRef) || !refs(plan.designRef)
    || !same(plan.designRef,e.designRef) || plan.status !== 'DRAFT' || plan.executionEvidence !== 'NOT_CONNECTED'
    || !iso(plan.observedAt) || !list(plan.screenReviewRefs) || !list(plan.dependencies,80_000) || !list(plan.issues,200_000)
    || !text(plan.reason) || !plan.reason.trim() || !['STORED','ISSUES_ONLY'].includes(plan.relationalProjection)) return invalid();
  for (const r of plan.screenReviewRefs) if (!exactKeys(r,['id','targetRef','criteriaVersion','outcome'])
    || !uuid(r.id) || !refs(r.targetRef) || r.criteriaVersion !== 1 || r.outcome !== 'ACCEPTED') return invalid();
  for (const i of plan.issues) if (!exactKeys(i,['code','location','message']) || !code(i.code) || !text(i.location) || !text(i.message)) return invalid();
  const {ref,status,executionEvidence,observedAt,...snapshot} = plan;
  if (contentHash(canonicalJson(snapshot)) !== ref.contentHash) return invalid();
  const cards = analyzeWorkPlanCards(plan.tasks);
  if (!same(cards.dependencies.map(d=>canonicalJson(d)).sort(),plan.dependencies.map(d=>canonicalJson(d)).sort())) return invalid();
  const planIssueCodes = [...new Set<string>([...plan.issues,...cards.issues].map(i=>i.code))].sort();
  const base = {designRef:e.designRef as VersionRef,planRef:e.planRef as VersionRef,planIssueCodes,
    projectScopeAuthenticated:false,sourceTextVerified:false,accepted:false,completionDetermined:false,storageMutationPerformed:false,executionAuthorized:false};
  const unavailable = (reason: string) => ({...base,status:'UNAVAILABLE' as const,reason,
    unlinkedDesignItems:null,unlinkedScreenRegions:null,invalidTaskLinks:null,ungroundedTasks:null});
  if (index.status === 'NOT_INDEXED') return unavailable('DESIGN_INDEX_UNAVAILABLE');
  if (plan.relationalProjection !== 'STORED' || cards.issues.some(i=>['DUPLICATE_TASK_CODE','DEPENDENCY_CYCLE','DEPENDENCY_TASK_NOT_FOUND','SELF_DEPENDENCY','DUPLICATE_DEPENDENCY','DEPENDENCY_INPUT_INVALID'].includes(i.code))) return unavailable('PLAN_PROJECTION_UNAVAILABLE');
  const linkedItems = new Set<string>(), linkedScreens = new Set<string>();
  const invalidTaskLinks: {taskCode:string;kind:PlanTraceRef['kind'];referenceId:string;reason:string}[] = [];
  const ungroundedTasks: {taskCode:string;reasons:string[]}[] = [];
  for (const task of cards.tasks) {
    let designCount = 0, screenCount = 0;
    for (const link of [...task.designRefs,...task.screenRefs]) {
      const target = link.kind === 'DESIGN_ITEM' ? items.get(link.id) : screens.get(link.id);
      if (!target) invalidTaskLinks.push({taskCode:task.taskCode,kind:link.kind,referenceId:link.id,reason:'REFERENCE_NOT_FOUND'});
      else if (!same(link.versionRef,target.documentRef) || link.localCode !== ('localCode' in target ? target.localCode : target.screenCode) || link.anchor !== target.anchor)
        invalidTaskLinks.push({taskCode:task.taskCode,kind:link.kind,referenceId:link.id,reason:'REFERENCE_MISMATCH'});
      else if (link.kind === 'DESIGN_ITEM') { linkedItems.add(link.id); designCount++; }
      else { linkedScreens.add(link.id); screenCount++; }
    }
    const reasons: string[] = [];
    if (!designCount) reasons.push('DESIGN_REFERENCE_ABSENT');
    if (task.type === 'SCREEN' && !screenCount) reasons.push('SCREEN_REFERENCE_ABSENT');
    if (reasons.length) ungroundedTasks.push({taskCode:task.taskCode,reasons});
  }
  return {...base,status:'UNVERIFIED' as const,reason:'PLAN_TRACE_COVERAGE_ONLY',
    unlinkedDesignItems:[...items.values()].filter(i=>!linkedItems.has(i.id)).map(i=>({id:i.id,localCode:i.localCode})),
    unlinkedScreenRegions:[...screens.values()].filter(s=>!linkedScreens.has(s.id)).map(s=>({id:s.id,screenCode:s.screenCode,designItemId:s.designItemId})),
    invalidTaskLinks,ungroundedTasks};
}

export function analyzePlanTraceCoverageCandidate(input: unknown, expected: unknown) {
  try { return analyze(input,expected); } catch { return invalid(); }
}
