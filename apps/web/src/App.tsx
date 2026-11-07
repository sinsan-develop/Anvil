import type {NodeDecisionBuffer,DecisionPacket} from './features/workspace/node-decision-api.ts';
import {membershipOwned,membershipApprovalWork,bindMembershipApproval,type MembershipBuffer} from './features/projects/membership-api.ts';
import type {SourceLinkBuffer} from './features/design-trace/source-link-command-api.ts';
import {newNativeApproval,nativeOwned,type NativeBuffer} from './features/connections/native-boundary-preparation-api.ts';
import {environmentOwned,type EnvironmentBuffer} from './features/connections/environment-configuration-api.ts';
import {newEnvironmentApproval} from './features/connections/environment-configuration-approval.ts';
import {freezeDefinitionReportBuffer,type DefinitionCapabilityReportBuffer,type DefinitionCapabilityReportChange} from './features/connections/definition-capability-report-api.ts';
import {definitionKey,definitionOwned,newDefinitionApproval,type DefinitionBuffer} from './features/connections/connection-definition-api.ts';
import {mergePreparation,type PreparationBuffer} from './features/transfers/preparation-record-api.ts';
import type {ArtifactTaskTraceBuffer} from './features/session-detail/artifact-task-trace-api.ts';
import {BackupPolicyPanel} from './features/backups/BackupPolicyPanel.tsx';
import {backupPolicyOwned,mergeBackupPolicy,newBackupPolicyApproval,type BackupPolicyBuffer} from './features/backups/backup-policy-api.ts';
import type {CapabilityReportBuffer} from './features/connections/capability-report-api.ts';
import {InstallationResourcePanel} from './features/backups/InstallationResourcePanel.tsx';
import {InstallationResourceScope,installationResourceOwned,mergeInstallationResourceBuffer,newInstallationResourceApproval,type InstallationResourceBuffer} from './features/backups/installation-resource-api.ts';
import type {KnowledgeShareRequestBuffer} from './features/knowledge/knowledge-share-request-api.ts';
import {ProjectBackupsPanel} from './features/backups/ProjectBackupsPanel.tsx';
import {BackupReferencePanel} from './features/backups/BackupReferencePanel.tsx';
import {BackupReferenceScope,backupReferenceOwned,mergeBackupReferenceBuffer,newBackupReferenceApproval,type BackupReferenceBuffer} from './features/backups/backup-reference-api.ts';
import {ExportScope,mergeExportPending,type ExportPending} from './features/backups/project-backups-api.ts';
import { useEffect, useRef, useState } from 'react';
import {ProjectNotificationsPanel} from './notifications/ProjectNotificationsPanel.tsx';
import {NotificationScope,mergeNotificationPending,type NotificationPending} from './notifications/project-notifications-api.ts';
import {ControlScope,mergeControlBuffer,type ControlBuffer} from './features/control-handoff/state.ts';
import {TransferPreparationPage} from './features/transfers/TransferPreparationPage.tsx';
import {ControlAccessPage} from './features/control-handoff/ControlAccessPage.tsx';
import type {ResultSubmissionBuffer} from './features/session-detail/result-submission-write-api.ts';
import type {ManualResultReport} from './features/session-detail/manual-result-report.ts';
import type {QueuePanelBuffer} from './features/session-detail/stage-queue-api.ts';
import type {StageStartBuffer} from './features/session-detail/stage-start-api.ts';
import type {ActivationBuffer} from './features/design-change/activation-api.ts';
import {newDesignActivationApprovalRequest} from './features/decisions/design-activation-approval-api.ts';
import { DesignChangesPage } from './features/design-change/DesignChangesPage.tsx';
import type { ChangeRequestBuffer } from './features/design-change/request-api.ts';
import type { ImpactReviewBuffer } from './features/design-change/impact-review-api.ts';
import {ConnectionsPage} from './features/connections/ConnectionsPage.tsx';
import {ApprovalsPage,type ApprovalPageBuffer} from './features/decisions/ApprovalsPage.tsx';
import type {ResultIssueSelection} from './features/decisions/ReportedResultIssue.tsx';
import type {CandidateBuffer} from './features/connections/api.ts';
import type {TrustBuffer} from './features/connections/trust-api.ts';
import type {LimitBuffer} from './features/connections/limit-policy-api.ts';
import type {CandidatePolicyBuffer} from './features/connections/candidate-policy-api.ts';
import {SourceRootsPanel} from './features/connections/SourceRootsPanel.tsx';
import type {RootBuffer} from './features/connections/source-roots-api.ts';
import type {SourceReadBuffer} from './features/connections/source-read-api.ts';
import { ApiClient, ApiError } from './api/client.ts';
import { AppShell } from './shell/AppShell.tsx';
import { StatusView } from './shell/StatusView.tsx';
import { parseRoute } from './shell/routes.ts';
import {MobileNavigation,type MobilePane} from './features/mobile/MobileNavigation.tsx';
import { AuthForm } from './shell/AuthForm.tsx';
import { AccountSecurity } from './shell/AccountSecurity.tsx';
import { ProjectsPage } from './features/projects/ProjectsPage.tsx';
import { WorkspacePage } from './features/workspace/WorkspacePage.tsx';
import {SessionDetailPage} from './features/session-detail/SessionDetailPage.tsx';
import type {OriginBuffer} from './features/session-detail/execution-start-origin-api.ts';
import type {CheckpointForm} from './features/session-detail/CheckpointEditor.tsx';
import type {CriteriaBuffer} from './features/session-detail/ResultCriteriaEditor.tsx';
import type {ResultReviewBuffer} from './features/session-detail/result-review-write-api.ts';
import type {UnderstandingReviewBuffer} from './features/session-detail/understanding-review-write.ts';
import type {ResultReworkBuffer} from './features/session-detail/result-rework-write-api.ts';
import type {ResultReworkFormDraft} from './features/session-detail/result-rework-form.ts';
import type { AssignmentBuffer } from './features/workspace/assignment-api.ts';
import { ProjectCreatePage } from './features/project-create/ProjectCreatePage.tsx';
import { ProjectBaselinePanel } from './features/project-create/ProjectBaselinePanel.tsx';
import type { BaselineBuffer } from './features/project-create/baseline-api.ts';
import { emptyDraft } from './features/project-create/api.ts';
import { MethodologyEditorPage } from './features/methodology-editor/MethodologyEditorPage.tsx';
import { emptyMethodBuffer } from './features/methodology-editor/common-api.ts';
import type { MethodBuffer } from './features/methodology-editor/common-api.ts';
import { ProjectMethodologyPage } from './features/methodology-editor/ProjectMethodologyPage.tsx';
import { emptyFormBuffer } from './features/methodologies/form-editor-state.ts';
import { DocumentsPage } from './features/design-trace/DocumentsPage.tsx';
import type { DocumentBuffer } from './features/design-trace/editor-api.ts';
import type { DocumentReviewBuffer } from './features/design-trace/review-api.ts';
import type { DocumentConfirmationBuffer } from './features/design-trace/confirmation-api.ts';
import type {SourceDetachBuffer} from './features/design-trace/source-detach-api.ts';
import {KnowledgePage} from './features/knowledge/KnowledgePage.tsx';
import type {KnowledgeBuffer} from './features/knowledge/api.ts';
import type {ConversationBuffer} from './features/knowledge/conversation-api.ts';
import { mergeConversationBuffer } from './features/knowledge/conversation-buffer-update.ts';
import type{KnowledgeExclusionBuffer}from'./features/knowledge/exclusion-api.ts';
import type{KnowledgeCorrectionBuffer}from'./features/knowledge/correction-api.ts';
import type{KnowledgeDecisionBuffer}from'./features/knowledge/decision-api.ts';

