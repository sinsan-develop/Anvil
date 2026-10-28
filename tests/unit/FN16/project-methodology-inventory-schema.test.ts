import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(file:string)=>readFileSync(new URL('db/migrations/'+file,root),'utf8');
const maps=[
 ['0002_methodologies.sql','methodology_definitions','id scope owner_user_id project_id system_code name purpose head_version created_at',9],
 ['0002_methodologies.sql','methodology_versions','definition_id version name purpose graph_json content_hash origin_ref_json reason created_by created_at',10],
 ['0011_user_common_content_reviews.sql','content_reviews','id scope_kind scope_id owner_user_id project_id draft_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at',21],
 ['0002_methodologies.sql','methodology_reviews','id definition_id version target_hash validation_json review_refs decision decided_by decided_at',9],
 ['0002_methodologies.sql','project_methodologies','id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at',10],
 ['0011_authorization.sql','commands','id command_id scope_kind project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id',13],
 ['0011_authorization.sql','audit_events','event_id project_id command_id server_sequence',4]
]as const;
test('projectMethodSchema 명시9·10·21·12·10·13·4열과실제추가열',()=>{
 for(const[file,table,fields,count]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);assert.equal(fields.split(' ').length,count);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}
 const common=read('0011_user_common_method_reviews.sql'),project=read('0002_project_methodology_revisions.sql');for(const name of ['client_id','command_id'])assert(common.includes('ALTER TABLE anvil.methodology_reviews ADD COLUMN '+name+' uuid'));assert(project.includes('ALTER TABLE anvil.methodology_reviews ADD COLUMN project_id uuid'));
 const base=read('0002_methodologies.sql');assert(base.includes('PRIMARY KEY(definition_id,version)'));assert(base.includes('UNIQUE(project_id,application_version)'));assert(base.includes('UNIQUE(definition_id,version,content_hash)'));
});
test('projectMethodSchema 내부역사읽기·초기증빙만·권한/공통본/실행확대0',()=>{
 const u=new URL('apps/server/modules/backups/project-methodology-inventory.ts',root);assert(existsSync(u),'프로젝트 방법론 inventory 미구현');const s=readFileSync(u,'utf8');for(const[,table]of maps)assert(s.includes(table));
 for(const name of ['validateMethodologyGraph','readProjectMethodReview','methodContentReviewCriteria','readApplicationSnapshot'])assert(s.includes(name));
 assert(!/SELECT\s+(?:\w+\.)?\*/i.test(s));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(s));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(s));
 assert(!/new\s+ProjectMethodologies|readFile\(|storage_key|body_utf8|formsFor\s*\(/.test(s));assert(!/FROM anvil\.(?:form_definitions|form_versions|project_drafts|draft_confirmations|permission_policies|authorization_receipts|approval_requests|artifacts)/.test(s));
 assert(/application_version\s*=\s*1/.test(s));assert(s.includes('NOT_COLLECTED'));assert(s.includes('NOT_PERFORMED'));
});