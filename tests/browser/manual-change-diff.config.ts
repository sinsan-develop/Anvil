import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-change-diff-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:'UI05/result-submission.spec.ts',grep:/MANUAL_CHANGES(?:_LOSS|_BAD_PATH)?$/,outputDir:'D:/tmp/anvil-v3-stage-b/ui05-change-diff-01/results'});
