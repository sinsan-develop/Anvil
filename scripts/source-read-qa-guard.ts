import{assertSourceRootQaTmpfs,sourceRootQaError}from'./source-root-qa-guard.ts';
export function sourceReadQaError(error:unknown){
 const e=error as{code?:unknown;message?:unknown}|null,base=sourceRootQaError(error),codes=['ECONNREFUSED','ETIMEDOUT','ECONNRESET','EHOSTUNREACH','ENETUNREACH','EPIPE','EACCES','EADDRINUSE','ENOENT'];
 const messages:Record<string,string>={'Connection terminated due to connection timeout':'CONNECTION_TIMEOUT','timeout exceeded when trying to connect':'CONNECTION_TIMEOUT','Query read timeout':'QUERY_TIMEOUT','Connection terminated unexpectedly':'CONNECTION_CLOSED','Connection terminated':'CONNECTION_CLOSED'};
 const connectionCode=typeof e?.code==='string'&&codes.includes(e.code)?e.code:typeof e?.message==='string'?messages[e.message]??null:null;
 return{...base,failure:connectionCode?'QA_TRANSPORT_FAILED':base.failure,connectionCode};
}
export function assertSourceReadQaBindings(cwd:string,moduleFile:string,manifestRoot:string,env:NodeJS.ProcessEnv){
 if(cwd!=='/home/daon/deploy/anvil-v3'||moduleFile!==cwd+'/scripts/qa-source-read-sql.ts'||manifestRoot!==cwd||Object.entries(env).some(([k,v])=>k.startsWith('DOCKER_')&&!!v))throw Error('QA_RUNTIME_OR_DOCKER_OVERRIDE_INVALID');
}
export function assertSourceReadQaDaemon(info:any,id:string,name:string){if(!/^[A-Za-z0-9:_-]{12,128}$/.test(id)||!/^[A-Za-z0-9_.-]{1,253}$/.test(name)||info?.ID!==id||info?.Name!==name)throw Error('QA_DAEMON_BINDING_INVALID');}
/** 실행 전 실제 공개 결과를 검사한다. 미공개여도 exact 소유 자원 정리는 별도 identity 검사로 유지한다. */
export function assertSourceReadQaPublishedPort(item:any){
 const ports=item?.NetworkSettings?.Ports,binding=ports?.['5432/tcp'];
 if(!ports||Object.keys(ports).length!==1||!Array.isArray(binding)||binding.length!==1||binding[0]?.HostIp!=='127.0.0.1'||binding[0]?.HostPort!=='5548')throw Error('QA_ACTUAL_PORT_NOT_PUBLISHED_OR_INVALID');
}
export function assertSourceReadQaContainer(item:any,imageId:string,networkId:string,actualMounts:string){
 assertSourceRootQaTmpfs(item,imageId,actualMounts);const ports=item?.HostConfig?.PortBindings,networks=item?.NetworkSettings?.Networks;
 if(!/^[0-9a-f]{64}$/.test(networkId)||!ports||Object.keys(ports).length!==1||!Array.isArray(ports['5432/tcp'])||ports['5432/tcp'].length!==1||ports['5432/tcp'][0]?.HostIp!=='127.0.0.1'||ports['5432/tcp'][0]?.HostPort!=='5548'||!networks||Object.keys(networks).length!==1||networks['anvil-v3-a3-read-sql-qa-net']?.NetworkID!==networkId)throw Error('QA_PORT_OR_NETWORK_INVALID');
}
