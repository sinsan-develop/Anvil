'use strict';
const LOCAL_URL='anvil-local://shell/settings.html';
/** @param {unknown} value */
function normalizeOrigin(value){
 if(typeof value!=='string'||value.length>2048||!value.isWellFormed()||/[\s\\\x00-\x1f\x7f]/u.test(value)||!/^https:\/\/[^/?#]+\/?$/.test(value))throw Error('SERVER_ORIGIN_INVALID');
 let u;try{u=new URL(value);}catch{throw Error('SERVER_ORIGIN_INVALID');}
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||u.origin==='null')throw Error('SERVER_ORIGIN_INVALID');
 return u.origin;
}
/** @param {unknown} input @param {string[]} keys @returns {Record<string,unknown>} */
function closed(input,keys){
 if(!input||typeof input!=='object'||Array.isArray(input)||(Object.getPrototypeOf(input)!==Object.prototype&&Object.getPrototypeOf(input)!==null))throw Error('IPC_INPUT_INVALID');
 const descriptors=Object.getOwnPropertyDescriptors(input);
 if(Reflect.ownKeys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k],'value')))throw Error('IPC_INPUT_INVALID');
 return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
/** @param {{sender:unknown,senderFrame:unknown}} event @param {{mainFrame:{url:string}}} owner @param {string} action @param {unknown} input */
function assertIpc(event,owner,action,input){
 if(event.sender!==owner||event.senderFrame!==owner.mainFrame||owner.mainFrame.url!==LOCAL_URL)throw Error('IPC_SENDER_DENIED');
 if(action==='get-state'){if(input!==null)throw Error('IPC_INPUT_INVALID');return null;}
 if(action==='connect'){const v=closed(input,['serverOrigin','replaceInvalidConfig']);if(typeof v.replaceInvalidConfig!=='boolean')throw Error('IPC_INPUT_INVALID');return {serverOrigin:normalizeOrigin(v.serverOrigin),replaceInvalidConfig:v.replaceInvalidConfig};}
 if(action==='client-quit'){const v=closed(input,['ackUnverifiedRuntime']);if(v.ackUnverifiedRuntime!==true)throw Error('IPC_INPUT_INVALID');return {ackUnverifiedRuntime:true};}
 throw Error('IPC_INPUT_INVALID');
}
/** @param {number} code */
function connectionError(code){if(code<=-200&&code>=-299)return 'TLS_ERROR';if([-106,-105,-102,-101].includes(code))return 'OFFLINE';if([-20,-22,-27].includes(code))return 'BLOCKED';return 'LOAD_FAILED';}

/** @param {any} value */function trustUuid(value){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);}
/** @param {any} event @param {any} owner @param {string} action @param {unknown} input */
function assertTrustIpc(event,owner,action,input){assertIpc(event,owner,'get-state',null);if(require('node:util').types.isProxy(input))throw Error('IPC_INPUT_INVALID');if(['native-receive-begin','native-receive-status','native-receive-refresh','native-receive-arm','native-receive-close'].includes(action)){const fields=action==='native-receive-status'?['attemptId','epoch']:action==='native-receive-arm'?['requestId','attemptId','epoch','offerRef','confirmed']:action==='native-receive-close'?['requestId','attemptId','epoch','confirmed']:['requestId','attemptId','epoch'],v=closed(input,fields);if(!trustUuid(v.attemptId)||!Number.isSafeInteger(v.epoch)||v.epoch<1||action!=='native-receive-status'&&!trustUuid(v.requestId))throw Error('IPC_INPUT_INVALID');if((action==='native-receive-arm'||action==='native-receive-close')&&v.confirmed!==true)throw Error('IPC_INPUT_INVALID');if(action==='native-receive-arm'){if(require('node:util').types.isProxy(v.offerRef))throw Error('IPC_INPUT_INVALID');const r=closed(v.offerRef,['id','version','contentHash']);if(!trustUuid(r.id)||r.version!==1||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash))throw Error('IPC_INPUT_INVALID');}return v;}const fields=action==='trust-status'?['attemptId','epoch']:action==='trust-begin'?['requestId','epoch','confirmNewKey','label']:action==='trust-pair'?['requestId','attemptId','epoch','projectIdHint','registrationId','oneTimeCode']:action==='trust-act'?['requestId','attemptId','epoch','action']:null;if(!fields)throw Error('IPC_INPUT_INVALID');const v=closed(input,fields);const epoch=Number.isSafeInteger(v.epoch)&&Number(v.epoch)>0;if(action==='trust-status'){if(v.attemptId===null&&v.epoch===null)return v;if(!epoch||v.attemptId!==null&&!trustUuid(v.attemptId))throw Error('IPC_INPUT_INVALID');return v;}if(!trustUuid(v.requestId)||!epoch)throw Error('IPC_INPUT_INVALID');if(action==='trust-begin'){if(v.confirmNewKey!==true||typeof v.label!=='string'||!v.label.isWellFormed()||v.label.length>200||v.label.trim().length<1)throw Error('IPC_INPUT_INVALID');}else{if(!trustUuid(v.attemptId))throw Error('IPC_INPUT_INVALID');if(action==='trust-pair'){if(!trustUuid(v.projectIdHint)||!trustUuid(v.registrationId)||typeof v.oneTimeCode!=='string'||v.oneTimeCode.length<1||v.oneTimeCode.length>256)throw Error('IPC_INPUT_INVALID');}else if(!['CHECK_CURRENT','ISSUE','RESTORE_VERIFY','CLOSE'].includes(String(v.action)))throw Error('IPC_INPUT_INVALID');}return v;}
/** main이 소유한 표시 phase만 소비한다. renderer 좌표 입력은 없다.
 * @param {number} width @param {number} height @param {boolean} expanded @param {string} phase
 */function trustLayout(width,height,expanded,phase){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<0||height<0)throw Error('LAYOUT_INVALID');const cap=expanded?(['KEY_PENDING','KEY_READY','UNKNOWN','PAIR_PENDING','PROOF_PENDING','PROOFED_WAITING_HUMAN','READY_TO_ISSUE','ISSUE_PENDING','REGISTERED','REJECTED','REVOKED','EXPIRED'].includes(phase)?520:320):128,top=expanded?Math.min(cap,Math.max(128,height-160)):128;return{localTop:top,remote:{x:0,y:top,width,height:Math.max(0,height-top)}};}

module.exports={LOCAL_URL,normalizeOrigin,closed,assertIpc,assertTrustIpc,trustLayout,connectionError};
