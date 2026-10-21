import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui09-context-original-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI09',testMatch:['transfer-original.spec.ts','transfer-read.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui09-context-original-01/results'});
