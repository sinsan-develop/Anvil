import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui10-knowledge-scope-original-e20261025-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI10',testMatch:'knowledge-scope.spec.ts',grep:/RELATED_ORIGINAL/,outputDir:'D:/tmp/anvil-v3-stage-b/ui10-knowledge-scope-original-e20261025-01/results'});
