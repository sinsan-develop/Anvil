import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui08-issue-assignment-02/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI08/reported-issue-assignment.spec.ts','UI05/session-detail.spec.ts'],grep:/ISSUE_ASSIGNMENT_|REPORTED_ISSUE /,outputDir:'D:/tmp/anvil-v3-stage-b/ui08-issue-assignment-02/results'});
