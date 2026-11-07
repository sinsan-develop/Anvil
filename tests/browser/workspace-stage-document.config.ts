import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui04-stage-document-create-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI04/workspace-stage-document.spec.ts','UI06/stage-document-draft.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui04-stage-document-create-01/results'});
