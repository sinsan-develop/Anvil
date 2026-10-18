import type { PoolClient } from 'pg';
import { canonicalJson } from '../../../../contracts/canonical.ts';
import { uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import type { ProjectAssignmentConfirmations } from '../assignments/project-assignment-confirmations.ts';
import type { ResponsibleSessions } from '../assignments/responsible-sessions.ts';
import type { ProjectExecutionPreparations } from './project-execution-preparations.ts';

/** 승인 C1 원문 조회의 화면용 집계. 최신 조회는 현재 실행 허가나 OS 사실이 아니다. */
export async function readExecutionPreparationState(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number,
  dependencies:{assignments:Pick<ProjectAssignmentConfirmations,'read'>;sessions:Pick<ResponsibleSessions,'readRole'|'readBinding'>;preparations:Pick<ProjectExecutionPreparations,'read'>}) {
  if(!uuidV1(projectId)||!uuidV1(id)||!Number.isSafeInteger(version)||version<1)throw new AuthFailure('INPUT_INVALID',400);
  await projectMember(db,actor,projectId);
  const assignment=await dependencies.assignments.read(db,actor,projectId,id,version);
  if(assignment.snapshot.contentConfirmed!==true||assignment.snapshot.executionAuthorized!==false||assignment.snapshot.dispatchPerformed!==false)throw new AuthFailure('VERSION_CONFLICT',409);
  const task=assignment.snapshot.definition.taskRef,stageRef={applicationRef:task.applicationRef,nodeId:task.nodeId};
  const roleRows=(await db.query("SELECT role_id,version FROM anvil.project_roles WHERE project_id=$1 AND (snapshot_json->>'kind'='COORDINATOR' OR snapshot_json->'stageRef'=$2::jsonb) ORDER BY role_id LIMIT 3",[projectId,JSON.stringify(stageRef)])).rows;
  if(roleRows.length>2)throw new AuthFailure('PROJECT_ROLE_INTEGRITY_FAILED',503);
  const roles:Awaited<ReturnType<ResponsibleSessions['readRole']>>[]=[];
  for(const row of roleRows)roles.push(await dependencies.sessions.readRole(db,actor,projectId,row.role_id,Number(row.version)));
  const bindingRows=roles.length?(await db.query('SELECT DISTINCT ON(role_id) binding_id,version FROM anvil.role_bindings WHERE project_id=$1 AND role_id=ANY($2::uuid[]) ORDER BY role_id,version DESC',[projectId,roles.map(r=>r.ref.id)])).rows:[];
  if(bindingRows.length>2)throw new AuthFailure('RESPONSIBLE_SESSION_INTEGRITY_FAILED',503);
  const bindings:Awaited<ReturnType<ResponsibleSessions['readBinding']>>[]=[];
  for(const row of bindingRows)bindings.push(await dependencies.sessions.readBinding(db,actor,projectId,row.binding_id,Number(row.version)));
  const preparationRows=(await db.query('SELECT id,version FROM anvil.execution_preparations WHERE project_id=$1 AND assignment_id=$2 AND assignment_version=$3 ORDER BY created_at DESC,id DESC LIMIT 21',[projectId,id,version])).rows;
  const preparations:Awaited<ReturnType<ProjectExecutionPreparations['read']>>[]=[];
  for(const row of preparationRows.slice(0,20))preparations.push(await dependencies.preparations.read(db,actor,projectId,row.id,Number(row.version)));
  const result={projectId,assignmentRef:assignment.ref,roles,bindings,preparations,hasMorePreparations:preparationRows.length>20,currentness:'NOT_RECHECKED' as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  if(Buffer.byteLength(canonicalJson(result),'utf8')>2*1024*1024)throw new AuthFailure('EXECUTION_STATE_TOO_LARGE',503);
  return result;
}
