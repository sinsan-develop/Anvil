import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
const root=process.env.ANVIL_BASELINE_UPLOAD_QA_ROOT??'D:/tmp/anvil-v3-stage-b/ui02-baseline-upload-approval-01';process.env.TEMP=root+'/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI02',testMatch:'baseline-upload-approval.spec.ts',outputDir:root+'/results'});
