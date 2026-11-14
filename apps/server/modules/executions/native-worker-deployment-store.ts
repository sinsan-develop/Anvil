import {types} from 'node:util';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {nativeSame} from '../../../../contracts/runtime/native-preparation-authority-v1.ts';
import {workerDataSnapshot} from '../../../../contracts/runtime/native-worker-provenance-v1.ts';
import {readWorkerDeploymentBundle,readWorkerDeploymentHead,workerNonce,type WorkerDeploymentBundle} from '../../../../contracts/runtime/native-worker-deployment-v1.ts';
import {refV1,uuidV1,isoV1,hashV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';

const unavailable=():never=>{throw Error('WORKER_DEPLOYMENT_UNAVAILABLE');};
/** 배포 서비스가 원 compiler/검증/parent 원객체 reader를 고정 주입한다. HTTP JSON reader·model reader 기본 구현은 없다. */
export interface WorkerPublicationReader{readOriginal(product:unknown):{bundle:WorkerDeploymentBundle};}
export class NativeWorkerDeploymentStore{
 readonly #pool:Pick<Pool,'connect'>;readonly #reader:WorkerPublicationReader|null;readonly #read:WorkerPublicationReader['readOriginal']|null;
 constructor(pool:Pick<Pool,'connect'>,reader:WorkerPublicationReader|null=null){this.#pool=pool;this.#reader=reader;this.#read=reader?this.#method():null;}
 #method(){const r=this.#reader;if(!r||types.isProxy(r))return unavailable();const p=Object.getOwnPropertyDescriptor(r,'readOriginal');if(!p||!('value'in p)||typeof p.value!=='function')return unavailable();return p.value as WorkerPublicationReader['readOriginal'];}
 #original(product:unknown){if(!this.#read||this.#method()!==this.#read)return unavailable();const value=this.#read.call(this.#reader,product);if(this.#method()!==this.#read)return unavailable();return readWorkerDeploymentBundle(workerDataSnapshot(value).bundle);}
 async #transaction<T>(fn:(db:PoolClient)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  const start=performance.now(),wall=Date.now();let active=true,db:PoolClient|undefined,released=false,committed=false,uncertain=false,timer:ReturnType<typeof setTimeout>|undefined;
  const release=(error?:Error)=>{if(db&&!released){released=true;db.release(error);}};
  const check=()=>{if(!active||signal?.aborted||performance.now()-start>=1000||performance.now()<start||Date.now()<wall)return unavailable();};
  let abort=()=>{};const stopped=new Promise<never>((_,reject)=>{abort=()=>{active=false;reject(Error('WORKER_DEPLOYMENT_UNAVAILABLE'));};timer=setTimeout(abort,1000);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
  // signal을 무시한 늦은 connect도 보존하지 않는다. raw client는 목적 callback에 전달하지 않는다.
  const work=(async()=>{check();const connected=this.#pool.connect().then(client=>{if(!active){client.release(Error('WORKER_DEPLOYMENT_LATE_CONNECT'));return unavailable();}db=client;return client;});await Promise.race([connected,stopped]);check();
   const query=async(...args:any[])=>{check();const value=await Promise.race([(db!.query as any)(...args),stopped]);check();return value;};
   const scoped={query} as unknown as PoolClient;
   try{await query('BEGIN');await query("SET LOCAL statement_timeout = '1000ms'");const result=await fn(scoped);check();uncertain=true;const done=await query('COMMIT');if(done.command!=='COMMIT')return unavailable();committed=true;return result;}
   catch(error){if(uncertain)throw Error('WORKER_DEPLOYMENT_COMMIT_UNKNOWN');if(!active){uncertain=true;throw Error('WORKER_DEPLOYMENT_TRANSACTION_UNKNOWN');}try{await query('ROLLBACK');}catch{uncertain=true;throw Error('WORKER_DEPLOYMENT_ROLLBACK_UNKNOWN');}throw error;}
  })();
  try{return await Promise.race([work,stopped]);}
  catch(error){if(uncertain&&!committed)throw Error('WORKER_DEPLOYMENT_COMMIT_UNKNOWN');if(!active&&db)throw Error('WORKER_DEPLOYMENT_TRANSACTION_UNKNOWN');throw error;}
  finally{const discard=!active||uncertain&&!committed;active=false;if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);release(discard?Error('WORKER_DEPLOYMENT_COMMIT_UNKNOWN'):undefined);void work.catch(()=>{});}
 }
 async publish(requestId:string,product:unknown){
  if(!uuidV1(requestId))return unavailable();const bundle=this.#original(product);
  return this.#transaction(async db=>{
   const r=await db.query('SELECT anvil.worker_deployment_publish($1::uuid,$2::jsonb) AS result',[requestId,canonicalJson(bundle)]);
   if(!nativeSame(this.#original(product),bundle)||r.rows.length!==1)return unavailable();
   const h=readWorkerDeploymentHead(r.rows[0].result,bundle);if(h.snapshot.sequence!==1)return unavailable();return h;
  });
 }
 async revoke(requestId:string,factory:RuntimeRefV1,expectedHead:RuntimeRefV1){
  const f=workerDataSnapshot(factory),h=workerDataSnapshot(expectedHead);if(!uuidV1(requestId)||!refV1(f)||!refV1(h)||h.version!==1)return unavailable();
  return this.#transaction(async db=>{const r=await db.query('SELECT anvil.worker_deployment_revoke($1::uuid,$2::jsonb,$3::jsonb) AS result',[requestId,canonicalJson(f),canonicalJson(h)]);if(r.rows.length!==1)return unavailable();const v=workerDataSnapshot(r.rows[0].result);const b=readWorkerDeploymentBundle(v.bundle),head=readWorkerDeploymentHead(v.head,b);if(!nativeSame(b.descriptor.snapshot.nativeFactoryRef,f)||!nativeSame(head.snapshot.previousHeadRef,h)||head.snapshot.sequence!==2)return unavailable();return head;});
 }
 /** 불명 후에는 명시된 원 request/hash만 조회한다. publish를 내부 재실행하지 않는다. */
 async lookup(requestId:string,requestHash:string){if(!uuidV1(requestId)||!hashV1(requestHash))return unavailable();return this.#transaction(async db=>{const r=await db.query('SELECT anvil.worker_deployment_lookup($1::uuid,$2::text) AS result',[requestId,requestHash]);if(r.rows.length!==1)return unavailable();return workerDataSnapshot(r.rows[0].result);});}
 async read(factory:RuntimeRefV1,nonce:string,signal?:AbortSignal){
  const f=workerDataSnapshot(factory);if(!refV1(f)||!workerNonce(nonce))return unavailable();
  return this.#transaction(async db=>{
   const r=await db.query('SELECT anvil.worker_deployment_read($1::jsonb) AS result',[canonicalJson(f)]);if(r.rows.length!==1)return unavailable();
   const v=workerDataSnapshot(r.rows[0].result);if(v===null)throw Error('WORKER_DEPLOYMENT_NOT_FOUND');
   const bundle=readWorkerDeploymentBundle(v.bundle),head=readWorkerDeploymentHead(v.head,bundle);
   if(!nativeSame(bundle.descriptor.snapshot.nativeFactoryRef,f)||!isoV1(v.observedAt))return unavailable();
   if(head.snapshot.state!=='ACTIVE'||Date.parse(v.observedAt)>=Date.parse(head.snapshot.expiresAt)||Date.parse(v.observedAt)<Date.parse(head.snapshot.updatedAt))throw Error('WORKER_DEPLOYMENT_NOT_CURRENT');
   return {schemaVersion:1 as const,purpose:'NATIVE_WORKER_DEPLOYMENT_READ' as const,nonce,bundle,head,observedAt:v.observedAt};
  },signal);
 }
}
