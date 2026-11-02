import {isRelativeSourceFileV1} from '../../../../contracts/runtime/source-scope-v1.ts';
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {recordV1,hashV1,isoV1 as optionIso} from '../../../../contracts/runtime/validation-v1.ts';
import type {ProjectListCodec} from '../projects/service.ts';
import type {PoolClient} from 'pg';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {persistProjectReceipt,currentProjectController,authorizeMaterial,currentPolicy,projectMember,ProjectPolicyRepository,type ProjectCommand} from '../access/project-command.ts';
import type {ProjectDocuments} from './project-documents.ts';
import {DocumentSourceLinkRecords} from './document-source-link-records.ts';
import {prepareDocumentSourceDetach,readDocumentSourceLinkInput,type LinkInput} from './document-source-link-history.ts';
import {readApprovalRef} from '../approvals/approval-input.ts';
import {registrationRef,connectorRef} from '../connections/project-registrations.ts';
import {DocumentSourceObservations,observationLease,sourceChoiceRecord,sourceEventQuotaPart,type DocumentSourceObservationPort,readDocumentObservation,type ObservationRecord,type ObservationLease} from './document-source-observation.ts';
import {prepareDocumentSourceImport,storeDocumentSourceImport,type ImportCandidate} from './project-imports.ts';
import {prepareDocumentProposalMaterial,storeDocumentProposalMaterial,type DocumentProposalPlan} from './project-proposals.ts';
import type {ProjectStorageQuota,StartedQuotaBundle,QuotaPart} from '../projects/project-storage-quota.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail(code='DOCUMENT_SOURCE_LINK_INPUT_INVALID',status=422):never{throw new AuthFailure(code,status);}
type ChoiceRecord=ReturnType<typeof sourceChoiceRecord>;
interface SourcePlan {link:{ref:VersionRef;snapshot:Record<string,unknown>}|null;linkId:string;documentRef:VersionRef;record:ChoiceRecord;observation:ObservationRecord;oldHead:VersionRef|null;candidate:ImportCandidate|null;proposal:DocumentProposalPlan|null;projection:unknown;part:QuotaPart;at:string}
/** 원 인증 Tx/원 명령/목적 quota를 소유한다. 기본 관측 공급자는 미등록이다. */
export class ProjectDocumentSourceLinks{
 readonly #observations:DocumentSourceObservations;
 constructor(source?:DocumentSourceObservationPort){this.#observations=new DocumentSourceObservations(source);}
 /** 보관된 후보 선택만 수행한다. ProjectCommand/승인 소비·새 관측·원문 IO를 만들지 않는다. */
 async options(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,documentId:string,query:Record<string,unknown>,codec:ProjectListCodec){
  const optional=['rootId','linkId','linkHash','limit','cursor'].filter(k=>query[k]!==undefined);
  if(!recordV1(query,['view','version','contentHash','mode',...optional])||query.view!=='options'||!['LINK','CHANGE'].includes(String(query.mode))||typeof query.version!=='string'||!(/^[1-9][0-9]{0,14}$/).test(query.version)||!hashV1(query.contentHash)||!uuidV1(projectId)||!uuidV1(documentId)||query.limit!==undefined&&(typeof query.limit!=='string'||!(/^[1-9][0-9]?$/).test(query.limit)||Number(query.limit)>50)||query.cursor!==undefined&&(typeof query.cursor!=='string'||query.cursor.length>4096))fail('DOCUMENT_SOURCE_LINK_INPUT_INVALID',400);
  if(query.mode==='LINK'?(!uuidV1(query.rootId)||query.linkId!==undefined||query.linkHash!==undefined):(query.rootId!==undefined||!uuidV1(query.linkId)||!hashV1(query.linkHash)))fail('DOCUMENT_SOURCE_LINK_INPUT_INVALID',400);
  const source=this.#observations.require(),descriptor=Object.getOwnPropertyDescriptor(source,'options');
  if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='function')fail('DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE',412);
  const method=descriptor.value as (db:PoolClient,actor:AuthenticatedIdentity,scope:Readonly<Record<string,unknown>>,position:{at:string;id:string}|null,limit:number,signal:AbortSignal)=>Promise<unknown>;
  const documentRef={id:documentId,version:Number(query.version),contentHash:query.contentHash},operation=query.mode==='LINK'?'linkDocumentSource':'proposeDocumentSourceChange';
  let identity:string|undefined,lease:ObservationLease|undefined=observationLease(actor,Date.now()+10000),active=true;const pending=new Set<Promise<unknown>>();
  const gate=async()=>{
   lease?.check();const member=await projectMember(db,actor,projectId,true);lease?.check();if(member.archived_at||member.participation!=='OWNER')fail('PROJECT_WRITE_DENIED',403);
   const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',[projectId])).rows[0];lease?.check();
   if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId||!Number.isSafeInteger(Number(control.generation))||Number(control.generation)<1)fail('PROJECT_CONTROL_REQUIRED',403);
   const policy=await currentPolicy(db,projectId);lease?.check();if(!policy)fail('PERMISSION_POLICY_UNCONFIGURED',412);
   const rules=policy.rules.filter(r=>r.subjectRef.kind==='HUMAN'&&r.subjectRef.userId===actor.actorId&&r.operations.includes(operation)&&r.targetScopes.some(t=>t.kind==='PROJECT'&&t.projectId===projectId)&&Date.parse(r.expiresAt)>Date.now());
   if(!rules.length||rules.some(r=>r.disposition==='DENY'))fail('PROJECT_OPERATION_DENIED',403);
   const next=canonicalJson({actorId:actor.actorId,clientId:actor.clientId,credentialGeneration:actor.credentialGeneration,session:actor.authSession,controlGeneration:Number(control.generation),policyRef:policy.ref});if(identity!==undefined&&identity!==next)fail('DOCUMENT_SOURCE_CURRENT_CHANGED',409);identity=next;
   const until=Math.min(...rules.map(r=>Date.parse(r.expiresAt)));if(!lease)lease=observationLease(actor,until);else lease.narrow(new Date(until).toISOString());
   if(Object.getOwnPropertyDescriptor(source,'options')?.value!==method)fail();return Number(control.generation);
  };
  try{
   const generation=await gate();let rootId=String(query.rootId??''),relativePath:string|null=null,linkRef:VersionRef|null=null;
   const document=(await db.query('SELECT content_hash FROM anvil.document_versions WHERE project_id=$1 AND document_id=$2 AND version=$3',[projectId,documentId,documentRef.version])).rows[0];lease!.check();if(!document)fail('NOT_FOUND',404);if(document.content_hash!==documentRef.contentHash)fail('DOCUMENT_SOURCE_REFERENCE_CHANGED',409);
   if(query.mode==='CHANGE'){const view=await new DocumentSourceLinkRecords().read(db,actor,projectId,documentRef,String(query.linkId));lease!.check();if(!view.rawAllowed||view.state!=='ACTIVE'||view.ref.version!==1||view.ref.contentHash!==query.linkHash||!view.history.length)fail('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);const original=view.history[0]!.snapshot;rootId=original.sourceRootId;relativePath=original.relativePath;linkRef=view.ref;}
   const root=(await db.query('SELECT v.* FROM anvil.source_roots r JOIN anvil.source_root_versions v ON v.project_id=r.project_id AND v.root_id=r.id AND v.version=r.head_version WHERE r.project_id=$1 AND r.id=$2 FOR SHARE OF r',[projectId,rootId])).rows[0];lease!.check();
   if(!root||root.status!=='DECLARED')fail('NOT_FOUND',404);
   const scope={projectId,documentRef,sourceRootId:rootId,relativePath,actorId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession!.id,controlGeneration:generation};
   const limit=query.limit===undefined?50:Number(query.limit),filter={query:canonicalJson({view:'DOCUMENT_SOURCE_OPTIONS',mode:query.mode,scope,linkRef,identity}),archived:false,limit};let position:{at:string;id:string}|null=null;
   if(query.cursor!==undefined){try{position=codec.read(String(query.cursor),actor.actorId,filter);}catch{fail('CURSOR_INVALID',400);}}
   const guardedQuery=(...args:unknown[])=>{try{lease!.check();if(!active)fail();const task=Promise.resolve(Reflect.apply(db.query,db,args));pending.add(task);void task.then(()=>pending.delete(task),()=>pending.delete(task));const guarded=task.then(value=>{lease!.check();if(!active)fail();return value;});void guarded.catch(()=>{});return guarded;}catch(e){const rejected=Promise.reject(e);void rejected.catch(()=>{});return rejected;}};
   let timer:ReturnType<typeof setTimeout>|undefined,raw:unknown;
   try{raw=await Promise.race([method.call(source,Object.freeze({query:guardedQuery}) as unknown as PoolClient,actor,Object.freeze(cloneV1(scope)),position,limit,lease!.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AuthFailure('DOCUMENT_SOURCE_OBSERVATION_EXPIRED',409)),lease!.remaining());})]);}finally{if(timer)clearTimeout(timer);}
   await gate();
   const snapshot=(v:unknown,depth=0):unknown=>{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return v;if(!v||typeof v!=='object'||types.isProxy(v)||depth>14||Object.getOwnPropertySymbols(v).length)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);if(Array.isArray(v)){const d=Object.getOwnPropertyDescriptors(v);if(Object.getPrototypeOf(v)!==Array.prototype||v.length>50||Object.keys(d).length!==v.length+1||Object.entries(d).some(([k,p])=>k!=='length'&&(!('value'in p)||!p.enumerable)))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);return Array.from({length:v.length},(_,i)=>snapshot(d[String(i)]!.value,depth+1));}if(Object.getPrototypeOf(v)!==Object.prototype)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);const d=Object.getOwnPropertyDescriptors(v);if(Object.values(d).some(p=>!('value'in p)||!p.enumerable))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);return Object.fromEntries(Object.entries(d).map(([k,p])=>[k,snapshot(p.value,depth+1)]));};
   const page=snapshot(raw);if(!recordV1(page,['items','hasMore'])||!Array.isArray(page.items)||page.items.length>limit||typeof page.hasMore!=='boolean'||page.hasMore&&page.items.length===0)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
   const items=[];let last=position;const seen=new Set<string>();
   for(const value of page.items){if(!recordV1(value,['label','record'])||typeof value.label!=='string'||!value.label.trim()||value.label.length>200||!value.label.isWellFormed()||/[\u0000-\u001f\u007f]/.test(value.label)||!recordV1(value.record,['ref','snapshot'])||!recordV1(value.record.snapshot,Object.keys(value.record.snapshot))||!refV1(value.record.snapshot.sourceSnapshotRef)||!recordV1(value.record.snapshot.scope,Object.keys(scope)))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
    const observedScope={...scope,relativePath:value.record.snapshot.scope.relativePath};if(relativePath!==null&&relativePath!==observedScope.relativePath||!isRelativeSourceFileV1(observedScope.relativePath))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);
    const record=readDocumentObservation(value.record,observedScope as Parameters<typeof readDocumentObservation>[1],value.record.snapshot.sourceSnapshotRef);lease!.narrow(record.snapshot.expiresAt);if(Date.parse(record.snapshot.expiresAt)<=Date.now()||!optionIso(record.snapshot.observedAt))fail('DOCUMENT_SOURCE_OBSERVATION_EXPIRED',409);
    const pos={at:record.snapshot.observedAt,id:record.ref.id};if(seen.has(pos.id)||last&&(pos.at>last.at||pos.at===last.at&&pos.id>=last.id))fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);seen.add(pos.id);
    const item={label:value.label,relativePath:record.snapshot.scope.relativePath,observedSnapshotRef:record.snapshot.sourceSnapshotRef,blobHash:record.snapshot.blobHash,artifactRef:record.snapshot.artifactRef,observedAt:record.snapshot.observedAt,expiresAt:record.snapshot.expiresAt};
    if(Buffer.byteLength(canonicalJson({items:[...items,item],nextCursor:'x'.repeat(4096)}))>2000000)fail('DOCUMENT_SOURCE_OBSERVATION_INVALID',503);items.push(item);last=pos;
   }
   await gate();return{view:'DOCUMENT_SOURCE_OPTIONS',projectId,documentRef,mode:query.mode,rootId,sourceLinkRef:linkRef,items,hasMore:page.hasMore,nextCursor:page.hasMore?codec.create(actor.actorId,filter,last!):null};
  }catch(error){if(error instanceof AuthFailure)throw error;fail('DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE',503);}finally{active=false;lease?.close();while(pending.size)await Promise.allSettled([...pending]);}
 }
 /** 직접 link 호출은 보호 예약/현재성 closure 없이는 저장하지 않는다. */
 async link(_db:PoolClient,_actor:AuthenticatedIdentity,_input:ProjectCommand,_policyRef:VersionRef){this.#observations.require();fail('PROJECT_STORAGE_QUOTA_UNVERIFIED',412);}
 async command(access:AccessRepository,policies:ProjectPolicyRepository,documents:ProjectDocuments,token:string,csrf:string,raw:ProjectCommand){
  const request=cloneV1(raw);if(!['linkDocumentSource','proposeDocumentSourceChange'].includes(request.operation))fail();
  const quota=documents.sourceQuota(access),startedAt=performance.now();let active=true,plan:SourcePlan|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  const alive=()=>{if(!active||performance.now()-startedAt>=10000)fail('DOCUMENT_SOURCE_OBSERVATION_EXPIRED',409);};
  const work=(async()=>{
   const prepared=await quota.prepare(token,csrf,request,async(db,actor,fixed,existing)=>{
    alive();if(existing)fail('DOCUMENT_SOURCE_OUTCOME_UNKNOWN',503);
    const policy=await authorizeMaterial(db,actor,request,false,documents),lease=observationLease(actor,policy.validUntil);
    try{plan=await this.#prepare(db,actor,request,documents,lease,async()=>{alive();await currentProjectController(db,actor,request);const p=await authorizeMaterial(db,actor,request,false,documents);if(!same(p.ref,policy.ref))fail('DOCUMENT_SOURCE_CURRENT_CHANGED',409);lease.check();});return[plan.part];}finally{lease.close();}
   });
   alive();if(prepared.replay)return access.authenticated(token,csrf,(db,actor)=>quota.protectedReplay(db,actor,request));
   if(!plan)fail('DOCUMENT_SOURCE_OUTCOME_UNKNOWN',503);
   const started=await quota.start(token,csrf,await quota.reserve(token,csrf,prepared));
   try{return await policies.command(token,csrf,request,async(db,actor,policyRef)=>{
    const policy=await authorizeMaterial(db,actor,request,false,documents),lease=observationLease(actor,Math.min(policy.validUntil,Date.parse(prepared.authorizedUntil)));
    const check=async()=>{alive();await currentProjectController(db,actor,request);const current=await authorizeMaterial(db,actor,request,false,documents);if(!same(current.ref,policyRef)||!same(policy.ref,policyRef))fail('DOCUMENT_SOURCE_CURRENT_CHANGED',409);lease.narrow(new Date(current.validUntil).toISOString());};
    try{await check();const final=await this.#prepare(db,actor,request,documents,lease,check,plan);if(!same(final.projection,plan!.projection)||!same(final.part,plan!.part))fail('DOCUMENT_SOURCE_OBSERVATION_CHANGED',409);
     await quota.requireStarted(db,actor,request,started,[plan!.part]);await check();return this.#store(db,actor,request,policyRef,final,quota,started,check);
    }finally{lease.close();}
   });}catch{return fail('DOCUMENT_SOURCE_OUTCOME_UNKNOWN',503);}
  })();
  void work.catch(()=>{});
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AuthFailure('DOCUMENT_SOURCE_OUTCOME_UNKNOWN',503)),10000);})]);}
  finally{active=false;if(timer)clearTimeout(timer);}
 }
 async #root(db:PoolClient,actor:AuthenticatedIdentity,observation:ObservationRecord){
  const s=observation.snapshot,root=(await db.query(`SELECT v.*,r.head_version FROM anvil.source_roots r JOIN anvil.source_root_versions v ON v.project_id=r.project_id AND v.root_id=r.id AND v.version=r.head_version WHERE r.project_id=$1 AND r.id=$2 FOR SHARE OF r`,[s.scope.projectId,s.scope.sourceRootId])).rows[0];
  if(!root)fail('NOT_FOUND',404);
  if(Number(root.head_version)!==s.sourceRootRef.version||root.content_hash!==s.sourceRootRef.contentHash||root.status!=='DECLARED'||root.connector_id!==s.connectorRef.id||contentHash(canonicalJson({declaration:root.declaration_json,status:root.status,authority:root.authority,readiness:root.readiness,reason:root.reason}))!==s.sourceRootRef.contentHash)fail('DOCUMENT_SOURCE_CURRENT_CHANGED',409);
  const r=(await db.query(`SELECT r.*,c.generation,c.status connector_status,c.revoked_at connector_revoked,anvil.connector_basis_current(r.id,false) basis_current FROM anvil.connector_registrations r JOIN anvil.connectors c ON c.project_id=r.project_id AND c.id=r.connector_id AND c.registration_id=r.id WHERE r.project_id=$1 AND r.id=$2 AND r.requested_by=$3 AND r.client_id=$4 FOR SHARE OF r,c`,[s.scope.projectId,s.registrationRef.id,actor.actorId,actor.clientId])).rows[0];
  if(!r||r.basis_current!==true||r.state!=='ISSUED'||r.connector_status!=='TRUSTED'||r.revoked_at||r.connector_revoked||!same(registrationRef(r),s.registrationRef)||!same(connectorRef(r,Number(r.generation)),s.connectorRef)||Number(r.credential_generation)!==actor.credentialGeneration||Number(r.control_generation)!==s.scope.controlGeneration)fail('DOCUMENT_SOURCE_CURRENT_CHANGED',409);
 }
 async #prepare(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,documents:ProjectDocuments,lease:ObservationLease,check:()=>Promise<void>,fixed?:SourcePlan):Promise<SourcePlan>{
  this.#observations.require();await check();
  const initial=request.operation==='linkDocumentSource';let linkId:string,documentRef:VersionRef,rootId:string,path:string,snapshotRef:VersionRef,oldHead:VersionRef|null=null,link:SourcePlan['link']=null;
  const input=initial?readDocumentSourceLinkInput('linkDocumentSource',request.payload):readDocumentSourceLinkInput('proposeDocumentSourceChange',request.payload);
  if(request.baselineRefs.length||request.clientId!==actor.clientId||!actor.authSession)fail();
  if(initial){const p=input as LinkInput;if(request.targetId!==null||request.expectedVersion!==0)fail();documentRef=p.documentRef;rootId=p.sourceRootId;path=p.relativePath;snapshotRef=p.sourceSnapshotRef;linkId=fixed?.linkId??randomUUID();}
  else{
   if(!('sourceLinkRef'in input)||request.targetId!==input.sourceLinkRef.id||request.expectedVersion!==1)fail();linkId=input.sourceLinkRef.id;
   const row=(await db.query('SELECT l.document_id,l.version,l.link_version,l.state,v.content_hash FROM anvil.document_source_links l JOIN anvil.document_versions v ON v.project_id=l.project_id AND v.document_id=l.document_id AND v.version=l.version WHERE l.project_id=$1 AND l.id=$2 FOR UPDATE OF l',[request.projectId,linkId])).rows[0];
   if(!row)fail('NOT_FOUND',404);documentRef={id:row.document_id,version:Number(row.version),contentHash:row.content_hash};
   const stored=await new DocumentSourceLinkRecords().read(db,actor,request.projectId,documentRef,linkId);
   if(!stored.rawAllowed||stored.state!=='ACTIVE'||!same(stored.ref,input.sourceLinkRef))fail('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);
   const origin=stored.history[0]!.snapshot;rootId=origin.sourceRootId;path=origin.relativePath;
   if(!('observedSnapshotRef'in input))fail();snapshotRef=input.observedSnapshotRef;
   const head=(await db.query('SELECT stream_id,head_version,head_hash FROM anvil.document_source_observation_heads WHERE project_id=$1 AND link_id=$2 FOR UPDATE',[request.projectId,linkId])).rows[0];
   if(head){oldHead={id:head.stream_id,version:Number(head.head_version),contentHash:head.head_hash};if(!refV1(oldHead))fail('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);}
   if(fixed&&!same(oldHead,fixed.oldHead))fail('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);
   if(input.choice==='COLLECT_PROPOSAL'&&(await db.query("SELECT id FROM anvil.document_source_observation_events WHERE project_id=$1 AND link_id=$2 AND snapshot_json->>'choice'='COLLECT_PROPOSAL' AND snapshot_json->'observation'->'snapshot'->'sourceSnapshotRef'=$3::jsonb",[request.projectId,linkId,JSON.stringify(snapshotRef)])).rows.length)fail('DOCUMENT_SOURCE_OBSERVATION_ALREADY_COLLECTED',409);
  }
  const observation=await this.#observations.observe(db,actor,{projectId:request.projectId,documentRef,sourceRootId:rootId,relativePath:path,actorId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession.id,controlGeneration:request.controlGeneration},snapshotRef,lease);
  await check();await this.#root(db,actor,observation);await check();
  const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at?.toISOString();if(!isoV1(at))fail('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);
  if(initial){const p=input as LinkInput;if(p.blobHash!==observation.snapshot.blobHash)fail('DOCUMENT_SOURCE_OBSERVATION_CHANGED',409);const snapshot={...p,projectId:request.projectId,kind:'LINKED',state:'ACTIVE',previousRef:null,recordedAt:at};link={ref:{id:linkId,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};}
  let candidate:ImportCandidate|null=null,proposal:DocumentProposalPlan|null=null;
  if('choice'in input&&input.choice==='COLLECT_PROPOSAL'){
   const artifact=observation.snapshot.artifactRef;if(!artifact)fail('DOCUMENT_SOURCE_ORIGINAL_UNAVAILABLE',412);
   const base=await documents.version(db,actor,request.projectId,documentRef.id,documentRef.version);await check();
   candidate=await prepareDocumentSourceImport(db,request.projectId,artifact,base.formRef,(d,p,r)=>documents.sourceArtifact(d,p,r),fixed?.candidate?.id??randomUUID());await check();
   if(candidate.status!=='READY'||!candidate.extractedContentRef)fail('DOCUMENT_SOURCE_IMPORT_UNSUPPORTED',412);
   proposal=await prepareDocumentProposalMaterial(db,actor,request.projectId,{baseRef:documentRef,proposedContent:{...base.content,body:artifact,sections:[],sourceRefs:[]},reason:input.reason,sourceRefs:[]},base,(d,p,r)=>documents.sourceArtifact(d,p,r),fixed?.proposal?{artifactId:fixed.proposal.proposal.diffRef.artifactId,proposalId:fixed.proposal.proposal.id}:undefined);await check();
  }
  const record=sourceChoiceRecord(oldHead?.id??fixed?.record.ref.id??randomUUID(),(oldHead?.version??0)+1,{projectId:request.projectId,sourceLinkRef:link?.ref??('sourceLinkRef'in input?input.sourceLinkRef:documentRef),observation,choice:'choice'in input?input.choice:null,reason:input.reason,previousRef:oldHead,proposalId:proposal?.proposal.id??null,importId:candidate?.id??null,recordedAt:at});
  // quota 계획은 신규 로컬 기록시각/파생hash만 제외한다. 관측 proof의 원시각/hash와 기존 sourceLinkRef는 그대로 결박한다.
  const projection={link:link?{ref:{id:link.ref.id,version:link.ref.version},snapshot:{...link.snapshot,recordedAt:null}}:null,record:{ref:{id:record.ref.id,version:record.ref.version},snapshot:{...record.snapshot,sourceLinkRef:link?{id:link.ref.id,version:link.ref.version}:record.snapshot.sourceLinkRef,recordedAt:null}},candidate,proposal:proposal?{proposal:proposal.proposal,content:proposal.content,reason:proposal.reason}:null};
  const part=sourceEventQuotaPart(initial?'linkDocumentSource':'proposeDocumentSourceChange',proposal?.proposal.diffRef.artifactId??record.ref.id,projection,proposal?.diff.length??0);
  await check();return{link,linkId,documentRef,record,observation,oldHead,candidate,proposal,projection,part,at};
 }
 async #store(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef,plan:SourcePlan,quota:ProjectStorageQuota,started:StartedQuotaBundle,check:()=>Promise<void>){
  let key:string|null=null;if(plan.proposal)key=await quota.publishSourceDiff(db,actor,request,started,plan.projection,plan.proposal.proposal.diffRef,plan.proposal.diff);
  await check();const ref=plan.link?.ref??plan.record.ref,snapshot=plan.link?.snapshot??plan.record.snapshot;
  const receipt=await persistProjectReceipt(db,actor,request,ref,{status:plan.link?'DOCUMENT_SOURCE_LINKED':'DOCUMENT_SOURCE_CHANGE_RECORDED',snapshot,observationRef:plan.observation.ref,sourceEvent:plan.record,proposal:plan.proposal?.proposal??null,importCandidate:plan.candidate},policyRef,'EXPLICIT_DOCUMENT_SOURCE_CHOICE');
  if(plan.link){const s=plan.link.snapshot as unknown as LinkInput;
   const eventId=randomUUID();await db.query("INSERT INTO anvil.document_source_links(project_id,id,document_id,version,source_root_id,relative_path,source_snapshot_ref,blob_hash,link_version,state,current_event_id,linked_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,'ACTIVE',$9,$10,$10)",[request.projectId,plan.linkId,s.documentRef.id,s.documentRef.version,s.sourceRootId,s.relativePath,JSON.stringify(s.sourceSnapshotRef),s.blobHash,eventId,plan.at]);
   await db.query('INSERT INTO anvil.document_source_link_events(id,project_id,link_id,link_version,content_hash,snapshot_json,command_id,created_at) VALUES($1,$2,$3,1,$4,$5,$6,$7)',[eventId,request.projectId,plan.linkId,plan.link.ref.contentHash,JSON.stringify(plan.link.snapshot),receipt.id,plan.at]);
  }
  if(plan.candidate)await storeDocumentSourceImport(db,actor,request.projectId,receipt.id,plan.candidate);
  if(plan.proposal&&key)await storeDocumentProposalMaterial(db,actor,request.projectId,receipt.id,plan.proposal,key);
  await db.query('INSERT INTO anvil.document_source_observation_events(id,project_id,link_id,stream_id,version,content_hash,snapshot_json,command_id,projection_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),request.projectId,plan.linkId,plan.record.ref.id,plan.record.ref.version,plan.record.ref.contentHash,JSON.stringify(plan.record.snapshot),receipt.id,plan.part.contentHash,plan.at]);
  if(!plan.oldHead)await db.query('INSERT INTO anvil.document_source_observation_heads(project_id,link_id,stream_id,head_version,head_hash) VALUES($1,$2,$3,$4,$5)',[request.projectId,plan.linkId,plan.record.ref.id,plan.record.ref.version,plan.record.ref.contentHash]);
  else if((await db.query('UPDATE anvil.document_source_observation_heads SET head_version=$3,head_hash=$4 WHERE project_id=$1 AND link_id=$2 AND head_version=$5 AND head_hash=$6',[request.projectId,plan.linkId,plan.record.ref.version,plan.record.ref.contentHash,plan.oldHead.version,plan.oldHead.contentHash])).rowCount!==1)fail('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);
  await quota.settle(db,actor,request,started,{serverCommandId:receipt.id,authorizationReceiptId:receipt.authorizationReceiptRef.id,scopeDigest:receipt.authorizationReceiptRef.contentHash});return receipt.result;
 }
 async detach(db:PoolClient,actor:AuthenticatedIdentity,input:ProjectCommand,policyRef:VersionRef){
  const request=cloneV1(input),payload=readDocumentSourceLinkInput('detachDocumentSource',request.payload);
  if(request.approvalRef!==null)readApprovalRef(request.approvalRef);
  if(!uuidV1(actor.actorId)||!uuidV1(actor.clientId)||!refV1(policyRef)||!uuidV1(request.projectId)||!uuidV1(request.commandId)
   ||request.operation!=='detachDocumentSource'||request.clientId!==actor.clientId||request.targetId!==payload.sourceLinkRef.id
   ||request.expectedVersion!==payload.sourceLinkRef.version||request.baselineRefs.length)throw new AuthFailure('DOCUMENT_SOURCE_LINK_INPUT_INVALID',422);
  try{
   const rows=(await db.query(`SELECT l.document_id,l.version,l.current_event_id,v.content_hash document_hash FROM anvil.document_source_links l
    JOIN anvil.document_versions v ON v.project_id=l.project_id AND v.document_id=l.document_id AND v.version=l.version
    WHERE l.project_id=$1 AND l.id=$2 FOR UPDATE OF l`,[request.projectId,request.targetId])).rows;
   if(!rows.length)throw new AuthFailure('NOT_FOUND',404);
   if(rows.length!==1)throw new AuthFailure('DOCUMENT_SOURCE_LINK_HISTORY_INVALID',503);
   const row=rows[0],documentRef={id:row.document_id,version:Number(row.version),contentHash:row.document_hash};
   const stored=await new DocumentSourceLinkRecords().read(db,actor,request.projectId,documentRef,payload.sourceLinkRef.id);
   if(!stored.rawAllowed)throw new AuthFailure('PROJECT_WRITE_DENIED',403);
   const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
   const snapshot=prepareDocumentSourceDetach({projectId:request.projectId,documentRef},stored.history,payload,at);
   const ref={id:payload.sourceLinkRef.id,version:2,contentHash:contentHash(canonicalJson(snapshot))},eventId=randomUUID();
   const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'DOCUMENT_SOURCE_DETACHED',snapshot},policyRef,'EXPLICIT_DOCUMENT_SOURCE_DETACH');
   await db.query('INSERT INTO anvil.document_source_link_events(id,project_id,link_id,link_version,content_hash,snapshot_json,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[eventId,request.projectId,ref.id,ref.version,ref.contentHash,JSON.stringify(snapshot),receipt.id,at]);
   const updated=await db.query("UPDATE anvil.document_source_links SET link_version=$3,state='DETACHED',current_event_id=$4,updated_at=$5 WHERE project_id=$1 AND id=$2 AND link_version=$6 AND state='ACTIVE' AND current_event_id IS NOT DISTINCT FROM $7",[request.projectId,ref.id,ref.version,eventId,at,payload.sourceLinkRef.version,row.current_event_id??null]);
   if(updated.rowCount!==1)throw new AuthFailure('DOCUMENT_SOURCE_LINK_VERSION_CONFLICT',409);
   return receipt.result;
  }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure('DOCUMENT_SOURCE_LINK_STORAGE_UNAVAILABLE',503);}
 }
}
