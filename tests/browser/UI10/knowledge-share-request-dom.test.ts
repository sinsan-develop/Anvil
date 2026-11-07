import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {userInfo} from 'node:os';
import {build} from 'vite';
import {chromium,expect,type Page} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const qaRoot=resolve('D:/tmp/anvil-v3-fn05-share-request-dom-20261028-01');
const id=(n:number)=>'a6f50500-0000-4000-8000-'+String(n).padStart(12,'0');
function seed(mode='PAGE'){
 const projectId=id(1),targetId=id(2),at='2026-10-28T00:00:00.000Z',session={user:{id:id(3)},clientId:id(4),csrfToken:'C'.repeat(43)},body='출발 원문 <script>window.SHARE_XSS=1</script>';
 const entry={kind:'FACT',title:'공유 요청용 고정 지식',contentRef:{artifactId:id(5),bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'요청은 원문을 복제하지 않는다',scope:{projectId,stageRefs:[],taskRefs:[]},relatedRefs:[]};
 const ref={id:id(6),version:1,contentHash:contentHash(canonicalJson(entry))},knowledge={ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:id(5),kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:session.user.id},recordedAt:at}]};
 return{mode,projectId,targetId,at,session,knowledge,requestId:id(7),policyRef:{id:id(8),version:1,contentHash:'a'.repeat(64)},otherUser:id(9),otherClient:id(10),otherProject:id(11),project:{id:projectId,name:'합성 출발 프로젝트',purpose:'요청 보관',desiredOutcome:'출발측 metadata 보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:null,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:session.user.id,clientId:session.clientId,generation:1}}};
}
const panel=(p:Page)=>p.getByRole('region',{name:'지식 공유 요청 보관',exact:true});
const detail=(p:Page)=>p.getByRole('region',{name:'보관 공유 요청 상세',exact:true});
async function qa(p:Page){return p.evaluate(()=>{const q=(window as any).__shareQA;return{calls:q.calls,writes:q.writes,unknown:q.unknown,buffer:q.buffer,records:q.records.size,authLost:q.authLost};});}
async function select(p:Page,app=false,pending?:unknown){const before=await qa(p);if(app){await p.getByRole('button',{name:'제목·이유 검색',exact:true}).click();await p.getByRole('button',{name:'지식 원문 보기',exact:true}).click();}else await p.getByRole('button',{name:'저장한 지식 고정 원문 보기',exact:true}).click();const start=panel(p).getByRole('button',{name:'선택 지식으로 요청 작성',exact:true});if(pending===undefined)await expect(start).toBeEnabled();else{await expect(start).toBeDisabled();await expect(panel(p).getByRole('button',{name:'원명령 재확인',exact:true})).toBeEnabled();const after=await qa(p);assert.deepEqual(after.writes,before.writes,'복귀·원문 선택은 POST를 자동 전송하지 않는다');if(!app)assert.deepEqual(after.buffer?.pending,pending,'harness 원 pending 전체를 보존한다');else{assert.equal(after.writes.length,1);assert.deepEqual(after.writes[0],pending,'App 내부 buffer를 노출하지 않고 원명령·후속 동일 전송으로 확인한다');}}}
async function draft(p:Page){await panel(p).getByRole('button',{name:'선택 지식으로 요청 작성',exact:true}).click();await panel(p).getByRole('button',{name:'허가된 대상 프로젝트 조회',exact:true}).click();await panel(p).getByLabel('허가된 합성 대상',{exact:true}).check();await panel(p).getByLabel('공유 요청 목적',{exact:true}).fill('공유 목적 <script>window.SHARE_XSS=1</script>');}
// Main의 별도 QA GO가 없으면 자원 생성 전에 종료한다. 실제 서버/DB/포트 사용0.
test('FN05 실제 KnowledgePage/App 합성 DOM: 보관·최소조회·미전송닫기·제외후 원명령·문맥/ABA 격리',{timeout:60000},async t=>{
 assert.equal(process.env.ANVIL_FN05_SHARE_DOM_QA,'1','별도 Main QA GO가 필요하다');assert.equal(userInfo().username.toLowerCase(),'cyhuh');
 const parent=dirname(qaRoot),p=await lstat(parent);assert.ok(p.isDirectory()&&!p.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(qaRoot);await mkdir(join(qaRoot,'bundle'));
 const built=await build({configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:fileURLToPath(new URL('./knowledge-share-request-dom-harness.tsx',import.meta.url)),name:'AnvilShareQA',formats:['iife']}}});
 const out=Array.isArray(built)?built[0]:built;assert.ok(out&&'output' in out);const chunks=out.output.filter(c=>c.type==='chunk');assert.equal(chunks.length,1);const chunk=chunks[0]!;assert.equal(chunk.type,'chunk');const styles=out.output.filter(c=>c.type==='asset'&&c.fileName.endsWith('.css')).map(c=>c.type==='asset'?String(c.source):'').join(String.fromCharCode(10));
 assert.match(styles,/:root\s*\{[^}]*--bg\s*:\s*#071321\b/,'실제 entry의 root token CSS가 필요하다');
 assert.match(styles,/\.app-shell\s*\{[^}]*display\s*:\s*grid/,'실제 entry의 app-shell CSS가 필요하다');
 const old={TEMP:process.env.TEMP,TMP:process.env.TMP};process.env.TEMP=join(qaRoot,'bundle');process.env.TMP=join(qaRoot,'bundle');
 const context=await chromium.launchPersistentContext(join(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(10000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(r.request().url()==='https://anvil.invalid:3830/'&&r.request().method()==='GET')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><div id="root"></div></html>'});unexpected.push(r.request().url());return r.abort();});
  page.on('dialog',dialog=>void dialog.accept());
  async function open(mode='PAGE'){await page.goto('https://anvil.invalid:3830/');await page.evaluate(s=>{(window as any).__shareSeed=s;window.fetch=(input,init)=>(window as any).__shareTransport(input,init);location.hash=s.mode==='APP'?'#/projects/'+s.projectId+'/knowledge':'';},seed(mode));if(styles)await page.addStyleTag({content:styles});await page.addScriptTag({content:chunk.code});await panel(page).waitFor();const style=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return{fontSize:s.fontSize,background:s.backgroundColor,token:s.getPropertyValue('--bg').trim()};});assert.deepEqual(style,{fontSize:'12px',background:'rgb(7, 19, 33)',token:'#071321'},'기존 entry의 12px/root 배경 token을 실제 페이지에 적용한다');}
  await t.test('미전송초안 명시닫기 뒤 요청1 보관·본인목록/고정조회·수신효과0',async()=>{
   await open();await select(page);await draft(page);await panel(page).getByRole('button',{name:'미전송 요청 초안 닫기',exact:true}).click();assert.equal((await qa(page)).buffer,null);assert.equal((await qa(page)).writes.length,0);
   await draft(page);await panel(page).getByRole('button',{name:'공유 요청 보관',exact:true}).click();await detail(page).waitFor();assert.match(await detail(page).innerText(),/실제 공유·승인·수신은 수행하지 않았습니다/);assert.equal(await page.evaluate(()=>(window as any).SHARE_XSS),undefined);
   let state=await qa(page);assert.equal(state.writes.length,1);assert.equal(state.records,1);assert.equal(state.writes[0].operation,'requestKnowledgeShare');assert.deepEqual(Object.keys(state.writes[0].payload).sort(),['explicitTargets','purpose','versionRefs']);assert.equal(JSON.stringify(state.writes).includes(seed().knowledge.body),false);
   await panel(page).getByRole('button',{name:'내 보관 요청 조회',exact:true}).click();await panel(page).getByRole('button',{name:seed().requestId+' 고정 조회',exact:true}).click();await detail(page).waitFor();
   await page.evaluate(()=>{(window as any).__shareQA.unavailable=true;});await panel(page).getByRole('button',{name:'보관 요청 고정 조회',exact:true}).click();await expect(detail(page)).toContainText('선택과 목적을 표시하지 않습니다');assert.equal((await detail(page).innerText()).includes('공유 목적'),false);assert.equal(await panel(page).getByLabel('공유 요청 목적',{exact:true}).count(),0);
   await panel(page).scrollIntoViewIfNeeded();await page.screenshot({path:join(qaRoot,'bundle','minimum.png')});assert.deepEqual((await qa(page)).unknown,[]);
  });
  await t.test('응답유실 뒤 pending닫기0·제외된 같은 ref 원명령재확인1',async()=>{
   await open();await select(page);await draft(page);await page.evaluate(()=>{(window as any).__shareQA.next='LOST';});await panel(page).getByRole('button',{name:'공유 요청 보관',exact:true}).click();await panel(page).getByRole('button',{name:'원명령 재확인',exact:true}).waitFor();assert.equal(await panel(page).getByRole('button',{name:'미전송 요청 초안 닫기',exact:true}).count(),0);const original=(await qa(page)).writes[0];assert.ok((await qa(page)).buffer?.pending);
   await page.evaluate(()=>{const q=(window as any).__shareQA;q.sourceState='EXCLUDED';q.unavailable=true;});await page.getByRole('button',{name:'저장한 지식 고정 원문 보기',exact:true}).click();await expect(page.getByRole('region',{name:'보관 지식',exact:true})).toContainText('사용 제외');await expect(panel(page).getByRole('button',{name:'원명령 재확인',exact:true})).toBeEnabled();await panel(page).getByRole('button',{name:'원명령 재확인',exact:true}).click();await expect(detail(page)).toContainText('선택과 목적을 표시하지 않습니다');const state=await qa(page);assert.equal(state.writes.length,2);assert.deepEqual(state.writes[1],original);assert.equal(state.records,1);assert.equal(state.buffer?.pending,null);assert.deepEqual(state.unknown,[]);
  });
  await t.test('POST 늦은 JSON의 actor전환·ABA는 원명령을 덮거나 이전목록을 노출하지 않는다',async()=>{
   await open();await select(page);await draft(page);await page.evaluate(()=>{(window as any).__shareQA.next='DELAY_JSON';});await panel(page).getByRole('button',{name:'공유 요청 보관',exact:true}).click();await page.waitForFunction(()=>(window as any).__shareQA.calls.some((c:any)=>c.jsonStarted&&!c.settled));const pending=(await qa(page)).buffer?.pending;assert.ok(pending);
   await page.evaluate(()=>{(window as any).__shareQA.change('B');});assert.equal(await detail(page).count(),0);assert.equal(await panel(page).getByText('허가된 합성 대상',{exact:true}).count(),0);assert.equal(await panel(page).getByLabel('공유 요청 목적',{exact:true}).count(),0);
   await page.evaluate(()=>{(window as any).__shareQA.change('A');});await page.evaluate(()=>{const q=(window as any).__shareQA;for(const release of q.releases.values())release();});await page.waitForFunction(()=>(window as any).__shareQA.calls.filter((c:any)=>c.jsonStarted).every((c:any)=>c.settled));assert.equal(await detail(page).count(),0);assert.deepEqual((await qa(page)).buffer?.pending,pending);assert.equal((await qa(page)).writes.length,1);assert.deepEqual((await qa(page)).unknown,[]);
   await select(page,false,pending);await panel(page).getByRole('button',{name:'내 보관 요청 조회',exact:true}).click();await panel(page).getByRole('button',{name:seed().requestId+' 고정 조회',exact:true}).waitFor();await page.evaluate(()=>{(window as any).__shareQA.change('B');});assert.equal(await panel(page).getByRole('button',{name:seed().requestId+' 고정 조회',exact:true}).count(),0);assert.equal(await detail(page).count(),0);
  });
  await t.test('실제 App는 화면이탈 후 원 pending을 보존하고 자동재전송 없이 같은 명령만 재확인한다',async()=>{
   await open('APP');await select(page,true);await draft(page);await page.evaluate(()=>{(window as any).__shareQA.next='LOST';});await panel(page).getByRole('button',{name:'공유 요청 보관',exact:true}).click();await panel(page).getByRole('button',{name:'원명령 재확인',exact:true}).waitFor();const original=(await qa(page)).writes[0];await page.evaluate(()=>{location.hash='#/projects';});await expect(panel(page)).toHaveCount(0);assert.equal((await qa(page)).writes.length,1);await page.evaluate(pid=>{location.hash='#/projects/'+pid+'/knowledge';},seed().projectId);await panel(page).waitFor();await select(page,true,original);await panel(page).getByRole('button',{name:'원명령 재확인',exact:true}).click();await detail(page).waitFor();assert.deepEqual((await qa(page)).writes[1],original);assert.equal((await qa(page)).records,1);assert.deepEqual((await qa(page)).unknown,[]);
  });
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();for(const key of ['TEMP','TMP'] as const){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
 // QA root의 browser/profile·bundle 증거는 Main이 소유·잔류를 확인한 뒤 정확 회수한다.
});