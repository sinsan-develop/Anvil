import { expect, test } from '@playwright/test';

const unexpected = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => { unexpected.set(page, []); await page.route('**/api/v1/**', route => { unexpected.get(page)!.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); }); });
test.afterEach(async ({ page }) => { expect(unexpected.get(page)).toEqual([]); });

const csrfBefore = 'A'.repeat(43), csrfAfter = 'B'.repeat(43);
const user = { id: '32b5f276-13e6-4d8a-b93f-27a15d21c788', displayName: 'QA 사용자' };
const initial = { user, clientId: user.id, csrfToken: csrfBefore };
test('인증 화면 계약: 재인증에서 받은 새 CSRF로만 비밀번호를 변경하고 다시 로그인한다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: initial }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  let reauthCalls = 0, passwordCalls = 0;
  await page.route('**/api/v1/auth/reauthenticate', route => {
    reauthCalls++;
    expect(route.request().headers()['x-anvil-csrf']).toBe(csrfBefore);
    return route.fulfill({ json: { ...initial, csrfToken: csrfAfter, reauthUntil: new Date(Date.now() + 300000).toISOString() } });
  });
  await page.route('**/api/v1/auth/password', route => {
    passwordCalls++;
    expect(route.request().headers()['x-anvil-csrf']).toBe(csrfAfter);
    expect(route.request().postDataJSON().currentPassword).toBe('synthetic current passphrase');
    expect(route.request().postDataJSON().newPassword).toBe('synthetic new passphrase');
    expect(route.request().postDataJSON().commandId).toMatch(/^[0-9a-f-]{36}$/);
    return route.fulfill({ status: 204 });
  });
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '로그인 보안' })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('재인증 비밀번호', { exact: true }).fill('synthetic current passphrase');
  await page.getByRole('button', { name: '재인증', exact: true }).click();
  await expect(page.getByLabel('재인증 비밀번호', { exact: true })).toHaveValue('');
  await page.getByLabel('현재 비밀번호', { exact: true }).fill('synthetic current passphrase');
  await page.getByLabel('새 비밀번호', { exact: true }).fill('synthetic new passphrase');
  await page.getByRole('button', { name: '비밀번호 변경', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible();
  expect(reauthCalls).toBe(1); expect(passwordCalls).toBe(1);
});

test('인증 화면 계약: 일회 복구 성공 뒤 자동 로그인 없이 입력 비밀을 회수한다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  let calls = 0;
  await page.route('**/api/v1/auth/recovery', route => {
    calls++;
    expect(route.request().postDataJSON().loginName).toBe('qa-user');
    expect(route.request().postDataJSON().recoverySecret).toBe('R'.repeat(43));
    expect(route.request().headers()['x-anvil-csrf']).toBeUndefined();
    return route.fulfill({ status: 204 });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '비밀번호 복구', exact: true }).click({ timeout: 1000 });
  await page.getByLabel('사용자명', { exact: true }).fill('qa-user');
  await page.getByLabel('일회 복구 비밀', { exact: true }).fill('R'.repeat(43));
  await page.getByLabel('새 비밀번호', { exact: true }).fill('synthetic restored passphrase');
  await page.getByRole('button', { name: '복구 후 비밀번호 변경', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible();
  await expect(page.getByLabel('사용자명', { exact: true })).toHaveValue('qa-user');
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('');
  await expect(page.getByText('비밀번호를 변경했습니다. 다시 로그인하세요.', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
});

test('인증 화면 계약: 재발급은 회수 동의·재인증 후 한 번만 요청하고 새 비밀을 기본 가림한다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ json: initial }));
  await page.route('**/api/v1/auth/reauthenticate', route => route.fulfill({ json: { ...initial, csrfToken: csrfAfter, reauthUntil: new Date(Date.now() + 300000).toISOString() } }));
  let rotateCalls = 0;
  await page.route('**/api/v1/auth/recovery/rotate', route => {
    rotateCalls++;
    expect(route.request().headers()['x-anvil-csrf']).toBe(csrfAfter);
    return route.fulfill({ json: { recoverySecret: 'R'.repeat(43) } });
  });
  await page.goto('/#/settings');
  await page.getByText('일회 복구 비밀 재발급', { exact: true }).click();
  const button = page.getByRole('button', { name: '새 복구 비밀 발급', exact: true });
  await expect(button).toBeDisabled();
  await page.getByLabel('재인증 비밀번호', { exact: true }).fill('synthetic current passphrase');
  await page.getByRole('button', { name: '재인증', exact: true }).click();
  await expect(button).toBeDisabled();
  await page.getByLabel('기존 복구 비밀 회수에 동의합니다').check();
  await button.click();
  await expect(page.getByLabel('새 일회 복구 비밀', { exact: true })).toHaveAttribute('type', 'password');
  await expect(button).toBeDisabled();
  await page.getByLabel('새 복구 비밀을 안전한 곳에 보관했습니다').check();
  expect(rotateCalls).toBe(1);
});

test('인증 화면 계약: 초대를 수락해도 자동 로그인하지 않고 복구 비밀 보관을 요구한다', async ({ page }) => {
  await page.route('**/api/v1/session', route => route.fulfill({ status: 401, json: { code: 'AUTH_REQUIRED' } }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ json: { setupRequired: false, policyVersion: 1 } }));
  let calls = 0;
  await page.route('**/api/v1/auth/invitations/accept', route => {
    calls++;
    expect(route.request().postDataJSON().invitationSecret).toBe('I'.repeat(43));
    expect(route.request().headers()['x-anvil-csrf']).toBeUndefined();
    return route.fulfill({ status: 201, json: { user: { ...user, serverOwner: false }, recoverySecret: 'R'.repeat(43) } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '초대 수락', exact: true }).click({ timeout: 1000 });
  await page.getByRole('button', { name: '로그인으로 돌아가기', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible({ timeout: 1000 });
  await page.getByRole('button', { name: '초대 수락', exact: true }).click();
  await page.getByLabel('사용자명', { exact: true }).fill('qa-invited');
  await page.getByLabel('초대 ID', { exact: true }).fill(user.id);
  await page.getByLabel('초대 비밀', { exact: true }).fill('I'.repeat(43));
  await page.getByLabel('새 비밀번호', { exact: true }).fill('synthetic invited passphrase');
  await page.getByRole('button', { name: '초대 수락 후 계정 등록', exact: true }).click();
  await expect(page.getByLabel('복구 비밀', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: '로그인으로 이동' })).toBeDisabled();
  await page.getByLabel('복구 비밀을 안전한 곳에 보관했습니다').check();
  await page.getByRole('button', { name: '로그인으로 이동' }).click();
  await expect(page.getByRole('heading', { name: 'Anvil 로그인' })).toBeVisible();
  expect(calls).toBe(1);
});
