import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(name:string)=>readFile(new URL('../../../db/migrations/'+name,import.meta.url),'utf8');
test('0092는 v1 원 권위 완결 함수를 보존하고 exact v2 operation만 별도 수용한다',async()=>{
 const old=await source('0071_native_preparation_authority.sql.pending'),next=await source('0092_native_preparation_ownership_return.sql.pending');
 const name='FUNCTION anvil.native_preparation_authority_complete(p uuid,a uuid)',begin=old.indexOf('CREATE '+name),end=old.indexOf('END;$$;',begin)+7;
 const expected=old.slice(begin,end).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace("g->'schemaVersion'<>'1'::jsonb","NOT ((g->'schemaVersion'='1'::jsonb AND g->'allowedOperations'='[\"CHECK_NATIVE_PREPARATION_CURRENT\",\"CONSUME_NATIVE_PREPARATION\"]'::jsonb) OR (g->'schemaVersion'='2'::jsonb AND g->'allowedOperations'='[\"CHECK_NATIVE_PREPARATION_CURRENT\",\"CONSUME_NATIVE_PREPARATION\",\"RETURN_NATIVE_PREPARATION_OWNERSHIP\"]'::jsonb))").replace(" OR g->'allowedOperations'<>'[\"CHECK_NATIVE_PREPARATION_CURRENT\",\"CONSUME_NATIVE_PREPARATION\"]'::jsonb",'');
 const start=next.indexOf('CREATE OR REPLACE '+name),stop=next.indexOf('END;$$;',start)+7;
 assert.ok(start>=0);assert.equal(next.slice(start,stop).replaceAll('\r\n','\n'),expected.replaceAll('\r\n','\n'));
 assert.doesNotMatch(next,/DISABLE\s+TRIGGER|ALTER\s+.*OWNER\s+TO|GRANT\s+.*TO\s+PUBLIC/i);
});

test('0092 native 부모는 닫힌 XOR이며 원 synthetic 거절/관측 역방향/불변 guard를 보존한다',async()=>{
 const old=await source('0039_ownership_authority.sql.pending'),next=await source('0092_native_preparation_ownership_return.sql.pending');
 assert.match(next,/CREATE TABLE anvil\.native_preparation_ownership_bindings/);
 assert.match(next,/CREATE TABLE anvil\.native_preparation_ownership_results/);
 assert.match(next,/CONSTRAINT native_return_anchor_parent_xor CHECK/);
 assert.doesNotMatch(next,/TG_TABLE_NAME='execution_ownership_anchors' AND NEW\./);
 assert.match(next,/TG_TABLE_NAME='execution_ownership_anchors' AND r->'native_return_binding_ref'/);
 assert.match(next,/native_return_binding_ref IS NULL AND preparation_event_ref IS NOT NULL/);
 assert.match(next,/native_return_binding_ref IS NOT NULL AND preparation_event_ref IS NULL/);
 assert.match(next,/FOREIGN KEY\(project_id,execution_id,execution_generation,native_return_binding_id,native_return_binding_hash\)/);
 for(const name of ['ownership_record_shape_guard','ownership_anchor_links_guard','ownership_authority_unavailable']){
  const prefix='CREATE FUNCTION anvil.'+name+'()',start=old.indexOf(prefix),end=old.indexOf('END;$$;',start)+7;
  const original=old.slice(start,end),replacement='CREATE OR REPLACE FUNCTION anvil.'+name+'()',at=next.indexOf(replacement),stop=next.indexOf('END;$$;',at)+7;
  assert.ok(start>=0&&at>=0,name);
  const changed=next.slice(at,stop).replaceAll('\r\n','\n'),body=original.replaceAll('\r\n','\n').replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION');
  const withoutBranch=changed.replace(/\n \/\* NATIVE_RETURN_BRANCH_BEGIN \*\/[\s\S]*? \/\* NATIVE_RETURN_BRANCH_END \*\//,'');
  assert.equal(withoutBranch,body,name+'의 원본문은 byte 동등하다');
 }
 assert.doesNotMatch(next,/CREATE OR REPLACE FUNCTION anvil\.(ownership_observation_links_guard|ownership_head_cas_guard|ownership_record_immutable)/);
 assert.match(next,/NATIVE_RETURN_GRAPH_INCOMPLETE/);
 assert.match(next,/DEFERRABLE INITIALLY DEFERRED/);
 assert.match(next,/TG_OP<>'INSERT'/);
 assert.match(next,/transaction_isolation[^\n]*read committed/);
 assert.match(next,/created_transaction/);
 assert.match(next,/USING\(false\) WITH CHECK\(false\)/);
 assert.doesNotMatch(next,/DROP\s+(?:TRIGGER|POLICY)|DISABLE\s+TRIGGER|GRANT\s+/i);
});
