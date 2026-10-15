import { expect, test } from '@playwright/test';

test('초기 등록의 화면 계약 fixture: 복구 비밀 보관 확인 뒤 로그인으로 이동하며 자동 로그인하지 않는다', async ({ page }) => {
  const failure = { code: 'AUTH_REQUIRED', message: '인증 필요', requestId: 'qa-auth', targetId: null, retryDisposition: 'not-retryable', details: {} };
  await page.route('**/api/v1/session', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(failure) }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ setupRequired: true, policyVersion: 1 }) }));
  let loginCalls = 0;
  await page.route('**/api/v1/auth/login', route => { loginCalls++; return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(failure) }); });
  await page.route('**/api/v1/auth/setup/claim', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: '32b5f276-13e6-4d8a-b93f-27a15d21c788', displayName: 'QA 소유자', serverOwner: true }, recoverySecret: 'Q'.repeat(43) }) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anvil 초기 소유자 등록' })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('초기 등록 비밀').fill('B'.repeat(43));
  await page.getByLabel('사용자명', { exact: true }).fill('qa-owner');
  await page.getByLabel('표시 이름').fill('QA 소유자');
  await page.getByLabel('비밀번호', { exact: true }).fill('synthetic passphrase only');
  await page.getByRole('button', { name: '초기 소유자 등록', exact: true }).click();
  await expect(page.getByLabel('복구 비밀', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByRole('button', { name: '로그인으로 이동' })).toBeDisabled();
  await page.getByLabel('복구 비밀을 안전한 곳에 보관했습니다').check();
  await page.getByRole('button', { name: '로그인으로 이동' }).click();
  await expect(page.getByLabel('사용자명', { exact: true })).toHaveValue('qa-owner');
  await expect(page.getByLabel('복구 비밀', { exact: true })).toHaveCount(0);
  expect(loginCalls).toBe(0);
});

test('로그인 만료의 화면 계약 fixture: 실패해도 사용자명은 보존하고 비밀번호는 화면에서 회수한다', async ({ page }) => {
  const failure = { code: 'AUTH_REQUIRED', message: '인증 필요', requestId: 'qa-auth', targetId: null, retryDisposition: 'not-retryable', details: {} };
  await page.route('**/api/v1/session', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(failure) }));
  await page.route('**/api/v1/auth/setup', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ setupRequired: false, policyVersion: 1 }) }));
  await page.route('**/api/v1/auth/login', route => {
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(failure) });
  });
  await page.goto('/');
  await expect(page.getByLabel('사용자명', { exact: true })).toBeVisible({ timeout: 1000 });
  await page.getByLabel('사용자명', { exact: true }).fill('qa-owner');
  await page.getByLabel('비밀번호', { exact: true }).fill('synthetic passphrase only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByLabel('사용자명', { exact: true })).toHaveValue('qa-owner');
  await expect(page.getByLabel('비밀번호', { exact: true })).toHaveValue('');
  await expect(page.getByRole('alert').last()).toContainText('로그인');
});

test('본문 바로가기는 화면 경로를 바꾸지 않고 키보드 초점만 이동한다', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '본문으로 이동' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('heading', { name: '프로젝트', exact: true })).toBeVisible();
  expect(new URL(page.url()).hash).not.toBe('#main-content');
});

test('첫 화면은 프로젝트이며 실패한 세션 조회를 빈 목록이나 로그인 성공으로 표시하지 않는다', async ({ page, baseURL }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', r => requests.push(r.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '프로젝트', exact: true })).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('alert')).toContainText('찾을 수 없습니다', { timeout: 1000 });
  await expect(page.getByText('접근 확인 전')).toBeVisible();
  await expect(page.getByText('프로젝트가 없습니다', { exact: true })).toHaveCount(0);
  expect(requests.filter(url => new URL(url).origin !== new URL(baseURL!).origin)).toEqual([]);
  expect(errors).toEqual([]);
});

test('보조 Dashboard가 아닌 공통 탐색을 키보드로 열고 뒤로/새로고침해도 경로가 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: '탐색 메뉴' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: '방법론', exact: true }).click();
  await expect(page).toHaveURL(/#\/methodologies$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: '방법론', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '프로젝트', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
