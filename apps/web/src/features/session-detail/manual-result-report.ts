import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {prepareResultSubmissionFile} from './result-submission-write-api.ts';
export interface ManualResultReport {bindingId:string;projectId:string;ownerUserId:string;ownerClientId:string;assignmentRef:ConfirmedAssignmentView['ref'];baselineRefs:ConfirmedAssignmentView['ref'][];executionId:string;executionVersion:string;executionHash:string;submissionState:'INCOMPLETE'|'BLOCKED'|'CANCELLED';rows:{criterionId:string;testId:string;reason:string}[];risks:string;rollback:string}
export interface ManualResultReportStorage {drafts:Record<string,ManualResultReport|null>;onChange:(key:string,change:(value:ManualResultReport|null)=>ManualResultReport|null)=>void}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
function fail():never{throw new ApiError('MANUAL_RESULT_REPORT_INVALID');}
export function newManualResultReport(a:ConfirmedAssignmentView,s:DocumentSession):ManualResultReport{return{bindingId:crypto.randomUUID(),projectId:a.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,assignmentRef:structuredClone(a.ref),baselineRefs:structuredClone(a.snapshot.definition.baselineRefs),executionId:'',executionVersion:'',executionHash:'',submissionState:'INCOMPLETE',rows:[{criterionId:'',testId:'',reason:''}],risks:'',rollback:''};}
/** 화면 입력도 기존 제출 parser를 거친 수행자 주장이다. 실행·시험 evidence를 생성하지 않는다. */
export async function prepareManualResultReport(raw:ManualResultReport,a:ConfirmedAssignmentView,s:DocumentSession,generation:number){
 const d=structuredClone(raw);
 if(d.projectId!==a.projectId||d.ownerUserId!==s.user.id||d.ownerClientId!==s.clientId||!same(d.assignmentRef,a.ref)||!same(d.baselineRefs,a.snapshot.definition.baselineRefs)||!['INCOMPLETE','BLOCKED','CANCELLED'].includes(d.submissionState)||!Array.isArray(d.rows)||d.rows.length<1||d.rows.length>200||typeof d.risks!=='string'||typeof d.rollback!=='string'||!d.rollback.trim()||!/^\d{1,16}$/.test(d.executionVersion))fail();
 const executionRef={id:d.executionId,version:Number(d.executionVersion),contentHash:d.executionHash};
 const manifest={assignmentRef:d.assignmentRef,executionRef,baselineRefs:d.baselineRefs,submissionState:d.submissionState,changes:[],commandResults:[],testResults:[],artifactRefs:[],unexecuted:d.rows,risks:d.risks.trim()?[d.risks]:[],rollback:d.rollback,checkpointRef:null};
 return prepareResultSubmissionFile(new TextEncoder().encode(JSON.stringify({scope:{projectId:d.projectId,assignmentRef:d.assignmentRef,executionRef},manifest})),a.projectId,a.ref,s,generation);
}
