import test from 'node:test';
import assert from 'node:assert/strict';
import {openNativeHostStorage,nativeHostVerified,nativeHostWrite} from '../../../apps/server/modules/executions/native-host-storage.ts';
import {createHash} from 'node:crypto';
import {nativeHash} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {nativeFixture,id,ref} from './native-host-storage-fixture.ts';

test('host material은 잘못된 목적·digest·거래에 query 없이 닫힌다',async()=>{
 let calls=0;const db={query:async()=>{calls++;throw Error('query forbidden');}};
 for(const input of [{purpose:'HISTORY',digest:'a'.repeat(64)},{purpose:'CURRENT',digest:'bad'}]){
  await assert.rejects(openNativeHostStorage(db as any,'00000000-0000-4000-8000-000000000001',input.digest,input.purpose as any,()=>{}));
 }
 assert.equal(calls,0);
});

async function writeFixture(){
 const f=await nativeFixture(false,10000,true);
 try{
  const r=await f.nativeApp.inject({method:'POST',url:'/api/v1/projects/'+f.pid+'/native-boundary-preparations',headers:f.headers,payload:f.nativeCommand});assert.equal(r.statusCode,200,r.body);
  await f.db.query('BEGIN');const row=f.data().native[0],a=row.snapshot_json,ar={id:row.id,version:1,contentHash:row.content_hash},at=f.clockDate().toISOString(),expiresAt=new Date(Date.parse(at)+1000).toISOString();
  const scope=await openNativeHostStorage(f.db as any,row.id,row.credential_digest,'CHALLENGE',()=>{}),tail=f.data().nativeEvents[0],body={schemaVersion:1,authorityRef:ar,localAttemptRef:ref(9901)},input={schemaVersion:1,requestId:id(9902),authorityRef:ar,localAttemptRef:body.localAttemptRef,target:{method:'POST',path:'/api/v1/connector/native-preparations/'+row.id+'/consume',queryHash:nativeHash({}),bodyHash:nativeHash(body)}};
  const proposed={eventId:id(9903),serverNonce:'A'.repeat(43),issuedAt:at,expiresAt},packet={input,proposed};
  const snapshot={schemaVersion:1,purpose:'NATIVE_PREPARATION_AUTHORITY_EVENT',projectId:f.pid,authorityRef:ar,sequence:2,previousRef:{id:tail.id,version:1,contentHash:tail.content_hash},kind:'CHALLENGE_ISSUED',actor:{kind:'REGISTERED_HOST',registrationRef:a.scope.registrationRef,credentialId:a.credentialId,credentialGeneration:a.credentialGeneration},payload:{requestId:input.requestId,localAttemptRef:input.localAttemptRef,target:input.target,serverNonce:proposed.serverNonce,nonceDigest:createHash('sha256').update(proposed.serverNonce).digest('hex'),issuedAt:at,expiresAt},at,expiresAt};
  return {f,scope,packet,expected:{event:{ref:{id:proposed.eventId,version:1,contentHash:nativeHash(snapshot)},snapshot}}};
 }catch(error){await f.close();throw error;}
}

test('verifier lease는 위조·다른 목적/packet·재사용을 거절하고 원 DB의 한 번 저장만 허용한다',async()=>{
 const {f,scope,packet,expected}=await writeFixture();try{
  const lease=nativeHostVerified(scope.db,packet);
  await assert.rejects(nativeHostWrite(scope.db,{},'CHALLENGE',packet,expected),/NATIVE_PURPOSE_DENIED/);
  await assert.rejects(nativeHostWrite(scope.db,lease,'CONSUME',packet,expected),/NATIVE_PURPOSE_DENIED/);
  await assert.rejects(nativeHostWrite(scope.db,lease,'CHALLENGE',{...packet,input:{...packet.input,requestId:id(9988)}},expected),/NATIVE_PURPOSE_DENIED/);
  for(const sql of ['SELECT * FROM anvil.native_preparation_authorities','SELECT anvil.native_host_consume($1)','SELECT anvil.fn94_native_event($1)'])await assert.rejects(scope.db.query(sql,[]),/NATIVE_PURPOSE_DENIED/);
  assert.equal(f.data().nativeEvents.length,1);
  await nativeHostWrite(scope.db,lease,'CHALLENGE',packet,expected);assert.equal(f.data().nativeEvents.length,2);
  await assert.rejects(nativeHostWrite(scope.db,lease,'CHALLENGE',packet,expected),/NATIVE_PURPOSE_DENIED/);assert.equal(f.data().nativeEvents.length,2);
  scope.close();await assert.rejects(scope.db.query('SELECT 1'),/NATIVE_CONTEXT_CHANGED/);
 }finally{scope.close();await f.db.query('ROLLBACK');await f.close();}
});

test('verifier lease는 다른 DB·query·거래와 효과 후 응답 불명에서 재저장을 막는다',async()=>{
 for(const mode of ['DB','QUERY','TX','RESULT']){
  const {f,scope,packet,expected}=await writeFixture();try{
   const lease=nativeHostVerified(scope.db,packet),before=f.data().nativeEvents.length;
   if(mode==='DB')await assert.rejects(nativeHostWrite({query:scope.db.query},lease,'CHALLENGE',packet,expected),/NATIVE_PURPOSE_DENIED/);
   if(mode==='QUERY'){const query=f.db.query;f.db.query=(...args:any[])=>Reflect.apply(query,f.db,args);await assert.rejects(nativeHostWrite(scope.db,lease,'CHALLENGE',packet,expected),/NATIVE_CONTEXT_CHANGED/);}
   if(mode==='TX'){f.hostStorage!.swapTx=true;await assert.rejects(nativeHostWrite(scope.db,lease,'CHALLENGE',packet,expected),/NATIVE_OUTCOME_UNKNOWN/);}
   if(mode==='RESULT'){await assert.rejects(nativeHostWrite(scope.db,lease,'CHALLENGE',packet,{}),/NATIVE_OUTCOME_UNKNOWN/);assert.equal(f.data().nativeEvents.length,before+1);await assert.rejects(nativeHostWrite(scope.db,lease,'CHALLENGE',packet,expected),/NATIVE_PURPOSE_DENIED/);}
   else assert.equal(f.data().nativeEvents.length,before);
  }finally{scope.close();await f.db.query('ROLLBACK');await f.close();}
 }
});

