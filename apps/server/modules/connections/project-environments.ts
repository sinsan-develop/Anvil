import {ProjectApprovals} from '../approvals/project-approvals.ts';
import type {ApprovalDetails,ApprovalScope} from '../approvals/approval-input.ts';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {currentProjectController,authorizeMaterial,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import {ProjectSourceRoots} from './project-source-roots.ts';
import {SourceReadRecords} from './source-read-records.ts';
import {ProjectEnvironmentResources,environmentOwner,environmentReadPolicy,assertEnvironmentHistoryProof,environmentFailure,readEnvironmentCommand,loadEnvironmentRow,loadEnvironmentWriteRow,insertEnvironmentVersion,environmentWriteGuard,uniqueEnvironmentIssues} from './project-environment-resources.ts';
import {verifyEnvironmentRegistrationEvidence} from './environment-registration-evidence.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {environmentHash,hostId,readEnvironmentHostRef,readEnvironmentInput,type EnvironmentInput,type HostRef,type MetadataKind,type MetadataSnapshot,type EnvironmentVersion,type EnvironmentSourceRoot} from '../../../../contracts/runtime/environment-configuration-v1.ts';
import type {RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
type OriginReuseReferenceReaders=Readonly<{
 readMetadata:ProjectEnvironmentResources['readOriginReuseMetadata'];
 readRoot:ProjectSourceRoots['read'];
 readSnapshot:SourceReadRecords['readSnapshot'];
 loadSnapshotGrant:SourceReadRecords['load'];
}>;
export class ProjectEnvironments{
 readonly access:AccessRepository;readonly resources:ProjectEnvironmentResources;readonly roots:ProjectSourceRoots;readonly observations:SourceReadRecords;
 constructor(access:AccessRepository){this.access=access;this.resources=new ProjectEnvironmentResources(access);this.roots=new ProjectSourceRoots(access);this.observations=new SourceReadRecords(access.installationId);}
 async #host(db:PoolClient,a:AuthenticatedIdentity,pid:string,h:HostRef,fresh:boolean,evidence:any[]){if(fresh)return this.resources.host(db,a,pid,h,evidence);if(h.kind==='CONNECTOR_STATUS'){const proof=evidence.filter(e=>same(e.connectorRef,h.connectorRef)&&same(e.registrationRef,h.registrationRef));if(proof.length!==1)environmentFailure();await verifyEnvironmentRegistrationEvidence(db,pid,proof[0]);}else{const v=await loadEnvironmentRow(db,a,pid,'ENVIRONMENT_HOST_DECLARATION',h.ref.id,h.ref.version);if(!same(v.ref,h.ref)||(v.snapshot as MetadataSnapshot).status!=='DECLARED')environmentFailure();}}
 async #resource(db:PoolClient,a:AuthenticatedIdentity,pid:string,kind:MetadataKind,ref:any,fresh:boolean){if(fresh){const v=await this.resources.read(db,a,pid,kind,ref.id,ref.version);if(!same(v.ref,ref)||v.snapshot.status!=='DECLARED'||v.current.configurationCurrentness!=='MATCHED')environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);return v.snapshot;}const v=await loadEnvironmentRow(db,a,pid,kind,ref.id,ref.version);if(!same(v.ref,ref)||(v.snapshot as MetadataSnapshot).status!=='DECLARED')environmentFailure();return v.snapshot as MetadataSnapshot;}
 async #snapshot(db:PoolClient,a:AuthenticatedIdentity,pid:string,ref:any,root:EnvironmentSourceRoot,host:HostRef,observations?:SourceReadRecords){const v=await (observations??this.observations).readSnapshot(db,a,pid,ref.id);if(!v.rawAllowed||!same(v.snapshotRef,ref)||v.sourceRootRef.id!==root.sourceRootId||host.kind!=='CONNECTOR_STATUS'||!same(v.connectorRef,host.connectorRef)||v.report.root.state!=='OBSERVED'||v.report.root.facts===null)environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);const grant=await (observations??this.observations).load(db,pid,v.grantRef.id);if(!same(grant.grantRef,v.grantRef)||!same(grant.scope.connectorRef,host.connectorRef)||!same(grant.scope.registrationRef,host.registrationRef)||!same(grant.scope.sourceRootRef,v.sourceRootRef))environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);return v.sourceRootRef;}
 async references(db:PoolClient,a:AuthenticatedIdentity,pid:string,input:EnvironmentInput,fresh:boolean,evidence:any[]){
 const hosts=[input.executionHostRef,...input.targetHostRefs,...input.sourceRoots.map(r=>r.registeredPathRef.hostRef)],unique=[...new Map(hosts.map(h=>[canonicalJson(h),h])).values()];for(const h of unique)await this.#host(db,a,pid,h,fresh,evidence);const rootRefs:any[]=[];
 for(const root of input.sourceRoots){const p=root.registeredPathRef,sourceRef=p.kind==='SOURCE_ROOT_DECLARATION'?p.sourceRootRef:await this.#snapshot(db,a,pid,p.snapshotRef,root,p.hostRef),source=await this.roots.read(db,a,pid,sourceRef.id,sourceRef.version);if(!source.rawAllowed||!same(source.ref,sourceRef)||source.ref.id!==root.sourceRootId||source.status!=='DECLARED'||fresh&&source.headVersion!==sourceRef.version)environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);const connector=source.snapshot.declaration.connectorId;if(connector!==null&&(p.hostRef.kind!=='CONNECTOR_STATUS'||p.hostRef.connectorRef.id!==connector))environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);if(root.identityRef!==null){const identityRoot=await this.#snapshot(db,a,pid,root.identityRef.snapshotRef,root,p.hostRef);if(!same(identityRoot,sourceRef))environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);}rootRefs.push({ref:sourceRef,hostRef:p.hostRef});}
 const secrets=new Map<string,MetadataSnapshot>();for(const r of input.secretRefs){const s=await this.#resource(db,a,pid,'SECRET_REFERENCE_METADATA',r.ref,fresh);if(!hosts.some(h=>same(h,s.definition.hostRef)))environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);secrets.set(canonicalJson(r),s);}
 for(const r of input.commandProfileRefs){const p=await this.#resource(db,a,pid,'COMMAND_PROFILE_METADATA',r.ref,fresh),d=p.definition;if(!hosts.some(h=>same(h,d.hostRef))||!rootRefs.some(root=>same(root.ref,d.workingDirectory.sourceRootRef)&&same(root.hostRef,d.hostRef)))environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);for(const slot of d.secretSlots){const secret=secrets.get(canonicalJson(slot.secretRef));if(!secret||!same(secret.definition.hostRef,d.hostRef))environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);}}
 }
 /** S/Q가 선택한 환경의 하위 원문과 P2 보호 읽기를 대조한다. 등록의 live 관측은 호출자가 같은 Tx에서 결박한다. */
 async readOriginReuseReferences(db:PoolClient,a:AuthenticatedIdentity,pid:string,input:EnvironmentVersion,evidence:unknown[],p2:RuntimeRefV1,readers:OriginReuseReferenceReaders){
  const reject=()=>environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);
  const resources=this.resources,roots=this.roots,observations=this.observations;
  if(Object.getPrototypeOf(resources)!==ProjectEnvironmentResources.prototype||Object.hasOwn(resources,'readOriginReuseMetadata')
   ||Object.getPrototypeOf(roots)!==ProjectSourceRoots.prototype||Object.hasOwn(roots,'read')
   ||Object.getPrototypeOf(observations)!==SourceReadRecords.prototype||Object.hasOwn(observations,'readSnapshot')||Object.hasOwn(observations,'load'))return reject();
  const {readMetadata,readRoot,readSnapshot,loadSnapshotGrant}=readers;
  // readSnapshot 내부의 this.load도 원 grant reader로 고정한다.
  const snapshotReaders=Object.freeze(Object.defineProperties(new SourceReadRecords(observations.installationId),{
   readSnapshot:{value:readSnapshot},
   load:{value:loadSnapshotGrant}
  })) as SourceReadRecords;
  let validUntil=Infinity;
  const dependencies=new Map<string,{kind:MetadataKind|'SOURCE_ROOT_DECLARATION';ref:RuntimeRefV1}>();
  const collect=(kind:MetadataKind|'SOURCE_ROOT_DECLARATION',ref:RuntimeRefV1)=>{
   const key=kind+':'+ref.id,previous=dependencies.get(key);
   if(previous&&!same(previous.ref,ref))return reject();
   if(!previous)dependencies.set(key,{kind,ref:{id:ref.id,version:ref.version,contentHash:ref.contentHash}});
  };
  const metadata=async(kind:MetadataKind,ref:RuntimeRefV1)=>{
   const stored=await readMetadata.call(resources,db,a,pid,kind,ref,input.policyRef,p2);
   validUntil=Math.min(validUntil,stored.validUntil);
   collect(kind,{id:stored.snapshot.id,version:stored.snapshot.version,contentHash:contentHash(canonicalJson(stored.snapshot))});
   return stored;
  };
  type ConnectorHost=Extract<HostRef,{kind:'CONNECTOR_STATUS'}>;
  const evidenceKey=(host:ConnectorHost)=>canonicalJson([host.connectorRef,host.registrationRef]);
  const history=new Map<string,Record<string,unknown>>();
  for(const item of evidence){
   if(!item||typeof item!=='object'||!('connectorRef' in item)||!('registrationRef' in item))return reject();
   const key=canonicalJson([item.connectorRef,item.registrationRef]);
   if(history.has(key))return reject();
   history.set(key,item as Record<string,unknown>);
  }
  const registrations=new Map<string,{host:ConnectorHost;history:Record<string,unknown>}>();
  const seenHosts=new Map<string,HostRef>(),seenRegistrations=new Map<string,ConnectorHost>();
  const declarations=new Map<string,{kind:string;evidenceKey:string|null}>();
  const exactHost=(h:HostRef)=>{
   const id=hostId(h),previous=seenHosts.get(id);
   if(previous&&!same(previous,h))return reject();
   seenHosts.set(id,h);
  };
  const assertHostEvidence=(stored:unknown[],key:string|null)=>{
   if(key===null){if(stored.length!==0)return reject();return;}
   if(stored.length!==1)return reject();
   const item=stored[0];
   if(!item||typeof item!=='object'||!('connectorRef'in item)||!('registrationRef'in item)
    ||canonicalJson([item.connectorRef,item.registrationRef])!==key)return reject();
  };
  const visitHost=async(h:HostRef,parent=false):Promise<string|null>=>{
   exactHost(h);
   if(h.kind==='CONNECTOR_STATUS'){
    const key=evidenceKey(h),proof=history.get(key),previous=seenRegistrations.get(h.registrationRef.id);
    if(!proof||previous&&!same(previous,h))return reject();
    seenRegistrations.set(h.registrationRef.id,h);
    registrations.set(key,{host:h,history:proof});
    return key;
   }
   const cached=declarations.get(h.ref.id);
   if(cached){if(parent&&cached.kind!=='MACHINE')return reject();return cached.evidenceKey;}
   const stored=await metadata('ENVIRONMENT_HOST_DECLARATION',h.ref),d=stored.snapshot.definition;
   if(parent&&d.hostKind!=='MACHINE')return reject();
   let key:string|null=null;
   if(d.hostKind==='WSL_DISTRIBUTION'){
    const parentHost=readEnvironmentHostRef(d.parentHostRef);
    if(hostId(parentHost)===h.ref.id)return reject();
    // 원 계약은 MACHINE 또는 connector 한 단계만 WSL 부모로 허용한다.
    key=await visitHost(parentHost,true);
   }
   assertHostEvidence(stored.evidence,key);
   declarations.set(h.ref.id,{kind:d.hostKind,evidenceKey:key});
   return key;
  };
  const hosts=[input.executionHostRef,...input.targetHostRefs,...input.sourceRoots.map(r=>r.registeredPathRef.hostRef)];
  const allowed=new Map<string,HostRef>();
  for(const host of hosts){
   const id=hostId(host),previous=allowed.get(id);
   if(previous&&!same(previous,host))return reject();
   allowed.set(id,host);
  }
  const keys=new Map<string,string|null>();
  for(const host of allowed.values())keys.set(hostId(host),await visitHost(host));
  if(history.size!==registrations.size)return reject();
  const hostKey=(raw:unknown)=>{
   const h=readEnvironmentHostRef(raw);
   if(!same(allowed.get(hostId(h))??null,h))return reject();
   return keys.get(hostId(h))!;
  };
  const rootRefs=new Map<string,{ref:RuntimeRefV1;host:HostRef}>();
  for(const root of input.sourceRoots){
   const path=root.registeredPathRef;
   const ref=path.kind==='SOURCE_ROOT_DECLARATION'?path.sourceRootRef:await this.#snapshot(db,a,pid,path.snapshotRef,root,path.hostRef,snapshotReaders);
   if(rootRefs.has(root.sourceRootId)||ref.id!==root.sourceRootId)return reject();
   const source=await readRoot.call(roots,db,a,pid,ref.id,ref.version);
   if(!source.rawAllowed||!same(source.ref,ref)||source.headVersion!==ref.version||source.status!=='DECLARED'||source.readiness!=='UNVERIFIED')return reject();
   const connector=source.snapshot.declaration.connectorId;
   if(connector!==null&&(path.hostRef.kind!=='CONNECTOR_STATUS'||path.hostRef.connectorRef.id!==connector))return reject();
   if(root.identityRef!==null&&!same(await this.#snapshot(db,a,pid,root.identityRef.snapshotRef,root,path.hostRef,snapshotReaders),ref))return reject();
   rootRefs.set(root.sourceRootId,{ref,host:path.hostRef});
   collect('SOURCE_ROOT_DECLARATION',source.ref);
  }
  const secrets=new Map<string,HostRef>();
  for(const secret of input.secretRefs){
   const stored=await metadata('SECRET_REFERENCE_METADATA',secret.ref),host=readEnvironmentHostRef(stored.snapshot.definition.hostRef);
   assertHostEvidence(stored.evidence,hostKey(host));
   const key=canonicalJson(secret);
   if(secrets.has(key))return reject();
   secrets.set(key,host);
  }
  const profiles=new Set<string>();
  for(const profile of input.commandProfileRefs){
   const stored=await metadata('COMMAND_PROFILE_METADATA',profile.ref),d=stored.snapshot.definition,host=readEnvironmentHostRef(d.hostRef);
   const root=rootRefs.get(d.workingDirectory.sourceRootRef.id);
   assertHostEvidence(stored.evidence,hostKey(host));
   if(profiles.has(profile.ref.id)||!root||!same(root.ref,d.workingDirectory.sourceRootRef)||!same(root.host,host))return reject();
   profiles.add(profile.ref.id);
   for(const slot of d.secretSlots)if(!same(secrets.get(canonicalJson(slot.secretRef))??null,host))return reject();
  }
  if(!Number.isFinite(validUntil))return reject();
  const orderedDependencies=[...dependencies.keys()].sort().map(key=>dependencies.get(key)!);
  return {validUntil,dependencies:orderedDependencies,registrations:[...registrations.values()].sort((a,b)=>a.host.connectorRef.id.localeCompare(b.host.connectorRef.id))};
 }
 async command(token:string,csrf:string,raw:ProjectCommand){const started=performance.now(),c=readEnvironmentCommand(raw,'ENVIRONMENT_VERSION');let input:EnvironmentInput;try{input=readEnvironmentInput(c.payload.environment);}catch{environmentFailure('ENVIRONMENT_INPUT_INVALID',422);}try{return await this.access.authenticated(token,csrf,async(db,a)=>{await currentProjectController(db,a,c);if(!a.reauthUntil||a.reauthUntil.getTime()<=Date.now())environmentFailure('REAUTHENTICATION_REQUIRED',412);const policy=await authorizeMaterial(db,a,c,true);
 const approvals=new ProjectApprovals();
 const check=environmentWriteGuard(db,a,c,policy,started);await check();const previous=await projectReplay(db,a,c);if(previous!==undefined){const result=previous as any,old=await loadEnvironmentWriteRow(db,a,c);if(!old||!same(old.ref,result.data.ref)||!same(old.snapshot,result.data.snapshot))environmentFailure();await check();return result;}
 if(policy.approvalRequired)await approvals.authorize(db,a,c,policy.ref);else if(c.approvalRef!==null)environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);
 if(!same(input.policyRef,policy.ref))environmentFailure('ENVIRONMENT_VERSION_CONFLICT',409);const old=await loadEnvironmentWriteRow(db,a,c);if(old&&(!same(old.ref,c.payload.baseRef)||old.headVersion!==old.ref.version))environmentFailure('ENVIRONMENT_VERSION_CONFLICT',409);const evidence:any[]=[];await this.references(db,a,c.projectId,input,true,evidence);await check();const body={id:old?.ref.id??randomUUID(),version:c.expectedVersion+1,...input},snapshot={...body,contentHash:environmentHash(body)},result=await insertEnvironmentVersion(db,a,c,'ENVIRONMENT_VERSION',snapshot,evidence,policy.ref);await check();return result;
 });}catch(e){if(e instanceof AuthFailure)throw e;return environmentFailure();}}
 async history(db:PoolClient,a:AuthenticatedIdentity,pid:string,id:string,version:number){await environmentOwner(db,a,pid);const v=await loadEnvironmentRow(db,a,pid,'ENVIRONMENT_VERSION',id,version),snapshot=v.snapshot as EnvironmentVersion;await assertEnvironmentHistoryProof(db,a,pid,'ENVIRONMENT_VERSION',v.ref);return{...v,snapshot};}
 async read(db:PoolClient,a:AuthenticatedIdentity,pid:string,id:string,version:number){const policy=await environmentReadPolicy(db,a,pid,'ENVIRONMENT_VERSION'),v=await this.history(db,a,pid,id,version),issues:any[]=[];let unavailable=false;const add=(value:{issues:any[];unavailable:boolean})=>{issues.push(...value.issues);unavailable=unavailable||value.unavailable;};if(v.headVersion!==version)issues.push({code:'HEAD_CHANGED',target:{kind:'ENVIRONMENT_VERSION',ref:v.ref}});if(!same(policy.ref,v.snapshot.policyRef))issues.push({code:'POLICY_CHANGED',target:{kind:'PERMISSION_POLICY',ref:v.snapshot.policyRef}});
 const input=v.snapshot,hosts=[input.executionHostRef,...input.targetHostRefs,...input.sourceRoots.map(root=>root.registeredPathRef.hostRef)];for(const host of new Map(hosts.map(h=>[canonicalJson(h),h])).values())add(await this.resources.currentHost(db,a,pid,host));
 for(const root of input.sourceRoots){const p=root.registeredPathRef;try{const ref=p.kind==='SOURCE_ROOT_DECLARATION'?p.sourceRootRef:await this.#snapshot(db,a,pid,p.snapshotRef,root,p.hostRef);add(await this.resources.currentSource(db,a,pid,ref));if(root.identityRef!==null)await this.#snapshot(db,a,pid,root.identityRef.snapshotRef,root,p.hostRef);}catch{add({issues:[{code:'CURRENT_REFERENCE_UNAVAILABLE',target:p.kind==='SOURCE_ROOT_DECLARATION'?{kind:'SOURCE_ROOT_DECLARATION',ref:p.sourceRootRef}:{kind:'SOURCE_SNAPSHOT',ref:p.snapshotRef}}],unavailable:true});}}
 for(const item of input.commandProfileRefs)add(await this.resources.currentMetadata(db,a,pid,'COMMAND_PROFILE_METADATA',item.ref));for(const item of input.secretRefs)add(await this.resources.currentMetadata(db,a,pid,'SECRET_REFERENCE_METADATA',item.ref));issues.push({code:'OBSERVATION_UNVERIFIED',target:null});const currentIssues=uniqueEnvironmentIssues(issues);return{projectId:pid,kind:'ENVIRONMENT_VERSION',ref:v.ref,snapshot:v.snapshot,historyVerification:'STORED_CONFIGURATION_VERIFIED',current:{headVersion:v.headVersion,configurationCurrentness:unavailable?'UNAVAILABLE':currentIssues.some(i=>i.code!=='OBSERVATION_UNVERIFIED')?'CHANGED':'MATCHED',issues:currentIssues,checkedAt:new Date().toISOString()},executionEligible:false,dispatchPerformed:false,observedAt:new Date().toISOString()};}
 async list(db:PoolClient,a:AuthenticatedIdentity,pid:string,query:Record<string,unknown>,codec:any){return this.resources.list(db,a,pid,'ENVIRONMENT_VERSION',query,codec);}
}

/** 완성형 환경 원문 전용. 후보 namespace나 실행 권한으로 대체하지 않는다. */
export class EnvironmentApprovalCandidates{
 async assertCurrent(db:PoolClient,a:AuthenticatedIdentity,pid:string,scope:ApprovalScope,value:unknown){
  const payload=readEnvironmentApprovalPayload(value,scope.payloadHash),c=readEnvironmentCommand({schemaVersion:1,projectId:pid,commandId:'00000000-0000-4000-8000-000000000001',clientId:a.clientId,controlGeneration:scope.controlGeneration,operation:'saveEnvironment',targetId:payload.baseRef?.id??null,expectedVersion:payload.baseRef?.version??0,baselineRefs:[],approvalRef:null,payload},'ENVIRONMENT_VERSION');
  if(scope.operation!=='saveEnvironment'||!same(scope.targetRef,payload.baseRef)||scope.expectedVersion!==c.expectedVersion||scope.baselineRefs.length||scope.environmentRef!==null||scope.sourceScopes.length||scope.limitsRef!==null||!same(scope.requestedSubjectRef,{kind:'HUMAN',userId:a.actorId,clientId:a.clientId}))environmentFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  await environmentOwner(db,a,pid);await currentProjectController(db,a,c);const policy=await authorizeMaterial(db,a,c,true);if(!policy.approvalRequired||!same(policy.ref,payload.environment.policyRef))environmentFailure('APPROVAL_BASIS_NOT_CURRENT',412);
  const checked=(await db.query('SELECT anvil.environment_approval_target($1,$2,$3,$4,$5,$6) AS valid',[a.authSession?.id,a.actorId,a.clientId,pid,JSON.stringify(payload),scope.controlGeneration])).rows;if(checked.length!==1||checked[0].valid!==true)environmentFailure('ENVIRONMENT_REFERENCE_UNAVAILABLE',412);return payload;
 }
 async capture(db:PoolClient,a:AuthenticatedIdentity,input:{command:ProjectCommand;requestId:string;serverCommandId:string;policyRef:any;details:ApprovalDetails;payload:unknown}){
  const c=input.command,d=input.details,payload=await this.assertCurrent(db,a,c.projectId,d.actionScope,input.payload),projection=environmentApprovalProjection({projectId:c.projectId,requestId:input.requestId,requestCommandId:input.serverCommandId,candidateCommandId:d.candidateCommandId,payloadHash:d.actionScope.payloadHash,payload,createdBy:a.actorId,clientId:a.clientId,controlGeneration:c.controlGeneration,policyRef:input.policyRef});
  if(c.operation!=='requestApproval'||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null||c.baselineRefs.length||c.clientId!==a.clientId||!same(c.payload,{details:d,candidatePayload:payload}))environmentFailure('APPROVAL_CANDIDATE_MISMATCH',409);
  if(Buffer.byteLength(canonicalJson(payload))>2097152||Buffer.byteLength(canonicalJson(projection))>2097152)environmentFailure('ENVIRONMENT_INPUT_INVALID',422);
  const rows=(await db.query('SELECT anvil.environment_approval_capture($1,$2,$3,$4,$5) AS captured',[a.authSession?.id,a.actorId,a.clientId,c.projectId,JSON.stringify(projection)])).rows;if(rows.length!==1||rows[0].captured!==true)environmentFailure('ENVIRONMENT_APPROVAL_INTEGRITY_FAILED',503);
 }
 async read(db:PoolClient,a:AuthenticatedIdentity,pid:string,id:string,meta:any){
  await environmentOwner(db,a,pid);if(a.actorId!==meta.createdBy)environmentFailure('NOT_FOUND',404);
  const rows=(await db.query('SELECT anvil.environment_approval_candidate($1,$2,$3,$4,$5) AS value',[a.authSession?.id,a.actorId,a.clientId,pid,id])).rows;
  try{if(rows.length!==1||!rows[0].value)throw Error();const v=rows[0].value,payload=readEnvironmentApprovalPayload(v.payload,meta.details.actionScope.payloadHash),expected=environmentApprovalProjection({projectId:pid,requestId:id,requestCommandId:meta.serverCommandId,candidateCommandId:meta.details.candidateCommandId,payloadHash:meta.details.actionScope.payloadHash,payload,createdBy:meta.createdBy,clientId:meta.clientId,controlGeneration:meta.controlGeneration,policyRef:meta.policyRef});if(!same(v,expected)||meta.details.actionScope.operation!=='saveEnvironment'||!same(meta.details.actionScope.targetRef,payload.baseRef)||meta.details.actionScope.expectedVersion!==(payload.baseRef?.version??0))throw Error();return{kind:'ENVIRONMENT_DEFINITION' as const,payload,payloadHash:expected.payloadHash};}catch{environmentFailure('ENVIRONMENT_APPROVAL_INTEGRITY_FAILED',503);}
 }
}
export function readEnvironmentApprovalPayload(value:unknown,hash:string){const c=readEnvironmentCommand({schemaVersion:1,projectId:'00000000-0000-4000-8000-000000000001',commandId:'00000000-0000-4000-8000-000000000002',clientId:'00000000-0000-4000-8000-000000000003',controlGeneration:1,operation:'saveEnvironment',targetId:(value as any)?.baseRef?.id??null,expectedVersion:(value as any)?.baseRef?.version??0,baselineRefs:[],approvalRef:null,payload:value},'ENVIRONMENT_VERSION'),payload=c.payload as any;payload.environment=readEnvironmentInput(payload.environment);if(contentHash(canonicalJson(payload))!==hash)environmentFailure('APPROVAL_CANDIDATE_MISMATCH',409);return payload as {environment:EnvironmentInput;baseRef:any;reason:string};}
export function environmentApprovalProjection(v:any){return{projectId:v.projectId,requestId:v.requestId,requestCommandId:v.requestCommandId,candidateCommandId:v.candidateCommandId,payloadHash:v.payloadHash,payload:v.payload,createdBy:v.createdBy,clientId:v.clientId,controlGeneration:v.controlGeneration,policyRef:v.policyRef};}
