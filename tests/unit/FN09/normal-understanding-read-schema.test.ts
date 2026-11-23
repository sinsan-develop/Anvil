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
 assert.equal(sql.slice(currentBegin,currentEnd).replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'",'').replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_DISCOVERY_RESULT'",'').replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_RANGE_ACQUIRED'",'').replaceAll(" AND NEW.snapshot_json->>'kind' IS DISTINCT FROM 'NORMAL_UNDERSTANDING_RANGE_RESULT'",''),prior.slice(begin,end));
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

test('range result custody has a private immutable bytea row, exact body/part validation and no app raw-data access',()=>{
 assert.match(sql,/CREATE TABLE anvil\.normal_understanding_range_result_bodies/);
 assert.match(sql,/REVOKE ALL ON anvil\.normal_understanding_range_result_bodies FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/GRANT[^;]*ON anvil\.normal_understanding_range_result_bodies/);
 const valid=definition('fn09_normal_understanding_range_result_body_valid');
 for(const token of ['convert_from(raw,\'UTF8\')','convert_to(anvil.execution_authority_canonical(body),\'UTF8\')','FIXED_RANGE_SELECTION','textHash','sha256','blockIndex','2097152','textBlocks','textBytes','beforeRef','afterRef','sourceResultRef'])assert.ok(valid.includes(token),token);
 assert.match(sql,/CREATE TRIGGER fn09_range_body_immutable BEFORE UPDATE OR DELETE/);
 assert.match(sql,/FOREIGN KEY\(project_id,id,version\) REFERENCES anvil\.execution_receipts\(project_id,id,version\) DEFERRABLE INITIALLY DEFERRED/);
});

test('range result basis derives the single consumed GET from path identity and preserves original GET uniqueness',()=>{
 const basis=definition('fn09_normal_understanding_range_result_get')+definition('fn09_normal_understanding_range_result_basis');
 for(const token of ['understandingRangeRequestRef','version=1','version=2','INTO STRICT','range_transport_complete','range_connector_current','range_transport_valid','getChallenge','getConsumed','acquisitionRef','selectionHash'])assert.ok(basis.includes(token),token);
 assert.doesNotMatch(basis,/INSERT INTO|UPDATE anvil|DELETE FROM|set_config/);
 assert.match(sql,/CREATE UNIQUE INDEX normal_understanding_range_result_once[^;]*understandingRangeResultBinding,rangeRequestRef,id[^;]*version=1/s);
 const current=definition('fn09_normal_understanding_range_result_current');
 assert.match(current,/range_result_basis/);assert.match(current,/normal_request_verified/);assert.match(current,/normal_page_verified/);
 assert.match(current,/getChallenge,snapshot_json,request,requestId/);assert.match(current,/getChallenge,snapshot_json,serverNonceDigest/);
});

test('range result historical closure is time independent; atomic reserve/settle counts only new rows plus original bytes once',()=>{
 for(const name of ['fn09_normal_understanding_range_result_historical','fn09_normal_understanding_range_result_plan','fn09_normal_understanding_range_result_complete'])assert.doesNotMatch(definition(name),/clock_timestamp|current_setting|normal_request_credential|normal_exchange_current|range_connector_current|range_result_basis/);
 const plan=definition('fn09_normal_understanding_range_result_plan');
 assert.match(plan,/octet_length\(raw\)/);assert.match(plan,/ISSUE/);assert.match(plan,/STORE/);assert.doesNotMatch(plan,/humanCommand|humanAuthorization|credentialV1|parentResult/);
 const store=definition('fn09_normal_understanding_range_result_store');
 for(const token of ["coverage_state IS DISTINCT FROM 'VERIFIED'",'FOR UPDATE','10737418240',"phase='IO_STARTED'","phase='SETTLED'",'range_result_current','range_result_complete','quota_complete','REPLAY','body_bytes IS DISTINCT FROM raw'])assert.ok(store.includes(token),token);
 assert.ok(store.indexOf('REPLAY')<store.indexOf('INSERT INTO anvil.project_storage_reservations'));
});

