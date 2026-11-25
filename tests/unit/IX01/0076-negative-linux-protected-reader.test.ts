import test from 'node:test';
import assert from 'node:assert/strict';
import {constants,readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeContract} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {current0076NegativeLinuxApprovalContract,verify0076NegativeLinuxApproval,type NegativeLinuxApprovalSelection} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';
import {
 create0076NegativeLinuxProtectedReader,
 type NegativeLinuxProtectedReaderAuthority,type NegativeLinuxProtectedReaderStat,type NegativeLinuxProtectedReaderSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-protected-reader.ts';

const sourceRootUrl=new URL('../../../',import.meta.url);
const manifestPath='docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv';
const desiredDependencies=current0076NegativeLinuxApprovalContract.dependencyPaths;
const manifestBytes=new Uint8Array(Buffer.from(readFileSync(new URL(manifestPath,sourceRootUrl),'utf8').replaceAll('\r\n','\n'),'utf8'));
const manifestRows=readCurrentSchemaManifest(manifestBytes);
const sourceBytes=manifestRows.map(row=>new Uint8Array(readFileSync(new URL(row.path,sourceRootUrl))));

let sequence=120;
function fixture(mode:'NORMAL'|'LINK'|'DRIFT'|'NESTED_DRIFT'|'TRUNCATED'|'CLOSE_UNKNOWN'|'ALIAS'|'FRACTIONAL'|'RECEIPT_0755'|'RECEIPT_ROOT_0755'|'RECEIPT_0775'|'RECEIPT_NULL'='NORMAL'){
 const attemptId='e7000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),compact=attemptId.replaceAll('-',''),sourceHead='a'.repeat(40),issuedAt=2_000_000,expiresAt=2_600_000;
 const sourceRoot='/home/daon/anvil-ix01-0076-negative-source',receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId;
 const dependencies=desiredDependencies.map((path,index)=>new Uint8Array(Buffer.from('protected-'+index+'-'+path)));
 const graphRows=[...current0076NegativeContract.graphPaths.map((path,index)=>({path,bytes:index+1,sha256:String(index+1).repeat(64).slice(0,64)})),
  ...desiredDependencies.map((path,index)=>({path,bytes:dependencies[index]!.byteLength,sha256:contentHash(dependencies[index]!)}))].sort((a,b)=>a.path.localeCompare(b.path));
 const graphRaw=canonicalJson({schemaVersion:1,sourceHead,files:graphRows}),graphHash=contentHash(graphRaw),namespace={container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,receipt:receiptRoot,network:'none'};
 const planRaw=canonicalJson({schemaVersion:1,purpose:current0076NegativeContract.purpose,attemptId,sourceHead,graphHash,issuedAt,expiresAt,namespace,sourceManifestHash:contentHash(canonicalJson(manifestRows)),
  sourceSha256:current0076NegativeContract.sourceSha256,executionSha256:current0076NegativeContract.executionSha256,sentinelSqlHash:current0076NegativeContract.sentinelSqlHash,catalogSqlHash:current0076NegativeContract.catalogSqlHash});
 const planHash=contentHash(planRaw),approvalRaw=canonicalJson({schemaVersion:1,purpose:current0076NegativeContract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',
  approvalId:'e7100000-0000-4000-8000-'+String(sequence).padStart(12,'0'),attemptId,sourceHead,planHash,graphHash,issuedAt,expiresAt}),approvalHash=contentHash(approvalRaw);
 const selection=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION' as const,attemptId,sourceHead,planHash,approvalHash,graphHash}) satisfies NegativeLinuxApprovalSelection;
 const requested=[receiptRoot+'-plan.json',receiptRoot+'-approval.json',receiptRoot+'-graph.json',...desiredDependencies,manifestPath],actual=[requested[0]!,requested[1]!,requested[2]!,...desiredDependencies.map(path=>sourceRoot+'/'+path),sourceRoot+'/'+manifestPath];
 const sourceRequested=manifestRows.map(row=>row.path),sourceActual=sourceRequested.map(path=>sourceRoot+'/'+path);
 const values=[new Uint8Array(Buffer.from(planRaw)),new Uint8Array(Buffer.from(approvalRaw)),new Uint8Array(Buffer.from(graphRaw)),...dependencies,manifestBytes];
 const files=new Map<string,Uint8Array>();for(const [index,path] of actual.entries())files.set(path,values[index]!);for(const [index,path] of sourceActual.entries())files.set(path,sourceBytes[index]!);
 const directories=['/home','/home/daon',sourceRoot,'/home/daon/.local','/home/daon/.local/share','/home/daon/.local/share/anvil-v3-qa-receipts',
  ...[...desiredDependencies,manifestPath,...sourceRequested].flatMap(path=>{const parts=path.split('/');return parts.slice(0,-1).map((_,index)=>sourceRoot+'/'+parts.slice(0,index+1).join('/'));})];
 let inode=10;const stamp=mode==='FRACTIONAL'?1.25:1,stats=new Map<string,NegativeLinuxProtectedReaderStat>();for(const path of new Set(directories))stats.set(path,Object.freeze({kind:'DIRECTORY' as const,dev:1,ino:inode++,uid:path==='/home'?0:1000,mode:path==='/home'?0o40755:0o40700,nlink:1,size:0,mtimeMs:stamp,ctimeMs:stamp}));
 if(['RECEIPT_0755','RECEIPT_ROOT_0755','RECEIPT_0775'].includes(mode))stats.set('/home/daon/.local/share/anvil-v3-qa-receipts',Object.freeze({...stats.get('/home/daon/.local/share/anvil-v3-qa-receipts')!,uid:mode==='RECEIPT_ROOT_0755'?0:1000,mode:mode==='RECEIPT_0775'?0o40775:0o40755}));
 for(const [index,path] of [...actual,...sourceActual].entries()){const bytes=files.get(path)!;stats.set(path,Object.freeze({kind:'FILE' as const,dev:1,ino:inode++,uid:1000,mode:index<3?0o100600:0o100644,nlink:1,size:bytes.byteLength,mtimeMs:stamp,ctimeMs:stamp}));}
 if(mode==='ALIAS')stats.set(actual.at(-1)!,Object.freeze({...stats.get(actual[0]!)!,size:values.at(-1)!.byteLength,mode:0o100644}));
 const recipient=Object.freeze(Object.create(null)),handles=new Map<object,{path:string;offset:number}>();let opens=0,closes=0,closeAttempts=0,current=0,drifted=false;
 const system=Object.freeze({recipient,
  lstat(this:object,path:string){assert.equal(this,recipient);if(mode==='RECEIPT_NULL'&&path==='/home/daon/.local/share/anvil-v3-qa-receipts')return null as unknown as NegativeLinuxProtectedReaderStat;const stat=stats.get(path);if(!stat)throw Object.assign(Error('missing'),{code:'ENOENT'});if(drifted&&(mode==='DRIFT'&&path===sourceRoot||mode==='NESTED_DRIFT'&&path===sourceRoot+'/scripts'))return Object.freeze({...stat,ino:stat.ino+1});return stat;},
  realpath(this:object,path:string){assert.equal(this,recipient);return mode==='LINK'&&path===sourceRoot?sourceRoot+'-elsewhere':path;},
  open(this:object,path:string,flags:number){assert.equal(this,recipient);assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const handle=Object.freeze(Object.create(null));handles.set(handle,{path,offset:0});opens++;return handle;},
  fstat(this:object,handle:object){assert.equal(this,recipient);const found=handles.get(handle);if(!found)throw Error('handle');return stats.get(found.path)!;},
  read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number){assert.equal(this,recipient);const found=handles.get(handle);if(!found)throw Error('handle');const bytes=files.get(found.path)!,available=(mode==='TRUNCATED'?Math.max(0,bytes.byteLength-1):bytes.byteLength)-found.offset;if(available<=0)return 0;const count=Math.min(length,available);buffer.set(bytes.subarray(found.offset,found.offset+count),offset);found.offset+=count;return count;},
  close(this:object,handle:object){assert.equal(this,recipient);closeAttempts++;if(!handles.has(handle))throw Error('handle');if(mode==='CLOSE_UNKNOWN')throw Error('close');handles.delete(handle);closes++;drifted=true;},
 }) satisfies NegativeLinuxProtectedReaderSystem;
 const authorityRecipient=Object.freeze(Object.create(null));const authority=Object.freeze({recipient:authorityRecipient,selection,sourceRoot,receiptRoot,uid:1000,
  now(this:object){assert.equal(this,authorityRecipient);return 2_100_000;},monotonic(this:object){assert.equal(this,authorityRecipient);return 100+current;},
  assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalSelection>){assert.equal(this,authorityRecipient);assert.equal(found,selection);current++;},}) satisfies NegativeLinuxProtectedReaderAuthority;
 return{selection,authority,system,requested,sourceRequested,get opens(){return opens;},get closes(){return closes;},get closeAttempts(){return closeAttempts;},get handles(){return handles.size;}};
}

