import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {buildApp} from '../../../apps/server/app.ts';

// connector Bearer와 HUMAN cookie가 같이 와도 전역 자료/프로젝트 경로로 권한이 합쳐지면 실패한다.
test('등록상태 전용 credential은 cookie 유무와 무관하게 기존 API/명령에 들어가기 전에 거절한다',async()=>{
 const pool=new Pool({connectionTimeoutMillis:10}),access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)});
 const app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830'});
 try{
  const authorization='Bearer av3ct1_'+randomBytes(32).toString('base64url');
  for(const path of ['/api/v1/health','/api/v1/projects','/api/v1/projects/'+randomUUID()+'/commands','/api/v1/methodologies']){
   for(const cookie of [undefined,'__Host-anvil.sid='+randomBytes(32).toString('base64url')]){
    const response=await app.inject({method:path.endsWith('/commands')?'POST':'GET',url:path,headers:{host:'localhost:3830',origin:'https://localhost:3830',authorization,...(cookie?{cookie}:{})}});
    assert.equal(response.statusCode,403);assert.equal(response.json().code,'CONNECTOR_CREDENTIAL_SCOPE_DENIED');assert.equal(response.body.includes(authorization),false);
   }
  }
  const health=await app.inject('/api/v1/health');assert.equal(health.statusCode,200);assert.equal(health.json().scope,'process');
 }finally{await app.close();await pool.end();}
});
