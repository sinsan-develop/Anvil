import type {PoolClient} from 'pg';
import {isProxy} from 'node:util/types';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectMethodologies} from '../methodologies/project-methodologies.ts';
import {readApplicationSnapshot} from '../methodologies/application-snapshot.ts';
import {ProjectWorkPlans} from '../traceability/work-plans.ts';
import {ProjectDesignIndex} from '../traceability/design-index.ts';
import {deriveNodeDecisionDeclaration} from './node-decision-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {copyControlData} from '../control-handoff/control-grant.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const methods={application:ProjectMethodologies.prototype.readApplication,method:ProjectMethodologies.prototype.read,row:ProjectMethodologies.prototype.row,document:ProjectDocuments.prototype.version,text:ProjectDocuments.prototype.originalText,index:ProjectDesignIndex.prototype.read,plan:ProjectWorkPlans.prototype.read,decision:ProjectWorkPlans.prototype.decision};
function denied(code='NODE_DECISION_SOURCE_CONFLICT',status=409):never{throw new AuthFailure(code,status);}
export interface NodeDecisionSelection{applicationRef:VersionRef;designRef:VersionRef;planRef:VersionRef}
/** 실제 보호 reader를 사용해 원문·선택·현재성을 유한 전후 관측한다. */
export class NodeDecisionSources{
 readonly #documents:ProjectDocuments;readonly #methods=new ProjectMethodologies();readonly #plans:ProjectWorkPlans;
 constructor(documents:ProjectDocuments){if(!documents||isProxy(documents)||Object.getPrototypeOf(documents)!==ProjectDocuments.prototype)denied('DECISION_PROTECTION_NOT_CONNECTED',412);this.#documents=documents;this.#plans=new ProjectWorkPlans(documents);this.#ports();}
 #ports(){
  for(const [prototype,key,expected]of [[ProjectMethodologies.prototype,'readApplication',methods.application],[ProjectMethodologies.prototype,'read',methods.method],[ProjectMethodologies.prototype,'row',methods.row],[ProjectDocuments.prototype,'version',methods.document],[ProjectDocuments.prototype,'originalText',methods.text],[ProjectDesignIndex.prototype,'read',methods.index],[ProjectWorkPlans.prototype,'read',methods.plan],[ProjectWorkPlans.prototype,'decision',methods.decision]]as const){const descriptor=Object.getOwnPropertyDescriptor(prototype,key);if(!descriptor||!('value'in descriptor)||descriptor.value!==expected)denied('DECISION_PROTECTION_NOT_CONNECTED',412);}
  if(Object.getPrototypeOf(this.#documents)!==ProjectDocuments.prototype||Object.getPrototypeOf(this.#methods)!==ProjectMethodologies.prototype||Object.getPrototypeOf(this.#plans)!==ProjectWorkPlans.prototype)denied('DECISION_PROTECTION_NOT_CONNECTED',412);
  for(const [object,keys]of [[this.#documents,['version','originalText']],[this.#methods,['readApplication','read','row']],[this.#plans,['read','decision']]]as const)for(const key of keys)if(Object.hasOwn(object,key))denied('DECISION_PROTECTION_NOT_CONNECTED',412);
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,nodeId:string,rawSelection:NodeDecisionSelection,rawSourceDocumentRefs:readonly VersionRef[],fresh:boolean,check:()=>Promise<void>){
  const fixed=copyControlData({selection:rawSelection,sourceDocumentRefs:rawSourceDocumentRefs},2097152) as {selection:NodeDecisionSelection;sourceDocumentRefs:VersionRef[]};
  const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}};freeze(fixed);const{selection,sourceDocumentRefs}=fixed;
  if(!uuidV1(projectId)||typeof nodeId!=='string'||!refV1(selection.applicationRef)||!refV1(selection.designRef)||!refV1(selection.planRef)||!sourceDocumentRefs.length||!sourceDocumentRefs.every(refV1))denied('INPUT_INVALID',422);
  const query=db.query,actorId=actor.actorId,clientId=actor.clientId,generation=actor.credentialGeneration,sessionId=actor.authSession?.id;
  const guard=async()=>{this.#ports();if(db.query!==query||actor.actorId!==actorId||actor.clientId!==clientId||actor.credentialGeneration!==generation||actor.authSession?.id!==sessionId)denied();await check();this.#ports();if(db.query!==query||actor.actorId!==actorId||actor.clientId!==clientId||actor.credentialGeneration!==generation||actor.authSession?.id!==sessionId)denied();};
  const load=async()=>{
   await guard();const member=await projectMember(db,actor,projectId);await guard();if(member.participation!=='OWNER')denied('PROJECT_READ_DENIED',403);
   let app;
   if(fresh)app=await methods.application.call(this.#methods,db,actor,projectId);
   else app=readApplicationSnapshot(projectId,(await db.query('SELECT id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash FROM anvil.project_methodologies WHERE project_id=$1 AND id=$2 AND application_version=$3',[projectId,selection.applicationRef.id,selection.applicationRef.version])).rows);
   await guard();if(!app.snapshot||!same(app.applicationRef,selection.applicationRef))denied();
   if(!refV1(app.snapshot.sourceRef))denied();
   const definition=await methods.method.call(this.#methods,db,actor,projectId,app.snapshot.sourceRef.id,app.snapshot.sourceRef.version);await guard();
   if(!same(definition.ref,app.snapshot.sourceRef)||!definition.validation.validForConfirmation)denied();
   const formRefs=(await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1",[actor.actorId])).rows.map(r=>({id:r.id,version:Number(r.version),contentHash:r.content_hash}));await guard();
   const declaration=deriveNodeDecisionDeclaration({applicationRef:app.applicationRef,applicationSnapshot:app.snapshot,nodeId,formRefs});
   const plan=await methods.plan.call(this.#plans,db,actor,projectId,selection.planRef.id,selection.planRef.version);await guard();
   if(!same(plan.ref,selection.planRef)||!same(plan.designRef,selection.designRef))denied();
   const refs=[selection.designRef,plan.documentRef,...sourceDocumentRefs],documents=[];
   for(let i=0;i<refs.length;i++){
    const ref=refs[i]!;const doc=await methods.document.call(this.#documents,db,actor,projectId,ref.id,ref.version);await guard();if(doc.contentHash!==ref.contentHash)denied();
    if(i<2){const row=(await db.query("SELECT definition_json->>'formCode' code FROM anvil.form_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3",[doc.formRef.id,doc.formRef.version,doc.formRef.contentHash])).rows[0];await guard();if(row?.code!==(i===0?'AF02':'AF04'))denied('NODE_DECISION_DOCUMENT_KIND_INVALID',422);}
    if(fresh){const head=(await db.query('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2',[projectId,ref.id])).rows[0];await guard();if(!head||Number(head.head_version)!==ref.version||Number(head.confirmed_version)!==ref.version||!doc.confirmed||!doc.validation.validForConfirmation||doc.contentReviews[0]?.ref.outcome!=='ACCEPTED')denied();}
    documents.push({ref,contentHash:doc.contentHash,content:doc.content,formRef:doc.formRef,sourceRefs:doc.sourceRefs,confirmed:doc.confirmed,review:doc.contentReviews[0]?.ref??null});
   }
   if(fresh){const decision=await methods.decision.call(this.#plans,db,actor,projectId,selection.planRef.id,selection.planRef.version);await guard();if(!decision.currentConfirmationValid)denied();}
   return {declaration,basisSelection:selection,planDocumentRef:plan.documentRef,observationHash:contentHash(canonicalJson({application:app.snapshot,definition:{ref:definition.ref,graph:definition.graph,confirmation:definition.confirmation},plan:{...plan,observedAt:null},documents}))};
  };
  const before=await load(),after=await load();await guard();if(!same(before,after))denied();return JSON.parse(canonicalJson(after)) as typeof after;
 }
}
