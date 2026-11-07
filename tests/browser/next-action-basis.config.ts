import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-next-action-basis-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI05',testMatch:'result-criteria.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/ui05-next-action-basis-01/results'});
