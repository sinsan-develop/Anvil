import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,isoV1,cloneV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {receiveSame} from '../../../../contracts/runtime/native-first-receive-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import type {ProjectCommand} from '../access/project-command.ts';
import {NativeFirstReceiveStore} from './native-first-receive-store.ts';
import {NativeFirstReceiveService,type NormalStartPreparationReceiver,type NormalStartPreparationReceiverScope} from './native-first-receive-service.ts';

export interface NormalStartPreparationAdmissionOptions {purpose:'NORMAL_START_PREPARATION_ADMISSION_V1';receiver:NativeFirstReceiveService}
export interface NormalStartPreparationOrigin {registrationRef:Ref;connectorRef:Ref;expiresAt:string}
type Inspect=(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand)=>Promise<NormalStartPreparationOrigin|null>;
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const unavailable=():never=>{throw new AuthFailure('NORMAL_START_PREPARATION_OUTCOME_UNKNOWN',503);};
const take=NativeFirstReceiveService.prototype.takeNormalStartPreparationReceiver;
const readHuman=NativeFirstReceiveStore.prototype.readHuman;
function configuration(value:NormalStartPreparationAdmissionOptions){
 if(!recordV1(value,['purpose','receiver'])||value.purpose!=='NORMAL_START_PREPARATION_ADMISSION_V1'
  ||!(value.receiver instanceof NativeFirstReceiveService)||Object.getPrototypeOf(value.receiver)!==NativeFirstReceiveService.prototype
  ||value.receiver.takeNormalStartPreparationReceiver!==take)return unavailable();
 return value.receiver;
}
/** 기존 app/명시 서비스 구성만 소비한다. 공개 body·기본 구성·새 physical factory를 만들지 않는다. */
export class NormalStartPreparationAdmissions {
 #access:AccessRepository;#options:NormalStartPreparationAdmissionOptions;#receiver:NativeFirstReceiveService;#inspect:Inspect;
 constructor(access:AccessRepository,options:NormalStartPreparationAdmissionOptions,inspect:Inspect){
  this.#receiver=configuration(options);if(typeof inspect!=='function')unavailable();
  this.#access=access;this.#options=options;this.#inspect=inspect;
 }
 #stable(){if(configuration(this.#options)!==this.#receiver||NativeFirstReceiveService.prototype.takeNormalStartPreparationReceiver!==take
  ||NativeFirstReceiveStore.prototype.readHuman!==readHuman)return unavailable();}
 async enter(token:string,csrf:string,request:ProjectCommand){
  this.#stable();const command=cloneV1(request),commandHash=hash(command),store=new NativeFirstReceiveStore();
  let custody:NormalStartPreparationReceiver|undefined,scope:NormalStartPreparationReceiverScope|undefined;
  let end=Infinity,monoEnd=Infinity,lastWall=-Infinity,lastMono=-Infinity,entered=false;
  const check=()=>{
   this.#stable();const wall=Date.now(),mono=performance.now();
   if(!Number.isFinite(wall)||!Number.isFinite(mono)||wall<lastWall||mono<lastMono||wall>=end||mono>=monoEnd
    ||hash(request)!==commandHash)return unavailable();lastWall=wall;lastMono=mono;
  };
  const tighten=(expiresAt:string)=>{
   if(!isoV1(expiresAt))return unavailable();const wall=Date.now(),mono=performance.now(),until=Date.parse(expiresAt);
   end=Math.min(end,until);monoEnd=Math.min(monoEnd,mono+(until-wall));check();
  };
  const tx=async(db:PoolClient)=>{
   check();const r=await db.query('SELECT txid_current()::text AS transaction_id');check();
   const value=r.rows.length===1?r.rows[0]?.transaction_id:null;
   if(typeof value!=='string'||!(/^[1-9][0-9]{0,18}$/).test(value))return unavailable();return value;
  };
  const slot=async(db:PoolClient,actor:AuthenticatedIdentity,origin:NormalStartPreparationOrigin)=>{
   check();if(!actor.authSession||!refV1(origin.registrationRef)||!refV1(origin.connectorRef))return unavailable();
   const active=await Reflect.apply(readHuman,store,[db,actor,command.projectId,'ACTIVE',origin.registrationRef,this.#access.installationId,command.controlGeneration,check]);
   check();tighten(active.expiresAt);const w=active.value.window;
   if(!w||!recordV1(w,['ref','snapshot'])||!refV1(w.ref)||w.ref.contentHash!==hash(w.snapshot)
    ||!same(w.snapshot.connectorRef,origin.connectorRef))return unavailable();
   const state=await Reflect.apply(readHuman,store,[db,actor,command.projectId,'STATE',w.ref.id,this.#access.installationId,command.controlGeneration,check]);
   check();tighten(state.expiresAt);const s=state.value;
   if(s.phase!=='STREAMING'||s.current.usable!==true||s.current.reason!=='CURRENT'||!same(s.windowRef,w.ref)||!refV1(s.receiveSessionRef)
    ||['offerRef','armRef','bindingRef','deliveryRef','authorityRef','ackRef','terminalRef'].some(k=>s[k]!==null))return unavailable();
   const result:NormalStartPreparationReceiverScope={purpose:'NORMAL_START_PREPARATION_RECEIVER_V1',installationId:this.#access.installationId,
    projectId:command.projectId,registrationRef:origin.registrationRef,connectorRef:origin.connectorRef,windowRef:w.ref,receiveSessionRef:s.receiveSessionRef,
    localReceiveAttemptId:w.snapshot.localReceiveAttemptId,actorId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession.id,
    credentialGeneration:actor.credentialGeneration,controlGeneration:command.controlGeneration};
   if(scope&&!same(scope,result))return unavailable();return result;
  };
  const result=(raw:any,purpose:string)=>{
   if(raw.rows.length!==1||!recordV1(raw.rows[0],['result']))return unavailable();const v=raw.rows[0].result;
   if(!recordV1(v,['disposition','ref','snapshot'])||!['FIRST_COMMIT','REPLAY_ONLY'].includes(v.disposition)||!refV1(v.ref)||v.ref.version!==1
    ||v.ref.contentHash!==hash(v.snapshot)||v.snapshot.purpose!==purpose||v.snapshot.requestHash!==commandHash
    ||v.snapshot.executionAuthorized!==false||v.snapshot.dispatchPerformed!==false)return unavailable();
   if(purpose==='NORMAL_START_PREPARATION_ADMISSION'){
    if(!recordV1(v.snapshot,['schemaVersion','purpose','admissionId','claimId','request','requestHash','scope','provenance','brokerInstanceId','operationFence','transactionId','recordedAt','expiresAt','executionAuthorized','dispatchPerformed'])
     ||v.ref.id!==v.snapshot.admissionId||!same(v.snapshot.request,command)||!same(v.snapshot.scope,scope))return unavailable();
   }else if(!recordV1(v.snapshot,['schemaVersion','purpose','claimId','admissionRef','requestHash','windowRef','receiveSessionRef','streamProofHash','transactionId','claimedAt','expiresAt','executionAuthorized','dispatchPerformed'])
    ||v.ref.id!==v.snapshot.claimId||!same(v.snapshot.windowRef,scope!.windowRef)||!same(v.snapshot.receiveSessionRef,scope!.receiveSessionRef))return unavailable();
   return cloneV1(v) as {disposition:'FIRST_COMMIT'|'REPLAY_ONLY';ref:Ref;snapshot:Record<string,any>};
  };
  try{
   const admitted=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    check();const origin=await this.#inspect(db,actor,command);check();if(origin===null)return null;
    tighten(origin.expiresAt);scope=await slot(db,actor,origin);check();
    const transactionId=await tx(db);
    // SQL 행은 연결 증거가 아니다. 원 STREAM owner의 단회 provenance를 먼저 검산한다.
    custody=Reflect.apply(take,this.#receiver,[scope]);check();const provenance=custody.read(scope);check();tighten(provenance.expiresAt);
    const before=await db.query('SELECT clock_timestamp() AS at');check();const at=before.rows[0]?.at;
    if(!(at instanceof Date))return unavailable();tighten(new Date(Math.min(end,at.getTime()+10000)).toISOString());
    const ids={admissionId:randomUUID(),claimId:randomUUID()},payload={ids,scope,provenance,expiresAt:new Date(end).toISOString()};
    entered=true;
    const stored=result(await db.query('SELECT anvil.fn08_start_preparation_admit($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) AS result',
     [actor.authSession!.id,actor.actorId,actor.clientId,command.projectId,canonicalJson(command),canonicalJson(payload),transactionId]),'NORMAL_START_PREPARATION_ADMISSION');
    check();custody.read(scope);check();tighten(stored.snapshot.expiresAt);
    if(stored.disposition!=='FIRST_COMMIT')return unavailable();return stored;
   });
   // authenticated가 원 COMMIT tag와 release를 확인한 뒤에만 다음 거래를 시작한다.
   check();if(admitted===null)return null;
   if(!scope||!custody)return unavailable();
   const fixedScope=scope,owner=custody;
   const claimed=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    check();const origin=await this.#inspect(db,actor,command);check();if(!origin)return unavailable();tighten(origin.expiresAt);
    const selected=await slot(db,actor,origin);if(!same(selected,fixedScope))return unavailable();
    const provenance=owner.read(selected);check();const transactionId=await tx(db);
    const stored=result(await db.query('SELECT anvil.fn08_start_preparation_claim($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8) AS result',
     [actor.authSession!.id,actor.actorId,actor.clientId,command.projectId,canonicalJson(command),canonicalJson(admitted.ref),canonicalJson(provenance),transactionId]),'NORMAL_START_PREPARATION_CLAIM');
    check();owner.read(selected);check();if(stored.disposition!=='FIRST_COMMIT'||!same(stored.snapshot.admissionRef,admitted.ref))return unavailable();return stored;
   });
   check();owner.read(fixedScope);check();
   return Object.freeze({admissionRef:admitted.ref,claimRef:claimed.ref,scope:cloneV1(fixedScope),expiresAt:new Date(end).toISOString(),
    check:()=>{check();owner.read(fixedScope);check();},
    verifyQueue:async(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,host:{registrationRef:Ref;connectorRef:Ref})=>{
     check();if(!actor.authSession||actor.actorId!==fixedScope.actorId||actor.clientId!==fixedScope.clientId||actor.authSession.id!==fixedScope.humanSessionId
      ||actor.credentialGeneration!==fixedScope.credentialGeneration||raw.projectId!==fixedScope.projectId||raw.controlGeneration!==fixedScope.controlGeneration
      ||hash(raw)!==commandHash||!same(host.registrationRef,fixedScope.registrationRef)||!same(host.connectorRef,fixedScope.connectorRef))return unavailable();
     owner.read(fixedScope);const transactionId=await tx(db);
     const out=await db.query('SELECT anvil.fn08_start_preparation_queue($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8) AS result',
      [actor.authSession.id,actor.actorId,actor.clientId,command.projectId,canonicalJson(command),canonicalJson(admitted.ref),canonicalJson(claimed.ref),transactionId]);
     check();owner.read(fixedScope);const v=out.rows.length===1?out.rows[0]?.result:null;
     if(!recordV1(v,['admissionRef','claimRef','requestHash','scope','transactionId','expiresAt'])||!same(v.admissionRef,admitted.ref)||!same(v.claimRef,claimed.ref)
      ||v.requestHash!==commandHash||!same(v.scope,fixedScope)||v.transactionId!==transactionId||v.expiresAt!==admitted.snapshot.expiresAt)return unavailable();
     check();
    },revoke:()=>owner.revoke()});
  }catch(error){
   custody?.revoke();
   // 저장 진입 뒤의 COMMIT/ROLLBACK/release 예외는 확정 실패·새 admission 발급 근거가 아니다.
   if(entered)return unavailable();throw error instanceof AuthFailure?error:new AuthFailure('NORMAL_START_PREPARATION_OUTCOME_UNKNOWN',503);
  }
 }
}
