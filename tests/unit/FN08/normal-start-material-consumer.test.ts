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
 const f=instruction();assert.notDeepEqual(f.group.payloadRef,f.group.sourceRef);const item=consumer.readNormalCommandPage(f.page,f.scope,f.at).items[0]!;assert(item.materials!==null);assert.equal(item.materials.groups[0]!.kind,'INSTRUCTION');
 for(const mutate of [(g:any)=>g.payloadRef=ref(),(g:any)=>g.sourceRef=ref(),(g:any)=>g.kind='START_OPTIONS',(g:any)=>g.mediaType='application/json',(g:any)=>g.parts[0].byteOffset=1,(g:any)=>g.parts[0].partIndex=0,(g:any)=>g.extra=true]){
  const page=structuredClone(f.page);mutate(page.items[0]!.materials.groups[0]);rejects(()=>consumer.readNormalCommandPage(page,f.scope,f.at),'MATERIAL_DESCRIPTOR_INVALID');
 }
 const duplicate=structuredClone(f.page);duplicate.items[0]!.materials.groups.push(duplicate.items[0]!.materials.groups[0]!);rejects(()=>consumer.readNormalCommandPage(duplicate,f.scope,f.at),'MATERIAL_DESCRIPTOR_INVALID');
});
test('SEND 64KiB와 원문2MiB 경계를 지키며 200부분/50항목 초과를 거절한다',()=>{
 const text='a'.repeat(2097152),cuts=Array.from({length:31},(_,i)=>(i+1)*65536),f=instruction(text,cuts);
 const parsed=consumer.readNormalCommandPage(f.page,f.scope,f.at);assert(parsed.items[0]!.materials!==null);assert.equal(parsed.items[0]!.materials.groups[0]!.parts.length,32);assert.equal(consumer.assembleNormalInstructionMaterial(f.group,f.received).bytes.length,2097152);
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
 assert(parsed.materials!==null);
 const raw={transport:'NORMAL_PROTECTED',proofResultRef:ref(),material:{materialId:part.materialId,sourceRef:broken.group.sourceRef,partIndex:1,partCount:2,contentHash:part.contentHash,bytes:Buffer.from(broken.received[0]!.bytes).toString('base64url')},observedAt:broken.page.observedAt,expiresAt:broken.page.expiresAt,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
 rejects(()=>consumer.readNormalMaterialResponse(raw,parsed,part.materialId,broken.at),'MATERIAL_BYTES_MISMATCH');
});

const stopCodec=await import('../../../contracts/runtime/normal-stop-target-v1.ts');
function stopPage(){
 const f=instruction(),{envelopeHash:_,...base}=f.item.envelope;
 const startUnsigned={...base,commandId:randomUUID(),operation:'START_SESSION',payload:{contextBundleRef:ref(),optionsRef:ref()}},startEnvelope={...startUnsigned,envelopeHash:hash(startUnsigned)},startCommandRef=ref();
 const target={kind:'NORMAL_STOP_SCOPE_V1',projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:1,grantRef:ref(),parentStartCommandRef:startCommandRef,parentStartEnvelopeHash:startEnvelope.envelopeHash,executorRegistrationRef:base.executorRegistrationRef,sessionBindingRef:f.item.envelope.payload.sessionBindingRef,roleBindingRef:ref(),bindingGeneration:3,ownershipRef:ref(),mode:'COOPERATIVE_REQUEST_ONLY',forceKillAllowed:false};
 const stopUnsigned={...base,operation:'REQUEST_STOP',payload:{sessionBindingRef:target.sessionBindingRef,stopScopeRef:stopCodec.normalStopScopeRefV1(target,startEnvelope.commandId)}},item={sequence:8,commandRef:ref(),envelope:{...stopUnsigned,envelopeHash:hash(stopUnsigned)},materials:null,stopTarget:target};
 return{...f,item,page:{...f.page,items:[item]},original:{startCommandRef,startEnvelope,grantRef:target.grantRef,sessionBindingRef:target.sessionBindingRef,roleBindingRef:target.roleBindingRef,bindingGeneration:target.bindingGeneration,ownershipRef:target.ownershipRef}};
}
test('STOP만 자료 null과 target을 받고 원 START namespace·전체tuple 비교 전에 실행 권위를 반환하지 않는다',()=>{
 const f=stopPage(),parsed=consumer.readNormalCommandPage(f.page,f.scope,f.at),item=parsed.items[0]!;
 assert.equal(item.materials,null);assert.equal(item.materialsDescriptorHash,null);
 const checked=consumer.readNormalStopItem(item,f.original,f.at);assert.deepEqual(checked.stopTarget,f.item.stopTarget);
 for(const key of ['startCommandRef','grantRef','sessionBindingRef','roleBindingRef','ownershipRef'])assert.throws(()=>consumer.readNormalStopItem(item,{...f.original,[key]:ref()},f.at));
 assert.throws(()=>consumer.readNormalStopItem(item,{...f.original,bindingGeneration:4},f.at));
 assert.throws(()=>consumer.findNormalMaterial(item,randomUUID()),/MATERIAL_NOT_IN_DESCRIPTOR/);
});
test('STOP의 재해시 target·잘못된 namespace·START null·SEND stopTarget 혼합은 거절한다',()=>{
 const f=stopPage();for(const mutate of [(p:any)=>p.items[0].stopTarget.executionGeneration=2,(p:any)=>p.items[0].materials={manifestRef:ref(),groups:[]},(p:any)=>delete p.items[0].stopTarget]){const p=structuredClone(f.page);mutate(p);assert.throws(()=>consumer.readNormalCommandPage(p,f.scope,f.at));}
 const wrong=structuredClone(f.page),x=wrong.items[0]!;x.envelope.payload.stopScopeRef=stopCodec.normalStopScopeRefV1(x.stopTarget,x.stopTarget.parentStartCommandRef.id);const{envelopeHash:_,...u}=x.envelope;x.envelope.envelopeHash=hash(u);
 const shape=consumer.readNormalCommandPage(wrong,f.scope,f.at);assert.throws(()=>consumer.readNormalStopItem(shape.items[0]!,f.original,f.at));
 const i=instruction(),nullSend={...i.page,items:[{...i.item,materials:null}]};assert.throws(()=>consumer.readNormalCommandPage(nullSend,i.scope,i.at));assert.throws(()=>consumer.readNormalCommandPage({...i.page,items:[{...i.item,stopTarget:f.item.stopTarget}]},i.scope,i.at));
});

test('보호 GET client STOP 검산은 원 grant/credential/취소를 대조하고 자료 challenge/GET은0이다',async()=>{
 const {NormalProtectedGetClient}=await import('../../../apps/connector/runtime/normal-protected-get-client.ts');
 const f=stopPage(),item=consumer.readNormalCommandPage(f.page,f.scope,f.at).items[0]!;let now=f.at,calls=0;
 const options={origin:'https://normal.invalid',ca:'RAM',credential:'av3ex1_'+Buffer.alloc(32).toString('base64url'),credentialExpiresAt:new Date(f.at+60000).toISOString(),scope:{projectId:f.scope.projectId,executionId:f.scope.executionId,executionGeneration:1,connectorId:randomUUID(),grantRef:f.original.grantRef,credentialGeneration:1}};
 const client=new NormalProtectedGetClient(options,{now:()=>now,signer:{async sign(){calls++;throw Error('unexpected');}},request:()=>{calls++;throw Error('unexpected');}});
 const signal=new AbortController().signal;
 assert.deepEqual(client.readStopTarget(item,f.original,signal).stopTarget,f.item.stopTarget);
 assert.throws(()=>client.readStopTarget(item,{...f.original,grantRef:ref()},signal));
 await assert.rejects(client.prepareMaterial(item,randomUUID(),signal),/NORMAL_GET_INPUT_INVALID/);
 const cancelled=new AbortController();cancelled.abort();assert.throws(()=>client.readStopTarget(item,f.original,cancelled.signal),/NORMAL_GET_CANCELLED/);
 now=f.at+30000;assert.throws(()=>client.readStopTarget(item,f.original,signal));
 now=f.at+60000;assert.throws(()=>client.readStopTarget(item,f.original,signal),/NORMAL_GET_CREDENTIAL_EXPIRED/);assert.equal(calls,0);
});
