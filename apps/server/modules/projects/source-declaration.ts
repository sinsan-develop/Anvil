import{AuthFailure}from'../access/repository.ts';
import{inspectArtifact}from'../../storage/sensitive-inspection.ts';
export interface SourceDeclaration{hostLabel:string;displayName:string;pathHint:string;reason:string}
// 경로 해석·파일 조회·관측 권한과 무관한 사용자 선언 입력이다.
export function readSourceDeclaration(value:unknown):SourceDeclaration{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='displayName,hostLabel,pathHint,reason')throw new AuthFailure('SOURCE_DECLARATION_INPUT_INVALID',422);
 const v=value as Record<string,unknown>;
 for(const[key,limit]of[['hostLabel',200],['displayName',200],['pathHint',4096],['reason',20000]]as const){const s=v[key];if(typeof s!=='string'||!s.trim()||s.length>limit||!s.isWellFormed()||key!=='reason'&&/[\u0000-\u001f\u007f]/.test(s))throw new AuthFailure('SOURCE_DECLARATION_INPUT_INVALID',422);}
 if(inspectArtifact(Buffer.from(Object.values(v).join('\n'),'utf8')).state==='SUSPECTED')throw new AuthFailure('SOURCE_DECLARATION_SENSITIVE_CONTENT_SUSPECTED',412);
 return structuredClone(value)as SourceDeclaration;
}
