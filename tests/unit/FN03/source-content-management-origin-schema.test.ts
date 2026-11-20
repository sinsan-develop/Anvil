import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const file=new URL('../../../db/migrations/0101_source_content_policy_management_origins.sql.pending',import.meta.url);
const text=existsSync(file)?readFileSync(file,'utf8'):'';
const sql=text.replace(/--[^\r\n]*/g,'');
const compact=sql.replace(/\s+/g,' ').trim();
test('write replay는 ids SQL NULL만 받고 현재 write→역사 완결→현재 write 후 반환, 신규 예약/행/ID 발급0',()=>{
 const commit=body('fn03_source_content_management_commit'),start=commit.indexOf('IF ids IS NULL THEN'),end=commit.indexOf("IF anvil.source_read_exact(ids",start);
 assert.ok(start>commit.indexOf("fn03_management_context(s,a,c,p,g,'defineSourceContentPolicy'"));assert.ok(end>start);
 const replay=commit.slice(start,end);
 for(const token of ['INTO STRICT cmd',"x.scope_kind='PROJECT'",'x.project_id=p','x.actor_id=a',"cmd.request_hash IS DISTINCT FROM qh",'cmd.client_id IS DISTINCT FROM c','cmd.control_generation IS DISTINCT FROM g','fn03_management_history_bundle(p,cmd.id)',"request_json' IS DISTINCT FROM q","fn03_management_context(s,a,c,p,g,'defineSourceContentPolicy'","'REPLAYED'"])assert.ok(replay.includes(token),token);
 assert.doesNotMatch(replay,/INSERT INTO|UPDATE |DELETE |random|quota_complete|fn03_source_content_management_read|readSourceContentPolicyManagementOrigin/);
 assert.ok(end<commit.indexOf('FROM anvil.project_storage_accounts'));
});
test('목적 설치는 단일 거래이며 임시 ADMIN/CREATE를 회수하고 앱에는 두 RPC만 연다',()=>{
 assert.match(compact,/^BEGIN;/);assert.match(compact,/COMMIT;$/);
 assert.match(compact,/GRANT anvil_v3_source_content_management_owner TO anvil_v3_migrator WITH ADMIN OPTION/);
 assert.match(compact,/REVOKE anvil_v3_source_content_management_owner FROM anvil_v3_migrator/);
 assert.match(compact,/REVOKE CREATE ON SCHEMA anvil FROM anvil_v3_source_content_management_owner/);
 const appGrants=[...sql.matchAll(/GRANT ([^;]+) TO anvil_v3_app;/g)].map(m=>m[1]);
 assert.deepEqual(appGrants,[
  'EXECUTE ON FUNCTION anvil.fn03_source_content_management_commit(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz)',
  'EXECUTE ON FUNCTION anvil.fn03_source_content_management_read(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,text)',
 ]);
 assert.match(sql,/pg_catalog\.pg_auth_members/);assert.match(sql,/relowner=purpose_oid/);
});
test('E/O INSERT는 원 IO_STARTED 봉인·XID·현재 context 및 실제 C/A/U만 받는다',()=>{
 const gate=body('fn03_management_insert_guard');
 for(const token of ["current_user<>'anvil_v3_source_content_management_owner'","session_user<>'anvil_v3_app'","r.phase IS DISTINCT FROM 'IO_STARTED'","r.start_fence IS DISTINCT FROM 1","r.plan_json->>'transactionId' IS DISTINCT FROM txid_current()::text",'fn03_management_context','r.plan_hash IS DISTINCT FROM anvil.source_read_hash(r.plan_json)','count(*)','authorization_receipts','audit_events','r.created_at','r.started_at','RETURN NEW'])assert.ok(gate.includes(token),token);
 assert.doesNotMatch(gate,/SECURITY DEFINER|current_setting|set_config|WHEN OTHERS|fn03_management_complete/);
 assert.match(compact,/DROP TRIGGER source_content_unavailable ON anvil\.source_content_policy_events;/);
 assert.match(compact,/DROP TRIGGER source_content_management_unavailable ON anvil\.source_content_policy_management_origins;/);
});
test('quota owner는 목적 SD complete EXEC만 받고 E/O 직접 권한은 받지 않는다',()=>{
 assert.match(dispatcher(sql,'fn03_management_complete'),/STABLE SECURITY DEFINER SET search_path=pg_catalog/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION anvil\.fn03_management_complete\(uuid,uuid\) TO %I/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION anvil\.fn03_management_plan_valid\(jsonb\) TO %I/);
 assert.doesNotMatch(sql,/GRANT SELECT[^;]+TO %I/);
 assert.match(sql,/SOURCE_CONTENT_MANAGEMENT_DISPATCHER_OWNER_INVALID/);
 assert.match(sql,/SOURCE_CONTENT_MANAGEMENT_CALLEE_INVALID/);
});
test('기존 E INVOKER 제약만 별도 목적-role flush하고 그 뒤 E 재쓰기는 없다',()=>{
 const write=body('fn03_source_content_management_commit');
 assert.match(write,/SET CONSTRAINTS anvil\.source_content_policy_final IMMEDIATE;\s+SET CONSTRAINTS anvil\.source_content_policy_final DEFERRED;/);
 assert.doesNotMatch(write.slice(write.indexOf('SET CONSTRAINTS anvil.source_content_policy_final IMMEDIATE')),/INSERT INTO|UPDATE anvil|DELETE FROM/);
 assert.match(sql,/SOURCE_CONTENT_MANAGEMENT_EVENT_TRIGGER_INVALID/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION anvil\.check_source_content_policy_final/);
});
test('목적 열 ACL은 원 WI의 13표·6 UPDATE 집합이며 account 원문/봉인 R 갱신은 없다',()=>{
 const grants=[...sql.matchAll(/GRANT (SELECT|INSERT|UPDATE)\(([^)]+)\) ON anvil\.(\w+) TO anvil_v3_source_content_management_owner;/g)];
 assert.equal(grants.length,25);
 const selected=new Map(grants.filter(x=>x[1]==='SELECT').map(x=>[x[3],x[2]]));
 assert.deepEqual([...selected.keys()],['auth_sessions','projects','project_members','project_control','permission_policies','permission_policy_versions','project_storage_accounts','project_storage_reservations','commands','authorization_receipts','audit_events','source_content_policy_events','source_content_policy_management_origins']);
 assert.equal(selected.get('auth_sessions'),'id,user_id,client_id,credential_generation,idle_expires_at,absolute_expires_at,reauth_until,revoked_at');
 assert.equal(selected.get('project_storage_accounts'),'project_id,coverage_state,generation,used_bytes,held_bytes');
 assert.deepEqual(grants.filter(x=>x[1]==='UPDATE').map(x=>[x[3],x[2]]),[
  ['projects','id'],['project_members','participation'],['project_control','generation'],['permission_policies','head_version'],
  ['project_storage_accounts','used_bytes,held_bytes,updated_at'],['project_storage_reservations','phase,start_fence,started_at,settled_bytes,server_command_id,authorization_receipt_id,scope_digest,settled_at'],
 ]);
 const inserted=grants.filter(x=>x[1]==='INSERT');
 assert.deepEqual(inserted.map(x=>x[3]),['project_storage_reservations','commands','authorization_receipts','audit_events','source_content_policy_events','source_content_policy_management_origins']);
 for(const x of inserted){
  const columns=selected.get(x[3]);assert.ok(columns);
  assert.equal(x[2],x[3]==='source_content_policy_events'?columns.replace(',previous_id,previous_version,previous_hash',''):columns);
 }
 assert.match(body('fn03_source_content_management_commit'),/SELECT x\.project_id,x\.coverage_state,x\.generation,x\.used_bytes,x\.held_bytes INTO STRICT ac/);
 assert.match(body('fn03_source_content_management_commit'),/SELECT x\.\* INTO head FROM anvil\.source_content_policy_events x WHERE x\.project_id=p ORDER BY x\.sequence DESC LIMIT 1;/);
 assert.match(body('fn03_management_context'),/PERFORM x\.id FROM anvil\.projects x WHERE x\.id=p AND x\.archived_at IS NULL FOR UPDATE/);
 assert.doesNotMatch(body('fn03_source_content_management_commit'),/source_content_policy_events[^;]+FOR UPDATE/);
 assert.doesNotMatch(sql,/GRANT (?:ALL|SELECT|INSERT|UPDATE) ON anvil\./);
});
test('RLS와 역할 후검산은 일반 C/A/U를 변경하지 않고 직접 원문/상속/owner를 차단한다',()=>{
 const policies=[...sql.matchAll(/CREATE POLICY source_content_management_(select|insert) ON anvil\.(\w+) FOR (SELECT|INSERT) TO ([a-z0-9_]+)/g)];
 assert.deepEqual(policies.map(x=>[x[1],x[2],x[3],x[4]]),[
  ['select','source_content_policy_events','SELECT','anvil_v3_source_content_management_owner'],
  ['insert','source_content_policy_events','INSERT','anvil_v3_source_content_management_owner'],
  ['select','source_content_policy_management_origins','SELECT','anvil_v3_source_content_management_owner'],
  ['insert','source_content_policy_management_origins','INSERT','anvil_v3_source_content_management_owner'],
 ]);
 for(const token of ['m.roleid=purpose_oid OR m.member=purpose_oid','has_any_column_privilege(app_oid,r.oid,privilege)','has_table_privilege(app_oid,r.oid,privilege)','r.relrowsecurity OR r.relforcerowsecurity OR r.relowner IN(purpose_oid,app_oid)','f.proowner<>purpose_oid','NOT(a.grantee=ANY(allowed))'])assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/ALTER FUNCTION anvil\.(?:fn01_|fn09_registered_|fn15_|fn75_|fn76_|quota_|check_source_content_)/);
});
test('E/O 직전 guard는 다른 역할/Tx/ID/회수·기한·계보 오류를 고정 실패로 분리한다',()=>{
 const gate=body('fn03_management_insert_guard');
 for(const token of ["TG_OP<>'INSERT'","TG_WHEN<>'BEFORE'","TG_LEVEL<>'ROW'","c.id::text=ids->>'serverCommandId'","a.id::text=ids->>'authorizationReceiptId'","u.event_id::text=ids->>'auditEventId'","ctx->'credentialGeneration' IS DISTINCT FROM r.plan_json->'credentialGeneration'",'begin_at>=r.authorized_until','at_time<begin_at','at_time>=r.authorized_until',"r.plan_json->'originRef' IS DISTINCT FROM jsonb_build_object",'NEW.request_hash IS DISTINCT FROM c.request_hash','source_content_policy_lineage_shape(b,e) IS NOT TRUE'])assert.ok(gate.includes(token),token);
 assert.match(gate,/TG_TABLE_NAME='source_content_policy_events'[\s\S]+ELSE[\s\S]+q=NEW\.request_json/);
 assert.doesNotMatch(gate,/INSERT INTO|UPDATE anvil|DELETE FROM|EXECUTE|RETURN true|EXCEPTION WHEN/);
 // 원문은 이 private 검사에서만 소비하며 외부 오류는 고정 코드다.
 for(const m of gate.matchAll(/RAISE EXCEPTION ([^;]+);/g))assert.match(m[1]!,/^'SOURCE_CONTENT_MANAGEMENT_[A-Z_]+' USING ERRCODE='42501'$/);
});
test('목적 INVOKER 전이와 기존 collector SD 경계는 정확 29 EXEC 집합이다',()=>{
 const directory=new URL('../../../db/migrations/',import.meta.url);
 const functions=new Map<string,{source:string;body:string}>();
 for(const file of readdirSync(directory).filter(x=>/^\d{4}_.+\.sql(?:\.pending)?$/.test(x)&&x.slice(0,4)<='0101').sort()){
  const raw=readFileSync(new URL(file,directory),'utf8');
  for(const m of raw.matchAll(/CREATE(?: OR REPLACE)? FUNCTION anvil\.(\w+)\([^]*?AS (\$\w*\$)([^]*?)\2;/g))functions.set(m[1]!,{source:m[0],body:m[3]!});
 }
 const seen=new Set<string>();const external=new Set<string>();
 function visit(name:string){
  if(seen.has(name))return;seen.add(name);const f=functions.get(name);if(!f)return;
  if(!name.startsWith('fn03_')){external.add(name);if(f.source.split('AS ')[0]!.includes('SECURITY DEFINER'))return;}
  for(const m of f.body.matchAll(/anvil\.(\w+)\(/g)){
   // R 비용 호출은 literal R/NULL로 고정됐다. P/C 전용 shape 분기에 권한을 추가하지 않는다.
   if(name==='fn09_registered_cost'&&m[1]==='execution_json_shape'){
    assert.match(f.body,/IF kind IN\('P','C'\) THEN/);
    assert.match(functions.get('fn09_registered_reservation_cost')!.body,/fn09_registered_cost\(anvil\.fn09_registered_cost_projection\(projection_row\),'R',NULL\)/);
    continue;
   }
   visit(m[1]!);
  }
 }
 for(const name of functions.keys())if(name.startsWith('fn03_management_')||name.startsWith('fn03_source_content_management_'))visit(name);
 const granted=[...sql.matchAll(/GRANT EXECUTE ON FUNCTION anvil\.(\w+)\([^;]+ TO anvil_v3_source_content_management_owner;/g)].map(x=>x[1]!);
 assert.equal(granted.length,29);assert.equal(new Set(granted).size,29);
 assert.deepEqual([...external].sort(),granted.sort());
 for(const name of granted){
  const f=functions.get(name)!;const sd=f.source.split('AS ')[0]!.includes('SECURITY DEFINER');
  assert.match(sql,new RegExp(`\\('anvil\\.${name}\\([^']*\\)',${sd}\\)`));
  if(sd)assert.ok(f.source.split('AS ')[0]!.includes('SET search_path=pg_catalog'),name);
 }
});
test('0101은 미적용 토대이며 기존 exact9 원문만 저장한다',()=>{
 assert.ok(text.length>0,'0101 source absent');
 assert.match(text,/미적용/);assert.match(text,/source caller 미연결/);
 const table=sql.match(/CREATE TABLE anvil\.source_content_policy_management_origins\s*\(([\s\S]*?)\n\);/);assert.ok(table);
 const columns=[...table[1]!.matchAll(/^ ([a-z_]+) (uuid|smallint|jsonb|text|timestamptz)\b/gm)].map(m=>m[1]);
 assert.deepEqual(columns,['project_id','id','version','management_command_id','policy_event_ref','request_json','request_hash','recorded_at','content_hash']);
 assert.doesNotMatch(table[1]!,/GENERATED|canonical\s+text|snapshot_json/);
});

const baselineQuota=execFileSync('git',['show','a13bb4e2:db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending'],{encoding:'utf8'});
const baselineOperation=execFileSync('git',['show','a13bb4e2:db/migrations/0081_execution_start_origins.sql.pending'],{encoding:'utf8'});
function checkList(source:string,name:string){
 const m=source.match(new RegExp(`ADD CONSTRAINT ${name} CHECK\\([^]*?IN\\(([^)]*)\\)\\);`));assert.ok(m,name);return [...m[1]!.matchAll(/'([^']+)'/g)].map(x=>x[1]);
}
function dispatcher(source:string,name:string){
 const m=source.match(new RegExp(`CREATE(?: OR REPLACE)? FUNCTION anvil\\.${name}\\([^]*?\\$\\$;`));assert.ok(m,name);return m[0];
}
const deferredRoots=[
 ['fn09_prepare_complete','0055_execution_preparation_one_time_approval.sql.pending'],
 ['fn09_understanding_complete','0056_understanding_review_one_time_approval.sql.pending'],
 ['guard_child_human_complete','0061_child_assignment_content.sql.pending'],
 ['fn16_policy_complete','0063_backup_policies.sql.pending'],
 ['fn09_registered_binding_complete','0068_registered_definition_reservations.sql.pending'],
 ['material_registration_reverse','0078_start_execution_material_registration.sql.pending'],
] as const;
const flushNames=['fn09_prepare_commands_complete','fn09_prepare_authorization_receipts_complete','fn09_prepare_audit_events_complete','fn09_understanding_commands_complete','fn09_understanding_authorization_receipts_complete','fn09_understanding_audit_events_complete','child_human_commands_complete','child_human_receipts_complete','child_human_audits_complete','fn16_policy_commands_complete','fn16_policy_authorization_receipts_complete','fn16_policy_audit_events_complete','fn09_registered_commands_complete','fn09_registered_authorization_receipts_complete','fn09_registered_audit_events_complete','material_registration_complete'];
test('6 INVOKER root는 목적 분기 역치환 뒤 원 Git 함수 전체와 같고 다른 표/DELETE를 건너뛰지 않는다',()=>{
 for(const [name,file] of deferredRoots){
  const old=dispatcher(execFileSync('git',['show',`9f0f36d5:db/migrations/${file}`],{encoding:'utf8'}),name);
  const next=dispatcher(text,name);
  const restored=next.replace(/ -- FN03_MANAGEMENT_TRIGGER_BEGIN\r?\n[^]*? -- FN03_MANAGEMENT_TRIGGER_END\r?\n/,'').replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION');
  assert.equal(restored.replace(/\r\n/g,'\n'),old.replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION').replace(/\r\n/g,'\n'),name);
  const added=next.match(/ -- FN03_MANAGEMENT_TRIGGER_BEGIN[^]*? -- FN03_MANAGEMENT_TRIGGER_END/)?.[0];assert.ok(added);
  assert.match(added,/TG_OP IN\('INSERT','UPDATE'\)/);
  assert.match(added,/TG_TABLE_NAME='commands'/);assert.match(added,/TG_TABLE_NAME='authorization_receipts'/);assert.match(added,/TG_TABLE_NAME='audit_events'/);
  assert.match(added,/NEW\.scope_kind='PROJECT'/);assert.match(added,/x\.operation='defineSourceContentPolicy'/);
  assert.match(added,/fn03_management_dispatch\(TG_TABLE_NAME,to_jsonb\(NEW\)\)/);
  assert.doesNotMatch(next,/SECURITY DEFINER|SET search_path/);
 }
});
test('원 목적 dispatch는 실 role/원 행 전체/단일 봉인 R/같은 XID 없이는 생략할 수 없다',()=>{
 const proof=body('fn03_management_dispatch');
 for(const token of ["session_user<>'anvil_v3_app'","current_user<>'anvil_v3_source_content_management_owner'","r.plan_json->>'transactionId' IS DISTINCT FROM txid_current()::text","r.phase IS DISTINCT FROM 'SETTLED'","r.start_fence IS DISTINCT FROM 1",'r.plan_hash IS DISTINCT FROM anvil.source_read_hash(r.plan_json)','row_value IS DISTINCT FROM stored','count(*)','ids'])assert.ok(proof.includes(token),token);
 assert.doesNotMatch(proof,/RETURN true|current_setting|set_config|quota_complete|fn03_management_actual/);
 const final=body('fn03_management_current_final');
 assert.match(final,/fn03_management_complete\(p,cid\) IS NOT TRUE/);assert.match(final,/fn03_management_context/);
 assert.match(final,/clock_timestamp\(\)/);assert.match(final,/at_time<r\.settled_at/);
 assert.match(final,/expected_tx IS DISTINCT FROM txid_current\(\)::text/);
 assert.doesNotMatch(final,/quota_complete|WHEN OTHERS|INSERT INTO|UPDATE anvil/);
});
test('6표 역완결은 C-only도 검사하고 RPC는 exact16 IMMEDIATE→DEFERRED 뒤 현재를 재검산한다',()=>{
 const final=body('fn03_management_final_guard');
 assert.match(final,/TG_OP='UPDATE'/);assert.match(final,/to_jsonb\(OLD\),to_jsonb\(NEW\)/);
 assert.match(final,/raw->>'operation' IS DISTINCT FROM 'defineSourceContentPolicy'/);
 assert.match(final,/fn03_management_current_final\(p,cid,txid_current\(\)::text\)/);
 const attached=[...sql.matchAll(/CREATE CONSTRAINT TRIGGER source_content_management_\w+_complete AFTER INSERT OR UPDATE OR DELETE ON anvil\.(\w+) DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil\.fn03_management_final_guard\(\)/g)].map(x=>x[1]);
 assert.deepEqual(attached,['commands','authorization_receipts','audit_events','source_content_policy_events','source_content_policy_management_origins','project_storage_reservations']);
 const write=body('fn03_source_content_management_commit');
 const calls=[...write.matchAll(/SET CONSTRAINTS ([^;]+) (IMMEDIATE|DEFERRED);/g)].filter(x=>x[1]!== 'anvil.source_content_policy_final');assert.equal(calls.length,2);
 for(const call of calls)assert.deepEqual(call[1]!.replace(/\s+/g,'').split(','),flushNames.map(x=>`anvil.${x}`));
 assert.deepEqual(calls.map(x=>x[2]),['IMMEDIATE','DEFERRED']);
 assert.ok(write.indexOf('fn03_management_current_final')<calls[0]!.index!);
 assert.ok(write.lastIndexOf('fn03_management_current_final')>calls[1]!.index!);
 assert.doesNotMatch(write.slice(calls[0]!.index!),/INSERT INTO|UPDATE anvil|DELETE FROM|SET CONSTRAINTS ALL/);
 assert.match(text,/pg_catalog\.pg_trigger/);assert.match(text,/tgdeferrable/);assert.match(text,/tginitdeferred/);assert.match(text,/tgenabled/);
 assert.match(text,/SOURCE_CONTENT_MANAGEMENT_TRIGGER_LAYOUT_INVALID/);
});
test('설치 대상16 이름의24 부착 및 AFTER ROW 이벤트 비트는 원 DDL과 같다',()=>{
 const expected:Array<[string,string,string,number]>=[];
 for(const [name,file] of deferredRoots.slice(0,5)){
  const old=execFileSync('git',['show',`9f0f36d5:db/migrations/${file}`],{encoding:'utf8'});
  for(const m of old.matchAll(/CREATE CONSTRAINT TRIGGER (\w+) AFTER (INSERT(?: OR UPDATE)?(?: OR DELETE)?) ON anvil\.(\w+) DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION anvil\.(\w+)\(\)/g)){
   if(flushNames.includes(m[1]!)){assert.equal(m[4],name);expected.push([m[1]!,m[3]!,name,1+4+(m[2]!.includes('UPDATE')?16:0)+(m[2]!.includes('DELETE')?8:0)]);}
  }
 }
 const material=execFileSync('git',['show','9f0f36d5:db/migrations/0062_execution_material_registration.sql.pending'],{encoding:'utf8'});
 const tables=material.match(/FOREACH t IN ARRAY ARRAY\[([^\]]+)\] LOOP\s+EXECUTE format\('CREATE CONSTRAINT TRIGGER material_registration_complete AFTER INSERT OR UPDATE OR DELETE/);assert.ok(tables);
 for(const m of tables[1]!.matchAll(/'([^']+)'/g))expected.push(['material_registration_complete',m[1]!,'material_registration_reverse',29]);
 assert.equal(expected.length,24);
 const layout=text.match(/WITH expected\(trigger_name,table_name,function_name,event_bits\) AS \(VALUES([^]*?)\)\s+SELECT 1 FROM expected/);assert.ok(layout);
 const actual=[...layout[1]!.matchAll(/\('([^']+)','([^']+)','([^']+)',(\d+)\)/g)].map(m=>[m[1],m[2],m[3],Number(m[4])]);
 assert.deepEqual(actual,expected);
 for(const token of ['t.tgtype<>e.event_bits','pg_catalog.pg_constraint','con.contype IS DISTINCT FROM \'t\'','con.connamespace IS DISTINCT FROM n.oid','f.prorettype'])assert.ok(text.includes(token),token);
});
test('R 최종 허용 집합은 고정 0081/0082에 신규 operation/kind 한 개만 더한다',()=>{
 assert.equal(createHash('sha256').update(baselineQuota).digest('hex'),'3f32acd0f6f402e823bd3805b1948ae8f48d7ec98300e8dbdc2925923d49cfdf');
 assert.equal(createHash('sha256').update(baselineOperation).digest('hex'),'e642d2b48565dc17e5bbb35c1996a48abcaf0c1bbd988b15cde4a5c95c0f34de');
 assert.deepEqual(checkList(text,'project_storage_reservations_operation_check'),[...checkList(baselineOperation,'project_storage_reservations_operation_check'),'defineSourceContentPolicy']);
 assert.deepEqual(checkList(text,'project_storage_reservations_part_kind_check'),[...checkList(baselineQuota,'project_storage_reservations_part_kind_check'),'SOURCE_CONTENT_POLICY_MANAGEMENT']);
 const drops=[...sql.matchAll(/DROP CONSTRAINT (\w+)/g)].map(m=>m[1]);
 assert.deepEqual(drops,['project_storage_reservations_operation_check','project_storage_reservations_part_kind_check']);
 assert.doesNotMatch(sql,/DROP CONSTRAINT (registered_options_purpose_pair|node_decision_purpose_pair|execution_start_origin_purpose_pair|origin_reuse_\w+_purpose_pair)/);
});
test('management R은 op/kind/key/purpose 중 하나라도 오면 exact 봉인 조합을 요구한다',()=>{
 const m=sql.match(/ADD CONSTRAINT source_content_management_purpose_pair CHECK\(([^]*?)\n\);/);assert.ok(m);const pair=m[1]!;
 const [selector,required]=pair.split('THEN');assert.ok(selector);assert.ok(required);
 for(const token of ["operation='defineSourceContentPolicy'","part_kind='SOURCE_CONTENT_POLICY_MANAGEMENT'","part_key='management_origin'","plan_json->>'purpose'='SOURCE_CONTENT_POLICY_MANAGEMENT_STORAGE'"]){assert.ok(selector.includes(token),token);assert.ok(required.includes(token),token);}
 assert.match(required,/fn03_management_plan_valid\(plan_json\) IS TRUE/);assert.match(required,/plan_hash=anvil\.source_read_hash\(plan_json\)/);
 for(const token of ["plan_json->>'projectId'=project_id::text","plan_json->>'actorId'=actor_id::text","plan_json->>'clientId'=client_id::text","plan_json->>'externalCommandId'=external_command_id::text","plan_json->>'requestHash'=command_hash","plan_json->'ids'->>'serverCommandId'=id::text","plan_json->'parts'->0->>'bytes'=reserved_bytes::text"])assert.ok(required.includes(token),token);
 assert.match(required,/\) IS TRUE ELSE true END/);assert.doesNotMatch(pair,/clock_timestamp|fn03_management_context|quota_complete/);
});
test('quota 두 dispatcher의 새 분기 역치환은 고정 0082 전체 함수와 같고 역사 완결만 연결한다',()=>{
 for(const name of ['quota_plan_valid','quota_settled_complete']){
  const next=dispatcher(text,name),old=dispatcher(baselineQuota,name);
  const restored=next.replace('CREATE OR REPLACE FUNCTION','CREATE FUNCTION').replace(/ -- FN03_MANAGEMENT_DISPATCH_BEGIN\r?\n[^]*? -- FN03_MANAGEMENT_DISPATCH_END\r?\n/,'');
  assert.equal(restored.replace(/\r\n/g,'\n'),old.replace(/\r\n/g,'\n'),name);
  assert.doesNotMatch(text,new RegExp(`ALTER FUNCTION anvil\\.${name}\\([^;]* (OWNER|RENAME)`));
 }
 const plan=dispatcher(sql,'quota_plan_valid'),settled=dispatcher(sql,'quota_settled_complete');
 assert.match(plan,/fn03_management_plan_valid\(v\)/);assert.match(plan,/@> '\[\{"kind":"SOURCE_CONTENT_POLICY_MANAGEMENT"\}\]'/);
 assert.match(plan,/@> '\[\{"key":"management_origin"\}\]'/);
 assert.match(settled,/r\.phase IS DISTINCT FROM 'SETTLED'/);assert.match(settled,/r\.id IS DISTINCT FROM r\.server_command_id/);
 assert.match(settled,/to_jsonb\(r\) IS DISTINCT FROM \(SELECT to_jsonb\(stored\)/);
 assert.match(settled,/fn03_management_complete\(r\.project_id,r\.id\)/);
 assert.doesNotMatch(plan+settled,/clock_timestamp|fn03_management_context|quota_complete\(|fn03_management_actual\(|INSERT|UPDATE|GRANT/);
});
test('O의 프로젝트·원command hash·관리 event 식별을 정확 FK/유일성으로 결박한다',()=>{
 assert.match(compact,/UNIQUE \(project_id,id,request_hash\)/);
 assert.match(compact,/FOREIGN KEY \(project_id,management_command_id,request_hash\) REFERENCES anvil\.commands\(project_id,id,request_hash\) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED/);
 assert.match(compact,/FOREIGN KEY \(project_id,management_command_id\) REFERENCES anvil\.source_content_policy_events\(project_id,management_command_id\) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED/);
 for(const cols of ['project_id,management_command_id','project_id,policy_event_ref','project_id,id,version,content_hash'])assert.ok(compact.includes(`UNIQUE (${cols})`));
 assert.doesNotMatch(compact,/ALTER TABLE anvil\.source_content_policy_events/);
 assert.match(text,/ORIGIN_ABSENT/);assert.match(text,/역완결.*후속/);
});
test('exact11 원명령과 exact10 도출 hash·1MiB/2MiB·유한 ms 시각을 CHECK한다',()=>{
 assert.ok(compact.includes("ARRAY['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']"));
 assert.match(compact,/request_hash=anvil\.source_read_hash\(request_json\)/);
 assert.match(compact,/request_json->'operation'='"defineSourceContentPolicy"'::jsonb/);
 assert.match(compact,/octet_length\(convert_to\(anvil\.source_read_canonical_json\(request_json\),'UTF8'\)\)<=1048576/);
 assert.match(compact,/content_hash=anvil\.source_read_hash\(jsonb_build_object\(/);
 assert.ok(compact.includes("'purpose','SOURCE_CONTENT_POLICY_MANAGEMENT_ORIGIN'"));
 assert.match(compact,/<=2097152/);
 assert.match(compact,/isfinite\(recorded_at\).*recorded_at=date_trunc\('milliseconds',recorded_at\)/);
 assert.match(compact,/anvil\.source_read_ref\(policy_event_ref\) IS TRUE/);
 assert.match(compact,/policy_event_ref->'version'='1'::jsonb/);
});
test('목적 역할은 신규 NOLOGIN·비우회이며 앱 membership과 원문 권한을 발급하지 않는다',()=>{
 assert.match(compact,/CREATE ROLE anvil_v3_source_content_management_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/);
 assert.doesNotMatch(compact,/GRANT anvil_v3_source_content_management_owner TO anvil_v3_app|ALTER ROLE|ALTER TABLE[^;]* OWNER TO/);
 assert.match(compact,/pg_has_role\('anvil_v3_app','anvil_v3_source_content_management_owner','MEMBER'\)/);
 assert.match(compact,/GRANT USAGE ON SCHEMA anvil TO anvil_v3_source_content_management_owner/);
 assert.match(compact,/REVOKE ALL ON anvil\.source_content_policy_management_origins FROM PUBLIC,anvil_v3_app,anvil_v3_source_content_management_owner/);
 assert.doesNotMatch(compact,/GRANT (?:SELECT|INSERT|UPDATE|ALL)[^;]+ TO (?:PUBLIC|anvil_v3_app)/);
});
test('RLS FORCE/false·목적 INSERT 한정·불변/truncate 거절을 유지하고 기존 관측/LINK는 변경하지 않는다',()=>{
 assert.match(compact,/ALTER TABLE anvil\.source_content_policy_management_origins ENABLE ROW LEVEL SECURITY/);
 assert.match(compact,/ALTER TABLE anvil\.source_content_policy_management_origins FORCE ROW LEVEL SECURITY/);
 assert.match(compact,/CREATE POLICY source_content_management_unavailable ON anvil\.source_content_policy_management_origins USING\(false\) WITH CHECK\(false\)/);
 assert.match(compact,/BEFORE INSERT ON anvil\.source_content_policy_management_origins FOR EACH ROW EXECUTE FUNCTION anvil\.source_content_unavailable\(\)/);
 assert.match(compact,/BEFORE UPDATE OR DELETE ON anvil\.source_content_policy_management_origins FOR EACH ROW EXECUTE FUNCTION anvil\.source_content_append_only\(\)/);
 assert.match(compact,/BEFORE TRUNCATE ON anvil\.source_content_policy_management_origins FOR EACH STATEMENT EXECUTE FUNCTION anvil\.source_content_append_only\(\)/);
 assert.doesNotMatch(compact,/DELETE FROM|SET ROLE/);
 assert.doesNotMatch(compact.replace(/ALTER TABLE anvil\.project_storage_reservations DROP CONSTRAINT project_storage_reservations_(operation|part_kind)_check;/g,'').replace(/DROP TRIGGER (?:source_content_unavailable ON anvil\.source_content_policy_events|source_content_management_unavailable ON anvil\.source_content_policy_management_origins);/g,''),/DROP\b/);
 // 새 private producer 본문에만 DML을 허용한다. 권한과 기존 차단 trigger는 위에서 별도로 고정한다.
 const withoutWrite=sql.replace(/CREATE FUNCTION anvil\.fn03_source_content_management_commit\([^]*?\$\$;/,'');
 assert.doesNotMatch(withoutWrite,/INSERT INTO|UPDATE anvil/);
 assert.equal((compact.match(/SECURITY DEFINER/g)??[]).length,6);
 assert.match(compact,/fn03_source_content_management_read\([^;]+LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog/);
 const helpers=[...compact.matchAll(/CREATE FUNCTION anvil\.(fn03_management_\w+)\(([^)]*)\)/g)];
 assert.deepEqual(helpers.map(m=>m[1]),['fn03_management_physical','fn03_management_plan_valid','fn03_management_definition_valid','fn03_management_rows','fn03_management_actual','fn03_management_maximum','fn03_management_fixed_point','fn03_management_complete','fn03_management_history_bundle','fn03_management_context','fn03_management_dispatch','fn03_management_current_final','fn03_management_final_guard','fn03_management_insert_guard']);
 for(const helper of helpers)assert.ok(compact.includes(`REVOKE ALL ON FUNCTION anvil.${helper[1]}(`));
 assert.doesNotMatch(compact,/anvil\.(source_content_requests|source_content_observations|source_content_verifications|document_source_links)\b/);
});
test('기존 0040은 E관리command unique와 무조건 쓰기 거절을 가진 선행이다',()=>{
 const old=readFileSync(new URL('../../../db/migrations/0040_source_content_hash.sql.pending',import.meta.url),'utf8');
 assert.ok(old.includes('UNIQUE(project_id,management_command_id)'));
 assert.ok(old.includes("CREATE TRIGGER source_content_unavailable BEFORE INSERT OR UPDATE OR DELETE"));
 assert.ok(old.includes("RAISE EXCEPTION 'SOURCE_CONTENT_AUTHORITY_NOT_ACTIVATED'"));
});

function body(name:string){
 const found=sql.match(new RegExp(`CREATE FUNCTION anvil\\.${name}\\([^]*?AS \\$\\$([^]*?)\\$\\$;`));
 assert.ok(found,`${name} source absent`);return found[1]!;
}
test('실제 물리행 수집→비용→봉인 정산→역사 bundle DAG는 현재 권한과 분리한다',()=>{
 const rows=body('fn03_management_rows'),actual=body('fn03_management_actual'),complete=body('fn03_management_complete'),history=body('fn03_management_history_bundle');
 for(const table of ['source_content_policy_management_origins','source_content_policy_events','commands','authorization_receipts','audit_events','project_storage_reservations'])assert.ok(rows.includes(`anvil.${table}`));
 assert.match(rows,/INTO STRICT/);assert.match(rows,/server_sequence[^]*::text/);
 assert.match(actual,/fn03_management_rows/);assert.match(actual,/fn09_registered_cost_projection/);assert.match(actual,/fn75_cost/);
 assert.match(complete,/fn03_management_maximum/);assert.match(complete,/fn03_management_fixed_point/);assert.match(complete,/plan_hash[^]*source_read_hash/);
 assert.match(history,/fn03_management_complete\(p,cid\) IS NOT TRUE/);
 for(const name of ['fn03_management_rows','fn03_management_actual','fn03_management_complete','fn03_management_history_bundle'])assert.doesNotMatch(body(name),/clock_timestamp|quota_complete|fn03_management_context|fn01_active/);
});
test('역사 완결은 실제 E/O 별도 시각과 원 봉인 수명을 보존하며 예외를 성공으로 바꾸지 않는다',()=>{
 const complete=body('fn03_management_complete');
 assert.match(complete,/e\.recorded_at>o\.recorded_at/);assert.doesNotMatch(complete,/e\.recorded_at\s*=\s*o\.recorded_at/);
 assert.match(complete,/r\.settled_at>=r\.authorized_until/);
 assert.match(complete,/received_at>c\.completed_at/);
 assert.doesNotMatch(complete,/WHEN OTHERS|RETURN true[^]*EXCEPTION/);
 assert.match(body('fn03_management_fixed_point'),/1\.\.64/);
 assert.match(body('fn03_management_maximum'),/9223372036854775807/);
});

test('현재 목적은 실 auth 잠금 뒤 project/member/control/head 순서와 유한 원 기한을 검산한다',()=>{
 const current=body('fn03_management_context');
 const ordered=['PERFORM anvil.fn01_active(s,a,c)','FROM anvil.auth_sessions','FROM anvil.projects','FROM anvil.project_members','FROM anvil.project_control','FROM anvil.permission_policies'];
 let previous=-1;for(const token of ordered){const at=current.indexOf(token);assert.ok(at>previous,token);previous=at;}
 assert.match(current,/FOR SHARE OF h/);assert.match(current,/FOR UPDATE/g);
 for(const token of ["'defineSourceContentPolicy'","'readSourceContentPolicyManagementOrigin'","participation IS DISTINCT FROM 'OWNER'",'control.client_id IS DISTINCT FROM c','control.generation IS DISTINCT FROM g','auth.reauth_until IS NULL','auth.revoked_at IS NOT NULL','auth.credential_generation','date_trunc(\'milliseconds\',until_at)'])assert.ok(current.includes(token),token);
 assert.doesNotMatch(current,/current_setting|set_config|fn01_lock_owner|quota_account|project_storage|INSERT|UPDATE anvil|DELETE/);
});
test('현재 DENY/REQUIRE_APPROVAL은 좁은 AUTO 형상 전에 거절하고 만료 및 주체·목적을 구분한다',()=>{
 const current=body('fn03_management_context');
 const deny=current.indexOf("rule->>'disposition' IS DISTINCT FROM 'AUTO'");
 const narrow=current.indexOf("rule->'targetScopes' IS DISTINCT FROM jsonb_build_array");
 assert.ok(deny>=0&&narrow>deny);assert.match(current,/rule_until>at_time/);
 for(const token of ["rule->'subjectRef'->>'kind'='HUMAN'","rule->'subjectRef'->>'userId'=a::text","rule->'operations' ? op","scope->>'kind'='PROJECT'","scope->>'projectId'=p::text","rule->'limitPolicyRef' IS DISTINCT FROM 'null'::jsonb",'IF NOT matched'])assert.ok(current.includes(token),token);
 assert.doesNotMatch(current,/ORDER BY|LIMIT 1|approval_consumptions/);
});
test('보호 read는 current exact3→O→역사 완결→current이고 순수 부재만 ORIGIN_ABSENT다',()=>{
 const read=body('fn03_source_content_management_read');
 assert.equal((read.match(/anvil\.fn03_management_context\(/g)??[]).length,2);
 assert.match(read,/expected_tx IS DISTINCT FROM txid_current\(\)::text/);
 assert.match(read,/ARRAY\['originRef','policyEventRef','managementCommandId'\]/);
 assert.match(read,/o\.id=\(selection->'originRef'->>'id'\)::uuid OR o\.management_command_id=cid OR o\.policy_event_ref->>'id'=selection->'policyEventRef'->>'id'/);
 const absence=read.indexOf('EXCEPTION WHEN no_data_found THEN absent=true'),bundle=read.indexOf('anvil.fn03_management_history_bundle(p,cid)');
 assert.ok(absence>=0&&bundle>absence);assert.match(read,/SOURCE_CONTENT_MANAGEMENT_SELECTION_MISMATCH/);
 const historical=read.slice(read.indexOf('IF absent THEN'),read.indexOf('ELSE',read.indexOf('IF absent THEN')));
 assert.match(historical,/FROM anvil\.source_content_policy_events e WHERE e\.project_id=p AND e\.management_command_id=cid/);
 assert.match(historical,/IF NOT FOUND OR selection->'policyEventRef' IS DISTINCT FROM jsonb_build_object\('id',historical_event\.id,'version',historical_event\.version,'contentHash',historical_event\.content_hash\)/);
 assert.match(historical,/source_content_policy_row_shape\(historical_event\) IS NOT TRUE/);
 assert.match(historical,/RAISE EXCEPTION 'SOURCE_CONTENT_MANAGEMENT_SELECTION_MISMATCH'/);
 assert.match(read,/jsonb_build_object\('status','ORIGIN_ABSENT','transactionId',expected_tx\)/);
 assert.match(read,/jsonb_build_object\('status','FOUND','transactionId',expected_tx\)\|\|bundle/);
 assert.equal((read.match(/EXCEPTION WHEN/g)??[]).length,1);assert.doesNotMatch(read,/WHEN OTHERS|quota_|INSERT|UPDATE|DELETE|GUC|set_config/);
 assert.doesNotMatch(read,/plan[^\n]*(actorId|clientId|authSessionId|authorizedUntil)|R\.plan/);
 assert.match(compact,/REVOKE ALL ON FUNCTION anvil\.fn03_source_content_management_read\(uuid,uuid,uuid,uuid,bigint,jsonb,jsonb,text\) FROM PUBLIC,anvil_v3_app/);
});

test('새 private commit은 원 context/계정/전체비용/head CAS 뒤에만 예약과 실제 다섯 행을 쓴다',()=>{
 const write=body('fn03_source_content_management_commit');
 const ordered=['anvil.fn03_management_context(', 'FROM anvil.project_storage_accounts', 'anvil.quota_complete(p)', 'FROM anvil.source_content_policy_events', 'anvil.fn03_management_definition_valid(', 'anvil.fn03_management_fixed_point(', 'INSERT INTO anvil.project_storage_reservations', "SET phase='IO_STARTED'", 'INSERT INTO anvil.commands', 'INSERT INTO anvil.authorization_receipts', 'INSERT INTO anvil.audit_events', 'INSERT INTO anvil.source_content_policy_events', 'INSERT INTO anvil.source_content_policy_management_origins', 'anvil.fn03_management_actual(', "SET phase='SETTLED'", 'anvil.fn03_management_history_bundle('];
 let last=-1;for(const token of ordered){const next=write.indexOf(token,last+1);assert.ok(next>last,token);last=next;}
 assert.match(write,/previous IS DISTINCT FROM q->'payload'->'previousPolicyRef'/);
 assert.match(write,/ORDER BY x\.sequence DESC LIMIT 1/);assert.doesNotMatch(write,/disposition\s*=\s*'AUTO'/);
 for(const f of ['fn15_storage_actual','fn75_project_storage_actual_bytes','fn76_storage_actual','fn15_storage_future','fn75_project_storage_future','fn76_storage_future','fn09_registered_other_bytes'])assert.ok(write.includes(`anvil.${f}(p)`));
 assert.match(write,/used\+held\+reserved\+other_bytes>10737418240/);
 assert.match(write,/used\+settled\+held\+other_bytes>10737418240/);
 assert.match(write,/jsonb_build_object\('status','RECORDED','transactionId',expected_tx\)\|\|bundle/);
 assert.doesNotMatch(write,/WHEN OTHERS|ON CONFLICT|set_config|SET ROLE|quota_account\(/);
});
test('write는 실제 clock·원 plan·CAS와 저장 뒤 물리행 검산을 유지한다',()=>{
 const write=body('fn03_source_content_management_commit');
 assert.match(write,/expected_tx IS DISTINCT FROM txid_current\(\)::text/);
 assert.match(write,/received_at=transaction_timestamp\(\)/);
 assert.match(write,/e_at=date_trunc\('milliseconds',at_time\)/);assert.match(write,/o_at=date_trunc\('milliseconds',at_time\)/);
 assert.match(write,/done_at<received_at/);assert.doesNotMatch(write,/greatest\([^]*clock_timestamp/);
 assert.match(write,/plan_hash=sealed_hash AND phase='RESERVED' AND start_fence=0/);
 assert.match(write,/plan_hash=sealed_hash AND phase='IO_STARTED' AND start_fence=1/);
 assert.doesNotMatch(write,/SET plan_json|SET plan_hash|SET authorized_until/);
 assert.match(write,/actual>maximum OR settled>reserved/);
 assert.match(write,/final_ctx IS DISTINCT FROM ctx/);
 assert.match(write,/\(bundle->'rows'-'R'\) IS DISTINCT FROM prepared/);
 assert.match(write,/bundle->'rows'->'R'->'plan_json' IS DISTINCT FROM plan/);
 assert.match(write,/bundle->'rows'->'R'->>'plan_hash' IS DISTINCT FROM sealed_hash/);
 assert.match(write,/coverage_state='VERIFIED' AND generation=ac\.generation AND used_bytes=used AND held_bytes=held\+reserved/);
 assert.match(compact,/REVOKE ALL ON FUNCTION anvil\.fn03_source_content_management_commit\(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,timestamptz\) FROM PUBLIC,anvil_v3_app/);
});

test('producer의 물리 tuple은 exact 기존 열을 보존하고 generated E열·가상 비용열은 쓰지 않는다',()=>{
 const write=body('fn03_source_content_management_commit');
 const insert=write.match(/INSERT INTO anvil\.source_content_policy_events\(([^)]*)\)/);assert.ok(insert);
 assert.deepEqual(insert[1]!.split(','),['project_id','id','version','sequence','subject_user_id','disposition','snapshot_json','content_hash','previous_ref','management_command_id','recorded_at','expires_at']);
 for(const [table,record] of [['commands','cmd'],['authorization_receipts','receipt'],['audit_events','audit'],['source_content_policy_management_origins','o'],['project_storage_reservations','r']]){
  assert.ok(write.includes(`NULL::anvil.${table}`));assert.ok(write.includes(`INSERT INTO anvil.${table} SELECT (${record}).*;`));
 }
 assert.match(write,/audit\.server_sequence=audit_seq/);assert.match(write,/'server_sequence',audit_seq::text/);
 assert.match(write,/audit_seq NOT BETWEEN 1 AND 9007199254740991/);
 assert.doesNotMatch(write,/request_canonical|snapshot_canonical|_canonical_result_ref/);
 const finalAt=write.indexOf('bundle=anvil.fn03_management_history_bundle(p,cid)');
 assert.ok(finalAt>write.indexOf("SET phase='SETTLED'"));
 assert.doesNotMatch(write.slice(finalAt),/INSERT INTO|UPDATE anvil|DELETE FROM/);
 // 원 AUTO 허가와 새 CM 의도(AUTO/DENY/REVOKED)는 서로 다른 원형이며 새 intent로 현재 허가를 만들지 않는다.
 assert.match(write,/fn03_management_context\(s,a,c,p,g,'defineSourceContentPolicy',policy,observed_until\)/);
 assert.match(write,/fn03_management_definition_valid\(q->'payload'->'definition',q->'payload'->'reason',a,e_at\)/);
});
