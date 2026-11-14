import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativeReceiveNativeBounds} from '../../../apps/server/modules/executions/native-first-receive-store.ts';

test('명시 v2 최대 authority는 v1 exact byte를 보존하며 승인된 operation의 38 bytes만 더한다',()=>{
 const old=nativeReceiveNativeBounds(),v1=nativeReceiveNativeBounds(undefined,1),v2=nativeReceiveNativeBounds(undefined,2);
 assert.deepEqual(old,v1);assert.equal(v1.AUTHORITY,2100130);
 assert.deepEqual(v2,{...v1,AUTHORITY:v1.AUTHORITY+38});
 for(const version of [null,0,3,'2',{},NaN])assert.throws(()=>nativeReceiveNativeBounds(undefined,version as any));
});

test('0093은 v1 SQL을 보존하고 원 window version 불변·예약/삽입/전달을 함께 검산한다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0093_native_receive_authority_version.sql.pending',import.meta.url),'utf8');
 assert.match(sql,/authority_version smallint NOT NULL DEFAULT 1/);
 assert.match(sql,/NEW\.authority_version IS DISTINCT FROM OLD\.authority_version/);
 assert.match(sql,/fn93_native_intent_bounds/);assert.match(sql,/fn93_plan/);
 assert.doesNotMatch(sql,/GRANT |DISABLE (?:TRIGGER|ROW LEVEL)|DROP POLICY/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});
