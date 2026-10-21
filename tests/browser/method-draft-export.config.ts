import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui03-method-export-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI03',testMatch:'method-draft-import.spec.ts',grep:/METHOD_EXPORT_/,outputDir:'D:/tmp/anvil-v3-stage-b/ui03-method-export-01/results'});
