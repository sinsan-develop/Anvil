import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui04-document-material-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI04',testMatch:['workspace-document-material.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui04-document-material-01/results'});
