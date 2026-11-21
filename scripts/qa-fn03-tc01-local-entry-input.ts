import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import {currentProfile,currentLegacyModuleSource} from './qa-ix01-current-journey.ts';
import {buildOfficialForms} from '../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../apps/server/modules/methodologies/builtins.ts';
import {buildSourceContentPolicySnapshotCandidate} from '../apps/server/modules/documents/source-content-policy-definition.ts';
import {readManagementOriginSchemaManifest} from '../tests/integration/FN03/source-content-management-origin-schema.ts';
import type {createTc01PreloadFiles} from './qa-fn03-tc01-preload-files.ts';
import type {ManagementOriginEntryInput} from './qa-fn03-source-content-management-origin-entry.ts';

type Held=ReturnType<ReturnType<typeof createTc01PreloadFiles>['read']>;
export interface Tc01LocalEntryInputPorts {
 now():number;monotonic():number;
 /** 동일 감독의 기존 승인/수명 검산. 합성 void가 실제 권위를 발급하지 않는다. */
 assertCurrent(binding:Readonly<Record<string,unknown>>,runtime:Readonly<Record<string,unknown>>):void;
 /** 지정된 새 버퍼만 채우고 undefined. 기본 OS entropy 없음; 실제 공급은 별도 실행 범위다. */
 fillSyntheticEntropy(target:Uint8Array):void;
}
const fail=():never=>{throw Error('FN03_TC01_LOCAL_ENTRY_INPUT_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,keys:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);out[k]=x.value;}return out;
}
function array(v:unknown,max:number):unknown[]{
 check(Array.isArray(v)&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v) as unknown as Record<string,PropertyDescriptor>,n=d.length?.value;
 check(Number.isSafeInteger(n)&&n>=0&&n<=max&&Reflect.ownKeys(d).length===n+1);return Array.from({length:n},(_,i)=>{const x=d[String(i)];check(x&&'value'in x);return x.value;});
}
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const consumed=new WeakSet<object>();
const bindingKeys=['attemptId','approvalId','planHash','approvalHash','sourceHead','issuedAt','expiresAt','artifactRoot','subnet','purpose','profile'];
const runtimeKeys=['sourceHead','entry','nodeSha256','sourceClosureSha256','packageLockSha256','installedDependenciesSha256'];
const commandKeys=['draftCommandId','createCommandId','policyCommandId','ruleId','managementCommandId','deniedCommandId','readCommandId'];
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function packet(raw:unknown,b:Record<string,any>,runtime:Record<string,any>){
 const p=record(raw,['planRaw','planHash','approvalRaw','approvalHash']);
 for(const [text,digest]of [['planRaw','planHash'],['approvalRaw','approvalHash']] as const)check(typeof p[text]==='string'&&p[text].isWellFormed()&&Buffer.byteLength(p[text])<=16384&&hashV1(p[digest])&&contentHash(p[text])===p[digest]);
 const plan=parseWireJson(p.planRaw),approval=parseWireJson(p.approvalRaw);
 check(recordV1(plan,['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','artifactRoot','receiptRoot','subnet','runtime'])&&plan.schemaVersion===1&&plan.purpose===b.purpose&&plan.profile===b.profile&&plan.attemptId===b.attemptId&&plan.sourceHead===b.sourceHead&&plan.issuedAt===b.issuedAt&&plan.expiresAt===b.expiresAt&&plan.artifactRoot===b.artifactRoot&&plan.subnet===b.subnet&&same(plan.runtime,runtime)&&p.planHash===b.planHash);
 check(plan.receiptRoot==='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+b.attemptId);
 check(recordV1(approval,['schemaVersion','purpose','profile','decision','approvalId','attemptId','planHash','sourceHead','issuedAt','expiresAt'])&&approval.schemaVersion===1&&approval.purpose===b.purpose+'_RUN_APPROVAL'&&approval.profile===b.profile&&approval.decision==='ALLOW_ONE_RUN'&&approval.approvalId===b.approvalId&&approval.attemptId===b.attemptId&&approval.planHash===b.planHash&&approval.sourceHead===b.sourceHead&&approval.issuedAt===b.issuedAt&&approval.expiresAt===b.expiresAt&&p.approvalHash===b.approvalHash);
 return{packet:Object.freeze({...p}) as ManagementOriginEntryInput['packet'],receiptRoot:plan.receiptRoot};
}
/** 같은 child 메모리의 원 preload 행만 원 entry 입력으로 조립한다. 파일·환경 조회/기본 난수/실행 없음.
 * 원 3개 한글 경로는 그대로다. 현재 preload/bootstrap/native ASCII allowlist와의 연결은 별도 미완료다.
 * callback은 로컬 기존 launcher/entry 소비용이며 반환값은 undefined만; raw 입력을 결과로 반환하지 않는다.
 * 합성 refs는 CM 형상 시험 자료일 뿐 등록·관측/실행 권위가 아니다. 실제 승인/배타소비는 기존 entry 책임.
 * dispose는 이 factory의 사본만 소거한다. 원 held의 dispose는 그 감독 책임, JS 문자열은 GC 한계가 있다.
 */
export function createTc01LocalEntryInput(ports:Tc01LocalEntryInputPorts){
 let spent=false,disposed=false;const owned:Buffer[]=[];
 const dispose=()=>{disposed=true;let failed=false;for(const b of owned)try{fill.call(b,0);}catch{failed=true;}if(failed)fail();};
 return Object.freeze({dispose,async withInput(held:Held,rawPacket:ManagementOriginEntryInput['packet'],consume:(input:ManagementOriginEntryInput)=>Promise<void>|void):Promise<void>{
  if(spent||disposed)fail();spent=true;
  try{
   const keys=['now','monotonic','assertCurrent','fillSyntheticEntropy'] as const,methods=record(ports,keys);check(keys.every(k=>typeof methods[k]==='function')&&typeof consume==='function');
   const h=record(held,['binding','runtime','sourceRoot','files','assertCurrent','dispose']);check(typeof h.assertCurrent==='function'&&typeof h.dispose==='function'&&!consumed.has(held));consumed.add(held);
   const b=Object.freeze(record(h.binding,bindingKeys)),runtime=Object.freeze(record(h.runtime,runtimeKeys));
   check(b.purpose==='FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED'&&b.profile==='FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1'&&uuidV1(b.attemptId)&&uuidV1(b.approvalId)&&hashV1(b.planHash)&&hashV1(b.approvalHash)&&typeof b.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(b.sourceHead));
   check(Number.isSafeInteger(b.issuedAt)&&b.issuedAt>=0&&Number.isSafeInteger(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000&&b.artifactRoot==='/tmp/fn03-tc01-'+b.attemptId&&h.sourceRoot==='/home/daon/anvil-fn03-tc01-'+b.attemptId+'-qa');
   const subnet=typeof b.subnet==='string'&&/^172\.(1[6-9]|2\d|3[01])\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(b.subnet);check(subnet&&Number(subnet[2])<=254&&Number(subnet[3])<=240&&Number(subnet[3])%16===0);
   check(runtime.sourceHead===b.sourceHead&&runtime.entry==='scripts/qa-fn03-source-content-management-origin-entry.ts'&&runtime.nodeSha256===currentProfile.nodeHash&&[runtime.sourceClosureSha256,runtime.packageLockSha256,runtime.installedDependenciesSha256].every(hashV1));
   const p=packet(rawPacket,b,runtime);let wall=-1,mono=-1,until=Infinity;
   const clock=()=>{check(!disposed);const latest=record(ports,keys);check(keys.every(k=>latest[k]===methods[k]));const t=methods.now.call(ports),m=methods.monotonic.call(ports);check(Number.isSafeInteger(t)&&Number.isSafeInteger(m)&&t>=wall&&m>=mono&&m>=0&&t>=b.issuedAt&&t<b.expiresAt&&m<until);if(until===Infinity)until=m+b.expiresAt-t;check(Number.isSafeInteger(until));wall=t;mono=m;};
   const current=()=>{clock();check(methods.assertCurrent.call(ports,b,runtime)===undefined);clock();};
   current();check(h.assertCurrent.call(held)===undefined);current();
   const files=new Map<string,unknown>();for(const raw of array(h.files,20000)){const r=record(raw,['path','bytes']);check(typeof r.path==='string'&&!files.has(r.path));files.set(r.path,r.bytes);}
   let total=0;const own=(raw:unknown,max:number)=>{check(types.isUint8Array(raw)&&!types.isProxy(raw));const n=lengthOf.call(raw);check(types.isArrayBuffer(bufferOf.call(raw))&&n>0&&n<=max);total+=n;check(total<=268435456);const copy=Buffer.alloc(n);owned.push(copy);set.call(copy,raw);return copy;};
   const take=(path:string,max:number,sha?:string)=>{check(files.has(path));const copy=own(files.get(path),max);if(sha)check(contentHash(copy)===sha);return copy;};
   const historicalTsv=take(currentProfile.manifest,15807),rows=readManagementOriginSchemaManifest(historicalTsv);check(rows.length===132);
   const sql=rows.map(row=>{const bytes=take(row.path,row.bytes,row.sha256);check(bytes.length===row.bytes);return Object.freeze({id:row.id,path:row.path,bytes});});
   const legacyBytes=take(currentProfile.legacy,4194304,currentProfile.legacyHash);currentLegacyModuleSource(legacyBytes,currentProfile.legacyHash);
   const sources={forms:take(currentProfile.forms,2097152),standard:take(currentProfile.standard,2097152),methods:take(currentProfile.methods,2097152)};
   const catalog=buildOfficialForms(sources.forms,sources.standard);owned.push(catalog.standard.body);
   const methodsCatalog=buildBuiltinMethodologies(sources.methods,catalog.forms),method=methodsCatalog.find(m=>m.systemCode==='SYS-M01');check(method&&methodsCatalog.filter(m=>m.systemCode==='SYS-M01').length===1);
   const methodologyRef=Object.freeze({id:method.id,version:method.version,contentHash:method.contentHash});
   // 15 UUID + 5개의 32B private seed. 하나의 원 entropy 호출만 사용하며 재시도하지 않는다.
   const random=Buffer.alloc(400);owned.push(random);current();check(methods.fillSyntheticEntropy.call(ports,random)===undefined);current();
   let offset=0;const ids:string[]=[];for(let n=0;n<15;n++){const raw=Buffer.from(random.subarray(offset,offset+16));owned.push(raw);offset+=16;raw[6]=(raw[6]!&15)|64;raw[8]=(raw[8]!&63)|128;const hex=raw.toString('hex');ids.push(hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20));}check(new Set(ids).size===15&&!ids.includes(b.attemptId)&&!ids.includes(b.approvalId));
   const secret=()=>{const raw=Buffer.from(random.subarray(offset,offset+32));offset+=32;owned.push(raw);return raw;};
   const key=secret(),passwords={bootstrap:secret().toString('hex'),app:secret().toString('hex'),migrator:secret().toString('hex')},password=secret().toString('hex');check(offset===400&&new Set([...Object.values(passwords),password,key.toString('hex')]).size===5);
   const actorId=ids[1]!,policyExpiresAt=new Date(Math.min(b.expiresAt,wall+300000)).toISOString(),ref=(n:number)=>({id:ids[n]!,version:1,contentHash:contentHash(canonicalJson({kind:'FN03_SYNTHETIC_REFERENCE',id:ids[n]}))});
   const managementPayload={previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:actorId,disposition:'AUTO',expiresAt:policyExpiresAt,allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(9),connectorRef:ref(10),registrationRef:ref(11),observerRef:ref(12),targets:[{relativePath:'src/synthetic.ts',documentRef:ref(13),documentBlobRef:{artifactId:ids[14],bytes:0,contentHash:contentHash(''),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 준비'};
   buildSourceContentPolicySnapshotCandidate(managementPayload,{projectId:b.attemptId,actorId,sequence:1,recordedAt:new Date(wall).toISOString()});
   const input:ManagementOriginEntryInput={packet:p.packet,isolated:{binding:b as unknown as ManagementOriginEntryInput['isolated']['binding'],receiptRoot:p.receiptRoot,historicalTsv,legacyBytes,sources,passwords,fixture:{artifactRoot:b.artifactRoot,access:{installationId:ids[0]!,key},origin:'https://anvil.invalid',actorId,loginName:'fn03-synthetic-'+actorId,password,credentialGeneration:1,methodologyRef,ids:Object.fromEntries(commandKeys.map((k,i)=>[k,ids[i+2]])),policyExpiresAt,managementPayload}},sql:Object.freeze(sql)};
   current();check(h.assertCurrent.call(held)===undefined);current();check(await consume(input)===undefined);current();
  }catch{return fail();}finally{dispose();}
 }});
}
