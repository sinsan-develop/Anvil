import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-stage-queue-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI05',testMatch:['stage-queue.spec.ts','result-submission.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui05-stage-queue-01/results'});
