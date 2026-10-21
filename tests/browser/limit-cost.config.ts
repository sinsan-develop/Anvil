import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui11-limit-cost-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI11',testMatch:'limit-policies.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/ui11-limit-cost-01/results'});
