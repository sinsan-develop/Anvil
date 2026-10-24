import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui04-context-knowledge-scope-e20261025-01/temp';process.env.TMP=process.env.TEMP;
process.env.ANVIL_UI04_QA_DIST='apps/web/dist';
export default defineConfig({...base,testDir:'./UI04',testMatch:'assignment-confirmation.spec.ts',grep:/CONTEXT_ORIGINAL/,outputDir:'D:/tmp/anvil-v3-stage-b/ui04-context-knowledge-scope-e20261025-01/results'});
