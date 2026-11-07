import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui09-read-preparation-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI09/transfer-read.spec.ts','UI05/session-detail.spec.ts','UI08/approvals.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui09-read-preparation-01/results'});
