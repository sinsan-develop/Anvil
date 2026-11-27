import test,{type TestContext} from 'node:test';
import {constants,type BigIntStats} from 'node:fs';
import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createFileManifest} from '../../../apps/server/modules/backups/file-manifest.ts';
import {createFileBundle} from '../../../apps/server/modules/backups/file-bundle.ts';
import {validateFileRestore} from '../../../apps/server/modules/backups/file-restore-validation.ts';
import type {FileSelection} from '../../../apps/server/modules/backups/file-manifest-input.ts';
import type {FileRestoreValidationInput} from '../../../apps/server/modules/backups/file-restore-validation-input.ts';
import {withRestoreFixture} from './file-restore-validation-fixture.ts';
const selection=(name:string):FileSelection=>({path:name,versionRef:'version-1',required:true,ignored:true,decision:'include',reason:'명시 선택 합성 원문',classification:'ordinary'});
type Fixture=Parameters<Parameters<typeof withRestoreFixture>[0]>[0];
async function bundle(f:Fixture,selections=[selection('data.bin')]):Promise<FileRestoreValidationInput> {
  const limits={maxFiles:10,maxFileBytes:1024,maxTotalBytes:1024,maxDurationMs:10000};
  const source={root:f.source,selections,limits};const manifest=await createFileManifest(source);
  const baseline={selections:structuredClone(selections),expectedManifestHash:manifest.manifestHash};
  assert.equal((await createFileBundle({source,manifest,baseline,destinationParent:f.backupParent,destinationName:'bundle'})).complete,true);
  return {bundleRoot:path.join(f.backupParent,'bundle'),baseline,limits,maxMetadataBytes:8192,validationParent:f.validationParent,validationName:'restored'};
}
test('원 source 삭제 뒤 보관본만으로 BOM·CRLF·binary를 새 위치에 검증복원한다',async()=>{
  await withRestoreFixture(async f=>{
    const bytes=Buffer.from([239,187,191,65,13,10,0,255]);await f.put('data.bin',bytes);const input=await bundle(f);await f.removeSource();
    input.limits.maxTotalBytes=bytes.length;input.limits.maxFileBytes=bytes.length;
    const result=await validateFileRestore(input);
    assert.equal(result.complete,true);assert.equal(result.state,'complete');
    assert.deepEqual(await fs.readFile(path.join(f.validationParent,'restored/payload/data.bin')),bytes);
    assert.deepEqual(await fs.readFile(path.join(input.bundleRoot,'payload/data.bin')),bytes);
    await assert.rejects(fs.lstat(f.source),{code:'ENOENT'});
  });
});

test('독립 기준 부재는 파일 읽기·목적지 생성 전에 거절한다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f);input.baseline.expectedManifestHash='';
    const original=fs.open;let opens=0;const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{opens++;return original(...args);});
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'BASELINE_MISMATCH');assert.equal(opens,0);assert.deepEqual(await fs.readdir(f.validationParent),[]);
  });
});
for(const scenario of ['json','truncated','oversize','hash','version','missing','tampered','extra-root','extra-payload','excluded','directory','link'] as const) {
  test(`보관본 ${scenario} 불일치의 내용/미지 경로를 채택하지 않는다`,async t=>{
    await withRestoreFixture(async f=>{
      await f.put('data.bin','original');const secret={...selection('secret.bin'),required:false,classification:'secret' as const};
      const input=await bundle(f,[selection('data.bin'),secret]);const metadata=path.join(input.bundleRoot,'manifest.json'),payload=path.join(input.bundleRoot,'payload');
      const originalMetadata=await fs.readFile(metadata);
      let forbidden:string|undefined;
      if(scenario==='json') await fs.writeFile(metadata,'{invalid');
      if(scenario==='truncated') await fs.writeFile(metadata,originalMetadata.subarray(0,originalMetadata.length-4));
      if(scenario==='oversize') input.maxMetadataBytes=originalMetadata.length-1;
      if(scenario==='hash') input.baseline.expectedManifestHash='0'.repeat(64);
      if(scenario==='version') input.baseline.selections[0]!.versionRef='other-version';
      if(scenario==='missing') await fs.unlink(path.join(payload,'data.bin'));
      if(scenario==='tampered') await fs.writeFile(path.join(payload,'data.bin'),'tampered');
      if(['extra-root','extra-payload','excluded'].includes(scenario)) {
        forbidden=path.join(scenario==='extra-root'?input.bundleRoot:payload,scenario==='excluded'?'secret.bin':'unknown.bin');
        await fs.writeFile(forbidden,'synthetic unexpected payload',{flag:'wx'});await f.record(forbidden);
      }
      if(scenario==='directory') {forbidden=path.join(payload,'unknown-dir');await fs.mkdir(forbidden);await f.record(forbidden);const child=path.join(forbidden,'unknown.bin');await fs.writeFile(child,'do not read');await f.record(child);}
      if(scenario==='link') {await fs.unlink(path.join(payload,'data.bin'));forbidden=path.join(payload,'data.bin');await fs.symlink(f.source,forbidden,'junction');await f.record(forbidden);}
      const open=fs.open;let forbiddenOpened=false;
      const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{if(forbidden&&String(args[0]).startsWith(forbidden)) forbiddenOpened=true;return open(...args);});
      let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
      const expectedCode={json:'METADATA_INVALID',truncated:'METADATA_INVALID',oversize:'METADATA_LIMIT',hash:'MANIFEST_INVALID',version:'CONTENT_MISMATCH',missing:'INVENTORY_MISMATCH',tampered:'CONTENT_MISMATCH','extra-root':'INVENTORY_MISMATCH','extra-payload':'INVENTORY_MISMATCH',excluded:'INVENTORY_MISMATCH',directory:'INVENTORY_MISMATCH',link:'INVENTORY_MISMATCH'}[scenario];
      assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,expectedCode);assert.equal(forbiddenOpened,false);
      assert.deepEqual(await fs.readdir(f.validationParent),[]);
      assert.equal(await fs.readFile(path.join(f.source,'data.bin'),'utf8'),'original');
    });
  });
}

