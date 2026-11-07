import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui06-screen-refinement-e20261025-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'./UI06',testMatch:'design-dependency.spec.ts',grep:/등록 화면의 상세화/,outputDir:'D:/tmp/anvil-v3-stage-b/ui06-screen-refinement-e20261025-01/results'});
