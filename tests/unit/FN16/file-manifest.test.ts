import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { withFixture } from './file-manifest-fixture.ts';

function assertPayloadHash(result:{complete:boolean;entries:unknown[];issues:unknown[];manifestHash:string}) {
  // 표준 JSON의 명시된 키 순서를 사용하며 제품 canonical 함수를 호출하지 않는다.
  const payload=JSON.stringify({complete:result.complete,entries:result.entries,issues:result.issues},['bytes','classification','code','complete','decision','entries','ignored','issues','path','reason','reasonCode','required','sha256','status','versionRef']);
  assert.equal(result.manifestHash,createHash('sha256').update(payload).digest('hex'));
}

test('실제 선택 파일의 바이트·제외·독립 재검증 경계', async t => {
  let engine: typeof import('../../../apps/server/modules/backups/file-manifest.ts') | undefined;
  try { engine = await import('../../../apps/server/modules/backups/file-manifest.ts'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw error;
  }
  assert.equal(typeof engine?.createFileManifest, 'function', '실제 파일 manifest 엔진이 필요하다');
  const {createFileManifest, verifyFileManifest} = engine!;
  await withFixture(async (root, put) => {
    const selection = (name: string, extra = {}) => ({path:name, versionRef:'원문-v1', required:false, ignored:false, decision:'include' as const, reason:'명시 선택', classification:'ordinary' as const, ...extra});
    const input = (selections = [selection('bom.txt')], limits = {}) => ({root, selections, limits:{maxFiles:20,maxFileBytes:1024*1024,maxTotalBytes:2*1024*1024,maxDurationMs:10000,...limits}});
    await put('bom.txt', Buffer.from([239,187,191,65,13,10]));
    await put('binary.dat', Buffer.from([0,255,128,13,10]));
    await put('ignored.txt', 'ignored');
    await t.test('BOM·CRLF·binary와 명시 ignored 포함을 그대로 hash', async () => {
      const request = input([selection('ignored.txt',{ignored:true,required:true}),selection('binary.dat'),selection('bom.txt')]);
      const result = await createFileManifest(request);
      assert.equal(result.complete,true);
      assert.deepEqual(result.entries.map(e=>e.path),['binary.dat','bom.txt','ignored.txt']);
      assert.equal(result.entries[1]?.bytes,6);
      assert.equal(result.entries[1]?.sha256,createHash('sha256').update(Buffer.from([239,187,191,65,13,10])).digest('hex'));
      assert.equal(result.entries[0]?.sha256,createHash('sha256').update(Buffer.from([0,255,128,13,10])).digest('hex'));
      assert.equal((await createFileManifest({...request,selections:[...request.selections].reverse()})).manifestHash,result.manifestHash);
      assert.deepEqual(await fs.readFile(path.join(root,'bom.txt')),Buffer.from([239,187,191,65,13,10]));
    });
    await t.test('required ignored 제외는 이유와 문제로 보인다', async () => {
      const result = await createFileManifest(input([selection('ignored.txt',{required:true,ignored:true,decision:'exclude',reason:'명시 제외'})]));
      assert.equal(result.complete,false);
      assert.equal(result.entries[0]?.reason,'명시 제외');
      assert.ok(result.issues.some(i=>i.code==='REQUIRED_EXCLUDED'));
    });
    await t.test('secret 분류는 존재 확인조차 하지 않고 제외', async () => {
      const result = await createFileManifest(input([selection('never-created-secret',{classification:'secret'})]));
      assert.equal(result.entries[0]?.status,'excluded');
      assert.equal(result.entries[0]?.sha256,null);
      assert.equal(result.entries[0]?.reasonCode,'SENSITIVE_EXCLUDED');
      assert.ok(!JSON.stringify(result).includes(root));
    });
    await t.test('누락은 부분 결과이고 원본 오류 경로가 유출되지 않는다', async () => {
      const result = await createFileManifest(input([selection('missing.txt'),selection('bom.txt')]));
      assert.equal(result.complete,false);
      assert.ok(result.issues.some(i=>i.code==='FILE_MISSING'));
      assert.equal(result.entries.filter(e=>e.status==='included').length,1);
      assert.ok(!JSON.stringify(result).includes(root));
    });
    await t.test('독립 원선택·참조·기대 hash와 실제 누락·변조를 재검증', async () => {
      const request = input();
      const result = await createFileManifest(request);
      const baseline = {selections:request.selections,expectedManifestHash:result.manifestHash};
      assert.equal((await verifyFileManifest(request,result,baseline)).valid,true);
      assert.equal((await verifyFileManifest(request,{...result,entries:[]},baseline)).valid,false);
      assert.equal((await verifyFileManifest(request,result,{...baseline,expectedManifestHash:'0'.repeat(64)})).valid,false);
      assert.equal((await verifyFileManifest(request,result,{...baseline,selections:[selection('bom.txt',{versionRef:'원문-v2'})]})).valid,false);
      await put('bom.txt','tampered');
      assert.equal((await verifyFileManifest(request,result,baseline)).valid,false);
      await fs.unlink(path.join(root,'bom.txt'));
      assert.equal((await verifyFileManifest(request,result,baseline)).valid,false);
      await put('bom.txt',Buffer.from([239,187,191,65,13,10]));
    });
    await t.test('경로·중복·case 충돌·한도·빈 이유를 읽기 전에 거절', async () => {
      for (const name of ['/abs','../up','a/../b','C:drive','a:b','a\\b/c','a//b','a.','CON','a\u0000b']) {
        const result = await createFileManifest(input([selection(name)]));
        assert.equal(result.complete,false,name);
        assert.ok(result.issues.some(i=>i.code==='INVALID_INPUT'),name);
      }
      for (const selections of [[selection('bom.txt'),selection('bom.txt')],[selection('bom.txt'),selection('BOM.txt')],[selection('bom.txt',{reason:''})]]) {
        assert.ok((await createFileManifest(input(selections))).issues.some(i=>i.code==='INVALID_INPUT'));
      }
      for (const limits of [{maxFiles:0},{maxDurationMs:Infinity},{maxFileBytes:-1}]) assert.ok((await createFileManifest(input(undefined,limits))).issues.some(i=>i.code==='INVALID_INPUT'));
      assert.ok((await createFileManifest(input(undefined,{maxFileBytes:2}))).issues.some(i=>i.code==='FILE_LIMIT'));
      assert.ok((await createFileManifest(input([selection('bom.txt'),selection('binary.dat')],{maxTotalBytes:7}))).issues.some(i=>i.code==='TOTAL_LIMIT'));
      assert.ok((await createFileManifest(input([selection('bom.txt'),selection('binary.dat')],{maxFiles:1}))).issues.some(i=>i.code==='INVALID_INPUT'));
    });
    await t.test('열린 실제 파일 변경과 오류·취소 뒤 handle을 닫는다', async () => {
      const originalOpen = fs.open;
      let opened=0,closed=0,mutated=false;
      let action:'mutate'|'fail'|'abort'='mutate';
      const controller = new AbortController();
      t.mock.method(fs,'open',async (...args: Parameters<typeof fs.open>) => {
        const handle = await originalOpen(...args); opened++;
        const close = handle.close.bind(handle);
        handle.close = async () => {closed++;return close();};
        const read = handle.read.bind(handle);
        handle.read = (async (...readArgs: unknown[]) => {
          if(action==='fail') throw new Error('secret absolute path must not escape');
          const result = await (read as Function)(...readArgs);
          if(action==='mutate' && !mutated) {mutated=true;await fs.appendFile(path.join(root,'bom.txt'),'x');}
          if(action==='abort') controller.abort();
          return result;
        }) as typeof handle.read;
        return handle;
      });
      try {
        assert.ok((await createFileManifest(input())).issues.some(i=>i.code==='FILE_CHANGED'));
        action='fail';
        const failure=await createFileManifest(input());
        assert.ok(failure.issues.some(i=>i.code==='READ_FAILED'));
        assert.ok(!JSON.stringify(failure).includes('secret absolute'));
        action='abort';
        assert.ok((await createFileManifest({...input(),signal:controller.signal})).issues.some(i=>i.code==='CANCELLED'));
        assert.equal(opened,closed);
      } finally { t.mock.restoreAll(); }
    });
  });
});

test('파일 handle 종료 지연도 전체 시간 한도에 포함한다', async t => {
  const {createFileManifest}=await import('../../../apps/server/modules/backups/file-manifest.ts');
  await withFixture(async (root,put)=>{
    await put('close.dat','abc');
    const originalOpen=fs.open;
    let opened=0,closed=0;
    t.mock.method(fs,'open',async (...args:Parameters<typeof fs.open>)=>{
      const handle=await originalOpen(...args);opened++;
      const close=handle.close.bind(handle);
      handle.close=async()=>{await close();closed++;await new Promise(resolve=>setTimeout(resolve,150));};
      return handle;
    });
    try {
      const result=await createFileManifest({root,selections:[{path:'close.dat',versionRef:'원문-v1',required:true,ignored:false,decision:'include',reason:'종료 시간 확인',classification:'ordinary'}],limits:{maxFiles:1,maxFileBytes:10,maxTotalBytes:10,maxDurationMs:100}});
      assert.equal(opened,1);
      assert.equal(closed,1);
      assert.equal(result.complete,false);
      assert.ok(result.issues.some(i=>i.code==='TIME_LIMIT'));
      assertPayloadHash(result);
    } finally {t.mock.restoreAll();}
  });
});

test('실제 junction과 민감 분류 미접근·취소 경계', async t=>{
  const {createFileManifest}=await import('../../../apps/server/modules/backups/file-manifest.ts');
  await withFixture(async(root,put)=>{
    await put('source.dat','abc');
    await put('junction','placeholder');
    await fs.unlink(path.join(root,'junction'));
    await fs.symlink(root,path.join(root,'junction'),'junction');
    const selection={path:'source.dat',versionRef:'원문-v1',required:false,ignored:false,decision:'include' as const,reason:'명시 선택',classification:'ordinary' as const};
    const request={root,selections:[selection],limits:{maxFiles:10,maxFileBytes:100,maxTotalBytes:100,maxDurationMs:10000}};
    assert.ok((await createFileManifest({...request,selections:[{...selection,path:'junction/source.dat'}]})).issues.some(i=>i.code==='PATH_UNSAFE'));
    assert.ok((await createFileManifest({...request,root:path.join(root,'junction')})).issues.some(i=>i.code==='ROOT_UNSAFE'));
    const controller=new AbortController();controller.abort();
    assert.ok((await createFileManifest({...request,signal:controller.signal})).issues.some(i=>i.code==='CANCELLED'));
    const originalLstat=fs.lstat;
    const originalOpen=fs.open;
    let fileAccesses=0;
    t.mock.method(fs,'lstat',async(...args:Parameters<typeof fs.lstat>)=>{
      if(String(args[0]).includes('credential-never-open')) {fileAccesses++;throw new Error('분류 자료 접근 금지');}
      return originalLstat(...args);
    });
    t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{fileAccesses++;return originalOpen(...args);});
    try {
      const result=await createFileManifest({...request,selections:[{...selection,path:'credential-never-open',classification:'credential'}]});
      assert.equal(result.entries[0]?.reasonCode,'SENSITIVE_EXCLUDED');
      assert.equal(result.entries[0]?.bytes,null);
      assert.equal(fileAccesses,0);
    } finally {t.mock.restoreAll();}
  });
});

