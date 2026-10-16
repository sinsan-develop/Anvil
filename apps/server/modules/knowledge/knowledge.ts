import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from '../documents/project-documents.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {readKnowledgeEntry,exact,assertKnowledgeTextSafe,type KnowledgeEntry} from './knowledge-entry.ts';

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
      }else{
        const row=(await db.query("SELECT bytes,media_type,content_hash FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND state='READY'",[pid,r.id])).rows[0];
        if(!row)throw new AuthFailure('NOT_FOUND',404);if(row.content_hash!==r.contentHash)throw new AuthFailure('KNOWLEDGE_SOURCE_MISMATCH',409);
        // 이 초기 경로는 실제 UTF-8 원문을 검증할 수 있는 출처만 수용한다.
        assertKnowledgeTextSafe(await this.#documents.originalText(db,pid,{artifactId:r.id,bytes:Number(row.bytes),contentHash:row.content_hash,mediaType:row.media_type}));
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
    const row=(await db.query('SELECT v.*,k.kind FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries k ON k.project_id=v.project_id AND k.id=v.entry_id WHERE v.project_id=$1 AND v.entry_id=$2 AND v.version=$3',[pid,id,version])).rows[0];
    if(!row)throw new AuthFailure('NOT_FOUND',404);
    const entry=readKnowledgeEntry(row.entry_json,pid);
    if(contentHash(canonicalJson(entry))!==row.content_hash||entry.kind!==row.kind||entry.title!==row.title||entry.reason!==row.reason||entry.contentRef.artifactId!==row.content_artifact_id||canonicalJson(entry.sourceRefs)!==canonicalJson(row.source_refs)||canonicalJson(entry.scope)!==canonicalJson(row.scope_json)||canonicalJson(entry.relatedRefs)!==canonicalJson(row.related_refs))throw new AuthFailure('KNOWLEDGE_INTEGRITY_FAILED',503);
    const events=(await db.query('SELECT id,kind,reason,actor_ref,recorded_at FROM anvil.knowledge_events WHERE project_id=$1 AND entry_id=$2 AND version=$3 ORDER BY recorded_at,id',[pid,id,version])).rows;
    if(events.length!==1||events[0].kind!=='PROPOSED')throw new AuthFailure('KNOWLEDGE_EVENT_INTEGRITY_FAILED',503);
    const body=await this.#verify(db,actor,pid,entry);
    return{ref:{id,version,contentHash:row.content_hash},entry,body,state:'PROPOSED',appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',history:events.map(e=>({id:e.id,kind:e.kind,reason:e.reason,actorRef:e.actor_ref,recordedAt:e.recorded_at.toISOString()})),agentDelivery:'NOT_CONNECTED'};
  }
  async search(db:PoolClient,actor:AuthenticatedIdentity,pid:string,q:Record<string,unknown>,codec:ProjectListCodec){
    await projectMember(db,actor,pid);
    if(Object.keys(q).some(k=>!['query','kind','status','limit','cursor'].includes(k))||q.query!==undefined&&(typeof q.query!=='string'||q.query.length>200||!q.query.isWellFormed())||q.kind!==undefined&&!['PURPOSE','CONSTITUTION','DECISION','FACT','HYPOTHESIS','FAILURE_SOLUTION','CAUTION'].includes(String(q.kind))||q.status!==undefined&&q.status!=='PROPOSED'||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(q.limit)||Number(q.limit)>200)||q.cursor!==undefined&&(typeof q.cursor!=='string'||q.cursor.length>4096))throw new AuthFailure('INPUT_INVALID',400);
    const query=String(q.query??''),limit=q.limit===undefined?50:Number(q.limit),filter={query:canonicalJson({projectId:pid,query,kind:q.kind??null,status:q.status??'PROPOSED'}),archived:false,limit};
    let pos:{at:string;id:string}|null=null;if(q.cursor!==undefined){try{pos=codec.read(String(q.cursor),actor.actorId,filter);}catch{throw new AuthFailure('CURSOR_INVALID',400);}}
    const rows=(await db.query("SELECT k.id,k.head_version,to_char(k.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') cursor_at FROM anvil.knowledge_entries k JOIN anvil.knowledge_versions v ON v.project_id=k.project_id AND v.entry_id=k.id AND v.version=k.head_version WHERE k.project_id=$1 AND ($2::text IS NULL OR k.kind=$2) AND (strpos(lower(v.title),lower($3))>0 OR strpos(lower(v.reason),lower($3))>0) AND ($4::timestamptz IS NULL OR (k.created_at,k.id)<($4::timestamptz,$5::uuid)) ORDER BY k.created_at DESC,k.id DESC LIMIT $6",[pid,q.kind??null,query,pos?.at??null,pos?.id??null,limit+1])).rows;
    const items=[];for(const row of rows.slice(0,limit)){const view=await this.read(db,actor,pid,row.id,Number(row.head_version));items.push({versionRef:view.ref,title:view.entry.title,kind:view.entry.kind,sourceRefs:view.entry.sourceRefs,reasonSnippet:view.entry.reason.slice(0,200),state:view.state});}
    const hasMore=rows.length>limit,last=rows.slice(0,limit).at(-1);
    return{items,hasMore,nextCursor:hasMore?codec.create(actor.actorId,filter,{at:last!.cursor_at,id:last!.id}):null,searchScope:'TITLE_REASON',observedAt:new Date().toISOString()};
  }
}
