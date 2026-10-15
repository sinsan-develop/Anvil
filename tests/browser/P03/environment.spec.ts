import { expect, test } from '@playwright/test';

test('신뢰된 HTTPS에서 실제 화면 JS·same-origin API를 확인한다', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Anvil/);
  await expect(page.locator('#root')).not.toBeEmpty();
  const health = await page.evaluate(async () => {
    const response = await fetch('/api/v1/health');
    return { status: response.status, body: await response.json() };
  });
  expect(health).toEqual({ status: 200, body: { status: 'ok', scope: 'process', version: '0.1.0' } });
  expect(errors).toEqual([]);
  expect(requests.length).toBeGreaterThanOrEqual(3);
  expect(requests.filter(url => new URL(url).origin !== new URL(baseURL!).origin)).toEqual([]);
  console.log('P03_NETWORK_AUDIT ' + JSON.stringify({ requests: requests.length, offOrigin: 0, pageErrors: errors.length, tlsIgnore: false }));
});
