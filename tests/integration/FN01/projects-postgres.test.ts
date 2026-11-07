import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';

test('FN01 원본은 실제 DB에 저장되며 client/초안/프로젝트 제어가 다른 사용자와 섞이지 않는다', async () => {
  if (!process.env.ANVIL_DB_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app');
  const db = new Client(config);
  await db.connect();
  const owner = randomUUID(), other = randomUUID(), client = randomUUID(), project = randomUUID();
  try {
    const identity = (await db.query('SELECT current_database() AS database,current_user AS username,inet_server_port() AS port')).rows[0];
    assert.deepEqual(identity, { database: 'anvil_v3_development', username: 'anvil_v3_app', port: 5432 });
    await db.query('BEGIN');
    for (const id of [owner, other]) await db.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'FN01 합성 QA','ACTIVE')", [id, 'qa-' + id]);
    await db.query("INSERT INTO anvil.clients(id,user_id,label) VALUES($1,$2,'FN01-QA')", [client, owner]);
    await db.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'FN01 합성 QA','사용자 원본 보존','재조회 확인')", [project]);
    await db.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [project, owner]);
    await db.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [project, owner, client]);
    const saved = (await db.query('SELECT name,purpose,desired_outcome FROM anvil.projects WHERE id=$1', [project])).rows[0];
    assert.deepEqual(saved, { name: 'FN01 합성 QA', purpose: '사용자 원본 보존', desired_outcome: '재조회 확인' });
    await db.query('SAVEPOINT reject_cross_user');
    await assert.rejects(db.query('INSERT INTO anvil.project_drafts(id,owner_user_id,client_id,step,input_json) VALUES($1,$2,$3,1,$4)', [randomUUID(), other, client, '{}']), (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && e.code === '23503');
    await db.query('ROLLBACK TO SAVEPOINT reject_cross_user');
    await db.query('SAVEPOINT reject_empty');
    await assert.rejects(db.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,'valid',' ','valid')", [randomUUID()]), (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && e.code === '23514');
    await db.query('ROLLBACK TO SAVEPOINT reject_empty');
  } finally { await db.query('ROLLBACK').catch(() => {}); await db.end(); }
  const check = new Client(config);
  await check.connect();
  try {
    const remaining = (await check.query('SELECT count(*)::int AS count FROM anvil.users WHERE id=ANY($1::uuid[])', [[owner, other]])).rows[0];
    assert.equal(remaining.count, 0);
  } finally { await check.end(); }
});
