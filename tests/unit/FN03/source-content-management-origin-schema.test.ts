import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const file=new URL('../../../db/migrations/0101_source_content_policy_management_origins.sql.pending',import.meta.url);
const text=existsSync(file)?readFileSync(file,'utf8'):'';
const sql=text.replace(/--[^\r\n]*/g,'');
const compact=sql.replace(/\s+/g,' ').trim();
test('0101은 미적용 토대이며 기존 exact9 원문만 저장한다',()=>{
 assert.ok(text.length>0,'0101 source absent');
 assert.match(text,/미적용/);assert.match(text,/RPC.*미연결/);
 const table=sql.match(/CREATE TABLE anvil\.source_content_policy_management_origins\s*\(([\s\S]*?)\n\);/);assert.ok(table);
 const columns=[...table[1]!.matchAll(/^ ([a-z_]+) (uuid|smallint|jsonb|text|timestamptz)\b/gm)].map(m=>m[1]);
 assert.deepEqual(columns,['project_id','id','version','management_command_id','policy_event_ref','request_json','request_hash','recorded_at','content_hash']);
 assert.doesNotMatch(table[1]!,/GENERATED|canonical\s+text|snapshot_json/);
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
 assert.doesNotMatch(compact,/GRANT anvil_v3_source_content_management_owner TO|ALTER ROLE|ALTER TABLE[^;]* OWNER TO/);
 assert.match(compact,/pg_has_role\('anvil_v3_app','anvil_v3_source_content_management_owner','MEMBER'\)/);
 assert.match(compact,/GRANT USAGE ON SCHEMA anvil TO anvil_v3_source_content_management_owner/);
 assert.match(compact,/REVOKE ALL ON anvil\.source_content_policy_management_origins FROM PUBLIC,anvil_v3_app,anvil_v3_source_content_management_owner/);
 assert.deepEqual([...compact.matchAll(/GRANT ([^;]+);/g)].map(m=>m[1]),['USAGE ON SCHEMA anvil TO anvil_v3_source_content_management_owner']);
});
test('RLS FORCE/false·전 INSERT 거절·불변/truncate 거절을 유지하고 기존 관측/LINK는 변경하지 않는다',()=>{
 assert.match(compact,/ALTER TABLE anvil\.source_content_policy_management_origins ENABLE ROW LEVEL SECURITY/);
 assert.match(compact,/ALTER TABLE anvil\.source_content_policy_management_origins FORCE ROW LEVEL SECURITY/);
 assert.match(compact,/CREATE POLICY source_content_management_unavailable ON anvil\.source_content_policy_management_origins USING\(false\) WITH CHECK\(false\)/);
 assert.match(compact,/BEFORE INSERT ON anvil\.source_content_policy_management_origins FOR EACH ROW EXECUTE FUNCTION anvil\.source_content_unavailable\(\)/);
 assert.match(compact,/BEFORE UPDATE OR DELETE ON anvil\.source_content_policy_management_origins FOR EACH ROW EXECUTE FUNCTION anvil\.source_content_append_only\(\)/);
 assert.match(compact,/BEFORE TRUNCATE ON anvil\.source_content_policy_management_origins FOR EACH STATEMENT EXECUTE FUNCTION anvil\.source_content_append_only\(\)/);
 assert.doesNotMatch(compact,/DROP\b|INSERT INTO|UPDATE anvil|DELETE FROM|SET ROLE/);
 assert.equal((compact.match(/SECURITY DEFINER/g)??[]).length,1);
 assert.match(compact,/fn03_source_content_management_read\([^;]+LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog/);
 const helpers=[...compact.matchAll(/CREATE FUNCTION anvil\.(fn03_management_\w+)\(([^)]*)\)/g)];
 assert.deepEqual(helpers.map(m=>m[1]),['fn03_management_physical','fn03_management_plan_valid','fn03_management_definition_valid','fn03_management_rows','fn03_management_actual','fn03_management_maximum','fn03_management_fixed_point','fn03_management_complete','fn03_management_history_bundle','fn03_management_context']);
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
