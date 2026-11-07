import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(file:string)=>readFileSync(new URL('db/migrations/'+file,root),'utf8');
// 실제 migration 허용열을 대조한다. PG/RLS/SQL 실행 증거는 아니다.
const maps=[
 ['0004_work_plan_drafts.sql','work_plans','id project_id head_version confirmed_version created_by created_at updated_at'],
 ['0004_work_plan_drafts.sql','work_plan_versions','project_id plan_id version document_id document_version document_hash design_id design_version design_hash screen_review_refs content_hash version_json created_by client_id command_id created_at'],
 ['0004_work_plan_drafts.sql','plan_tasks','project_id plan_id plan_version task_code task_type card_json card_hash owner_role'],
 ['0004_work_plan_drafts.sql','plan_dependencies','project_id plan_id plan_version task_code dependency_task_code phase'],
 ['0004_work_plan_confirmation.sql','work_plan_confirmations','id project_id plan_id version target_hash review_refs validation_json confirmed_by client_id command_id created_at'],
 ['0011_user_common_content_reviews.sql','content_reviews','id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'],
 ['0011_authorization.sql','commands','id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'],
 ['0011_authorization.sql','audit_events','event_id project_id command_id server_sequence']
]as const;
test('workPlanSchema 명시열·검토19열·복합PK·확정pointer',()=>{for(const[file,table,fields]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}assert.equal(maps.find(m=>m[1]==='content_reviews')![2].split(' ').length,19);const drafts=read('0004_work_plan_drafts.sql');assert(/PRIMARY KEY\s*\(project_id,plan_id,plan_version,task_code\)/.test(drafts));assert(/PRIMARY KEY\s*\(project_id,plan_id,plan_version,task_code,dependency_task_code,phase\)/.test(drafts));assert(/confirmed_version bigint/.test(drafts));assert(read('0011_authorization.sql').includes('PRIMARY KEY(project_id,server_sequence)'));});
test('workPlanSchema 명시읽기·역사검토·text cursor·외부원문/쓰기0',()=>{const u=new URL('apps/server/modules/backups/work-plan-inventory.ts',root);assert(existsSync(u),'작업계획 inventory 미구현');const source=readFileSync(u,'utf8');for(const[,table]of maps)assert(source.includes(table));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(source));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(source));assert(!/acceptedWorkPlanReviews\s*\(|await\s+workPlanReviews\s*\(|new\s+ProjectWorkPlans|readFile\(|storage_key|body_utf8/.test(source));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(source));assert(!/FROM anvil\.(?:authorization_receipts|artifacts|document_versions|trace_links|design_items)/.test(source));assert(/COLLATE\s+"C"/.test(source));assert(!/task_code\s*::\s*(?:uuid|bigint)/i.test(source));});
