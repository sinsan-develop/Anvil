import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-form-entry-02/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:['document-edit.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui06-form-entry-02/results'});
