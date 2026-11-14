import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {instructionSourceFixture,normalInstructionFixture,normalInstructionDeliveryFixture} from './normal-instruction-dispatch-fixture.ts';
const {NormalInstructionCommands}=await import('../../../apps/server/modules/executions/normal-instruction-command.ts');
const {NormalInstructionSource,registeredInstructionReadMatches}=await import('../../../apps/server/modules/executions/normal-instruction-source.ts');
const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 test('실제 보호 메시지와 append receipt에서 부분계획 GET을 만들고 SEND source가 원문으로 다시 대조한다',async()=>{
  const x=await instructionSourceFixture();try{const direct=await x.read();const response=await x.get();assert.equal(response.statusCode,200,response.body);assert.equal(response.headers['cache-control'],'no-store');const out=response.json();assert.deepEqual(out,direct);assert.deepEqual(out.instructionRef,x.f.commands.get(x.m.command_id)!.result_ref.data.ref);assert.deepEqual(Object.keys(out).sort(),['instructionRef','partsRef','plan']);
   const q={...x.f.originCommand(),payload:{instructionRef:out.instructionRef,partsRef:out.partsRef}};
   const material=await x.f.access.authenticated(x.f.token,null,(db,actor)=>x.source.read(db,actor,q));assert.deepEqual(material.sourceRef,out.instructionRef);assert.deepEqual(material.parts,out.plan.parts);assert.equal(material.contentHash,x.m.message_json.message.bodyRef.contentHash);assert.equal(material.sourceBytes,x.m.message_json.message.bodyRef.bytes);
   q.payload.partsRef={...out.partsRef,contentHash:'0'.repeat(64)};await assert.rejects(x.f.access.authenticated(x.f.token,null,(db,actor)=>x.source.read(db,actor,q)),/NORMAL_INSTRUCTION_SOURCE_CHANGED/);
  }finally{await x.close();}
 });
 for(const fault of ['RECEIPT','OUTER','AUDIT','CORRECTION','AFTER_READ','QUARANTINE'] as const)test('보호 instruction '+fault+' 불일치는 부분계획을 발급하지 않는다',async()=>{
  const x=await instructionSourceFixture();try{
   if(fault==='RECEIPT')x.f.receipts.delete(x.m.command_id);
   if(fault==='OUTER')x.f.commands.get(x.m.command_id)!.result_ref.targetId=randomUUID();
   if(fault==='AUDIT')x.f.audits.get(x.m.command_id)!.target_ref={...x.f.audits.get(x.m.command_id)!.target_ref,id:randomUUID()};
   if(fault==='CORRECTION')await x.f.richSources!.supersede(x.f.policyRef);
   if(fault==='AFTER_READ')x.mode.afterReadCorrection=true;
   if(fault==='QUARANTINE')x.f.state.quarantined=true;
   const result=await x.get();assert.notEqual(result.statusCode,200);assert.equal(result.json().plan,undefined);
  }finally{await x.close();}
 });
 test('다른 대화/회원 해지/실행 Bearer는 HUMAN 부분계획 GET을 열지 않는다',async()=>{
  const x=await instructionSourceFixture();try{
   const wrong=await x.app.inject({method:'GET',url:x.url.replace(x.m.conversation_id,randomUUID()),headers:{host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+x.f.token}});assert.equal(wrong.statusCode,404);
   const bearer=await x.app.inject({method:'GET',url:x.url,headers:{host:'anvil-synthetic.invalid',authorization:'Bearer av3ex1_'+Buffer.alloc(32,1).toString('base64url')}});assert.notEqual(bearer.statusCode,200);
   x.f.state.member=false;assert.notEqual((await x.get()).statusCode,200);
  }finally{await x.close();}
 });
 test('실제 SEND 저장행과 발급 credential에 결박한 원 표식만 같은 거래의 정확 메시지를 읽는다',async()=>{
  const q=await normalInstructionFixture(),x=await instructionSourceFixture(q.j);try{
   const plan=await x.read();Object.assign(q.request.payload,{instructionRef:plan.instructionRef,partsRef:plan.partsRef});const fact=q.g.snapshot_json.binding;
   const current={async observe(_scope:unknown,checkedAt:string){return{fact:{...structuredClone(fact),writerState:'OWNED',checkedAt},turnState:'IDLE',stageRef:x.f.stage.data.snapshot.input.stageRef,demand:{attempts:0,calls:1,spoolBytes:plan.plan.bodyRef.bytes,cost:null,costStatus:'VERIFIED_NO_CHARGE'},checkedAt,expiresAt:q.g.snapshot_json.expiresAt};}};
   const service=new NormalInstructionCommands(x.f.access,{mode:'NORMAL_PROTECTED',current},x.source,x.f.limits);
   const sent:any=await service.command(x.f.token,x.f.csrf,q.request),stored=q.stored()[0]!,manifestRef=stored.snapshot_json.currentBinding.materialManifestRef;
   const original=await x.f.access.authenticated(x.f.token,null,(db,actor)=>x.source.read(db,actor,q.request)),before=x.f.db.query;
   const hash=(v:unknown)=>contentHash(canonicalJson(v));
   let protectedReading=false,membershipReads=0;
   x.f.db.query=async(sql:string,args:any[]=[])=>{
    if(protectedReading&&sql.includes('JOIN anvil.project_members'))membershipReads++;
    if(sql.startsWith('SELECT * FROM anvil.normal_instruction_record(')){assert.deepEqual(args,[x.f.pid,q.g.execution_id,q.g.generation,q.request.commandId]);return{rows:[{valid:true,snapshot_json:stored.snapshot_json,original,result_ref:sent}]};}
    if(sql.startsWith('SELECT * FROM anvil.normal_request_credential(')){
     const [token,cid,eid,gid,ver,gh,gen]=args,r=q.j.store.receipts().find(v=>v.snapshot_json.tokenDigest===token),c=x.f.tables.execution_credentials![0]!,e=r&&q.j.store.events().find(v=>v.id===r.challenge_id&&v.version===2);
     if(!r||cid!==fact.registration.connectorId||eid!==q.g.execution_id||gid!==q.g.id||ver!==q.g.version||gh!==q.g.content_hash||gen!==c.credential_generation)return{rows:[]};
     assert.equal(hash(r.snapshot_json),r.content_hash);assert.deepEqual(r.snapshot_json.reservationRef,{id:c.id,version:1,contentHash:hash(c.snapshot_json)});assert.deepEqual(e!.snapshot_json.consumption.resultRef,{id:r.id,version:1,contentHash:r.content_hash});return{rows:[{project_id:x.f.pid,credential_ref:{id:r.id,version:1,contentHash:r.content_hash},expires_at:new Date(r.snapshot_json.expiresAt)}]};
    }return before(sql,args);
   };
   const digest=createHash('sha256').update(q.j.token).digest('hex'),proof={grantRef:q.request.payload.grantRef,credentialGeneration:fact.executionCredentialReservation.generation};
   const read=(ref=manifestRef)=>x.f.access.authenticated(x.f.token,null,db=>x.source.readRegistered(db,digest,fact.registration.connectorId,q.g.execution_id,proof,q.request.commandId,ref));
   protectedReading=true;const body=await read();protectedReading=false;assert.equal(membershipReads,0);assert.equal(contentHash(body),plan.plan.bodyRef.contentHash);assert.equal(Buffer.byteLength(body),plan.plan.bodyRef.bytes);
   assert.throws(()=>new NormalInstructionSource({readInstruction:async()=>({})} as any),/NORMAL_INSTRUCTION_SOURCE_REQUIRED/);
   await assert.rejects(read({...manifestRef,id:randomUUID()}),/NORMAL_INSTRUCTION_SOURCE_REQUIRED/);
   const forged={kind:'INSTRUCTION_GRANT',projectId:x.f.pid,conversationId:x.m.conversation_id,messageId:x.m.id};assert.equal(registeredInstructionReadMatches(forged,x.f.db,x.f.pid,x.m.conversation_id,x.m.id),false);
   await assert.rejects(x.conversations.readMessageCore(x.f.db,forged as any,x.f.pid,x.m.conversation_id,x.m.id),/INSTRUCTION_GRANT_READ_DENIED/);
   await x.f.richSources!.supersede(x.f.policyRef);await assert.rejects(read(),/INSTRUCTION_SOURCE_EXCLUDED/);
  }finally{await x.close();}
 });

 test('SEND descriptor는 재봉인한 교차 partsRef·offset·source·추가 material 행도 거절한다',async()=>{
  const h=await normalInstructionDeliveryFixture();try{
   const {instructionMaterialDescriptor}=await import('../../../apps/server/modules/executions/normal-instruction-materials.ts');
   const command=h.f.tables.execution_commands!.find(c=>c.snapshot_json.envelope.operation==='SEND_INSTRUCTION')!,manifest=h.f.tables.execution_material_manifests!.find(m=>m.created_command_id===command.created_command_id)!;
   const row={command_record_id:command.id,manifest_ref:{id:manifest.id,version:1,contentHash:manifest.content_hash},manifest:manifest.snapshot_json,materials:h.f.tables.execution_materials!.filter(m=>m.manifest_id===manifest.id).map(m=>({ref:{id:m.id,version:1,contentHash:m.content_hash},snapshot:m.snapshot_json}))};
   const b=manifest.snapshot_json.scope;
   assert.equal(instructionMaterialDescriptor(row,b,command.snapshot_json.envelope).groups[0]!.payloadRef.contentHash,h.plan.partsRef.contentHash);
   for(const fault of ['PARTS','OFFSET','SOURCE','EXTRA']){const bad=structuredClone(row);
    if(fault==='PARTS'){bad.manifest.source.partsRef.id=randomUUID();bad.materials[0]!.snapshot.payloadRef=bad.manifest.source.partsRef;}
    if(fault==='OFFSET'){bad.manifest.parts[0].byteOffset=1;bad.materials[0]!.snapshot.byteOffset=1;}
    if(fault==='SOURCE'){bad.manifest.source.sourceRef.id=randomUUID();bad.materials[0]!.snapshot.sourceRef=bad.manifest.source.sourceRef;}
    if(fault==='EXTRA')bad.materials.push(structuredClone(bad.materials[0]!));
    bad.manifest_ref.contentHash=contentHash(canonicalJson(bad.manifest));for(const m of bad.materials)m.ref.contentHash=contentHash(canonicalJson(m.snapshot));
    assert.throws(()=>instructionMaterialDescriptor(bad,b,command.snapshot_json.envelope),/EXECUTION_INSTRUCTION_MATERIAL_REJECTED/,fault);
   }
  }finally{await h.close();}
 });
 for(const fault of ['ROLLBACK','COMMIT_TAG','LOST','CORRECTION','PORT','PORT_AFTER','REVOKED','EXPIRED','SIGNATURE','QUARANTINE'] as const)test('SEND material '+fault+'은 원문/nonce/영수증 경계를 보존한다',async()=>{
  const h=await normalInstructionDeliveryFixture();const original=NormalInstructionSource.prototype.readRegistered;
  try{const c=h.f.tables.execution_commands!.find(c=>c.snapshot_json.envelope.operation==='SEND_INSTRUCTION')!,m=h.f.tables.execution_materials!.find(m=>m.command_record_id===c.id)!,p=await h.prepare(h.prefix+'/commands/'+c.snapshot_json.envelope.commandId+'/materials/'+m.id);
   const before=h.q.j.store.events().length,receipts=h.q.j.store.receipts().length;
   if(fault==='ROLLBACK')h.mode.failBinding=true;
   if(fault==='COMMIT_TAG')h.q.j.store.mode.badTag=true;
   if(fault==='LOST')h.q.j.store.mode.lost=true;
   if(fault==='PORT')NormalInstructionSource.prototype.readRegistered=async()=>{throw Error('REPLACED_READER_MUST_NOT_RUN');};
   if(fault==='REVOKED')h.q.j.store.mode.revoked=true;
   if(fault==='QUARANTINE')h.f.state.quarantined=true;
   if(fault==='EXPIRED')h.q.j.store.mode.offset+=60000;
   if(fault==='SIGNATURE')p.frame.signature=p.frame.signature.slice(0,-4)+'AAAA';
   if(fault==='PORT_AFTER'){const raw=h.f.db.query;h.f.db.query=async(s:string,a:any[]=[])=>{const r=await raw(s,a);if(s.startsWith('SELECT m.command_id,m.client_id,m.message_json'))NormalInstructionSource.prototype.readRegistered=async()=>{throw Error('REPLACED_READER_MUST_NOT_RUN');};return r;};}
   if(fault==='CORRECTION'){const first=await p.get();assert.equal(first.statusCode,200,first.body);await h.f.richSources!.supersede(h.f.policyRef);}
   const response=await p.get();assert.notEqual(response.statusCode,200,response.body);assert.equal(response.json().material,undefined);
   if(fault==='LOST'){assert.equal(response.statusCode,503);assert.equal(h.q.j.store.mode.discards,1);assert.equal(h.bindings.length,1);h.q.j.store.mode.lost=false;const recovered=await p.get();assert.equal(recovered.statusCode,200,recovered.body);assert.equal(h.bindings.length,1);assert.equal(h.q.j.store.events().length,before+1);assert.equal(h.q.j.store.receipts().length,receipts+1);}
   else if(fault==='CORRECTION'){assert.equal(h.bindings.length,1);assert.equal(h.q.j.store.events().length,before+1);}
   else{assert.equal(h.bindings.length,0);assert.equal(h.q.j.store.events().length,before);assert.equal(h.q.j.store.receipts().length,receipts);}
  }finally{NormalInstructionSource.prototype.readRegistered=original;await h.close();}
 });

}
