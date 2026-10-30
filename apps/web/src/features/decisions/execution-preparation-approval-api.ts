import {ApiError} from '../../api/client.ts';
import type {ApprovalView} from './api.ts';
const exact=(v:any,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')&&keys.every(k=>Object.getOwnPropertyDescriptor(v,k)?.get===undefined&&Object.getOwnPropertyDescriptor(v,k)?.set===undefined);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const ref=(v:any)=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const canonical=(v:any):string=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const path=(v:any)=>typeof v==='string'&&v.isWellFormed()&&v===v.normalize('NFC')&&v.length>0&&new TextEncoder().encode(v).length<=1024&&!/[\x00-\x1f\x7f\\:%?*"<>|]/.test(v)&&v.split('/').every((s:string)=>s.length>0&&s.length<=255&&s!=='.'&&s!=='..'&&!/[. ]$/.test(s)&&!/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(s));
export interface ExecutionPreparationCandidate{candidateCommandId:string;payloadHash:string;payload:Record<string,any>}
/** 후보 원문 검산만 한다. 능력·예산·소스 접근 권위를 발급하지 않는다. */
export async function validateExecutionPreparationCandidate(view:ApprovalView,pid:string):Promise<void>{
 const bad=():never=>{throw new ApiError('RESPONSE_INVALID');};
 if(view?.request?.details?.actionScope?.operation!=='prepareExecution'){if(view?.candidatePreparation!==undefined)bad();return;}
 const c=view.candidatePreparation,s=view.request.details.actionScope;
 if(!exact(c,['candidateCommandId','payloadHash','payload'])||!uuid(c!.candidateCommandId)||c!.candidateCommandId!==view.request.details.candidateCommandId||c!.payloadHash!==s.payloadHash||s.targetRef!==null||s.expectedVersion!==0||s.baselineRefs.length||s.environmentRef!==null||s.sourceScopes.length||s.limitsRef!==null)bad();
 const v=c!.payload,refs=['assignmentRef','roleBindingRef','contextBundleRef','connectionRef','environmentRef','capabilityRef','budgetPolicyRef'];
 if(!exact(v,['projectId',...refs,'sourceScopes','mode','reason'])||!uuid(v.projectId)||v.projectId!==pid||refs.some(k=>!ref(v[k]))||!['CONTEXT_REVIEW','WORK'].includes(v.mode)||typeof v.reason!=='string'||!v.reason.isWellFormed()||!v.reason.trim()||v.reason.length>20000||!Array.isArray(v.sourceScopes)||!v.sourceScopes.length||v.sourceScopes.length>200)bad();
 const roots=new Set<string>();let count=0;for(const scope of v.sourceScopes){if(!exact(scope,['sourceRootRef','mappingRef','observationRef','baselineRef','targets'])||!ref(scope.sourceRootRef)||scope.mappingRef!==null&&!ref(scope.mappingRef)||!ref(scope.observationRef)||!ref(scope.baselineRef)||!Array.isArray(scope.targets)||!scope.targets.length||scope.targets.length>200||roots.has(scope.sourceRootRef.id))bad();roots.add(scope.sourceRootRef.id);const paths=new Set<string>();for(const t of scope.targets){if(++count>200||!exact(t,['relativePath','kind','access','recursive'])||!path(t.relativePath)||t.kind!=='FILE'||!['READ','WRITE'].includes(t.access)||t.recursive!==false||paths.has(t.relativePath.toUpperCase()))bad();paths.add(t.relativePath.toUpperCase());}}
 if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[=:]\s*\S+/i.test(v.reason))bad();
 const bytes=new TextEncoder().encode(canonical(v));if(bytes.length>2*1024*1024)bad();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==c!.payloadHash)bad();
}
