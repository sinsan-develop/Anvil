import assert from'node:assert/strict';import{test}from'node:test';import{Pool}from'pg';import{AccessRepository}from'../../../apps/server/modules/access/repository.ts';import{buildApp}from'../../../apps/server/app.ts';
test('승인 목록은 인증 없는 요청을 DB 조회 전에 거절한다',async()=>{
 const pool=new Pool({host:'127.0.0.1',port:1}),repository=new AccessRepository(pool,{installationId:'a6f30000-0000-4000-8000-000000000081',key:Buffer.alloc(32,1)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
 try{const response=await app.inject({method:'GET',url:'/api/v1/projects/a6f30000-0000-4000-8000-000000000083/approvals',headers:{host:'localhost:3830'}});assert.equal(response.statusCode,401,response.body);}finally{await app.close();await pool.end();}
});
test('승인 목록은 유한 페이지/정확 상태·대상만 받고 전체 수집/임의 필터를 거절한다',async()=>{
 const m=await import('../../../apps/server/modules/approvals/approval-input.ts');assert.equal(typeof m.readApprovalListQuery,'function','유한 승인 목록 입력 검사 필요');assert.deepEqual(m.readApprovalListQuery({}),{status:null,targetId:null,limit:50,cursor:undefined});assert.equal(m.readApprovalListQuery({status:'EXPIRED',limit:'200'}).limit,200);
 for(const bad of [{limit:'201'},{limit:'0'},{limit:'01'},{status:'ALL_APPROVED'},{targetId:'../outside'},{cursor:'x'.repeat(4097)},{allow:true}])assert.throws(()=>m.readApprovalListQuery(bad));
});


test('수락된 일반승인 목록은 물리 current grant를 소비하고 OWNER 전용 후보로 범위를 넓히지 않는다',async()=>{
 const {ProjectApprovals}=await import('../../../apps/server/modules/approvals/project-approvals.ts'),g=await import('../../../apps/server/modules/control-handoff/control-grant.ts');
 const id=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0'),pid=id(1),actor={actorId:id(2),clientId:id(3)},r={id:id(4),version:1,contentHash:'a'.repeat(64)},command={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(5),projectId:pid,clientId:actor.clientId,payload:{requestRef:r,summaryVersion:1,reason:'수락'}};
 const chain=g.createControlAcceptanceChain({projectId:pid,command,requestRef:r,summaryRef:r,before:{actorId:id(6),clientId:id(7),generation:1,version:1},targetActorId:actor.actorId,recordedAt:'2026-11-03T00:00:00.000Z',ids:{acceptance:id(8),revocation:id(9),grant:id(10),receipt:id(11),audit:id(12)}});let grant=true,operation='uploadArtifact',grantReads=0,viewerParticipation='HANDOFF_ELIGIBLE';
 const db={async query(sql:string,args:unknown[]=[]){if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:args[0]===pid?[{id:pid,archived_at:null,participation:viewerParticipation}]:[]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation:2,version:2,revoked_at:null,participation:'HANDOFF_ELIGIBLE'}]};
  if(sql.includes('FROM anvil.control_handoffs')){grantReads++;return{rows:grant?[{project_id:pid,next_generation:2,content_hash:chain.acceptance.ref.contentHash,bundle_json:chain,grant_rows:[chain.grant,chain.revocation],command_rows:[{command,result:chain.result,commandHash:g.controlHash(command),resultHash:g.controlHash(chain.result)}],receipt_rows:[chain.receipt],audit_rows:[chain.audit],revoked_count:'0'}]:[]};}
  if(sql.includes('clock_timestamp'))return{rows:[{at:new Date('2026-11-03T00:01:00.000Z')}]};
  if(sql.includes('WITH visible')){const protectedOrdinary=sql.includes("pm.participation='HANDOFF_ELIGIBLE'")&&args.includes(actor.actorId)&&args.includes(actor.clientId)&&args.includes(2)&&g.ordinaryDocumentOperations.some(x=>x===operation);return{rows:[{id:id(13),version:1,status:'PENDING',scope_digest:'b'.repeat(64),action_scope_json:{operation,targetRef:{id:id(14),version:1,contentHash:'c'.repeat(64)}},expires_at:new Date('2026-11-03T00:10:00.000Z'),created_at:new Date('2026-11-03T00:00:30.000Z'),effective_state:protectedOrdinary?'PENDING':'REVOKED'}]};}throw Error('예상 밖 SQL '+sql);
 }};
 const repository=new ProjectApprovals(),codec={read(){throw Error('cursor 없음');},create(){throw Error('추가 page 없음');}};
 const first=await repository.list(db as never,actor as never,pid,{},codec as never);assert.equal(first.items[0]?.effectiveState,'PENDING');assert.equal(grantReads,1);
 for(const participation of ['OWNER','VIEWER']){viewerParticipation=participation;assert.equal((await repository.list(db as never,{actorId:id(30),clientId:id(31)}as never,pid,{},codec as never)).items[0]?.effectiveState,'PENDING');}
 await assert.rejects(()=>repository.list(db as never,actor as never,id(99),{},codec as never));
 operation='saveBackupPolicy';assert.equal((await repository.list(db as never,actor as never,pid,{},codec as never)).items[0]?.effectiveState,'REVOKED');
 grant=false;operation='uploadArtifact';assert.equal((await repository.list(db as never,actor as never,pid,{},codec as never)).items[0]?.effectiveState,'REVOKED');
});
