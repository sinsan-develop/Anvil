import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui03-applied-method-forms-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI03',testMatch:['applied-method-forms.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui03-applied-method-forms-01/results'});