test('기존 빈 목적지·보관본 중첩·목적지 junction을 보존한다',async()=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f),dest=path.join(f.validationParent,'restored');
    await fs.mkdir(dest);await f.record(dest);
    assert.equal((await validateFileRestore(input)).issues[0]?.code,'DESTINATION_EXISTS');assert.deepEqual(await fs.readdir(dest),[]);
    assert.equal((await validateFileRestore({...input,validationParent:input.bundleRoot})).issues[0]?.code,'DESTINATION_UNSAFE');
    await fs.rmdir(dest);await fs.symlink(f.source,dest,'junction');await f.record(dest);
    assert.equal((await validateFileRestore(input)).complete,false);
    assert.equal(await fs.readFile(path.join(f.source,'data.bin'),'utf8'),'original');
  });
});

test('첫 await 전에 입력을 고정하며 외부 Signal 교체는 채택하지 않는다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f);const controller=new AbortController();input.signal=controller.signal;
    const original=fs.lstat;let hit=false;
    const spy=t.mock.method(fs,'lstat',async(...args:Parameters<typeof fs.lstat>)=>{
      if(!hit) {hit=true;input.baseline.selections[0]!.versionRef='mutated';input.baseline.expectedManifestHash='0'.repeat(64);input.validationName='changed';input.limits.maxTotalBytes=1;input.maxMetadataBytes=1;input.signal=AbortSignal.abort();}
      return original(...args);
    });
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
    assert.equal(result.complete,true);assert.equal(await fs.readFile(path.join(f.validationParent,'restored/payload/data.bin'),'utf8'),'original');
  });
});

for(const late of ['metadata-change','payload-change','cancel','deadline','close-error'] as const) {
  test(`새 복사 후 ${late}는 성공으로 반환하지 않고 검증복사 보존을 명시한다`,async t=>{
    await withRestoreFixture(async f=>{
      await f.put('data.bin','original');const input=await bundle(f);const controller=new AbortController();input.signal=controller.signal;
      const metadata=path.join(input.bundleRoot,'manifest.json');const original=fs.open;let metadataReads=0,handles=0,closes=0,clock=0;
      const time=t.mock.method(performance,'now',()=>clock);
      const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
        const target=String(args[0]);const trigger=target===metadata&&++metadataReads===2;
        if(trigger&&late==='metadata-change') await fs.writeFile(metadata,'{}');
        if(trigger&&late==='payload-change') await fs.writeFile(path.join(input.bundleRoot,'payload/data.bin'),'tampered');
        const handle=await original(...args);handles++;const close=handle.close.bind(handle);
        t.mock.method(handle,'close',async()=>{
          closes++;await close();
          if(trigger) {if(late==='cancel') {input.signal=new AbortController().signal;controller.abort();}if(late==='deadline') clock=input.limits.maxDurationMs;if(late==='close-error') throw new Error('synthetic private close error');}
        });return handle;
      });
      let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();time.mock.restore();}
      assert.equal(result.complete,false);assert.equal(result.state,'partial');assert.equal(closes,handles);
      assert.equal(result.cleanup.some(e=>e.state==='preserved'&&e.reason==='IDENTITY_UNCONFIRMED'),true);
      if(late==='cancel') assert.equal(result.issues.some(i=>i.code==='CANCELLED'),true);
      if(late==='deadline') assert.equal(result.issues.some(i=>i.code==='TIME_LIMIT'),true);
      if(late==='close-error') assert.equal(result.issues.some(i=>i.code==='CLOSE_FAILED'),true);
      assert.equal(JSON.stringify(result).includes('synthetic private'),false);
      assert.equal(await fs.readFile(path.join(f.validationParent,'restored/payload/data.bin'),'utf8'),'original');
    });
  });
}

