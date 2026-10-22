import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m=await import(new URL('../../../contracts/runtime/ownership-observation-v1.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function fn(name:string){assert.equal(typeof m[name],'function',`${name} 계약이 필요하다`);return m[name];}
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:String(n%10).repeat(64)});
const requestedAt='2026-10-23T00:00:00.000Z',observedAt='2026-10-23T00:00:00.001Z',expiresAt='2026-10-23T00:00:10.000Z';
function payload(){return{protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',installationId:id(1),projectId:id(2),executionId:id(3),executionGeneration:1,registrationRef:ref(4),publicKeyFingerprint:'a'.repeat(64),observerRef:ref(5),anchorRef:ref(6),preparationRef:ref(7),requestRef:ref(8),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',factsHash:'b'.repeat(64),requestedAt,observedAt,expiresAt};}

// phase/head 결합 누락 또는 domain prefix 누락은 서로 다른 요청의 서명을 재사용하게 한다.
test('부트스트랩과 CURRENT를 구분하고 prefix+NUL+canonical UTF8 바이트를 만든다',()=>{
 const read=fn('readOwnershipObservationV1'),bytes=fn('ownershipObservationBytesV1'),p=payload(),before=structuredClone(p);
 const parsed=read(p);assert.deepEqual(parsed,p);assert.notEqual(parsed,p);parsed.anchorRef.version=2;assert.deepEqual(p,before);
 assert.deepEqual(bytes(p),Buffer.concat([Buffer.from('ANVIL_OWNERSHIP_OBSERVATION_V1\0','ascii'),Buffer.from(canonicalJson(p),'utf8')]));
 const current={...p,phase:'CURRENT',expectedHeadRef:ref(9)};assert.deepEqual(read(current),current);assert.notDeepEqual(bytes(p),bytes(current));
 assert.throws(()=>read({...p,expectedHeadRef:ref(9)}));assert.throws(()=>read({...current,expectedHeadRef:null}));
 assert.throws(()=>read({...p,phase:'HOST_TRUST_REGISTRATION'}));
});

// 원래 서버 요청과 exact 비교가 없으면 다른 scope/head/nonce/시점으로 바꾼 보고가 들어간다.
test('원 서버 요청의 scope·phase·nonce·head·기한을 exact 대조하고 fresh 관측만 받는다',()=>{
 const read=fn('readOwnershipObservationV1'),match=fn('matchOwnershipObservationV1'),p=payload(),now=Date.parse(observedAt);
 const expected=structuredClone(p);delete (expected as any).factsHash;delete (expected as any).observedAt;
 assert.deepEqual(match(p,expected,now),read(p));
 for(const changed of [{projectId:id(99)},{executionGeneration:2},{anchorRef:ref(9)},{registrationRef:ref(9)},{observerRef:ref(9)},{preparationRef:ref(9)},{requestRef:ref(9)},{nonce:'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE'},{publicKeyFingerprint:'c'.repeat(64)},{requestedAt:observedAt},{expiresAt:'2026-10-23T00:00:09.000Z'},{phase:'CURRENT',expectedHeadRef:ref(9)}])assert.throws(()=>match({...p,...changed},expected,now));
 assert.throws(()=>match(p,expected,Date.parse(expiresAt)));assert.throws(()=>match(p,expected,Date.parse(requestedAt)));
 assert.throws(()=>match(p,expected,now+30001));assert.throws(()=>match(p,{...expected,executionAuthorized:true},now));
});

// 읽기 자체가 fail-closed여야 서명 전 부적절한 숫자/접근자/추가 권한을 수용하지 않는다.
test('부적절한 구조·참조·시간·nonce와 추가 권한 필드를 거절한다',()=>{
 const read=fn('readOwnershipObservationV1'),p=payload();let getters=0;
 for(const bad of [{...p,executionAuthorized:true},{...p,nonce:p.nonce+'='},{...p,nonce:'a'},{...p,executionGeneration:0},{...p,anchorRef:{...p.anchorRef,version:0}},{...p,factsHash:'B'.repeat(64)},{...p,observedAt:requestedAt.replace('00.000Z','59.999Z')},{...p,observedAt:'2026-10-22T23:59:59.999Z'},{...p,expiresAt:'2026-10-23T00:00:30.001Z'},{...p,expiresAt:requestedAt},{...p,protocolVersion:2},Object.defineProperty({...p},'nonce',{enumerable:true,get(){getters++;return p.nonce;}})])assert.throws(()=>read(bad));
 assert.equal(getters,0);
});

// 새로 해시한 PID/Job/세대 후보를 원 process로 착각하거나 PREPARED를 RUNNING으로 승격하면 실패한다.
test('관측 본문 hash와 원 process 정체성·phase 상태를 함께 대조한다',()=>{
 const match=fn('matchOwnershipObservationFactsV1');
 const processRef={runId:id(20),generation:1,jobId:id(21),pid:100,startTicks:'638960000000000001',executableHash:'c'.repeat(64)};
 const facts={processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:100,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false};
 const report={...payload(),factsHash:contentHash(canonicalJson(facts))},before=structuredClone(facts);
 const result=match(report,facts,processRef);assert.deepEqual(result,facts);assert.notEqual(result.processRef,facts.processRef);assert.deepEqual(facts,before);
 const signed=(f:unknown)=>({...report,factsHash:contentHash(canonicalJson(f))});
 for(const changed of [{...facts,everResumed:true},{...facts,state:'RUNNING',everResumed:true},{...facts,processRef:{...processRef,pid:101}},{...facts,processRef:{...processRef,generation:2}},{...facts,processRef:{...processRef,jobId:id(99)}},{...facts,processRef:{...processRef,startTicks:'638960000000000002'}},{...facts,processes:[{...facts.processes[0],inJob:false}]},{...facts,processes:[{...facts.processes[0],startTicks:'638960000000000002'}]},{...facts,processes:[{...facts.processes[0],executableHash:'d'.repeat(64)}]},{...facts,active:2,processes:[...facts.processes,...facts.processes]},{...facts,active:0,processes:[]},{...facts,fileSandboxVerified:true},{...facts,killOnClose:true},{...facts,executionAuthorized:true}])assert.throws(()=>match(signed(changed),changed,processRef));
 assert.throws(()=>match(report,{...facts,active:2},processRef));
 assert.throws(()=>match({...report,factsHash:'d'.repeat(64)},facts,processRef));
 const currentFacts={...facts,state:'RUNNING',everResumed:true},currentReport={...report,phase:'CURRENT',expectedHeadRef:ref(9),factsHash:contentHash(canonicalJson(currentFacts))};
 assert.deepEqual(match(currentReport,currentFacts,processRef),currentFacts);
 assert.throws(()=>match({...currentReport,factsHash:report.factsHash},facts,processRef));
});
