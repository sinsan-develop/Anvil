import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes} from 'node:crypto';
import type {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {fixture,pid,id,actor} from './baseline-activation-fixture.ts';
function application(){let connections=0;const pool={connect:async()=>{connections++;throw Error('실DB접속 금지');}} as unknown as Pool;const repository=new AccessRepository(pool,{installationId:id(90),key:randomBytes(32)});return{app:buildApp({},undefined,{repository,origin:'https://localhost:3830'}),connections:()=>connections};}

test('FN04 current/fixed 실제 GET은 등록되고 익명401/no-store·DB접속0이다',async()=>{
 const {app,connections}=application();try{for(const suffix of ['/baseline-activations/current',`/baseline-activations/${id(101)}/versions/1`]){const response=await app.inject({method:'GET',url:`/api/v1/projects/${pid}${suffix}`,headers:{host:'localhost:3830'}});assert.equal(response.statusCode,401,'등록된 보호 GET이어야 한다: '+response.body);assert.equal(response.headers['cache-control'],'no-store');assert(!response.body.includes('reason'));}assert.equal(connections(),0);}finally{await app.close();}
});

test('FN04 activate 실제 command operation은등록되고인증전401·외부origin403이다',async()=>{
 const {app,connections}=application(),f=fixture(),headers={host:'localhost:3830',origin:'https://localhost:3830','x-anvil-csrf':'C'.repeat(43)};
 try{const response=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers,payload:f.command});assert.equal(response.statusCode,401,'operation enum/dispatch가 실제 등록되어야 한다: '+response.body);const external=await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{...headers,origin:'https://other.invalid'},payload:f.command});assert.equal(external.statusCode,403);assert.equal(connections(),0);}finally{await app.close();}
});

test('FN04 고정GET의generation은정규양의안전정수이며임의query를거절한다',async()=>{
 const {app,connections}=application();try{for(const generation of ['0','01','-1','1.0','9007199254740992']){const response=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/baseline-activations/${id(101)}/versions/${generation}`,headers:{host:'localhost:3830'}});assert.equal(response.statusCode,400,'잘못된 generation을 인증/DB조회 전에 닫는다');}const query=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/baseline-activations/current?all=1`,headers:{host:'localhost:3830'}});assert.equal(query.statusCode,400);assert.equal(connections(),0);}finally{await app.close();}
});

test('FN04 합성인증GET은실제current/fixedreader를소비하고원후보이유를반환하지않는다',async()=>{
 const f=fixture(),first=f.record();f.state.history=[first];f.state.pointer=first;const pool={connect:async()=>{throw Error('실DB접속 금지');}} as unknown as Pool,repository=new AccessRepository(pool,{installationId:id(90),key:randomBytes(32)});
 repository.authenticated=async(_token,_csrf,operation)=>operation(f.db,actor);const app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
 try{const headers={host:'localhost:3830'},current=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/baseline-activations/current`,headers});assert.equal(current.statusCode,200);assert.deepEqual(current.json().current.activationRef,first.ref);const fixed=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/baseline-activations/${first.ref.id}/versions/1`,headers});assert.equal(fixed.statusCode,200);assert.deepEqual(fixed.json().snapshot,first.snapshot);assert.equal(fixed.json().isCurrent,true);assert(!fixed.body.includes(f.input.reason));assert.deepEqual(f.state.writes,[]);
 }finally{await app.close();}
});
