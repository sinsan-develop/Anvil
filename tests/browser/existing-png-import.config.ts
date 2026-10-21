import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-direct-png-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:['preserved-png-attachment.spec.ts','document-attachments.spec.ts','imported-png-attachment.spec.ts'],outputDir:'D:/tmp/anvil-v3-stage-b/ui06-direct-png-01/results'});
