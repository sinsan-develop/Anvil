import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(name:string)=>readFileSync(new URL('db/migrations/'+name,root),'utf8');
const maps=[
 ['0052_approval_in_app_notifications.sql.pending','notifications','id project_id source_command_id approval_request_id request_version request_content_hash recipient_user_id event_kind channel severity reason_code delivery_state created_at content_hash',14],
 ['0052_approval_in_app_notifications.sql.pending','notification_reads','project_id notification_id recipient_user_id client_id command_id notification_content_hash read_at',7],
 ['0011_authorization.sql','approval_requests','id project_id version candidate_command_id action_scope_json scope_digest details_json required_decider_ref status expires_at created_by created_at',12],
 ['0011_authorization.sql','commands','id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash',19],
 ['0011_authorization.sql','authorization_receipts','id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at',9],
 ['0011_authorization.sql','audit_events','project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of',16]
]as const;
test('notificationSchema 실제알림14/읽음7·요청12+5·명령19/허가9/감사16',()=>{
 for(const[file,table,fields,count]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);assert.equal(fields.split(' ').length,count);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}
 const added=read('0011_one_time_approval_requests.sql');for(const field of['client_id','command_id','policy_ref','content_hash','request_json'])assert(new RegExp(String.raw`ALTER TABLE anvil\.approval_requests ADD COLUMN ${field}\b`).test(added));
 const n=read('0052_approval_in_app_notifications.sql.pending');assert(n.includes("recipient_user_id=nullif(current_setting('anvil.actor_id',true),'')::uuid"));assert(n.includes('FORCE ROW LEVEL SECURITY'));assert(n.includes('PRIMARY KEY(project_id,notification_id,recipient_user_id)'));assert(n.includes('NEW.read_at>=n.created_at'));assert(n.includes("'operation','markNotificationRead'"));assert(n.includes("c.approval_consumption_id IS NULL"));assert(n.includes("c.result_ref->'data'=jsonb_build_object('ref',ref,'status','NOTIFICATION_READ'"));
});
test('notificationSchema 내부읽기·순수원hash·RLS문맥·현재승인/후보쓰기0',()=>{
 const u=new URL('apps/server/modules/backups/notification-inventory.ts',root);assert(existsSync(u),'본인 승인알림 inventory 미구현');const s=readFileSync(u,'utf8');for(const[,table]of maps)assert(s.includes(table));assert(s.includes('notificationFromRow'));assert(s.includes('anvil.actor_id'));assert(s.includes('anvil.client_id'));assert(!s.includes("set_config('anvil.command_id'"));
 assert(!/SELECT\s+(?:\w+\.)?\*/i.test(s));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(s));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(s));assert(!/new\s+ProjectNotifications|recordApprovalRequestNotification\s*\(|persistProjectReceipt\s*\(|fn17_notification_origin_valid\s*\(|assert_approval_notification_capacity\s*\(|readFile\(/.test(s));assert(!/FROM anvil\.(?:permission_policies|approval_decisions|approval_consumptions|approval_work_plan_candidates|approval_design_change_candidates)/.test(s));assert(s.includes('NOT_COLLECTED')&&s.includes('NOT_PERFORMED'));
});
