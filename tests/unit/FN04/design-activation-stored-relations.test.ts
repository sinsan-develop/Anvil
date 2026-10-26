import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readStoredDesignActivationRelations} from '../../../apps/server/modules/traceability/design-activation-stored-relations.ts';

const ref=(n:number,version=1)=>({id:`a6f40000-0000-4000-8000-${String(n).padStart(12,'0')}`,version,contentHash:'a'.repeat(64)});
const document=(version:number)=>{
  const value={id:ref(1).id,version,title:'승인 설계',formRef:ref(9),stageNodeRef:null,
    content:{body:{artifactId:ref(version+20).id,bytes:12,contentHash:'b'.repeat(64),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[] as {itemId:string;anchor:string}[],sourceRefs:[] as []},
    confirmed:true,validation:{validForConfirmation:true},contentReviews:[{ref:{id:ref(30).id,targetRef:ref(1,version),criteriaVersion:1,outcome:'ACCEPTED'},items:[],reviewer:{},sourceKind:'HUMAN_REVIEW',reason:'검토',reviewedAt:'2026-10-26T00:00:00.000Z',serverSequence:1}]};
  return {...value,contentHash:contentHash(canonicalJson({title:value.title,formRef:value.formRef,stageNodeRef:value.stageNodeRef,content:value.content}))};
};
function fixture(){
  const before=document(1),approved=document(2),approvedRef={id:approved.id,version:approved.version,contentHash:approved.contentHash};
  const beforeRef={id:before.id,version:before.version,contentHash:before.contentHash};
  const input={changeRef:ref(2),impactRef:ref(3,2),approvedDesignRef:approvedRef,confirmedPlanRef:ref(4,3),reason:' 원문 적용 이유\n'};
  const change={ref:input.changeRef,beforeRef,afterProposalRef:ref(5).id};
  const impact={ref:input.impactRef,changeRef:input.changeRef,items:[{kind:'TASK',review:'REQUIRED'}],coverageGaps:[{code:'EXECUTION_NOT_CONNECTED'}],requiresReview:true};
  const record={change,impactVersions:[impact],latestImpactRef:input.impactRef};
  const proposal={id:change.afterProposalRef,baseRef:beforeRef,proposedContent:approved.content,selections:[{documentId:approved.id,version:2,selectedBy:ref(6).id,at:'2026-10-26T00:00:00.000Z'}]};
  const plan={ref:input.confirmedPlanRef,designRef:approvedRef,status:'DRAFT'};
  const decision={planRef:plan.ref,headVersion:3,confirmedVersion:3,currentConfirmationValid:true,
    confirmation:{id:ref(7).id,planRef:plan.ref,reviewRefs:[],validation:{},confirmedBy:{kind:'HUMAN',userId:ref(6).id},confirmedAt:'2026-10-26T00:00:00.000Z'}};
  const calls:string[]=[];
  const readers={
    change:async(id:string)=>{calls.push(`change:${id}`);return record;},
    document:async(id:string,version:number)=>{calls.push(`document:${id}:${version}`);return version===1?before:approved;},
    proposal:async(id:string)=>{calls.push(`proposal:${id}`);return proposal;},
    plan:async(id:string,version:number)=>{calls.push(`plan:${id}:${version}`);return plan;},
    decision:async(id:string,version:number)=>{calls.push(`decision:${id}:${version}`);return decision;}
  };
  return{before,approved,input,change,impact,record,proposal,plan,decision,readers,calls};
}
const conflict=(call:()=>Promise<unknown>)=>assert.rejects(call,(e:unknown)=>e instanceof AuthFailure&&e.statusCode===409&&e.message==='DESIGN_ACTIVATION_RELATION_MISMATCH');

test('FN04 보관 관계는 기존 보호 조회의 정확 참조와 선택·현재 계획확정만 대조하고 원자료를 보존한다',async()=>{
  const f=fixture(),snapshot=structuredClone({input:f.input,record:f.record,proposal:f.proposal,plan:f.plan,decision:f.decision});
  const result=await readStoredDesignActivationRelations(f.input,f.readers);
  assert.deepEqual(result.input,f.input);assert.deepEqual(result.change,f.change);assert.deepEqual(result.impact,f.impact);
  assert.deepEqual(result.approvedDesignVersionFacts,{ref:f.input.approvedDesignRef,confirmed:true,latestReviewOutcome:'ACCEPTED',validForConfirmation:true});
  assert.deepEqual(result.planConfirmationFacts,{planRef:f.plan.ref,headVersion:3,confirmedVersion:3,currentConfirmationValid:true});
  assert.deepEqual(result.unverified,{documentHead:true,baselinePointer:true,approval:true,concurrency:true,writerSafety:true,activation:true});
  assert.deepEqual({input:f.input,record:f.record,proposal:f.proposal,plan:f.plan,decision:f.decision},snapshot);
  assert.equal(f.calls.length,6);assert.equal(JSON.stringify(result).includes('"ready":true'),false);
  for(const key of ['ready','authorized','applied','executionAuthorized','activatedAsBaseline'])assert.equal(Object.hasOwn(result,key),false);
  result.impact.coverageGaps.length=0;assert.equal(f.impact.coverageGaps.length,1);
});

for(const field of ['changeRef','impactRef','approvedDesignRef','confirmedPlanRef'] as const){
  for(const part of ['id','version','contentHash'] as const){
    test(`FN04 ${field}.${part} 변조는 보관 fullref와 다르면 거절한다`,async()=>{
      const f=fixture(),value=structuredClone(f.input);
      if(part==='id')value[field].id=ref(99).id;
      else if(part==='version')value[field].version+=1;
      else value[field].contentHash='f'.repeat(64);
      await conflict(()=>readStoredDesignActivationRelations(value,f.readers));
    });
  }
}

test('FN04 잘못된 payload는 보호 조회 전에 기존 입력 검사로 거절한다',async()=>{
  const f=fixture();await assert.rejects(()=>readStoredDesignActivationRelations({...f.input,approvalRef:null},f.readers),{message:'DESIGN_ACTIVATION_INPUT_INVALID'});assert.deepEqual(f.calls,[]);
});

test('FN04 타 프로젝트·권한 거절은 그대로 전파하며 다른 조회를 계속하지 않는다',async()=>{
  const f=fixture(),error=new AuthFailure('NOT_FOUND',404);
  f.readers.change=async()=>{throw error;};
  await assert.rejects(()=>readStoredDesignActivationRelations(f.input,f.readers),e=>e===error);assert.deepEqual(f.calls,[]);
});

test('FN04 다른 변경의 영향·최신 영향 불일치·조회누락을 거절한다',async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.impact.changeRef=ref(99);},
    (f:ReturnType<typeof fixture>)=>{f.record.latestImpactRef=ref(99);},
    (f:ReturnType<typeof fixture>)=>{f.record.impactVersions=[];},
    (f:ReturnType<typeof fixture>)=>{f.impact.ref=ref(99);}
  ]){const f=fixture();mutate(f);await conflict(()=>readStoredDesignActivationRelations(f.input,f.readers));}
});

