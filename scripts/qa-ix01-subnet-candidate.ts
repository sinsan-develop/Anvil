import {types} from 'node:util';

/** 완전성/시각은 투영 공급자의 선언이다. 실제 조회, 원자적 관측, 예약 또는 실행 권위가 아니다.
 * 공급자는 동일 WSL namespace의 IPv4 인터페이스 전체, 모든 table의 IPv4 경로,
 * Docker의 모든 IPv4 IPAM Config를 빠짐없이 투영해야 한다. IPv6/다른 namespace 및
 * 상위 호스트/VPN의 범위 확인도 공급자 책임이며 이 함수가 완전성을 소급 증명하지 않는다.
 */
export interface SubnetProjection {
 readonly schemaVersion:1;
 readonly observedAt:number;
 readonly complete:{readonly interfaces:true;readonly routesAllTables:true;readonly dockerIpam:true};
 readonly interfaces:readonly {readonly address:string;readonly prefixLength:number}[];
 readonly routes:readonly {readonly table:string|number;readonly destination:string}[];
 readonly dockerIpam:readonly {readonly subnet:string;readonly ipRange:string|null;
  readonly gateway:string|null;readonly reserved:readonly string[]}[];
}
export type SubnetCandidateResult=Readonly<{code:'CANDIDATE';cidr:string}|{code:'NO_CANDIDATE'|'UNKNOWN'}>;
const limits=Object.freeze({ageMs:300_000,interfaces:4096,routes:16384,ipam:4096,reserved:16384});
const unknown=Object.freeze({code:'UNKNOWN'} as const),none=Object.freeze({code:'NO_CANDIDATE'} as const);
type Range={start:number;end:number};
function invalid():never{throw null;}

// 호출자 getter/toJSON/iterator/Proxy를 실행하지 않고 닫힌 데이터 속성만 복제한다.
function fields(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(value===null||typeof value!=='object'||types.isProxy(value))return invalid();
 const proto=Object.getPrototypeOf(value);
 if(proto!==Object.prototype&&proto!==null)return invalid();
 const names=Reflect.ownKeys(value);
 if(names.length!==keys.length||names.some(name=>typeof name!=='string'||!keys.includes(name)))return invalid();
 const result:Record<string,unknown>=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return invalid();result[key]=d.value;
 }
 return result;
}
function array(value:unknown,max:number):unknown[]{
 if(value===null||typeof value!=='object'||types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return invalid();
 const length=Object.getOwnPropertyDescriptor(value,'length')?.value;
 if(!Number.isSafeInteger(length)||length<0||length>max||Reflect.ownKeys(value).length!==length+1)return invalid();
 const result:unknown[]=[];
 for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return invalid();result.push(d.value);
 }
 return result;
}
function address(value:unknown):number{
 if(typeof value!=='string'||value.length>15||! /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(value))return invalid();
 const octets=value.split('.').map(Number);if(octets.some(octet=>octet>255))return invalid();
 return octets.reduce((total,octet)=>total*256+octet,0);
}
function prefix(value:unknown):number{
 if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>32)return invalid();return value;
}
function range(ip:number,bits:number):Range{
 const size=2**(32-bits),start=Math.floor(ip/size)*size;return {start,end:start+size-1};
}
function cidr(value:unknown,hostAllowed=false):Range{
 if(typeof value!=='string'||value.length>18)return invalid();const parts=value.split('/');
 if(parts.length===1&&hostAllowed)return range(address(parts[0]),32);
 if(parts.length!==2||! /^(?:0|[1-9]\d?)$/.test(parts[1]!))return invalid();
 const bits=prefix(Number(parts[1])),ip=address(parts[0]);
 // 0/0만 기본 경로 표현으로 허용한다. 다른 주소/0을 기본으로 조용히 버리지 않는다.
 if(bits===0&&ip!==0)return invalid();return range(ip,bits);
}
function contains(outer:Range,inner:Range):boolean{return outer.start<=inner.start&&inner.end<=outer.end;}
function table(value:unknown):void{
 if(typeof value==='number'&&Number.isSafeInteger(value)&&value>0&&value<=0xffff_ffff)return;
 if(typeof value==='string'&&/^[A-Za-z0-9_.-]{1,64}$/.test(value))return;invalid();
}

/** 외부 제공 now를 사용한 순수 계산이다. 파일/프로세스/명령/clock 호출 및 실행 진입점이 없다.
 * 오래되거나 미래의 투영은 UNKNOWN. 5분 이내여도 실제 사용 직전의 재검산/예약을 대신하지 않는다.
 * 반환 CIDR은 숫자 순서의 첫 빈 /28 하나이며 기존 주소/망 이름/ID/예외는 반환하지 않는다.
 */
export function selectSubnetCandidate(value:unknown,now:number):SubnetCandidateResult{
 try{
  if(!Number.isSafeInteger(now)||now<=0)return unknown;
  const input=fields(value,['schemaVersion','observedAt','complete','interfaces','routes','dockerIpam']);
  const observedAt=input.observedAt;
  if(input.schemaVersion!==1||typeof observedAt!=='number'||!Number.isSafeInteger(observedAt)||observedAt<=0
   ||observedAt>now||now-observedAt>limits.ageMs)return unknown;
  const complete=fields(input.complete,['interfaces','routesAllTables','dockerIpam']);
  if(complete.interfaces!==true||complete.routesAllTables!==true||complete.dockerIpam!==true)return unknown;
  const blocked:Range[]=[];
  for(const value of array(input.interfaces,limits.interfaces)){
   const item=fields(value,['address','prefixLength']);blocked.push(range(address(item.address),prefix(item.prefixLength)));
  }
  for(const value of array(input.routes,limits.routes)){
   const item=fields(value,['table','destination']);table(item.table);
   if(item.destination==='default')continue;const destination=cidr(item.destination,true);
   if(destination.start===0&&destination.end===0xffff_ffff)continue;
   blocked.push(destination);
  }
  let reservedCount=0;
  for(const value of array(input.dockerIpam,limits.ipam)){
   const item=fields(value,['subnet','ipRange','gateway','reserved']),subnet=cidr(item.subnet);
   if(item.ipRange!==null&&!contains(subnet,cidr(item.ipRange)))return unknown;
   if(item.gateway!==null&&!contains(subnet,range(address(item.gateway),32)))return unknown;
   const reserved=array(item.reserved,limits.reserved-reservedCount);reservedCount+=reserved.length;
   for(const ip of reserved)if(!contains(subnet,range(address(ip),32)))return unknown;
   // 전체 IPAM subnet을 배제하므로 range/gateway/reserved까지 모두 배제된다.
   blocked.push(subnet);
  }
  // 최대 24,576개 구간을 정렬·합친 후 후보 65,280개를 한 번씩만 대조한다.
  blocked.sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged:Range[]=[];
  for(const item of blocked){const previous=merged.at(-1);
   if(previous&&item.start<=previous.end+1)previous.end=Math.max(previous.end,item.end);else merged.push({...item});
  }
  let cursor=0;
  for(let second=16;second<=31;second++)for(let third=0;third<255;third++)for(let fourth=0;fourth<256;fourth+=16){
   const start=((172*256+second)*256+third)*256+fourth,end=start+15;
   while(cursor<merged.length&&merged[cursor]!.end<start)cursor++;
   if(cursor===merged.length||merged[cursor]!.start>end)return Object.freeze({code:'CANDIDATE',cidr:`172.${second}.${third}.${fourth}/28`});
  }
  return none;
 }catch{return unknown;}
}
