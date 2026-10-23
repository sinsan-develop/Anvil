import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui08-review-evidence-e20261024-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI08/reported-issue-criteria.spec.ts','UI05/result-criteria.spec.ts'],grep:/ISSUE_CRITERIA_COVERAGE_EVIDENCE| EVIDENCE_FILE$/,outputDir:'D:/tmp/anvil-v3-stage-b/ui08-review-evidence-e20261024-01/results'});
