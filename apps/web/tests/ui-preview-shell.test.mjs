import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('preview shell exposes navigation and Eoul surfaces', async () => {
  const html = await readFile(new URL('ui-preview.html', root), 'utf8');
  assert.match(html, /data-preview-shell/);
  assert.match(html, /aria-label="Anvil 전체 메뉴"/);
  assert.match(html, /id="eoul-drawer"/);
  assert.match(html, /UI PREVIEW/);
});

test('browser code contains no internal endpoint', async () => {
  const source = await readFile(new URL('src/app/ui-preview.js', root), 'utf8');
  assert.doesNotMatch(source, /localhost|127\.0\.0\.1|anvil-api|shared-db|http:\/\//i);
});

test('screen style keeps the approved type scale and sidebar width', async () => {
  const css = await readFile(new URL('src/styles/ui-preview.css', root), 'utf8');
  assert.match(css, /--font-body:\s*12px/);
  assert.match(css, /--font-title:\s*16px/);
  assert.match(css, /--sidebar-width:\s*224px/);
});
