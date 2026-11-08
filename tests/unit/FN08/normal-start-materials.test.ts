import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedMaterialPart} from '../../../apps/server/modules/executions/normal-start-materials.ts';
import {contentHash} from '../../../contracts/canonical.ts';
test('UTF-8 원본과 등록된 부분의 offset·길이·hash를 각각 검산한다',()=>{
 const raw='자료!',bytes=Buffer.from(raw),part=bytes.subarray(3);
 const source={sourceBytes:bytes.length,contentHash:contentHash(bytes)},p={byteOffset:3,utf8Bytes:part.length,contentHash:contentHash(part)};
 assert.deepEqual(checkedMaterialPart(raw,source,p),part);
 for(const delta of [{byteOffset:4},{utf8Bytes:0},{contentHash:'0'.repeat(64)}])assert.throws(()=>checkedMaterialPart(raw,source,{...p,...delta}));
 assert.throws(()=>checkedMaterialPart(raw,{...source,contentHash:'1'.repeat(64)},p));
});
