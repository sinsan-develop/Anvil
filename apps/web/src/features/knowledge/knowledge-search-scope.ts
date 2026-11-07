import {ApiError} from '../../api/client.ts';
import {ordered} from './review-view.ts';
import {validKnowledgeScope} from './knowledge-scope.ts';
import type {KnowledgeStageRef,KnowledgeTaskRef} from '../../../../server/modules/knowledge/knowledge-entry.ts';
export interface KnowledgeSearchScope{stageRef:KnowledgeStageRef|null;taskRef:KnowledgeTaskRef|null;includeProjectWide:boolean}
export function knowledgeSearchScopeWire(value:unknown):string{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='includeProjectWide,stageRef,taskRef')throw new ApiError('KNOWLEDGE_SEARCH_SCOPE_INVALID');
 const scope=value as KnowledgeSearchScope,pid='00000000-0000-4000-8000-000000000000';
 if(typeof scope.includeProjectWide!=='boolean'||scope.stageRef===null&&scope.taskRef===null||!validKnowledgeScope({projectId:pid,stageRefs:scope.stageRef===null?[]:[scope.stageRef],taskRefs:scope.taskRef===null?[]:[scope.taskRef]},pid,'FACT'))throw new ApiError('KNOWLEDGE_SEARCH_SCOPE_INVALID');
 const wire=ordered(scope);if(wire.length>2048)throw new ApiError('KNOWLEDGE_SEARCH_SCOPE_INVALID');return wire;
}
