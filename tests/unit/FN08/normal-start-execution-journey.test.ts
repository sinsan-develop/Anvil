import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionFixture,httpsFixture} from './normal-start-execution-fixture.ts';
import {NormalStartIntake,receiveNormalStart} from '../../../apps/connector/runtime/normal-start-intake.ts';
import {NormalProtectedGetClient} from '../../../apps/connector/runtime/normal-protected-get-client.ts';
import {NormalProtectedPostClient} from '../../../apps/connector/runtime/normal-protected-post-client.ts';
import {NormalStartFileStore} from '../../../apps/connector/runtime/normal-start-file-store.ts';
import {NormalObservationSpool} from '../../../apps/connector/runtime/normal-observation-spool.ts';
import {root,memoryFiles} from './normal-start-local-fixture.ts';
const {NormalStartCoordinator}=await import('../../../apps/connector/runtime/normal-start-coordinator.ts');
test('실제 START→자료 GET→normal intake→내구 attempt→permit→wire1→관측 ACK 전체 source 여정',async()=>{
 const q=await executionFixture(),h=q.h;
 try{
  const http=httpsFixture(h),get=new NormalProtectedGetClient(http.options,http.ports),post=new NormalProtectedPostClient(http.options,http.ports);
  const signal=new AbortController().signal;
  const page=await get.send(await get.prepareCommandPage({afterSequence:0,waitMs:0},signal),signal) as any,item=page.items[0];
  const e=item.envelope,scope={projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration};
  const fs=memoryFiles(),store=new NormalStartFileStore(root,scope,fs.fs),clock=()=>h.store.now().getTime();
  const intake=new NormalStartIntake(store.intake(),{context:e.context,executorRegistrationRef:e.executorRegistrationRef},clock);
  await receiveNormalStart(get,intake,item,page.proofResultRef,signal);
  const binding=h.f.tables.execution_grants![0]!.snapshot_json.binding,grantRef=http.options.scope.grantRef;let wires=0;
  const current={transport:'NORMAL_PROTECTED' as const,async current(envelope:any,attempt:any,_signal:AbortSignal){
   return{transport:'NORMAL_PROTECTED',key:{...scope,commandId:e.commandId},envelopeHash:envelope.envelopeHash,grantRef,
    localAttemptRef:attempt,sourceObservationRefs:[...new Map(e.context.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],
    osOwnershipRef:binding.checks.osFence.evidenceRefs[0],checkedAt:h.store.now().toISOString(),expiresAt:new Date(clock()+10000).toISOString()};
  }};
  const spool=new NormalObservationSpool(store,scope,clock);
  let wireError='';const wire={transport:'NORMAL_PROTECTED' as const,async send(value:any,_signal:AbortSignal){try{
   wires++;assert.equal(q.permits.length,1);
   const records=[...fs.files].filter(([p])=>p.includes('attempt-')&&!p.endsWith('.lock')).map(([,f])=>JSON.parse(f.bytes.toString()));
   assert.deepEqual(records.map(r=>r.snapshot.state),['START_ATTEMPTED','PERMIT_RECORDED']);
   assert.deepEqual(value.localAttemptRef,records[0].ref);assert.deepEqual(q.permits[0].snapshot_json.request.localAttemptRef,records[0].ref);
   assert.deepEqual(value.permit,records[1].snapshot.permit);
   assert.equal(Buffer.from(value.options.bytes).toString('utf8'),h.f.preparation.data.snapshot.options.body);
   assert.equal(contentHash(value.contextBundle.bytes),item.materials.groups[0].contentHash);
   assert.equal(value.contextBundle.bytes.length,item.materials.groups[0].sourceBytes);
   assert.equal(JSON.parse(Buffer.from(value.contextBundle.bytes).toString()).purpose,'START_CONTEXT_BODY_V1');
   assert.equal(Buffer.from(value.contextBundle.bytes).toString('utf8'),q.opts.contextBodies[0]);
   assert.equal(value.options.envelopeHash,e.envelopeHash);return{transport:'NORMAL_PROTECTED',responseRef:grantRef,processRef:null};}catch(error){wireError=String(error);throw error;}
  }};
  const make=()=>new NormalStartCoordinator({intake,store,post,current,wire,spool,grantRef,clock,timeoutMs:1000});
  const result=await make().start(e,signal);assert.equal(result.state,'RESPONSE_RECORDED',wireError);assert.equal(wires,1);
  assert.deepEqual(await make().start(e,signal),result);assert.equal(wires,1);
  const ack=await spool.sync(post,signal);assert(ack);assert.equal(ack.snapshot.highestContiguous,5);assert.equal(q.observations.length,5);assert.equal(q.acks.length,1);
  assert.deepEqual((await spool.batch()).events.map((v:any)=>v.type),['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED']);
  assert.equal(q.observations.at(-1).snapshot_json.event.reasonCode,'UNVERIFIED_PROVIDER_CLAIM');
  assert.equal(ack.snapshot.executionAuthorized,false);assert.equal(ack.snapshot.writerReleaseVerified,false);
  assert(!JSON.stringify([...fs.files.values()].map(v=>v.bytes.toString())).includes(h.token));
  assert.equal([...fs.files.keys()].some(p=>p.endsWith('.lock')),false);
 }finally{await h.app.close();}
});
