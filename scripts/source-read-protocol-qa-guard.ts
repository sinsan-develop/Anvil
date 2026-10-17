import {assertSourceRootQaTmpfs} from './source-root-qa-guard.ts';
import {assertSourceReadQaPublishedPort} from './source-read-qa-guard.ts';
type QaResourceKind='container'|'network';
/** 관측으로 되찾은 ID도 이번 정확 이름/난수/소유를 확인한다. 삭제 권한을 부여하지 않는다. */
export function assertSourceReadProtocolQaIdentity(item:any,kind:QaResourceKind,instance:string,expectedId?:string):string{
 const labels=kind==='container'?item?.Config?.Labels:item?.Labels,name=kind==='container'?'/anvil-v3-a3-read-protocol-qa-pg':'anvil-v3-a3-read-protocol-qa-net';
 if(!['container','network'].includes(kind)||!/^[0-9a-f]{32}$/.test(instance)||typeof item?.Id!=='string'||!/^[0-9a-f]{64}$/.test(item.Id)||expectedId!==undefined&&item.Id!==expectedId||item.Name!==name||labels?.['anvil.project']!=='v3'||labels?.['anvil.owner']!=='A3_READ_PROTOCOL_QA'||labels?.['anvil.instance']!==instance||kind==='network'&&(item.Driver!=='bridge'||item.Internal!==false))throw Error('QA_CLEANUP_IDENTITY_MISMATCH');
 return item.Id;
}
/** 읽기 전용 discover만 사용한다. 후속 정리는 image/mount/port/network 검사를 별도로 통과해야 한다. */
export function recoverSourceReadProtocolQaIds(ids:{containerId:string|null;networkId:string|null},instance:string,discover:(kind:QaResourceKind,name:string)=>any|null){
 if(!/^[0-9a-f]{32}$/.test(instance)||[ids.containerId,ids.networkId].some(id=>id!==null&&!/^[0-9a-f]{64}$/.test(id)))throw Error('QA_CLEANUP_IDENTITY_MISMATCH');
 const next={...ids};for(const [kind,key,name]of [['network','networkId','anvil-v3-a3-read-protocol-qa-net'],['container','containerId','anvil-v3-a3-read-protocol-qa-pg']]as const){if(next[key]!==null)continue;const item=discover(kind,name);if(item!==null)next[key]=assertSourceReadProtocolQaIdentity(item,kind,instance);}return next;
}
export function sourceReadProtocolQaDockerError(error:unknown){
 const e=error as{code?:unknown;signal?:unknown;status?:unknown}|null,code=typeof e?.code==='string'&&['ETIMEDOUT','ENOBUFS','EACCES','EPERM','ENOENT'].includes(e.code)?e.code:null,signal=typeof e?.signal==='string'&&['SIGTERM','SIGKILL','SIGINT'].includes(e.signal)?e.signal:null,exitCode=typeof e?.status==='number'&&Number.isInteger(e.status)&&e.status>=0&&e.status<=255?e.status:null;
 return{failure:'QA_DOCKER_STEP_FAILED',code,signal,exitCode};
}
export function assertSourceReadProtocolQaBindings(cwd:string,moduleFile:string,manifestRoot:string,env:NodeJS.ProcessEnv){
 if(cwd!=='/home/daon/deploy/anvil-v3'||moduleFile!==cwd+'/scripts/qa-source-read-protocol.ts'||manifestRoot!==cwd||Object.entries(env).some(([k,v])=>k.startsWith('DOCKER_')&&!!v))throw Error('QA_PROTOCOL_RUNTIME_OR_DOCKER_OVERRIDE_INVALID');
}
export const assertSourceReadProtocolQaReady=assertSourceReadQaPublishedPort;
export function assertSourceReadProtocolQaContainer(item:any,imageId:string,networkId:string,actualMounts:string){
 assertSourceRootQaTmpfs(item,imageId,actualMounts);
 const requested=item?.HostConfig?.PortBindings,networks=item?.NetworkSettings?.Networks;
 if(item?.HostConfig?.PublishAllPorts!==false||!requested||Object.keys(requested).length!==1||!Array.isArray(requested['5432/tcp'])||requested['5432/tcp'].length!==1||requested['5432/tcp'][0]?.HostIp!=='127.0.0.1'||requested['5432/tcp'][0]?.HostPort!=='5548'||!/^[0-9a-f]{64}$/.test(networkId)||!networks||Object.keys(networks).length!==1||networks['anvil-v3-a3-read-protocol-qa-net']?.NetworkID!==networkId)throw Error('QA_PROTOCOL_PORT_OR_NETWORK_INVALID');
}
