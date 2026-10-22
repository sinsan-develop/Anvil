import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-rework-review-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:'UI05/result-criteria.spec.ts',grep:/REWORK_HISTORY$/,outputDir:'D:/tmp/anvil-v3-stage-b/ui05-rework-review-01/results'});
