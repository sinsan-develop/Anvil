import {AuthFailure} from '../access/repository.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import type {ProjectDesignChanges} from './design-changes.ts';
import type {ProjectWorkPlans} from './work-plans.ts';
import {readDesignActivationInput,type DesignActivationInput} from './design-activation-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';

interface StoredChange {ref:VersionRef;beforeRef:VersionRef;afterProposalRef:string;[key:string]:unknown}
interface StoredImpact {ref:VersionRef;changeRef:VersionRef;items:unknown[];coverageGaps:unknown[];[key:string]:unknown}
type DocumentVersion=Pick<Awaited<ReturnType<ProjectDocuments['version']>>,
  'id'|'version'|'contentHash'|'title'|'formRef'|'stageNodeRef'|'content'|'confirmed'|'validation'|'contentReviews'>;
type Proposal=Pick<Awaited<ReturnType<ProjectDocuments['proposal']>>,'id'|'baseRef'|'proposedContent'|'selections'>;
type ChangeRecord=Pick<Awaited<ReturnType<ProjectDesignChanges['read']>>,'latestImpactRef'>&{
  change:StoredChange;impactVersions:StoredImpact[];
};
type PlanDecision=Pick<Awaited<ReturnType<ProjectWorkPlans['decision']>>,
  'planRef'|'headVersion'|'confirmedVersion'|'confirmation'|'currentConfirmationValid'>;
// 같은 project/db/actor에 결박된 기존 보호 reader의 내부 adapter 전용이며 외부 입력·권한 증명이 아니다.
interface Readers {
  change:(id:string)=>Promise<ChangeRecord>;
  document:(id:string,version:number)=>Promise<DocumentVersion>;
  proposal:(id:string)=>Promise<Proposal>;
  plan:(id:string,version:number)=>Promise<{ref:VersionRef;designRef:VersionRef}>;
  decision:(id:string,version:number)=>Promise<PlanDecision>;
}
interface StoredRelations {
  input:DesignActivationInput;
  change:StoredChange;
  impact:StoredImpact;
  approvedDesignVersionFacts:{ref:VersionRef;confirmed:true;latestReviewOutcome:'ACCEPTED';validForConfirmation:true};
  planConfirmationFacts:{planRef:VersionRef;headVersion:number;confirmedVersion:number;currentConfirmationValid:true};
  unverified:{documentHead:true;baselinePointer:true;approval:true;concurrency:true;writerSafety:true;activation:true};
}
const mismatch=():never=>{throw new AuthFailure('DESIGN_ACTIVATION_RELATION_MISMATCH',409);};
const sameRef=(a:unknown,b:unknown):boolean=>isVersionRef(a)&&isVersionRef(b)&&canonicalJson(a)===canonicalJson(b);
const documentRef=(d:DocumentVersion):VersionRef=>{
  const ref={id:d.id,version:d.version,contentHash:d.contentHash};
  if(!isVersionRef(ref))return mismatch();
  return ref;
};
const documentHashValid=(d:DocumentVersion):boolean=>contentHash(canonicalJson({title:d.title,formRef:d.formRef,stageNodeRef:d.stageNodeRef,content:d.content}))===d.contentHash;

// 저장된 관계만 대조한다. 조회 사이의 동시성·현재 기준·승인·writer 안전 및 적용 가능성을 판정하지 않는다.
export async function readStoredDesignActivationRelations(value:unknown,readers:Readers):Promise<StoredRelations>{
  const input=readDesignActivationInput(value);
  const record=await readers.change(input.changeRef.id),impact=record.impactVersions[0];
  if(!sameRef(record.change.ref,input.changeRef)||!sameRef(record.latestImpactRef,input.impactRef)
    ||!impact||!sameRef(impact.ref,input.impactRef)||!sameRef(impact.changeRef,input.changeRef))return mismatch();
  const change=record.change,proposal=await readers.proposal(change.afterProposalRef);
  if(proposal.id!==change.afterProposalRef||!sameRef(change.beforeRef,proposal.baseRef))return mismatch();
  const before=await readers.document(change.beforeRef.id,change.beforeRef.version);
  if(!sameRef(documentRef(before),change.beforeRef)||!documentHashValid(before))return mismatch();
  const selected=proposal.selections[0];
  if(proposal.selections.length!==1||!selected||selected.documentId!==change.beforeRef.id
    ||selected.version!==change.beforeRef.version+1||!Number.isSafeInteger(selected.version)
    ||selected.documentId!==input.approvedDesignRef.id||selected.version!==input.approvedDesignRef.version)return mismatch();
  const approved=await readers.document(input.approvedDesignRef.id,input.approvedDesignRef.version);
  // change.read의 기존 #source가 원기준 AF02를 확인한다. 여기서는 그 formRef/hash의 동일성만 소비한다.
  if(!sameRef(documentRef(approved),input.approvedDesignRef)||!documentHashValid(approved)
    ||approved.title!==before.title||!sameRef(approved.formRef,before.formRef)
    ||canonicalJson(approved.stageNodeRef)!==canonicalJson(before.stageNodeRef)
    ||canonicalJson(approved.content)!==canonicalJson(proposal.proposedContent)
    ||approved.confirmed!==true||approved.validation.validForConfirmation!==true
    ||approved.contentReviews[0]?.ref.outcome!=='ACCEPTED')return mismatch();
  const plan=await readers.plan(input.confirmedPlanRef.id,input.confirmedPlanRef.version);
  if(!sameRef(plan.ref,input.confirmedPlanRef)||!sameRef(plan.designRef,input.approvedDesignRef))return mismatch();
  // read.status=DRAFT는 불변 저장 형식이다. 현재 확정 여부는 기존 decision의 보호 조회 사실만 사용한다.
  const decision=await readers.decision(input.confirmedPlanRef.id,input.confirmedPlanRef.version);
  if(!sameRef(decision.planRef,input.confirmedPlanRef)||decision.currentConfirmationValid!==true
    ||decision.headVersion!==input.confirmedPlanRef.version||decision.confirmedVersion!==input.confirmedPlanRef.version
    ||!decision.confirmation||!sameRef(decision.confirmation.planRef,input.confirmedPlanRef))return mismatch();
  const result:StoredRelations={input,change,impact,
    approvedDesignVersionFacts:{ref:input.approvedDesignRef,confirmed:true,latestReviewOutcome:'ACCEPTED',validForConfirmation:true},
    planConfirmationFacts:{planRef:input.confirmedPlanRef,headVersion:decision.headVersion,confirmedVersion:decision.confirmedVersion,currentConfirmationValid:true},
    unverified:{documentHead:true,baselinePointer:true,approval:true,concurrency:true,writerSafety:true,activation:true}};
  return structuredClone(result);
}
