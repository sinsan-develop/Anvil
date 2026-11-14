import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
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

const hash=(v:unknown)=>contentHash(canonicalJson(v));
function instruction(text='가나다🙂',cuts:number[]=[]){
 const b=split(Buffer.from(text),cuts),group={...b.group,kind:'INSTRUCTION' as const,mediaType:'text/plain;charset=utf-8' as const};
 const at=Date.parse('2026-11-12T00:00:00.000Z'),context={projectId:randomUUID(),assignmentId:randomUUID(),executionId:randomUUID(),executionGeneration:1,
  connectionRef:ref(),environmentRef:ref(),authorizationReceiptRef:ref(),capabilityRef:ref(),budgetRef:ref(),sourceScopes:[{sourceRootRef:ref(),mappingRef:null,observationRef:ref(),baselineRef:ref(),targets:[{relativePath:'a.txt',kind:'FILE',access:'READ',recursive:false}]}]};
 const unsigned={schemaVersion:1,commandId:randomUUID(),issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString(),executorRegistrationRef:ref(),context,operation:'SEND_INSTRUCTION',payload:{sessionBindingRef:ref(),instructionRef:group.sourceRef,partsRef:group.payloadRef}};
 const envelope={...unsigned,envelopeHash:hash(unsigned)},materials={manifestRef:ref(),groups:[group]},item={sequence:3,commandRef:ref(),envelope,materials};
 const scope={projectId:context.projectId,executionId:context.executionId,executionGeneration:1,afterSequence:0};
 const page={transport:'NORMAL_PROTECTED',proofResultRef:ref(),items:[item],nextCursor:'opaque',hasMore:false,observedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString(),cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
 return{...b,group,item,page,scope,at};
}
test('SEND descriptor는 partsRef와 instructionRef를 각각 대조하고 닫힌 단일 그룹만 받는다',()=>{
 const f=instruction();assert.notDeepEqual(f.group.payloadRef,f.group.sourceRef);assert.equal(consumer.readNormalCommandPage(f.page,f.scope,f.at).items[0]!.materials.groups[0]!.kind,'INSTRUCTION');
 for(const mutate of [(g:any)=>g.payloadRef=ref(),(g:any)=>g.sourceRef=ref(),(g:any)=>g.kind='START_OPTIONS',(g:any)=>g.mediaType='application/json',(g:any)=>g.parts[0].byteOffset=1,(g:any)=>g.parts[0].partIndex=0,(g:any)=>g.extra=true]){
  const page=structuredClone(f.page);mutate(page.items[0]!.materials.groups[0]);rejects(()=>consumer.readNormalCommandPage(page,f.scope,f.at),'MATERIAL_DESCRIPTOR_INVALID');
 }
 const duplicate=structuredClone(f.page);duplicate.items[0]!.materials.groups.push(duplicate.items[0]!.materials.groups[0]!);rejects(()=>consumer.readNormalCommandPage(duplicate,f.scope,f.at),'MATERIAL_DESCRIPTOR_INVALID');
});
test('SEND 64KiB와 원문2MiB 경계를 지키며 200부분/50항목 초과를 거절한다',()=>{
 const text='a'.repeat(2097152),cuts=Array.from({length:31},(_,i)=>(i+1)*65536),f=instruction(text,cuts);
 const parsed=consumer.readNormalCommandPage(f.page,f.scope,f.at);assert.equal(parsed.items[0]!.materials.groups[0]!.parts.length,32);assert.equal(consumer.assembleNormalInstructionMaterial(f.group,f.received).bytes.length,2097152);
 const oversize=instruction('a'.repeat(65537));rejects(()=>consumer.readNormalCommandPage(oversize.page,oversize.scope,oversize.at),'MATERIAL_DESCRIPTOR_INVALID');
 const tooLarge=instruction(text+'a',[...cuts,2097152]);rejects(()=>consumer.readNormalCommandPage(tooLarge.page,tooLarge.scope,tooLarge.at),'MATERIAL_DESCRIPTOR_INVALID');
 const many=instruction('a'.repeat(201),Array.from({length:200},(_,i)=>i+1));rejects(()=>consumer.readNormalCommandPage(many.page,many.scope,many.at),'MATERIAL_DESCRIPTOR_INVALID');
 const page=structuredClone(f.page);page.items=Array.from({length:51},()=>structuredClone(page.items[0]!));rejects(()=>consumer.readNormalCommandPage(page,f.scope,f.at),'COMMAND_PAGE_INVALID');
});
test('SEND 부분 UTF8 경계·누락·중복·hash변조는 조립하지 않고 START 의미는 유지한다',()=>{
 const f=instruction('가나다🙂',[3,9]);rejects(()=>consumer.assembleNormalStartMaterial(f.group,f.received),'MATERIAL_DESCRIPTOR_INVALID');assert.equal(consumer.assembleNormalInstructionMaterial(f.group,[...f.received].reverse()).text,'가나다🙂');
 rejects(()=>consumer.assembleNormalInstructionMaterial(f.group,f.received.slice(1)),'MATERIAL_ASSEMBLY_INCOMPLETE');
 rejects(()=>consumer.assembleNormalInstructionMaterial(f.group,[f.received[0]!,f.received[0]!,f.received[2]!]),'MATERIAL_ASSEMBLY_INCOMPLETE');
 const bad=structuredClone(f.received);bad[0]!.bytes[0]=0;rejects(()=>consumer.assembleNormalInstructionMaterial(f.group,bad),'MATERIAL_ASSEMBLY_INCOMPLETE');
 const broken=instruction('🙂',[2]);rejects(()=>consumer.assembleNormalInstructionMaterial(broken.group,broken.received),'MATERIAL_ASSEMBLY_MISMATCH');
 const parsed=consumer.readNormalCommandPage(broken.page,broken.scope,broken.at).items[0]!,part=broken.group.parts[0]!;
 const raw={transport:'NORMAL_PROTECTED',proofResultRef:ref(),material:{materialId:part.materialId,sourceRef:broken.group.sourceRef,partIndex:1,partCount:2,contentHash:part.contentHash,bytes:Buffer.from(broken.received[0]!.bytes).toString('base64url')},observedAt:broken.page.observedAt,expiresAt:broken.page.expiresAt,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
 rejects(()=>consumer.readNormalMaterialResponse(raw,parsed,part.materialId,broken.at),'MATERIAL_BYTES_MISMATCH');
});
