import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url),read=(file:string)=>readFileSync(new URL('db/migrations/'+file,root),'utf8');
const maps=[
 ['0050_design_baseline_activations.sql.pending','baseline_activations','project_id id generation content_hash snapshot_json previous_activation_id command_id approval_consumption_id created_by client_id created_at',11],
 ['0050_design_baseline_activations.sql.pending','baseline_activation_current','project_id activation_id activation_ref',3],
 ['0050_design_baseline_activations.sql.pending','baseline_activation_rechecks','project_id activation_id plan_id plan_version plan_hash task_code impact_ref',7],
 ['0011_authorization.sql','commands','id command_id project_id state operation actor_id client_id control_generation expected_version policy_ref result_ref authorization_receipt_id approval_consumption_id',13]
]as const;
test('baselineSchema pending 명시11·3·7열과 서버/요청명령13열',()=>{
 for(const[file,table,fields,count]of maps){const sql=read(file),start=sql.indexOf('CREATE TABLE anvil.'+table),end=sql.indexOf('\n);',start);assert(start>=0&&end>start);const ddl=sql.slice(start,end);assert.equal(fields.split(' ').length,count);for(const field of fields.split(' '))assert(new RegExp(String.raw`\b${field}\s+(uuid|text|bigint|jsonb|timestamptz)\b`).test(ddl),table+'.'+field);}
 const ddl=read('0050_design_baseline_activations.sql.pending');for(const text of ['UNIQUE(project_id,generation)','command_id uuid NOT NULL UNIQUE','approval_consumption_id uuid NOT NULL UNIQUE','PRIMARY KEY(project_id,activation_id,plan_id,plan_version,task_code)','CHECK((generation=1)=(previous_activation_id IS NULL))'])assert(ddl.includes(text));
});
test('baselineSchema 내부읽기·외부승인/전체coverage/실행 재판정0',()=>{
 const u=new URL('apps/server/modules/backups/baseline-inventory.ts',root);assert(existsSync(u),'활성 기준 inventory 미구현');const s=readFileSync(u,'utf8');for(const[,table]of maps)assert(s.includes(table));assert(s.includes('readBaselineActivationRecord'));assert(!/SELECT\s+(?:\w+\.)?\*/i.test(s));assert(!/\bOFFSET\s+(?:\d|\$)/i.test(s));assert(!/fn04_activation_history_valid\s*\(|readStoredDesignActivationRelations\s*\(|new\s+ProjectBaselineActivations|readFile\(|storage_key|body_utf8/.test(s));assert(!/\b(?:INSERT\s+INTO|UPDATE\s+anvil\.|DELETE\s+FROM|CREATE\s+TABLE)/i.test(s));assert(!/FROM anvil\.(?:approval_requests|approval_decisions|approval_consumptions|authorization_receipts|audit_events|design_activation_approval_candidates|design_change_impacts|permission_policies|artifacts)/.test(s));assert(s.includes('COLLATE'));assert(s.includes('NOT_PERFORMED'));
});