const client = new ApiClient();
interface Session { user: { id: string; displayName: string }; clientId: string; csrfToken: string }
function readSession(value: unknown): Session {
  const candidate = value as Session;
  if (!candidate?.user || typeof candidate.user.id !== 'string' || typeof candidate.user.displayName !== 'string' || typeof candidate.clientId !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(candidate.csrfToken)) throw new ApiError('RESPONSE_INVALID');
  return candidate;
}
export function App() {
  const [activationBuffers,setActivationBuffers]=useState<Record<string,ActivationBuffer|null>>({});
  useEffect(()=>{if(!Object.values(activationBuffers).some(b=>b&&!b.receipt))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[activationBuffers]);
  const [understandingReviews,setUnderstandingReviews]=useState<Record<string,UnderstandingReviewBuffer|null>>({});
  useEffect(()=>{if(!Object.values(understandingReviews).some(b=>b&&!b.stored))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[understandingReviews]);
  const [stageStartBuffers,setStageStartBuffers]=useState<Record<string,StageStartBuffer|null>>({});
  const startOriginStore=useRef<Record<string,OriginBuffer|null>>({}),[startOriginBuffers,setStartOriginBuffers]=useState<Record<string,OriginBuffer|null>>({});
  function changeStartOrigin(key:string,change:(prior:OriginBuffer|null)=>OriginBuffer|null){const prior=startOriginStore.current[key]??null,next=change(prior);if(prior===next)return false;startOriginStore.current={...startOriginStore.current,[key]:next};setStartOriginBuffers(startOriginStore.current);return true;}
  useEffect(()=>{if(!Object.values(stageStartBuffers).some(b=>b&&!b.result))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[stageStartBuffers]);
  const [stageQueueBuffers,setStageQueueBuffers]=useState<Record<string,QueuePanelBuffer|null>>({});
  useEffect(()=>{if(!Object.values(stageQueueBuffers).some(b=>b&&!b.command?.result))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[stageQueueBuffers]);
  const [manualResultReports,setManualResultReports]=useState<Record<string,ManualResultReport|null>>({});
  useEffect(()=>{if(!Object.values(manualResultReports).some(Boolean))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[manualResultReports]);
  const [resultSubmissionBuffers,setResultSubmissionBuffers]=useState<Record<string,ResultSubmissionBuffer|null>>({});
  useEffect(()=>{if(!Object.values(resultSubmissionBuffers).some(b=>b&&!b.result&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[resultSubmissionBuffers]);
  const [artifactTraceBuffers,setArtifactTraceBuffers]=useState<Record<string,ArtifactTaskTraceBuffer|null>>({});
  useEffect(()=>{if(!Object.values(artifactTraceBuffers).some(b=>b&&!b.result&&(b.selected||b.reason||b.pending)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[artifactTraceBuffers]);
  const [resultReviewBuffers,setResultReviewBuffers]=useState<Record<string,ResultReviewBuffer|null>>({});
  const [resultReworkBuffers,setResultReworkBuffers]=useState<Record<string,ResultReworkBuffer|null>>({});
  const [resultReworkForms,setResultReworkForms]=useState<Record<string,ResultReworkFormDraft|null>>({});
  useEffect(()=>{if(!Object.values(resultReworkForms).some(f=>f&&(f.selected.length||f.files.length||f.bindingId||f.reason)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[resultReworkForms]);
  useEffect(()=>{if(!Object.values(resultReviewBuffers).some(b=>b&&!b.stored&&(b.dirty||b.pending||b.uncertain))&&!Object.values(resultReworkBuffers).some(b=>b&&!b.stored))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[resultReviewBuffers,resultReworkBuffers]);
  const [criteriaBuffers,setCriteriaBuffers]=useState<Record<string,CriteriaBuffer|null>>({});
  useEffect(()=>{if(!Object.values(criteriaBuffers).some(b=>b&&!b.stored&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[criteriaBuffers]);
  const [baselineBuffers,setBaselineBuffers]=useState<Record<string,BaselineBuffer|null>>({});
  useEffect(()=>{if(!Object.values(baselineBuffers).some(b=>b&&(b.dirty||b.reviewDirty||b.pending||b.uncertain||b.confirmation.acknowledged||b.confirmation.reason)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[baselineBuffers]);
  const [impactReviewBuffers, setImpactReviewBuffers] = useState<Record<string, ImpactReviewBuffer | null>>({});
  useEffect(() => { if(!Object.values(impactReviewBuffers).some(value=>value&&(value.dirty||value.pending||value.uncertain)))return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn); }, [impactReviewBuffers]);
  const [changeRequestBuffers, setChangeRequestBuffers] = useState<Record<string, ChangeRequestBuffer | null>>({});
  useEffect(() => { if(!Object.values(changeRequestBuffers).some(value=>value&&(value.dirty||value.pending||value.uncertain)))return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn); }, [changeRequestBuffers]);
  const [assignmentBuffers, setAssignmentBuffers] = useState<Record<string, AssignmentBuffer | null>>({});
  const nodeDecisionStore=useRef<Record<string,NodeDecisionBuffer>>({}),[,nodeDecisionRedraw]=useState(0);
  const changeNodeDecision=(key:string,expected:DecisionPacket|null,change:(previous:NodeDecisionBuffer|null)=>NodeDecisionBuffer)=>{const previous=nodeDecisionStore.current[key]??null;if(expected!==null&&previous?.packet!==expected)return;const next=change(previous);if(next.key!==key)return;nodeDecisionStore.current[key]=next;nodeDecisionRedraw(n=>n+1);};
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(Object.values(nodeDecisionStore.current).some(b=>b.packet&&b.phase!=='SAVED')){event.preventDefault();event.returnValue='';}};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[]);

  useEffect(() => { if (!Object.values(assignmentBuffers).some(b => b && (b.dirty || b.pending || b.uncertain))) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn); }, [assignmentBuffers]);
  const [sourceReadBuffers,setSourceReadBuffers]=useState<Record<string,SourceReadBuffer|null>>({});
  useEffect(()=>{if(!Object.values(sourceReadBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[sourceReadBuffers]);
  const [rootBuffers,setRootBuffers]=useState<Record<string,RootBuffer|null>>({});
  useEffect(()=>{if(!Object.values(rootBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[rootBuffers]);
  const [definitionReportBuffers,setDefinitionReportBuffers]=useState<Record<string,DefinitionCapabilityReportBuffer|null>>({});
  const definitionReportBuffersRef=useRef(definitionReportBuffers);
  function changeDefinitionReport(key:string,change:DefinitionCapabilityReportChange){const previous=definitionReportBuffersRef.current[key]??null,next=typeof change==='function'?change(previous):change;if(next===previous)return false;const updated={...definitionReportBuffersRef.current,[key]:freezeDefinitionReportBuffer(next)};definitionReportBuffersRef.current=updated;setDefinitionReportBuffers(updated);return true;}

  const [capabilityReportBuffers,setCapabilityReportBuffers]=useState<Record<string,CapabilityReportBuffer|null>>({});
  const [trustBuffers,setTrustBuffers]=useState<Record<string,TrustBuffer|null>>({});
  const [limitBuffers,setLimitBuffers]=useState<Record<string,LimitBuffer|null>>({});
  const [candidatePolicyBuffers,setCandidatePolicyBuffers]=useState<Record<string,CandidatePolicyBuffer|null>>({});
  useEffect(()=>{if(!Object.values(candidatePolicyBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[candidatePolicyBuffers]);
  useEffect(()=>{if(!Object.values(limitBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[limitBuffers]);
  useEffect(()=>{if(!Object.values(trustBuffers).some(b=>b&&(b.pending||b.uncertain||b.approvalWork?.pending||b.approvalWork?.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[trustBuffers]);
  const [approvalBuffers,setApprovalBuffers]=useState<Record<string,ApprovalPageBuffer|null>>({});
  useEffect(()=>{if(!Object.values(approvalBuffers).some(b=>b&&(b.request?.dirty||b.request?.pending||b.request?.uncertain||b.decision?.pending&&!b.decision.resultId||b.decision?.uncertain||b.decision?.reason&&!b.decision.resultId)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[approvalBuffers]);
  const [candidateBuffers,setCandidateBuffers]=useState<Record<string,CandidateBuffer|null>>({});
  useEffect(()=>{if(!Object.values(candidateBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[candidateBuffers]);
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const membershipStore=useRef<Record<string,MembershipBuffer|null>>({});const [membershipRevision,membershipRender]=useState(0);const membershipLive=useRef({session,client,transport:client.transport,route});membershipLive.current={session,client,transport:client.transport,route};
  const membershipKey=(pid:string)=>session?JSON.stringify([session.user.id,session.clientId,session.csrfToken,pid]):'';
  function changeMembership(pid:string,expected:MembershipBuffer|null,next:MembershipBuffer|null){const live=membershipLive.current;if(!session||live.session!==session||live.client!==client||live.transport!==client.transport||(next?!membershipOwned(next,client,session,pid):expected?.phase!=='APPLIED'))return false;const key=membershipKey(pid);if((membershipStore.current[key]??null)!==expected)return false;membershipStore.current[key]=next;membershipRender(v=>v+1);return true;}
  function requestMembershipApproval(b:MembershipBuffer){if(!session||membershipLive.current.session!==session||membershipLive.current.client!==client||membershipLive.current.transport!==client.transport||membershipStore.current[membershipKey(b.projectId)]!==b)return false;const key=session.user.id+':'+session.clientId+':'+b.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;try{const request=membershipApprovalWork(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:b.projectId,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request}}));location.hash='#/projects/'+b.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}}
  useEffect(()=>{if(!Object.values(membershipStore.current).some(b=>b&&b.phase!=='APPLIED'))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[membershipRevision]);
  async function returnMembershipApproval(id:string){if(!session||!route.projectId)return false;const pid=route.projectId,b=membershipStore.current[membershipKey(pid)];if(!b)return false;const ticket=membershipLive.current,active=()=>membershipLive.current.session===ticket.session&&membershipLive.current.client===ticket.client&&membershipLive.current.transport===ticket.transport&&membershipLive.current.route.screen==='approvals'&&membershipLive.current.route.projectId===pid&&membershipStore.current[membershipKey(pid)]===b;try{const next=await bindMembershipApproval(b,session,id,active);if(!active()||!changeMembership(pid,b,next))return false;location.hash='#/projects';return true;}catch(e){if(active())setError(e instanceof ApiError?e:new ApiError('APPROVAL_NOT_USABLE'));return false;}}

  const environmentStore=useRef<Record<string,EnvironmentBuffer|null>>({}),[,refreshEnvironments]=useState(0);
  const nativeStore=useRef<Record<string,NativeBuffer|null>>({}),[,refreshNative]=useState(0);
  const nativeLive=useRef({session,client,transport:client.transport,route});nativeLive.current={session,client,transport:client.transport,route};
  const nativeObjects=useRef(new WeakMap<object,number>()),nativeObjectSequence=useRef(0);const nativeObjectKey=(value:object)=>{let n=nativeObjects.current.get(value);if(n===undefined){n=++nativeObjectSequence.current;nativeObjects.current.set(value,n);}return n;};
  const currentNativeStoreKey=()=>session&&route.projectId?JSON.stringify([route.projectId,session.user.id,session.clientId,session.csrfToken,nativeObjectKey(client),nativeObjectKey(client.transport)]):'';const nativeStoreKey=currentNativeStoreKey();
  if(!session)nativeStore.current={};
  function changeNative(expected:NativeBuffer|null,next:NativeBuffer|null){const live=nativeLive.current;if(!session||!route.projectId||live.session!==session||live.client!==client||live.route.screen!=='connections'||live.route.projectId!==route.projectId)return false;const currentKey=currentNativeStoreKey(),old=nativeStore.current[currentKey]??null;if(old!==expected||expected&&!nativeOwned(expected,client,session,route.projectId)||next&&!nativeOwned(next,client,session,route.projectId)||!next&&old?.pending&&!['STORED','REJECTED'].includes(old.pending.state))return false;nativeStore.current[currentKey]=next;refreshNative(v=>v+1);return true;}
  function requestNativeApproval(b:NativeBuffer){if(!session||!route.projectId||nativeStore.current[nativeStoreKey]!==b||!nativeOwned(b,client,session,route.projectId))return false;const key=session.user.id+':'+session.clientId+':'+route.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;try{const request=newNativeApproval(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}}
  useEffect(()=>{if(!Object.values(nativeStore.current).some(b=>b&&(!b.pending||!['STORED','REJECTED'].includes(b.pending.state))))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  const definitionStore=useRef<Record<string,DefinitionBuffer|null>>({}),[,refreshDefinitions]=useState(0);
  const definitionLive=useRef({session,client,transport:client.transport,route});definitionLive.current={session,client,transport:client.transport,route};
  const definitionStoreKey=session&&route.projectId?definitionKey(session,route.projectId):'';
  function changeDefinition(expected:DefinitionBuffer|null,next:DefinitionBuffer){const live=definitionLive.current;if(!session||live.session!==session||live.client!==client||live.transport!==client.transport||live.route.screen!=='connections'||live.route.projectId!==next.projectId||!definitionOwned(next,client,session,next.projectId))return false;const old=definitionStore.current[next.key]??null;if(old!==expected)return false;definitionStore.current[next.key]=next;refreshDefinitions(v=>v+1);return true;}
  const environmentStoreKey=session&&route.projectId?JSON.stringify([route.projectId,session.user.id,session.clientId]):'';
  function changeEnvironment(expected:EnvironmentBuffer|null,next:EnvironmentBuffer|null){const live=definitionLive.current;if(!session||live.session!==session||live.client!==client||live.transport!==client.transport||live.route.screen!=='connections'||live.route.projectId!==route.projectId)return false;const old=environmentStore.current[environmentStoreKey]??null;if(old!==expected||next&&!environmentOwned(next,client,session,route.projectId!))return false;if(!next&&expected?.pending&&!['REJECTED','STORED'].includes(expected.pending.state))return false;environmentStore.current[environmentStoreKey]=next;refreshEnvironments(v=>v+1);return true;}
  function requestEnvironmentApproval(b:EnvironmentBuffer){if(!session||!route.projectId||environmentStore.current[environmentStoreKey]!==b||!environmentOwned(b,client,session,route.projectId))return false;const key=session.user.id+':'+session.clientId+':'+route.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;try{const request=newEnvironmentApproval(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}}
  useEffect(()=>{if(!Object.values(environmentStore.current).some(b=>b&&(!b.pending||['UNKNOWN','REQUIRED','BOUND','PREPARED'].includes(b.pending.state))))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  function requestDefinitionApproval(b:DefinitionBuffer){if(!session||!route.projectId||definitionStore.current[definitionStoreKey]!==b||!definitionOwned(b,client,session,route.projectId))return false;const key=session.user.id+':'+session.clientId+':'+route.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;try{const request=newDefinitionApproval(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}}
  useEffect(()=>{if(!Object.values(definitionStore.current).some(b=>b&&(!b.pending||['UNKNOWN','REQUIRED','BOUND','PREPARED'].includes(b.pending.state))))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});

  const backupReferenceScope=useRef(new BackupReferenceScope());backupReferenceScope.current.bind(session,client,route.projectId);
  const backupReferenceStore=useRef<Record<string,BackupReferenceBuffer>>({});
  const backupReferenceKey=session&&route.projectId?session.user.id+':'+session.clientId+':'+route.projectId:'';
  const backupReferenceLive=useRef({session,projectId:route.projectId,screen:route.screen});backupReferenceLive.current={session,projectId:route.projectId,screen:route.screen};
  const [,updateBackupReferences]=useState(0);
  function changeBackupReference(expected:BackupReferenceBuffer|null,next:BackupReferenceBuffer):boolean{
   if(!session||!route.projectId||backupReferenceLive.current.session!==session||backupReferenceLive.current.projectId!==route.projectId||backupReferenceLive.current.screen!=='settings'||!backupReferenceOwned(next,client,session,route.projectId))return false;
   const old=backupReferenceStore.current[backupReferenceKey]??null,merged=mergeBackupReferenceBuffer(old,expected,next);if(merged===old||!merged)return false;backupReferenceStore.current[backupReferenceKey]=merged;updateBackupReferences(v=>v+1);return true;
  }
  function requestBackupReferenceApproval(b:BackupReferenceBuffer):boolean{
   if(!session||!route.projectId||backupReferenceStore.current[backupReferenceKey]!==b||!backupReferenceOwned(b,client,session,route.projectId))return false;
   const key=session.user.id+':'+session.clientId+':'+route.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;
   try{const work=newBackupReferenceApproval(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request:work}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}
  }
  useEffect(()=>{if(!Object.values(backupReferenceStore.current).some(b=>b.dirty||b.uncertain||b.pending&&!b.pending.receipt))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  const installationResourceScope=useRef(new InstallationResourceScope());installationResourceScope.current.bind(session,client,route.projectId);
  const backupPolicyStore=useRef<Record<string,BackupPolicyBuffer>>({});
  const [,updateBackupPolicies]=useState(0);
  function changeBackupPolicy(expected:BackupPolicyBuffer|null,next:BackupPolicyBuffer):boolean{
   if(!session||!route.projectId||backupReferenceLive.current.session!==session||backupReferenceLive.current.projectId!==route.projectId||backupReferenceLive.current.screen!=='settings'||!backupPolicyOwned(next,client,session,route.projectId))return false;
   const old=backupPolicyStore.current[backupReferenceKey]??null,merged=mergeBackupPolicy(old,expected,next);if(merged===old||!merged)return false;backupPolicyStore.current[backupReferenceKey]=merged;updateBackupPolicies(v=>v+1);return true;
  }
  function requestBackupPolicyApproval(b:BackupPolicyBuffer):boolean{
   if(!session||!route.projectId||backupPolicyStore.current[backupReferenceKey]!==b||!backupPolicyOwned(b,client,session,route.projectId))return false;
   const key=session.user.id+':'+session.clientId+':'+route.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;
   try{const work=newBackupPolicyApproval(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request:work}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}
  }
  useEffect(()=>{if(!Object.values(backupPolicyStore.current).some(b=>b.dirty||b.uncertain||b.pending&&!b.pending.receipt))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  const installationResourceStore=useRef<Record<string,InstallationResourceBuffer>>({});
  const installationResourceKey=session&&route.projectId?session.user.id+':'+session.clientId+':'+route.projectId+':'+session.csrfToken:'';
  const installationResourceLive=useRef({session,projectId:route.projectId,screen:route.screen});installationResourceLive.current={session,projectId:route.projectId,screen:route.screen};
  const [,updateInstallationResources]=useState(0);
  function changeInstallationResource(expected:InstallationResourceBuffer|null,next:InstallationResourceBuffer):boolean{
   if(!session||!route.projectId||installationResourceLive.current.session!==session||installationResourceLive.current.projectId!==route.projectId||installationResourceLive.current.screen!=='settings'||!installationResourceOwned(next,client,session,route.projectId))return false;
   const old=installationResourceStore.current[installationResourceKey]??null,merged=mergeInstallationResourceBuffer(old,expected,next);if(merged===old||!merged)return false;installationResourceStore.current[installationResourceKey]=merged;updateInstallationResources(v=>v+1);return true;
  }
  function requestInstallationResourceApproval(b:InstallationResourceBuffer):boolean{
   if(!session||!route.projectId||installationResourceStore.current[installationResourceKey]!==b||!installationResourceOwned(b,client,session,route.projectId))return false;
   const key=session.user.id+':'+session.clientId+':'+route.projectId,old=approvalBuffers[key];if(old?.request&&!old.request.resultId)return false;
   try{const work=newInstallationResourceApproval(b,session);setApprovalBuffers(previous=>({...previous,[key]:{...previous[key]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request:work}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}catch(e){setError(e instanceof ApiError?e:new ApiError('APPROVAL_CANDIDATE_MISMATCH'));return false;}
  }
  useEffect(()=>{if(!Object.values(installationResourceStore.current).some(b=>b.dirty||b.uncertain||b.pending&&!b.pending.receipt))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  const exportScope=useRef(new ExportScope());exportScope.current.bind(session,client,route.projectId);
  const exportOwner=session?session.user.id+':'+session.clientId:'';
  const exportStore=useRef<{owner:string;items:Record<string,ExportPending>}>({owner:'',items:{}});
  const exportLive=useRef({session,projectId:route.projectId});exportLive.current={session,projectId:route.projectId};
  const [,updateExports]=useState(0);
  if(exportStore.current.owner!==exportOwner)exportStore.current={owner:exportOwner,items:{}};
  function changeExport(expected:string|null,next:ExportPending|null):boolean{
   if(!session||!route.projectId||exportLive.current.session!==session||exportLive.current.projectId!==route.projectId||exportStore.current.owner!==exportOwner)return false;
   if(next&&(next.ownerUserId!==session.user.id||next.ownerClientId!==session.clientId||next.projectId!==route.projectId||next.csrfToken!==session.csrfToken||next.api!==client||next.transport!==client.transport))return false;
   const old=exportStore.current.items[route.projectId]??null,merged=mergeExportPending(old,expected,next);if(merged===old)return false;
   if(merged)exportStore.current.items[route.projectId]=merged;else delete exportStore.current.items[route.projectId];updateExports(v=>v+1);return true;
  }
  useEffect(()=>{if(!Object.values(exportStore.current.items).some(p=>!p.receipt))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  const notificationScope=useRef(new NotificationScope());
  notificationScope.current.bind(session,client,route.projectId);
  const notificationOwner=session?session.user.id+':'+session.clientId:'';
  const notificationStore=useRef<{owner:string;items:Record<string,NotificationPending>}>({owner:'',items:{}});
  const notificationLive=useRef({session,projectId:route.projectId});notificationLive.current={session,projectId:route.projectId};
  const [,updateNotifications]=useState(0);
  if(notificationStore.current.owner!==notificationOwner)notificationStore.current={owner:notificationOwner,items:{}};
  function changeNotification(expected:string|null,next:NotificationPending|null):boolean{
    if(!session||!route.projectId||notificationLive.current.session!==session||notificationLive.current.projectId!==route.projectId||notificationStore.current.owner!==notificationOwner)return false;
    const old=notificationStore.current.items[route.projectId]??null;
    if(next&&(next.ownerUserId!==session.user.id||next.ownerClientId!==session.clientId||next.projectId!==route.projectId||next.csrfToken!==session.csrfToken||next.api!==client||next.transport!==client.transport))return false;
    const merged=mergeNotificationPending(old,expected,next);if(merged===old)return false;
    if(merged)notificationStore.current.items[route.projectId]=merged;else delete notificationStore.current.items[route.projectId];
    updateNotifications(v=>v+1);return true;
  }
  useEffect(()=>{if(!Object.values(notificationStore.current.items).some(p=>!p.receipt))return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);});
  const controlScope=useRef(new ControlScope());
  controlScope.current.bind(session,route.screen==='control'?(route.projectId??''):'');
  const controlStore=useRef<Record<string,ControlBuffer|null>>({});
  const [controlBuffers,setControlBuffers]=useState<Record<string,ControlBuffer|null>>({});
  const controlKey=session?JSON.stringify([session.user.id,session.clientId,route.projectId]):'';
  function changeControl(expected:string|null,next:ControlBuffer):boolean{
    const key=JSON.stringify([next.ownerUserId,next.ownerClientId,next.projectId]);
    const current=controlStore.current[key]??null;
    const merged=mergeControlBuffer(current,expected,next);
    if(merged===current)return false;
    controlStore.current={...controlStore.current,[key]:merged};setControlBuffers(controlStore.current);return true;
  }
  useEffect(()=>{
    if(!Object.values(controlBuffers).some(b=>b&&(b.reason||b.expiresAt||b.pending&&b.pending.status!=='CONFIRMED')))return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);
  },[controlBuffers]);
  const [checkpointBuffers,setCheckpointBuffers]=useState<Record<string,CheckpointForm|null>>({});
  useEffect(()=>{setCheckpointBuffers({});},[session?.user.id,session?.clientId]);
  useEffect(()=>{if(!session||!Object.values(checkpointBuffers).some(Boolean))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[checkpointBuffers,session]);
  const preparationRecords=useRef<Record<string,PreparationBuffer|null>>({}),[,refreshPreparationRecords]=useState(0);
  const preparationLive=useRef({session,client,transport:client.transport,route});preparationLive.current={session,client,transport:client.transport,route};
  function changePreparation(expected:PreparationBuffer|null,next:PreparationBuffer){const live=preparationLive.current;if(!session||live.session!==session||live.client!==client||live.transport!==client.transport||live.route.screen!=='transfers'||live.route.projectId!==next.projectId||next.ownerUserId!==session.user.id||next.ownerClientId!==session.clientId||next.api!==client||next.transport!==client.transport)return false;const old=preparationRecords.current[next.key]??null,merged=mergePreparation(old,expected,next);if(merged===old)return false;preparationRecords.current[next.key]=merged;refreshPreparationRecords(v=>v+1);return true;}
  const candidateKey=session?session.user.id+':'+session.clientId+':'+route.projectId:'';
  const [mobileSelection,setMobileSelection]=useState<{owner:string;pane:MobilePane}>({owner:'',pane:'chat'});
  if(mobileSelection.owner!==candidateKey)setMobileSelection({owner:candidateKey,pane:'chat'});
  const mobilePane=mobileSelection.owner===candidateKey?mobileSelection.pane:'chat';
  function selectMobilePane(pane:MobilePane){setMobileSelection({owner:candidateKey,pane});if(route.screen==='mobile'&&route.mobileScreen&&route.projectId)location.hash='#/projects/'+route.projectId+'/mobile';}
  const criteriaKey=[candidateKey,route.assignmentRef?.id,route.assignmentRef?.version,route.assignmentRef?.contentHash].join(':');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [retry, setRetry] = useState(0);
  const [endingSession, setEndingSession] = useState(false);
  const [draftBuffer, setDraftBuffer] = useState(emptyDraft);
  const baselineProjectId=route.screen==='workspace'?route.projectId:route.screen==='create'&&draftBuffer.createdProject?draftBuffer.createdProject.id:null;
  const baselineKey=session&&baselineProjectId?[session.user.id,session.clientId,baselineProjectId].join(':'):'';
  const [methodBuffer, setMethodBuffer] = useState(emptyMethodBuffer);
  const [projectMethodBuffers, setProjectMethodBuffers] = useState<Record<string, MethodBuffer>>({});
  useEffect(() => {
    if (!Object.values(projectMethodBuffers).some(value => value.dirty || value.pending || value.preparationId || value.review?.dirty || value.review?.pending || value.application?.reason || value.application?.pending || value.application?.preparationId)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn);
  }, [projectMethodBuffers]);
  const [formBuffer, setFormBuffer] = useState(emptyFormBuffer);
  const [documentBuffer, setDocumentBuffer] = useState<DocumentBuffer | null>(null);
  const [documentReview, setDocumentReview] = useState<DocumentReviewBuffer | null>(null);
  const [documentConfirmation, setDocumentConfirmation] = useState<DocumentConfirmationBuffer | null>(null);
  const [sourceDetachBuffers,setSourceDetachBuffers]=useState<Record<string,SourceDetachBuffer|null>>({});
  const [sourceLinkBuffers,setSourceLinkBuffers]=useState<Record<string,SourceLinkBuffer|null>>({});
  useEffect(()=>{if(!Object.values(sourceLinkBuffers).some(b=>b&&!b.verified&&(b.pending||String(b.payload.reason??'').trim())))return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[sourceLinkBuffers]);
  const [resultIssueSelections,setResultIssueSelections]=useState<Record<string,ResultIssueSelection|null>>({});
  useEffect(()=>{
    if(!Object.values(sourceDetachBuffers).some(b=>b&&!b.verified&&(b.reason||b.pending)))return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);
  },[sourceDetachBuffers]);
  const [knowledgeBuffers,setKnowledgeBuffers]=useState<Record<string,KnowledgeBuffer|null>>({});
  const [conversationBuffers,setConversationBuffers]=useState<Record<string,ConversationBuffer|null>>({});
  const changeConversation = (projectId: string, expectedBindingId: string | null, value: ConversationBuffer | null) => setConversationBuffers(previous => {
    const current = previous[projectId] ?? null, next = mergeConversationBuffer(projectId, expectedBindingId, current, value);
    return next === current ? previous : { ...previous, [projectId]: next };
  });
  const[knowledgeExclusions,setKnowledgeExclusions]=useState<Record<string,KnowledgeExclusionBuffer|null>>({});
  const[knowledgeCorrections,setKnowledgeCorrections]=useState<Record<string,KnowledgeCorrectionBuffer|null>>({});
  const[knowledgeShareRequests,setKnowledgeShareRequests]=useState<Record<string,KnowledgeShareRequestBuffer|null>>({});
  const[knowledgeDecisions,setKnowledgeDecisions]=useState<Record<string,KnowledgeDecisionBuffer|null>>({});
  useEffect(()=>{
    if(![...Object.values(knowledgeBuffers),...Object.values(conversationBuffers),...Object.values(knowledgeExclusions),...Object.values(knowledgeCorrections),...Object.values(knowledgeDecisions),...Object.values(knowledgeShareRequests)].some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);
  },[knowledgeBuffers,conversationBuffers,knowledgeExclusions,knowledgeCorrections,knowledgeDecisions,knowledgeShareRequests]);
  useEffect(() => {
    if (!documentBuffer?.dirty && !documentBuffer?.pending && !documentReview?.dirty && !documentReview?.pending && !(documentConfirmation?.acknowledged && !documentConfirmation.saved) && !documentConfirmation?.pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn);
  }, [documentBuffer?.dirty, documentBuffer?.pending, documentReview?.dirty, documentReview?.pending, documentConfirmation?.acknowledged, documentConfirmation?.saved, documentConfirmation?.pending]);
  function newProject() {
    if (draftBuffer.upload || draftBuffer.pendingCommand || draftBuffer.pendingAction || draftBuffer.commonSetupWork&&['PREPARED','SENDING','UNKNOWN'].includes(draftBuffer.commonSetupWork.phase)) { alert('앞선 저장 결과를 먼저 확인하세요. 입력과 명령을 유지했습니다.'); return false; }
    if ((draftBuffer.dirty || draftBuffer.review?.dirty || draftBuffer.commonSetupEditor || draftBuffer.commonSetupWork) && !confirm('탭의 미저장 입력을 버리고 새 초안을 시작할까요?')) return false;
    setDraftBuffer(emptyDraft()); return true;
  }
  useEffect(() => {
    if (!draftBuffer.commonSetupEditor && !draftBuffer.commonSetupWork && !draftBuffer.dirty && !draftBuffer.upload && !draftBuffer.pendingCommand && !draftBuffer.pendingAction && !draftBuffer.review?.dirty && !methodBuffer.dirty && !methodBuffer.pending && !methodBuffer.review?.dirty && !methodBuffer.review?.pending && !formBuffer.dirty && !formBuffer.pending && !formBuffer.review?.dirty && !formBuffer.review?.pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [draftBuffer.commonSetupEditor, draftBuffer.commonSetupWork, draftBuffer.dirty, draftBuffer.upload, draftBuffer.pendingCommand, draftBuffer.pendingAction, draftBuffer.review?.dirty, methodBuffer.dirty, methodBuffer.pending, methodBuffer.review?.dirty, methodBuffer.review?.pending, formBuffer.dirty, formBuffer.pending, formBuffer.review?.dirty, formBuffer.review?.pending]);
  async function logout() {
    if (!session || endingSession) return;
    setEndingSession(true);
    try {
      await client.postAuth('logout', {}, session.csrfToken);
      setSession(null); setError(new ApiError('AUTH_REQUIRED', 401));
    } catch (cause: unknown) { setError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
    finally { setEndingSession(false); }
  }
  useEffect(() => {
    const changed = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', changed);
    return () => removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    client.get<Session>('/api/v1/session').then(value => {
      const valid = readSession(value);
      if (current) { setSession(valid); setError(null); }
    }).catch((cause: unknown) => {
      if (current) { setSession(null); setError(cause instanceof ApiError ? cause : new ApiError('RESPONSE_INVALID')); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [retry]);
  return <AppShell route={route} projectAccess={session&&!loading&&!error&&!endingSession?{client,session,onAuthenticationLost:()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}:undefined} displayName={session?.user.displayName} onLogout={session ? () => { void logout(); } : undefined} endingSession={endingSession}>
    {session&&route.screen==='mobile'&&route.projectId?<MobileNavigation route={route} pane={mobilePane} onPaneChange={selectMobilePane}/>:null}
    <StatusView loading={loading} error={error} onRetry={() => setRetry(v => v + 1)}>
{session&&route.screen==='control'&&route.projectId?<ControlAccessPage key={candidateKey} client={client} projectId={route.projectId} session={session} buffer={controlBuffers[controlKey]??null} onChange={changeControl} scope={controlScope.current} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:session&&route.screen==='transfers'&&route.projectId?<TransferPreparationPage session={session} preparation={{buffers:preparationRecords.current,onChange:changePreparation}} key={candidateKey+':'+JSON.stringify(route.assignmentRef??null)+':'+session.csrfToken} client={client} projectId={route.projectId} assignmentRef={route.assignmentRef} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:<>
{session && route.screen === 'session' && route.projectId ? <SessionDetailPage startOrigins={{buffers:startOriginBuffers,onChange:changeStartOrigin}} artifactTraces={{buffers:artifactTraceBuffers,onChange:(key,change)=>setArtifactTraceBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))}} onIssueSelect={selection=>setResultIssueSelections(previous=>({...previous,[candidateKey]:selection}))} key={candidateKey+':'+route.assignmentRef?.id+':'+route.assignmentRef?.version+':'+route.assignmentRef?.contentHash} client={client} projectId={route.projectId} assignmentRef={route.assignmentRef} checkpoint={{buffers:checkpointBuffers,onChange:(key,change)=>setCheckpointBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))}} criteria={{session,understanding:{buffers:understandingReviews,onChange:(key,change)=>setUnderstandingReviews(previous=>({...previous,[key]:change(previous[key]??null)}))},stageStart:{buffers:stageStartBuffers,onChange:(key,change)=>setStageStartBuffers(prior=>({...prior,[key]:change(prior[key]??null)}))},stageQueue:{buffers:stageQueueBuffers,onChange:(key,change)=>setStageQueueBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))},submissions:{manual:{drafts:manualResultReports,onChange:(key,change)=>setManualResultReports(previous=>({...previous,[key]:change(previous[key]??null)}))},buffers:resultSubmissionBuffers,onChange:(key,change)=>setResultSubmissionBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))},reworks:{form:{drafts:resultReworkForms,onChange:(key,change)=>setResultReworkForms(previous=>({...previous,[key]:change(previous[key]??null)}))},buffers:resultReworkBuffers,onChange:(key,change)=>setResultReworkBuffers(previous=>({...previous,[key]:typeof change==='function'?change(previous[key]??null):change}))},reviews:{buffers:resultReviewBuffers,onChange:(key,change)=>setResultReviewBuffers(previous=>({...previous,[key]:typeof change==='function'?change(previous[key]??null):change}))},buffer:criteriaBuffers[criteriaKey]??null,onChange:change=>setCriteriaBuffers(previous=>({...previous,[criteriaKey]:typeof change==='function'?change(previous[criteriaKey]??null):change}))}} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/> : session && route.screen === 'changes' && route.projectId ? <DesignChangesPage activationBuffer={activationBuffers[candidateKey]??null} onActivationChange={change=>setActivationBuffers(previous=>({...previous,[candidateKey]:typeof change==='function'?change(previous[candidateKey]??null):change}))} onActivationRequest={buffer=>{const old=approvalBuffers[candidateKey];if(old?.request&&!old.request.resultId)return false;const work=newDesignActivationApprovalRequest(buffer,session);setApprovalBuffers(previous=>({...previous,[candidateKey]:{...previous[candidateKey]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request:work}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}} key={candidateKey+':'+session.csrfToken} client={client} projectId={route.projectId} session={session} reviewBuffer={impactReviewBuffers[candidateKey]??null} onReviewChange={value=>setImpactReviewBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} buffer={changeRequestBuffers[candidateKey]??null} onChange={value=>setChangeRequestBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} onAuthenticationLost={() => {setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && (route.screen === 'workspace'||route.screen==='mobile'&&!route.mobileScreen) && route.projectId ? <WorkspacePage nodeDecisions={{buffers:nodeDecisionStore.current,onChange:changeNodeDecision}} mobilePane={route.screen==='mobile'?mobilePane:undefined} providedHumanReportRef={capabilityReportBuffers[candidateKey]?.projectId===route.projectId&&capabilityReportBuffers[candidateKey]?.ownerUserId===session.user.id&&capabilityReportBuffers[candidateKey]?.ownerClientId===session.clientId?capabilityReportBuffers[candidateKey]?.result??null:null} documentPreparation={{available:!documentBuffer&&!documentReview&&!documentConfirmation&&!sourceDetachBuffers[candidateKey],onPrepared:value=>{if(documentBuffer||documentReview||documentConfirmation||value.projectId!==route.projectId||value.ownerUserId!==session.user.id)return;setDocumentBuffer(previous=>previous??value);location.hash='#/projects/'+route.projectId+'/documents';}}} key={candidateKey+':'+JSON.stringify(route.planTask??null)} client={client} projectId={route.projectId} requestedTask={route.planTask} session={session} conversationBuffer={conversationBuffers[route.projectId] ?? null} onConversationChange={value=>changeConversation(route.projectId!,conversationBuffers[route.projectId!]?.bindingId??null,value)} assignmentBuffer={assignmentBuffers[candidateKey] ?? null} onAssignmentChange={value => setAssignmentBuffers(previous => ({ ...previous, [candidateKey]: typeof value === 'function' ? value(previous[candidateKey] ?? null) : value }))} onAuthenticationLost={() => {setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && (route.screen === 'approvals'||route.screen==='mobile'&&route.mobileScreen==='approvals') && route.projectId ? <ApprovalsPage onMembershipReturn={returnMembershipApproval} nativeBuffer={nativeStore.current[nativeStoreKey]??null} environmentBuffer={environmentStore.current[environmentStoreKey]??null} backupPolicyBuffer={backupPolicyStore.current[backupReferenceKey]??null} installationResourceBuffer={installationResourceStore.current[installationResourceKey]??null} backupReferenceBuffer={backupReferenceStore.current[backupReferenceKey]??null} activationBuffer={activationBuffers[candidateKey]??null} responsibleSessionBuffers={Object.values(assignmentBuffers).map(b=>b?.responsibleSession??null)} limitBuffers={limitBuffers} stageStartBuffers={stageStartBuffers} resultIssueSelection={resultIssueSelections[candidateKey]??null} onResultIssueClose={()=>setResultIssueSelections(previous=>({...previous,[candidateKey]:null}))} sourceLink={sourceLinkBuffers[candidateKey]??null} onSourceLinkChange={change=>setSourceLinkBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} sourceDetach={sourceDetachBuffers[candidateKey]??null} onSourceDetachChange={change=>setSourceDetachBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} key={candidateKey+':'+(route.approvalRequestId??'')} client={client} projectId={route.projectId} requestId={route.approvalRequestId} session={session} buffer={approvalBuffers[candidateKey] ?? null} onChange={value=>setApprovalBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} candidate={candidateBuffers[candidateKey]??null} onCandidateChange={value=>setCandidateBuffers(previous=>({...previous,[candidateKey]:value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && route.screen === 'connections' && route.projectId ? <ConnectionsPage nativeBuffer={nativeStore.current[nativeStoreKey]??null} onNativeChange={changeNative} onNativeApproval={requestNativeApproval} nativeApprovalId={approvalBuffers[candidateKey]?.request?.candidate.commandId===nativeStore.current[nativeStoreKey]?.pending?.command.commandId?approvalBuffers[candidateKey]?.request?.resultId??null:null} environmentPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_ENVIRONMENT']??null} onEnvironmentPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_ENVIRONMENT']:change(previous[candidateKey+':PROJECT_ENVIRONMENT']??null)}))} environmentBuffer={environmentStore.current[environmentStoreKey]??null} onEnvironmentChange={changeEnvironment} onEnvironmentApproval={requestEnvironmentApproval} environmentApprovalId={approvalBuffers[candidateKey]?.request?.candidate.commandId===environmentStore.current[environmentStoreKey]?.pending?.command.commandId?approvalBuffers[candidateKey]?.request?.resultId??null:null} definitionReportBuffer={definitionReportBuffers[candidateKey]??null} onDefinitionReportChange={change=>changeDefinitionReport(candidateKey,change)} definitionBuffer={definitionStore.current[definitionStoreKey]??null} onDefinitionChange={changeDefinition} onDefinitionApproval={requestDefinitionApproval} definitionApprovalId={approvalBuffers[candidateKey]?.request?.candidate.commandId===definitionStore.current[definitionStoreKey]?.pending?.command.commandId?approvalBuffers[candidateKey]?.request?.resultId??null:null} capabilityReportBuffer={capabilityReportBuffers[candidateKey]??null} onCapabilityReportChange={change=>setCapabilityReportBuffers(previous=>({...previous,[candidateKey]:typeof change==='function'?change(previous[candidateKey]??null):change}))} hostTrustPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_HOST_TRUST']??null} onHostTrustPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_HOST_TRUST']:change(previous[candidateKey+':PROJECT_HOST_TRUST']??null)}))} sourceObservationPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_SOURCE_OBSERVATIONS']??null} onSourceObservationPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_SOURCE_OBSERVATIONS']:change(previous[candidateKey+':PROJECT_SOURCE_OBSERVATIONS']??null)}))} baselinePolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_BASELINES']??null} onBaselinePolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_BASELINES']:change(previous[candidateKey+':PROJECT_BASELINES']??null)}))} sourceDeclarationPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_SOURCE_DECLARATIONS']??null} onSourceDeclarationPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_SOURCE_DECLARATIONS']:change(previous[candidateKey+':PROJECT_SOURCE_DECLARATIONS']??null)}))} limitPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_LIMITS']??null} onLimitPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_LIMITS']:change(previous[candidateKey+':PROJECT_LIMITS']??null)}))} resultPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_RESULTS']??null} onResultPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_RESULTS']:change(previous[candidateKey+':PROJECT_RESULTS']??null)}))} preparationPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_PREPARATION']??null} onPreparationPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_PREPARATION']:change(previous[candidateKey+':PROJECT_PREPARATION']??null)}))} materialPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_MATERIAL']??null} onMaterialPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_MATERIAL']:change(previous[candidateKey+':PROJECT_MATERIAL']??null)}))} policyBuffer={candidatePolicyBuffers[candidateKey]??null} onPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} limitBuffer={limitBuffers[candidateKey]??null} onLimitChange={change=>setLimitBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} trustBuffer={trustBuffers[candidateKey]??null} onTrustChange={value=>setTrustBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} key={candidateKey+':'+session.csrfToken} client={client} projectId={route.projectId} session={session} buffer={candidateBuffers[candidateKey] ?? null} onChange={value => setCandidateBuffers(previous => ({...previous,[candidateKey]:value}))} onAuthenticationLost={() => {setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && route.screen === 'methodologies' && route.projectId ? <ProjectMethodologyPage key={session.user.id + ':' + session.clientId + ':' + route.projectId} client={client} projectId={route.projectId} session={session} buffer={projectMethodBuffers[route.projectId] ?? emptyMethodBuffer()} onChange={value => setProjectMethodBuffers(previous => ({ ...previous, [route.projectId!]: typeof value === 'function' ? value(previous[route.projectId!] ?? emptyMethodBuffer()) : value }))} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED',401)); }} /> : session && route.screen === 'knowledge' && route.projectId ? <KnowledgePage key={session.user.id + ':' + session.clientId + ':' + route.projectId} client={client} projectId={route.projectId} session={session} shareBuffer={knowledgeShareRequests[route.projectId]??null} onShareChange={change=>setKnowledgeShareRequests(previous=>({...previous,[route.projectId!]:typeof change==='function'?change(previous[route.projectId!]??null):change}))} buffer={knowledgeBuffers[route.projectId] ?? null} conversationBuffer={conversationBuffers[route.projectId] ?? null} exclusion={knowledgeExclusions[route.projectId] ?? null} correction={knowledgeCorrections[route.projectId] ?? null} decision={knowledgeDecisions[route.projectId] ?? null} onDecisionChange={value=>setKnowledgeDecisions(previous=>({...previous,[route.projectId!]:typeof value==='function'?value(previous[route.projectId!]??null):value}))} onCorrectionChange={value=>setKnowledgeCorrections(previous=>({...previous,[route.projectId!]:typeof value==='function'?value(previous[route.projectId!]??null):value}))} onExclusionChange={value=>setKnowledgeExclusions(previous=>({...previous,[route.projectId!]:value}))} onConversationChange={value=>changeConversation(route.projectId!,conversationBuffers[route.projectId!]?.bindingId??null,value)} onChange={value=>setKnowledgeBuffers(previous=>({...previous,[route.projectId!]:value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && route.screen === 'documents' && route.projectId ? <DocumentsPage createdOriginal={route.createdOriginal} requestedDocument={route.documentRef} key={session.user.id + ':' + session.clientId + ':' + route.projectId + ':' + JSON.stringify(route.documentRef??null)} client={client} projectId={route.projectId} session={session} buffer={documentBuffer} onChange={setDocumentBuffer} review={documentReview} onReviewChange={setDocumentReview} confirmation={documentConfirmation} onConfirmationChange={setDocumentConfirmation} sourceLink={sourceLinkBuffers[candidateKey]??null} onSourceLinkChange={change=>setSourceLinkBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} sourceDetach={sourceDetachBuffers[candidateKey]??null} onSourceDetachChange={change=>setSourceDetachBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'create' ? <ProjectCreatePage client={client} session={session} buffer={draftBuffer} onChange={setDraftBuffer} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'projects' ? <ProjectsPage membership={session?{session,buffers:Object.fromEntries(Object.values(membershipStore.current).filter((b):b is MembershipBuffer=>!!b&&membershipOwned(b,client,session,b.projectId)).map(b=>[b.projectId,b])),onChange:changeMembership,onApproval:requestMembershipApproval}:undefined} client={client} onNewProject={newProject} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'methodologies' && !route.projectId ? <MethodologyEditorPage key={session.user.id + ':' + session.clientId} client={client} session={session} buffer={methodBuffer} onChange={setMethodBuffer} formBuffer={formBuffer} onFormChange={setFormBuffer} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'settings' ? <AccountSecurity backups={<><BackupPolicyPanel key={'policy:'+backupReferenceKey+':'+session.csrfToken} client={client} session={session} projectId={route.projectId} buffer={backupPolicyStore.current[backupReferenceKey]??null} approvalRequestId={approvalBuffers[candidateKey]?.request?.candidate.commandId===backupPolicyStore.current[backupReferenceKey]?.pending?.command.commandId?approvalBuffers[candidateKey]?.request?.resultId??null:null} onChange={changeBackupPolicy} onApprovalRequest={requestBackupPolicyApproval} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/><BackupReferencePanel key={backupReferenceKey+':'+session.csrfToken} client={client} session={session} projectId={route.projectId} buffer={backupReferenceStore.current[backupReferenceKey]??null} scope={backupReferenceScope.current} approvalRequestId={approvalBuffers[candidateKey]?.request?.candidate.commandId===backupReferenceStore.current[backupReferenceKey]?.pending?.command.commandId?approvalBuffers[candidateKey]?.request?.resultId??null:null} onChange={changeBackupReference} onApprovalRequest={requestBackupReferenceApproval} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/><InstallationResourcePanel key={installationResourceKey+':'+session.csrfToken} client={client} session={session} projectId={route.projectId} buffer={installationResourceStore.current[installationResourceKey]??null} scope={installationResourceScope.current} approvalRequestId={approvalBuffers[candidateKey]?.request?.candidate.commandId===installationResourceStore.current[installationResourceKey]?.pending?.command.commandId?approvalBuffers[candidateKey]?.request?.resultId??null:null} onChange={changeInstallationResource} onApprovalRequest={requestInstallationResourceApproval} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/><ProjectBackupsPanel client={client} session={session} projectId={route.projectId} buffer={route.projectId?exportStore.current.items[route.projectId]??null:null} scope={exportScope.current} onChange={changeExport} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/></>} notifications={<ProjectNotificationsPanel client={client} session={session} projectId={route.projectId} buffer={route.projectId?notificationStore.current.items[route.projectId]??null:null} scope={notificationScope.current} onChange={changeNotification} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>} key={session.user.id+':'+session.clientId} projectId={route.projectId} client={client} csrfToken={session.csrfToken} onSession={value => setSession(readSession(value))} onRevoked={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : <section className="status-card"><h2>아직 연결되지 않은 화면</h2><p>공통 탐색을 구현 중입니다. 이 화면의 실제 처리·저장·조회 기능은 아직 연결되지 않았습니다.</p></section>}
{session&&route.screen==='connections'&&route.projectId?<SourceRootsPanel key={'source-roots-panel:'+candidateKey} client={client} projectId={route.projectId} session={session} buffer={rootBuffers[candidateKey]??null} onChange={value=>setRootBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} readBuffer={sourceReadBuffers[candidateKey]??null} onReadChange={value=>setSourceReadBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:null}
{session&&baselineProjectId?<ProjectBaselinePanel key={'baseline-panel:'+baselineKey} client={client} projectId={baselineProjectId} session={session} buffer={baselineBuffers[baselineKey]??null} onChange={value=>setBaselineBuffers(previous=>({...previous,[baselineKey]:typeof value==='function'?value(previous[baselineKey]??null):value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:null}
    </>}
    </StatusView>
    {!loading && error?.status === 401 ? <AuthForm client={client} onAuthenticated={value => { setSession(readSession(value)); setError(null); }} /> : null}
  </AppShell>;
}
