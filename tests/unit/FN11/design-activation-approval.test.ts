import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readApprovalDetails,assertApprovalCandidate} from '../../../apps/server/modules/approvals/approval-input.ts';
import {authorizeMaterial,persistProjectReceipt,reserveActivationReceiptIds} from '../../../apps/server/modules/access/project-command.ts';
import {ProjectApprovals} from '../../../apps/server/modules/approvals/project-approvals.ts';
import {fixture,candidateModule,code,pid,actor,hash,ref,id} from '../FN04/baseline-activation-fixture.ts';

test('FN04 승인scope는activate에만현재pointer fullref1개를허용하고다른연산guard를보존한다',()=>{
 const f=fixture(),baseline=ref(101),context={actorId:actor.actorId,clientId:actor.clientId,controlGeneration:1,allowedOperations:['activateDesignChange','uploadArtifact'],now:new Date('2026-10-27T10:00:00.000Z')};f.scope.baselineRefs=[baseline];
 assert.deepEqual(readApprovalDetails(f.details,context).actionScope.baselineRefs,[baseline]);
 for(const refs of [[baseline,baseline],[{...baseline,contentHash:'broken'}]]){const d=structuredClone(f.details);d.actionScope.baselineRefs=refs;assert.throws(()=>readApprovalDetails(d,context));}
 const other=structuredClone(f.details);other.actionScope.operation='uploadArtifact';assert.throws(()=>readApprovalDetails(other,context),code('APPROVAL_REFERENCE_NOT_CONNECTED',412));
 const changed=structuredClone(f.command);changed.baselineRefs=[baseline];changed.payload={...changed.payload,changeRef:{...f.input.changeRef,contentHash:'f'.repeat(64)}};assert.throws(()=>assertApprovalCandidate(f.details,changed,actor.actorId,pid),code('APPROVAL_CANDIDATE_MISMATCH',409));
});

test('FN04 후보payload는기존exact5필드/parser와원hash·비밀검사를소비한다',async()=>{
 const m=await candidateModule(),f=fixture(),before=structuredClone(f.input),value=m.readDesignActivationApprovalPayload(f.input,hash(f.input));assert.deepEqual(value,before);value.reason='반환값 편집';assert.deepEqual(f.input,before);
 for(const input of [{...f.input,allow:true},{...f.input,reason:''},{...f.input,changeRef:{...f.input.changeRef,contentHash:'broken'}}])assert.throws(()=>m.readDesignActivationApprovalPayload(input,hash(input)),code('APPROVAL_INPUT_INVALID',422));
 assert.throws(()=>m.readDesignActivationApprovalPayload({...f.input,reason:'다른내용'},hash(f.input)),code('APPROVAL_CANDIDATE_MISMATCH',409));
 const secret={...f.input,reason:'password=synthetic-private-value'};assert.throws(()=>m.readDesignActivationApprovalPayload(secret,hash(secret)),(e:any)=>e.statusCode===422&&!String(e.message).includes('synthetic-private-value'));
});

test('FN04 후보capture/read는원요청/명령/hash/현재OWNER+원요청자에결박하고다른client읽기를허용한다',async()=>{
 const m=await candidateModule(),f=fixture(),repo=new m.DesignActivationApprovalCandidates();await repo.capture(f.db,actor,{command:f.requestCommand,requestId:f.approvalRef.requestId,serverCommandId:f.meta.serverCommandId,policyRef:f.policyRef,details:f.details,payload:f.input});assert.equal(f.state.writes.length,1);
 assert.deepEqual(await repo.read(f.db,{...actor,clientId:id(70)},pid,f.approvalRef.requestId,f.meta),{candidateCommandId:f.command.commandId,payloadHash:hash(f.input),payload:f.input});
 await assert.rejects(()=>repo.read(f.db,{...actor,actorId:id(71)},pid,f.approvalRef.requestId,f.meta),code('NOT_FOUND',404));f.state.member='VIEWER';await assert.rejects(()=>repo.read(f.db,actor,pid,f.approvalRef.requestId,f.meta),code('NOT_FOUND',404));
});