test('range result marker-only/receipt-only/body-only writes have exact BEFORE and private deferred guards; legacy scopes stay separate',()=>{
 const guard=definition('guard_fn09_range_result');
 for(const token of ["TG_TABLE_NAME='execution_challenges'","n.snapshot_json ? 'understandingRangeResultBinding'",'range_result_current(n,TG_WHEN=\'AFTER\')','INTO STRICT body','range_result_historical','body.body_bytes'])assert.ok(guard.includes(token),token);
 for(const prefix of ['fn09_range_result_challenge','fn09_range_result_receipt']){
  assert.match(sql,new RegExp('CREATE TRIGGER '+prefix+'_guard BEFORE INSERT[^;]*guard_fn09_range_result'));
  assert.match(sql,new RegExp('CREATE CONSTRAINT TRIGGER '+prefix+'_complete AFTER INSERT[^;]*DEFERRABLE INITIALLY DEFERRED[^;]*guard_fn09_range_result'));
 }
 assert.match(sql,/CREATE CONSTRAINT TRIGGER fn09_range_body_complete AFTER INSERT[^;]*DEFERRABLE INITIALLY DEFERRED[^;]*guard_fn09_range_result/);
 for(const name of ['normal_request_challenge_guard','normal_request_challenge_complete','normal_page_consumption_guard','normal_page_consumption_complete']){
  const at=sql.indexOf('CREATE '+(name.endsWith('_complete')?'CONSTRAINT ':'')+'TRIGGER '+name+' '),body=sql.slice(at,sql.indexOf(';',at));assert.ok(body.includes("AND NOT (NEW.snapshot_json ? 'understandingRangeResultBinding')"),name);
 }
 const current=definition('fn09_normal_understanding_range_result_current');assert.match(current,/final_check[\s\S]*range_result_complete\(q\)/);
 const complete=definition('fn09_normal_understanding_range_result_complete');assert.match(complete,/phase IS DISTINCT FROM 'SETTLED'/);
 const history=definition('fn09_normal_understanding_range_result_historical');
 const shape=history.match(/execution_json_shape\(s,ARRAY\[([^\]]+)\]/)?.[1];assert.ok(shape);assert.doesNotMatch(shape,/'(?:body|text|parts|auth|bodyBase64|sdk|sessionId)'/);
 assert.match(shape,/'responseRef','partRefs','bodyHash','bodyBytes'/);
 const section=sql.slice(sql.indexOf('-- FN09 A §4.3:'));
 const helpers=[...section.matchAll(/CREATE FUNCTION anvil\.([a-z0-9_]+)\(([^)]*)\)/g)];assert.equal(helpers.length,19);
 for(const [,name,args] of helpers){
  const signature=name+'('+args!.split(',').filter(Boolean).map(x=>x.trim().split(/\s+/).at(-1)).join(',')+')';
  assert.ok(section.includes('ALTER FUNCTION anvil.'+signature+' OWNER TO anvil_v3_migrator;'),signature);
  assert.ok(section.includes('REVOKE ALL ON FUNCTION anvil.'+signature+' FROM PUBLIC,anvil_v3_app;'),signature);
 }
 assert.doesNotMatch(section,/GRANT |CREATE ROLE|nativeVerified|sourceVerified/);
 assert.ok(sql.indexOf("r.part_kind='FN09_RANGE_RESULT'",sql.indexOf('CREATE OR REPLACE FUNCTION anvil.quota_settled_complete'))<sql.indexOf("r.operation='readNormalUnderstandingResponse'",sql.indexOf('CREATE OR REPLACE FUNCTION anvil.quota_settled_complete')));
});

test('range result RPC is closed to exact transient wrapper; replay validates current authority plus immutable packet/body before any new charge',()=>{
 const entry=definition('fn09_normal_understanding_result_store');
 for(const token of ['FIXED_RANGE_RESULT_CUSTODY',"ARRAY['purpose','receipt','bodyBase64']",'2796204',"decode(snapshot->>'bodyBase64','base64')",'fn09_normal_understanding_range_result_store'])assert.ok(entry.includes(token),token);
 assert.ok(entry.indexOf("length(snapshot->>'bodyBase64')")<entry.indexOf("decode(snapshot->>'bodyBase64','base64')"));
 const basis=definition('fn09_normal_understanding_discovery');assert.match(basis,/FIXED_RANGE_RESULT[\s\S]*rangeRequestId[\s\S]*range_result_basis/);
 const body=definition('fn09_normal_understanding_range_result_store');
 assert.ok(body.indexOf('range_result_basis')<body.indexOf('SELECT * INTO previous'));
 assert.ok(body.indexOf('range_result_historical')<body.indexOf('SELECT * INTO previous'));
 assert.ok(body.indexOf('range_result_current')<body.indexOf('SELECT * INTO previous'));
 const replay=body.slice(body.indexOf(' IF FOUND THEN'),body.indexOf(' SELECT * INTO STRICT ac'));
 for(const token of ['to_jsonb(previous) IS DISTINCT FROM to_jsonb(v)','to_jsonb(saved) IS DISTINCT FROM to_jsonb(r)','body.body_bytes IS DISTINCT FROM raw','range_result_complete(q)','REPLAY_CONFLICT'])assert.ok(replay.includes(token),token);
 assert.doesNotMatch(replay,/INSERT INTO|UPDATE |DELETE FROM|set_config/);
 assert.ok(body.indexOf('range_result_historical')<body.indexOf('INSERT INTO anvil.project_storage_reservations'));
 assert.ok(body.indexOf('INSERT INTO anvil.normal_understanding_range_result_bodies')<body.indexOf('INSERT INTO anvil.execution_receipts'));
 assert.doesNotMatch(definition('fn09_normal_understanding_range_result_plan'),/getV1|getV2|humanCommand|parentResult|(?:encode|decode)\(/);
});

test('range result canonical fixture preserves UTF8/body and per-part hashes; changed bytes/ref/order/count are distinct (RAM data only)',async()=>{
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 const id=(n:number)=>'af090403-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
 const part=(n:number,text:string)=>({outputRef:ref(n),sequence:n,payloadDigest:'b'.repeat(64),blockIndex:0,kind:'ASSISTANT_TEXT',text,textHash:contentHash(text)});
 const body={schemaVersion:1,kind:'FIXED_RANGE_SELECTION',attribution:'SESSION_ONLY',projectId:id(1),executionId:id(2),executionGeneration:1,requestRef:ref(3),acquisitionRef:ref(4),sourceRequestRef:ref(5),sourceResultRef:ref(6),contextBundleRef:ref(7),initConfirmationRef:ref(8),tailRef:ref(10),firstSequence:9,lastSequence:10,beforeRef:ref(8),afterRef:null,parts:[part(9,'한글 🙂'),part(10,'다음 원문')],wholeConversationComplete:false,executionAuthorized:false};
 const raw=Buffer.from(canonicalJson(body)),hash=contentHash(raw),refs=body.parts.map((p,i)=>({...ref(i+11),contentHash:contentHash(canonicalJson(p))}));
 assert.equal(raw.toString('utf8'),canonicalJson(JSON.parse(raw.toString())));assert.notEqual(raw.length,raw.toString().length);
 assert.equal(contentHash(Buffer.from(raw.toString('base64'),'base64')),hash);
 for(const changed of [{...body,requestRef:ref(99)},{...body,sourceResultRef:ref(99)},{...body,parts:[...body.parts].reverse()},{...body,parts:body.parts.slice(0,1)},{...body,parts:[{...body.parts[0],text:'변조'},body.parts[1]]}])assert.notEqual(contentHash(canonicalJson(changed)),hash);
 assert.notEqual(contentHash(Buffer.concat([raw,Buffer.from(' ')])),hash);assert.notEqual(contentHash(Buffer.from(raw).fill(0,0,1)),hash);
 assert.notEqual(refs[0]!.contentHash,refs[1]!.contentHash);
 const receipt={kind:'NORMAL_UNDERSTANDING_RANGE_RESULT',rangeRequestRef:body.requestRef,acquisitionRef:body.acquisitionRef,responseRef:{...ref(20),contentHash:hash},partRefs:refs,bodyHash:hash,bodyBytes:raw.length};
 const management=canonicalJson({v2:{consumption:{resultRef:ref(30)}},receipt,privateRow:{...receipt}});
 assert.equal(management.includes('다음 원문'),false);assert.equal(management.includes('한글'),false);
 const charge=Buffer.byteLength(management)+raw.length;assert.equal(charge-Buffer.byteLength(management),raw.length);
 // 이 fixture는 SQL/원 proof/COMMIT 실행 증거가 아니다.
});

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
  assert.equal(current.replace(" AND NOT (NEW.snapshot_json ? 'understandingResultBinding')",'').replace(" AND NOT (NEW.snapshot_json ? 'understandingRangeRequestRef')",'').replace(" AND NOT (NEW.snapshot_json ? 'understandingRangeResultBinding')",''),trigger(prior,name));
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
 const newPurpose=sql.slice(sql.indexOf('-- HUMAN 고정 범위 의사만'),sql.indexOf('-- FN09 A §4.3:'));
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
 for(const [name,digest] of Object.entries(original))assert.equal(createHash('sha256').update(definition(name).replace(/\r\n/g,'\n').replace(/ -- FN09_RANGE_CURRENT_DISPATCH_BEGIN\n[\s\S]*? -- FN09_RANGE_CURRENT_DISPATCH_END\n/,'').replace(/ -- FN09_RANGE_RESULT_DISPATCH_BEGIN\n[\s\S]*? -- FN09_RANGE_RESULT_DISPATCH_END\n/,'').replace(" IF expected->>'purpose'='FIXED_RANGE' THEN RETURN anvil.fn09_normal_understanding_range_connector_current(token,b,signed_request_id,expected);END IF;\n",'')).digest('hex'),digest,name);
});

