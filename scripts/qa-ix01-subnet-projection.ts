import {isIP} from 'node:net';
import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {selectSubnetCandidate,type SubnetProjection,type SubnetCandidateResult} from './qa-ix01-subnet-candidate.ts';

/** 동기 메모리 포트 계약. 명령/launcher/실제 수집기는 포함하지 않는다.
 * 허용 필드만 담은 완전한 JSON 투영을 공급해야 한다. 실제 도구의 생략 필드 의미,
 * 다른 namespace/상위 호스트 및 관측 완전성은 공급자 책임이며 자체 권위가 아니다.
 * 실제 실행 감독은 각 호출10초/전체60초를 별도로 강제해야 한다. 이 계층은 supplied now로
 * 반환 전후 초과를 거절하며, 반환하지 않는 동기 포트를 직접 선점/중단할 수는 없다.
 */
export interface SubnetProjectionPorts {
 now():number;
 readAddresses():unknown;
 readRoutes():unknown;
 readDockerIds():unknown;
 readDockerIpam(id:string):unknown;
}
export interface SubnetProjectionWindow {readonly issuedAt:number;readonly expiresAt:number}
const unknown=Object.freeze({code:'UNKNOWN'} as const);
const methods=['now','readAddresses','readRoutes','readDockerIds','readDockerIpam'] as const;
type Row=Record<string,unknown>;
function invalid():never{throw null;}
function record(value:unknown,required:readonly string[],optional:readonly string[]=[]):Row{
 if(!value||typeof value!=='object'||types.isProxy(value))return invalid();
 if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)return invalid();
 const keys=Reflect.ownKeys(value),allowed=[...required,...optional];
 if(keys.some(key=>typeof key!=='string'||!allowed.includes(key))||required.some(key=>!keys.includes(key)))return invalid();
 const result:Row=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key)!;
  if(!Object.hasOwn(d,'value')||!d.enumerable)return invalid();result[key as string]=d.value;
 }return result;
}
function rows(value:unknown,max:number):unknown[]{if(!Array.isArray(value)||value.length>max)return invalid();return value;}
function ip(value:unknown):4|6{
 if(typeof value!=='string'||value.length>45)return invalid();const family=isIP(value);
 if(family!==4&&family!==6)return invalid();return family;
}
function cidr(value:unknown):4|6{
 if(typeof value!=='string'||value.length>49)return invalid();const parts=value.split('/');
 if(parts.length!==2||! /^(0|[1-9]\d{0,2})$/.test(parts[1]!))return invalid();
 const family=ip(parts[0]),prefix=Number(parts[1]);if(prefix>(family===4?32:128))return invalid();
 if(family===4&&prefix===0&&parts[0]!=='0.0.0.0')return invalid();return family;
}
function table(value:unknown):void{
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=0xffff_ffff)return;
 if(typeof value==='string'&&/^[A-Za-z0-9_.-]{1,64}$/.test(value))return;invalid();
}

/** 후보 계산만 반환한다. 시작/종료 ID 집합 동일은 중간 변동·동일 ID의 IPAM 변경이나
 * 전체 관측의 원자성을 보장하지 않는다. 원문/ID/이름/포트 예외를 반환하거나 기록하지 않는다.
 */
