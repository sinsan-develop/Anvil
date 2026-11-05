'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('anvilDesktop',Object.freeze({
 getState:()=>ipcRenderer.invoke('anvil:get-state',null),
 nativeReceiveBegin:(requestId,attemptId,epoch)=>ipcRenderer.invoke('anvil:native-receive-begin',{requestId,attemptId,epoch}),
 nativeReceiveStatus:(attemptId,epoch)=>ipcRenderer.invoke('anvil:native-receive-status',{attemptId,epoch}),
 nativeReceiveRefresh:(requestId,attemptId,epoch)=>ipcRenderer.invoke('anvil:native-receive-refresh',{requestId,attemptId,epoch}),
 nativeReceiveArm:(requestId,attemptId,epoch,offerRef,confirmed)=>ipcRenderer.invoke('anvil:native-receive-arm',{requestId,attemptId,epoch,offerRef,confirmed}),
 nativeReceiveClose:(requestId,attemptId,epoch,confirmed)=>ipcRenderer.invoke('anvil:native-receive-close',{requestId,attemptId,epoch,confirmed}),
 /** @param {string|null} attemptId @param {number|null} epoch */
 trustStatus:(attemptId,epoch)=>ipcRenderer.invoke('anvil:trust-status',{attemptId,epoch}),
 /** @param {string} requestId @param {number} epoch @param {string} label @param {boolean} confirmNewKey */
 trustBegin:(requestId,epoch,label,confirmNewKey)=>ipcRenderer.invoke('anvil:trust-begin',{requestId,epoch,confirmNewKey,label}),
 /** @param {string} requestId @param {string} attemptId @param {number} epoch @param {string} projectIdHint @param {string} registrationId @param {string} oneTimeCode */
 trustPair:(requestId,attemptId,epoch,projectIdHint,registrationId,oneTimeCode)=>ipcRenderer.invoke('anvil:trust-pair',{requestId,attemptId,epoch,projectIdHint,registrationId,oneTimeCode}),
 /** @param {string} requestId @param {string|null} attemptId @param {number} epoch @param {string} action */
 trustAct:(requestId,attemptId,epoch,action)=>ipcRenderer.invoke('anvil:trust-act',{requestId,attemptId,epoch,action}),
 /** @param {string} serverOrigin @param {boolean} replaceInvalidConfig */connect:(serverOrigin,replaceInvalidConfig)=>ipcRenderer.invoke('anvil:connect',{serverOrigin,replaceInvalidConfig}),
 quit:()=>ipcRenderer.invoke('anvil:client-quit',{ackUnverifiedRuntime:true}),
 /** @param {(state:unknown)=>void} callback */onState:callback=>{ipcRenderer.on('anvil:state',(_event,state)=>callback(state));},
 /** @param {()=>void} callback */onQuitRequest:callback=>{ipcRenderer.on('anvil:quit-request',()=>callback());}
}));
