import { expect, test } from '@playwright/test';

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
