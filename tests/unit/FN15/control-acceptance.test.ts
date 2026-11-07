import test from 'node:test';import assert from 'node:assert/strict';
import {requestBundle,projectId,baseControl,now,controller,controllerClient} from './control-handoff-summary-fixture.ts';
const load=()=>import('../../../apps/server/modules/control-handoff/control-acceptance.ts');
function fixture(){
 let calls=0,releases=0,commitLost=false;const releaseErrors:unknown[]=[];const control=structuredClone(baseControl);const rows=new Map<string,Record<string,unknown>[]>(),request=requestBundle(),auth={actorId:controller,clientId:controllerClient,serverOwner:false,credentialGeneration:1,reauthUntil:new Date(Date.parse(now)+60000),authSession:{id:projectId,idleExpiresAt:new Date(Date.parse(now)+60000).toISOString(),absoluteExpiresAt:new Date(Date.parse(now)+120000).toISOString()}},logs:string[]=[];
 const db={release(error?:unknown){releases++;releaseErrors.push(error);},async query(sql:string,args:unknown[]=[]):Promise<{rows:any[];rowCount:number}>{calls++;logs.push(sql);
  if(['BEGIN','ROLLBACK'].includes(sql))return{rows:[],rowCount:0};if(sql==='COMMIT'){if(commitLost){commitLost=false;throw Error('COMMIT_REPLY_LOST');}return{rows:[],rowCount:0};}
  if(sql.includes('schema_migrations')){const m=await load();return{rows:[{id:m.controlAcceptanceMigration,checksum:m.controlAcceptanceChecksum}],rowCount:1};}
  if(sql.includes('FROM anvil.projects'))return{rows:[{id:projectId,archived_at:null}],rowCount:1};
  if(sql.includes('FROM anvil.project_members'))return{rows:[{project_id:projectId,user_id:auth.actorId,participation:auth.actorId===controller?'OWNER':'HANDOFF_ELIGIBLE',revoked_at:null}],rowCount:1};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{project_id:projectId,actor_id:control.actorId,client_id:control.clientId,generation:control.generation,version:control.version,revoked_at:null}],rowCount:1};
  if(sql.startsWith('UPDATE anvil.project_control')){if(control.actorId!==args[6]||control.clientId!==args[7]||control.generation!==args[8]||control.version!==args[9])return{rows:[],rowCount:0};Object.assign(control,{actorId:args[1],clientId:args[2],generation:args[3],version:args[4]});return{rows:[],rowCount:1};}
  if(sql.includes('clock_timestamp'))return{rows:[{at:new Date(now)}],rowCount:1};
  if(sql.includes('pg_advisory_xact_lock'))return{rows:[{}],rowCount:1};
  if(sql.includes('fn15_handoff_request_bundle'))return{rows:[{bundle:structuredClone(request)}],rowCount:1};
  if(sql.includes('fn15_handoff_facts'))return{rows:[{packet:{projectId,requestRef:request.request.requestRef,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null}}],rowCount:1};
  if(sql.includes('fn15_control_storage_reserve'))return{rows:[{plan_hash:args[4],reserved_bytes:args[5]}],rowCount:1};
  if(sql.startsWith('INSERT INTO anvil.')){const match=/INSERT INTO anvil\.(\w+)\(([^)]+)\)/.exec(sql)!;const table=match[1]!,keys=match[2]!.split(','),row=Object.fromEntries(keys.map((k,i)=>[k,k.endsWith('_json')||k.endsWith('_ref')?JSON.parse(String(args[i])):args[i]]));rows.set(table,[...(rows.get(table)??[]),row]);return{rows:[],rowCount:1};}
  if(sql.includes('fn15_control_storage_actual')){const cid=args[1],handoffs=(rows.get('control_handoffs')??[]).filter(r=>r.command_id===cid),acceptanceIds=new Set(handoffs.map(r=>r.id)),all=[...(rows.get('control_handoff_protected_summaries')??[]).filter(r=>r.source_command_id===cid).map(r=>({table:'control_handoff_protected_summaries',row:r})),...handoffs.map(r=>({table:'control_handoffs',row:r})),...['REVOKED','ISSUED'].flatMap(kind=>(rows.get('control_grant_events')??[]).filter(r=>acceptanceIds.has(r.acceptance_id)&&r.kind===kind).map(r=>({table:'control_grant_events',row:r}))),...['control_handoff_acceptance_commands','control_handoff_acceptance_receipts','control_handoff_acceptance_audits'].flatMap(table=>(rows.get(table)??[]).filter(r=>r.command_id===cid).map(row=>({table,row})))].map(({table,row:r})=>({table,id:String(r.id??r.request_id??r.command_id),projection:r}));return{rows:[{rows_json:all}],rowCount:1};}
  if(sql.includes('fn15_control_storage_settle'))return{rows:[{settled_bytes:args[2]}],rowCount:1};
  if(sql.includes('FROM anvil.control_handoffs')){const h=(rows.get('control_handoffs')??[]).find(r=>sql.includes('h.next_generation=$2')?Number(r.next_generation)===args[1]:r.command_id===args[1]);if(!h)return{rows:[],rowCount:0};const c=(rows.get('control_handoff_acceptance_commands')??[]).filter(r=>r.command_id===h.command_id);return{rows:[{...h,revoked_count:String((rows.get('control_grant_events')??[]).filter(e=>(e.kind??(e.snapshot_json as any).kind)==='REVOKED'&&Number(e.basis_generation??(e.snapshot_json as any).basis.generation)===Number(h.next_generation)).length),grant_rows:(rows.get('control_grant_events')??[]).filter(r=>r.acceptance_id===h.id).map(r=>({ref:{id:r.id,version:1,contentHash:r.content_hash},snapshot:r.snapshot_json})).sort((a,b)=>String((a.snapshot as any).kind).localeCompare(String((b.snapshot as any).kind))),command_rows:c.map(r=>({command:r.command_json,result:r.result_json,commandHash:r.command_hash,resultHash:r.result_hash})),receipt_rows:(rows.get('control_handoff_acceptance_receipts')??[]).filter(r=>r.command_id===h.command_id).map(r=>({ref:{id:r.id,version:1,contentHash:r.content_hash},snapshot:r.body_json})),audit_rows:(rows.get('control_handoff_acceptance_audits')??[]).filter(r=>r.command_id===h.command_id).map(r=>({ref:{id:r.id,version:1,contentHash:r.content_hash},snapshot:r.body_json}))}],rowCount:1};}
  if(sql.includes('FROM anvil.control_handoff_acceptance_commands'))return{rows:(rows.get('control_handoff_acceptance_commands')??[]).filter(r=>r.command_id===args[1]),rowCount:0};
  if(sql.includes('FROM anvil.control_handoff_protected_summaries'))return{rows:(rows.get('control_handoff_protected_summaries')??[]).filter(r=>r.request_id===args[1]&&(args.length<4||Number(r.version)===args[2]&&r.content_hash===args[3])).sort((a,b)=>Number(b.version)-Number(a.version)).slice(0,sql.includes('LIMIT 1')?1:undefined),rowCount:0};
  throw Error('UNMODELED_SQL '+sql);
 }};
 const access={authenticateInTransaction:async(receiver:unknown,token:string,csrf:string)=>{assert.equal(receiver!==db,true);assert.equal(token,'memory-token');assert.equal(csrf,'memory-csrf');return auth;}};
 return{pool:{connect:async()=>db},access,rows,control,request,logs,auth,clock:{now:()=>Date.parse(now),monotonic:()=>0},lost:()=>{commitLost=true;},releaseErrors,counts:()=>({calls,releases})};
}
test('실제 source 준비는 고정 reader→UNKNOWN 보호요약→F 예약/실행/정산→원 결과 replay를 연결한다',async()=>{
 const m=await load(),f=fixture(),service=new m.ControlAcceptanceService(f as never),command={schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-000000000011',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}};
 assert.equal(f.counts().calls,0);const session=service.forSession('memory-token','memory-csrf',projectId),result=await session.prepare(command);
 assert.equal(result.snapshot.transferState,'UNKNOWN');assert.equal(f.rows.get('control_handoff_protected_summaries')?.length,1);assert.equal(f.logs.some(x=>x.includes('fn15_control_storage_actual')),true);
 const before=[...f.rows.values()].reduce((n,v)=>n+v.length,0);assert.deepEqual(await session.prepare(command),result);assert.equal([...f.rows.values()].reduce((n,v)=>n+v.length,0),before);assert.equal(f.counts().releases,2);
});
test('COMMIT 응답유실은 원 commandId의 UNKNOWN을 보존하고 자동 새 명령을 만들지 않는다',async()=>{
 const m=await load(),f=fixture(),service=new m.ControlAcceptanceService(f as never),command={schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-000000000012',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}};f.lost();
 await assert.rejects(()=>service.forSession('memory-token','memory-csrf',projectId).prepare(command),(e:unknown)=>e instanceof m.ControlAcceptanceFailure&&e.code==='CONTROL_ACCEPTANCE_OUTCOME_UNKNOWN'&&e.commandId===command.commandId);
 assert.equal(f.rows.get('control_handoff_protected_summaries')?.length,1);assert.equal(f.counts().releases,1);
});

test('v2 준비 뒤 exact GET은 과거 v1 원문을 보존하고 최신 조회와 분리한다',async()=>{
 const m=await load(),f=fixture(),session=new m.ControlAcceptanceService(f as never).forSession('memory-token','memory-csrf',projectId);
 const command=(n:string)=>({schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-'+n,projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}});
 const first=await session.prepare(command('000000000021')),second=await session.prepare(command('000000000022'));assert.equal(second.ref.version,2);
 assert.deepEqual(await session.readSummary(f.request.request.requestRef,first.ref),first);
 const facts=f.logs.filter(x=>x.includes('fn15_handoff_facts')).length;f.auth.actorId=f.request.request.snapshot.targetActorRef.userId;f.auth.clientId=f.request.request.snapshot.targetClientRef.clientId;
 await assert.rejects(()=>session.accept({schemaVersion:1,operation:'acceptControl',commandId:'88888888-8888-4888-8888-000000000023',projectId,clientId:f.auth.clientId,payload:{requestRef:f.request.request.requestRef,summaryVersion:1,reason:'옛 요약 수락 금지'}}),(e:unknown)=>e instanceof m.ControlAcceptanceFailure&&e.statusCode===409);assert.equal(f.logs.filter(x=>x.includes('fn15_handoff_facts')).length,facts);
});

function manualClock(){let mono=0;const jobs=new Map<number,()=>void>();const scheduled:number[]=[];let id=0;return{scheduled,clock:{now:()=>Date.parse(now),monotonic:()=>mono,schedule:(fn:()=>void,_ms:number)=>{scheduled.push(_ms);jobs.set(++id,fn);return id;},cancel:(n:unknown)=>{jobs.delete(Number(n));}},expire(at=30001){mono=at;for(const [n,fn]of [...jobs]){jobs.delete(n);fn();}}};}
const turns=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
test('pool connect 미정착 중 원30초 종료는 응답만 bounded 종료하고 늦은 client를 BEGIN 없이 회수한다',async()=>{
 const m=await load(),f=fixture(),client=await f.pool.connect(),clock=manualClock();let resolve!:(v:typeof client)=>void;const pending=new Promise<typeof client>(r=>resolve=r);f.pool.connect=()=>pending;
 const service=new m.ControlAcceptanceService({...f,clock:clock.clock}as never),command={schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-000000000031',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}};
 let outcome='PENDING';const external=service.forSession('memory-token','memory-csrf',projectId).prepare(command).then(()=>{outcome='SUCCESS';},e=>{outcome=e.code;});await turns();clock.expire();await turns();assert.equal(outcome,'CONTROL_ACCEPTANCE_TIME_LIMIT');assert.equal(f.logs.length,0);assert.equal(f.counts().releases,0);
 resolve(client);await external;await turns();assert.equal(f.logs.length,0);assert.equal(f.counts().releases,1);
});
test('raw query 미정착이면 bounded 응답 뒤에도 원 query 정착 전 rollback/release와 새 query가 없다',async()=>{
 const m=await load(),f=fixture(),client=await f.pool.connect(),clock=manualClock(),query=client.query.bind(client);let resolve!:(v:{rows:any[];rowCount:number})=>void;const pending=new Promise<{rows:any[];rowCount:number}>(r=>resolve=r);let entered=false;
 client.query=async(sql:string,args:unknown[]=[])=>{if(sql.includes('FROM anvil.projects')){entered=true;return pending;}return query(sql,args);};
 const command={schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-000000000032',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}};
 let outcome='PENDING';const external=new m.ControlAcceptanceService({...f,clock:clock.clock}as never).forSession('memory-token','memory-csrf',projectId).prepare(command).then(()=>{outcome='SUCCESS';},e=>{outcome=e.code;});await turns();assert.equal(entered,true);const before=f.logs.length;clock.expire();await turns();assert.equal(outcome,'CONTROL_ACCEPTANCE_TIME_LIMIT');assert.equal(f.logs.length,before);assert.equal(f.counts().releases,0);
 resolve({rows:[{id:projectId,archived_at:null}],rowCount:1});await external;await turns();assert.equal(f.logs.at(-1),'ROLLBACK');assert.equal(f.logs.filter(x=>x==='ROLLBACK').length,1);assert.equal(f.counts().releases,1);assert.equal(f.logs.some(x=>x.includes('FROM anvil.project_members')),false);
});

test('짧은 session100ms 최소기한은 pending query 응답timer도 줄이고 COMMIT불명 연결은 폐기한다',async()=>{
 const m=await load(),f=fixture(),client=await f.pool.connect(),clock=manualClock(),query=client.query.bind(client);f.auth.authSession.idleExpiresAt=new Date(Date.parse(now)+100).toISOString();
 let resolve!:(v:{rows:any[];rowCount:number})=>void;const pending=new Promise<{rows:any[];rowCount:number}>(r=>resolve=r);client.query=async(sql:string,args:unknown[]=[])=>sql.includes('FROM anvil.projects')?pending:query(sql,args);
 let outcome='PENDING';const command={schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-000000000033',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}};
 const operation=new m.ControlAcceptanceService({...f,clock:clock.clock}as never).forSession('memory-token','memory-csrf',projectId).prepare(command).catch(e=>{outcome=e.code;});await turns();assert.ok(clock.scheduled.some(ms=>ms<=100));clock.expire(101);await turns();assert.equal(outcome,'CONTROL_ACCEPTANCE_TIME_LIMIT');assert.equal(f.counts().releases,0);resolve({rows:[{id:projectId,archived_at:null}],rowCount:1});await operation;await turns();assert.equal(f.counts().releases,1);
 const g=fixture();g.lost();await assert.rejects(()=>new m.ControlAcceptanceService(g as never).forSession('memory-token','memory-csrf',projectId).prepare({...command,commandId:'88888888-8888-4888-8888-000000000034'}));assert.ok(g.releaseErrors[0] instanceof Error);
});


test('정확 target의 보호 head 발견은 저장 원문만 읽고 만료·다른 target은 수락 근거를 만들지 않는다',async()=>{
 const m=await load(),f=fixture(),service=new m.ControlAcceptanceService(f as never),command={schemaVersion:1 as const,operation:'prepareControlHandoff' as const,commandId:'88888888-8888-4888-8888-000000000051',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}};
 const stored=await service.forSession('memory-token','memory-csrf',projectId).prepare(command);f.auth.actorId=f.request.request.snapshot.targetActorRef.userId;f.auth.clientId=f.request.request.snapshot.targetClientRef.clientId;
 const target=service.forSession('memory-token','memory-csrf',projectId),before=f.logs.filter(x=>x.includes('fn15_handoff_facts')).length;
 const head=await target.readHead(f.request.request.requestRef);assert.equal(head.schemaVersion,2);assert.deepEqual(head.head,{state:'AVAILABLE',summaryRef:stored.ref});assert.equal(f.logs.filter(x=>x.includes('fn15_handoff_facts')).length,before);
 f.auth.clientId='99999999-9999-4999-8999-000000000099';await assert.rejects(()=>target.readHead(f.request.request.requestRef));
 f.auth.clientId=f.request.request.snapshot.targetClientRef.clientId;f.clock.now=()=>Date.parse(now)+21000;const expired=await target.readHead(f.request.request.requestRef);assert.deepEqual(expired.head,{state:'UNKNOWN',summaryRef:null});
});


test('과거 성공 GET/POST replay도 실제 물리 receipt 누락을 거절하고 현재 control로 역사를 지우지 않는다',async()=>{
 const m=await load(),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),f=fixture();f.auth.actorId=f.request.request.snapshot.targetActorRef.userId;f.auth.clientId=f.request.request.snapshot.targetClientRef.clientId;
 const command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:'88888888-8888-4888-8888-000000000061',projectId,clientId:f.auth.clientId,payload:{requestRef:f.request.request.requestRef,summaryVersion:1,reason:'과거 성공 조회'}};
 const id=(n:number)=>'99999999-9999-4999-8999-'+String(n).padStart(12,'0'),chain=g.createControlAcceptanceChain({projectId,command,requestRef:f.request.request.requestRef,summaryRef:{id:f.request.request.requestRef.id,version:1,contentHash:'a'.repeat(64)},before:baseControl,targetActorId:f.auth.actorId,recordedAt:now,ids:{acceptance:id(1),revocation:id(2),grant:id(3),receipt:id(4),audit:id(5)}});
 f.rows.set('control_handoff_acceptance_commands',[{project_id:projectId,command_id:command.commandId,operation:'acceptControl',actor_id:f.auth.actorId,client_id:f.auth.clientId,command_hash:g.controlHash(command),command_json:command,result_hash:g.controlHash(chain.result),result_json:chain.result}]);
 f.rows.set('control_handoffs',[{project_id:projectId,id:chain.acceptance.ref.id,command_id:command.commandId,next_generation:chain.result.nextControl.generation,content_hash:chain.acceptance.ref.contentHash,snapshot_json:chain.acceptance.snapshot,bundle_json:chain}]);
 f.rows.set('control_grant_events',[chain.grant,chain.revocation].map(e=>({project_id:projectId,id:e.ref.id,content_hash:e.ref.contentHash,snapshot_json:e.snapshot,acceptance_id:chain.acceptance.ref.id})));
 f.rows.set('control_handoff_acceptance_audits',[{id:chain.audit.ref.id,content_hash:chain.audit.ref.contentHash,body_json:chain.audit.snapshot,command_id:command.commandId}]);
 const session=new m.ControlAcceptanceService(f as never).forSession('memory-token','memory-csrf',projectId);
 await assert.rejects(()=>session.readResult(command.commandId,g.controlHash(command)));await assert.rejects(()=>session.accept(command));
 f.rows.set('control_handoff_acceptance_receipts',[{id:chain.receipt.ref.id,content_hash:chain.receipt.ref.contentHash,body_json:chain.receipt.snapshot,command_id:command.commandId}]);
 assert.deepEqual(await session.readResult(command.commandId,g.controlHash(command)),chain.result);assert.deepEqual(await session.accept(command),chain.result);assert.equal(f.logs.some(x=>x.includes('fn15_handoff_facts')),false);assert.equal(f.logs.some(x=>x.startsWith('INSERT')||x.startsWith('UPDATE')),false);
});


/** 실제 SQL/PG 대역임을 명시한다. private evidence factory/원 저장·CAS·물리 readback은 production source를 실행한다. */
async function managedFixture(){
 const f=fixture(),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),db=await f.pool.connect(),query=db.query.bind(db),names=["executions","execution_grants","usage_reservations","writer_claims","execution_commands","delivery_outbox","execution_credentials","execution_challenges","execution_receipts","execution_observations","execution_acknowledgements","execution_observation_results","execution_start_permits","execution_instruction_permits","execution_grant_revocations","project_writer_authority_events","project_writer_authority_heads","execution_ownership_events","execution_ownership_observations","execution_ownership_anchors","execution_ownership_bindings","execution_ownership_heads","native_preparation_authorities","native_preparation_authority_events","execution_preparations","execution_preparation_approval_candidates","understanding_reviews","stage_runs","queue_requests","project_storage_reservations","context_bundles","context_items","assignment_versions","source_roots","source_root_versions","project_source_declarations","project_roles","agent_sessions","role_bindings","execution_material_manifests","execution_materials","execution_material_proof_bindings"];
 db.query=async(sql:string,args:unknown[]=[])=>{if(!sql.includes('fn15_handoff_facts'))return query(sql,args);
  const result=await query(sql,args),packet=result.rows[0]!.packet,requestRef=JSON.parse(String(args[4])),subject={sessionId:args[0],actorId:args[1],clientId:args[2]};
  const birth={intentId:projectId,draftId:projectId,draftVersion:1,commandRef:{id:projectId,version:1,contentHash:'b'.repeat(64)},requestHash:'b'.repeat(64),receiptId:projectId,scopeDigest:'c'.repeat(64),auditEventId:projectId,auditScopeDigest:'c'.repeat(64),initialControl:{actorId:controller,clientId:controllerClient,generation:1,version:1},anchorHash:'d'.repeat(64)};
  const snapshot={schemaVersion:1,purpose:'FN15_CLOSED_MANAGED_ABSENCE',projectId,requestRef,baseControl,subject,birth,sources:names.map(table=>({table,rows:(f.rows.get(table)??[]).length?[{projectId}]:[]})),guardHash:"c210cba4f937b35290c98e4dfbbc5d46c383f1ed2c704e65400cc15e38c577c4",observedAt:now,expiresAt:f.request.request.snapshot.expiresAt};
  return{rows:[{packet:{...packet,emptyClosure:{snapshot,contentHash:g.controlHash(snapshot)}}}],rowCount:1};
 };
 // 동일 project의 메모리 transaction을 직렬화한다. rollback은 소유 map/control만 복원하고 COMMIT reply 유실은 apply된 결과를 보존한다.
 let tail:Promise<void>=Promise.resolve();f.pool.connect=async()=>{const previous=tail;let unlock!:()=>void;tail=new Promise<void>(r=>unlock=r);await previous;const before=structuredClone(f.rows),beforeControl=structuredClone(f.control);let commitAttempted=false;
  return{query:async(sql:string,args:unknown[]=[])=>{if(sql==='COMMIT')commitAttempted=true;if(sql==='ROLLBACK'&&!commitAttempted){f.rows.clear();for(const[k,v]of before)f.rows.set(k,v);Object.assign(f.control,beforeControl);}return db.query(sql,args);},release(error?:unknown){db.release(error);unlock();}};
 };
 const service=new(await load()).ControlAcceptanceService(f as never),prepare={schemaVersion:1 as const,operation:'prepareControlHandoff' as const,commandId:'88888888-8888-4888-8888-000000000071',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}},summary=await service.forSession('memory-token','memory-csrf',projectId).prepare(prepare);
 assert.equal(summary.snapshot.transferState,'READY');f.auth.actorId=f.request.request.snapshot.targetActorRef.userId;f.auth.clientId=f.request.request.snapshot.targetClientRef.clientId;f.auth.authSession.id='99999999-9999-4999-8999-000000000072';
 const accept={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:'88888888-8888-4888-8888-000000000073',projectId,clientId:f.auth.clientId,payload:{requestRef:f.request.request.requestRef,summaryVersion:summary.ref.version,reason:'명시 수락'}};
 return{...f,service,summary,accept};
}
test('고정 EMPTY source→READY 요약→실제 수락 저장/CAS/물리 readback과 replay를 한 메모리 호출선으로 연결한다',async()=>{
 const f=await managedFixture(),m=await load(),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),session=f.service.forSession('memory-token','memory-csrf',projectId),result=await session.accept(f.accept);
 assert.equal(result.nextControl.actorId,f.auth.actorId);assert.equal(result.nextControl.generation,baseControl.generation+1);assert.deepEqual(f.control,result.nextControl);assert.equal(f.rows.get('control_handoffs')?.length,1);assert.equal(f.rows.get('control_grant_events')?.length,2);
 const before=f.logs.length;assert.deepEqual(await session.accept(f.accept),result);assert.equal(f.logs.slice(before).some(x=>x.startsWith('INSERT')||x.startsWith('UPDATE')||x.includes('fn15_handoff_facts')),false);
 assert.deepEqual(await session.readResult(f.accept.commandId,g.controlHash(f.accept)),result);
 f.auth.actorId=controller;f.auth.clientId=controllerClient;f.auth.authSession.id=projectId;await assert.rejects(()=>f.service.forSession('memory-token','memory-csrf',projectId).prepare({schemaVersion:1,operation:'prepareControlHandoff',commandId:'88888888-8888-4888-8888-000000000074',projectId,clientId:controllerClient,payload:{requestRef:f.request.request.requestRef}}),(e:unknown)=>e instanceof m.ControlAcceptanceFailure&&e.statusCode===403);
 assert.equal(f.logs.some(x=>x.startsWith('UPDATE anvil.execution_')||x.startsWith('INSERT INTO anvil.execution_')||x.startsWith('DELETE')),false);
});
test('보관 READY 뒤 현재 SYNTHETIC issuer가 있으면 수락/CAS0이고 실행/credential를 바꾸지 않는다',async()=>{
 const f=await managedFixture(),m=await load();f.rows.set('execution_credentials',[{project_id:projectId,transport:'SYNTHETIC_ONLY'}]);const before=structuredClone(f.rows),generation=f.control.generation;
 await assert.rejects(()=>f.service.forSession('memory-token','memory-csrf',projectId).accept(f.accept),(e:unknown)=>e instanceof m.ControlAcceptanceFailure&&e.code==='CONTROL_HANDOFF_NOT_READY');assert.equal(f.control.generation,generation);assert.deepEqual(f.rows,before);assert.equal(f.logs.some(x=>x.startsWith('UPDATE anvil.execution_')||x.startsWith('DELETE')),false);
});


test('READY 수락 COMMIT 응답 유실은 원 결과 GET으로만 확인하고 새 발급 없이 물리 결과를 보존한다',async()=>{
 const f=await managedFixture(),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),session=f.service.forSession('memory-token','memory-csrf',projectId);f.lost();
 await assert.rejects(()=>session.accept(f.accept),(e:unknown)=>e instanceof Error&&e.message.includes('UNKNOWN'));
 assert.equal(f.rows.get('control_handoffs')?.length,1);assert.equal(f.rows.get('control_grant_events')?.length,2);assert.equal(f.control.generation,baseControl.generation+1);
 const count=f.logs.length,result=await session.readResult(f.accept.commandId,g.controlHash(f.accept));assert.equal(result.commandId,f.accept.commandId);assert.equal(f.logs.slice(count).some(x=>x.startsWith('INSERT')||x.startsWith('UPDATE')||x.includes('fn15_handoff_facts')),false);assert.equal(f.rows.get('control_grant_events')?.length,2);
});

test('동일 READY의 다른 두 수락은 하나만 CAS·발급하며 동일 명령 경합은 원 결과를 재조회한다',async()=>{
 const f=await managedFixture(),session=f.service.forSession('memory-token','memory-csrf',projectId),other={...f.accept,commandId:'88888888-8888-4888-8888-000000000081'};
 const outcomes=await Promise.allSettled([session.accept(f.accept),session.accept(other)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);assert.equal(f.rows.get('control_handoffs')?.length,1);assert.equal(f.rows.get('control_grant_events')?.length,2);assert.equal(f.control.generation,baseControl.generation+1);
 const h=await managedFixture(),own=h.service.forSession('memory-token','memory-csrf',projectId),results=await Promise.all([own.accept(h.accept),own.accept(h.accept)]);assert.deepEqual(results[0],results[1]);assert.equal(h.rows.get('control_handoffs')?.length,1);assert.equal(h.rows.get('control_grant_events')?.length,2);
});
