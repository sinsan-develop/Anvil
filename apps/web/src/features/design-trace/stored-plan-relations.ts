import type {TaskCard} from '../../../../server/modules/traceability/work-plan-card.ts';
type State='UNIQUE'|'MISSING'|'AMBIGUOUS'|'SELF';
export interface StoredPlanRelation{taskCode:string;direction:'PREREQUISITE'|'DEPENDENT';phase:'START'|'ACCEPTANCE';state:State}
/** 같은 고정 계획의 카드 선언만 읽는다. 실제 완료/허가·transitive 영향 판정은 아니다. */
export function storedPlanRelations(tasks:TaskCard[],code:string){
 const indexes=new Map<string,TaskCard[]>();for(const task of tasks)indexes.set(task.taskCode,[...(indexes.get(task.taskCode)??[]),task]);const current=indexes.get(code)??[];
 if(current.length!==1)return{state:current.length?'AMBIGUOUS':'MISSING',task:null,links:[]} as const;
 const task=current[0]!,links:StoredPlanRelation[]=[],state=(target:string):State=>target===code?'SELF':!indexes.has(target)?'MISSING':indexes.get(target)!.length!==1?'AMBIGUOUS':'UNIQUE';
 for(const[phase,field]of[['START','startPrerequisites'],['ACCEPTANCE','acceptancePrerequisites']]as const)for(const target of task[field])links.push({taskCode:target,direction:'PREREQUISITE',phase,state:state(target)});
 for(const next of tasks)for(const[phase,field]of[['START','startPrerequisites'],['ACCEPTANCE','acceptancePrerequisites']]as const)if(next[field].includes(code))links.push({taskCode:next.taskCode,direction:'DEPENDENT',phase,state:state(next.taskCode)});
 return{state:'UNIQUE' as const,task:structuredClone(task),links};
}
