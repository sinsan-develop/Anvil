import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui04-document-edit-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI04/workspace-document-edit.spec.ts','UI06/screen-region-edit.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui04-document-edit-01/results'});
