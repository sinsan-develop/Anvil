import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Client } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';

test('전용 app 역할로 합성 자료를 저장·새 연결 재조회·정확 삭제한다', async () => {
  assert.ok(process.env.ANVIL_DB_CONFIG, '보호된 전용 app DB 참조 필요');
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app');
  assert.equal(config.database, 'anvil_v3_development');
  assert.equal(config.user, 'anvil_v3_app');
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 5546);
  const first = new Client(config);
  const second = new Client(config);
  const key = 'p03-probe-' + randomUUID();
  let connected = false;
  try {
    await first.connect(); connected = true; await second.connect();
    assert.deepEqual((await first.query('SELECT current_database() AS database,current_user AS username,inet_server_port() AS port')).rows,
      [{ database: 'anvil_v3_development', username: 'anvil_v3_app', port: 5432 }]);
    const roles = await first.query('SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');
    assert.deepEqual(roles.rows, [{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }]);
    await first.query('INSERT INTO anvil_qa.fixtures(name,payload) VALUES($1,$2)', [key, '{"purpose":"저장 후 재조회"}']);
    assert.deepEqual((await second.query('SELECT payload FROM anvil_qa.fixtures WHERE name=$1', [key])).rows, [{ payload: { purpose: '저장 후 재조회' } }]);
    assert.equal((await first.query("SELECT count(*)::int AS count FROM anvil_qa.fixtures WHERE name IN ('project-a','project-b')")).rows[0].count, 2);
    await assert.rejects(first.query('CREATE TABLE anvil.forbidden_probe(id int)'), (error: { code?: string }) => error.code === '42501');
  } finally {
    try {
      if (connected) {
        await first.query('DELETE FROM anvil_qa.fixtures WHERE name=$1', [key]);
        assert.equal((await first.query('SELECT count(*)::int AS count FROM anvil_qa.fixtures WHERE name=$1', [key])).rows[0].count, 0);
      }
    } finally { await Promise.allSettled([first.end(), second.end()]); }
  }
});
