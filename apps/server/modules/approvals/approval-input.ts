import{AuthFailure}from'../access/repository.ts';
import type{ProjectCommand}from'../access/project-command.ts';
import type{VersionRef}from'../../../../contracts/generated-types.ts';
import{isVersionRef}from'../../../../contracts/references.ts';
import{canonicalJson,contentHash}from'../../../../contracts/canonical.ts';

export interface ApprovalScope{operation:string;targetRef:VersionRef|null;expectedVersion:number;payloadHash:string;baselineRefs:never[];environmentRef:null;sourceScopes:never[];limitsRef:null;requestedSubjectRef:{kind:'HUMAN';userId:string;clientId:string};controlGeneration:number}
export interface ApprovalDetails{reason:string;risks:{data:string;security:string;cost:string;interruption:string;unverified:string};rollback:{method:string;limitations:string;evidenceRefs:never[]};expiresAt:string;actionScope:ApprovalScope;candidateCommandId:string}
export interface ApprovalInputContext{actorId:string;clientId:string;controlGeneration:number;allowedOperations:readonly string[];now:Date}
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const text=(v:unknown)=>typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&v.length<=20_000;
const uuid=(id:unknown)=>isVersionRef({id,version:1,contentHash:'0'.repeat(64)});
const hash=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
/** 범위 구조 검사다. 현재 정책/원문·기한·소비 검사는 같은 저장 transaction의 서버가 별도로 수행한다. */
export function readApprovalDetails(value:unknown,context:ApprovalInputContext):ApprovalDetails{
 if(!exact(value,['reason','risks','rollback','expiresAt','actionScope','candidateCommandId'])||!text(value.reason)||!uuid(value.candidateCommandId)||!exact(value.risks,['data','security','cost','interruption','unverified'])||!Object.values(value.risks).every(text)||!exact(value.rollback,['method','limitations','evidenceRefs'])||!text(value.rollback.method)||!text(value.rollback.limitations)||!Array.isArray(value.rollback.evidenceRefs)||typeof value.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.expiresAt)||!Number.isFinite(Date.parse(value.expiresAt))||new Date(value.expiresAt).toISOString()!==value.expiresAt||Date.parse(value.expiresAt)<=context.now.getTime())throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
 const s=value.actionScope;
 if(!exact(s,['operation','targetRef','expectedVersion','payloadHash','baselineRefs','environmentRef','sourceScopes','limitsRef','requestedSubjectRef','controlGeneration'])||typeof s.operation!=='string'||!context.allowedOperations.includes(s.operation)||!Number.isSafeInteger(s.expectedVersion)||s.expectedVersion<0||!hash(s.payloadHash)||!Array.isArray(s.baselineRefs)||!Array.isArray(s.sourceScopes)||!exact(s.requestedSubjectRef,['kind','userId','clientId'])||s.requestedSubjectRef.kind!=='HUMAN'||s.requestedSubjectRef.userId!==context.actorId||s.requestedSubjectRef.clientId!==context.clientId||!Number.isSafeInteger(s.controlGeneration)||s.controlGeneration<1||s.controlGeneration!==context.controlGeneration||(s.targetRef===null?s.expectedVersion!==0:!isVersionRef(s.targetRef)||s.targetRef.version!==s.expectedVersion))throw new AuthFailure('APPROVAL_INPUT_INVALID',422);
 if(value.rollback.evidenceRefs.length||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null)throw new AuthFailure('APPROVAL_REFERENCE_NOT_CONNECTED',412);
 return structuredClone(value)as ApprovalDetails;
}
/** 주체/기기·기준세대와 exact 후보만 대조한다. 승인 여부/만료 검사를 대체하지 않는다. */
export function assertApprovalCandidate(details:ApprovalDetails,c:ProjectCommand,actorId:string,projectId:string){
 const s=details.actionScope;
 if(c.projectId!==projectId||c.commandId!==details.candidateCommandId||s.requestedSubjectRef.kind!=='HUMAN'||s.requestedSubjectRef.userId!==actorId||s.requestedSubjectRef.clientId!==c.clientId||s.controlGeneration!==c.controlGeneration||s.operation!==c.operation||s.expectedVersion!==c.expectedVersion||(s.targetRef?.id??null)!==c.targetId||canonicalJson(s.baselineRefs)!==canonicalJson(c.baselineRefs)||s.payloadHash!==contentHash(canonicalJson(c.payload)))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
}
