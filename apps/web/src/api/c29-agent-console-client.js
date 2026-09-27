import {apiPath} from './workbench-client.js';

const menus=['team','moa','sns','adapters'];
export function checkMenu(menu){if(typeof menu!=='string'||!menus.includes(menu))throw Error('MENU_INVALID');return menu;}
const hash=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const topKeys=['schema','menu','state','target_hash','baseline_hash','session_id','projection_hash','data','deploy_readiness','external_runtime','automatic_acceptance','counts_as_pass'].sort().join(',');
const dataKeys=new Set(['tasks','task_id','parent_task_id','role','status','assignment_hash','result_hash','dependency_ids','artifact_refs','evidence_refs','evidence_status','provider','model','team_status','plan_hash','provider_status','proposals','critiques','synthesis','final_owner','id','actor_id','proposal_id','verdict','receipts','channel','identity_status','delivery','receipt_ref','receipt_hash','session_id','privacy','telegram','kakao','control','allowed']);
function safeData(value,depth=0){
  if(depth>12)throw Error('PROJECTION_INVALID');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='string'){if(value.length>2048)throw Error('PROJECTION_INVALID');return;}
  if(Array.isArray(value)){if(value.length>128)throw Error('PROJECTION_INVALID');value.forEach(v=>safeData(v,depth+1));return;}
  if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('PROJECTION_INVALID');
  for(const [key,child]of Object.entries(value)){if(!dataKeys.has(key))throw Error('PROJECTION_INVALID');safeData(child,depth+1);}
}
export function checkedProjection(value,menu){
  if(!value||Object.keys(value).sort().join(',')!==topKeys)throw Error('PROJECTION_INVALID');
  if(!value||value.schema!=='agent-console/v1'||value.menu!==checkMenu(menu)||!['NORMAL','EMPTY'].includes(value.state)||!hash(value.target_hash)||!hash(value.baseline_hash)||!hash(value.projection_hash)||typeof value.session_id!=='string'||value.session_id.length>256||value.automatic_acceptance!==false||value.counts_as_pass!==false||value.external_runtime!=='NOT_EXECUTED'||value.deploy_readiness!=='NOT_EVALUATED'||!value.data||typeof value.data!=='object')throw Error('PROJECTION_INVALID');
  safeData(value.data);const text=JSON.stringify(value);if(text.length>262144)throw Error('PROJECTION_INVALID');return JSON.parse(text);
}
export function createAgentConsoleClient(fetchImpl=globalThis.fetch){
  async function call(path,options={}){
    let response;
    try{response=await fetchImpl(apiPath(path),{credentials:'same-origin',redirect:'error',...options});}catch{throw Object.assign(Error('CONSOLE_REQUEST_FAILED'),{status:503});}
    if(!response.ok)throw Object.assign(Error('CONSOLE_REQUEST_FAILED'),{status:response.status});
    const text=await response.text();if(text.length>262144)throw Error('CONSOLE_REQUEST_FAILED');
    try{return JSON.parse(text);}catch{throw Error('CONSOLE_REQUEST_FAILED');}
  }
  return Object.freeze({
    read(menu){checkMenu(menu);return call('/api/agent-console/'+menu).then(value=>checkedProjection(value,menu));},
    async control(action,target_hash){
      if(!['pause','resume','deploy','delete','approve','merge','apply','provider','permission'].includes(action)||!hash(target_hash))throw Error('CONTROL_INVALID');
      const config=await call('/api/agent-console/config');
      if(typeof config.csrfToken!=='string'||config.csrfToken.length>128)throw Error('CONSOLE_REQUEST_FAILED');
      try{return await call('/api/agent-console/control',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':config.csrfToken},body:JSON.stringify({action,target_hash,request_id:globalThis.crypto.randomUUID()})});}
      catch(error){if(error.status===403)return {state:'HUMAN_APPROVAL_REQUIRED',allowed:false,applied:false};throw error;}
    }
  });
}
