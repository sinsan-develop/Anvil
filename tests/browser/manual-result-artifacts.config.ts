import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-manual-artifacts-02/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI05',testMatch:'result-submission.spec.ts',grep:/RESULT_SUBMISSION_MANUAL_ARTIFACTS/,outputDir:'D:/tmp/anvil-v3-stage-b/ui05-manual-artifacts-02/results'});
