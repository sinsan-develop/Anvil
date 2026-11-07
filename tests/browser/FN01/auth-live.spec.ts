import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildApp } from '../../../apps/server/app.ts';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { validateDevelopmentDbConfig } from '../../../apps/server/storage/development-config.ts';

const installationId = randomUUID(), loginName = 'qa-' + randomUUID();
const bootstrap = randomBytes(32).toString('base64url'), password = randomBytes(32).toString('base64url'), authKey = randomBytes(32);
let pool: Pool | undefined, app: ReturnType<typeof buildApp> | undefined, inserted = false;
test.beforeAll(async () => {
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile('D:/Project/Anvil/.av3-data/db-app.json', 'utf8')), 'app');
  pool = new Pool(config);
  expect((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE server_owner')).rows[0].count).toBe(0);
  await pool.query("INSERT INTO anvil.installation_claims(installation_id,bootstrap_digest,expires_at) VALUES($1,$2,now()+interval '30 minutes')", [installationId, createHash('sha256').update(bootstrap).digest('hex')]);
  inserted = true;
  const [key, cert] = await Promise.all([readFile('D:/Project/Anvil/.av3-data/dev-tls/server.key.pem'), readFile('D:/Project/Anvil/.av3-data/dev-tls/server.cert.pem')]);
  app = buildApp({ https: { key, cert } }, new URL('../../../apps/web/dist/', import.meta.url), { repository: new AccessRepository(pool, { installationId, key: authKey }), origin: 'https://localhost:3830' });
  await app.listen({ host: '127.0.0.1', port: 3830 });
});
test.afterAll(async () => {
  await app?.close();
  if (pool && inserted) {
    const owner = (await pool.query('SELECT id FROM anvil.users WHERE normalized_login_name=$1', [loginName])).rows[0]?.id;
    if (owner) {
      await pool.query('DELETE FROM anvil.auth_sessions WHERE user_id=$1', [owner]);
      await pool.query('DELETE FROM anvil.clients WHERE user_id=$1', [owner]);
      await pool.query('DELETE FROM anvil.recovery_credentials WHERE user_id=$1', [owner]);
      await pool.query('DELETE FROM anvil.password_credentials WHERE user_id=$1', [owner]);
    }
    await pool.query('DELETE FROM anvil.auth_actions WHERE actor_scope=$1', [installationId]);
    await pool.query('DELETE FROM anvil.installation_claims WHERE installation_id=$1', [installationId]);
    if (owner) await pool.query('DELETE FROM anvil.users WHERE id=$1', [owner]);
    for (const [kind, value] of [['ACCOUNT', loginName], ['SOURCE', '127.0.0.1']]) {
      const bucket = createHmac('sha256', authKey).update(kind + ':' + value).digest('hex');
      await pool.query('DELETE FROM anvil.auth_attempt_windows WHERE bucket_kind=$1 AND bucket_key=$2', [kind, bucket]);
    }
    expect((await pool.query('SELECT count(*)::int AS count FROM anvil.users WHERE normalized_login_name=$1', [loginName])).rows[0].count).toBe(0);
    expect((await pool.query('SELECT count(*)::int AS count FROM anvil.installation_claims WHERE installation_id=$1', [installationId])).rows[0].count).toBe(0);
    console.log('FN01_ACTUAL_QA_ACTIVE_RESIDUE_0_SAFE_AUDIT_RETAINED');
  }
  await pool?.end();
});

test('실제 HTTPS·DB·화면에서 초기 등록→복구 보관 확인→로그인→로그아웃까지 연결된다', async ({ page, context, baseURL }) => {
  const urls: string[] = [], errors: string[] = [];
  page.on('request', request => urls.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anvil 초기 소유자 등록' })).toBeVisible();
  await page.getByLabel('초기 등록 비밀').fill(bootstrap);
  await page.getByLabel('사용자명', { exact: true }).fill(loginName);
  await page.getByLabel('표시 이름').fill('FN01 실제 QA');
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '초기 소유자 등록', exact: true }).click();
  await expect(page.getByLabel('복구 비밀', { exact: true })).toHaveAttribute('type', 'password');
  expect(await page.getByLabel('복구 비밀', { exact: true }).evaluate(element => (element as HTMLInputElement).value.length === 43)).toBe(true);
  await page.getByLabel('복구 비밀을 안전한 곳에 보관했습니다').check();
  await page.getByRole('button', { name: '로그인으로 이동' }).click();
  await page.getByLabel('비밀번호', { exact: true }).fill(password);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('FN01 실제 QA', { exact: true })).toBeVisible();
  const cookies = (await context.cookies()).filter(cookie => cookie.name === '__Host-anvil.sid').map(cookie => ({ secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite }));
  expect(cookies).toEqual([{ secure: true, httpOnly: true, sameSite: 'Lax' }]);
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === '__Host-anvil.sid')).toBe(false);
  expect(urls.filter(url => new URL(url).origin !== new URL(baseURL!).origin)).toEqual([]);
  expect(urls.filter(url => url.includes('/commands'))).toEqual([]);
  expect(errors).toEqual([]);
  console.log('FN01_ACTUAL_HTTPS_DB_BROWSER networkSameOrigin=true pageErrors=0 tlsIgnore=false agentCalls=0');
});
