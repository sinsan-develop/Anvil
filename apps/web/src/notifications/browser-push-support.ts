export type PushSupportState='SUPPORTED'|'PERMISSION_REQUIRED'|'DENIED'|'UNSUPPORTED'|'UNVERIFIED';
export interface BrowserPushSupport{state:PushSupportState;reason:string}
/** 브라우저 API·현재 권한의 읽기 관측이다. 구독/서버 연결·실제 전달 여부는 검사하지 않는다. */
export function getPushSupport(read:()=>unknown=()=>({secure:globalThis.isSecureContext,notification:globalThis.Notification,push:globalThis.PushManager,serviceWorker:globalThis.navigator?.serviceWorker})):BrowserPushSupport{
 const unknown=():BrowserPushSupport=>({state:'UNVERIFIED',reason:'BROWSER_STATE_UNVERIFIED'});
 try{
  const value=read() as {secure?:unknown;notification?:unknown;push?:unknown;serviceWorker?:{getRegistration?:unknown}}|null;
  if(!value||typeof value!=='object'||typeof value.secure!=='boolean')return unknown();
  if(!value.secure)return{state:'UNSUPPORTED',reason:'SECURE_CONTEXT_REQUIRED'};
  if(typeof value.notification!=='function')return{state:'UNSUPPORTED',reason:'NOTIFICATION_API_UNAVAILABLE'};
  if(typeof value.push!=='function')return{state:'UNSUPPORTED',reason:'PUSH_API_UNAVAILABLE'};
  if(typeof value.serviceWorker?.getRegistration!=='function')return{state:'UNSUPPORTED',reason:'SERVICE_WORKER_API_UNAVAILABLE'};
  const permission=(value.notification as unknown as {permission:unknown}).permission;
  if(permission==='denied')return{state:'DENIED',reason:'BROWSER_PERMISSION_DENIED'};
  if(permission==='default')return{state:'PERMISSION_REQUIRED',reason:'BROWSER_PERMISSION_NOT_GRANTED'};
  if(permission==='granted')return{state:'SUPPORTED',reason:'BROWSER_API_AND_PERMISSION_AVAILABLE'};
  return unknown();
 }catch{return unknown();}
}
