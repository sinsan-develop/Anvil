import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(file:string)=>readFileSync(new URL('db/migrations/'+file,root),'utf8');
const maps=[
 ['0002_methodologies.sql','project_methodologies','id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at',10],
 ['0011_authorization.sql','commands','id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash',19],
 ['0011_authorization.sql','audit_events','event_id project_id command_id server_sequence',4]
]as const;
test('methodApplicationSchema 실제10+추가1·명령19·감사4열',()=>{
 for(const[file,table,fields,count]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);assert.equal(fields.split(' ').length,count);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}
 const migration=read('0031_empty_project_methodology_application.sql');assert(migration.includes('ALTER TABLE anvil.project_methodologies ADD COLUMN application_command_id uuid UNIQUE'));assert(migration.includes("NEW.application_command_id=current_setting('anvil.command_id',true)::uuid"));assert(migration.includes('cmd.approval_consumption_id IS NOT NULL OR cmd.payload_ref IS NOT NULL'));assert(migration.includes("'baselineRefs','[]'::jsonb,'approvalRef','null'::jsonb"));assert(read('0002_methodologies.sql').includes('UNIQUE(project_id,application_version)'));
});
test('methodApplicationSchema 내부읽기·실제snapshot소비·현재권한/양식재판정0',()=>{
 const u=new URL('apps/server/modules/backups/methodology-application-inventory.ts',root);assert(existsSync(u),'방법론 적용 이력 inventory 미구현');const s=readFileSync(u,'utf8');for(const[,table]of maps)assert(s.includes(table));assert(s.includes('application_command_id'));assert(s.includes('readApplicationSnapshot'));assert(s.includes('request_hash'));
 assert(!/SELECT\s+(?:\w+\.)?\*/i.test(s));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(s));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(s));assert(!/new\s+ProjectMethodologies|readFile\(|storage_key|body_utf8|requirePreparedForms\s*\(|fn02_assert_application\s*\(/.test(s));assert(!/FROM anvil\.(?:methodology_versions|content_reviews|methodology_reviews|form_definitions|form_versions|permission_policies|authorization_receipts|executions|project_drafts)/.test(s));assert(s.includes('NOT_PERFORMED'));
});