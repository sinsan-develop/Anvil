import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/fn06-provider-history-c2-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI04',testMatch:'assignment-confirmation.spec.ts',grep:/PROVIDER_HISTORY_/,outputDir:'D:/tmp/anvil-v3-stage-b/fn06-provider-history-c2-01/results'});
