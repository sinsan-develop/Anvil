import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const old=readFileSync(new URL('../../../db/migrations/0062_execution_material_registration.sql.pending',import.meta.url),'utf8');
const sql=readFileSync(new URL('../../../db/migrations/0078_start_execution_material_registration.sql.pending',import.meta.url),'utf8');
function body(text:string,name:string){const start=text.search(new RegExp('CREATE (?:OR REPLACE )?FUNCTION anvil\\.'+name+'\\('));assert(start>=0,name);const from=text.indexOf('AS $$',start);assert(from>start);const end=text.indexOf('$$;',from+5);assert(end>from);return text.slice(from+5,end);}
test('START0078은 원 SEND 위임과 기존 세 표 guard를 보존하는 forward 원문이다',()=>{
 for(const name of ['material_descriptor_valid','material_registration_complete','material_target_required'])assert.match(sql,new RegExp('ALTER FUNCTION anvil\\.'+name+'\\([^;]+RENAME TO '+name+'_send_0062;'));
 assert(!/CREATE TABLE|ALTER TABLE|DROP |DISABLE|UPDATE anvil\.|DELETE FROM anvil\./i.test(sql.replace(/--[^\n]*/g,'')));assert(!/SECURITY DEFINER|GRANT (?:ALL|UPDATE|DELETE|TRUNCATE)/.test(sql));
 const descriptor=body(sql,'material_descriptor_valid');assert.match(descriptor,/CASE WHEN d \? 'purpose'/);assert.match(descriptor,/material_descriptor_valid_send_0062\(d\)/);
 const guard=body(old,'material_registration_guard');for(const table of ['execution_material_manifests','execution_materials','execution_material_proof_bindings'])assert(guard.includes('FROM anvil.'+table));assert.match(guard,/WHERE grant_id=NEW\.grant_id/);assert(!/expires_at\s*>|version\s*=/.test(guard.slice(guard.indexOf('SELECT count(*)'),guard.indexOf('added='))));
});
test('START0078 descriptor는 exact 두 그룹·전역 부분·합산 bytes와 SQL null을 닫는다',()=>{
 const b=body(sql,'fn08_start_material_descriptor_valid');
 for(const text of ["'schemaVersion','purpose','id','sourceKind','scope','commandId','payload','groups','expiresAt'","'CONTEXT_BUNDLE'","'START_OPTIONS'","'contextBundleRef','optionsRef'","'sourceRef','bodyRef','originRef','contentHash','sourceBytes','mediaType'","'materialId','partIndex','byteOffset','utf8Bytes','contentHash'","jsonb_array_length(d->'groups')<>2",'total_bytes>2097152 OR total_parts>200',"(p->>'materialId')::uuid=ANY(ids)","off_bytes<>(s->>'sourceBytes')::bigint",'EXCEPTION WHEN OTHERS THEN RETURN false'])assert(b.includes(text),text);
 assert.match(b,/IS DISTINCT FROM/g);assert.match(b,/COALESCE/g);
});
test('START0078 역사 완결은 원 receipt·등록·Options bytes·부분과 양방향 graph를 검산한다',()=>{
 const b=body(sql,'fn08_start_material_complete');
 for(const table of ['commands','execution_commands','execution_grants','executions','usage_reservations','writer_claims','delivery_outbox','authorization_receipts','audit_events','execution_preparations','execution_material_manifests','execution_materials'])assert(b.includes('anvil.'+table),table);
 assert(!/anvil\.check_initial_execution_graph\(|anvil\.execution_queue_authorized\(|synthetic_grant_deadline\(|clock_timestamp\(/.test(b));
 assert(b.includes("c.request_hash IS DISTINCT FROM anvil.execution_json_hash(request)"));assert(b.includes("m.created_command_id IS DISTINCT FROM cid"));assert(b.includes("env IS DISTINCT FROM jsonb_build_object"));assert(b.includes("octet_length(convert_to(opt->>'body','UTF8'))"));assert(b.includes("sha256(convert_to(opt->>'body','UTF8'))"));
 const reverse=body(sql,'material_registration_reverse');assert(reverse.includes("IN('SEND_INSTRUCTION','START_SESSION')"));assert(reverse.includes('material_binding_complete(pid,rid)'));assert(reverse.includes('material_target_required(pid,rid)'));
 assert(sql.includes("ARRAY['executions','execution_grants','usage_reservations','writer_claims','delivery_outbox']"));assert(sql.includes('DEFERRABLE INITIALLY DEFERRED'));
 const oldBinding=body(old,'material_binding_complete');for(const text of ["v.snapshot_json->'consumption'->'resultRef'","c.snapshot_json->'request'->'target'","v.snapshot_json->'previousRef'","v.snapshot_json->'consumption'->'proofHash'"])assert(oldBinding.includes(text));
});

test('START0078 Options 원문 SHA는 기존 내장 sha256 경로만 쓰고 미정 pgcrypto 의존을 만들지 않는다',()=>{assert(!/public\.digest\(/.test(body(sql,'fn08_start_material_complete')));assert(body(sql,'fn08_start_material_complete').includes("encode(sha256(convert_to(opt->>'body','UTF8')),'hex')"));});

test('원자료 요청0082는 보존 A0·P2 문법과 목적 한정 원장/알림 완결을 함께 설치하는 소스다',()=>{
 const source=readFileSync(new URL('../../../db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending',import.meta.url),'utf8');
 for(const name of ['environment_configuration_commit','execution_policy_deadline','fn09_origin_reuse_request_context','fn09_origin_reuse_request_rows','fn09_origin_reuse_request_reserve','fn09_origin_reuse_request_settle','fn09_origin_reuse_request_complete'])assert(source.includes('FUNCTION anvil.'+name+'('),name);
 assert(source.includes('PERFORM 1 FROM anvil.projects WHERE id=p FOR UPDATE;'));
 const complete=body(source,'fn09_origin_reuse_request_complete');
 const closure=complete+body(source,'fn09_origin_reuse_request_actual')+body(source,'fn09_origin_reuse_request_notification')+body(source,'fn09_origin_reuse_request_record_valid')+body(source,'fn09_origin_reuse_request_seal_valid')+body(source,'fn09_origin_reuse_request_rows');
 for(const name of ['approval_requests','commands','authorization_receipts','audit_events','notifications','project_storage_reservations'])assert(closure.includes('anvil.'+name),name);
 assert(complete.includes('fn09_origin_reuse_request_actual'));assert(body(source,'fn09_origin_reuse_request_actual').includes('fn09_origin_reuse_request_notification'));
 assert(complete.includes("r.phase IS DISTINCT FROM 'SETTLED'"));assert(complete.includes("r.part_kind IS DISTINCT FROM 'ORIGIN_REUSE_APPROVAL_REQUEST'"));
 assert(source.includes('DEFERRABLE INITIALLY DEFERRED'));assert(!/CREATE TABLE|GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON/i.test(source));
 assert(!source.includes('CREATE OR REPLACE FUNCTION anvil.one_time_decision_command_authorized('));
});

test('요청0082 보존 A0/C0/C1 원바이트와 일반 승인 invoker 본문은 한정 추가 밖에서 동일하다',async()=>{
 const {createHash}=await import('node:crypto');
 const raw=readFileSync(new URL('../../../db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending',import.meta.url));
 assert.equal(raw.subarray(0,7).toString(),'BEGIN;\n');
 assert.equal(createHash('sha256').update(raw.subarray(7,7+16423)).digest('hex'),'2a568dcd02be60817a5ec977e234dd4b555da07c0bdcf9a097775ad9b6bca203');
 const text=raw.toString(),original=readFileSync(new URL('../../../db/migrations/0073_control_handoff_acceptance.sql.pending',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const current=body(text,'guard_one_time_approval_request'),old=body(original,'guard_one_time_approval_request');
 const start=current.indexOf("\n IF NEW.action_scope_json->>'operation'='queueExecutionCommand'"),end=current.indexOf("\n IF TG_OP='UPDATE' THEN\n  IF OLD.version=2",start);
 assert(start>=0&&end>start);assert.equal(current.slice(0,start)+current.slice(end),old);
 const declaration=text.slice(text.indexOf('CREATE OR REPLACE FUNCTION anvil.guard_one_time_approval_request('),text.indexOf('AS $$',text.indexOf('CREATE OR REPLACE FUNCTION anvil.guard_one_time_approval_request(')));
 assert(!declaration.includes('SECURITY DEFINER'));assert(!declaration.includes('SET search_path'));
 assert(current.includes("TG_OP<>'INSERT'"));assert(current.includes('ORIGIN_REUSE_REQUEST_INVALID'));
});

test('요청0082 원 source·최단기한과 단일 R의 양방향 완결은 caller JSON이나 GUC만으로 합격하지 않는다',()=>{
 const text=readFileSync(new URL('../../../db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending',import.meta.url),'utf8');
 const context=body(text,'fn09_origin_reuse_request_context'),source=body(text,'fn09_origin_reuse_request_source');
 for(const token of ['anvil.fn01_active(s,a,c)','expected_tx IS DISTINCT FROM txid_current()::text','anvil.project_members','anvil.project_control','anvil.permission_policies','anvil.permission_policy_versions','anvil.connector_registrations','anvil.connectors','auth.reauth_until','anvil.fn09_origin_reuse_request_source(p,e,true)','anvil.execution_policy_deadline','reuseExecutionStartOrigin',"record->'details'->>'expiresAt'"])assert(context.includes(token),token);
 assert(context.indexOf('anvil.fn01_active(s,a,c)')<context.indexOf('FROM anvil.projects'));
 assert(context.indexOf('FROM anvil.projects')<context.indexOf('anvil.environment_configuration_heads'));
 for(const token of ['anvil.execution_start_origins','anvil.fn09_execution_start_origin_source(p,s,false)','anvil.environment_configuration_snapshot_root','anvil.environment_configuration_source_ref','anvil.environment_configuration_metadata_ref','e->\'dependencies\' IS DISTINCT FROM expected'])assert(source.includes(token),token);
 const complete=body(text,'fn09_origin_reuse_request_complete'),actual=body(text,'fn09_origin_reuse_request_actual');
 assert(complete.includes('anvil.fn09_registered_reservation_fixed_point(actual_base,to_jsonb(r),r.reserved_bytes)'));
 assert(actual.includes('anvil.fn09_origin_reuse_request_rows(p,cid)'));assert(!actual.includes('execution_start_origins'));
 for(const table of ['approval_requests','commands','notifications','project_storage_reservations','project_storage_accounts'])assert(body(text,'fn09_origin_reuse_request_final_guard').includes('anvil.'+table));
});

test('결정0082는 v1 원봉인·v2 세결정을 보존하고 v3 exact8 목적 소비만 추가한다',()=>{
 const s=readFileSync(new URL('../../../db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending',import.meta.url),'utf8');
 const state=body(s,'fn09_origin_reuse_request_record_valid');assert(state.includes("r.version=3 AND r.status='CONSUMED'"));assert(state.includes('fn09_origin_reuse_consumption_actual'));for(const token of ["r.version=1 AND r.status='PENDING'","RETURN n=0","r.version<>2 OR n<>1",'fn09_origin_reuse_decision_actual','approval_consumptions'])assert(state.includes(token),token);
 const context=body(s,'fn09_origin_reuse_decision_context');for(const token of ['anvil.fn01_active(s,a,c)','FOR UPDATE','fn09_origin_reuse_request_seal_valid','expected_tx IS DISTINCT FROM txid_current()::text',"q->'schemaVersion' IS DISTINCT FROM '1'::jsonb","'decideApproval'",'humanSessionId','credentialGeneration','reauth_until','fn09_origin_reuse_request_source(p,e,true)','execution_policy_deadline'])assert(context.includes(token),token);
 const settle=body(s,'fn09_origin_reuse_decision_settle');for(const token of ['pg_current_xact_id()::xid','fn09_origin_reuse_decision_context','fn09_origin_reuse_decision_actual','used_bytes=used_bytes+actual_bytes','held_bytes=held_bytes-r.reserved_bytes','actual_bytes>r.reserved_bytes'])assert(settle.includes(token),token);
 assert(!/CREATE TABLE|GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL) ON/i.test(s));assert(!s.includes('CREATE OR REPLACE FUNCTION anvil.one_time_decision_command_authorized('));
 for(const name of ['quota_plan_valid','quota_settled_complete'])assert(body(s,name).includes('ORIGIN_REUSE_APPROVAL_DECISION'));
 const forward=body(s,'guard_one_time_approval_request');assert(forward.includes("OLD.version<>1 OR OLD.status IS DISTINCT FROM 'PENDING' OR NEW.version<>2"));assert(forward.includes('ORIGIN_REUSE_DECISION_REQUIRED'));
 assert(forward.includes('ORIGIN_REUSE_CONSUMPTION_REQUIRED'));assert(forward.includes('one_time_consumption_command_authorized'));
 const consumed=body(s,'one_time_consumption_command_authorized');assert(consumed.includes("IF c.operation='queueExecutionCommand' THEN"));assert(consumed.includes('sr.xmin=pg_current_xact_id()::xid'));assert(consumed.includes('one_time_consumption_command_before_membership(pid,cid,did)'));
 const final=body(s,'fn09_origin_reuse_request_final_guard');assert(final.includes('fn09_origin_reuse_decision_complete(p,cid)'));assert(final.includes('anvil.approval_decisions'));assert(final.includes('ORIGIN_REUSE_DECISION_INCOMPLETE'));
});