test('exact protected paths를 same-FD O_NOFOLLOW로 읽어 기존 approval validator에 공급한다',async()=>{
 const h=fixture(),reader=create0076NegativeLinuxProtectedReader(h.authority,h.system),result=await verify0076NegativeLinuxApproval(h.selection,reader);
 assert.equal(result.evidence,'PROTECTED_READ_SOURCE_ONLY');assert.equal(result.executionAuthorized,false);assert.equal(manifestRows.length,130);assert.equal(h.opens,142);assert.equal(h.closes,142);assert.equal(h.handles,0);
 const fractional=fixture('FRACTIONAL');await verify0076NegativeLinuxApproval(fractional.selection,create0076NegativeLinuxProtectedReader(fractional.authority,fractional.system));
 const receipt0755=fixture('RECEIPT_0755');await verify0076NegativeLinuxApproval(receipt0755.selection,create0076NegativeLinuxProtectedReader(receipt0755.authority,receipt0755.system));
 const receiptRoot0755=fixture('RECEIPT_ROOT_0755');await verify0076NegativeLinuxApproval(receiptRoot0755.selection,create0076NegativeLinuxProtectedReader(receiptRoot0755.authority,receiptRoot0755.system));
});

test('일반 경로와 manifest 검산 전 SQL read 및 세 번째 read는 파일 open 전에 차단한다',async()=>{
 const h=fixture(),reader=create0076NegativeLinuxProtectedReader(h.authority,h.system);
 await assert.rejects(reader.read.call(reader.recipient,Object.freeze(['/etc/passwd'])));assert.equal(h.opens,0);
 await assert.rejects(reader.read.call(reader.recipient,Object.freeze(h.sourceRequested)));assert.equal(h.opens,0);
 const first=await reader.read.call(reader.recipient,Object.freeze(h.requested));assert.equal(first.length,12);assert.equal(h.opens,12);
 const second=await reader.read.call(reader.recipient,Object.freeze(h.sourceRequested));assert.equal(second.length,130);assert.equal(h.opens,142);
 await assert.rejects(reader.read.call(reader.recipient,Object.freeze(h.sourceRequested)));assert.equal(h.opens,142);
 const badSelection=Object.freeze({...h.selection,attemptId:'../../etc/passwd'});
 assert.throws(()=>create0076NegativeLinuxProtectedReader(Object.freeze({...h.authority,selection:badSelection}) as unknown as NegativeLinuxProtectedReaderAuthority,h.system));assert.equal(h.opens,142);
});