test('전체 제외 선택과 최종 지문 계산도 시간 한도를 지킨다', async t=>{
  const {createFileManifest}=await import('../../../apps/server/modules/backups/file-manifest.ts');
  await withFixture(async(root,put)=>{
    await put('excluded.dat','excluded-original');
    const request={root,selections:[{path:'excluded.dat',versionRef:'원문-v1',required:false,ignored:false,decision:'exclude' as const,reason:'명시 제외',classification:'ordinary' as const}],limits:{maxFiles:1,maxFileBytes:100,maxTotalBytes:100,maxDurationMs:100}};
    await t.test('root 확인 뒤 전체 제외 분기의 시간 초과도 문제로 반환',async()=>{
      let calls=0;
      t.mock.method(performance,'now',()=>++calls<=3?0:200);
      try {
        const result=await createFileManifest(request);
        assert.equal(result.complete,false);
        assert.ok(result.issues.some(i=>i.code==='TIME_LIMIT'));
      assertPayloadHash(result);
        assert.equal(result.entries[0]?.status,'excluded');
        assert.equal(result.entries[0]?.reason,'명시 제외');
        assert.equal(result.entries[0]?.sha256,null);
      } finally {t.mock.restoreAll();}
    });
    await t.test('최종 manifest 지문 계산 중 시간 초과도 성공으로 반환하지 않음',async()=>{
      let elapsed=0;
      t.mock.method(performance,'now',()=>elapsed);
      const prototype=Object.getPrototypeOf(createHash('sha256'));
      const originalDigest=prototype.digest;
      t.mock.method(prototype,'digest',function(this: ReturnType<typeof createHash>,...args: unknown[]){
        const result=Reflect.apply(originalDigest,this,args);
        elapsed=200;
        return result;
      });
      try {
        const result=await createFileManifest(request);
        assert.equal(result.complete,false);
        assert.ok(result.issues.some(i=>i.code==='TIME_LIMIT'));
      assertPayloadHash(result);
        assert.equal(result.entries[0]?.status,'excluded');
      } finally {t.mock.restoreAll();}
    });
  });
});

