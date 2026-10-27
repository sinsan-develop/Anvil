import {test,expect,type Page} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const root=process.env.ANVIL_UI11_LIMIT_POLICY_APPROVAL_DIST;
if(root!=='D:/tmp/anvil-v3-stage-b/ui11-limit-policy-approval-20261027-01/dist')throw Error('LIMIT_POLICY_APPROVAL_QA_PATH_INVALID');
const hash=(v:unknown)=>contentHash(canonicalJson(v)),id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function installWorkspaceBundle(page:Page){
 const files=new Map<string,{body:Buffer;contentType:string}>();files.set('/',{body:await readFile(root+'/index.html'),contentType:'text/html'});
 for(const name of await readdir(root+'/assets')){if(!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('LIMIT_POLICY_APPROVAL_QA_ASSET_INVALID');files.set('/assets/'+name,{body:await readFile(root+'/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'});}
 await page.route(/^https:\/\/localhost:3830\/(?:$|assets\/)/,r=>{const f=files.get(new URL(r.request().url()).pathname);return r.request().method()==='GET'&&f?r.fulfill({status:200,...f}):r.abort();});
}


for(const mode of ['FLOW','AUTO_NULL','LOST_REQUEST','LOST_WRITE','GET_FAIL','REJECTED','REVOKED_POLICY','UNKNOWN412','LEAVE_INFLIGHT'])test('LIMIT_POLICY_APPROVAL_'+mode,async({page})=>{
 const pid=id(1),uid=id(2),at='2026-10-27T00:00:00.000Z',commands:any[]=[],unknown:string[]=[],errors:string[]=[],stored=new Map<number,any>(),receipts=new Map<string,any>(),views=new Map<string,any>();let releaseFirst=()=>{};const firstGate=new Promise<void>(resolve=>releaseFirst=resolve);let stores=0,policyVersion=1,readCount=0,lostRequest=false,lostWrite=false;
 const policyBody={rules:[{ruleId:'LIMIT',subjectRef:{kind:'HUMAN',userId:uid},operations:['applyLimitPolicy','revokeLimitPolicy'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:mode==='AUTO_NULL'?'AUTO':'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},{ruleId:'DECISIONS',subjectRef:{kind:'HUMAN',userId:uid},operations:['requestApproval','decideApproval'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'한도 원명령 별도 승인',reviewRefs:[]};
 const policyRef=()=>({id:id(10),version:policyVersion,contentHash:hash(policyBody)});
 const result=(c:any,data:any)=>({operationId:crypto.randomUUID(),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:data.ref.id,version:data.ref.version,data,evidenceRefs:[],warnings:[],serverReceivedAt:at});
 await page.route('**/*',r=>{unknown.push(r.request().method()+' '+r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'한도 승인 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:2,status:'HELD'}}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const path=new URL(r.request().url()).pathname,b='/api/v1/projects/'+pid+'/';let body:any;
  if(path===b+'permission-policy')body={configured:true,policy:{ref:policyRef(),...policyBody,createdAt:at}};
  else if(path===b+'connection-candidates')body={view:'CANDIDATES_ONLY',items:[],hasMore:false,nextCursor:null,observedAt:at};
  else if(['connector-registrations','source-roots','source-read-grants'].some(x=>path===b+x))return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});
  else if(path===b+'approvals')body={items:[],hasMore:false,nextCursor:null,observedAt:at};
  else if(path.startsWith(b+'approvals/'))body=views.get(path.split('/').at(-1)!);
  else if(path.startsWith(b+'limit-policies/')){readCount++;if(mode==='GET_FAIL'&&readCount===1)return r.fulfill({status:503,json:{code:'LIMIT_POLICY_SOURCE_UNAVAILABLE'}});const v=Number(path.split('/').at(-1));body=stored.get(v);}
  else if(path===b+'commands'){
   const c=r.request().postDataJSON();commands.push(c);body=receipts.get(c.commandId);
   if(!body){
    if(['applyLimitPolicy','revokeLimitPolicy'].includes(c.operation)){
     const originals=commands.filter(x=>['applyLimitPolicy','revokeLimitPolicy'].includes(x.operation));if(mode==='UNKNOWN412'&&originals.length===1)return r.abort();if(mode==='LEAVE_INFLIGHT'&&originals.length===1){await firstGate;return r.fulfill({status:412,json:{code:'APPROVAL_REQUIRED'}});}
     if(c.approvalRef===null&&mode!=='AUTO_NULL')return r.fulfill({status:412,json:{code:'APPROVAL_REQUIRED'}});
     if(mode!=='AUTO_NULL'){const v=views.get(c.approvalRef.requestId);expect(v.effectiveState).toBe('APPROVED');expect(v.request.details.candidateCommandId).toBe(c.commandId);expect(v.request.details.actionScope.payloadHash).toBe(hash(c.payload));expect(v.request.details.actionScope.operation).toBe(c.operation);expect(v.request.details.actionScope.targetRef).toEqual(stored.get(c.expectedVersion)?.ref??null);}
     const base=stored.get(c.expectedVersion),snapshot={...c.payload,limits:c.payload.limits??base.snapshot.limits,state:c.operation==='applyLimitPolicy'?'APPLIED':'REVOKED',previousRef:base?.ref??null,decidedBy:{kind:'HUMAN',userId:uid},decidedAt:at,expiresAt:c.operation==='applyLimitPolicy'?new Date(Date.parse(at)+c.payload.limits.maxElapsedMs).toISOString():base.snapshot.expiresAt,executionAuthorized:false,dispatchPerformed:false},ref={id:id(20),version:c.expectedVersion+1,contentHash:hash(snapshot)};
     stores++;stored.set(ref.version,{projectId:pid,ref,snapshot});body=result(c,{status:c.operation==='applyLimitPolicy'?'LIMIT_POLICY_APPLIED':'LIMIT_POLICY_REVOKED',ref,snapshot});receipts.set(c.commandId,body);if(mode==='LOST_WRITE'&&!lostWrite){lostWrite=true;return r.abort();}
    }else if(c.operation==='requestApproval'){
     const requestId=id(70+views.size),details=c.payload.details,scopeDigest=hash(details.actionScope),snapshot={projectId:pid,details,scopeDigest,requiredDecider:{kind:'HUMAN',userId:uid},policyRef:policyRef(),requestedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:2},ref={id:requestId,version:1,contentHash:hash(snapshot)},request={id:requestId,version:1,status:'PENDING',...snapshot,createdAt:at};views.set(requestId,{request,requestRef:ref,currentVersion:1,storedStatus:'PENDING',effectiveState:'PENDING',decision:null,consumption:null,expired:false,basisCurrent:true,executionAuthorized:false,observedAt:at});body=result(c,{ref,status:'APPROVAL_REQUESTED',request});receipts.set(c.commandId,body);if(mode==='LOST_REQUEST'&&!lostRequest){lostRequest=true;return r.abort();}
    }else if(c.operation==='decideApproval'){
     const v=views.get(c.targetId),requestId=c.targetId,snapshot={requestId,requestVersion:1,requestRef:v.requestRef,scopeDigest:v.request.scopeDigest,decision:c.payload.decision,reason:c.payload.reason,decidedBy:{kind:'HUMAN',userId:uid,clientId:uid},controlGeneration:2,policyRef:policyRef()},ref={id:id(100+views.size),version:1,contentHash:hash(snapshot)},decision={id:ref.id,...snapshot,decidedAt:at},status=c.payload.decision==='REJECT'?'REJECTED':'APPROVED';views.set(requestId,{...v,currentVersion:2,storedStatus:status,effectiveState:status,decision:{ref,...decision}});body=result(c,{ref,status:'APPROVAL_DECIDED',decision});receipts.set(c.commandId,body);
    }else{unknown.push(c.operation);return r.abort();}
   }
  }else{unknown.push(r.request().method()+' '+path);return r.abort();}
  return r.fulfill({json:body});
 });
 page.on('pageerror',e=>errors.push(e.message));await page.goto('/#/projects/'+pid+'/connections');const panel=page.getByRole('region',{name:'프로젝트 한도 정책',exact:true});
 const rounds=mode==='FLOW'?3:1;
 for(let n=0;n<rounds;n++){
  if(n===0)await panel.getByRole('button',{name:'새 프로젝트 한도 작성',exact:true}).click();else await panel.getByRole('button',{name:'이 한도 버전에서 작성',exact:true}).click();
  await panel.getByRole('textbox',{name:'한도 정책 사유',exact:true}).fill('한도 원명령 '+n);if(n===1)await panel.getByRole('spinbutton',{name:'최대 호출 수',exact:true}).fill('49');
  if(n===2){page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'선택 버전 한도 회수 요청',exact:true}).click();}else await panel.getByRole('button',{name:'한도 정책 명시 저장',exact:true}).click();
  expect(stores).toBe(n);await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();
  if(mode==='LEAVE_INFLIGHT'){
   await expect.poll(()=>commands.length).toBe(1);await page.evaluate(()=>{location.hash='/not-found';});await expect(panel).toHaveCount(0);await page.evaluate(projectId=>{location.hash='/projects/'+projectId+'/connections';},pid);await expect(panel.getByRole('textbox',{name:'한도 정책 사유',exact:true})).toHaveValue('한도 원명령 0');
   await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('APPROVAL_REQUIRED');await expect(panel.getByRole('button',{name:'한도 승인 요청 준비',exact:true})).toHaveCount(0);releaseFirst();expect(commands[0]).toEqual(commands[1]);expect(stores).toBe(0);expect(errors).toEqual([]);return;
  }
  if(mode==='UNKNOWN412'){await expect(panel.getByRole('button',{name:'같은 한도 명령 결과 확인',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'같은 한도 명령 결과 확인',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('APPROVAL_REQUIRED');await expect(panel.getByRole('button',{name:'한도 승인 요청 준비',exact:true})).toHaveCount(0);expect(commands[0]).toEqual(commands[1]);expect(stores).toBe(0);expect(unknown).toEqual([]);expect(errors).toEqual([]);return;}
  if(mode!=='AUTO_NULL'){
   await panel.getByRole('button',{name:'한도 승인 요청 준비',exact:true}).click();const approval=panel.getByRole('region',{name:'한도 원명령 일회 승인',exact:true});
   for(const label of ['한도 승인 요청 이유','한도 데이터 위험','한도 보안 위험','한도 비용 위험','한도 중단 영향','한도 미확인 사항','한도 복구 방법','한도 복구 한계'])await approval.getByRole('textbox',{name:label,exact:true}).fill('정확 검토');await approval.getByRole('textbox',{name:'한도 승인 만료 UTC',exact:true}).fill('2098-01-01T00:00:00.000Z');await approval.getByRole('button',{name:'한도 원명령 승인 요청 저장',exact:true}).click();
   if(mode==='LOST_REQUEST'){await expect(approval.getByRole('button',{name:'같은 한도 승인 요청 결과 확인',exact:true})).toBeEnabled();await approval.getByRole('button',{name:'같은 한도 승인 요청 결과 확인',exact:true}).click();await expect.poll(()=>commands.filter(c=>c.operation==='requestApproval').length).toBe(2);const reqs=commands.filter(c=>c.operation==='requestApproval');expect(reqs[0]).toEqual(reqs[1]);}
   const link=approval.getByRole('link',{name:'이 한도 승인 요청에서 별도 결정',exact:true});await expect(link).toBeVisible();expect(stores).toBe(n);
   if(mode==='REVOKED_POLICY'){policyVersion++;for(const v of views.values()){v.basisCurrent=false;v.effectiveState='REVOKED';}}
   await link.click();await expect(page.getByRole('heading',{name:/요청 .* · (PENDING|REVOKED)/,level:3})).toBeVisible();
   if(mode!=='REVOKED_POLICY'){
    // 다른 원명령 결정 입력과 이전 확인을 자동 재사용하지 않는다.
    if(n>0){await page.getByRole('button',{name:'결정 입력 닫기',exact:true}).click();await page.getByRole('button',{name:'이 요청 결정 준비',exact:true}).click();}
    await page.getByRole('textbox',{name:'결정 이유',exact:true}).fill('이번 원명령 확인');const ack=page.getByRole('checkbox',{name:'정확 범위·위험·복구 한계를 확인했습니다',exact:true});await ack.uncheck();await ack.check();await page.getByRole('button',{name:mode==='REJECTED'?'거절':'이번만 승인',exact:true}).click();await expect(page.getByRole('heading',{name:mode==='REJECTED'?/요청 .* · REJECTED/:/요청 .* · APPROVED/,level:3})).toBeVisible();
   }
   expect(stores).toBe(n);await page.getByRole('link',{name:'한도 원명령으로 돌아가 별도 승인 결박·저장',exact:true}).click();await expect(panel.getByRole('textbox',{name:'한도 정책 사유',exact:true})).toHaveValue('한도 원명령 '+n);
   if(mode==='REJECTED'||mode==='REVOKED_POLICY'){await panel.getByRole('button',{name:'한도 승인 종결 상태 확인',exact:true}).click();await panel.getByRole('button',{name:'종결된 한도 승인 종료·입력 수정',exact:true}).click();await expect(panel.getByRole('textbox',{name:'한도 정책 사유',exact:true})).toBeEnabled();await expect(panel).toContainText('종결된 한도 승인');expect(stores).toBe(0);expect(unknown).toEqual([]);expect(errors).toEqual([]);return;}
   await panel.getByRole('button',{name:'한도 승인 재조회·원 한도 명령 결박',exact:true}).click();await expect(panel).toContainText('한도 승인 결박 확인');expect(stores).toBe(n);await panel.getByRole('button',{name:'동결 한도 명령 명시 전송',exact:true}).click();
   if(mode==='LOST_WRITE'){await expect(panel.getByRole('button',{name:'같은 한도 명령 결과 확인',exact:true})).toBeEnabled();await panel.getByRole('button',{name:'같은 한도 명령 결과 확인',exact:true}).click();await expect.poll(()=>commands.filter(c=>c.approvalRef!==null).length).toBe(2);const writes=commands.filter(c=>c.approvalRef!==null);expect(writes.at(-1)).toEqual(writes.at(-2));}
  }
  const completed='한도 보관 확인 · v'+(n+1)+' · '+(n===2?'REVOKED':'APPLIED')+' · 실행 허가 아님';await expect(panel.getByRole('status').filter({hasText:new RegExp('^'+completed+'$')})).toBeVisible();expect(stores).toBe(n+1);await panel.getByRole('button',{name:'정확 한도 버전 조회',exact:true}).click();
  if(mode==='GET_FAIL'){await expect(panel.getByRole('alert')).toContainText('LIMIT_POLICY_SOURCE_UNAVAILABLE');await expect(panel).toContainText('한도 보관 확인');expect(stores).toBe(1);await panel.getByRole('button',{name:'정확 한도 버전 조회',exact:true}).click();}
  await expect(panel.getByRole('article',{name:'보관 한도 정책',exact:true})).toContainText(stored.get(n+1).ref.contentHash);if(n<rounds-1)await panel.getByRole('button',{name:'한도 작성 닫기',exact:true}).click();
 }
 const writes=commands.filter(c=>['applyLimitPolicy','revokeLimitPolicy'].includes(c.operation));if(mode!=='AUTO_NULL')for(const c of writes.filter(c=>c.approvalRef!==null)){const raw=writes.find(x=>x.commandId===c.commandId&&x.approvalRef===null);expect(c.payload).toEqual(raw.payload);expect(c.expectedVersion).toBe(raw.expectedVersion);expect(c.targetId).toBe(raw.targetId);}
 if(mode==='FLOW'){expect(views.size).toBe(3);expect(new Set(writes.filter(c=>c.approvalRef!==null).map(c=>c.approvalRef.requestId)).size).toBe(3);expect(stored.get(3).snapshot.limits).toEqual(stored.get(2).snapshot.limits);expect(stored.get(3).snapshot.expiresAt).toBe(stored.get(2).snapshot.expiresAt);}
 expect(unknown).toEqual([]);expect(errors).toEqual([]);
});
