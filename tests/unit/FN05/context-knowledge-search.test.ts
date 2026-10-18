import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const url=new URL('../../../apps/web/src/features/workspace/context-knowledge-search.ts',import.meta.url),subject=existsSync(url)?await import(url.href):{};
const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002',kid='30000000-0000-4000-8000-000000000003';
function fixture(){const body='프로젝트 목적',entry={kind:'PURPOSE',title:'내가 소유하는 프로젝트',contentRef:{artifactId:uid,bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'도구를 교체해도 남길 이유',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]},ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))};return{ref,view:{ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:uid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:'2026-10-19T00:00:00Z'}]},hit:{versionRef:ref,title:entry.title,kind:'PURPOSE',sourceRefs:[],reasonSnippet:entry.reason,state:'PROPOSED'}};}
function load(...args:any[]){assert.equal(typeof subject.loadContextKnowledgeCandidates,'function');return subject.loadContextKnowledgeCandidates(...args);}
test('제목·이유검색과슬롯종류/cursor를기존GET에고정하고원문은명시inspect때정확버전으로만읽는다',async()=>{
 const f=fixture(),calls:string[]=[];const client=new ApiClient(async(path,init)=>{assert.equal(init?.method,'GET');const p=String(path);calls.push(p);if(p.includes('/versions/'))return Response.json(f.view);return Response.json({items:[f.hit],hasMore:true,nextCursor:'opaque-next',searchScope:'TITLE_REASON',observedAt:'2026-10-19T00:00:00Z'});});
 const page=await load(client,pid,'PURPOSE_REASON','  프로젝트 이유  ','opaque-before');assert.equal(calls.length,1);const q=new URL(calls[0]!,'https://anvil.invalid').searchParams;assert.equal(q.get('query'),'프로젝트 이유');assert.equal(q.get('kind'),'PURPOSE');assert.equal(q.get('cursor'),'opaque-before');assert.equal(q.get('limit'),'50');assert.equal(page.query,'프로젝트 이유');assert.equal(page.nextCursor,'opaque-next');const preview=await page.items[0].inspect();assert.deepEqual(preview.selection,{kind:'KNOWLEDGE_VERSION',versionRef:f.ref});assert.equal(preview.body,'프로젝트 목적');assert.equal(calls[1],`/api/v1/projects/${pid}/knowledge/${kid}/versions/1`);
});
test('슬롯별기존필터는유지하고사용자지시슬롯·과대한검색/잘못된Unicode는전송전거절한다',async()=>{
 const calls:URL[]=[];const client=new ApiClient(async path=>{calls.push(new URL(String(path),'https://anvil.invalid'));return Response.json({items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:'2026-10-19T00:00:00Z'});});
 for(const [code,filter] of [['RULES_SCOPE','CONSTITUTION'],['DECISIONS_REASON','DECISION'],['CURRENT_POSITION',null],['ACTUAL_GAPS',null],['NEXT_ACTION',null]]){await load(client,pid,code,'',null);assert.equal(calls.at(-1)!.searchParams.get('kind'),filter);}
 const before=calls.length;for(const [code,q] of [['LATEST_INSTRUCTIONS','검색'],['PURPOSE_REASON','x'.repeat(201)],['PURPOSE_REASON','\ud800']])await assert.rejects(load(client,pid,code,q,null));assert.equal(calls.length,before);
});
test('조회거절·다른버전/변조본문은빈검색이나선택원문으로대체하지않는다',async()=>{
 for(const status of [401,403,503])await assert.rejects(load(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status})),pid,'PURPOSE_REASON','q',null),(e:any)=>e.status===status);
 for(const change of [(v:any)=>({...v,ref:{...v.ref,version:2}}),(v:any)=>({...v,body:'바뀐 본문'})]){const f=fixture();const page=await load(new ApiClient(async path=>Response.json(String(path).includes('/versions/')?change(f.view):{items:[f.hit],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:'2026-10-19T00:00:00Z'})),pid,'PURPOSE_REASON','q',null);await assert.rejects(page.items[0].inspect());}
});
test('원문선택화면은제목·이유검색입력을제공하되지시슬롯에지식검색을섞지않는다',async()=>{
 const {createServer}=await import('vite'),{fileURLToPath}=await import('node:url'),{createElement}=await import('react'),{renderToStaticMarkup}=await import('react-dom/server');
 const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
 try{const component=await compiler.ssrLoadModule('/src/features/workspace/ContextSourcePicker.tsx');let requests=0;const props={client:new ApiClient(async()=>{requests++;throw Error('정적표시조회금지');}),projectId:pid,disabled:false,run:()=>{},onSelect:()=>{}};
 const knowledge=renderToStaticMarkup(createElement(component.ContextSourcePicker,{...props,code:'PURPOSE_REASON'}));assert.ok(knowledge.includes('aria-label="지식 제목·이유 검색"'));assert.ok(knowledge.includes('maxLength="200"'));
 const instruction=renderToStaticMarkup(createElement(component.ContextSourcePicker,{...props,code:'LATEST_INSTRUCTIONS'}));assert.equal(instruction.includes('지식 제목·이유 검색'),false);assert.ok(instruction.includes('사용자 지시 대화 목록'));assert.equal(requests,0);
 }finally{await compiler.close();}
});