test('재검증 중 호출자가 manifest를 바꿔도 최초 독립 지문에 결박한다',async t=>{
  const {createFileManifest,verifyFileManifest}=await import('../../../apps/server/modules/backups/file-manifest.ts');
  await withFixture(async(root,put)=>{
    await put('mutable.dat','version-one');
    const selection={path:'mutable.dat',versionRef:'원문-v1',required:true,ignored:false,decision:'include' as const,reason:'원문 확인',classification:'ordinary' as const};
    const request={root,selections:[selection],limits:{maxFiles:1,maxFileBytes:100,maxTotalBytes:100,maxDurationMs:10000}};
    const original=await createFileManifest(request);
    const baseline={selections:[{...selection}],expectedManifestHash:original.manifestHash};
    const expected=baseline.expectedManifestHash;
    await put('mutable.dat','version-two');
    const replacement=await createFileManifest(request);
    assert.notEqual(replacement.manifestHash,expected);
    const mutable=structuredClone(original);
    const originalOpen=fs.open;
    let mutations=0;
    t.mock.method(fs,'open',async(...args:Parameters<typeof fs.open>)=>{
      if(mutations===0) {
        mutations++;
        Object.assign(mutable,structuredClone(replacement));
        baseline.expectedManifestHash=replacement.manifestHash;
        baseline.selections[0]!.versionRef='호출 중 변경';
      }
      return originalOpen(...args);
    });
    try {
      const result=await verifyFileManifest(request,mutable,baseline);
      assert.equal(mutations,1);
      assert.equal(result.valid,false);
      assert.ok(result.issues.some(i=>i.code==='CONTENT_MISMATCH'));
    } finally {t.mock.restoreAll();}
  });
});
