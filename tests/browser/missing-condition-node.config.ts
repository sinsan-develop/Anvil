import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
const root=process.env.ANVIL_CONDITION_QA_ROOT??'D:/tmp/anvil-v3-stage-b/ui03-missing-condition-node-02';
process.env.TEMP=root+'/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI03',testMatch:'method-draft-import.spec.ts',grep:/MISSING_CONDITION_NODE/,outputDir:root+'/results'});
