import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui08-review-coverage-e20261024-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:'UI08/reported-issue-criteria.spec.ts',grep:/ISSUE_CRITERIA_(COVERAGE|NORMAL$|MISSING$|DENY$)/,outputDir:'D:/tmp/anvil-v3-stage-b/ui08-review-coverage-e20261024-01/results'});
