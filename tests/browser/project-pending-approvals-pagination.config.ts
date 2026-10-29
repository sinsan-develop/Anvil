import {defineConfig} from '@playwright/test';
const root='D:/tmp/anvil-v3-stage-b/ui01-approval-pagination-20261030-01';
process.env.TEMP=root+'/temp';process.env.TMP=process.env.TEMP;process.env.ANVIL_UI04_QA_DIST='apps/web/dist';
export default defineConfig({testDir:'./UI01',testMatch:['project-pending-approvals-pagination.spec.ts','projects.spec.ts'],outputDir:root+'/results',workers:1,retries:0,forbidOnly:true,timeout:15000,reporter:'line',use:{baseURL:'https://localhost:3830',browserName:'chromium',channel:'msedge',headless:true,ignoreHTTPSErrors:false,serviceWorkers:'block',trace:'off',screenshot:'only-on-failure'}});