test('제외된 민감 경로를 허용 하위 경로의 디렉터리로 재해석하지 않는다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('nested/data.bin','original');const excluded={...selection('nested'),required:false,classification:'secret' as const};
    const input=await bundle(f,[selection('nested/data.bin'),excluded]);
    const open=fs.open;let payloadRead=false;const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{if(String(args[0]).includes(path.join('payload','nested'))) payloadRead=true;return open(...args);});
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'BASELINE_MISMATCH');assert.equal(payloadRead,false);assert.deepEqual(await fs.readdir(f.validationParent),[]);
  });
});

test('복사 쓰기 실패·unknown으로 인한 소유 정리 실패를 부분 결과에 보존한다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f);const dest=path.join(f.validationParent,'restored');const original=fs.open;
    const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      if(String(args[0])===path.join(dest,'payload/data.bin')) {
        const unknown=path.join(dest,'unknown.bin');await fs.writeFile(unknown,'synthetic unknown',{flag:'wx'});await f.record(unknown);
        throw Object.assign(new Error('private synthetic write failure'),{code:'EIO'});
      }
      return original(...args);
    });
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.state,'partial');assert.equal(result.issues[0]?.code,'WRITE_FAILED');
    assert.equal(result.cleanup.some(i=>i.state==='preserved'&&i.reason==='CLEANUP_FAILED'),true);
    assert.equal(await fs.readFile(path.join(dest,'unknown.bin'),'utf8'),'synthetic unknown');
    assert.equal(await fs.readFile(path.join(input.bundleRoot,'payload/data.bin'),'utf8'),'original');
    assert.equal(JSON.stringify(result).includes('private synthetic'),false);
  });
});

test('하위 복사 실패의 정리 중 원 Signal 취소도 원 실패와 함께 반환한다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f);const controller=new AbortController();input.signal=controller.signal;
    const dest=path.join(f.validationParent,'restored');const open=fs.open,rmdir=fs.rmdir;
    const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{if(String(args[0])===path.join(dest,'payload/data.bin')) throw Object.assign(new Error('write failure'),{code:'EIO'});return open(...args);});
    const clean=t.mock.method(fs,'rmdir',async(...args:Parameters<typeof fs.rmdir>)=>{const result=await rmdir(...args);if(String(args[0])===dest) controller.abort();return result;});
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();clean.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues.some(i=>i.code==='WRITE_FAILED'),true);assert.equal(result.issues.some(i=>i.code==='CANCELLED'),true);
    assert.equal(result.cleanup.every(i=>i.state==='removed'),true);assert.deepEqual(await fs.readdir(f.validationParent),[]);
  });
});


test('metadata 실제 읽기 실패와 뒤이은 close 실패를 둘 다 보존한다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f),metadata=path.join(input.bundleRoot,'manifest.json');const open=fs.open;let handles=0,closes=0;
    const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const handle=await open(...args);handles++;const close=handle.close.bind(handle);
      t.mock.method(handle,'close',async()=>{closes++;await close();if(String(args[0])===metadata) throw new Error('private close failure');});
      if(String(args[0])===metadata) t.mock.method(handle,'read',async()=>{throw Object.assign(new Error('private read failure'),{code:'EIO'});});
      return handle;
    });
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues.some(i=>i.code==='READ_FAILED'),true);assert.equal(result.issues.some(i=>i.code==='CLOSE_FAILED'),true);
    assert.equal(handles,closes);assert.deepEqual(await fs.readdir(f.validationParent),[]);assert.equal(JSON.stringify(result).includes('private'),false);
  });
});


