import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.ANVIL_UI04_QA_DIST='apps/web/dist';process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui07-change-conversation-source-e20261025-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI07',testMatch:'stored-change-conversation.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/ui07-change-conversation-source-e20261025-01/results'});
