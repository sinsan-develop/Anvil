import type {PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {readServerExecutionFactV1,type ServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import type {AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import {readExecutionPreparationInput,compileExecutionPreparationOptions} from './preparation-input.ts';
import {readStartMaterialDescriptor,readPreparedStartMaterial,startMaterialHash as hash,startMaterialSame as same,type PreparedStartMaterial,type StartMaterialDescriptor} from './execution-start-material-registration-input.ts';
import {readStartQueueRecord,assertStartFact,type StartQueueRecord} from './execution-start-material-basis.ts';
import {materialReject as reject,assertMaterialCapacity,readMaterialScope,type MaterialScope} from './execution-material-registration-input.ts';
import type {SyntheticInstructionMaterialResults} from './execution-instruction-material-store.ts';
import {executionTarget} from './execution-proof.ts';
import {readMaterialCredentialBasis} from './execution-material-credential-basis.ts';
import {SyntheticStartMaterialParts} from './execution-start-material-parts.ts';
export interface SyntheticStartMaterialSource {
 readonly transport:'SYNTHETIC_ONLY';
 describe(db:PoolClient,actor:AuthenticatedIdentity,scope:MaterialScope,request:ProjectCommand,binding:unknown):Promise<unknown>;
 /** 명시 합성 원 source/current 포트다. 실제 supplier/보호 reader의 기본 구현은 제공하지 않는다.
  * preparation은 원 보호 reader의 projectId/ref/snapshot/currentness 원형을 그대로 전달한다. */
 inspect(db:PoolClient,scope:MaterialScope,descriptor:StartMaterialDescriptor,basis:unknown):Promise<unknown>;
 readBody(db:PoolClient,scope:MaterialScope,selection:unknown):Promise<Uint8Array>;
}
export interface StartRegistration {
 scope:MaterialScope;command:StartQueueRecord;descriptor:StartMaterialDescriptor;manifestRef:Ref;
 material:{ref:Ref;snapshot:Record<string,any>};groupIndex:number;fact:ServerExecutionFactV1;grantExpiresAt:string;createdCommandId:string;
}
type Grant={ref:Ref;snapshot:Record<string,any>};
interface PreparedContext {db:PoolClient;tx:string;actor:AuthenticatedIdentity;request:ProjectCommand;fact:ServerExecutionFactV1;grant:Grant;plan:PreparedStartMaterial;used:boolean}
const basis=(f:ServerExecutionFactV1)=>({subject:f.subject,permissionPolicyRef:f.permissionPolicyRef,basisRefs:f.basisRefs,latestInstructionRefs:f.latestInstructionRefs});
const stable=(f:ServerExecutionFactV1)=>{const {checkedAt:_,expires:__,writerState:___,...rest}=f;return rest;};
const small=(s:MaterialScope)=>({projectId:s.projectId,executionId:s.executionId,executionGeneration:s.executionGeneration});
/** START 등록을 caller의 원 Tx에만 저장한다. source 부재의 성공 fallback/별도 Tx는 없다. */
export class SyntheticPgStartMaterialRegistration implements SyntheticInstructionMaterialResults {
 readonly transport='SYNTHETIC_ONLY' as const;readonly source:SyntheticStartMaterialSource;
 readonly #prepared=new WeakMap<object,PreparedContext>();
 constructor(source:SyntheticStartMaterialSource){this.source=source;this.#port();}
 #port(){if(this.source?.transport!=='SYNTHETIC_ONLY'||['describe','inspect','readBody'].some(k=>typeof(this.source as any)[k]!=='function'))return reject('MATERIAL_REGISTRATION_REQUIRED');}
 async clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return reject('MATERIAL_REGISTRATION_INTEGRITY',503);return at.toISOString();}
 async #tx(db:PoolClient){const r=(await db.query('SELECT txid_current()::text AS transaction_id')).rows[0]?.transaction_id;if(typeof r!=='string'||!/^[1-9][0-9]*$/.test(r))return reject('MATERIAL_REGISTRATION_INTEGRITY',503);return r;}
 async #sameTx(db:PoolClient,tx:string){if(await this.#tx(db)!==tx)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);}
 #scope(f:ServerExecutionFactV1,g:Grant):MaterialScope{return readMaterialScope({mode:'EXECUTION',...small(f as any),connectorId:f.registration.connectorId,grantRef:g.ref,credentialGeneration:f.subject.credentialGeneration});}
 #grant(raw:unknown,s:MaterialScope):Grant{
  if(!recordV1(raw,['ref','snapshot'])||!refV1(raw.ref)||raw.ref.version!==1||!same(raw.ref,s.grantRef)||!recordV1(raw.snapshot,['kind','state','transport','binding','allowedOperations','expiresAt','scopeDigest','factHash','plannedAt','executionAuthorized','dispatchPerformed']))return reject();
  const g=raw.snapshot,f=readServerExecutionFactV1(g.binding);
  if(raw.ref.contentHash!==hash(g)||g.kind!=='EXECUTION'||g.state!=='SYNTHETIC_PLAN'||g.transport!=='SYNTHETIC_ONLY'||g.executionAuthorized!==false||g.dispatchPerformed!==false||!same(g.allowedOperations,['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'])||!isoV1(g.expiresAt)||!isoV1(g.plannedAt)||g.factHash!==hash(f)||g.scopeDigest!==hash({binding:f,allowedOperations:g.allowedOperations,expiresAt:g.expiresAt})||!same(this.#scope(f,raw as any),s)||Date.parse(g.expiresAt)>Math.min(...Object.values(f.expires).map(Date.parse)))return reject();
  return cloneV1(raw) as Grant;
 }
 async inspect(db:PoolClient,scope:MaterialScope,plan:PreparedStartMaterial,savedFact:ServerExecutionFactV1,grantExpiresAt:string){
  this.#port();const arg=cloneV1(scope),descriptor=cloneV1(plan.descriptor),b=cloneV1(basis(savedFact)),raw=cloneV1(await this.source.inspect(db,arg,descriptor,b));this.#port();
  const now=Date.parse(await this.clock(db));
  if(!same(arg,scope)||!same(descriptor,plan.descriptor)||!same(b,basis(savedFact))||!recordV1(raw,['scope','descriptorHash','basis','fact','preparation','access','quarantined','superseded','excluded','checkedAt','expiresAt'])||!same(raw.scope,scope)||raw.descriptorHash!==plan.manifestRef.contentHash||!same(raw.basis,basis(savedFact))||raw.access!=='READ'||raw.quarantined!==false||raw.superseded!==false||raw.excluded!==false||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>now||now-Date.parse(raw.checkedAt)>30000)return reject('MATERIAL_REGISTRATION_CURRENT_REQUIRED');
  const fact=readServerExecutionFactV1(raw.fact),prep=raw.preparation;
  if(!same(stable(fact),stable(savedFact))||Date.parse(fact.checkedAt)>now||now-Date.parse(fact.checkedAt)>30000||!recordV1(prep,['projectId','ref','snapshot','currentness'])||prep.projectId!==scope.projectId||!same(prep.ref,plan.descriptor.payload.optionsRef)||!same(prep.ref,fact.preparationRef)||prep.currentness!=='NOT_RECHECKED'||!recordV1(prep.snapshot,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed','options'])||hash(prep.snapshot)!==prep.ref.contentHash)return reject('MATERIAL_REGISTRATION_CURRENT_REQUIRED');
  const input=readExecutionPreparationInput(prep.snapshot.intent),{connectionKind:_,optionsFormat:__,...runtime}=input as any,o=prep.snapshot.options;
  if(!('connectionKind'in input)||!same(runtime,fact.intent)||!same(prep.snapshot.basisRefs,fact.basisRefs)||!same(prep.snapshot.latestInstructionRefs,fact.latestInstructionRefs)||!same(prep.snapshot.preparedBy,{kind:'HUMAN',userId:fact.subject.userId})||prep.snapshot.authorizationState!=='NOT_AUTHORIZED'||prep.snapshot.executionAuthorized!==false||prep.snapshot.dispatchPerformed!==false||!isoV1(prep.snapshot.checkedAt)||Date.parse(prep.snapshot.checkedAt)>now||!recordV1(o,['format','mediaType','body','utf8Bytes','contentHash'])||typeof o.body!=='string')return reject();
  const compiled=compileExecutionPreparationOptions({adapterKind:'CLAUDE_AGENT_SDK',toolProduct:'Claude Code',modelOptions:parseWireJson(o.body)});
  const group=plan.descriptor.groups[1];
  if(!same(o,compiled)||o.format!==input.optionsFormat||!same(group.source.sourceRef,prep.ref)||o.contentHash!==group.source.contentHash||o.utf8Bytes!==group.source.sourceBytes)return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');
  const validUntil=new Date(Math.min(Date.parse(raw.expiresAt),Date.parse(raw.checkedAt)+30000,Date.parse(fact.checkedAt)+30000,Date.parse(plan.descriptor.expiresAt),Date.parse(grantExpiresAt),...Object.values(savedFact.expires).map(Date.parse),...Object.values(fact.expires).map(Date.parse))).toISOString();
  if(Date.parse(validUntil)<=now)return reject('MATERIAL_REGISTRATION_CURRENT_REQUIRED');
  return{fact,validUntil,options:compiled};
 }
 async prepare(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,rawFact:ServerExecutionFactV1,rawGrant:Grant){
  this.#port();const tx=await this.#tx(db),fact=readServerExecutionFactV1(rawFact),s=this.#scope(fact,rawGrant),grant=this.#grant(rawGrant,s),a=actor.authSession;
  if(!a||actor.actorId!==fact.subject.userId||actor.clientId!==fact.subject.clientId||a.id!==fact.subject.humanSessionId||actor.credentialGeneration!==s.credentialGeneration||request.projectId!==s.projectId||request.clientId!==actor.clientId||request.controlGeneration!==fact.subject.controlGeneration)return reject();
  const r=cloneV1(request),arg=cloneV1(s),f=cloneV1(fact),raw=await this.source.describe(db,cloneV1(actor),arg,r,f),plan=readStartMaterialDescriptor(raw);this.#port();
  if(!same(arg,s)||!same(r,request)||!same(f,fact)||!same(plan.descriptor.scope,s)||plan.descriptor.commandId!==request.commandId||!same(plan.descriptor.payload,(request.payload as any).payload)||!same(plan.descriptor.payload.contextBundleRef,fact.intent.contextBundleRef)||!same(plan.descriptor.payload.optionsRef,fact.preparationRef)||Date.parse(plan.descriptor.expiresAt)>Date.parse(grant.snapshot.expiresAt))return reject('MATERIAL_REGISTRATION_BINDING_CONFLICT');
  await this.inspect(db,s,plan,fact,grant.snapshot.expiresAt);await this.#sameTx(db,tx);
  this.#prepared.set(plan,{db,tx,actor:cloneV1(actor),request:cloneV1(request),fact,grant,plan:cloneV1(plan),used:false});return plan;
 }
 async #capacity(db:PoolClient,s:MaterialScope,rows:unknown[]){
  await db.query('SELECT id FROM anvil.projects WHERE id=$1::uuid FOR UPDATE',[s.projectId]);
  const q=(await db.query('SELECT count(*)::bigint AS project_count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(snapshot_json))),0)::bigint AS project_bytes,count(*) FILTER (WHERE grant_id=$2::uuid)::bigint AS grant_count,COALESCE(sum(octet_length(anvil.execution_authority_canonical(snapshot_json))) FILTER (WHERE grant_id=$2::uuid),0)::bigint AS grant_bytes FROM (SELECT grant_id,snapshot_json FROM anvil.execution_material_manifests WHERE project_id=$1::uuid UNION ALL SELECT grant_id,snapshot_json FROM anvil.execution_materials WHERE project_id=$1::uuid UNION ALL SELECT grant_id,snapshot_json FROM anvil.execution_material_proof_bindings WHERE project_id=$1::uuid) all_rows',[s.projectId,s.grantRef.id])).rows[0];
  if(!q)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);assertMaterialCapacity({projectCount:Number(q.project_count),projectBytes:Number(q.project_bytes),grantCount:Number(q.grant_count),grantBytes:Number(q.grant_bytes)},rows.length,rows.reduce<number>((n,r)=>n+Buffer.byteLength(canonicalJson(r)),0));
 }
 material(plan:PreparedStartMaterial,record:StartQueueRecord,groupIndex:number,partIndex:number){
  const d=plan.descriptor,g=d.groups[groupIndex]!,p=g.parts[partIndex]!,s=d.scope,snapshot={...small(s),commandId:d.commandId,envelopeHash:record.snapshot.envelope.envelopeHash,payloadRef:g.payloadRef,sourceRef:g.source.sourceRef,partIndex:p.partIndex,partCount:g.parts.length,byteOffset:p.byteOffset,sourceBytes:g.source.sourceBytes,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash,mediaType:g.source.mediaType};
  return{ref:{id:p.materialId,version:1,contentHash:hash(snapshot)},snapshot};
 }
 async register(db:PoolClient,raw:PreparedStartMaterial,rawRecord:StartQueueRecord,createdCommandId:string){
  this.#port();const c=this.#prepared.get(raw);if(!c||c.db!==db||c.used||!uuidV1(createdCommandId)||!same(c.plan,readPreparedStartMaterial(raw)))return reject('MATERIAL_REGISTRATION_INTEGRITY',503);c.used=true;await this.#sameTx(db,c.tx);
  const p=c.plan,d=p.descriptor,s=d.scope,record=readStartQueueRecord(rawRecord,s,await this.clock(db));
  assertStartFact(c.fact,s,record,await this.clock(db));
  if(record.snapshot.envelope.commandId!==d.commandId||!same(record.snapshot.payload,d.payload)||record.snapshot.envelope.expiresAt!==c.grant.snapshot.expiresAt)return reject();
  const materials=d.groups.flatMap((g,gi)=>g.parts.map((_,pi)=>this.material(p,record,gi,pi)));await this.#capacity(db,s,[d,...materials.map(m=>m.snapshot)]);await this.inspect(db,s,p,c.fact,c.grant.snapshot.expiresAt);
  const out=await db.query('INSERT INTO anvil.execution_material_manifests(project_id,id,version,execution_id,generation,grant_id,grant_version,credential_generation,command_id,created_command_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[s.projectId,d.id,s.executionId,s.executionGeneration,s.grantRef.id,s.grantRef.version,s.credentialGeneration,d.commandId,createdCommandId,p.manifestRef.contentHash,JSON.stringify(d)]);if(out.rowCount!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  for(const m of materials){const r=await db.query('INSERT INTO anvil.execution_materials(project_id,id,version,manifest_id,execution_id,generation,grant_id,grant_version,credential_generation,command_id,command_record_id,created_command_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[s.projectId,m.ref.id,d.id,s.executionId,s.executionGeneration,s.grantRef.id,s.grantRef.version,s.credentialGeneration,d.commandId,record.ref.id,createdCommandId,m.ref.contentHash,JSON.stringify(m.snapshot)]);if(r.rowCount!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);}
  await this.assertRegistered(db,c.actor,c.request,record);await this.#sameTx(db,c.tx);return materials;
 }
 async #find(db:PoolClient,rawScope:MaterialScope,where:string,args:unknown[]):Promise<StartRegistration|null>{
  this.#port();const s=readMaterialScope(rawScope),rows=(await db.query('SELECT m.*,d.content_hash manifest_hash,d.snapshot_json descriptor,e.content_hash command_record_hash,e.snapshot_json command_snapshot,g.snapshot_json grant_snapshot,g.content_hash grant_hash FROM anvil.execution_materials m JOIN anvil.execution_material_manifests d ON d.project_id=m.project_id AND d.id=m.manifest_id JOIN anvil.execution_commands e ON e.project_id=m.project_id AND e.id=m.command_record_id AND e.version=1 JOIN anvil.execution_grants g ON g.project_id=m.project_id AND g.id=m.grant_id AND g.version=m.grant_version WHERE m.project_id=$1::uuid AND '+where+' LIMIT 2',[s.projectId,...args])).rows;
  if(!rows.length)return null;if(rows.length!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const r=rows[0],p=readStartMaterialDescriptor(r.descriptor),d=p.descriptor,record=readStartQueueRecord({ref:{id:r.command_record_id,version:1,contentHash:r.command_record_hash},snapshot:r.command_snapshot},s,r.command_snapshot?.queuedAt),grant=this.#grant({ref:{id:r.grant_id,version:Number(r.grant_version),contentHash:r.grant_hash},snapshot:r.grant_snapshot},s),gi=d.groups.findIndex(g=>g.parts.some(part=>part.materialId===r.id)),g=d.groups[gi],pi=g?.parts.findIndex(part=>part.materialId===r.id);
  if(!same(d.scope,s)||r.manifest_hash!==p.manifestRef.contentHash||r.manifest_id!==d.id||r.execution_id!==s.executionId||Number(r.generation)!==s.executionGeneration||r.grant_id!==s.grantRef.id||Number(r.grant_version)!==s.grantRef.version||Number(r.credential_generation)!==s.credentialGeneration||r.command_id!==d.commandId||record.snapshot.envelope.commandId!==d.commandId||!same(record.snapshot.payload,d.payload)||!g||pi===undefined||pi<0||Number(r.version)!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const complete=(await db.query('SELECT anvil.fn08_start_material_complete($1::uuid,$2::uuid) AS complete',[s.projectId,r.created_command_id])).rows;if(complete.length!==1||complete[0]?.complete!==true)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const m=this.material(p,record,gi,pi);if(!same(m.ref,{id:r.id,version:Number(r.version),contentHash:r.content_hash})||!same(m.snapshot,r.snapshot_json))return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  return{scope:s,command:record,descriptor:d,manifestRef:p.manifestRef,material:m,groupIndex:gi,fact:readServerExecutionFactV1(grant.snapshot.binding),grantExpiresAt:grant.snapshot.expiresAt,createdCommandId:r.created_command_id};
 }
 async findByCommand(db:PoolClient,s:MaterialScope,c:string,m:string){if(!uuidV1(c)||!uuidV1(m))return reject();return this.#find(db,s,'m.command_id=$2::uuid AND m.id=$3::uuid',[c,m]);}
 async findByRef(db:PoolClient,s:MaterialScope,r:Ref){if(!refV1(r)||r.version!==1)return reject();return this.#find(db,s,'m.id=$2::uuid AND m.version=$3::bigint AND m.content_hash=$4::text',[r.id,r.version,r.contentHash]);}
 async #assertStored(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,record:StartQueueRecord,fresh:boolean){
  this.#port();const q=record.snapshot,grants=(await db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1::uuid AND id=$2::uuid AND version=$3::bigint AND content_hash=$4::text LIMIT 2',[request.projectId,q.grantRef.id,q.grantRef.version,q.grantRef.contentHash])).rows;
  if(grants.length!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);const storedFact=readServerExecutionFactV1(grants[0].snapshot_json?.binding),s=readMaterialScope({mode:'EXECUTION',projectId:request.projectId,connectorId:storedFact.registration.connectorId,executionId:q.executionId,executionGeneration:q.executionGeneration,grantRef:q.grantRef,credentialGeneration:storedFact.subject.credentialGeneration});
  if(fresh&&actor.credentialGeneration!==s.credentialGeneration)return reject('MATERIAL_REGISTRATION_CURRENT_REQUIRED');
  const rows=(await db.query('SELECT d.snapshot_json,d.content_hash FROM anvil.execution_material_manifests d JOIN anvil.execution_commands e ON e.project_id=d.project_id AND e.created_command_id=d.created_command_id WHERE d.project_id=$1::uuid AND e.id=$2::uuid AND e.version=$3::bigint AND e.content_hash=$4::text LIMIT 2',[s.projectId,record.ref.id,record.ref.version,record.ref.contentHash])).rows;
  if(rows.length!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);const p=readStartMaterialDescriptor(rows[0].snapshot_json);if(rows[0].content_hash!==p.manifestRef.contentHash||!same(p.descriptor.scope,s)||!same(p.descriptor.payload,(request.payload as any).payload)||p.descriptor.commandId!==request.commandId)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const count=(await db.query('SELECT count(*)::bigint AS count FROM anvil.execution_materials WHERE project_id=$1::uuid AND manifest_id=$2::uuid',[s.projectId,p.descriptor.id])).rows[0];if(!count||Number(count.count)!==p.descriptor.groups.reduce((n,g)=>n+g.parts.length,0))return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const parts=new SyntheticStartMaterialParts(this);for(const g of p.descriptor.groups)for(const part of g.parts){const r=await this.findByCommand(db,s,request.commandId,part.materialId);if(!r||!same(r.command,record)||actor.actorId!==r.fact.subject.userId||actor.clientId!==r.fact.subject.clientId||fresh&&actor.authSession?.id!==r.fact.subject.humanSessionId)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);if(fresh){await parts.current(db,actor,s,request.commandId,part.materialId);await parts.readPart(db,s,r.material.ref);}}
 }
 async assertRegistered(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,record:StartQueueRecord){await this.#assertStored(db,actor,request,record,true);}
 async assertReplay(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,result:any){
  this.#port();if(result?.status!=='APPLIED'||result.projectId!==request.projectId||result.data?.status!=='SYNTHETIC_QUEUE_STORED'||!refV1(result.data.ref))return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const rows=(await db.query('SELECT content_hash,snapshot_json FROM anvil.execution_commands WHERE project_id=$1::uuid AND id=$2::uuid AND version=1 LIMIT 2',[request.projectId,result.data.ref.id])).rows;if(rows.length!==1||rows[0].content_hash!==result.data.ref.contentHash)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  const snapshot=rows[0].snapshot_json,{envelope:_,...q}=snapshot;
  if(!same(q,result.data.snapshot)||!same(snapshot.payload,(request.payload as any).payload)||snapshot.envelope?.commandId!==request.commandId)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
  await this.#assertStored(db,actor,request,{ref:result.data.ref,snapshot},false);
 }
 async #proof(db:PoolClient,s:MaterialScope,proof:Ref,target:unknown,consumed:boolean){
  const rows=(await db.query('SELECT r.*,c.content_hash challenge_hash,c.snapshot_json challenge_snapshot,v.content_hash consumed_hash,v.snapshot_json consumed_snapshot FROM anvil.execution_receipts r LEFT JOIN anvil.execution_challenges c ON c.project_id=r.project_id AND c.id=r.challenge_id AND c.version=1 LEFT JOIN anvil.execution_challenges v ON v.project_id=r.project_id AND v.id=r.challenge_id AND v.version=2 WHERE r.project_id=$1::uuid AND r.id=$2::uuid AND r.version=$3::bigint LIMIT 2',[s.projectId,proof.id,proof.version])).rows;
  if(rows.length!==1)return reject('MATERIAL_REGISTRATION_PROOF_INVALID',503);const r=rows[0],x=r.snapshot_json,c=r.challenge_snapshot,v=r.consumed_snapshot,credentials=await readMaterialCredentialBasis(db,s,'MATERIAL'),execution=credentials.executionScope;
  if(r.content_hash!==proof.contentHash||r.content_hash!==hash(x)||r.grant_id!==s.grantRef.id||Number(r.grant_version)!==s.grantRef.version||!recordV1(x,['kind','challengeRef','requestId','proofHash','recordedAt','credentialIssued','executionAuthorized','dispatchPerformed'])||x.kind!=='SYNTHETIC_PROOF_RESULT'||!refV1(x.challengeRef)||x.challengeRef.id!==r.challenge_id||x.challengeRef.version!==1||x.challengeRef.contentHash!==r.challenge_hash||x.credentialIssued!==false||x.executionAuthorized!==false||x.dispatchPerformed!==false||!isoV1(x.recordedAt)||!c||hash(c)!==r.challenge_hash||c.request?.requestId!==x.requestId||!same(c.request?.target,target)||!Object.keys(execution).every(k=>same(c.binding?.[k],(execution as any)[k]))||c.publicChallenge?.credentialGeneration!==execution.credentialGeneration||!same(c.publicChallenge?.grantRef,execution.grantRef)||c.request?.credentialGeneration!==execution.credentialGeneration||!same(c.request?.grantRef,execution.grantRef))return reject('MATERIAL_REGISTRATION_PROOF_INVALID',503);
  if(!isoV1(c.publicChallenge?.issuedAt)||Date.parse(credentials.reservation.snapshot_json.reservedAt)>Date.parse(c.publicChallenge.issuedAt))return reject('MATERIAL_REGISTRATION_PROOF_INVALID',503);
  if(consumed&&(!v||hash(v)!==r.consumed_hash||!same(v.consumption?.resultRef,proof)||v.consumption?.proofHash!==x.proofHash||!same(v.previousRef,x.challengeRef)||!same(v.binding,c.binding)||!same(v.request,c.request)))return reject('MATERIAL_REGISTRATION_BINDING_MISSING',503);
 }
 async #binding(db:PoolClient,s:MaterialScope,r:Ref){return(await db.query('SELECT * FROM anvil.execution_material_proof_bindings WHERE project_id=$1::uuid AND proof_result_id=$2::uuid AND proof_result_version=$3::bigint LIMIT 2',[s.projectId,r.id,r.version])).rows;}
 async bind(db:PoolClient,rawScope:MaterialScope,proof:Ref,binding:Parameters<SyntheticInstructionMaterialResults['bind']>[3]){
  this.#port();const s=readMaterialScope(rawScope);if(!refV1(proof)||proof.version!==1||!recordV1(binding,['target','materialRef','contentHash'])||!refV1(binding.materialRef))return reject();const r=await this.findByRef(db,s,binding.materialRef);if(!r)return reject();
  const target=executionTarget('GET','/api/v1/connectors/'+s.connectorId+'/executions/'+s.executionId+'/commands/'+r.descriptor.commandId+'/materials/'+binding.materialRef.id,[],null);if(!same(binding.target,target)||binding.contentHash!==r.material.snapshot.contentHash)return reject();
  await this.#proof(db,s,proof,target,false);const old=await this.#binding(db,s,proof);if(old.length){if(old.length!==1||!same(await this.read(db,s,proof),binding))return reject();return;}
  if((await db.query("SELECT id FROM anvil.execution_challenges WHERE project_id=$1::uuid AND snapshot_json->'consumption'->'resultRef'->>'id'=$2::text LIMIT 1",[s.projectId,proof.id])).rows.length)return reject('MATERIAL_REGISTRATION_BINDING_MISSING',503);
  const snapshot={scope:s,proofResultRef:proof,target,materialRef:cloneV1(binding.materialRef),contentHash:binding.contentHash};await this.#capacity(db,s,[snapshot]);const out=await db.query('INSERT INTO anvil.execution_material_proof_bindings(project_id,proof_result_id,proof_result_version,execution_id,generation,grant_id,grant_version,credential_generation,material_id,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[s.projectId,proof.id,proof.version,s.executionId,s.executionGeneration,s.grantRef.id,s.grantRef.version,s.credentialGeneration,binding.materialRef.id,hash(snapshot),JSON.stringify(snapshot)]);if(out.rowCount!==1)return reject('MATERIAL_REGISTRATION_INTEGRITY',503);
 }
 async read(db:PoolClient,rawScope:MaterialScope,proof:Ref){
  this.#port();const s=readMaterialScope(rawScope);if(!refV1(proof)||proof.version!==1)return reject();const rows=await this.#binding(db,s,proof);if(!rows.length)return null;if(rows.length!==1)return reject();const r=rows[0],v=r.snapshot_json;
  if(!recordV1(v,['scope','proofResultRef','target','materialRef','contentHash'])||!same(v.scope,s)||!same(v.proofResultRef,proof)||r.content_hash!==hash(v)||r.execution_id!==s.executionId||Number(r.generation)!==s.executionGeneration||r.grant_id!==s.grantRef.id||Number(r.grant_version)!==s.grantRef.version||Number(r.credential_generation)!==s.credentialGeneration||r.material_id!==v.materialRef?.id)return reject();
  const m=await this.findByRef(db,s,v.materialRef);if(!m||v.contentHash!==m.material.snapshot.contentHash||!same(v.target,executionTarget('GET','/api/v1/connectors/'+s.connectorId+'/executions/'+s.executionId+'/commands/'+m.descriptor.commandId+'/materials/'+v.materialRef.id,[],null)))return reject();await this.#proof(db,s,proof,v.target,true);return cloneV1({target:v.target,materialRef:v.materialRef,contentHash:v.contentHash});
 }
}
