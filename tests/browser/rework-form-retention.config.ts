import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-rework-input-e20261024-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:'UI05/result-criteria.spec.ts',grep:/REWORK_(FORM_ROUNDTRIP|PREPARED|PREPARE_STALE|LOSS)$/,outputDir:'D:/tmp/anvil-v3-stage-b/ui05-rework-input-e20261024-01/results'});
