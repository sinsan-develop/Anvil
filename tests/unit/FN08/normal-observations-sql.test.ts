import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
/** 0090은 미적용 source다. 실제 PostgreSQL 실행은 하지 않으며 여기서는 원문 구조만 고정한다. */
const read=(name:string)=>readFileSync(new URL('../../../db/migrations/'+name,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const sql=read('0090_normal_observations.sql.pending'),p89=read('0089_normal_start_permit.sql.pending'),p18=read('0018_execution_observation.sql');
function fn(text:string,head:string){const i=text.indexOf(head);assert.ok(i>=0,head);return text.slice(i,text.indexOf('\n$$;\n',i)+5);}
test('0090은 하나의 거래로 끝나고 normal 관측 guard·영수증 검사·transport 제약·trigger 분리를 둔다',()=>{
 assert.match(sql,/^--[^\n]*\n--[^\n]*\n--[^\n]*미적용 source[^\n]*\nBEGIN;\n/);assert.match(sql,/\nCOMMIT;\n$/);assert.equal(sql.match(/^COMMIT;$/gm)!.length,1);
 for(const s of ['CREATE FUNCTION anvil.normal_observation_receipt_valid(r anvil.execution_receipts)','CREATE FUNCTION anvil.guard_normal_execution_observation()',
  "CHECK (coalesce(snapshot_json->>'transport','') IN ('SYNTHETIC_ONLY','NORMAL_PROTECTED'))",
  "WHEN (NEW.snapshot_json->>'transport'='SYNTHETIC_ONLY') EXECUTE FUNCTION anvil.guard_execution_observation();",
  'CREATE TRIGGER execution_observation_immutable BEFORE UPDATE OR DELETE ON anvil.execution_observations FOR EACH ROW EXECUTE FUNCTION anvil.guard_execution_observation();',
  "WHEN (NEW.snapshot_json->>'transport'='NORMAL_PROTECTED') EXECUTE FUNCTION anvil.guard_normal_execution_observation();",
  "WHEN (NEW.snapshot_json->>'kind'='NORMAL_OBSERVATIONS') EXECUTE FUNCTION anvil.guard_normal_observation_receipt();",
  "current_setting('anvil.normal_observation_verified',true)"])assert.ok(sql.includes(s),s);
 assert.ok(!/CREATE (OR REPLACE )?FUNCTION anvil\.guard_execution_observation\(\)/.test(sql));
 assert.equal(sql.match(/IS DISTINCT FROM 'NORMAL_OBSERVATIONS'\) EXECUTE FUNCTION/g)!.length,2);
});
test('0090이 옮겨 온 함수는 원본과 표시한 곳만 다르다',()=>{
 assert.equal(fn(sql,'CREATE OR REPLACE FUNCTION anvil.normal_command_consumption_valid('),
  fn(p89,'CREATE OR REPLACE FUNCTION anvil.normal_command_consumption_valid(').replace("'NORMAL_START_PERMIT')","'NORMAL_START_PERMIT','NORMAL_OBSERVATIONS')"));
 const c=fn(p89,'CREATE OR REPLACE FUNCTION anvil.normal_request_challenge_valid('),d=fn(sql,'CREATE OR REPLACE FUNCTION anvil.normal_request_challenge_valid(');
 const cut="'/[0-9a-f-]{36}/permit$')\n";const ci=c.indexOf(cut)+cut.length,di=d.indexOf(cut)+cut.length;
 assert.equal(d.slice(0,di),c.slice(0,ci));
 const tail=c.slice(c.indexOf("  OR jsonb_typeof(t->'queryHash')"));assert.ok(d.endsWith(tail));
 assert.ok(d.slice(di,d.length-tail.length).includes("||'/observations'"));
 // 합성 관측 현재성 식은 그대로 ELSE 분기에 남는다.
 // 괄호 안에 넣으므로 원 식 끝의 세미콜론만 빠진다(괄호 안 세미콜론은 문법 오류).
 const cur=fn(p18,'CREATE FUNCTION anvil.execution_observation_current('),body=cur.slice(cur.indexOf(' SELECT COALESCE('),cur.indexOf('\n$$;')).replace(/;$/,'');
 const replaced=fn(sql,'CREATE OR REPLACE FUNCTION anvil.execution_observation_current(');
 assert.ok(replaced.includes('ELSE (\n'+body+'\n  ) END;'));assert.ok(!replaced.includes(';\n  ) END;'));
 // normal 관측 guard는 원 guard와 transport·credential 세대·marker·오류 이름만 다르다.
 const o=fn(p18,'CREATE FUNCTION anvil.guard_execution_observation()'),n=fn(sql,'CREATE FUNCTION anvil.guard_normal_execution_observation()');
 const norm=(t:string)=>t.replace('guard_normal_execution_observation','guard_execution_observation').replace(/NORMAL_EXECUTION_OBSERVATION_EXACT_CLAIM_REQUIRED/g,'EXECUTION_OBSERVATION_EXACT_CLAIM_REQUIRED')
  .replace("'NORMAL_PROTECTED'","'SYNTHETIC_ONLY'").replace(/\n  -- \(0090 변경\)[^\n]*\n  OR s->'credentialGeneration' IS DISTINCT FROM g\.snapshot_json#>'\{binding,executionCredentialReservation,generation\}'\n  OR split_part\(current_setting\('anvil\.normal_observation_verified',true\),':',1\) IS DISTINCT FROM txid_current\(\)::text/," OR s->'credentialGeneration' IS DISTINCT FROM '1'::jsonb");
 assert.equal(norm(n),o);
});
