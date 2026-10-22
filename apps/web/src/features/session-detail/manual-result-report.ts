import {ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import {prepareResultSubmissionFile} from './result-submission-write-api.ts';
export interface ManualReportedEvidence {sourceKind:'WORKER_CLAIM'|'CONNECTOR_OBSERVED'|'TEST_ARTIFACT'|'REVIEWER_CONFIRMED';ref:{id:string;version:string;contentHash:string};contentHash:string;environmentRef:{id:string;version:string;contentHash:string};recordedAt:string}
export interface ManualReportedTest {criterionId:string;testId:string;expected:string;actual:string;status:'PASS'|'FAIL'|'NOT_EXECUTED'|'BLOCKED'|'NOT_APPLICABLE';evidence?:ManualReportedEvidence[]}
export interface ManualReportedChange {path:string;kind:'ADDED'|'MODIFIED'|'DELETED';beforeHash:string;afterHash:string;diff?:{id:string;version:string;contentHash:string}|null}
export interface ManualReportedCommand {profile:{id:string;version:string;contentHash:string};cwd:{id:string;version:string;contentHash:string};host:{id:string;version:string;contentHash:string};argv:string;startedAt:string;finishedAt:string;exitCode:string;output?:{id:string;version:string;contentHash:string}|null;evidence?:ManualReportedEvidence[]}
export interface ManualResultReport {bindingId:string;projectId:string;ownerUserId:string;ownerClientId:string;assignmentRef:ConfirmedAssignmentView['ref'];baselineRefs:ConfirmedAssignmentView['ref'][];executionId:string;executionVersion:string;executionHash:string;submissionState:'INCOMPLETE'|'BLOCKED'|'CANCELLED';rows:{criterionId:string;testId:string;reason:string}[];tests?:ManualReportedTest[];changes?:ManualReportedChange[];commands?:ManualReportedCommand[];artifacts?:{id:string;version:string;contentHash:string}[];risks:string;rollback:string}
export interface ManualResultReportStorage {drafts:Record<string,ManualResultReport|null>;onChange:(key:string,change:(value:ManualResultReport|null)=>ManualResultReport|null)=>void}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
function fail():never{throw new ApiError('MANUAL_RESULT_REPORT_INVALID');}
export function newManualResultReport(a:ConfirmedAssignmentView,s:DocumentSession):ManualResultReport{return{bindingId:crypto.randomUUID(),projectId:a.projectId,ownerUserId:s.user.id,ownerClientId:s.clientId,assignmentRef:structuredClone(a.ref),baselineRefs:structuredClone(a.snapshot.definition.baselineRefs),executionId:'',executionVersion:'',executionHash:'',submissionState:'INCOMPLETE',rows:[{criterionId:'',testId:'',reason:''}],risks:'',rollback:''};}
/** 화면 입력도 기존 제출 parser를 거친 수행자 주장이다. 실행·시험 evidence를 생성하지 않는다. */
export async function prepareManualResultReport(raw:ManualResultReport,a:ConfirmedAssignmentView,s:DocumentSession,generation:number){
 const d=structuredClone(raw);
 if(d.projectId!==a.projectId||d.ownerUserId!==s.user.id||d.ownerClientId!==s.clientId||!same(d.assignmentRef,a.ref)||!same(d.baselineRefs,a.snapshot.definition.baselineRefs)||!['INCOMPLETE','BLOCKED','CANCELLED'].includes(d.submissionState)||!Array.isArray(d.rows)||d.rows.length<1||d.rows.length>200||typeof d.risks!=='string'||typeof d.rollback!=='string'||!d.rollback.trim()||!/^\d{1,16}$/.test(d.executionVersion))fail();
 const executionRef={id:d.executionId,version:Number(d.executionVersion),contentHash:d.executionHash};
 const versioned=(r:ManualReportedCommand['profile'])=>{if(!r||Object.keys(r).sort().join(',')!=='contentHash,id,version'||typeof r.id!=='string'||typeof r.contentHash!=='string'||typeof r.version!=='string'||! /^[1-9][0-9]{0,15}$/.test(r.version))fail();return{...r,version:Number(r.version)};};
 const evidenceEntries=(value:ManualReportedEvidence[]|undefined)=>{const raw=value===undefined?[]:value;if(!Array.isArray(raw)||raw.length>20)fail();return raw.map(e=>{if(!e||Object.keys(e).sort().join(',')!=='contentHash,environmentRef,recordedAt,ref,sourceKind')fail();return{...e,ref:versioned(e.ref),environmentRef:versioned(e.environmentRef)};});};
 const rawCommands=d.commands===undefined?[]:d.commands;
 if(!Array.isArray(rawCommands)||rawCommands.length>200)fail();
 const commandResults=rawCommands.map(c=>{
  if(!c||Object.keys(c).sort().join(',')!==['argv','cwd','exitCode','finishedAt','host','profile','startedAt',...(Object.hasOwn(c,'output')?['output']:[]),...(Object.hasOwn(c,'evidence')?['evidence']:[])].sort().join(',')||!['argv','startedAt','finishedAt','exitCode'].every(k=>typeof c[k as keyof ManualReportedCommand]==='string'))fail();
  if(c.exitCode!==''&&!/^(0|[1-9][0-9]{0,15})$/.test(c.exitCode))fail();
  return{profileRef:versioned(c.profile),cwdRef:versioned(c.cwd),hostRef:versioned(c.host),executionRef:{...executionRef},argv:c.argv===''?[]:c.argv.split(/\r?\n/),startedAt:c.startedAt===''?null:c.startedAt,finishedAt:c.finishedAt===''?null:c.finishedAt,exitCode:c.exitCode===''?null:Number(c.exitCode),outputRef:c.output===null||c.output===undefined?null:versioned(c.output),evidence:evidenceEntries(c.evidence)};
 });
 const tests=d.tests===undefined?[]:d.tests;
 if(!Array.isArray(tests)||tests.length>200||tests.some(t=>!t||Object.keys(t).sort().join(',')!==['actual','criterionId','expected','status','testId',...(Object.hasOwn(t,'evidence')?['evidence']:[])].sort().join(',')))fail();
 const testResults=tests.map(({evidence,...t})=>({...t,baselineRefs:structuredClone(d.baselineRefs),evidence:evidenceEntries(evidence)}));
 const rawChanges=d.changes===undefined?[]:d.changes;
 if(!Array.isArray(rawChanges)||rawChanges.length>200||rawChanges.some(c=>!c||Object.keys(c).sort().join(',')!==['afterHash','beforeHash','kind','path',...(Object.hasOwn(c,'diff')?['diff']:[])].sort().join(',')||typeof c.beforeHash!=='string'||typeof c.afterHash!=='string'))fail();
 const changes=rawChanges.map(({diff,...c})=>({...c,beforeHash:c.beforeHash===''?null:c.beforeHash,afterHash:c.afterHash===''?null:c.afterHash,diffRef:diff==null?null:versioned(diff)}));
 const rawArtifacts=d.artifacts===undefined?[]:d.artifacts;
 if(!Array.isArray(rawArtifacts)||rawArtifacts.length>200)fail();
 const artifactRefs=rawArtifacts.map(r=>{if(!r||Object.keys(r).sort().join(',')!=='contentHash,id,version'||typeof r.id!=='string'||typeof r.contentHash!=='string'||typeof r.version!=='string'||! /^[1-9][0-9]{0,15}$/.test(r.version))fail();return{...r,version:Number(r.version)};});
 const manifest={assignmentRef:d.assignmentRef,executionRef,baselineRefs:d.baselineRefs,submissionState:d.submissionState,changes,commandResults,testResults,artifactRefs,unexecuted:d.rows,risks:d.risks.trim()?[d.risks]:[],rollback:d.rollback,checkpointRef:null};
 return prepareResultSubmissionFile(new TextEncoder().encode(JSON.stringify({scope:{projectId:d.projectId,assignmentRef:d.assignmentRef,executionRef},manifest})),a.projectId,a.ref,s,generation);
}
