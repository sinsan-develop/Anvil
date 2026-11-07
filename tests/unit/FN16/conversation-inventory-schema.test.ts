import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
// migration 명시열/정렬 경계의 정적 대조이며 실제 PG 실행 증거가 아니다.
const fields={conversations:'id project_id target_role_ref head_sequence created_by last_client_id last_command_id created_at updated_at',conversation_messages:'project_id conversation_id sequence id author_ref kind body_artifact_id source_refs reply_to supersedes_instruction_id effective_scope message_json content_hash redaction_state client_id command_id recorded_at'};
test('conversationSchema 실제 대화열·복합순서PK·원문상태와검사열을 고정한다',()=>{
 const sql=readFileSync(new URL('db/migrations/0005_conversations.sql',root),'utf8');for(const[table,names]of Object.entries(fields)){const from=sql.indexOf('CREATE TABLE anvil.'+table+' ('),end=sql.indexOf('\n);',from);assert(from>=0&&end>from);const ddl=sql.slice(from,end);for(const field of names.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}
 assert(/PRIMARY KEY\(project_id,conversation_id,sequence\)/.test(sql));assert(/UNIQUE\(project_id,conversation_id,id\)/.test(sql));const quarantine=readFileSync(new URL('db/migrations/0005_artifact_quarantine.sql',root),'utf8');assert(quarantine.includes('inspection_json jsonb'));assert(quarantine.includes('QUARANTINED'));
});
test('conversationSchema metadata 3표만·명시SELECT·원문읽기/쓰기/식별자출력경로0',()=>{
 const u=new URL('apps/server/modules/backups/conversation-inventory.ts',root);assert(existsSync(u),'대화 inventory source 미구현');const source=readFileSync(u,'utf8');for(const table of ['conversations','conversation_messages','artifacts'])assert(source.includes(table));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(source));assert(!/\bOFFSET\b/i.test(source));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(source));assert(!/originalText\(|readMessage\(|new\s+ArtifactStore|\.readFile\(|storage_key|body_utf8/.test(source));assert(!/FROM anvil\.(?:knowledge|constitution|commands|audit|authorization)/.test(source));
});
