import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui05-checkpoint-changes-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:'UI05/session-detail.spec.ts',grep:/CHECKPOINT_COMPARE /,outputDir:'D:/tmp/anvil-v3-stage-b/ui05-checkpoint-changes-01/results'});
