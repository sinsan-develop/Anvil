import {ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {CheckpointForm} from './CheckpointEditor.tsx';
import type {CheckpointFileInspection} from './checkpoint-journal-comparison.ts';
import {checkpointDownloadFile,type CheckpointInput} from './checkpoint-api.ts';
import {checkpointObservationInput,emptyCheckpointObservations} from './checkpoint-observation-input.ts';
import {checkpointEvidenceInput,emptyCheckpointEvidence} from './checkpoint-evidence-input.ts';
import {checkpointWorkInput,emptyCheckpointWorkDetails} from './checkpoint-work-input.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),lines=(v:string)=>v.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
export const emptyCheckpointForm=():CheckpointForm=>({position:'',completed:'',progress:'',remaining:'',decisions:'',next:'',forbidden:'자동 재개\n확인되지 않은 완료 처리',reason:''});
function fail():never{throw new ApiError('CHECKPOINT_FORM_RESTORE_INVALID');}
/** 작성 중인 입력은 빈 값으로 간주하지 않는다. 기존 입력을 덮지 않는 UI 경계다. */
export function isEmptyCheckpointForm(raw:CheckpointForm|null|undefined){if(raw==null)return true;const base=emptyCheckpointForm(),allowed=[...Object.keys(base),'observations','evidence','workDetails'];if(typeof raw!=='object'||Object.keys(raw).some(k=>!allowed.includes(k)))return false;return Object.keys(base).every(k=>(raw as any)[k]===(base as any)[k])&&(raw.observations===undefined||same(raw.observations,emptyCheckpointObservations()))&&(raw.evidence===undefined||same(raw.evidence,emptyCheckpointEvidence()))&&(raw.workDetails===undefined||same(raw.workDetails,emptyCheckpointWorkDetails()));}
/** 같은 입력 조립을 수동 편집과 파일의 완전 왕복 대조에 사용한다. 저장/실행은 하지 않는다. */
export function checkpointInputFromForm(assignment:ConfirmedAssignmentView,form:CheckpointForm):CheckpointInput{
 return{baseRef:null,reason:form.reason,state:{assignmentRef:assignment.ref,...checkpointObservationInput(form.observations),baselineRefs:assignment.snapshot.definition.baselineRefs,currentPosition:{taskRef:assignment.snapshot.definition.taskRef,description:form.position},...checkpointWorkInput(form,form.workDetails),...checkpointEvidenceInput(assignment,form.evidence),nextAction:form.next,forbiddenActions:lines(form.forbidden)}};
}
export async function checkpointFormFromInspection(rawAssignment:ConfirmedAssignmentView,rawFile:CheckpointFileInspection):Promise<CheckpointForm>{
 try{const a=structuredClone(rawAssignment),file=structuredClone(rawFile),p=file.prepared,s=p.snapshot.input.state;if(file.fileSource!=='USER_SELECTED_BYTES_ONLY'||file.authenticityVerified!==false||p.sourceState!=='FIXED_ASSIGNMENT_REFERENCE_ONLY'||p.projectId!==a.projectId||p.snapshot.projectId!==a.projectId||!same(p.assignmentRef,a.ref)||!same(p.input,p.snapshot.input)||p.input.baseRef!==null)fail();await checkpointDownloadFile(p);
  const reference=(r:{id:string;version:number;contentHash:string}|null)=>r?{id:r.id,version:String(r.version),contentHash:r.contentHash}:{id:'',version:'',contentHash:''},items=[...s.completedItems,...s.inProgress,...s.remaining],form:CheckpointForm={position:s.currentPosition.description,completed:s.completedItems.map(i=>i.description).join('\n'),progress:s.inProgress.map(i=>i.description).join('\n'),remaining:s.remaining.map(i=>i.description).join('\n'),decisions:s.pendingDecisions.map(i=>i.question).join('\n'),reason:p.input.reason,next:s.nextAction,forbidden:s.forbiddenActions.join('\n'),
   observations:{executionRefs:s.executionRefs.map(reference),lastLocalSequence:s.lastLocalSequence===null?'':String(s.lastLocalSequence),ackSequence:s.lastServerAck===null?'':String(s.lastServerAck.sequence),ackRef:reference(s.lastServerAck?.batchRef??null)},
   evidence:{sourceSnapshotRefs:s.sourceSnapshotRefs.map(reference),changedFiles:s.changedFiles.map(f=>{const matches=a.snapshot.definition.allowedScopes.flatMap((scope,i)=>scope.targets.flatMap((t,j)=>same(scope.sourceRootRef,f.sourceRootRef)&&t.relativePath===f.relativePath?[i+':'+j]:[]));if(matches.length!==1)fail();return{target:matches[0]!,kind:f.kind,beforeHash:f.beforeHash??'',afterHash:f.afterHash??'',diffRef:reference(f.diffRef)};}),verificationRefs:s.verificationRefs.map(reference),errors:s.errorFingerprints.map(fingerprint=>{const c=s.attemptCounts.find(c=>c.fingerprint===fingerprint);return{fingerprint,count:c?String(c.count):''};}),untransmittedRefs:s.untransmittedRefs.map(reference),recordFileRef:reference(s.recordFileRef)},
   workDetails:{evidence:items.filter(i=>i.evidenceRefs.length).map(i=>({itemId:i.itemId,description:i.description,evidenceRefs:i.evidenceRefs.map(reference)})),decisions:s.pendingDecisions.map(i=>({decisionId:i.decisionId,question:i.question,reason:i.reason,requiredFrom:i.requiredFrom,sourceRef:reference(i.sourceRef)}))}
  };if(!same(checkpointInputFromForm(a,form),p.input))fail();return form;
 }catch{fail();}
}
