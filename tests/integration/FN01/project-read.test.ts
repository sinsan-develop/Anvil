import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { hashPassword } from '../../../apps/server/modules/access/service.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('프로젝트 목록·직접ID는 현재 참여 범위를 집행하며 microsecond cursor와 재조회에서 손실/노출이 없다', async () => {
  if (!process.env.ANVIL_DB_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const pool = new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app'));
  const users = [randomUUID(), randomUUID()], projects = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const key = randomBytes(32), password = randomBytes(32).toString('base64url');
  const access = new AccessRepository(pool, { installationId: randomUUID(), key });
  const app = buildApp({}, undefined, { repository: access, origin: 'https://localhost:3830' });
  const headers = { host: 'localhost:3830' };
  try {
    const phc = await hashPassword(password);
    for (const id of users) {
      await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES($1,$2,$2,'프로젝트 조회 QA','ACTIVE')", [id, 'qa-read-' + id]);
      await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation) VALUES($1,$2,1)', [id, phc]);
    }
    for (const [index, id] of projects.entries()) {
      await pool.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome,updated_at,archived_at) VALUES($1,$2,'원본 유지','조회 검수',$3,$4)", [id, 'QA project ' + index, '2026-10-16T01:02:03.45678' + index + 'Z', index === 3 ? new Date() : null]);
      await pool.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [id, index === 2 ? users[1] : users[0]]);
    }
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/projects', headers })).statusCode, 401);
    const login = await access.login('qa-read-' + users[0], password, 'FN01 read QA', 'qa-read-' + users[0]);
    const other = await access.login('qa-read-' + users[1], password, 'FN01 read QA', 'qa-read-' + users[1]);
    const ownHeaders = { ...headers, cookie: '__Host-anvil.sid=' + login.token };
    const first = await app.inject({ method: 'GET', url: '/api/v1/projects?limit=1', headers: ownHeaders });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().items.length, 1); assert.equal(first.json().hasMore, true);
    const cursor = first.json().nextCursor;
    const second = await app.inject({ method: 'GET', url: '/api/v1/projects?limit=1&cursor=' + encodeURIComponent(cursor), headers: ownHeaders });
    assert.equal(second.statusCode, 200);
    assert.equal(second.json().hasMore, false);
    assert.deepEqual(new Set([...first.json().items, ...second.json().items].map((item: { id: string }) => item.id)), new Set(projects.slice(0, 2)));
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/projects?limit=1&cursor=' + encodeURIComponent(cursor), headers: { ...headers, cookie: '__Host-anvil.sid=' + other.token } })).statusCode, 400);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/projects/' + projects[2], headers: ownHeaders })).statusCode, 404);
    const visible = await app.inject({ method: 'GET', url: '/api/v1/projects/' + projects[0], headers: ownHeaders });
    assert.equal(visible.statusCode, 200); assert.equal(visible.json().purpose, '원본 유지');
    const archived = await app.inject({ method: 'GET', url: '/api/v1/projects?archived=true', headers: ownHeaders });
    assert.deepEqual(archived.json().items.map((item: { id: string }) => item.id), [projects[3]]);
    await pool.query('UPDATE anvil.project_members SET revoked_at=now() WHERE project_id=$1 AND user_id=$2', [projects[0], users[0]]);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/projects/' + projects[0], headers: ownHeaders })).statusCode, 404);
    await access.logout(login.token, login.csrfToken);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/projects', headers: ownHeaders })).statusCode, 401);
  } finally {
    for (const project of projects) { await pool.query('DELETE FROM anvil.project_members WHERE project_id=$1', [project]); await pool.query('DELETE FROM anvil.projects WHERE id=$1', [project]); }
    for (const user of users) {
      await pool.query('DELETE FROM anvil.auth_sessions WHERE user_id=$1', [user]); await pool.query('DELETE FROM anvil.clients WHERE user_id=$1', [user]);
      await pool.query('DELETE FROM anvil.password_credentials WHERE user_id=$1', [user]); await pool.query('DELETE FROM anvil.users WHERE id=$1', [user]);
    }
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.projects WHERE id=ANY($1::uuid[])', [projects])).rows[0].count, 0);
    await app.close(); await pool.end();
  }
});
