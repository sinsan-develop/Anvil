import {AuthFailure} from '../access/repository.ts';
import {exact,assertKnowledgeTextSafe} from './knowledge-entry.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
export interface KnowledgeShareTarget {kind:'PROJECT';projectId:string}
export interface KnowledgeShareRequestInput {versionRefs:VersionRef[];explicitTargets:KnowledgeShareTarget[];purpose:string}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function readKnowledgeShareRequestInput(value:unknown,projectId:string):KnowledgeShareRequestInput {
 if(!uuid.test(projectId)||!exact(value,['versionRefs','explicitTargets','purpose'])||!Array.isArray(value.versionRefs)||!value.versionRefs.length||value.versionRefs.length>200||!Array.isArray(value.explicitTargets)||!value.explicitTargets.length||value.explicitTargets.length>200||typeof value.purpose!=='string'||!value.purpose.trim()||value.purpose.length>20000||!value.purpose.isWellFormed())throw new AuthFailure('KNOWLEDGE_SHARE_INPUT_INVALID',422);
 if(value.versionRefs.some(v=>!isVersionRef(v))||new Set(value.versionRefs.map(v=>canonicalJson(v))).size!==value.versionRefs.length||new Set(value.versionRefs.map(v=>v.id)).size!==value.versionRefs.length)throw new AuthFailure('KNOWLEDGE_SHARE_INPUT_INVALID',422);
 if(value.explicitTargets.some(t=>!exact(t,['kind','projectId'])||t.kind!=='PROJECT'||typeof t.projectId!=='string'||!uuid.test(t.projectId)||t.projectId===projectId)||new Set(value.explicitTargets.map(t=>t.projectId)).size!==value.explicitTargets.length)throw new AuthFailure('KNOWLEDGE_SHARE_TARGET_UNAVAILABLE',422);
 assertKnowledgeTextSafe(value.purpose);
 if(Buffer.byteLength(canonicalJson(value),'utf8')>2*1024*1024)throw new AuthFailure('KNOWLEDGE_SHARE_INPUT_INVALID',422);
 return structuredClone(value) as unknown as KnowledgeShareRequestInput;
}