test('FN04 원기준과 제안 base·제안 식별·실제 선택 결과가 모두 같아야 한다',async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.proposal.baseRef=ref(99);},
    (f:ReturnType<typeof fixture>)=>{f.proposal.id=ref(99).id;},
    (f:ReturnType<typeof fixture>)=>{f.proposal.selections=[];},
    (f:ReturnType<typeof fixture>)=>{f.proposal.selections.push({...f.proposal.selections[0]!});},
    (f:ReturnType<typeof fixture>)=>{f.proposal.selections[0]!.documentId=ref(99).id;},
    (f:ReturnType<typeof fixture>)=>{f.proposal.selections[0]!.version=3;},
    (f:ReturnType<typeof fixture>)=>{f.before.version=5;},
    (f:ReturnType<typeof fixture>)=>{f.approved.version=3;}
  ]){const f=fixture();mutate(f);await conflict(()=>readStoredDesignActivationRelations(f.input,f.readers));}
});

test('FN04 선택 결과의 제목·form·stage·본문·hash와 제안 내용 변경은 거절한다',async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.approved.title='다른 제목';},
    (f:ReturnType<typeof fixture>)=>{f.approved.formRef=ref(99);},
    (f:ReturnType<typeof fixture>)=>{f.approved.content={...f.approved.content,body:{...f.approved.content.body,contentHash:'c'.repeat(64)}};},
    (f:ReturnType<typeof fixture>)=>{f.approved.contentHash='c'.repeat(64);},
    (f:ReturnType<typeof fixture>)=>{f.proposal.proposedContent={...f.proposal.proposedContent,sections:[{itemId:'다른항목',anchor:'line:1'}]};}
  ]){const f=fixture();mutate(f);await conflict(()=>readStoredDesignActivationRelations(f.input,f.readers));}
  const f=fixture();await conflict(()=>readStoredDesignActivationRelations(f.input,{...f.readers,document:async(id,version)=>({...await f.readers.document(id,version),stageNodeRef:{applicationId:ref(99).id,nodeId:'다른단계'}})}));
});

