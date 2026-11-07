import {test,expect} from '@playwright/test';
import {installImpactFixture} from './impact-fixture.ts';
import {pid,user,clientId,changeId} from './request-fixture.ts';
for(const side of ['review','request'] as const)test(`${side} 준비의 지연된 제어권 응답 중 반대 편집기는 준비할 수 없다`,async({page})=>{
 const f=await installImpactFixture(page);
 await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill(changeId);
 await page.getByRole('button',{name:'변경 요청 조회',exact:true}).click();
 await expect(page.getByRole('region',{name:'보관 설계 변경',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'변경용 수정 제안 목록 조회',exact:true}).click();
 const request=page.getByRole('button',{name:'변경 요청 준비: 확정 설계',exact:true}),review=page.getByRole('button',{name:'사람 영향 검토 준비',exact:true});
 await expect(request).toBeEnabled();await expect(review).toBeEnabled();
 let release!:()=>void,arrive!:()=>void;const held=new Promise<void>(r=>release=r),arrived=new Promise<void>(r=>arrive=r);
 await page.route(`**/api/v1/projects/${pid}`,async route=>{arrive();await held;await route.fulfill({json:{id:pid,participation:'OWNER',controlState:{actorId:user,clientId,generation:3,status:'HELD'}}});});
 try{await(side==='review'?review:request).click();await arrived;await expect(side==='review'?request:review).toBeDisabled();}
 finally{release();}
 if(side==='review'){await expect(page.getByRole('textbox',{name:'영향 항목 1 판단 이유',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'변경 요청 이유',exact:true})).toHaveCount(0);}
 else{await expect(page.getByRole('textbox',{name:'변경 요청 이유',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'영향 항목 1 판단 이유',exact:true})).toHaveCount(0);}
 expect(f.commands).toEqual([]);expect(f.reviews).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
