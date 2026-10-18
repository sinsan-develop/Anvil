import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';

const compiler='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',bcl='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319';
const qaRoot='D:\\tmp\\anvil-v3-stage-b\\a3-absolute-source-compile-01';
const hashes=Object.freeze({sourceHash:'3D10E3964317EB5F3F18A74B42328BDC6894CAEBE9452CA49D1470CD273FFFBC',compilerHash:'46809206887326D2D24DB1EFF1F3064DE972C3451ABE766B49111450A5E08E00',mscorlibHash:'11AC114C43ECF6996BEF58BA3C99FBA3693A4560A84EEADDE54D193060DC626C',systemHash:'2B3C17C6208A0B4B6BEB94E1A066F99BA06CDB2EA919479E99D47E8C6D96DC71'});
const fail=():never=>{throw Error('A3_ABSOLUTE_CANDIDATE_INPUT_INVALID');};
function rootPath(value:unknown):value is string{
 if(typeof value!=='string'||!value.isWellFormed()||value.length>4096||! /^[A-Z]:\\[^\\]/.test(value))return false;
 const parts=value.slice(3).split('\\');
 return parts.every(p=>!!p&&!['.','..'].includes(p)&&!/[\u0000-\u001f\u007f/:*?"<>|]/.test(p)&&!/[. ]$/.test(p)&&!/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(p));
}
/** 순수 후보: 전달된 hash/path 주장은 OS 증명이 아니다. 파일 접근·프로세스·실행승인 수집을 하지 않는다. */
export function buildA3AbsoluteSourceCompileCandidate(input:unknown){
 if(!input||typeof input!=='object'||types.isProxy(input)||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))return fail();
 const fields=['sourceRoot',...Object.keys(hashes)],descriptors=Object.getOwnPropertyDescriptors(input);
 if(Reflect.ownKeys(input).length!==fields.length||fields.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k]!,'value')||descriptors[k]!.get||descriptors[k]!.set))return fail();
 const values=Object.fromEntries(fields.map(k=>[k,descriptors[k]!.value]));
 if(!rootPath(values.sourceRoot)||Object.entries(hashes).some(([k,hash])=>typeof values[k]!=='string'||values[k].toUpperCase()!==hash))return fail();
 const root=values.sourceRoot,fold=root.toUpperCase(),qaFold=qaRoot.toUpperCase();if(fold===qaFold||fold.startsWith(qaFold+'\\')||qaFold.startsWith(fold+'\\'))return fail();
 const shared=['/nologo','/noconfig','/nostdlib+','/target:library','/debug-','/optimize+',`/reference:${bcl}\\mscorlib.dll`,`/reference:${bcl}\\System.dll`,`/out:${qaRoot}\\bin\\SourceReadObserver.dll`];
 const previousArgs=Object.freeze([...shared,'apps/connector/native/SourceReadObserver.cs']),args=Object.freeze([...shared,root+'\\apps\\connector\\native\\SourceReadObserver.cs']);
 const body={kind:'A3_ABSOLUTE_SOURCE_LIBRARY_CANDIDATE',candidateOnly:true,executable:compiler,cwd:root,previousArgs,args,changedIndices:Object.freeze([9]),useShellExecute:false,createNoWindow:true,childEnvironment:Object.freeze({TMP:qaRoot+'\\temp',TEMP:qaRoot+'\\temp'}),limits:Object.freeze({timeoutMs:15000,combinedOutputBytes:16384,compilerStarts:1,retries:0}),expectedHashes:hashes,mustVerifyBeforeStart:Object.freeze(['NEW_EXACT_COMMAND_COMMIT_WINDOW_DECISION','GIT_EXACT_CLEAN_PRIVATE','SOURCE_REALPATH_NONLINK_OWNER_HASH','COMPILER_BCL_FIXED_IDENTITY_HASH','FRESH_EXCLUSIVE_QA_ROOT','PROTECTED_FILES_RUNTIME_UNCHANGED','OWNED_PROCESS_OUTPUT_CLEANUP']),executionAuthorized:false,processStarted:false,osVerified:false,baselineConfirmed:false,callerFactsVerified:false};
 return Object.freeze({...body,commandHash:contentHash(canonicalJson(body))});
}
