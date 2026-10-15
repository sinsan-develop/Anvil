import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';

test('실제 DB에서 초기 소유자 한 번 등록→로그인→session 조회→로그아웃 회수, 비밀은 저장/감사 원문에 남기지 않는다', async () => {
  if (!process.env.ANVIL_DB_CONFIG) throw Error('ACTUAL_PROTECTED_DB_REQUIRED_NOT_SKIP');
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG, 'utf8')), 'app');
  const pool = new Pool(config);
  const installationId = randomUUID(), commandId = randomUUID();
  const bootstrap = randomBytes(32).toString('base64url'), password = randomBytes(32).toString('base64url');
  const loginName = 'qa-' + randomUUID(), unknownName = 'qa-unknown-' + randomUUID(), key = randomBytes(32);
  const repository = new AccessRepository(pool, { installationId, key });
  const app = Reflect.apply(buildApp, undefined, [{}, undefined, { repository, origin: 'https://localhost:3830' }]) as ReturnType<typeof buildApp>;
  let ownerId: string | undefined;
  try {
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE server_owner')).rows[0].count, 0, '초기화 시험은 실제 소유자가 없는 새 개발 DB에서만 수행');
    await pool.query('INSERT INTO anvil.installation_claims(installation_id,bootstrap_digest,expires_at) VALUES($1,$2,now()+interval \'30 minutes\')', [installationId, createHash('sha256').update(bootstrap).digest('hex')]);
    assert.equal((await repository.setup()).setupRequired, true);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'localhost:3830' } })).statusCode, 401);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { host: 'localhost:3830', origin: 'https://other.invalid' }, payload: { loginName, password, clientLabel: 'FN01-QA' } })).statusCode, 403);
    const claimInput = { bootstrapSecret: bootstrap, loginName, displayName: 'FN01 합성 QA', password, commandId };
    const competing = await Promise.all([repository.claimOwner(claimInput), repository.claimOwner(claimInput)]);
    assert.equal(competing[0]!.user.id, competing[1]!.user.id);
    assert.equal(competing.filter(value => value.recoverySecret !== null).length, 1);
    const claim = competing.find(value => value.recoverySecret !== null)!;
    ownerId = claim.user.id;
    assert(claim.recoverySecret && claim.recoverySecret !== bootstrap);
    assert.equal((await repository.setup()).setupRequired, false);
    const replay = await repository.claimOwner({ bootstrapSecret: bootstrap, loginName, displayName: 'FN01 합성 QA', password, commandId });
    assert.equal(replay.user.id, ownerId);
    assert.equal(replay.recoverySecret, null);
    await assert.rejects(repository.claimOwner({ bootstrapSecret: bootstrap, loginName, displayName: '다른 요청', password, commandId }), (e: unknown) => e instanceof Error && e.message === 'IDEMPOTENCY_CONFLICT');
    await assert.rejects(repository.login(loginName, password + 'wrong', 'FN01-QA', 'qa-source'), (e: unknown) => e instanceof Error && e.message === 'AUTH_REQUIRED');
    const login = await repository.login(loginName.toUpperCase(), password, 'FN01-QA', 'qa-source');
    assert.equal(login.user.id, ownerId);
    assert(login.token !== login.csrfToken);
    const session = await repository.session(login.token);
    assert.equal(session.user.id, ownerId);
    assert.equal(session.clientId, login.clientId);
    assert.equal(session.csrfToken, login.csrfToken);
    const stored = JSON.stringify((await pool.query('SELECT token_digest,csrf_digest FROM anvil.auth_sessions WHERE user_id=$1', [ownerId])).rows);
    assert(!stored.includes(login.token));
    assert(!stored.includes(login.csrfToken));
    const audit = JSON.stringify((await pool.query('SELECT * FROM anvil.auth_audit_events WHERE subject_ref=$1', [ownerId])).rows);
    assert(!audit.includes(password) && !audit.includes(bootstrap) && !audit.includes(claim.recoverySecret!));
    await repository.logout(login.token, login.csrfToken);
    await assert.rejects(repository.session(login.token), (e: unknown) => e instanceof Error && e.message === 'AUTH_REQUIRED');
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { host: 'localhost:3830', origin: 'https://localhost:3830' }, payload: { loginName, password, clientLabel: 'FN01-QA' } });
    assert.equal(response.statusCode, 200);
    assert(!('token' in response.json()));
    const setCookie = String(response.headers['set-cookie']);
    assert.match(setCookie, /__Host-anvil\.sid=/);
    assert.match(setCookie, /Secure/); assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Lax/);
    assert(!setCookie.includes('Domain='));
    const cookie = setCookie.split(';')[0]!;
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'localhost:3830', cookie } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { host: 'localhost:3830', origin: 'https://localhost:3830', cookie }, payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { host: 'localhost:3830', origin: 'https://localhost:3830', cookie, 'x-anvil-csrf': response.json().csrfToken }, payload: {} })).statusCode, 204);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'localhost:3830', cookie } })).statusCode, 401);
    const fresh = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { host: 'localhost:3830', origin: 'https://localhost:3830' }, payload: { loginName, password, clientLabel: 'FN01-QA-reauth' } });
    assert.equal(fresh.statusCode, 200);
    const beforeCookie = String(fresh.headers['set-cookie']).split(';')[0]!;
    const nextPassword = randomBytes(32).toString('base64url');
    const passwordBody = { currentPassword: password, newPassword: nextPassword, commandId: randomUUID() };
    const beforeHeaders = { host: 'localhost:3830', origin: 'https://localhost:3830', cookie: beforeCookie, 'x-anvil-csrf': fresh.json().csrfToken };
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/password', headers: beforeHeaders, payload: passwordBody })).statusCode, 412, '최근 재인증 없는 비밀번호 변경 차단');
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/reauthenticate', headers: beforeHeaders, payload: { password: password + 'wrong' } })).statusCode, 401);
    const reauth = await app.inject({ method: 'POST', url: '/api/v1/auth/reauthenticate', headers: beforeHeaders, payload: { password } });
    assert.equal(reauth.statusCode, 200);
    const afterCookie = String(reauth.headers['set-cookie']).split(';')[0]!;
    assert.notEqual(afterCookie, beforeCookie);
    assert.notEqual(reauth.json().csrfToken, fresh.json().csrfToken);
    assert.equal(reauth.json().clientId, fresh.json().clientId);
    assert.equal(reauth.json().absoluteExpiresAt, fresh.json().absoluteExpiresAt);
    assert(Date.parse(reauth.json().reauthUntil) > Date.now());
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'localhost:3830', cookie: beforeCookie } })).statusCode, 401);
    const afterHeaders = { ...beforeHeaders, cookie: afterCookie, 'x-anvil-csrf': reauth.json().csrfToken };
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/auth/password', headers: afterHeaders, payload: passwordBody })).statusCode, 204);
    assert.equal((await app.inject({ method: 'GET', url: '/api/v1/session', headers: { host: 'localhost:3830', cookie: afterCookie } })).statusCode, 401);
    await assert.rejects(repository.login(loginName, password, 'FN01-QA-old-password', 'qa-source'), (e: unknown) => e instanceof Error && e.message === 'AUTH_REQUIRED');
    const actions = JSON.stringify((await pool.query('SELECT * FROM anvil.auth_actions WHERE actor_scope=$1', [ownerId])).rows);
    assert(!actions.includes(password) && !actions.includes(nextPassword));
    const generationLogin = await repository.login(loginName, nextPassword, 'FN01-QA-generation', 'qa-source');
    await pool.query('UPDATE anvil.users SET credential_generation=credential_generation+1 WHERE id=$1', [ownerId]);
    await assert.rejects(repository.session(generationLogin.token), (e: unknown) => e instanceof Error && e.message === 'AUTH_REQUIRED');
    // 옛 generation은 복구하지 않는다. 임시 QA 사용자 전체를 아래에서 회수한다.
    for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(repository.login(unknownName, password, 'FN01-QA-rate', 'qa-rate-source'), (e: unknown) => e instanceof Error && e.message === 'AUTH_REQUIRED');
    await assert.rejects(repository.login(unknownName, password, 'FN01-QA-rate', 'qa-rate-source'), (e: unknown) => e instanceof Error && e.message === 'AUTH_RATE_LIMITED');
  } finally {
    // 본문/비밀은 회수하며 비밀 없는 append-only 감사는 과거 검수 사실로 보존한다.
    if (ownerId) {
      await pool.query('DELETE FROM anvil.auth_sessions WHERE user_id=$1', [ownerId]);
      await pool.query('DELETE FROM anvil.clients WHERE user_id=$1', [ownerId]);
      await pool.query('DELETE FROM anvil.recovery_credentials WHERE user_id=$1', [ownerId]);
      await pool.query('DELETE FROM anvil.password_credentials WHERE user_id=$1', [ownerId]);
    }
    await pool.query('DELETE FROM anvil.auth_actions WHERE actor_scope=$1 OR actor_scope=$2', [installationId, ownerId ?? installationId]);
    await pool.query('DELETE FROM anvil.installation_claims WHERE installation_id=$1', [installationId]);
    if (ownerId) await pool.query('DELETE FROM anvil.users WHERE id=$1', [ownerId]);
    for (const [kind, value] of [['ACCOUNT', loginName], ['ACCOUNT', unknownName], ['SOURCE', 'qa-source'], ['SOURCE', 'qa-rate-source'], ['SOURCE', '127.0.0.1']]) {
      const bucket = createHmac('sha256', key).update(kind + ':' + value).digest('hex');
      await pool.query('DELETE FROM anvil.auth_attempt_windows WHERE bucket_kind=$1 AND bucket_key=$2', [kind, bucket]);
    }
    await app.close();
    await pool.end();
  }
});
