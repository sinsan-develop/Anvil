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
