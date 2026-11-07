import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';
import { chromium, type Page } from '@playwright/test';

const qaRoot = resolve('D:/Project/Anvil/.av3-data/ui04-methodology-rules-20261025-01');
const selected = (page: Page) => page.getByRole('region', { name: '선택한 절차 정의', exact: true });
const join = (page: Page) => selected(page).getByRole('region', { name: '합류 규칙 정의', exact: true });
const retry = (page: Page, id = 'R1') => selected(page).getByRole('region', { name: '재작업 규칙 정의: ' + id, exact: true });
const state = (page: Page) => page.evaluate(() => { const qa = (window as any).__methodologyRulesQA; return { requests: qa.requests, unexpected: qa.unexpected, authLost: qa.authLost }; });

test('UI04 선택 단계의 저장 합류·재작업 규칙을 읽고 손상 정의와 실행 상태를 구분한다', { timeout: 120000 }, async t => {
  assert.equal(process.env.ANVIL_UI04_METHODOLOGY_RULES_DOM_QA, '1', 'Main 사전등록 QA만 실행');
  assert.equal(resolve(process.env.ANVIL_UI04_METHODOLOGY_RULES_QA_ROOT ?? ''), qaRoot);
  assert.equal(process.env.USERDOMAIN + '\\' + process.env.USERNAME, 'SINSAN\\cyhuh');
  for (const name of ['TEMP', 'TMP']) assert.equal(process.env[name], resolve(qaRoot, 'temp'), '등록 literal temp만 사용');
  const parent = dirname(qaRoot), info = await lstat(parent); assert(info.isDirectory() && !info.isSymbolicLink()); assert.equal((await realpath(parent)).toLowerCase(), parent.toLowerCase());
  try { await lstat(qaRoot); assert.fail('기존 QA root 재사용 금지'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(qaRoot); await mkdir(resolve(qaRoot, 'temp'));
  const result = await build({ configFile: false, logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, minify: false, sourcemap: false, lib: { entry: resolve('tests/browser/UI04/methodology-rules-dom-harness.tsx'), name: 'AnvilMethodologyRulesQA', formats: ['iife'] } } });
  const outputs = Array.isArray(result) ? result : [result]; assert.equal(outputs.length, 1); const output = outputs[0]; assert(output && typeof output === 'object' && 'output' in output && Array.isArray(output.output)); assert.equal(output.output.length, 1); const chunk = output.output[0]; assert(chunk?.type === 'chunk');
  const context = await chromium.launchPersistentContext(resolve(qaRoot, 'browser'), { channel: 'msedge', headless: true, serviceWorkers: 'block', timeout: 15000, viewport: { width: 1920, height: 1080 } });
  try {
    const page = context.pages()[0] ?? await context.newPage(), errors: string[] = [], unexpected: string[] = []; page.setDefaultTimeout(4000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { if (route.request().url() === 'https://anvil.invalid:3830/' && route.request().method() === 'GET') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>' }); unexpected.push(route.request().url()); return route.abort(); });
    await page.goto('https://anvil.invalid:3830/'); await page.addScriptTag({ content: chunk.code }); await page.getByRole('button', { name: '적용 절차 조회', exact: true }).waitFor();
    assert.equal((await state(page)).requests.length, 0, '명시 조회 전 GET0');
    await page.getByRole('button', { name: '적용 절차 조회', exact: true }).click(); await selected(page).getByRole('heading', { name: '요구 판단', exact: true }).waitFor();
    assert.equal((await state(page)).requests.length, 1);
    async function choose(name: string) { await page.getByRole('button', { name: '절차 정의: ' + name, exact: true }).click(); await selected(page).getByRole('heading', { name, exact: true }).waitFor(); }
    async function reset(mode: string, name = '모든 결과 합류') {
      await page.evaluate(mode => (window as any).__methodologyRulesQA.reset(mode), mode);
      const count = (await state(page)).requests.length;
      await page.getByRole('button', { name: '적용 절차 조회', exact: true }).click(); await selected(page).getByRole('heading', { name: '요구 판단', exact: true }).waitFor(); await choose(name);
      assert.equal((await state(page)).requests.length, count + 1, '같은 응답의 선택 전환은 추가 GET0');
    }
    await choose('모든 결과 합류');
    // 최초 RED: 현재 소비자에는 저장 JOIN 규칙을 읽는 상세 영역 자체가 없다.
    assert.equal(await join(page).count(), 1, '선택 JOIN의 저장 합류 규칙 상세가 필요하다');
    await t.test('ALL·명시 조건 원문과 선택 단계에 인접한 각 재작업 정책을 정확히 전환한다', async () => {
      assert.match(await join(page).innerText(), /모든 선행 결과/); assert.match(await join(page).innerText(), /ALL/);
      for (const text of ['최대 3회', '같은 실패', 'SAME_FAILURE_FINGERPRINT', '사용자 판단', 'USER_DECISION']) assert((await retry(page).innerText()).includes(text));
      assert.equal(await retry(page, 'R2').count(), 0);
      await choose('명시 조건 합류'); assert.match(await join(page).innerText(), /DECLARED_CONDITION/);
      const raw = await join(page).locator('pre').textContent(); assert.deepEqual(JSON.parse(raw!), { all: [{ fieldRef: { nodeId: 'N1', field: 'USER_DECISION' }, operator: 'EQ', value: '<script>window.rulesUnsafe=1</script> 승인' }, { not: { fieldRef: { nodeId: 'N2', field: 'REVIEW_OUTCOME' }, operator: 'IN', value: ['REWORK', 'BLOCKED'] } }] });
      assert.match(await retry(page, 'R2').innerText(), /최대 2회/); assert.equal(await retry(page).count(), 0); assert.equal(await page.evaluate(() => (window as any).rulesUnsafe), undefined);
      await choose('요구 판단'); assert.equal(await join(page).count(), 0); assert.match(await retry(page).innerText(), /최대 3회/);
      await choose('마지막 확인'); assert.equal(await join(page).count(), 0); assert.equal(await selected(page).getByRole('region', { name: /재작업 규칙 정의:/ }).count(), 0); assert((await selected(page).innerText()).includes('정의상 마지막')); assert(!(await selected(page).innerText()).includes('정의 미확인'));
      assert.equal((await state(page)).requests.length, 1, '단계/일반 연결 전환 추가 GET0');
    });
    await t.test('배열 field/operator를 문자열 enum으로 강제 변환해 정상 조건으로 표시하지 않는다', async () => {
      for (const mode of ['JOIN_CONDITION_OPERATOR_ARRAY', 'JOIN_CONDITION_FIELD_ARRAY']) {
        await reset(mode); const text = await join(page).innerText(); assert.match(text, /정의 미확인/, mode); assert.doesNotMatch(text, /명시한 결과 조건 · 평가하지 않은 원문/, mode);
        const raw = JSON.parse((await join(page).locator('pre').textContent())!);
        if (mode === 'JOIN_CONDITION_OPERATOR_ARRAY') assert.deepEqual(raw.condition.operator, ['EQ']);
        else assert.deepEqual(raw.condition.fieldRef.field, ['REVIEW_OUTCOME']);
      }
    });
    await t.test('누락·알 수 없는 합류/조건 정의를 정상 합류로 설명하지 않는다', async () => {
      for (const mode of ['JOIN_MISSING', 'JOIN_NULL', 'JOIN_UNKNOWN', 'JOIN_EXTRA', 'JOIN_CONDITION_MISSING', 'JOIN_CONDITION_INVALID', 'JOIN_CONDITION_UNKNOWN', 'JOIN_CONDITION_REFERENCE']) {
        await reset(mode); assert.match(await join(page).innerText(), /정의 미확인/, mode); assert.doesNotMatch(await join(page).innerText(), /모든 선행 결과|명시한 결과 조건 · 평가하지 않은 원문/, mode);
      }
      await reset('JOIN_WRONG_NODE', '요구 판단'); assert.match(await join(page).innerText(), /정의 미확인/);
    });
    await t.test('재작업의 유한 정수 상한·같은 실패·소진 정책이 손상되면 정의 미확인으로 표시한다', async () => {
      for (const mode of ['RETRY_MISSING', 'RETRY_NULL', 'RETRY_STRING', 'RETRY_EXTRA', 'RETRY_NAN', 'RETRY_INFINITY', 'RETRY_FRACTION', 'RETRY_ZERO', 'RETRY_NEGATIVE', 'RETRY_STRING_MAX', 'RETRY_UNSAFE', 'RETRY_COUNTING', 'RETRY_EXHAUSTION']) {
        await reset(mode); const text = await retry(page).innerText(); assert.match(text, /정의 미확인/, mode); assert.doesNotMatch(text, /최대 .+회|소진 시: 사용자 판단 요청/, mode);
      }
      await reset('RETRY_WRONG_EDGE', '요구 판단'); const edge = selected(page).getByRole('region', { name: '재작업 규칙 정의: E1', exact: true }); assert.match(await edge.innerText(), /정의 미확인/); assert.doesNotMatch(await edge.innerText(), /최대 9회/);
    });
    await t.test('저장 정의 조회는 실제 충족·시도 횟수·실행 권한을 만들지 않는다', async () => {
      await reset('NORMAL'); const text = await page.getByRole('region', { name: '적용된 개발 절차', exact: true }).innerText();
      assert(text.includes('실제 실행 상태 미연결')); assert(text.includes('현재 시도 횟수·조건 충족·선행 완료·실행 권한은 미연결입니다.'));
      assert.doesNotMatch(text, /현재 \d+회|선행 완료됨|실행 허가됨|조건 충족됨/);
      assert.equal(await selected(page).getByRole('button').count(), 0, '규칙은 읽기 전용이며 실행 제어를 추가하지 않는다');
    });
    const final = await state(page); assert(final.requests.every((request: { path: string; method: string | undefined }) => request.method === 'GET' && request.path === '/api/v1/projects/32b5f276-13e6-4d8a-b93f-27a15d21c788/methodology-application')); assert.equal(final.authLost, 0); assert.deepEqual(final.unexpected, []); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  } finally { await context.close(); }
});
