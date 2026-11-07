import {ApiError} from '../../api/client.ts';
import type {CheckpointState} from '../../../../server/modules/checkpoints/checkpoint-input.ts';
import type {ConfirmedAssignmentView} from '../workspace/assignment-confirmation-api.ts';
import type {CheckpointReferenceForm} from './checkpoint-observation-input.ts';
type Ref=CheckpointState['executionRefs'][number];
export interface CheckpointFileForm{target:string;kind:'ADDED'|'MODIFIED'|'DELETED';beforeHash:string;afterHash:string;diffRef:CheckpointReferenceForm}
export interface CheckpointEvidenceForm{sourceSnapshotRefs:CheckpointReferenceForm[];changedFiles:CheckpointFileForm[];verificationRefs:CheckpointReferenceForm[];errors:{fingerprint:string;count:string}[];untransmittedRefs:CheckpointReferenceForm[];recordFileRef:CheckpointReferenceForm}
export const emptyEvidenceReference=():CheckpointReferenceForm=>({id:'',version:'',contentHash:''});
export const emptyCheckpointEvidence=():CheckpointEvidenceForm=>({sourceSnapshotRefs:[],changedFiles:[],verificationRefs:[],errors:[],untransmittedRefs:[],recordFileRef:emptyEvidenceReference()});
const exact=(v:any,k:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(','),hash=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v),uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function fail():never{throw new ApiError('CHECKPOINT_EVIDENCE_INPUT_INVALID');}
function count(v:unknown){if(typeof v!=='string'||!/^(0|[1-9][0-9]*)$/.test(v)||!Number.isSafeInteger(Number(v)))fail();return Number(v);}
function reference(v:any):Ref{if(!exact(v,['id','version','contentHash'])||!uuid(v.id)||!hash(v.contentHash))fail();const version=count(v.version);if(version<1)fail();return{id:v.id,version,contentHash:v.contentHash};}
function optional(v:any){if(!exact(v,['id','version','contentHash']))fail();return v.id===''&&v.version===''&&v.contentHash===''?null:reference(v);}
function refs(v:any):Ref[]{if(!Array.isArray(v)||v.length>200)fail();const out=v.map(reference);if(new Set(out.map(r=>r.id+':'+r.version)).size!==out.length)fail();return out;}
function relative(v:unknown):v is string{if(typeof v!=='string'||!v.isWellFormed()||v!==v.normalize('NFC')||new TextEncoder().encode(v).length>1024||/[\x00-\x1f\x7f\\:%?*"<>|]/.test(v))return false;return v.split('/').every(s=>!!s&&s.length<=255&&s!=='.'&&s!=='..'&&!/[. ]$/.test(s)&&!/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(s));}
type Evidence=Pick<CheckpointState,'sourceSnapshotRefs'|'changedFiles'|'verificationRefs'|'errorFingerprints'|'attemptCounts'|'untransmittedRefs'|'recordFileRef'>;
/** 고정 임무의 허용 파일을 선언 기록에 연결할 뿐 실제 파일을 읽거나 권한을 발행하지 않는다. */
export function checkpointEvidenceInput(assignment:ConfirmedAssignmentView,raw?:CheckpointEvidenceForm):Evidence{
 const v=structuredClone(raw??emptyCheckpointEvidence()),scopes=assignment.snapshot.definition.allowedScopes;if(!exact(v,['sourceSnapshotRefs','changedFiles','verificationRefs','errors','untransmittedRefs','recordFileRef'])||!Array.isArray(v.changedFiles)||v.changedFiles.length>200||!Array.isArray(v.errors)||v.errors.length>200)fail();
 const sourceSnapshotRefs=refs(v.sourceSnapshotRefs),paths=new Set<string>(),changedFiles:Evidence['changedFiles']=v.changedFiles.map(f=>{
  if(!exact(f,['target','kind','beforeHash','afterHash','diffRef'])||typeof f.target!=='string'||! /^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(f.target))fail();const [i,j]=f.target.split(':').map(Number),s=scopes[i!],t=s?.targets[j!];if(!s||!t||t.kind!=='FILE'||t.recursive!==false||!relative(t.relativePath))fail();
  const sourceRootRef=reference({...s.sourceRootRef,version:String(s.sourceRootRef.version)}),observation=reference({...s.observationRef,version:String(s.observationRef.version)}),path=sourceRootRef.id+':'+t.relativePath.toUpperCase();if(paths.has(path))fail();paths.add(path);
  const prior=sourceSnapshotRefs.find(r=>r.id===observation.id&&r.version===observation.version);if(prior&&prior.contentHash!==observation.contentHash)fail();if(!prior)sourceSnapshotRefs.push(observation);if(sourceSnapshotRefs.length>200)fail();
  if(!['ADDED','MODIFIED','DELETED'].includes(f.kind)||!(f.kind==='ADDED'?f.beforeHash===''&&hash(f.afterHash):f.kind==='DELETED'?hash(f.beforeHash)&&f.afterHash==='':hash(f.beforeHash)&&hash(f.afterHash)))fail();
  return{sourceRootRef,relativePath:t.relativePath,kind:f.kind,beforeHash:f.beforeHash===''?null:f.beforeHash,afterHash:f.afterHash===''?null:f.afterHash,diffRef:optional(f.diffRef)};
 });
 const errorFingerprints:string[]=[],attemptCounts:Evidence['attemptCounts']=[];for(const e of v.errors){if(!exact(e,['fingerprint','count'])||!hash(e.fingerprint)||errorFingerprints.includes(e.fingerprint))fail();errorFingerprints.push(e.fingerprint);if(e.count!=='')attemptCounts.push({fingerprint:e.fingerprint,count:count(e.count)});}
 return{sourceSnapshotRefs,changedFiles,verificationRefs:refs(v.verificationRefs),errorFingerprints,attemptCounts,untransmittedRefs:refs(v.untransmittedRefs),recordFileRef:optional(v.recordFileRef)};
}
