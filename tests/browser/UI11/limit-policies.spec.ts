import {test,expect,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',at='2026-10-20T00:00:00.000Z';
async function fixture(page:Page,mode:string){
 const writes:any[]=[],unexpected:string[]=[],errors:string[]=[],stored=new Map<number,any>(),receipts=new Map<string,any>();page.on('pageerror',e=>errors.push(e.message));let releaseDenial=()=>{};const denialGate=new Promise<void>(resolve=>{releaseDenial=resolve;});
 await page.route('**/api/v1/**',r=>{unexpected.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'한도 정책 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/*/connector-registrations?*',r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));
 await page.route('**/api/v1/projects/*/source-roots?*',r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));
 await page.route('**/api/v1/projects/*/source-read-grants?*',r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));
 await page.route('**/api/v1/projects/*/connection-candidates?*',r=>r.fulfill({json:{view:'CANDIDATES_ONLY',items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}}}));
 await page.route('**/api/v1/projects/'+pid+'/permission-policy',r=>r.fulfill({json:mode==='NO_POLICY'?{configured:false,policy:null}:{configured:true,policy:{ref:{id,version:1,contentHash:'a'.repeat(64)},rules:[{subjectRef:{kind:'HUMAN',userId:uid},operations:['applyLimitPolicy','revokeLimitPolicy'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+60000).toISOString()}]}}}));
 await page.route('**/api/v1/projects/'+pid+'/limit-policies/'+id+'/versions/*',r=>{const version=Number(new URL(r.request().url()).pathname.split('/').at(-1));return r.fulfill({json:stored.get(version)});});
 await page.route('**/api/v1/projects/'+pid+'/commands',async r=>{
  const c=r.request().postDataJSON();writes.push(c);
  if(mode==='LATE_DENIAL'){if(writes.length===1){await denialGate;return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});}return r.abort('connectionreset');}
  let result=receipts.get(c.commandId);
  if(!result){const previous=stored.get(c.expectedVersion),snapshot={...c.payload,limits:c.payload.limits??previous.snapshot.limits,state:c.operation==='applyLimitPolicy'?'APPLIED':'REVOKED',previousRef:previous?.ref??null,decidedBy:{kind:'HUMAN',userId:uid},decidedAt:at,expiresAt:c.operation==='applyLimitPolicy'?new Date(Date.parse(at)+c.payload.limits.maxElapsedMs).toISOString():previous.snapshot.expiresAt,executionAuthorized:false,dispatchPerformed:false},ref={id,version:c.expectedVersion+1,contentHash:contentHash(canonicalJson(snapshot))};stored.set(ref.version,{projectId:pid,ref,snapshot});result={operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:id,version:ref.version,data:{status:c.operation==='applyLimitPolicy'?'LIMIT_POLICY_APPLIED':'LIMIT_POLICY_REVOKED',ref,snapshot},evidenceRefs:[],warnings:[],serverReceivedAt:at};receipts.set(c.commandId,result);}
  if(mode==='LOSS'&&writes.length===1)return r.abort('connectionreset');return r.fulfill({json:result});
 });
 await page.goto('/#/projects/'+pid+'/connections');return{writes,unexpected,errors,releaseDenial};
}
for(const mode of ['FREEZE_RACE','LATE_DENIAL','FLOW','LOSS','NO_POLICY','HASH'])test('LIMIT_POLICY_'+mode,async({page})=>{
 const f=await fixture(page,mode),panel=page.getByLabel('프로젝트 한도 정책',{exact:true});
 await panel.getByRole('button',{name:'새 프로젝트 한도 작성',exact:true}).click();await panel.getByLabel('한도 정책 사유',{exact:true}).fill('단계 작업 유한 한도');
 if(mode==='FREEZE_RACE'){
  await page.evaluate(()=>{const w=window as any,original=crypto.subtle.digest.bind(crypto.subtle);w.heldDigest=new Promise(resolve=>{w.finishDigest=resolve;});crypto.subtle.digest=async function(algorithm,data){const text=new TextDecoder().decode(data as ArrayBuffer);if(!w.freezeOnce&&text.includes('"operation":"applyLimitPolicy"')&&text.includes('"commandId"')){w.freezeOnce=true;w.freezeReached=true;await new Promise(resolve=>{w.releaseFreeze=resolve;});const result=await original(algorithm,data);w.finishDigest();return result;}return original(algorithm,data);};});
  await panel.getByRole('button',{name:'한도 정책 명시 저장',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as any).freezeReached)).toBe(true);
  const other='44444444-4444-4444-8444-444444444444';await page.evaluate(p=>{location.hash='/projects/'+p+'/connections';},other);await expect(panel.getByLabel('한도 정책 사유',{exact:true})).toHaveCount(0);
  await page.evaluate(p=>{location.hash='/projects/'+p+'/connections';},pid);await panel.getByLabel('한도 정책 사유',{exact:true}).fill('복귀 후 새 사유');
  await page.evaluate(async()=>{const w=window as any;w.releaseFreeze();await w.heldDigest;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  expect(f.writes).toHaveLength(0);await expect(panel.getByLabel('한도 정책 사유',{exact:true})).toHaveValue('복귀 후 새 사유');return;
 }
 await panel.getByRole('button',{name:'한도 정책 명시 저장',exact:true}).click();
 if(mode!=='NO_POLICY')await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();
 if(mode==='LATE_DENIAL'){
  try{
   await expect.poll(()=>f.writes.length).toBe(1);const other='44444444-4444-4444-8444-444444444444';await page.evaluate(p=>{location.hash='/projects/'+p+'/connections';},other);await expect(panel.getByLabel('한도 정책 사유',{exact:true})).toHaveCount(0);
   await page.evaluate(p=>{location.hash='/projects/'+p+'/connections';},pid);await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('CONNECTION_LOST');
   f.releaseDenial();await expect(panel.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(panel).toContainText('결과 불명');await expect(panel.getByRole('button',{name:'거절된 한도 입력 수정',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'한도 작성 닫기',exact:true})).toBeDisabled();expect(f.writes[1]).toEqual(f.writes[0]);
  }finally{f.releaseDenial();}
  expect({unexpected:f.unexpected,errors:f.errors}).toEqual({unexpected:[],errors:[]});return;
 }
 if(mode==='NO_POLICY'){await expect(panel.getByRole('alert')).toContainText('PROJECT_POLICY_REQUIRED');expect(f.writes).toHaveLength(0);await expect(panel.getByLabel('한도 정책 사유',{exact:true})).toHaveValue('단계 작업 유한 한도');}
 else{
  if(mode==='LOSS'){
   await expect(panel.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(panel.getByLabel('최대 호출 수',{exact:true})).toBeDisabled();const other='44444444-4444-4444-8444-444444444444';
   await page.evaluate(p=>{location.hash='/projects/'+p+'/connections';},other);await expect(panel.getByLabel('한도 정책 사유',{exact:true})).toHaveCount(0);
   await page.evaluate(p=>{location.hash='/projects/'+p+'/connections';},pid);await expect(panel.getByLabel('한도 정책 사유',{exact:true})).toHaveValue('단계 작업 유한 한도');
   await panel.getByRole('button',{name:'같은 한도 명령 결과 확인',exact:true}).click();await expect.poll(()=>f.writes.length).toBe(2);expect(f.writes[1]).toEqual(f.writes[0]);
  }
  await expect(panel.getByRole('status')).toContainText('한도 보관 확인 · v1 · APPLIED · 실행 허가 아님');
  await panel.getByRole('button',{name:'한도 작성 닫기',exact:true}).click();
  if(mode==='HASH'){
   await panel.getByLabel('한도 정책 hash',{exact:true}).fill('0'.repeat(64));await panel.getByRole('button',{name:'정확 한도 버전 조회',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('LIMIT_POLICY_RESPONSE_INVALID');await expect(panel.getByLabel('보관 한도 정책',{exact:true})).toHaveCount(0);
  }else if(mode==='FLOW'){
   await panel.getByRole('button',{name:'정확 한도 버전 조회',exact:true}).click();await expect(panel.getByLabel('보관 한도 정책',{exact:true})).toContainText('현재 적용/실행 준비 판정 아님');
   await panel.getByRole('button',{name:'이 한도 버전에서 작성',exact:true}).click();await panel.getByLabel('최대 호출 수',{exact:true}).fill('49');await panel.getByLabel('한도 정책 사유',{exact:true}).fill('호출 수 축소');
   await panel.getByRole('button',{name:'한도 정책 명시 저장',exact:true}).click();await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();await expect(panel.getByRole('status')).toContainText('v2 · APPLIED');
   await panel.getByRole('button',{name:'한도 작성 닫기',exact:true}).click();await panel.getByRole('button',{name:'이 한도 버전에서 작성',exact:true}).click();await panel.getByLabel('한도 정책 사유',{exact:true}).fill('이 한도 정책 회수');
   page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'선택 버전 한도 회수 요청',exact:true}).click();await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();await expect(panel.getByRole('status')).toContainText('v3 · REVOKED');expect(f.writes.map(w=>w.operation)).toEqual(['applyLimitPolicy','applyLimitPolicy','revokeLimitPolicy']);expect(f.writes[1].targetId).toBe(id);expect(f.writes[1].expectedVersion).toBe(1);expect(f.writes[2].expectedVersion).toBe(2);
  }
 }
 expect({unexpected:f.unexpected,errors:f.errors}).toEqual({unexpected:[],errors:[]});
});
