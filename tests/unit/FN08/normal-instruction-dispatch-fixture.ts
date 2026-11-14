import {journey,digest,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomUUID,randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
const {NormalInstructionCommands}=await import('../../../apps/server/modules/executions/normal-instruction-command.ts');
const {ProjectConversations}=await import('../../../apps/server/modules/knowledge/conversations.ts');
const {NormalInstructionSource}=await import('../../../apps/server/modules/executions/normal-instruction-source.ts');
const {buildApp}=await import('../../../apps/server/app.ts');

/** 실제 START/credential 생산 행을 사용한다. SQL 실행과 부분계획 발급 producer는 이 fixture의 검증 범위가 아니다. */
export async function normalInstructionFixture(pages?:Parameters<typeof journey>[0]){
 const j=await journey(pages),f=j.f,g=f.tables.execution_grants![0]!,start=f.tables.execution_commands![0]!,originalQuery=f.db.query;
 const ref=(v:any)=>({id:v.id,version:Number(v.version),contentHash:v.content_hash}),grantRef=ref(g),fact=g.snapshot_json.binding;
 const body='명시 등록된 합성 지시 원문',bodyHash=contentHash(body),sourceRef={id:randomUUID(),version:1,contentHash:digest({bodyHash,kind:'USER_INSTRUCTION'})},bodyRef={id:randomUUID(),version:1,contentHash:bodyHash};
 const parts=[{partIndex:1,byteOffset:0,utf8Bytes:Buffer.byteLength(body),contentHash:bodyHash}],partsRef={id:randomUUID(),version:1,contentHash:digest({bodyRef,parts})};
 const original={sourceRef,bodyRef,partsRef,originRef:sourceRef,contentHash:bodyHash,sourceBytes:Buffer.byteLength(body),mediaType:'text/plain;charset=utf-8' as const,parts};
 const mode={busy:false,revoked:false,failWrite:'',changeAfterWrite:false,reads:0,originalChanged:false,missingParent:false,requireUnlocked:false,txOpen:false,observeTransactions:[] as boolean[],authChange:'',finalAuthChange:false,commitLost:false,committedLost:false,discards:0,changedUser:randomUUID(),changedClient:randomUUID()};
 const request={...f.originCommand(),operation:'queueExecutionCommand',targetId:g.execution_id,expectedVersion:g.generation,approvalRef:null,payload:{grantRef,sessionBindingRef:fact.agentSession.sessionRef,instructionRef:sourceRef,partsRef,permissionPolicyRef:fact.permissionPolicyRef,budgetPolicyRef:fact.intent.budgetPolicyRef,reason:'명시 후속 지시'}};
 const stored=()=>f.tables.execution_commands!.filter(r=>r.snapshot_json.state==='NORMAL_INSTRUCTION_QUEUED');
 const source={async observe(scope:any,checkedAt:string,signal:AbortSignal){assert.equal(signal.aborted,false);assert.deepEqual(scope,{projectId:f.pid,executionId:g.execution_id,executionGeneration:g.generation,grantRef,instructionRef:sourceRef,partsRef:request.payload.partsRef});mode.reads++;mode.observeTransactions.push(mode.txOpen);if(mode.requireUnlocked)assert.equal(mode.txOpen,false,'external current must not wait under the project transaction');
  return {fact:{...structuredClone(fact),writerState:mode.changeAfterWrite&&stored().length?'UNKNOWN':'OWNED',checkedAt},turnState:mode.busy?'BUSY':'IDLE',stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:0,calls:1,spoolBytes:Buffer.byteLength(body),cost:null,costStatus:'VERIFIED_NO_CHARGE'},checkedAt,expiresAt:g.snapshot_json.expiresAt};}};
 // 원 저장행에서 파생하는 RAM 조회이며 SQL 함수 실행 증거는 아니다.
 const release=f.db.release.bind(f.db);f.db.release=(error?:Error)=>{if(error)mode.discards++;release(error);};
 f.db.query=async(sql:string,args:any[]=[])=>{
  if(sql==='BEGIN'){mode.txOpen=true;mode.committedLost=false;}
  if(sql==='COMMIT'){const out=await originalQuery(sql,args);mode.txOpen=false;if(mode.commitLost&&stored().length){mode.commitLost=false;mode.committedLost=true;throw Error('RAM_COMMIT_RESPONSE_LOST');}return out;}
  if(sql==='ROLLBACK'){mode.txOpen=false;if(mode.committedLost)return{rows:[]};}
  if(sql.startsWith('SELECT s.*,u.id AS uid')){const out=await originalQuery(sql,args),row=out.rows[0];
   if(mode.finalAuthChange&&stored().length)return{...out,rows:[{...row,id:randomUUID()}]};
   if(mode.authChange==='session')return{...out,rows:[{...row,id:randomUUID()}]};
   if(mode.authChange==='generation')return{...out,rows:[{...row,credential_generation:4,current_generation:4}]};
   if(mode.authChange==='user')return{...out,rows:[{...row,uid:mode.changedUser}]};
   if(mode.authChange==='client')return{...out,rows:[{...row,client_id:mode.changedClient}]};return out;
  }
  if(sql.startsWith('SELECT g.*,c.id AS start_id')){assert.deepEqual(args,[f.pid,g.execution_id,g.generation,g.id,g.version]);assert.equal(g.content_hash,digest(g.snapshot_json));assert.equal(start.created_command_id,g.command_id);return {rows:mode.missingParent?[]:[{...g,start_id:start.id,start_version:start.version,start_hash:start.content_hash,start_envelope_hash:start.envelope_hash,start_snapshot:start.snapshot_json}]};}
  if(sql.startsWith('SELECT * FROM anvil.normal_exchange_current(')){
   assert.deepEqual(args,[f.pid,fact.registration.connectorId,g.execution_id,g.id,g.version,g.content_hash,fact.executionCredentialReservation.generation]);if(mode.revoked||mode.changeAfterWrite&&stored().length)return{rows:[]};
   const policy=f.tables.limits!.find(r=>r.policy_id===fact.intent.budgetPolicyRef.id&&r.version===fact.intent.budgetPolicyRef.version)!;assert(policy);const at=(await originalQuery('SELECT clock_timestamp() AS at')).rows[0].at;
   return{rows:[{binding:{transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:f.pid,connectorId:fact.registration.connectorId,executionId:g.execution_id,executionGeneration:g.generation,grantRef,scopeDigest:g.snapshot_json.scopeDigest,credentialGeneration:fact.executionCredentialReservation.generation,publicKeyFingerprint:fact.registration.hostPublicKeyFingerprint},spki:f.registration!.connector.public_key_spki,deadline:new Date(g.snapshot_json.expiresAt),observed_at:at,budget_ref:fact.budgetReservationRef,budget_policy:{projectId:f.pid,ref:fact.intent.budgetPolicyRef,snapshot:policy.snapshot_json}}]};
  }
  if(sql.startsWith('SELECT EXISTS(SELECT 1 FROM anvil.execution_commands'))return{rows:[{stopped:false}]};
  if(sql.startsWith('SELECT count(*)::int AS count')&&sql.includes('NORMAL_INSTRUCTION_QUEUED'))return{rows:[{count:stored().length,total:stored().reduce((n,r)=>n+Buffer.byteLength(canonicalJson(r.snapshot_json)),0)}]};
  if(sql.startsWith('SELECT * FROM anvil.normal_instruction_record(')){assert.deepEqual(args,[f.pid,g.execution_id,g.generation,request.commandId]);return{rows:stored().filter(r=>r.snapshot_json.request.commandId===args[3]).map(r=>{const c=f.commands.get(r.created_command_id)!;assert(c);assert.equal(c.request_hash,digest(r.snapshot_json.request));assert(f.receipts.has(c.id));assert(f.audits.has(c.id));return{valid:true,snapshot_json:r.snapshot_json,original:structuredClone(original),result_ref:c.result_ref};})};}
  if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'SERVER_DENIAL'")&&(mode.authChange==='user'||mode.authChange==='client')){
   assert.equal(args[0],f.pid);assert.deepEqual(JSON.parse(args[2]),{kind:'HUMAN',userId:mode.authChange==='user'?mode.changedUser:f.actor.actorId});assert.equal(args[3],mode.authChange==='client'?mode.changedClient:f.actor.clientId);assert.equal(args[5],mode.authChange==='user'?'PROJECT_CONTROL_REQUIRED':'PROJECT_WRITE_DENIED');return{rows:[],rowCount:1};
  }
  const insert=/^INSERT INTO anvil\.(execution_commands|execution_material_manifests|execution_materials|delivery_outbox)\(([^)]+)\) VALUES\(([^)]+)\)$/.exec(sql);
  if(insert){if(mode.failWrite===insert[1])throw Error('RAM_WRITE_FAILED');const fields=insert[2]!.split(','),values=insert[3]!.split(','),row:any={};fields.forEach((k,i)=>{const v=values[i]!,x=v==='1'?1:args[Number(v.slice(1))-1];row[k]=['snapshot_json','authorization_ref','destination_ref','payload_ref'].includes(k)?JSON.parse(x):x;});
   const cid=row.created_command_id??row.command_id,c=f.commands.get(cid)!;assert(c&&c.state==='APPLIED');assert(f.receipts.has(cid)&&f.audits.has(cid));assert.equal(row.project_id,f.pid);
   if(row.grant_id){assert.equal(row.grant_id,g.id);assert.equal(row.grant_version,g.version);assert.equal(row.execution_id,g.execution_id);assert.equal(row.generation,g.generation);}
   if(insert[1]==='execution_commands'){const{request:q,envelope,...intent}=row.snapshot_json;assert.deepEqual(q,request);assert.equal(digest(intent),row.content_hash);assert.equal(envelope.commandId,request.commandId);assert.equal(c.result_ref.data.ref.contentHash,row.content_hash);}
   if(insert[1]==='execution_material_manifests'||insert[1]==='execution_materials')assert.equal(row.content_hash,digest(row.snapshot_json));
   if(insert[1]==='delivery_outbox'){assert.equal(row.kind,'EXECUTION_NORMAL');assert.equal(row.state,'PENDING');assert.equal(row.payload_ref.commandRef.contentHash,stored().at(-1)!.content_hash);}
   f.tables[insert[1]!]!.push(row);return{rows:[],rowCount:1};
  }
  return originalQuery(sql,args);
 };
 const originalSource={async read(db:any,actor:any,q:any){assert.equal(db,f.db);assert.equal(actor.actorId,f.actor.actorId);assert.deepEqual(q.payload.instructionRef,sourceRef);return {...structuredClone(original),...(mode.originalChanged?{contentHash:'0'.repeat(64)}:{})};}};
 const service=new NormalInstructionCommands(f.access,{mode:'NORMAL_PROTECTED',current:source},originalSource,f.limits);
 return {j,f,g,start,mode,request,original,service,stored,run:()=>service.command(f.token,f.csrf,request),close:()=>j.app.close()};
}

