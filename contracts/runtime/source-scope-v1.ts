import {arrayV1,recordV1,refV1,cloneV1,type RuntimeRefV1} from './validation-v1.ts';
export interface SourceScopeV1{sourceRootRef:RuntimeRefV1;mappingRef:RuntimeRefV1|null;observationRef:RuntimeRefV1;baselineRef:RuntimeRefV1;targets:{relativePath:string;kind:'FILE';access:'READ'|'WRITE';recursive:false}[]}
function relativeFile(v:unknown):v is string{
 if(typeof v!=='string'||!v.isWellFormed()||v!==v.normalize('NFC')||!v.length||Buffer.byteLength(v,'utf8')>1024||/[\x00-\x1f\x7f\\:%?*"<>|]/.test(v))return false;
 return v.split('/').every(s=>!!s&&s.length<=255&&s!=='.'&&s!=='..'&&!/[. ]$/.test(s)&&!/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(s));
}
// 관측은 같은 경로 문법만 공유하며 READ/WRITE scope나 실행 권한으로 변환하지 않는다.
export {relativeFile as isRelativeSourceFileV1};
/** 문법/동일 범위 검사뿐이다. 실경로·link/OS 권한·현재 root 관측은 별도 미연결이다. */
export function readSourceScopesV1(value:unknown):SourceScopeV1[]{
 const fail=():never=>{throw Error('SOURCE_SCOPE_INVALID');};
 if(!arrayV1(value,200)||!value.length)return fail();const roots=new Set<string>();let total=0;
 for(const s of value){
  if(!recordV1(s,['sourceRootRef','mappingRef','observationRef','baselineRef','targets'])||!refV1(s.sourceRootRef)||s.mappingRef!==null&&!refV1(s.mappingRef)||!refV1(s.observationRef)||!refV1(s.baselineRef)||!arrayV1(s.targets,200)||!s.targets.length||roots.has(s.sourceRootRef.id))return fail();roots.add(s.sourceRootRef.id);
  const paths=new Set<string>();for(const t of s.targets){if(++total>200||!recordV1(t,['relativePath','kind','access','recursive'])||!relativeFile(t.relativePath)||t.kind!=='FILE'||!['READ','WRITE'].includes(t.access)||t.recursive!==false||paths.has(t.relativePath.toUpperCase()))return fail();paths.add(t.relativePath.toUpperCase());}
 }
 return cloneV1(value) as SourceScopeV1[];
}
