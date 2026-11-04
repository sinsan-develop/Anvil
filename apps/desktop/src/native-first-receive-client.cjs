'use strict';
const {types}=require('node:util');
const {canonicalJson}=require('./runtime-catalogue-profile.cjs');
/** 입력 준비만의 오류 경계다. context/기한/공급자/HTTP 오류는 이 catch 안에 넣지 않는다. @param {unknown} value */
function windowInput(value){
 try{const active=new Set();
 /** @param {any} v @param {number} depth */const visit=(v,depth)=>{if(depth>64)throw Error();if(v===null||typeof v!=='object')return;if(types.isProxy(v)||active.has(v))throw Error();const proto=Object.getPrototypeOf(v);if(!Array.isArray(v)&&proto!==Object.prototype&&proto!==null)throw Error();const ds=Object.getOwnPropertyDescriptors(v);active.add(v);try{for(const key of Reflect.ownKeys(ds)){if(typeof key!=='string')throw Error();const d=ds[key];if(!d||!('value'in d))throw Error();visit(d.value,depth+1);}}finally{active.delete(v);}};
 visit(value,0);return JSON.parse(canonicalJson(value));}catch{throw Error('NATIVE_RECEIVE_INPUT_INVALID');}
}
/** main의 보호 Session/원 문맥만 받는다. renderer/IPC의 runtime·cookie 입력을 받는 경로가 아니다.
 * @param {any} session @param {string} origin @param {any} lease @param {()=>void} current @param {any} [suppliedRuntime]
 */
function createNativeFirstReceiveClient(session,origin,lease,current,suppliedRuntime){
 let runtime=suppliedRuntime;if(runtime===undefined){try{runtime=require('./native-proof-runtime.cjs');}catch{throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');}}
 if(!runtime||types.isProxy(runtime))throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');const descriptor=Object.getOwnPropertyDescriptor(runtime,'NativeFirstReceiveHumanClient');if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='function')throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');const Client=descriptor.value,client=new Client(session,origin,lease,current),read=client.signingCurrent,prepare=client.prepareWindow;if(typeof read!=='function'||typeof prepare!=='function')throw Error('NATIVE_RECEIVE_SOURCE_UNAVAILABLE');
 const stable=()=>{lease.check();current();const d=Object.getOwnPropertyDescriptor(runtime,'NativeFirstReceiveHumanClient');if(!d||!('value'in d)||d.value!==Client||client.signingCurrent!==read||client.prepareWindow!==prepare)throw Error('NATIVE_RECEIVE_CONTEXT_CHANGED');};
 const clock=Date.now;let last=-Infinity;
 /** @param {number} issued @param {number} expires */const fresh=(issued,expires)=>{stable();const at=clock();if(!Number.isFinite(at)||!Number.isFinite(issued)||!Number.isFinite(expires)||at<last||at<issued||at>=expires)throw Error('NATIVE_RECEIVE_CONTEXT_CHANGED');last=at;};
 return Object.freeze({/** @param {unknown} rawWindow */signingCurrent:async rawWindow=>{const safe=windowInput(rawWindow),window=Reflect.apply(prepare,client,[safe]),issued=Date.parse(window.snapshot.issuedAt),expires=Date.parse(window.snapshot.expiresAt);fresh(issued,expires);const value=await Reflect.apply(read,client,[window]);stable();const result=JSON.parse(canonicalJson(value));fresh(Math.max(issued,Date.parse(result.observedAt)),Math.min(expires,Date.parse(result.expiresAt)));return result;}});
}
module.exports={createNativeFirstReceiveClient};
