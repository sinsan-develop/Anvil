import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui03-form-history-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI03',testMatch:['form-version-comparison.spec.ts','forms.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui03-form-history-01/results'});
