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
module.exports={LOCAL_URL,normalizeOrigin,closed,assertIpc,connectionError};