export function projectSubnetCandidate(ports:SubnetProjectionPorts,window:SubnetProjectionWindow):SubnetCandidateResult{
 try{
  const callbacks=record(ports,methods),period=record(window,['issuedAt','expiresAt']);
  for(const name of methods)if(typeof callbacks[name]!=='function'||types.isProxy(callbacks[name]))return unknown;
  const start=period.issuedAt,end=period.expiresAt;
  if(typeof start!=='number'||typeof end!=='number'||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)
   ||start<=0||end<=start||end-start>60_000)return unknown;
  let last=start,totalBytes=0;
  const check=()=>{const value:unknown=Reflect.apply(callbacks.now as Function,ports,[]);
   if(typeof value!=='number'||!Number.isSafeInteger(value)||value<last||value>=end)return invalid();last=value;return value;
  };
  const read=(name:Exclude<typeof methods[number],'now'>,args:unknown[]=[])=>{
   const before=check(),raw:unknown=Reflect.apply(callbacks[name] as Function,ports,args);const after=check();
   if(after-before>10_000)return invalid();
   if(typeof raw!=='string'||!raw.isWellFormed()||raw.length>1_048_576)return invalid();
   const bytes=Buffer.byteLength(raw);totalBytes+=bytes;
   if(bytes===0||bytes>1_048_576||totalBytes>8_388_608)return invalid();
   const value=parseWireJson(raw);check();return value;
  };
  const ids=(value:unknown)=>{const result=rows(value,4096);
   if(result.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))||new Set(result).size!==result.length)return invalid();
   return (result as string[]).slice().sort();
  };
  const observedAt=check(),beforeIds=ids(read('readDockerIds'));
  const interfaces:{address:string;prefixLength:number}[]=[],routes:{table:string|number;destination:string}[]=[],
   dockerIpam:{subnet:string;ipRange:string|null;gateway:string|null;reserved:string[]}[]=[];
  let addressCount=0,configCount=0,reservedCount=0;
  for(const value of rows(read('readAddresses'),4096)){
   const item=record(value,['addr_info']);
   for(const raw of rows(item.addr_info,4096-addressCount)){
    addressCount++;const info=record(raw,['family','local','prefixlen']),family=ip(info.local),bits=info.prefixlen;
    if(info.family!==(family===4?'inet':'inet6')||typeof bits!=='number'||!Number.isInteger(bits)||bits<0||bits>(family===4?32:128))return unknown;
    if(family===4)interfaces.push({address:info.local as string,prefixLength:bits});
   }
  }
  for(const value of rows(read('readRoutes'),16384)){
   const item=record(value,['table','dst']);table(item.table);
   const family=item.dst==='default'?4:typeof item.dst==='string'&&item.dst.includes('/')?cidr(item.dst):ip(item.dst);
   if(family===4)routes.push({table:item.table as string|number,destination:item.dst as string});
  }
  for(const id of beforeIds){
   const item=record(read('readDockerIpam',[id]),['Id','IPAM']);if(item.Id!==id)return unknown;
   const ipam=record(item.IPAM,['Config']);if(ipam.Config===null)continue;
   for(const value of rows(ipam.Config,4096-configCount)){
    configCount++;const config=record(value,['Subnet','IPRange','Gateway','AuxiliaryAddresses']),family=cidr(config.Subnet);
    const ipRange=config.IPRange,gateway=config.Gateway;
    if(ipRange!==null&&cidr(ipRange)!==family||gateway!==null&&ip(gateway)!==family)return unknown;
    const auxiliary=config.AuxiliaryAddresses;let reserved:string[]=[];
    if(auxiliary!==null){
     if(typeof auxiliary!=='object'||Array.isArray(auxiliary))return unknown;
     const values=Object.values(auxiliary);reservedCount+=values.length;if(reservedCount>16384)return unknown;
     if(values.some(value=>ip(value)!==family))return unknown;reserved=values as string[];
    }
    if(family===4)dockerIpam.push({subnet:config.Subnet as string,ipRange:ipRange as string|null,gateway:gateway as string|null,reserved});
   }
  }
  const afterIds=ids(read('readDockerIds'));
  if(beforeIds.length!==afterIds.length||beforeIds.some((id,index)=>id!==afterIds[index]))return unknown;
  const projection:SubnetProjection={schemaVersion:1,observedAt,complete:{interfaces:true,routesAllTables:true,dockerIpam:true},interfaces,routes,dockerIpam};
  const result=selectSubnetCandidate(projection,check());check();return result;
 }catch{return unknown;}
}
