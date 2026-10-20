import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',at='2026-10-20T00:00:00.000Z';
const rule=(ruleId:string,operations:string[])=>({ruleId,subjectRef:{kind:'HUMAN',userId:uid},operations,targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'DENY',limitPolicyRef:null,expiresAt:new Date(Date.now()+3600000).toISOString()});
function base(){const value={rules:[rule('DOC',['saveDocumentDraft']),rule('CANDIDATE',['registerConnection'])],reason:'다른 규칙 보존',reviewRefs:[]};return{ref:{id,version:1,contentHash:contentHash(canonicalJson(value))},...value,createdAt:at};}
async function fixture(page:Page,mode:string){
 const unknown:string[]=[],errors:string[]=[],writes:any[]=[],receipts=new Map<string,any>();let policy:any=mode==='EDIT'?base():null;
 await installWorkspaceBundle(page);await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_API'}});});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'정책 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,name:'정책 프로젝트',purpose:'사용자가 권한을 관리',desiredOutcome:'명시 정책',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}}}));
 await page.route(`**/api/v1/projects/${pid}/permission-policy`,r=>r.fulfill({json:{configured:policy!==null,policy}}));
 await page.route(`**/api/v1/projects/${pid}/connection-candidates?*`,r=>r.fulfill({json:{view:'CANDIDATES_ONLY',items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/connector-registrations?*`,r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));
 await page.route(`**/api/v1/projects/${pid}/source-roots?*`,r=>r.fulfill({json:{view:'SOURCE_ROOT_DECLARATIONS',items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/source-read-grants?*`,r=>r.fulfill({json:{view:'SOURCE_READ_GRANTS',items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/conversations?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/commands`,r=>{const c=r.request().postDataJSON();writes.push(c);expect(c.operation).toBe('savePermissionPolicy');if(mode==='REAUTH')return r.fulfill({status:412,json:{code:'REAUTHENTICATION_REQUIRED'}});let receipt=receipts.get(c.commandId);if(!receipt){const ref={id,version:c.expectedVersion+1,contentHash:contentHash(canonicalJson(c.payload))};policy={ref,...c.payload,createdAt:at};receipt={operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:id,version:ref.version,data:{status:'POLICY_SAVED',ref},serverReceivedAt:at};receipts.set(c.commandId,receipt);}if(mode==='LOSS'&&writes.length===1)return r.abort('connectionreset');return r.fulfill({json:receipt});});
 await page.goto(`/#/projects/${pid}/connections`);return{unknown,errors,writes,bump:()=>{policy=base();}};
}
for(const mode of ['INITIAL','EDIT','LOSS','REAUTH','STALE','LATE_SEND'])test('MATERIAL_POLICY_'+mode,async({page})=>{
 if(mode==='LATE_SEND')await page.addInitScript(()=>{const digest=crypto.subtle.digest.bind(crypto.subtle);let count=0;crypto.subtle.digest=async(algorithm,bytes)=>{const result=await digest(algorithm,bytes),text=new TextDecoder().decode(bytes as ArrayBuffer);if(text.includes('"operation":"savePermissionPolicy"')&&++count===2){(globalThis as any).candidatePolicySendReady=true;await new Promise<void>(resolve=>{(globalThis as any).candidatePolicyReleaseSend=resolve;});setTimeout(()=>{(globalThis as any).candidatePolicySendReturned=true;},0);}return result;};});
 const f=await fixture(page,mode);if(mode==='LOSS'){const other=page.getByRole('region',{name:'후보 저장 권한 정책 편집',exact:true});await other.getByRole('button',{name:'후보 정책 작성 준비',exact:true}).click();await other.getByLabel('후보 정책 변경 이유',{exact:true}).fill('독립 후보 입력 보존');}const panel=page.getByRole('region',{name:'문서·방법론 권한 정책 편집',exact:true});await panel.getByRole('button',{name:'자료 정책 작성 준비',exact:true}).click();
 if(mode==='EDIT')await panel.getByRole('combobox',{name:'편집할 자료 전용 규칙',exact:true}).selectOption('DOC');
 await panel.getByLabel('자료 정책 행동: 문서 초안 저장',{exact:true}).check();await panel.getByRole('combobox',{name:'자료 정책 처리',exact:true}).selectOption('AUTO');await panel.getByLabel('자료 정책 만료 UTC',{exact:true}).fill(new Date(Date.now()+600000).toISOString());await panel.getByLabel('자료 정책 변경 이유',{exact:true}).fill('본인 자료 작성만 명시 허용');await panel.getByLabel('자료 정책 범위와 기존 규칙 보존 확인',{exact:true}).check();
 if(mode==='STALE')f.bump();await panel.getByRole('button',{name:'자료 정책 명령 준비',exact:true}).click();
 if(mode==='STALE'){await expect(panel.getByRole('alert')).toContainText('CANDIDATE_POLICY_BASE_CHANGED');await expect(panel.getByRole('button',{name:'보존 자료 정책 명령 전송',exact:true})).toHaveCount(0);await expect(panel.getByLabel('자료 정책 변경 이유',{exact:true})).toHaveValue('본인 자료 작성만 명시 허용');expect(f.writes).toHaveLength(0);}
 else{
  const send=panel.getByRole('button',{name:'보존 자료 정책 명령 전송',exact:true});await expect(send).toBeVisible();expect(f.writes).toHaveLength(0);await send.click();
  if(mode==='LOSS'||mode==='LATE_SEND'){
   if(mode==='LOSS')await expect(panel.getByRole('alert')).toContainText('CONNECTION_LOST');else await page.waitForFunction(()=>(globalThis as any).candidatePolicySendReady===true);
   await page.evaluate(projectId=>{location.hash='/projects/'+projectId+'/workspace';},pid);await expect(page.getByRole('heading',{name:'정책 프로젝트',exact:true})).toBeVisible();await page.evaluate(projectId=>{location.hash='/projects/'+projectId+'/connections';},pid);await expect(panel.getByLabel('자료 정책 변경 이유',{exact:true})).toHaveValue('본인 자료 작성만 명시 허용');
   if(mode==='LATE_SEND'){await page.evaluate(()=>(globalThis as any).candidatePolicyReleaseSend());await page.waitForFunction(()=>(globalThis as any).candidatePolicySendReturned===true);await expect(panel.getByText('결과 미확인 · 원 명령/입력 보존, 다른 명령 자동 생성·정책 삭제 없음',{exact:true})).toBeVisible();expect(f.writes).toHaveLength(0);}
   await expect(panel.getByLabel('자료 정책 변경 이유',{exact:true})).toBeDisabled();await panel.getByRole('button',{name:'같은 자료 정책 명령 결과 확인',exact:true}).click();
  }
  if(mode==='REAUTH'){await expect(panel.getByRole('alert')).toContainText('REAUTHENTICATION_REQUIRED');await expect(panel.getByRole('button',{name:'거절된 자료 정책 명령 분리',exact:true})).toBeEnabled();await expect(panel.getByLabel('자료 정책 변경 이유',{exact:true})).toHaveValue('본인 자료 작성만 명시 허용');expect(f.writes).toHaveLength(1);}
  else {await expect(panel.getByRole('status')).toContainText('자료 정책 저장 확인');expect(f.writes).toHaveLength(mode==='LOSS'?2:1);if(mode==='LOSS')expect(f.writes[1]).toEqual(f.writes[0]);const c=f.writes[0];expect(c.clientId).toBe(uid);expect(c.controlGeneration).toBe(2);expect(c.payload.rules.at(-1)).toEqual({ruleId:mode==='EDIT'?'DOC':c.payload.rules.at(-1).ruleId,subjectRef:{kind:'HUMAN',userId:uid},operations:['saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:c.payload.rules.at(-1).expiresAt});if(mode==='EDIT'){expect(c.targetId).toBe(id);expect(c.expectedVersion).toBe(1);expect(c.payload.rules[0]).toMatchObject({ruleId:'CANDIDATE',operations:['registerConnection'],disposition:'DENY'});expect(c.payload.rules).toHaveLength(2);}else{expect(c.targetId).toBe(null);expect(c.expectedVersion).toBe(0);}}
 }
 if(mode==='LOSS')await expect(page.getByRole('region',{name:'후보 저장 권한 정책 편집',exact:true}).getByLabel('후보 정책 변경 이유',{exact:true})).toHaveValue('독립 후보 입력 보존');expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});


for(const disposition of ['AUTO','DENY','REQUIRE_APPROVAL'])test('MATERIAL_DETACH_POLICY_'+disposition,async({page})=>{
 const f=await fixture(page,'EDIT'),panel=page.getByRole('region',{name:'문서·방법론 권한 정책 편집',exact:true});await panel.getByRole('button',{name:'자료 정책 작성 준비',exact:true}).click();const action=panel.getByLabel('자료 정책 행동: 문서 소스 연결 해제',{exact:true});await expect(action).not.toBeChecked();await action.check();await panel.getByRole('combobox',{name:'자료 정책 처리',exact:true}).selectOption(disposition);await panel.getByLabel('자료 정책 만료 UTC',{exact:true}).fill(new Date(Date.now()+600000).toISOString());await panel.getByLabel('자료 정책 변경 이유',{exact:true}).fill('본인 연결 분리 정책');await panel.getByLabel('자료 정책 범위와 기존 규칙 보존 확인',{exact:true}).check();await expect(panel.getByText(/DOCUMENT_SOURCE_APPROVAL_NOT_CONNECTED/)).toBeVisible();await panel.getByRole('button',{name:'자료 정책 명령 준비',exact:true}).click();await expect(panel.getByRole('button',{name:'보존 자료 정책 명령 전송',exact:true})).toBeVisible();expect(f.writes).toHaveLength(0);await panel.getByRole('button',{name:'보존 자료 정책 명령 전송',exact:true}).click();await expect(panel.getByRole('status')).toContainText('자료 정책 저장 확인');expect(f.writes).toHaveLength(1);const rules=f.writes[0].payload.rules;expect(rules.slice(0,2)).toMatchObject([{ruleId:'DOC',operations:['saveDocumentDraft']},{ruleId:'CANDIDATE',operations:['registerConnection']}]);expect(rules[2]).toMatchObject({subjectRef:{kind:'HUMAN',userId:uid},operations:['detachDocumentSource'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition});expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});

test('MATERIAL_POLICY_APPROVAL_RECURSION',async({page})=>{
 const f=await fixture(page,'INITIAL'),panel=page.getByRole('region',{name:'문서·방법론 권한 정책 편집',exact:true});
 await panel.getByRole('button',{name:'자료 정책 작성 준비',exact:true}).click();
 await expect(panel.getByLabel('자료 정책 행동: 문서 초안 저장',{exact:true})).not.toBeChecked();
 await expect(panel.getByRole('combobox',{name:'자료 정책 처리',exact:true})).toHaveValue('DENY');
 await panel.getByLabel('자료 정책 행동: 일회 승인 요청',{exact:true}).check();
 await expect(panel.getByRole('combobox',{name:'자료 정책 처리',exact:true}).locator('option[value="REQUIRE_APPROVAL"]')).toHaveJSProperty('disabled',true);
 await expect(panel.getByRole('combobox',{name:'자료 정책 처리',exact:true})).toHaveValue('DENY');
 await expect(panel.getByLabel('자료 정책 행동: 도구 후보 저장',{exact:true})).toHaveCount(0);
 expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
