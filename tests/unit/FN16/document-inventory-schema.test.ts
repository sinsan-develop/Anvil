import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';

// 정적 schema/명시 SELECT 경계만 대조한다. 실제 PG 구문·RLS·자료 존재 증거가 아니다.
const root=new URL('../../../',import.meta.url);
const mappings=[
 ['0003_project_documents.sql','documents','id project_id title head_version confirmed_version created_by created_at updated_at','id'],
 ['0003_project_documents.sql','document_versions','project_id document_id version form_definition_id form_version form_hash stage_ref_json body_artifact_id title source_refs_json content_json content_hash sections_json author_ref_json validation_json reason client_id command_id created_at','project_id document_id version'],
 ['0003_project_documents.sql','document_artifact_links','project_id document_id version artifact_id kind','project_id document_id version artifact_id kind'],
 ['0003_project_documents.sql','document_version_events','id project_id document_id version event_kind review_ref actor_ref reason command_id created_at','id'],
 ['0003_project_artifacts.sql','artifacts','id project_id bytes content_hash media_type state','id'],
 ['0003_document_imports.sql','document_imports','id project_id original_artifact_id form_definition_id form_version form_hash candidate_json content_hash created_by client_id command_id created_at','id'],
 ['0003_document_imports.sql','document_import_selections','id project_id import_id document_id version created_by client_id command_id created_at','id'],
 ['0003_document_proposals.sql','document_proposals','id project_id document_id base_version base_hash body_artifact_id diff_artifact_id content_json proposal_json content_hash reason created_by client_id command_id created_at','id'],
 ['0003_document_proposals.sql','document_proposal_selections','id project_id proposal_id document_id version created_by client_id command_id created_at','id'],
 ['0011_user_common_content_reviews.sql','content_reviews','id scope_kind scope_id project_id target_kind target_id target_version target_hash criteria_version criteria_snapshot_json items_json outcome reviewer_user_id client_id reviewer_subject_ref source_kind reason command_id created_at','id'],
 ['0003_document_confirmations.sql','document_confirmations','id project_id document_id version target_hash form_ref review_refs validation_json confirmed_by client_id command_id created_at','id'],
 ['0032_document_source_links.sql','document_source_links','project_id id document_id version source_root_id relative_path source_snapshot_ref blob_hash link_version state current_event_id linked_at updated_at','project_id id'],
 ['0032_document_source_links.sql','document_source_link_events','id project_id link_id link_version content_hash snapshot_json command_id created_at','id'],
 ['0003_documents.sql','form_definitions','id scope owner_user_id project_id form_code name','id'],
 ['0003_documents.sql','form_versions','definition_id version definition_json content_hash authoring_standard_id authoring_standard_version authoring_standard_hash authoring_standard_ref origin_ref_json created_by created_at','definition_id version'],
 ['0003_documents.sql','authoring_standard_versions','id version content_hash created_at','id version'],
 ['0002_methodologies.sql','project_methodologies','id project_id application_version source_definition_id source_version source_hash snapshot_json snapshot_hash created_by created_at','id'],
 ['0002_methodologies.sql','methodology_definitions','id scope owner_user_id project_id system_code','id'],
 ['0002_methodologies.sql','methodology_versions','definition_id version name purpose graph_json content_hash origin_ref_json reason created_by created_at','definition_id version']
] as const;
function definition(file:string,table:string){const sql=readFileSync(new URL('db/migrations/'+file,root),'utf8'),start=sql.indexOf('CREATE TABLE anvil.'+table+' ');const alternate=sql.indexOf('CREATE TABLE anvil.'+table+'(');const from=start>=0?start:alternate;assert(from>=0,`${table} 실 schema 존재`);const end=sql.indexOf('\n);',from);assert(end>from);return sql.slice(from,end);}

test('inventorySchema 실제 migration의 허용열·PK와 후속 검사열을 대조한다',()=>{
 for(const [file,table,fields,key] of mappings){const ddl=definition(file,table);for(const field of fields.split(' '))assert(new RegExp('\\b'+field+'\\s+(?:uuid|text|bigint|jsonb|timestamptz)\\b','i').test(ddl),`${table}.${field} 정의`);
  if(key.includes(' '))assert(new RegExp('PRIMARY KEY\\s*\\(\\s*'+key.split(' ').join('\\s*,\\s*')+'\\s*\\)','i').test(ddl),`${table} 복합PK`);
  else assert(new RegExp('\\b'+key+'\\s+uuid\\s+PRIMARY KEY','i').test(ddl),`${table} UUID PK`);
 }
 const quarantine=readFileSync(new URL('db/migrations/0005_artifact_quarantine.sql',root),'utf8');assert(/ALTER TABLE anvil\.artifacts ADD COLUMN inspection_json jsonb/.test(quarantine));
 const review=readFileSync(new URL('db/migrations/0003_project_document_reviews.sql',root),'utf8');assert(review.includes("NEW.scope_kind<>'PROJECT'"));assert(review.includes("NEW.target_kind<>'DOCUMENT'"));
});

test('inventorySchema collector는 실제 명시 metadata 표를 소비하며 blob reader를 호출하지 않는다',()=>{
 const url=new URL('apps/server/modules/backups/document-inventory.ts',root);assert(existsSync(url),'문서 inventory collector 미구현');const source=readFileSync(url,'utf8');
 for(const table of [...new Set(mappings.map(m=>m[1]))])assert(source.includes(table),`${table} 실제 수집 경로`);
 assert(!/SELECT\s+(?:\w+\.)?\*/i.test(source),'SELECT * 금지');assert(!/\bOFFSET\s+(?:\d|\$)/i.test(source),'OFFSET 이력 절단 금지');
 assert(!/new\s+ArtifactStore|\.readFile\(|readFile\(|new\s+ProjectDocuments|\.imported\(|\.proposal\(/.test(source),'기존 blob 읽기 경로 호출 금지');
 assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(source),'DB metadata 쓰기0');
 assert(!/SELECT[^;`]*\b(?:storage_key|body_utf8|source_approval_json)\b/i.test(source),'보관경로·bytebody 읽기0');
});
