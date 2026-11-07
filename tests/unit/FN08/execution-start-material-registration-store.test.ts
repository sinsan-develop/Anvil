import assert from 'node:assert/strict';
import test from 'node:test';
import {SyntheticPgStartMaterialRegistration} from '../../../apps/server/modules/executions/execution-start-material-registration-store.ts';
import {assertMaterialCapacity} from '../../../apps/server/modules/executions/execution-material-registration-input.ts';
test('START registrar는 기본 source·잘못된 transport·미구성 실제 포트를 거절한다',()=>{
 for(const source of [undefined,{}, {transport:'HTTP'},{transport:'SYNTHETIC_ONLY',describe:async()=>({}),inspect:async()=>({})}])assert.throws(()=>new SyntheticPgStartMaterialRegistration(source as any),/MATERIAL_REGISTRATION_REQUIRED/);
});
test('START registrar는 같은 원 Tx에서 발급하지 않은 prepare 선언을 저장하지 않는다',async()=>{
 let effects=0;const source:any={transport:'SYNTHETIC_ONLY',describe:async()=>{effects++;},inspect:async()=>{effects++;},readBody:async()=>{effects++;return new Uint8Array();}};
 const r=new SyntheticPgStartMaterialRegistration(source),db:any={query:async()=>{effects++;throw Error('예상 외 저장');}};
 await assert.rejects(r.register(db,{descriptor:{},manifestRef:{}} as any,{} as any,'af080078-1111-4111-8111-000000000001'),/MATERIAL_REGISTRATION_INTEGRITY/);assert.equal(effects,0);
});
test('START와 SEND의 전체 이력 한도는 프로젝트 및 grant의 정확 경계에서 닫힌다',()=>{
 const zero={projectCount:0,projectBytes:0,grantCount:0,grantBytes:0};assert.doesNotThrow(()=>assertMaterialCapacity(zero,10000,67108864));
 for(const [field,value]of [['projectCount',100000],['projectBytes',1073741824],['grantCount',10000],['grantBytes',67108864]] as const){assert.throws(()=>assertMaterialCapacity({...zero,[field]:value},1,1),/MATERIAL_REGISTRATION_LIMIT/);}
 for(const v of [NaN,Infinity,-1,1.5])assert.throws(()=>assertMaterialCapacity({...zero,projectCount:v},1,1));
});
