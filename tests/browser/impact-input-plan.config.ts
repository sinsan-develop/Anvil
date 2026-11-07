import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui07-impact-input-plan-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI07',testMatch:['impact-input-plan.spec.ts','impact-document-original.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui07-impact-input-plan-01/results'});