test('FN04 후보누락·귀속/원명령/hash변조는값없는503이며다른후보로대체하지않는다',async()=>{
 const m=await candidateModule(),repo=new m.DesignActivationApprovalCandidates();
 for(const change of [null,{payload_json:{reason:'변조'}},{request_hash:'f'.repeat(64)},{policy_ref:ref(99)},{request_command_id:id(99)},{baseline_refs:[ref(99)]}]){const f=fixture();f.state.candidate=change===null?null:{...f.state.candidate,...change};await assert.rejects(()=>repo.read(f.db,actor,pid,f.approvalRef.requestId,f.meta),code('ACTIVATION_APPROVAL_STORAGE_UNAVAILABLE',503));assert.equal(f.state.writes.length,0);}
});

test('FN04 합법소비replay는진행한pointer/impact를신규CAS로재검사하지않는다',async()=>{
 const f=fixture(),repo=new ProjectApprovals(),request={details:f.details,scopeDigest:f.approvalRef.scopeDigest,policyRef:f.policyRef},consumption={commandId:f.command.commandId,requestHash:hash(f.command)};
 // 보호이력의합성반환만주입한다. 실제authorize의exact후보/소비replay분기를그대로실행한다.
 (repo as any).read=async()=>({request,decision:{id:f.approvalRef.decisionId,decision:'APPROVE'},basisCurrent:true,storedStatus:'CONSUMED',currentVersion:3,consumption,expired:true});
 assert.deepEqual(await repo.authorize(f.db,actor,f.command,f.policyRef),{...f.approvalRef,replay:true});assert.deepEqual(f.state.calls,[],'합법replay에새pointer/impact/§6조회를요구하지않는다');
 for(const command of [{...f.command,commandId:id(99)},{...f.command,payload:{...f.input,reason:'다른 내용'}}])await assert.rejects(()=>repo.authorize(f.db,actor,command,f.policyRef));
 consumption.requestHash='f'.repeat(64);await assert.rejects(()=>repo.authorize(f.db,actor,f.command,f.policyRef),code('APPROVAL_ALREADY_CONSUMED',409));
});

test('FN04 targetRef는id/version만같은다른hash를같은후보로수락하지않는다',()=>{
 const f=fixture();f.details.actionScope.targetRef={...f.input.changeRef,contentHash:'f'.repeat(64)};assert.throws(()=>assertApprovalCandidate(f.details,f.command,actor.actorId,pid),code('APPROVAL_CANDIDATE_MISMATCH',409));
});

test('FN04 잘못된Unicode·NUL·의심비밀은후보INSERT전에값없는422로닫는다',async()=>{
 const m=await candidateModule();for(const reason of ['잘못된 '+String.fromCharCode(0xD800),'NUL'+String.fromCharCode(0)+'입력','password=synthetic-private-value']){const f=fixture(),repo=new m.DesignActivationApprovalCandidates(),payload={...f.input,reason};
  assert.throws(()=>m.readDesignActivationApprovalPayload(payload,hash(f.input)),(e:any)=>e.statusCode===422&&!String(e.message).includes(reason));
  const command={...f.requestCommand,payload:{details:f.details,candidatePayload:payload}};await assert.rejects(()=>repo.capture(f.db,actor,{command,requestId:f.approvalRef.requestId,serverCommandId:f.meta.serverCommandId,policyRef:f.policyRef,details:f.details,payload}),(e:any)=>e.statusCode===422&&!String(e.message).includes(reason));assert.deepEqual(f.state.writes,[]);
 }
});

