import {assertSourceRootQaTmpfs} from './source-root-qa-guard.ts';
export function assertSourceReadPsqlBindings(cwd:string,moduleFile:string,manifestRoot:string,env:NodeJS.ProcessEnv){
 if(cwd!=='/home/daon/deploy/anvil-v3'||moduleFile!==cwd+'/scripts/qa-source-read-psql.ts'||manifestRoot!==cwd||Object.entries(env).some(([k,v])=>k.startsWith('DOCKER_')&&!!v))throw Error('QA_PSQL_RUNTIME_OR_DOCKER_OVERRIDE_INVALID');
}
export function assertSourceReadPsqlContainer(item:any,imageId:string,networkId:string,actualMounts:string){
 assertSourceRootQaTmpfs(item,imageId,actualMounts);
 const requested=item?.HostConfig?.PortBindings,actual=item?.NetworkSettings?.Ports,networks=item?.NetworkSettings?.Networks;
 if(item?.HostConfig?.PublishAllPorts!==false||(requested!=null&&(typeof requested!=='object'||Object.keys(requested).length))||!actual||Object.keys(actual).length!==1||actual['5432/tcp']!==null||!/^[0-9a-f]{64}$/.test(networkId)||!networks||Object.keys(networks).length!==1||networks['anvil-v3-a3-read-psql-qa-net']?.NetworkID!==networkId)throw Error('QA_PSQL_PUBLISH_OR_NETWORK_INVALID');
}
