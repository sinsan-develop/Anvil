import { defineConfig } from '@playwright/test';
import base from '../../playwright.config.ts';
// 이 시험은 가짜 API/로컬 bundle만 읽으며 HTTP 서버나 DB를 띄우지 않는다.
process.env.TEMP='D:/tmp/anvil-v3-stage-b/fn11-work-plan-approval-ui-01/temp';
process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:'work-plan-edit.spec.ts',outputDir:'D:/tmp/anvil-v3-stage-b/fn11-work-plan-approval-ui-01/results'});