test('FN04 activate는AUTO정책으로정확일회승인요건을우회하지않는다',async()=>{
 const f=fixture(),rules=[{ruleId:'TEST',subjectRef:{kind:'HUMAN',userId:actor.actorId},targetScopes:[{kind:'PROJECT',projectId:pid}],operations:['activateDesignChange'],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],policy={rules,reason:'합성정책',reviewRefs:[]};
 const db={query:async()=>({rows:[{id:f.policyRef.id,head_version:1,rules_json:rules,content_hash:hash(policy),reason:policy.reason,review_refs:[],created_at:new Date('2026-10-27T10:00:00.000Z')}]})} as any;
 await assert.rejects(()=>authorizeMaterial(db,actor,{...f.command,approvalRef:null}),code('APPROVAL_REQUIRED',412));await assert.rejects(()=>authorizeMaterial(db,actor,f.command,true),code('APPROVAL_REQUIRED',412));assert.deepEqual(f.state.writes,[]);
});

test('FN04 실제persistProjectReceipt와consume는예약ID한개·원pointer재authorize순서를보존한다',async()=>{
 const m=await candidateModule(),f=fixture(),events:string[]=[],reserved=reserveActivationReceiptIds(),snapshot={...f.record().snapshot,approvalConsumptionId:reserved.consumptionId},record={snapshot,ref:{...f.record().ref,contentHash:hash(snapshot)}};
 const oldRead=ProjectApprovals.prototype.read,oldCurrent=m.DesignActivationApprovalCandidates.prototype.assertCurrent,query=f.db.query.bind(f.db);
 (ProjectApprovals.prototype as any).read=async()=>({request:{details:f.details,scopeDigest:f.approvalRef.scopeDigest,policyRef:f.policyRef},decision:{id:f.approvalRef.decisionId,decision:'APPROVE'},basisCurrent:true,storedStatus:'APPROVED',currentVersion:2,consumption:null,expired:false});
 m.DesignActivationApprovalCandidates.prototype.assertCurrent=async()=>{events.push('원pointer authorize');assert.equal(f.state.pointer,null);return f.relations;};
 (f.db as any).query=async(sql:string,args:unknown[]=[])=>{if(sql.includes('set_config'))return{rows:[]};if(sql.startsWith('INSERT INTO anvil.approval_consumptions'))events.push('consume');return query(sql,args);};
 try{const receipt=await persistProjectReceipt(f.db,actor,f.command,record.ref,{status:'DESIGN_BASELINE_ACTIVATED',snapshot},f.policyRef,'DESIGN_BASELINE_ACTIVATED',reserved);assert.equal(receipt.id,reserved.serverCommandId);const command=f.state.calls.find((v:any)=>v.sql.startsWith('INSERT INTO anvil.commands')),used=f.state.calls.find((v:any)=>v.sql.startsWith('INSERT INTO anvil.approval_consumptions'));assert.equal(command.args[9],reserved.consumptionId);assert.equal(used.args[0],reserved.consumptionId);assert.equal(used.args[3],reserved.serverCommandId);assert.deepEqual(events,['원pointer authorize','consume']);assert.equal((receipt.result.data as any).snapshot.approvalConsumptionId,reserved.consumptionId);
  await assert.rejects(()=>persistProjectReceipt(f.db,actor,f.command,record.ref,{snapshot},f.policyRef,'DESIGN_BASELINE_ACTIVATED',reserved),code('ACTIVATION_RECEIPT_RESERVATION_INVALID',422));
 }finally{ProjectApprovals.prototype.read=oldRead;m.DesignActivationApprovalCandidates.prototype.assertCurrent=oldCurrent;}
});

test('FN04 예약을사용하지않는기존receiptcaller의기본동작은유지한다',async()=>{
 const f=fixture(),query=f.db.query.bind(f.db);(f.db as any).query=async(sql:string,args:unknown[]=[])=>sql.includes('set_config')?{rows:[]}:query(sql,args);
 const request={...f.command,operation:'saveKnowledge',approvalRef:null},receipt=await persistProjectReceipt(f.db,actor,request,f.input.changeRef,{status:'SAVED'},f.policyRef,'SYNTHETIC_SAVE');assert.equal(receipt.result.status,'APPLIED');const command=f.state.calls.find((v:any)=>v.sql.startsWith('INSERT INTO anvil.commands'));assert.equal(command.args[9],null);assert.equal(f.state.calls.some((v:any)=>v.sql.startsWith('INSERT INTO anvil.approval_consumptions')),false);
});
