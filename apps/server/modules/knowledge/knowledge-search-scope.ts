import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {exact,type KnowledgeStageRef,type KnowledgeTaskRef} from './knowledge-entry.ts';
export interface KnowledgeSearchScope{stageRef:KnowledgeStageRef|null;taskRef:KnowledgeTaskRef|null;includeProjectWide:boolean}
export function readKnowledgeSearchScope(raw:unknown):KnowledgeSearchScope|null{
 if(raw===undefined)return null;
 try{if(typeof raw!=='string'||raw.length>2048)throw Error();const value=JSON.parse(raw);if(canonicalJson(value)!==raw||!exact(value,['stageRef','taskRef','includeProjectWide'])||typeof value.includeProjectWide!=='boolean'||value.stageRef===null&&value.taskRef===null)throw Error();
 for(const [key,refKey,label] of [['stageRef','applicationRef','nodeId'],['taskRef','planRef','taskCode']] as const){const v=value[key];if(v!==null&&(!exact(v,[refKey,label])||!isVersionRef(v[refKey])||typeof v[label]!=='string'||!v[label].trim()||v[label].length>200||!v[label].isWellFormed()))throw Error();}
 return value as unknown as KnowledgeSearchScope;
 }catch{throw new AuthFailure('INPUT_INVALID',400);}
}
