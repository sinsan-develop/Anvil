import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {projectSubnetCandidate,type SubnetProjectionWindow} from './qa-ix01-subnet-projection.ts';
import type {SubnetCandidateResult} from './qa-ix01-subnet-candidate.ts';

export interface SubnetReadCommand {
 readonly tool:'ip'|'docker';readonly args:readonly string[];
 readonly timeoutMs:number;readonly maxOutputBytes:number;
}
/** 실제 실행기는 아니다. run 공급자는 사전 검산된 원 도구만 호출하고 고정 daemon/socket,
 * 사용자 설정·credential을 읽지 않는 호출 설정, stdin 없음과 고정 환경을 보장해야 한다.
 * 임의 실행파일/인자/env/stdin 주입 포트가 아니며 아래 닫힌 명령만 수락해야 한다.
 * run은 timeout 내 원 자식을 종결·수거해야 한다. stdout만 일시 메모리로 전달하고 stderr,
 * 예외/원자료를 기록하지 않는다. 도구/설정 신원 및 실제 종결은 이 합성 계층이 증명하지 않는다.
 */
export interface SubnetObservationPorts {
 now():number;monotonic():number;
 run(command:SubnetReadCommand):unknown;
}
const unknown=Object.freeze({code:'UNKNOWN'} as const),maxBytes=1_048_576;
const host=['--host','unix:///var/run/docker.sock'] as const;
const daemonTemplate='{"ID":{{json .ID}},"Name":{{json .Name}}}';
const ipamTemplate='{"Id":{{json .Id}},"IPAM":{"Config":{{if .IPAM.Config}}[{{range $i, $c := .IPAM.Config}}{{if $i}},{{end}}{"Subnet":{{json $c.Subnet}},"IPRange":{{json $c.IPRange}},"Gateway":{{json $c.Gateway}},"AuxiliaryAddresses":{{json $c.AuxiliaryAddresses}}}{{end}}]{{else}}null{{end}}}}';
function invalid():never{throw null;}
function data(value:unknown):Record<string,unknown>{
 if(value===null||typeof value!=='object'||types.isProxy(value))return invalid();
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return invalid();
 const result:Record<string,unknown>=Object.create(null);
 for(const key of Reflect.ownKeys(value)){
  if(typeof key!=='string')return invalid();const d=Object.getOwnPropertyDescriptor(value,key)!;
  if(!Object.hasOwn(d,'value')||!d.enumerable)return invalid();result[key]=d.value;
 }return result;
}
function exact(value:unknown,keys:readonly string[]):Record<string,unknown>{
 const result=data(value);if(Object.keys(result).length!==keys.length||keys.some(k=>!Object.hasOwn(result,k)))return invalid();return result;
}
function pick(value:unknown,keys:readonly string[]):Record<string,unknown>{
 const row=data(value),result:Record<string,unknown>=Object.create(null);
 for(const key of keys){if(!Object.hasOwn(row,key))return invalid();result[key]=row[key];}return result;
}
function rows(value:unknown,max:number):unknown[]{if(!Array.isArray(value)||value.length>max)return invalid();return value;}

/** 승인된 관측의 전달 조립용 순수 함수. 실제 호출/SSH/CLI 진입점·파일 쓰기가 없다.
 * 결과에는 후보/판정만 남긴다. 원 stdout은 파싱/선별 범위 밖으로 반환하지 않지만 메모리
 * zeroization이나 관측 원자성은 보장하지 않는다. 완전성은 원 포트 공급자의 책임이다.
 */
