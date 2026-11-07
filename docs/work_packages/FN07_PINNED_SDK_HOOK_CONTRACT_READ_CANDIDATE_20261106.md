# FN07 고정 SDK hook 연결 계약 추가 공개 읽기 후보

- 상태: DRAFT / 승인 전 실행0 / SDK 설치·로드·호출0.
- 목적: 실행 admission 후보의 미확인 callback 전체 계약·반환 동기성·실제 hook 호출과 argv/env 변환 근거를 닫는다. 이미 확인된 SpawnOptions/SpawnedProcess 형상과 hook 이름 자체는 완료 사실로 유지한다.
- 이전 공개 읽기1회는 a840aa로 소진됐다. 이번은 그 승인을 재사용하지 않는 추가1회 결정이다.
- 제품 dependency/local node_modules에는 해당 SDK가 없다(c95797). 사용자 계정/대화/캐시·실제 실행파일을 조사하지 않는다.

## 정확한 대상과 한도

고정 공개 tarball https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz 한 URL에 HTTPS GET1회, redirect/재시도0.1110841B·기존SHA512 무결성과 dts333809B/55627703·mjs1145192B/70E00A3E를 검산한다. 압축해제는 메모리16MiB 이하, 요청의 절대시간·socket timeout 각각10초/도구한도30초다.

SDK 파일을 실행/import/query하지 않고 문자열로만 읽는다. key/DB/권한/서비스/Agent/설치·파일저장·외부전송0이다. 새 계정/인증·환경 설정을 바꾸지 않는다. 실패/불명이면 같은 네트워크 요청을 재시도하지 않고 승인 소진 여부를 기록한다.

공개 원문을 같은 Node 메모리에 보관해, 이후 필요한 정확 선언/호출부를 한 번 읽은 자료에서 유한 출력으로 좁힌다. 추가 fetch는 하지 않는다. 첫 출력은 짧은 hook 주변부이며 잘린 문맥으로 전체 argv/env를 확인했다고 하지 않는다. 저장한 SDK 문자열을 eval하거나 import하지 않는다.

## 실행 코드 후보

아래 코드는 아직 실행하지 않았다. 동일 메모리의 attempted 표식이 있는 경우 추가 네트워크 요청 전에 거절한다.

```javascript
if(typeof anvilFn07SdkHookRead2!=='undefined'&&anvilFn07SdkHookRead2.attempted)throw Error('READ_ALREADY_ATTEMPTED');
var anvilFn07SdkHookRead2={attempted:true,state:'STARTED',source:null};
var anvilFn07Https2=await import('node:https'),anvilFn07Zip2=await import('node:zlib'),anvilFn07Crypto2=await import('node:crypto');
try{
 var anvilFn07Packed2=await new Promise((resolve,reject)=>{var chunks=[],size=0,req;var total=setTimeout(()=>{if(req)req.destroy(Error('SOURCE_TIMEOUT'));reject(Error('SOURCE_TIMEOUT'));},10000);req=anvilFn07Https2.get('https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.224.tgz',{timeout:10000},res=>{if(res.statusCode!==200){res.destroy();reject(Error('SOURCE_HTTP_FAILED'));return;}res.on('data',c=>{size+=c.length;if(size>1110841){res.destroy(Error('SOURCE_SIZE_EXCEEDED'));return;}chunks.push(c);});res.on('error',reject);res.on('end',()=>resolve(Buffer.concat(chunks)));});req.on('timeout',()=>req.destroy(Error('SOURCE_TIMEOUT')));req.on('error',reject);req.on('close',()=>clearTimeout(total));});
 if(anvilFn07Packed2.length!==1110841||anvilFn07Crypto2.createHash('sha512').update(anvilFn07Packed2).digest('base64')!=='a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==')throw Error('SOURCE_INTEGRITY_FAILED');
 var anvilFn07Tar2=anvilFn07Zip2.gunzipSync(anvilFn07Packed2,{maxOutputLength:16777216}),anvilFn07Dts2=null,anvilFn07Mjs2=null;
 for(var at=0;at+512<=anvilFn07Tar2.length;){var head=anvilFn07Tar2.subarray(at,at+512),name=head.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(head.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8);if(!name)break;if(!Number.isSafeInteger(size)||size<0||at+512+size>anvilFn07Tar2.length)throw Error('TAR_INVALID');var data=anvilFn07Tar2.subarray(at+512,at+512+size);if(name==='package/sdk.d.ts'){if(anvilFn07Dts2)throw Error('DUPLICATE_ENTRY');anvilFn07Dts2=Buffer.from(data);}if(name==='package/sdk.mjs'){if(anvilFn07Mjs2)throw Error('DUPLICATE_ENTRY');anvilFn07Mjs2=Buffer.from(data);}at+=512+Math.ceil(size/512)*512;}
 if(!anvilFn07Dts2||anvilFn07Dts2.length!==333809||anvilFn07Crypto2.createHash('sha256').update(anvilFn07Dts2).digest('hex')!=='556277033b15112811922d84ec8dc846d446cce7bd9aa27765c52a9c09869575')throw Error('DECLARATION_CHANGED');
 if(!anvilFn07Mjs2||anvilFn07Mjs2.length!==1145192||anvilFn07Crypto2.createHash('sha256').update(anvilFn07Mjs2).digest('hex')!=='70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5')throw Error('IMPLEMENTATION_CHANGED');
 anvilFn07SdkHookRead2.source={dts:anvilFn07Dts2.toString(),mjs:anvilFn07Mjs2.toString()};anvilFn07SdkHookRead2.state='VERIFIED';
 var d=anvilFn07SdkHookRead2.source.dts,j=anvilFn07SdkHookRead2.source.mjs,di=d.indexOf('spawnClaudeCodeProcess'),ji=j.indexOf('spawnClaudeCodeProcess');if(di<0||ji<0)throw Error('HOOK_NOT_FOUND');
 nodeRepl.write({state:'VERIFIED',fetches:1,dtsBytes:333809,mjsBytes:1145192,hookDeclaration:d.slice(Math.max(0,di-700),di+1600),hookImplementation:j.slice(Math.max(0,ji-900),ji+1600)});
}catch(e){anvilFn07SdkHookRead2.state='FAILED_OR_UNKNOWN';nodeRepl.write({state:anvilFn07SdkHookRead2.state,code:typeof e?.message==='string'?e.message:'SOURCE_READ_FAILED'});throw e;}
```

## 판정과 후속

독립 기술 검토와 정확한 승인 뒤 기존 담당자 한 명만 실행한다. 전체 원문은 공개 source 문자열이며 사용자 자료가 아니다. 확인 결과는 기존 admission 후보의 기술 미정을 정정하는 근거일 뿐 새 계약 채택·제품 GO·실제 생성 허가가 아니다.
