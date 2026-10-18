// 작성/독립 읽기용 후보. private adapter는 작성했지만 actual binding은 미발급.
// import/CLI 인자/env만으로 실행하지 않는다. 성공 mock을 실제 QA로 사용하지 않는다.
import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat, realpath, readdir, unlink, rmdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fixedQa, assertActualQaAuthorized, assertMigrationManifest, assertParentChain, assertSameIdentity, assertOwnedContainer, assertOwnedNetwork, cleanupFileOrder, containerArguments, QaWindow, QaWorkAdmission, sha256, boundedWait, QaWaitTimeout, validateBootstrapReceipt } from './fn01-baseline-qa-guard.ts';
import type { Identity, FileProof, MigrationManifest, BootstrapExpectation, BootstrapMetadata } from './fn01-baseline-qa-guard.ts';

export interface QaSourceProof {
  head:string; clean:boolean;remote:string;productDiff:string;lockBytes:Uint8Array;
  migrations:Record<string,Uint8Array>; manifest:unknown;
}
export interface QaPreflight {
  platform:string;uid:number;parents:Identity[];bootstrap:BootstrapMetadata;
  daemonId:string;daemonName:string;imageId:string;namesAbsent:boolean;
  nodeRealpath:string;npmRealpath:string;nodeHash:string;npmHash:string;
  toolchainApprovalRef:string|null;toolchainManifestHash:string|null;pathRiskDecisionRef:string|null;
}
export interface WorkflowReceipt {phase:'DONE';cases:string[];closeFailures:number;failure:null;testCount:1;passCount:1;failCount:0;skipCount:0;cancelCount:0}
export const requiredCases=Object.freeze(['EXACT_49_SCHEMA','LEGACY_PRESERVED','AUTH_POLICY_REQUIRED','DRAFT_STORED_READ','REVIEW_SEPARATE_ADOPTION','RECEIPT_LOSS_RECONCILED','SECOND_ADOPTION','CLIENT_TRANSITION','CROSS_PROJECT_DENIED','OLD_GENERATION_DENIED','DIRECT_DML_DENIED','CURRENT_DENY_BEFORE_REPLAY','REWORK_BLOCKS_ADOPTION','CORE_STATIC_REJECTED','QUARANTINE_BLOCKS_REUSE','CONCURRENT_CAS_AUDIT']);
/** 외부 실행 허가가 아니다. 각 port의 native 구현·bootstrap은 B 검토 대상이다. */
export interface QaPorts {
  now():number;
  stopWork():void;
  preflight():Promise<QaPreflight>;
  sourceProof():Promise<QaSourceProof>;
  parents():Promise<Identity[]>;
  createNetwork(input:{name:string;nonce:string;internal:true;timeout:number}):Promise<string>;
  inspectNetwork(id:string,purpose?:'CLEANUP'):Promise<unknown>;
  createContainer(input:{args:string[];password:string;timeout:number}):Promise<string>;
  inspectContainer(id:string,purpose?:'CLEANUP'):Promise<unknown>;
  // image metadata 외 /proc/mounts의 tmpfs/noexec/nosuid 및 volume0도 확인해야 한다.
  verifyTmpfs(id:string,purpose?:'CLEANUP'):Promise<void>;
  bootstrap(input:{id:string;database:string;passwords:{bootstrap:string;migrator:string;app:string};timeout:number}):Promise<void>;
  // 각 SQL의 COMMIT 완료와0015 전 fixture/적용 후 행·hash 불변을 별도 확인한다.
  migrate(input:{id:string;ordered:{id:string;bytes:Uint8Array}[];beforeFinalMigration:string;passwords:{bootstrap:string;migrator:string;app:string};timeout:number}):Promise<void>;
  workflow(input:{host:string;database:string;nonce:string;head:string;expiresAt:number;appPassword:string;migratorPassword:string;timeout:number}):Promise<WorkflowReceipt>;
  closeWriters():Promise<void>;
  removeContainer(fullId:string):Promise<void>;
  removeNetwork(fullId:string):Promise<void>;
  // 알려진 항목은 생성 때부터 추적. 회수 시점에 새 항목을 임의 채택하지 않는다.
  expectedFiles():readonly FileProof[];
  currentFiles():Promise<FileProof[]>;
  removeFile(item:FileProof):Promise<void>;
  removeEmptyRoot():Promise<void>;
  residue():Promise<{rootAbsent:boolean;containerAbsent:boolean;networkAbsent:boolean}>;
}
export interface CandidateBinding {head:string;issuedAt:number;expiresAt:number;bootstrap?:BootstrapExpectation}
export const qaFixture=Object.freeze({user:'a6f10100-0000-4000-8000-000000000101',outsider:'a6f10100-0000-4000-8000-000000000102',project:'a6f10100-0000-4000-8000-000000000201',otherProject:'a6f10100-0000-4000-8000-000000000202',legacy:'a6f10100-0000-4000-8000-000000000301',snapshot:'a6f10100-0000-4000-8000-000000000401'});
// 새 빈 DB의0015 직전 전용 fixture. 실제 source 관측/사용자 인수 증거가 아니다.
export const legacyFixtureSql=`BEGIN;
INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status) VALUES('${qaFixture.user}','qa-fn01-baseline-owner','qa-fn01-baseline-owner','기준선 합성 소유자','ACTIVE');
INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES('${qaFixture.project}','격리 기준선','기준선 기계경계','원문·이력 보존');
INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES('${qaFixture.project}','${qaFixture.user}','OWNER');
INSERT INTO anvil.project_baselines(id,project_id,version,source_snapshot_ref,content_json,content_hash,created_by,created_at) VALUES('${qaFixture.legacy}','${qaFixture.project}',1,'${qaFixture.snapshot}','{"legacy":true}',encode(sha256(convert_to('{"legacy":true}','UTF8')),'hex'),'${qaFixture.user}','2026-10-18T00:00:00.000Z');
COMMIT;`;
export function assertCandidateSource(p:QaSourceProof,head:string):MigrationManifest {
  if(!/^[0-9a-f]{40}$/.test(head)||p.head!==head||!p.clean||p.remote!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'||p.productDiff!==''||sha256(p.lockBytes)!==fixedQa.lockHash)throw Error('FN01_SOURCE_MISMATCH');
  assertMigrationManifest(p.manifest);
  if(Object.keys(p.migrations).length!==49)throw Error('FN01_MIGRATION_COUNT_MISMATCH');
  for(const item of p.manifest.ordered)if(!p.migrations[item.id]||sha256(p.migrations[item.id]!)!==item.sha256)throw Error('FN01_MIGRATION_HASH_MISMATCH');
  return p.manifest;
}
function assertPreflight(p:QaPreflight):void {
  assertParentChain(p.parents);
  if(p.platform!=='linux'||p.uid!==1000||!p.bootstrap.metadataMatched||p.bootstrap.executionAuthorized!==false||!p.namesAbsent||p.daemonId!==fixedQa.daemonId||p.daemonName!==fixedQa.daemonName||p.imageId!==fixedQa.imageId||p.nodeRealpath!==fixedQa.node||p.npmRealpath!==fixedQa.npm||p.nodeHash!==fixedQa.nodeHash||p.npmHash!==fixedQa.npmHash)throw Error('FN01_PREFLIGHT_MISMATCH');
  if(!p.toolchainApprovalRef||!p.pathRiskDecisionRef||!p.toolchainManifestHash||!/^[0-9a-f]{64}$/.test(p.toolchainManifestHash))throw Error('FN01_TOOLCHAIN_OR_PATH_UNRESOLVED');
}
function assertWorkflow(r:WorkflowReceipt):void {
  if(r?.phase!=='DONE'||r.failure!==null||r.closeFailures!==0||r.testCount!==1||r.passCount!==1||r.failCount!==0||r.skipCount!==0||r.cancelCount!==0||!Array.isArray(r.cases)||new Set(r.cases).size!==r.cases.length||requiredCases.some(c=>!r.cases.includes(c)))throw Error('FN01_WORKFLOW_INCOMPLETE');
}
export interface CandidateResult {status:'FAIL'|'PASS';failure:string|null;cleanupFailure:string|null;actualWorkflowVerified:boolean;formalDbChanges:0;sourceAuthorizationVerified:false;coverageVerified:false;executionAuthorized:false;dispatchPerformed:false}
/** 현재는 첫 gate에서 반드시 거절한다. B issuer/adapter/실행 원본 확정 전 호출 금지. */
export async function runBaselineQaCandidate(ports:QaPorts,binding:CandidateBinding):Promise<CandidateResult> {
  assertActualQaAuthorized(); // preflight/시계/경로 읽기 이전. 현재 아래로 진행하지 않는다.
  if(!binding.bootstrap||binding.head!==binding.bootstrap.head||binding.issuedAt!==binding.bootstrap.issuedAt||binding.expiresAt!==binding.bootstrap.expiresAt)throw Error('FN01_BOOTSTRAP_BINDING_UNISSUED');
  const window=new QaWindow(binding.issuedAt,binding.expiresAt),nonce=binding.bootstrap.nonce;
  let rootClaimed=false,containerId:string|null=null,networkId:string|null=null,parents:Identity[]=[],failure:string|null=null,cleanupFailure:string|null=null,verified=false,pendingMutationUnknown=false,phase='PREFLIGHT';
  const activeOperations=new Set<Promise<unknown>>();
  const stage=async<T>(name:string,limit:number,operation:()=>Promise<T>,mutation=false):Promise<T>=>{
    phase=name;
    try{return await boundedWait(window.remaining(ports.now(),limit),signal=>{
      signal.addEventListener('abort',()=>ports.stopWork(),{once:true});
      const work=Promise.resolve().then(operation);activeOperations.add(work);
      void work.then(()=>activeOperations.delete(work),()=>activeOperations.delete(work));return work;
    });}
    catch(e){if(e instanceof QaWaitTimeout&&mutation)pendingMutationUnknown=true;throw e;}
  };
  const fence=async(limit:number)=>{assertSameIdentity(parents,await stage('PARENTS',5000,()=>ports.parents()));return window.remaining(ports.now(),limit);};
  try {
    const p=await stage('PREFLIGHT',5000,()=>ports.preflight());assertPreflight(p);parents=p.parents;
    validateBootstrapReceipt(p.bootstrap.receipt,binding.bootstrap,ports.now());
    if(p.toolchainApprovalRef!==binding.bootstrap.toolchainDecisionRef||p.toolchainManifestHash!==binding.bootstrap.toolchainManifestHash||p.pathRiskDecisionRef!==binding.bootstrap.pathRiskDecisionRef)throw Error('FN01_BOOTSTRAP_TRUST_MISMATCH');
    assertSameIdentity(binding.bootstrap.parents,parents);
    // 별도 bootstrap의 정확 소유 명세만 승계. 여기서 clone/npm/새 창을 만들지 않는다.
    const proof=await stage('SOURCE',5000,()=>ports.sourceProof());const manifest=assertCandidateSource(proof,binding.head);
    rootClaimed=true;
    const networkTimeout=await fence(30000);
    networkId=await stage('CREATE_NETWORK',networkTimeout,()=>ports.createNetwork({name:fixedQa.network,nonce,internal:true,timeout:networkTimeout}),true);
    assertOwnedNetwork(await stage('NETWORK_INSPECT',5000,()=>ports.inspectNetwork(networkId!)),networkId,nonce,true);
    const passwords={bootstrap:randomBytes(32).toString('hex'),migrator:randomBytes(32).toString('hex'),app:randomBytes(32).toString('hex')};
    const pgTimeout=await fence(90000);
    containerId=await stage('CREATE_PG',pgTimeout,()=>ports.createContainer({args:containerArguments(nonce),password:passwords.bootstrap,timeout:pgTimeout}),true);
    const host=assertOwnedContainer(await stage('CONTAINER_INSPECT',5000,()=>ports.inspectContainer(containerId!)),containerId,networkId,nonce);
    await stage('TMPFS',5000,()=>ports.verifyTmpfs(containerId!));
    const bootstrapTimeout=await fence(90000);
    await stage('BOOTSTRAP',bootstrapTimeout,()=>ports.bootstrap({id:containerId!,database:fixedQa.database,passwords,timeout:bootstrapTimeout}),true);
    assertCandidateSource(await stage('SOURCE',5000,()=>ports.sourceProof()),binding.head);
    const migrationTimeout=await fence(90000);
    await stage('MIGRATE',migrationTimeout,()=>ports.migrate({id:containerId!,ordered:manifest.ordered.map(x=>({id:x.id,bytes:proof.migrations[x.id]!})),beforeFinalMigration:legacyFixtureSql,passwords,timeout:migrationTimeout}),true);
    const workflowTimeout=await fence(180000);
    const receipt=await stage('WORKFLOW',workflowTimeout,()=>ports.workflow({host,database:fixedQa.database,nonce,head:binding.head,expiresAt:window.expiresAt,appPassword:passwords.app,migratorPassword:passwords.migrator,timeout:workflowTimeout}),true);
    assertWorkflow(receipt);verified=true;
  } catch {failure='FN01_'+phase+'_FAILED';}
  finally {
    ports.stopWork(); // child 유무와 별개로 늦은 일반 작업의 시작을 영구 차단.
    // 별도 30초는 회수/관측만. 기존 시험 창을 연장하거나 새 작업을 시작하지 않는다.
    const cleanupEnd=Date.now()+30000;
    const collect=async<T>(limit:number,operation:()=>Promise<T>):Promise<T>=>boundedWait(Math.min(limit,cleanupEnd-Date.now()),()=>operation());
    let writersClosed=false;
    try{await collect(5000,async()=>{await Promise.allSettled([...activeOperations]);await ports.closeWriters();});writersClosed=true;}catch{cleanupFailure='FN01_WRITER_CLOSE_UNVERIFIED';}
    // 타이머 만료는 실제 취소 증거가 아니다. 늦은 생성/설치/SQL이 불명확하면 파괴 회수0.
    if(pendingMutationUnknown)cleanupFailure='FN01_PENDING_MUTATION_UNKNOWN_PRESERVED';
    if(writersClosed&&!pendingMutationUnknown) {
      try {
        if(containerId&&networkId){
          assertSameIdentity(parents,await collect(3000,()=>ports.parents()));
          assertOwnedContainer(await collect(3000,()=>ports.inspectContainer(containerId!,'CLEANUP')),containerId,networkId,nonce);
          await collect(3000,()=>ports.verifyTmpfs(containerId!,'CLEANUP'));
          await collect(5000,()=>ports.removeContainer(containerId!));
        }
        if(networkId){assertOwnedNetwork(await collect(3000,()=>ports.inspectNetwork(networkId!,'CLEANUP')),networkId,nonce,true);await collect(5000,()=>ports.removeNetwork(networkId!));}
        if(rootClaimed){
          assertSameIdentity(parents,await collect(3000,()=>ports.parents()));
          const current=await collect(3000,()=>ports.currentFiles());
          for(const item of cleanupFileOrder(ports.expectedFiles(),current))await collect(1000,()=>ports.removeFile(item));
          await collect(1000,()=>ports.removeEmptyRoot());
        }
      } catch {cleanupFailure='FN01_EXACT_CLEANUP_UNVERIFIED';}
    }
    // 앞선 종료 오류와 독립해서 시도한다. 기한 소진이면 즉시 미검증으로 남긴다.
    try{const r=await collect(3000,()=>ports.residue());if(!r.rootAbsent||!r.containerAbsent||!r.networkAbsent)cleanupFailure??='FN01_RESIDUE_REMAINS';}catch{cleanupFailure??='FN01_RESIDUE_UNVERIFIED';}
  }
  return{status:failure||cleanupFailure?'FAIL':'PASS',failure,cleanupFailure,actualWorkflowVerified:verified&&!failure&&!cleanupFailure,formalDbChanges:0,sourceAuthorizationVerified:false,coverageVerified:false,executionAuthorized:false,dispatchPerformed:false};
}

// 비공개 native 후보: 외부 입력/CLI/env로 binding을 만들 수 없다.
// 실제 B에서 신뢰한 전체 도구 목록·bootstrap 원문/최초 identity를 발급해야 한다.
interface NativeBinding extends CandidateBinding {
  bootstrap:BootstrapExpectation;bootstrapBytesHash:string;
  toolchain:FileProof[];dockerHash:string;gitHash:string;
}
function unissuedNativeBinding():NativeBinding {throw Error('FN01_NATIVE_BINDING_NOT_ISSUED');}
export async function runNativeBaselineQaCandidate():Promise<CandidateResult> {
  assertActualQaAuthorized(); // factory·OS·시계 조회보다 먼저. 현재 항상 거절.
  const binding=unissuedNativeBinding();
  return runBaselineQaCandidate(createNativePorts(binding),binding);
}
function createNativePorts(binding:NativeBinding):QaPorts {
  // 생성자에는 OS 효과 없음. 모든 동작은 위 첫 거절/미발급 binding 뒤의 method에만 둔다.
  const source=fixedQa.root+'/source',bootstrapPath=fixedQa.root+'/bootstrap.json';
  let expected:FileProof[]=[],networkId:string|null=null,containerId:string|null=null;
  let metadata:BootstrapMetadata|undefined,unknownChild=false,cleanup=false,cleanupDeadline=0,rootRemoved=false;
  const children=new Set<ReturnType<typeof execFile>>();
  const admission=new QaWorkAdmission();
  const window=new QaWindow(binding.issuedAt,binding.expiresAt);
  function problem(code:string):never {throw Error('FN01_NATIVE_'+code);}
  const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  const fresh=(limit=5000)=>window.remaining(Date.now(),limit);
  const cleanupRemaining=(limit=5000)=>Math.max(0,Math.min(limit,cleanupDeadline-Date.now()));
  function stageRemaining(end:number):number {const n=end-Date.now();if(n<=0)problem('STAGE_EXPIRED');return n;}
  async function identity(path:string):Promise<Identity> {
    const s=await lstat(path);
    return{path,realpath:await realpath(path),uid:s.uid,mode:s.mode&0o777,dev:s.dev,ino:s.ino,kind:s.isSymbolicLink()?'LINK':s.isDirectory()?'DIRECTORY':'FILE',links:s.nlink};
  }
  async function parents():Promise<Identity[]> {
    return Promise.all(binding.bootstrap.parents.map(r=>identity(r.path)));
  }
  async function fence(purpose:'WORK'|'CLEANUP'='WORK'):Promise<void> {
    if(purpose==='WORK')admission.assertWork();
    if(process.platform!=='linux'||process.getuid?.()!==1000||(purpose==='WORK'?fresh():cleanup&&cleanupRemaining()||0)<1)problem('PLATFORM_OR_EXPIRED');
    assertSameIdentity(binding.bootstrap.parents,await parents());
    const r=await identity(fixedQa.root),old=binding.bootstrap.root;
    // 자식 디렉터리 증감으로 nlink는 바뀐다. dev/ino/uid/mode/realpath는 고정한다.
    if(r.path!==old.path||r.realpath!==old.realpath||r.kind!=='DIRECTORY'||r.uid!==1000||r.mode!==0o700||r.dev!==old.dev||r.ino!==old.ino)problem('ROOT_IDENTITY');
  }
  async function bytes(path:string,limit=16*1024*1024):Promise<Buffer> {
    if(await realpath(path)!==path)problem('READ_LINK');
    const before=await lstat(path);
    if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>limit||before.size<0)problem('READ_DESCRIPTOR');
    const h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    try {
      const opened=await h.stat();if(opened.dev!==before.dev||opened.ino!==before.ino||opened.size!==before.size)problem('READ_RACE');
      const value=await h.readFile(),after=await h.stat();
      if(after.dev!==opened.dev||after.ino!==opened.ino||after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||value.length!==opened.size)problem('READ_CHANGED');
      return value;
    } finally {await h.close();}
  }
  async function proof(path:string):Promise<FileProof> {
    const r=await identity(path);if(r.kind==='LINK'||r.realpath!==path||r.dev!==binding.bootstrap.root.dev||r.uid!==1000||(r.mode&0o022)!==0)problem('FILE_IDENTITY');
    return{path,kind:r.kind,uid:r.uid,mode:r.mode,dev:r.dev,ino:r.ino,links:r.links,hash:r.kind==='FILE'?sha256(await bytes(path,256*1024*1024)):null};
  }
  async function files(purpose:'WORK'|'CLEANUP'='WORK'):Promise<FileProof[]> {
    await fence(purpose);const rows:FileProof[]=[];
    async function visit(path:string):Promise<void> {
      if(rows.length>=20000)problem('INVENTORY_LIMIT');
      const p=await proof(path);rows.push(p);
      if(p.kind==='DIRECTORY')for(const name of (await readdir(path)).sort())await visit(path+'/'+name);
    }
    for(const name of (await readdir(fixedQa.root)).sort())await visit(fixedQa.root+'/'+name);
    return rows;
  }
  async function tool(path:string,want:string):Promise<void> {
    if(!/^[0-9a-f]{64}$/.test(want)||await realpath(path)!==path||sha256(await bytes(path,256*1024*1024))!==want)problem('TOOL_HASH');
  }
  const cleanEnv=():NodeJS.ProcessEnv=>({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'});
  // 임의 명령은 export하지 않는다. 아래 fixed docker/git/node method의 지역 구현뿐이다.
  async function child(binary:'/usr/bin/docker'|'/usr/bin/git'|typeof fixedQa.node,args:string[],timeout:number,input?:string,extra:NodeJS.ProcessEnv={},purpose:'WORK'|'CLEANUP'='WORK'):Promise<string> {
    if(purpose==='WORK')admission.assertWork();
    if(purpose==='CLEANUP'){
      const allowed=[['container','ls','-a','--format','{{.Names}}'],['network','ls','--format','{{.Name}}']];
      if(containerId)allowed.push(['container','inspect',containerId],['exec',containerId,'cat','/proc/mounts'],['container','rm','--force',containerId]);
      if(networkId)allowed.push(['network','inspect',networkId],['network','rm',networkId]);
      if(!cleanup||binary!=='/usr/bin/docker'||!allowed.some(x=>same(['--host','unix:///var/run/docker.sock',...x],args)))problem('CLEANUP_COMMAND_DENIED');
    }
    if(rootRemoved){
      // root 회수 후 허용되는 명령은 아래 독립 잔여 조회 두 개뿐이다.
      if(!cleanup||binary!=='/usr/bin/docker'||![['--host','unix:///var/run/docker.sock','container','ls','-a','--format','{{.Names}}'],['--host','unix:///var/run/docker.sock','network','ls','--format','{{.Name}}']].some(x=>same(x,args)))problem('POST_ROOT_EFFECT_DENIED');
      assertSameIdentity(binding.bootstrap.parents,await parents());
      try{await lstat(fixedQa.root);return problem('ROOT_REAPPEARED');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    }else await fence(purpose);
    await tool(binary,binary==='/usr/bin/docker'?binding.dockerHash:binary==='/usr/bin/git'?binding.gitHash:fixedQa.nodeHash);
    // 비동기 경로/도구 검사 사이에 timeout이 올 수 있으므로 실제 spawn 직전에 재검사.
    if(purpose==='WORK')admission.assertWork();
    const duration=Math.min(timeout,purpose==='WORK'?fresh(timeout):cleanupRemaining(timeout));if(duration<1)problem('CHILD_EXPIRED');
    return new Promise<string>((resolve,reject)=>{
      let result:string|undefined,failed=false;
      const c=execFile(binary,args,{cwd:rootRemoved?binding.bootstrap.parents.at(-1)!.path:source,env:{...cleanEnv(),...extra},encoding:'utf8',windowsHide:true,timeout:duration,maxBuffer:8*1024*1024,killSignal:'SIGTERM'},(error,stdout)=>{
        failed=!!error;if(error&&(error.killed||error.signal))unknownChild=true;result=stdout.trim();
      });
      children.add(c);c.once('close',()=>{children.delete(c);if(failed||result===undefined)reject(Error('FN01_NATIVE_CHILD_FAILED'));else resolve(result);});c.stdin?.on('error',()=>{});c.stdin?.end(input??'');
    });
  }
  const docker=(args:string[],timeout=5000,input?:string,extra:NodeJS.ProcessEnv={},purpose:'WORK'|'CLEANUP'='WORK')=>child('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],timeout,input,{DOCKER_CONFIG:fixedQa.root+'/docker-config',...extra},purpose);
  const git=(args:string[])=>child('/usr/bin/git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','protocol.allow=never',...args],5000);
  async function names(purpose:'WORK'|'CLEANUP'='WORK'):Promise<{containerAbsent:boolean;networkAbsent:boolean}> {
    const c=await docker(['container','ls','-a','--format','{{.Names}}'],5000,undefined,{},purpose),n=await docker(['network','ls','--format','{{.Name}}'],5000,undefined,{},purpose);
    return{containerAbsent:!c.split('\n').includes(fixedQa.container),networkAbsent:!n.split('\n').includes(fixedQa.network)};
  }
  async function inspect(kind:'container'|'network',id:string,purpose:'WORK'|'CLEANUP'='WORK'):Promise<any> {
    if(!/^[0-9a-f]{64}$/.test(id))problem('FULL_ID_REQUIRED');
    const rows=JSON.parse(await docker([kind,'inspect',id],5000,undefined,{},purpose));if(!Array.isArray(rows)||rows.length!==1)problem('INSPECT');return rows[0];
  }
  async function ownedContainer(id:string,purpose:'WORK'|'CLEANUP'='WORK'):Promise<void> {
    if(id!==containerId||!networkId)problem('CONTAINER_NOT_CREATED');
    assertOwnedContainer(await inspect('container',id,purpose),id,networkId,binding.bootstrap.nonce);
  }
  async function psql(id:string,role:'anvil_v3_bootstrap'|'anvil_v3_migrator',password:string,sql:string,timeout:number):Promise<string> {
    await ownedContainer(id);if(!/^[0-9a-f]{64}$/.test(password)||Buffer.byteLength(sql)>2*1024*1024)problem('SQL_INPUT');
    return docker(['exec','-i','--env','PGPASSWORD','--env','PGCONNECT_TIMEOUT=5',id,'psql','--no-psqlrc','--no-password','--quiet','--no-align','--tuples-only','--host=127.0.0.1','--port=5432','--username='+role,'--dbname='+fixedQa.database,'--set=ON_ERROR_STOP=on','--set=VERBOSITY=sqlstate','--set=SHOW_CONTEXT=never','--set=ECHO=none','--file=-'],timeout,sql,{PGPASSWORD:password});
  }
  const ports:QaPorts={
    now:()=>Date.now(),parents,
    stopWork(){admission.stop();if(!cleanupDeadline)cleanupDeadline=Date.now()+30000;},
    async preflight(){
      await fence();if(await realpath(process.execPath)!==fixedQa.node||await realpath(process.cwd())!==source||await realpath(new URL(import.meta.url))!==source+'/scripts/qa-fn01-baseline-isolated.ts')problem('ENTRY_SOURCE');
      const raw=await bytes(bootstrapPath),bp=await proof(bootstrapPath);
      if(bp.mode!==0o600||sha256(raw)!==binding.bootstrapBytesHash)problem('BOOTSTRAP_BYTES');
      metadata=validateBootstrapReceipt(JSON.parse(raw.toString('utf8')),binding.bootstrap,Date.now());
      expected=[...metadata.receipt.inventory,bp];cleanupFileOrder(expected,await files());
      if(!binding.toolchain.length||sha256(JSON.stringify(binding.toolchain))!==binding.bootstrap.toolchainManifestHash)problem('TOOLCHAIN_MANIFEST');
      for(const item of binding.toolchain){
        if(![fixedQa.node,'/usr/bin/docker','/usr/bin/git'].includes(item.path)&&!item.path.startsWith('/opt/node-v24.21.0-linux-x64/lib/node_modules/npm/'))problem('TOOLCHAIN_PATH');
        const r=await identity(item.path);
        if(r.kind!==item.kind||r.realpath!==item.path||r.uid!==item.uid||r.mode!==item.mode||r.dev!==item.dev||r.ino!==item.ino||r.links!==item.links||(r.mode&0o022)!==0||r.kind==='FILE'&&sha256(await bytes(item.path,256*1024*1024))!==item.hash)problem('TOOLCHAIN_CHANGED');
      }
      await tool(fixedQa.node,fixedQa.nodeHash);await tool(fixedQa.npm,fixedQa.npmHash);
      const dc=expected.find(x=>x.path===fixedQa.root+'/docker-config');if(!dc||dc.kind!=='DIRECTORY'||expected.some(x=>x.path.startsWith(dc.path+'/')))problem('DOCKER_CONFIG_NOT_EMPTY');
      const socket=await lstat('/var/run/docker.sock');if(!socket.isSocket()||socket.uid!==0||socket.gid!==1001||(socket.mode&0o777)!==0o660||await realpath('/var/run/docker.sock')!=='/run/docker.sock')problem('SOCKET_IDENTITY');
      const info=JSON.parse(await docker(['info','--format','{{json .}}'])),absent=await names();
      return{platform:process.platform,uid:process.getuid!(),parents:await parents(),bootstrap:metadata,daemonId:info.ID,daemonName:info.Name,imageId:await docker(['image','inspect',fixedQa.image,'--format','{{.Id}}']),namesAbsent:absent.containerAbsent&&absent.networkAbsent,nodeRealpath:await realpath(fixedQa.node),npmRealpath:await realpath(fixedQa.npm),nodeHash:sha256(await bytes(fixedQa.node,256*1024*1024)),npmHash:sha256(await bytes(fixedQa.npm)),toolchainApprovalRef:binding.bootstrap.toolchainDecisionRef,toolchainManifestHash:binding.bootstrap.toolchainManifestHash,pathRiskDecisionRef:binding.bootstrap.pathRiskDecisionRef};
    },
    async sourceProof(){
      const manifest:unknown=JSON.parse((await bytes(source+'/docs/work_packages/FN01_BASELINE_PG_MIGRATION_MANIFEST.json')).toString('utf8'));assertMigrationManifest(manifest);
      const migrations:Record<string,Uint8Array>={};for(const m of manifest.ordered)migrations[m.id]=await bytes(source+'/db/migrations/'+m.id+'.sql',2*1024*1024);
      return{head:await git(['rev-parse','HEAD']),clean:(await git(['status','--porcelain','--untracked-files=all']))==='',remote:await git(['remote','get-url','origin']),productDiff:await git(['diff','--name-only',fixedQa.source,'--','apps','contracts','db','package.json','package-lock.json','docs/design']),lockBytes:await bytes(source+'/package-lock.json'),migrations,manifest};
    },
    async createNetwork(input){
      if(input.name!==fixedQa.network||input.nonce!==binding.bootstrap.nonce||input.internal!==true)problem('NETWORK_INPUT');
      const absent=await names();if(!absent.containerAbsent||!absent.networkAbsent)problem('NAME_ALREADY_EXISTS');
      let id:string;try{id=await docker(['network','create','--internal','--label','anvil.project=v3','--label','anvil.owner='+fixedQa.owner,'--label','anvil.instance='+input.nonce,fixedQa.network],input.timeout);}catch(e){unknownChild=true;throw e;}
      if(!/^[0-9a-f]{64}$/.test(id)){unknownChild=true;return problem('NETWORK_CREATE_UNKNOWN');}networkId=id;return id;
    },
    inspectNetwork:(id,purpose)=>inspect('network',id,purpose),
    async createContainer(input){
      if(!networkId||!same(input.args,containerArguments(binding.bootstrap.nonce))||!/^[0-9a-f]{64}$/.test(input.password))problem('CONTAINER_INPUT');
      assertOwnedNetwork(await inspect('network',networkId),networkId,binding.bootstrap.nonce,true);
      const absent=await names();if(!absent.containerAbsent)problem('CONTAINER_ALREADY_EXISTS');
      let id:string;try{id=await docker(input.args,input.timeout,undefined,{POSTGRES_PASSWORD:input.password});}catch(e){unknownChild=true;throw e;}
      if(!/^[0-9a-f]{64}$/.test(id)){unknownChild=true;return problem('CONTAINER_CREATE_UNKNOWN');}containerId=id;return id;
    },
    inspectContainer:(id,purpose)=>inspect('container',id,purpose),
    async verifyTmpfs(id,purpose){await ownedContainer(id,purpose);const mounts=await docker(['exec',id,'cat','/proc/mounts'],5000,undefined,{},purpose);const row=mounts.split('\n').find(r=>r.split(' ')[1]==='/var/lib/postgresql/data')?.split(' ');if(!row||row[2]!=='tmpfs'||!['rw','noexec','nosuid'].every(o=>row[3]!.split(',').includes(o)))problem('TMPFS');},
    async bootstrap(input){
      if(input.database!==fixedQa.database)problem('DATABASE');for(const p of Object.values(input.passwords))if(!/^[0-9a-f]{64}$/.test(p))problem('PASSWORD');
      const end=Math.min(Date.now()+input.timeout,binding.expiresAt-20000);let ready=false;
      while(Date.now()<end){try{await docker(['exec',input.id,'pg_isready','-h','127.0.0.1','-U','anvil_v3_bootstrap','-d',fixedQa.database],Math.min(5000,end-Date.now()));ready=true;break;}catch{if(unknownChild)problem('READY_UNKNOWN');await boundedWait(Math.min(600,Math.max(1,end-Date.now())),()=>new Promise<void>(r=>setTimeout(r,250)));}}
      if(!ready)problem('PG_NOT_READY');
      await psql(input.id,'anvil_v3_bootstrap',input.passwords.bootstrap,"BEGIN;CREATE ROLE anvil_v3_migrator LOGIN PASSWORD '"+input.passwords.migrator+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;CREATE ROLE anvil_v3_app LOGIN PASSWORD '"+input.passwords.app+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;REVOKE ALL ON DATABASE "+fixedQa.database+' FROM PUBLIC;GRANT CONNECT ON DATABASE '+fixedQa.database+" TO anvil_v3_migrator,anvil_v3_app;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA anvil AUTHORIZATION anvil_v3_migrator;CREATE SCHEMA anvil_qa AUTHORIZATION anvil_v3_migrator;GRANT USAGE ON SCHEMA anvil,anvil_qa TO anvil_v3_app;ALTER DEFAULT PRIVILEGES FOR ROLE anvil_v3_migrator IN SCHEMA anvil,anvil_qa GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anvil_v3_app;COMMIT;",Math.max(1,end-Date.now()));
    },
    async migrate(input){
      const end=Math.min(Date.now()+input.timeout,binding.expiresAt-20000);
      const p=await ports.sourceProof(),m=assertCandidateSource(p,binding.head);if(input.beforeFinalMigration!==legacyFixtureSql||input.ordered.length!==49)problem('MIGRATION_INPUT');
      for(let i=0;i<m.ordered.length;i++){
        const row=m.ordered[i]!,actual=input.ordered[i]!;if(actual.id!==row.id||sha256(actual.bytes)!==row.sha256)problem('MIGRATION_CHANGED');
        if(row.id==='0015_project_baselines')await psql(input.id,'anvil_v3_migrator',input.passwords.migrator,legacyFixtureSql,stageRemaining(end));
        // 각 원 SQL의 COMMIT을 유지한다. 전체 시험을 감싸는 ROLLBACK/원 SQL 변경 없음.
        await psql(input.id,'anvil_v3_migrator',input.passwords.migrator,Buffer.from(actual.bytes).toString('utf8')+"\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');",stageRemaining(end));
      }
    },
    async workflow(input){
      if(!containerId||input.database!==fixedQa.database||input.head!==binding.head||input.nonce!==binding.bootstrap.nonce||input.expiresAt!==binding.expiresAt)problem('WORKFLOW_BINDING');
      const host=assertOwnedContainer(await inspect('container',containerId),containerId,networkId!,binding.bootstrap.nonce);if(input.host!==host)problem('WORKFLOW_HOST');
      const out=await child(fixedQa.node,['--test','tests/integration/FN01/baseline-isolated.test.ts'],input.timeout,undefined,{ANVIL_FN01_BASELINE_PG_HOST:host,ANVIL_FN01_BASELINE_NONCE:input.nonce,ANVIL_FN01_BASELINE_EXPIRES_AT:new Date(input.expiresAt).toISOString(),ANVIL_FN01_BASELINE_APP_PASSWORD:input.appPassword,ANVIL_FN01_BASELINE_MIGRATOR_PASSWORD:input.migratorPassword});
      const lines=out.split('\n').filter(x=>x.includes('FN01_BASELINE_SAFE '));if(lines.length!==1)problem('WORKFLOW_RECEIPT');
      const r=JSON.parse(lines[0]!.split('FN01_BASELINE_SAFE ')[1]!);
      const count=(key:string)=>Number(out.match(new RegExp('^# '+key+' (\\d+)$','m'))?.[1]??NaN);
      if(!Array.isArray(r.files)||r.files.length>32)problem('WORKFLOW_FILES');
      // child가 업로드 직후 기록한 전용 blob/부모만. 회수 시 전수 스캔을 소유 근거로 삼지 않는다.
      for(const item of r.files as FileProof[]){if(!item.path.startsWith(fixedQa.root+'/artifacts/')||!same(await proof(item.path),item)||expected.some(f=>f.path===item.path))problem('WORKFLOW_FILE_PROOF');expected.push(item);}
      // 기존 artifacts 디렉터리의 nlink 변경만 갱신. inode/소유/권한 변경은 거절한다.
      expected=await Promise.all(expected.map(async item=>{if(item.kind!=='DIRECTORY')return item;const current=await proof(item.path);if(!same({...current,links:item.links},item))problem('KNOWN_DIRECTORY_CHANGED');return current;}));
      return{...r,testCount:count('tests'),passCount:count('pass'),failCount:count('fail'),skipCount:count('skipped'),cancelCount:count('cancelled')};
    },
    async closeWriters(){admission.stop();if(!cleanupDeadline)cleanupDeadline=Date.now()+30000;if(children.size||unknownChild)problem('WRITERS_UNKNOWN_PRESERVED');cleanup=true;},
    async removeContainer(id){if(!cleanup)problem('NOT_CLEANUP');await ownedContainer(id,'CLEANUP');await docker(['container','rm','--force',id],5000,undefined,{},'CLEANUP');},
    async removeNetwork(id){if(!cleanup||id!==networkId)problem('NOT_CLEANUP_OWNER');assertOwnedNetwork(await inspect('network',id,'CLEANUP'),id,binding.bootstrap.nonce,true);await docker(['network','rm',id],5000,undefined,{},'CLEANUP');},
    expectedFiles:()=>expected,currentFiles:()=>files('CLEANUP'),
    async removeFile(item){if(!cleanup||!expected.some(x=>same(x,item)))problem('NOT_OWNED_FILE');await fence('CLEANUP');const current=await proof(item.path);if(item.kind==='DIRECTORY'){if(!same({...current,links:item.links},item)||(await readdir(item.path)).length)problem('DIRECTORY_CHANGED');await rmdir(item.path);}else{if(!same(current,item))problem('FILE_CHANGED');await unlink(item.path);}},
    async removeEmptyRoot(){await fence('CLEANUP');if((await readdir(fixedQa.root)).length)problem('ROOT_NOT_EMPTY');await rmdir(fixedQa.root);rootRemoved=true;},
    async residue(){
      // root 회수 뒤에는 고정 부모에서 이름 두 개의 독립 읽기만 허용한다.
      let rootAbsent=false;try{await lstat(fixedQa.root);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')rootAbsent=true;else throw e;}
      return{rootAbsent,...await names('CLEANUP')};
    },
  };
  return ports;
}
