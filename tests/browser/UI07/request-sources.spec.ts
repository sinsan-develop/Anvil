import{test,expect,type Page}from'@playwright/test';
import{installRequestFixture,pid,documentId}from'./request-fixture.ts';
async function prepare(page:Page){const f=await installRequestFixture(page);await page.route(`**/api/v1/projects/${pid}/documents?*`,route=>route.fulfill({json:{items:[{id:documentId,title:'확정 설계',headVersion:1,confirmedVersion:1,updatedAt:'2026-10-18T00:00:00Z'}],hasMore:false,nextCursor:null,observedAt:'2026-10-18T00:00:00Z'}}));await page.getByRole('button',{name:'변경용 수정 제안 목록 조회',exact:true}).click();await page.getByRole('button',{name:'변경 요청 준비: 확정 설계',exact:true}).click();await expect(page.getByRole('textbox',{name:'변경 요청 이유',exact:true})).toBeVisible();return f;}
test('변경 요청은 읽은 문서 원문을 출처로 명시 선택해 정확 버전과 함께 등록한다',async({page})=>{
 const f=await prepare(page);await page.getByRole('button',{name:'변경 요청 출처 문서 목록',exact:true}).click();await page.getByRole('button',{name:'변경 요청 출처 원문: 확정 설계 v1',exact:true}).click();await expect(page.getByLabel('선택한 변경 요청 출처 원문',{exact:true})).toContainText('원문을 보존한다');await page.getByRole('button',{name:'이 문서를 변경 요청 출처로 연결',exact:true}).click();await page.getByRole('textbox',{name:'변경 요청 이유',exact:true}).fill('이 문서의 복구 요구에 따른 변경');await page.getByRole('checkbox',{name:'변경 요청만 등록하며 승인·적용·재개하지 않음을 확인합니다',exact:true}).check();await page.getByRole('button',{name:'설계 변경 요청 등록',exact:true}).click();await expect(page.getByRole('status')).toContainText('변경 요청 등록 영수증 확인');expect(f.commands).toHaveLength(1);expect(f.commands[0].payload.sourceRefs).toEqual([{kind:'DOCUMENT_VERSION',...f.beforeRef}]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
test('출처 원문 읽기 거절은 앞선 원문을 숨기고 연결 버튼을 비활성화한다',async({page})=>{
 const f=await prepare(page);await page.getByRole('button',{name:'변경 요청 출처 문서 목록',exact:true}).click();const open=page.getByRole('button',{name:'변경 요청 출처 원문: 확정 설계 v1',exact:true});await open.click();await expect(page.getByLabel('선택한 변경 요청 출처 원문',{exact:true})).toBeVisible();await page.route(`**/api/v1/projects/${pid}/files/*`,route=>route.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));const denied=page.waitForResponse(r=>r.url().includes(`/projects/${pid}/files/`)&&r.status()===403);await open.click();await denied;await expect(page.getByRole('alert')).toContainText('ARTIFACT_READ_FAILED');await expect(page.getByLabel('선택한 변경 요청 출처 원문',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'이 문서를 변경 요청 출처로 연결',exact:true})).toBeDisabled();expect(f.commands).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});

for(const stage of ['metadata','body'])test('문서 출처 '+stage+' 응답 대기 중 화면을 떠나면 늦은 본문을 채택하지 않는다',async({page})=>{
 await page.addInitScript(({stage,documentId})=>{
  const original=globalThis.fetch;let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>release=resolve);
  const qa={hold:false,entered:false,released:false,fileCalls:0,release};(globalThis as any).changeSourceQa=qa;
  globalThis.fetch=async(...args)=>{const url=String(args[0]);if(qa.hold&&url.includes('/files/'))qa.fileCalls++;const response=await original(...args);
   if(qa.hold&&stage==='metadata'&&url.includes('/documents/'+documentId+'/versions/')){const json=response.json.bind(response);response.json=async()=>{qa.entered=true;await gate;const value=await json();qa.released=true;return value;};}
   if(qa.hold&&stage==='body'&&url.includes('/files/')){qa.entered=true;await gate;qa.released=true;}
   return response;
  };
 },{stage,documentId});
 const f=await prepare(page);await page.getByRole('button',{name:'변경 요청 출처 문서 목록',exact:true}).click();
 await page.evaluate(()=>(globalThis as any).changeSourceQa.hold=true);
 await page.getByRole('button',{name:'변경 요청 출처 원문: 확정 설계 v1',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>(globalThis as any).changeSourceQa.entered)).toBe(true);
 await page.evaluate(id=>{location.hash=`/projects/${id}/session`;},pid);await expect(page.getByRole('region',{name:'설계 변경 조회',exact:true})).toHaveCount(0);
 await page.evaluate(()=>(globalThis as any).changeSourceQa.release());await expect.poll(()=>page.evaluate(()=>(globalThis as any).changeSourceQa.released)).toBe(true);
 await page.evaluate(id=>{location.hash=`/projects/${id}/changes`;},pid);await expect(page.getByRole('textbox',{name:'변경 요청 이유',exact:true})).toBeVisible();
 await expect(page.getByLabel('선택한 변경 요청 출처 원문',{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'이 문서를 변경 요청 출처로 연결',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>(globalThis as any).changeSourceQa.fileCalls)).toBe(stage==='metadata'?0:1);expect(f.commands).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
