import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',at='2026-10-20T00:00:00.000Z';
for(const config of [
 {key:'SOURCE_OBSERVATION',noun:'소스 관측',title:'소스 읽기 관측 권한 정책',ops:['requestSourceReadObservation','revokeSourceReadObservation'],labels:['읽기 관측 허가 요청','읽기 관측 허가 회수'],guard:'SOURCE_READ_APPROVAL_NOT_CONNECTED'},
 {key:'BASELINE',noun:'시작 기준선',title:'시작 기준선 권한 정책',ops:['saveBaselineDraft','reviewBaselineContent','confirmBaseline'],labels:['시작 기준선 초안 저장','시작 기준선 내용 검토','시작 기준선 별도 확정'],guard:'BASELINE_APPROVAL_NOT_CONNECTED'}
]){
async function fixture(page:Page,mode:string){
 const rule={ruleId:'DOC',subjectRef:{kind:'HUMAN',userId:uid},operations:['saveDocumentDraft'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'DENY',limitPolicyRef:null,expiresAt:'2099-10-20T00:00:00.000Z'},original={rules:[rule],reason:'기존 문서 보존',reviewRefs:[]};
 let policy:any={ref:{id,version:1,contentHash:contentHash(canonicalJson(original))},...original,createdAt:at};const writes:any[]=[],unknown:string[]=[],errors:string[]=[],receipts=new Map<string,any>();
 await installWorkspaceBundle(page);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'소스 선언 권한 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/*',r=>r.fulfill({json:{id:new URL(r.request().url()).pathname.split('/').at(-1),participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}}}));
 for(const path of ['connector-registrations','source-roots','source-read-grants'])await page.route('**/api/v1/projects/*/'+path+'?*',r=>r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}}));
 await page.route('**/api/v1/projects/*/connection-candidates?*',r=>r.fulfill({json:{view:'CANDIDATES_ONLY',items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/permission-policy',r=>r.fulfill({json:{configured:true,policy}}));
 await page.route('**/api/v1/projects/'+pid+'/commands',r=>{const c=r.request().postDataJSON();writes.push(c);expect(c.operation).toBe('savePermissionPolicy');expect(c.approvalRef).toBeNull();expect(c.payload.rules[0]).toEqual(rule);expect(c.payload.rules[1].subjectRef).toEqual({kind:'HUMAN',userId:uid});expect(c.payload.rules[1].operations).toEqual(config.ops);let receipt=receipts.get(c.commandId);if(!receipt){const ref={id,version:2,contentHash:contentHash(canonicalJson(c.payload))};policy={ref,...c.payload,createdAt:at};receipt={operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:id,version:2,data:{status:'POLICY_SAVED',ref},serverReceivedAt:at};receipts.set(c.commandId,receipt);}if(mode==='LOSS'&&writes.length===1)return r.abort('connectionreset');return r.fulfill({json:receipt});});
 await page.goto('/#/projects/'+pid+'/connections');return{writes,unknown,errors,bump:()=>{policy={...policy,ref:{id,version:2,contentHash:contentHash(canonicalJson({...original,reason:'별도 관리 변경'}))},reason:'별도 관리 변경'};}};
}
for(const mode of ['FLOW','LOSS','STALE'])test(config.key+'_POLICY_'+mode,async({page})=>{
 const f=await fixture(page,mode),panel=page.getByRole('region',{name:config.title+' 편집',exact:true});await panel.getByRole('button',{name:config.noun+' 정책 작성 준비',exact:true}).click();await expect(panel.getByRole('combobox',{name:config.noun+' 정책 처리',exact:true})).toHaveValue('DENY');expect(f.writes).toHaveLength(0);
 for(const label of config.labels)await panel.getByLabel(config.noun+' 정책 행동: '+label,{exact:true}).check();await panel.getByRole('combobox',{name:config.noun+' 정책 처리',exact:true}).selectOption('AUTO');await panel.getByLabel(config.noun+' 정책 만료 UTC',{exact:true}).fill(new Date(Date.now()+600000).toISOString());await panel.getByLabel(config.noun+' 정책 변경 이유',{exact:true}).fill('본인 프로젝트 위치 선언만');await panel.getByLabel(config.noun+' 정책 범위와 기존 규칙 보존 확인',{exact:true}).check();
 await expect(panel).toContainText(config.guard);if(mode==='STALE')f.bump();await panel.getByRole('button',{name:config.noun+' 정책 명령 준비',exact:true}).click();
 if(mode==='STALE'){await expect(panel.getByRole('alert')).toContainText('CANDIDATE_POLICY_BASE_CHANGED');expect(f.writes).toHaveLength(0);await expect(panel.getByLabel(config.noun+' 정책 변경 이유',{exact:true})).toHaveValue('본인 프로젝트 위치 선언만');}
 else{expect(f.writes).toHaveLength(0);await panel.getByRole('button',{name:'보존 '+config.noun+' 정책 명령 전송',exact:true}).click();if(mode==='LOSS'){await expect(panel.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(panel.getByLabel(config.noun+' 정책 행동: '+config.labels[0],{exact:true})).toBeDisabled();await page.evaluate(()=>location.hash='/projects/44444444-4444-4444-8444-444444444444/connections');await expect(panel.getByLabel(config.noun+' 정책 변경 이유',{exact:true})).toHaveCount(0);await page.evaluate(p=>location.hash='/projects/'+p+'/connections',pid);await expect(panel.getByLabel(config.noun+' 정책 변경 이유',{exact:true})).toHaveValue('본인 프로젝트 위치 선언만');await panel.getByRole('button',{name:'같은 '+config.noun+' 정책 명령 결과 확인',exact:true}).click();await expect.poll(()=>f.writes.length).toBe(2);expect(f.writes[1]).toEqual(f.writes[0]);}await expect(panel.getByRole('status')).toContainText(config.noun+' 정책 저장 확인');}
 expect({errors:f.errors,unknown:f.unknown}).toEqual({errors:[],unknown:[]});
});

}
