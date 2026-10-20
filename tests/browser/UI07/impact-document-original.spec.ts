import{contentHash}from'../../../contracts/canonical.ts';import{test,expect}from'@playwright/test';import{installWorkspaceBundle}from'../UI04/bundle.ts';import{impactDocumentFixture}from'../../unit/UI07/impact-document-fixture.ts';
for(const mode of ['NORMAL','DENIED','MISMATCH','DEPART','BODY_SWAP','TITLE_SWAP'])test('IMPACT_DOCUMENT_'+mode,async({page})=>{
 const f=impactDocumentFixture(),writes:string[]=[],unknown:string[]=[],errors:string[]=[],docs:string[]=[],files:string[]=[];let release:(()=>void)|null=null,returned=false;const gate=new Promise<void>(resolve=>{release=resolve;});
 await installWorkspaceBundle(page);await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.abort();});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:f.selection.userId,displayName:'영향 문서 QA'},clientId:f.selection.clientId,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+f.selection.projectId+'/design-changes/'+f.selection.changeRef.id+'?*',r=>r.fulfill({json:f.page}));
 const documentPath='**/api/v1/projects/'+f.selection.projectId+'/documents/'+f.document.id+'/versions/1';
 await page.route(documentPath,async r=>{docs.push(r.request().url());if(mode==='DEPART')await gate;const forged=Buffer.from('다른 일관된 본문');await r.fulfill({json:mode==='MISMATCH'?{...f.document,contentHash:'e'.repeat(64)}:mode==='TITLE_SWAP'?{...f.document,title:'다른 제목'}:mode==='BODY_SWAP'?{...f.document,content:{...f.document.content,body:{...f.document.content.body,artifactId:'77777777-7777-4777-8777-777777777777',bytes:forged.length,contentHash:contentHash(forged)}}}:f.document});returned=true;});
 await page.route('**/api/v1/projects/'+f.selection.projectId+'/files/*',r=>{files.push(r.request().url());return r.fulfill({body:mode==='BODY_SWAP'?Buffer.from('다른 일관된 본문'):f.bytes,contentType:'application/octet-stream'});});
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/projects/'+f.selection.projectId+'/changes');await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill(f.selection.changeRef.id);await page.getByRole('button',{name:'변경 요청 조회',exact:true}).click();await expect(page.getByRole('region',{name:'보관 설계 변경',exact:true})).toBeVisible();expect(docs).toHaveLength(0);expect(files).toHaveLength(0);
 const open=page.getByRole('button',{name:'영향 문서 '+f.document.id+' 고정 원문 보기',exact:true});await open.click();
 if(mode==='DEPART'){await expect.poll(()=>docs.length).toBe(1);await page.getByRole('textbox',{name:'변경 요청 ID',exact:true}).fill('');release!();await expect.poll(()=>returned).toBe(true);await expect(page.getByRole('region',{name:'영향 문서 고정 원문',exact:true})).toHaveCount(0);expect(files).toHaveLength(0);}
 else if(['MISMATCH','BODY_SWAP','TITLE_SWAP'].includes(mode)){await expect(page.getByRole('alert')).toContainText('DOCUMENT_REFERENCE_CHANGED');await expect(page.getByLabel('영향 문서 보관 원문',{exact:true})).toHaveCount(0);expect(files).toHaveLength(0);}
 else{await expect(page.getByLabel('영향 문서 보관 원문',{exact:true})).toHaveText(f.body);expect(files).toHaveLength(1);expect(await page.evaluate(()=>(globalThis as any).impactDocumentExecuted)).toBeUndefined();
  if(mode==='DENIED'){await page.route(documentPath,r=>r.fulfill({status:403,json:{code:'PROJECT_DOCUMENT_DENIED'}}));await open.click();await expect(page.getByRole('alert')).toContainText('PROJECT_DOCUMENT_DENIED');await expect(page.getByLabel('영향 문서 보관 원문',{exact:true})).toHaveCount(0);expect(files).toHaveLength(1);}
 }
 expect(writes).toEqual([]);expect(unknown).toEqual([]);expect(errors).toEqual([]);
});
