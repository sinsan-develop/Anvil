import {ApiClient, ApiError} from '../../api/client.ts';
import {validRef} from '../connections/api.ts';
import {readDocument} from '../design-trace/api.ts';
import {readDesignIndex} from '../design-trace/design-index-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {readDesignChange} from './api.ts';
import type {ImpactPlanSelection} from './impact-plan-task-read.ts';

export type ImpactDesignItemSelection = ImpactPlanSelection;
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const same = (a: unknown, b: unknown) => ordered(a) === ordered(b);

/** 저장된 영향 구간과 등록 항목을 재확인하고 해당 고정 문서만 읽는다. */
export async function readImpactDesignItem(client: ApiClient, selection: ImpactDesignItemSelection, active: () => boolean) {
  const target = selection?.target;
  if (!selection || ![selection.projectId, selection.userId, selection.clientId].every(uuid)
    || !validRef(selection.changeRef) || selection.changeRef.version !== 1 || !validRef(selection.impactRef)
    || !target || target.kind !== 'DESIGN_ITEM' || !uuid(target.id) || !validRef(target.versionRef)
    || typeof target.localCode !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(target.localCode)
    || typeof target.anchor !== 'string' || !/^line:[1-9][0-9]{0,7}$/.test(target.anchor)
    || selection.beforeVersion !== null && (!Number.isSafeInteger(selection.beforeVersion) || selection.beforeVersion < 1 || selection.beforeVersion > 999999999999999)) throw new ApiError('IMPACT_DESIGN_ITEM_TARGET_INVALID');
  const chosen = structuredClone(selection);
  const check = () => { if (!active()) throw new ApiError('IMPACT_DESIGN_ITEM_READ_PAUSED'); };
  check();
  const page = await readDesignChange(client, chosen.projectId, chosen.changeRef.id, chosen.beforeVersion);
  check();
  const impacts = page.impactVersions.filter(impact => same(impact.ref, chosen.impactRef));
  if (!same(page.change.ref, chosen.changeRef) || impacts.length !== 1
    || impacts[0]!.items.filter(item => same(item.targetRef, chosen.target)).length !== 1) throw new ApiError('IMPACT_DESIGN_ITEM_TARGET_CHANGED');
  const index = await readDesignIndex(client, chosen.projectId, chosen.target.versionRef);
  check();
  const items = index.items.filter(item => item.id === chosen.target.id && item.localCode === chosen.target.localCode
    && item.anchor === chosen.target.anchor && same(item.documentRef, chosen.target.versionRef));
  if (items.length !== 1) throw new ApiError('IMPACT_DESIGN_ITEM_UNAVAILABLE');
  const original = await readDocument(client, chosen.projectId, chosen.target.versionRef.id, chosen.target.versionRef.version,
    {expectedContentHash: chosen.target.versionRef.contentHash, active});
  check();
  return {...original, item: items[0]!};
}
