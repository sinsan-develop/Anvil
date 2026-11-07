import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-plan-prerequisite-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:'work-plan-edit.spec.ts',grep:/PLAN_PREREQUISITE_SELECT/,outputDir:'D:/tmp/anvil-v3-stage-b/ui06-plan-prerequisite-01/results'});
