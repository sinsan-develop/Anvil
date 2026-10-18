import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {buildA3AbsoluteSourceCompileCandidate} from './source-read-absolute-compile.ts';
const core='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\System.Core.dll';
const coreHash='8B898BED54AE8CC61F9C58CC3EB062724F8357D2BDDA338B5D363654ECFF333D';
const qa='D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01-qa';
const fields=['sourceRoot','sourceHash','compilerHash','mscorlibHash','systemHash','systemCoreHash'];
const fail=():never=>{throw Error('A3_CORE_REFERENCE_CANDIDATE_INVALID');};
/** 메모리 안의 명령 비교만 생성한다. 전달된 경로/hash와 commandHash는 OS 증명·실행 허가가 아니다. */
export function buildA3CoreReferenceCandidate(input:unknown){
 if(!input||typeof input!=='object'||types.isProxy(input)||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))return fail();
 const descriptors=Object.getOwnPropertyDescriptors(input);
 if(Reflect.ownKeys(input).length!==fields.length||fields.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k]!,'value')||descriptors[k]!.get||descriptors[k]!.set))return fail();
 const v=Object.fromEntries(fields.map(k=>[k,descriptors[k]!.value]));
 if(typeof v.systemCoreHash!=='string'||v.systemCoreHash.toUpperCase()!==coreHash)return fail();
 const base=buildA3AbsoluteSourceCompileCandidate({sourceRoot:v.sourceRoot,sourceHash:v.sourceHash,compilerHash:v.compilerHash,mscorlibHash:v.mscorlibHash,systemHash:v.systemHash});
 const root=base.cwd,fold=root.toUpperCase(),qaFold=qa.toUpperCase();
 if(fold===qaFold||fold.startsWith(qaFold+'\\')||qaFold.startsWith(fold+'\\'))return fail();
 const comparisonArgs=Object.freeze([...base.args.slice(0,8),'/out:'+qa+'\\bin\\SourceReadObserver.dll',base.args[9]!]);
 const args=Object.freeze([...comparisonArgs.slice(0,8),'/reference:'+core,...comparisonArgs.slice(8)]);
 const body={kind:'A3_CORE_REFERENCE_LIBRARY_CANDIDATE',runId:'a3-core-reference-compile-01',candidateOnly:true,executable:base.executable,cwd:root,comparisonArgs,args,addedArgumentIndex:8,
  useShellExecute:false,createNoWindow:true,childEnvironment:Object.freeze({TMP:qa+'\\temp',TEMP:qa+'\\temp'}),receiptProposed:'D:\\Project\\Anvil\\.av3-data\\a3-core-reference-compile-01.consumed.json',
  limits:base.limits,expectedHashes:Object.freeze({...base.expectedHashes,systemCoreHash:coreHash}),coreMetadata:Object.freeze({path:core,bytes:1551104,fileVersion:'4.8.9363.0 built by: NET481REL1LAST_25H2_B',owner:'NT SERVICE\\TrustedInstaller',attributes:'Archive',linkType:'HardLink',target:null}),
  mustVerifyBeforeStart:Object.freeze(['NEW_EXACT_REFERENCE_PATH_COMMIT_WINDOW_DECISION','NEW_RUNNER_GATE_AND_SCOPED_REVIEW','ACTUAL_CORE_METADATA_HASH_AND_FIXED_LEAF_EXCEPTION','PRIOR_CONSUMED_RECORD_PRESERVED','GIT_EXACT_CLEAN_PRIVATE','SOURCE_COMPILER_BCL_IDENTITIES_UNCHANGED','FRESH_PRIVATE_QA_AND_CONSUMPTION_RECORD','PROTECTED_FILES_RUNTIME_UNCHANGED','OWNED_PROCESS_CAPTURE_CLEANUP']),
  executionAuthorized:false,processStarted:false,osVerified:false,baselineConfirmed:false,callerFactsVerified:false};
 return Object.freeze({...body,commandHash:contentHash(canonicalJson(body))});
}
