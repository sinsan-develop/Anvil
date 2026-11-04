/** 본인 공통 설정 원형. 등록/credential/실행 권위를 포함하지 않는다. */
export type CommonSetupKind='TOOL'|'ENVIRONMENT';
export interface SetupRef{id:string;version:number;contentHash:string}
export interface ToolSetupDefinition{label:string;toolProduct:string;toolVersion:string;adapterKind:string;modelOptions:Record<string,unknown>}
export interface SetupHost{label:string;platform:'WINDOWS'|'LINUX'|'OTHER';pathHint:string|null}
export interface EnvironmentSetupDefinition{label:string;executionHost:SetupHost;targetHosts:SetupHost[];sourceRoots:{label:string;pathHint:string;requestedAccess:'READ'|'READ_WRITE'}[];commandProfiles:{label:string;purpose:string;commandText:string}[];executionUserHint:string|null}
export type CommonSetupDefinition=ToolSetupDefinition|EnvironmentSetupDefinition;
export interface SetupSelection{coordinatorToolRef:SetupRef|null;codingToolRef:SetupRef|null;environmentRef:SetupRef|null}
export type SetupSlot='COORDINATOR_TOOL'|'CODING_TOOL'|'ENVIRONMENT';
export interface CommonSetupSnapshot{id:string;version:number;kind:CommonSetupKind;definition:CommonSetupDefinition;reason:string;createdBy:string}
export interface ProjectSetupCopy{id:string;projectId:string;slot:SetupSlot;sourceRef:SetupRef;sourceOwnerUserId:string;definitionSnapshot:CommonSetupDefinition;status:'UNBOUND'}
export const setupUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export const setupRecord=(v:any,keys:readonly string[]):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Object.getOwnPropertySymbols(v).length===0&&Object.keys(Object.getOwnPropertyDescriptors(v)).sort().join('|')===[...keys].sort().join('|')&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>d.enumerable&&'value'in d);
const bad=():never=>{throw Error('COMMON_SETUP_INPUT_INVALID');};
export const setupText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.isWellFormed()&&!!v.trim()&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v);
export function copyCommonSetupData(v:unknown):any{
 const active=new Set<object>();
 const copy=(x:any,depth:number):any=>{if(depth>64)bad();if(x===null||typeof x==='boolean')return x;if(typeof x==='string'){if(!x.isWellFormed())bad();return x;}if(typeof x==='number'){if(!Number.isFinite(x)||Number.isInteger(x)&&!Number.isSafeInteger(x))bad();return x;}if(!x||typeof x!=='object'||active.has(x)||Object.getOwnPropertySymbols(x).length)bad();const d=Object.getOwnPropertyDescriptors(x);if(!Array.isArray(x)&&![Object.prototype,null].includes(Object.getPrototypeOf(x)))bad();active.add(x);try{if(Array.isArray(x)){if(Object.keys(d).length!==x.length+1)bad();return Array.from({length:x.length},(_,i)=>{const p=d[String(i)];if(!p||!p.enumerable||!('value'in p))bad();return copy(p!.value,depth+1);});}const r:Record<string,unknown>={};for(const k of Object.keys(d).sort()){const p=d[k]!;if(!k.isWellFormed()||!p.enumerable||!('value'in p))bad();Object.defineProperty(r,k,{value:copy(p.value,depth+1),enumerable:true,writable:true,configurable:true});}return r;}finally{active.delete(x);}};
 const result=copy(v,0);if(new TextEncoder().encode(JSON.stringify(result)).length>2097152)bad();return result;
}
export const setupRef=(v:unknown):v is SetupRef=>setupRecord(v,['id','version','contentHash'])&&setupUuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[0-9a-f]{64}$/.test(v.contentHash);
const array=(v:any):v is any[]=>Array.isArray(v)&&v.length<=200;
const labels=(v:any[])=>new Set(v.map(x=>x.label.trim())).size===v.length;
function host(v:any){if(!setupRecord(v,['label','platform','pathHint'])||!setupText(v.label,200)||!['WINDOWS','LINUX','OTHER'].includes(v.platform)||v.pathHint!==null&&!setupText(v.pathHint,4096))bad();}
export function readCommonSetupDefinition(kind:unknown,raw:unknown):CommonSetupDefinition{
 const v=copyCommonSetupData(raw);
 if(kind==='TOOL'){if(!setupRecord(v,['label','toolProduct','toolVersion','adapterKind','modelOptions'])||!['label','toolProduct','toolVersion','adapterKind'].every(k=>setupText(v[k],200))||!v.modelOptions||typeof v.modelOptions!=='object'||Array.isArray(v.modelOptions))bad();}
 else if(kind==='ENVIRONMENT'){if(!setupRecord(v,['label','executionHost','targetHosts','sourceRoots','commandProfiles','executionUserHint'])||!setupText(v.label,200)||!array(v.targetHosts)||!array(v.sourceRoots)||!array(v.commandProfiles)||v.executionUserHint!==null&&!setupText(v.executionUserHint,200))bad();host(v.executionHost);v.targetHosts.forEach(host);for(const r of v.sourceRoots)if(!setupRecord(r,['label','pathHint','requestedAccess'])||!setupText(r.label,200)||!setupText(r.pathHint,4096)||!['READ','READ_WRITE'].includes(r.requestedAccess))bad();for(const r of v.commandProfiles)if(!setupRecord(r,['label','purpose','commandText'])||!setupText(r.label,200)||!setupText(r.purpose,20000)||!setupText(r.commandText,20000))bad();if(![v.targetHosts,v.sourceRoots,v.commandProfiles].every(labels))bad();}
 else bad();return v;
}
export function readSetupSelection(value:unknown):SetupSelection|undefined{if(value===undefined)return undefined;const v=copyCommonSetupData(value);if(!setupRecord(v,['coordinatorToolRef','codingToolRef','environmentRef'])||![v.coordinatorToolRef,v.codingToolRef,v.environmentRef].every(r=>r===null||setupRef(r)))bad();return v as unknown as SetupSelection;}
export function setupSlots(value:SetupSelection){return [['COORDINATOR_TOOL',value.coordinatorToolRef],['CODING_TOOL',value.codingToolRef],['ENVIRONMENT',value.environmentRef]] as const;}
