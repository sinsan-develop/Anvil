import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import type {AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import type {ProjectDocuments} from '../../../apps/server/modules/documents/project-documents.ts';
import type {TaskCard} from '../../../apps/server/modules/traceability/work-plan-card.ts';
import {workPlanReviewCriteria} from '../../../apps/server/modules/traceability/work-plan-reviews.ts';
import {ProjectWorkPlans} from '../../../apps/server/modules/traceability/work-plans.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id = (n: number) => `a6f30000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const projectId=id(1),planId=id(2),documentId=id(3),designId=id(4),itemId=id(5);
const actor: AuthenticatedIdentity={actorId:id(6),clientId:id(7),serverOwner:false,credentialGeneration:1,reauthUntil:null};
const at=new Date('2026-11-07T00:00:00.000Z');
const hash=(value:unknown)=>contentHash(canonicalJson(value));

function fixture({designConfirmed=false,acceptedReview=false}={}){
  const designText='# D01 문서 저장 설계',planText='# FN01 문서 저장';
  const documentRef={id:documentId,version:1,contentHash:hash(planText)},designRef={id:designId,version:1,contentHash:hash(designText)};
  const planForm={id:id(8),version:1,contentHash:hash('AF04')},designForm={id:id(9),version:1,contentHash:hash('AF02')};
  const planBody={artifactId:id(10),bytes:Buffer.byteLength(planText),contentHash:contentHash(Buffer.from(planText)),mediaType:'text/markdown;charset=utf-8'};
  const designBody={artifactId:id(11),bytes:Buffer.byteLength(designText),contentHash:contentHash(Buffer.from(designText)),mediaType:'text/markdown;charset=utf-8'};
  const designItem={documentRef:designRef,localCode:'D01',title:'문서 저장 설계',anchor:'line:1'};
  const task:TaskCard={
    taskCode:'FN01',type:'FUNCTION',title:'문서 저장',purpose:'원문을 고정 버전으로 저장',ownerRole:'개발 책임자',
    designRefs:[{kind:'DESIGN_ITEM',id:itemId,versionRef:designRef,localCode:'D01',anchor:'line:1'}],screenRefs:[],
    inputs:['문서 원문'],outputs:['고정 버전'],included:['저장'],excluded:['Agent 실행'],allowedFileRefs:['apps/server/modules/traceability/work-plans.ts'],
    startPrerequisites:[],acceptancePrerequisites:[],steps:['원문 저장 후 조회'],acceptanceCriteria:['원문 일치'],evidenceRequirements:['고정 버전'],
    testCases:(['NORMAL','IMPORTANT_FAILURE','DIRECT_IMPACT'] as const).map((kind,index)=>({id:`TC0${index+1}`,kind,steps:['저장 후 조회'],expected:'입력 계약 유지',environment:'합성'})),
    rollback:'이전 저장본 보존',recoveryNotes:'결과 불명 시 원명령 확인',
  };
  const snapshot={documentRef,designRef,screenReviewRefs:[],tasks:[task],dependencies:[],reason:'고정 설계와 계획 원문 연결',
    issues:[{code:'DESIGN_NOT_CONFIRMED',location:'designRef',message:'초안 저장 당시 설계 미확정'}],relationalProjection:'STORED'};
  const planRef={id:planId,version:1,contentHash:hash(snapshot)};
  const reviewRef={id:id(12),targetRef:planRef,criteriaVersion:1,outcome:'ACCEPTED'};
  const reviewer={kind:'HUMAN',userId:actor.actorId,sameAsTargetRecorder:true};
  const items=workPlanReviewCriteria.items.map(({criterionId})=>({criterionId,outcome:'ACCEPTED',evidenceRefs:[],reason:'계획 원문과 직접 대조'}));
  const review={ref:reviewRef,criteria:workPlanReviewCriteria,items,reviewer,sourceKind:'HUMAN_REVIEW',reason:'합성 계획 내용 검토',reviewedAt:at.toISOString()};
  const reviewRow={id:reviewRef.id,criteria_version:1,items_json:items,outcome:reviewRef.outcome,reason:review.reason,
    reviewer_user_id:actor.actorId,client_id:actor.clientId,reviewer_subject_ref:reviewer,source_kind:'HUMAN_REVIEW',
    criteria_snapshot_json:workPlanReviewCriteria,created_at:at,server_sequence:1,command_actor:actor.actorId,
    command_client:actor.clientId,command_operation:'recordContentReview',
    command_result:{status:'APPLIED',projectId,targetId:planId,version:1,data:{status:'REVIEW_RECORDED',ref:planRef,reviewRef,review}}};
  const calls:string[]=[],writes:string[]=[];
  const db={
    async query(sql:string,args:unknown[]){
      calls.push(sql);
      if(/^(?:INSERT|UPDATE|DELETE)\b/i.test(sql)){writes.push(sql);throw Error('UNEXPECTED_DOMAIN_WRITE');}
      if(sql.startsWith('SELECT p.id,p.archived_at,m.participation FROM anvil.projects')){
        assert.deepEqual(args,[projectId,actor.actorId]);return {rows:[{id:projectId,archived_at:null,participation:'OWNER'}]};
      }
      if(sql.startsWith('SELECT definition_json')){
        if(args[0]===planForm.id){assert.deepEqual(args,[planForm.id,1,planForm.contentHash]);return {rows:[{code:'AF04'}]};}
        assert.deepEqual(args,[designForm.id,1,designForm.contentHash]);return {rows:[{code:'AF02'}]};
      }
      if(sql.startsWith('SELECT item_json FROM anvil.design_items')){
        assert.deepEqual(args,[projectId,designId,1]);return {rows:[{item_json:{id:itemId,...designItem,itemHash:hash(designItem)}}]};
      }
      if(sql.startsWith('SELECT s.region_json FROM anvil.screen_regions')){
        assert.deepEqual(args,[projectId,designId,1]);return {rows:[]};
      }
      if(sql.startsWith('SELECT head_version,confirmed_version FROM anvil.documents')){
        assert.ok(args[1]===documentId||args[1]===designId);assert.deepEqual(args,[projectId,args[1]]);
        return {rows:[{head_version:1,confirmed_version:args[1]===documentId||designConfirmed?1:null}]};
      }
      if(sql.includes('FROM anvil.content_reviews r')){
        assert.deepEqual(args,[projectId,planId,1,planRef.contentHash]);return {rows:acceptedReview?[structuredClone(reviewRow)]:[]};
      }
      assert.deepEqual(args,[projectId,planId,1]);
      if(sql.startsWith('SELECT w.head_version,w.confirmed_version,v.created_by'))return {rows:[{head_version:1,confirmed_version:null,created_by:actor.actorId}]};
      if(sql.startsWith('SELECT content_hash,version_json FROM anvil.work_plan_versions'))return {rows:[{content_hash:planRef.contentHash,version_json:{ref:planRef,status:'DRAFT',...snapshot}}]};
      if(sql.startsWith('SELECT task_code,card_json,card_hash FROM anvil.plan_tasks'))return {rows:[{task_code:task.taskCode,card_json:task,card_hash:hash(task)}]};
      if(sql.startsWith('SELECT task_code,dependency_task_code,phase FROM anvil.plan_dependencies')||sql.includes('FROM anvil.work_plan_confirmations f'))return {rows:[]};
      throw Error(`UNEXPECTED_SQL ${sql}`);
    },
  } as unknown as PoolClient;
  // 문서 조회와 원문 바이트 공급만 합성 포트다. 계획/설계 인덱스/검토 원장 해시 검산은 제품 메서드를 실행한다.
  const documents={
    async version(tx:PoolClient,subject:AuthenticatedIdentity,pid:string,document:string,version:number){
      assert.equal(tx,db);assert.equal(subject,actor);assert.equal(pid,projectId);assert.equal(version,1);
      assert.ok(document===documentId||document===designId);
      const isPlan=document===documentId,confirmed=isPlan||designConfirmed;
      return {contentHash:isPlan?documentRef.contentHash:designRef.contentHash,formRef:isPlan?planForm:designForm,
        content:{body:isPlan?planBody:designBody},confirmed,validation:{validForConfirmation:true},contentReviews:[{ref:{outcome:'ACCEPTED'}}]};
    },
    async originalText(tx:PoolClient,pid:string,body:typeof planBody){
      assert.equal(tx,db);assert.equal(pid,projectId);
      if(body.artifactId===planBody.artifactId){assert.deepEqual(body,planBody);return planText;}
      assert.deepEqual(body,designBody);return designText;
    },
  } as unknown as ProjectDocuments;
  const plans=new ProjectWorkPlans(documents),policyRef={id:id(13),version:1,contentHash:hash('정책 참조')};
  const confirm=(payload:ProjectCommand['payload'])=>plans.confirm(db,actor,{schemaVersion:1,projectId,commandId:id(14),clientId:actor.clientId,
    controlGeneration:1,operation:'confirmWorkPlan',targetId:planId,expectedVersion:1,baselineRefs:[],approvalRef:null,payload},policyRef);
  const decision=()=>plans.decision(db,actor,projectId,planId,1);
  return {calls,writes,planRef,reviewRef,confirm,decision};
}

test('IX01 과거 versionRef 확정 요청은 자료 조회나 쓰기 전에 정확 입력 오류로 거절한다',async()=>{
  const model=fixture();
  await assert.rejects(model.confirm({versionRef:model.planRef,reviewRefs:[]}),{message:'WORK_PLAN_CONFIRMATION_INPUT_INVALID',statusCode:422});
  assert.deepEqual(model.calls,[]);assert.deepEqual(model.writes,[]);
});
test('IX01 정확 planRef라도 계획 내용검토가 없으면 준비 검산과 쓰기 전에 거절한다',async()=>{
  const model=fixture();
  await assert.rejects(model.confirm({planRef:model.planRef,reviewRefs:[]}),{message:'CONTENT_REVIEW_REQUIRED',statusCode:422});
  assert.ok(model.calls.some(sql=>sql.includes('FROM anvil.content_reviews r')));
  assert.ok(!model.calls.some(sql=>sql.startsWith('SELECT head_version,confirmed_version FROM anvil.documents')));
  assert.deepEqual(model.writes,[]);
});
test('IX01 최신 적합 계획 검토 뒤 미확정 설계만 남으면 유일한 준비 문제로 확정을 차단한다',async()=>{
  const model=fixture({acceptedReview:true});
  const result=await model.decision();
  assert.deepEqual(result.planRef,model.planRef);
  assert.deepEqual(result.contentReviews.map(review=>review.ref),[model.reviewRef]);
  assert.equal(result.validation.validForConfirmation,false);
  assert.deepEqual(result.validation.issues.map(({code,location})=>({code,location})),[{code:'DESIGN_NOT_READY',location:'designRef'}]);
  await assert.rejects(model.confirm({planRef:model.planRef,reviewRefs:[model.reviewRef]}),{message:'WORK_PLAN_NOT_READY',statusCode:422});
  assert.deepEqual(model.writes,[]);
});
test('IX01 동일 자료의 현재 설계 확정이 확인되면 준비 판정만 참으로 바뀐다',async()=>{
  const model=fixture({designConfirmed:true,acceptedReview:true});
  const result=await model.decision();
  assert.deepEqual(result.contentReviews.map(review=>review.ref),[model.reviewRef]);
  assert.equal(result.validation.validForConfirmation,true);
  assert.deepEqual(result.validation.issues,[]);
  assert.equal(result.confirmation,null);
  assert.equal(result.currentConfirmationValid,false);
  assert.equal(result.activatedAsBaseline,false);
  assert.deepEqual(model.writes,[]);
});
