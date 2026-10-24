import {defineConfig} from '@playwright/test';
import base from '../../playwright.config.ts';
process.env.TEMP='D:/tmp/anvil-v3-stage-b/ui03-ui04-form-fields-e20261024-01/temp';process.env.TMP=process.env.TEMP;
export default defineConfig({...base,testDir:'.',testMatch:['UI03/forms.spec.ts','UI04/workspace.spec.ts'],grep:/FORM_FIELD_DETAILS|단계 양식의|단계 양식 조회 거절|단계 양식 다른 버전|양식 화면 계약:/,outputDir:'D:/tmp/anvil-v3-stage-b/ui03-ui04-form-fields-e20261024-01/results'});
