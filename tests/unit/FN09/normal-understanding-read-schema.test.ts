import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../../../db/migrations/0102_normal_understanding_responses.sql.pending',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
test('FN09 original START queue/envelope retain the 0083 execution hash; new request C/A/U keep their own hash',async()=>{
 const original=await readFile(new URL('../../../db/migrations/0083_normal_initial_execution.sql.pending',import.meta.url),'utf8');
 assert.ok(original.includes('x.content_hash IS DISTINCT FROM anvil.execution_json_hash(q)'));
 assert.ok(original.includes("x.envelope_hash IS DISTINCT FROM anvil.execution_json_hash(env-'envelopeHash')"));
 assert.ok(sql.includes("x.content_hash IS DISTINCT FROM anvil.execution_json_hash(x.snapshot_json-'envelope')"));
 assert.ok(sql.includes("x.envelope_hash IS DISTINCT FROM anvil.execution_json_hash((x.snapshot_json->'envelope')-'envelopeHash')"));
 assert.equal((sql.split('-- S3 DISCOVERY acquisition.')[0]!.match(/anvil\.execution_json_hash\(/g)??[]).length,2);
 for(const fragment of ['r.content_hash IS DISTINCT FROM anvil.fn01_hash(s)','c.request_hash IS DISTINCT FROM anvil.fn01_hash(q)','scope_hash=anvil.fn01_hash(',"ref->>'contentHash' IS DISTINCT FROM anvil.fn01_hash(snapshot)"])assert.ok(sql.includes(fragment));
});
test('FN09 request forward is a bounded metadata-only immutable pending ledger, not an output or dispatch table',()=>{
 assert.match(sql,/CREATE TABLE anvil\.normal_understanding_read_requests/);assert.match(sql,/sourceScope.*null/);assert.match(sql,/PENDING_SOURCE/);
 assert.match(sql,/octet_length.*8192/);assert.match(sql,/count\(\*\).*1000/s);assert.match(sql,/BEFORE UPDATE OR DELETE/);
 assert.doesNotMatch(sql,/GRANT .* ON anvil\.(execution_commands|execution_challenges|execution_observations|understanding_reviews)/);
});
test('FN09 request SQL rechecks original HUMAN/current policy and normal source instead of GUC/verified claims',()=>{
 assert.match(sql,/anvil\.fn01_active\(s,a,c\)/);assert.match(sql,/FOR UPDATE/);assert.match(sql,/normal_exchange_current/);assert.match(sql,/normal_start_material_complete/);
 assert.match(sql,/CONTEX[T]_REVIEW/);assert.match(sql,/disposition.*AUTO/s);assert.match(sql,/txid_current\(\)::text/);assert.doesNotMatch(sql.split('-- S3 DISCOVERY acquisition.')[0]!,/set_config|get_setting|current_setting/);
});
test('FN09 request graph requires C/A/U in both directions and never grants public function execution',()=>{
 assert.match(sql,/authorization_receipts/);assert.match(sql,/audit_events/);assert.match(sql,/CREATE CONSTRAINT TRIGGER fn09_understanding_request_command_complete/);
 assert.match(sql,/DEFERRABLE INITIALLY DEFERRED/);assert.match(sql,/REVOKE ALL ON FUNCTION.*FROM PUBLIC/s);assert.match(sql,/REVOKE ALL ON anvil\.normal_understanding_read_requests FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/CREATE ROLE|GRANT .*execution_grants|INSERT INTO anvil\.delivery_outbox/);
 assert.doesNotMatch(sql,/GRANT SELECT ON anvil\.normal_understanding_read_requests|GRANT EXECUTE[^;]*request_complete/);
 assert.match(sql,/fn09_normal_understanding_request_replay\(s uuid,a uuid,c uuid,q jsonb,policy jsonb,expected_tx text\)/);
});

test('0102 preserves exact latest legacy validator definitions by rename/delegation and receipt trigger timing/order',async()=>{
 const {createHash}=await import('node:crypto');
 const prior90=await readFile(new URL('../../../db/migrations/0090_normal_observations.sql.pending',import.meta.url));
 const prior97=await readFile(new URL('../../../db/migrations/0097_normal_instruction_dispatch.sql.pending',import.meta.url));
 assert.equal(createHash('sha256').update(prior90).digest('hex'),'230612c862be0901ef3f5765eae5ef0ea0d774ce1693cd999940a5229e47f73c');
 assert.equal(createHash('sha256').update(prior97).digest('hex'),'2cfa7393922f5d91664345b2c63c764d7540cebcbfdbce7ec29a7cfbbb9ee025');
 for(const [name,arg] of [['normal_request_challenge_valid','n'],['normal_command_consumption_valid','v']] as const){
  assert.ok(sql.includes('ALTER FUNCTION anvil.'+name+'(anvil.execution_challenges,boolean) RENAME TO '+name+'_pre0102;'));
  assert.ok(sql.includes('RETURN anvil.'+name+'_pre0102('+arg+',deferred_check);'));
  assert.doesNotMatch(sql,new RegExp('CREATE(?: OR REPLACE)? FUNCTION anvil\\.'+name+'_pre0102'));
  assert.doesNotMatch(sql,new RegExp('ALTER FUNCTION anvil\\.'+name+'_pre0102[^;]*(OWNER|SET|RESET)|(?:REVOKE|GRANT)[^;]*'+name+'_pre0102'));
 }
 const prior=prior97.toString('utf8'),begin=prior.indexOf('DROP TRIGGER synthetic_execution_receipt_guard'),end=prior.indexOf('\n',prior.indexOf('EXECUTE FUNCTION anvil.guard_execution_challenge_complete();',begin))+1;
 const currentBegin=sql.indexOf('DROP TRIGGER synthetic_execution_receipt_guard'),currentEnd=sql.indexOf('\n',sql.indexOf('EXECUTE FUNCTION anvil.guard_execution_challenge_complete();',currentBegin))+1;
 assert.equal(sql.slice(currentBegin,currentEnd).replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'",'').replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_DISCOVERY_RESULT'",'').replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_RANGE_ACQUIRED'",''),prior.slice(begin,end));
 assert.match(sql,/CREATE TRIGGER normal_understanding_acquisition_guard BEFORE INSERT/);
 assert.match(sql,/CREATE CONSTRAINT TRIGGER normal_understanding_acquisition_complete AFTER INSERT[^;]*DEFERRABLE INITIALLY DEFERRED/);
 assert.match(sql,/request_basis\(\(r.snapshot_json#>>'\{requestedBy,sessionId\}'\)::uuid,cmd.actor_id,cmd.client_id/);
 assert.match(sql,/x.request_id IS DISTINCT FROM signed_request_id/);
 assert.match(sql,/CREATE UNIQUE INDEX normal_understanding_challenge_request_once/);
 assert.doesNotMatch(sql,/GRANT SELECT ON anvil\.normal_understanding_read_requests|CREATE ROLE/);
});

test('result basis reads exact historical GET completion under current authority; does not store custody or reuse POST identity as GET uniqueness',()=>{
 const start=sql.indexOf('CREATE FUNCTION anvil.fn09_normal_understanding_result_basis('),end=sql.indexOf('\n$$;',start);
 assert.ok(start>0&&end>start);const basis=sql.slice(start,end);
 assert.match(basis,/SECURITY INVOKER SET search_path=pg_catalog/);
 assert.match(basis,/id=\(expected_acquisition->>'id'\)::uuid AND version=1/);
 assert.match(basis,/g\.snapshot_json->'understandingRequestRef' IS DISTINCT FROM expected_request/);
 assert.match(basis,/u\.snapshot_json IS DISTINCT FROM/);
 assert.match(basis,/jsonb_build_object\('resultRef',expected_acquisition,'packetHash',s->'packetHash','consumedAt',s->'observedAt'\)/);
 assert.match(basis,/fn09_normal_understanding_discovery\(token,b,\(s->>'requestId'\)::uuid,expected_request\)/);
 assert.match(basis,/normal_request_credential/);assert.match(basis,/normal_exchange_current/);
 assert.match(basis,/s->'context' IS DISTINCT FROM d#>'\{snapshot,context\}'/);
 assert.match(basis,/ends<=clock_timestamp\(\)/);
 assert.doesNotMatch(basis,/INSERT INTO|UPDATE |DELETE FROM|set_config|current_setting|nativeVerified|sourceVerified/);
 assert.match(sql,/ALTER FUNCTION anvil\.fn09_normal_understanding_result_basis\(text,jsonb,jsonb,jsonb\) OWNER TO anvil_v3_migrator/);
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.fn09_normal_understanding_result_basis\(text,jsonb,jsonb,jsonb\) FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/CREATE TABLE anvil\.normal_understanding_(?:read_results|responses)|NORMAL_UNDERSTANDING_RESULT_STORED/);
 const challenge=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn09_normal_understanding_challenge_valid'),sql.indexOf('ALTER FUNCTION anvil.normal_request_challenge_valid'));
 assert.match(challenge,/jsonb_build_object\('method','GET','path'/);
 const consumption=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn09_normal_understanding_consumption_valid'),sql.indexOf('ALTER FUNCTION anvil.normal_command_consumption_valid'));
 assert.match(consumption,/jsonb_build_object\('method','GET','path'/);assert.doesNotMatch(consumption,/'method','POST'/);
});

test('internal result v1 has a separate request slot and exact acquisition/current proof; no role or default POST activation',async()=>{
 assert.ok(sql.includes("CREATE UNIQUE INDEX normal_understanding_challenge_request_once ON anvil.execution_challenges(project_id,((snapshot_json->'understandingRequestRef'->>'id')))\n WHERE version=1 AND snapshot_json ? 'understandingRequestRef';"));
 assert.match(sql,/CREATE UNIQUE INDEX normal_understanding_result_challenge_once[^;]*understandingResultBinding,requestRef,id[^;]*WHERE version=1 AND snapshot_json \? 'understandingResultBinding'/s);
 const challenge=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn09_normal_understanding_challenge_valid'),sql.indexOf('ALTER FUNCTION anvil.normal_request_challenge_valid'));
 for(const key of ['understandingResultBinding','requestRef','acquisitionRef','fn09_normal_understanding_result_basis','getConsumed,snapshot,sequence','getChallenge,snapshot_json,request,requestId','getChallenge,snapshot_json,request,clientNonce','getChallenge,snapshot_json,serverNonceDigest',"total<10000 AND recent<60 AND live=0"]){assert.ok(challenge.includes(key),key);}
 assert.match(challenge,/jsonb_build_object\('method','POST','path'[^\n]*requestRef,id[^\n]*'\/result'/);
 assert.doesNotMatch(sql,/NORMAL_UNDERSTANDING_RESULT_STORED|CREATE ROLE|GRANT[^;]*(?:PUBLIC|UPDATE|DELETE)/);
 const source=await readFile(new URL('../../../apps/server/modules/executions/normal-exchange-challenge.ts',import.meta.url),'utf8');
 assert.ok(source.includes("if((request.target.path===understanding||request.target.path.startsWith(understanding+'/'))&&!discovery&&!range)"));
 assert.ok(source.includes("if(requestedRange&&!range)return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503)"));
 assert.ok(source.includes("return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503)"));
});

function definition(name:string){const start=sql.indexOf('CREATE FUNCTION anvil.'+name+'('),end=sql.indexOf('$$;',start)+3;assert.ok(start>=0&&end>start,name);return sql.slice(start,end);}

test('HUMAN current metadata uses exact private projection, independent current policy and historical settlement without new writes',()=>{
 const body=definition('fn09_normal_understanding_metadata_current');
 assert.match(body,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(body,/expected_tx IS DISTINCT FROM txid_current\(\)::text/);
 assert.match(body,/fn01_active\(s,a,c\)/);
 assert.ok(body.indexOf('fn09_normal_understanding_request_basis(s,a,c,command,policy,expected_tx)')<body.indexOf('SELECT \* INTO h'.replace('\\','')));
 for(const token of ['requestedBy,userId','requestedBy,clientId','requestedBy,sessionId','selection->\'requestRef\' IS DISTINCT FROM','h.execution_id','h.generation',
  'fn09_normal_understanding_request_complete','fn09_normal_understanding_result_pair_historical','fn09_normal_understanding_storage_complete','last_basis','context',
  "version=2 AND snapshot_json#>>'{understandingResultBinding,requestRef,id}'=rid::text","part_kind='FN09_DISCOVERY_METADATA'",'LIMIT 2',
  "least(h.expires_at",'storageExpiresAt','CURRENT_UNAVAILABLE',"'selectionAvailable',false"]){assert.ok(body.includes(token),token);}
 assert.match(body,/NORMAL_UNDERSTANDING_METADATA_INTEGRITY_FAILED/);
 assert.doesNotMatch(body,/INSERT INTO|UPDATE |DELETE FROM|set_config|current_setting|normal_request_credential|fn09_normal_understanding_result_custody_valid|EXECUTE /);
 assert.match(sql,/ALTER FUNCTION anvil\.fn09_normal_understanding_metadata_current\(uuid,uuid,uuid,jsonb,jsonb,text\) OWNER TO anvil_v3_migrator/);
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.fn09_normal_understanding_metadata_current\(uuid,uuid,uuid,jsonb,jsonb,text\) FROM PUBLIC,anvil_v3_app/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION anvil\.fn09_normal_understanding_metadata_current\(uuid,uuid,uuid,jsonb,jsonb,text\) TO anvil_v3_app/);
 assert.doesNotMatch(sql,/GRANT SELECT ON anvil\.normal_understanding_read_requests|CREATE ROLE/);
 const projection=body.slice(body.lastIndexOf("RETURN jsonb_build_object('status','METADATA_STORED'"));
 assert.doesNotMatch(projection,/token|credentialRef|acquisitionRef|snapshot_json|sessionBindingRef|binding|sourceScope|bodyHash/);
});
test('historical metadata accounting is independent of expiry/revocation/current credentials; new admission remains current and bounded',()=>{
 for(const name of ['fn09_normal_understanding_result_pair_historical','fn09_normal_understanding_storage_plan','fn09_normal_understanding_storage_complete']){
  const body=definition(name);assert.doesNotMatch(body,/clock_timestamp|current_setting|normal_exchange_current|normal_request_credential|fn09_normal_understanding_result_basis/);
 }
 const plan=definition('fn09_normal_understanding_storage_plan');
 assert.match(plan,/bytes=octet_length\(anvil.execution_authority_canonical\(records\)\)/);
 for(const part of ['request','humanCommand','humanAuthorization','humanAudit','credentialReservation','credentialV1','credentialV2','credentialReceipt','getV1','getV2','acquisition','postV1','postV2','result'])assert.ok(plan.includes("'"+part+"'"),part);
 assert.match(plan,/SET TimeZone='UTC'/);
 const admission=definition('fn09_normal_understanding_result_admission');
 assert.match(admission,/fn09_normal_understanding_result_basis/);assert.match(admission,/authorized_until<=clock_timestamp\(\)/);assert.match(admission,/normal_page_verified/);
 assert.match(admission,/fn09_normal_understanding_storage_complete/);
});
test('atomic result purpose uses existing VERIFIED account/cap and globally rejects a second transaction latch without accepting caller bytes',()=>{
 const store=definition('fn09_normal_understanding_result_store');
 assert.match(store,/coverage_state IS DISTINCT FROM 'VERIFIED'/);assert.match(store,/FOR UPDATE/);
 assert.match(store,/ac.used_bytes\+ac.held_bytes\+charge>10737418240/);
 assert.match(store,/part_kind='FN09_DISCOVERY_METADATA' AND z.plan_json->>'transactionId'=tx/);
 assert.doesNotMatch(store,/project_id=old.project_id AND z.plan_json/);
 assert.ok(store.indexOf('fn09_normal_understanding_result_basis')<store.indexOf('INSERT INTO anvil.project_storage_reservations'));
 assert.ok(store.indexOf('INSERT INTO anvil.project_storage_reservations')<store.indexOf('INSERT INTO anvil.execution_challenges'));
 assert.ok(store.indexOf('INSERT INTO anvil.execution_receipts')<store.indexOf("phase='SETTLED'"));
 assert.match(store,/fn09_normal_understanding_result_admission\(v,true\)/);
 assert.doesNotMatch(store.split('RETURNS')[0]!,/bytes|count|native|verified/i);
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION anvil\.(quota_plan_valid|quota_current|quota_reserve|quota_start|quota_settle)\(/);
 assert.doesNotMatch(sql,/GRANT (?:SELECT|INSERT|UPDATE|DELETE).*project_storage|CREATE ROLE|GRANT[^;]*TO PUBLIC/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[^;]*fn09_normal_understanding_result_store[^;]*FROM PUBLIC,anvil_v3_app/s);
 assert.doesNotMatch(sql,/GRANT[^;]*fn09_normal_understanding_result_admission/);
});
test('FN09 quota forward preserves exact 0059 bytes and all existing FN03/legacy settled branches',async()=>{
 const {createHash}=await import('node:crypto');
 const original=await readFile(new URL('../../../db/migrations/0059_project_storage_quota.sql.pending',import.meta.url));
 const fn03=await readFile(new URL('../../../db/migrations/0101_source_content_policy_management_origins.sql.pending',import.meta.url));
 assert.equal(createHash('sha256').update(original).digest('hex'),'0e13c17946d47a03e388c16d6cc05cab17f13033dec572dedd9e559a0f4e24e7');
 assert.equal(createHash('sha256').update(fn03).digest('hex'),'930f8cd3da7372bb09fe4be49c388aa5a9ca619989a29297b8369a34984231c1');
 const extract=(value:string)=>{const start=value.indexOf('CREATE OR REPLACE FUNCTION anvil.quota_settled_complete(');return value.slice(start,value.indexOf('END;$$;',start)+7);};
 assert.equal(extract(sql).replace(/ -- FN09_METADATA_DISPATCH_BEGIN[\s\S]*? -- FN09_METADATA_DISPATCH_END\n/,''),extract(fn03.toString('utf8')));
});

test('result v2 deferred admission owns only its private definer trigger; invoker GET and legacy page guards retain their exact scope',async()=>{
 const prior=await readFile(new URL('../../../db/migrations/0087_normal_command_pages.sql.pending',import.meta.url),'utf8');
 const trigger=(value:string,name:string)=>{const start=value.indexOf('CREATE '+(name.endsWith('_complete')?'CONSTRAINT ':'')+'TRIGGER '+name+' ');assert.ok(start>=0,name);return value.slice(start,value.indexOf(';',start)+1);};
 for(const name of ['normal_page_consumption_guard','normal_page_consumption_complete']){
  const current=trigger(sql,name);
  assert.equal(current.replace(" AND NOT (NEW.snapshot_json ? 'understandingResultBinding')",'').replace(" AND NOT (NEW.snapshot_json ? 'understandingRangeRequestRef')",''),trigger(prior,name));
 }
 const consumption=definition('fn09_normal_understanding_consumption_valid');
 assert.match(consumption,/IF FOUND AND old\.snapshot_json \? 'understandingResultBinding' THEN RETURN false;END IF/);
 assert.doesNotMatch(consumption,/fn09_normal_understanding_result_admission/);
 const guard=definition('guard_fn09_normal_understanding_result_consumption');
 assert.match(guard,/SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(guard,/NEW\.version<>2/);assert.match(guard,/NOT \(NEW\.snapshot_json \? 'understandingResultBinding'\)/);
 assert.match(guard,/fn09_normal_understanding_result_admission\(NEW::anvil.execution_challenges,TG_WHEN='AFTER'\)/);
 assert.match(sql,/ALTER FUNCTION anvil\.guard_fn09_normal_understanding_result_consumption\(\) OWNER TO anvil_v3_migrator/);
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil\.guard_fn09_normal_understanding_result_consumption\(\) FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/GRANT[^;]*(?:result_admission|guard_fn09_normal_understanding_result_consumption)/);
 for(const name of ['fn09_understanding_result_consumption_guard','fn09_understanding_result_consumption_complete']){
  const statement=trigger(sql,name);assert.match(statement,/WHEN \(NEW.version=2 AND NEW.snapshot_json \? 'understandingResultBinding'\)/);
  assert.match(statement,/EXECUTE FUNCTION anvil.guard_fn09_normal_understanding_result_consumption\(\)/);
  if(name.endsWith('_complete'))assert.match(statement,/AFTER INSERT[^;]*DEFERRABLE INITIALLY DEFERRED/);
 }
 // 이 검산은 SQL 호출선/ACL의 정적 증거다. 실제 app COMMIT의 trigger 권한 실행을 대체하지 않는다.
});

test('fixed range aggregate text bound applies only to new/current admission, never historical accounting or exact HUMAN replay',()=>{
 for(const name of ['fn09_normal_understanding_range_basis','fn09_normal_understanding_range_connector_current']){
  const body=definition(name);assert.match(body,/sum\(\(r->>'textBytes'\)::bigint\)/);assert.match(body,/jsonb_array_elements\(x->'ranges'\)/);assert.match(body,/>2097152/);
 }
 for(const name of ['fn09_normal_understanding_range_valid','fn09_normal_understanding_range_historical','fn09_normal_understanding_range_replay','fn09_normal_understanding_range_plan','fn09_normal_understanding_range_complete'])assert.doesNotMatch(definition(name),/sum\(\(r->>'textBytes'\)::bigint\)/);
});

test('fixed range admission uses exact current parent and existing purpose RPC, with no discovery rows, connector nonce or new role grants',()=>{
 const valid=definition('fn09_normal_understanding_range_valid');
 for(const text of ["ARRAY['requestRef','resultRef','initConfirmationRef','tailRef','firstSequence','lastSequence','ranges']","BETWEEN 1 AND 200","to_jsonb((x->>'firstSequence')::bigint+i)","{initConfirmationRef,id}","{tailRef,id}",'blocks>200'])assert.ok(valid.includes(text),text);
 const basis=definition('fn09_normal_understanding_range_basis');
 for(const text of ['fn09_normal_understanding_range_authorize','fn09_normal_understanding_metadata_current',"'METADATA_STORED'","'CURRENT'","v->'resultRef' IS DISTINCT FROM x->'resultRef'","expected IS DISTINCT FROM x->'ranges'","least(until_at,(v->>'expiresAt')::timestamptz)"])assert.ok(basis.includes(text),text);
 const auth=definition('fn09_normal_understanding_range_authorize');
 for(const text of ['fn01_active(s,a,c)','FOR UPDATE',"participation='OWNER'",'FOR SHARE',"rule->>'disposition' IS DISTINCT FROM 'AUTO'","rule->'limitPolicyRef' IS DISTINCT FROM 'null'::jsonb",'hs.reauth_until<=at','txid_current()::text'])assert.ok(auth.includes(text),text);
 const insert=definition('fn09_normal_understanding_request_insert'),replay=definition('fn09_normal_understanding_request_replay');
 assert.ok(insert.indexOf('fn09_normal_understanding_range_store')<insert.indexOf('fn09_normal_understanding_request_basis'));
 assert.ok(replay.indexOf('fn09_normal_understanding_range_replay')<replay.indexOf('fn09_normal_understanding_request_basis'));
 const newPurpose=sql.slice(sql.indexOf('-- HUMAN 고정 범위 의사만'));
 assert.doesNotMatch(newPurpose,/CREATE TABLE|CREATE ROLE|GRANT |INSERT INTO anvil\.(?:normal_understanding_read_requests|execution_challenges|execution_receipts|execution_commands)/);
 assert.match(newPurpose,/REVOKE ALL ON FUNCTION[^;]*fn09_normal_understanding_range_store[^;]*FROM PUBLIC,anvil_v3_app/s);
});

test('fixed range accounting uses only new exact immutable C/A/U bytes and remains historical after expiry or revocation',()=>{
 for(const name of ['fn09_normal_understanding_range_historical','fn09_normal_understanding_range_plan','fn09_normal_understanding_range_storage_complete','fn09_normal_understanding_range_complete']){
  const body=definition(name);assert.doesNotMatch(body,/clock_timestamp|transaction_timestamp|fn01_active|normal_exchange_current|normal_request_credential|metadata_current|range_basis|range_authorize/);
 }
 const historical=definition('fn09_normal_understanding_range_historical');
 for(const text of ['fn09_normal_understanding_result_pair_historical(v,r)','fn09_normal_understanding_storage_complete(parent_quota)',"ss#>'{requestedBy,sessionId}'",'EXPLICIT_NORMAL_UNDERSTANDING_RANGE_REQUEST',"expected IS DISTINCT FROM x->'ranges'"])assert.ok(historical.includes(text),text);
 const plan=definition('fn09_normal_understanding_range_plan');
 assert.match(plan,/records=jsonb_build_object\('command',to_jsonb\(cmd\),'authorization',to_jsonb\(ar\),'audit',to_jsonb\(au\)\);bytes=octet_length\(anvil.execution_authority_canonical\(records\)\)/);
 assert.match(plan,/SET TimeZone='UTC'/);assert.match(plan,/'parentResultRef'/);
 assert.match(plan,/coverage IS NULL/);assert.match(plan,/tx IS NULL/);
 const valid=definition('fn09_normal_understanding_range_plan_valid');assert.match(valid,/jsonb_typeof\(p->'transactionId'\) IS DISTINCT FROM 'string'/);assert.match(valid,/jsonb_typeof\(p->'coverageGeneration'\) IS DISTINCT FROM 'string'/);
 assert.doesNotMatch(plan,/to_jsonb\((?:parent_quota|r|v|h)\)|'humanCommand'|'getV1'|'postV1'/);
 const replay=definition('fn09_normal_understanding_range_replay');assert.match(replay,/range_authorize/);assert.match(replay,/range_complete/);
 assert.doesNotMatch(replay,/INSERT INTO|UPDATE |DELETE FROM|range_basis|metadata_current|range_store/);
 const immutable=definition('guard_fn09_normal_understanding_range_history');
 for(const text of ["TG_TABLE_NAME='commands'","OLD.result_ref","NEW.result_ref",'cid=OLD.command_id','id=NEW.command_id','NORMAL_UNDERSTANDING_RANGE_IMMUTABLE'])assert.ok(immutable.includes(text),text);
 for(const table of ['commands','authorization_receipts','audit_events'])assert.match(sql,new RegExp('BEFORE UPDATE OR DELETE ON anvil\\.'+table+' FOR EACH ROW EXECUTE FUNCTION anvil.guard_fn09_normal_understanding_range_history'));
});

test('fixed range store is same-project lock/CAS, existing VERIFIED cap, exact transaction settlement and deferred current recheck',()=>{
 const body=definition('fn09_normal_understanding_range_store');
 for(const text of ['NORMAL_UNDERSTANDING_RANGE_PENDING',"sourceScope,requestRef}","coverage_state IS DISTINCT FROM 'VERIFIED'",'FOR UPDATE',"plan_json->>'transactionId'=expected_tx",'ac.used_bytes+ac.held_bytes+charge>10737418240',"'RESERVED'","phase='IO_STARTED'","phase='SETTLED'",'held_bytes=held_bytes-charge,used_bytes=used_bytes+charge','fn09_normal_understanding_range_final(cmd)'])assert.ok(body.includes(text),text);
 assert.ok(body.indexOf('range_basis')<body.indexOf('INSERT INTO anvil.project_storage_reservations'));
 const latch=body.slice(body.indexOf("IF EXISTS(SELECT 1 FROM anvil.project_storage_reservations"),body.indexOf('ends=anvil.fn09_normal_understanding_range_basis',body.indexOf('SELECT * INTO STRICT ac')));
 assert.doesNotMatch(latch,/project_id=/);
 const final=definition('fn09_normal_understanding_range_final');assert.match(final,/txid_current\(\)::text/);assert.match(final,/range_basis/);assert.match(final,/expiresAt.*clock_timestamp/);
 assert.match(definition('fn09_normal_understanding_request_final'),/PERFORM anvil.fn09_normal_understanding_range_final\(c\);RETURN NULL/);
 const dispatch=sql.slice(sql.indexOf('-- FN09_METADATA_DISPATCH_BEGIN'),sql.indexOf('-- FN09_METADATA_DISPATCH_END'));
 assert.match(dispatch,/fn09_normal_understanding_range_storage_complete\(r\)/);
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION anvil\.(?:quota_plan_valid|quota_current|quota_reserve|quota_start|quota_settle)\(/);
});

test('fixed range forward retains exact original discovery, current metadata, challenge/consumption and settled metadata functions',async()=>{
 const {createHash}=await import('node:crypto');
 const original={fn09_normal_understanding_discovery:'627c6769874011a14332945f9d86183d42acd2777cc5ccfb671a32faa4e6f4e3',
  fn09_normal_understanding_metadata_current:'91d227bedaee509d18247f7cd8313fb6c0237e6cc22203deca8aea8325c62c5a',
  fn09_normal_understanding_challenge_valid:'f04d6109c957e0154f8767c80da5b974846f9005858709675731e400ab9432ca',
  fn09_normal_understanding_consumption_valid:'0cae65df8c1ab09b5a33424a363fbe0de5784346471417e3f2df1dbce9b67f63',
  fn09_normal_understanding_result_pair_historical:'6767b3e8a31a300b40872e7187dd02eef2e2beb1aa91e26bb3069ffa4c559720',
  fn09_normal_understanding_result_store:'c2aa2d863f425e6f04a0f7f7ecc92b93f09b8bbf507b00f6b2e2d5b6e12e9d03'};
 for(const [name,digest] of Object.entries(original))assert.equal(createHash('sha256').update(definition(name).replace(/\r\n/g,'\n').replace(" IF expected->>'purpose'='FIXED_RANGE' THEN RETURN anvil.fn09_normal_understanding_range_connector_current(token,b,signed_request_id,expected);END IF;\n",'')).digest('hex'),digest,name);
});

test('range connector current preserves auth SHARE then project lock, exact settled parent and HUMAN policy without auth lock upgrade',()=>{
 const body=definition('fn09_normal_understanding_range_connector_current');
 for(const token of ['normal_request_credential','normal_exchange_current','FOR SHARE OF hs0,u,cl','FOR SHARE OF m,pc0','fn09_normal_understanding_range_complete','NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST','LIMIT 2','understandingRangeRequestRef',"'NONE'","'RANGE_REQUEST'",'reauth_until','EXPIRES'])assert.ok(body.toUpperCase().includes(token.toUpperCase()),token);
 assert.doesNotMatch(body,/fn01_active|fn09_normal_understanding_range_basis|fn09_normal_understanding_metadata_current|FOR UPDATE OF (?:hs|u|cl)|INSERT INTO|UPDATE anvil|DELETE FROM/);
 const discovery=definition('fn09_normal_understanding_discovery');assert.match(discovery,/expected->>'purpose'='FIXED_RANGE'/);
 assert.match(sql,/CREATE UNIQUE INDEX normal_understanding_range_challenge_once/);
});

test('range transport has private purpose triggers, current admission and immutable historical bytes for separate issue/acquisition charges',()=>{
 const complete=definition('fn09_normal_understanding_range_transport_complete');
 assert.doesNotMatch(complete,/clock_timestamp|normal_request_credential|normal_exchange_current|range_connector_current/);
 for(const name of ['fn09_normal_understanding_range_transport_valid','fn09_normal_understanding_range_transport_plan'])assert.doesNotMatch(definition(name),/clock_timestamp|fn01_active|normal_exchange_current|normal_request_credential|range_connector_current/);
 const charge=definition('fn09_normal_understanding_range_transport_charge');
 for(const token of ['FOR UPDATE',"coverage_state IS DISTINCT FROM 'VERIFIED'",'ac.used_bytes+ac.held_bytes+charge>10737418240',"'fn09_range_issue'","'fn09_range_acquire'",'range_transport_plan','range_transport_admission',"phase='SETTLED'"])assert.ok(charge.includes(token),token);
 assert.match(definition('fn09_normal_understanding_range_transport_plan'),/octet_length\(anvil.execution_authority_canonical\(records\)\)/);
 assert.match(definition('fn09_normal_understanding_range_transport_admission'),/range_connector_current/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[^;]*range_transport_charge[^;]*FROM PUBLIC,anvil_v3_app/s);
 assert.doesNotMatch(sql,/GRANT[^;]*(?:range_connector_current|range_transport|guard_fn09_range)/);
 for(const table of ['execution_challenges','execution_receipts'])assert.match(sql,new RegExp('ON anvil\\.'+table+'[^;]*guard_fn09_range'));
 for(const name of ['fn09_range_challenge_complete','fn09_range_receipt_complete'])assert.match(sql,new RegExp('CREATE CONSTRAINT TRIGGER '+name+' AFTER INSERT[^;]*DEFERRABLE INITIALLY DEFERRED[^;]*guard_fn09_range'));
 assert.match(sql,/CREATE TRIGGER fn09_range_issue_settle AFTER INSERT[^;]*NEW.version=1[^;]*settle_fn09_range_transport/);
 assert.match(sql,/CREATE TRIGGER fn09_range_receipt_settle AFTER INSERT[^;]*NORMAL_UNDERSTANDING_RANGE_ACQUIRED[^;]*settle_fn09_range_transport/);
 const shapeAt=sql.indexOf('CREATE FUNCTION anvil.fn09_normal_understanding_range_transport_plan_valid('),checkAt=sql.indexOf("WHEN part_kind='FN09_RANGE_TRANSPORT'");assert.ok(shapeAt>0&&shapeAt<checkAt);
});
