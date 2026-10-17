import{assertSourceRootQaTmpfs}from'./source-root-qa-guard.ts';
export function assertSourceReadQaBindings(cwd:string,moduleFile:string,manifestRoot:string,env:NodeJS.ProcessEnv){
 if(cwd!=='/home/daon/deploy/anvil-v3'||moduleFile!==cwd+'/scripts/qa-source-read-sql.ts'||manifestRoot!==cwd||Object.entries(env).some(([k,v])=>k.startsWith('DOCKER_')&&!!v))throw Error('QA_RUNTIME_OR_DOCKER_OVERRIDE_INVALID');
}
export function assertSourceReadQaDaemon(info:any,id:string,name:string){if(!/^[A-Za-z0-9:_-]{12,128}$/.test(id)||!/^[A-Za-z0-9_.-]{1,253}$/.test(name)||info?.ID!==id||info?.Name!==name)throw Error('QA_DAEMON_BINDING_INVALID');}
export function assertSourceReadQaContainer(item:any,imageId:string,networkId:string,actualMounts:string){
 assertSourceRootQaTmpfs(item,imageId,actualMounts);const ports=item?.HostConfig?.PortBindings,networks=item?.NetworkSettings?.Networks;
 if(!/^[0-9a-f]{64}$/.test(networkId)||!ports||Object.keys(ports).length!==1||!Array.isArray(ports['5432/tcp'])||ports['5432/tcp'].length!==1||ports['5432/tcp'][0]?.HostIp!=='127.0.0.1'||ports['5432/tcp'][0]?.HostPort!=='5548'||!networks||Object.keys(networks).length!==1||networks['anvil-v3-a3-read-sql-qa-net']?.NetworkID!==networkId)throw Error('QA_PORT_OR_NETWORK_INVALID');
}
