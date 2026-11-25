import test from 'node:test';
import assert from 'node:assert/strict';
import {
 verify0076NegativeLinuxHostSource,
 type NegativeLinuxHostSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-host.ts';
import {contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeLinuxApprovalContract,type NegativeLinuxApprovalSelection} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';

const sourceRoot='/home/daon/anvil-ix01-0076-negative-fa000000000040008000000000000001-qa';
const nodePath='/opt/node-v24.22.1-linux-x64/bin/node';
const nodeHash='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
const attemptId='fa000000-0000-4000-8000-000000000001';
const selection=Object.freeze({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION',attemptId,sourceHead:'a'.repeat(40),
 planHash:'b'.repeat(64),approvalHash:'c'.repeat(64),graphHash:'d'.repeat(64)}) satisfies NegativeLinuxApprovalSelection;

function fixture(patch:{platform?:string;euid?:number;cwd?:string;nodeHash?:string;head?:string;writableRoot?:boolean;headDrift?:boolean}={}){
 const recipient=Object.freeze(Object.create(null));let ino=10,headInspected=false;
 const directories=new Map<string,Readonly<{kind:'DIRECTORY';dev:number;ino:number;uid:number;gid:number;mode:number;nlink:number;size:number;mtimeMs:number;ctimeMs:number}>>();
 const directory=(path:string)=>{let found=directories.get(path);if(!found){found=Object.freeze({kind:'DIRECTORY',dev:1,ino:ino++,uid:path===sourceRoot?1000:0,gid:path===sourceRoot?1000:0,
   mode:path===sourceRoot?(patch.writableRoot?0o40770:0o40700):0o40755,nlink:1,size:0,mtimeMs:1,ctimeMs:1});directories.set(path,found);}return found;};
 const nodeFact=Object.freeze({path:nodePath,realpath:nodePath,kind:'FILE' as const,dev:2,ino:1,uid:0,gid:0,mode:0o100755,nlink:1,
  size:126879696,mtimeMs:2,ctimeMs:2,sha256:patch.nodeHash??nodeHash,text:null,closed:true as const});
 const headPath=sourceRoot+'/.git/HEAD',headFact=Object.freeze({path:headPath,realpath:headPath,kind:'FILE' as const,dev:1,ino:2,uid:1000,gid:1000,mode:0o100644,nlink:1,
  size:41,mtimeMs:2,ctimeMs:2,sha256:contentHash(patch.head??selection.sourceHead+'\n'),text:patch.head??selection.sourceHead+'\n',closed:true as const});
 const system=Object.freeze({recipient,
  platform(this:object){assert.equal(this,recipient);return patch.platform??'linux';},euid(this:object){assert.equal(this,recipient);return patch.euid??1000;},
  cwd(this:object){assert.equal(this,recipient);return patch.cwd??sourceRoot;},execPath(this:object){assert.equal(this,recipient);return nodePath;},
  execArgv(this:object){assert.equal(this,recipient);return Object.freeze([]);},
  lstat(this:object,path:string){assert.equal(this,recipient);if(path===nodePath)return nodeFact;if(path===headPath)return patch.headDrift&&headInspected?Object.freeze({...headFact,mtimeMs:3}):headFact;return directory(path);},realpath(this:object,path:string){assert.equal(this,recipient);return path;},
  inspectFile(this:object,path:string){assert.equal(this,recipient);if(path===nodePath)return nodeFact;assert.equal(path,headPath);headInspected=true;return headFact;},
 }) satisfies NegativeLinuxHostSystem;
 return system;
}

test('고정 Linux host의 Node 물리 지문과 detached source HEAD만 source-only authority 근거로 검산한다',()=>{
 for(const path of ['contracts/canonical.ts','contracts/runtime/validation-v1.ts','scripts/qa-ix01-current-journey.ts','scripts/qa-ix01-0076-atomicity-negative.ts',
  'scripts/qa-ix01-0076-negative-linux-host.ts','scripts/qa-ix01-0076-negative-linux-container.ts','scripts/qa-ix01-0076-negative-linux-docker.ts',
  'scripts/qa-ix01-0076-negative-linux-native-docker.ts','scripts/qa-ix01-0076-negative-linux-schema-stage.ts','tests/integration/IX01/current-schema-baseline.ts',
  'tests/integration/IX01/current-schema-installation.ts'])assert(current0076NegativeLinuxApprovalContract.dependencyPaths.includes(path as never),path);
 const result=verify0076NegativeLinuxHostSource(selection,fixture());
 assert.deepEqual(result,{schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_HOST_SOURCE_VERIFIED',attemptId,sourceHead:selection.sourceHead,sourceRoot,nodePath,nodeHash,
  evidence:'NODE_AND_DETACHED_HEAD_SOURCE_ONLY',gitToolVerified:false,runtimeVerified:false,executionAuthorized:false});
});

test('다른 host·Node·HEAD·쓰기 가능한 source root는 실제 authority 근거가 아니다',()=>{
 for(const patch of[{platform:'win32'},{euid:1001},{cwd:'/tmp/other'},{nodeHash:'0'.repeat(64)},{head:'ref: refs/heads/main\n'},{writableRoot:true},{headDrift:true}])
  assert.throws(()=>verify0076NegativeLinuxHostSource(selection,fixture(patch)));
});
