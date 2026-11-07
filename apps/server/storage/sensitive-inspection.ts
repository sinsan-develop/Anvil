import{AuthFailure}from'../modules/access/repository.ts';import{canonicalJson}from'../../../contracts/canonical.ts';
// 바이트에 그대로 보이는 알려진 표식만 검사한다. 압축 해제·OCR·복호화나 완전한 비밀 탐지가 아니다.
export function inspectArtifact(bytes:Uint8Array){const text=Buffer.from(bytes).toString('utf8'),reasonCodes:string[]=[];
 if(/-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/i.test(text))reasonCodes.push('PRIVATE_KEY_MARKER');
 if(/\bBearer\s+[A-Za-z0-9_.~+\/-]{16,}/i.test(text))reasonCodes.push('BEARER_TOKEN_MARKER');
 if(/\b(?:password|passwd|api[_-]?key|access[_-]?token|token|secret)\s*[:=]\s*["']?[^\s"']{4,}/i.test(text))reasonCodes.push('SECRET_ASSIGNMENT_MARKER');
 return{policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:reasonCodes.length?'SUSPECTED':'NO_KNOWN_MARKER',reasonCodes};
}
export function assertStoredArtifactReadable(row:{state:string;inspection_json:unknown},bytes:Uint8Array){
 if(row.state==='QUARANTINED')throw new AuthFailure('ARTIFACT_QUARANTINED',412);
 if(row.state!=='READY')throw new AuthFailure('ARTIFACT_NOT_READY',422);const inspected=inspectArtifact(bytes);
 if(row.inspection_json!=null){try{if(canonicalJson(row.inspection_json)!==canonicalJson(inspected))throw Error();}catch{throw new AuthFailure('ARTIFACT_INSPECTION_INTEGRITY_FAILED',503);}}
 if(inspected.state==='SUSPECTED')throw new AuthFailure('ARTIFACT_SENSITIVE_CONTENT_SUSPECTED',412);
}
