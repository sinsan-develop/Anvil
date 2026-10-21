import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-stage-document-draft-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:['stage-document-draft.spec.ts','work-plan-version-history.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui06-stage-document-draft-01/results'});
