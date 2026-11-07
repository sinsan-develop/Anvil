import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP = 'D:/tmp/anvil-v3-stage-b/ui03-node-kind-save-e20261024-01/temp';
process.env.TMP = process.env.TEMP;
process.env.ANVIL_UI04_QA_DIST = 'apps/web/dist';
export default defineConfig({ ...base, testDir: '.', testMatch: ['UI03/node-kind-save.spec.ts', 'UI02/draft-node-deletion.spec.ts'], outputDir: 'D:/tmp/anvil-v3-stage-b/ui03-node-kind-save-e20261024-01/results' });
