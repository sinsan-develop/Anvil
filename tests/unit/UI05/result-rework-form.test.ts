import test from 'node:test';
import assert from 'node:assert/strict';
const m:any=await import('../../../apps/web/src/features/session-detail/result-rework-form.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('보완 입력은 같은 주체와 정확한 임무·결과·검수에만 다시 연결된다',()=>{
 assert.equal(typeof m.resultReworkFormKey,'function');
 const ref={id:'ref',version:1,contentHash:'a'.repeat(64)},scope={userId:'user',clientId:'client',projectId:'project',assignmentRef:{...ref},resultRef:{...ref},reviewRef:{...ref}},key=m.resultReworkFormKey(scope);
 const value={selected:['save'],files:['0:0'],bindingId:'binding',reason:'보완 사유'},store={[key]:value};
 assert.deepEqual(store[m.resultReworkFormKey(structuredClone(scope))],value);
 for(const field of ['userId','clientId','projectId'] as const){const changed=structuredClone(scope);changed[field]+='-other';assert.equal(store[m.resultReworkFormKey(changed)],undefined);}
 for(const field of ['assignmentRef','resultRef','reviewRef'] as const)for(const part of ['id','version','contentHash'] as const){const changed=structuredClone(scope);if(part==='version')changed[field].version++;else changed[field][part]+='other';assert.equal(store[m.resultReworkFormKey(changed)],undefined);}
 assert.deepEqual(scope.assignmentRef,ref);
});
