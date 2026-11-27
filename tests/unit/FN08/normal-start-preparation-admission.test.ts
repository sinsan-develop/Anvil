import test from 'node:test';
import assert from 'node:assert/strict';

test('normal admission은 실제 등록 service 없이는 구성되지 않고 raw custody/Boolean을 권위로 받지 않는다',async()=>{
 const {NormalStartPreparationAdmissions}=await import('../../../apps/server/modules/executions/normal-start-preparation-admission.ts');
 for(const receiver of [undefined,null,{},true,{takeNormalStartPreparationReceiver:()=>({read:()=>({verified:true})})}]){
  assert.throws(()=>new NormalStartPreparationAdmissions({} as any,{purpose:'NORMAL_START_PREPARATION_ADMISSION_V1',receiver} as any,async()=>null));
 }
});

test('normal FRAME 확정 거절은 문자열/외부 AuthFailure로 위조되지 않고 기존 오류 envelope만 사용한다',async()=>{
 const {AuthFailure}=await import('../../../apps/server/modules/access/repository.ts');
 const {NativeFirstReceiveService,isCommittedNormalStartPreparationRejection:committed}=await import('../../../apps/server/modules/executions/native-first-receive-service.ts');
 const service=new NativeFirstReceiveService({installationId:'11111111-1111-4111-8111-111111111111',authenticated:async()=>{throw Error('UNEXPECTED_IO');}}as any),command={commandId:'11111111-1111-4111-8111-111111111111'}as any;
 for(const error of [new AuthFailure('NORMAL_START_PREPARATION_REJECTED',412),new AuthFailure('NORMAL_START_PREPARATION_PRODUCER_REQUIRED',503),new AuthFailure('NORMAL_START_PREPARATION_OUTCOME_UNKNOWN',503),{message:'NORMAL_START_PREPARATION_REJECTED',statusCode:412,committed:true}])assert.equal(committed(error,service,command,{}as any),false);
 const source=readFileSync(new URL('../../../apps/server/modules/executions/normal-start-preparation-admission.ts',import.meta.url),'utf8');
 assert.match(source,/await this\.#receiver\.waitNormalStartPreparationResult\(frame,[^;]+;return unavailable\(\);/);assert(source.includes('isCommittedNormalStartPreparationRejection(error,this.#receiver,command,scope)){check();throw error;}'));
 assert.doesNotMatch(source,/new AuthFailure\('NORMAL_START_PREPARATION_REJECTED'/,'admission 자체가 거절 권위를 만들지 않는다');
 const commandPath=readFileSync(new URL('../../../apps/server/modules/executions/normal-initial-execution.ts',import.meta.url),'utf8').split('  async command(token:string,csrf:string,value:ProjectCommand){')[1];
 assert(commandPath);
 assert.match(commandPath,/const admitted=this\.#admissions\?await this\.#admissions\.enter\(token,csrf,request\):null;[^]*?const result=await this\.#access\.authenticated/);
 assert(commandPath.indexOf('await this.#admissions.enter')<commandPath.indexOf('try{'),'FRAME의 UNKNOWN은 queue transaction/회수·인계에 들어가기 전에 전파된다');
});


import {readFileSync} from 'node:fs';
const sql=()=>readFileSync(new URL('../../../db/migrations/0105_normal_start_preparation_admission.sql.pending',import.meta.url),'utf8');
function definition(s:string,name:string){const begin=s.indexOf('FUNCTION anvil.'+name+'(');assert(begin>=0,name);const start=s.indexOf(' AS $$',begin),end=s.indexOf('$$;',start+6);assert(start>=0&&end>start,name);return s.slice(start+6,end);}

test('0105는 사전 등록 read·issuer·claim·queue-read와 실제 app EXECUTE만 닫고 새 권한/공개 wire를 만들지 않는다',()=>{
 const s=sql();assert.match(s,/BEGIN;/);assert.match(s,/COMMIT;\s*$/);assert.equal(s.match(/^BEGIN;$/gm)?.length,1);assert.equal(s.match(/^COMMIT;$/gm)?.length,1);
 for(const table of ['normal_start_preparation_admissions','normal_start_preparation_claims']){
  assert(s.includes('ALTER TABLE anvil.'+table+' FORCE ROW LEVEL SECURITY;'));
  assert.match(s,/REVOKE ALL ON anvil.normal_start_preparation_admissions,anvil.normal_start_preparation_claims FROM PUBLIC,anvil_v3_app;/);
 }
 assert.doesNotMatch(s,/CREATE ROLE|GRANT (?:SELECT|INSERT|UPDATE|DELETE)|TO PUBLIC|UPDATE anvil.native_receive_|INSERT INTO anvil.native_receive_/);
 const current=definition(s,'fn105_current');
 assert(current.includes("native_receive_human_read(p,s,'ACTIVE',host->'registrationRef',expected_tx)"));
 assert(current.includes("native_receive_human_read(p,s,'STATE',to_jsonb(w#>>'{ref,id}'),expected_tx)"));
 assert(current.includes("phase='STREAM' AND occurrence=1 AND stage='CONSUMED'"));
 assert(current.includes("i->>'mode' IS DISTINCT FROM 'CONTEXT_REVIEW'"));assert(current.includes("target->>'access' IS DISTINCT FROM 'READ'"));
 for(const name of ['fn08_start_preparation_admit','fn08_start_preparation_claim']){
  const body=definition(s,name);assert(body.includes('PERFORM 1 FROM anvil.project_storage_accounts WHERE project_id=p FOR UPDATE;'));
  assert(body.includes("IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_STORAGE_QUOTA_UNVERIFIED'"));
  assert.doesNotMatch(body,/SELECT \* FROM anvil.project_storage_accounts[^;]+FOR UPDATE;/);
  assert(body.includes('fn76_project_quota_settle(p,before_actual,before_future)'));
 }
 const queue=definition(s,'fn08_start_preparation_queue');
 assert(queue.includes('claim_ref IS DISTINCT FROM anvil.fn105_ref(claim.id,claim.snapshot_json)'));
 assert(queue.includes("expected_tx=claim.snapshot_json->>'transactionId'"));assert.doesNotMatch(queue,/INSERT INTO|UPDATE anvil\./);
});

test('0105 collector와 기존 R/N capacity 식은 FN08 소계 외에는 같은 원 SQL을 보존한다',()=>{
 const before=readFileSync(new URL('../../../db/migrations/0076_native_first_receive.sql.pending',import.meta.url),'utf8'),s=sql();
 for(const [name,addition] of [['fn76_storage_actual','+anvil.fn105_storage_actual(p)'],['fn76_storage_future','+anvil.fn105_storage_future(p)']]as const){
  assert.equal(definition(s,name).replace(addition,''),definition(before,name));
 }
 const capacity=definition(s,'fn76_capacity_valid'),removed=capacity.replace(/ -- FN08_PREPARATION_CAPACITY_BEGIN[^]*? -- FN08_PREPARATION_CAPACITY_END\n/,'');
 assert.equal(removed,definition(before,'fn76_capacity_valid'));
 for(const token of ['r_bytes:=r_bytes+anvil.fn105_storage_actual(p)','r_future:=r_future+anvil.fn105_storage_future(p)','r_slots:=r_slots+','r_future_slots:=r_future_slots+'])assert(capacity.includes(token));
 assert(definition(s,'fn105_storage_future').includes('NOT EXISTS(SELECT 1 FROM anvil.normal_start_preparation_claims'));
 assert(definition(s,'fn105_complete').includes("c.snapshot_json->>'transactionId'=j->>'transactionId'"));
 assert.doesNotMatch(definition(s,'fn105_complete'),/fn105_current|clock_timestamp\(\)|expires_at>clock/,'정착의 역사 회계에 현재 TTL을 역적용하지 않는다');
});

test('기존 R 64MiB/10000 경계에는 새 actual/future가 한 번만 들어가며 미소비 future를 자동 반환하지 않는다',()=>{
 const cap=definition(sql(),'fn76_capacity_valid');
 const evaluate=(rBytes:number,rFuture:number,rSlots:number,rFutureSlots:number,addedBytes:number,addedFuture:number,addedSlots:number,addedFutureSlots:number)=>{
  assert(cap.includes('r_slots+r_future_slots<=10000 AND r_bytes+r_future<=67108864'));
  return rSlots+addedSlots+rFutureSlots+addedFutureSlots<=10000&&rBytes+addedBytes+rFuture+addedFuture<=67108864;
 };
 assert.equal(evaluate(67108863,0,9998,0,1,0,1,1),true);
 assert.equal(evaluate(67108863,0,9998,0,1,1,1,1),false);
 assert.equal(evaluate(0,0,9999,0,0,0,1,1),false);
 assert.equal(evaluate(0,0,9998,0,0,0,1,1),true);
 const future=definition(sql(),'fn105_storage_future');assert.doesNotMatch(future,/clock_timestamp|expiresAt[^]*WHERE/);
 assert(future.includes("'9223372036854775807','9999-12-31T23:59:59.999Z'"));
});
