import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activationModule,fixture,code,pid,actor,hash,ref} from './baseline-activation-fixture.ts';

test('FN04 독립fixture는계약18필드·canonicalhash·reason비공개를만족한다',()=>{
 const f=fixture(),r=f.record();assert.equal(Object.keys(r.snapshot).length,18);assert.equal(hash(r.snapshot),r.ref.contentHash);assert.equal(r.ref.version,r.snapshot.generation);assert.equal(r.snapshot.previousActivationRef,null);assert.equal(Object.hasOwn(r.snapshot,'reason'),false);assert.equal(hash(f.input),f.scope.payloadHash);
});

test('FN04 생산 준비 gate는 보관 관계/빈 coverage만으로 실제 writer 안전을 만들지 않는다',async()=>{
 const m=await activationModule(),f=fixture();assert.equal(typeof m.assertProductionDesignActivationReady,'function');
 for(const gaps of [[],[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}]]){
  f.relations.impact.coverageGaps=gaps;assert.throws(()=>m.assertProductionDesignActivationReady(f.relations),code('DESIGN_ACTIVATION_NOT_READY',412));
 }
 assert.deepEqual(f.state.writes,[]);assert.equal(f.relations.unverified.writerSafety,true);
});

test('FN04 내부 합성 정상 저장은 단일 소비UUID·18필드 snapshot·receipt뒤 CAS와 AFFECTED만 연결한다',async()=>{
 const m=await activationModule(),f=fixture();
 const result=await f.transaction<any>(()=>m.applyBaselineActivationInTransaction({db:f.db,actor,command:f.command,policyRef:f.policyRef,relations:f.relations,receiptPort:f.receiptPort}));
 assert.deepEqual(f.receiptEvents,['reserve','receipt+consume']);assert.equal(result.status,'APPLIED');const record=result.data;
 assert.equal(Object.keys(record.snapshot).length,18);assert.equal(record.snapshot.projectId,pid);assert.equal(record.snapshot.approvalConsumptionId,'a6f40000-0000-4000-8000-000000000016');assert.equal(record.snapshot.candidatePayloadHash,hash(f.input));assert.equal(record.ref.contentHash,hash(record.snapshot));assert.equal(record.ref.version,1);assert.equal(record.snapshot.previousActivationRef,null);
 assert.equal(Object.hasOwn(record.snapshot,'reason'),false);assert.equal(Object.hasOwn(record.snapshot,'payload'),false);assert.equal(record.snapshot.commandId,f.command.commandId);
 assert(f.state.writes.some((s:string)=>s.includes('baseline_activations')));assert(f.state.writes.some((s:string)=>s.includes('baseline_activation_current')));
 const rechecks=f.state.calls.filter((v:any)=>/^\s*INSERT/.test(v.sql)&&v.sql.includes('baseline_activation_rechecks'));assert.equal(rechecks.length,1);assert(JSON.stringify(rechecks[0].args).includes('FN04'));assert(!JSON.stringify(rechecks[0].args).includes('FN03'));
});

test('FN04 내부 저장은 exact 이전 pointer CAS·원beforeRef 불일치·세대 overflow를 거절한다',async()=>{
 const m=await activationModule();
 for(const mode of ['MISSING_BASELINE','WRONG_HASH','WRONG_BEFORE','OVERFLOW']){const f=fixture(),previous=f.record();f.state.history=[previous];f.state.pointer=previous;f.command.baselineRefs=[previous.ref];f.relations.change.beforeRef=previous.snapshot.approvedDesignRef;
  if(mode==='MISSING_BASELINE')f.command.baselineRefs=[];
  if(mode==='WRONG_HASH')f.command.baselineRefs=[{...previous.ref,contentHash:'f'.repeat(64)}];
  if(mode==='WRONG_BEFORE')f.relations.change.beforeRef={...previous.snapshot.approvedDesignRef,contentHash:'f'.repeat(64)};
  if(mode==='OVERFLOW'){previous.ref.version=Number.MAX_SAFE_INTEGER;previous.snapshot.generation=Number.MAX_SAFE_INTEGER;previous.snapshot.previousActivationRef=ref(999,Number.MAX_SAFE_INTEGER-1);previous.ref.contentHash=hash(previous.snapshot);f.command.baselineRefs=[previous.ref];}
  await assert.rejects(()=>m.applyBaselineActivationInTransaction({db:f.db,actor,command:f.command,policyRef:f.policyRef,relations:f.relations,receiptPort:f.receiptPort}),code('VERSION_CONFLICT',409));assert.deepEqual(f.state.writes,[]);assert.deepEqual(f.receiptEvents,[]);
 }
});

test('FN04 내부 저장의 pointer 쓰기 실패를 전파하고 합성 호출자 상태를 복원한다',async()=>{
 const m=await activationModule(),f=fixture();f.state.fail='baseline_activation_current';
 await assert.rejects(()=>f.transaction(()=>m.applyBaselineActivationInTransaction({db:f.db,actor,command:f.command,policyRef:f.policyRef,relations:f.relations,receiptPort:f.receiptPort})));
 assert.deepEqual(f.state.writes,[]);assert.equal(f.state.pointer,null);assert.deepEqual(f.state.history,[]);
});

test('FN04 실제생산activate는보관관계가있어도실제§6근거없으면412·쓰기0이며route가같은method를소비한다',async()=>{
 const m=await activationModule(),f=fixture(),repo=new m.ProjectBaselineActivations();repo.assertCandidateCurrent=async()=>f.relations;
 await assert.rejects(()=>repo.activate(f.db,actor,f.command,f.policyRef),code('DESIGN_ACTIVATION_NOT_READY',412));assert.deepEqual(f.state.writes,[]);assert.deepEqual(f.receiptEvents,[]);
 const {readFile}=await import('node:fs/promises'),source=await readFile(new URL('../../../apps/server/modules/projects/routes.ts',import.meta.url),'utf8');assert(source.includes("request.body.operation==='activateDesignChange'"));assert(source.includes('baselineActivations.activate(db,actor,request.body,policyRef)'));
});
