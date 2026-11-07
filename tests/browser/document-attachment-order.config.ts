import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP = 'D:/tmp/anvil-v3-stage-b/ui06-attachment-order-e20261024-01/temp';
process.env.TMP = process.env.TEMP;
process.env.ANVIL_UI04_QA_DIST = 'apps/web/dist';
export default defineConfig({ ...base, testDir: '.', testMatch: 'UI06/document-attachments.spec.ts', outputDir: 'D:/tmp/anvil-v3-stage-b/ui06-attachment-order-e20261024-01/results' });
