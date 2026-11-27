import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {inspectReportedCommands} from './reported-command-output.ts';
import {readResultArtifactText,readResultArtifactDownload} from './result-artifact-api.ts';

export interface CommandEvidenceSelection{commandIndex:number;evidenceIndex:number}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
function invalid():never{throw new ApiError('COMMAND_EVIDENCE_FILE_BINDING_INVALID');}
async function hash(value:unknown){const bytes=new TextEncoder().encode(ordered(value));return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
/** 같은 명령 선언과 manifest의 exact 교집합만 반환한다. 출처·실행 권위가 아니다. */
async function binding(original:SubmittedResultView,selection:CommandEvidenceSelection,current:()=>boolean){
 if(!current())return null;
 const r=structuredClone(original),pick=structuredClone(selection),s=r?.snapshot?.scope,m=r?.snapshot?.manifest;
 if(!pick||Object.keys(pick).sort().join(',')!=='commandIndex,evidenceIndex'||!Number.isSafeInteger(pick.commandIndex)||pick.commandIndex<0||!Number.isSafeInteger(pick.evidenceIndex)||pick.evidenceIndex<0
  ||!s||!m||new TextEncoder().encode(ordered(r)).length>2*1024*1024||await hash(r.snapshot)!==r.ref.contentHash||await hash(m)!==r.snapshot.manifestHash
  ||!same(m.executionRef,s.executionRef)||!same(m.assignmentRef,s.assignmentRef)||!Array.isArray(m.artifactRefs)||m.artifactRefs.length>200)invalid();
 if(!current())return null;
 const commands=inspectReportedCommands(m.commandResults),command=commands.rows.find(row=>row.index===pick.commandIndex)?.value;
 if(commands.listInvalid||!command) return invalid();
 const e=command.evidence[pick.evidenceIndex];if(!e)return invalid();
 const issues:string[]=[];
 if(!same(command.executionRef,s.executionRef))issues.push('COMMAND_EXECUTION_MISMATCH');
 if(e.contentHash!==e.ref.contentHash)issues.push('DECLARED_EVIDENCE_HASH_MISMATCH');
 const matches=m.artifactRefs.filter(v=>v?.id===e.ref.id);
 if(!matches.length)issues.push('FILE_NOT_DECLARED_IN_RESULT');
 else if(matches.length!==1)issues.push('AMBIGUOUS_FILE_ID');
 else if(!same(matches[0],e.ref))issues.push('DECLARED_FILE_REF_MISMATCH');
 else if(e.ref.version!==1)issues.push('FILE_VERSION_UNSUPPORTED');
 const base={purpose:'REPORTED_COMMAND_EVIDENCE_COMPARISON_ONLY' as const,projectId:s.projectId,resultRef:r.ref,executionRef:s.executionRef,
  selection:pick,reported:structuredClone(e),issues,evidenceProvenanceVerified:false as const,commandExecutionVerified:false as const,
  commandExitVerified:false as const,completionAccepted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 return current()?{result:r,base}:null;
}
/** 기존 텍스트 동선. 개별 근거의 보관 바이트 일치는 실제 수행/exit를 검증하지 않는다. */
export async function readReportedCommandEvidence(client:ApiClient,original:SubmittedResultView,selection:CommandEvidenceSelection,active:()=>boolean){
 const transport=client.transport,current=()=>active()&&client.transport===transport,bound=await binding(original,selection,current);if(!bound||!current())return null;
 const {result,base}=bound;if(base.issues.length)return{...base,bytesState:'NOT_QUERIED_BINDING_MISMATCH' as const,file:null};
 const file=await readResultArtifactText(client,result,base.reported.ref,current);
 return current()&&file?{...base,bytesState:'MATCHED_REGISTERED_BYTES' as const,file}:null;
}
/** 기존 보호 다운로드 reader로만 길이/SHA를 대조하며 raw bytes·파일명·텍스트는 반환하지 않는다. */
export async function readReportedCommandEvidenceBytes(client:ApiClient,original:SubmittedResultView,selection:CommandEvidenceSelection,active:()=>boolean,signal?:AbortSignal){
 const transport=client.transport,current=()=>!signal?.aborted&&active()&&client.transport===transport,bound=await binding(original,selection,current);if(!bound||!current())return null;
 const {result,base}=bound;if(base.issues.length)return{...base,bytesState:'NOT_QUERIED_BINDING_MISMATCH' as const,file:null};
 const file=await readResultArtifactDownload(client,result,base.reported.ref,current,signal);if(!file)return null;
 try{return current()?{...base,bytesState:'MATCHED_REGISTERED_BYTES' as const,file:{artifactRef:file.artifactRef,bytes:file.bytes.byteLength,sha256:file.artifactRef.contentHash}}:null;}
 finally{file.bytes.fill(0);}
}
export type CommandEvidenceView=NonNullable<Awaited<ReturnType<typeof readReportedCommandEvidence>>>;
export type CommandEvidenceBytesView=NonNullable<Awaited<ReturnType<typeof readReportedCommandEvidenceBytes>>>;
