import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../../apps/server/app.ts';
import {registerProjectRoutes} from '../../../apps/server/modules/projects/routes.ts';
import Fastify from 'fastify';

test('normal SEND는 buildApp과 exported route 모두 정확한 명시 설정만 받는다',async()=>{
 for(const invalid of [null,{}, {mode:'SYNTHETIC_ONLY'},{mode:'NORMAL_PROTECTED',extra:true},Object.defineProperty({},'mode',{enumerable:true,get(){throw Error('GETTER_RAN');}}),new Proxy({mode:'NORMAL_PROTECTED'},{ownKeys(){throw Error('PROXY_RAN');}})]){
  const args:any[]=[{}];args[21]=invalid;
  assert.throws(()=>(buildApp as any)(...args),/NORMAL_INSTRUCTION_CONFIGURATION_INVALID/);
  const app=Fastify();try{assert.throws(()=>registerProjectRoutes(app,{} as any,undefined,undefined,undefined,undefined,invalid as any),/NORMAL_INSTRUCTION_CONFIGURATION_INVALID/);}finally{await app.close();}
 }
});