for(const race of ['grow','truncate'] as const) {
  test(`metadata 열린 뒤 ${race} 경합에서 bounded read와 handle 종료를 확인한다`,async t=>{
    await withRestoreFixture(async f=>{
      await f.put('data.bin','original');const input=await bundle(f),metadata=path.join(input.bundleRoot,'manifest.json');input.maxMetadataBytes=(await fs.stat(metadata)).size;
      const open=fs.open;let opened=0,closed=0,changed=false;
      const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
        const handle=await open(...args);opened++;const close=handle.close.bind(handle);
        t.mock.method(handle,'close',async()=>{closed++;await close();});
        if(String(args[0])===metadata) {
          const read=handle.read.bind(handle);
          t.mock.method(handle,'read',async(...readArgs:Parameters<typeof handle.read>)=>{
            if(!changed) {changed=true;if(race==='grow') await fs.appendFile(metadata,'x');else await fs.truncate(metadata,1);}
            return read(...readArgs);
          });
        }
        return handle;
      });
      let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
      assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,race==='grow'?'METADATA_LIMIT':'FILE_CHANGED');assert.equal(opened,closed);assert.deepEqual(await fs.readdir(f.validationParent),[]);
    });
  });
}

test('metadata와 bundle root의 junction을 따라가지 않는다',async()=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f);const metadata=path.join(input.bundleRoot,'manifest.json');
    await fs.unlink(metadata);await fs.symlink(f.source,metadata,'junction');await f.record(metadata);
    assert.equal((await validateFileRestore(input)).issues[0]?.code,'INVENTORY_MISMATCH');
    const link=path.join(f.validationParent,'restored');await fs.symlink(input.bundleRoot,link,'junction');await f.record(link);
    assert.equal((await validateFileRestore({...input,bundleRoot:link,validationName:'child'})).issues[0]?.code,'PATH_UNSAFE');
    assert.equal(await fs.readFile(path.join(f.source,'data.bin'),'utf8'),'original');
  });
});

test('builder 성공 뒤 새 목적지 metadata만 손상되어도 완료로 채택하지 않는다',async t=>{
  await withRestoreFixture(async f=>{
    await f.put('data.bin','original');const input=await bundle(f);
    const originalMetadata=path.join(input.bundleRoot,'manifest.json');
    const restoredMetadata=path.join(f.validationParent,'restored/manifest.json');
    const originalBytes=await fs.readFile(originalMetadata);const open=fs.open;let sourceReads=0,changed=false,opened=0,closed=0;
    const spy=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      if(String(args[0])===originalMetadata&&++sourceReads===2) {await fs.writeFile(restoredMetadata,'{}');changed=true;}
      const handle=await open(...args);opened++;const close=handle.close.bind(handle);
      t.mock.method(handle,'close',async()=>{closed++;await close();});return handle;
    });
    let result;try {result=await validateFileRestore(input);} finally {spy.mock.restore();}
    assert.equal(changed,true);assert.equal(result.complete,false);assert.equal(result.state,'partial');
    assert.equal(result.cleanup.some(entry=>entry.state==='preserved'&&entry.reason==='IDENTITY_UNCONFIRMED'),true);
    assert.equal(opened,closed);assert.deepEqual(await fs.readFile(originalMetadata),originalBytes);
    assert.equal(await fs.readFile(path.join(input.bundleRoot,'payload/data.bin'),'utf8'),'original');
    assert.equal(await fs.readFile(restoredMetadata,'utf8'),'{}');
  });
});


