import {ApiClient, ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {readTraceScreenRegion} from '../design-trace/trace-screen-region.ts';
import {readRegisteredScreen} from '../design-trace/screen-region-navigation.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readDesignChange} from './api.ts';
import type {ImpactPlanSelection} from './impact-plan-task-read.ts';

export type ImpactScreenRegionSelection = ImpactPlanSelection;
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);

/** 저장 영향 소속과 원설계 등록을 재확인해 별도 고정 AF03 시안 문서만 읽는다. */
export async function readImpactScreenRegion(client: ApiClient, selection: ImpactScreenRegionSelection, active: () => boolean) {
  const target = selection?.target;
  if (!selection || ![selection.projectId, selection.userId, selection.clientId].every(uuid)
    || !validRef(selection.changeRef) || selection.changeRef.version !== 1 || !validRef(selection.impactRef)
    || !target || Object.keys(target).sort().join(',') !== 'anchor,id,kind,localCode,versionRef'
    || target.kind !== 'SCREEN_REGION' || !uuid(target.id) || !validRef(target.versionRef)
    || typeof target.localCode !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(target.localCode)
    || typeof target.anchor !== 'string' || !/^line:[1-9][0-9]{0,7}$/.test(target.anchor)
    || selection.beforeVersion !== null && (!Number.isSafeInteger(selection.beforeVersion) || selection.beforeVersion < 1 || selection.beforeVersion > 999999999999999)) throw new ApiError('IMPACT_SCREEN_REGION_TARGET_INVALID');
  const chosen = structuredClone(selection);
  const check = () => { if (!active()) throw new ApiError('IMPACT_SCREEN_REGION_READ_PAUSED'); };
  check();
  // 기존 reader 내부의 후속 GET도 같은 선택 수명에 묶고 전송 정책은 그대로 전달한다.
  const guarded = new ApiClient(async (path, init) => {
    check();
    const response = await client.transport.call(globalThis, path, init);
    check();
    return response;
  });
  const page = await readDesignChange(guarded, chosen.projectId, chosen.changeRef.id, chosen.beforeVersion);
  check();
  const impacts = page.impactVersions.filter(impact => same(impact.ref, chosen.impactRef));
  if (!same(page.change.ref, chosen.changeRef) || impacts.length !== 1
    || impacts[0]!.items.filter(item => same(item.targetRef, chosen.target)).length !== 1) throw new ApiError('IMPACT_SCREEN_REGION_TARGET_CHANGED');
  const sourceRef = structuredClone(page.change.beforeRef);
  const region = await readTraceScreenRegion(guarded, chosen.projectId, sourceRef, {...chosen.target, kind: 'SCREEN_REGION'}, active);
  check();
  if (!region) throw new ApiError('IMPACT_SCREEN_REGION_UNAVAILABLE');
  const context = {projectId: chosen.projectId, userId: chosen.userId, clientId: chosen.clientId, sourceRef};
  const original = await readRegisteredScreen(guarded, context, {...context, region}, active);
  check();
  return {...original, region, sourceRef};
}
