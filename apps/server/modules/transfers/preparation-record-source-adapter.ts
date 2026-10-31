import type {PoolClient} from 'pg';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {ProjectAssignmentConfirmations} from '../assignments/project-assignment-confirmations.ts';
import {ProjectAssignmentDrafts} from '../assignments/project-assignment-drafts.ts';
import {ProjectContexts} from '../context/project-contexts.ts';
import {ResponsibleSessions} from '../assignments/responsible-sessions.ts';
import {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectKnowledge} from '../knowledge/knowledge.ts';
import {ProjectConversations} from '../knowledge/conversations.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {preparationFailure,preparationHash,type PreparationPayload,type PreparationSource} from './preparation-record-input.ts';

type Scope={db:PoolClient;actor:AuthenticatedIdentity;projectId:string};
type Readers={assignments:ProjectAssignmentConfirmations;drafts:ProjectAssignmentDrafts;contexts:ProjectContexts;sessions:ResponsibleSessions;documents:ProjectDocuments;knowledge:ProjectKnowledge;conversations:ProjectConversations};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const exact=(actual:unknown,expected:unknown)=>{if(!same(actual,expected))preparationFailure('VERSION_CONFLICT',409);};
/** Route가 보유한 실제 보호 클래스만 capture한다. 인증/transaction/원문 저장을 새로 만들지 않는다. */
export class PreparationRecordSourceAdapter {
 readonly transport='SYNTHETIC_ONLY' as const;
 readonly #readAssignment:ProjectAssignmentConfirmations['read']; readonly #currentDraft:ProjectAssignmentDrafts['current'];
 readonly #readContext:ProjectContexts['read']; readonly #readRole:ResponsibleSessions['readRole']; readonly #readBinding:ResponsibleSessions['readBinding'];
 readonly #document:ProjectDocuments['version']; readonly #text:ProjectDocuments['originalText']; readonly #knowledge:ProjectKnowledge['read']; readonly #message:ProjectConversations['readMessage'];
 constructor(r:Readers){
  for(const [value,Type] of [[r.assignments,ProjectAssignmentConfirmations],[r.drafts,ProjectAssignmentDrafts],[r.contexts,ProjectContexts],[r.sessions,ResponsibleSessions],[r.documents,ProjectDocuments],[r.knowledge,ProjectKnowledge],[r.conversations,ProjectConversations]] as const)if(!(value instanceof Type))preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  this.#readAssignment=ProjectAssignmentConfirmations.prototype.read.bind(r.assignments);this.#currentDraft=ProjectAssignmentDrafts.prototype.current.bind(r.drafts);
  this.#readContext=ProjectContexts.prototype.read.bind(r.contexts);this.#readRole=ResponsibleSessions.prototype.readRole.bind(r.sessions);this.#readBinding=ResponsibleSessions.prototype.readBinding.bind(r.sessions);
  this.#document=ProjectDocuments.prototype.version.bind(r.documents);this.#text=ProjectDocuments.prototype.originalText.bind(r.documents);this.#knowledge=ProjectKnowledge.prototype.read.bind(r.knowledge);this.#message=ProjectConversations.prototype.readMessage.bind(r.conversations);
 }
 async commandLock(s:Scope,_commandId:string){await projectMember(s.db,s.actor,s.projectId,true);}
 async discoverContext(s:Scope,ref:RuntimeRefV1){
  // 불변 manifest 발견만 수행한다. 본문/현재 접근권은 선택 잠금 뒤 context()에서 다시 검사한다.
  const rows=(await s.db.query('SELECT manifest_json,content_hash FROM anvil.context_bundles WHERE project_id=$1 AND id=$2 AND version=$3',[s.projectId,ref.id,ref.version])).rows;
  if(rows.length!==1)preparationFailure(rows.length?'PREPARATION_INTEGRITY_FAILED':'NOT_FOUND',rows.length?503:404);
  const row=rows[0];if(row.content_hash!==ref.contentHash||preparationHash(row.manifest_json)!==ref.contentHash)preparationFailure('PREPARATION_INTEGRITY_FAILED',503);
  return {manifest:cloneV1(row.manifest_json)};
 }
 async lock(s:Scope,parents:readonly {kind:string;id:string;version?:number}[]){
  await projectMember(s.db,s.actor,s.projectId,true);
  const sql:Record<string,string>={ASSIGNMENT:'SELECT id FROM anvil.assignment_drafts WHERE project_id=$1 AND id=$2 FOR UPDATE',contextRef:'SELECT id FROM anvil.context_bundles WHERE project_id=$1 AND id=$2 FOR SHARE',roleRef:'SELECT role_id FROM anvil.project_roles WHERE project_id=$1 AND role_id=$2 FOR SHARE',oldBindingRef:'SELECT binding_id FROM anvil.role_bindings WHERE project_id=$1 AND binding_id=$2 AND version=$3 FOR SHARE',DOCUMENT_VERSION:'SELECT id FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR UPDATE',KNOWLEDGE_VERSION:'SELECT id FROM anvil.knowledge_entries WHERE project_id=$1 AND id=$2 FOR UPDATE',CONVERSATION:'SELECT id FROM anvil.conversations WHERE project_id=$1 AND id=$2 FOR UPDATE',USER_INSTRUCTION:'SELECT id FROM anvil.conversation_messages WHERE project_id=$1 AND id=$2 FOR SHARE'};
  for(const parent of parents){if(parent.kind==='targetConnectionRef')preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);const q=sql[parent.kind];if(!q)preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);if(!(await s.db.query(q,parent.kind==='oldBindingRef'?[s.projectId,parent.id,parent.version]:[s.projectId,parent.id])).rows.length)preparationFailure('NOT_FOUND',404);}
 }
 async assignment(s:Scope,ref:RuntimeRefV1,options?:{fresh:boolean}){
  const value=await this.#readAssignment(s.db,s.actor,s.projectId,ref.id,ref.version);exact(value.ref,ref);
  const currentDraftRef=options?.fresh?(await this.#currentDraft(s.db,s.actor,s.projectId,value.snapshot.draftRef)).ref:value.snapshot.draftRef;
  return {...value,currentDraftRef};
 }
 async context(s:Scope,ref:RuntimeRefV1){const value=await this.#readContext(s.db,s.actor,s.projectId,ref.id,ref.version);exact(value.ref,ref);return value;}
 async binding(s:Scope,ref:RuntimeRefV1){const value=await this.#readBinding(s.db,s.actor,s.projectId,ref.id,ref.version);exact(value.ref,ref);return {projectId:s.projectId,ref:value.ref,assignmentRef:value.snapshot.assignmentRef,roleRef:value.snapshot.roleRef};}
 async role(s:Scope,ref:RuntimeRefV1,options?:{payload:PreparationPayload}){
  const value=await this.#readRole(s.db,s.actor,s.projectId,ref.id,ref.version);exact(value.ref,ref);const payload=options?.payload;if(!payload)preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
  let binding;
  if(payload.oldBindingRef)binding=await this.binding(s,payload.oldBindingRef);
  else {const rows=(await s.db.query("SELECT binding_id,version,content_hash FROM anvil.role_bindings WHERE project_id=$1 AND role_id=$2 AND snapshot_json->'assignmentRef'=$3::jsonb AND snapshot_json->'roleRef'=$4::jsonb ORDER BY binding_id,version LIMIT 1 FOR SHARE",[s.projectId,ref.id,canonicalJson(payload.assignmentRef),canonicalJson(ref)])).rows; if(!rows.length)preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);const row=rows[0];binding=await this.binding(s,{id:row.binding_id,version:Number(row.version),contentHash:row.content_hash});}
  exact(binding.roleRef,ref);exact(binding.assignmentRef,payload.assignmentRef);return {projectId:s.projectId,ref:value.ref,assignmentRef:binding.assignmentRef};
 }
 async target(_s:Scope,_ref:RuntimeRefV1):Promise<never>{return preparationFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);}
 async source(s:Scope,source:PreparationSource){
  if(source.kind==='DOCUMENT_VERSION'){const v=await this.#document(s.db,s.actor,s.projectId,source.ref.id,source.ref.version);exact({id:v.id,version:v.version,contentHash:v.contentHash},source.ref);await this.#text(s.db,s.projectId,v.content.body);}
  else if(source.kind==='KNOWLEDGE_VERSION'){const v=await this.#knowledge(s.db,s.actor,s.projectId,source.ref.id,source.ref.version);exact(v.ref,source.ref);}
  else {const v=await this.#message(s.db,s.actor,s.projectId,source.conversationId!,source.ref.id);exact(v.sourceRef,source.ref);if(v.message.kind!=='USER_INSTRUCTION')preparationFailure('NOT_FOUND',404);}
  return {projectId:s.projectId,source:cloneV1(source)};
 }
}
