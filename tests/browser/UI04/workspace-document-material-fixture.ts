import {expect,type Page} from '@playwright/test';
import {stageDocumentFixture} from '../../unit/UI06/stage-document-fixture.ts';
import {pngFixture} from '../../unit/FN03/png-preview-fixture.ts';
import {installWorkspaceBundle} from './bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
export async function documentMaterialFixture(page:Page,mode:string){
 const f=stageDocumentFixture(),unknown:string[]=[],errors:string[]=[],outside:string[]=[],writes:string[]=[];
 const did='66666666-6666-4666-8666-666666666666',bodyId='77777777-7777-4777-8777-777777777777',pngId='88888888-8888-4888-8888-888888888888',textId='99999999-9999-4999-8999-999999999999';
 const body='# 단계 설계 설명\n\n| 항목 | 상세 |\n| --- | --- |\n| 사용자 흐름 | 직접 확인 |\n\n<script>실행하지 않는 원문</script>',png=pngFixture(),text='사람이 등록한 시안 설명',at=f.application.observedAt;
 const artifact=(id:string,bytes:Buffer,mediaType:string)=>({artifactId:id,bytes:bytes.length,contentHash:contentHash(bytes),mediaType});
 const rawId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',raw=Buffer.from('<html><script>window.__downloadExecuted=true</script>원본 보존</html>');
 const content={body:artifact(bodyId,Buffer.from(body),'text/markdown;charset=utf-8'),attachments:[artifact(pngId,png,'image/png'),artifact(textId,Buffer.from(text),'text/plain;charset=utf-8'),...(mode==='DOWNLOAD'?[artifact(rawId,raw,'text/html')]:[])],sections:[],sourceRefs:[]},stageNodeRef={applicationId:f.choice.applicationRef.id,nodeId:'DESIGN'};
 const doc={id:did,version:1,title:'단계의 실제 보관 문서',formRef:f.form.ref,stageNodeRef,contentHash:contentHash(canonicalJson({title:'단계의 실제 보관 문서',formRef:f.form.ref,stageNodeRef,content})),confirmed:false,content,stageBinding:{applicationRef:f.choice.applicationRef,methodologyName:f.application.snapshot.name,nodeId:'DESIGN',nodeName:'설계 단계',uses:['OUTPUT']},validation:{validForConfirmation:false,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef:f.form.ref,items:[]},contentReviews:[]};
 let rawReads=0,pngReads=0,docReads=0,release=()=>{};const pending=new Promise<void>(r=>release=r);
 await page.addInitScript(id=>{const get=window.fetch;window.fetch=async(...args:Parameters<typeof fetch>)=>{const response=await get(...args);if(String(args[0]).endsWith('/files/'+id)){await response.clone().arrayBuffer();(window as any).__workspacePngArrived=true;}return response;};},pngId);
 await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('data:')&&new URL(r.url()).origin!=='https://localhost:3830')outside.push(r.url());if(r.method()!=='GET')writes.push(r.method()+' '+r.url());});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{...f.session,user:{id:f.userId,displayName:'단계 자료 QA'}}}));await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 const project={...f.project,name:'단계 자료',purpose:'선택 단계의 실제 자료 조회',desiredOutcome:'문서·시안 소유',version:1,createdAt:at,updatedAt:at,sourceMode:'EMPTY',sourceDeclaration:null,baselineRef:null,readinessIssues:[],viewerPermissions:['READ_PROJECT']};
 await page.route(`**/api/v1/projects/${f.projectId}`,r=>r.fulfill({json:project}));await page.route(`**/api/v1/projects/${f.projectId}/methodology-application`,r=>r.fulfill({json:f.application}));await page.route(`**/api/v1/projects/${f.projectId}/conversations?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route(`**/api/v1/projects/${f.projectId}/documents?*`,r=>{const q=new URL(r.request().url()).searchParams;expect(q.get('applicationId')).toBe(f.choice.applicationRef.id);expect(q.get('nodeId')).toBe('DESIGN');return r.fulfill({json:{items:[{id:did,title:doc.title,headVersion:1,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at}});});
 await page.route(`**/api/v1/projects/${f.projectId}/documents/${did}/versions/1`,r=>{docReads++;return r.fulfill({json:doc});});await page.route(`**/api/v1/projects/${f.projectId}/files/${bodyId}`,r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from(body)}));
 await page.route(`**/api/v1/projects/${f.projectId}/files/${pngId}`,async r=>{pngReads++;if(mode==='LATE')await pending;return r.fulfill({contentType:'application/octet-stream',body:mode==='HASH'?pngFixture({width:2}):png});});await page.route(`**/api/v1/projects/${f.projectId}/files/${textId}`,r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from(text)}));
 await page.route(`**/api/v1/projects/${f.projectId}/files/${rawId}`,r=>{rawReads++;return r.fulfill({headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="artifact-${rawId}.bin"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"},body:raw});});
 return{rawReads:()=>rawReads,f,body,text,rawId,raw,unknown,errors,outside,writes,release,pngReads:()=>pngReads,docReads:()=>docReads};
}
