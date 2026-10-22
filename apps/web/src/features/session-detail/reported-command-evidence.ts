import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {inspectReportedCommands} from './reported-command-output.ts';
import {readResultArtifactText} from './result-artifact-api.ts';

export interface CommandEvidenceSelection{commandIndex:number;evidenceIndex:number}
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b);
function invalid():never{throw new ApiError('COMMAND_EVIDENCE_FILE_BINDING_INVALID');}
async function hash(value:unknown){const bytes=new TextEncoder().encode(ordered(value));return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
/** Compare one command's declared evidence to registered bytes, never outputRef or OS paths.
 * Source kind/environment remain claims, not verified provenance or command execution. */
export async function readReportedCommandEvidence(client:ApiClient,original:SubmittedResultView,selection:CommandEvidenceSelection,active:()=>boolean){
 if(!active())return null;
 const r=structuredClone(original),pick=structuredClone(selection),s=r?.snapshot?.scope,m=r?.snapshot?.manifest;
 if(!pick||Object.keys(pick).sort().join(',')!=='commandIndex,evidenceIndex'||!Number.isSafeInteger(pick.commandIndex)||pick.commandIndex<0||!Number.isSafeInteger(pick.evidenceIndex)||pick.evidenceIndex<0
  ||!s||!m||new TextEncoder().encode(ordered(r)).length>2*1024*1024||await hash(r.snapshot)!==r.ref.contentHash||await hash(m)!==r.snapshot.manifestHash
  ||!same(m.executionRef,s.executionRef)||!Array.isArray(m.artifactRefs)||m.artifactRefs.length>200)invalid();
 if(!active())return null;
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
 if(issues.length)return active()?{...base,bytesState:'NOT_QUERIED_BINDING_MISMATCH' as const,file:null}:null;
 const file=await readResultArtifactText(client,r,e.ref,active);
 return active()&&file?{...base,bytesState:'MATCHED_REGISTERED_BYTES' as const,file}:null;
}
export type CommandEvidenceView=NonNullable<Awaited<ReturnType<typeof readReportedCommandEvidence>>>;
