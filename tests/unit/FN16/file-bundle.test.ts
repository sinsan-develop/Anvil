import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createFileManifest} from '../../../apps/server/modules/backups/file-manifest.ts';
import {createFileBundle} from '../../../apps/server/modules/backups/file-bundle.ts';
import type {FileManifestInput,FileSelection} from '../../../apps/server/modules/backups/file-manifest-input.ts';
import type {FileBundleInput} from '../../../apps/server/modules/backups/file-bundle-input.ts';
import {withBundleFixture} from './file-bundle-fixture.ts';
const selection=(name:string):FileSelection=>({path:name,versionRef:'version-1',required:true,ignored:true,decision:'include',reason:'합성 자료 명시 선택',classification:'ordinary'});
async function inputFor(root:string,parent:string,selections=[selection('data.bin')]):Promise<FileBundleInput> {
  const source:FileManifestInput={root,selections,limits:{maxFiles:10,maxFileBytes:1024,maxTotalBytes:1024,maxDurationMs:10000}};
  const manifest=await createFileManifest(source);
  return {source,manifest,baseline:{selections:structuredClone(selections),expectedManifestHash:manifest.manifestHash},destinationParent:parent,destinationName:'bundle'};
}
test('BOM·CRLF·바이너리 바이트를 실제 보관하고 독립 재읽기한다',async()=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    const bytes=Buffer.from([239,187,191,65,13,10,0,255]);await put('data.bin',bytes);
    const input=await inputFor(root,parent);input.source.limits.maxTotalBytes=bytes.length;input.source.limits.maxFileBytes=bytes.length;
    const result=await createFileBundle(input);
    assert.equal(result.complete,true);assert.equal(result.state,'complete');
    const actual=await fs.readFile(path.join(parent,'bundle/payload/data.bin'));
    assert.deepEqual(actual,bytes);assert.equal(createHash('sha256').update(actual).digest('hex'),input.manifest.entries[0]!.sha256);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(parent,'bundle/manifest.json'),'utf8')),input.manifest);
  });
});

test('기존 빈 목적지와 자료가 있는 목적지를 보존한다',async()=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    await fs.mkdir(path.join(parent,'bundle'));
    assert.equal((await createFileBundle(input)).issues[0]?.code,'DESTINATION_EXISTS');
    assert.deepEqual(await fs.readdir(path.join(parent,'bundle')),[]);
    await fs.writeFile(path.join(parent,'bundle/other.bin'),'keep',{flag:'wx'});await record(path.join(parent,'bundle/other.bin'));
    assert.equal((await createFileBundle(input)).complete,false);
    assert.equal(await fs.readFile(path.join(parent,'bundle/other.bin'),'utf8'),'keep');
  });
});
test('독립 기준 불일치면 목적지를 생성하지 않는다',async()=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    input.baseline.selections[0]!.versionRef='other-version';
    assert.equal((await createFileBundle(input)).complete,false);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});
