import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui01-method-origin-e20261024-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI01/project-methodology.spec.ts','UI01/projects.spec.ts'],grep:/PROJECT_METHODOLOGY_|PROJECT_DRAFTS_PARENT/,outputDir:'D:/tmp/anvil-v3-stage-b/ui01-method-origin-e20261024-01/results'});
