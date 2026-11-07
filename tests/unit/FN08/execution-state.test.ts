import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes,randomUUID } from 'node:crypto';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
const module:any=await import('../../../apps/server/modules/executions/project-execution-state.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const pid='11111111-1111-4111-8111-111111111111',ref={id:pid,version:1,contentHash:'a'.repeat(64)},actor:any={actorId:pid,clientId:pid};
function fixture() {
  let member=true,reads:string[]=[];
  const assignment={projectId:pid,ref,snapshot:{definition:{taskRef:{applicationRef:ref,nodeId:'개발'}},contentConfirmed:true,executionAuthorized:false,dispatchPerformed:false}};
  const db:any={query:async(sql:string,args:any[])=>{
    if(sql.startsWith('SELECT p.id,p.archived_at')){reads.push('MEMBER');return{rows:member?[{id:pid,participation:'OWNER'}]:[]};}
    if(sql.includes('FROM anvil.project_roles')){assert.equal(args[0],pid);assert.deepEqual(JSON.parse(args[1]),{applicationRef:ref,nodeId:'개발'});return{rows:[{role_id:pid,version:1}]};}
    if(sql.includes('FROM anvil.role_bindings'))return{rows:[{binding_id:pid,version:2}]};
    if(sql.includes('FROM anvil.execution_preparations'))return{rows:Array.from({length:21},(_,n)=>({id:pid,version:1,n}))};
    throw Error('UNEXPECTED_QUERY');
  }};
  const dependencies:any={assignments:{read:async()=>{reads.push('ASSIGNMENT');return assignment;}},sessions:{readRole:async()=>{reads.push('ROLE');return{projectId:pid,ref,snapshot:{kind:'STAGE_OWNER'}};},readBinding:async()=>{reads.push('BINDING');return{projectId:pid,ref:{...ref,version:2},snapshot:{state:'RESERVED'}};}},preparations:{read:async()=>{reads.push('PREPARATION');return{projectId:pid,ref,snapshot:{authorizationState:'NOT_AUTHORIZED'}};}}};
  return{db,dependencies,reads,deny:()=>{member=false;}};
}
test('확정 임무의 현재 단계 역할/최신 결박·준비20건을 무권한승격 없이 조회한다',async()=>{
  assert.equal(typeof module.readExecutionPreparationState,'function');const f=fixture();
  const result=await module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies);
  assert.deepEqual(result.assignmentRef,ref);assert.equal(result.roles.length,1);assert.equal(result.bindings[0].ref.version,2);assert.equal(result.preparations.length,20);assert.equal(result.hasMorePreparations,true);
  assert.equal(result.executionAuthorized,false);assert.equal(result.dispatchPerformed,false);assert.equal(result.currentness,'NOT_RECHECKED');
  assert.deepEqual(f.reads.slice(0,2),['MEMBER','ASSIGNMENT']);assert.equal(f.reads.filter(x=>x==='PREPARATION').length,20);
});
test('비참여자는 목록/원문 resolver를 호출하지 않으며 잘못된 exact 입력은 거절한다',async()=>{
  assert.equal(typeof module.readExecutionPreparationState,'function');const f=fixture();f.deny();
  await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies));assert.deepEqual(f.reads,['MEMBER']);
  await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,'bad',1,f.dependencies));await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,pid,0,f.dependencies));
});
test('역할/결박 원문의 무결성 오류를 빈 정상 목록으로 바꾸지 않는다',async()=>{
  assert.equal(typeof module.readExecutionPreparationState,'function');const f=fixture();f.dependencies.sessions.readBinding=async()=>{throw Error('RESPONSIBLE_SESSION_INTEGRITY_FAILED');};
  await assert.rejects(module.readExecutionPreparationState(f.db,actor,pid,pid,1,f.dependencies),/INTEGRITY_FAILED/);assert(!f.reads.includes('PREPARATION'));
});
test('새 화면 조회 경로도 로그인 없이 DB나 원문을 조회하지 않는다',async()=>{
  let queries=0;const pool:any={query:async()=>{queries++;throw Error('UNEXPECTED_DATABASE_ACCESS');},connect:async()=>{queries++;throw Error('UNEXPECTED_DATABASE_ACCESS');}};
  const repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
  try{const r=await app.inject({method:'GET',url:'/api/v1/projects/'+pid+'/assignments/'+pid+'/versions/1/execution-preparation-state',headers:{host:'localhost:3830'}});assert.equal(r.statusCode,401);assert.equal(queries,0);}finally{await app.close();}
});
