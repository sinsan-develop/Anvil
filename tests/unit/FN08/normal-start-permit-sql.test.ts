import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
/** 0089는 미적용 source다. 실제 PostgreSQL 실행은 하지 않으며 여기서는 원문 구조만 고정한다. */
const read=(name:string)=>readFileSync(new URL('../../../db/migrations/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const sql=read('0089_normal_start_permit.sql.pending'),prev=read('0088_normal_start_material_delivery.sql.pending'),base=read('0018_execution_observation.sql');
function fn(text:string,name:string){const i=text.indexOf('CREATE OR REPLACE FUNCTION anvil.'+name+'(');assert.ok(i>=0,name);return text.slice(i,text.indexOf('\n$$;\n',i)+5);}
test('0089는 하나의 거래로 끝나고 normal permit guard·영수증 검사·state 제약·trigger 분리를 둔다',()=>{
 assert.match(sql,/^--[^\n]*\n--[^\n]*\n--[^\n]*미적용 source[^\n]*\nBEGIN;\n/);assert.match(sql,/\nCOMMIT;\n$/);assert.equal(sql.match(/^COMMIT;$/gm)!.length,1);
 for(const s of ['CREATE FUNCTION anvil.normal_start_permit_receipt_valid(r anvil.execution_receipts)','CREATE FUNCTION anvil.guard_normal_start_permit()',
  'CREATE FUNCTION anvil.guard_normal_start_permit_complete()',"CHECK (coalesce(snapshot_json->>'state','') IN ('SYNTHETIC_CONSUMED_NO_AUTHORITY','NORMAL_START_PERMITTED'))","NOT anvil.execution_preparation_ref_valid(req->'localAttemptRef')","anvil.execution_json_shape(f->'expires',ARRAY['humanSession','permissionPolicy','registration','budget','automaticScope'])",
  "WHEN (NEW.snapshot_json->>'state'='NORMAL_START_PERMITTED') EXECUTE FUNCTION anvil.guard_normal_start_permit();",
  "WHEN (NEW.snapshot_json->>'state'='SYNTHETIC_CONSUMED_NO_AUTHORITY') EXECUTE FUNCTION anvil.guard_execution_start_permit();",
  'CREATE TRIGGER execution_start_permit_immutable BEFORE UPDATE OR DELETE ON anvil.execution_start_permits FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_start_permit();',
  "WHEN (NEW.snapshot_json->>'kind'='NORMAL_START_PERMIT') EXECUTE FUNCTION anvil.guard_normal_start_permit_receipt();",
  "current_setting('anvil.normal_permit_verified',true)","s->'executionAuthorized' IS DISTINCT FROM 'true'::jsonb","s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb",
  "f-'checkedAt'-'checks'-'expires'-'writerState' IS DISTINCT FROM (g.snapshot_json->'binding')-'checkedAt'-'checks'-'expires'-'writerState'",
  "(s->>'expiresAt')::timestamptz>(s->>'issuedAt')::timestamptz+interval '30 seconds'"])assert.ok(sql.includes(s),s);
 // 합성 guard 본문은 다시 정의하지 않는다.
 assert.ok(!/CREATE (OR REPLACE )?FUNCTION anvil\.guard_execution_start_permit\(\)/.test(sql));assert.ok(base.includes("s->>'state' IS DISTINCT FROM 'SYNTHETIC_CONSUMED_NO_AUTHORITY'"));
 // 합성 영수증 trigger에서 새 종류를 뺀다.
 assert.equal(sql.match(/IS DISTINCT FROM 'NORMAL_START_PERMIT'\) EXECUTE FUNCTION/g)!.length,2);
});
test('0089가 옮겨 온 두 함수는 0088과 표시한 곳만 다르다',()=>{
 const a=fn(prev,'normal_command_consumption_valid'),b=fn(sql,'normal_command_consumption_valid');
 assert.equal(b,a.replace("IN ('NORMAL_COMMAND_PAGE','NORMAL_START_MATERIAL')","IN ('NORMAL_COMMAND_PAGE','NORMAL_START_MATERIAL','NORMAL_START_PERMIT')"));
 const c=fn(prev,'normal_request_challenge_valid'),d=fn(sql,'normal_request_challenge_valid');
 const lines=(t:string)=>t.split('\n');
 // 대상(method·path·body) 조건 줄만 바뀌고 앞뒤 본문은 같다.
 const head=c.slice(0,c.indexOf("  OR NOT anvil.execution_json_shape(t,")),tail=c.slice(c.indexOf("  OR s->>'requestHash' IS DISTINCT FROM anvil.execution_json_hash(r)"));
 assert.ok(d.startsWith(head));assert.ok(d.endsWith(tail));
 const changed=d.slice(head.length,d.length-tail.length);
 assert.ok(changed.includes("t->>'method' NOT IN ('GET','POST')"));assert.ok(changed.includes("'/[0-9a-f-]{36}/permit$'"));
 assert.ok(changed.includes("t->>'bodyHash'<>anvil.execution_json_hash('null'::jsonb)"));assert.ok(changed.includes("t->>'method'='GET' AND t->>'bodyHash'=anvil.execution_json_hash('null'::jsonb)"));
 assert.ok(lines(changed).length<=8);
});

test('0104는 신규 WORK grant·permit에만 최신 선택을 검산하고 원 permit의 읽기 재확인은 바꾸지 않는다',()=>{
 const work=read('0104_normal_work_start_understanding.sql.pending');
 for(const name of ['fn09_work_start_grant_guard','fn09_work_start_grant_complete','fn09_work_start_permit_guard','fn09_work_start_permit_complete']){
  const line=work.split('\n').find(v=>v.startsWith('CREATE ')&&v.includes('TRIGGER '+name+' '));
  assert.ok(line,name);assert.match(line,/INSERT ON anvil\.execution_(grants|start_permits)/);assert.doesNotMatch(line,/UPDATE|DELETE/);
  if(name.includes('grant'))assert.match(line,/'WORK'/);else{assert.match(line,/'NORMAL_START_PERMITTED'/);assert.doesNotMatch(line,/currentFact,intent,mode/);}
 }
 assert.equal(work.split('\n').filter(v=>v.startsWith('CREATE CONSTRAINT TRIGGER')&&v.includes('DEFERRABLE INITIALLY DEFERRED')).length,2);
 const guard=work.slice(work.indexOf('CREATE FUNCTION anvil.fn09_work_start_permit_guard()'));
 for(const token of ["NEW.snapshot_json#>'{scope,grantRef}'",'NEW.execution_id IS DISTINCT FROM g.execution_id','NEW.generation IS DISTINCT FROM g.generation',"NEW.snapshot_json#>'{currentFact,preparationRef}'",'normal_start_material_complete',"NEW.snapshot_json->'currentFact'",'fn09_work_start_fact_current'])assert.ok(guard.includes(token),token);
 // linked 판별 전 불변 원본을 검산한다. 원래 정상인 unlinked WORK에는 새 head를 요구하지 않는다.
 const linked=guard.indexOf("IF g.snapshot_json#>>'{binding,intent,mode}'='WORK' AND ep.snapshot_json?'understandingBasis'");assert.ok(linked>0);
 for(const token of ['SELECT * INTO STRICT g','g.content_hash IS DISTINCT FROM anvil.execution_json_hash(g.snapshot_json)','normal_start_material_complete',"original_ref=g.snapshot_json#>'{binding,preparationRef}'",'SELECT * INTO STRICT ep','ep.content_hash IS DISTINCT FROM anvil.execution_json_hash(ep.snapshot_json)'])assert.ok(guard.indexOf(token)>=0&&guard.indexOf(token)<linked,token);
 assert.equal(guard.indexOf('fn09_work_start_fact_current'),guard.indexOf('fn09_work_start_fact_current',linked));
 assert.doesNotMatch(work,/CREATE (?:OR REPLACE )?FUNCTION anvil\.(?:normal_start_permit_receipt_valid|normal_start_material_complete|guard_normal_start_permit)\(/);
 // 원 START의 QUEUED/RESERVED/PENDING은 가변 실행 상태가 아니라 현재 source에서 불변 원 기록이다.
 const queue=read('0017_execution_authority.sql'),normal=read('0083_normal_initial_execution.sql.pending');
 assert.ok(queue.includes("IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'EXECUTION_QUEUE_HISTORY_IMMUTABLE'"));
 assert.ok(queue.includes("ARRAY['executions','execution_grants','usage_reservations','writer_claims','execution_commands']"));
 assert.ok(normal.includes("IF TG_OP<>'INSERT' AND OLD.kind='EXECUTION_NORMAL'"));assert.ok(normal.includes('NORMAL_OUTBOX_IMMUTABLE'));
});
