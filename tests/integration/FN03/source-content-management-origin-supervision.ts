import {installManagementOriginSchema} from './source-content-management-origin-schema.ts';
import {runSourceContentManagementOriginJourney,type ManagementOriginJourneyContext} from './source-content-management-origin-journey.ts';
import type {CurrentSchemaInstallationPorts} from '../IX01/current-schema-installation.ts';

const managementOwner='anvil_v3_source_content_management_owner';
const flags=['superuser','inherit','createRole','createDb','replication','bypassRls','login'] as const;
const fail=():never=>{throw Error('FN03_MANAGEMENT_SUPERVISION_REJECTED');};
function exact(value:unknown,keys:readonly string[]):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
/** JSON은 기존 역할 metadata 포트의 형상이다. 관리 owner 한 행만 제거해 기존 역할 검산에 전달한다.
 * 전체 catalog/membership 투영의 완전성 및 실제 principal은 외부 감독의 책임이며 이 함수는 발급하지 않는다. */
function existingRoleProjection(raw:unknown):string{
 if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)return fail();
 let v:unknown;try{v=JSON.parse(raw);}catch{return fail();}
 if(!exact(v,['sessionUser','currentUser','roles','memberships'])||JSON.stringify(v)!==raw||typeof v.sessionUser!=='string'||typeof v.currentUser!=='string'||!Array.isArray(v.roles)||v.roles.length>21||!Array.isArray(v.memberships)||v.memberships.length>7)return fail();
 let count=0;const remaining:unknown[]=[];
 for(const role of v.roles){
  if(!exact(role,['name',...flags,'validUntil'])||typeof role.name!=='string')return fail();
  if(role.name===managementOwner){if(++count!==1||role.validUntil!==null||flags.some(flag=>role[flag]!==false))return fail();}
  else remaining.push(role);
 }
 if(count!==1)return fail();
 for(const member of v.memberships){
  if(!exact(member,['role','member','grantor','adminOption'])||[member.role,member.member,member.grantor].some(x=>typeof x!=='string'||x===managementOwner)||typeof member.adminOption!=='boolean')return fail();
 }
 return JSON.stringify({...v,roles:remaining});
}
export interface ManagementOriginSupervisionPorts {
 /** 원 소유자·원 시도·절대/monotonic 기한을 검산한다. 대기 중 기한/원 handle 수거 역시 외부 감독이 소유한다. */
 assertCurrent():void;
 installation:CurrentSchemaInstallationPorts;
 readRoleMetadata():Promise<unknown>;
 /** 기존 130개 역할/멤버십 기대를 그대로 적용한다. true/VERIFIED 등 대체 권위 값은 받지 않는다. */
 verifyExistingRoles(raw:string):void;
 /** 이미 인가된 원 app/Access read·별도 보호 observer·원 거래 종결 수거만 반환. 새 권한/연결을 발급하지 않는다. */
 acquireJourney():Promise<ManagementOriginJourneyContext>;
}
type Stage='INSTALL'|'ROLE_READ'|'ROLE_VERIFY'|'JOURNEY_ACQUIRE'|'JOURNEY';
export type ManagementOriginSupervisionResult=
 |Readonly<{status:'CHECKED';stage:'JOURNEY';installationCount:132;authority:'NOT_ISSUED'}>
 |Readonly<{status:'STOPPED';stage:Stage;reason:'BOUNDARY_OR_OUTCOME_UNKNOWN'|'INSTALLATION_STOPPED'|'ATTEMPT_CONSUMED';authority:'NOT_ISSUED'}>;

/** Source-only 조립. import/생성 때 효과0, 같은 인스턴스의 한 시도만 소비하며 외부 실행 승인/프로세스간 단회는 발급하지 않는다.
 * 실제 PG15 권한/제약의 증거는 실제 포트로 실행·수거하기 전까지 없다. cleanup/retry/connection/OS entry 없음. */
export function createManagementOriginSupervision(ports:ManagementOriginSupervisionPorts){
 const {assertCurrent,installation,readRoleMetadata,verifyExistingRoles,acquireJourney}=ports;
 const install=installation.install,append=installation.appendLedger,read=installation.readLedger,installCurrent=installation.assertCurrent;
 let spent=false;
 const current=()=>{if(assertCurrent.call(ports)!==undefined||installCurrent.call(installation)!==undefined)return fail();};
 const fixed:CurrentSchemaInstallationPorts={assertCurrent:current,install:(raw,row)=>install.call(installation,raw,row),appendLedger:row=>append.call(installation,row),readLedger:()=>read.call(installation)};
 return Object.freeze({async run(historicalTsv:unknown,orderedSql:unknown):Promise<ManagementOriginSupervisionResult>{
  let stage:Stage='INSTALL';
  const stopped=(reason:Extract<ManagementOriginSupervisionResult,{status:'STOPPED'}>['reason'])=>Object.freeze({status:'STOPPED' as const,stage,reason,authority:'NOT_ISSUED' as const});
  if(spent)return stopped('ATTEMPT_CONSUMED');spent=true;
  try{
   current();const installed=await installManagementOriginSchema(historicalTsv,orderedSql,fixed);
   if(installed.status!=='VERIFIED')return stopped('INSTALLATION_STOPPED');current();
   stage='ROLE_READ';const roles=await readRoleMetadata.call(ports);current();
   stage='ROLE_VERIFY';const prior=existingRoleProjection(roles);current();if(verifyExistingRoles.call(ports,prior)!==undefined)return fail();current();
   stage='JOURNEY_ACQUIRE';const context=await acquireJourney.call(ports);current();
   const originalCurrent=context.assertCurrent;
   const guarded={...context,assertCurrent:()=>{current();if(originalCurrent.call(context)!==undefined)return fail();current();}};
   stage='JOURNEY';await runSourceContentManagementOriginJourney(guarded);current();
   return Object.freeze({status:'CHECKED',stage:'JOURNEY',installationCount:132,authority:'NOT_ISSUED'});
  }catch{return stopped('BOUNDARY_OR_OUTCOME_UNKNOWN');}
 }});
}
