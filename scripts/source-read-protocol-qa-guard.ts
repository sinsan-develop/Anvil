import {assertSourceRootQaTmpfs} from './source-root-qa-guard.ts';
import {assertSourceReadQaPublishedPort} from './source-read-qa-guard.ts';
export function assertSourceReadProtocolQaBindings(cwd:string,moduleFile:string,manifestRoot:string,env:NodeJS.ProcessEnv){
 if(cwd!=='/home/daon/deploy/anvil-v3'||moduleFile!==cwd+'/scripts/qa-source-read-protocol.ts'||manifestRoot!==cwd||Object.entries(env).some(([k,v])=>k.startsWith('DOCKER_')&&!!v))throw Error('QA_PROTOCOL_RUNTIME_OR_DOCKER_OVERRIDE_INVALID');
}
export const assertSourceReadProtocolQaReady=assertSourceReadQaPublishedPort;
export function assertSourceReadProtocolQaContainer(item:any,imageId:string,networkId:string,actualMounts:string){
 assertSourceRootQaTmpfs(item,imageId,actualMounts);
 const requested=item?.HostConfig?.PortBindings,networks=item?.NetworkSettings?.Networks;
 if(item?.HostConfig?.PublishAllPorts!==false||!requested||Object.keys(requested).length!==1||!Array.isArray(requested['5432/tcp'])||requested['5432/tcp'].length!==1||requested['5432/tcp'][0]?.HostIp!=='127.0.0.1'||requested['5432/tcp'][0]?.HostPort!=='5548'||!/^[0-9a-f]{64}$/.test(networkId)||!networks||Object.keys(networks).length!==1||networks['anvil-v3-a3-read-protocol-qa-net']?.NetworkID!==networkId)throw Error('QA_PROTOCOL_PORT_OR_NETWORK_INVALID');
}
