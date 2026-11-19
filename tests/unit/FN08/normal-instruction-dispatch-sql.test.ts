import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../../../'+p,import.meta.url),'utf8');
test('후속 SEND는 최초쓰기 GUC graph 대신 기존 역사 START material/receipt/audit/outbox 완결을 조회한다',()=>{
 const source=read('apps/server/modules/executions/normal-instruction-command.ts');
 assert.doesNotMatch(source,/anvil\.normal_initial_graph\(/);
 assert.match(source,/anvil\.normal_start_material_complete\(\$1,g\.command_id\)/);
 const all=read('db/migrations/0083_normal_initial_execution.sql.pending'),body=all.slice(all.indexOf('CREATE FUNCTION anvil.normal_start_material_complete'),all.indexOf('-- 일반 outbox'));
 assert.doesNotMatch(body,/current_setting|normal_queue_authorized|normal_initial_graph|clock_timestamp/);
 for(const dependency of ['authorization_receipts','audit_events','delivery_outbox','execution_grants','usage_reservations','execution_preparations','normal_credential_reservation_valid'])assert(body.includes(dependency),dependency);
 assert.match(body,/env IS DISTINCT FROM jsonb_build_object/);
 assert.match(source,/readGrantCurrent\(db/);
});

test('0097은 normal SEND graph·명령별 permit·정확 자료 소비만 확장하고 기존 저장 권한과 START/관측을 보존한다',()=>{
 const s=read('db/migrations/0097_normal_instruction_dispatch.sql.pending').replace(/--[^\n]*/g,'');
 for(const name of ['normal_instruction_authorized','normal_instruction_graph','normal_instruction_record','normal_instruction_descriptor_valid','normal_instruction_permit_receipt_valid','guard_normal_instruction_permit','guard_normal_instruction_permit_complete'])assert(s.includes('FUNCTION anvil.'+name+'('),name);
 for(const marker of ['NORMAL_INSTRUCTION_QUEUED','NORMAL_INSTRUCTION_PERMITTED','NORMAL_INSTRUCTION_MATERIAL','NORMAL_INSTRUCTION_PERMIT','NORMAL_OBSERVATIONS','PROTECTED_INSTRUCTION_REFERENCE_V1','FOR UPDATE','DEFERRABLE INITIALLY DEFERRED','normal_request_credential','normal_exchange_current','normal_start_material_complete'])assert(s.includes(marker),marker);
 assert.doesNotMatch(s,/CREATE TABLE|CREATE ROLE|SECURITY DEFINER|GRANT (?:SELECT|INSERT|UPDATE|DELETE)|DROP (?:CONSTRAINT|INDEX)/);
 assert.match(s,/guard_execution_permit_proof_complete/);
 assert.match(s,/execution_queue_authorized_pre0097/);
 assert.match(s,/material_registration_complete_pre0097/);
 assert.match(s,/normal_command_consumption_valid[\s\S]*NORMAL_OBSERVATIONS/);
});

const sql97=()=>read('db/migrations/0097_normal_instruction_dispatch.sql.pending');
const fn=(s:string,n:string)=>{const m=s.match(new RegExp('CREATE (?:OR REPLACE )?FUNCTION anvil\\.'+n+'\\([\\s\\S]*?\\$\\$;'));assert(m,n);return m[0];};
const normalized=(s:string)=>s.replace(/--[^\n]*/g,'').replace(/\s+/g,'');
test('0097 nonce 소비는 최신0090의 OBS/START 보존 및 새 두 receipt kind 추가만 한다',()=>{
 const old=fn(read('db/migrations/0090_normal_observations.sql.pending'),'normal_command_consumption_valid');
 const expected=old.replace("'NORMAL_START_PERMIT','NORMAL_OBSERVATIONS'","'NORMAL_START_PERMIT','NORMAL_OBSERVATIONS','NORMAL_INSTRUCTION_MATERIAL','NORMAL_INSTRUCTION_PERMIT'");
 assert.equal(normalized(fn(sql97(),'normal_command_consumption_valid')),normalized(expected));
 const s=sql97();for(const kind of ['NORMAL_CREDENTIAL_ISSUED','NORMAL_COMMAND_PAGE','NORMAL_START_MATERIAL','NORMAL_START_PERMIT','NORMAL_OBSERVATIONS','NORMAL_INSTRUCTION_MATERIAL','NORMAL_INSTRUCTION_PERMIT']){
  const exclusions=s.slice(s.indexOf('DROP TRIGGER synthetic_execution_receipt_guard'));assert.equal((exclusions.match(new RegExp("IS DISTINCT FROM '"+kind+"'",'g'))??[]).length,2,kind);
 }
});
test('0097 역사 graph는 명령 GUC/신규 시각을 쓰지 않고 원 부모·자기 예약·감사·자료를 완결한다',()=>{
 const graph=fn(sql97(),'normal_instruction_graph');assert.doesNotMatch(graph,/current_setting|clock_timestamp|normal_queue_authorized|normal_initial_graph/);
 for(const relation of ['normal_start_material_complete','execution_grants','usage_reservations','delivery_outbox','authorization_receipts','audit_events','conversation_messages','execution_materials','parentStart','sourceRef','reservationRef','created_command_id'])assert(graph.includes(relation),relation);
 assert.match(graph,/u\.reservation_id::text=f#>>'\{budgetReservationRef,id\}'/);
 const auth=fn(sql97(),'normal_instruction_authorized');for(const relation of ['FOR UPDATE','anvil.command_id','project_control','project_members','auth_sessions','execution_policy_deadline','normal_exchange_current','credential_generation'])assert(auth.includes(relation),relation);
 const before=read('db/migrations/0024_execution_instruction_permits.sql');assert.match(before,/UNIQUE\(project_id,execution_id,generation,command_id\)/);assert.match(before,/UNIQUE\(project_id,proof_result_id,proof_result_version\)/);
 assert.doesNotMatch(sql97(),/DROP.*(?:UNIQUE|execution_start_permits|execution_permit_proof)/);
});
test('0097 부분계획·quota·permit marker가 같은 원자료와 별도 SEND 예산에 닫혀 있다',()=>{
 const s=sql97(),d=fn(s,'normal_instruction_descriptor_valid');
 for(const marker of ['UTF8_CODEPOINT_64K_V1','INSTRUCTION_PARTS_PLAN','65536','2097152','200',"'bodyRef'","'originRef'","'materialId'"])assert(d.includes(marker),marker);
 const permit=fn(s,'guard_normal_instruction_permit');for(const marker of ['normal_instruction_graph','normal_instruction_permit_receipt_valid',"'SEND_INSTRUCTION'","'NORMAL_INSTRUCTION_PERMITTED'","'OWNED'",'source_refs',"'osOwnershipRef'",'>=50','2097152'])assert(permit.includes(marker),marker);
 assert.match(fn(s,'normal_instruction_permit_receipt_valid'),/anvil\.normal_instruction_permit_verified/);
 assert.match(fn(s,'guard_normal_instruction_limit'),/n>100 OR bytes>2097152/);
 assert.match(fn(s,'guard_execution_permit_proof_complete'),/NORMAL_INSTRUCTION_QUEUED[\s\S]*NORMAL_INSTRUCTION_PERMITTED[\s\S]*NORMAL_INSTRUCTION_PERMIT/);
});
test('0097 새 함수는 invoker이며 PUBLIC 회수와 기존 app 실행 범위만 갖는다',()=>{
 const s=sql97(),code=s.replace(/--[^\n]*/g,'');assert.doesNotMatch(code,/SECURITY DEFINER|ALTER.*OWNER|GRANT.*(?: ON anvil\.| TO PUBLIC)/);
 for(const m of code.matchAll(/CREATE (?:OR REPLACE )?FUNCTION anvil\.(\w+)\(([^)]*)\)/g)){
  const signature='anvil.'+m[1]+'('+(m[2]!.trim()?m[2]!.split(',').map(a=>a.trim().split(/\s+/).at(-1)).join(','):'')+')';
  assert(code.includes('REVOKE ALL ON FUNCTION '+signature+' FROM PUBLIC;'),signature);
  assert(code.includes('GRANT EXECUTE ON FUNCTION '+signature+' TO anvil_v3_app;'),signature);
 }
 assert.equal((code.match(/\$\$/g)??[]).length,(code.match(/CREATE (?:OR REPLACE )?FUNCTION/g)??[]).length*2);
 assert.match(code,/^\s*BEGIN;/);assert.match(code,/COMMIT;\s*$/);
});

test('0097 PLpgSQL IF의 receipt kind CASE는 괄호로 닫아 다음 OR 조건과 구분한다',()=>{
 const body=fn(sql97(),'normal_start_material_valid');
 assert.doesNotMatch(body,/IS DISTINCT FROM CASE/);
 assert.match(body,/IS DISTINCT FROM \(CASE WHEN p\.envelope->>'operation'='SEND_INSTRUCTION' THEN 'NORMAL_INSTRUCTION_MATERIAL' ELSE 'NORMAL_START_MATERIAL' END\) OR/);
});


test('0100 C forward는 SEND 요청 선택 검산 외 원 0097 guard 바이트를 보존한다',()=>{
 const base=read('db/migrations/0097_normal_instruction_dispatch.sql.pending').replace(/\r\n/g,'\n'),next=read('db/migrations/0100_normal_send_permit_source.sql.pending');
 const originalStart=base.indexOf('CREATE FUNCTION anvil.guard_normal_instruction_permit()'),bodyStart=next.indexOf('CREATE OR REPLACE FUNCTION anvil.guard_normal_instruction_permit()');
 const originalEnd=base.indexOf('\n$$;',originalStart),bodyEnd=next.indexOf('\n$$;',bodyStart);
 assert(originalStart>=0&&bodyStart>=0&&originalEnd>originalStart&&bodyEnd>bodyStart);
 // 함수 종결자까지 그대로 비교하며 함수 밖 구분용 빈 줄/EOF만 제외한다.
 const original=base.slice(originalStart,originalEnd+4),body=next.slice(bodyStart,bodyEnd+4);
 const begin=body.indexOf('OR NOT (anvil.execution_json_shape(req,'),end=body.indexOf("\n  OR NOT anvil.execution_preparation_ref_valid(req->'localAttemptRef')",begin);
 assert(begin>=0&&end>begin);
 const changed=body.slice(begin,end);
 assert.match(changed,/representation' IS NOT DISTINCT FROM '"SEND_PERMIT_SOURCE_V1"'::jsonb/);
 assert.match(changed,/mode' IS NOT DISTINCT FROM '"CONTEXT_REVIEW"'::jsonb/);
 assert.match(changed,/jsonb_array_elements\(source->'targets'\).*access' IS DISTINCT FROM 'READ'/);
 const restored=body.slice(0,begin)+"OR NOT anvil.execution_json_shape(req,ARRAY['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])"+body.slice(end);
 assert.equal(restored.replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION'),original);
 assert.doesNotMatch(body,/CREATE TABLE|CREATE ROLE|GRANT |REVOKE |DROP |UPDATE anvil|DELETE FROM/);
});
