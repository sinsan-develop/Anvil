import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',kid='44444444-4444-4444-8444-444444444444',at='2026-10-16T05:00:00Z';
async function fixture(page:Page,lost=false,denyAfterLost=false){
  const unknown:string[]=[],writes:any[]=[];let body='',entry:any=null,ref:any=null;
  await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
  await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'지식 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
  await page.route(`**/api/v1/projects/${pid}/conversations?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
  await page.route(`**/api/v1/projects/${pid}`,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:1}}}));
  await page.route(`**/api/v1/projects/${pid}/knowledge?*`,r=>r.fulfill({json:{items:ref?[{versionRef:ref,title:entry.title,kind:entry.kind,sourceRefs:entry.sourceRefs,reasonSnippet:entry.reason,state:'PROPOSED'}]:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at}}));
  await page.route(`**/api/v1/projects/${pid}/files`,r=>{
    const c=JSON.parse(r.request().headers()['x-anvil-command']!);writes.push(c);body=r.request().postDataBuffer()!.toString('utf8');expect(c.payload.contentHash).toBe(createHash('sha256').update(body).digest('hex'));
    return r.fulfill({status:201,json:receipt(c,{status:'ARTIFACT_READY',artifactRef:{artifactId:aid,...c.payload}},aid,null)});
  });
  await page.route(`**/api/v1/projects/${pid}/commands`,r=>{
    const c=r.request().postDataJSON();writes.push(c);expect(c.operation).toBe('saveKnowledge');entry=c.payload.entry;ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))};
    if(lost&&writes.length===2)return r.abort('connectionreset');if(denyAfterLost&&writes.length===3)return r.fulfill({status:403,json:{code:'PROJECT_OPERATION_DENIED'}});return r.fulfill({json:receipt(c,{status:'PROPOSED',ref,entry},kid,1)});
  });
  await page.route(`**/api/v1/projects/${pid}/knowledge/${kid}/versions/1`,r=>r.fulfill({json:{ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]}}));
  await page.goto(`/#/projects/${pid}/knowledge`);return{unknown,writes};
}
function receipt(c:any,data:any,targetId:string,version:number|null){return{operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId,version,data,evidenceRefs:[],warnings:[],serverReceivedAt:at};}
async function fill(page:Page){await page.getByRole('button',{name:'새 지식 작성',exact:true}).click();await page.getByLabel('지식 종류',{exact:true}).selectOption('HYPOTHESIS');await page.getByLabel('지식 제목',{exact:true}).fill('도구 교체 이유');await page.getByLabel('지식 원문',{exact:true}).fill('지식은 사용자 소유로 남긴다');await page.getByLabel('지식 작성 이유',{exact:true}).fill('도구를 교체해도 목적을 보존한다');}
test('지식 원문 작성→초안 저장→목록/본문에서 사실과 가설·미확정을 확인한다',async({page})=>{
  const f=await fixture(page);await fill(page);await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(page.getByRole('status')).toContainText('지식 초안 저장 확인');
  await page.getByRole('button',{name:'작성 닫기',exact:true}).click();await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await expect(page.getByLabel('보관 지식 원문',{exact:true})).toHaveText('지식은 사용자 소유로 남긴다');await expect(page.getByText('가설 · 제안 상태 · 헌법 미적용',{exact:true})).toBeVisible();expect(f.writes).toHaveLength(2);expect(f.unknown).toEqual([]);
});
test('단절된 지식 저장은 이동 뒤 입력/명령을 유지하고 같은 명령으로만 재확인한다',async({page})=>{
  const f=await fixture(page,true);await fill(page);await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');
  await page.getByRole('link',{name:'프로젝트 작업',exact:true}).click();await page.getByRole('link',{name:'헌법·지식',exact:true}).click();await expect(page.getByLabel('지식 제목',{exact:true})).toHaveValue('도구 교체 이유');await expect(page.getByRole('button',{name:'작성 닫기',exact:true})).toBeDisabled();await page.getByRole('button',{name:'같은 지식 명령 결과 확인',exact:true}).click();await expect(page.getByRole('status')).toContainText('지식 초안 저장 확인');expect(f.writes).toHaveLength(3);expect(f.writes[2]).toEqual(f.writes[1]);expect(f.unknown).toEqual([]);
});
test('단절 뒤 정책 거절이 와도 원래 지식 명령을 버리거나 중복 작성하지 않는다',async({page})=>{
  const f=await fixture(page,true,true);await fill(page);await page.getByRole('button',{name:'지식 초안 저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await page.getByRole('button',{name:'같은 지식 명령 결과 확인',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PROJECT_OPERATION_DENIED');await expect(page.getByRole('button',{name:'작성 닫기',exact:true})).toBeDisabled();await page.getByRole('button',{name:'같은 지식 명령 결과 확인',exact:true}).click();await expect(page.getByRole('status')).toContainText('지식 초안 저장 확인');expect(f.writes).toHaveLength(4);expect(f.writes[1]).toEqual(f.writes[2]);expect(f.writes[2]).toEqual(f.writes[3]);expect(f.unknown).toEqual([]);
});
test('사용 제외본은 명시 필터에서만 조회하고 과거/제외를 제안 상태로 표시하지 않는다',async({page})=>{
 const f=await fixture(page),body='제외해도 원문은 보존한다',entry={kind:'FACT',title:'제외된 지식',contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'당시 근거',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))};
 await page.route(`**/api/v1/projects/${pid}/knowledge?*`,r=>r.fulfill({json:{items:new URL(r.request().url()).searchParams.get('status')==='EXCLUDED'?[{versionRef:ref,title:entry.title,kind:entry.kind,sourceRefs:[],reasonSnippet:entry.reason,state:'EXCLUDED'}]:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at}}));
 await page.route(`**/api/v1/projects/${pid}/knowledge/${kid}/versions/1`,r=>r.fulfill({json:{ref,entry,body,state:'EXCLUDED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},baseRef:null,sourceRefs:null,recordedAt:at},{id:pid,kind:'EXCLUDED',reason:'사용 제외',actorRef:{kind:'HUMAN',userId:uid},baseRef:null,sourceRefs:null,recordedAt:at}]}}));
 await page.getByLabel('지식 상태 필터',{exact:true}).selectOption('EXCLUDED');await page.getByRole('button',{name:'제목·이유 검색',exact:true}).click();await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await expect(page.getByText('사실 · 사용 제외 · 헌법 미적용',{exact:true})).toBeVisible();await expect(page.getByLabel('보관 지식 원문',{exact:true})).toHaveText(body);expect(f.writes).toHaveLength(0);expect(f.unknown).toEqual([]);
});
