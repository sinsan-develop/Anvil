import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {contentHash} from '../../../contracts/canonical.ts';
const consumer=await import('../../../apps/connector/runtime/normal-start-material-consumer.ts');
const ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)});
/** 원본을 주어진 byte 경계로 나눠 descriptor 그룹과 받은 부분을 만든다(서버 응답 검산을 통과한 것과 같은 형태). */
function split(source:Buffer,cuts:number[]){
 const edges=[0,...cuts,source.length],parts=[],received=[];
 for(let i=0;i<edges.length-1;i++){
  const bytes=source.subarray(edges[i],edges[i+1]),materialId=randomUUID(),part={materialId,partIndex:i+1,byteOffset:edges[i]!,utf8Bytes:bytes.length,contentHash:contentHash(bytes)};
  parts.push(part);received.push({proofResultRef:ref(),materialId,partIndex:i+1,bytes:new Uint8Array(bytes),observedAt:'2026-11-12T00:00:00.000Z',expiresAt:'2026-11-12T00:01:00.000Z'});
 }
 const group={kind:'START_OPTIONS' as const,payloadRef:ref(),sourceRef:ref(),sourceBytes:source.length,contentHash:contentHash(source),mediaType:'application/json' as const,parts};
 return {group,received};
}
const rejects=(fn:()=>unknown,code:string)=>assert.throws(fn,(e:any)=>e instanceof consumer.NormalMaterialConsumerFailure&&e.code===code);
test('여러 부분을 순서와 무관하게 받아 원본으로 조립하고, 문자 중간에서 나뉜 부분도 전체에서 UTF-8을 판정한다',()=>{
 const text='{"설명":"한글과 이모지 🙂를 포함한 실행 옵션"}',source=Buffer.from(text,'utf8');
 const at=source.indexOf(Buffer.from('🙂'))+2;// 4바이트 문자 중간
 const {group,received}=split(source,[5,at,source.length-3]);
 assert.throws(()=>new TextDecoder('utf-8',{fatal:true}).decode(received[1]!.bytes));// 부분 하나만으로는 UTF-8이 깨진다
 const out=consumer.assembleNormalStartMaterial(group,[...received].reverse());
 assert.equal(out.text,text);assert.equal(contentHash(out.bytes),group.contentHash);
});
test('누락·중복·순번 불일치·변조된 부분과 원본 hash·UTF-8 오류는 조립하지 않는다',()=>{
 const source=Buffer.from('{"a":"0123456789"}'),{group,received}=split(source,[4,9]);
 rejects(()=>consumer.assembleNormalStartMaterial(group,received.slice(1)),'MATERIAL_ASSEMBLY_INCOMPLETE');
 rejects(()=>consumer.assembleNormalStartMaterial(group,[received[0]!,received[0]!,received[2]!]),'MATERIAL_ASSEMBLY_INCOMPLETE');
 rejects(()=>consumer.assembleNormalStartMaterial(group,[{...received[0]!,partIndex:2},received[1]!,received[2]!]),'MATERIAL_ASSEMBLY_INCOMPLETE');
 const flipped=new Uint8Array(received[1]!.bytes);flipped[0]=flipped[0]!^1;
 rejects(()=>consumer.assembleNormalStartMaterial(group,[received[0]!,{...received[1]!,bytes:flipped},received[2]!]),'MATERIAL_ASSEMBLY_INCOMPLETE');
 rejects(()=>consumer.assembleNormalStartMaterial({...group,contentHash:'0'.repeat(64)},received),'MATERIAL_ASSEMBLY_MISMATCH');
 // 등록 hash와 일치해도 엄격 UTF-8이 아니면 거절한다
 const broken=Buffer.from([0x7b,0xff,0x7d]),b=split(broken,[1]);
 rejects(()=>consumer.assembleNormalStartMaterial(b.group,b.received),'MATERIAL_ASSEMBLY_MISMATCH');
});
test('BOM은 원본 bytes 그대로 보존한다',()=>{
 const source=Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from('{}')]),{group,received}=split(source,[]);
 const out=consumer.assembleNormalStartMaterial(group,received);
 assert.equal(Buffer.from(out.text,'utf8').length,source.length);
});
test('자료 경로는 UUID 네 개로만 만들고 쿼리를 붙이지 않는다',()=>{
 const ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()] as const;
 assert.equal(consumer.normalMaterialPath(...ids),'/api/v1/connectors/'+ids[0]+'/executions/'+ids[1]+'/commands/'+ids[2]+'/materials/'+ids[3]);
 rejects(()=>consumer.normalMaterialPath(ids[0],ids[1],ids[2],'../x'),'MATERIAL_PATH_INVALID');
});
