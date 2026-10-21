import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui01-assignment-drafts-01/temp';
process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI01',testMatch:'projects.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/ui01-assignment-drafts-01/results'});
