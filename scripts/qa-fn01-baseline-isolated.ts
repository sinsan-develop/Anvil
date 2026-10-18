// 작성/독립 읽기용 orchestration 후보. 네이티브 실행 adapter와 actual binding은 미연결.
// import/CLI 인자/env만으로 실행하지 않는다. 성공 mock을 실제 QA로 사용하지 않는다.
import { randomBytes } from 'node:crypto';
import { fixedQa, assertActualQaAuthorized, assertMigrationManifest, assertParentChain, assertSameIdentity, assertOwnedContainer, assertOwnedNetwork, cleanupFileOrder, containerArguments, dependencyArguments, QaWindow, sha256, boundedWait, QaWaitTimeout } from './fn01-baseline-qa-guard.ts';
import type { Identity, FileProof, MigrationManifest } from './fn01-baseline-qa-guard.ts';

export interface QaSourceProof {
  head:string; clean:boolean;remote:string;productDiff:string;lockBytes:Uint8Array;
  migrations:Record<string,Uint8Array>; manifest:unknown;
}
export interface QaPreflight {
  platform:string;uid:number;parents:Identity[];rootAbsent:boolean;
  daemonId:string;daemonName:string;imageId:string;namesAbsent:boolean;
  nodeRealpath:string;npmRealpath:string;nodeHash:string;npmHash:string;
  toolchainApprovalRef:string|null;toolchainManifestHash:string|null;pathRiskDecisionRef:string|null;
}
export interface WorkflowReceipt {phase:'DONE';cases:string[];closeFailures:number;failure:null;testCount:1;passCount:1;failCount:0;skipCount:0;cancelCount:0}
export const requiredCases=Object.freeze(['EXACT_49_SCHEMA','LEGACY_PRESERVED','AUTH_POLICY_REQUIRED','DRAFT_STORED_READ','REVIEW_SEPARATE_ADOPTION','RECEIPT_LOSS_RECONCILED','SECOND_ADOPTION','CLIENT_TRANSITION','CROSS_PROJECT_DENIED','OLD_GENERATION_DENIED','DIRECT_DML_DENIED','CURRENT_DENY_BEFORE_REPLAY','REWORK_BLOCKS_ADOPTION','CORE_STATIC_REJECTED','QUARANTINE_BLOCKS_REUSE','CONCURRENT_CAS_AUDIT']);
/** 외부 실행 허가가 아니다. 각 port의 native 구현·bootstrap은 B 검토 대상이다. */
export interface QaPorts {
  now():number;
  preflight():Promise<QaPreflight>;
  // root/clone/npm 부작용은 미연결. B에서 별도로 심사한 구현만 연결한다.
  claimAndClone(input:{root:string;source:string;head:string;remote:string;mode:0o700;recursive:false;timeout:number}):Promise<void>;
  sourceProof():Promise<QaSourceProof>;
  install(input:{file:string;args:string[];timeout:number;emptyEnvironment:true}):Promise<void>;
  parents():Promise<Identity[]>;
  createNetwork(input:{name:string;nonce:string;internal:true;timeout:number}):Promise<string>;
  inspectNetwork(id:string):Promise<unknown>;
  createContainer(input:{args:string[];password:string;timeout:number}):Promise<string>;
  inspectContainer(id:string):Promise<unknown>;
  // image metadata 외 /proc/mounts의 tmpfs/noexec/nosuid 및 volume0도 확인해야 한다.
  verifyTmpfs(id:string):Promise<void>;
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
export interface CandidateBinding {head:string;issuedAt:number;expiresAt:number}
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
  if(p.platform!=='linux'||p.uid!==1000||!p.rootAbsent||!p.namesAbsent||p.daemonId!==fixedQa.daemonId||p.daemonName!==fixedQa.daemonName||p.imageId!==fixedQa.imageId||p.nodeRealpath!==fixedQa.node||p.npmRealpath!==fixedQa.npm||p.nodeHash!==fixedQa.nodeHash||p.npmHash!==fixedQa.npmHash)throw Error('FN01_PREFLIGHT_MISMATCH');
  if(!p.toolchainApprovalRef||!p.pathRiskDecisionRef||!p.toolchainManifestHash||!/^[0-9a-f]{64}$/.test(p.toolchainManifestHash))throw Error('FN01_TOOLCHAIN_OR_PATH_UNRESOLVED');
}
function assertWorkflow(r:WorkflowReceipt):void {
  if(r?.phase!=='DONE'||r.failure!==null||r.closeFailures!==0||r.testCount!==1||r.passCount!==1||r.failCount!==0||r.skipCount!==0||r.cancelCount!==0||!Array.isArray(r.cases)||new Set(r.cases).size!==r.cases.length||requiredCases.some(c=>!r.cases.includes(c)))throw Error('FN01_WORKFLOW_INCOMPLETE');
}
export interface CandidateResult {status:'FAIL'|'PASS';failure:string|null;cleanupFailure:string|null;actualWorkflowVerified:boolean;formalDbChanges:0;sourceAuthorizationVerified:false;coverageVerified:false;executionAuthorized:false;dispatchPerformed:false}
/** 현재는 첫 gate에서 반드시 거절한다. B issuer/adapter/실행 원본 확정 전 호출 금지. */
export async function runBaselineQaCandidate(ports:QaPorts,binding:CandidateBinding):Promise<CandidateResult> {
  assertActualQaAuthorized(); // preflight/시계/경로 읽기 이전. 현재 아래로 진행하지 않는다.
  const window=new QaWindow(binding.issuedAt,binding.expiresAt),nonce=randomBytes(16).toString('hex');
  let rootClaimed=false,containerId:string|null=null,networkId:string|null=null,parents:Identity[]=[],failure:string|null=null,cleanupFailure:string|null=null,verified=false,pendingMutationUnknown=false,phase='PREFLIGHT';
  const stage=async<T>(name:string,limit:number,operation:()=>Promise<T>,mutation=false):Promise<T>=>{
    phase=name;
    try{return await boundedWait(window.remaining(ports.now(),limit),()=>operation());}
    catch(e){if(e instanceof QaWaitTimeout&&mutation)pendingMutationUnknown=true;throw e;}
  };
  const fence=async(limit:number)=>{assertSameIdentity(parents,await stage('PARENTS',5000,()=>ports.parents()));return window.remaining(ports.now(),limit);};
  try {
    const p=await stage('PREFLIGHT',5000,()=>ports.preflight());assertPreflight(p);parents=p.parents;
    // bootstrap이 어느 exact H에서 시작하는지는 미확정. B에서 adapter와 함께 결박한다.
    const cloneTimeout=await fence(60000);
    await stage('CLAIM_CLONE',cloneTimeout,()=>ports.claimAndClone({root:fixedQa.root,source:fixedQa.root+'/source',head:binding.head,remote:'git@github-sinsan-develop:sinsan-develop/Anvil.git',mode:0o700,recursive:false,timeout:cloneTimeout}),true);
    rootClaimed=true; // 부분 생성/응답 유실은 임의 소유 채택하지 않고 보존한다.
    let proof=await stage('SOURCE',5000,()=>ports.sourceProof());const manifest=assertCandidateSource(proof,binding.head);
    const installTimeout=await fence(300000);
    await stage('INSTALL',installTimeout,()=>ports.install({file:fixedQa.node,args:dependencyArguments(),timeout:installTimeout,emptyEnvironment:true}),true);
    proof=await stage('SOURCE',5000,()=>ports.sourceProof());assertCandidateSource(proof,binding.head);
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
    // 별도 30초는 회수/관측만. 기존 시험 창을 연장하거나 새 작업을 시작하지 않는다.
    const cleanupEnd=Date.now()+30000;
    const collect=async<T>(limit:number,operation:()=>Promise<T>):Promise<T>=>boundedWait(Math.min(limit,cleanupEnd-Date.now()),()=>operation());
    let writersClosed=false;
    try{await collect(5000,()=>ports.closeWriters());writersClosed=true;}catch{cleanupFailure='FN01_WRITER_CLOSE_UNVERIFIED';}
    // 타이머 만료는 실제 취소 증거가 아니다. 늦은 생성/설치/SQL이 불명확하면 파괴 회수0.
    if(pendingMutationUnknown)cleanupFailure='FN01_PENDING_MUTATION_UNKNOWN_PRESERVED';
    if(writersClosed&&!pendingMutationUnknown) {
      try {
        if(containerId&&networkId){
          assertSameIdentity(parents,await collect(3000,()=>ports.parents()));
          assertOwnedContainer(await collect(3000,()=>ports.inspectContainer(containerId!)),containerId,networkId,nonce);
          await collect(3000,()=>ports.verifyTmpfs(containerId!));
          await collect(5000,()=>ports.removeContainer(containerId!));
        }
        if(networkId){assertOwnedNetwork(await collect(3000,()=>ports.inspectNetwork(networkId!)),networkId,nonce,true);await collect(5000,()=>ports.removeNetwork(networkId!));}
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
