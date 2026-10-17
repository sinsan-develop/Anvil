import assert from 'node:assert/strict';import {test} from 'node:test';import {randomBytes,randomUUID} from 'node:crypto';import {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';import {buildApp} from '../../../apps/server/app.ts';
const id='11111111-1111-4111-8111-111111111111';
test('새 소스 원문 route는 현재 로그인이 없으면 DB에 연결하지 않고401로 차단한다',async()=>{const pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});try{
 for(const suffix of ['/source-roots','/source-roots/'+id+'/versions/1']){const r=await app.inject({method:'GET',url:'/api/v1/projects/'+id+suffix,headers:{host:'localhost:3830'}});assert.equal(r.statusCode,401,r.body);assert.equal(r.json().code,'AUTH_REQUIRED');}
 for(const operation of ['saveSourceRoot','reviseSourceRoot','revokeSourceRoot']){const r=await app.inject({method:'POST',url:'/api/v1/projects/'+id+'/commands',headers:{host:'localhost:3830',origin:'https://localhost:3830','x-anvil-csrf':'C'.repeat(43)},payload:{schemaVersion:1,projectId:id,commandId:randomUUID(),clientId:id,controlGeneration:1,operation,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}}});assert.equal(r.statusCode,401,r.body);}
 assert.equal(pool.totalCount,0);
}finally{await app.close();await pool.end();}});
