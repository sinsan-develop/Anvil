import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../../../apps/server/app.ts';

const origin='https://anvil-synthetic.invalid';
const url='/api/v1/connectors/'+randomUUID()+'/executions/'+randomUUID()+'/credential-exchange';
test('교환 기본 경로는 닫히고 명시 설정해도 평문·forwarded 헤더로는 접근할 수 없다',async()=>{
 const opts={pool:{connect(){throw Error('예상하지 않은 DB 연결');}},origin,storage:{observe(){throw Error();}}};
 const closed=buildApp(),app=buildApp({},undefined,undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,undefined,opts as any);
 try{
  assert.equal((await closed.inject({method:'POST',url,payload:{}})).statusCode,404);
  const denied=await app.inject({method:'POST',url,payload:{},headers:{host:'anvil-synthetic.invalid','x-forwarded-proto':'https'}});
  assert.equal(denied.statusCode,403);
  await app.ready();
  for(const extra of [{cookie:'qa=example'},{authorization:'Bearer synthetic'},{origin}, {'anvil-execution-auth':'!'}]){
   const res=await inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:true});app.routing(req,rep);},
    {method:'POST',url,payload:'{}',headers:{host:'anvil-synthetic.invalid','content-type':'application/json',...extra}});
   assert.ok([400,403].includes(res.statusCode));
  }
 }finally{await app.close();await closed.close();}
});
