import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {
 currentProfile,
 verifyContainerObservation,
} from './qa-ix01-current-journey.ts';
import type {NegativeOwnedTarget} from './qa-ix01-0076-atomicity-negative.ts';

const purpose='IX01_0076_NEGATIVE_LINUX_CONTAINER_SOURCE_VERIFIED' as const;
const owner='IX01_0076_NEGATIVE';
const maximumObservationBytes=32_768;

export interface NegativeLinuxContainerPin{
 readonly recipient:object;
 readonly target:NegativeOwnedTarget;
 readonly startedWall:number;
 readonly startedMonotonic:number;
 readonly expiresAt:number;
 current(this:object,target:NegativeOwnedTarget):unknown;
 wall(this:object):number;
 monotonic(this:object):number;
 inspect(this:object,target:NegativeOwnedTarget):Promise<Readonly<{daemonRaw:string;containerRaw:string;closed:boolean}>>;
}

export interface NegativeLinuxContainerSourceProjection{
 readonly schemaVersion:1;
 readonly purpose:typeof purpose;
 readonly attemptId:string;
 readonly containerId:string;
 readonly image:string;
 readonly evidence:'DAEMON_AND_CONTAINER_INSPECT_SOURCE_ONLY';
 readonly isolated:true;
 readonly runtimeVerified:false;
 readonly executionAuthorized:false;
}

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_CONTAINER_INVALID');};
const exact=(value:unknown,keys:readonly string[]):value is Record<string,unknown>=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value))return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),found=Reflect.ownKeys(descriptors);
 return found.length===keys.length&&found.every(key=>typeof key==='string'&&keys.includes(key))
  &&keys.every(key=>Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key]!,'value'));
};
const hash=(value:unknown,size:number):value is string=>typeof value==='string'&&value.length===size&&/^[a-f0-9]+$/.test(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

function targetShape(target:NegativeOwnedTarget){
 if(!exact(target,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId'])||!Object.isFrozen(target)
  ||target.schemaVersion!==1||target.purpose!=='IX01_0076_NEGATIVE_OWNED_TARGET'||!uuid(target.attemptId)||!hash(target.sourceHead,40)
  ||!hash(target.planHash,64)||!hash(target.graphHash,64)||!hash(target.containerId,64)||!exact(target.namespace,['container','database','receipt','network'])
  ||!Object.isFrozen(target.namespace))invalid();
 const compact=target.attemptId.replaceAll('-','');
 if(target.namespace.container!=='anvil-ix01-0076-negative-'+compact||target.namespace.database!=='ix01_0076_negative_'+compact
  ||target.namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+target.attemptId||target.namespace.network!=='none')invalid();
 return compact;
}

function rawObject(raw:unknown):Record<string,any>{
 if(typeof raw!=='string')return invalid();
 if(Buffer.byteLength(raw)>maximumObservationBytes)return invalid();
 try{const value=parseWireJson(raw);if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value))return invalid();return value as Record<string,any>;}catch{return invalid();}
}

export async function verify0076NegativeLinuxContainerSource(target:NegativeOwnedTarget,pin:NegativeLinuxContainerPin):Promise<Readonly<NegativeLinuxContainerSourceProjection>>{
 const compact=targetShape(target);
 if(!exact(pin,['recipient','target','startedWall','startedMonotonic','expiresAt','current','wall','monotonic','inspect'])||!Object.isFrozen(pin)
  ||pin.target!==target||!pin.recipient||typeof pin.recipient!=='object'||!Number.isSafeInteger(pin.startedWall)||!Number.isSafeInteger(pin.expiresAt)
  ||!Number.isFinite(pin.startedMonotonic)||pin.startedMonotonic<0||pin.startedWall>=pin.expiresAt
  ||typeof pin.current!=='function'||typeof pin.wall!=='function'||typeof pin.monotonic!=='function'||typeof pin.inspect!=='function')invalid();
 const recipient=pin.recipient,duration=pin.expiresAt-pin.startedWall;
 let lastWall=pin.startedWall,lastMonotonic=pin.startedMonotonic;
 const current=()=>{
  if(pin.current.call(recipient,target)!==undefined)invalid();
  const wall=pin.wall.call(recipient),monotonic=pin.monotonic.call(recipient);
  if(!Number.isSafeInteger(wall)||!Number.isFinite(monotonic)||monotonic<0||wall<lastWall||monotonic<lastMonotonic||wall>=pin.expiresAt
   ||monotonic-pin.startedMonotonic>=duration)invalid();
  lastWall=wall;lastMonotonic=monotonic;
 };
 current();
 const reply=await pin.inspect.call(recipient,target).catch(()=>invalid());
 current();
 if(!exact(reply,['daemonRaw','containerRaw','closed'])||reply.closed!==true)invalid();
 const daemon=rawObject(reply.daemonRaw);
 if(!exact(daemon,['ID','Name'])||daemon.ID!==currentProfile.daemon||daemon.Name!=='SINSAN')invalid();
 const observation=rawObject(reply.containerRaw),labels={'anvil.owner':owner,'anvil.instance':compact,'anvil.plan':target.planHash};
 verifyContainerObservation(observation,{containerId:target.containerId,containerName:target.namespace.container,image:currentProfile.image,labels});
 if(observation.running!==true||!exact(observation.networks,['none']))invalid();
 const none=observation.networks.none;
 if(!none||typeof none!=='object'||Array.isArray(none)||!hash(none.NetworkID,64)||none.IPAddress!=='')invalid();
 current();
 return Object.freeze({schemaVersion:1,purpose,attemptId:target.attemptId,containerId:target.containerId,image:currentProfile.image,
  evidence:'DAEMON_AND_CONTAINER_INSPECT_SOURCE_ONLY',isolated:true,runtimeVerified:false,executionAuthorized:false});
}
