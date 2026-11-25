import test from 'node:test';
import assert from 'node:assert/strict';
import {
 verify0076NegativeLinuxContainerSource,
 type NegativeLinuxContainerPin,
} from '../../../scripts/qa-ix01-0076-negative-linux-container.ts';
import type {NegativeOwnedTarget} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';

const attemptId='fa000000-0000-4000-8000-000000000001',compact=attemptId.replaceAll('-','');
const target=Object.freeze({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET',attemptId,sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),graphHash:'c'.repeat(64),
 namespace:Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,
  receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'}),containerId:'d'.repeat(64)}) satisfies NegativeOwnedTarget;
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f';
const labels={'anvil.owner':'IX01_0076_NEGATIVE','anvil.instance':compact,'anvil.plan':target.planHash};
const tmpfs={'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456,uid=999,gid=999','/var/run/postgresql':'rw,noexec,nosuid,size=16777216,uid=999,gid=999','/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'};

function container(){return{id:target.containerId,name:'/'+target.namespace.container,image,user:'999:999',labels:{...labels},running:true,
 host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,
  Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:{...tmpfs}},mounts:[],
 networks:{none:{NetworkID:'e'.repeat(64),IPAddress:''}},ports:{'5432/tcp':null}};}

function fixture(patch:{target?:NegativeOwnedTarget;wall?:number;mono?:number;closed?:boolean;daemon?:unknown;container?:unknown;currentReturn?:unknown;onCurrent?:()=>void}={}){
 const recipient=Object.freeze(Object.create(null)),startedWall=1_000,startedMonotonic=10.25,expiresAt=5_000;
 const pin=Object.freeze({recipient,target:patch.target??target,startedWall,startedMonotonic,expiresAt,
  current(this:object,found:NegativeOwnedTarget){assert.equal(this,recipient);assert.equal(found,target);patch.onCurrent?.();return patch.currentReturn;},
  wall(this:object){assert.equal(this,recipient);return patch.wall??1_100;},monotonic(this:object){assert.equal(this,recipient);return patch.mono??110.75;},
  async inspect(this:object,found:NegativeOwnedTarget){assert.equal(this,recipient);assert.equal(found,target);return Object.freeze({
   daemonRaw:JSON.stringify(patch.daemon??{ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'}),
   containerRaw:JSON.stringify(patch.container??container()),closed:patch.closed??true});},
 }) satisfies NegativeLinuxContainerPin;
 return pin;
}

test('원 native pin의 exact 0076 container inspect만 source-only preflight로 검산한다',async()=>{
 let current=0;const result=await verify0076NegativeLinuxContainerSource(target,fixture({onCurrent(){current++;}}));
 assert.deepEqual(result,{schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_CONTAINER_SOURCE_VERIFIED',attemptId,containerId:target.containerId,
  image,evidence:'DAEMON_AND_CONTAINER_INSPECT_SOURCE_ONLY',isolated:true,runtimeVerified:false,executionAuthorized:false});
 assert.equal(current,3);
});

test('raw inspect 변조·foreign pin·만료·close 불명은 authority나 source match를 만들지 않는다',async()=>{
 const mutations:Array<(value:any)=>void>=[
  value=>value.id='f'.repeat(64),value=>value.name='/foreign',value=>value.image='sha256:'+'0'.repeat(64),value=>value.labels['anvil.owner']='FOREIGN',
  value=>value.labels['anvil.instance']='0'.repeat(32),value=>value.labels['anvil.plan']='0'.repeat(64),value=>value.host.NetworkMode='host',
  value=>value.host.PortBindings={'5432/tcp':[{}]},value=>value.host.Binds=['/host:/container'],value=>value.host.Privileged=true,value=>value.networks={bridge:{}},
 ];
 for(const mutate of mutations){const value=container();mutate(value);await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({container:value})));}
 const foreign=Object.freeze({...target,containerId:'f'.repeat(64)}) as NegativeOwnedTarget;
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({target:foreign})));
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({wall:5_000,mono:4_010})));
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({wall:1_100,mono:4_010.25})));
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({closed:false})));
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({daemon:{ID:'0'.repeat(64),Name:'SINSAN'}})));
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,fixture({currentReturn:true})));
 let getterReads=0;const accessor=Object.freeze(Object.defineProperty({...fixture()},'target',{enumerable:true,get(){getterReads++;return target;}})) as NegativeLinuxContainerPin;
 await assert.rejects(verify0076NegativeLinuxContainerSource(target,accessor));assert.equal(getterReads,0);
});
