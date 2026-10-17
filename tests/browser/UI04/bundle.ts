import { readFile, readdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';
if (process.env.ANVIL_UI04_QA_DIST === 'D:/tmp/anvil-v3-stage-b/ui04-context-01/dist') {
  process.env.TEMP = 'D:\\tmp\\anvil-v3-stage-b\\ui04-context-01\\temp'; process.env.TMP = process.env.TEMP;
}

export async function installWorkspaceBundle(page: Page) {
  if (process.env.ANVIL_UI04_QA_DIST !== 'D:/tmp/anvil-v3-stage-b/ui04-context-01/dist') return;
  const root = process.env.ANVIL_UI04_QA_DIST, files = new Map<string, { body: Buffer; contentType: string }>();
  files.set('/', { body: await readFile(root + '/index.html'), contentType: 'text/html' });
  for (const name of await readdir(root + '/assets')) {
    if (!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name)) throw Error('UI04_QA_ASSET_UNEXPECTED');
    files.set('/assets/' + name, { body: await readFile(root + '/assets/' + name), contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css' });
  }
  await page.route(/^https:\/\/localhost:3830\/(?:$|assets\/)/, route => {
    const file = files.get(new URL(route.request().url()).pathname);
    return route.request().method() === 'GET' && file ? route.fulfill({ status: 200, ...file }) : route.abort();
  });
}