test('range connector current preserves auth SHARE then project lock, exact settled parent and HUMAN policy without auth lock upgrade',()=>{
 const body=definition('fn09_normal_understanding_range_connector_current');
 for(const token of ['normal_request_credential','normal_exchange_current','FOR SHARE OF hs0,u,cl','FOR SHARE OF m,pc0','fn09_normal_understanding_range_complete','NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST','LIMIT 2','understandingRangeRequestRef',"'NONE'","'RANGE_REQUEST'",'reauth_until','EXPIRES'])assert.ok(body.toUpperCase().includes(token.toUpperCase()),token);
 assert.doesNotMatch(body,/fn01_active|fn09_normal_understanding_range_basis|fn09_normal_understanding_metadata_current|FOR UPDATE OF (?:hs|u|cl)|INSERT INTO|UPDATE anvil|DELETE FROM/);
 const discovery=definition('fn09_normal_understanding_discovery');assert.match(discovery,/expected->>'purpose'='FIXED_RANGE'/);
 assert.match(sql,/CREATE UNIQUE INDEX normal_understanding_range_challenge_once/);
});

test('고정 범위 HUMAN current는 원 명령/동일 HUMAN 세션과 현재 등록·정산·private 원문을 사전 사후 조회로만 검산한다',()=>{
 const current=definition('fn09_normal_understanding_range_current');
 for(const token of ["selection-'controlGeneration'",'expected_tx IS DISTINCT FROM txid_current()::text','request_basis(s,a,c,command,policy,expected_tx)',
  "cmd.actor_id IS DISTINCT FROM a","cmd.client_id IS DISTINCT FROM c","requestedBy,sessionId","hs.credential_generation",'selection->\'requestRef\' IS DISTINCT FROM rf',
  "selection->'assignmentRef'","selection->'preparationRef'","selection->'executionGeneration'",'range_complete(cmd)',"basis->'context' IS DISTINCT FROM parent.snapshot_json->'context'",
  'LIMIT 2',"'PENDING_SOURCE'","'CURRENT_UNAVAILABLE'",'NORMAL_UNDERSTANDING_RANGE_INTEGRITY_FAILED','range_result_challenge_history(old)',
  'range_result_historical(v,r,body.body_bytes)','range_result_complete(q)','INTO STRICT body','normal_understanding_range_result_bodies',"ends<=at",'last_basis'])assert.ok(current.includes(token),token);
 assert.equal((current.match(/request_basis\(s,a,c,command,policy,expected_tx\)/g)??[]).length,2);
 assert.ok(current.indexOf('request_basis(')<current.indexOf('SELECT count(*)'));
 assert.ok(current.indexOf('range_result_historical')<current.indexOf('answer=anvil.fn09_normal_understanding_range_response'));
 const absent=current.slice(current.indexOf('IF n=0 THEN'),current.indexOf("END IF;IF n<>1"));
 for(const token of ["result_ref#>>'{data,ref,id}'=rid::text","result_ref#>>'{data,requestRef,id}'=rid::text","result_ref->>'targetId'=rid::text",
  'project_storage_reservations',"plan_json#>>'{rangeRequestRef,id}'=rid::text",'execution_challenges','execution_receipts','normal_understanding_range_result_bodies'])assert.ok(absent.includes(token),token);
 assert.equal((absent.match(/WHERE project_id=p/g)??[]).length,4);assert.match(absent,/candidate.project_id=p/);assert.match(absent,/cq.project_id=p/);assert.doesNotMatch(absent,/actor_id=|user_id=/);
 for(const token of ["candidate.result_ref#>>'{data,status}'='NORMAL_UNDERSTANDING_RANGE_REQUESTED'","{data,snapshot,request,payload}' ? 'selection'","{data,snapshot,sourceScope}' ? 'ranges'",'cq.server_command_id=candidate.id',"part_kind='FN09_FIXED_RANGE_REQUEST'","FN09_FIXED_RANGE_REQUEST_STORAGE","FN09_RANGE_TRANSPORT_STORAGE","FN09_RANGE_RESULT_STORAGE"])assert.ok(absent.includes(token),token);
 assert.ok(absent.indexOf('NORMAL_UNDERSTANDING_RANGE_INTEGRITY_FAILED')<absent.indexOf('NORMAL_UNDERSTANDING_RANGE_NOT_FOUND'));
 assert.doesNotMatch(current,/INSERT INTO|UPDATE anvil|DELETE FROM|set_config|normal_page_verified|normal_request_verified|range_result_store\(/);
 const dispatcher=definition('fn09_normal_understanding_metadata_current');assert.match(dispatcher,/selection->>'purpose'='FIXED_RANGE_CURRENT'.*range_current\(s,a,c,selection-'purpose',policy,expected_tx\)/);
 for(const name of ['range_current','range_response']){assert.match(sql,new RegExp('REVOKE ALL ON FUNCTION anvil.fn09_normal_understanding_'+name+'\\([^;]+FROM PUBLIC,anvil_v3_app'));assert.doesNotMatch(sql,new RegExp('GRANT[^;]+(?:range_current|range_response)'));}
});

test('최종 HUMAN envelope의 정확 2MiB는 store/replay 입장과 deferred current에서 검산하고 역사 정산에는 이월하지 않는다',()=>{
 const store=definition('fn09_normal_understanding_range_result_store'),current=definition('fn09_normal_understanding_range_result_current'),human=definition('fn09_normal_understanding_range_current');
 for(const body of [store,current,human]){assert.match(body,/2097152/);assert.match(body,/execution_authority_canonical/);assert.match(body,/range_response/);}
 assert.ok(store.indexOf('NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE')<store.indexOf('SELECT * INTO previous'));
 assert.ok(store.indexOf('NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE')<store.indexOf('INSERT INTO anvil.project_storage_reservations'));
 for(const name of ['range_result_historical','range_result_complete','range_result_plan','range_complete'])assert.doesNotMatch(definition('fn09_normal_understanding_'+name),/range_response|RESPONSE_TOO_LARGE/);
 const response=definition('fn09_normal_understanding_range_response');
 for(const key of ['status','request','resultRef','responseRef','partRefs','currentness','observedAt','expiresAt','selectionAvailable','body'])assert.ok(response.includes("'"+key+"'"),key);
 assert.doesNotMatch(response,/token|credentialRef|binding|auth|sdk|sessionId/);
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

test('최초 normal 검토 basis는 원 response의 현재 HUMAN custody와 원 준비/책임/맥락/모든 전달 부분에만 결박된다',()=>{
 const source=definition('fn09_normal_understanding_review_source_basis'),context=definition('fn09_normal_understanding_review_context_basis');
 assert.match(source,/range_current\(s,a,c,selection,policy,expected_tx\)/);assert.equal((source.match(/range_current\(s,a,c,selection,policy,expected_tx\)/g)??[]).length,2);
 for(const token of ['response_ref',"'RANGE_STORED'",'review_context_basis',"'SOURCE_BASIS_ONLY'","'subjectBindingState','VERIFIED'","'reviewAvailable',false","'responsePartRefs'","'executionAuthorized',false"])assert.ok(source.includes(token),token);
 for(const token of ['normal_start_material_complete','execution_preparations','role_bindings','agent_sessions','project_roles','context_bundles','context_items','assignment_draft_versions','execution_material_manifests','execution_materials',"'CONTEXT_BUNDLE'",'material_binding_complete',"'NORMAL_START_MATERIAL'",'LIMIT 2',"'requiredPartRefs'","'receivedPartRefs'","'basisRefs'","'latestInstructionRefs'"])assert.ok(context.includes(token),token);
 assert.doesNotMatch(source+context,/INSERT INTO|UPDATE anvil|DELETE FROM|set_config|reviewUnderstanding|SYNTHETIC_ONLY/);
 assert.ok(source.includes("'subjectBindingRef',ground->'roleBindingRef'"));assert.doesNotMatch(source,/'subjectBindingRef',ground->'(?:agentSessionRef|roleRef)'/);
 for(const [name,args]of [['fn09_normal_understanding_review_context_basis','uuid,jsonb,jsonb'],['fn09_normal_understanding_review_source_basis','uuid,uuid,uuid,jsonb,jsonb,text,jsonb']]){
  assert.ok(sql.includes('REVOKE ALL ON FUNCTION anvil.'+name+'('+args+') FROM PUBLIC,anvil_v3_app;'));assert.doesNotMatch(sql,new RegExp('GRANT[^;]*'+name));
 }
});

test('최초 basis의 원 준비/role/session/context와 수신 검사는 다른 회차·첫 영수증·부분 수신으로 치환되지 않는다',async()=>{
 const body=definition('fn09_normal_understanding_review_context_basis'),source=definition('fn09_normal_understanding_review_source_basis');
 for(const token of ["f#>'{agentSession,bindingGeneration}' IS DISTINCT FROM to_jsonb(rb.version)","f#>'{agentSession,sessionRef}' IS DISTINCT FROM ctx->'sessionBindingRef'",
  "ep.snapshot_json#>'{intent,roleBindingRef}'",'rb.snapshot_json->\'assignmentRef\'',"rb.snapshot_json->'connectionRef'",'newer.version>rb.version',
  "ep.snapshot_json->'basisRefs' IS DISTINCT FROM basis","f->'latestInstructionRefs' IS DISTINCT FROM latest",'context_preparation_manifest_valid(p,bm)',"bm->'missingRequired'",'assignment_draft_basis_current',
  "ctx->'startCommandRef' IS DISTINCT FROM cf","ctx->>'startCommandId' IS DISTINCT FROM d.command_id::text",'FOR part IN SELECT value FROM jsonb_array_elements(grp->\'parts\')',
  "snapshot_json#>>'{materialRef,id}'=m.id::text LIMIT 2",'IF n<>1 THEN',"r.content_hash IS DISTINCT FROM anvil.execution_json_hash(rr)",'material_binding_complete(p,r.id)',
  "rr->'manifestRef' IS DISTINCT FROM mf","rr->'materialRef' IS DISTINCT FROM rf","rr->'target' IS DISTINCT FROM target",'used.snapshot_json IS DISTINCT FROM old.snapshot_json||',"required IS DISTINCT FROM received"])
  assert.ok(body.includes(token),token);
 const append=body.indexOf('received=received||');assert.ok(body.indexOf('material_binding_complete(p,r.id)')<append);assert.ok(body.indexOf('FOR part IN')<body.indexOf('required=required||'));
 assert.doesNotMatch(body,/rr->>'expiresAt'\)::timestamptz<=clock_timestamp|normal_start_material_valid\(/);
 for(const token of ['old.grant_id IS DISTINCT FROM g.id','used.grant_version IS DISTINCT FROM g.version',"old.snapshot_json->'sequence' IS DISTINCT FROM to_jsonb(old.server_sequence)","publicChallenge,issuedAt","publicChallenge,expiresAt"])assert.ok(body.includes(token),token);
 const returned=source.slice(source.indexOf('answer=ground||'));
 assert.doesNotMatch(returned,/'body'|'text'|'snapshot'|'manifest'|'criteria'|'ACCEPTED'/);
 assert.match(source,/ground IS DISTINCT FROM last_ground/);assert.match(source,/ends<=at/);assert.match(source,/2097152/);
 const latest=await readFile(new URL('../../../db/migrations/0097_normal_instruction_dispatch.sql.pending',import.meta.url),'utf8');
 assert.match(latest,/CREATE OR REPLACE FUNCTION anvil.material_binding_complete/);assert.match(latest,/proofResultRef.*materialRef/s);
});

test('검토 주체는 원 등록 책임 결박의 닫힌 형태·세대·예약 상태·작성자와 APPLIED 영수증을 모두 확인한 roleBindingRef만 사용한다',async()=>{
 const body=definition('fn09_normal_understanding_review_context_basis'),source=definition('fn09_normal_understanding_review_source_basis');
 const canonical=await readFile(new URL('../../../apps/server/modules/assignments/responsible-sessions.ts',import.meta.url),'utf8');
 for(const key of ['assignmentRef','roleRef','connectionRef','existingSessionBindingRef','reason','sessionRef','generation','state','externalSessionHandleRef','connectionReadiness','executionAuthorized','dispatchPerformed','boundBy','boundAt','connectionKind'])assert.ok(canonical.includes("'"+key+"'"),key);
 for(const token of [
  'anvil.fn09_binding_variant(rb.snapshot_json)',
  "anvil.execution_json_shape(ag.snapshot_json,ARRAY['roleRef','connectionRef','state','externalSessionHandleRef','reservedBy','reservedAt','connectionKind'])",
  "rb.snapshot_json->'generation' IS DISTINCT FROM to_jsonb(rb.version)",
  "f#>'{agentSession,bindingGeneration}' IS DISTINCT FROM to_jsonb(rb.version)",
  "rb.snapshot_json->'connectionReadiness' IS DISTINCT FROM '\"REGISTERED_DEFINITION_ONLY\"'::jsonb",
  "ag.snapshot_json->'connectionRef' IS DISTINCT FROM rb.snapshot_json->'connectionRef'",
  "ag.snapshot_json->>'connectionKind' IS DISTINCT FROM 'REGISTERED_DEFINITION'",
  "ag.snapshot_json->>'state' IS DISTINCT FROM 'RESERVED'",
  "ag.snapshot_json->'externalSessionHandleRef' IS DISTINCT FROM 'null'::jsonb",
  "rb.snapshot_json->'boundBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',rb.created_by)",
  "ag.snapshot_json->'reservedBy' IS DISTINCT FROM jsonb_build_object('kind','HUMAN','userId',ag.created_by)",
  "anvil.execution_iso_valid(rb.snapshot_json->'boundAt')", "anvil.execution_iso_valid(ag.snapshot_json->'reservedAt')",
  'newer.version>rb.version',"rb.snapshot_json->'sessionRef' IS DISTINCT FROM f#>'{agentSession,sessionRef}'",
  'bc.actor_id IS DISTINCT FROM rb.created_by','bc.client_id IS DISTINCT FROM rb.client_id',
  "bc.operation IS DISTINCT FROM 'bindResponsibleSession'","bc.state IS DISTINCT FROM 'APPLIED'",
  "bc.result_ref#>'{data,snapshot}' IS DISTINCT FROM rb.snapshot_json",
  "sc.result_ref#>'{data,snapshot,sessionRef}' IS DISTINCT FROM f#>'{agentSession,sessionRef}'",
  "sc.actor_id IS DISTINCT FROM ag.created_by",'sc.client_id IS DISTINCT FROM ag.client_id',
  "origin.command_id=sc.id AND origin.version=1",
 ])assert.ok(body.includes(token),token);
 assert.ok(body.indexOf('fn09_binding_variant')<body.indexOf("RETURN jsonb_build_object('bundleRef'"));
 assert.ok(source.includes("'subjectBindingRef',ground->'roleBindingRef'"));
 assert.ok(source.indexOf('ground IS DISTINCT FROM last_ground')<source.indexOf("'subjectBindingRef'"));
 assert.doesNotMatch(source,/'subjectBindingRef',(?:response_ref|selection|ground->'(?:agentSessionRef|roleRef)')/);
 assert.match(source,/'SOURCE_BASIS_ONLY'/);assert.match(source,/'reviewAvailable',false/);
 // 실제 PG 실행이 아닌 소스 음성 회귀: 각 오염 조건이 반환 전에 명시 거절 분기에 있어야 한다.
 const rejection=body.slice(body.indexOf("IF ctx->'preparationRef'"),body.indexOf('SELECT * INTO STRICT cb'));
 const gates={staleBinding:'EXISTS(SELECT 1 FROM anvil.role_bindings newer WHERE newer.project_id=p AND newer.role_id=rb.role_id AND newer.version>rb.version)',
  wrongSession:"rb.snapshot_json->'sessionRef' IS DISTINCT FROM f#>'{agentSession,sessionRef}'",
  wrongStoredGeneration:"rb.snapshot_json->'generation' IS DISTINCT FROM to_jsonb(rb.version)",
  wrongStartGeneration:"f#>'{agentSession,bindingGeneration}' IS DISTINCT FROM to_jsonb(rb.version)",
  wrongOriginalContext:"ep.snapshot_json#>'{intent,contextBundleRef}' IS DISTINCT FROM ctx->'contextBundleRef'"};
 const requires=(text:string,gate:string)=>{assert.ok(text.includes(gate));assert.ok(text.indexOf(gate)<text.indexOf("THEN RAISE EXCEPTION 'NORMAL_UNDERSTANDING_REVIEW_BASIS_INVALID'",text.indexOf(gate)));};
 for(const [name,gate]of Object.entries(gates)){requires(rejection,gate);assert.throws(()=>requires(rejection.replace(gate,'false'),gate),name);}
});

test('원 책임 결박의 역사 요청·승인 소비는 당시 exact 원장으로 재구성하고 현재 만료나 GUC로 재승인하지 않는다',()=>{
 const history=definition('fn09_normal_understanding_review_binding_history'),context=definition('fn09_normal_understanding_review_context_basis');
 for(const token of ['fn09_responsible_payload','fn09_responsible_target','prior.version=hb.version-1',"target IS DISTINCT FROM jsonb_build_object('id',previous.binding_id",'h.expected_version IS DISTINCT FROM expected_version',
  'h.request_hash IS DISTINCT FROM anvil.execution_json_hash(request)','h.approval_consumption_id IS NULL',"h.payload_ref IS NOT NULL",'approval_consumptions',
  'u.command_id IS DISTINCT FROM h.id','u.decision_id IS DISTINCT FROM d.id','u.scope_digest IS DISTINCT FROM q.scope_digest',
  'q.candidate_command_id IS DISTINCT FROM h.command_id','q.created_by IS DISTINCT FROM h.actor_id','q.client_id IS DISTINCT FROM h.client_id',
  'd.client_id IS DISTINCT FROM h.client_id','d.decided_by IS DISTINCT FROM h.actor_id','d.control_generation IS DISTINCT FROM h.control_generation',
  'q.scope_digest IS DISTINCT FROM anvil.execution_json_hash(q.action_scope_json)',"q.action_scope_json->'targetRef' IS DISTINCT FROM target",'q.content_hash IS DISTINCT FROM anvil.execution_json_hash(request_snapshot)',
  'rc.request_hash IS DISTINCT FROM anvil.execution_json_hash(request_command)','dc.request_hash IS DISTINCT FROM anvil.execution_json_hash(decision_command)',
  'd.content_hash IS DISTINCT FROM anvil.execution_json_hash(decision_snapshot)','u.consumed_at<d.decided_at','u.consumed_at>=q.expires_at',
  'ar.approval_decision_ref IS NOT DISTINCT FROM decision_id','audit.approval_ref IS NOT DISTINCT FROM audit_approval',
 ])assert.ok(history.includes(token),token);
 assert.ok(context.includes('review_binding_history(p,bc.id)'));assert.ok(context.includes('review_binding_history(p,sc.id)'));
 assert.doesNotMatch(history,/clock_timestamp|current_setting|fn09_responsible_approval_execution_valid|fn01_active|normal_exchange_current|INSERT INTO|UPDATE anvil|DELETE FROM/);
 assert.match(sql,/REVOKE ALL ON FUNCTION anvil.fn09_normal_understanding_review_binding_history\(uuid,uuid\) FROM PUBLIC,anvil_v3_app/);
 assert.doesNotMatch(sql,/GRANT[^;]*review_binding_history/);
 // shared hash/scope만 함께 변조해도 snapshot에서 재구성한 원 요청 비교를 삭제할 수 없다.
 for(const gate of ['h.request_hash IS DISTINCT FROM anvil.execution_json_hash(request)','q.scope_digest IS DISTINCT FROM anvil.execution_json_hash(q.action_scope_json)',
  'u.decision_id IS DISTINCT FROM d.id','d.client_id IS DISTINCT FROM h.client_id']){
  const check=(s:string)=>assert.ok(s.includes(gate));check(history);assert.throws(()=>check(history.replace(gate,'false')));
 }
});

test('원 bind 요청 재구성 RAM 관계는 공동 request/scope 변조·다른 결정/client를 거절하고 당시 정상 만료 승인은 보존한다 · SQL 실행 아님',async()=>{
 const {readResponsibleSessionBinding}=await import('../../../apps/server/modules/assignments/responsible-sessions.ts');
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 const id=(n:number)=>'af090509-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
 const payload=readResponsibleSessionBinding({connectionKind:'REGISTERED_DEFINITION',assignmentRef:ref(1),roleRef:ref(2),connectionRef:ref(3),existingSessionBindingRef:null,reason:'원 책임 예약'});
 const snapshot={...payload,sessionRef:ref(4),generation:1,state:'RESERVED',externalSessionHandleRef:null,connectionReadiness:'REGISTERED_DEFINITION_ONLY',executionAuthorized:false,dispatchPerformed:false,boundBy:{kind:'HUMAN',userId:id(5)},boundAt:'2020-01-01T00:00:02.000Z'};
 const actionScope={operation:'bindResponsibleSession',targetRef:null,expectedVersion:0,payloadHash:hash(payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:id(5),clientId:id(6)},controlGeneration:2};
 const approval={requestId:id(7),decisionId:id(8),scopeDigest:hash(actionScope)};
 const command={schemaVersion:1,projectId:id(9),commandId:id(10),clientId:id(6),controlGeneration:2,operation:'bindResponsibleSession',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:approval,payload};
 const base={command,requestHash:hash(command),authorizationScope:'',auditScope:'',approval,actionScope,decision:{id:id(8),clientId:id(6),decidedAt:'2020-01-01T00:00:01.000Z'},used:{decisionId:id(8),consumedAt:'2020-01-01T00:00:02.000Z'},expiresAt:'2020-01-01T00:00:03.000Z'};
 const scope=(requestHash:string)=>hash({projectId:command.projectId,actorId:id(5),clientId:command.clientId,controlGeneration:2,requestHash,policyRef:ref(11),targetRef:ref(12)});base.authorizationScope=base.auditScope=scope(base.requestHash);
 const verify=(v:typeof base)=>{
  const {sessionRef:_,generation:__,state:___,externalSessionHandleRef:____,connectionReadiness:_____,executionAuthorized:______,dispatchPerformed:_______,boundBy:________,boundAt:_________,...input}=snapshot;
  const original={...v.command,payload:readResponsibleSessionBinding(input),targetId:input.existingSessionBindingRef?.id??null,expectedVersion:input.existingSessionBindingRef?.version??0,approvalRef:v.approval};
  assert.equal(v.requestHash,hash(original));assert.equal(v.authorizationScope,scope(v.requestHash));assert.equal(v.auditScope,v.authorizationScope);
  assert.equal(v.approval.scopeDigest,hash(v.actionScope));assert.equal(v.actionScope.payloadHash,hash(original.payload));assert.equal(v.decision.id,v.approval.decisionId);assert.equal(v.used.decisionId,v.decision.id);assert.equal(v.decision.clientId,original.clientId);
  assert.ok(Date.parse(v.decision.decidedAt)<=Date.parse(v.used.consumedAt)&&Date.parse(v.used.consumedAt)<Date.parse(v.expiresAt));
 };
 verify(base);assert.ok(Date.parse(base.expiresAt)<Date.now(),'기한이 지난 정상 과거 소비도 당시 구간으로만 검산한다');
 for(const mode of ['shared-hash-scope','shared-payload-scope','wrong-decision','wrong-client']){
  const v=structuredClone(base);
  if(mode==='shared-hash-scope'){v.requestHash='f'.repeat(64);v.authorizationScope=v.auditScope=scope(v.requestHash);}
  if(mode==='shared-payload-scope'){v.actionScope.payloadHash='f'.repeat(64);v.approval.scopeDigest=hash(v.actionScope);v.command.approvalRef=v.approval;v.requestHash=hash(v.command);v.authorizationScope=v.auditScope=scope(v.requestHash);}
  if(mode==='wrong-decision')v.used.decisionId=id(99);if(mode==='wrong-client')v.decision.clientId=id(99);
  assert.throws(()=>verify(v),mode);
 }
});

test('원 CONTEXT_BUNDLE 자료 refs와 각 전달 영수증의 조합은 모두 필요하다 · 실제 descriptor/RAM 관계 검산, SQL 실행 아님',async()=>{
 const {startMaterialDescriptor}=await import('../../../apps/server/modules/executions/normal-start-materials.ts');
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 const id=(n:number)=>'af090503-0000-4000-8000-'+String(n).padStart(12,'0'),digest=(v:unknown)=>contentHash(canonicalJson(v)),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
 const b={projectId:id(1),connectorId:id(2),executionId:id(3),executionGeneration:1,grantRef:ref(4),credentialGeneration:1},payload={contextBundleRef:ref(5),optionsRef:ref(6)},envelope={commandId:id(7),envelopeHash:'b'.repeat(64),payload};
 const groups=['CONTEXT_BUNDLE','START_OPTIONS'].map((kind,i)=>{const payloadRef=i?payload.optionsRef:payload.contextBundleRef;return {kind,payloadRef,source:{sourceRef:payloadRef,bodyRef:payloadRef,originRef:payloadRef,contentHash:'c'.repeat(64),sourceBytes:8,mediaType:'application/json'},parts:[{materialId:id(20+i),partIndex:1,byteOffset:0,utf8Bytes:8,contentHash:'c'.repeat(64)}]};});
 const manifest={schemaVersion:1,purpose:'START_CONTEXT_OPTIONS_MATERIAL_V1',id:id(8),sourceKind:'PROTECTED_START_REFERENCE_V1',scope:{mode:'EXECUTION',...b},commandId:envelope.commandId,payload,groups,expiresAt:new Date(Date.now()+20000).toISOString()};
 const materials=groups.map((g,i)=>{const snapshot={projectId:b.projectId,executionId:b.executionId,executionGeneration:1,commandId:envelope.commandId,envelopeHash:envelope.envelopeHash,payloadRef:g.payloadRef,sourceRef:g.source.sourceRef,partIndex:1,partCount:1,byteOffset:0,sourceBytes:8,utf8Bytes:8,contentHash:'c'.repeat(64),mediaType:'application/json'};return {ref:{...ref(20+i),contentHash:digest(snapshot)},snapshot};});
 const row={command_record_id:id(9),manifest_ref:{...ref(8),contentHash:digest(manifest)},manifest,materials};
 const descriptor=startMaterialDescriptor(row,b,envelope),required=descriptor.groups[0]!.parts.map(p=>materials.find(m=>m.ref.id===p.materialId)!.ref);
 const receipt=(i:number)=>{const snapshot={kind:'NORMAL_START_MATERIAL',binding:b,manifestRef:row.manifest_ref,materialRef:materials[i]!.ref,partContentHash:groups[i]!.parts[0]!.contentHash};return {ref:{...ref(30+i),contentHash:digest(snapshot)},snapshot};};
 const original=[receipt(0),receipt(1)];let reads:string[]=[];
 const delivered=(receipts:typeof original,bindings:typeof original)=>required.map(m=>{
  const found=receipts.filter(r=>r.snapshot.kind==='NORMAL_START_MATERIAL'&&r.snapshot.materialRef.id===m.id);assert.equal(found.length,1);
  const r=found[0]!;assert.equal(r.ref.contentHash,digest(r.snapshot));assert.ok(same(r.snapshot.binding,b)&&same(r.snapshot.materialRef,m)&&same(r.snapshot.manifestRef,row.manifest_ref));
  reads.push(r.ref.id);assert.ok(bindings.some(bound=>same(bound,r)),'각 receipt의 실제 결박을 별도 확인하는 RAM 관계');return m;
 });
 assert.deepEqual(delivered(original,original),required);assert.deepEqual(reads,[original[0]!.ref.id]);assert.notEqual(required[0]!.contentHash,groups[0]!.parts[0]!.contentHash,'metadata ref hash와 payload hash를 혼용하지 않는다');
 for(const mode of ['missing','options-only','duplicate','binding-missing','wrong-scope','wrong-fullref','wrong-hash','wrong-manifest']){
  reads=[];let receipts=structuredClone(original),bindings=structuredClone(original);
  if(mode==='missing')receipts=[];if(mode==='options-only')receipts=receipts.slice(1);if(mode==='duplicate')receipts.push(structuredClone(receipts[0]!));if(mode==='binding-missing')bindings=bindings.slice(1);
  if(mode==='wrong-scope')receipts[0]!.snapshot.binding.executionGeneration=2;
  if(mode==='wrong-fullref')receipts[0]!.snapshot.materialRef.contentHash='0'.repeat(64);
  if(mode==='wrong-hash')receipts[0]!.ref.contentHash='0'.repeat(64);
  if(mode==='wrong-manifest')receipts[0]!.snapshot.manifestRef=ref(99);
  assert.throws(()=>delivered(receipts,bindings),mode);
 }
 for(const changed of [{...row,materials:materials.slice(1)},{...row,manifest:{...manifest,scope:{...manifest.scope,executionGeneration:2}}}])assert.throws(()=>startMaterialDescriptor(changed,b,envelope));
});
