import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
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
  } finally { await pool.end(); }
});
