import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {readKnowledgeEntry,exact,assertKnowledgeTextSafe,type KnowledgeEntry} from './knowledge-entry.ts';
import{ProjectConversations}from'./conversations.ts';
import{knowledgeState,assertKnowledgeHistory}from'./knowledge-state.ts';
import{isVersionRef}from'../../../../contracts/references.ts';

export class ProjectKnowledge{
  #documents:ProjectDocuments;
  constructor(documents:ProjectDocuments){this.#documents=documents;}
  async #verify(db:PoolClient,actor:AuthenticatedIdentity,pid:string,entry:KnowledgeEntry){
    const body=await this.#documents.originalText(db,pid,entry.contentRef);
    assertKnowledgeTextSafe(entry.title);assertKnowledgeTextSafe(entry.reason);assertKnowledgeTextSafe(body);
    for(const r of entry.sourceRefs){
      if(r.kind==='DOCUMENT_VERSION'){
        const doc=await this.#documents.version(db,actor,pid,r.id,r.version);if(doc.contentHash!==r.contentHash)throw new AuthFailure('KNOWLEDGE_SOURCE_MISMATCH',409);
        assertKnowledgeTextSafe(await this.#documents.originalText(db,pid,doc.content.body));
      }else if(r.kind==='ARTIFACT'){
        const row=(await db.query("SELECT bytes,media_type,content_hash FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND state='READY'",[pid,r.id])).rows[0];
        if(!row)throw new AuthFailure('NOT_FOUND',404);if(row.content_hash!==r.contentHash)throw new AuthFailure('KNOWLEDGE_SOURCE_MISMATCH',409);
        // 이 초기 경로는 실제 UTF-8 원문을 검증할 수 있는 출처만 수용한다.
        assertKnowledgeTextSafe(await this.#documents.originalText(db,pid,{artifactId:r.id,bytes:Number(row.bytes),contentHash:row.content_hash,mediaType:row.media_type}));
      }else{
        const row=(await db.query('SELECT conversation_id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2',[pid,r.id])).rows[0];if(!row)throw new AuthFailure('NOT_FOUND',404);
        const message=await new ProjectConversations(this.#documents).readMessage(db,actor,pid,row.conversation_id,r.id);
        if(message.sourceRef.contentHash!==r.contentHash)throw new AuthFailure('KNOWLEDGE_SOURCE_MISMATCH',409);
        if(r.kind==='USER_INSTRUCTION'&&message.message.kind!=='USER_INSTRUCTION')throw new AuthFailure('KNOWLEDGE_SOURCE_KIND_MISMATCH',422);
      }
    }
    return body;
  }
  async save(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef){
    if(request.targetId!==null||request.expectedVersion!==0||!exact(request.payload,['entry']))throw new AuthFailure('KNOWLEDGE_INPUT_INVALID',422);
    const entry=readKnowledgeEntry(request.payload.entry,request.projectId);await this.#verify(db,actor,request.projectId,entry);
    const id=randomUUID(),ref={id,version:1,contentHash:contentHash(canonicalJson(entry))};
    const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'PROPOSED',entry},policyRef,'EXPLICIT_KNOWLEDGE_PROPOSAL');
    await db.query('INSERT INTO anvil.knowledge_entries(id,project_id,kind,head_version,created_by,client_id,command_id) VALUES($1,$2,$3,1,$4,$5,$6)',[id,request.projectId,entry.kind,actor.actorId,actor.clientId,receipt.id]);
    await db.query('INSERT INTO anvil.knowledge_versions(project_id,entry_id,version,title,content_artifact_id,content_hash,source_refs,reason,scope_json,related_refs,entry_json,created_by,client_id,command_id) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[request.projectId,id,entry.title,entry.contentRef.artifactId,ref.contentHash,JSON.stringify(entry.sourceRefs),entry.reason,JSON.stringify(entry.scope),JSON.stringify(entry.relatedRefs),JSON.stringify(entry),actor.actorId,actor.clientId,receipt.id]);
    await db.query("INSERT INTO anvil.knowledge_events(id,project_id,entry_id,version,kind,reason,actor_ref,client_id,command_id) VALUES($1,$2,$3,1,'PROPOSED',$4,$5,$6,$7)",[randomUUID(),request.projectId,id,entry.reason,JSON.stringify({kind:'HUMAN',userId:actor.actorId}),actor.clientId,receipt.id]);
    return receipt.result;
  }
  async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,version:number){
    await projectMember(db,actor,pid);
    const row=(await db.query('SELECT v.*,k.kind,k.head_version FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries k ON k.project_id=v.project_id AND k.id=v.entry_id WHERE v.project_id=$1 AND v.entry_id=$2 AND v.version=$3',[pid,id,version])).rows[0];
    if(!row)throw new AuthFailure('NOT_FOUND',404);
    const entry=readKnowledgeEntry(row.entry_json,pid);
    if(contentHash(canonicalJson(entry))!==row.content_hash||entry.kind!==row.kind||entry.title!==row.title||entry.reason!==row.reason||entry.contentRef.artifactId!==row.content_artifact_id||canonicalJson(entry.sourceRefs)!==canonicalJson(row.source_refs)||canonicalJson(entry.scope)!==canonicalJson(row.scope_json)||canonicalJson(entry.relatedRefs)!==canonicalJson(row.related_refs))throw new AuthFailure('KNOWLEDGE_INTEGRITY_FAILED',503);
    const events=(await db.query("SELECT e.id,e.kind,e.reason,e.actor_ref,e.recorded_at,e.base_ref,e.change_sources,c.actor_id command_actor_id,c.operation command_operation,c.result_ref command_result FROM anvil.knowledge_events e JOIN anvil.commands c ON c.id=e.command_id AND c.project_id=e.project_id WHERE e.project_id=$1 AND e.entry_id=$2 AND e.version=$3 ORDER BY CASE WHEN e.kind IN ('PROPOSED','CORRECTED') THEN 0 ELSE 1 END,e.recorded_at,e.id",[pid,id,version])).rows;
    const state=knowledgeState(version,Number(row.head_version),events.map(e=>e.kind));
    assertKnowledgeHistory(events,{id,version,contentHash:row.content_hash},entry);for(const e of events)assertKnowledgeTextSafe(e.reason);
    let supersedesRef:VersionRef|null=null;
    if(version>1){const previous=(await db.query('SELECT content_hash FROM anvil.knowledge_versions WHERE project_id=$1 AND entry_id=$2 AND version=$3',[pid,id,version-1])).rows[0];if(Number(row.supersedes_version)!==version-1||!previous)throw new AuthFailure('KNOWLEDGE_INTEGRITY_FAILED',503);supersedesRef={id,version:version-1,contentHash:previous.content_hash};if(canonicalJson(events[0].base_ref)!==canonicalJson(supersedesRef))throw new AuthFailure('KNOWLEDGE_EVENT_INTEGRITY_FAILED',503);}
    const body=await this.#verify(db,actor,pid,entry);
    if(version>1)await this.#verify(db,actor,pid,readKnowledgeEntry({...entry,sourceRefs:events[0].change_sources},pid));
    return{ref:{id,version,contentHash:row.content_hash},entry,body,state,headVersion:Number(row.head_version),supersedesRef,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',history:events.map(e=>({id:e.id,kind:e.kind,reason:e.reason,actorRef:e.actor_ref,baseRef:e.base_ref,sourceRefs:e.change_sources,recordedAt:e.recorded_at.toISOString()})),agentDelivery:'NOT_CONNECTED'};
  }
  async correct(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
    const p=c.payload;if(!exact(p,['baseRef','entry','reason','sourceRefs'])||!isVersionRef(p.baseRef)||c.targetId!==p.baseRef.id||c.expectedVersion!==p.baseRef.version||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000)throw new AuthFailure('KNOWLEDGE_INPUT_INVALID',422);
    const head=(await db.query('SELECT head_version,kind FROM anvil.knowledge_entries WHERE project_id=$1 AND id=$2 FOR UPDATE',[c.projectId,c.targetId])).rows[0];if(!head)throw new AuthFailure('NOT_FOUND',404);if(Number(head.head_version)!==c.expectedVersion||!Number.isSafeInteger(c.expectedVersion+1))throw new AuthFailure('VERSION_CONFLICT',409);
    const old=await this.read(db,actor,c.projectId,p.baseRef.id,p.baseRef.version);if(old.ref.contentHash!==p.baseRef.contentHash)throw new AuthFailure('VERSION_CONFLICT',409);if(old.state==='EXCLUDED')throw new AuthFailure('KNOWLEDGE_EXCLUDED',412);
    const entry=readKnowledgeEntry(p.entry,c.projectId);if(entry.kind!==head.kind)throw new AuthFailure('KNOWLEDGE_KIND_CHANGE_NOT_READY',412);
    const sources=readKnowledgeEntry({...entry,sourceRefs:p.sourceRefs},c.projectId).sourceRefs;await this.#verify(db,actor,c.projectId,entry);await this.#verify(db,actor,c.projectId,{...entry,sourceRefs:sources});assertKnowledgeTextSafe(p.reason);
    const ref={id:p.baseRef.id,version:p.baseRef.version+1,contentHash:contentHash(canonicalJson(entry))},eventId=randomUUID();
    const receipt=await persistProjectReceipt(db,actor,c,ref,{status:'PROPOSED',entry,baseRef:p.baseRef,supersedesRef:p.baseRef,reason:p.reason,changeSources:sources,eventId},policyRef,'EXPLICIT_KNOWLEDGE_CORRECTION');
    await db.query('UPDATE anvil.knowledge_entries SET head_version=$3 WHERE project_id=$1 AND id=$2',[c.projectId,ref.id,ref.version]);
    await db.query('INSERT INTO anvil.knowledge_versions(project_id,entry_id,version,title,content_artifact_id,content_hash,source_refs,reason,scope_json,related_refs,entry_json,supersedes_version,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[c.projectId,ref.id,ref.version,entry.title,entry.contentRef.artifactId,ref.contentHash,JSON.stringify(entry.sourceRefs),entry.reason,JSON.stringify(entry.scope),JSON.stringify(entry.relatedRefs),JSON.stringify(entry),p.baseRef.version,actor.actorId,actor.clientId,receipt.id]);
    await db.query("INSERT INTO anvil.knowledge_events(id,project_id,entry_id,version,kind,reason,actor_ref,client_id,command_id,base_ref,change_sources) VALUES($1,$2,$3,$4,'CORRECTED',$5,$6,$7,$8,$9,$10)",[eventId,c.projectId,ref.id,ref.version,p.reason,JSON.stringify({kind:'HUMAN',userId:actor.actorId}),actor.clientId,receipt.id,JSON.stringify(p.baseRef),JSON.stringify(sources)]);
    return receipt.result;
  }
  async exclude(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
    const p=c.payload;if(!exact(p,['versionRef','reason'])||!isVersionRef(p.versionRef)||c.targetId!==p.versionRef.id||c.expectedVersion!==p.versionRef.version||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>20000)throw new AuthFailure('KNOWLEDGE_INPUT_INVALID',422);
    const view=await this.read(db,actor,c.projectId,p.versionRef.id,p.versionRef.version);if(canonicalJson(view.ref)!==canonicalJson(p.versionRef))throw new AuthFailure('VERSION_CONFLICT',409);if(view.state==='EXCLUDED')throw new AuthFailure('KNOWLEDGE_ALREADY_EXCLUDED',409);assertKnowledgeTextSafe(p.reason);
    const eventId=randomUUID(),receipt=await persistProjectReceipt(db,actor,c,p.versionRef,{status:'EXCLUDED',reason:p.reason,eventId},policyRef,'EXPLICIT_KNOWLEDGE_EXCLUSION');
    await db.query("INSERT INTO anvil.knowledge_events(id,project_id,entry_id,version,kind,reason,actor_ref,client_id,command_id) VALUES($1,$2,$3,$4,'EXCLUDED',$5,$6,$7,$8)",[eventId,c.projectId,p.versionRef.id,p.versionRef.version,p.reason,JSON.stringify({kind:'HUMAN',userId:actor.actorId}),actor.clientId,receipt.id]);
    return receipt.result;
  }
  async search(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){
    await projectMember(db,actor,pid);
    if(Object.keys(q).some(k=>!['query','kind','status','limit','cursor'].includes(k))||q.query!==undefined&&(typeof q.query!=='string'||q.query.length>200||!q.query.isWellFormed())||q.kind!==undefined&&!['PURPOSE','CONSTITUTION','DECISION','FACT','HYPOTHESIS','FAILURE_SOLUTION','CAUTION'].includes(String(q.kind))||q.status!==undefined&&(typeof q.status!=='string'||!['PROPOSED','EXCLUDED'].includes(q.status))||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(q.limit)||Number(q.limit)>200)||q.cursor!==undefined&&(typeof q.cursor!=='string'||q.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
    const query=String(q.query??''),limit=q.limit===undefined?50:Number(q.limit),filter={query:canonicalJson({projectId:pid,query,kind:q.kind??null,status:q.status??'PROPOSED'}),archived:false,limit};
    let pos:{at:string;id:string}|null=null;if(q.cursor!==undefined){try{pos=codec.read(String(q.cursor),actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
    const rows=(await db.query("SELECT k.id,k.head_version,to_char(k.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.knowledge_entries k JOIN anvil.knowledge_versions v ON v.project_id=k.project_id AND v.entry_id=k.id AND v.version=k.head_version WHERE k.project_id=$1 AND ($2::text IS NULL OR k.kind=$2) AND (strpos(lower(v.title),lower($3))>0 OR strpos(lower(v.reason),lower($3))>0) AND ($4::timestamptz IS NULL OR (k.created_at,k.id)<($4::timestamptz,$5::uuid)) AND EXISTS(SELECT 1 FROM anvil.knowledge_events e WHERE e.project_id=k.project_id AND e.entry_id=k.id AND e.version=k.head_version AND e.kind='EXCLUDED')=$7::boolean ORDER BY k.created_at DESC,k.id DESC LIMIT $6",[pid,q.kind??null,query,pos?.at??null,pos?.id??null,limit+1,q.status==='EXCLUDED'])).rows;
    const items=[];for(const row of rows.slice(0,limit)){const view=await this.read(db,actor,pid,row.id,Number(row.head_version));items.push({versionRef:view.ref,title:view.entry.title,kind:view.entry.kind,sourceRefs:view.entry.sourceRefs,reasonSnippet:view.entry.reason.slice(0,200),state:view.state});}
    const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);
    return{items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,searchScope:'TITLE_REASON',observedAt:new Date().toISOString()};
  }
}
