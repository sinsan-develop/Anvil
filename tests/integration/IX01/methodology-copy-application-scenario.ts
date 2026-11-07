import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {buildApp} from '../../../apps/server/app.ts';
import type {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import type {DraftCreate,ProjectCreate} from '../../../apps/server/modules/projects/repository.ts';
import {methodContentReviewCriteria} from '../../../apps/server/modules/methodologies/content-review.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {VersionRef} from '../../../contracts/generated-types.ts';
import type {MethodologyGraph} from '../../../contracts/methodologies.ts';
import {isVersionRef} from '../../../contracts/references.ts';

type Session=Awaited<ReturnType<AccessRepository['reauthenticate']>>;
type Json=Record<string,unknown>;
const builtinId='a6f20000-0000-4000-8000-000000000001';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface MethodologyCopyApplicationContext{
  app:ReturnType<typeof buildApp>;
  session:Pick<Session,'token'|'csrfToken'|'clientId'|'user'>;
  origin:string;
  assertCurrent:()=>void;
}

function record(value:unknown,stage:string):Json{
  assert.ok(value!==null&&typeof value==='object'&&!Array.isArray(value),stage);
  return value as Json;
}
function versionRef(value:unknown,stage:string):VersionRef{
  assert.ok(isVersionRef(value),stage);return value;
}
function same(actual:unknown,expected:unknown,stage:string){
  let equal=false;
  try{equal=canonicalJson(actual)===canonicalJson(expected);}catch{throw Error(stage);}
  assert.ok(equal,stage);
}
function hash(value:unknown,stage:string){
  try{return contentHash(canonicalJson(value));}catch{throw Error(stage);}
}
function graphOf(view:Json,ref:VersionRef,stage:string):MethodologyGraph{
  const graph=record(view.graph,stage),nodes=graph.nodes;
  assert.ok(Array.isArray(nodes)&&nodes.length>0&&Array.isArray(graph.edges),stage);
  const first=record(nodes[0],stage),position=record(first.position,stage);
  assert.ok(typeof position.x==='number'&&Number.isSafeInteger(position.x),stage);
  assert.ok(hash(graph,stage)===ref.contentHash,stage);
  assert.ok(record(view.validation,stage).validForConfirmation===true,stage);
  return graph as unknown as MethodologyGraph;
}
function reviewRefs(view:Json,stage:string):unknown[]{
  assert.ok(Array.isArray(view.contentReviews),stage);
  return view.contentReviews.map(item=>record(item,stage).ref);
}

/** 호출자가 승인된 현재 격리 앱과 재인증 세션을 준비한다. 이 모듈은 자동 실행하거나 자원을 소유하지 않는다. */
export async function runMethodologyCopyApplicationScenario({app,session,origin,assertCurrent}:MethodologyCopyApplicationContext){
  assertCurrent();
  const url=URL.parse(origin);
  assert.ok(url?.protocol==='https:'&&url.origin===origin,'TC01_ORIGIN');
  const actorId=session.user.id,clientId=session.clientId;
  assert.ok(uuid.test(actorId)&&uuid.test(clientId)&&/^[A-Za-z0-9_-]{43}$/.test(session.token)&&/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken),'TC01_SESSION_SHAPE');
  const headers={host:url.host,origin,cookie:'__Host-anvil.sid='+session.token,'x-anvil-csrf':session.csrfToken};

  async function request(stage:string,status:number,path:string,payload?:object):Promise<Json>{
    assertCurrent();
    let response:Awaited<ReturnType<typeof app.inject>>;
    try{
      response=payload===undefined
        ?await app.inject({method:'GET',url:path,headers})
        :await app.inject({method:'POST',url:path,headers:{...headers,'content-type':'application/json'},payload});
    }catch{throw Error(stage+'_REQUEST_FAILED');}
    assertCurrent();
    assert.ok(response.statusCode===status,stage+'_HTTP_STATUS');
    assert.ok(Buffer.byteLength(response.body)<=2*1024*1024,stage+'_RESPONSE_SIZE');
    let result:unknown;
    try{result=response.json();}catch{throw Error(stage+'_RESPONSE_JSON');}
    return record(result,stage+'_RESPONSE_SHAPE');
  }
  const getMethod=(id:string,version:number,stage:string)=>request(stage,200,'/api/v1/methodologies/'+id+'/versions/'+version);
  const command=(operation:'copyMethodology'|'saveMethodologyDraft'|'recordContentReview'|'confirmMethodology',targetId:string|null,expectedVersion:number,payload:object)=>
    ({schemaVersion:1,commandId:randomUUID(),clientId,operation,targetId,expectedVersion,payload});
  async function send(stage:string,body:ReturnType<typeof command>,dataStatus:string,version:number){
    const result=await request(stage,200,'/api/v1/user-common/commands',body),data=record(result.data,stage+'_DATA');
    const ref=versionRef(data.ref,stage+'_REF');
    assert.ok(result.scopeKind==='USER_COMMON'&&result.ownerUserId===actorId&&result.status==='APPLIED'&&result.commandId===body.commandId
      &&result.targetId===ref.id&&result.version===version&&ref.version===version&&data.status===dataStatus,stage+'_RECEIPT');
    if(body.targetId!==null)assert.ok(ref.id===body.targetId,stage+'_TARGET');
    return {data,ref};
  }
  async function review(ref:VersionRef,stage:string){
    const {data,ref:target}=await send(stage,command('recordContentReview',ref.id,ref.version,{
      targetKind:'METHODOLOGY',targetRef:ref,criteriaVersion:1,outcome:'ACCEPTED',reason:'방법론 원문과 범위를 대조한 합성 검토',
      items:methodContentReviewCriteria.items.map(({criterionId})=>({criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'해당 버전의 원문을 직접 대조'})),
    }),'REVIEW_RECORDED',ref.version);
    same(target,ref,stage+'_TARGET_REF');
    const selected=record(data.reviewRef,stage+'_REVIEW_REF');
    assert.ok(typeof selected.id==='string'&&uuid.test(selected.id),stage+'_REVIEW_ID');
    same(selected,{id:selected.id,criteriaVersion:1,targetRef:ref,outcome:'ACCEPTED'},stage+'_REVIEW_BINDING');
    return selected;
  }
  function checkMethod(view:Json,ref:VersionRef,graph:MethodologyGraph,provenance:object,stage:string){
    same(view.ref,ref,stage+'_REF');
    same(graphOf(view,ref,stage+'_GRAPH'),graph,stage+'_GRAPH');
    same(view.sourceApproval,provenance,stage+'_PROVENANCE');
    assert.ok(view.scope==='USER_COMMON'&&view.runtimeReadiness==='PROJECT_BINDINGS_REQUIRED',stage+'_SCOPE');
  }

  const builtin=await getMethod(builtinId,2,'TC01_BUILTIN'),builtinRef=versionRef(builtin.ref,'TC01_BUILTIN_REF');
  assert.ok(builtinRef.id===builtinId&&builtinRef.version===2&&builtin.scope==='SYSTEM','TC01_BUILTIN_IDENTITY');
  const originalGraph=graphOf(builtin,builtinRef,'TC01_BUILTIN_GRAPH');
  assert.ok(typeof builtin.purpose==='string'&&builtin.purpose.length>0,'TC01_BUILTIN_PURPOSE');
  const purpose=builtin.purpose,copyName='IX01 TC01 내장 복사 합성본';
  const {ref:v1}=await send('TC01_COPY',command('copyMethodology',null,0,{
    sourceRef:builtinRef,name:copyName,scope:'USER_COMMON',reason:'고정 내장 방법론 복사',
  }),'DRAFT',1);
  assert.ok(v1.id!==builtinRef.id&&v1.contentHash===builtinRef.contentHash,'TC01_COPY_IDENTITY');
  const copied=await getMethod(v1.id,1,'TC01_READ_V1'),copyProvenance={kind:'COPY',parentRef:builtinRef};
  checkMethod(copied,v1,originalGraph,copyProvenance,'TC01_READ_V1');
  assert.ok(copied.name===copyName&&copied.purpose===purpose&&copied.confirmation===null,'TC01_COPY_METADATA');
  const reviewV1=await review(v1,'TC01_REVIEW_V1');

  const graphV2=structuredClone(originalGraph);graphV2.nodes[0]!.position.x=345;
  assert.ok(hash(graphV2,'TC01_V2_GRAPH_HASH')!==v1.contentHash,'TC01_V2_GRAPH_CHANGED');
  const nameV2='IX01 TC01 적용할 개정본';
  const {ref:v2}=await send('TC01_REVISE_V2',command('saveMethodologyDraft',v1.id,1,{
    name:nameV2,purpose,scope:'USER_COMMON',graph:graphV2,reason:'첫 노드 좌표를 바꾼 합성 개정',
  }),'DRAFT',2);
  const provenanceV2={kind:'REVISION',parentRef:v1};
  const draftV2=await getMethod(v2.id,2,'TC01_READ_V2');
  checkMethod(draftV2,v2,graphV2,provenanceV2,'TC01_READ_V2');
  assert.ok(draftV2.name===nameV2&&draftV2.purpose===purpose&&draftV2.confirmation===null,'TC01_V2_DRAFT');
  const reviewV2=await review(v2,'TC01_REVIEW_V2');
  const rejected=await request('TC01_REJECT_V1_REVIEW',422,'/api/v1/user-common/commands',
    command('confirmMethodology',v2.id,2,{versionRef:v2,reviewRefs:[reviewV1]}));
  assert.ok(rejected.code==='CONTENT_REVIEW_REQUIRED','TC01_REJECT_V1_REVIEW_CODE');
  const stillDraft=await getMethod(v2.id,2,'TC01_AFTER_REJECT_V2');
  checkMethod(stillDraft,v2,graphV2,provenanceV2,'TC01_AFTER_REJECT_V2');
  assert.ok(stillDraft.confirmation===null,'TC01_REJECT_NO_CONFIRMATION');
  same(reviewRefs(stillDraft,'TC01_REJECT_REVIEWS'),[reviewV2],'TC01_REJECT_REVIEWS');
  const confirmed=await send('TC01_CONFIRM_V2',command('confirmMethodology',v2.id,2,{versionRef:v2,reviewRefs:[reviewV2]}),'CONFIRMED',2);
  same(confirmed.ref,v2,'TC01_CONFIRMED_REF');
  const fixedV2=await getMethod(v2.id,2,'TC01_CONFIRMED_V2');
  checkMethod(fixedV2,v2,graphV2,provenanceV2,'TC01_CONFIRMED_V2');
  const confirmation=record(fixedV2.confirmation,'TC01_V2_CONFIRMATION');
  assert.ok(typeof confirmation.id==='string'&&uuid.test(confirmation.id)&&confirmation.id===confirmed.data.confirmationId
    &&confirmation.decision==='CONFIRMED'&&confirmation.decidedBy===actorId,'TC01_V2_CONFIRMATION_BINDING');
  same(confirmation.reviewRefs,[reviewV2],'TC01_V2_CONFIRMATION_REVIEW');

  const selection={kind:'CONFIRMED_REFERENCE',versionRef:v2};
  const draft:DraftCreate={schemaVersion:1,commandId:randomUUID(),clientId,targetId:null,expectedVersion:0,
    name:'IX01 TC01 합성 프로젝트',purpose:'확정한 공통본의 고정 적용',desiredOutcome:'후속 개정에서 적용본 보존',
    sourceMode:'EMPTY',methodologySelection:selection,artifactRefs:[]};
  const drafted=await request('TC01_CREATE_DRAFT',201,'/api/v1/project-drafts',draft);
  const draftId=drafted.draftId;
  assert.ok(typeof draftId==='string'&&uuid.test(draftId)&&drafted.version===1,'TC01_DRAFT_IDENTITY');
  const readDraft=await request('TC01_READ_DRAFT',200,'/api/v1/project-drafts/'+draftId);
  assert.ok(readDraft.draftId===draftId&&readDraft.version===1,'TC01_READ_DRAFT_IDENTITY');
  same(record(readDraft.input,'TC01_DRAFT_INPUT').methodologySelection,selection,'TC01_DRAFT_SELECTION');
  const create:ProjectCreate={schemaVersion:1,commandId:randomUUID(),clientId,draftId,draftVersion:1};
  const created=await request('TC01_CREATE_PROJECT',201,'/api/v1/projects',create);
  const projectId=created.id;
  assert.ok(typeof projectId==='string'&&uuid.test(projectId)&&created.participation==='OWNER','TC01_PROJECT_OWNER');
  const applicationPath='/api/v1/projects/'+projectId+'/methodology-application';
  const before=await request('TC01_READ_APPLICATION',200,applicationPath);
  const snapshot={name:nameV2,purpose,graph:graphV2,sourceRef:v2};
  same(before.snapshot,snapshot,'TC01_APPLICATION_SNAPSHOT');
  const applicationRef=versionRef(before.applicationRef,'TC01_APPLICATION_REF');
  assert.ok(applicationRef.version===1&&applicationRef.contentHash===hash(snapshot,'TC01_APPLICATION_HASH')&&before.projectId===projectId
    &&before.executionState==='NOT_CONNECTED','TC01_APPLICATION_BINDING');
  same(created.currentMethodologyRef,applicationRef,'TC01_CREATED_APPLICATION');
  const {observedAt,...fixedApplication}=before;
  assert.ok(typeof observedAt==='string'&&Number.isFinite(Date.parse(observedAt)),'TC01_APPLICATION_OBSERVED_AT');

  const graphV3=structuredClone(graphV2);graphV3.nodes[0]!.position.x=678;
  const nameV3='IX01 TC01 적용 이후 개정본';
  const {ref:v3}=await send('TC01_REVISE_V3',command('saveMethodologyDraft',v2.id,2,{
    name:nameV3,purpose,scope:'USER_COMMON',graph:graphV3,reason:'프로젝트 적용 이후 별도 합성 개정',
  }),'DRAFT',3);
  assert.ok(v3.contentHash!==v2.contentHash,'TC01_V3_GRAPH_CHANGED');
  const latest=await getMethod(v3.id,3,'TC01_READ_V3');
  checkMethod(latest,v3,graphV3,{kind:'REVISION',parentRef:v2},'TC01_READ_V3');
  assert.ok(latest.name===nameV3&&latest.confirmation===null,'TC01_V3_DRAFT');
  const retained=await getMethod(v2.id,2,'TC01_READ_HISTORICAL_V2');
  checkMethod(retained,v2,graphV2,provenanceV2,'TC01_READ_HISTORICAL_V2');
  same(retained.confirmation,confirmation,'TC01_HISTORICAL_V2_CONFIRMATION');
  const retainedV1=await getMethod(v1.id,1,'TC01_READ_HISTORICAL_V1');
  checkMethod(retainedV1,v1,originalGraph,copyProvenance,'TC01_READ_HISTORICAL_V1');
  same(reviewRefs(retainedV1,'TC01_HISTORICAL_V1_REVIEWS'),[reviewV1],'TC01_HISTORICAL_V1_REVIEWS');
  const {observedAt:later,...after}=await request('TC01_REREAD_APPLICATION',200,applicationPath);
  assert.ok(typeof later==='string'&&Number.isFinite(Date.parse(later)),'TC01_REREAD_OBSERVED_AT');
  same(after,fixedApplication,'TC01_APPLICATION_UNCHANGED');
  return {projectId,builtinRef,v1,v2,v3,applicationRef};
}