/** 이 범위는 node:fs의 실제 자료/ACL을 열지 않는다. 기존 actual fixture 시험은 이름 필터로 제외한다. */
async function ramRestore(t:TestContext,legacy=false){
 type Entry={directory:boolean;bytes:Buffer;ino:bigint;stamp:bigint};
 const root=path.resolve('Z:/fn16-manifest-ram'),bundleRoot=path.join(root,'bundle'),payload=path.join(bundleRoot,'payload'),validationParent=path.join(root,'validation');
 const entries=new Map<string,Entry>(),io:{op:string;target:string}[]=[];let next=1n,opened=0,closed=0;
 const add=(target:string,directory:boolean,bytes=Buffer.alloc(0))=>entries.set(target,{directory,bytes:Buffer.from(bytes),ino:next++,stamp:1n});
 function directories(target:string){const parent=path.dirname(target);if(parent!==target&&!entries.has(parent))directories(parent);if(!entries.has(target))add(target,true);}
 directories(payload);directories(validationParent);
 const payloadBytes=Buffer.from([239,187,191,65,13,10,0,255]);add(path.join(payload,'data.bin'),false,payloadBytes);
 const get=(target:string)=>{const entry=entries.get(target);if(!entry)throw Object.assign(new Error('RAM_MISSING'),{code:'ENOENT'});return entry;};
 const stat=(entry:Entry)=>({dev:1n,ino:entry.ino,mode:entry.directory?0o40700n:0o100600n,nlink:1n,size:BigInt(entry.bytes.length),mtimeNs:entry.stamp,ctimeNs:entry.stamp,isSymbolicLink:()=>false,isDirectory:()=>entry.directory,isFile:()=>!entry.directory} as unknown as BigIntStats);
 const children=(target:string)=>[...entries.keys()].filter(p=>p!==target&&path.dirname(p)===target);
 t.mock.method(fs,'lstat',async(target:any)=>{const name=String(target);io.push({op:'lstat',target:name});return stat(get(name));});
 t.mock.method(fs,'realpath',async(target:any)=>{const name=String(target);io.push({op:'realpath',target:name});get(name);return name;});
 t.mock.method(fs,'opendir',async(target:any)=>{const name=String(target);io.push({op:'opendir',target:name});assert(get(name).directory);const list=children(name);let at=0;return{read:async()=>at===list.length?null:{name:path.basename(list[at++]!)},close:async()=>{}} as any;});
 t.mock.method(fs,'readdir',async(target:any)=>{const name=String(target);io.push({op:'readdir',target:name});assert(get(name).directory);return children(name).map(p=>path.basename(p)) as any;});
 t.mock.method(fs,'mkdir',async(target:any)=>{const name=String(target);io.push({op:'mkdir',target:name});assert(!entries.has(name));assert(get(path.dirname(name)).directory);add(name,true);});
 t.mock.method(fs,'unlink',async(target:any)=>{const name=String(target);io.push({op:'unlink',target:name});assert(!get(name).directory);entries.delete(name);});
 t.mock.method(fs,'rmdir',async(target:any)=>{const name=String(target);io.push({op:'rmdir',target:name});assert(get(name).directory);assert.equal(children(name).length,0);entries.delete(name);});
 t.mock.method(fs,'open',async(target:any,flags:any)=>{
  const name=String(target),writing=typeof flags==='number'&&(flags&constants.O_WRONLY)!==0;io.push({op:writing?'openWrite':'openRead',target:name});
  if(writing){assert(flags&constants.O_CREAT);assert(flags&constants.O_EXCL);assert(!entries.has(name));assert(get(path.dirname(name)).directory);add(name,false);}
  const entry=get(name);assert(!entry.directory);opened++;let position=0,done=false;
  return{stat:async()=>{assert(!done);return stat(entry);},read:async(buffer:Buffer,offset:number,length:number)=>{assert(!done&&!writing);io.push({op:'read',target:name});const count=Math.min(length,entry.bytes.length-position);entry.bytes.copy(buffer,offset,position,position+count);position+=count;return{bytesRead:count,buffer};},write:async(buffer:Buffer,offset:number,length:number)=>{assert(!done&&writing);io.push({op:'write',target:name});entry.bytes=Buffer.concat([entry.bytes,buffer.subarray(offset,offset+length)]);entry.stamp++;return{bytesWritten:length,buffer};},close:async()=>{assert(!done);done=true;closed++;}} as any;
 });
 // 복사 엔진의 호출이 새 filesystem 지름길로 빠지면 RAM 경계에서 실패시킨다.
 for(const name of ['readFile','writeFile','appendFile','copyFile','cp','rename','rm','symlink','link','chmod','chown','stat','readlink'] as const)t.mock.method(fs,name,async()=>assert.fail('RAM 밖 fs 호출 금지: '+name));
 const selected={...selection('data.bin'),...(legacy?{reason:'보관한 \ud800 입력',versionRef:'version-\udfff'}:{reason:'한글 보관 🙂'})};
 const limits={maxFiles:10,maxFileBytes:1024,maxTotalBytes:1024,maxDurationMs:10000},manifest=await createFileManifest({root:payload,selections:[selected],limits});assert(manifest.complete);
 const metadata=path.join(bundleRoot,'manifest.json');add(metadata,false,Buffer.from(JSON.stringify(manifest),'utf8'));
 const input:FileRestoreValidationInput={bundleRoot,baseline:{selections:[selected],expectedManifestHash:manifest.manifestHash},limits,maxMetadataBytes:8192,validationParent,validationName:'restored'};
 const before=[...entries.keys()];io.length=0;const startingOpen=opened,startingClose=closed;
 return{input,manifest,metadata,payload,payloadBytes,io,entries,before,replace(bytes:Buffer){get(metadata).bytes=Buffer.from(bytes);},get handles(){return{opened:opened-startingOpen,closed:closed-startingClose};}};
}
for(const scenario of ['outer','outerEscaped','nested','nestedEscaped'] as const)test('RAM manifest 중복 키 '+scenario+'는 마지막 정상값·독립 hash가 같아도 내용 읽기·복사0',async t=>{
 const f=await ramRestore(t),raw=JSON.stringify(f.manifest),reason='"reason":'+JSON.stringify(f.manifest.entries[0]!.reason);
 const altered=scenario==='outer'?raw.replace('"complete":true','"complete":false,"complete":true'):scenario==='outerEscaped'?raw.replace('"complete":true','"com\\u0070lete":false,"complete":true'):raw.replace(reason,(scenario==='nested'?'"reason"':'"re\\u0061son"')+':"discarded",'+reason);
 assert.notEqual(altered,raw);assert.deepEqual(JSON.parse(altered),f.manifest,'일반 JSON.parse는 변조를 정상 마지막 값으로 접는다');assert.equal(contentHash(canonicalJson(JSON.parse(altered))),contentHash(canonicalJson(f.manifest)));f.replace(Buffer.from(altered,'utf8'));
 const result=await validateFileRestore(f.input);assert.equal(result.complete,false);assert.equal(result.state,'failed');assert.equal(result.manifest,null);assert.deepEqual(result.issues,[{code:'METADATA_INVALID'}]);assert.deepEqual(result.cleanup,[]);
 assert.equal(f.io.filter(v=>v.op==='read'&&v.target!==f.metadata).length,0);assert.equal(f.io.filter(v=>v.op==='openWrite'||v.op==='write'||v.op==='mkdir').length,0);assert.deepEqual([...f.entries.keys()],f.before);assert.deepEqual(f.handles,{opened:1,closed:1});
});
for(const scenario of ['utf8','legacy','invalidUtf8','limit','hash'] as const)test('RAM manifest 정상·기존 경계 '+scenario+'를 보존한다',async t=>{
 const f=await ramRestore(t,scenario==='legacy');if(scenario==='invalidUtf8')f.replace(Buffer.from([0xc3,0x28]));if(scenario==='limit')f.input.maxMetadataBytes=1;if(scenario==='hash')f.input.baseline.expectedManifestHash='0'.repeat(64);
 const result=await validateFileRestore(f.input),success=scenario==='utf8'||scenario==='legacy';assert.equal(result.complete,success);assert.equal(f.handles.opened,f.handles.closed);
 if(success){assert.deepEqual(result.manifest,f.manifest);assert.deepEqual(result.issues,[]);assert.deepEqual(f.entries.get(path.join(f.input.validationParent,'restored/payload/data.bin'))!.bytes,f.payloadBytes);assert.deepEqual(f.entries.get(path.join(f.input.validationParent,'restored/manifest.json'))!.bytes,Buffer.from(JSON.stringify(f.manifest),'utf8'));}
 else{assert.equal(result.issues[0]?.code,scenario==='invalidUtf8'?'METADATA_INVALID':scenario==='limit'?'METADATA_LIMIT':'MANIFEST_INVALID');assert.equal(f.io.filter(v=>v.op==='read'&&v.target!==f.metadata||['openWrite','write','mkdir'].includes(v.op)).length,0);assert.deepEqual([...f.entries.keys()],f.before);}
});
test('RAM manifest 보완 뒤 기존 공개 wire parser의 중복·Unicode 거절은 유지한다',()=>{
 assert.deepEqual(parseWireJson('{"ok":"한글🙂"}'),{ok:'한글🙂'});
 for(const raw of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"x":"\\ud800"}'])assert.throws(()=>parseWireJson(raw));
});
