import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
test('0061은 HUMAN 두 guard만 교체하고 원 guard·downstream 및 양방향 증빙을 보존한다',()=>{
 const s=readFileSync('db/migrations/0061_child_assignment_content.sql.pending','utf8');
 assert.equal((s.match(/DROP TRIGGER/g)||[]).length,2);
 assert(!/CREATE OR REPLACE FUNCTION anvil\.(guard_assignment_content|guard_child_assignment_draft_only|assignment_root_reference)/.test(s));
 for(const token of ['assignment_parent_current','guard_child_human_content','child_human_complete','DEFERRABLE INITIALLY DEFERRED','authorization_receipts','audit_events','request_hash','scope_digest','client_ref IS DISTINCT FROM c.client_id','clock_timestamp()'])assert(s.includes(token),token);
 assert(!/GRANT|CREATE TABLE|ALTER TABLE/.test(s));
 for(const table of ['commands','authorization_receipts','audit_events','assignment_content_reviews','assignment_versions'])assert(s.includes('ON anvil.'+table),table);
});

test('실제 원행 분류가 operation/result JSON보다 선행하고 child half-command를 닫는다',()=>{
 const s=readFileSync('db/migrations/0061_child_assignment_content.sql.pending','utf8');
 const start=s.indexOf('CREATE FUNCTION anvil.child_human_complete'),end=s.indexOf('CREATE FUNCTION anvil.guard_child_human_complete'),body=s.slice(start,end);
 assert(body.indexOf('INTO reviews_count')<body.indexOf('c.operation IS DISTINCT FROM expected_op'));
 assert(body.indexOf('INTO versions_count')<body.indexOf('c.operation IS DISTINCT FROM expected_op'));
 assert(body.includes("c.state IS DISTINCT FROM 'APPLIED'"));assert(body.includes('reviews_count+versions_count<>1'));
 assert(!/draft_id::text=s->'draftRef'/.test(body));
 const trigger=s.slice(end);assert(!trigger.includes("c.operation NOT IN('reviewAssignmentContent','confirmAssignment') THEN RETURN NULL"));
 assert(trigger.includes("anvil.child_human_complete(pid,cid) IS NOT TRUE"));
});

test('분류 분기표는 DRAFT null project/무관 PROJECT와 child·half·삭제를 구분한다 (SQL 실행 아님)',()=>{
 const s=readFileSync('db/migrations/0061_child_assignment_content.sql.pending','utf8');const body=s.slice(s.indexOf('CREATE FUNCTION anvil.child_human_complete'),s.indexOf('CREATE FUNCTION anvil.guard_child_human_complete'));
 assert(body.includes('FROM anvil.commands WHERE id=cid'));assert(body.includes('INTO reviews_count FROM anvil.assignment_content_reviews WHERE command_id=cid'));assert(body.includes('INTO versions_count FROM anvil.assignment_versions WHERE command_id=cid'));
 assert(body.includes("RETURN c.operation NOT IN('reviewAssignmentContent','confirmAssignment')"));
 // source의 좁은 분류표를 메모리로 대조한다. PostgreSQL의 문법/trigger 실행 증거가 아니다.
 const classify=(c:any,rows:any[])=>{if(!c)return false;if(rows.length===0)return !['reviewAssignmentContent','confirmAssignment'].includes(c.operation);if(rows.length!==1)return false;const row=rows[0];if(row.projectId!==c.projectId)return false;if(!row.child)return true;return c.scope==='PROJECT'&&c.operation===row.operation&&c.state==='APPLIED';};
 const child={projectId:'p',child:true,operation:'reviewAssignmentContent'},command={projectId:'p',scope:'PROJECT',operation:'reviewAssignmentContent',state:'APPLIED'};
 for(const [name,c,rows,expected]of [
 ['child',command,[child],true],['operation',{...command,operation:'other'},[child],false],['half',command,[],false],['root',command,[{...child,child:false}],true],['otherProject',{...command,operation:'other'},[],true],['draft',{projectId:null,scope:'DRAFT',operation:'uploadDraftArtifact',state:'APPLIED'},[],true],['deleted',null,[child],false],['scope',{...command,projectId:null,scope:'DRAFT'},[child],false]
 ] as const)assert.equal(classify(c,[...rows]),expected,name);
});
