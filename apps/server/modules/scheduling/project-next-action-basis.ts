import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import type {ProjectResultReviews} from '../results/project-result-reviews.ts';
import type {ProjectResultReviewSources} from '../results/project-result-review-sources.ts';
import type {ProjectMethodologies} from '../methodologies/project-methodologies.ts';
import type {MethodologyGraph} from '../../../../contracts/methodologies.ts';
import {validateMethodologyGraph} from '../methodologies/service.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const flagKeys=['completionAccepted','formalFailureCounted','evidenceProvenanceVerified','executionAuthorized','dispatchPerformed'] as const;
function fail(code='NEXT_ACTION_BASIS_INVALID',status=503):never{throw new AuthFailure(code,status);}
type Ports={reviews:Pick<ProjectResultReviews,'read'>;sources:Pick<ProjectResultReviewSources,'read'>;applications:Pick<ProjectMethodologies,'readApplication'>};
/** 기존 인증 transaction 안에서만 사용한다. 저장된 보완/차단 검토의 근거이며 완료 판정·scheduler가 아니다. */
export class ProjectNextActionBasis{
 readonly ports:Ports;
 constructor(ports:Ports){if(typeof ports?.reviews?.read!=='function'||typeof ports.sources?.read!=='function'||typeof ports.applications?.readApplication!=='function')fail();this.ports=ports;}
 async read(db:PoolClient,rawActor:AuthenticatedIdentity,pid:string,id:string){
  if(!uuidV1(pid)||!uuidV1(id))fail('INPUT_INVALID',400);
  const actor=structuredClone(rawActor),session=actor.authSession;
  if(!session||!uuidV1(session.id)||!isoV1(session.idleExpiresAt)||!isoV1(session.absoluteExpiresAt))fail('AUTH_REQUIRED',401);
  const validUntil=new Date(Math.min(Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt))).toISOString();
  const fresh=async()=>{const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail();if(at.getTime()>=Date.parse(validUntil))fail('AUTH_REQUIRED',401);};
  await fresh();await projectMember(db,actor,pid,true);
  const review=cloneV1(await this.ports.reviews.read(db,actor,pid,id)),s=review?.snapshot;
  if(review.projectId!==pid||!refV1(review.ref)||review.ref.id!==id||review.ref.version!==1||hash(s)!==review.ref.contentHash||review.reviewStored!==true||!isoV1(review.observedAt)||s?.scope?.projectId!==pid||!refV1(s?.input?.resultRef)||!['REWORK','BLOCKED'].includes(s.input.outcome)||flagKeys.some(k=>review[k]!==false||s[k]!==false))fail();
  const sources=cloneV1(await this.ports.sources.read(db,actor,pid,s.input.resultRef.id)),r=sources.result,a=sources.assignment,task=a?.snapshot?.definition?.taskRef;
  if(sources.projectId!==pid||!refV1(r?.ref)||!same(r.ref,s.input.resultRef)||hash(r.snapshot)!==r.ref.contentHash||!same(r.snapshot.scope,s.scope)||!same(a?.ref,s.scope.assignmentRef)||a.projectId!==pid||hash(a.snapshot)!==a.ref.contentHash||a.snapshot.contentConfirmed!==true||a.snapshot.ready!==false||a.snapshot.executionAuthorized!==false||a.snapshot.dispatchPerformed!==false||!refV1(task?.applicationRef)||typeof task.nodeId!=='string'||!task.nodeId.trim()||r.snapshot.completionAccepted!==false||r.snapshot.executionAuthorized!==false||r.snapshot.dispatchPerformed!==false)fail();
  const app=cloneV1(await this.ports.applications.readApplication(db,actor,pid));
  if(app.projectId!==pid||!refV1(app.applicationRef)||!same(app.applicationRef,task.applicationRef)||!app.snapshot||hash(app.snapshot)!==app.applicationRef.contentHash||!refV1(app.snapshot.sourceRef)||hash(app.snapshot.graph)!==app.snapshot.sourceRef.contentHash||app.executionState!=='NOT_CONNECTED'||!isoV1(app.observedAt))fail('METHODOLOGY_APPLICATION_CHANGED',409);
  if(validateMethodologyGraph(app.snapshot.graph,[]).issues.some(i=>i.code==='INPUT_INVALID'))fail();
  const nodes=(app.snapshot.graph as MethodologyGraph).nodes.filter(n=>n.nodeId===task.nodeId);if(nodes.length!==1)fail();const node=nodes[0]!;
  const latest=await this.ports.applications.readApplication(db,actor,pid);if(!same(latest.applicationRef,app.applicationRef)||!same(latest.snapshot,app.snapshot))fail('METHODOLOGY_APPLICATION_CHANGED',409);
  await projectMember(db,actor,pid,true);await fresh();
  return{validUntil,basis:{projectId:pid,resultRef:r.ref,reviewRef:review.ref,assignmentRef:a.ref,applicationRef:app.applicationRef,nodeId:node.nodeId,nodeName:node.name,action:s.input.outcome==='REWORK'?'REVIEW_REWORK_FOR_SELECTED_STAGE' as const:'WAIT_HUMAN_UNBLOCK_DECISION' as const,reviewOutcome:s.input.outcome,sourceAssurance:'SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY' as const,resultTransport:r.snapshot.transport,reviewObservedAt:review.observedAt,applicationObservedAt:app.observedAt,reasonCodes:['COMPLETION_NOT_ACCEPTED','RUNTIME_STATE_NOT_VERIFIED','CURRENT_AUTHORITY_BUDGET_NOT_REVALIDATED'],completionAccepted:false as const,runtimeStateVerified:false as const,automaticTransitionPerformed:false as const,executionAuthorized:false as const,dispatchPerformed:false as const}};
 }
}
