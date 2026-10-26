import { expect, test, type Page } from '@playwright/test';
import {readFile,lstat,realpath}from'node:fs/promises';
import {resolve}from'node:path';
import{pathToFileURL}from'node:url';
const bodyDownloadRoot='D:/tmp/anvil-v3-stage-b/ui06-stored-body-download-20261027-01';
const bodyDownloadCandidate=process.env.ANVIL_UI06_BODY_DOWNLOAD_QA_DIST;
if(bodyDownloadCandidate){
 if(resolve(bodyDownloadCandidate)!==resolve(bodyDownloadRoot+'/bundle'))throw new Error('BODY_DOWNLOAD_QA_ROOT_INVALID');
 process.env.TEMP=bodyDownloadRoot+'/temp';process.env.TMP=process.env.TEMP;
}
const anchorCandidate=bodyDownloadCandidate?undefined:process.env.ANVIL_UI06_FIXTURE_DIST;
if(anchorCandidate){process.env.TEMP='D:/tmp/anvil-v3-stage-b/browser/ui06-design-anchor-nav-01/browser-temp';process.env.TMP=process.env.TEMP;}
test.beforeEach(async({page})=>{
 const candidate=bodyDownloadCandidate??anchorCandidate;if(!candidate)return;
 if(bodyDownloadCandidate){for(const path of [bodyDownloadRoot,bodyDownloadCandidate]){if((await lstat(path)).isSymbolicLink()||resolve(await realpath(path))!==resolve(path))throw new Error('BODY_DOWNLOAD_QA_LINK_INVALID');}}
 const dist=pathToFileURL(candidate+'/');
 await page.route('https://localhost:3830/**',async r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||u.pathname!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(u.pathname))return r.abort('blockedbyclient');const p=u.pathname==='/'?'index.html':u.pathname.slice(1);return r.fulfill({body:await readFile(new URL(p,dist)),contentType:p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':'application/javascript'});});
});

test('문서 화면에서 보관한 가져오기 후보와 제안을 다시 조회할 수 있다', async ({ page }) => {
  await page.goto('/#/projects/51c0439f-791e-4bb5-8471-70938d6afaf1/documents');
  await expect(page.getByRole('button', { name: '보관한 후보·제안 조회', exact: true })).toBeVisible();
});
import { createHash } from 'node:crypto';
import { canonicalJson,contentHash } from '../../../contracts/canonical.ts';

const project = '51c0439f-791e-4bb5-8471-70938d6afaf1', id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
const artifactId = 'a6f30000-0000-4000-8000-000000000099';
const body = '\uFEFF# 사용자 원문\r\n<script>window.DOCUMENT_EXECUTED=1</script>\r\n';
const bytes = Buffer.from(body), hash = createHash('sha256').update(bytes).digest('hex');
const ref = { artifactId, bytes: bytes.length, contentHash: hash, mediaType: 'text/markdown;charset=utf-8' };
const unknown = new WeakMap<object, string[]>();
test.beforeEach(async ({ page }) => {
  unknown.set(page, []);
  await page.route('**/api/v1/**', route => { unknown.get(page)!.push(route.request().method() + ' ' + new URL(route.request().url()).pathname); return route.fulfill({ status: 503, json: { code: 'UNEXPECTED_QA_API' } }); });
  await page.route('**/api/v1/session', route => route.fulfill({ json: { user: { id, displayName: '문서 조회 QA' }, clientId: id, csrfToken: 'C'.repeat(43) } }));
  await page.route(`**/api/v1/projects/${project}/documents?*`, route => route.fulfill({ json: { items: [{ id, title: '요구사항 원본', headVersion: 2, confirmedVersion: null, updatedAt: '2026-10-16T04:00:00.000Z' }], nextCursor: null, hasMore: false, observedAt: '2026-10-16T04:00:00.000Z' } }));
  await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/*`, route => {
    const version = Number(new URL(route.request().url()).pathname.split('/').pop());
    const targetRef = { id, version, contentHash: 'b'.repeat(64) }, formRef = { id: artifactId, version: 1, contentHash: 'a'.repeat(64) };
    const review = { ref: { id: artifactId, criteriaVersion: 1, targetRef, outcome: 'REWORK' }, items: [{ criterionId: 'REQ', outcome: 'REWORK', evidenceRefs: [], reason: '요구 출처를 더 적어야 합니다' }], reviewer: { kind: 'HUMAN', userId: id, sameAsTargetRecorder: true }, sourceKind: 'HUMAN_REVIEW', reason: '원문 대조 후 보완 요청', reviewedAt: '2026-10-16T04:00:01.000Z', serverSequence: 7 };
    return route.fulfill({ json: { id, version, title: version === 1 ? '이전 요구사항' : '요구사항 원본', formRef, contentHash: targetRef.contentHash, confirmed: false, content: { body: ref, attachments: [], sections: [], sourceRefs: [] }, validation: { validForConfirmation: false, issues: [{ code: 'REQUIRED_SECTION_MISSING', location: 'sections.REQ', message: '필수 항목 미연결', severity: 'ERROR' }] }, statusHistory: [{ kind: 'DRAFT_SAVED', reason: '사람이 저장한 원문', at: '2026-10-16T04:00:00.000Z' }], contentReviewCriteria: { criteriaVersion: 1, formRef, items: [{ criterionId: 'REQ', title: '요구 출처', reviewCriteria: ['원문과 비교'] }] }, contentReviews: [review], reviewRefs: [review.ref], proposalRefs: [], sourceLinks: [] } });
  });
  await page.route(`**/api/v1/projects/${project}/files/${artifactId}`, route => route.fulfill({ contentType: 'application/octet-stream', body: bytes }));
});
test.afterEach(async ({ page }) => { expect(unknown.get(page)).toEqual([]); });
test('문서 목록에서 정확 버전과 원문을 열고 구버전을 조회하되 본문 지시는 실행하지 않는다', async ({ page }) => {
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '요구사항 원본 열기', exact: true }).click();
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveText(body);
  await expect(page.getByText('필수 항목 미연결', { exact: true })).toBeVisible();
  await expect(page.getByText('초안 · 내용 검토/사용자 확정과 별개', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).DOCUMENT_EXECUTED)).toBeUndefined();
  await expect(page.getByText('원문 대조 후 보완 요청', { exact: true })).toBeVisible();
  await expect(page.getByText('작성 기록자와 같은 사용자 · 독립 검수 아님', { exact: true })).toBeVisible();
  await page.getByLabel('조회 버전', { exact: true }).fill('1');
  await page.getByRole('button', { name: '지정 버전 조회', exact: true }).click();
  await expect(page.getByRole('heading', { name: '이전 요구사항', exact: true })).toBeVisible();
});

test('선택한 문서 버전에서 설계 항목·화면 위치 추적 조회를 열 수 있다', async ({ page }) => {
  await page.goto(`/#/projects/${project}/documents`); await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
  await expect(page.getByRole('button',{name:'이 버전 설계 추적 조회',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'이 버전 설계 위치 등록',exact:true})).toBeVisible();
});

test('설계 추적은 별도 GET에서 정확 버전 항목을 보이고 변조/미구현을 완료로 숨기지 않는다', async ({ page }) => {
  const documentRef={id,version:2,contentHash:'b'.repeat(64)},data={documentRef,localCode:'D01',title:'원문 위치 조회',anchor:'line:1'};let reads=0,broken=false;
  await page.route(`**/api/v1/projects/${project}/design-index?*`,r=>{reads++;expect(r.request().method()).toBe('GET');expect(new URL(r.request().url()).searchParams.get('version')).toBe('2');return r.fulfill({json:{documentRef,items:[{id:artifactId,...data,itemHash:broken?'0'.repeat(64):contentHash(canonicalJson(data))}],screenRegions:[],status:'INDEXED',observedAt:'2026-10-16T05:00:00Z'}});});
  await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();expect(reads).toBe(0);
  await page.getByRole('button',{name:'이 버전 설계 추적 조회',exact:true}).click();const panel=page.getByRole('region',{name:'설계 항목·화면 위치 추적',exact:true});await expect(panel.getByText('D01 · 원문 위치 조회',{exact:true})).toBeVisible();await expect(panel).toContainText('실제 실행/시험 증거는 아직 미연결');
  broken=true;await panel.getByRole('button',{name:'설계 추적 새로고침',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('DESIGN_INDEX_INTEGRITY_FAILED');await expect(panel.getByText('D01 · 원문 위치 조회',{exact:true})).toHaveCount(0);expect(reads).toBe(2);
});
test('원문 바이트가 hash와 다르면 문서를 표시하지 않고 명확히 실패한다', async ({ page }) => {
  await page.route(`**/api/v1/projects/${project}/files/${artifactId}`, route => route.fulfill({ contentType: 'application/octet-stream', body: Buffer.from('다른 파일') }));
  await page.goto(`/#/projects/${project}/documents`);
  await page.getByRole('button', { name: '요구사항 원본 열기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED');
  await expect(page.getByLabel('문서 원문', { exact: true })).toHaveCount(0);
});
test('업무 연결 조회는 같은 edge의 방향만 바꾸고 실제 실행/시험 미연결과 변조를 숨기지 않는다',async({page})=>{
 const documentRef={id,version:2,contentHash:'b'.repeat(64)},planId='a6f30000-0000-4000-8000-000000000098',edgeId='a6f30000-0000-4000-8000-000000000097',from={kind:'PLAN_TASK',id:planId,versionRef:{id:planId,version:1,contentHash:'c'.repeat(64)},localCode:'FN01'},to={kind:'DESIGN_ITEM',id:artifactId,versionRef:documentRef,localCode:'D01',anchor:'line:1'},data={from,to,relation:'IMPLEMENTS',reason:'실제 설계 연결',designRefs:[documentRef]};let reads=0,broken=false;
 await page.route(`**/api/v1/projects/${project}/design-index?*`,r=>r.fulfill({json:{documentRef,items:[],screenRegions:[],status:'NOT_INDEXED',observedAt:'2026-10-16T05:00:00Z'}}));
 await page.route(`**/api/v1/projects/${project}/traces?*`,r=>{reads++;const direction=new URL(r.request().url()).searchParams.get('direction'),edge={id:edgeId,...data,edgeHash:broken?'0'.repeat(64):contentHash(canonicalJson(data)),createdAt:'2026-10-16T05:00:00Z'};return r.fulfill({json:{designRef:documentRef,direction,nodes:[{ref:from,title:'실제 저장 업무',designRefs:[documentRef]},{ref:to,title:'원문 보존',designRefs:[documentRef]}],edges:[edge],traversal:[{edgeId,from:direction==='FORWARD'?from:to,to:direction==='FORWARD'?to:from}],missingLinks:[],unknownEvidence:[{code:'EXECUTION_SOURCE_NOT_CONNECTED'},{code:'TEST_EVIDENCE_SOURCE_NOT_CONNECTED'}],baselineRef:null,hasMore:false,nextCursor:null,observedAt:'2026-10-16T05:00:00Z'}});});
 await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전 설계 추적 조회',exact:true}).click();expect(reads).toBe(0);await page.getByRole('button',{name:'업무 연결 조회',exact:true}).click();const panel=page.getByRole('region',{name:'설계·업무 연결 조회',exact:true});await expect(panel).toContainText('실제 저장 업무');await expect(panel).toContainText('실제 실행/시험 증거는 아직 미연결');
 await panel.getByLabel('추적 방향',{exact:true}).selectOption('REVERSE');await expect(panel.getByText('역방향 · 같은 저장 연결',{exact:true})).toBeVisible();await expect(panel).toContainText(edgeId);broken=true;await panel.getByRole('button',{name:'업무 연결 새로고침',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('TRACE_INTEGRITY_FAILED');await expect(panel.getByText('실제 저장 업무',{exact:true})).toHaveCount(0);expect(reads).toBe(3);
});

const priorArtifactId='a6f30000-0000-4000-8000-000000000098';
const priorBytes=Buffer.from('\uFEFF# 이전 원문\r\n이전 버전의 별도 파일\r\n');
const bodyDownloadName='저장 본문 보관 원본 다운로드';
async function bodyDownloadFixture(page:Page){
 const errors:string[]=[],outside:string[]=[],writes:string[]=[],fileReads:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(u.origin!=='https://localhost:3830')outside.push(r.url());if(u.pathname.startsWith('/api/')&&r.method()!=='GET')writes.push(r.method()+' '+u.pathname);});
 await page.route(`**/api/v1/projects/${project}`,r=>r.fulfill({json:{id:project,name:'본문 원본 다운로드',purpose:'저장 바이트 보존',participation:'OWNER',controlState:{actorId:id,clientId:id,generation:1,status:'HELD'},readinessIssues:[]}}));
 await page.route(`**/api/v1/projects/${project}/queue`,r=>r.fulfill({json:{projectId:project,items:[],selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:'2026-10-27T00:00:00.000Z',writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false}}));
 await page.route(`**/api/v1/projects/${project}/documents/${id}/versions/*`,r=>{
  const version=Number(new URL(r.request().url()).pathname.split('/').pop()),raw=version===1?priorBytes:bytes,aid=version===1?priorArtifactId:artifactId;
  return r.fulfill({json:{id,version,title:version===1?'이전 요구사항':'요구사항 원본',formRef:{id:artifactId,version:1,contentHash:'a'.repeat(64)},contentHash:(version===1?'c':'b').repeat(64),confirmed:false,content:{body:{artifactId:aid,bytes:raw.length,contentHash:createHash('sha256').update(raw).digest('hex'),mediaType:'text/markdown;charset=utf-8'},attachments:[],sections:[],sourceRefs:[]},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:{id:artifactId,version:1,contentHash:'a'.repeat(64)},items:[]},contentReviews:[]}});
 });
 for(const [aid,raw]of [[artifactId,bytes],[priorArtifactId,priorBytes]]as const){await page.route(`**/api/v1/projects/${project}/files/${aid}`,r=>{fileReads.push(aid);expect(r.request().method()).toBe('GET');return r.fulfill({contentType:'application/octet-stream',headers:{'Content-Disposition':`attachment; filename="artifact-${aid}.bin"`},body:raw});});}
 return{errors,outside,writes,fileReads};
}

test('저장 본문 다운로드는 선택한 고정 버전의 원본 링크만 제공하고 자동 GET·POST를 추가하지 않는다',async({page})=>{
 const f=await bodyDownloadFixture(page);
 await page.goto(`/#/projects/${project}/documents`);
 const link=page.getByRole('link',{name:bodyDownloadName,exact:true});await expect(link).toHaveCount(0);
 await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
 await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(body);
 await expect(link).toHaveAttribute('href',`/api/v1/projects/${project}/files/${artifactId}`);
 await expect(link).toHaveAttribute('download',`artifact-${artifactId}.bin`);
 expect(f.fileReads).toEqual([artifactId]);
 await page.getByLabel('조회 버전',{exact:true}).fill('1');await page.getByRole('button',{name:'지정 버전 조회',exact:true}).click();
 await expect(page.getByRole('heading',{name:'이전 요구사항',exact:true})).toBeVisible();
 await expect(link).toHaveAttribute('href',`/api/v1/projects/${project}/files/${priorArtifactId}`);
 await expect(link).toHaveAttribute('download',`artifact-${priorArtifactId}.bin`);
 expect(f.fileReads).toEqual([artifactId,priorArtifactId]);expect(f.writes).toEqual([]);expect(f.outside).toEqual([]);expect(f.errors).toEqual([]);
 expect(await page.evaluate(()=>(window as any).DOCUMENT_EXECUTED)).toBeUndefined();
});
test('저장 본문 다운로드 실제 Edge 파일은 두 고정 버전의 바이트·SHA256·BOM·CRLF를 보존한다',async({page},testInfo)=>{
 const f=await bodyDownloadFixture(page);await page.setViewportSize({width:1920,height:1080});await page.goto(`/#/projects/${project}/documents`);
 await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
 const link=page.getByRole('link',{name:bodyDownloadName,exact:true});
 for(const [version,aid,raw]of [[2,artifactId,bytes],[1,priorArtifactId,priorBytes]]as const){
  if(version===1){await page.getByLabel('조회 버전',{exact:true}).fill('1');await page.getByRole('button',{name:'지정 버전 조회',exact:true}).click();}
  await expect(link).toHaveAttribute('href',`/api/v1/projects/${project}/files/${aid}`);
  const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);
  expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toBe(`artifact-${aid}.bin`);
  const path=bodyDownloadCandidate?`${bodyDownloadRoot}/downloads/artifact-${aid}.bin`:testInfo.outputPath(`artifact-${aid}.bin`);
  await download.saveAs(path);const actual=await readFile(path);
  expect(actual).toEqual(raw);expect(createHash('sha256').update(actual).digest('hex')).toBe(createHash('sha256').update(raw).digest('hex'));
  expect([...actual.subarray(0,3)]).toEqual([239,187,191]);expect(actual.includes(Buffer.from('\r\n'))).toBe(true);
 }
 if(bodyDownloadCandidate)await page.screenshot({path:bodyDownloadRoot+'/screenshots/body-download-1920.png'});
 expect(f.fileReads).toEqual([artifactId,artifactId,priorArtifactId,priorArtifactId]);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.outside).toEqual([]);
 expect(await page.evaluate(()=>(window as any).DOCUMENT_EXECUTED)).toBeUndefined();
});

test('저장 본문 다운로드는 버전 입력·원문 읽기 대기·hash 오류에 이전 링크를 숨긴다',async({page})=>{
 const f=await bodyDownloadFixture(page);await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
 const link=page.getByRole('link',{name:bodyDownloadName,exact:true});await expect(link).toBeVisible();
 await page.getByLabel('조회 버전',{exact:true}).fill('1');await expect(link).toHaveCount(0);
 let release!:()=>void;const waiting=new Promise<void>(r=>{release=r;});let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
 await page.route(`**/api/v1/projects/${project}/files/${priorArtifactId}`,async r=>{f.fileReads.push(priorArtifactId);entered();await waiting;return r.fulfill({contentType:'application/octet-stream',body:Buffer.from('무결성이 다른 바이트')});});
 await page.getByRole('button',{name:'지정 버전 조회',exact:true}).click();await started;
 try{await expect(page.getByText('원문 무결성 확인 중',{exact:true})).toBeVisible();await expect(link).toHaveCount(0);}finally{release();}
 await expect(page.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED');await expect(link).toHaveCount(0);
 expect(f.fileReads).toEqual([artifactId,priorArtifactId]);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.outside).toEqual([]);
});

test('저장 본문 다운로드는 목록 새로고침 대기와 실패에 이전 링크를 숨긴다',async({page})=>{
 const f=await bodyDownloadFixture(page);await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
 const link=page.getByRole('link',{name:bodyDownloadName,exact:true});await expect(link).toBeVisible();
 let release!:()=>void;const waiting=new Promise<void>(r=>{release=r;});let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
 await page.route(`**/api/v1/projects/${project}/documents?*`,async r=>{entered();await waiting;return r.fulfill({status:503,json:{code:'DOCUMENT_LIST_UNAVAILABLE'}});});
 await page.getByRole('button',{name:'문서 목록 새로고침',exact:true}).click();await started;
 try{await expect(link).toHaveCount(0);}finally{release();}
 await expect(page.getByRole('alert')).toContainText('DOCUMENT_LIST_UNAVAILABLE');await expect(link).toHaveCount(0);
 expect(f.fileReads).toEqual([artifactId]);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.outside).toEqual([]);
});

test('저장 본문 다운로드는 프로젝트 이탈 뒤 늦은 본문과 돌아온 이전 선택을 노출하지 않는다',async({page})=>{
 const f=await bodyDownloadFixture(page),otherProject='51c0439f-791e-4bb5-8471-70938d6afaf2';
 await page.route(`**/api/v1/projects/${otherProject}`,r=>r.fulfill({json:{id:otherProject,name:'다른 프로젝트',purpose:'이탈 검수',participation:'OWNER',controlState:{actorId:id,clientId:id,generation:1,status:'HELD'},readinessIssues:[]}}));
 await page.route(`**/api/v1/projects/${otherProject}/queue`,r=>r.fulfill({json:{projectId:otherProject,items:[],selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:'2026-10-27T00:00:00.000Z',writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false}}));
 await page.route(`**/api/v1/projects/${otherProject}/documents?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-27T00:00:00.000Z'}}));
 await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
 const link=page.getByRole('link',{name:bodyDownloadName,exact:true});await expect(link).toBeVisible();
 let release!:()=>void;const waiting=new Promise<void>(r=>{release=r;});let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
 await page.route(`**/api/v1/projects/${project}/files/${priorArtifactId}`,async r=>{f.fileReads.push(priorArtifactId);entered();await waiting;return r.fulfill({contentType:'application/octet-stream',body:priorBytes});});
 await page.getByLabel('조회 버전',{exact:true}).fill('1');await page.getByRole('button',{name:'지정 버전 조회',exact:true}).click();await started;
 try{await page.evaluate(p=>{location.hash=`#/projects/${p}/documents`;},otherProject);await expect(page.getByText('저장된 문서가 없습니다.',{exact:true})).toBeVisible();await expect(link).toHaveCount(0);}finally{release();}
 await page.evaluate(p=>{location.hash=`#/projects/${p}/documents`;},project);await expect(page.getByRole('button',{name:'요구사항 원본 열기',exact:true})).toBeVisible();await expect(link).toHaveCount(0);
 expect(f.fileReads).toEqual([artifactId,priorArtifactId]);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.outside).toEqual([]);
});
test('저장 본문 다운로드는 문서 목록 단계 선택 뒤 이전 링크를 노출하지 않는다',async({page})=>{
 const f=await bodyDownloadFixture(page),applicationId='a6f30000-0000-4000-8000-000000000096',nodeId='a6f30000-0000-4000-8000-000000000095';
 await page.route(`**/api/v1/projects/${project}/documents/stage-options?*`,r=>r.fulfill({json:{projectId:project,formRef:{id:artifactId,version:1,contentHash:'a'.repeat(64)},applicationRef:{id:applicationId,version:1,contentHash:'c'.repeat(64)},methodologyName:'합성 방법론',status:'READY',items:[{stageNodeRef:{applicationId,nodeId},nodeName:'설계 단계',nodeKind:'HUMAN',uses:['OUTPUT']}],observedAt:'2026-10-27T00:00:00.000Z'}}));
 await page.goto(`/#/projects/${project}/documents`);await page.getByRole('button',{name:'요구사항 원본 열기',exact:true}).click();
 const link=page.getByRole('link',{name:bodyDownloadName,exact:true});await expect(link).toBeVisible();
 await page.getByRole('button',{name:'이 문서 양식의 적용 단계 조회',exact:true}).click();
 await page.route(`**/api/v1/projects/${project}/documents?*`,r=>{const u=new URL(r.request().url());expect(u.searchParams.get('applicationId')).toBe(applicationId);expect(u.searchParams.get('nodeId')).toBe(nodeId);return r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-27T00:00:00.000Z'}});});
 await page.getByLabel('문서를 찾을 개발 단계',{exact:true}).selectOption(nodeId);
 await expect(page.getByText('이 단계 조회 조건에 맞는 문서가 없습니다. 다른 단계/미연결 문서는 포함하지 않습니다.',{exact:true})).toBeVisible();await expect(link).toHaveCount(0);
 expect(f.fileReads).toEqual([artifactId]);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.outside).toEqual([]);
});