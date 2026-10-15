import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';

test('명령·정확 승인·별도 감사 저장 기반이 실제 전용 DB에 있고 감사 변경 권한은 없다', async () => {
  if (!process.env.ANVIL_DB_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  try {
    const names = ['permission_policies', 'permission_policy_versions', 'approval_requests', 'approval_decisions', 'approval_consumptions', 'commands', 'authorization_receipts', 'audit_events', 'project_events', 'delivery_outbox', 'draft_audit_events'];
    for (const name of names) assert.equal((await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', ['anvil.' + name])).rows[0].present, true, '승인 명세의 실제 저장 기반 누락: ' + name);
    for (const name of ['audit_events', 'draft_audit_events']) {
      const privilege = (await pool.query("SELECT has_table_privilege(current_user,$1,'INSERT') AS insert,has_table_privilege(current_user,$1,'UPDATE') AS update,has_table_privilege(current_user,$1,'DELETE') AS delete", ['anvil.' + name])).rows[0];
      assert.equal(privilege.insert, true); assert.equal(privilege.update, false); assert.equal(privilege.delete, false);
    }
    const db = await pool.connect();
    const user = randomUUID(), client = randomUUID(), p1 = randomUUID(), p2 = randomUUID();
    const c1 = randomUUID(), c2 = randomUUID(), r1 = randomUUID(), r2 = randomUUID();
    try {
      await db.query('BEGIN');
      await db.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN11 저장 QA','ACTIVE')", [user, 'qa-fn11-' + user]);
      await db.query("INSERT INTO anvil.clients(id,user_id,label) VALUES($1,$2,'FN11 저장 QA')", [client, user]);
      for (const id of [p1, p2]) await db.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'FN11 저장 QA','범위 격리','rollback')", [id]);
      for (const [id, project] of [[c1, p1], [c2, p2]]) await db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,project_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,expected_version,control_generation) VALUES($1,'PROJECT',$2,$2,$3,$4,'QA_SCHEMA',$5,$6,$7,'PERSISTED',0,1)", [id, project, user, client, randomUUID(), '0'.repeat(64), randomUUID()]);
      await db.query('SAVEPOINT invalid_scope');
      await assert.rejects(db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,expected_version,control_generation) VALUES($1,'PROJECT',$2,$3,$4,'QA_SCHEMA',$5,$6,$7,'PERSISTED',0,1)", [randomUUID(), p1, user, client, randomUUID(), '0'.repeat(64), randomUUID()]), (error: unknown) => (error as { code: string }).code === '23514');
      await db.query('ROLLBACK TO SAVEPOINT invalid_scope');
      for (const [id, project, command] of [[r1, p1, c1], [r2, p2, c2]]) await db.query("INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,scope_digest) VALUES($1,'PROJECT',$2,$3,$4,$5)", [id, project, command, JSON.stringify({ kind: 'HUMAN', userId: user }), '0'.repeat(64)]);
      await db.query('UPDATE anvil.commands SET authorization_receipt_id=$2 WHERE id=$1', [c1, r1]);
      await db.query('SET CONSTRAINTS ALL IMMEDIATE');
      await db.query('SAVEPOINT cross_scope');
      await assert.rejects(db.query('UPDATE anvil.commands SET authorization_receipt_id=$2 WHERE id=$1', [c1, r2]), (error: unknown) => (error as { code: string }).code === '23503');
      await db.query('ROLLBACK TO SAVEPOINT cross_scope');
      await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,command_id,target_ref,outcome,reason_code,source_kind) VALUES($1,1,$2,$3,$4,$5,$6,'APPLIED','QA_ONLY','HUMAN')", [p1, randomUUID(), JSON.stringify({ kind: 'HUMAN', userId: user }), client, c1, JSON.stringify({ id: p1 })]);
      for (const query of ['UPDATE anvil.audit_events SET reason_code=reason_code WHERE project_id=$1', 'DELETE FROM anvil.audit_events WHERE project_id=$1']) {
        await db.query('SAVEPOINT immutable_audit');
        await assert.rejects(db.query(query, [p1]), (error: unknown) => (error as { code: string }).code === '42501');
        await db.query('ROLLBACK TO SAVEPOINT immutable_audit');
      }
    } finally { await db.query('ROLLBACK'); db.release(); }
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.projects WHERE id=$1 OR id=$2', [p1, p2])).rows[0].count, 0);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=$1', [user])).rows[0].count, 0);
  } finally { await pool.end(); }
});
