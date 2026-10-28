import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(file:string)=>readFileSync(new URL('db/migrations/'+file,root),'utf8');
// 실제 migration의 명시 허용열 대조다. 실제 PG/RLS 실행 검증은 아니다.
const maps=[
 ['0005_knowledge_drafts.sql','knowledge_entries','id project_id kind head_version created_by client_id command_id created_at'],
 ['0005_knowledge_drafts.sql','knowledge_versions','project_id entry_id version title content_artifact_id content_hash source_refs reason scope_json related_refs entry_json supersedes_version created_by client_id command_id created_at'],
 ['0005_knowledge_drafts.sql','knowledge_events','id project_id entry_id version kind reason actor_ref approval_ref target_refs client_id command_id recorded_at'],
 ['0005_project_constitutions.sql','constitution_applications','project_id application_version content_hash entry_id version confirmation_id snapshot_json applied_by client_id command_id created_at'],
 ['0005_project_constitutions.sql','project_constitutions','project_id application_version application_hash entry_id version'],
 ['0011_authorization.sql','commands','id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id'],
 ['0011_authorization.sql','audit_events','event_id project_id command_id server_sequence'],
 ['0011_authorization.sql','authorization_receipts','id command_id policy_ref'],
 ['0011_user_common_content_reviews.sql','content_reviews','id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at'],
 ['0003_project_artifacts.sql','artifacts','id project_id bytes content_hash media_type state']
]as const;
test('knowledgeSchema 실표열·사건추가열·audit event_id와복합PK 확인',()=>{for(const[file,table,fields]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}const changes=read('0005_knowledge_changes.sql'),confirmation=read('0005_knowledge_confirmation.sql');for(const column of ['base_ref','change_sources'])assert(changes.includes('ADD COLUMN '+column+' jsonb'));assert(confirmation.includes('ADD COLUMN review_refs jsonb'));assert(read('0011_authorization.sql').includes('PRIMARY KEY(project_id,server_sequence)'));assert(read('0005_artifact_quarantine.sql').includes('inspection_json jsonb'));});

test('knowledgeSchema 명시표·순수검증만·원문/일반조회/공유/쓰기0',()=>{const u=new URL('apps/server/modules/backups/knowledge-inventory.ts',root);assert(existsSync(u),'지식 inventory 미구현');const source=readFileSync(u,'utf8');for(const[,table]of maps)assert(source.includes(table));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(source));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(source));assert(!/originalText\(|new\s+ProjectKnowledge|new\s+ProjectConstitutions|await\s+knowledgeReviews\(|readFile\(|storage_key|body_utf8/.test(source));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(source));assert(!/FROM anvil\.(?:knowledge_share_requests|conversation_messages|document_versions)/.test(source));});
