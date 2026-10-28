import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectKnowledge} from './knowledge.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import type {KnowledgeShareTarget} from './knowledge-share-request-input.ts';
export interface KnowledgeShareTargetSnapshot extends KnowledgeShareTarget {version:number}
// READ_PROJECT는 기존 프로젝트 GET의 활성 회원 읽기 의미다. 새 역할이나 정책 권한을 만들지 않는다.
export async function shareProjectAccess(db:PoolClient,actor:AuthenticatedIdentity,pid:string,lock=false){
 return (await db.query(`SELECT p.id,p.version,p.archived_at,m.participation FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL ${lock?'FOR UPDATE OF p,m':''}`,[pid,actor.actorId])).rows[0];
}
export async function lockShareProjects(db:PoolClient,actor:AuthenticatedIdentity,source:string,targets:KnowledgeShareTarget[]){
 // source를 먼저 잠그면 서로 반대방향 요청이 교착될 수 있으므로 전체 ID를 먼저 정렬한다.
 for(const id of [...new Set([source,...targets.map(t=>t.projectId)])].sort())await shareProjectAccess(db,actor,id,true);
}
export async function currentShareTargets(db:PoolClient,actor:AuthenticatedIdentity,targets:KnowledgeShareTarget[],expected?:KnowledgeShareTargetSnapshot[]):Promise<KnowledgeShareTargetSnapshot[]>{
 const result:KnowledgeShareTargetSnapshot[]=[];
 for(const t of targets){const p=await shareProjectAccess(db,actor,t.projectId);if(!p||p.archived_at||!Number.isSafeInteger(Number(p.version))||Number(p.version)<1||expected&&!expected.some(e=>e.projectId===t.projectId&&e.version===Number(p.version)))throw new AuthFailure('KNOWLEDGE_SHARE_TARGET_UNAVAILABLE',412);result.push({...t,version:Number(p.version)});}
 return result;
}
export async function checkShareKnowledge(db:PoolClient,actor:AuthenticatedIdentity,knowledge:ProjectKnowledge,pid:string,refs:VersionRef[],lock=false){
 if(lock)for(const r of [...refs].sort((a,b)=>a.id.localeCompare(b.id))){const head=(await db.query('SELECT id,head_version,kind FROM anvil.knowledge_entries WHERE project_id=$1 AND id=$2 FOR UPDATE',[pid,r.id])).rows[0];if(!head||Number(head.head_version)!==r.version)throw new AuthFailure('KNOWLEDGE_SHARE_SOURCE_UNAVAILABLE',412);}
 const artifactIds=new Set<string>();
 const read=async(r:VersionRef)=>{const view=await knowledge.read(db,actor,pid,r.id,r.version);if(canonicalJson(view.ref)!==canonicalJson(r)||view.headVersion!==r.version||!['PROPOSED','CONFIRMED'].includes(view.state)||view.redactionState!=='NOT_REDACTED')throw Error('UNAVAILABLE');return view;};
 try{
  for(const r of refs){const view=await read(r);artifactIds.add(view.entry.contentRef.artifactId);
   for(const source of view.entry.sourceRefs){
    if(source.kind==='ARTIFACT')artifactIds.add(source.id);
    else if(source.kind==='DOCUMENT_VERSION'){const row=(await db.query('SELECT content_json FROM anvil.document_versions WHERE project_id=$1 AND document_id=$2 AND version=$3',[pid,source.id,source.version])).rows[0];const id=row?.content_json?.body?.artifactId;if(typeof id!=='string')throw Error('UNAVAILABLE');artifactIds.add(id);}
    else{const row=(await db.query('SELECT body_artifact_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2',[pid,source.id])).rows[0];if(typeof row?.body_artifact_id!=='string')throw Error('UNAVAILABLE');artifactIds.add(row.body_artifact_id);}
   }
  }
  // 기존 app 계약의 원문3표는 최초 INSERT 후 불변이다. 추가 UPDATE 권한 없이 READY와 물리 원문/hash를 다시 대조한다.
  for(const id of [...artifactIds].sort()){const a=(await db.query('SELECT id,state,content_hash FROM anvil.artifacts WHERE project_id=$1 AND id=$2',[pid,id])).rows[0];if(!a||a.state!=='READY')throw Error('UNAVAILABLE');}
  for(const r of refs)await read(r);
 }catch{throw new AuthFailure('KNOWLEDGE_SHARE_SOURCE_UNAVAILABLE',412);}
}
