import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui02-draft-delete-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI02',testMatch:'draft-node-deletion.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/ui02-draft-delete-01/results'});
