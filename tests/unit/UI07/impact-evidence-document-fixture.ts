import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {impactDocumentFixture} from './impact-document-fixture.ts';
import {designChangeFixture} from './design-change-fixture.ts';
import type {DesignChangePage,ImpactTargetRef} from '../../../apps/web/src/features/design-change/api.ts';
import type {ImpactDocumentSelection} from '../../../apps/web/src/features/design-change/impact-document-read.ts';
export function impactEvidenceDocumentFixture(){
 const original=impactDocumentFixture(),human=designChangeFixture().impactVersions[0]!,{ref,observedAt,...raw}=human,evidence=original.selection.target as ImpactTargetRef,evidenceFor=structuredClone(human.items[0]!.targetRef!) as ImpactTargetRef;
 const snapshot={...raw,items:[{targetRef:evidenceFor,state:'UNAFFECTED',reason:'고정 근거 원문을 별도로 검토해야 합니다',evidenceRefs:[evidence]}]},impact={...snapshot,ref:{...ref,contentHash:contentHash(canonicalJson(snapshot))},observedAt},page={...original.page,impactVersions:[impact],latestImpactRef:impact.ref} as DesignChangePage;
 const selection:ImpactDocumentSelection & {evidenceFor:ImpactTargetRef}={...original.selection,target:evidence,impactRef:impact.ref,evidenceFor};
 return {...original,page,selection};
}