/** DB 조회 결과만 실제 appendConversation 생성행에서 도출한다. 원 reader/원 artifact 검산은 제품 코드를 호출한다. */
export async function instructionSourceFixture(base?:Awaited<ReturnType<typeof journey>>,instruction?:{text:string;mediaType:'text/plain;charset=utf-8'|'text/markdown;charset=utf-8'}){
 const j=base??await journey(),f=j.f,raw=f.db.query,conversations=new ProjectConversations(f.documents),source=new NormalInstructionSource(conversations);
 // 선택된 새 합성 본문은 RAM artifact 포트에 등록하고 원 appendConversation 제품 메서드로 새 메시지를 만든다.
 // 기존 START에서 참조한 메시지/원문은 수정하지 않는다.
 if(instruction){
  const bytes=Buffer.from(instruction.text,'utf8'),bodyRef={artifactId:randomUUID(),bytes:bytes.length,contentHash:contentHash(bytes),mediaType:instruction.mediaType};
  f.files.set(join(f.root,'blobs',f.pid,bodyRef.artifactId),bytes);
  f.docRows.set(randomUUID(),{content_json:{body:bodyRef}});
  const originalMessage=f.tables.messages!.find(r=>r.id===f.richSources!.messageRef.id)!.message_json.message;
  const command={schemaVersion:1 as const,projectId:f.pid,commandId:randomUUID(),clientId:f.cid,controlGeneration:1,operation:'appendConversation',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,
   payload:{conversationId:null,targetRoleRef:null,message:{...structuredClone(originalMessage),bodyRef,replyTo:null,supersedesInstructionRef:null},sourceRefs:[]}};
  const result=await f.run(actor=>conversations.append(f.db,actor,command,f.policyRef));
  Object.assign(f.richSources!,{conversationId:result.data.conversationId,messageRef:result.data.sourceRef});
 }
 // 기존 fixture가 생략한 메시지 command/client 열만 원 append 결과의 유일 역참조로 복원한다.
 for(const row of f.tables.messages!){const parents=[...f.commands.values()].filter(c=>c.operation==='appendConversation'&&c.result_ref?.data?.ref?.id===row.id&&c.result_ref.data.ref.contentHash===row.content_hash);assert.equal(parents.length,1);row.command_id=parents[0]!.id;row.client_id=parents[0]!.client_id;}
 const selected=f.richSources!,m=f.tables.messages!.find(r=>r.id===selected.messageRef.id)!;
 const mode={afterReadCorrection:false,metadataReads:0};
 f.db.query=async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT conversation_id FROM anvil.conversation_messages'))return{rows:f.tables.messages!.filter(v=>v.project_id===args[0]&&v.id===args[1]&&v.content_hash===args[2]).map(v=>({conversation_id:v.conversation_id}))};
  if(sql.startsWith('SELECT m.content_hash,m.kind,m.conversation_id,EXISTS')){mode.metadataReads++;const result=await raw(sql,args);return{rows:result.rows.map((r:any)=>({content_hash:r.content_hash,kind:r.kind,conversation_id:r.conversation_id,superseded:mode.afterReadCorrection&&mode.metadataReads>1?true:r.superseded}))};}
  if(sql.startsWith('SELECT m.command_id,m.client_id,m.message_json')){
   const rows=f.tables.messages!.filter(v=>v.project_id===args[0]&&v.conversation_id===args[1]&&v.id===args[2]).flatMap(v=>{
    const c=f.commands.get(v.command_id),r=f.receipts.get(v.command_id),a=f.audits.get(v.command_id);
    if(!c||!r||!a||r.id!==c.authorization_receipt_id||r.command_id!==c.id||r.scope_id!==v.project_id||a.command_id!==c.id||a.operation_id!==c.operation_id||a.outcome!=='APPLIED'||a.source_kind!=='HUMAN_COMMAND')return[];
    return[{...v,command_key:c.command_id,operation:c.operation,operation_id:c.operation_id,actor_id:c.actor_id,command_client:c.client_id,control_generation:c.control_generation,request_hash:c.request_hash,policy_ref:c.policy_ref,result_ref:c.result_ref,state:c.state,receipt_id:r.id,subject_ref:r.subject_ref,receipt_policy:r.policy_ref,receipt_scope:r.scope_digest,audit_actor:a.actor_ref,audit_client:a.client_ref,audit_target:a.target_ref,audit_policy:a.policy_ref,audit_scope:a.scope_digest,reason_code:a.reason_code}];
   });return{rows};
  }
  return raw(sql,args);
 };
 const args:any[]=[{},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root}];args[7]=null;args[18]=null;args[21]={mode:'NORMAL_PROTECTED'};
 const app=Reflect.apply(buildApp,undefined,args),url=`/api/v1/projects/${f.pid}/conversations/${m.conversation_id}/messages/${m.id}/instruction-parts`;
 const get=()=>app.inject({method:'GET',url,headers:{host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+f.token}});
 return{j,f,m,mode,source,conversations,app,url,get,read:()=>f.access.authenticated(f.token,null,(db,actor)=>conversations.instructionParts(db,actor,f.pid,m.conversation_id,m.id)),close:async()=>{await app.close();await j.app.close();}};
}

