import type {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {ProjectSourceContentPolicyManagement} from '../../../apps/server/modules/documents/project-source-content-policy-management.ts';
import {createManagementOriginTransactionFence} from './source-content-management-origin-transaction-fence.ts';
import {managementOriginInspectionSql,runSourceContentManagementOriginJourney,type ManagementOriginJourneyContext} from './source-content-management-origin-journey.ts';

type JourneyInput=Pick<ManagementOriginJourneyContext,'origin'|'session'|'deniedSession'|'deniedCode'|'request'|'deniedRequest'|'readCommandId'>;
export interface ManagementOriginChildInput {
 /** 외부 감독이 공급·종결하는 원 Pool. 여기서 Pool 생성/end·연결 설정·역할/fixture 설치를 하지 않는다. */
 pool:Pool;
 assertCurrent():void;
 access:{installationId:string;key:Uint8Array};
 journey:JourneyInput;
 /** 별도 보호 observer의 원 연결/권한은 외부 책임이다. app Pool로 대체하지 않는다. */
 inspect:ManagementOriginJourneyContext['inspect'];
}
type Stage='PREPARE'|'JOURNEY'|'CLOSE'|'DONE';
export type ManagementOriginChildResult=Readonly<{
 status:'CHECKED'|'STOPPED';stage:Stage;reason:'JOURNEY_CHECKED'|'BOUNDARY_OR_OUTCOME_UNKNOWN'|'ATTEMPT_CONSUMED';authority:'NOT_ISSUED';
}>;

/** 명시 run만 원 app을 만든다. listen/환경/파일/IPC entry는 없고 합성 성공을 실제 PG 증거로 승격하지 않는다.
 * 프레임워크 종료는 이 함수가 만든 소켓 없는 앱에만 적용한다. DB/observer 소유권과 시간 제한은 감독이 유지한다. */
export function createManagementOriginChild(input:ManagementOriginChildInput){
 const {pool,assertCurrent,inspect}=input;
 const journey=structuredClone(input.journey),installationId=input.access.installationId,key=Buffer.from(input.access.key);
 let spent=false,closed=false;
 const boundary=()=>{if(input.pool!==pool||input.assertCurrent!==assertCurrent||input.inspect!==inspect||assertCurrent.call(input)!==undefined)throw Error('FN03_MANAGEMENT_CHILD_CURRENT');};
 const current=()=>{if(closed)throw Error('FN03_MANAGEMENT_CHILD_CURRENT');boundary();};
 const fence=createManagementOriginTransactionFence(pool,current);
 const args=Object.freeze([journey.request.projectId,journey.request.commandId,journey.deniedRequest.commandId]);
 const observed:ManagementOriginJourneyContext['inspect']=async(sql,parameters)=>{
  current();if(sql!==managementOriginInspectionSql||parameters.length!==3||parameters.some((value,index)=>value!==args[index]))throw Error('FN03_MANAGEMENT_CHILD_OBSERVER');
  const result=await inspect.call(input,managementOriginInspectionSql,args);current();return result;
 };
 return Object.freeze({settlements:fence.settlements,releases:fence.releases,async run():Promise<ManagementOriginChildResult>{
  const result=(status:'CHECKED'|'STOPPED',stage:Stage,reason:ManagementOriginChildResult['reason']):ManagementOriginChildResult=>Object.freeze({status,stage,reason,authority:'NOT_ISSUED'});
  if(spent)return result('STOPPED','PREPARE','ATTEMPT_CONSUMED');spent=true;
  let app:ReturnType<typeof buildApp>|undefined,stage:Stage='PREPARE',outcome=result('STOPPED','PREPARE','BOUNDARY_OR_OUTCOME_UNKNOWN');
  try{
   current();const access=new AccessRepository(fence.pool,{installationId,key});key.fill(0);current();
   // artifactRoot/webRoot 미제공: 이 목적은 문서 파일 reader나 외부 listen을 구성하지 않는다.
   app=buildApp({},undefined,{repository:access,origin:journey.origin});current();
   const service=new ProjectSourceContentPolicyManagement(access);
   stage='JOURNEY';await runSourceContentManagementOriginJourney({...journey,app,service,inspect:observed,assertCurrent:current,settlements:fence.settlements});current();
   outcome=result('CHECKED','DONE','JOURNEY_CHECKED');
  }catch{outcome=result('STOPPED',stage,'BOUNDARY_OR_OUTCOME_UNKNOWN');}
  finally{
   key.fill(0);closed=true;
   // 불명 뒤 새 DB 효과나 재시도는 없고 자기 Fastify 인스턴스만 한 번 닫는다.
   if(app)try{await app.close();}catch{outcome=result('STOPPED','CLOSE','BOUNDARY_OR_OUTCOME_UNKNOWN');}
   if(outcome.status==='CHECKED')try{boundary();}catch{outcome=result('STOPPED','CLOSE','BOUNDARY_OR_OUTCOME_UNKNOWN');}
  }
  return outcome;
 }});
}
