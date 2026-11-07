import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-understanding-history-e20261024-01/temp';process.env.TMP=process.env.TEMP;
process.env.ANVIL_UI04_QA_DIST='apps/web/dist';
export default defineConfig({...base,testDir:'.',testMatch:'UI05/session-detail.spec.ts',grep:/UNDERSTANDING_HISTORY|REPORTED_ISSUE DENY/,outputDir:'D:/tmp/anvil-v3-stage-b/ui05-understanding-history-e20261024-01/results'});
