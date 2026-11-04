'use strict';
const {types}=require('node:util');
/** main의 보호 Session/원 문맥만 받는다. renderer/IPC의 runtime·cookie 입력을 받는 경로가 아니다.
 * @param {any} session @param {string} origin @param {any} lease @param {()=>void} current @param {any} [suppliedRuntime]
 */
function createNativeFirstReceiveClient(session,origin,lease,current,suppliedRuntime){
 let runtime=suppliedRuntime;if(runtime===undefined){try{runtime=require('./native-proof-runtime.cjs');}catch{throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');}}
 if(!runtime||types.isProxy(runtime))throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');const descriptor=Object.getOwnPropertyDescriptor(runtime,'NativeFirstReceiveHumanClient');if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='function')throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');const Client=descriptor.value,client=new Client(session,origin,lease,current),read=client.signingCurrent;if(typeof read!=='function')throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');
 const stable=()=>{lease.check();current();const d=Object.getOwnPropertyDescriptor(runtime,'NativeFirstReceiveHumanClient');if(!d||!('value'in d)||d.value!==Client||client.signingCurrent!==read)throw Error('NATIVE_RECEIVE_CONTEXT_CHANGED');};
 return Object.freeze({/** @param {unknown} window */signingCurrent:async window=>{stable();const value=await Reflect.apply(read,client,[window]);stable();return value;}});
}
module.exports={createNativeFirstReceiveClient};
