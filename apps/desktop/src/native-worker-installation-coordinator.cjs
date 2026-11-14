'use strict';
const {types}=require('node:util');
const {canonicalJson,catalogueExact}=require('./runtime-catalogue-profile.cjs');
const {readWorkerDeploymentObservation}=require('./native-worker-deployment-client.cjs');
/** @type {Set<any>} */const unknown=new Set();
/** @param {string} [code] @returns {never} */function fail(code='WORKER_INSTALLATION_UNAVAILABLE'){throw Error(code);}
/** @param {any} v @param {string} k */function own(v,k){if(!v||types.isProxy(v))fail();const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))fail();return d.value;}
/** @param {any} v */function freeze(v){if(v!==null&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
/** 설치는 원 offer를 보유한 owner의 명시 호출만 받는다. renderer/URL/경로 입력이나 자동 설치는 없다.
 * host는 같은 보호 등록/parent/offer를 검산하는 제한 포트이며 기본 등록하지 않는다.
 * @param {any} client @param {null|Function} [openHost] */
function createWorkerInstallationCoordinator(client,openHost=null){const read=own(client,'current');if(typeof read!=='function')fail();let used=false;
 return Object.freeze({install:async(/** @type {any} */factoryInput,/** @type {any} */outer)=>{if(used||typeof openHost!=='function')fail();used=true;const factory=JSON.parse(canonicalJson(catalogueExact(factoryInput,'id,version,contentHash')));let effect=false,active=true;
 /** @type {any} */const owner={host:null,close:null,closing:null,state:'OPENING'};
 /** @type {ReturnType<typeof setTimeout>|undefined} */let timer;
 const controller=new AbortController();let abort=()=>{};
 const stopped=new Promise((_,reject)=>{abort=()=>{active=false;controller.abort();reject(Error(effect?'WORKER_INSTALLATION_UNKNOWN':'WORKER_INSTALLATION_UNAVAILABLE'));};});
 /** @type {any} */let observation;
 const check=()=>{if(!active||controller.signal.aborted||own(client,'current')!==read)fail();if(!observation)fail();observation.check();if(owner.host&&own(owner.host,'close')!==owner.close)fail();};
 const close=()=>{if(!owner.host)return Promise.resolve({state:'CLOSED_CONFIRMED'});if(!owner.closing){owner.closing=Promise.resolve().then(()=>owner.close.call(owner.host));void owner.closing.catch(()=>{});}return owner.closing;};
 const wait=async(/** @type {Promise<any>} */p)=>{void p.catch(()=>{});const v=await Promise.race([p,stopped]);check();return v;};
 try{const result=await read.call(client,factory,outer);observation=readWorkerDeploymentObservation(client,result);const value=observation.value;check();timer=setTimeout(abort,Math.max(1,observation.remainingMs()));observation.signal.addEventListener('abort',abort,{once:true});if(observation.signal.aborted)abort();check();
 const budget=Object.freeze({check,remainingMs:()=>{check();return observation.remainingMs();},signal:controller.signal});
 const opening=Promise.resolve().then(()=>{check();return openHost(budget);}).then(h=>{owner.host=h;owner.close=own(h,'close');if(typeof owner.close!=='function')fail();if(!active){owner.state='UNKNOWN';unknown.add(owner);void close().catch(()=>{});}return h;});
 const host=await wait(opening),install=own(host,'install');if(typeof install!=='function')fail();const payload=freeze(JSON.parse(canonicalJson({factoryRef:factory,bundle:value.bundle,head:value.head})));check();effect=true;owner.state='INSTALLING';const response=await wait(Promise.resolve().then(()=>{check();return install.call(host,payload,budget);}));if(own(host,'install')!==install)fail();
 catalogueExact(response,own(response,'state')==='UNSUPPORTED'?'state':'state,installationRef,descriptorRef,headRef,workerHash');const r=JSON.parse(canonicalJson(response));if(r.state==='UNSUPPORTED'){catalogueExact(r,'state');}else{catalogueExact(r,'state,installationRef,descriptorRef,headRef,workerHash');catalogueExact(r.installationRef,'id,version,contentHash');if(r.state!=='INSTALLED'||!Number.isSafeInteger(r.installationRef.version)||r.installationRef.version<1||typeof r.installationRef.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.installationRef.id)||typeof r.installationRef.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(r.installationRef.contentHash)||canonicalJson(r.descriptorRef)!==canonicalJson(value.bundle.descriptor.ref)||canonicalJson(r.headRef)!==canonicalJson(value.head.ref)||r.workerHash!==value.bundle.descriptor.snapshot.workerHash)fail();}
 const closed=await wait(close());if(canonicalJson(closed)!=='{"state":"CLOSED_CONFIRMED"}')fail();check();owner.state=r.state;return r;
 }catch(error){owner.state='UNKNOWN';unknown.add(owner);if(effect||owner.host)fail('WORKER_INSTALLATION_UNKNOWN');throw Error('WORKER_INSTALLATION_UNAVAILABLE');}
 finally{active=false;controller.abort();if(timer)clearTimeout(timer);observation?.signal.removeEventListener('abort',abort);if(owner.host&&!owner.closing)void close().catch(()=>{});}
 }});
}
module.exports={createWorkerInstallationCoordinator};
