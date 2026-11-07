import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';
import { chromium, type Page } from '@playwright/test';

const qaRoot = resolve('D:/Project/Anvil/.av3-data/ui11-current-permission-policy-20261025-01');
const panel = (page: Page) => page.getByRole('region', { name: '현재 프로젝트 권한 정책', exact: true });
const result = (page: Page) => panel(page).getByRole('region', { name: '저장된 현재 권한 정책', exact: true });
const open = (page: Page) => panel(page).getByRole('button', { name: '현재 권한 정책 조회', exact: true });
async function state(page: Page) { return page.evaluate(() => { const qa = (window as any).__currentPolicyQA; return { requests: qa.requests.map((r: any) => ({ path: r.path, method: r.method, jsonStarted: r.jsonStarted, settled: r.settled, pending: !!r.release })), authLost: qa.authLost, unexpected: qa.unexpected, hashPending: !!qa.hashRelease, hashSettled: qa.hashSettled }; }); }

test('UI11 설정에서 전체 현재 권한 정책을 명시 조회하고 닫기·문맥 변경 뒤 늦은 응답을 숨긴다', { timeout: 120000 }, async t => {
  assert.equal(process.env.ANVIL_UI11_CURRENT_POLICY_DOM_QA, '1', 'Main 사전등록 QA만 실행');
  assert.equal(resolve(process.env.ANVIL_UI11_CURRENT_POLICY_QA_ROOT ?? ''), qaRoot);
  assert.equal(process.env.USERDOMAIN + '\\' + process.env.USERNAME, 'SINSAN\\cyhuh');
  for (const name of ['TEMP', 'TMP']) assert.equal(resolve(process.env[name] ?? ''), resolve(qaRoot, 'temp'));
  const parent = dirname(qaRoot), info = await lstat(parent); assert(info.isDirectory() && !info.isSymbolicLink()); assert.equal((await realpath(parent)).toLowerCase(), parent.toLowerCase());
  try { await lstat(qaRoot); assert.fail('기존 QA root 재사용 금지'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(qaRoot); await mkdir(resolve(qaRoot, 'temp'));
  const built = await build({ configFile: false, logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, minify: false, sourcemap: false, lib: { entry: resolve('tests/browser/UI11/current-permission-policy-dom-harness.tsx'), name: 'AnvilCurrentPolicyQA', formats: ['iife'] } } });
  const outputs = Array.isArray(built) ? built : [built]; assert.equal(outputs.length, 1); const output = outputs[0]; assert(output && typeof output === 'object' && 'output' in output && Array.isArray(output.output)); assert.equal(output.output.length, 1); const chunk = output.output[0]; assert(chunk?.type === 'chunk');
  const context = await chromium.launchPersistentContext(resolve(qaRoot, 'browser'), { channel: 'msedge', headless: true, serviceWorkers: 'block', timeout: 15000, viewport: { width: 1920, height: 1080 } });
  try {
    const page = context.pages()[0] ?? await context.newPage(), errors: string[] = [], unexpected: string[] = []; page.setDefaultTimeout(4000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { if (route.request().url() === 'https://anvil.invalid:3830/' && route.request().method() === 'GET') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>' }); unexpected.push(route.request().url()); return route.abort(); });
    await page.goto('https://anvil.invalid:3830/'); await page.addScriptTag({ content: chunk.code }); await page.getByRole('region', { name: '로그인 보안', exact: true }).waitFor();
    assert.equal((await state(page)).requests.length, 0, '기존 설정과 새 정책은 명시 조회 전 GET0');
    // 최초 RED: 실제 AccountSecurity 소비자에 전체 정책 조회 진입이 없다.
    assert.equal(await open(page).count(), 1, '설정에서 현재 프로젝트 전체 정책 조회 진입이 필요하다');
    async function reset(mode = 'NORMAL') { await page.evaluate(mode => (window as any).__currentPolicyQA.reset(mode), mode); await open(page).waitFor(); }
    async function load() { const before = (await state(page)).requests.length; await open(page).click(); await result(page).waitFor(); assert.equal((await state(page)).requests.length, before + 1); }
    async function pending(hash = false) { const before = (await state(page)).requests.length; await page.evaluate(hash => { const qa = (window as any).__currentPolicyQA; if (hash) qa.hashPending = true; else qa.pending = true; }, hash); await open(page).click(); await page.waitForFunction(({ before, hash }) => { const qa = (window as any).__currentPolicyQA; return hash ? !!qa.hashRelease : qa.requests.some((r: any, n: number) => n >= before && r.jsonStarted && r.release); }, { before, hash }); return before; }
    async function release(index: number, hash = false) { await page.evaluate(({ index, hash }) => { const qa = (window as any).__currentPolicyQA; if (hash) qa.hashRelease(); else qa.requests[index].release(); }, { index, hash }); await page.waitForFunction(({ index, hash }) => { const qa = (window as any).__currentPolicyQA; return hash ? qa.hashSettled : qa.requests[index].settled; }, { index, hash }); await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0))); }
    await t.test('읽기 전용 멤버도 본인 프로필 필터 없이 모든 규칙·전체 참조·저장 사유·시각을 읽는다', async () => {
      await load(); const text = await result(page).innerText();
      for (const expected of ['88888888-8888-4888-8888-888888888888', '12', '저장 사유 전체', '2026-10-25T01:02:03.000Z', '조회 완료 시각', 'CANDIDATE_RULE', 'OTHER_PERSON_MATERIAL', 'APPROVAL_RULE', 'EXECUTION_RULE', '정의상 허용', '정의상 거절', '정의상 별도 승인']) assert(text.includes(expected), expected);
      const details = result(page).locator('details'); assert.equal(await details.count(), 4); assert.equal(await result(page).locator('details[open]').count(), 0);
      for (const detail of await details.all()) await detail.locator('summary').click();
      const expanded = await result(page).innerText(); for (const expected of ['registerConnection', 'saveDocumentDraft', 'confirmWorkPlan', 'authorizeExecution', '44444444-4444-4444-8444-444444444444', 'EXECUTION', 'executionGeneration', 'sourceScopes', '2099-10-25T00:00:00.000Z', '77777777-7777-4777-8777-777777777777', 'a'.repeat(64)]) assert(expanded.includes(expected), expected);
      assert(text.includes(await page.evaluate(() => (window as any).__currentPolicyQA.policyHash))); assert.match(text, /검토 참조/); assert.equal(await page.evaluate(() => (window as any).policyUnsafe), undefined); assert.equal(await result(page).locator('script,img,iframe').count(), 0);
      assert.match(text, /현재 행동.*허용.*판정하지 않습니다/); assert.doesNotMatch(text, /실행 허가됨|권한 획득/);
      await panel(page).getByRole('button', { name: '현재 권한 정책 닫기', exact: true }).click(); assert.equal(await result(page).count(), 0);
    });
    await t.test('미설정·hash 손상·401/403/404에서 이전 정책과 오류 본문을 노출하지 않는다', async () => {
      await reset('UNCONFIGURED'); await open(page).click(); await panel(page).getByText('현재 권한 정책이 설정되지 않았습니다.', { exact: true }).waitFor(); assert.equal(await result(page).count(), 0);
      for (const mode of ['HASH', 'ERROR_401', 'ERROR_403', 'ERROR_404']) { await reset(); await load(); await page.evaluate(mode => (window as any).__currentPolicyQA.mode = mode, mode); await open(page).click(); await panel(page).getByRole('alert').waitFor(); assert.equal(await result(page).count(), 0, mode); const text = await panel(page).innerText(); assert(!text.includes('저장 사유 전체') && !text.includes('노출 금지 오류 원문') && !text.includes('변조된 저장 사유')); }
      assert.equal((await state(page)).authLost, 1);
    });
    await t.test('미지원 중첩 정의는 미확인으로 표시하고 원문을 안전하게 보존한다', async () => {
      await reset('UNKNOWN'); await load(); const first = result(page).locator('details').first(); await first.locator('summary').click(); assert.match(await first.innerText(), /정의 미확인/); assert.doesNotMatch(await first.innerText(), /정의상 허용/); assert((await first.innerText()).includes('미지원 필드')); assert.equal(await page.evaluate(() => (window as any).policyUnsafe), undefined);
    });
    await t.test('정확한 7필드 정책도 미지원 중첩 정의를 허용으로 요약하지 않고 원문을 보존한다', async () => {
      await reset('UNKNOWN_NESTED');
      const before = (await state(page)).requests.length;
      await load();
      const first = result(page).locator('details').first();
      const summary = await first.locator('summary').innerText();
      assert.match(summary, /정의 미확인/);
      assert.doesNotMatch(summary, /정의상 허용/);
      await first.locator('summary').click();
      const raw = await first.innerText();
      for (const value of ['SERVICE', '42', 'targetScopes', 'not-an-instant']) assert(raw.includes(value), value);
      const requests = (await state(page)).requests.slice(before);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].method, 'GET');
    });
    await t.test('닫기·사용자/client/project/ApiClient 변경과 이탈은 지연 JSON·hash 결과를 폐기한다', async () => {
      for (const hash of [false, true]) for (const kind of ['close', 'user', 'device', 'project', 'client', 'unmount']) {
        await reset(); const index = await pending(hash); if (kind === 'close') await panel(page).getByRole('button', { name: '현재 권한 정책 닫기', exact: true }).click(); else await page.evaluate(kind => (window as any).__currentPolicyQA.context(kind), kind);
        await release(index, hash); assert.equal(await result(page).count(), 0, kind + ':' + hash); assert(!(await page.locator('body').innerText()).includes('저장 사유 전체'));
      }
    });
    await t.test('같은 문맥 A→B→A 복귀도 이전 선택을 되살리지 않고 명시 재조회한다', async () => {
      for (const kind of ['project', 'user', 'device', 'client']) { await reset(); await load(); await page.evaluate(kind => { const qa = (window as any).__currentPolicyQA; qa.context(kind); qa.context(kind); }, kind); assert.equal(await result(page).count(), 0, kind); await load(); }
    });
    const final = await state(page); assert(final.requests.every((request: any) => request.method === 'GET' && /^\/api\/v1\/projects\/[0-9a-f-]+\/permission-policy$/.test(request.path))); assert.deepEqual(final.unexpected, []); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  } finally { await context.close(); }
});
