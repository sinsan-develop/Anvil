import test from 'node:test';import assert from 'node:assert/strict';
import {requestBundle,projectId,baseControl,now,controller,controllerClient} from './control-handoff-summary-fixture.ts';
const load=()=>import('../../../apps/server/modules/control-handoff/control-acceptance.ts');
function fixture(){
 let calls=0,releases=0,commitLost=false;const releaseErrors:unknown[]=[];const rows=new Map<string,Record<string,unknown>[]>(),request=requestBundle(),auth={actorId:controller,clientId:controllerClient,serverOwner:false,credentialGeneration:1,reauthUntil:new Date(Date.parse(now)+60000),authSession:{id:projectId,idleExpiresAt:new Date(Date.parse(now)+60000).toISOString(),absoluteExpiresAt:new Date(Date.parse(now)+120000).toISOString()}},logs:string[]=[];
 const db={release(error?:unknown){releases++;releaseErrors.push(error);},async query(sql:string,args:unknown[]=[]):Promise<{rows:any[];rowCount:number}>{calls++;logs.push(sql);
  if(['BEGIN','ROLLBACK'].includes(sql))return{rows:[],rowCount:0};if(sql==='COMMIT'){if(commitLost){commitLost=false;throw Error('COMMIT_REPLY_LOST');}return{rows:[],rowCount:0};}
  if(sql.includes('schema_migrations')){const m=await load();return{rows:[{id:m.controlAcceptanceMigration,checksum:m.controlAcceptanceChecksum}],rowCount:1};}
  if(sql.includes('FROM anvil.projects'))return{rows:[{id:projectId,archived_at:null}],rowCount:1};
  if(sql.includes('FROM anvil.project_members'))return{rows:[{project_id:projectId,user_id:auth.actorId,participation:auth.actorId===controller?'OWNER':'HANDOFF_ELIGIBLE',revoked_at:null}],rowCount:1};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{project_id:projectId,actor_id:baseControl.actorId,client_id:baseControl.clientId,generation:baseControl.generation,version:baseControl.version,revoked_at:null}],rowCount:1};
  if(sql.includes('clock_timestamp'))return{rows:[{at:new Date(now)}],rowCount:1};
  if(sql.includes('pg_advisory_xact_lock'))return{rows:[{}],rowCount:1};
  if(sql.includes('fn15_handoff_request_bundle'))return{rows:[{bundle:structuredClone(request)}],rowCount:1};
  if(sql.includes('fn15_handoff_facts'))return{rows:[{packet:{projectId,requestRef:request.request.requestRef,baseControl,writer:{head:null,events:[],commands:[],receipts:[],audits:[],approvals:[]},executions:[],pendingCommands:[],pendingApprovals:[],checkpoints:[],proofBasis:null}}],rowCount:1};
  if(sql.includes('fn15_control_storage_reserve'))return{rows:[{plan_hash:args[4],reserved_bytes:args[5]}],rowCount:1};
  if(sql.startsWith('INSERT INTO anvil.')){const match=/INSERT INTO anvil\.(\w+)\(([^)]+)\)/.exec(sql)!;const table=match[1]!,keys=match[2]!.split(','),row=Object.fromEntries(keys.map((k,i)=>[k,k.endsWith('_json')||k.endsWith('_ref')?JSON.parse(String(args[i])):args[i]]));rows.set(table,[...(rows.get(table)??[]),row]);return{rows:[],rowCount:1};}
  if(sql.includes('fn15_control_storage_actual')){const all=[...rows.entries()].flatMap(([table,values])=>values.filter(r=>r.command_id===args[1]||r.source_command_id===args[1]).map(r=>({table,id:String(r.id??r.request_id??r.command_id),projection:r})));return{rows:[{rows_json:all}],rowCount:1};}
  if(sql.includes('fn15_control_storage_settle'))return{rows:[{settled_bytes:args[2]}],rowCount:1};
  if(sql.includes('FROM anvil.control_handoff_acceptance_commands'))return{rows:(rows.get('control_handoff_acceptance_commands')??[]).filter(r=>r.command_id===args[1]),rowCount:0};
  if(sql.includes('FROM anvil.control_handoff_protected_summaries'))return{rows:(rows.get('control_handoff_protected_summaries')??[]).filter(r=>r.request_id===args[1]&&(args.length<4||Number(r.version)===args[2]&&r.content_hash===args[3])).sort((a,b)=>Number(b.version)-Number(a.version)).slice(0,sql.includes('LIMIT 1')?1:undefined),rowCount:0};
  throw Error('UNMODELED_SQL '+sql);
 }};
 const access={authenticateInTransaction:async(receiver:unknown,token:string,csrf:string)=>{assert.equal(receiver!==db,true);assert.equal(token,'memory-token');assert.equal(csrf,'memory-csrf');return auth;}};
 return{pool:{connect:async()=>db},access,rows,request,logs,auth,clock:{now:()=>Date.parse(now),monotonic:()=>0},lost:()=>{commitLost=true;},releaseErrors,counts:()=>({calls,releases})};
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
