import type {PoolClient} from 'pg';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {AuthFailure} from '../access/repository.ts';
import {readApplicationSnapshot} from '../methodologies/application-snapshot.ts';
import type {KnowledgeScope} from './knowledge-entry.ts';
import type {MethodologyGraph} from '../../../../contracts/methodologies.ts';

// 관련성 참조는 실행 허가나 최신 기준 적용을 의미하지 않는다.
export async function verifyKnowledgeScope(db:PoolClient,pid:string,scope:KnowledgeScope,readPlan:(ref:VersionRef)=>Promise<{ref:VersionRef;tasks:{taskCode:string}[]}>){
  if(scope.projectId!==pid)throw new AuthFailure('KNOWLEDGE_SCOPE_NOT_FOUND',404);
  for(const stage of scope.stageRefs){
    const rows=(await db.query('SELECT * FROM anvil.project_methodologies WHERE project_id=$1 AND id=$2 AND application_version=$3',[pid,stage.applicationRef.id,stage.applicationRef.version])).rows;
    const application=readApplicationSnapshot(pid,rows);
    if(!application.applicationRef)throw new AuthFailure('KNOWLEDGE_SCOPE_NOT_FOUND',404);
    if(canonicalJson(application.applicationRef)!==canonicalJson(stage.applicationRef))throw new AuthFailure('KNOWLEDGE_SCOPE_MISMATCH',409);
    if(!(application.snapshot!.graph as MethodologyGraph).nodes.some(node=>node.nodeId===stage.nodeId))throw new AuthFailure('KNOWLEDGE_SCOPE_NOT_FOUND',404);
  }
  for(const task of scope.taskRefs){
    const plan=await readPlan(task.planRef);
    if(canonicalJson(plan.ref)!==canonicalJson(task.planRef))throw new AuthFailure('KNOWLEDGE_SCOPE_MISMATCH',409);
    const matches=plan.tasks.filter(item=>item.taskCode===task.taskCode).length;
    if(!matches)throw new AuthFailure('KNOWLEDGE_SCOPE_NOT_FOUND',404);
    if(matches!==1)throw new AuthFailure('KNOWLEDGE_SCOPE_AMBIGUOUS',422);
  }
}
