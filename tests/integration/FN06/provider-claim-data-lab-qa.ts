/** 새 폐기형 DB 원자성 시험 전용. schema-only 시험의 성공/권한 증거를 반복 생성하지 않는다. */
import assert from 'node:assert/strict';
import {providerClaimLab,providerClaimLabSchema} from './provider-claim-schema-qa.ts';
export {runProviderClaimLabCleanup} from './provider-claim-schema-qa.ts';
export const providerClaimDataLab=Object.freeze({...providerClaimLab,root:'/home/daon/deploy/anvil-v3-fn06-claim-data-qa-01',pg:'anvil-v3-fn06-claim-data-pg-01',net:'anvil-v3-fn06-claim-data-net-01',database:'anvil_v3_fn06_claim_data_qa_01',owner:'AV3_FN06_CLAIM_DATA_QA'});
export const providerClaimDataLabSchema=providerClaimLabSchema;
export function readClaimDataQaCase(value:unknown):'ATOMIC'|'HISTORY_READ'{if(value===undefined)return'ATOMIC';assert(value==='ATOMIC'||value==='HISTORY_READ','CLAIM_DATA_QA_CASE_INVALID');return value;}
export function validateProviderClaimDataQa(v:{cwd:string;sha:string;expires:number;now:number;env:NodeJS.ProcessEnv}){
 readClaimDataQaCase(v.env.ANVIL_FN06_CLAIM_DATA_CASE);
 assert.equal(v.cwd,providerClaimDataLab.root);assert.match(v.sha,/^[a-f0-9]{40}$/);assert.equal(v.env.ANVIL_FN06_CLAIM_DATA_QA,'1');assert(Number.isFinite(v.now)&&Number.isFinite(v.expires)&&v.expires>v.now+60000&&v.expires<=v.now+providerClaimDataLab.maxMs);
 assert(!Object.entries(v.env).some(([k,x])=>x&&(k.startsWith('PG')||k.startsWith('DOCKER_')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(k))));assert(!Object.entries(v.env).some(([k,x])=>x==='1'&&/^ANVIL_FN\d+_.*QA$/.test(k)&&k!=='ANVIL_FN06_CLAIM_DATA_QA'));
}
export function assertProviderClaimDataContainer(v:any,id:string,instance:string,network:string){
 const q=providerClaimDataLab;assert.match(id,/^[a-f0-9]{64}$/);assert.match(instance,/^[a-f0-9]{32}$/);assert.match(network,/^[a-f0-9]{64}$/);assert.equal(v.Id,id);assert.equal(v.Name,'/'+q.pg);assert.equal(v.Image,q.imageId);assert.equal(v.Config?.Labels?.['anvil.owner'],q.owner);assert.equal(v.Config?.Labels?.['anvil.instance'],instance);assert.deepEqual(v.Mounts,[]);assert.deepEqual(v.HostConfig?.PortBindings,{});assert.equal(v.HostConfig?.PublishAllPorts,false);assert.deepEqual(v.HostConfig?.Tmpfs,{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'});assert.deepEqual(Object.keys(v.NetworkSettings?.Networks??{}),[q.net]);assert.equal(v.NetworkSettings.Networks[q.net].NetworkID,network);assert.deepEqual(v.NetworkSettings.Ports,{'5432/tcp':null});
}
/** child stdout/stderr나 assertion 원문은 반환하지 않는다. 고정 safe summary의 성공만 채택한다. */
export function readClaimDataChildSummary(output:string,rawCase:unknown=undefined){
 const selected=readClaimDataQaCase(rawCase),required=selected==='ATOMIC'?['FN06_NORMAL_REGISTRATION_RESERVATION_SIGNED_START','FN06_CLAIM_COMMIT_DISTINCT_READ_SAME_NEW_PROOF_ATOMIC_ROLLBACK','EXPLICIT_SYNTHETIC_SOURCE_OS_NO_ACTUAL_PROVIDER']:['FN06_NORMAL_REGISTRATION_RESERVATION_SIGNED_START','FN06_OWNER_HISTORY_LIST_RECEIPT_SAME_ORIGIN','FN06_HISTORY_OUTSIDER_NOCOOKIE_DENIED','FN06_HISTORY_GET_NO_LEDGER_WRITE','EXPLICIT_SYNTHETIC_SOURCE_OS_NO_ACTUAL_PROVIDER'];
 const lines=output.split(/\r?\n/).filter(l=>l.startsWith('FN12_ISOLATED_SAFE '));assert.equal(lines.length,1,'CLAIM_DATA_QA_SAFE_SUMMARY_REQUIRED');
 let v:any;try{v=JSON.parse(lines[0]!.slice('FN12_ISOLATED_SAFE '.length));}catch{throw Error('CLAIM_DATA_QA_SAFE_SUMMARY_INVALID');}
 assert(v&&v.phase==='DONE'&&v.failure===null&&v.closeFailures===0&&v.rootCleanupFailed===false&&Number.isSafeInteger(v.rootCleanup?.files)&&v.rootCleanup.files>=0&&Number.isSafeInteger(v.rootCleanup?.dirs)&&v.rootCleanup.dirs>=1&&Array.isArray(v.cases)&&required.every(c=>v.cases.includes(c)),'CLAIM_DATA_QA_CHILD_NOT_COMPLETE');
 return{phase:'DONE',cases:v.cases.filter((c:unknown)=>typeof c==='string'&&/^[A-Z0-9_]{1,96}$/.test(c)),failure:null,rootCleanup:{files:v.rootCleanup.files,dirs:v.rootCleanup.dirs},closeFailures:0,rootCleanupFailed:false};
}

/** 실패 원문은 전달하지 않는다. 원 fixture가 정리 때 남긴 상수 코드와 수치만 채택한다. */
export function readClaimDataChildFailure(output:string):Record<string,unknown>{
 try{
  const lines=output.split(/\r?\n/).map(l=>l.startsWith('# ')?l.slice(2):l).filter(l=>l.startsWith('FN12_ISOLATED_SAFE '));
  if(lines.length!==1)return{phase:'SAFE_SUMMARY_UNAVAILABLE'};
  const v=JSON.parse(lines[0]!.slice('FN12_ISOLATED_SAFE '.length)),f=v?.failure;
  const phases=['TARGET','CATALOG_SEED','SEED','AUTH','CONFIRMED_DOCUMENTS','CONFIRMED_PLAN','ASSIGNMENT_DRAFT','CONFIRMED_ASSIGNMENT','FN06_CLAIM_DATA','DONE'];
  const messages=['CLAIM_QA_TRUST_PREREQUISITE_REFUSED','CLAIM_QA_TRUST_CREATED_INVALID','CLAIM_QA_TRUST_SCOPE_MISMATCH','CLAIM_QA_TRUST_CHALLENGE_MISMATCH','CLAIM_QA_TRUST_STATUS_REFUSED','CLAIM_QA_TRUST_EXPIRED','CLAIM_QA_SESSION_PREREQUISITE_REFUSED','CLAIM_QA_SESSION_BINDING_MISMATCH','CLAIM_QA_SESSION_PREREQUISITE_READ_REFUSED','CLAIM_DATA_QA_NORMAL_PREREQUISITE_REFUSED','CLAIM_DATA_QA_POLICY_REFUSED','CLAIM_DATA_QA_BINDING_MISMATCH','CLAIM_DATA_QA_CURRENT_WRITER_REQUIRED','CLAIM_DATA_QA_WRITER_SCOPE_MISMATCH','CLAIM_DATA_QA_DB_CLOCK_REQUIRED','CLAIM_DATA_QA_EXPLICIT_READ_SCOPE_REQUIRED','CLAIM_DATA_QA_EXPIRED','FN12_QA_EXPIRED','INPUT_INVALID','AUTHENTICATED_PERMIT_REJECTED','PROVIDER_SESSION_CLAIM_REJECTED','PROVIDER_SESSION_CLAIM_INVALID','PROVIDER_SESSION_CLAIM_STORAGE_UNAVAILABLE'];
  const states=['42501','23505','23503','23514','23502','40001','40P01','42601','42P01','42703','P0001','57014','ERR_ASSERTION'];
  const responses=['POLICY_DENIED','POLICY_REQUIRED','POLICY_NOT_FOUND','FORBIDDEN','AUTHENTICATION_REQUIRED','UNAUTHENTICATED','REAUTH_REQUIRED','PRECONDITION_FAILED','INPUT_INVALID','VALIDATION_FAILED','STORAGE_FAILED','VERSION_CONFLICT','NOT_FOUND'];
  messages.push('CLAIM_OWNER_SESSION_LEDGER_LOCK_FORBIDDEN','CLAIM_OWNER_READ_EXPECTED_SUCCESS','CLAIM_OWNER_READ_POOL_MISMATCH');
  const known=(s:unknown,allowed:string[])=>typeof s==='string'&&allowed.includes(s)?s:null,num=(n:unknown,max=599)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max?n:null;
  const diagnostic=safeLocation(f?.diagnostic);
  return{phase:known(v?.phase,phases)??'SAFE_SUMMARY_UNAVAILABLE',messageCode:known(f?.messageCode,messages),code:known(f?.code,states),lastResponseCode:known(f?.lastResponseCode,responses),expected:num(f?.expected),actual:num(f?.actual),closeFailures:num(v?.closeFailures,3),rootCleanupFailed:typeof v?.rootCleanupFailed==='boolean'?v.rootCleanupFailed:null,...(diagnostic?{diagnostic}:{})};
 }catch{return{phase:'SAFE_SUMMARY_UNAVAILABLE'};}
}

const sourceUnits=[
 ['tests/integration/FN06/provider-claim-owner-read-qa.ts','QA_OWNER_READ'],
 ['apps/web/src/features/workspace/provider-claim-receipt-api.ts','WEB_CLAIM_READER'],
 ['tests/integration/FN06/provider-claim-data-case-qa.ts','QA_CALLER'],
 ['tests/integration/FN06/provider-claim-fixture-qa.ts','QA_SESSION'],
 ['tests/integration/FN06/provider-claim-trust-qa.ts','QA_TRUST'],
 ['tests/integration/FN06/provider-claim-persistence-qa.ts','QA_PERSISTENCE'],
 ['apps/server/modules/access/project-command.ts','PROJECT_POLICY'],
 ['apps/server/modules/access/repository.ts','AUTH_REPOSITORY'],
 ['apps/server/modules/executions/runtime-policy.ts','LIMIT_POLICY'],
 ['apps/server/modules/executions/execution-commands.ts','EXECUTION_QUEUE'],
 ['apps/server/modules/executions/execution-challenge-store.ts','CHALLENGE_STORE'],
 ['apps/server/modules/executions/execution-permits.ts','START_PERMIT'],
 ['apps/server/modules/executions/provider-session-claim-store.ts','CLAIM_STORE'],
 ['contracts/canonical.ts','CANONICAL'],
 ['contracts/runtime/validation-v1.ts','WIRE_VALIDATION']
] as const;
const kinds=['TYPE_ERROR','RANGE_ERROR','SYNTAX_ERROR','ASSERTION_ERROR','OTHER_ERROR'];
function safeLocation(v:any){
 if(!v||!kinds.includes(v.kind)||!Array.isArray(v.locations)||v.locations.length>5)return null;
 if(!v.locations.every((p:any)=>p&&sourceUnits.some(([,unit])=>unit===p.unit)&&[p.line,p.column].every(n=>Number.isSafeInteger(n)&&n>0&&n<=100000)))return null;
 return{kind:v.kind,locations:v.locations.map((p:any)=>({unit:p.unit,line:p.line,column:p.column}))};
}
/** 원 message/stack/path는 반환하지 않고 이 시험에 포함된 고정 source 위치만 추출한다. */
export function readClaimDataQaFailureLocation(error:unknown){
 const kind=error instanceof TypeError?'TYPE_ERROR':error instanceof RangeError?'RANGE_ERROR':error instanceof SyntaxError?'SYNTAX_ERROR':error instanceof assert.AssertionError?'ASSERTION_ERROR':'OTHER_ERROR',locations:Array<{unit:string;line:number;column:number}>=[];
 if(error instanceof Error&&typeof error.stack==='string'){
  for(const frame of error.stack.split(/\r?\n/).slice(1)){
   for(const [file,unit] of sourceUnits){
    const needle=providerClaimDataLab.root+'/'+file+':',index=frame.indexOf(needle);
    if(index<0)continue;const match=/^(\d{1,6}):(\d{1,6})(?:\)|$)/.exec(frame.slice(index+needle.length));
    if(match&&Number(match[1])>0&&Number(match[1])<=100000&&Number(match[2])>0&&Number(match[2])<=100000)locations.push({unit,line:Number(match[1]),column:Number(match[2])});
    break;
   }
   if(locations.length===5)break;
  }
 }
 return{kind,locations};
}