export function observeSubnetCandidate(ports:SubnetObservationPorts,window:SubnetProjectionWindow):SubnetCandidateResult{
 try{
  const callbacks=exact(ports,['now','monotonic','run']),period=exact(window,['issuedAt','expiresAt']);
  for(const name of ['now','monotonic','run'])if(typeof callbacks[name]!=='function'||types.isProxy(callbacks[name]))return unknown;
  const start=period.issuedAt,end=period.expiresAt;
  if(typeof start!=='number'||typeof end!=='number'||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<=0||end<=start||end-start>60_000)return unknown;
  const invoke=(name:string,args:unknown[]=[])=>Reflect.apply(callbacks[name] as Function,ports,args) as unknown;
  const initialMono=invoke('monotonic');if(typeof initialMono!=='number'||!Number.isFinite(initialMono)||initialMono<0)return unknown;
  let lastWall=start,lastMono=initialMono,total=0;
  const check=()=>{
   const wall=invoke('now'),mono=invoke('monotonic');
   if(typeof wall!=='number'||!Number.isSafeInteger(wall)||wall<lastWall||wall>=end||typeof mono!=='number'||!Number.isFinite(mono)||mono<lastMono||mono-initialMono>=60_000)return invalid();
   lastWall=wall;lastMono=mono;return {wall,mono};
  };
  const command=(tool:'ip'|'docker',args:readonly string[],emptyList=false)=>{
   const before=check(),timeoutMs=Math.floor(Math.min(10_000,end-before.wall,60_000-(before.mono-initialMono)));
   if(timeoutMs<=0)return invalid();
   const request=Object.freeze({tool,args:Object.freeze([...args]),timeoutMs,maxOutputBytes:maxBytes});
   const returned=invoke('run',[request]),after=check();
   if(after.wall-before.wall>timeoutMs||after.mono-before.mono>timeoutMs)return invalid();
   const result=exact(returned,['status','stdout']);if(result.status!=='OK')return invalid();
   const raw=result.stdout;if(typeof raw!=='string'||!raw.isWellFormed()||raw.length>maxBytes)return invalid();
   const bytes=Buffer.byteLength(raw);total+=bytes;if((!bytes&&!emptyList)||bytes>maxBytes||total>8_388_608)return invalid();return raw;
  };
  const json=(tool:'ip'|'docker',args:readonly string[])=>{const value=parseWireJson(command(tool,args));check();return value;};
  const daemon=exact(json('docker',[...host,'info','--format',daemonTemplate]),['ID','Name']);
  if(daemon.ID!=='e3349f1d-dbfc-478a-96d9-295bf6c6839e'||daemon.Name!=='SINSAN')return unknown;
  return projectSubnetCandidate({now:()=>check().wall,
   readDockerIds(){
    const raw=command('docker',[...host,'network','ls','--no-trunc','--format','{{json .ID}}'],true);
    if(raw==='')return '[]';
    const lines=raw.replace(/\r?\n$/,'').split(/\r?\n/);if(lines.length>4096)return invalid();
    const ids=lines.map(line=>parseWireJson(line));check();return JSON.stringify(ids);
   },
   readAddresses(){
    let count=0;const addresses=rows(json('ip',['-j','-4','address','show']),4096).map(value=>{
     const item=pick(value,['addr_info']);const addr_info=rows(item.addr_info,4096-count).map(info=>{count++;return pick(info,['family','local','prefixlen']);});return {addr_info};
    });check();return JSON.stringify(addresses);
   },
   readRoutes(){
    const routes=rows(json('ip',['-j','-4','-details','route','show','table','all']),16384).map(value=>pick(value,['table','dst']));
    check();return JSON.stringify(routes);
   },
   readDockerIpam(id:string){
    if(!/^[a-f0-9]{64}$/.test(id))return invalid();
    const item=exact(json('docker',[...host,'network','inspect','--format',ipamTemplate,id]),['Id','IPAM']);
    const ipam=exact(item.IPAM,['Config']);
    const Config=ipam.Config===null?null:rows(ipam.Config,4096).map(value=>{
     const row=exact(value,['Subnet','IPRange','Gateway','AuxiliaryAddresses']);
     // 명시된 빈 선택 문자열만 null로 표현한다. 누락 필드나 Subnet은 추정하지 않는다.
     return {...row,IPRange:row.IPRange===''?null:row.IPRange,Gateway:row.Gateway===''?null:row.Gateway};
    });check();return JSON.stringify({Id:item.Id,IPAM:{Config}});
   },
  },{issuedAt:start,expiresAt:end});
 }catch{return unknown;}
}
