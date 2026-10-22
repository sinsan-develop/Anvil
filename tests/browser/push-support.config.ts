import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
const root=process.env.ANVIL_PUSH_SUPPORT_QA_ROOT??'D:/tmp/anvil-v3-stage-b/ui14-push-support-01';process.env.TEMP=root+'/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI14',testMatch:'browser-push-support.spec.ts',outputDir:root+'/results'});
