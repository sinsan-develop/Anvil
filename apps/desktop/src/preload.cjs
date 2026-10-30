'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('anvilDesktop',Object.freeze({
 getState:()=>ipcRenderer.invoke('anvil:get-state',null),
 /** @param {string} serverOrigin @param {boolean} replaceInvalidConfig */connect:(serverOrigin,replaceInvalidConfig)=>ipcRenderer.invoke('anvil:connect',{serverOrigin,replaceInvalidConfig}),
 quit:()=>ipcRenderer.invoke('anvil:client-quit',{ackUnverifiedRuntime:true}),
 /** @param {(state:unknown)=>void} callback */onState:callback=>{ipcRenderer.on('anvil:state',(_event,state)=>callback(state));},
 /** @param {()=>void} callback */onQuitRequest:callback=>{ipcRenderer.on('anvil:quit-request',()=>callback());}
}));
