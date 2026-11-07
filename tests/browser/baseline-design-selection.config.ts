import {defineConfig} from '@playwright/test';import base from '../../playwright.config.ts';
const root=process.env.ANVIL_BASELINE_DESIGN_QA_ROOT??'D:/tmp/anvil-v3-stage-b/ui02-baseline-design-01';process.env.TEMP=root+'/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI02',testMatch:'baseline-design-selection.spec.ts',outputDir:root+'/results'});
