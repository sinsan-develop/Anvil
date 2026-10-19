import test from 'node:test';import assert from 'node:assert/strict';
const mod:any=await import('../../../apps/web/src/features/session-detail/reported-change-diff.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const ref={id:'a6f30000-0000-4000-8000-000000000091',version:1,contentHash:'a'.repeat(64)};
const change=()=>({path:'src/handler.ts',kind:'MODIFIED',diffRef:structuredClone(ref),beforeHash:'b'.repeat(64),afterHash:'c'.repeat(64)});
test('보고diff는같은원제출에정확등록된단일artifact fullref로만연결한다',()=>{
 assert.equal(typeof mod.resolveReportedChangeDiff,'function');const value=change(),before=structuredClone(value),selected=mod.resolveReportedChangeDiff(value,[ref]);assert.deepEqual(selected,ref);selected.contentHash='d'.repeat(64);assert.deepEqual(value,before);assert.deepEqual(ref.contentHash,'a'.repeat(64));
});
test('없는/다른hash·버전/중복등록·잘못된변경형식을다른원문으로대체하지않는다',()=>{
 assert.equal(typeof mod.resolveReportedChangeDiff,'function');for(const [value,refs]of[[change(),[]],[change(),[{...ref,contentHash:'f'.repeat(64)}]],[{...change(),diffRef:{...ref,version:2}},[ref]],[change(),[ref,ref]],[null,[ref]],[{...change(),path:{}},[ref]],[{...change(),diffRef:null},[ref]],[{...change(),kind:'EXECUTE'},[ref]]])assert.equal(mod.resolveReportedChangeDiff(value,refs),null);
});
