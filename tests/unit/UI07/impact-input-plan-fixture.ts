import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {designChangeFixture,projectId} from './design-change-fixture.ts';
export function impactInputPlanFixture(){
 const page=designChangeFixture(),raw=page.impactVersions[1]!,task={taskCode:'FN01',type:'FUNCTION',title:'계산 입력의 고정 업무',purpose:'변경 영향 근거 확인',designRefs:[],screenRefs:[],ownerRole:'개발 담당',inputs:['설계'],outputs:['구현'],included:['승인 범위'],excluded:['운영'],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:['보관 정의 확인'],testCases:[],acceptanceCriteria:['고정본 재조회'],evidenceRequirements:['결과 원문'],rollback:'이전 기준 보존',recoveryNotes:'미완료 위치 보존'};
 const data={documentRef:page.change.beforeRef,designRef:page.change.beforeRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'영향 계산 입력 원문',issues:[],relationalProjection:'STORED'},planRef={id:'77777777-7777-4777-8777-777777777777',version:2,contentHash:contentHash(canonicalJson(data))};
 const {ref,observedAt,...base}=raw,body={...base,items:[],inputs:{planRefs:[planRef],indexedDesign:true}},impact={ref:{...ref,contentHash:contentHash(canonicalJson(body))},...body,observedAt};
 const value={...page,impactVersions:[impact],latestImpactRef:impact.ref};
 return{page:value,plan:{ref:planRef,status:'DRAFT',...data,executionEvidence:'NOT_CONNECTED',observedAt},selection:{projectId,userId:projectId,clientId:projectId,changeRef:page.change.ref,impactRef:impact.ref,beforeVersion:null as number|null,planRef}};
}