test('metadata 이름 원본을 payload로 보존하고 민감·제외 원본은 열지 않는다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('manifest.json','payload metadata name');
    const excluded={...selection('absent-secret.bin'),required:false,classification:'secret' as const};
    const manual={...selection('absent-excluded.bin'),required:false,decision:'exclude' as const};
    const input=await inputFor(root,parent,[selection('manifest.json'),excluded,manual]);
    const original=fs.open;const opened:string[]=[];
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{opened.push(String(args[0]));return original(...args);});
    try {
      const result=await createFileBundle(input);assert.equal(result.complete,true);
      assert.equal(await fs.readFile(path.join(parent,'bundle/payload/manifest.json'),'utf8'),'payload metadata name');
      assert.equal(opened.some(p=>p.includes('absent-')),false);
      assert.deepEqual(result.manifest?.entries.filter(e=>e.status==='excluded').map(e=>e.reasonCode),['MANUAL_EXCLUDED','SENSITIVE_EXCLUDED']);
    } finally {mock.mock.restore();}
  });
});
test('원본·목적지 중첩과 디렉터리 링크를 거절한다',async()=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const nested=await createFileBundle({...input,destinationParent:root});assert.equal(nested.complete,false);
    await assert.rejects(fs.lstat(path.join(root,'bundle')),{code:'ENOENT'});
    await fs.symlink(root,path.join(parent,'bundle'),'junction');await record(path.join(parent,'bundle'));
    assert.equal((await createFileBundle({...input,destinationParent:path.join(parent,'bundle'),destinationName:'child'})).complete,false);
    assert.equal(await fs.readFile(path.join(root,'data.bin'),'utf8'),'original');
  });
});
test('최초 await 전에 입력을 고정하고 원래 Signal의 후속 취소는 관측한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);const abort=new AbortController();input.source.signal=abort.signal;
    const original=fs.lstat;let hit=false;
    const mock=t.mock.method(fs,'lstat',async(...args:Parameters<typeof fs.lstat>)=>{
      if(!hit) {hit=true;input.source.selections[0]!.versionRef='mutated';input.manifest.entries[0]!.sha256='0'.repeat(64);input.baseline.expectedManifestHash='0'.repeat(64);input.destinationName='other';abort.abort();}
      return original(...args);
    });
    try {const result=await createFileBundle(input);assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'CANCELLED');} finally {mock.mock.restore();}
    assert.deepEqual(await fs.readdir(parent),[]);
  });
});
test('사전 검증 뒤 변경된 원본을 거절하고 소유 부분 파일만 회수한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.mkdir;
    const mock=t.mock.method(fs,'mkdir',async(...args:Parameters<typeof fs.mkdir>)=>{
      const result=await original(...args);
      if(String(args[0])===path.join(parent,'bundle')) await put('data.bin','modified');
      return result;
    });
    let result;
    try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'CONTENT_MISMATCH');
    assert.equal(result.cleanup.every(e=>e.state==='removed'),true);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
    assert.equal(await fs.readFile(path.join(root,'data.bin'),'utf8'),'modified');
  });
});
test('재읽기 전 보관본 변조를 완료로 처리하지 않는다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;let corrupted=false;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      if(!corrupted && String(args[0])===path.join(parent,'bundle/manifest.json')) {corrupted=true;await fs.writeFile(path.join(parent,'bundle/payload/data.bin'),'corrupt!');}
      return original(...args);
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'CONTENT_MISMATCH');
    assert.equal(result.cleanup.some(e=>e.path==='payload/data.bin'&&e.state==='preserved'),true);
  });
});
test('쓰기 실패 때 unknown을 보존하고 호출 소유 항목만 회수한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      if(String(args[0])===path.join(parent,'bundle/payload/data.bin')) {
        await fs.writeFile(path.join(parent,'bundle/unknown.bin'),'synthetic unknown',{flag:'wx'});await record(path.join(parent,'bundle/unknown.bin'));
        throw Object.assign(new Error('private error must not leak'),{code:'EIO'});
      }
      return original(...args);
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.state,'partial');
    assert.equal(await fs.readFile(path.join(parent,'bundle/unknown.bin'),'utf8'),'synthetic unknown');
    assert.equal(JSON.stringify(result).includes('private error'),false);
    await assert.rejects(fs.lstat(path.join(parent,'bundle/payload')),{code:'ENOENT'});
  });
});
test('쓰기 진행이 없으면 실패하며 열린 파일 handle을 모두 닫는다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;let handles=0;let closes=0;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const handle=await original(...args);handles++;
      const close=handle.close.bind(handle);
      t.mock.method(handle,'close',async()=>{closes++;await close();});
      if(String(args[0])===path.join(parent,'bundle/payload/data.bin')) t.mock.method(handle,'write',async()=>({bytesWritten:0,buffer:Buffer.alloc(0)}));
      return handle;
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'WRITE_FAILED');assert.equal(closes,handles);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});
test('크기 한도와 사전 취소는 목적지 생성 전에 거절한다',async()=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    input.source.limits.maxTotalBytes=7;assert.equal((await createFileBundle(input)).complete,false);
    input.source.limits.maxTotalBytes=1024;input.source.signal=AbortSignal.abort();
    assert.equal((await createFileBundle(input)).issues[0]?.code,'CANCELLED');
    assert.deepEqual(await fs.readdir(parent),[]);
  });
});


