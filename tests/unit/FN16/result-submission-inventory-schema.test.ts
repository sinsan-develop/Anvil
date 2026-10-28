import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(file:string)=>readFileSync(new URL('db/migrations/'+file,root),'utf8');
const maps=[
 ['0025_result_submissions.sql','result_submissions','project_id id execution_id generation assignment_ref execution_ref manifest_ref manifest_hash submission_state submitted_by client_id command_id content_hash snapshot_json submitted_at',15],
 ['0011_authorization.sql','commands','id command_id scope_kind scope_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id payload_ref completed_at operation_id request_hash',19],
 ['0011_authorization.sql','authorization_receipts','id scope_kind scope_id command_id subject_ref policy_ref scope_digest approval_decision_ref authorized_at',9],
 ['0011_authorization.sql','audit_events','project_id server_sequence event_id actor_ref client_ref command_id operation_id target_ref policy_ref approval_ref outcome reason_code scope_digest recorded_at source_kind correction_of',16]
]as const;
test('resultSubmissionSchema 실제결과15·명령19·허가9·감사16열과두hash',()=>{
 for(const[file,table,fields,count]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);assert.equal(fields.split(' ').length,count);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}
 const sql=read('0025_result_submissions.sql');assert(sql.includes('UNIQUE(project_id,command_id)'));assert(sql.includes("NEW.manifest_hash IS DISTINCT FROM anvil.execution_json_hash(m)"));assert(sql.includes("NEW.content_hash IS DISTINCT FROM anvil.execution_json_hash(s)"));assert(sql.includes("'targetRef',manifest_ref"));assert(sql.includes("'status' IS DISTINCT FROM 'RESULT_SUBMITTED'"));assert(sql.includes("s->>'sourceKind' IS DISTINCT FROM 'WORKER_CLAIM'"));assert(read('0011_project_policy_control.sql').includes('project_command_once ON anvil.commands(project_id,actor_id,command_id)'));
});
test('resultSubmissionSchema 내부읽기·기존순수parser·현재실행/검토재조회0',()=>{
 const u=new URL('apps/server/modules/backups/result-submission-inventory.ts',root);assert(existsSync(u),'결과제출 history inventory 미구현');const s=readFileSync(u,'utf8');for(const[,table]of maps)assert(s.includes(table));assert(s.includes('readSubmittedResultRecord'));assert(s.includes('manifest_hash'));assert(s.includes('content_hash'));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(s));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(s));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(s));assert(!/readPgResultExecution\s*\(|new\s+ProjectResultSubmissions|persistProjectReceipt\s*\(|result_submission_authorized\s*\(|readFile\(/.test(s));assert(!/FROM anvil\.(?:executions|execution_commands|execution_grants|assignment_versions|permission_policies|result_reviews|result_review_criteria|result_rework_drafts|artifacts)/.test(s));assert(s.includes('NOT_PERFORMED')&&s.includes('NOT_COLLECTED'));
});
