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
