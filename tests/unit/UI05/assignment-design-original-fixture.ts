import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {assignmentPlanFixture} from './assignment-plan-original-fixture.ts';
export function assignmentDesignFixture(){
 const f=assignmentPlanFixture(),body='임무에 고정된 설계 원문\n<script>globalThis.designExecuted=true</script>',bytes=Buffer.from(body),id='66666666-6666-4666-8666-666666666666',fileId='88888888-8888-4888-8888-888888888888',formRef={id:'99999999-9999-4999-8999-999999999999',version:1,contentHash:'f'.repeat(64)},content={body:{artifactId:fileId,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]};
 const hash=(v:unknown)=>contentHash(canonicalJson(v)),ref={id,version:2,contentHash:hash({title:'당시 설계',formRef,stageNodeRef:null,content})};
 const document={id,version:2,title:'당시 설계',confirmed:true,contentHash:ref.contentHash,formRef,stageNodeRef:null,content,validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[]},contentReviews:[]};
 f.plan.designRef=ref;const {ref:old,status,executionEvidence,observedAt,...snapshot}=f.plan;f.plan.ref={...old,contentHash:hash(snapshot)};
 const draft=f.detail.draft,confirmed=f.detail.confirmed!;draft.snapshot.basis.designRef=ref;draft.snapshot.basis.planRef=f.plan.ref;draft.snapshot.definition.taskRef.planRef=f.plan.ref;draft.snapshot.definition.baselineRefs=[ref];draft.ref.contentHash=hash(draft.snapshot);confirmed.snapshot.draftRef={...draft.ref};confirmed.ref.contentHash=hash(confirmed.snapshot);
 return {...f,body,bytes,document,fileId};
}
