import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-document-download-02/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI04',testMatch:['document-download.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui06-document-download-02/results'});