/** 모든 원 행은 START/appendConversation/SEND 제품 생산값이다. SQL 함수 실행 대신 exact RAM 관계를 검산한다. */
export async function normalInstructionDeliveryFixture(instruction?:{text:string;mediaType:'text/plain;charset=utf-8'|'text/markdown;charset=utf-8'}){
 const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
 let original:any;const bindings:any[]=[],permits:any[]=[],mode={failBinding:false,failPermit:false,busy:false};let tx=1000;
 const registered=(f:any,x:any)=>{const d=f.tables.execution_material_manifests.find((d:any)=>d.created_command_id===x.created_command_id);assert(d);return{command_record_id:x.id,manifest_ref:{id:d.id,version:1,contentHash:d.content_hash},manifest:d.snapshot_json,materials:f.tables.execution_materials.filter((m:any)=>m.manifest_id===d.id&&m.command_record_id===x.id).map((m:any)=>({ref:{id:m.id,version:1,contentHash:m.content_hash},snapshot:m.snapshot_json}))};};
 const sql:PageSqlAdapter=(s,a,{f,drafts,issued})=>{
  if(s.startsWith('SELECT v.content_hash AS vhash')){const v=drafts.find(x=>x.id===a[3]&&x.version===2),r=issued.find(x=>x.challenge_id===a[3]);return{rows:v?[{vhash:v.content_hash,consumed:v.snapshot_json,id:r?.id,content_hash:r?.content_hash,receipt:r?.snapshot_json}]:[]};}
  if(s.startsWith('SELECT * FROM anvil.normal_command_page_rows')){const[pid,eid,gid,gv,gen,after,ids]=a;return{rows:f.tables.execution_commands!.filter(x=>x.project_id===pid&&x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen).flatMap(x=>{
   const receipt=f.receipts.get(x.created_command_id)!,audit=f.audits.get(x.created_command_id)!,out=f.tables.delivery_outbox!.find(o=>o.command_id===x.created_command_id)!,ref={id:x.id,version:x.version,contentHash:x.content_hash};assert(receipt&&audit&&out);const sequence=audit.server_sequence;
   if(sequence<=after||ids&&!ids.includes(x.id))return[];const valid=receipt.id===x.authorization_ref.id&&audit.scope_digest===receipt.scope_digest&&canonicalJson(audit.target_ref)===canonicalJson(ref)&&canonicalJson(out.payload_ref.commandRef)===canonicalJson(ref)&&out.payload_ref.envelopeHash===x.envelope_hash&&out.payload_ref.grantRef.id===gid&&out.destination_ref.executionId===eid;
   return[{sequence:String(sequence),valid,command_ref:ref,envelope:x.snapshot_json.envelope,envelope_hash:x.envelope_hash}];
  }).sort((x,y)=>Number(x.sequence)-Number(y.sequence))};}
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_rows'))return{rows:f.tables.execution_commands!.filter(x=>x.project_id===a[0]&&a[1].includes(x.id)).map(x=>registered(f,x))};
  if(s.startsWith('SELECT * FROM anvil.normal_start_material_part')){const[pid,eid,gid,gv,gen,cmd,mid]=a;return{rows:f.tables.execution_commands!.filter(x=>x.project_id===pid&&x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen&&x.snapshot_json.envelope.commandId===cmd).flatMap(x=>{const r=registered(f,x);return r.materials.some((m:any)=>m.ref.id===mid)?[{...r,command_ref:{id:x.id,version:1,contentHash:x.content_hash},envelope:x.snapshot_json.envelope,envelope_hash:x.envelope_hash,options_body:x.snapshot_json.envelope.operation==='START_SESSION'?f.preparation.data.snapshot.options.body:''}]:[];})};}
  if(s.startsWith('SELECT * FROM anvil.normal_instruction_record('))return{rows:f.tables.execution_commands!.filter(x=>x.project_id===a[0]&&x.execution_id===a[1]&&x.generation===a[2]&&x.snapshot_json.request?.commandId===a[3]).map(x=>({valid:true,snapshot_json:x.snapshot_json,original,result_ref:f.commands.get(x.created_command_id)!.result_ref}))};
  if(s.startsWith('SELECT snapshot_json FROM anvil.execution_grants'))return{rows:f.tables.execution_grants!.filter(g=>g.project_id===a[0]&&g.id===a[1]&&g.version===a[2]&&g.content_hash===a[3]).map(g=>({snapshot_json:g.snapshot_json}))};
  if(s.startsWith('SELECT id,content_hash,snapshot_json,proof_result_id FROM anvil.execution_instruction_permits'))return{rows:permits.slice().sort((a,b)=>a.id.localeCompare(b.id)).slice(0,51)};
  if(s.startsWith('INSERT INTO anvil.execution_instruction_permits(')){
   if(mode.failPermit)throw Error('RAM_PERMIT_FAILED');const snapshot=JSON.parse(a[12]),command=f.tables.execution_commands!.find(c=>c.id===a[5]);assert(command);assert.equal(a[4],command.snapshot_json.request.commandId);assert.deepEqual(snapshot.commandRef,{id:command.id,version:1,contentHash:command.content_hash});assert.deepEqual(snapshot.reservationRef,command.snapshot_json.reservationRef);assert.equal(snapshot.reservationRef.id,a[8]);assert.notEqual(a[8],f.tables.execution_grants![0]!.snapshot_json.binding.budgetReservationRef.id);assert.equal(digest(snapshot),a[11]);assert(issued.some(r=>r.id===a[9]));assert(!permits.some(p=>p.snapshot_json.commandId===a[4]));permits.push({id:a[3],content_hash:a[11],snapshot_json:snapshot,proof_result_id:a[9]});return{rows:[],rowCount:1};
  }
  if(s==='SELECT txid_current()::text AS transaction_id')return{rows:[{transaction_id:String(tx)}]};
  if(s.startsWith('SELECT conversation_id FROM anvil.conversation_messages')||s.startsWith('SELECT m.command_id,m.client_id,m.message_json')||s.startsWith('SELECT m.content_hash,m.kind,m.conversation_id,EXISTS')||s.startsWith('SELECT * FROM anvil.conversation_messages')||s.includes('FROM anvil.artifacts')||s.includes('FROM anvil.artifact_'))return f.db.query(s,a) as any;
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&['NORMAL_COMMAND_PAGE','NORMAL_INSTRUCTION_MATERIAL','NORMAL_INSTRUCTION_PERMIT'].includes(JSON.parse(a[6]).kind)){issued.push({id:a[1],version:1,content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});return{rows:[],rowCount:1};}
  if(s.startsWith('INSERT INTO anvil.execution_material_proof_bindings(')){if(mode.failBinding)throw Error('RAM_BINDING_FAILED');const snapshot=JSON.parse(a[9]);assert.equal(digest(snapshot),a[8]);assert.equal(snapshot.materialRef.id,a[7]);assert(f.tables.execution_materials!.some(m=>m.id===a[7]));bindings.push({proof_result_id:a[1],snapshot_json:snapshot});return{rows:[],rowCount:1};}
  return undefined;
 };
 const cursors=new NormalPageCursors(randomBytes(32)),q=await normalInstructionFixture({sql,cursors}),x=await instructionSourceFixture(q.j,instruction),f=x.f,plan=await x.read(),fact=q.g.snapshot_json.binding;
 Object.assign(q.request.payload,{instructionRef:plan.instructionRef,partsRef:plan.partsRef});
 const current={async observe(_scope:unknown,checkedAt:string){return{fact:{...structuredClone(fact),writerState:'OWNED',checkedAt},turnState:mode.busy?'BUSY':'IDLE',stageRef:f.stage.data.snapshot.input.stageRef,demand:{attempts:0,calls:1,spoolBytes:plan.plan.bodyRef.bytes,cost:null,costStatus:'VERIFIED_NO_CHARGE'},checkedAt,expiresAt:q.g.snapshot_json.expiresAt};}};
 const service=new NormalInstructionCommands(f.access,{mode:'NORMAL_PROTECTED',current},x.source,f.limits),sent=await service.command(f.token,f.csrf,q.request);
 original=await f.access.authenticated(f.token,null,(db,actor)=>x.source.read(db,actor,q.request));
 const base=q.j.store.pool.connect;
 const pool={async connect(){const db=await base();let previous:any,committed=false;return{release:(error?:Error)=>db.release(error),async query(s:string,a:any[]=[]){
  if(s==='BEGIN'){const result=await db.query(s,a);previous=structuredClone({bindings,permits});tx++;return result;}
  if(s==='ROLLBACK'&&!committed&&previous){bindings.splice(0,bindings.length,...previous.bindings);permits.splice(0,permits.length,...previous.permits);}
  try{const result=await db.query(s,a);if(s==='COMMIT'&&'command'in result&&result.command==='COMMIT')committed=true;return result;}catch(error){if(s==='COMMIT'&&q.j.store.mode.lost)committed=true;throw error;}
 }}}};
 const args:any[]=[{},undefined,{repository:f.access,origin:'https://anvil-synthetic.invalid',artifactRoot:f.root}];args[7]=null;args[14]={pool,origin:'https://anvil-synthetic.invalid',cursors};args[15]={pool,origin:'https://anvil-synthetic.invalid'};args[16]={pool,origin:'https://anvil-synthetic.invalid'};args[18]=null;args[21]={mode:'NORMAL_PROTECTED',current};
 const app=Reflect.apply(buildApp,undefined,args),prefix=`/api/v1/connectors/${fact.registration.connectorId}/executions/${q.g.execution_id}`;
 await app.ready();
 const prepare=async(path:string,query:Record<string,unknown>={},body?:unknown)=>{
  const request=q.j.mk();request.target.path=path;request.target.queryHash=digest(query);if(body!==undefined){request.target.method='POST';request.target.bodyHash=digest(body);}const challenged=await q.j.post(q.j.signed(request));assert.equal(challenged.statusCode,200,challenged.body);const c=challenged.json(),proof={requestId:c.challenge.requestId,...request.target,grantRef:c.challenge.grantRef,credentialGeneration:c.challenge.credentialGeneration,serverNonce:c.challenge.serverNonce};
  const frame={schemaVersion:1,challengeRef:c.ref,proof,signature:q.j.signProof(proof)},search=new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)])).toString(),url=path+(search?'?'+search:'');
  return{frame,get:(override:any={})=>inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:override.tls!==false});app.routing(req,rep);},{method:body===undefined?'GET':'POST',url,...(body===undefined?{}:{payload:canonicalJson(body)}),headers:{...(body===undefined?{}:{'content-type':'application/json'}),host:'anvil-synthetic.invalid',authorization:'Bearer '+q.j.token,'anvil-execution-auth':Buffer.from(canonicalJson(override.frame??frame)).toString('base64url')}})};
 };
 return{q,x,f,app,prefix,sent,plan,bindings,permits,mode,prepare,close:async()=>{await app.close();await x.close();}};
}

