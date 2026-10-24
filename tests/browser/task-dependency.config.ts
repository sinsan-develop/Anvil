import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.ANVIL_UI04_QA_DIST='apps/web/dist';process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-task-dependency-e20261025-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:'work-plan-edit.spec.ts',grep:/TASK_DEPENDENCY|보관 업무의 추적 연결/,outputDir:'D:/tmp/anvil-v3-stage-b/ui06-task-dependency-e20261025-01/results'});
