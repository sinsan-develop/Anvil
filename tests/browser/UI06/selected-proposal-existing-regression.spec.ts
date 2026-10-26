import {test} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import './material-library.spec.ts';

// 기존 다섯 시험의 기대와 합성 API는 유지하고 현재 App 빌드만 route로 공급한다.
test.beforeEach(async({page})=>{
  if(process.env.ANVIL_UI04_QA_DIST!=='apps/web/dist')throw Error('CURRENT_APP_BUNDLE_REQUIRED');
  await installWorkspaceBundle(page);
});