/** 실제 handler를 RAM HTTPS로 연결한다. 파일/네트워크/등록 키 I/O는 하지 않는다. */
export async function normalInstructionRuntimeFixture(instruction?:Parameters<typeof normalInstructionDeliveryFixture>[0]){
 const h=await normalInstructionDeliveryFixture(instruction),j=h.q.j;
 const {EventEmitter}=await import('node:events');
 const {NormalProtectedGetClient}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');
 const {NormalProtectedPostClient}=await import('../../../apps/connector/runtime/normal-protected-post-client.ts');
 const calls:{path:string;body:unknown}[]=[],mode={wall:0,losePermit:false,mutatePermit:null as null|((v:any)=>void)};
 const request=(url:URL,options:any,callback:(r:any)=>void)=>{
  const req:any=new EventEmitter();req.destroy=()=>{};req.end=(body?:Buffer)=>{
   calls.push({path:url.pathname,body:body?JSON.parse(body.toString()):null});
   inject((rq,rp)=>{Object.defineProperty(rq.socket,'encrypted',{value:true});(url.pathname.endsWith('/challenges')?j.app:h.app).routing(rq,rp);},
    {method:options.method,url:url.pathname+url.search,headers:{host:url.host,...options.headers},...(body?{payload:body}:{})}).then(r=>{
     if(url.pathname.endsWith('/permit')&&mode.losePermit){req.emit('error',Error('RAM_RESPONSE_LOST'));return;}
     let payload=r.rawPayload;if(url.pathname.endsWith('/permit')&&mode.mutatePermit&&r.statusCode===200){const v=r.json();mode.mutatePermit(v);payload=Buffer.from(canonicalJson(v));}
     const res:any=new EventEmitter();res.destroy=()=>{};res.statusCode=r.statusCode;res.rawHeaders=Object.entries(r.headers).flatMap(([k,v])=>[k,String(v)]);
     callback(res);setImmediate(()=>{res.emit('data',payload);res.emit('end');});
    },e=>req.emit('error',e));
  };return req;
 };
 const first=h.f.tables.execution_commands![0]!,scope={projectId:h.f.pid,connectorId:h.f.registration!.row.connector_id,executionId:first.execution_id,executionGeneration:first.generation,grantRef:j.mk().grantRef,credentialGeneration:j.mk().credentialGeneration};
 const config={origin:'https://anvil-synthetic.invalid',ca:'RAM CA',credential:j.token,credentialExpiresAt:j.credentialExpiresAt,scope};
 const clock=()=>j.store.now().getTime()+mode.wall,ports={request:request as any,signer:{async sign(_purpose:any,bytes:Buffer){return j.signBytes(bytes);}},now:clock};
 const get=new NormalProtectedGetClient(config,ports),post=new NormalProtectedPostClient(config,ports);
 const current={transport:'NORMAL_PROTECTED' as const,async current(e:any,localAttemptRef:any){const fact=h.q.g.snapshot_json.binding;
  return{transport:'NORMAL_PROTECTED',key:{projectId:e.context.projectId,executionId:e.context.executionId,executionGeneration:e.context.executionGeneration,commandId:e.commandId},envelopeHash:e.envelopeHash,grantRef:scope.grantRef,localAttemptRef,
   sourceObservationRefs:[...new Map(e.context.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()],osOwnershipRef:fact.checks.osFence.evidenceRefs[0],checkedAt:new Date(clock()).toISOString(),expiresAt:new Date(Math.min(clock()+30000,Date.parse(e.expiresAt))).toISOString()};}};
 return{h,get,post,current,scope,clock,calls,mode,signal:new AbortController().signal};
}

/** 아래는 source 합성 시험의 내부 조립이다. current 대역을 실제 OS 권위로 표시하지 않는다. */
export async function normalInstructionDurableFixture(){
 const f=await normalInstructionRuntimeFixture(),{root,memoryFiles}=await import('./normal-start-local-fixture.ts');
 const {NormalStartFileStore}=await import('../../../apps/connector/runtime/normal-start-file-store.ts');
 const {NormalInstructionIntake,receiveNormalInstruction}=await import('../../../apps/connector/runtime/normal-instruction-intake.ts');
 const {NormalInstructionCoordinator}=await import('../../../apps/connector/runtime/normal-instruction-coordinator.ts');
 const page=await f.get.send(await f.get.prepareCommandPage({afterSequence:0,waitMs:0},f.signal),f.signal),start=page.items[0]!,item=page.items[1]!;
 const localScope={projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:f.scope.executionGeneration},fs=memoryFiles(),store=new NormalStartFileStore(root,localScope,fs.fs);
 const expected={context:start.envelope.context,executorRegistrationRef:start.envelope.executorRegistrationRef};
 const intake=new NormalInstructionIntake(store.instructionIntake(),expected,f.clock);
 const receive=()=>receiveNormalInstruction(f.get,intake,item,page.proofResultRef,f.signal);
 const make=(override:Record<string,unknown>={})=>new NormalInstructionCoordinator({intake,store:store.instructionAttempts(),post:f.post,current:f.current,grantRef:f.scope.grantRef,clock:f.clock,timeoutMs:10000,...override});
 return{...f,page,item,fs,store,intake,expected,localScope,receive,make};
}

/** SEND wire 전용 RAM 조립. 원 서버/수신/permit 생산은 위 기본 fixture를 그대로 사용한다. */
export async function normalInstructionWireFixture(timeoutMs=10000){
 const f=await normalInstructionDurableFixture();await f.receive();
 const {NormalInstructionWire}=await import('../../../apps/connector/adapters/secondary/normal-instruction-wire.ts');
 const c=f.make({timeoutMs}),prepared=await c.prepare(f.item.envelope,f.signal);
 assert.equal(prepared.state,'PERMIT_RECORDED');
 const rows=()=>[...f.fs.files.entries()].filter(([p])=>p.includes('attempt-'+f.item.envelope.commandId)&&p.endsWith('.json')).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>JSON.parse(v.bytes.toString()));
 const observed={transport:'NORMAL_PROTECTED' as const,responseRef:{id:randomUUID(),version:1,contentHash:'a'.repeat(64)},processRef:null};
 let driverCalls=0;const driver={async send(_input:any,_signal:AbortSignal){driverCalls++;return observed;}};
 const wire=new NormalInstructionWire({driver});
 return{...f,c,prepared,rows,observed,driver,wire,driverCalls:()=>driverCalls,wireWith:(send:(input:any,signal:AbortSignal)=>Promise<any>)=>new NormalInstructionWire({driver:{send}})};
}
