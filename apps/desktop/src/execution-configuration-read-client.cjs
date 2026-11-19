'use strict';
const {types}=require('node:util');
const {canonicalJson,contentHash,catalogueExact}=require('./runtime-catalogue-profile.cjs');
/** @typedef {{id:string,version:number,contentHash:string}} Ref */
/** @typedef {{check:()=>void,signal:AbortSignal}} Lease */
const maximumSnapshotBytes=2097152, maximumIssues=3*(401+401+200+200+200)+3;
const maximumFixedBytes=maximumSnapshotBytes+maximumIssues*512+4096;
/** @param {string} [code] @returns {never} */
function fail(code='EXECUTION_CONFIGURATION_RESPONSE_INVALID'){throw Error(code);}
/** @param {unknown} v */
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
/** @param {unknown} v */
const instant=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
/** @param {unknown} a @param {unknown} b */
const same=(a,b)=>canonicalJson(a)===canonicalJson(b);
/** @param {unknown} v @returns {Ref} */
function ref(v){const r=catalogueExact(v,'id,version,contentHash');if(!uuid(r.id)||!Number.isSafeInteger(r.version)||r.version<1||typeof r.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(r.contentHash))fail();return {id:r.id,version:r.version,contentHash:r.contentHash};}
/** @param {unknown} v @param {number} max */
function text(v,max){return typeof v==='string'&&v.isWellFormed()&&v.length>0&&v.length<=max&&!!v.trim()&&!/[\u0000-\u001f\u007f]/.test(v);}
/** @param {unknown} v */
function relative(v){return typeof v==='string'&&v.isWellFormed()&&v===v.normalize('NFC')&&v.length>0&&Buffer.byteLength(v)<=1024&&!/[\x00-\x1f\x7f\\:%?*"<>|]/.test(v)&&v.split('/').every(s=>!!s&&s.length<=255&&s!=='.'&&s!=='..'&&!/[. ]$/.test(s)&&!/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(s));}
/** @param {unknown} value @param {Ref} registration @param {Ref} connector */
function localHost(value,registration,connector){const h=catalogueExact(value,'kind,registrationRef,connectorRef');if(h.kind!=='CONNECTOR_STATUS'||!same(ref(h.registrationRef),registration)||!same(ref(h.connectorRef),connector))fail('EXECUTION_CONFIGURATION_UNSUPPORTED');return h;}
/** 원 web 고정 조회와 같은 envelope/hash/current 규칙. 이 함수의 결과는 실행 권위가 아니다.
 * @param {unknown} raw @param {string} project @param {'ENVIRONMENT_VERSION'|'COMMAND_PROFILE_METADATA'} kind @param {Ref} expected
 */
function view(raw,project,kind,expected){
 const v=catalogueExact(raw,'projectId,kind,ref,snapshot,historyVerification,current,executionEligible,dispatchPerformed,observedAt');
 if(v.projectId!==project||v.kind!==kind||!same(ref(v.ref),expected)||v.historyVerification!=='STORED_CONFIGURATION_VERIFIED'||v.executionEligible!==false||v.dispatchPerformed!==false||!instant(v.observedAt))fail();
 const c=catalogueExact(v.current,'headVersion,configurationCurrentness,issues,checkedAt');
 if(!Number.isSafeInteger(c.headVersion)||c.headVersion<expected.version||!instant(c.checkedAt)||!Array.isArray(c.issues)||c.issues.length>maximumIssues)fail();
 const codes=new Set();
 for(const rawIssue of c.issues){const i=catalogueExact(rawIssue,'code,target');if(!['HEAD_CHANGED','REFERENCE_REVOKED','REFERENCE_CHANGED','POLICY_CHANGED','CURRENT_REFERENCE_UNAVAILABLE','OBSERVATION_UNVERIFIED'].includes(i.code))fail();if(i.target!==null){const t=catalogueExact(i.target,'kind,ref');if(!['ENVIRONMENT_VERSION','HOST_DECLARATION','COMMAND_PROFILE_METADATA','SECRET_REFERENCE_METADATA','SOURCE_ROOT_DECLARATION','SOURCE_SNAPSHOT','CONNECTOR_STATUS','PERMISSION_POLICY'].includes(t.kind))fail();ref(t.ref);}codes.add(i.code);}
 const expectedCurrent=codes.has('CURRENT_REFERENCE_UNAVAILABLE')?'UNAVAILABLE':['HEAD_CHANGED','REFERENCE_REVOKED','REFERENCE_CHANGED','POLICY_CHANGED'].some(code=>codes.has(code))?'CHANGED':'MATCHED';
 if(c.configurationCurrentness!==expectedCurrent||kind==='ENVIRONMENT_VERSION'&&!codes.has('OBSERVATION_UNVERIFIED'))fail();
 if(expectedCurrent!=='MATCHED'||c.headVersion!==expected.version)fail('EXECUTION_CONFIGURATION_NOT_CURRENT');
 const s=kind==='ENVIRONMENT_VERSION'?catalogueExact(v.snapshot,'id,version,sourceRoots,executionHostRef,targetHostRefs,commandProfileRefs,secretRefs,policyRef,contentHash'):catalogueExact(v.snapshot,'id,version,status,definition');
 if(s.id!==expected.id||s.version!==expected.version||Buffer.byteLength(canonicalJson(s))>maximumSnapshotBytes||Buffer.byteLength(canonicalJson(v))>maximumFixedBytes)fail();
 if(kind==='ENVIRONMENT_VERSION'){const {contentHash:claimed,...body}=s;if(claimed!==expected.contentHash||contentHash(canonicalJson(body))!==expected.contentHash)fail();}
 else if(contentHash(canonicalJson(s))!==expected.contentHash)fail();
 return v;
}
/** @param {unknown} raw @param {Ref} registration @param {Ref} connector @param {Ref} selected */
function environment(raw,registration,connector,selected){
 const e=catalogueExact(raw,'id,version,sourceRoots,executionHostRef,targetHostRefs,commandProfileRefs,secretRefs,policyRef,contentHash');
 ref(e.policyRef);localHost(e.executionHostRef,registration,connector);
 if(!Array.isArray(e.sourceRoots)||e.sourceRoots.length!==1||!Array.isArray(e.targetHostRefs)||e.targetHostRefs.length>200||!Array.isArray(e.commandProfileRefs)||!e.commandProfileRefs.length||e.commandProfileRefs.length>200||!Array.isArray(e.secretRefs)||e.secretRefs.length)fail('EXECUTION_CONFIGURATION_UNSUPPORTED');
 const targets=new Set();for(const h of e.targetHostRefs){localHost(h,registration,connector);if(targets.has(h.connectorRef.id))fail();targets.add(h.connectorRef.id);}
 const profiles=new Set();let found=false;
 for(const rawProfile of e.commandProfileRefs){const p=catalogueExact(rawProfile,'kind,ref'),r=ref(p.ref);if(p.kind!=='COMMAND_PROFILE_METADATA'||profiles.has(r.id))fail();profiles.add(r.id);if(same(r,selected))found=true;}
 if(!found)fail('EXECUTION_CONFIGURATION_PROFILE_NOT_SELECTED');
 const r=catalogueExact(e.sourceRoots[0],'sourceRootId,hostId,displayLabel,registeredPathRef,identityRef,permissionScope');
 if(!uuid(r.sourceRootId)||r.hostId!==connector.id||!text(r.displayLabel,200)||r.identityRef!==null)fail('EXECUTION_CONFIGURATION_UNSUPPORTED');
 const p=catalogueExact(r.registeredPathRef,'kind,sourceRootRef,hostRef'),source=ref(p.sourceRootRef);
 if(p.kind!=='SOURCE_ROOT_DECLARATION'||source.id!==r.sourceRootId)fail('EXECUTION_CONFIGURATION_UNSUPPORTED');localHost(p.hostRef,registration,connector);
 const scope=catalogueExact(r.permissionScope,'kind,targets');if(scope.kind!=='REQUESTED_SCOPE'||!Array.isArray(scope.targets)||!scope.targets.length||scope.targets.length>200)fail();
 const paths=new Set();for(const rawTarget of scope.targets){const t=catalogueExact(rawTarget,'relativePath,kind,access,recursive');if(!relative(t.relativePath)||t.kind!=='FILE'||!['READ','WRITE'].includes(t.access)||t.recursive!==false||paths.has(t.relativePath.toUpperCase()))fail();paths.add(t.relativePath.toUpperCase());}
 return source;
}
/** @param {unknown} raw @param {Ref} registration @param {Ref} connector @param {Ref} source */
function profile(raw,registration,connector,source){
 const s=catalogueExact(raw,'id,version,status,definition');if(s.status!=='DECLARED')fail('EXECUTION_CONFIGURATION_NOT_CURRENT');
 const p=catalogueExact(s.definition,'label,purpose,hostRef,toolRequirements,program,argsTemplate,workingDirectory,secretSlots,policyRef');
 if(!text(p.label,200)||p.purpose!=='CONTEXT_REVIEW'||!text(p.program,200)||!Array.isArray(p.toolRequirements)||!p.toolRequirements.length||p.toolRequirements.length>20||!Array.isArray(p.argsTemplate)||p.argsTemplate.length>200||!Array.isArray(p.secretSlots)||p.secretSlots.length)fail('EXECUTION_CONFIGURATION_UNSUPPORTED');
 ref(p.policyRef);localHost(p.hostRef,registration,connector);
 const tools=new Set();for(const rawTool of p.toolRequirements){const t=catalogueExact(rawTool,'product,versionRequirement');if(!text(t.product,200)||!text(t.versionRequirement,200)||tools.has(t.product))fail();tools.add(t.product);}
 for(const rawArg of p.argsTemplate){const a=catalogueExact(rawArg,'kind,value');if(a.kind!=='LITERAL'||typeof a.value!=='string'||!a.value.isWellFormed()||a.value.length>4096||/[\u0000-\u001f\u007f]/.test(a.value))fail('EXECUTION_CONFIGURATION_UNSUPPORTED');}
 const w=catalogueExact(p.workingDirectory,'sourceRootRef,relativeDirectory');if(!same(ref(w.sourceRootRef),source)||w.relativeDirectory!==null&&!relative(w.relativeDirectory))fail('EXECUTION_CONFIGURATION_UNSUPPORTED');
}
/** @param {string} raw @returns {unknown} */
function parse(raw){
 /** @type {{keys:Set<string>|null,key:boolean}[]} */const stack=[];
 for(const token of raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)||[]){
  if(token==='{'||token==='[')stack.push({keys:token==='{'?new Set():null,key:token==='{'});
  else if(token==='}'||token===']')stack.pop();
  else{const f=stack.at(-1);if(!f?.keys)continue;if(token===',')f.key=true;else if(token===':')f.key=false;else if(f.key&&token[0]==='"'){const key=JSON.parse(token);if(f.keys.has(key))fail();f.keys.add(key);}}
 }
 const v=JSON.parse(raw);catalogueExact(v,Object.keys(v).join(','));return v;
}
/** @param {object} session @returns {typeof fetch} */
function sessionFetch(session){let target=session;for(let depth=0;target&&depth<16;depth++){if(types.isProxy(target))fail('PROTECTION_UNAVAILABLE');const d=Object.getOwnPropertyDescriptor(target,'fetch');if(d){if(!('value'in d)||typeof d.value!=='function'||types.isProxy(d.value))fail('PROTECTION_UNAVAILABLE');return d.value;}target=Object.getPrototypeOf(target);}return fail('PROTECTION_UNAVAILABLE');}
/** 원 main 소유 session만 소비하며 생성/목록 조회/기본 IO가 없다.
 * @param {object} session @param {string} origin @param {Lease} lease @param {()=>void} current
 */
function createExecutionConfigurationReadClient(session,origin,lease,current){
 if(!session||types.isProxy(session)||typeof current!=='function')fail('PROTECTION_UNAVAILABLE');
 const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin)fail('PROTECTION_UNAVAILABLE');
 const fetch=sessionFetch(session),guard=()=>{lease.check();current();if(sessionFetch(session)!==fetch)fail('CONTEXT_CHANGED');};
 /** @param {string} path */
 async function get(path){
  guard();let response;
  try{response=await Reflect.apply(fetch,session,[origin+path,{method:'GET',credentials:'include',redirect:'error',cache:'no-store',bypassCustomProtocolHandlers:true,signal:lease.signal,headers:{Accept:'application/json'}}]);}
  catch{guard();return fail('EXECUTION_CONFIGURATION_READ_UNKNOWN');}
  if(!response||types.isProxy(response))fail();
  const reader=response.body?.getReader();if(!reader)fail();
  let total=0,ended=false;/** @type {Buffer[]} */const chunks=[];
  try{
   guard();if(response.status>=300&&response.status<400)fail('EXECUTION_CONFIGURATION_REDIRECT_DENIED');
   if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers.get('content-type')||'')||response.headers.has('location')||response.headers.has('content-encoding'))fail();
   for(;;){guard();const part=await reader.read();guard();if(part.done){ended=true;break;}if(types.isProxy(part.value)||!types.isUint8Array(part.value))fail();total+=part.value.byteLength;if(total>maximumFixedBytes)fail();chunks.push(Buffer.from(part.value));}
   const value=parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,total)));guard();
   if(response.status!==200)fail(response.status===401?'AUTH_REQUIRED':response.status===403?'FORBIDDEN':response.status===404?'NOT_FOUND':'EXECUTION_CONFIGURATION_READ_UNKNOWN');
   return value;
  }finally{for(const b of chunks)b.fill(0);try{if(!ended)await reader.cancel();}finally{reader.releaseLock();}}
 }
 return Object.freeze({read:async(/** @type {unknown} */selection)=>{
  guard();const s=catalogueExact(selection,'projectId,environmentRef,commandProfileRef,registrationRef,connectorRef');
  if(!uuid(s.projectId))fail();const project=s.projectId,er=ref(s.environmentRef),pr=ref(s.commandProfileRef),rr=ref(s.registrationRef),cr=ref(s.connectorRef);
  const e=view(await get(`/api/v1/projects/${project}/environments/${er.id}/versions/${er.version}`),project,'ENVIRONMENT_VERSION',er);guard();
  const root=environment(e.snapshot,rr,cr,pr);guard();
  const p=view(await get(`/api/v1/projects/${project}/command-profile-metadata/${pr.id}/versions/${pr.version}`),project,'COMMAND_PROFILE_METADATA',pr);guard();profile(p.snapshot,rr,cr,root);guard();
  return Object.freeze({environment:JSON.parse(canonicalJson(e)),profile:JSON.parse(canonicalJson(p))});
 }});
}
module.exports={createExecutionConfigurationReadClient};