test('최종 검증 중 unknown 유입은 완료를 막고 해당 파일은 보존한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      if(String(args[0])===path.join(parent,'bundle/manifest.json') && Number(args[1])===0) {await fs.writeFile(path.join(parent,'bundle/unknown.bin'),'synthetic unknown',{flag:'wx'});await record(path.join(parent,'bundle/unknown.bin'));}
      return original(...args);
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.state,'partial');
    assert.equal(await fs.readFile(path.join(parent,'bundle/unknown.bin'),'utf8'),'synthetic unknown');
  });
});
test('첫 IO 뒤 호출자 변조로 선택 버전과 기대 manifest를 바꾸지 못한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);const expected=structuredClone(input.manifest);
    const original=fs.lstat;let hit=false;
    const mock=t.mock.method(fs,'lstat',async(...args:Parameters<typeof fs.lstat>)=>{
      if(!hit) {hit=true;input.source.root=parent;input.source.selections[0]!.versionRef='other';input.source.limits.maxTotalBytes=1;input.manifest.entries[0]!.sha256='0'.repeat(64);input.baseline.selections[0]!.versionRef='other';input.baseline.expectedManifestHash='0'.repeat(64);input.destinationName='other';}
      return original(...args);
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,true);assert.deepEqual(result.manifest,expected);
    assert.equal(await fs.readFile(path.join(parent,'bundle/payload/data.bin'),'utf8'),'original');
  });
});
test('복사 도중 원본 변경을 읽기 뒤 검출하고 모든 파일 handle을 닫는다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;let sourceOpens=0,changed=false,opened=0,closed=0;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const h=await original(...args);opened++;const close=h.close.bind(h);t.mock.method(h,'close',async()=>{closed++;await close();});
      if(String(args[0])===path.join(root,'data.bin') && ++sourceOpens===2) {
        const read=h.read.bind(h);
        t.mock.method(h,'read',async(...a:Parameters<typeof h.read>)=>{const r=await read(...a);if(!changed) {changed=true;await put('data.bin','modified');}return r;});
      }
      return h;
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(changed,true);assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'FILE_CHANGED');assert.equal(opened,closed);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});
test('복사 읽기 실패 때 두 handle을 닫고 소유 출력만 회수한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;let sourceOpens=0,opened=0,closed=0;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const h=await original(...args);opened++;const close=h.close.bind(h);t.mock.method(h,'close',async()=>{closed++;await close();});
      if(String(args[0])===path.join(root,'data.bin') && ++sourceOpens===2) t.mock.method(h,'read',async()=>{throw new Error('private read error');});
      return h;
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(opened,closed);assert.equal(JSON.stringify(result).includes('private read error'),false);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});
test('실제 닫기 뒤 close 오류를 보고하고 다른 handle도 닫는다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.open;let opened=0,closed=0;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const h=await original(...args);opened++;const close=h.close.bind(h);
      t.mock.method(h,'close',async()=>{closed++;await close();if(String(args[0])===path.join(parent,'bundle/payload/data.bin')) throw new Error('private close error');});return h;
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'CLOSE_FAILED');assert.equal(opened,closed);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});
test('최종 metadata close에도 원래 전체 기한과 늦은 취소를 적용한다',async(t)=>{
  for(const kind of ['deadline','abort']) await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);input.source.limits.maxDurationMs=100;
    const abort=new AbortController();input.source.signal=abort.signal;
    let expired=false;const original=fs.open;
    const clock=t.mock.method(performance,'now',()=>expired?101:0);
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const h=await original(...args);
      if(String(args[0])===path.join(parent,'bundle/manifest.json') && Number(args[1])===0) {
        const close=h.close.bind(h);t.mock.method(h,'close',async()=>{await close();if(kind==='deadline') expired=true;else abort.abort();});
      }
      return h;
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();clock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,kind==='deadline'?'TIME_LIMIT':'CANCELLED');
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});

test('정리 거절은 소유 파일을 보존하고 partial로 반환한다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const open=fs.open;const unlink=fs.unlink;
    const failure=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      const h=await open(...args);
      if(String(args[0])===path.join(parent,'bundle/payload/data.bin')) t.mock.method(h,'write',async()=>{throw new Error('write failure');});
      return h;
    });
    const deny=t.mock.method(fs,'unlink',async(...args:Parameters<typeof fs.unlink>)=>{
      if(String(args[0])===path.join(parent,'bundle/payload/data.bin')) throw Object.assign(new Error('denied cleanup'),{code:'EACCES'});
      return unlink(...args);
    });
    let result;try {result=await createFileBundle(input);} finally {failure.mock.restore();deny.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.state,'partial');
    assert.equal(result.cleanup.some(e=>e.path==='payload/data.bin'&&e.state==='preserved'&&e.reason==='CLEANUP_FAILED'),true);
    assert.equal((await fs.lstat(path.join(parent,'bundle/payload/data.bin'))).isFile(),true);
  });
});
test('원본 링크는 읽지 않고 거절하며 목적지도 생성하지 않는다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    await fs.unlink(path.join(root,'data.bin'));await fs.symlink(path.join(root,'absent.bin'),path.join(root,'data.bin'),'file');await record(path.join(root,'data.bin'));
    const original=fs.open;let sourceReads=0;
    const mock=t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{if(String(args[0]).startsWith(root)) sourceReads++;return original(...args);});
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(sourceReads,0);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});
test('최종 디렉터리 handle close 실패는 완료가 아니다',async(t)=>{
  await withBundleFixture(async(root,parent,put,record)=>{
    await put('data.bin','original');const input=await inputFor(root,parent);
    const original=fs.opendir;let opened=0,closed=0;
    const mock=t.mock.method(fs,'opendir',async(...args:Parameters<typeof fs.opendir>)=>{
      const d=await original(...args);opened++;const close=d.close.bind(d);
      t.mock.method(d,'close',async()=>{closed++;await close();throw new Error('directory close failed');});return d;
    });
    let result;try {result=await createFileBundle(input);} finally {mock.mock.restore();}
    assert.equal(result.complete,false);assert.equal(result.issues[0]?.code,'CLOSE_FAILED');assert.equal(opened,closed);
    await assert.rejects(fs.lstat(path.join(parent,'bundle')),{code:'ENOENT'});
  });
});



test('중첩 상대경로와 여러 파일을 총 원본 크기 한도 안에서 보관한다',async()=>{
  await withBundleFixture(async(root,parent,put)=>{
    await put('nested/data.bin','abc');await put('other.bin','de');
    const input=await inputFor(root,parent,[selection('nested/data.bin'),selection('other.bin')]);
    input.source.limits.maxFileBytes=3;input.source.limits.maxTotalBytes=5;
    const result=await createFileBundle(input);assert.equal(result.complete,true);
    assert.equal(await fs.readFile(path.join(parent,'bundle/payload/nested/data.bin'),'utf8'),'abc');
    assert.equal(await fs.readFile(path.join(parent,'bundle/payload/other.bin'),'utf8'),'de');
  });
});
