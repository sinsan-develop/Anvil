import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui08-issue-basis-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI08/issue-basis.spec.ts','UI05/session-detail.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui08-issue-basis-01/results'});
