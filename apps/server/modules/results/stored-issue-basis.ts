import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,isoV1,hashV1,arrayV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSubmittedResultRecord} from './result-submission-store.ts';
import {classifyExecutionIssue} from './execution-issues.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const flags=['actualProviderObserved','currentAuthorizationVerified','completionAccepted','formalFailureCounted','writerReleaseVerified','executionAuthorized','dispatchPerformed'];
const sequence=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=10000;
function fail():never{throw Error('STORED_ISSUE_BASIS_INVALID');}
/** 같은 HUMAN tx의 기존 원제출/전체원장 검증 reader 출력만 조립한다. HTTP 입력용 검증기가 아니다.
 * 표시 items는 최근20개이므로 공백을 다시 계산하지 않는다. 원 reader의 전체 ACK 검증이 필수다.
 * 공급자 주장은 reports/current fact가 아니며 원인/완료/실패집계나 실행을 만들지 않는다. */
export function prepareStoredIssueBasis(rawResult:unknown,rawJournal:unknown,asOf:string){
 try{
  const r=cloneV1(rawResult),j=cloneV1(rawJournal);if(!recordV1(r,['ref','snapshot']))fail();const scope=r.snapshot?.scope;
  if(!isoV1(asOf)||!recordV1(scope,['projectId','assignmentRef','executionRef'])||!uuidV1(scope.projectId)||!refV1(scope.assignmentRef)||!refV1(scope.executionRef))fail();
  const result=readSubmittedResultRecord(r,{projectId:scope.projectId,assignmentRef:scope.assignmentRef,executionRef:scope.executionRef},r.ref?.id,asOf);
  if(!recordV1(j,['projectId','resultRef','executionRef','transport','sourceState','ledgerValidation','items','storedCount','hasMore','ack','localSequence','localSequenceState',...flags,'observedAt'])||j.projectId!==scope.projectId||!same(j.resultRef,result.ref)||!same(j.executionRef,scope.executionRef)||j.transport!=='SYNTHETIC_ONLY'||j.sourceState!=='SERVER_STORED_SYNTHETIC_CLAIMS_ONLY'||j.ledgerValidation!=='HASH_SEQUENCE_ACK_ONLY'||flags.some(k=>j[k]!==false)||j.localSequence!==null||j.localSequenceState!=='NOT_OBSERVED'||!isoV1(j.observedAt)||Date.parse(j.observedAt)>Date.parse(asOf)||Date.parse(j.observedAt)<Date.parse(result.snapshot.submittedAt)||!sequence(j.storedCount)||!arrayV1(j.items,20)||j.items.length!==Math.min(j.storedCount,20)||j.hasMore!==(j.storedCount>20)||Buffer.byteLength(canonicalJson({result,journal:j}))>2*1024*1024)fail();
  const execution={projectId:scope.projectId,executionId:scope.executionRef.id,executionGeneration:scope.executionRef.version};
  let prior=10001;const ids=new Set<string>();
  for(const entry of j.items){const q=entry?.snapshot,e=q?.event;if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||entry.ref.version!==1||entry.ref.contentHash!==hash(q)||ids.has(entry.ref.id)||!recordV1(q,['event','grantRef','credentialGeneration','mode','receivedAt','transport','verification'])||q.transport!=='SYNTHETIC_ONLY'||q.verification!=='PROVIDER_CLAIM_ONLY'||!isoV1(q.receivedAt)||Date.parse(q.receivedAt)>Date.parse(j.observedAt)||!same({projectId:e?.projectId,executionId:e?.executionId,executionGeneration:e?.executionGeneration},execution)||!sequence(e?.sequence)||e.sequence<1||e.sequence>=prior)fail();ids.add(entry.ref.id);prior=e.sequence;}
  let ackRef=null,gaps:{from:number;to:number;evidenceRef:typeof result.ref}[]=[];
  if(j.ack===null){if(j.storedCount!==0)fail();}
  else{const a=j.ack,q=a?.snapshot;if(!recordV1(a,['ref','snapshot'])||!refV1(a.ref)||a.ref.contentHash!==hash(q)||!recordV1(q,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])||!same(q.execution,execution)||!sequence(q.highestContiguous)||!sequence(q.maxSequence)||q.highestContiguous>q.maxSequence||q.storedCount!==j.storedCount||q.storedCount>q.maxSequence||!hashV1(q.contiguousDigest)||!arrayV1(q.gaps,100)||!isoV1(q.recordedAt)||Date.parse(q.recordedAt)>Date.parse(j.observedAt)||['writerReleaseVerified','executionAuthorized','dispatchPerformed'].some(k=>q[k]!==false)||j.items.length&&j.items[0].snapshot.event.sequence!==q.maxSequence)fail();
   let end=-1,missing=0;for(const gap of q.gaps){if(!recordV1(gap,['from','to'])||!sequence(gap.from)||!sequence(gap.to)||gap.from<1||gap.to<gap.from||gap.to>=q.maxSequence||gap.from<=end+1)fail();missing+=gap.to-gap.from+1;end=gap.to;}
   if(missing!==q.maxSequence-q.storedCount||q.highestContiguous!==(q.gaps[0]?q.gaps[0].from-1:q.maxSequence)||j.items.some(e=>q.gaps.some((g:{from:number;to:number})=>e.snapshot.event.sequence>=g.from&&e.snapshot.event.sequence<=g.to)))fail();
   ackRef=cloneV1(a.ref);gaps=q.gaps.map(g=>({...g,evidenceRef:cloneV1(a.ref)}));
  }
  const classification=classifyExecutionIssue({transport:'SYNTHETIC_ONLY',scope,asOf,reports:[],observationGaps:gaps,resultAssessment:null});
  if(!classification||!['OBSERVATION_GAP','UNVERIFIED_CAUSE'].includes(classification.kind))fail();
  const value={purpose:'STORED_ISSUE_BASIS_ONLY' as const,projectId:scope.projectId,resultRef:result.ref,assignmentRef:scope.assignmentRef,executionRef:scope.executionRef,ackRef,ack:j.ack,observationGaps:gaps,sourceAssurance:'SERVER_STORED_SYNTHETIC_CLAIMS_ONLY' as const,journalObservedAt:j.observedAt,asOf,classification,causeUnestablished:true as const,actualProviderObserved:false as const,currentAuthorizationVerified:false as const,completionAccepted:false as const,formalFailureCounted:false as const,writerReleaseVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  if(Buffer.byteLength(canonicalJson(value))>2*1024*1024)fail();return cloneV1(value);
 }catch{return fail();}
}
