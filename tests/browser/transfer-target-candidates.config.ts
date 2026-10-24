import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP = 'D:/tmp/anvil-v3-stage-b/ui09-target-candidates-e20261024-01/temp';
process.env.TMP = process.env.TEMP;
process.env.ANVIL_UI04_QA_DIST = 'apps/web/dist';
export default defineConfig({ ...base, testDir: '.', testMatch: ['UI09/transfer-target-candidates.spec.ts', 'UI09/transfer-read.spec.ts'], outputDir: 'D:/tmp/anvil-v3-stage-b/ui09-target-candidates-e20261024-01/results' });
