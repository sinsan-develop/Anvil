import{test,expect,type Page}from'@playwright/test';
import{installImpactFixture}from'./impact-fixture.ts';
import{pid,changeId,proposalId}from'./request-fixture.ts';
async function open(page:Page){const f=await installImpactFixture(page);await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill(changeId);await page.getByRole('button',{name:'변경 요청 조회',exact:true}).click();await expect(page.getByRole('region',{name:'보관 설계 변경',exact:true})).toBeVisible();return f;}
test('저장된 변경 요청은 정확 제안의 전후 원문과 재구성 diff를 읽고 적용하지 않는다',async({page})=>{
 const f=await open(page);await page.getByRole('button',{name:'보관 변경 전후 원문·diff 조회',exact:true}).click();await expect(page.getByLabel('보관 변경 전 원문',{exact:true})).toContainText('원문을 보존한다');await expect(page.getByLabel('보관 변경 제안 원문',{exact:true})).toContainText('실패 시 복구 절차를 보완한다');await expect(page.getByRole('region',{name:'보관 변경 diff',exact:true})).toContainText('실패 시 복구 절차를 보완한다');expect(f.commands).toEqual([]);expect(f.reviews).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
test('보관 변경 원문 재조회 거절과 요청 선택 변경은 앞선 전후 원문을 숨긴다',async({page})=>{
 const f=await open(page),button=page.getByRole('button',{name:'보관 변경 전후 원문·diff 조회',exact:true});await button.click();await expect(page.getByLabel('보관 변경 전 원문',{exact:true})).toBeVisible();await page.route(`**/api/v1/projects/${pid}/proposals/${proposalId}`,route=>route.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));await button.click();await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED');await expect(page.getByLabel('보관 변경 전 원문',{exact:true})).toHaveCount(0);await expect(page.getByLabel('보관 변경 제안 원문',{exact:true})).toHaveCount(0);await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill('');await expect(page.getByRole('region',{name:'보관 변경 전후 비교',exact:true})).toHaveCount(0);expect(f.commands).toEqual([]);expect(f.reviews).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
