import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const path=new URL('../../../db/migrations/0024_execution_instruction_permits.sql',import.meta.url);
// 파일 계약 검사다. 실제 SQL 파싱·권한·trigger/COMMIT 검증으로 표시하지 않는다.
test('SENDpermit SQL소스는별도보조표의명령별유일키·원명령/예약/증명FK를선언한다',async()=>{
 const sql=await readFile(path,'utf8');assert.match(sql,/CREATE TABLE anvil\.execution_instruction_permits/);for(const part of ['UNIQUE(project_id,execution_id,generation,command_id)','UNIQUE(project_id,proof_result_id,proof_result_version)','REFERENCES anvil.execution_commands(project_id,id,version)','REFERENCES anvil.usage_reservations(project_id,reservation_id,version)','REFERENCES anvil.execution_receipts(project_id,id,version)'])assert(sql.includes(part),part);
});
test('SENDpermit SQL소스는허용된reverse1함수외기존guard/START표를교체하지않고전용불변검사를정의한다',async()=>{
 const sql=await readFile(path,'utf8');assert(!/ALTER TABLE|DROP |DISABLE TRIGGER|session_replication_role/i.test(sql));assert.deepEqual([...sql.matchAll(/CREATE OR REPLACE FUNCTION ([\w.]+)/g)].map(v=>v[1]),['anvil.guard_execution_permit_proof_complete']);assert(!/CREATE (?:OR REPLACE )?FUNCTION anvil\.guard_(initial_execution|execution_command|execution_start_permit)/.test(sql));assert.match(sql,/IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'INSTRUCTION_PERMIT_IMMUTABLE'/);assert.match(sql,/CREATE CONSTRAINT TRIGGER instruction_permit_complete[\s\S]*DEFERRABLE INITIALLY DEFERRED/);assert.match(sql,/REVOKE UPDATE,DELETE ON anvil\.execution_instruction_permits/);
});
test('SENDpermit SQL소스는정확원명령/새예약·시도/기한·nonce역결박과효과false를검사한다',async()=>{
 const sql=await readFile(path,'utf8');for(const marker of ['SYNTHETIC_INSTRUCTION_QUEUED','SYNTHETIC_INSTRUCTION_CONSUMED_NO_AUTHORITY','localAttemptRef','authorizationReceiptRef','reservationRef','proofExpiresAt','commandExpiresAt','grantExpiresAt','INSTRUCTION_PERMIT_EXACT_BINDING_REQUIRED','INSTRUCTION_PERMIT_PROOF_ATOMIC_REQUIRED','HELD_SYNTHETIC_ONLY'])assert(sql.includes(marker),marker);assert.match(sql,/c\.snapshot_json->'consumption'->'resultRef'/);assert.match(sql,/s->'dispatchPerformed' IS DISTINCT FROM 'false'::jsonb/);
});
test('reverse분기source는기존START검사본문을그대로포함하며원0018파일hash와trigger는불변이다',async()=>{
 const original=await readFile(new URL('../../../db/migrations/0018_execution_observation.sql',import.meta.url)),text=original.toString('utf8').replaceAll('\r\n','\n'),sql=await readFile(path,'utf8');assert.equal(createHash('sha256').update(original).digest('hex').toUpperCase(),'547DEBDE0FA13F24401DDCF538A8A178147D5C9BCB60863B634A798B4BB896E5');const start=text.slice(text.indexOf('CREATE FUNCTION anvil.guard_execution_permit_proof_complete()')),match=start.match(/ IF c\.snapshot_json->'request'->'target'->>'path' ~ [\s\S]*?;END IF;/);assert(match);assert(sql.includes(match[0]));assert(!sql.includes('CREATE CONSTRAINT TRIGGER execution_permit_proof_complete_'));assert(!sql.includes('CREATE TABLE anvil.execution_start_permits'));
});
test('reverse분기source는저장명령정확1행/전체path와START_SEND별표검사·다른종류거절을고정한다',async()=>{
 const sql=await readFile(path,'utf8'),reverse=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION anvil.guard_execution_permit_proof_complete'));for(const marker of ["IF n<>1 THEN RAISE EXCEPTION", "q.snapshot_json->'envelope'->>'operation'='START_SESSION'", "q.snapshot_json->'envelope'->>'operation'='SEND_INSTRUCTION'", "q.snapshot_json->>'state'='SYNTHETIC_INSTRUCTION_QUEUED'", "p.command_record_id=q.id", "p.envelope_hash=q.envelope_hash", "p.snapshot_json->'reservationRef'=q.snapshot_json->'reservationRef'", "ELSE RAISE EXCEPTION 'EXECUTION_PERMIT_PROOF_REVERSE_ATOMIC_REQUIRED'"])assert(reverse.includes(marker),marker);assert(reverse.includes("'/api/v1/connectors/'"));assert(reverse.includes("'/executions/'"));assert(reverse.includes("'/commands/'"));
});
test('SENDpermit SQL소스의HUMAN영수증주체는실생산자의user/client3필드계약이다',async()=>{
 const sql=await readFile(path,'utf8');assert(sql.includes("a.subject_ref=jsonb_build_object('kind','HUMAN','userId',c.actor_id,'clientId',c.client_id)"));
});
test('SENDpermit SQL소스는행크기뿐아니라신규행포함전체canonical journal2MiB도검사한다',async()=>{
 const sql=await readFile(path,'utf8');for(const marker of ["jsonb_build_object('complete',true,'permits'",'jsonb_agg(',"jsonb_build_array(jsonb_build_object('ref',jsonb_build_object('id',NEW.id",'INSTRUCTION_PERMIT_JOURNAL_LIMIT'])assert(sql.includes(marker),marker);
});
