import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.ANVIL_UI04_QA_DIST='apps/web/dist';process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-plan-document-trace-e20261025-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:'work-plan-edit.spec.ts',grep:/PLAN_DOCUMENT_REFINES|TASK_DEPENDENCY/,outputDir:'D:/tmp/anvil-v3-stage-b/ui06-plan-document-trace-e20261025-01/results'});
