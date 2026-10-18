import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {newContextPreparation,prepareContextWrite} from '../../../apps/web/src/features/workspace/context-api.ts';
import {readContextPreparationInput} from '../../../apps/server/modules/context/context-input.ts';
import {planContextText} from '../../../apps/server/modules/context/context-text-plan.ts';
import {contentHash} from '../../../contracts/canonical.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});after(async()=>{await compiler.close();});
const module=existsSync(new URL('../../../apps/web/src/features/workspace/ContextDeliveryLimits.tsx',import.meta.url))?await compiler.ssrLoadModule('/src/features/workspace/ContextDeliveryLimits.tsx'):{};
const workspace=await compiler.ssrLoadModule('/src/features/workspace/WorkspaceContextPreparation.tsx');
const pid='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000002',ref={id:uid,version:1,contentHash:'a'.repeat(64)};
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},confirmed:any={projectId:pid,ref,snapshot:{definition:{budgetRef:null},contentConfirmed:true,ready:false,executionAuthorized:false,dispatchPerformed:false}};
function nodes(value:any):any[]{return !value||typeof value!=='object'?[]:[value,...(Array.isArray(value.props?.children)?value.props.children:[value.props?.children]).flatMap(nodes)];}
function input(props:any,label:string){assert.equal(typeof module.ContextDeliveryLimits,'function');const element=module.ContextDeliveryLimits(props);const found=nodes(element).find(node=>node.type==='input'&&node.props['aria-label']===label);assert.ok(found,label);return found.props;}
test('실제 두 입력 handler의 선택값이 기존 준비명령·서버검사·UTF8분할 계산까지 전달된다',()=>{
 const b=newContextPreparation(confirmed,session,1);b.input.reason='사용자 지정 분할 준비';
 const props=()=>({limits:b.input.limits,disabled:false,onChange:(limits:any)=>{b.input.limits=limits;b.dirty=true;}});
 input(props(),'부분 최대 UTF8 바이트').onChange({target:{value:'6'}});input(props(),'최대 부분 수').onChange({target:{value:'3'}});
 assert.deepEqual(b.input.limits,{maxPartBytes:6,maxParts:3});assert.equal(b.dirty,true);const command=prepareContextWrite(b,session),parsed=readContextPreparationInput(command.payload);assert.deepEqual(parsed.limits,{maxPartBytes:6,maxParts:3});
 const text='목적😀이유';const item={itemId:'purpose',category:'PURPOSE_REASON',required:true,sourceRef:ref,reason:'확인할 원문',state:'AVAILABLE',bodyRef:{artifactId:uid,bytes:16,contentHash:contentHash(text),mediaType:'text/plain;charset=utf-8'},body:text};
 const planned=planContextText([item],parsed.limits);assert.deepEqual(planned.parts.map(part=>part.utf8Bytes),[6,4,6]);assert.equal(planned.parts.map(part=>part.text).join(''),text);assert.equal(planned.executionAuthorized,false);assert.equal(planned.budgetVerified,false);
 input(props(),'최대 부분 수').onChange({target:{value:'2'}});const short=planContextText([item],readContextPreparationInput(prepareContextWrite(b,session).payload).limits);assert.deepEqual(short.missingRequired,['purpose']);assert.deepEqual(short.parts,[]);
});
test('빈값·0·범위초과·소수는 유효한기존값으로대체하지않고 기존명령검사에서거절된다',()=>{
 for(const [label,value] of [['부분 최대 UTF8 바이트',''],['부분 최대 UTF8 바이트','2097153'],['부분 최대 UTF8 바이트','1.5'],['최대 부분 수','0'],['최대 부분 수','201']]){const b=newContextPreparation(confirmed,session,1);b.input.reason='입력오류 보존';input({limits:b.input.limits,disabled:false,onChange:(limits:any)=>{b.input.limits=limits;}},label!).onChange({target:{value}});assert.equal(module.contextDeliveryLimitsValid(b.input.limits),false);assert.throws(()=>prepareContextWrite(b,session),{code:'CONTEXT_INPUT_INVALID'});}
 assert.equal(module.contextDeliveryLimitsValid({maxPartBytes:1,maxParts:1}),true);assert.equal(module.contextDeliveryLimitsValid({maxPartBytes:2097152,maxParts:200}),true);
});
test('부모 준비화면은 한도입력을 연결하고 잘못된한도에서 저장버튼을 닫는다',()=>{
 const b=newContextPreparation(confirmed,session,1);let requests=0;const client={get:async()=>{requests++;throw Error('정적표시에서조회금지');}};
 const render=()=>renderToStaticMarkup(createElement(workspace.WorkspaceContextPreparation,{client,confirmed,session,buffer:b,onChange:()=>{},owner:true,busy:false,run:()=>{}}));
 const valid=render();assert.ok(valid.includes('aria-label="부분 최대 UTF8 바이트"'));assert.ok(valid.includes('aria-label="최대 부분 수"'));assert.equal(valid.match(/<button[^>]*>준비 저장<\/button>/)?.[0].includes('disabled'),false);
 b.input.limits.maxParts=201;const invalid=render();assert.equal(invalid.match(/<button[^>]*>준비 저장<\/button>/)?.[0].includes('disabled'),true);assert.ok(invalid.includes('role="alert"'));assert.equal(requests,0);
});
test('잠금은 handler도 변경하지않고 정적표시는 토큰/실행허가가아닌분할한도와 오류를구분한다',()=>{
 let changed=0;const props={limits:{maxPartBytes:32768,maxParts:200},disabled:true,onChange:()=>{changed++;}};
 input(props,'부분 최대 UTF8 바이트').onChange({target:{value:'6'}});assert.equal(changed,0);const html=renderToStaticMarkup(createElement(module.ContextDeliveryLimits,props));assert.ok(html.includes('fieldset disabled'));assert.ok(html.includes('토큰·비용 한도 아님'));assert.ok(html.includes('value="32768"'));
 const bad=renderToStaticMarkup(createElement(module.ContextDeliveryLimits,{...props,disabled:false,limits:{maxPartBytes:0,maxParts:201}}));assert.ok(bad.includes('role="alert"'));
});
