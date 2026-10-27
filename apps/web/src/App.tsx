import {ProjectBackupsPanel} from './features/backups/ProjectBackupsPanel.tsx';
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
import {MobileNavigation} from './features/mobile/MobileNavigation.tsx';
import { AuthForm } from './shell/AuthForm.tsx';
import { AccountSecurity } from './shell/AccountSecurity.tsx';
import { ProjectsPage } from './features/projects/ProjectsPage.tsx';
import { WorkspacePage } from './features/workspace/WorkspacePage.tsx';
import {SessionDetailPage} from './features/session-detail/SessionDetailPage.tsx';
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
  useEffect(()=>{if(!Object.values(stageStartBuffers).some(b=>b&&!b.result))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[stageStartBuffers]);
  const [stageQueueBuffers,setStageQueueBuffers]=useState<Record<string,QueuePanelBuffer|null>>({});
  useEffect(()=>{if(!Object.values(stageQueueBuffers).some(b=>b&&!b.command?.result))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[stageQueueBuffers]);
  const [manualResultReports,setManualResultReports]=useState<Record<string,ManualResultReport|null>>({});
  useEffect(()=>{if(!Object.values(manualResultReports).some(Boolean))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[manualResultReports]);
  const [resultSubmissionBuffers,setResultSubmissionBuffers]=useState<Record<string,ResultSubmissionBuffer|null>>({});
  useEffect(()=>{if(!Object.values(resultSubmissionBuffers).some(b=>b&&!b.result&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[resultSubmissionBuffers]);
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
  useEffect(() => { if (!Object.values(assignmentBuffers).some(b => b && (b.dirty || b.pending || b.uncertain))) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn); }, [assignmentBuffers]);
  const [sourceReadBuffers,setSourceReadBuffers]=useState<Record<string,SourceReadBuffer|null>>({});
  useEffect(()=>{if(!Object.values(sourceReadBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[sourceReadBuffers]);
  const [rootBuffers,setRootBuffers]=useState<Record<string,RootBuffer|null>>({});
  useEffect(()=>{if(!Object.values(rootBuffers).some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);},[rootBuffers]);
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
  const candidateKey=session?session.user.id+':'+session.clientId+':'+route.projectId:'';
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
  const[knowledgeDecisions,setKnowledgeDecisions]=useState<Record<string,KnowledgeDecisionBuffer|null>>({});
  useEffect(()=>{
    if(![...Object.values(knowledgeBuffers),...Object.values(conversationBuffers),...Object.values(knowledgeExclusions),...Object.values(knowledgeCorrections),...Object.values(knowledgeDecisions)].some(b=>b&&(b.dirty||b.pending||b.uncertain)))return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    addEventListener('beforeunload',warn);return()=>removeEventListener('beforeunload',warn);
  },[knowledgeBuffers,conversationBuffers,knowledgeExclusions,knowledgeCorrections,knowledgeDecisions]);
  useEffect(() => {
    if (!documentBuffer?.dirty && !documentBuffer?.pending && !documentReview?.dirty && !documentReview?.pending && !(documentConfirmation?.acknowledged && !documentConfirmation.saved) && !documentConfirmation?.pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn); return () => removeEventListener('beforeunload', warn);
  }, [documentBuffer?.dirty, documentBuffer?.pending, documentReview?.dirty, documentReview?.pending, documentConfirmation?.acknowledged, documentConfirmation?.saved, documentConfirmation?.pending]);
  function newProject() {
    if (draftBuffer.upload || draftBuffer.pendingCommand || draftBuffer.pendingAction) { alert('앞선 저장 결과를 먼저 확인하세요. 입력과 명령을 유지했습니다.'); return false; }
    if ((draftBuffer.dirty || draftBuffer.review?.dirty) && !confirm('탭의 미저장 입력을 버리고 새 초안을 시작할까요?')) return false;
    setDraftBuffer(emptyDraft()); return true;
  }
  useEffect(() => {
    if (!draftBuffer.dirty && !draftBuffer.upload && !draftBuffer.pendingCommand && !draftBuffer.pendingAction && !draftBuffer.review?.dirty && !methodBuffer.dirty && !methodBuffer.pending && !methodBuffer.review?.dirty && !methodBuffer.review?.pending && !formBuffer.dirty && !formBuffer.pending && !formBuffer.review?.dirty && !formBuffer.review?.pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [draftBuffer.dirty, draftBuffer.upload, draftBuffer.pendingCommand, draftBuffer.pendingAction, draftBuffer.review?.dirty, methodBuffer.dirty, methodBuffer.pending, methodBuffer.review?.dirty, methodBuffer.review?.pending, formBuffer.dirty, formBuffer.pending, formBuffer.review?.dirty, formBuffer.review?.pending]);
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
  return <AppShell route={route} displayName={session?.user.displayName} onLogout={session ? () => { void logout(); } : undefined} endingSession={endingSession}>
    {session&&route.screen==='mobile'&&route.projectId?<MobileNavigation route={route}/>:null}
    <StatusView loading={loading} error={error} onRetry={() => setRetry(v => v + 1)}>
{session&&route.screen==='control'&&route.projectId?<ControlAccessPage key={candidateKey} client={client} projectId={route.projectId} session={session} buffer={controlBuffers[controlKey]??null} onChange={changeControl} scope={controlScope.current} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:session&&route.screen==='transfers'&&route.projectId?<TransferPreparationPage key={candidateKey+':'+JSON.stringify(route.assignmentRef??null)} client={client} projectId={route.projectId} assignmentRef={route.assignmentRef} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:<>
{session && route.screen === 'session' && route.projectId ? <SessionDetailPage onIssueSelect={selection=>setResultIssueSelections(previous=>({...previous,[candidateKey]:selection}))} key={candidateKey+':'+route.assignmentRef?.id+':'+route.assignmentRef?.version+':'+route.assignmentRef?.contentHash} client={client} projectId={route.projectId} assignmentRef={route.assignmentRef} checkpoint={{buffers:checkpointBuffers,onChange:(key,change)=>setCheckpointBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))}} criteria={{session,understanding:{buffers:understandingReviews,onChange:(key,change)=>setUnderstandingReviews(previous=>({...previous,[key]:change(previous[key]??null)}))},stageStart:{buffers:stageStartBuffers,onChange:(key,change)=>setStageStartBuffers(prior=>({...prior,[key]:change(prior[key]??null)}))},stageQueue:{buffers:stageQueueBuffers,onChange:(key,change)=>setStageQueueBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))},submissions:{manual:{drafts:manualResultReports,onChange:(key,change)=>setManualResultReports(previous=>({...previous,[key]:change(previous[key]??null)}))},buffers:resultSubmissionBuffers,onChange:(key,change)=>setResultSubmissionBuffers(previous=>({...previous,[key]:change(previous[key]??null)}))},reworks:{form:{drafts:resultReworkForms,onChange:(key,change)=>setResultReworkForms(previous=>({...previous,[key]:change(previous[key]??null)}))},buffers:resultReworkBuffers,onChange:(key,change)=>setResultReworkBuffers(previous=>({...previous,[key]:typeof change==='function'?change(previous[key]??null):change}))},reviews:{buffers:resultReviewBuffers,onChange:(key,change)=>setResultReviewBuffers(previous=>({...previous,[key]:typeof change==='function'?change(previous[key]??null):change}))},buffer:criteriaBuffers[criteriaKey]??null,onChange:change=>setCriteriaBuffers(previous=>({...previous,[criteriaKey]:typeof change==='function'?change(previous[criteriaKey]??null):change}))}} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/> : session && route.screen === 'changes' && route.projectId ? <DesignChangesPage activationBuffer={activationBuffers[candidateKey]??null} onActivationChange={change=>setActivationBuffers(previous=>({...previous,[candidateKey]:typeof change==='function'?change(previous[candidateKey]??null):change}))} onActivationRequest={buffer=>{const old=approvalBuffers[candidateKey];if(old?.request&&!old.request.resultId)return false;const work=newDesignActivationApprovalRequest(buffer,session);setApprovalBuffers(previous=>({...previous,[candidateKey]:{...previous[candidateKey]??{projectId:route.projectId!,ownerUserId:session.user.id,ownerClientId:session.clientId,selectedId:null,decision:null},request:work}}));location.hash='#/projects/'+route.projectId+'/approvals';return true;}} key={candidateKey+':'+session.csrfToken} client={client} projectId={route.projectId} session={session} reviewBuffer={impactReviewBuffers[candidateKey]??null} onReviewChange={value=>setImpactReviewBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} buffer={changeRequestBuffers[candidateKey]??null} onChange={value=>setChangeRequestBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} onAuthenticationLost={() => {setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && (route.screen === 'workspace'||route.screen==='mobile'&&!route.mobileScreen) && route.projectId ? <WorkspacePage documentPreparation={{available:!documentBuffer&&!documentReview&&!documentConfirmation&&!sourceDetachBuffers[candidateKey],onPrepared:value=>{if(documentBuffer||documentReview||documentConfirmation||value.projectId!==route.projectId||value.ownerUserId!==session.user.id)return;setDocumentBuffer(previous=>previous??value);location.hash='#/projects/'+route.projectId+'/documents';}}} key={candidateKey+':'+JSON.stringify(route.planTask??null)} client={client} projectId={route.projectId} requestedTask={route.planTask} session={session} conversationBuffer={conversationBuffers[route.projectId] ?? null} onConversationChange={value=>changeConversation(route.projectId!,conversationBuffers[route.projectId!]?.bindingId??null,value)} assignmentBuffer={assignmentBuffers[candidateKey] ?? null} onAssignmentChange={value => setAssignmentBuffers(previous => ({ ...previous, [candidateKey]: typeof value === 'function' ? value(previous[candidateKey] ?? null) : value }))} onAuthenticationLost={() => {setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && (route.screen === 'approvals'||route.screen==='mobile'&&route.mobileScreen==='approvals') && route.projectId ? <ApprovalsPage activationBuffer={activationBuffers[candidateKey]??null} responsibleSessionBuffers={Object.values(assignmentBuffers).map(b=>b?.responsibleSession??null)} limitBuffers={limitBuffers} stageStartBuffers={stageStartBuffers} resultIssueSelection={resultIssueSelections[candidateKey]??null} onResultIssueClose={()=>setResultIssueSelections(previous=>({...previous,[candidateKey]:null}))} sourceDetach={sourceDetachBuffers[candidateKey]??null} onSourceDetachChange={change=>setSourceDetachBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} key={candidateKey+':'+(route.approvalRequestId??'')} client={client} projectId={route.projectId} requestId={route.approvalRequestId} session={session} buffer={approvalBuffers[candidateKey] ?? null} onChange={value=>setApprovalBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} candidate={candidateBuffers[candidateKey]??null} onCandidateChange={value=>setCandidateBuffers(previous=>({...previous,[candidateKey]:value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && route.screen === 'connections' && route.projectId ? <ConnectionsPage hostTrustPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_HOST_TRUST']??null} onHostTrustPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_HOST_TRUST']:change(previous[candidateKey+':PROJECT_HOST_TRUST']??null)}))} sourceObservationPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_SOURCE_OBSERVATIONS']??null} onSourceObservationPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_SOURCE_OBSERVATIONS']:change(previous[candidateKey+':PROJECT_SOURCE_OBSERVATIONS']??null)}))} baselinePolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_BASELINES']??null} onBaselinePolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_BASELINES']:change(previous[candidateKey+':PROJECT_BASELINES']??null)}))} sourceDeclarationPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_SOURCE_DECLARATIONS']??null} onSourceDeclarationPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_SOURCE_DECLARATIONS']:change(previous[candidateKey+':PROJECT_SOURCE_DECLARATIONS']??null)}))} limitPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_LIMITS']??null} onLimitPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_LIMITS']:change(previous[candidateKey+':PROJECT_LIMITS']??null)}))} resultPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_RESULTS']??null} onResultPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_RESULTS']:change(previous[candidateKey+':PROJECT_RESULTS']??null)}))} preparationPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_PREPARATION']??null} onPreparationPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_PREPARATION']:change(previous[candidateKey+':PROJECT_PREPARATION']??null)}))} materialPolicyBuffer={candidatePolicyBuffers[candidateKey+':PROJECT_MATERIAL']??null} onMaterialPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey+':PROJECT_MATERIAL']:change(previous[candidateKey+':PROJECT_MATERIAL']??null)}))} policyBuffer={candidatePolicyBuffers[candidateKey]??null} onPolicyChange={change=>setCandidatePolicyBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} limitBuffer={limitBuffers[candidateKey]??null} onLimitChange={change=>setLimitBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} trustBuffer={trustBuffers[candidateKey]??null} onTrustChange={value=>setTrustBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} key={candidateKey+':'+session.csrfToken} client={client} projectId={route.projectId} session={session} buffer={candidateBuffers[candidateKey] ?? null} onChange={value => setCandidateBuffers(previous => ({...previous,[candidateKey]:value}))} onAuthenticationLost={() => {setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && route.screen === 'methodologies' && route.projectId ? <ProjectMethodologyPage key={session.user.id + ':' + session.clientId + ':' + route.projectId} client={client} projectId={route.projectId} session={session} buffer={projectMethodBuffers[route.projectId] ?? emptyMethodBuffer()} onChange={value => setProjectMethodBuffers(previous => ({ ...previous, [route.projectId!]: typeof value === 'function' ? value(previous[route.projectId!] ?? emptyMethodBuffer()) : value }))} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED',401)); }} /> : session && route.screen === 'knowledge' && route.projectId ? <KnowledgePage key={session.user.id + ':' + session.clientId + ':' + route.projectId} client={client} projectId={route.projectId} session={session} buffer={knowledgeBuffers[route.projectId] ?? null} conversationBuffer={conversationBuffers[route.projectId] ?? null} exclusion={knowledgeExclusions[route.projectId] ?? null} correction={knowledgeCorrections[route.projectId] ?? null} decision={knowledgeDecisions[route.projectId] ?? null} onDecisionChange={value=>setKnowledgeDecisions(previous=>({...previous,[route.projectId!]:typeof value==='function'?value(previous[route.projectId!]??null):value}))} onCorrectionChange={value=>setKnowledgeCorrections(previous=>({...previous,[route.projectId!]:typeof value==='function'?value(previous[route.projectId!]??null):value}))} onExclusionChange={value=>setKnowledgeExclusions(previous=>({...previous,[route.projectId!]:value}))} onConversationChange={value=>changeConversation(route.projectId!,conversationBuffers[route.projectId!]?.bindingId??null,value)} onChange={value=>setKnowledgeBuffers(previous=>({...previous,[route.projectId!]:value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}} /> : session && route.screen === 'documents' && route.projectId ? <DocumentsPage createdOriginal={route.createdOriginal} requestedDocument={route.documentRef} key={session.user.id + ':' + session.clientId + ':' + route.projectId + ':' + JSON.stringify(route.documentRef??null)} client={client} projectId={route.projectId} session={session} buffer={documentBuffer} onChange={setDocumentBuffer} review={documentReview} onReviewChange={setDocumentReview} confirmation={documentConfirmation} onConfirmationChange={setDocumentConfirmation} sourceDetach={sourceDetachBuffers[candidateKey]??null} onSourceDetachChange={change=>setSourceDetachBuffers(previous=>({...previous,[candidateKey]:change(previous[candidateKey]??null)}))} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'create' ? <ProjectCreatePage client={client} session={session} buffer={draftBuffer} onChange={setDraftBuffer} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'projects' ? <ProjectsPage client={client} onNewProject={newProject} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'methodologies' && !route.projectId ? <MethodologyEditorPage key={session.user.id + ':' + session.clientId} client={client} session={session} buffer={methodBuffer} onChange={setMethodBuffer} formBuffer={formBuffer} onFormChange={setFormBuffer} onAuthenticationLost={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : session && route.screen === 'settings' ? <AccountSecurity backups={<ProjectBackupsPanel client={client} session={session} projectId={route.projectId} buffer={route.projectId?exportStore.current.items[route.projectId]??null:null} scope={exportScope.current} onChange={changeExport} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>} notifications={<ProjectNotificationsPanel client={client} session={session} projectId={route.projectId} buffer={route.projectId?notificationStore.current.items[route.projectId]??null:null} scope={notificationScope.current} onChange={changeNotification} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>} key={session.user.id+':'+session.clientId} projectId={route.projectId} client={client} csrfToken={session.csrfToken} onSession={value => setSession(readSession(value))} onRevoked={() => { setSession(null); setError(new ApiError('AUTH_REQUIRED', 401)); }} /> : <section className="status-card"><h2>아직 연결되지 않은 화면</h2><p>공통 탐색을 구현 중입니다. 이 화면의 실제 처리·저장·조회 기능은 아직 연결되지 않았습니다.</p></section>}
{session&&route.screen==='connections'&&route.projectId?<SourceRootsPanel key={'source-roots-panel:'+candidateKey} client={client} projectId={route.projectId} session={session} buffer={rootBuffers[candidateKey]??null} onChange={value=>setRootBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} readBuffer={sourceReadBuffers[candidateKey]??null} onReadChange={value=>setSourceReadBuffers(previous=>({...previous,[candidateKey]:typeof value==='function'?value(previous[candidateKey]??null):value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:null}
{session&&baselineProjectId?<ProjectBaselinePanel key={'baseline-panel:'+baselineKey} client={client} projectId={baselineProjectId} session={session} buffer={baselineBuffers[baselineKey]??null} onChange={value=>setBaselineBuffers(previous=>({...previous,[baselineKey]:typeof value==='function'?value(previous[baselineKey]??null):value}))} onAuthenticationLost={()=>{setSession(null);setError(new ApiError('AUTH_REQUIRED',401));}}/>:null}
    </>}
    </StatusView>
    {!loading && error?.status === 401 ? <AuthForm client={client} onAuthenticated={value => { setSession(readSession(value)); setError(null); }} /> : null}
  </AppShell>;
}