test('parent drift·link·truncated read·close 불명은 보호 reply를 만들지 않는다',async()=>{
 for(const mode of ['DRIFT','NESTED_DRIFT','LINK','TRUNCATED','CLOSE_UNKNOWN','ALIAS','RECEIPT_0775','RECEIPT_NULL'] as const){const h=fixture(mode),reader=create0076NegativeLinuxProtectedReader(h.authority,h.system);
  await assert.rejects(verify0076NegativeLinuxApproval(h.selection,reader));assert.equal(h.handles,mode==='CLOSE_UNKNOWN'?1:0);if(mode==='CLOSE_UNKNOWN')assert.equal(h.closeAttempts,1);if(mode.startsWith('RECEIPT_'))assert.equal(h.opens,0);}
});

test('native adapter는 close 확정 전 원 handle을 process-private strong holder에 남긴다',()=>{
 const source=readFileSync(new URL('../../../scripts/qa-ix01-0076-negative-linux-protected-reader.ts',import.meta.url),'utf8');
 assert.match(source,/const retainedNativeHandles=new Set<object>\(\);/);
 assert.match(source,/handles\.set\(handle,openSync\(path,flags\)\);retainedNativeHandles\.add\(handle\);/);
 assert.match(source,/closeSync\(fdFor\(handle\)\);handles\.delete\(handle\);retainedNativeHandles\.delete\(handle\);/);
});
