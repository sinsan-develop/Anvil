import type {PoolClient} from 'pg';
import {recordV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
/** caller가 같은 인증 tx의 project/control 잠금을 확보한 뒤 새 지시 예약 전에 호출한다.
 * 과거 결과 조회는 차단하지 않는다. 만료·시간 경과로 중지 의도를 해제하거나 실제 회수를 추정하지 않는다. */
export async function assertNoStoredExecutionStop(db:PoolClient,scope:{projectId:string;executionId:string;executionGeneration:number}){
 if(!recordV1(scope,['projectId','executionId','executionGeneration'])||!uuidV1(scope.projectId)||!uuidV1(scope.executionId)||!Number.isSafeInteger(scope.executionGeneration)||scope.executionGeneration<1)throw new AuthFailure('EXECUTION_STOP_STATE_UNAVAILABLE',503);
 let rows:any[];try{rows=(await db.query("SELECT EXISTS(SELECT 1 FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->>'state'='STOP_REQUEST_STORED') AS stopped",[scope.projectId,scope.executionId,scope.executionGeneration])).rows;}catch{throw new AuthFailure('EXECUTION_STOP_STATE_UNAVAILABLE',503);}
 if(!Array.isArray(rows)||rows.length!==1||typeof rows[0]?.stopped!=='boolean')throw new AuthFailure('EXECUTION_STOP_STATE_UNAVAILABLE',503);
 if(rows[0].stopped)throw new AuthFailure('EXECUTION_STOP_REQUESTED',412);
}
