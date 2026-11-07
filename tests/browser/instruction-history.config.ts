import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui10-instruction-history-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI10',testMatch:'instruction-history.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/ui10-instruction-history-01/results'});
