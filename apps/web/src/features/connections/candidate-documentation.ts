import {ApiError} from '../../api/client.ts';
import {capabilityNames} from './api.ts';
export type CapabilityCode=keyof typeof capabilityNames;
export interface CandidateDocumentation{code:CapabilityCode;source:string;observedAt:string;versionCompatibility:'CONFIRMED'|'UNVERIFIED'|'UNSUPPORTED'}
const fields=['source','observedAt','versionCompatibility'];
const invalid=():never=>{throw new ApiError('CANDIDATE_DOCUMENTATION_EDIT_INVALID');};
/** 미저장 사용자 보고만 편집한다. URL 조회·실측·현재 권한 확인을 수행하지 않는다. */
export function changeCandidateDocumentation(candidate:Record<string,unknown>&{label:string},code:CapabilityCode,patch:Partial<Omit<CandidateDocumentation,'code'>>|null){
 if(!Object.hasOwn(capabilityNames,code))return invalid();
 const docs=Object.hasOwn(candidate,'documentation')?candidate.documentation:[];
 if(!Array.isArray(docs)||docs.length>6||new Set(docs.map(d=>d?.code)).size!==docs.length||docs.some(d=>!d||Object.keys(d).sort().join(',')!=='code,observedAt,source,versionCompatibility'||!Object.hasOwn(capabilityNames,d.code)||typeof d.source!=='string'||typeof d.observedAt!=='string'||!['CONFIRMED','UNVERIFIED','UNSUPPORTED'].includes(d.versionCompatibility)))return invalid();
 if(patch!==null&&(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!fields.includes(k))||Object.values(patch).some(v=>typeof v!=='string'||!v.isWellFormed())||patch.source!==undefined&&patch.source.length>2048||patch.observedAt!==undefined&&patch.observedAt.length>24||patch.versionCompatibility!==undefined&&!['CONFIRMED','UNVERIFIED','UNSUPPORTED'].includes(patch.versionCompatibility)))return invalid();
 const next=structuredClone(candidate),entries=structuredClone(docs) as CandidateDocumentation[],index=entries.findIndex(d=>d.code===code);
 if(patch===null){if(index>=0)entries.splice(index,1);}
 else {const value:CandidateDocumentation={...(index>=0?entries[index]!:{code,source:'',observedAt:'',versionCompatibility:'UNVERIFIED'}),...patch};if(index>=0)entries[index]=value;else entries.push(value);}
 next.documentation=entries;return next;
}