test('host material은 DB 거래 교체와 digest 출력 및 추가 필드를 받아들이지 않는다',async()=>{
 const id='00000000-0000-4000-8000-000000000001';let calls=0;
 const db={query:async(sql:string)=>{calls++;return sql.includes('txid_current')?{rowCount:1,rows:[{transaction_id:'7'}]}:{rowCount:1,rows:[{result:{transactionId:'8',credentialDigest:'a'.repeat(64)}}]};}};
 await assert.rejects(openNativeHostStorage(db as any,id,'a'.repeat(64),'CURRENT',()=>{}));assert.equal(calls,2);
});

test('목적 SQL 오류는 고정 SQLSTATE와 메시지만 분류하고 임의 오류·getter·coercion은 인증 실패로 숨기지 않는다',async()=>{
 const authorityId='00000000-0000-4000-8000-000000000001';let effects=0;
 const known=Object.assign(Error('NATIVE_AUTH_REQUIRED'),{code:'42501'}),unknown=Object.assign(Error('permission denied for table'),{code:'42501'});
 const accessor=Object.defineProperty(Error('NATIVE_AUTH_REQUIRED'),'code',{get(){effects++;return '42501';}});
 const coercion=Object.assign(Error('NATIVE_AUTH_REQUIRED'),{code:{toString(){effects++;return '42501';}}});
 for(const error of [known,unknown,accessor,coercion]){
  const db={query:async(sql:string)=>{if(sql.includes('txid_current'))return{rowCount:1,rows:[{transaction_id:'7'}]};throw error;}};
  await assert.rejects(openNativeHostStorage(db as any,authorityId,'a'.repeat(64),'CURRENT',()=>{}),(caught:any)=>error===known?caught.message==='NATIVE_AUTH_REQUIRED'&&caught.statusCode===401:caught===error);
 }
 assert.equal(effects,0);
});

test('저장 거래 await 중 proof/body/ids와 expected 원본 변조는 이미 검산한 전송 snapshot을 바꾸지 않는다',async()=>{
 const {f,scope:initial}=await writeFixture();initial.close();
 let unblock!:()=>void,entered!:()=>void;const waiting=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{unblock=resolve;});
 const packet={proof:{requestId:id(9910)},signature:'original-signature',body:{authorityRef:ref(9911)},ids:{proofId:id(9912),consumeId:id(9913)}};
 const expected={receipt:{ref:ref(9914),snapshot:{requestId:packet.proof.requestId}}},originalPacket=structuredClone(packet),originalExpected=structuredClone(expected),query=f.db.query.bind(f.db);
 let block=false,captured:any=null,scope:Awaited<ReturnType<typeof openNativeHostStorage>>|undefined;
 f.db.query=async(sql:string,args:any[]=[])=>{
  if(sql.includes('txid_current')&&block){block=false;entered();await gate;}
  if(sql.startsWith('SELECT anvil.native_host_consume(')){captured={proof:JSON.parse(args[2]),signature:args[3],body:JSON.parse(args[4]),ids:JSON.parse(args[5])};return{rowCount:1,rows:[{result:structuredClone(originalExpected)}]};}
  return query(sql,args);
 };
 try{
  const row=f.data().native[0];scope=await openNativeHostStorage(f.db as any,row.id,row.credential_digest,'CONSUME',()=>{});
  const lease=nativeHostVerified(scope.db,packet);let effects=0;
  const proxy=new Proxy(packet,{ownKeys(){effects++;return Reflect.ownKeys(packet);}}),accessor=Object.defineProperty({},'receipt',{enumerable:true,get(){effects++;return expected.receipt;}});
  await assert.rejects(nativeHostWrite(scope.db,lease,'CONSUME',proxy,expected),/NATIVE_RECEIVE_INPUT_INVALID/);
  await assert.rejects(nativeHostWrite(scope.db,lease,'CONSUME',packet,accessor),/NATIVE_RECEIVE_INPUT_INVALID/);
  await assert.rejects(nativeHostWrite(scope.db,lease,'CONSUME',packet,Object.create({receipt:expected.receipt})),/NATIVE_RECEIVE_INPUT_INVALID/);
  assert.equal(effects,0);assert.equal(captured,null);
  block=true;const running=nativeHostWrite(scope.db,lease,'CONSUME',packet,expected);await waiting;
  packet.proof.requestId=id(9920);packet.signature='changed';packet.body.authorityRef=ref(9921);packet.ids.proofId=id(9922);packet.ids.consumeId=id(9923);expected.receipt.ref=ref(9924);expected.receipt.snapshot.requestId=id(9925);
  unblock();assert.deepEqual(await running,originalExpected);assert.deepEqual(captured,originalPacket);
 }finally{unblock();scope?.close();await f.db.query('ROLLBACK');await f.close();}
});