test('FN04 plan DRAFT는 확정 부정 근거가 아니며 다른 설계·현재 확정 불명·거짓·불일치는 거절한다',async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.plan.designRef=ref(99);},
    (f:ReturnType<typeof fixture>)=>{f.decision.planRef=ref(99);},
    (f:ReturnType<typeof fixture>)=>{f.decision.headVersion=4;},
    (f:ReturnType<typeof fixture>)=>{f.decision.confirmedVersion=2;},
    (f:ReturnType<typeof fixture>)=>{f.decision.currentConfirmationValid=false;},
    (f:ReturnType<typeof fixture>)=>{f.decision.confirmation.planRef=ref(99);}
  ]){const f=fixture();mutate(f);await conflict(()=>readStoredDesignActivationRelations(f.input,f.readers));}
  const f=fixture();await conflict(()=>readStoredDesignActivationRelations(f.input,{...f.readers,decision:async()=>({...f.decision,confirmation:null})}));
});

test('FN04 조회 버전의 확정·최신 검토·확정 검증 미충족을 성공 관계로 돌리지 않는다',async()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.approved.confirmed=false;},
    (f:ReturnType<typeof fixture>)=>{f.approved.contentReviews=[];},
    (f:ReturnType<typeof fixture>)=>{f.approved.contentReviews[0]!.ref.outcome='REWORK';},
    (f:ReturnType<typeof fixture>)=>{f.approved.validation.validForConfirmation=false;}
  ]){const f=fixture();mutate(f);await conflict(()=>readStoredDesignActivationRelations(f.input,f.readers));}
});

test('FN04 빈 영향·gap도 승인·동시성·writer 안전 확인으로 승격하지 않는다',async()=>{
  const f=fixture();f.impact.items=[];f.impact.coverageGaps=[];
  const result=await readStoredDesignActivationRelations(f.input,f.readers);
  assert.deepEqual(result.impact.items,[]);assert.deepEqual(result.impact.coverageGaps,[]);
  assert.equal(result.unverified.writerSafety,true);assert.equal(result.unverified.approval,true);assert.equal(result.unverified.concurrency,true);
});

for(const variant of ['title','form','stage'] as const){
  test(`FN04 ${variant} 관계는 결과 canonical hash·입력·계획 참조가 모두 정합이어도 원기준과 다르면 거절한다`,async()=>{
    const f=fixture();
    // 기존 보호 reader 반환의 형식·관계 반례이며 실제 저장·권한/현재 head 증거가 아니다.
    const changed={...f.approved,
      title:variant==='title'?'다른 제목':f.approved.title,
      formRef:variant==='form'?ref(99):f.approved.formRef,
      stageNodeRef:variant==='stage'?{applicationId:ref(99).id,nodeId:'다른단계'}:f.approved.stageNodeRef};
    const hash=contentHash(canonicalJson({title:changed.title,formRef:changed.formRef,stageNodeRef:changed.stageNodeRef,content:changed.content}));
    const approvedRef={id:changed.id,version:changed.version,contentHash:hash};
    const approved={...changed,contentHash:hash,
      contentReviews:changed.contentReviews.map(review=>({...review,ref:{...review.ref,targetRef:approvedRef}}))};
    f.input.approvedDesignRef=approvedRef;f.plan.designRef=approvedRef;
    const readers={...f.readers,document:async(id:string,version:number)=>{
      const original=await f.readers.document(id,version);
      return id===approved.id&&version===approved.version?approved:original;
    }};
    // 앞 fullref·hash·selection·본문 조건을 충족시키고 해당 관계 하나만 다르게 둔다.
    assert.deepEqual({id:approved.id,version:approved.version,contentHash:approved.contentHash},f.input.approvedDesignRef);
    assert.equal(contentHash(canonicalJson({title:approved.title,formRef:approved.formRef,stageNodeRef:approved.stageNodeRef,content:approved.content})),approved.contentHash);
    assert.deepEqual(f.plan.designRef,approvedRef);assert.deepEqual(f.proposal.proposedContent,approved.content);
    assert.deepEqual(f.change.beforeRef,f.proposal.baseRef);
    assert.equal(f.proposal.selections.length,1);assert.equal(f.proposal.selections[0]!.documentId,approved.id);
    assert.equal(f.proposal.selections[0]!.version,approved.version);assert.equal(approved.version,f.before.version+1);
    assert.equal(approved.title!==f.before.title,variant==='title');
    assert.equal(canonicalJson(approved.formRef)!==canonicalJson(f.before.formRef),variant==='form');
    assert.equal(canonicalJson(approved.stageNodeRef)!==canonicalJson(f.before.stageNodeRef),variant==='stage');
    assert.equal(approved.confirmed,true);assert.equal(approved.validation.validForConfirmation,true);
    assert.equal(approved.contentReviews[0]!.ref.outcome,'ACCEPTED');
    await conflict(()=>readStoredDesignActivationRelations(f.input,readers));
    assert.equal(f.calls.length,4);assert.equal(f.calls.some(call=>call.startsWith('plan:')||call.startsWith('decision:')),false);
  });
}
