import {test,expect,type Page} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
async function installWorkspaceBundle(page:Page){
 const root=process.env.ANVIL_UI14_QA_DIST;
 if(root!=='D:/tmp/anvil-v3-stage-b/ui14-in-app-notifications-20261027-01/bundle')throw Error('UI14_QA_ROOT_UNREGISTERED');
 const files=new Map<string,{body:Buffer;contentType:string}>();files.set('/',{body:await readFile(root+'/index.html'),contentType:'text/html'});
 for(const name of await readdir(root+'/assets')){if(!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name))throw Error('UI14_QA_ASSET_UNEXPECTED');files.set('/assets/'+name,{body:await readFile(root+'/assets/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'});}
 await page.route(/^https:\/\/localhost:3830\/(?:$|\?qa-notification-denied=404$|assets\/)/,r=>{const file=files.get(new URL(r.request().url()).pathname);return r.request().method()==='GET'&&file?r.fulfill({status:200,...file}):r.abort();});
}
import {notificationIds as i,notificationAt as at,notificationFixture} from './project-notifications-harness.tsx';
async function setup(page:Page){
 const posts:any[]=[],gets:string[]=[],unexpected:string[]=[],errors:string[]=[];let mode='NORMAL',read=false;
 await installWorkspaceBundle(page);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/**',async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname;
  if(u.origin!=='https://localhost:3830'){unexpected.push(req.method()+' '+u.origin);return r.abort();}
  if(p==='/api/v1/session')return r.fulfill({json:{user:{id:i.user,displayName:'QA'},clientId:i.client,csrfToken:'C'.repeat(43)}});
  if(p===`/api/v1/projects/${i.project}`)return r.fulfill({json:{id:i.project,participation:'OWNER',controlState:{actorId:i.user,clientId:i.client,generation:1,status:'HELD'}}});
  if(p===`/api/v1/projects/${i.project}/notifications`){gets.push(req.method()+' '+p+u.search);if(mode==='STORAGE')return r.fulfill({status:503,json:{code:'NOTIFICATION_STORAGE_NOT_READY'}});const d=notificationFixture();d.readAt=read?at:null;return r.fulfill({json:{items:[d],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}});}
  if(p===`/api/v1/projects/${i.project}/notifications/${i.notification}`){gets.push(req.method()+' '+p);if(mode==='READBACK')return r.fulfill({status:503,json:{code:'NOTIFICATION_STORAGE_FAILED'}});if(mode==='GONE')return r.fulfill({status:404,json:{code:'NOT_FOUND'}});const d=notificationFixture();d.readAt=read?at:null;return r.fulfill({json:d});}
  if(p===`/api/v1/projects/${i.project}/commands`){const c=req.postDataJSON();posts.push(c);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});read=true;if(mode==='LOST')return r.abort();if(mode==='UNCERTAIN')return r.fulfill({status:503,json:{code:'NOTIFICATION_READ_RESULT_UNCERTAIN'}});return r.fulfill({json:{commandId:c.commandId,operationId:i.client,projectId:i.project,status:'APPLIED',targetId:i.notification,version:1,data:{status:'NOTIFICATION_READ',ref:c.payload.notificationRef,readAt:at},evidenceRefs:[],warnings:[],serverReceivedAt:at}});}
  // 기존 설정의 독립 조회는 이 fixture의 검증 대상이 아니다.
  if(p.endsWith('/permission-policy'))return r.fulfill({json:{configured:false,policy:null}});
  if(req.method()==='GET'&&p===`/api/v1/projects/${i.project}/queue`)return r.fulfill({status:503,json:{code:'STORAGE_FAILED'}});
  unexpected.push(req.method()+' '+p);return r.fulfill({status:404,json:{code:'NOT_FOUND'}});
 });
 await page.goto(`/#/projects/${i.project}/settings`);
 return{posts,gets,unexpected,errors,setMode:(value:string)=>mode=value,panel:page.getByRole('region',{name:'본인 프로젝트 승인 알림',exact:true})};
}
test('실제 App 설정에서 명시 조회/원요청 이동만으로 POST하지 않고 보안 입력을 보존한다',async({page})=>{
 const x=await setup(page),p=x.panel;await expect(p).toBeVisible();await expect(p).toContainText('아직 조회하지 않았습니다');expect(x.gets).toEqual([]);
 await page.getByLabel('재인증 비밀번호',{exact:true}).fill('retained reauth');await page.getByLabel('현재 비밀번호',{exact:true}).fill('retained current');await page.getByLabel('새 비밀번호',{exact:true}).fill('retained new password');
 await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await p.getByRole('button',{name:'알림 상세 조회',exact:true}).click();
 await expect(p.getByRole('link',{name:'같은 요청 PC 화면',exact:true})).toHaveAttribute('href',`#/projects/${i.project}/approvals/requests/${i.request}`);
 await expect(p.getByRole('link',{name:'같은 요청 모바일 화면',exact:true})).toHaveAttribute('href',`#/projects/${i.project}/mobile/approvals/requests/${i.request}`);
 expect(x.posts).toEqual([]);await expect(page.getByLabel('재인증 비밀번호',{exact:true})).toHaveValue('retained reauth');await expect(page.getByLabel('현재 비밀번호',{exact:true})).toHaveValue('retained current');await expect(page.getByLabel('새 비밀번호',{exact:true})).toHaveValue('retained new password');expect(x.errors).toEqual([]);expect(x.unexpected).toEqual([]);
});
test('읽음은 클릭한 한 명령만 전송하고 receipt와 재조회 결과를 구분한다',async({page})=>{const x=await setup(page),p=x.panel;await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await p.getByRole('button',{name:'알림 상세 조회',exact:true}).click();x.setMode('READBACK');await p.getByRole('button',{name:'명시적으로 읽음 표시',exact:true}).click();await expect(p).toContainText('읽음 처리 확인');await expect(p).toContainText('후속 조회 실패');expect(x.posts).toHaveLength(1);expect(x.posts[0].operation).toBe('markNotificationRead');expect(x.posts[0].expectedVersion).toBe(1);expect(x.errors).toEqual([]);});
for(const mode of ['LOST','UNCERTAIN'])test(mode+' 결과는 설정 왕복 뒤 원명령만 명시 재확인한다',async({page})=>{const x=await setup(page),p=x.panel;await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await p.getByRole('button',{name:'알림 상세 조회',exact:true}).click();x.setMode(mode);await p.getByRole('button',{name:'명시적으로 읽음 표시',exact:true}).click();await expect(p).toContainText('처리 결과 미확인');await expect.poll(()=>x.posts.length).toBe(1);await expect(p.getByRole('button',{name:'같은 명령 결과 재확인',exact:true})).toBeEnabled();await expect(p.getByText('알림 조회·결과 확인 중',{exact:true})).toHaveCount(0);await expect(p.getByRole('button',{name:'상세 닫기',exact:true})).toBeDisabled();await page.evaluate(()=>location.hash='#/settings');await expect(p).toContainText('프로젝트를 선택');await page.evaluate(pid=>location.hash=`#/projects/${pid}/settings`,i.project);await expect(p).toContainText('처리 결과 미확인');await expect.poll(()=>x.posts.length).toBe(1);await expect(p.getByRole('button',{name:'같은 명령 결과 재확인',exact:true})).toBeEnabled();await expect(p.getByText('알림 조회·결과 확인 중',{exact:true})).toHaveCount(0);expect(x.posts).toHaveLength(1);x.setMode('NORMAL');await p.getByRole('button',{name:'같은 명령 결과 재확인',exact:true}).click();await expect(p).toContainText('읽음 처리 확인');expect(x.posts).toHaveLength(2);expect(x.posts[1]).toEqual(x.posts[0]);expect(x.errors).toEqual([]);});
test('저장소 503은 실제 빈목록으로 숨기지 않으며 명시 재조회할 수 있다',async({page})=>{const x=await setup(page),p=x.panel;x.setMode('STORAGE');await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await expect(p.getByRole('alert')).toContainText('알림 저장소');await expect(p).not.toContainText('조회된 알림이 없습니다');expect(x.posts).toEqual([]);x.setMode('NORMAL');await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await expect(p.getByRole('button',{name:'알림 상세 조회',exact:true})).toBeVisible();});
test('현재 권한 거절을 안내하고 새 승인·정책 변경을 만들지 않는다',async({page})=>{const x=await setup(page),p=x.panel;await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await p.getByRole('button',{name:'알림 상세 조회',exact:true}).click();x.setMode('DENIED');await p.getByRole('button',{name:'명시적으로 읽음 표시',exact:true}).click();await expect(p.getByRole('alert')).toContainText('권한');expect(x.posts).toHaveLength(1);expect(x.posts[0].operation).toBe('markNotificationRead');expect(x.unexpected).toEqual([]);});
test('1920과 좁은 화면에서 알림 명시 조회는 키보드로 가능하고 가로 넘침이 없다',async({page})=>{const x=await setup(page);for(const width of [1920,390]){await page.setViewportSize({width,height:1080});await x.panel.getByRole('button',{name:'알림 처음 조회',exact:true}).focus();await page.keyboard.press('Enter');await expect(x.panel.getByRole('button',{name:'알림 상세 조회',exact:true})).toBeVisible();expect(await x.panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);}expect(x.errors).toEqual([]);});

test('교차경로 I1 읽음 원문 접근을 회복해도 미확인 원명령의 재확인은 계속 가능하다',async({page})=>{
 const x=await setup(page),p=x.panel;
 await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await p.getByRole('button',{name:'알림 상세 조회',exact:true}).click();
 x.setMode('LOST');await p.getByRole('button',{name:'명시적으로 읽음 표시',exact:true}).click();await expect(p).toContainText('처리 결과 미확인');await expect.poll(()=>x.posts.length).toBe(1);await expect(p.getByRole('button',{name:'같은 명령 결과 재확인',exact:true})).toBeEnabled();await expect(p.getByText('알림 조회·결과 확인 중',{exact:true})).toHaveCount(0);expect(x.posts).toHaveLength(1);
 x.setMode('DENIED');await p.getByRole('button',{name:'같은 명령 결과 재확인',exact:true}).click();await expect.poll(()=>x.posts.length).toBe(2);await expect(p.getByRole('alert')).toContainText('권한');await expect(p.getByText('알림 조회·결과 확인 중',{exact:true})).toHaveCount(0);expect(x.posts).toHaveLength(2);expect(x.posts[1]).toEqual(x.posts[0]);
 x.setMode('NORMAL');await p.getByRole('button',{name:'원알림 접근 다시 확인',exact:true}).click();await expect(p.getByText('읽음 · '+at,{exact:true})).toBeVisible();
 const reconcile=p.getByRole('button',{name:'같은 명령 결과 재확인',exact:true});await expect(reconcile).toBeEnabled();await reconcile.click();
 await expect(p).toContainText('읽음 처리 확인');await expect(p).not.toContainText('처리 결과 미확인');expect(x.posts).toHaveLength(3);for(const command of x.posts)expect(command).toEqual(x.posts[0]);expect(x.errors).toEqual([]);expect(x.unexpected).toEqual([]);
});
test('교차경로 I2 즉시 후속403·404가 확정 receipt를 미확인으로 되돌리지 않는다',async({page})=>{
 await page.addInitScript(({project,notification,client,receivedAt})=>{
  const nativeFetch=window.fetch.bind(window),qa={applied:false,status:new URL(location.href).searchParams.get('qa-notification-denied')==='404'?404:403,posts:[] as unknown[],followups:0};
  (window as any).qaNotificationFastFetch=qa;
  // 실제 ApiClient가 소비하는 Response만 즉시 반환하여 같은 task의 React batching 경계를 재현한다.
  const immediate=(value:unknown,status=200)=>{const response=new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});Object.defineProperty(response,'json',{value:()=>Promise.resolve(value)});return Promise.resolve(response);};
  window.fetch=((input:RequestInfo|URL,init?:RequestInit)=>{
   const address=new URL(input instanceof Request?input.url:String(input),location.href),method=init?.method??(input instanceof Request?input.method:'GET');
   if(address.origin===location.origin&&method==='POST'&&address.pathname===`/api/v1/projects/${project}/commands`&&typeof init?.body==='string'){
    const command=JSON.parse(init.body);if(command.operation!=='markNotificationRead')return nativeFetch(input,init);
    qa.posts.push(command);qa.applied=true;
    return immediate({commandId:command.commandId,operationId:client,projectId:project,status:'APPLIED',targetId:notification,version:1,data:{status:'NOTIFICATION_READ',ref:command.payload.notificationRef,readAt:receivedAt},evidenceRefs:[],warnings:[],serverReceivedAt:receivedAt});
   }
   if(qa.applied&&address.origin===location.origin&&method==='GET'&&address.pathname===`/api/v1/projects/${project}/notifications/${notification}`){qa.followups++;return immediate({code:qa.status===403?'FORBIDDEN':'NOT_FOUND'},qa.status);}
   return nativeFetch(input,init);
  }) as typeof fetch;
 },{project:i.project,notification:i.notification,client:i.client,receivedAt:at});
 const x=await setup(page),p=x.panel;
 for(const deniedStatus of [403,404]){
  if(deniedStatus===404)await page.goto(`/?qa-notification-denied=404#/projects/${i.project}/settings`);
  await p.getByRole('button',{name:'알림 처음 조회',exact:true}).click();await p.getByRole('button',{name:'알림 상세 조회',exact:true}).click();
  await p.getByRole('button',{name:'명시적으로 읽음 표시',exact:true}).click();await expect(p.getByRole('alert')).toContainText('후속 조회 실패');
  const observed=await page.evaluate(()=>{const q=(window as any).qaNotificationFastFetch;return{status:q.status,posts:q.posts,followups:q.followups};});expect(observed.status).toBe(deniedStatus);expect(observed.posts).toHaveLength(1);expect(observed.followups).toBe(1);
  await expect(p).toContainText('읽음 처리 확인');await expect(p).not.toContainText('처리 결과 미확인');await expect(p.getByRole('link',{name:'같은 요청 PC 화면',exact:true})).toHaveCount(0);await expect(p.getByRole('link',{name:'같은 요청 모바일 화면',exact:true})).toHaveCount(0);await expect(p.getByRole('button',{name:'알림 처음 조회',exact:true})).toBeEnabled();
 }
 expect(x.posts).toEqual([]);expect(x.errors).toEqual([]);expect(x.unexpected).toEqual([]);
 if(process.env.ANVIL_UI14_QA_DIST!=='D:/tmp/anvil-v3-stage-b/ui14-in-app-notifications-20261027-01/bundle')throw Error('UI14_QA_SCREENSHOT_ROOT_UNREGISTERED');
 await page.setViewportSize({width:1920,height:1080});
 await page.screenshot({path:'D:/tmp/anvil-v3-stage-b/ui14-in-app-notifications-20261027-01/screenshots/i2-final-1920.png',fullPage:false});
});
